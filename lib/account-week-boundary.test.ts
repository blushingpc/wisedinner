import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { migrationInventory } from "../scripts/account-isolated.ts";
import { parseWeeks } from "../../wisedinner-app/src/account/contract.ts";
import { accountHandler, AccountError } from "./account.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const W = "30000000-0000-4000-8000-000000000001", OLD = "30000000-0000-4000-8000-000000000002";
const metadata = () => ({ snapshotVersion: 5, snapshotSha256: "a".repeat(64), solverRevision: "solver-test", catalogRevision: "catalog-test", recipeIds: Array<string>(15).fill("main"), seed: 7 });
const hybrid = () => ({ ...metadata(), answers: null, draft: {}, week: null, checks: {} });
const baseline = process.argv.includes("--baseline");
const migration = new URL("../supabase/migrations/0015_wd_week_metadata_boundary.sql", import.meta.url);

test("additive RPC body changes only by the reviewed pre-receipt guard", { skip: baseline }, async () => {
  const old = await readFile(new URL("../supabase/migrations/0006_wd_accounts.sql", import.meta.url), "utf8"), next = await readFile(migration, "utf8");
  const body = (sql: string) => sql.slice(sql.indexOf("returns jsonb language plpgsql security definer"), sql.indexOf("revoke all on function public.wd_account_command"));
  const guard = body(next).match(/  -- Validate before replay:[\s\S]*?(?=  select \* into receipt)/)?.[0];
  assert(guard); assert.deepEqual(body(next).replace(guard, ""), body(old));
  assert(next.includes("not valid;")); assert(!next.includes("validate constraint"));
});

