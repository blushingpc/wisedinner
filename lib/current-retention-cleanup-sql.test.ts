import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID, createHash } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createCurrentRetentionCleanup, type CurrentRetentionCleanupDependencies } from "./current-retention-cleanup.server.ts";
import { appleDigest } from "./apple-token-custody.server.ts";
import { createCurrentAuthScopePreflight, type ScopeAdmission, type ScopeObservation, type ScopeObservationRequest } from "./current-auth-scope.server.ts";
import { createAccountDeletionV2AuthAdapter, type AuthScopeInput } from "./account-deletion-v2-auth.server.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";

// This file is deliberately inert without Main's exact accepted-producer and
// exclusive-slot receipt. Setting a Boolean cannot substitute for that receipt.
const admissionFile = process.env.WD_RETENTION_SQL_ADMISSION;
const gated = { skip: admissionFile ? false : "Main accepted0023 and exclusive SQL slot not supplied" };
const custodyPolicy = { approved: true as const, version: "synthetic-only", credentialSeconds: 3600, recoverySeconds: 7200, evidenceSeconds: 10800, retainedEvidence: ["apple_credential_recovery"] };
const deletionPolicy = { approved: true as const, version: "synthetic-only", preparedSeconds: 3600, pendingSeconds: 3600, recoverySeconds: 3600, receiptSeconds: 3600, retainedEvidence: ["deletion_receipt", "apple_credential_recovery"] };
const ch = appleDigest(custodyPolicy), dh = appleDigest(deletionPolicy);
const hash = (x: string) => createHash("sha256").update(x).digest("hex");
const prerequisite = ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql", "0021_wd_deletion_lifecycle_v2.sql", "0022_wd_apple_token_custody.sql"];
async function fixture() {
  assert.ok(admissionFile);
  const receipt = JSON.parse(await readFile(admissionFile, "utf8"));
  assert.equal(receipt.contract, "wd-retention-sql-admission-v1");
  assert.equal(receipt.manager, "01a10302-a7d9-72f3-8abf-64605cde3a58");
  assert.equal(receipt.worker, "01a192f8-e59a-71a2-9149-1158d9e93c50");
  assert.equal(receipt.taskId, "backend-retention-maintenance-20261031");
  assert.equal(receipt.exclusiveSlotGranted, true);
  assert.equal(receipt.producerAccepted, true);
  assert.ok(Number.isFinite(Date.parse(receipt.validUntil)) && Date.parse(receipt.validUntil) > Date.now(), "current bounded slot receipt required");
  const producer = await readFile(receipt.acceptedProducer.file, "utf8");
  assert.equal(hash(producer), receipt.acceptedProducer.sha256);
  assert.match(producer, /create function public\.wd_current_credential_expiry_command/);
  const dir = await mkdtemp(path.join(tmpdir(), "wd-retention-sql-"));
  const { PGlite: Database } = await import("@electric-sql/pglite");
  let db: PGlite = await Database.create(dir), eraseCalls = 0, loseStatus = false;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create table auth.users(id uuid primary key);
    create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    grant select on auth.users,auth.identities to service_role;`);
    for (const name of prerequisite) await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    await db.exec(producer);
    // Actual accepted Auth producer, not a regex or replacement observer.
    await db.exec(await readFile(new URL("../supabase/migrations/0024_wd_current_auth_scope.sql", import.meta.url), "utf8"));
    await db.exec(`create schema storage;grant usage on schema storage to service_role;
      create table storage.buckets(id text primary key,owner uuid,owner_id text);
      create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
      create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
      create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
      grant select on all tables in schema storage to service_role;
      create schema extensions;create table extensions.source_retention_sentinel(id int primary key);insert into extensions.source_retention_sentinel values(23);
      create table public.ce_retention_sentinel(id int primary key);insert into public.ce_retention_sentinel values(17);`);
    await db.exec(await readFile(new URL("../supabase/migrations/0025_wd_current_retention_inventory.sql", import.meta.url), "utf8"));
  } catch (error) {
    await db.close(); await rm(dir, { recursive: true, force: true }); throw error;
  }
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(run: () => Promise<T>) => { const p = queue.then(run); queue = p.catch(() => {}); return p; };
  const admin = <T>(run: (db: PGlite) => Promise<T>) => serial(async () => { await db.exec("reset role"); return run(db); });
  const rpc = (name: "wd_current_retention_inventory_command" | "wd_current_credential_expiry_command", action: string, body: unknown, role = "service_role") => serial(async () => {
    assert.ok(["service_role", "authenticated", "anon"].includes(role));
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role })]);
    await db.exec("set role " + role);
    return (await db.query<{ r: Record<string, unknown> }>(`select public.${name}($1,$2::jsonb) r`, [action, JSON.stringify(body)])).rows[0].r;
  });
  const common = { policySha256: dh, custodyPolicySha256: ch, custodyPolicy, maxRecords: 4 };
  const deps: CurrentRetentionCleanupDependencies = {
    deletionPolicy, custodyPolicy, schemaSha256: "", eraserSha256: "", maxRecords: 4, freshnessMs: 30000, clockSkewMs: 30000,
    repository: { command: async (action, body) => { if (loseStatus && action === "status") throw Error("lost_status_ack"); return rpc("wd_current_retention_inventory_command", action, body); } },
    eraseExpired: async body => { eraseCalls++; return rpc("wd_current_credential_expiry_command", "erase_expired", body); },
    readAdmission: async () => ({ outcome: "admitted", registryId: "wd-apple-custody-v1", policySha256: dh, custodyPolicySha256: ch, ...await admin(async d => (await d.query<{ p: Record<string, unknown> }>("select wd_apple_private.current_retention_schema() p")).rows[0].p), observedAt: Date.now(), validUntil: Date.now() + 30000 })
  };
  const schema = await admin(async d => (await d.query<{ p: { schemaSha256: string; eraserSha256: string } }>("select wd_apple_private.current_retention_schema() p")).rows[0].p);
  const ready = { ...deps, ...schema };
  const seed = async (due: boolean, state = "available", policyHash = ch, policy = custodyPolicy, withCredential = true) => {
    const ownerId = randomUUID(), lineageId = randomUUID(), operationId = randomUUID(), intentSha256 = hash(operationId);
    await admin(async d => {
      await d.query("insert into wd_apple_private.owners(owner_id)values($1)", [ownerId]);
      await d.query("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,expires_at)values($1,$2,$3,'synthetic.native',$3,$3,$3,$4,$5,$6,now()+interval '1 hour')", [operationId, ownerId, intentSha256, JSON.stringify(policy), policyHash, state === "revoke_unknown" ? "unknown" : "stored"]);
      if (withCredential) await d.query("insert into wd_apple_private.credentials(lineage_id,operation_id,owner_id,client_id,apple_identity_hash,policy_hash,envelope,state,expires_at,recovery_until)values($1,$2,$3,'synthetic.native',$4,$5,'{\"synthetic\":true}',$6,now()+make_interval(secs=>$7),now()+make_interval(secs=>$7))", [lineageId, operationId, ownerId, intentSha256, policyHash, state, due ? -1 : 3600]);
    });
    return { ownerId, lineageId, operationId, intentSha256 };
  };
  return { admin, rpc, seed, common, deps: ready, run: () => createCurrentRetentionCleanup(ready).verify({ policySha256: dh, now: Date.now() }), counts: () => eraseCalls,
    loseStatus: (v: boolean) => loseStatus = v,
    reopen: () => serial(async () => { await db.close(); db = await Database.create(dir); }),
    close: async () => { await queue; await db.close(); await rm(dir, { recursive: true, force: true }); } };
}

test("actual accepted0023+0025 erase is independent of prepare; large active population, original readback and provider unknown survive reopen", gated, async () => {
  const f = await fixture(); try {
    for (let i = 0; i < 20; i++) await f.seed(false);
    await f.seed(true); const unknownProvider = await f.seed(true, "revoke_unknown");
    const result = await f.run(); assert.equal(result.outcome, "verified"); assert.equal(f.counts(), 2);
    assert.ok(result.outcome === "verified" && Number.isSafeInteger(result.validUntil) && result.validUntil > Date.now());
    await f.admin(async d => {
      assert.equal((await d.query<{ n: number }>("select count(*)::int n from wd_deletion_v2_private.intents")).rows[0].n, 0);
      assert.equal((await d.query<{ n: number }>("select count(*)::int n from wd_apple_private.credentials where envelope is not null")).rows[0].n, 20);
      assert.equal((await d.query<{ state: string }>("select state from wd_apple_private.exchanges where operation_id=$1", [unknownProvider.operationId])).rows[0].state, "unknown");
      assert.equal((await d.query<{ n: number }>("select count(*)::int n from wd_apple_private.current_retention_attempts where readback_at is not null")).rows[0].n, 2);
    });
    const lost = await f.seed(true); f.loseStatus(true); assert.deepEqual(await f.run(), { outcome: "held" }); assert.equal(f.counts(), 3);
    await f.reopen(); f.loseStatus(false); assert.equal((await f.run()).outcome, "verified"); assert.equal(f.counts(), 3);
    const after = await f.admin(async d => (await d.query<{ state: string; envelope: unknown }>("select state,envelope from wd_apple_private.credentials where lineage_id=$1", [lost.lineageId])).rows[0]);
    assert.equal(after.state, "erased"); assert.equal(after.envelope, null);
    assert.equal((await f.run()).outcome, "verified"); assert.equal(f.counts(), 3);
  } finally { await f.close(); }
});
test("actual SQL due overflow, foreign policy, unknown eligibility and partial original all hold", gated, async () => {
  const f = await fixture(); try {
    const row = await f.seed(true);
    const pending = createCurrentRetentionCleanup({ ...f.deps, eraseExpired: async () => ({ outcome: "unknown" }) });
    assert.deepEqual(await pending.verify({ policySha256: dh, now: Date.now() }), { outcome: "held" });
    assert.deepEqual(await f.run(), { outcome: "held" }); assert.equal(f.counts(), 0, "pending original may not resend");
    const original = await f.admin(async d => (await d.query<{ envelope: unknown }>("select envelope from wd_apple_private.credentials where lineage_id=$1", [row.lineageId])).rows[0]); assert.notEqual(original.envelope, null);
    await f.seed(true, "available", "f".repeat(64), { ...custodyPolicy, version: "foreign" });
    let inv = await f.rpc("wd_current_retention_inventory_command", "inventory", f.common); assert.equal(inv.foreignPolicyCount, 1); assert.deepEqual(await f.run(), { outcome: "held" });
    for (let i = 0; i < 5; i++) await f.seed(true);
    inv = await f.rpc("wd_current_retention_inventory_command", "inventory", f.common); assert.equal(inv.overflow, true); assert.equal((inv.rows as unknown[]).length, 5); assert.deepEqual(await f.run(), { outcome: "held" });
    const missing = await f.seed(false, "available", ch, custodyPolicy, false);
    await f.admin(d => d.query("update wd_apple_private.exchanges set state='unknown',expires_at=now()-interval '1 second' where operation_id=$1", [missing.operationId]));
    inv = await f.rpc("wd_current_retention_inventory_command", "inventory", f.common); assert.equal(inv.unknownCount, 1); assert.equal(f.counts(), 0);
  } finally { await f.close(); }
});
test("actual SQL denies foreign-owner, active and non-due erase reservations and unprivileged reads", gated, async () => {
  const f = await fixture(); try {
    const active = await f.seed(false), due = await f.seed(true), attemptId = randomUUID();
    assert.equal((await f.rpc("wd_current_retention_inventory_command", "reserve", { ...f.common, ...active, attemptId })).error, "not_due");
    assert.equal((await f.rpc("wd_current_retention_inventory_command", "reserve", { ...f.common, ...due, ownerId: active.ownerId, attemptId })).error, "original_unverified");
    for (const role of ["anon", "authenticated"]) await assert.rejects(f.rpc("wd_current_retention_inventory_command", "inventory", f.common, role), /permission denied/);
    await f.admin(async d => {
      const acl = (await d.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>("select relrowsecurity,relforcerowsecurity from pg_class where oid='wd_apple_private.current_retention_attempts'::regclass")).rows[0]; assert.equal(acl.relrowsecurity, true); assert.equal(acl.relforcerowsecurity, true);
      assert.equal((await d.query<{ ok: boolean }>("select has_table_privilege('service_role','wd_apple_private.current_retention_attempts','SELECT') ok")).rows[0].ok, false);
      assert.equal((await d.query<{ proconfig: string[] }>("select proconfig from pg_proc where oid='public.wd_current_retention_inventory_command(text,jsonb)'::regprocedure")).rows[0].proconfig.join(), 'search_path=""');
    });
    assert.equal(f.counts(), 0);
  } finally { await f.close(); }
});


const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
type SqlFixture = Awaited<ReturnType<typeof fixture>>;
// All SQL calls, including roles and reopened disk connections, use the original
// serial queue. This is NOT a multi-connection concurrency test.
async function composition(f: SqlFixture) {
  let deleted = false, deletes = 0, fault = "", identityChanged = false;
  const user = { id: A, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: randomUUID(), user_id: A, provider: "email", id: "synthetic-email-lineage", created_at: "2026-10-01T00:00:00Z" }] };
  let quiescent = false;
  const transport: typeof fetch = async (url, init) => {
    assert.equal(String(url), "https://retention.invalid/auth/v1/admin/users/" + A);
    if (init?.method === "DELETE") {
      assert.equal(quiescent, true, "synthetic host exclusion remains held THROUGH fake DELETE");
      deletes++; assert.equal(deletes, 1, "no duplicate provider effects"); deleted = true;
      if (fault === "delete") throw Error("synthetic_delete_ack_lost");
      return Response.json({});
    }
    if (deleted) return Response.json({ code: "user_not_found" }, { status: 404 });
    return Response.json(identityChanged ? { ...user, identities: [{ ...user.identities[0], id: "changed" }] } : user);
  };
  const identity = await supabaseDeletionAuthV2("https://retention.invalid", "synthetic", transport).verifyIdentity(A); assert.ok(identity);
  const binding: AuthScopeInput = { userId: A, identityHash: identity.identityHash, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: hash(randomUUID()), workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(Date.now() + 120000).toISOString() };
  const sql = (statement: string, values: unknown[] = []) => f.admin(d => values.length || !statement.includes(";") ? d.query<Record<string, unknown>>(statement, values) : d.exec(statement).then(() => ({ rows: [] as Record<string, unknown>[] })));
  await sql("insert into auth.users values($1),($2)", [A, B]);
  await sql("insert into public.wd_accounts(user_id,state,revision,preferences,deletion_dependencies)values($1,'deletion_pending',2,'{}',$3),($2,'active',1,'{}',null)", [A, B, JSON.stringify({ authDeletion: "pending", sessionInvalidation: "pending", appleRevocation: "review_required", subscriptionCancellation: "not_performed" })]);
  await sql("insert into public.wd_deletion_work(user_id,owner,attempt,lease_until,identity_hash,identity_evidence,apple_linkage,apple_state,auth_state,auth_operation)values($1,$2,1,$3,$4,$4,'linked','held','started',$5)", [A, binding.workOwner, binding.leaseUntil, binding.identityHash, binding.authOperationId]);
  await sql("insert into wd_deletion_v2_private.intents(operation_id,user_id,intent_hash,verifier,account_revision,identity_hash,identity_evidence,apple_linkage,policy,policy_hash,phase,data_state,apple_disposition,prepared_until,recovery_until,receipt_until)values($1,$2,$3,$3,2,$4,$4,'linked',$5,$6,'confirmed','cleared','unknown',now()+interval '1 minute',now()+interval '1 hour',now()+interval '1 hour')", [binding.deletionOperationId, A, binding.intentSha256, binding.identityHash, JSON.stringify(deletionPolicy), dh]);
  await sql("insert into wd_apple_private.owners(owner_id,gate,reserved_original)values($1,'closed',$2)", [A, binding.deletionOperationId]);
  await sql("insert into wd_apple_private.deletion_bindings values($1,$2,$3,$4,'none','linked',$3)", [binding.deletionOperationId, A, binding.intentSha256, binding.identityHash]);
  const service = <T>(run: (d: PGlite) => Promise<T>, role = "service_role") => f.admin(async d => {
    assert.ok(["service_role", "anon", "authenticated"].includes(role));
    await d.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role, sub: A })]); await d.exec("set role " + role); return run(d);
  });
  const repository = { command: async (namespace: "custody" | "revocation" | "deletion", action: string, body: Record<string, unknown>) => {
    assert.equal(namespace, "deletion");
    const row = await service(async d => (await d.query<{ r: Record<string, unknown> }>("select public.wd_apple_deletion_command($1,$2::jsonb) r", [action, JSON.stringify(body)])).rows[0].r);
    if (fault === action) throw Error("synthetic_lost_" + action + "_ack");
    return row;
  } };
  const target = { userId: A, identityHash: binding.identityHash, operationId: binding.authOperationId };
  const fence = await repository.command("deletion", "auth_fence", target); assert.equal(fence.currentIdentityHash, binding.identityHash); binding.leaseUntil = String(fence.lease);
  const request: ScopeObservationRequest = { binding, policySha256: dh, scopeSha256: hash("synthetic-scope"), authorizationId: randomUUID(), custodyPolicy, custodyPolicySha256: ch };
  const observe = (req = request, role = "service_role") => service(async d => (await d.query<{ r: ScopeObservation }>("select public.wd_current_auth_scope_observe($1::jsonb) r", [JSON.stringify(req)])).rows[0].r, role);
  const allowRestoreRead = () => sql("grant select on wd_restore_intents,wd_restore_lineages,wd_restore_aliases,wd_restore_fences to service_role");
  const admission = (o: ScopeObservation): ScopeAdmission => ({ authorizationId: request.authorizationId, target: binding, deletionPolicy, custodyPolicy, accountRevision: 2, expectedAuthGraphSha256: o.authGraphSha256, expectedCatalogSha256: o.catalogSha256, expectedEngineSha256: o.engine.metadataSha256, expiresAt: binding.leaseUntil, maxObservationAgeMs: 8000, retained: Object.fromEntries(Object.entries(o.references).filter(([, v]) => v.count > 0)) as ScopeAdmission["retained"] });
  // This is explicitly a fixture-owned trusted host, never production readiness.
  // It excludes every synthetic provider/writer until the adapter call finishes.
  const adapter = (a: ScopeAdmission, trusted = false) => createAccountDeletionV2AuthAdapter({ origin: "https://retention.invalid", serverCredential: "synthetic", repository, request: transport,
    preflight: createCurrentAuthScopePreflight({ enabled: true, admission: a, observe: async req => { const o = await observe(req); return trusted && quiescent && o.references ? { ...o, writeFence: { bindingSha256: appleDigest(req), evidenceSha256: hash("synthetic-host-exclusion"), validUntil: binding.leaseUntil } } : o; } }) });
  const run = async (a: ScopeAdmission, trusted = false) => { assert.equal(quiescent, false); quiescent = trusted; try { return await adapter(a, trusted).auth.run(target); } finally { quiescent = false; } };
  const snapshot = () => sql("select (select count(*) from public.ce_retention_sentinel) engine,(select count(*) from extensions.source_retention_sentinel) source,(select count(*) from public.wd_accounts where user_id='" + B + "') other,(select count(*) from auth.users) users");
  return { sql, service, binding, request, target, repository, observe, admission, allowRestoreRead, adapter, run, snapshot, deletes: () => deletes, fault: (v: string) => fault = v, changeIdentity: (v: boolean) => identityChanged = v };
}
async function historical(f: Awaited<ReturnType<typeof composition>>, owner = A, resolved = true, seconds = 3600) {
  const operation = randomUUID(), lineage = randomUUID(), attempt = randomUUID(), intent = hash(operation);
  await f.sql("insert into wd_apple_private.owners(owner_id)values($1)on conflict do nothing", [owner]);
  await f.sql("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,created_at,expires_at)values($1,$2,$3,'synthetic.native',$3,$3,$3,$4,$5,'stored',now()-make_interval(secs=>10800-$6::integer),now()+make_interval(secs=>$6::integer))", [operation, owner, intent, JSON.stringify(custodyPolicy), ch, seconds]);
  await f.sql("insert into wd_apple_private.credentials(lineage_id,operation_id,owner_id,client_id,apple_identity_hash,policy_hash,envelope,state,expires_at,recovery_until)values($1,$2,$3,'synthetic.native',$4,$5,$6,$7,now()-interval '1 second',now()-interval '1 second')", [lineage, operation, owner, intent, ch, resolved ? null : JSON.stringify({ ciphertext: "synthetic-ciphertext-sentinel" }), resolved ? "erased" : "available"]);
  await f.sql("insert into wd_apple_private.current_retention_attempts(lineage_id,owner_id,operation_id,intent_hash,policy_hash,attempt_id,readback_at)values($1,$2,$3,$4,$5,$6,case when $7::boolean then now() else null end)", [lineage, owner, operation, intent, ch, attempt, resolved]);
  return { operation, lineage, attempt, intent };
}

test("combined0023/0024/0025 real preflight and Auth adapter: empty/nonempty historical email, mutations and lost DELETE ACK recover without resend", gated, async () => {
  const f = await fixture(); try {
    const c = await composition(f); assert.deepEqual(await c.observe(), { outcome: "held" }, "actual restore privacy is not bypassed"); await c.allowRestoreRead();
    const empty = await c.observe(); assert.equal(empty.references.retentionAttempts.count, 0); assert.equal(empty.references.retentionAttempts.validUntil, null); assert.equal(empty.writeFence, null);
    assert.equal((await c.run(c.admission(empty))).outcome, "not_started"); assert.equal(c.deletes(), 0, "bare SQL cannot grant DELETE");
    const row = await historical(c); await historical(c);
    assert.notEqual(row.operation, c.binding.deletionOperationId); assert.notEqual(row.intent, c.binding.identityHash, "historical custody hash differs from current email identity");
    const expired = await historical(c, A, false);
    await c.sql("delete from wd_apple_private.current_retention_attempts where lineage_id=$1", [expired.lineage]);
    assert.equal((await f.run()).outcome, "verified", "actual factory and direct0023 cleanup before any new deletion prepare");
    assert.equal(f.counts(), 1);
    const foreign = await historical(c, B, false);
    const o = await c.observe(), a = c.admission(o); assert.equal(o.references.retentionAttempts.count, 3); assert.equal(o.providerOperations, "settled");
    assert.doesNotMatch(JSON.stringify(o), /synthetic-ciphertext|ciphertext|envelope|code_hash/);
    const sentinels = await c.snapshot();
    const mutations: [string, string, unknown[]][] = [
      ["attempt-only A", "update wd_apple_private.credentials set owner_id=$2 where lineage_id=$1;update wd_apple_private.exchanges set owner_id=$2 where operation_id=(select operation_id from wd_apple_private.credentials where lineage_id=$1)", [row.lineage, B]],
      ["credential-only A", "update wd_apple_private.current_retention_attempts set owner_id=$2 where lineage_id=$1;update wd_apple_private.exchanges set owner_id=$2 where operation_id=(select operation_id from wd_apple_private.credentials where lineage_id=$1)", [row.lineage, B]],
      ["exchange-only A", "update wd_apple_private.credentials set owner_id=$2 where lineage_id=$1;update wd_apple_private.current_retention_attempts set owner_id=$2 where lineage_id=$1", [row.lineage, B]],
      ["lineage/operation", "update wd_apple_private.current_retention_attempts set operation_id=$2 where lineage_id=$1", [row.lineage, foreign.operation]],
      ["attempt intent", "update wd_apple_private.current_retention_attempts set intent_hash=repeat('b',64) where lineage_id=$1", [row.lineage]],
      ["attempt policy", "update wd_apple_private.current_retention_attempts set policy_hash=repeat('b',64) where lineage_id=$1", [row.lineage]],
      ["credential policy", "update wd_apple_private.credentials set policy_hash=repeat('b',64) where lineage_id=$1", [row.lineage]],
      ["exchange policy", "update wd_apple_private.exchanges set policy_hash=repeat('b',64) where operation_id=$1", [row.operation]],
      ["changed attempt", "update wd_apple_private.current_retention_attempts set attempt_id=gen_random_uuid() where lineage_id=$1", [row.lineage]],
      ["changed content", "update wd_apple_private.current_retention_attempts set readback_at=null,reserved_at=reserved_at-interval '1 second' where lineage_id=$1", [row.lineage]],
      ["changed parent expiry", "update wd_apple_private.exchanges set expires_at=expires_at+interval '1 second' where operation_id=$1", [row.operation]],
      ["expired parent", "update wd_apple_private.exchanges set created_at=now()-interval '4 hours',expires_at=now()-interval '1 hour' where operation_id=$1", [row.operation]],
      ["active provider", "update wd_apple_private.exchanges set state='started' where operation_id=$1", [row.operation]],
      ["unknown provider", "update wd_apple_private.exchanges set state='unknown' where operation_id=$1", [row.operation]],
      ["stale attempt", "update public.wd_deletion_work set attempt=attempt+1 where user_id=$1", [A]],
      ["intent binding", "update wd_deletion_v2_private.intents set intent_hash=repeat('b',64) where operation_id=$1", [c.binding.deletionOperationId]],
      ["unknown Auth call", "insert into wd_apple_private.auth_attempts values($1,$2,$3,$4,'{}',$3,'started',null)", [randomUUID(), A, c.binding.identityHash, c.binding.deletionOperationId]],
      ["revision", "update public.wd_accounts set revision=revision+1 where user_id=$1", [A]],
      ["owner A/B", "update public.wd_deletion_work set owner=$1 where user_id=$2", [randomUUID(), A]],
      ["lease", "update public.wd_deletion_work set lease_until=lease_until-interval '1 second' where user_id=$1", [A]],
      ["foreign deletion policy", "update wd_deletion_v2_private.intents set policy_hash=repeat('b',64) where operation_id=$1", [c.binding.deletionOperationId]],
      ["incomplete residue", "insert into public.wd_account_receipts(user_id,id,request,result)values($1,gen_random_uuid(),'{}','{}')", [A]],
    ];
    for (const [label, statements, args] of mutations) {
      await c.sql("begin");
      try { for (const statement of statements.split(";")) await c.sql(statement, args); assert.equal((await c.run(a, true)).outcome, "not_started", label); assert.equal(c.deletes(), 0, label); }
      finally { await c.sql("rollback"); }
    }
    // A/B/A returns to the exact admitted generation; no stale intermediate
    // owner, orphan or current identity can authorize an effect.
    c.changeIdentity(true); assert.equal((await c.run(a, true)).outcome, "not_started"); c.changeIdentity(false);
    for (const column of ["lineage_id", "operation_id"]) {
      await c.sql("begin;set session_replication_role=replica");
      try { await c.sql(`update wd_apple_private.current_retention_attempts set ${column}=$1 where lineage_id=$2`, [randomUUID(), row.lineage]); assert.deepEqual(await c.observe(), { outcome: "held" }); assert.equal((await c.run(a, true)).outcome, "not_started"); }
      finally { await c.sql("rollback"); }
    }
    assert.equal(c.deletes(), 0); assert.deepEqual(await c.snapshot(), sentinels);
    const foreignBefore = await c.sql("select envelope,state from wd_apple_private.credentials where lineage_id=$1", [foreign.lineage]);
    await f.reopen(); assert.deepEqual(await c.observe().then(x => x.references.retentionAttempts), o.references.retentionAttempts);
    // Lease remains the same; re-review the exact current observation after disk reopen.
    const current = c.admission(await c.observe()); c.fault("delete");
    assert.equal((await c.run(current, true)).outcome, "unknown"); assert.equal(c.deletes(), 1);
    await f.reopen(); c.fault(""); assert.equal((await c.adapter(current, true).auth.reconcile!(c.target)).outcome, "already_absent");
    assert.equal((await c.adapter(current, true).auth.reconcile!(c.target)).outcome, "confirmed");
    assert.equal((await c.run(current, true)).outcome, "not_started"); assert.equal(c.deletes(), 1);
    assert.deepEqual(await c.sql("select envelope,state from wd_apple_private.credentials where lineage_id=$1", [foreign.lineage]), foreignBefore); assert.deepEqual(await c.snapshot(), sentinels);
  } finally { await f.close(); }
});

test("combined SQL128/129 exact references, strict v2 DTOs, ACL/private/RLS and unknown schema hold with zero fake DELETE", gated, async () => {
  const f = await fixture(); try {
    const c = await composition(f); await c.allowRestoreRead();
    for (let i = 0; i < 128; i++) await historical(c);
    const o = await c.observe(); assert.equal(o.references.retentionAttempts.count, 128); const a = c.admission(o);
    const proof = await createCurrentAuthScopePreflight({ enabled: true, admission: a, observe: async req => { const x = await c.observe(req); return { ...x, writeFence: { bindingSha256: appleDigest(req), evidenceSha256: hash("synthetic128"), validUntil: c.binding.leaseUntil } }; } })(c.binding);
    assert.equal(proof.outcome, "allowed"); assert.equal(c.deletes(), 0);
    for (const role of ["anon", "authenticated"]) { await assert.rejects(c.observe(c.request, role), /permission denied/); await assert.rejects(c.service(d => d.query("select * from wd_apple_private.current_retention_attempts"), role), /permission denied/); }
    await assert.rejects(c.service(d => d.query("select * from wd_apple_private.current_retention_attempts")), /permission denied/);
    await assert.rejects(c.service(d => d.query("select * from wd_apple_private.credentials")), /permission denied/);
    const acl = await c.sql("select relrowsecurity,relforcerowsecurity from pg_class where oid='wd_apple_private.current_retention_attempts'::regclass"); assert.deepEqual(acl.rows[0], { relrowsecurity: true, relforcerowsecurity: true });
    for (const [label, statement] of [
      ["unknown table", "create table wd_apple_private.unclassified_retention(owner_id uuid)"],
      ["unknown column", "alter table wd_apple_private.current_retention_attempts add column unknown_fact text"],
    ]) { await c.sql("begin"); try { await c.sql(statement); assert.equal((await c.run(a, true)).outcome, "not_started", label); assert.equal(c.deletes(), 0); } finally { await c.sql("rollback"); } }
    for (const ref of [{ ...o.references.retentionAttempts, validUntil: null }, { ...o.references.retentionAttempts, count: 0 }, { ...o.references.retentionAttempts, extra: true }]) {
      const bad = { ...a, retained: { ...a.retained, retentionAttempts: ref } }; assert.equal((await c.run(bad, true)).outcome, "not_started"); assert.equal(c.deletes(), 0);
    }
    await historical(c); assert.deepEqual(await c.observe(), { outcome: "held" }); assert.equal((await c.run(a, true)).outcome, "not_started"); assert.equal(c.deletes(), 0);
  } finally { await f.close(); }
});

test("actual SQL durable retention faults before/after reserve/erase/status and independent instances never resend an unknown original", gated, async () => {
  const f = await fixture(); try {
    const row = await f.seed(true); const run = (deps: CurrentRetentionCleanupDependencies) => createCurrentRetentionCleanup(deps).verify({ policySha256: dh, now: Date.now() });
    const original = f.deps.repository.command;
    const beforeReserve = { ...f.deps, repository: { command: async (action: Parameters<typeof original>[0], body: Record<string, unknown>) => { if (action === "reserve") throw Error("before_reserve"); return original(action, body); } } };
    assert.deepEqual(await run(beforeReserve), { outcome: "held" }); assert.equal(f.counts(), 0);
    const afterReserve = { ...f.deps, repository: { command: async (action: Parameters<typeof original>[0], body: Record<string, unknown>) => { const result = await original(action, body); if (action === "reserve") throw Error("after_reserve_lost_ack"); return result; } } };
    assert.deepEqual(await run(afterReserve), { outcome: "held" }); await f.reopen(); assert.deepEqual(await f.run(), { outcome: "held" }); assert.equal(f.counts(), 0, "reserve ACK loss must not invent erase permission");
    const reserved = await f.admin(d => d.query<{ attempt_id: string }>("select attempt_id from wd_apple_private.current_retention_attempts where lineage_id=$1", [row.lineageId])); assert.ok(reserved.rows[0].attempt_id);
    // Resolve only the synthetic disk row as a separately observed external erasure,
    // then status confirms the exact original without retrying erase.
    await f.admin(d => d.query("update wd_apple_private.credentials set state='erased',envelope=null where lineage_id=$1", [row.lineageId])); assert.equal((await f.run()).outcome, "verified"); assert.equal(f.counts(), 0);
    await f.seed(true);
    const afterErase = { ...f.deps, eraseExpired: async (body: Parameters<typeof f.deps.eraseExpired>[0]) => { await f.deps.eraseExpired(body); throw Error("after_erase_lost_ack"); } };
    assert.equal((await run(afterErase)).outcome, "verified"); assert.equal(f.counts(), 1); await f.reopen(); assert.equal((await f.run()).outcome, "verified"); assert.equal(f.counts(), 1);
    await f.seed(true); let lost = false;
    const afterStatus = { ...f.deps, repository: { command: async (action: Parameters<typeof original>[0], body: Record<string, unknown>) => { const result = await original(action, body); if (action === "status" && !lost) { lost = true; throw Error("after_status_ack_lost"); } return result; } } };
    assert.deepEqual(await run(afterStatus), { outcome: "held" }); await f.reopen(); assert.equal((await f.run()).outcome, "verified"); assert.equal(f.counts(), 2);
    await f.seed(true); const before = f.counts(); const results = await Promise.all([run(f.deps), run(f.deps)]); assert.ok(results.every(r => r.outcome === "verified" || r.outcome === "held")); assert.equal(f.counts(), before + 1); assert.equal((await f.run()).outcome, "verified"); assert.equal(f.counts(), before + 1);
  } finally { await f.close(); }
});
