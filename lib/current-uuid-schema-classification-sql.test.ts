import test, { after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { appleDigest, type AppleData } from "./apple-token-custody.server.ts";
import { CURRENT_AUTH_SCOPE, type ScopeObservationRequest, type ScopeObservation } from "./current-auth-scope.server.ts";
const slotPath = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;
assert.ok(slotPath, "Main exclusive local slot required before PGlite, no skip");
const slot = JSON.parse(await readFile(slotPath, "utf8"));
assert.equal(slot.contract, "wd-local-source-test-slot-v1");
assert.equal(slot.taskId, "backend-reviewed-legacy-scope-20261101");
assert.equal(slot.workerThreadId, "01a192f8-e59a-71a2-9149-1158d9e93c50");
assert.equal(resolve(slot.workspace), resolve(process.cwd()));
assert.ok(Date.parse(slot.at) <= Date.now() && Date.parse(slot.validUntil) > Date.now());
assert.ok(slot.argv.includes("lib/current-uuid-schema-classification-sql.test.ts"));
const { PGlite } = await import("@electric-sql/pglite");
const H = "a".repeat(64), B = "10000000-0000-4000-8000-000000000002";
// Synthetic operator-reviewed policies only; no production duration/authority.
const policy = { approved: true as const, version: "wd-owner-uuid-delete-v1", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
const custodyPolicy = { approved: true as const, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
const db = await PGlite.create();
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

const directory = new URL("../supabase/migrations/", import.meta.url);
for (const name of (await readdir(directory)).filter(n => /^00\d\d_.*\.sql$/.test(n) && Number(n.slice(0,4)) <= 27).sort()) await db.exec(await readFile(new URL(name, directory), "utf8"));
after(async () => { await db.close(); });
async function role(principal = "service_role", uid = "10000000-0000-4000-8000-000000000001") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: principal, sub: uid, is_anonymous: false, amr: [{ method: "password", timestamp: Math.floor(Date.now()/1000) }] })]);
  assert.ok(["anon", "authenticated", "service_role"].includes(principal)); await db.exec("set role " + principal);
}
async function rpc(name: string, action: string, body: unknown, principal = "service_role", uid?: string): Promise<AppleData> {
  assert.match(name, /^wd_[a-z0-9_]+$/); await role(principal, uid);
  return (await db.query<{ r: AppleData }>(`select public.${name}($1,$2::jsonb) r`, [action, JSON.stringify(body)])).rows[0].r;
}
async function observe(q: ScopeObservationRequest): Promise<ScopeObservation> {
  await role(); return (await db.query<{ r: ScopeObservation }>("select public.wd_current_auth_scope_observe($1::jsonb) r", [JSON.stringify(q)])).rows[0].r;
}

  const userId = "10000000-0000-4000-8000-000000000001", op = randomUUID(), recoveryHash = H;
  await db.exec("reset role"); await db.query("insert into auth.users values($1)", [userId]); await db.query("insert into public.wd_accounts(user_id)values($1)", [userId]);
  const basis = await rpc("wd_apple_deletion_command", "effective_basis", { userId });
  const admitted = await rpc("wd_apple_deletion_command", "admit_original", { original: { userId, operationId: op, recoveryHash, expectedAccountRevision: 1, identityHash: H, identityEvidence: H, appleLinkage: "none", policy, policyHash: appleDigest(policy), intentSha256: H }, basis: { userId, currentIdentityHash: H, identityEvidence: H, actualApple: "none", effectiveApple: "none", inventoryRevision: basis.revision, inventoryHash: basis.inventoryHash } });
  assert.equal(admitted.outcome, "admitted");
  const confirm = await rpc("wd_deletion_v2_account_command", "confirm", { operationId: op, recoveryHash, expectedAccountRevision: 1, intentSha256: H, confirmation: "DELETE MY ACCOUNT" }, "authenticated", userId); assert.equal(confirm.intentState, "confirmed");
  const owner = randomUUID(), original = { operationId: op, intentSha256: H, owner };
  const claimed = await rpc("wd_deletion_v2_worker_command", "claim", original), work = claimed.work as AppleData; assert.equal(work.owner, owner); assert.equal(work.attempt, 1);
  const advance = { ...original, attempt: work.attempt };
  assert.ok((await rpc("wd_deletion_v2_worker_command", "cleanup", advance)).receipt);
  await rpc("wd_deletion_v2_worker_command", "apple_unavailable", advance); await rpc("wd_deletion_v2_worker_command", "begin", { ...advance, dependency: "auth" });
  const target = { userId, identityHash: H, operationId: String(work.auth_operation) };
  const fence = await rpc("wd_apple_deletion_command", "auth_fence", target); assert.equal(fence.owner, owner); assert.equal(fence.attempt, 1); assert.equal(Date.parse(String(fence.lease)), Date.parse(String(work.lease_until)));
  const binding = { userId, identityHash: H, authOperationId: target.operationId, deletionOperationId: op, intentSha256: H, workOwner: owner, workAttempt: 1, leaseUntil: String(fence.lease) };
  const request: ScopeObservationRequest = { binding, policySha256: appleDigest(policy), authorizationId: randomUUID(), scopeSha256: appleDigest(["synthetic-non-authorizing-inspection", binding]), custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
  const before = await observe(request);
async function admin(sql: string, args: unknown[] = []) { await db.exec("reset role"); return db.query<AppleData>(sql,args); }
async function helper(input: unknown = request, principal = "service_role") { await role(principal); return (await db.query<{ r: boolean }>("select public.wd_current_reviewed_legacy_empty($1::jsonb) r", [JSON.stringify(input)])).rows[0].r; }
async function trial(fn: () => Promise<void>) { await admin("begin"); try { await fn(); } finally { await db.exec("rollback"); await db.exec("reset role"); } }
await admin("insert into auth.users values($1)",[B]); await admin("insert into public.wd_accounts(user_id)values($1)",[B]);
const migration = await readFile(new URL("0028_wd_current_reviewed_legacy_scope.sql", directory),"utf8");
await db.exec("reset role"); await db.exec(migration);
const known = ["waitlist","support_messages","receipts","delivery_quotes","shared_weeks","support_threads","support_messages_v2","wd_push_projects","wd_ops_checks","wd_ops_alerts","wd_support_sends","wd_support_work","wd_proposal_plan_policy","wd_proposal_plan_documents","wd_proposal_plan_receipts","wd_proposal_plan_replay"];
test("full unchanged0001..0027 real active original -> confirmation/cleanup/random claim; known-empty classification, receipt preserved",async()=>{
 assert.ok(before.unclassifiedReferences>0);
 for(const name of known) assert.equal((await admin("select count(*)::int n from public."+name)).rows[0].n,0,name);
 const ready=await helper();
 assert.equal(ready,true);
 const o=await observe(request); assert.equal(o.contract,CURRENT_AUTH_SCOPE); assert.equal(o.unclassifiedReferences,0);
 assert.equal(o.application.accountReceipts,1);assert.equal(o.writeFence,null);assert.deepEqual(o.binding,binding);
 for(const k of ["application","storage","engine","authGraphSha256","references","providerOperations","accountRevision"] as const)assert.deepEqual(o[k],before[k]);
 assert.notEqual(o.catalogSha256,before.catalogSha256,"new fingerprint is observed, never approval");
});
const inserts:Record<string,string[]>={
 waitlist:[`insert into public.waitlist(email,quiz)values('synthetic@example.invalid','{"unknown":true}')`],
 support_messages:[`insert into public.support_messages(email,message)values('synthetic@example.invalid','synthetic')`],
 receipts:[`insert into public.skus(id,name,aisle,pack_qty,pack_unit,canonical_unit,grams_per_unit)values('synthetic','synthetic','dairy',1,'each','each',1)`,`insert into public.receipts(user_hash,store_id,region,sku_id,price)values('${H}','walmart','00000','synthetic',1)`],
 delivery_quotes:[`insert into public.delivery_quotes(list_hash,store_id,zip,subtotal,fees)values('${H}','walmart','00000',1,0)`],
 shared_weeks:[`insert into public.shared_weeks(id,budget,protein_target,week)values('synthetic',150,150,'{"days":[],"unknown":true}')`],
 support_threads:[`insert into public.support_threads(channel,from_email)values('form','synthetic@example.invalid')`],
 support_messages_v2:[`with t as(insert into public.support_threads(channel,from_email)values('form','synthetic@example.invalid')returning id)insert into public.support_messages_v2(thread_id,direction,body)select id,'in','synthetic' from t`],
 wd_push_projects:[`insert into public.wd_push_projects values(gen_random_uuid(),'development',false)`],
 wd_ops_checks:[`insert into public.wd_ops_checks(check_id)values('database')`],
 wd_ops_alerts:[`insert into public.wd_ops_checks(check_id)values('database')`,`insert into public.wd_ops_alerts(check_id,generation,state)values('database',1,'failure')`],
 wd_support_sends:[`insert into public.wd_support_sends(id,fingerprint,owner,state)values('${H}','${H}',gen_random_uuid(),'held')`],
 wd_support_work:[`insert into public.wd_support_work(id,kind,input,input_hash)values('${H}','inbound','{}','${H}')`],
 wd_proposal_plan_policy:[`insert into public.wd_proposal_plan_policy(policy,environment)values('{}','SANDBOX')`],
 wd_proposal_plan_documents:[`insert into public.wd_proposal_plan_documents values('${B}',1,'{}')`],
 wd_proposal_plan_receipts:[`insert into public.wd_proposal_plan_receipts values('${B}',gen_random_uuid(),'{}','{}',now())`],
 wd_proposal_plan_replay:[`insert into public.wd_proposal_plan_replay values('${B}',gen_random_uuid(),'{}',txid_current())`]
};
for(const [name,sqls]of Object.entries(inserts))test("nonempty known area is held without guessed mapping/retention: "+name,()=>trial(async()=>{
 for(const sql of sqls)await admin(sql); const count=(await admin("select md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]')::text)n from public."+name+" t")).rows[0].n;
 assert.equal(await helper(),false); assert.deepEqual(await observe(request),{outcome:"held"});assert.equal((await admin("select md5(coalesce(jsonb_agg(to_jsonb(t)order by to_jsonb(t)::text),'[]')::text)n from public."+name+" t")).rows[0].n,count);
}));
for(const uid of [userId,B])test("recognized proposal owner and arbitrary JSON remain held: "+(uid===userId?"target":"foreign"),()=>trial(async()=>{
 await admin("insert into public.wd_proposal_plan_documents values($1,1,$2)",[uid,JSON.stringify({owner:uid,nested:{linkage:userId}})]);
 assert.equal(await helper(),false);assert.deepEqual(await observe(request),{outcome:"held"});
}));
for(const sql of ["alter table public.waitlist add column owner_id uuid","alter table public.wd_ops_checks add column arbitrary jsonb","grant select on public.waitlist to authenticated","grant update(email)on public.waitlist to service_role","alter table public.waitlist disable row level security","grant execute on function public.wd_operations(text,jsonb)to authenticated","grant execute on function public.wd_proposal_plan_cleanup()to public","alter function public.wd_support_send(text,jsonb)set search_path=public","create or replace view public.store_prices as select sku_id,store_id,region,shelf_price,unit_price,source,confidence,as_of from public.prices","create function public.synthetic_trigger()returns trigger language plpgsql as $$begin return new;end$$;create trigger synthetic before insert on public.waitlist for each row execute function public.synthetic_trigger()","create or replace function public.wd_operations(p_action text,p_body jsonb)returns jsonb language plpgsql as $$begin return '{}';end$$"])
 test("metadata/ACL/trigger/writer drift held: "+sql.split(" ").slice(0,6).join(" "),()=>trial(async()=>{await db.exec("reset role");await db.exec(sql);assert.equal(await helper(),false);assert.deepEqual(await observe(request),{outcome:"held"});}));
for(const sql of ["create table public.synthetic_unknown(id uuid)","create schema synthetic_unknown;create table synthetic_unknown.rows(id uuid)"])
 test("new relation/schema remains unknown: "+sql,()=>trial(async()=>{await db.exec("reset role");await db.exec(sql);const o=await observe(request);assert.ok(("outcome" in o && o.outcome==="held")||o.unclassifiedReferences>0);}));
for(const field of ["userId","workOwner","workAttempt","leaseUntil","intentSha256"])test("original binding remains strict: "+field,async()=>{
 const bad={...binding,[field]:field==="workAttempt"?2:field==="leaseUntil"?new Date(0).toISOString():field==="intentSha256"?"b".repeat(64):randomUUID()};assert.equal(await helper({...request,binding:bad}),false);
});
test("anon/authenticated helper/observer denied, no raw table privileges added",async()=>{
 for(const principal of ["anon","authenticated"]){await role(principal);await assert.rejects(()=>db.query("select public.wd_current_reviewed_legacy_empty($1::jsonb)",[JSON.stringify(request)]),{code:"42501"});await assert.rejects(()=>db.query("select public.wd_current_auth_scope_observe($1::jsonb)",[JSON.stringify(request)]),{code:"42501"});}
 await admin("select 1");assert.equal((await db.query<{r:boolean}>("select has_table_privilege('service_role','public.waitlist','SELECT')r")).rows[0].r,false);
});
test("exact old observer body reconstructed by removing only reviewed gate/exclusions; preimage drift rejected",async()=>{
 const old=await readFile(new URL("0026_wd_current_restore_scope_metadata.sql",directory),"utf8");
 const original=old.split("create or replace function public.wd_current_auth_scope_observe(p_body jsonb)")[1].split("as $$")[1].split("$$;")[0];
 const current=migration.split("as $observe$")[1].split("$observe$;")[0];
 let restored=current.replace(/\n if not public\.wd_current_reviewed_legacy_empty\(p_body\) then return '\{"outcome":"held"\}';end if;/,"");
 const added=","+known.map(n=>"'"+n+"'").join(",");assert.equal(restored.split(added).length-1,2);restored=restored.split(added).join("").replace(",'store_prices'","");assert.equal(restored,original);assert.ok(migration.includes(createHash("sha256").update(original).digest("hex")));
 await trial(async()=>{await admin("create or replace function public.wd_current_auth_scope_observe(p_body jsonb)returns jsonb language sql as $$select '{}'::jsonb$$");await assert.rejects(()=>db.exec(migration),/reviewed_legacy_observer_preimage/);});
});
test("current private states/operations residue and foreign records retain original cleanup semantics",()=>trial(async()=>{
 await admin("insert into wd_current_private.states values($1,$2,1,'{}',$2),($3,$2,1,'{}',$2)",[userId,H,B]);
 await admin("insert into wd_current_private.operations values($1,$2,$3,$2,'{}',$2)",[userId,H,randomUUID()]);
 const o=await observe(request);assert.equal(o.application.currentPlanCleanupPending,true);
 assert.equal((await admin("select count(*)::int n from wd_current_private.states")).rows[0].n,2);
 assert.equal((await admin("select count(*)::int n from wd_current_private.operations")).rows[0].n,1);
}));
test("genuine proposal tombstone trigger clears its exact owner and preserves unrelated original receipt",()=>trial(async()=>{
 await admin("insert into public.wd_proposal_plan_documents values($1,1,'{}')",[B]);
 await admin("update public.wd_accounts set state='deletion_pending' where user_id=$1",[B]);
 assert.equal((await admin("select count(*)::int n from public.wd_proposal_plan_documents where user_id=$1",[B])).rows[0].n,0);
 assert.equal((await admin("select count(*)::int n from public.wd_account_receipts where user_id=$1",[userId])).rows[0].n,1);
}));
// PGlite is serialized, not actual two-connection PostgreSQL or live provider proof.
