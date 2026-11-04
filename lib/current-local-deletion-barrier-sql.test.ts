import test, { after } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir, mkdtemp } from "node:fs/promises";
import { resolve, dirname, join } from "node:path";
import { randomUUID } from "node:crypto";
import { appleDigest } from "./apple-token-custody.server.ts";
import { createCurrentUuidAuthScopePreflight } from "./current-uuid-auth-scope.server.ts";
import type { ScopeObservation, ScopeObservationRequest, ScopeAdmission } from "./current-auth-scope.server.ts";
import type { AuthScopeInput } from "./account-deletion-v2-auth.server.ts";

// Main's actual exclusive local slot is checked BEFORE importing PGlite.
const path = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;
assert.ok(path, "Main local SQL slot required, never skip the fixture");
const slot = JSON.parse(await readFile(path, "utf8"));
assert.equal(slot.contract, "wd-local-source-test-slot-v1");
assert.equal(slot.taskId, "backend-local-writer-barrier-20261101");
assert.equal(slot.workerThreadId, "01a192f8-e59a-71a2-9149-1158d9e93c50");
assert.equal(resolve(slot.workspace), resolve(process.cwd()));
assert.ok(Date.parse(slot.at) <= Date.now() && Date.parse(slot.validUntil) > Date.now());
assert.ok(slot.argv.includes("lib/current-local-deletion-barrier-sql.test.ts"));
const { PGlite } = await import("@electric-sql/pglite");
type Data = Record<string, unknown>;
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002", H = "a".repeat(64);
const policy = { approved: true as const, version: "wd-owner-uuid-delete-v1", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
const custodyPolicy = { approved: true as const, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
const directory = new URL("../supabase/migrations/", import.meta.url);
const migration = await readFile(new URL("0027_wd_current_local_deletion_barrier.sql", directory), "utf8");

async function fixture(full: boolean, dataDir?: string) {
  const db = await PGlite.create(dataDir);
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
  const files = (await readdir(directory)).filter(n => /^00\d\d_.*\.sql$/.test(n) && Number(n.slice(0, 4)) <= 26).sort();
  const core = new Set([6, 7, 13, 14, 15, 18, 19, 20, 21, 22, 23, 24, 25, 26]);
  for (const n of files) if (full || core.has(Number(n.slice(0, 4)))) await db.exec(await readFile(new URL(n, directory), "utf8"));
  await db.exec(migration);
  const binding: AuthScopeInput = { userId: A, identityHash: H, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(Date.now() + 120000).toISOString() };
  await db.query("insert into auth.users values($1),($2)", [A, B]);
  await db.query("insert into public.wd_accounts(user_id,state,revision,preferences,deletion_dependencies)values($1,'deletion_pending',2,'{}',$3),($2,'active',1,'{}',null)", [A, B, JSON.stringify({ authDeletion: "pending", sessionInvalidation: "pending", appleRevocation: "not_required", subscriptionCancellation: "not_performed" })]);
  await db.query("insert into public.wd_deletion_work(user_id,owner,attempt,lease_until,identity_hash,identity_evidence,apple_linkage,apple_state,auth_state,auth_operation)values($1,$2,1,$3,$4,$4,'none','not_required','started',$5)", [A, binding.workOwner, binding.leaseUntil, H, binding.authOperationId]);
  await db.query("insert into wd_deletion_v2_private.intents(operation_id,user_id,intent_hash,verifier,account_revision,identity_hash,identity_evidence,apple_linkage,policy,policy_hash,phase,data_state,apple_disposition,prepared_until,recovery_until,receipt_until)values($1,$2,$3,$3,1,$3,$3,'none',$4,$5,'confirmed','cleared','not_required',now()+interval '1 minute',now()+interval '1 hour',now()+interval '1 hour')", [binding.deletionOperationId, A, H, JSON.stringify(policy), appleDigest(policy)]);
  await db.query("insert into wd_apple_private.owners(owner_id,gate,reserved_original)values($1,'deletion_reserved',$2)", [A, binding.deletionOperationId]);
  await db.query("insert into wd_apple_private.deletion_bindings values($1,$2,$3,$3,'none','none',$3)", [binding.deletionOperationId, A, H]);
  const request: ScopeObservationRequest = { binding, policySha256: appleDigest(policy), scopeSha256: H, authorizationId: randomUUID(), custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
  async function admin(sql: string, args: unknown[] = []) {
    // PostgreSQL will not execute RESET ROLE inside an aborted transaction.
    // Recover the actual savepoint/transaction first, without retrying effects.
    if (/^rollback\b/i.test(sql)) { await db.exec(sql); await db.exec("reset role"); return; }
    await db.exec("reset role"); if (!args.length && sql.includes(";")) return db.exec(sql); return db.query(sql, args);
  }
  async function role(name = "service_role", uid = A) {
    await db.exec("reset role"); assert.ok(["service_role", "authenticated", "anon", "wd_owner_plan_stage"].includes(name));
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: name, sub: uid, is_anonymous: false, amr: [{ method: "password", timestamp: Math.floor(Date.now() / 1000) }] })]);
    await db.exec("set role " + name);
  }
  async function rpc(name: string, action: string, body: unknown, key?: string, principal = "service_role", uid = A): Promise<Data> {
    assert.match(name, /^wd_[a-z0-9_]+$/); await role(principal, uid);
    return (await db.query<{ r: Data }>(`select public.${name}($1,$2::jsonb${key ? ",$3::uuid" : ""}) r`, [action, JSON.stringify(body), ...(key ? [key] : [])])).rows[0].r;
  }
  async function observation(name = "wd_current_local_deletion_barrier", input: unknown = request, principal = "service_role"): Promise<Data> {
    assert.match(name, /^wd_[a-z0-9_]+$/); await role(principal);
    return (await db.query<{ r: Data }>(`select public.${name}($1::jsonb) r`, [JSON.stringify(input)])).rows[0].r;
  }
  async function digest() {
    await db.exec("reset role"); const names = (await db.query<{ name: string }>("select quote_ident(n.nspname)||'.'||quote_ident(c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and(n.nspname in('wd_apple_private','wd_deletion_v2_private','wd_current_private') or(n.nspname='public' and left(c.relname,3)='wd_')) order by 1")).rows;
    const result: string[] = [];
    for (const { name } of names) result.push((await db.query<{ h: string }>(`select encode(sha256(convert_to(coalesce(jsonb_agg(v order by v::text),'[]')::text,'UTF8')),'hex') h from(select to_jsonb(t) v from ${name} t) q`)).rows[0].h);
    return result;
  }
  return { db, binding, request, admin, role, rpc, observation, digest };
}
// Full historical source cohort tests every installed writer; the restricted
// core fixture separately demonstrates the DTO. It is not an admitted target.
const full = await fixture(true), core = await fixture(false);
after(async () => { await full.db.close(); await core.db.close(); });
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function trial(f: Fixture, fn: () => Promise<void>) {
  await f.admin("begin;"); try { await fn(); } finally { await f.admin("rollback;"); }
}
async function unchanged(f: Fixture, fn: () => Promise<unknown>) {
  const before = await f.digest(); await f.admin("savepoint expected_denial;");
  let error = false;
  try { const result = await fn() as Data; assert.ok(result.error || result.outcome === "held", "must actually refuse"); }
  catch (e) {
    if (e instanceof assert.AssertionError) throw e;
    assert.ok(e && typeof e === "object" && "code" in e && ["42501", "23514"].includes(String(e.code)), "only actual privilege/tombstone denial is expected, not arbitrary SQL errors");
    error = true;
  }
  if (error) await f.admin("rollback to expected_denial;");
  assert.deepEqual(await f.digest(), before, "all owner/foreign/state/receipt rows unchanged");
}

