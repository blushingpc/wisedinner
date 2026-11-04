import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID, createHash } from "node:crypto";
import { appleDigest } from "./apple-token-custody.server.ts";
import { createCurrentAuthScopePreflight, type ScopeObservation, type ScopeObservationRequest, type ScopeAdmission } from "./current-auth-scope.server.ts";
import type { AuthScopeInput } from "./account-deletion-v2-auth.server.ts";

// A Main-issued synthetic local slot is required BEFORE loading/initializing PGlite.
// Never turn missing admission into a skipped SQL cohort or live authority.
const receiptPath = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;
assert.ok(receiptPath, "Main local SQL slot receipt required");
const receipt = JSON.parse(await readFile(receiptPath, "utf8"));
assert.equal(receipt.contract, "wd-local-source-test-slot-v1");
assert.equal(receipt.taskId, "backend-narrow-restore-metadata-20261101");
assert.equal(receipt.workerThreadId, "01a192eb-8b77-71f1-94a8-c96a303e937b");
assert.equal(resolve(receipt.workspace), resolve(process.cwd()));
assert.ok(Date.parse(receipt.at) <= Date.now() && Date.parse(receipt.validUntil) > Date.now());
assert.ok(receipt.argv.includes("lib/current-restore-scope-metadata-sql.test.ts"));
const { PGlite } = await import("@electric-sql/pglite");
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002", H = "a".repeat(64);
const tables = ["wd_restore_intents", "wd_restore_lineages", "wd_restore_aliases", "wd_restore_fences"];
const refs = ["restoreIntents", "restoreLineages", "restoreAliases", "restoreFences"];
const policy = { approved: true as const, version: "synthetic-restore-metadata", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
const custodyPolicy = { approved: true as const, version: "synthetic-restore-metadata", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
const migration = await readFile(new URL("../supabase/migrations/0026_wd_current_restore_scope_metadata.sql", import.meta.url), "utf8");
async function fixture(install = true) {
  const db = await PGlite.create();
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create table auth.users(id uuid primary key);create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    grant select on auth.users,auth.identities to service_role;`);
  for (const name of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql", "0021_wd_deletion_lifecycle_v2.sql", "0022_wd_apple_token_custody.sql", "0023_wd_deletion_prepared_retirement.sql", "0024_wd_current_auth_scope.sql", "0025_wd_current_retention_inventory.sql"]) {
    const bytes = await readFile(new URL("../supabase/migrations/" + name, import.meta.url));
    if (name.startsWith("0023")) assert.equal(createHash("sha256").update(bytes).digest("hex"), "00482c1655c9ba757a2bf454b122829cdc8406051a44e5e5197c1cc54894f743");
    await db.exec(bytes.toString("utf8"));
  }
  await db.exec(`create schema storage;grant usage on schema storage to service_role;
    create table storage.buckets(id text primary key,owner uuid,owner_id text);
    create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
    grant select on all tables in schema storage to service_role;`);
  const binding: AuthScopeInput = { userId: A, identityHash: H, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(Date.now() + 120000).toISOString() };
  await db.query("insert into auth.users values($1),($2)", [A, B]);
  await db.query("insert into public.wd_accounts(user_id,state,revision,preferences,deletion_dependencies)values($1,'deletion_pending',2,'{}',$3),($2,'active',1,'{}',null)", [A, B, JSON.stringify({ authDeletion: "pending", sessionInvalidation: "pending", appleRevocation: "review_required", subscriptionCancellation: "not_performed" })]);
  await db.query("insert into public.wd_deletion_work(user_id,owner,attempt,lease_until,identity_hash,identity_evidence,apple_linkage,apple_state,auth_state,auth_operation) values($1,$2,1,$3,$4,$4,'linked','held','started',$5)", [A, binding.workOwner, binding.leaseUntil, H, binding.authOperationId]);
  await db.query("insert into wd_deletion_v2_private.intents(operation_id,user_id,intent_hash,verifier,account_revision,identity_hash,identity_evidence,apple_linkage,policy,policy_hash,phase,data_state,apple_disposition,prepared_until,recovery_until,receipt_until)values($1,$2,$3,$3,2,$3,$3,'linked',$4,$5,'confirmed','cleared','unknown',now()+interval '1 minute',now()+interval '1 hour',now()+interval '1 hour')", [binding.deletionOperationId, A, H, JSON.stringify(policy), appleDigest(policy)]);
  await db.query("insert into wd_apple_private.owners(owner_id,gate,reserved_original)values($1,'closed',$2)", [A, binding.deletionOperationId]);
  await db.query("insert into wd_apple_private.deletion_bindings values($1,$2,$3,$3,'none','linked',$3)", [binding.deletionOperationId, A, H]);
  const request: ScopeObservationRequest = { binding, policySha256: appleDigest(policy), scopeSha256: H, authorizationId: randomUUID(), custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
  async function admin(sql: string, args: unknown[] = []) { await db.exec("reset role"); if (!args.length && sql.includes(";")) return db.exec(sql); return db.query(sql, args); }
  async function role(name = "service_role", claim = name) { assert.ok(["service_role", "anon", "authenticated"].includes(name)); await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: claim, sub: A })]); await db.exec("set role " + name); }
  async function call(name: "wd_current_restore_scope_metadata" | "wd_current_auth_scope_observe", input: unknown = request) { await role(); return (await db.query<{ result: ScopeObservation & { outcome?: string; contract: string } }>("select public." + name + "($1::jsonb) result", [JSON.stringify(input)])).rows[0].result; }
  if (install) await db.exec(migration);
  return { db, binding, request, admin, role, call, close: () => db.close() };
}
type Fixture = Awaited<ReturnType<typeof fixture>>;
async function seed(f: Fixture) {
  await f.admin("insert into public.wd_restore_intents(operation,target,environment,app,product,entitlement,target_binding,created_ms,expires_ms,status,proof) values($1,$2,'SANDBOX','fixture.app','weekly','protein','synthetic-private-binding',1,2,'held',$3)", [randomUUID(), A, JSON.stringify({ marker: "synthetic-private-proof" })]);
  await f.admin("insert into public.wd_restore_lineages(environment,root_hash,app,product,entitlement,original_purchase_ms,owner_id,observed_ms) values('SANDBOX',$1,'fixture.app','weekly','protein',1,$2,2),('PRODUCTION',$1,'fixture.app','weekly','protein',1,$3,2)", [H, A, B]);
  await f.admin("insert into public.wd_restore_aliases values('SANDBOX',$1,$2),('PRODUCTION',$3,$2)", ["b".repeat(64), H, "c".repeat(64)]);
  await f.admin("insert into public.wd_restore_fences values($1,'SANDBOX'),($2,'PRODUCTION')", [A, B]);
}

test("0014 privacy reproduced; additive0026 returns empty bounded metadata without raw SELECT or write fence", async () => {
  const f = await fixture(false); try {
    assert.deepEqual(await f.call("wd_current_auth_scope_observe"), { outcome: "held" });
    await f.admin(migration);
    const m = await f.call("wd_current_restore_scope_metadata"); assert.equal(m.contract, "wd-current-restore-scope-metadata-v1");
    const emptyHash = createHash("sha256").update("[]").digest("hex");
    for (const key of refs) assert.deepEqual(m.references[key as keyof typeof m.references], { count: 0, sha256: emptyHash });
    const o = await f.call("wd_current_auth_scope_observe"); assert.equal(o.contract, "wd-current-auth-scope-observation-v2"); assert.equal(o.writeFence, null); assert.equal(o.unclassifiedReferences, 0);
    const a: ScopeAdmission = { authorizationId: f.request.authorizationId, target: f.binding, deletionPolicy: policy, custodyPolicy, accountRevision: 2, expectedAuthGraphSha256: o.authGraphSha256, expectedCatalogSha256: o.catalogSha256, expectedEngineSha256: o.engine.metadataSha256, expiresAt: f.binding.leaseUntil, maxObservationAgeMs: 8000, retained: Object.fromEntries(Object.entries(o.references).filter(([,v]) => v.count > 0)) };
    assert.deepEqual(await createCurrentAuthScopePreflight({ enabled: true, admission: a, observe: q => f.call("wd_current_auth_scope_observe", q) })(f.binding), { outcome: "held" }, "metadata is not a trusted fence");
  } finally { await f.close(); }
});

test("actual target and foreign-environment aliases preserve full-row hashes without exporting proof or bindings", async () => {
  const f = await fixture(); try {
    await seed(f); const before = await f.call("wd_current_restore_scope_metadata");
    for (const key of refs) assert.equal(before.references[key as keyof typeof before.references].count, 1, key);
    // Independent admin-only reference calculation: unchanged0014 full-row JSONB wire identity.
    await f.admin("select 1");
    const expected = await f.db.query<{ refs: unknown }>(`select jsonb_object_agg(k,jsonb_build_object('count',n,'sha256',encode(sha256(convert_to(rows::text,'UTF8')),'hex'))) refs from (
      select 'restoreIntents' k,count(*) n,coalesce(jsonb_agg(to_jsonb(t) order by operation),'[]') rows from public.wd_restore_intents t where target=$1::uuid
      union all select 'restoreLineages',count(*),coalesce(jsonb_agg(to_jsonb(t) order by environment,root_hash),'[]') from public.wd_restore_lineages t where owner_id=$1::uuid
      union all select 'restoreAliases',count(*),coalesce(jsonb_agg(to_jsonb(t) order by t.environment,t.transaction_hash),'[]') from public.wd_restore_aliases t join public.wd_restore_lineages l using(environment,root_hash) where l.owner_id=$1::uuid
      union all select 'restoreFences',count(*),coalesce(jsonb_agg(to_jsonb(t) order by environment),'[]') from public.wd_restore_fences t where user_id=$1::uuid) q`, [A]);
    assert.deepEqual(before.references, expected.rows[0].refs);
    const text = JSON.stringify(before); for (const secret of ["synthetic-private-proof", "synthetic-private-binding", "root_hash", "transaction_hash", "target_binding", "proof"]) assert.equal(text.includes(secret), false);
    const rowCounts = await f.db.query<{ ok: boolean }>(`select not has_table_privilege('service_role','public.wd_restore_intents','SELECT') ok`); assert.equal(rowCounts.rows[0].ok, true);
    await f.admin("update public.wd_restore_intents set proof='{\"marker\":\"changed\"}' where target=$1", [A]);
    const changed = await f.call("wd_current_restore_scope_metadata"); assert.equal(changed.references.restoreIntents.count, 1); assert.notEqual(changed.references.restoreIntents.sha256, before.references.restoreIntents.sha256);
    assert.deepEqual(changed.references.restoreAliases, before.references.restoreAliases);
    await f.admin("update public.wd_restore_lineages set generation=generation+1 where owner_id=$1", [B]);
    assert.deepEqual((await f.call("wd_current_restore_scope_metadata")).references, changed.references, "foreign lineage is outside A projection");
    await f.admin("insert into public.wd_restore_aliases values('SANDBOX',$1,$2)", ["d".repeat(64), H]);
    const two = await f.call("wd_current_restore_scope_metadata"); assert.equal(two.references.restoreAliases.count, 2); assert.notEqual(two.references.restoreAliases.sha256, before.references.restoreAliases.sha256);
    await f.admin("begin;create temporary table copied_aliases as select * from public.wd_restore_aliases;delete from public.wd_restore_aliases;insert into public.wd_restore_aliases select * from copied_aliases order by transaction_hash desc;drop table copied_aliases;commit;");
    assert.deepEqual((await f.call("wd_current_restore_scope_metadata")).references, two.references, "physical permutation cannot change ordered content");
    const o = await f.call("wd_current_auth_scope_observe"); for (const key of refs) assert.deepEqual(o.references[key as keyof typeof o.references], two.references[key as keyof typeof two.references]);
  } finally { await f.close(); }
});

test("raw tables remain denied and helper invoker/definer roles and search_path are explicit", async () => {
  const f = await fixture(); try {
    for (const name of ["service_role", "anon", "authenticated"]) {
      await f.role(name);
      for (const table of tables) await assert.rejects(f.db.query("select * from public." + table), /permission denied/);
      if (name !== "service_role") await assert.rejects(f.db.query("select public.wd_current_restore_scope_metadata($1::jsonb)", [JSON.stringify(f.request)]), /permission denied/);
    }
    await f.role("authenticated", "service_role"); await assert.rejects(f.db.query("select public.wd_current_restore_scope_metadata($1::jsonb)", [JSON.stringify(f.request)]), /permission denied/);
    await f.role("service_role", "authenticated"); assert.deepEqual((await f.db.query<{ result: unknown }>("select public.wd_current_restore_scope_metadata($1::jsonb) result", [JSON.stringify(f.request)])).rows[0].result, { outcome: "held" });
    await f.admin("create temporary table wd_restore_intents(payload text);insert into wd_restore_intents values('shadow');");
    assert.equal((await f.call("wd_current_restore_scope_metadata")).references.restoreIntents.count, 0);
    await f.admin("select 1"); const procs = await f.db.query<{ proname: string; prosecdef: boolean; proconfig: string[] }>("select proname,prosecdef,proconfig from pg_proc where oid in ('public.wd_current_restore_scope_metadata(jsonb)'::regprocedure,'public.wd_current_auth_scope_observe(jsonb)'::regprocedure)");
    assert.equal(procs.rows.find(x => x.proname.endsWith("metadata"))!.prosecdef, true); assert.equal(procs.rows.find(x => x.proname.endsWith("observe"))!.prosecdef, false);
    for (const row of procs.rows) assert.deepEqual(row.proconfig, ['search_path=""']);
  } finally { await f.close(); }
});

test("missing original, expired and every crossed target/original binding holds before metadata release", async () => {
  const f = await fixture(); try {
    await seed(f);
    for (const change of [{ userId: B }, { identityHash: "b".repeat(64) }, { authOperationId: randomUUID() }, { deletionOperationId: randomUUID() }, { intentSha256: "b".repeat(64) }, { workOwner: randomUUID() }, { workAttempt: 2 }, { leaseUntil: new Date(Date.now()-1000).toISOString() }]) assert.deepEqual(await f.call("wd_current_restore_scope_metadata", { ...f.request, binding: { ...f.binding, ...change } }), { outcome: "held" });
    assert.deepEqual(await f.call("wd_current_restore_scope_metadata", { ...f.request, extra: true }), { outcome: "held" });
    assert.deepEqual(await f.call("wd_current_restore_scope_metadata", { ...f.request, policySha256: "b".repeat(64) }), { outcome: "held" });
    await f.admin("update wd_deletion_v2_private.intents set phase='prepared' where operation_id=$1", [f.binding.deletionOperationId]);
    assert.deepEqual(await f.call("wd_current_restore_scope_metadata"), { outcome: "held" });
  } finally { await f.close(); }
});

test("unknown restore columns/owners/forcedRLS and unrelated schema remain conservative holds", async () => {
  const f = await fixture(); try {
    for (const sql of ["alter table public.wd_restore_intents add column surprise text", "create role foreign_restore_owner nologin;alter table public.wd_restore_aliases owner to foreign_restore_owner", "alter table public.wd_restore_fences force row level security"]) {
      await f.admin("begin"); await f.admin(sql); assert.deepEqual(await f.call("wd_current_restore_scope_metadata"), { outcome: "held" }); await f.admin("rollback");
    }
    await f.admin("create schema unknown_app;create table unknown_app.hidden_reference(owner_id uuid)");
    assert.ok((await f.call("wd_current_auth_scope_observe")).unclassifiedReferences > 0);
  } finally { await f.close(); }
});

test("actual target128/129 bounds and global10000/10001 alias bound do not truncate", async () => {
  const f = await fixture(); try {
    await f.admin("insert into public.wd_restore_intents(operation,target,environment,app,product,entitlement,target_binding,created_ms,expires_ms) select md5(i::text)::uuid,$1,'SANDBOX','app','weekly','protein','synthetic',1,2 from generate_series(1,128)i", [A]);
    assert.equal((await f.call("wd_current_restore_scope_metadata")).references.restoreIntents.count, 128);
    await f.admin("insert into public.wd_restore_intents(operation,target,environment,app,product,entitlement,target_binding,created_ms,expires_ms) values($1,$2,'SANDBOX','app','weekly','protein','synthetic',1,2)", [randomUUID(), A]);
    assert.deepEqual(await f.call("wd_current_restore_scope_metadata"), { outcome: "held" });
    await f.admin("delete from public.wd_restore_intents");
    await f.admin("insert into public.wd_restore_lineages values('SANDBOX',$1,'app','weekly','protein',1,$2,0,2)", [H,A]);
    await f.admin("insert into public.wd_restore_aliases select 'SANDBOX',encode(sha256(convert_to(i::text,'UTF8')),'hex'),$1 from generate_series(1,10000)i", [H]);
    assert.equal((await f.call("wd_current_restore_scope_metadata")).references.restoreAliases.count, 10000);
    await f.admin("insert into public.wd_restore_aliases values('SANDBOX',$1,$2)", ["f".repeat(64),H]);
    assert.deepEqual(await f.call("wd_current_restore_scope_metadata"), { outcome: "held" });
  } finally { await f.close(); }
});

test("migration fails atomically on wrong deployed owner or missing exact validator capability", async () => {
  for (const mode of ["owner", "validator"]) {
    const f = await fixture(false); try {
      await f.admin("create role metadata_fixture_owner nologin;grant usage,create on schema public to metadata_fixture_owner");
      if (mode === "owner") await f.admin("alter table public.wd_restore_aliases owner to metadata_fixture_owner");
      else { for (const table of tables) await f.admin("alter table public."+table+" owner to metadata_fixture_owner"); await f.db.exec("set role metadata_fixture_owner"); }
      await assert.rejects(f.db.exec(migration), mode === "owner" ? /owner_prerequisite/ : /validator_prerequisite/);
      await f.db.exec("rollback;reset role");
      assert.equal((await f.db.query<{ value: string | null }>("select to_regprocedure('public.wd_current_restore_scope_metadata(jsonb)')::text value")).rows[0].value, null);
    } finally { await f.close(); }
  }
});

test("forward observer leaves every nonrestore storage/catalog/engine/unknown/fence guard byte-identical", async () => {
  const original = await readFile(new URL("../supabase/migrations/0024_wd_current_auth_scope.sql", import.meta.url), "utf8");
  const marker = " select jsonb_build_object(\n  'objects'";
  const suffix = (s: string) => s.slice(s.indexOf(marker),s.indexOf("revoke all on function public.wd_current_auth_scope_observe"));
  assert.equal(suffix(migration), suffix(original));
  assert.equal(/grant\s+(select|all|bypassrls)\b/i.test(migration), false);
  assert.ok(migration.includes("'writeFence',null"));
});


for (const table of ["wd_restore_lineages", "wd_restore_fences"]) test(`existing ${table} target128 boundary is exact,129 is held`, async () => {
  const f = await fixture(); try {
    if (table === "wd_restore_lineages") await f.admin("insert into public.wd_restore_lineages select 'SANDBOX',encode(sha256(convert_to(i::text,'UTF8')),'hex'),'app','weekly','protein',1,$1,0,2 from generate_series(1,128)i", [A]);
    else await f.admin("insert into public.wd_restore_fences select $1,'synthetic-'||i from generate_series(1,128)i", [A]);
    const key = table === "wd_restore_lineages" ? "restoreLineages" : "restoreFences";
    assert.equal((await f.call("wd_current_restore_scope_metadata")).references[key].count,128);
    if (table === "wd_restore_lineages") await f.admin("insert into public.wd_restore_lineages values('SANDBOX',$1,'app','weekly','protein',1,$2,0,2)", ["f".repeat(64),A]);
    else await f.admin("insert into public.wd_restore_fences values($1,'synthetic-overflow')", [A]);
    assert.deepEqual(await f.call("wd_current_restore_scope_metadata"), { outcome:"held" });
  } finally { await f.close(); }
});

for (const functionName of ["wd_current_auth_scope_observe", "wd_current_auth_scope_private"]) test(`wrong ${functionName} body cannot be upgraded or silently blessed`, async () => {
  const f = await fixture(false); try {
    const mode = functionName.endsWith("private") ? "definer" : "invoker";
    await f.admin(`create or replace function public.${functionName}(p_body jsonb) returns jsonb language plpgsql security ${mode} set search_path='' as $$begin return '{"outcome":"held"}';end $$`);
    await assert.rejects(f.db.exec(migration), /(?:observer|validator)_preimage/); await f.db.exec("rollback;reset role");
    assert.equal((await f.db.query<{ value: string | null }>("select to_regprocedure('public.wd_current_restore_scope_metadata(jsonb)')::text value")).rows[0].value,null);
  } finally { await f.close(); }
});
