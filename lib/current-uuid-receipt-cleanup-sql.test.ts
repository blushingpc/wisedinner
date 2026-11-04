import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { appleDigest } from "./apple-token-custody.server.ts";
import { createCurrentUuidReceiptCleanup, type CurrentUuidReceiptCleanupInput } from "./current-uuid-receipt-cleanup.server.ts";
// Require the real bounded local runner receipt BEFORE importing/initializing SQL.
const receiptPath = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;
assert.ok(receiptPath, "Actual local slot required; never skip");
const slot = JSON.parse(await readFile(receiptPath, "utf8"));
assert.equal(slot.contract, "wd-local-source-test-slot-v1");
assert.equal(slot.taskId, "backend-ephemeral-deletion-receipt-20261101");
assert.equal(slot.workerThreadId, "01a192ed-0c8f-7411-a5b6-f40ea6104f07");
assert.equal(resolve(slot.workspace), resolve(process.cwd()));
assert.ok(Date.parse(slot.at) <= Date.now() && Date.parse(slot.validUntil) > Date.now());
assert.ok(slot.argv.includes("lib/current-uuid-receipt-cleanup-sql.test.ts"));
const { PGlite } = await import("@electric-sql/pglite");
type Data = Record<string, unknown>;
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002", H = "a".repeat(64);
// Explicit synthetic policy only. No production durations/admission inferred.
const policy = { approved: true as const, version: "wd-owner-uuid-delete-v1", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
const directory = new URL("../supabase/migrations/", import.meta.url);
test("actual unchanged0001..0027 +0029: narrow ephemeral receipt cleanup", async t => {
 const db = await PGlite.create();
 try {
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create table auth.users(id uuid primary key);create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    grant select on auth.users,auth.identities to service_role;
    create schema storage;grant usage on schema storage to service_role;
    create table storage.buckets(id text primary key,owner uuid,owner_id text);
    create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
    grant select on all tables in schema storage to service_role;`);

 const files = (await readdir(directory)).filter(n => /^00\d\d_.*\.sql$/.test(n) && Number(n.slice(0, 4)) <= 27).sort();
 assert.equal(files.length, 27);
 for (const file of files) await db.exec(await readFile(new URL(file, directory), "utf8"));
 await db.exec(await readFile(new URL("0029_wd_current_ephemeral_deletion_receipt.sql", directory), "utf8"));
 async function admin(sql: string, args: unknown[] = []) {
  if (/^rollback\b/i.test(sql)) { await db.exec(sql); await db.exec("reset role"); return; }
  await db.exec("reset role"); return db.query(sql, args);
 }
 async function role(principal = "service_role", uid = A) {
  assert.ok(["service_role", "authenticated", "anon"].includes(principal)); await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: principal, sub: uid, is_anonymous: false, amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] })]);
  await db.exec("set role " + principal);
 }
 async function rpc(name: string, action: string, body: unknown, principal = "service_role"): Promise<Data> {
  assert.match(name, /^wd_[a-z0-9_]+$/); await role(principal);
  return (await db.query<{ r: Data }>(`select public.${name}($1,$2::jsonb) r`, [action, JSON.stringify(body)])).rows[0].r;
 }
 async function clear(input: unknown, principal = "service_role"): Promise<Data> {
  await role(principal); return (await db.query<{ r: Data }>("select public.wd_current_ephemeral_deletion_receipt_cleanup($1::jsonb) r", [JSON.stringify(input)])).rows[0].r;
 }
 async function count() { await db.exec("reset role"); return (await db.query<{ n: number }>("select count(*)::int n from public.wd_account_receipts where user_id=$1", [A])).rows[0].n; }
 async function snapshot() {
  await db.exec("reset role");
  const tables = (await db.query<{ name: string }>("select quote_ident(n.nspname)||'.'||quote_ident(c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname not in('pg_catalog','information_schema') order by 1")).rows;
  const rows: Record<string, unknown> = {};
  for (const { name } of tables) rows[name] = (await db.query<{ v: unknown }>(`select coalesce(jsonb_agg(v order by v::text),'[]') v from(select to_jsonb(t) v from ${name} t) q`)).rows[0].v;
  return rows;
 }
 async function prepare(stage = "cleaned") {
  const op = randomUUID(), owner = randomUUID();
  await admin("insert into auth.users values($1),($2)", [A, B]);
  await admin("insert into public.wd_accounts(user_id)values($1),($2)", [A, B]);
  assert.deepEqual((await db.query("select state,revision from public.wd_accounts where user_id=$1", [A])).rows[0], { state: "active", revision: 1 });
  await admin("insert into public.wd_account_receipts(user_id,id,request,result)values($1,$2,'{\"foreign\":true}','{\"retained\":true}')", [B, randomUUID()]);
  const basis = await rpc("wd_apple_deletion_command", "effective_basis", { userId: A });
  const original = { userId: A, operationId: op, recoveryHash: H, expectedAccountRevision: 1, identityHash: H, identityEvidence: H, appleLinkage: "none", policy, policyHash: appleDigest(policy), intentSha256: H };
  assert.equal((await rpc("wd_apple_deletion_command", "admit_original", { original, basis: { userId: A, currentIdentityHash: H, identityEvidence: H, actualApple: "none", effectiveApple: "none", inventoryRevision: basis.revision, inventoryHash: basis.inventoryHash } })).outcome, "admitted");
  let input: CurrentUuidReceiptCleanupInput = { userId: A, authOperationId: randomUUID(), deletionOperationId: op, intentSha256: H, identityHash: H, workOwner: owner, workAttempt: 1, leaseUntil: new Date(Date.now() + 60000).toISOString(), accountRevision: 2, policySha256: appleDigest(policy) };
  if (stage === "prepared") return { input, policy };
  const confirmed = await rpc("wd_deletion_v2_account_command", "confirm", { operationId: op, recoveryHash: H, expectedAccountRevision: 1, intentSha256: H, confirmation: "DELETE MY ACCOUNT" }, "authenticated");
  assert.equal(confirmed.intentState, "confirmed"); assert.equal(await count(), 1);
  if (stage === "confirmed") return { input, policy };
  const command = { operationId: op, intentSha256: H, owner };
  const claimed = await rpc("wd_deletion_v2_worker_command", "claim", command), work = claimed.work as Data;
  assert.equal(work.owner, owner); assert.equal(work.attempt, 1);
  assert.equal(work.auth_state, "pending");
  input = { ...input, authOperationId: work.auth_operation as string, workAttempt: work.attempt as number, leaseUntil: work.lease_until as string };
  if (stage !== "claimed") assert.ok((await rpc("wd_deletion_v2_worker_command", "cleanup", { ...command, attempt: work.attempt })).receipt);
  assert.equal(await count(), 1, "actual legacy cleanup does NOT remove the acknowledgement");
  if (stage === "started") {
   await rpc("wd_deletion_v2_worker_command", "apple_unavailable", { ...command, attempt: work.attempt });
   const begun = await rpc("wd_deletion_v2_worker_command", "begin", { ...command, attempt: work.attempt, dependency: "auth" });
   assert.ok(!("error" in begun));
   await admin("select 1");
   const natural = (await db.query<{ auth_state: string; n: number }>("select auth_state,(select count(*)::int from wd_apple_private.auth_attempts where owner_id=$1) n from public.wd_deletion_work where user_id=$1", [A])).rows[0];
   assert.deepEqual(natural, { auth_state: "started", n: 0 }, "worker begin is not admission of an Auth effect");
   const fence = await rpc("wd_apple_deletion_command", "auth_fence", { userId: A, operationId: input.authOperationId, identityHash: H });
   assert.equal(fence.owner, owner); assert.equal(fence.attempt, input.workAttempt);
   assert.equal(Date.parse(fence.lease as string), Date.parse(input.leaseUntil));
   assert.equal(fence.intentId, op); assert.equal(fence.authState, "started");
  }
  return { input, policy };
 }
 async function trial(fn: () => Promise<void>) { await admin("begin"); try { await fn(); } finally { await admin("rollback"); } }
 async function held(input: unknown) { const before = await snapshot(); assert.deepEqual(await clear(input), { outcome: "held" }); assert.deepEqual(await snapshot(), before); }
 await t.test("real confirm/random claim/cleanup then concrete port deletes only exact acknowledgement; retry is observed zero", () => trial(async () => {
  const f = await prepare("started"), before = await snapshot();
  const port = createCurrentUuidReceiptCleanup({ policy, now: Date.now, timeoutMs: 10000, maxObservationAgeMs: 10000,
   async rpc(name, body) { assert.equal(name, "wd_current_ephemeral_deletion_receipt_cleanup"); return clear(body); } });
  const first = await port.clear(f.input);
  assert.equal(first.outcome, "cleared");
  if (first.outcome !== "cleared") assert.fail("required successful real cleanup");
  assert.equal(first.removed, 1); assert.equal(await count(), 0);
  const after = await snapshot(), receipts = "public.wd_account_receipts";
  const oldReceipts = before[receipts] as Data[], newReceipts = after[receipts] as Data[];
  assert.deepEqual(newReceipts, oldReceipts.filter(r => r.user_id !== A));
  delete before[receipts]; delete after[receipts];
  assert.deepEqual(after, before, "all durable original/work/Auth/Apple/capability/source/guide/ACK tables unchanged");
  const second = await port.clear(f.input); assert.equal(second.outcome, "cleared");
  if (second.outcome === "cleared") assert.equal(second.removed, 0);
  const status = await rpc("wd_deletion_v2_worker_command", "status", { operationId: f.input.deletionOperationId, intentSha256: H, recoveryHash: H });
  assert.equal(status.intentState, "confirmed");
 }));
 for (const stage of ["prepared", "confirmed", "claimed"]) await t.test("no cleanup before actual progression: " + stage, () => trial(async () => { const f = await prepare(stage); await held({ ...f.input, policy }); }));
 for (const [name, patch] of Object.entries({ foreignOwner: { userId: B }, wrongOriginal: { deletionOperationId: randomUUID() }, wrongIntent: { intentSha256: "b".repeat(64) }, wrongIdentity: { identityHash: "b".repeat(64) }, wrongClaim: { workOwner: randomUUID() }, wrongAttempt: { workAttempt: 2 }, wrongLease: { leaseUntil: new Date(Date.now() + 10000).toISOString() }, wrongRevision: { accountRevision: 3 }, wrongPolicyHash: { policySha256: H }, extra: { extra: true }, stringAttempt: { workAttempt: "1" }, invalidTime: { leaseUntil: "2026-02-30T00:00:00Z" } })) await t.test("full bound tuple holds without mutation: " + name, () => trial(async () => { const f = await prepare(); await held({ ...f.input, policy, ...patch }); }));
 for (const [name, sql] of Object.entries({ expiredLease: "update public.wd_deletion_work set lease_until=now()-interval '1 second'", expiredRecovery: "update wd_deletion_v2_private.intents set recovery_until=now()-interval '1 second'", expiredReceipt: "update wd_deletion_v2_private.intents set receipt_until=now()-interval '1 second'", unconfirmed: "update wd_deletion_v2_private.intents set phase='prepared'", pendingData: "update wd_deletion_v2_private.intents set data_state='pending'", authHeld: "update public.wd_deletion_work set auth_state='held'", wrongIdentity: "update public.wd_deletion_work set identity_hash=repeat('b',64)", wrongReservation: "update wd_apple_private.owners set reserved_original=gen_random_uuid()", malformedReceipt: "update public.wd_account_receipts set result=result||'{\"extra\":true}' where user_id='" + A + "'", wrongRequest: "update public.wd_account_receipts set request='{\"action\":\"other\"}' where user_id='" + A + "'", wrongReceiptOriginal: "update public.wd_account_receipts set id=gen_random_uuid() where user_id='" + A + "'" })) await t.test("persisted invalid state holds atomically: " + name, () => trial(async () => { const f = await prepare(); await admin(sql); await held({ ...f.input, policy }); }));
 await t.test("additional receipt blocks deletion of otherwise exact row", () => trial(async () => {
  const f = await prepare(); await admin("insert into public.wd_account_receipts(user_id,id,request,result)values($1,$2,'{}','{}')", [A, randomUUID()]);
  await held({ ...f.input, policy }); assert.equal(await count(), 2);
 }));
 await t.test("different Auth operation and unknown receipt column hold without deleting", () => trial(async () => {
  const f = await prepare(); await held({ ...f.input, authOperationId: randomUUID(), policy });
  await admin("alter table public.wd_account_receipts add column unclassified jsonb");
  await held({ ...f.input, policy }); assert.equal(await count(), 1);
 }));
 await t.test("persisted strict original cannot use UUID cleanup even with its exact policy/hash", () => trial(async () => {
  const f = await prepare(), strict = { ...policy, version: "wd-delete-v2" }, hash = appleDigest(strict);
  await admin("update wd_deletion_v2_private.intents set policy=$1,policy_hash=$2", [JSON.stringify(strict), hash]);
  await held({ ...f.input, policy: strict, policySha256: hash });
 }));
 for (const p of [{ ...policy, version: "wd-account-delete-v2" }, { ...policy, pendingSeconds: 601 }, { ...policy, approved: false }, { ...policy, extra: true }]) await t.test("strict/foreign/unapproved/malformed policy stays closed: " + JSON.stringify(p), () => trial(async () => { const f = await prepare(); await held({ ...f.input, policy: p }); }));
 for (const stage of ["cleaned", "started"]) for (const state of ["started", "confirmed"]) await t.test("persisted Auth admission blocks receipt cleanup: " + stage + "/" + state, () => trial(async () => {
  // A persisted attempt is a denial fixture, never a manufactured positive scope grant.
  const f = await prepare(stage); await admin("insert into wd_apple_private.auth_attempts values($1,$2,$3,$4,'{}',$3,$5,null)", [f.input.authOperationId, A, H, f.input.deletionOperationId, state]); await held({ ...f.input, policy });
 }));
 await t.test("any owner Auth admission remains blocking, including a different Auth operation and held work", () => trial(async () => {
  const f = await prepare("started");
  await admin("insert into wd_apple_private.auth_attempts values($1,$2,$3,$4,'{}',$3,'started',null)", [randomUUID(), A, H, f.input.deletionOperationId]);
  await held({ ...f.input, policy });
  await admin("update public.wd_deletion_work set auth_state='held'"); await held({ ...f.input, policy });
 }));
 await t.test("natural started phase retains every caller tuple fence", () => trial(async () => {
  const f = await prepare("started");
  for (const patch of [{ userId: B }, { deletionOperationId: randomUUID() }, { authOperationId: randomUUID() }, { intentSha256: "b".repeat(64) }, { identityHash: "b".repeat(64) }, { workOwner: randomUUID() }, { workAttempt: 2 }, { leaseUntil: new Date(Date.now() + 10000).toISOString() }, { accountRevision: 3 }, { policySha256: H }, { policy: { ...policy, approved: false } }, { extra: true }]) await held({ ...f.input, policy, ...patch });
 }));
 await t.test("natural started phase retains expired lease and account state fences", () => trial(async () => {
  const f = await prepare("started");
  for (const sql of ["update public.wd_deletion_work set lease_until=now()-interval '1 second'", "update public.wd_accounts set revision=revision+1 where user_id='" + A + "'", "update public.wd_deletion_work set auth_state='held'", "update public.wd_deletion_work set auth_evidence=repeat('b',64)"]) {
   await admin("savepoint invalid_started"); await admin(sql); await held({ ...f.input, policy }); await admin("rollback to invalid_started");
  }
 }));
 await t.test("rollback restores exact acknowledgement; no independent commit or provider effect", () => trial(async () => {
  const f = await prepare(), before = await snapshot(); await admin("savepoint cleanup_boundary");
  assert.equal((await clear({ ...f.input, policy })).outcome, "cleared"); assert.equal(await count(), 0);
  await admin("rollback to cleanup_boundary"); assert.deepEqual(await snapshot(), before);
 }));
 await t.test("actual delete-trigger failure rolls the statement back atomically", () => trial(async () => {
  const f = await prepare();
  await admin("create function public.synthetic_receipt_fault() returns trigger language plpgsql as $$begin raise exception 'synthetic_cleanup_fault';end$$");
  await admin("create trigger synthetic_receipt_fault after delete on public.wd_account_receipts for each row execute function public.synthetic_receipt_fault()");
  const before = await snapshot(); await admin("savepoint receipt_fault");
  await assert.rejects(clear({ ...f.input, policy }), (e: unknown) => !!e && typeof e === "object" && "code" in e && e.code === "P0001");
  await admin("rollback to receipt_fault"); assert.deepEqual(await snapshot(), before); assert.equal(await count(), 1);
 }));
 await t.test("anonymous/authenticated cannot execute; runtime principals cannot directly delete receipts", () => trial(async () => {
  const f = await prepare();
  for (const principal of ["anon", "authenticated", "service_role"]) {
   await admin("savepoint denied"); await role(principal);
   try {
    await assert.rejects(db.query("delete from public.wd_account_receipts where user_id=$1", [A]), (e: unknown) => !!e && typeof e === "object" && "code" in e && e.code === "42501");
   } finally { await admin("rollback to denied"); }
   if (principal !== "service_role") {
    await admin("savepoint denied_rpc");
    try { await assert.rejects(clear({ ...f.input, policy }, principal), (e: unknown) => !!e && typeof e === "object" && "code" in e && e.code === "42501"); }
    finally { await admin("rollback to denied_rpc"); }
   }
  }
  assert.equal(await count(), 1);
  await db.exec("reset role"); const r = (await db.query<{ rolcanlogin: boolean; rolbypassrls: boolean; rolsuper: boolean }>("select rolcanlogin,rolbypassrls,rolsuper from pg_roles where rolname='wd_receipt_cleanup_internal'")).rows[0];
  assert.deepEqual(r, { rolcanlogin: false, rolbypassrls: false, rolsuper: false });
 }));
 } finally { await db.close(); }
});