test("all actual0001..0026 install then0027: unknown support/proposal references still hold, not whitelisted", () => trial(full, async () => {
  assert.deepEqual(await full.observation(), { outcome: "held" });
  assert.ok(Number((await full.observation("wd_current_auth_scope_observe")).unclassifiedReferences) > 0);
}));
test("core supported synthetic scope returns exact DTO, reserved remains reserved, no raw data or provider fence", () => trial(core, async () => {
  const o = await core.observation(); assert.equal(o.contract, "wd-current-local-delete-scope-v1"); assert.equal(o.writeFence, null);
  assert.deepEqual(o.denial, { accountState: "deletion_pending", custodyGate: "deletion_reserved", ordinaryOwnerWrites: "denied", allowedOriginalProgress: "same-original-only", durability: "persisted-until-original-resolution", barrierRevision: 2, unknownWriters: 0 });
  assert.equal(o.accountRevision, 2); assert.deepEqual(o.binding, core.binding); assert.equal(o.policySha256, appleDigest(policy));
  assert.match(String(o.writerManifestSha256), /^[a-f0-9]{64}$/); assert.match(String(o.writerCatalogSha256), /^[a-f0-9]{64}$/);
  assert.ok(Date.parse(String(o.validUntil)) <= Date.parse(core.binding.leaseUntil));
  for (const word of ["envelope", "ciphertext", "transaction_hash", "proof", "preferences", "verifier"]) assert.equal(JSON.stringify(o).includes('"' + word + '"'), false);
}));