// One ephemeral connection, synthetic claims only. No URL/env/provider/file database.
async function fixture() {
  const db = await PGlite.create("memory://");
  try {
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
    for (const p of await migrationInventory()) await db.exec(await readFile(new URL(`../supabase/migrations/${p.file}`, import.meta.url), "utf8"));
    await db.query("insert into public.wd_catalog_pins values('catalog-test',5,$1,'solver-test','[\"main\"]')", ["a".repeat(64)]);
    let sequence = 0;
    const key = () => `20000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
    const login = async (role = "authenticated", owner: string | null = A, age = 0, anonymous = false) => {
      assert(["authenticated", "anon", "service_role"].includes(role));
      await db.exec("reset role");
      await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role, sub: owner, is_anonymous: anonymous, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) - age }] })]);
      await db.exec(`set role ${role}`);
    };
    const command = async (action: string, body: unknown, id: string | null = key()) => (await db.query<{ r: Record<string, unknown> }>("select public.wd_account_command($1,$2::jsonb,$3::uuid) r", [action, JSON.stringify(body), id])).rows[0].r;
    for (const id of [A, B]) { await login("authenticated", id); assert.equal((await command("initialize", {})).revision, 1); }
    await login();
    const rows = async () => {
      await db.exec("reset role");
      const r = await db.query("select * from (select 'weeks' kind,to_jsonb(w) data from public.wd_saved_weeks w union all select 'receipts',to_jsonb(r) from public.wd_account_receipts r) state order by kind,data::text");
      await login(); return r.rows;
    };
    return { db, key, login, command, rows };
  } catch (e) { await db.close(); throw e; }
}

test("same refusal assertion: direct SQL must not persist nested full-state hybrid", async () => {
  const f = await fixture();
  try {
    if (!baseline) { await f.db.exec("reset role"); await f.db.exec(await readFile(migration, "utf8")); await f.login(); }
    const before = await f.rows();
    const result = await f.command("save_week", { id: W, revision: 0, week: hybrid() });
    if (baseline) {
      assert.equal(result.revision, 1, "original SQL accepts hybrid");
      const stored = await f.command("list_weeks", { limit: 20, before: null }, null);
      assert.deepEqual((stored.weeks as Array<{ week: unknown }>)[0].week, hybrid());
      assert.doesNotThrow(() => parseWeeks({ weeks: [{ id: W, revision: 1, week: metadata() }] }));
      assert.throws(() => parseWeeks(stored), /invalid/);
      console.log("BASELINE: hybrid stored; unchanged actual app parseWeeks refuses");
    }
    assert.deepEqual(result, { error: "invalid_command" }, "direct SQL must refuse nested full-state metadata");
    assert.deepEqual(await f.rows(), before);
  } finally { await f.db.close(); }
});

test("0015 strict metadata, receipts, RLS, CAS, historical holds and rollback", { skip: baseline }, async t => {
  const f = await fixture();
  try {
    const oldKey = f.key(), oldBody = { id: OLD, revision: 0, week: hybrid() };
    assert.equal((await f.command("save_week", oldBody, oldKey)).revision, 1);
    const priorValid = { id: "30000000-0000-4000-8000-000000000003", revision: 0, week: metadata() }, priorKey = f.key();
    const priorAck = await f.command("save_week", priorValid, priorKey);
    const oldBytes = await f.rows();
    await f.db.exec("reset role"); await f.db.exec(await readFile(migration, "utf8")); await f.login();
    await t.test("NOT VALID preserves old incompatible row and receipt; malformed replay refused", async () => {
      assert.deepEqual(await f.rows(), oldBytes);
      assert.equal((await f.command("save_week", oldBody, oldKey)).error, "invalid_command");
      assert.deepEqual(await f.rows(), oldBytes);
      assert.throws(() => parseWeeks({ weeks: [{ id: OLD, revision: 1, week: hybrid() }] }));
      await f.db.exec("reset role");
      assert.equal((await f.db.query<{ convalidated: boolean }>("select convalidated from pg_constraint where conname='wd_saved_week_metadata_v1'")).rows[0].convalidated, false);
      await assert.rejects(f.db.query("update public.wd_saved_weeks set updated_at=now() where id=$1", [OLD]), /check constraint/);
      await f.login(); assert.deepEqual(await f.rows(), oldBytes);
      assert.deepEqual(await f.command("save_week", priorValid, priorKey), priorAck); assert.deepEqual(await f.rows(), oldBytes);
    });
    const invalid: Array<[string, unknown]> = [];
    for (const field of Object.keys(metadata())) { const w: Record<string, unknown> = metadata(); delete w[field]; invalid.push([`missing ${field}`, w]); }
    for (const field of ["snapshotVersion", "seed"]) for (const value of [null, "5", -1, 0.5, 2147483648, {}, []]) invalid.push([`${field} ${JSON.stringify(value)}`, { ...metadata(), [field]: value }]);
    invalid.push(["zero version", { ...metadata(), snapshotVersion: 0 }], ["uppercase hash", { ...metadata(), snapshotSha256: "A".repeat(64) }], ["wrong hash", { ...metadata(), snapshotSha256: "b".repeat(64) }]);
    for (const field of ["snapshotSha256", "solverRevision", "catalogRevision"]) for (const value of [5, null, {}, "", "x".repeat(129), "bad space"]) invalid.push([`${field} ${JSON.stringify(value)}`, { ...metadata(), [field]: value }]);
    for (const value of [null, {}, "main", [], Array(14).fill("main"), Array(16).fill("main"), [...Array(14).fill("main"), 7], [...Array(14).fill("main"), "unknown"], [...Array(14).fill("main"), "bad space"]]) invalid.push([`recipeIds ${JSON.stringify(value)}`, { ...metadata(), recipeIds: value }]);
    invalid.push(["owner injection", { ...metadata(), userId: B }], ["tier injection", { ...metadata(), tier: "protein" }], ["oversize", { ...metadata(), extra: "x".repeat(17000) }], ["null week", null], ["array week", []]);
    for (const [label, week] of invalid) await t.test(label, async () => {
      const before = await f.rows(); assert.equal((await f.command("save_week", { id: W, revision: 0, week })).error, "invalid_command"); assert.deepEqual(await f.rows(), before);
    });
    for (const revision of [null, "0", -1, 0.5, 2147483648]) await t.test(`command revision ${JSON.stringify(revision)}`, async () => {
      const before = await f.rows(); assert.equal((await f.command("save_week", { id: W, revision, week: metadata() })).error, "invalid_command"); assert.deepEqual(await f.rows(), before);
    });
    await t.test("raw decimal tokens cannot be silently rounded by integer casts", async () => {
      for (const field of ["snapshotVersion", "seed", "revision"]) {
        const before = await f.rows(), body = JSON.stringify({ id: W, revision: 0, week: metadata() }).replace(`\"${field}\":${field === "snapshotVersion" ? 5 : field === "seed" ? 7 : 0}`, `\"${field}\":${field === "snapshotVersion" ? "5.0" : field === "seed" ? "7.0" : "0.0"}`);
        const r = (await f.db.query<{ r: { error: string } }>("select public.wd_account_command('save_week',$1::jsonb,$2::uuid) r", [body, f.key()])).rows[0].r;
        assert.equal(r.error, "invalid_command"); assert.deepEqual(await f.rows(), before);
      }
    });
    await t.test("exact outer fields and UUID types", async () => {
      for (const body of [{ id: W, revision: 0, week: metadata(), owner: B }, { revision: 0, week: metadata() }, { id: W, week: metadata() }, { id: 3, revision: 0, week: metadata() }, { id: "30000000-0000-0000-0000-000000000001", revision: 0, week: metadata() }]) {
        const before = await f.rows(); assert.equal((await f.command("save_week", body)).error, "invalid_command"); assert.deepEqual(await f.rows(), before);
      }
    });
    const valid = { id: W, revision: 0, week: metadata() }, receipt = f.key();
    await t.test("valid metadata app round-trip, repeated meal IDs and receipt stability", async () => {
      const ack = await f.command("save_week", valid, receipt); assert.deepEqual(ack, { revision: 1, nutritionalProof: false });
      const before = await f.rows(); assert.deepEqual(await f.command("save_week", valid, receipt), ack); assert.deepEqual(await f.rows(), before);
      const listed = await f.command("list_weeks", { limit: 20, before: null }, null);
      const validRows = (listed.weeks as Array<{ id: string }>).filter(w => w.id === W);
      assert.deepEqual(parseWeeks({ weeks: validRows }), [{ id: W, revision: 1, week: metadata() }]);
      assert.equal((await f.command("save_week", { ...valid, week: { ...metadata(), seed: 8 } }, receipt)).error, "idempotency_conflict");
      assert.equal((await f.command("save_week", valid)).error, "revision_conflict"); assert.deepEqual(await f.rows(), before);
    });
    await t.test("unchanged HTTP rejects hybrid before RPC and valid metadata reaches guarded SQL", async () => {
      let calls = 0;
      const handler = accountHandler({ verify: async () => ({ id: A, token: "synthetic", authenticatedAt: Math.floor(Date.now() / 1000), providers: [] }), pin: { version: 5, sha256: "a".repeat(64), solverRevision: "solver-test", catalogRevision: "catalog-test", recipeIds: new Set(["main"]) }, repository: { execute: async (_owner, c) => {
        calls++; const r = await f.command(c.action, c.body, c.key); if (r.error) throw new AccountError(400, String(r.error)); return r;
      } } });
      const request = (week: unknown) => new Request("https://fixture.invalid/api/v1/account/weeks", { method: "POST", headers: { "content-type": "application/json", "idempotency-key": f.key() }, body: JSON.stringify({ ...priorValid, revision: 1, week }) });
      const before = await f.rows(); assert.equal((await handler(request(hybrid()))).status, 400); assert.equal(calls, 0); assert.deepEqual(await f.rows(), before);
      assert.equal((await handler(request(metadata()))).status, 200); assert.equal(calls, 1);
    });
    await t.test("integer extremes and CAS preserve newer committed owner data", async () => {
      const next = { ...valid, revision: 1, week: { ...metadata(), seed: 2147483647 } }; assert.equal((await f.command("save_week", next)).revision, 2);
      const before = await f.rows(); assert.equal((await f.command("save_week", { ...next, week: metadata() })).error, "revision_conflict"); assert.deepEqual(await f.rows(), before);
      assert.equal((await f.command("save_week", { ...valid, revision: 2, week: { ...metadata(), seed: 0 } })).revision, 3);
    });
    await t.test("transaction abort restores row and receipt", async () => {
      const before = await f.rows();
      await assert.rejects(f.db.transaction(async tx => { await tx.query("select public.wd_account_command('save_week',$1::jsonb,$2::uuid)", [JSON.stringify({ ...valid, revision: 3 }), f.key()]); throw Error("synthetic abort"); }), /synthetic abort/);
      assert.deepEqual(await f.rows(), before);
    });
    await t.test("unchanged privileges; clients cannot write tables or call a renamed bypass", async () => {
      await assert.rejects(f.db.query("insert into public.wd_saved_weeks values($1,$2,1,$3::jsonb,now())", [B, W, JSON.stringify(metadata())]), /permission denied/);
      await assert.rejects(f.db.query("update public.wd_saved_weeks set week=$1::jsonb", [JSON.stringify(hybrid())]), /permission denied/);
      await assert.rejects(f.db.query("select * from public.wd_account_receipts"), /permission denied/);
      await f.db.exec("reset role");
      const privileges = (await f.db.query<{ names: string }>("select string_agg(proname,',') names from pg_proc where proname like 'wd_account_command%'")).rows[0].names;
      assert.equal(privileges, "wd_account_command");
      await f.login("service_role", null);
      await assert.rejects(f.db.query("insert into public.wd_saved_weeks(user_id,id,revision,week) values($1,$2,1,$3::jsonb)", [B, W, JSON.stringify(hybrid())]), /check constraint/);
      await f.login("anon", null); await assert.rejects(f.command("save_week", valid), /permission denied/);
      await assert.rejects(f.db.query("select * from public.wd_saved_weeks"), /permission denied/); await f.login();
    });
    await t.test("A/B isolation and impersonation refusal", async () => {
      const before = await f.rows(); await f.login("authenticated", B);
      assert.deepEqual((await f.command("list_weeks", { limit: 20, before: null }, null)).weeks, []);
      assert.equal((await f.command("save_week", { ...valid, revision: 3 })).error, "revision_conflict");
      assert.equal((await f.command("save_week", { ...valid, userId: A })).error, "invalid_command");
      await f.login("authenticated", A, 0, true); assert.equal((await f.command("save_week", valid)).error, "invalid_command"); await f.login(); assert.deepEqual(await f.rows(), before);
    });
    await t.test("maximum stored revision refuses overflow without changing history", async () => {
      await f.db.exec("reset role"); await f.db.query("update public.wd_saved_weeks set revision=2147483647 where id=$1", [W]); await f.login();
      const before = await f.rows(); assert.equal((await f.command("save_week", { ...valid, revision: 2147483647 })).error, "invalid_command"); assert.deepEqual(await f.rows(), before);
    });
    await t.test("deletion remains recent-auth, tombstone denies old JWT and replay", async () => {
      await f.login("authenticated", A, 301); assert.equal((await f.command("begin_deletion", { confirmation: "DELETE MY ACCOUNT" })).error, "invalid_command");
      await f.login(); assert.equal((await f.command("begin_deletion", { confirmation: "DELETE MY ACCOUNT" })).state, "deletion_pending");
      assert.equal((await f.command("save_week", valid, receipt)).error, "account_inactive"); assert.equal((await f.command("initialize", {})).error, "account_inactive");
      assert.equal((await f.command("list_weeks", { limit: 20 }, null)).error, "account_inactive");
      await f.db.exec("reset role"); await f.db.query("update public.wd_accounts set state='deleted' where user_id=$1", [A]); await f.login();
      assert.equal((await f.command("save_week", valid)).error, "account_inactive"); assert.equal((await f.command("deletion_status", {}, null)).state, "deleted");
      await f.login("authenticated", B); assert.equal((await f.command("read", {}, null)).revision, 1);
    });
  } finally { await f.db.close(); }
});
