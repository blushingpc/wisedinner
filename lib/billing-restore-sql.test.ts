import test from "node:test";
import assert from "node:assert/strict";
import { readFile, access } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { randomUUID } from "node:crypto";
import { reconcileExplicitRestore, requestExplicitRestore } from "./billing-restore.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const K = "20000000-0000-4000-8000-000000000001";
// Credential-free ephemeral memory; claims are emulated, not hosted Auth/PostgREST proof.
async function setup() {
  const db = await PGlite.create("memory://");
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema auth; grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
    create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
    create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;`);
  for (const file of ["0006_wd_accounts.sql", "0007_wd_billing.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  const login = async (role: string, id?: string) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role, sub: id, is_anonymous: false })]);
    await db.exec(`set role ${role}`);
  };
  for (const id of [A, B]) { await login("authenticated", id); await db.query("select public.wd_account_command('initialize','{}',$1)", [K]); }
  await login("service_role");
  const bill = async (action: string, body: unknown) => (await db.query<{ result: Record<string, unknown> }>("select public.wd_billing_command($1,$2::jsonb) result", [action, JSON.stringify(body)])).rows[0].result;
  const a = await bill("bind", { userId: A }), b = await bill("bind", { userId: B });
  const file = new URL("../supabase/migrations/0014_wd_billing_restore.sql", import.meta.url);
  await db.exec("reset role"); // Apply UNAPPLIED text only as ephemeral schema owner, not service-role runtime.
  try { await access(file); await db.exec(await readFile(file, "utf8")); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await login("service_role");
  const restore = async (action: string, body: unknown) => (await db.query<{ result: Record<string, unknown> }>("select public.wd_restore_command($1,$2::jsonb) result", [action, JSON.stringify(body)])).rows[0].result;
  return { db, login, bill, restore, a, b };
}

test("original billing path holds transfers and cannot express explicit restore authority", async () => {
  const { db, bill, a } = await setup();
  try {
    assert.equal((await bill("restore", { userId: B })).error, "invalid_command");
    assert.equal((await bill("enqueue", { id: "fixture-transfer", fingerprint: "a".repeat(64), type: "TRANSFER", environment: "PRODUCTION", timestamp: Date.now(), appUserIds: [a.appUserId], identityHold: true })).status, "held");
    assert.equal(((await bill("begin", { userId: A, environment: "PRODUCTION" })).binding as { held: boolean }).held, true);
  } finally { await db.close(); }
});

test("durable explicit restore prerequisite exists independently of the old client command", async () => {
  const { db } = await setup();
  try {
    const row = (await db.query<{ present: boolean }>("select to_regprocedure('public.wd_restore_command(text,jsonb)') is not null present")).rows[0];
    assert.equal(row.present, true, "missing server-internal durable intent/reconciliation seam");
  } finally { await db.close(); }
});

async function fixture(target = B) {
  const f = await setup();
  const now = Date.now(), oldHash = "a".repeat(64), nextHash = "b".repeat(64), root = "c".repeat(64);
  const begin = await f.bill("begin", { userId: A, environment: "PRODUCTION" });
  assert.equal((await f.bill("commit", { userId: A, environment: "PRODUCTION", generation: begin.generation, state: { state: "active", expiresAt: now + 86400000, observedAt: now, reason: "provider_verified", transactionHash: oldHash } })).state, "active");
  const scope = { environment: "PRODUCTION" as const, app: "fixture_app", product: "fixture_monthly", entitlement: "fixture_pro" };
  const operation = randomUUID(), lease = randomUUID();
  const requested = await f.restore("intent", { operation, target, ...scope });
  assert.equal(requested.status, "pending");
  const claim = await f.restore("claim", { operation, lease });
  const command = { operation, lease, attempt: claim.attempt };
  const proof = { operation, sourceBinding: f.a.appUserId, targetBinding: target === A ? f.a.appUserId : f.b.appUserId, ...scope, store: "app_store", sourceRoot: root, targetRoot: root, sourceTransaction: oldHash, targetTransaction: nextHash, originalPurchaseAt: now - 86400000, observedAt: Date.now(), expiresAt: now + 86400000, ownership: "PURCHASED", sourceRevoked: target !== A, state: "active", refunded: false };
  const state = async () => (await f.db.query<Record<string, unknown>>("select user_id,environment,generation,held,state from public.wd_billing_states order by user_id,environment")).rows;
  const admin = async (sql: string, args: unknown[] = []) => { await f.db.exec("reset role"); const r = await f.db.query<Record<string, unknown>>(sql, args); await f.login("service_role"); return r; };
  return { ...f, operation, lease, command, proof, scope, state, admin, oldHash, nextHash, root, requested };
}

test("actual SQL atomic old/new and same-owner reconciliation; retries, planning, environment and holds preserved", async () => {
  for (const target of [A, B]) {
    const f = await fixture(target);
    try {
      await f.admin("create table unrelated_sentinel(value text)");
      await f.admin("insert into unrelated_sentinel values('unchanged')");
      const week = { recipeIds: Array(15).fill("fixture"), snapshotSha256: "d".repeat(64), solverRevision: "fixture", catalogRevision: "fixture", checks: [true, false] };
      await f.admin("insert into wd_saved_weeks(user_id,id,revision,week) values($1,$2,1,$3::jsonb)", [A, K, JSON.stringify(week)]);
      await f.bill("begin", { userId: A, environment: "SANDBOX" });
      await f.admin("update wd_billing_states set held=true where user_id=$1 and environment='PRODUCTION'", [A]);
      await f.admin("insert into wd_billing_transactions values('PRODUCTION',$1,$2)", ["e".repeat(64), A]);
      const planning = (await f.admin("select * from wd_saved_weeks order by user_id,id")).rows;
      const prefs = (await f.admin("select * from wd_accounts order by user_id")).rows;
      const sandbox = (await f.admin("select * from wd_billing_states where environment='SANDBOX'")).rows;
      assert.equal((await f.restore("prepare", { ...f.command, proof: f.proof })).status, "prepared");
      const malformed = (await f.db.query<{ result: Record<string, unknown> }>("select wd_restore_command(null,$1::jsonb) result", [JSON.stringify(f.command)])).rows[0].result;
      assert.equal(malformed.error, "invalid_command", "NULL action cannot fall through to commit");
      assert.equal((await f.restore("commit", f.command)).status, "completed");
      assert.equal((await f.restore("commit", f.command)).status, "completed");
      const rows = await f.state();
      assert.equal(rows.filter(r => r.environment === "PRODUCTION" && (r.state as { state: string }).state === "active").length, 1);
      assert.equal((rows.find(r => r.user_id === target && r.environment === "PRODUCTION")!.state as { transactionHash: string }).transactionHash, f.nextHash);
      assert.equal(rows.find(r => r.user_id === A && r.environment === "PRODUCTION")!.held, true, "existing hold never cleared");
      assert.deepEqual((await f.admin("select * from wd_saved_weeks order by user_id,id")).rows, planning);
      assert.deepEqual((await f.admin("select * from wd_accounts order by user_id")).rows, prefs);
      assert.deepEqual((await f.admin("select * from wd_billing_states where environment='SANDBOX'")).rows, sandbox);
      assert.equal((await f.admin("select * from unrelated_sentinel")).rows[0].value, "unchanged");
      assert.equal((await f.admin("select user_id from wd_billing_transactions where transaction_hash=$1", ["e".repeat(64)])).rows[0].user_id, A);
      assert.equal(Number((await f.admin("select original_purchase_ms from wd_restore_lineages")).rows[0].original_purchase_ms), f.proof.originalPurchaseAt);
      // A new renewal hash cannot bypass durable lineage fencing in either participant's old path.
      const fresh = await f.bill("begin", { userId: target, environment: "PRODUCTION" });
      const replay = await f.bill("commit", { userId: target, environment: "PRODUCTION", generation: fresh.generation, state: { state: "active", observedAt: Date.now(), expiresAt: Date.now() + 1000000, reason: "provider_verified", transactionHash: "f".repeat(64) } });
      assert.ok(replay.error === "invalid_command" || replay.reason === "identity_review_required");
      assert.equal((await f.admin("select * from wd_billing_transactions where transaction_hash=$1", ["f".repeat(64)])).rows.length, 0);
    } finally { await f.db.close(); }
  }
});

test("SQL rejects client/RPC access, missing intent, idempotency changes, forged and malformed proof durably", async () => {
  const f = await fixture();
  try {
    for (const role of ["anon", "authenticated"]) {
      await f.login(role, B);
      for (const table of ["wd_restore_intents", "wd_restore_lineages", "wd_restore_aliases", "wd_restore_fences"]) await assert.rejects(f.db.query(`select * from ${table}`), /permission denied/);
      await assert.rejects(f.restore("intent", { operation: f.operation }), /permission denied/);
    }
    await f.login("service_role");
    await assert.rejects(f.db.query("select * from wd_restore_intents"), /permission denied/);
    assert.equal((await f.restore("claim", { operation: randomUUID(), lease: randomUUID() })).error, "intent_required");
    assert.equal((await f.restore("intent", { operation: f.operation, target: A, ...f.scope })).error, "idempotency_conflict");
    assert.equal((await f.restore("intent", { operation: f.operation, target: B, ...f.scope, product: "changed" })).error, "idempotency_conflict");
    const variants = [
      { sourceRevoked: false }, { ownership: "FAMILY_SHARED" }, { sourceBinding: `wd_${K}` }, { targetBinding: f.a.appUserId }, { sourceRoot: null }, { targetRoot: "d".repeat(64) },
      { sourceTransaction: "raw-transaction" }, { targetTransaction: null }, { app: "other" }, { product: "other" }, { entitlement: "other" }, { store: "test_store" }, { environment: "SANDBOX" },
      { observedAt: Date.now() + 100000 }, { observedAt: Date.now() - 300001 }, { originalPurchaseAt: -1 }, { originalPurchaseAt: 0.5 }, { expiresAt: Date.now() - 1 }, { refunded: true }, { verified: true }, { receipt: "forbidden" }, { sourceRevoked: null }
    ];
    for (const delta of variants) {
      await f.admin("update wd_restore_intents set lease_until_ms=null where operation=$1", [f.operation]);
      // Each independent malformed case uses a new bounded explicit operation, not unlimited retries.
      const operation = randomUUID(), lease = randomUUID();
      await f.restore("intent", { operation, target: B, ...f.scope });
      const claim = await f.restore("claim", { operation, lease });
      const command = { operation, lease, attempt: claim.attempt };
      const bad = { ...f.proof, operation, observedAt: Date.now(), ...delta };
      assert.equal((await f.restore("prepare", { ...command, proof: bad })).status, "held", JSON.stringify(Object.keys(delta)));
      assert.equal((await f.restore("read", { operation })).status, "held");
    }
    assert.equal((await f.admin("select * from wd_restore_lineages")).rows.length, 0);
    assert.equal((await f.state()).filter(r => (r.state as { state: string }).state === "active").length, 1);
  } finally { await f.db.close(); }
});

test("SQL lease/generation/deletion fences and interrupted atomic commit retain old owner", async () => {
  for (const mutation of ["target_generation", "source_generation", "target_delete", "source_delete", "interrupt", "lease"]) {
    const f = await fixture();
    try {
      assert.equal((await f.restore("prepare", { ...f.command, proof: f.proof })).status, "prepared");
      if (mutation === "target_generation") await f.bill("begin", { userId: B, environment: "PRODUCTION" });
      if (mutation === "source_generation") await f.bill("begin", { userId: A, environment: "PRODUCTION" });
      if (mutation.endsWith("delete")) await f.admin("update wd_accounts set state='deletion_pending' where user_id=$1", [mutation === "target_delete" ? B : A]);
      if (mutation === "lease") await f.admin("update wd_restore_intents set lease_until_ms=0 where operation=$1", [f.operation]);
      if (mutation === "interrupt") {
        await f.admin(`create function fixture_interrupt() returns trigger language plpgsql as $$ begin if new.user_id='${B}' then raise check_violation using message='fixture_interruption'; end if; return new; end $$`);
        await f.admin("create trigger fixture_interrupt before update on wd_billing_states for each row execute function fixture_interrupt()");
      }
      const before = await f.state();
      const result = await f.restore("commit", f.command);
      assert.ok(result.status === "held" || result.error === "invalid_command" || result.error === "account_inactive");
      assert.deepEqual(await f.state(), before);
      assert.equal((await f.admin("select * from wd_restore_lineages")).rows.length, 0);
      assert.equal((await f.admin("select user_id from wd_billing_transactions where transaction_hash=$1", [f.oldHash])).rows[0].user_id, A);
    } finally { await f.db.close(); }
  }
});

test("private actual orchestration uses explicit verified target and durably holds absent/unknown proof; read-only retry completes", async () => {
  const f = await fixture();
  try {
    // Release fixture's lease; runtime issues a fresh claim, retaining the explicit intent.
    await f.restore("hold", { ...f.command, reason: "proof_unavailable" });
    const repository = { execute: f.restore };
    assert.equal((await reconcileExplicitRestore(f.operation, repository)).reason, "proof_unavailable");
    const modes: string[] = [];
    assert.equal((await reconcileExplicitRestore(f.operation, repository, { observe: async (_i, mode) => { modes.push(mode); throw Error("synthetic timeout"); } })).reason, "outcome_unknown");
    const frozen = structuredClone(f.proof);
    assert.equal((await reconcileExplicitRestore(f.operation, repository, { observe: async (i, mode) => { modes.push(mode); return { ...f.proof, observedAt: Math.max(Date.now(), i.createdAt) }; } })).status, "completed");
    assert.deepEqual(f.proof, frozen); assert.deepEqual(modes, ["reconcile", "reconcile"]);
    assert.equal((await reconcileExplicitRestore(f.operation, repository, { observe: async () => { throw Error("must not replay"); } })).status, "completed");
    const req = () => new Request("https://fixture.invalid/internal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent: "restore" }) });
    const deps = { repository, scope: f.scope, verify: async () => ({ id: B, token: "synthetic-not-used", authenticatedAt: 1, providers: ["apple"] }) };
    const operation = randomUUID();
    assert.equal((await requestExplicitRestore(req(), operation, deps)).targetBinding, f.b.appUserId);
    await assert.rejects(requestExplicitRestore(new Request("https://fixture.invalid/login"), randomUUID(), deps), /explicit_restore_required/);
    await assert.rejects(requestExplicitRestore(new Request("https://fixture.invalid/internal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ intent: "restore", target: A, verified: true }) }), randomUUID(), deps), /unknown_field/);
  } finally { await f.db.close(); }
});

test("stable lineage survives renewal changes; date/root/payload conflicts, reordered leases and expiry cannot transfer", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.restore("commit", f.command)).status, "held", "no prepared proof cannot commit");
    let lease = randomUUID();
    let claim = await f.restore("claim", { operation: f.operation, lease });
    let command = { operation: f.operation, lease, attempt: claim.attempt };
    assert.equal((await f.restore("prepare", { ...command, proof: f.proof })).status, "prepared");
    assert.equal((await f.restore("commit", { ...command, lease: randomUUID() })).reason, "stale_lease");
    assert.equal((await f.restore("commit", { ...command, attempt: 1 })).reason, "stale_lease");
    assert.equal((await f.restore("commit", command)).status, "completed");
    const complete = await f.state();
    const requested = await f.restore("intent", { operation: f.operation, target: B, ...f.scope });
    assert.equal(requested.status, "completed");
    assert.equal((await f.restore("commit", { ...command, proof: f.proof })).error, "invalid_command", "ignored changed payload is forbidden");
    assert.deepEqual(await f.state(), complete);
    // Register a different renewal only through the same original lineage; never reset original purchase time.
    for (const delta of [{ originalPurchaseAt: f.proof.originalPurchaseAt + 1 }, { sourceRoot: "d".repeat(64), targetRoot: "d".repeat(64) }, {}]) {
      const operation = randomUUID(); lease = randomUUID();
      await f.restore("intent", { operation, target: A, ...f.scope });
      claim = await f.restore("claim", { operation, lease }); command = { operation, lease, attempt: claim.attempt };
      const proof = { ...f.proof, operation, sourceBinding: f.b.appUserId, targetBinding: f.a.appUserId, sourceTransaction: f.nextHash, targetTransaction: "d".repeat(64), observedAt: Date.now(), ...delta };
      const prepared = await f.restore("prepare", { ...command, proof });
      if (Object.keys(delta).length) { assert.equal(prepared.status, "held"); assert.deepEqual(await f.state(), complete); }
      else { assert.equal(prepared.status, "prepared"); assert.equal((await f.restore("commit", command)).status, "completed"); }
    }
    const after = await f.state();
    assert.equal(after.filter(r => (r.state as { state: string }).state === "active").length, 1);
    assert.equal((after.find(r => r.user_id === A)!.state as { transactionHash: string }).transactionHash, "d".repeat(64));
    assert.equal(Number((await f.admin("select original_purchase_ms from wd_restore_lineages")).rows[0].original_purchase_ms), f.proof.originalPurchaseAt);
    const operation = randomUUID();
    await f.restore("intent", { operation, target: B, ...f.scope });
    await f.admin("update wd_restore_intents set expires_ms=0 where operation=$1", [operation]);
    assert.equal((await f.restore("claim", { operation, lease: randomUUID() })).reason, "intent_expired");
    assert.equal((await f.restore("read", { operation })).status, "held");
    assert.deepEqual(await f.state(), after);
  } finally { await f.db.close(); }
});
