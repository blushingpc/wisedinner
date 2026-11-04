import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createHash, randomUUID } from "node:crypto";
import type { ScopeObservation, ScopeObservationRequest, ScopeAdmission, CurrentScopeReference } from "./current-auth-scope.server.ts";
import { createCurrentAuthScopePreflight, CURRENT_AUTH_SCOPE_REFERENCES } from "./current-auth-scope.server.ts";
import { appleDigest } from "./apple-token-custody.server.ts";
import type { AuthScopeInput } from "./account-deletion-v2-auth.server.ts";
import type { DeletionV2Policy } from "./account-deletion-v2.server.ts";

// No PGlite import/initialization or SQL execution without the separately granted
// shared slot AND a current Main-accepted0023 producer pin. This file is part of
// the later serial integrated cohort, not a claim of synthetic/hosted acceptance.
const accepted0023 = process.env.WD_CURRENT_SCOPE_ACCEPTED_0023_SHA256 ?? "";
const runSql = process.env.WD_CURRENT_SCOPE_SQL_RUN === "1" && /^[a-f0-9]{64}$/.test(accepted0023);
const skip = runSql ? false : "Main heavy-slot grant and FINAL accepted0023 SHA256 required; SQL unrun";
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002", H = "a".repeat(64);
const migration = new URL("../supabase/migrations/0024_wd_current_auth_scope.sql", import.meta.url);
const custodyPolicy = { approved: true as const, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
const policy: DeletionV2Policy = { approved: true, version: "synthetic-sql-scope", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };

test("0024 source contract is read-only, narrow-role, no Storage/engine/table grants or activation", async () => {
  const sql = await readFile(migration, "utf8");
  assert.match(sql, /create function public\.wd_current_auth_scope_observe\(p_body jsonb\)/);
  assert.match(sql, /language plpgsql security invoker set search_path=''/);
  assert.match(sql, /'writeFence',null/);
  assert.match(sql, /current_user<>'service_role'/);
  assert.match(sql, /revoke all on function public\.wd_current_auth_scope_observe\(jsonb\) from public,anon,authenticated,service_role/);
  const statements = [...sql.matchAll(/create function[\s\S]*?as \$\$([\s\S]*?)\$\$;/g)].map(m=>m[1]).join("\n").replace(/--[^\n]*/g, "");
  assert.ok(statements.length>1000,"inspect actual observer/private function bodies, not the separate temporary DDL membership lease");
  assert.doesNotMatch(statements, /\b(insert\s+into|update\s+(?:public|storage|wd_)|delete\s+from|truncate|drop|create\s+(?:table|policy)|alter\s+table)\b/i);
  assert.doesNotMatch(statements, /grant\s+(?:select|insert|update|delete|all|bypassrls)\b/i);
});

async function fixture(supported = false) {
  const { PGlite } = await import("@electric-sql/pglite");
  const db = await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create table auth.users(id uuid primary key);
    create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    grant select on auth.users,auth.identities to service_role;`);
  for (const name of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql", "0021_wd_deletion_lifecycle_v2.sql", "0022_wd_apple_token_custody.sql"]) await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
  const producer = await readFile(new URL("../supabase/migrations/0023_wd_deletion_prepared_retirement.sql", import.meta.url));
  assert.equal(createHash("sha256").update(producer).digest("hex"), accepted0023, "Never adopt live/unaccepted0023 bytes");
  await db.exec(producer.toString("utf8"));
  await db.exec(`create schema storage;grant usage on schema storage to service_role;
    create table storage.buckets(id text primary key,owner uuid,owner_id text);
    create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
    grant select on all tables in schema storage to service_role;
    create table public.ce_scope_sentinel(id int primary key);insert into public.ce_scope_sentinel values(17);
    create schema extensions;create table ${supported ? "extensions" : "public"}.source_scope_sentinel(id int primary key);insert into ${supported ? "extensions" : "public"}.source_scope_sentinel values(23);`);
  await db.exec(await readFile(migration, "utf8"));
  // Pinned candidate relation fixture only; final consumer acceptance is Backend5.
  const retention = await readFile(new URL("file:///C:/Users/borgh/Projects/wd-relay-backend-5-20261031/supabase/migrations/0025_wd_current_retention_inventory.sql"));
  assert.equal(createHash("sha256").update(retention).digest("hex"), "0a9cc997cc5651c330cbf1db0d84547abeed9e5a8537c1f42ac873eaeb6fdc4a");
  await db.exec(retention.toString("utf8"));
  const binding: AuthScopeInput = { userId: A, identityHash: H, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(Date.now() + 120000).toISOString() };
  await db.query("insert into auth.users values($1),($2)", [A, B]);
  await db.query("insert into public.wd_accounts(user_id,state,revision,preferences,deletion_dependencies)values($1,'deletion_pending',2,'{}',$3),($2,'active',1,'{}',null)", [A, B, JSON.stringify({ authDeletion: "pending", sessionInvalidation: "pending", appleRevocation: "review_required", subscriptionCancellation: "not_performed" })]);
  await db.query("insert into public.wd_deletion_work(user_id,owner,attempt,lease_until,identity_hash,identity_evidence,apple_linkage,apple_state,auth_state,auth_operation) values($1,$2,1,$3,$4,$4,'linked','held','started',$5)", [A, binding.workOwner, binding.leaseUntil, H, binding.authOperationId]);
  await db.query("insert into wd_deletion_v2_private.intents(operation_id,user_id,intent_hash,verifier,account_revision,identity_hash,identity_evidence,apple_linkage,policy,policy_hash,phase,data_state,apple_disposition,prepared_until,recovery_until,receipt_until)values($1,$2,$3,$3,2,$3,$3,'linked',$4,$5,'confirmed','cleared','unknown',now()+interval '1 minute',now()+interval '1 hour',now()+interval '1 hour')", [binding.deletionOperationId, A, H, JSON.stringify(policy), appleDigest(policy)]);
  await db.query("insert into wd_apple_private.owners(owner_id,gate,reserved_original)values($1,'closed',$2)", [A, binding.deletionOperationId]);
  await db.query("insert into wd_apple_private.deletion_bindings values($1,$2,$3,$3,'none','linked',$3)", [binding.deletionOperationId, A, H]);
  const request: ScopeObservationRequest = { binding, policySha256: appleDigest(policy), scopeSha256: H, authorizationId: randomUUID(), custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
  async function asRole(role = "service_role") {
    await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role, sub: A })]);
    if (!["service_role", "anon", "authenticated"].includes(role)) throw Error("invalid fixture role"); await db.exec("set role " + role);
  }
  const observe = async (input = request, role = "service_role") => { await asRole(role); return (await db.query<{ result: unknown }>("select public.wd_current_auth_scope_observe($1::jsonb) result", [JSON.stringify(input)])).rows[0].result; };
  const admin = async (sql: string, values: unknown[] = []) => {
    await db.exec("reset role");
    if (!values.length && sql.includes(";")) { await db.exec(sql); return { rows: [] as Record<string, unknown>[] }; }
    return db.query<Record<string, unknown>>(sql, values);
  };
  // Fixture-only existing visibility for a supported observation target.0024
  // never adds these privileges. Separately prove the actual0014 revoke holds.
  const allowRestoreRead = () => admin("grant select on wd_restore_intents,wd_restore_lineages,wd_restore_aliases,wd_restore_fences to service_role");
  const sentinels = async () => { await db.exec("reset role"); return db.query<{ engine: number; source: number; other: number; users: number }>("select (select count(*) from public.ce_scope_sentinel) engine,(select count(*) from " + (supported ? "extensions" : "public") + ".source_scope_sentinel) source,(select count(*) from public.wd_accounts where user_id='" + B + "') other,(select count(*) from auth.users) users"); };
  return { db, binding, request, observe, admin, allowRestoreRead, asRole, sentinels, close: () => db.close() };
}

test("actual SQL default privileges hold; supported observation has no write fence and leaves all rows untouched", { skip }, async () => {
  const f = await fixture(); try {
    assert.deepEqual(await f.observe(), { outcome: "held" }, "0014 restore privacy is not granted around");
    await f.allowRestoreRead(); const before = await f.sentinels(), o = await f.observe() as ScopeObservation;
    assert.equal(o.contract, "wd-current-auth-scope-observation-v2"); assert.equal(o.references.retentionAttempts.count, 0); assert.equal(o.references.retentionAttempts.validUntil, null);
    assert.equal(o.unclassifiedReferences, 1, "only existing source sentinel remains unclassified; exact0025 relation is recognized"); assert.equal(o.writeFence, null); assert.equal(o.providerOperations, "settled");
    assert.equal(o.application.currentPlanCleanupPending, false); assert.equal(o.application.savedWeeks, 0); assert.equal(o.engine.authLinks, 0); assert.equal(o.engine.unknownLinkages, 0);
    assert.equal(o.references.accountTombstone.count, 1); assert.equal(o.references.deletionWork.count, 1); assert.equal(o.references.deletionIntents.count, 1);
    assert.deepEqual(await f.sentinels(), before);
    const admission: ScopeAdmission = { authorizationId: f.request.authorizationId, target: f.binding, deletionPolicy: policy, custodyPolicy, accountRevision: 2, expectedAuthGraphSha256: o.authGraphSha256, expectedCatalogSha256: o.catalogSha256, expectedEngineSha256: o.engine.metadataSha256, expiresAt: f.binding.leaseUntil, maxObservationAgeMs: 8000,
      retained: Object.fromEntries(Object.entries(o.references).filter(([, value]) => value.count > 0)) };
    assert.deepEqual(await createCurrentAuthScopePreflight({ enabled: true, admission, observe: req => f.observe(req) })(f.binding), { outcome: "held" }, "SQL alone never supplies quiescence");
  } finally { await f.close(); }
});
test("actual SQL ACL/RLS and strict target validation reject foreign owners, old attempts/leases and extra fields", { skip }, async () => {
  const f = await fixture(); try {
    await f.allowRestoreRead();
    for (const role of ["anon", "authenticated"]) {
      await assert.rejects(f.observe(f.request, role), /permission denied/);
      await f.asRole(role); await assert.rejects(f.db.query("select * from wd_apple_private.credentials"), /permission denied/);
    }
    for (const change of [{ userId: B }, { workAttempt: 2 }, { workOwner: randomUUID() }, { authOperationId: randomUUID() }, { deletionOperationId: randomUUID() }, { leaseUntil: new Date(Date.now() - 10000).toISOString() }, { intentSha256: "b".repeat(64) }]) assert.deepEqual(await f.observe({ ...f.request, binding: { ...f.binding, ...change } }), { outcome: "held" });
    assert.deepEqual(await f.observe({ ...f.request, extra: true } as ScopeObservationRequest), { outcome: "held" });
    const result = await f.admin("select relrowsecurity,relforcerowsecurity from pg_class where oid='wd_apple_private.credentials'::regclass");
    assert.deepEqual(result.rows[0], { relrowsecurity: true, relforcerowsecurity: true });
    await f.asRole(); await assert.rejects(f.db.query("select * from wd_apple_private.credentials"), /permission denied/);
  } finally { await f.close(); }
});
test("SQL inventories each storage object/bucket/upload/part, indirect JSON/key ownership and unknown owner linkage", { skip }, async () => {
  const f = await fixture(); try {
    await f.allowRestoreRead();
    const cases = [
      ["insert into storage.objects values(gen_random_uuid(),'file',$1::uuid,$1::uuid::text,'{}')", "objects"],
      ["insert into storage.buckets values('owned',$1::uuid,$1::uuid::text)", "buckets"],
      ["insert into storage.s3_multipart_uploads values('upload','file',$1::uuid::text,'{}')", "multipartUploads"],
      ["insert into storage.s3_multipart_uploads_parts values(gen_random_uuid(),'file',$1::uuid::text)", "multipartParts"],
      ["insert into storage.objects values(gen_random_uuid(),'indirect',null,$2::uuid::text,jsonb_build_object('relatedOwner',$1::uuid::text))", "metadataReferences"],
      ["insert into storage.s3_multipart_uploads_parts values(gen_random_uuid(),$1::uuid::text||'/file',$2::uuid::text)", "metadataReferences"],
      ["insert into storage.objects values(gen_random_uuid(),'unclassified',null,null,'{}')", "unknownLinkages"],
    ];
    for (const [sql, counter] of cases) {
      // Send only the referenced number of positional parameters.
      await f.admin(sql, sql.includes("$2") ? [A, B] : sql.includes("$1") ? [A] : []); const o = await f.observe() as ScopeObservation;
      assert.ok((o.storage as unknown as Record<string, number>)[counter] > 0, counter);
      await f.admin("delete from storage.objects;delete from storage.buckets;delete from storage.s3_multipart_uploads;delete from storage.s3_multipart_uploads_parts");
    }
    assert.equal((await f.sentinels()).rows[0].engine, 1);
  } finally { await f.close(); }
});
test("SQL remaining plans/private originals and actual Auth/engine/schema closure changes are visible and not effects", { skip }, async () => {
  const f = await fixture(); try {
    await f.allowRestoreRead(); const before = await f.observe() as ScopeObservation;
    await f.admin("insert into public.wd_account_receipts(user_id,id,request,result)values($1,gen_random_uuid(),'{\"private\":true}','{}')", [A]);
    assert.equal((await f.observe() as ScopeObservation).application.accountReceipts, 1);
    await f.admin("insert into wd_current_private.states values($1,$2,1,'{}',$2)", [A, H]);
    assert.equal((await f.observe() as ScopeObservation).application.currentPlanCleanupPending, true);
    await f.admin("create table public.scope_unknown_owner(user_id uuid)");
    const changed = await f.observe() as ScopeObservation; assert.ok(changed.unclassifiedReferences > before.unclassifiedReferences); assert.notEqual(changed.catalogSha256, before.catalogSha256);
    await f.admin("create table public.ce_scope_auth_link(user_id uuid references auth.users(id) on delete cascade)");
    const graph = await f.observe() as ScopeObservation; assert.notEqual(graph.authGraphSha256, before.authGraphSha256); assert.ok(graph.engine.authLinks > 0);
    assert.equal(graph.engine.unknownLinkages, before.engine.unknownLinkages + 1);
    await f.admin("create function public.scope_test_trigger()returns trigger language plpgsql as $$begin return old;end$$;create trigger scope_auth_test before delete on auth.users for each row execute function public.scope_test_trigger()");
    const beforeTelegram = await f.observe() as ScopeObservation;
    assert.notEqual(beforeTelegram.authGraphSha256, graph.authGraphSha256);
    assert.equal(beforeTelegram.engine.unknownLinkages, graph.engine.unknownLinkages);
    await f.admin("create table public.ce_telegram_events(user_id text)");
    assert.equal((await f.observe() as ScopeObservation).engine.unknownLinkages, beforeTelegram.engine.unknownLinkages + 1);
    assert.deepEqual((await f.sentinels()).rows[0], { engine: 1, source: 1, other: 1, users: 2 });
    // Every nonempty retained projection has a concrete policy category; no
    // empty/unknown relation is silently treated as an approved retention rule.
    for (const key of Object.keys(before.references)) assert.ok(Object.hasOwn(CURRENT_AUTH_SCOPE_REFERENCES, key as CurrentScopeReference));
  } finally { await f.close(); }
});

// Synthetic metadata only, using the actual0022/0025 columns and constraints.
async function seedRetention(f: Awaited<ReturnType<typeof fixture>>, owner = A, seconds = 3600, resolved = true) {
  const operation = randomUUID(), lineage = randomUUID(), attempt = randomUUID(), historical = appleDigest(operation);
  await f.admin("insert into wd_apple_private.owners(owner_id)values($1) on conflict do nothing", [owner]);
  await f.admin("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,created_at,expires_at)values($1,$2,$3,'synthetic.native',$3,$3,$3,$4,$5,'stored',now()-make_interval(secs=>3601-$6::integer),now()+make_interval(secs=>$6::integer)-interval '1 second')", [operation, owner, historical, JSON.stringify(custodyPolicy), appleDigest(custodyPolicy), seconds]);
  await f.admin("insert into wd_apple_private.credentials(lineage_id,operation_id,owner_id,client_id,apple_identity_hash,policy_hash,envelope,state,expires_at,recovery_until)values($1,$2,$3,'synthetic.native',$4,$5,$6,$7,now()-interval '1 second',now()-interval '1 second')", [lineage, operation, owner, historical, appleDigest(custodyPolicy), resolved ? null : JSON.stringify({ ciphertext: "synthetic-secret-never-project" }), resolved ? "erased" : "available"]);
  await f.admin("insert into wd_apple_private.current_retention_attempts(lineage_id,owner_id,operation_id,intent_hash,policy_hash,attempt_id,readback_at)values($1,$2,$3,$4,$5,$6,case when $7::boolean then now() else null end)", [lineage, owner, operation, historical, appleDigest(custodyPolicy), attempt, resolved]);
  return { operation, lineage, attempt, historical };
}
async function admissionFor(f: Awaited<ReturnType<typeof fixture>>, o: ScopeObservation): Promise<ScopeAdmission> {
  return { authorizationId: f.request.authorizationId, target: f.binding, deletionPolicy: policy, custodyPolicy, accountRevision: 2, expectedAuthGraphSha256: o.authGraphSha256, expectedCatalogSha256: o.catalogSha256, expectedEngineSha256: o.engine.metadataSha256, expiresAt: f.binding.leaseUntil, maxObservationAgeMs: 8000,
    retained: Object.fromEntries(Object.entries(o.references).filter(([, v]) => v.count > 0)) as ScopeAdmission["retained"] };
}
// Synthetic host quiescence proof only: raw RPC is separately asserted null.
async function preflightFor(f: Awaited<ReturnType<typeof fixture>>, a: ScopeAdmission) {
  return createCurrentAuthScopePreflight({ enabled: true, admission: a, observe: async req => {
    const o = await f.observe(req) as ScopeObservation;
    if (!o.references) return o;
    return { ...o, writeFence: { bindingSha256: appleDigest(req), evidenceSha256: H, validUntil: f.binding.leaseUntil } };
  } })(f.binding);
}
test("SQL v2 empty-known reference and historical resolved/pending custody after email login yield real preflight proofs", { skip }, async () => {
  const f = await fixture(true); try {
    await f.allowRestoreRead(); const before = await f.sentinels();
    const empty = await f.observe() as ScopeObservation;
    assert.equal(empty.unclassifiedReferences, 0); assert.deepEqual(Object.keys(empty.references.retentionAttempts).sort(), ["count", "sha256", "validUntil"]);
    assert.equal(empty.references.retentionAttempts.count, 0); assert.equal(empty.references.retentionAttempts.validUntil, null);
    assert.equal((await preflightFor(f, await admissionFor(f, empty))).outcome, "allowed");
    const row = await seedRetention(f); assert.notEqual(row.operation, f.binding.deletionOperationId); assert.notEqual(row.historical, f.binding.identityHash);
    const first = await f.observe() as ScopeObservation; assert.equal(first.references.retentionAttempts.count, 1); assert.equal(first.providerOperations, "settled"); assert.equal(first.writeFence, null);
    assert.equal((await preflightFor(f, await admissionFor(f, first))).outcome, "allowed");
    await seedRetention(f, A, 3600, false);
    const pending = await f.observe() as ScopeObservation; assert.equal(pending.references.retentionAttempts.count, 2); assert.equal(pending.providerOperations, "settled");
    assert.equal((await preflightFor(f, await admissionFor(f, pending))).outcome, "allowed");
    assert.doesNotMatch(JSON.stringify(pending), /synthetic-secret-never-project|ciphertext|code_hash|envelope/);
    for (const role of ["anon", "authenticated"]) await assert.rejects(f.observe(f.request, role), /permission denied/);
    assert.deepEqual(await f.sentinels(), before);
  } finally { await f.close(); }
});
test("SQL v2 owner association via attempt/credential/exchange and malformed historical parents cannot disappear", { skip }, async () => {
  const f = await fixture(true); try {
    await f.allowRestoreRead(); const row = await seedRetention(f); await seedRetention(f, B);
    const mutations = [
      ["attempt-only target", "update wd_apple_private.credentials set owner_id=$2 where lineage_id=$1;update wd_apple_private.exchanges set owner_id=$2 where operation_id=(select operation_id from wd_apple_private.credentials where lineage_id=$1);"],
      ["credential-only target", "update wd_apple_private.current_retention_attempts set owner_id=$2 where lineage_id=$1;update wd_apple_private.exchanges set owner_id=$2 where operation_id=(select operation_id from wd_apple_private.credentials where lineage_id=$1);"],
      ["exchange-only target", "update wd_apple_private.credentials set owner_id=$2 where lineage_id=$1;update wd_apple_private.current_retention_attempts set owner_id=$2 where lineage_id=$1;"],
      ["foreign exchange", "update wd_apple_private.exchanges set owner_id=$2 where operation_id=(select operation_id from wd_apple_private.credentials where lineage_id=$1);"],
      ["operation/lineage mismatch", "update wd_apple_private.current_retention_attempts set operation_id=(select operation_id from wd_apple_private.exchanges where owner_id=$2) where lineage_id=$1;"],
      ["intent mismatch", "update wd_apple_private.current_retention_attempts set intent_hash=repeat('b',64) where lineage_id=$1;"],
      ["attempt policy mismatch", "update wd_apple_private.current_retention_attempts set policy_hash=repeat('b',64) where lineage_id=$1;"],
      ["credential policy mismatch", "update wd_apple_private.credentials set policy_hash=repeat('b',64) where lineage_id=$1;"],
      ["exchange policy mismatch", "update wd_apple_private.exchanges set policy_hash=repeat('b',64) where operation_id=(select operation_id from wd_apple_private.credentials where lineage_id=$1);"],
    ];
    for (const [label, statements] of mutations) {
      await f.admin("begin");
      for (const sql of statements.split(";").filter(Boolean)) await f.admin(sql, [row.lineage, B].slice(0, sql.includes("$2") ? 2 : 1));
      assert.deepEqual(await f.observe(), { outcome: "held" }, label); await f.admin("rollback");
    }
    // Corrupt-row simulation requires disabling FK triggers in this synthetic DB;
    // observer must detect orphan facts rather than rely solely on constraints.
    await f.admin("begin"); await f.admin("set session_replication_role=replica");
    await f.admin("update wd_apple_private.current_retention_attempts set lineage_id=$1 where lineage_id=$2", [randomUUID(), row.lineage]);
    assert.deepEqual(await f.observe(), { outcome: "held" }, "orphan lineage"); await f.admin("rollback");
    await f.admin("begin"); await f.admin("set session_replication_role=replica");
    await f.admin("update wd_apple_private.current_retention_attempts set operation_id=$1 where lineage_id=$2", [randomUUID(), row.lineage]);
    assert.deepEqual(await f.observe(), { outcome: "held" }, "orphan exchange"); await f.admin("rollback");
    assert.equal((await f.observe() as ScopeObservation).references.retentionAttempts.count, 1);
  } finally { await f.close(); }
});
test("SQL v2 exact parent deadlines, earliest expiry, category and ambiguous evidence holds", { skip }, async () => {
  const f = await fixture(true); try {
    await f.allowRestoreRead(); await seedRetention(f, A, 3600); const near = await seedRetention(f, A, 120);
    const o = await f.observe() as ScopeObservation; assert.ok(o.references, "exact admitted parent policy deadlines produce an observation");
    const parent = await f.admin("select expires_at::text deadline from wd_apple_private.exchanges where operation_id=$1", [near.operation]);
    assert.equal(Date.parse(o.references.retentionAttempts.validUntil!), Date.parse(parent.rows[0].deadline as string));
    assert.equal(Date.parse(o.validUntil), Date.parse(o.references.retentionAttempts.validUntil!));
    const a = await admissionFor(f, o), proof = await preflightFor(f, a); assert.equal(proof.outcome, "allowed");
    if (proof.outcome === "allowed") assert.ok(Date.parse(proof.binding.validUntil) <= Date.parse(o.references.retentionAttempts.validUntil!));
    for (const sql of [
      "update wd_apple_private.exchanges set expires_at=expires_at+interval '1 second' where operation_id=$1",
      "update wd_apple_private.exchanges set created_at=now()-interval '2 hours',expires_at=now()-interval '1 hour' where operation_id=$1",
      "update wd_apple_private.exchanges set policy=policy-'evidenceSeconds' where operation_id=$1",
      "update wd_apple_private.exchanges set policy=jsonb_set(policy,'{approved}','false') where operation_id=$1",
      "update wd_apple_private.exchanges set policy=jsonb_set(policy,'{retainedEvidence}','[]') where operation_id=$1",
    ]) { await f.admin("begin"); await f.admin(sql, [near.operation]); assert.deepEqual(await f.observe(), { outcome: "held" }, sql); await f.admin("rollback"); }
    const denied = { ...policy, retainedEvidence: ["deletion_receipt", "billing_evidence"] };
    await f.admin("begin"); await f.admin("update wd_deletion_v2_private.intents set policy=$1,policy_hash=$2 where operation_id=$3", [JSON.stringify(denied), appleDigest(denied), f.binding.deletionOperationId]);
    assert.deepEqual(await f.observe({ ...f.request, policySha256: appleDigest(denied) }), { outcome: "held" }, "actual deletion policy category absent"); await f.admin("rollback");
    assert.deepEqual(await preflightFor(f, { ...a, deletionPolicy: denied }), { outcome: "held" });
    for (const change of [
      { custodyPolicySha256: "b".repeat(64) },
      { custodyPolicy: { ...custodyPolicy, retainedEvidence: [] } },
      { custodyPolicy: { ...custodyPolicy, evidenceSeconds: 0 } },
      { custodyPolicy: { ...custodyPolicy, approved: false } },
    ]) assert.deepEqual(await f.observe({ ...f.request, ...change } as ScopeObservationRequest), { outcome: "held" }, "invalid/unadmitted actual custody policy");
  } finally { await f.close(); }
});
test("SQL v2 projection mutations invalidate exact admission and physical permutation preserves digest", { skip }, async () => {
  const f = await fixture(true); try {
    await f.allowRestoreRead(); const row = await seedRetention(f); await seedRetention(f);
    const o = await f.observe() as ScopeObservation, a = await admissionFor(f, o);
    for (const state of ["started", "unknown"]) {
      await f.admin("begin"); await f.admin("update wd_apple_private.exchanges set state=$1 where operation_id=$2", [state, row.operation]);
      assert.equal((await f.observe() as ScopeObservation).providerOperations, state === "started" ? "active" : "unknown");
      assert.deepEqual(await preflightFor(f, a), { outcome: "held" }, "actual provider work never grants"); await f.admin("rollback");
    }
    for (const sql of [
      "update wd_apple_private.current_retention_attempts set attempt_id=gen_random_uuid() where lineage_id=$1",
      "update wd_apple_private.current_retention_attempts set readback_at=null where lineage_id=$1",
      "update wd_apple_private.current_retention_attempts set reserved_at=reserved_at-interval '1 millisecond' where lineage_id=$1",
    ]) { await f.admin("begin"); await f.admin(sql, [row.lineage]); const changed = await f.observe() as ScopeObservation;
      assert.notEqual(changed.references.retentionAttempts.sha256, o.references.retentionAttempts.sha256); assert.deepEqual(await preflightFor(f, a), { outcome: "held" }); await f.admin("rollback"); }
    // Reinsert the same rows in reversed physical order, preserving every value.
    const physicalBefore = await f.admin("select array_agg(lineage_id order by ctid) ids from wd_apple_private.current_retention_attempts");
    await f.admin("create temporary table permutation as select * from wd_apple_private.current_retention_attempts order by ctid desc");
    await f.admin("delete from wd_apple_private.current_retention_attempts");
    await f.admin("insert into wd_apple_private.current_retention_attempts select * from permutation order by ctid");
    const physicalAfter = await f.admin("select array_agg(lineage_id order by ctid) ids from wd_apple_private.current_retention_attempts");
    assert.deepEqual(physicalAfter.rows[0].ids, [...physicalBefore.rows[0].ids as string[]].reverse());
    assert.deepEqual((await f.observe() as ScopeObservation).references.retentionAttempts, o.references.retentionAttempts);
    assert.equal((await preflightFor(f, a)).outcome, "allowed");
    await f.admin("begin");
    await f.admin("insert into wd_apple_private.prepared_captures(operation_id,original_id,owner_id,intent_hash)values($1,$2,$3,$4)", [row.operation, f.binding.deletionOperationId, A, row.historical]);
    assert.deepEqual(await f.observe(), { outcome: "held" }, "nonempty accepted0023 capture journal has no implicit retention permission"); await f.admin("rollback");
    await f.admin("begin"); await f.admin("alter table wd_apple_private.prepared_captures add column unknown_fact text");
    assert.deepEqual(await f.observe(), { outcome: "held" }, "0023 column drift"); await f.admin("rollback");
    await f.admin("create table wd_apple_private.unclassified_attempt(owner_id uuid)");
    assert.ok((await f.observe() as ScopeObservation).unclassifiedReferences > 0); assert.deepEqual(await preflightFor(f, a), { outcome: "held" });
    await f.admin("alter table wd_apple_private.current_retention_attempts add column unknown_fact text");
    assert.deepEqual(await f.observe(), { outcome: "held" });
    assert.deepEqual((await f.sentinels()).rows[0], { engine: 1, source: 1, other: 1, users: 2 });
  } finally { await f.close(); }
});
test("SQL v2 all associated attempts count at128 and129 holds without truncation", { skip }, async () => {
  const f = await fixture(true); try {
    await f.allowRestoreRead();
    for (let i = 0; i < 128; i++) await seedRetention(f);
    const o = await f.observe() as ScopeObservation; assert.equal(o.references.retentionAttempts.count, 128);
    assert.equal((await preflightFor(f, await admissionFor(f, o))).outcome, "allowed");
    await seedRetention(f); assert.deepEqual(await f.observe(), { outcome: "held" });
  } finally { await f.close(); }
});
