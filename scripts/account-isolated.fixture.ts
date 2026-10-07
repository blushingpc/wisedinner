// TEST ONLY: no external URL/file DB and no credential/environment lookup.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { accountHandler, supabaseAccountRepository, type VerifiedAccount } from "../lib/account.ts";
import { supabaseBillingRepository } from "../lib/billing.ts";
import { deletionRepository, type DeletionTarget } from "../lib/account-deletion.ts";
import { supportOutboxRepository } from "../lib/support/outbox.ts";
import type { Outbound } from "../lib/support/mail.ts";
import { DRY_A, DRY_B, DRY_HASH, type DryPorts } from "./account-isolated-dry.ts";
import { migrationInventory, type MigrationPin } from "./account-isolated.ts";
import type { RestoreIntent } from "../lib/billing-restore.ts";

export type DryScenario = "normal" | "completion_ack" | "unknown_apple" | "none" | "unknown_linkage" | "missing_material" | "absent_auth" | "outbox_accept_ack" | "outbox_begin_ack" | "outbox_accept_before" | "smtp_unknown" | "restore_unbound" | "restore_unknown" | "restore_unrevoked" | "restore_commit_ack";
export async function memoryLifecycleFixture(inventory: MigrationPin[], scenario: DryScenario = "normal") {
  assert.deepEqual(inventory, await migrationInventory(), "trusted_migration_inventory_required");
  const db = await PGlite.create("memory://");
  const trace: string[] = [], sends: Outbound[] = [], targets: DeletionTarget[] = [];
  const effects = { apple: 0, auth: 0, smtp: 0, classified: 0 }, operations = new Set<string>();
  let closed = false, injected = false;
  try {
    // Minimal historical dependencies, not a replacement readiness schema.
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
      create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
      create table auth.users(id uuid primary key);
      create table public.data_snapshots(version integer primary key,url text not null,sha256 text not null);
      create table public.support_threads(id uuid primary key default gen_random_uuid(),channel text not null,from_email text not null,subject text not null default '',status text not null default 'open',message_id text,created_at timestamptz default now(),updated_at timestamptz default now());
      create unique index support_threads_message_id on public.support_threads(message_id)where message_id is not null;
      create table public.support_messages_v2(id uuid primary key default gen_random_uuid(),thread_id uuid references public.support_threads(id),direction text not null,body text not null,ai boolean default false,message_id text,created_at timestamptz default now());
      create unique index support_messages_v2_message_id on public.support_messages_v2(message_id)where message_id is not null;`);
    const executed: MigrationPin[] = [];
    for (const pin of inventory) {
      const bytes = await readFile(new URL(`../supabase/migrations/${pin.file}`, import.meta.url));
      assert.equal(createHash("sha256").update(bytes).digest("hex"), pin.sha256);
      assert.equal(bytes.length, pin.bytes);
      await db.exec(bytes.toString("utf8")); executed.push(pin);
    }
    await db.query("insert into public.wd_catalog_pins values('dry',5,$1,'dry','[\"main\"]')", [DRY_HASH]);
    if (scenario === "absent_auth") await db.query("insert into auth.users values($1)", [DRY_B]);
    else await db.query("insert into auth.users values($1),($2)", [DRY_A, DRY_B]);
    const query: DryPorts["query"] = async (role, id, sql, args = [], age = 0) => {
      try {
        return await db.transaction(async tx => {
          if (role !== "bootstrap") {
            await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role, sub: id, is_anonymous: false, iat: Math.floor(Date.now() / 1000), amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) - age }] })]);
            await tx.exec(`set local role ${role}`);
          }
          return (await tx.query<Record<string, unknown>>(sql, args)).rows;
        });
      } catch (e) { throw Error((e as { code?: string }).code === "42501" ? "sql_permission_denied" : "sql_unavailable"); }
    };
    const request: typeof fetch = async (url, init) => {
      const path = new URL(String(url)).pathname;
      assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error");
      assert.equal(init?.method, "POST");
      const command = JSON.parse(init!.body as string), token = new Headers(init!.headers).get("authorization")!.slice(7);
      const table: Record<string, string> = { wd_account_command: "wd_account_command", wd_billing_command: "wd_billing_command", wd_deletion_command: "wd_deletion_command", wd_support_progress: "wd_support_progress" };
      const name = path.split("/").pop()!; assert.equal(path, `/rest/v1/rpc/${table[name]}`);
      trace.push(`${name}:${command.p_action}`);
      const role = name === "wd_account_command" ? "authenticated" : "service_role";
      const id = role === "authenticated" ? token.slice("synthetic-".length) : null;
      const trip = (after: boolean) => {
        const match = scenario === "completion_ack" && name === "wd_deletion_command" && command.p_action === "complete" && after
          || scenario === "outbox_accept_ack" && name === "wd_support_progress" && command.p_action === "accept" && after
          || scenario === "outbox_begin_ack" && name === "wd_support_progress" && command.p_action === "begin" && after
          || scenario === "outbox_accept_before" && name === "wd_support_progress" && command.p_action === "accept" && !after;
        if (match && !injected) { injected = true; trace.push("synthetic_ack_failure"); throw Error("synthetic_boundary_failure"); }
      };
      trip(false);
      const args = [command.p_action, JSON.stringify(command.p_body), ...(name === "wd_account_command" ? [command.p_key] : [])];
      const r = await query(role, id, `select public.${table[name]}($1,$2::jsonb${name === "wd_account_command" ? ",$3::uuid" : ""}) r`, args);
      if (!(r[0].r as { error?: string }).error) trip(true);
      return Response.json(r[0].r);
    };
    const verify = async (r: Request): Promise<VerifiedAccount> => {
      const token = r.headers.get("authorization")?.slice(7) ?? "";
      const stale = token.endsWith("-stale"), id = token.slice("synthetic-".length).replace(/-stale$/, "");
      assert([DRY_A, DRY_B].includes(id)); trace.push(stale ? "emulated_verified_stale_AMR" : "emulated_verified_AMR");
      return { id, token: `synthetic-${id}`, authenticatedAt: Math.floor(Date.now() / 1000) - (stale ? 301 : 0), providers: [] };
    };
    const adapter = (dep: "apple" | "auth") => ({ async run(target: DeletionTarget) {
      targets.push(structuredClone(target)); assert.equal(target.userId, DRY_A); assert.equal(target.identityHash, DRY_HASH);
      trace.push(`fake_${dep}_run`);
      if (scenario === "missing_material" && dep === "apple") return { ...target, outcome: "not_started" as const, evidenceHash: "b".repeat(64) };
      if (scenario === "absent_auth" && dep === "auth") {
        // Explicit fake adapter checks absence. No real provider capability is asserted.
        assert.equal((await query("bootstrap", null, "select id from auth.users where id=$1", [DRY_A])).length, 0);
        trace.push("fake_auth_verified_absent");
        return { ...target, outcome: "already_absent" as const, evidenceHash: "b".repeat(64) };
      }
      assert(!operations.has(target.operationId), "duplicate_physical_fake_effect"); operations.add(target.operationId); effects[dep]++;
      if (dep === "auth") await query("bootstrap", null, "delete from auth.users where id=$1", [DRY_A]);
      return { ...target, outcome: scenario === "unknown_apple" && dep === "apple" ? "unknown" as const : "confirmed" as const, evidenceHash: "b".repeat(64) };
    } });
    const seen = new Set<number>();
    const ports: DryPorts = {
      target: "memory://", query,
      account: accountHandler({ verify, repository: supabaseAccountRepository("https://dry.invalid", "synthetic", request), pin: { version: 5, sha256: DRY_HASH, solverRevision: "dry", catalogRevision: "dry", recipeIds: new Set(["main"]) } }),
      billing: supabaseBillingRepository("https://dry.invalid", "synthetic", request),
      restoreVerify: async r => ({ ...await verify(r), providers: ["apple"] }), // Emulated signed-in subject only, not Auth proof.
      restore: { execute: async (action, body) => {
        trace.push(`wd_restore_command:${action}`);
        const rows = await query("service_role", null, "select public.wd_restore_command($1,$2::jsonb) r", [action, JSON.stringify(body)]);
        const result = rows[0].r as Record<string, unknown>;
        if (result.error) throw Error(result.error as string);
        if (scenario === "restore_commit_ack" && action === "commit" && !injected) { injected = true; trace.push("synthetic_restore_commit_ack_loss"); throw Error("synthetic_boundary_failure"); }
        return result;
      } },
      ...(scenario === "restore_unbound" ? {} : { restoreProof: { observe: async (i: Readonly<RestoreIntent>, mode: "inspect" | "reconcile") => {
        trace.push(`fake_restore_observe:${mode}`);
        if (scenario === "restore_unknown") throw Error("synthetic_restore_unknown");
        const source = await supabaseBillingRepository("https://dry.invalid", "synthetic", request).bind(DRY_A);
        return { operation: i.operation, sourceBinding: source.appUserId, targetBinding: i.targetBinding, environment: i.environment, app: i.app, product: i.product, entitlement: i.entitlement, store: "app_store", sourceRoot: "c".repeat(64), targetRoot: "c".repeat(64), sourceTransaction: DRY_HASH, targetTransaction: "d".repeat(64), originalPurchaseAt: 946684800000, observedAt: Date.now(), expiresAt: Date.now() + 86400000, ownership: "PURCHASED", sourceRevoked: scenario !== "restore_unrevoked", state: "active", refunded: false };
      } } }),
      deletion: deletionRepository("https://dry.invalid", "synthetic", request),
      providers: { verifyIdentity: async userId => { trace.push("fake_identity_verified"); return { userId, identityHash: DRY_HASH, evidenceHash: "b".repeat(64), apple: scenario === "none" || scenario === "absent_auth" ? "none" : scenario === "unknown_linkage" ? "unknown" : "linked" }; }, apple: adapter("apple"), auth: adapter("auth") },
      outbox: supportOutboxRepository("https://dry.invalid", "synthetic", request),
      mail: { unread: async () => seen.has(1) ? [] : [{ uid: 1, messageId: "dry-inbound", from: "synthetic@example.invalid", subject: "Fixture", text: "Question", date: "2000-01-01" }], markSeen: async uid => { seen.add(uid); trace.push("fake_seen"); }, send: async payload => {
        assert.deepEqual(payload, (await query("bootstrap", null, "select payload from public.wd_support_work"))[0].payload, "send_matches_frozen_SQL_payload");
        sends.push(structuredClone(payload)); effects.smtp++; trace.push("fake_smtp_effect");
        if (scenario === "smtp_unknown") throw Error("synthetic_SMTP_unknown");
        return { messageId: "dry-smtp-1" };
      } },
      classify: async () => { effects.classified++; trace.push("fake_classify"); return { intent: "informational", category: "other", reason: "fixture", reply: "Prices are estimates." }; },
      close: async () => { if (!closed) { closed = true; await db.close(); trace.push("memory_closed"); } },
    };
    return { ports, trace, sends, targets, effects, executed, get closed() { return closed; } };
  } catch { await db.close(); throw Error("memory_fixture_unavailable"); }
}