for (const action of ["initialize", "update", "save_week", "delete_week"]) test("account old-token publisher denied: " + action, () => trial(full, () => unchanged(full, () => full.rpc("wd_account_command", action, action === "initialize" ? {} : { revision: 2, preferences: {} }, randomUUID(), "authenticated"))));
test("proposal save and direct stage/service replay insert denied independently of caller rollback", () => trial(full, async () => {
  await unchanged(full, () => full.rpc("wd_proposal_plan_command", "save", {}, randomUUID(), "authenticated"));
  for (const principal of ["wd_owner_plan_stage", "service_role"]) await unchanged(full, async () => {
    await full.role(principal); return full.db.query("insert into public.wd_proposal_plan_replay values($1,$2,'{}',txid_current())", [A, randomUUID()]);
  });
}));
for (const name of ["wd_accounts", "wd_saved_weeks", "wd_account_receipts", "wd_billing_bindings", "wd_billing_states", "wd_billing_transactions", "wd_billing_events", "wd_push_tokens", "wd_push_receipts", "wd_push_jobs"]) test("raw service DML and uid mutation denied: " + name, () => trial(full, async () => {
  for (const action of ["INSERT", "UPDATE", "DELETE", "TRUNCATE"]) {
    await full.admin("select 1"); const p = await full.db.query<{ allowed: boolean }>("select has_table_privilege('service_role',$1,$2) allowed", ["public." + name, action]); assert.equal(p.rows[0].allowed, false);
  }
  await unchanged(full, async () => { await full.role(); return full.db.exec("update public." + name + " set " + (name === "wd_accounts" ? "state='active',user_id='" + B + "'" : name === "wd_billing_events" ? "status='queued'" : "user_id='" + B + "'") ); });
  for (const sql of ["insert into public." + name + " default values", "delete from public." + name, "truncate public." + name]) await unchanged(full, async () => { await full.role(); return full.db.exec(sql); });
}));
for (const action of ["bind", "begin", "commit"]) test("billing owner publisher denied: " + action, () => trial(full, () => unchanged(full, () => full.rpc("wd_billing_command", action, { userId: A, environment: "SANDBOX", state: { transactionHash: H } }))));
test("billing foreign transaction owner hold cannot write pending owner through active B", () => trial(full, async () => {
  await full.admin("insert into public.wd_billing_bindings(user_id)values($1),($2);", [A, B]);
  await full.admin("insert into public.wd_billing_states(user_id,environment)values($1,'SANDBOX'),($2,'SANDBOX')", [A, B]);
  await full.admin("insert into public.wd_billing_transactions values('SANDBOX',$1,$2)", [H, A]);
  await unchanged(full, () => full.rpc("wd_billing_command", "commit", { userId: B, environment: "SANDBOX", generation: 0, state: { state: "active", transactionHash: H, expiresAt: Date.now() + 60000, observedAt: Date.now(), reason: "synthetic" } }));
}));
for (const action of ["enqueue", "claim_events", "finish_event"]) test("billing mixed-owner event publisher denied: " + action, () => trial(full, async () => {
  await full.admin("insert into public.wd_billing_bindings(user_id)values($1),($2)", [A, B]);
  await full.admin("insert into public.wd_billing_events(environment,event_id,fingerprint,event_type,event_timestamp_ms,account_ids,status,attempts)values('SANDBOX','synthetic',$1,'TEST',1,$2,$3,1)", [H, JSON.stringify([A, B]), action === "finish_event" ? "leased" : "queued"]);
  await full.admin("select 1"); const ids = (await full.db.query<{ app_user_id: string }>("select app_user_id from public.wd_billing_bindings order by user_id")).rows.map(x => x.app_user_id);
  await unchanged(full, () => full.rpc("wd_billing_command", action, { environment: "SANDBOX", id: "synthetic", fingerprint: H, type: "TEST", timestamp: 1, appUserIds: ids, identityHold: true, limit: 5, status: "processed", attempt: 1 }));
  await unchanged(full, () => full.rpc("wd_billing_command", "enqueue", { environment: "UNKNOWN", id: "unknown", fingerprint: H, type: "TEST", timestamp: 1, appUserIds: ids, identityHold: true }));
}));
for (const action of ["intent", "claim", "hold", "prepare", "commit"]) test("restore publication/late audit denied: " + action, () => trial(full, async () => {
  const op = randomUUID(); await full.admin("insert into public.wd_restore_intents(operation,target,environment,app,product,entitlement,target_binding,created_ms,expires_ms,status,lease,attempt,lease_until_ms) values($1,$2,'SANDBOX','fixture','weekly','pro','synthetic-only',1,9007199254740000,'leased',$3,1,9007199254740000)", [op, A, randomUUID()]);
  await unchanged(full, () => full.rpc("wd_restore_command", action, { operation: op, target: A, environment: "SANDBOX", app: "fixture", product: "weekly", entitlement: "pro", reason: "outcome_unknown" }));
}));
for (const action of ["register", "revoke", "revoke_all"]) test("old token push command denied: " + action, () => trial(full, () => unchanged(full, () => full.rpc("wd_push_command", action, {}, randomUUID(), "authenticated"))));
for (const action of ["enqueue", "claim", "finish", "disable", "receipt"]) test("push delivery publisher denied: " + action, () => trial(full, async () => {
  const id = randomUUID(), device = randomUUID(), project = randomUUID();
  await full.admin("insert into public.wd_push_jobs(id,user_id,device_id,project_id,environment,body,state,attempts,ticket_id)values($1,$2,$3,$4,'production','synthetic','claimed',1,'ticket')", [id, A, device, project]);
  await unchanged(full, () => full.rpc("wd_push_delivery", action, { id, userId: B, deviceId: device, projectId: project, environment: "production", body: "synthetic", attempt: 1, ticket: "ticket", state: "ticket", result: "complete" }));
}));
test("current RPC still denies inactive owner with original shared advisory protocol", () => trial(full, async () => {
  await unchanged(full, async () => {
    await full.role(); return (await full.db.query<{ r: Data }>("select public.wd_current_plan_rpc($1,2,$2,'commit','{}',null) r", [A, appleDigest({ protocol: "joined-session-v2", namespace: "wd-current-catalog-1300-v1/" + A })])).rows[0].r;
  });
}));
test("all renamed legacy entries denied to service/old-token/anon; private rows and helper denied", () => trial(full, async () => {
  await full.admin("select 1"); const rows = (await full.db.query<{ oid: number; proname: string }>("select oid,proname from pg_proc where proname like '%__pre0027' order by proname")).rows; assert.ok(rows.length >= 15);
  for (const row of rows) for (const principal of ["service_role", "authenticated", "anon"]) {
    await full.admin("select 1"); assert.equal((await full.db.query<{ p: boolean }>("select has_function_privilege($1,$2::oid,'EXECUTE') p", [principal, row.oid])).rows[0].p, false, row.proname);
  }
  for (const principal of ["anon", "authenticated"]) await unchanged(full, async () => full.observation(undefined, undefined, principal));
  await unchanged(full, async () => { await full.role(); return full.db.query("select * from wd_apple_private.credentials"); });
  await unchanged(full, async () => { await full.role(); return full.db.query("select * from public.wd_restore_intents"); });
}));
for (const change of [{ userId: B }, { workOwner: randomUUID() }, { workAttempt: 2 }, { authOperationId: randomUUID() }, { deletionOperationId: randomUUID() }, { intentSha256: "b".repeat(64) }, { leaseUntil: "2000-01-01T00:00:00.000Z" }]) test("strict local binding rejects " + Object.keys(change)[0], () => trial(core, async () => {
  assert.deepEqual(await core.observation(undefined, { ...core.request, binding: { ...core.binding, ...change } }), { outcome: "held" });
}));
test("missing metadata/extra field/wrong policy/account revision and durable gate changes hold", () => trial(core, async () => {
  for (const input of [undefined, {}, { ...core.request, extra: true }, { ...core.request, policySha256: "b".repeat(64) }]) assert.deepEqual(await core.observation(undefined, input === undefined ? {} : input), { outcome: "held" });
  await core.admin("update public.wd_accounts set revision=3 where user_id=$1", [A]); assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("deleted/expired owner cannot reopen; stale lease holds and no ordinary effects", () => trial(core, async () => {
  await core.admin("update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id=$1", [A]); assert.deepEqual(await core.observation(), { outcome: "held" });
  await core.admin("update public.wd_accounts set state='deleted' where user_id=$1", [A]);
  await unchanged(core, () => core.rpc("wd_account_command", "initialize", {}, randomUUID(), "authenticated"));
  assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("normal email confirm keeps its real account receipt/reserved gate; unresolved common-reader residue honestly holds", () => trial(core, async () => {
  const C = "10000000-0000-4000-8000-000000000003", op = randomUUID(), recovery = H;
  await core.admin("insert into public.wd_accounts(user_id)values($1)", [C]);
  await core.admin("insert into auth.users values($1)", [C]);
  const basis = await core.rpc("wd_apple_deletion_command", "effective_basis", { userId: C });
  const admitted = await core.rpc("wd_apple_deletion_command", "admit_original", {
    original: { userId: C, operationId: op, recoveryHash: recovery, expectedAccountRevision: 1, identityHash: H, identityEvidence: H, appleLinkage: "none", policy, policyHash: appleDigest(policy), intentSha256: H },
    basis: { userId: C, currentIdentityHash: H, identityEvidence: H, actualApple: "none", effectiveApple: "none", inventoryRevision: basis.revision, inventoryHash: basis.inventoryHash },
  }); assert.equal(admitted.outcome, "admitted");
  const confirmed = await core.rpc("wd_deletion_v2_account_command", "confirm", { operationId: op, recoveryHash: recovery, expectedAccountRevision: 1, intentSha256: H, confirmation: "DELETE MY ACCOUNT" }, undefined, "authenticated", C);
  assert.equal(confirmed.intentState, "confirmed"); await core.admin("select 1");
  assert.equal((await core.db.query<{ n: number }>("select count(*)::int n from public.wd_account_receipts where user_id=$1", [C])).rows[0].n, 1);
  assert.equal((await core.db.query<{ gate: string }>("select gate from wd_apple_private.owners where owner_id=$1", [C])).rows[0].gate, "deletion_reserved");
  const owner = randomUUID(), original = { operationId: op, intentSha256: H, owner };
  const claimed = await core.rpc("wd_deletion_v2_worker_command", "claim", original), work = claimed.work as Data;
  const advance = { ...original, attempt: work.attempt };
  assert.ok((await core.rpc("wd_deletion_v2_worker_command", "cleanup", advance)).receipt);
  await core.rpc("wd_deletion_v2_worker_command", "apple_unavailable", advance);
  await core.rpc("wd_deletion_v2_worker_command", "begin", { ...advance, dependency: "auth" });
  const binding: AuthScopeInput = { userId: C, identityHash: H, deletionOperationId: op, authOperationId: String(work.auth_operation), intentSha256: H, workOwner: owner, workAttempt: Number(work.attempt), leaseUntil: String(work.lease_until) };
  const request = { ...core.request, binding };
  const observation = await core.observation("wd_current_auth_scope_observe", request);
  assert.equal((observation.application as Data).accountReceipts, 1, "actual normal receipt is the separately unresolved common-reader residue");
  assert.equal(observation.providerOperations, "settled");
  assert.deepEqual(await core.observation(undefined, request), { outcome: "held" }, "never delete or relabel the receipt to fabricate readiness");
  // No fixture DELETE of this real receipt to fabricate end-to-end readiness.
}));
test("stored UUID auth_original projection, unknown recovery and one-attempt semantics", () => trial(core, async () => {
  const target = { userId: A, identityHash: H, operationId: core.binding.authOperationId };
  const fence = await core.rpc("wd_apple_deletion_command", "auth_fence", target);
  const scope = { outcome: "allowed", profile: "wd-owner-uuid-delete-v1", providerPredicate: "account-uuid-only", strongWriteFence: null, accountRevision: 2,
    binding: { ...core.binding, scopeSha256: H, policySha256: appleDigest(policy), authorizationId: core.request.authorizationId, evidenceSha256: H, observedAt: new Date().toISOString(), validUntil: core.binding.leaseUntil },
    coverage: { coveredAuthGraphSha256: H, storage: "verified_clear", sharedEngine: "verified_preserved", relatedOwnerReferences: "approved_preserved" } };
  const start = await core.rpc("wd_apple_deletion_command", "auth_begin", { ...target, fenceHash: fence.fenceHash, scope }); assert.equal(start.fresh, true);
  assert.equal((await core.rpc("wd_apple_deletion_command", "auth_begin", { ...target, fenceHash: fence.fenceHash, scope })).fresh, false);
  const original = await core.rpc("wd_apple_deletion_command", "auth_original", { ...target, scopeProfile: "forged" });
  assert.equal(original.scopeProfile, "wd-owner-uuid-delete-v1"); assert.equal(original.scopeProviderPredicate, "account-uuid-only"); assert.equal(original.scopeAccountRevision, 2); assert.equal(original.scopePolicySha256, appleDigest(policy)); assert.equal(original.state, "started");
  await core.admin("update wd_apple_private.auth_attempts set scope=scope-'profile' where operation_id=$1", [target.operationId]);
  assert.equal(Object.hasOwn(await core.rpc("wd_apple_deletion_command", "auth_original", target), "scopeProfile"), false, "old stored scopes never converted/defaulted");
}));
test("wrong profile/policy/revision never reserves auth attempt", () => trial(core, async () => {
  const target = { userId: A, identityHash: H, operationId: core.binding.authOperationId }, fence = await core.rpc("wd_apple_deletion_command", "auth_fence", target);
  for (const scope of [{}, { profile: "strict" }, { profile: "wd-owner-uuid-delete-v1", providerPredicate: "immutable-identity", strongWriteFence: null, accountRevision: 2 }, { profile: "wd-owner-uuid-delete-v1", providerPredicate: "account-uuid-only", strongWriteFence: null, accountRevision: 3 }]) await unchanged(core, () => core.rpc("wd_apple_deletion_command", "auth_begin", { ...target, fenceHash: fence.fenceHash, scope }));
}));
test("unknown schema/column and direct-DML ACL or role-member drift hold", () => trial(core, async () => {
  await core.admin("create table public.unclassified_owner(user_id uuid)"); assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("raw DML grant drift holds local proof", () => trial(core, async () => {
  await core.admin("grant update on public.wd_accounts to service_role"); assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("column-only grant cannot bypass table ACL inspection", () => trial(core, async () => {
  await core.admin("grant update(state) on public.wd_accounts to service_role");
  assert.equal((await core.db.query<{ p: boolean }>("select has_table_privilege('service_role','public.wd_accounts','UPDATE') p")).rows[0].p, false);
  assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("active foreign owner keeps real preference/billing/staging behavior", () => trial(full, async () => {
  const preferences = { diet: "none", allergens: [], excludedSkuIds: [], household: 1, notifications: false };
  const saved = await full.rpc("wd_account_command", "update", { revision: 1, preferences }, randomUUID(), "authenticated", B); assert.equal(saved.revision, 2);
  assert.ok((await full.rpc("wd_billing_command", "bind", { userId: B })).appUserId);
  assert.equal((await full.rpc("wd_billing_command", "begin", { userId: B, environment: "SANDBOX" })).generation, 1);
  await full.role("wd_owner_plan_stage", B);
  await full.db.query("insert into public.wd_proposal_plan_replay values($1,$2,'{}',txid_current())", [B, randomUUID()]);
  await full.admin("select 1"); assert.equal((await full.db.query<{ n: number }>("select count(*)::int n from public.wd_proposal_plan_replay where user_id=$1", [B])).rows[0].n, 1);
}));
test("internal membership drift holds local proof", () => trial(core, async () => {
  await core.admin("grant wd_deletion_v2_internal to service_role"); assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("actual factory rejects unaccepted manifest/catalog and trigger drift; metadata cannot self-admit", () => trial(core, async () => {
  const o = await core.observation("wd_current_auth_scope_observe") as unknown as ScopeObservation, local = await core.observation();
  const admission: ScopeAdmission = { target: core.binding, accountRevision: 2, authorizationId: core.request.authorizationId, deletionPolicy: policy, custodyPolicy,
    expectedAuthGraphSha256: o.authGraphSha256, expectedCatalogSha256: o.catalogSha256, expectedEngineSha256: o.engine.metadataSha256, expiresAt: core.binding.leaseUntil, maxObservationAgeMs: 8000,
    retained: Object.fromEntries(Object.entries(o.references).filter(([,v]) => v.count > 0)) };
  // No real independent authority: only synthetic expected pins in this local test.
  const preflight = createCurrentUuidAuthScopePreflight({ enabled: true, admission, writerManifestSha256: String(local.writerManifestSha256), writerCatalogSha256: String(local.writerCatalogSha256), observe: q => core.observation("wd_current_auth_scope_observe", q), observeLocalDenial: q => core.observation(undefined, q) });
  assert.equal((await preflight(core.binding)).outcome, "allowed");
  await core.admin("create function public.synthetic_trigger()returns trigger language plpgsql as $$begin return new;end$$;create trigger synthetic_drift before update on public.wd_accounts for each row execute function public.synthetic_trigger()");
  assert.equal((await preflight(core.binding)).outcome, "held");
  assert.notEqual((await core.observation()).writerCatalogSha256, local.writerCatalogSha256);
}));
test("existing saga release/status retains unknown original; no second original or provider operation", () => trial(core, async () => {
  const original = { operationId: core.binding.deletionOperationId, intentSha256: H, owner: core.binding.workOwner, attempt: 1 };
  const released = await core.rpc("wd_deletion_v2_worker_command", "release", original); assert.ok(released.receipt);
  await core.admin("select 1"); const w = (await core.db.query<{ auth_operation: string; auth_state: string; owner: string | null }>("select auth_operation,auth_state,owner from public.wd_deletion_work where user_id=$1", [A])).rows[0];
  assert.equal(w.auth_operation, core.binding.authOperationId); assert.equal(w.auth_state, "held"); assert.equal(w.owner, null);
  await unchanged(core, () => core.rpc("wd_deletion_v2_worker_command", "admit", { userId: A, operationId: randomUUID(), recoveryHash: H, expectedAccountRevision: 2, identityHash: H, identityEvidence: H, appleLinkage: "none", policy, policyHash: appleDigest(policy), intentSha256: H }));
}));

async function startedExchange(f: Fixture) {
  const op = randomUUID(), lineage = randomUUID();
  await f.admin("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,attempt,expires_at)values($1,$2,$3,'synthetic.app',$3,$3,$4,$5,$6,'started',1,now()+interval '3600 seconds')", [op, A, H, randomUUID().replaceAll("-", "").padEnd(64, "0"), JSON.stringify(custodyPolicy), appleDigest(custodyPolicy)]);
  const body = { ownerId: A, operationId: op, intentSha256: H, envelope: { version: 1, binding: { origin: "https://zpvqxtklvjitofpbddrn.supabase.co", ownerId: A, operationId: op, intentSha256: H, clientId: "synthetic.app", appleIdentityHash: H, lineageId: lineage, keyVersion: "synthetic-v1", policySha256: appleDigest(custodyPolicy) }, iv: "i".repeat(16), tag: "t".repeat(22), ciphertext: "SYNTHETIC-NOT-A-CREDENTIAL" } };
  return { op, lineage, body };
}
test("already-started late custody store preserves ciphertext and unknown; new admit/begin stays denied", () => trial(core, async () => {
  const e = await startedExchange(core);
  assert.equal((await core.rpc("wd_apple_custody_command", "store", e.body)).state, "unknown");
  await core.admin("select 1"); const c = (await core.db.query<{ state: string; present: boolean }>("select state,envelope is not null present from wd_apple_private.credentials where lineage_id=$1", [e.lineage])).rows[0];
  assert.deepEqual(c, { state: "revoking", present: true }); assert.deepEqual(await core.observation(), { outcome: "held" });
  const again = await core.rpc("wd_apple_custody_command", "status", e.body); assert.equal(again.state, "unknown");
  await unchanged(core, () => core.rpc("wd_apple_custody_command", "store", e.body));
  await core.admin("update wd_apple_private.exchanges set state='admitted',attempt=0 where operation_id=$1", [e.op]);
  await unchanged(core, () => core.rpc("wd_apple_custody_command", "begin", e.body));
  await unchanged(core, () => core.rpc("wd_apple_custody_command", "admit", { ownerId: A, operationId: randomUUID(), intentSha256: H, clientId: "synthetic.app", appleIdentityHash: H, identityHash: H, codeHash: "b".repeat(64), policy: custodyPolicy, policySha256: appleDigest(custodyPolicy), reuseLineage: null }));
}));
test("already-started refusal can settle only its exact original without provider replay", () => trial(core, async () => {
  const e = await startedExchange(core);
  assert.equal((await core.rpc("wd_apple_custody_command", "refuse", e.body)).state, "refused");
  const before = await core.digest(); assert.equal((await core.rpc("wd_apple_custody_command", "refuse", e.body)).state, "refused"); assert.deepEqual(await core.digest(), before);
}));
test("exact expired lineage reserve once, direct0023erasure and lost-ACK readback preserve historical operation", () => trial(core, async () => {
  const e = await startedExchange(core); await core.rpc("wd_apple_custody_command", "store", e.body);
  await core.admin("update wd_apple_private.credentials set recovery_until=now()-interval '1 second' where lineage_id=$1", [e.lineage]);
  const attemptId = randomUUID(), body = { policySha256: appleDigest(policy), custodyPolicySha256: appleDigest(custodyPolicy), custodyPolicy, maxRecords: 128, ownerId: A, lineageId: e.lineage, operationId: e.op, intentSha256: H, attemptId };
  assert.equal((await core.rpc("wd_current_retention_inventory_command", "reserve", body)).fresh, true);
  assert.equal((await core.rpc("wd_current_retention_inventory_command", "reserve", { ...body, attemptId: randomUUID() })).fresh, false);
  await unchanged(core, () => core.rpc("wd_current_credential_expiry_command", "erase_expired", { ownerId: B, lineageId: e.lineage, policySha256: appleDigest(custodyPolicy) }));
  const erased = await core.rpc("wd_current_credential_expiry_command", "erase_expired", { ownerId: A, lineageId: e.lineage, policySha256: appleDigest(custodyPolicy) }); assert.equal(erased.outcome, "erased");
  // Treat the ACK as lost. Recovery reads the original afterimage, not erase again.
  const status = await core.rpc("wd_current_retention_inventory_command", "status", body); assert.equal(status.envelopePresent, false); assert.equal(status.operationId, e.op); assert.notEqual(status.operationId, core.binding.deletionOperationId);
  const after = await core.digest(); assert.equal((await core.rpc("wd_current_retention_inventory_command", "status", body)).state, "erased"); assert.deepEqual(await core.digest(), after);
}));
test("closed gate cannot be downgraded by exact confirmed original admission replay", () => trial(core, async () => {
  await core.admin("update wd_apple_private.owners set gate='closed' where owner_id=$1", [A]);
  await core.admin("update wd_deletion_v2_private.intents set verifier=wd_deletion_v2_private.bound_hash(user_id,operation_id,$1) where operation_id=$2", [H, core.binding.deletionOperationId]);
  const basis = await core.rpc("wd_apple_deletion_command", "effective_basis", { userId: A });
  const original = { userId: A, operationId: core.binding.deletionOperationId, recoveryHash: H, expectedAccountRevision: 1, identityHash: H, identityEvidence: H, appleLinkage: "none", policy, policyHash: appleDigest(policy), intentSha256: H };
  const b = { userId: A, currentIdentityHash: H, identityEvidence: H, actualApple: "none", effectiveApple: "none", inventoryRevision: basis.revision, inventoryHash: basis.inventoryHash };
  assert.equal((await core.rpc("wd_apple_deletion_command", "admit_original", { original, basis: b })).outcome, "admitted");
  await core.admin("select 1"); assert.equal((await core.db.query<{ gate: string }>("select gate from wd_apple_private.owners where owner_id=$1", [A])).rows[0].gate, "closed");
}));
test("128 associated retained rows are bounded;129 does not silently sample", () => trial(core, async () => {
  await core.admin("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,attempt,expires_at) select gen_random_uuid(),$1,$2,'synthetic.app',$2,$2,lpad(i::text,64,'0'),$3,$4,'refused',1,now()+interval '3600 seconds' from generate_series(1,128)i", [A, H, JSON.stringify(custodyPolicy), appleDigest(custodyPolicy)]);
  assert.equal((await core.observation()).contract, "wd-current-local-delete-scope-v1");
  await core.admin("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,attempt,expires_at)values(gen_random_uuid(),$1,$2,'synthetic.app',$2,$2,$5,$3,$4,'refused',1,now()+interval '3600 seconds')", [A, H, JSON.stringify(custodyPolicy), appleDigest(custodyPolicy), "c".repeat(64)]);
  assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("unknown provider/cross-owner/parent-expiry facts and Storage/engine contents remain holds", () => trial(core, async () => {
  const e = await startedExchange(core); assert.deepEqual(await core.observation(), { outcome: "held" });
  await core.admin("update wd_apple_private.exchanges set state='unknown' where operation_id=$1", [e.op]); assert.deepEqual(await core.observation(), { outcome: "held" });
  await core.admin("update wd_apple_private.exchanges set state='refused' where operation_id=$1", [e.op]);
  await core.admin("insert into storage.objects values(gen_random_uuid(),'synthetic',$1,$1::uuid::text,'{}')", [A]); assert.deepEqual(await core.observation(), { outcome: "held" });
}));
test("disk close/reopen retains admitted unknown original and forbids a second fresh auth begin", async () => {
  const directory = await mkdtemp(join(dirname(path!), "synthetic-barrier-db-"));
  const f = await fixture(false, directory), t = { userId: A, identityHash: H, operationId: f.binding.authOperationId };
  const fence = await f.rpc("wd_apple_deletion_command", "auth_fence", t);
  const scope = { outcome: "allowed", profile: "wd-owner-uuid-delete-v1", providerPredicate: "account-uuid-only", strongWriteFence: null, accountRevision: 2,
    binding: { ...f.binding, scopeSha256: H, policySha256: appleDigest(policy), authorizationId: f.request.authorizationId, evidenceSha256: H, observedAt: new Date().toISOString(), validUntil: f.binding.leaseUntil }, coverage: { coveredAuthGraphSha256: H, storage: "verified_clear", sharedEngine: "verified_preserved", relatedOwnerReferences: "approved_preserved" } };
  try { assert.equal((await f.rpc("wd_apple_deletion_command", "auth_begin", { ...t, fenceHash: fence.fenceHash, scope })).fresh, true); } finally { await f.db.close(); }
  const reopened = await PGlite.create(directory);
  try {
    await reopened.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "service_role", sub: A })]); await reopened.exec("set role service_role");
    const call = async (action: string, body: unknown) => (await reopened.query<{ r: Data }>("select public.wd_apple_deletion_command($1,$2::jsonb) r", [action, JSON.stringify(body)])).rows[0].r;
    const original = await call("auth_original", t); assert.equal(original.state, "started"); assert.equal(original.scopeProfile, "wd-owner-uuid-delete-v1");
    assert.equal((await call("auth_begin", { ...t, fenceHash: fence.fenceHash, scope })).fresh, false);
    // No real/fake provider transport exists here: the persisted reservation is
    // evidence of unknown effect only, not successful Auth deletion.
  } finally { await reopened.close(); }
});
// PGlite serializes. No test here counts as actual TWO-connection writer versus
// confirm lock-wait/commit/rollback, hosted exclusion or provider admission.
