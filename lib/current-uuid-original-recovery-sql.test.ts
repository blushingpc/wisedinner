import test from "node:test";
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { appleDigest,type AppleData } from "./apple-token-custody.server.ts";
import { createCurrentUuidOriginalRecoveryStrategy } from "./current-uuid-original-recovery.server.ts";
const receiptPath = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;
assert.ok(receiptPath, "Actual local slot required; never skip");
const slot = JSON.parse(await readFile(receiptPath, "utf8"));
assert.equal(slot.contract, "wd-local-source-test-slot-v1");
assert.equal(slot.taskId, "backend-original-uuid-recovery-20261101");
assert.equal(slot.workerThreadId, "01a192f8-e59a-71a2-9149-1158d9e93c50");
assert.equal(resolve(slot.workspace), resolve(process.cwd()));
assert.ok(Date.parse(slot.at) <= Date.now() && Date.parse(slot.validUntil) > Date.now());
assert.ok(slot.argv.includes("lib/current-uuid-original-recovery-sql.test.ts"));
const { PGlite }=await import("@electric-sql/pglite");
const A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",H="a".repeat(64);
// Synthetic private admission ONLY to set up an already-admitted original via
// real SQL RPC. Not final runtime-issued proof/full destructive run acceptance.
const policy={approved:true as const,version:"wd-owner-uuid-delete-v1",preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
test("real unchanged0001..0029 original-bound GET-only recovery",async t=>{
 const db=await PGlite.create();try{
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


 const directory=new URL("../supabase/migrations/",import.meta.url);
 const files=(await readdir(directory)).filter(n=>/^00\d\d_.*\.sql$/.test(n)&&Number(n.slice(0,4))<=29).sort();assert.equal(files.length,29);
 for(const f of files)await db.exec(await readFile(new URL(f,directory),"utf8"));
 async function admin(sql:string,args:unknown[]=[]){await db.exec("reset role");return db.query<AppleData>(sql,args);}
 async function role(principal="service_role") {await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(principal==="service_role"?{role:principal}:{role:principal,sub:A,is_anonymous:false,amr:[{method:"password",timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec("set role "+principal);}
 async function rpc(name:string,action:string,body:unknown,principal="service_role"):Promise<AppleData>{assert.match(name,/^wd_[a-z0-9_]+$/);await role(principal);return(await db.query<{r:AppleData}>(`select public.${name}($1,$2::jsonb)r`,[action,JSON.stringify(body)])).rows[0].r;}
 async function trial(fn:()=>Promise<void>){await admin("begin");try{await fn();}finally{await db.exec("rollback");await db.exec("reset role");}}
 async function prepare(){
  await admin("insert into auth.users values($1),($2)",[A,B]);await admin("insert into public.wd_accounts(user_id)values($1),($2)",[A,B]);
  const op=randomUUID(),owner=randomUUID(),basis=await rpc("wd_apple_deletion_command","effective_basis",{userId:A});
  assert.equal((await rpc("wd_apple_deletion_command","admit_original",{original:{userId:A,operationId:op,recoveryHash:H,expectedAccountRevision:1,identityHash:H,identityEvidence:H,appleLinkage:"none",policy,policyHash:appleDigest(policy),intentSha256:H},basis:{userId:A,currentIdentityHash:H,identityEvidence:H,actualApple:"none",effectiveApple:"none",inventoryRevision:basis.revision,inventoryHash:basis.inventoryHash}})).outcome,"admitted");
  assert.equal((await rpc("wd_deletion_v2_account_command","confirm",{operationId:op,recoveryHash:H,expectedAccountRevision:1,intentSha256:H,confirmation:"DELETE MY ACCOUNT"},"authenticated")).intentState,"confirmed");
  const claimed=await rpc("wd_deletion_v2_worker_command","claim",{operationId:op,intentSha256:H,owner}),work=claimed.work as AppleData;
  assert.equal(work.owner,owner);assert.equal(work.attempt,1);
  const advance={operationId:op,intentSha256:H,owner,attempt:work.attempt};assert.ok((await rpc("wd_deletion_v2_worker_command","cleanup",advance)).receipt);
  await rpc("wd_deletion_v2_worker_command","apple_unavailable",advance);await rpc("wd_deletion_v2_worker_command","begin",{...advance,dependency:"auth"});
  const target={userId:A,identityHash:H,operationId:String(work.auth_operation)},f=await rpc("wd_apple_deletion_command","auth_fence",target);
  const scope={outcome:"allowed",profile:policy.version,providerPredicate:"account-uuid-only",strongWriteFence:null,accountRevision:2,
   binding:{userId:A,identityHash:H,authOperationId:target.operationId,deletionOperationId:op,intentSha256:H,workOwner:owner,workAttempt:1,leaseUntil:f.lease,policySha256:appleDigest(policy),scopeSha256:H,authorizationId:randomUUID(),evidenceSha256:H,observedAt:new Date().toISOString(),validUntil:f.lease},
   coverage:{coveredAuthGraphSha256:H,storage:"verified_clear",sharedEngine:"verified_preserved",relatedOwnerReferences:"approved_preserved"}};
  assert.equal((await rpc("wd_apple_deletion_command","auth_begin",{...target,fenceHash:f.fenceHash,scope})).fresh,true);
  const saved=await rpc("wd_apple_deletion_command","auth_original",target);assert.equal(saved.scopeProfile,policy.version);assert.equal(saved.scopeAccountRevision,2);
  const scopeBytes=(await admin("select md5(scope::text) h from wd_apple_private.auth_attempts where operation_id=$1",[target.operationId])).rows[0].h;return{target,op,saved,scopeBytes};
 }
 function port(opts:{lost?:boolean;drift?:string;lostGet?:boolean;afterRecord?:string}={}){
  const calls:string[]=[],methods:string[]=[];let records=0;
  const s=createCurrentUuidOriginalRecoveryStrategy({origin:"https://synthetic.invalid",serverCredential:"synthetic-not-a-key",policy,now:Date.now,timeoutMs:8000,
   repository:{async command(ns,action,body){assert.equal(ns,"deletion");assert.ok(["auth_fence","auth_original","auth_record"].includes(action));calls.push(action);const r=await rpc("wd_apple_deletion_command",action,body);if(action==="auth_record"){records++;if(opts.afterRecord)await admin(opts.afterRecord);if(opts.lost)throw Error("synthetic_record_ack_lost");}return r;}},
   async request(url,init){assert.equal(url,"https://synthetic.invalid/auth/v1/admin/users/"+A);methods.push(String(init?.method));assert.equal(init?.method,"GET");assert.equal(init?.body,undefined);if(opts.lostGet)throw Error("synthetic_get_lost");
    if(opts.drift)await admin(opts.drift);
    const count=await admin("select count(*)::int n from auth.users where id=$1",[A]);return count.rows[0].n===0?new Response('{"code":"user_not_found"}',{status:404}):new Response(JSON.stringify({id:A,created_at:new Date().toISOString()}),{status:200});}});
  return{p:s.forOwner(A),s,calls,methods,records:()=>records};
 }
 async function absent(){await admin("delete from auth.users where id=$1",[A]);}
 await t.test("prior synthetic provider effect/Auth absent: GET404 records once, no new scope or auth_begin, confirmed replay no GET",()=>trial(async()=>{
  const f=await prepare();await absent();const p=port();assert.equal((await p.p.reconcile(f.target)).outcome,"already_absent");assert.equal(p.records(),1);assert.deepEqual(p.methods,["GET"]);
  assert.equal((await p.p.reconcile(f.target)).outcome,"confirmed");assert.equal(p.records(),1);assert.deepEqual(p.methods,["GET"]);
  const saved=await rpc("wd_apple_deletion_command","auth_original",f.target);assert.equal(saved.scopeHash,f.saved.scopeHash);assert.equal(saved.state,"confirmed");
 }));
 await t.test("actual expired work is renewed through unchanged claim RPC, original stored scope preserved",()=>trial(async()=>{
  const f=await prepare();await absent();await admin("update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id=$1",[A]);
  const renewed=await rpc("wd_deletion_v2_worker_command","claim",{operationId:f.op,intentSha256:H,owner:randomUUID()}),work=renewed.work as AppleData;assert.equal(work.attempt,2);
  const p=port();assert.equal((await p.p.reconcile(f.target)).outcome,"already_absent");const saved=await rpc("wd_apple_deletion_command","auth_original",f.target);assert.equal(saved.scopeHash,f.saved.scopeHash);assert.equal((await admin("select md5(scope::text) h from wd_apple_private.auth_attempts where operation_id=$1",[f.target.operationId])).rows[0].h,f.scopeBytes);assert.equal(p.records(),1);
 }));
 await t.test("present user never sends DELETE or records absence",()=>trial(async()=>{const f=await prepare(),p=port();assert.equal((await p.p.reconcile(f.target)).outcome,"unknown");assert.equal(p.records(),0);assert.deepEqual(p.methods,["GET"]);}));
 await t.test("lost record ACK stays unknown then explicit recovery reads durable confirmation, never repeats effect",()=>trial(async()=>{
  const f=await prepare();await absent();const p=port({lost:true});assert.equal((await p.p.reconcile(f.target)).outcome,"unknown");assert.equal(p.records(),1);assert.equal((await p.p.reconcile(f.target)).outcome,"confirmed");assert.equal(p.records(),1);assert.deepEqual(p.methods,["GET"]);
 }));
 await t.test("lost GET remains unknown with no record",()=>trial(async()=>{const f=await prepare();await absent();const p=port({lostGet:true});assert.equal((await p.p.reconcile(f.target)).outcome,"unknown");assert.equal(p.records(),0);assert.deepEqual(p.methods,["GET"]);}));
 for(const [name,sql]of Object.entries({lease:"update public.wd_deletion_work set lease_until=now()-interval '1 second'",phase:"update wd_deletion_v2_private.intents set phase='prepared'",owner:"update public.wd_deletion_work set owner=gen_random_uuid()",attempt:"update public.wd_deletion_work set attempt=attempt+1",intent:"update wd_deletion_v2_private.intents set intent_hash=repeat('b',64)"}))await t.test("actual GET boundary drift prevents record: "+name,()=>trial(async()=>{const f=await prepare();await absent();const p=port({drift:sql});assert.equal((await p.p.reconcile(f.target)).outcome,"unknown");assert.equal(p.records(),0);}));
 await t.test("strict/unadmitted stored original, foreign owner/identity/new operation remain unknown without GET",()=>trial(async()=>{
  const f=await prepare(),p=port();for(const target of [{...f.target,userId:B},{...f.target,identityHash:"b".repeat(64)},{...f.target,operationId:randomUUID()}])assert.equal((await p.p.reconcile(target)).outcome,"unknown");assert.equal(p.methods.length,0);
  await admin("update wd_apple_private.auth_attempts set scope=scope-'profile' where operation_id=$1",[f.target.operationId]);assert.equal((await p.p.reconcile(f.target)).outcome,"unknown");assert.equal(p.methods.length,0);assert.equal(p.records(),0);
 }));
 await t.test("post-record lease loss stays unknown after one durable record; no duplicate effect",()=>trial(async()=>{
  const f=await prepare();await absent();const p=port({afterRecord:"update public.wd_deletion_work set lease_until=now()-interval '1 second'"});assert.equal((await p.p.reconcile(f.target)).outcome,"unknown");assert.equal(p.records(),1);assert.deepEqual(p.methods,["GET"]);
  const stored=await admin("select state,scope_hash from wd_apple_private.auth_attempts where operation_id=$1",[f.target.operationId]);assert.equal(stored.rows[0].state,"confirmed");assert.equal(stored.rows[0].scope_hash,f.saved.scopeHash);
 }));
 await t.test("foreign policy cannot recover exact original",()=>trial(async()=>{const f=await prepare();await absent();const p=createCurrentUuidOriginalRecoveryStrategy({origin:"https://synthetic.invalid",serverCredential:"synthetic",policy:{...policy,receiptSeconds:601},now:Date.now,timeoutMs:8000,repository:{command:async(_ns,a,b)=>rpc("wd_apple_deletion_command",a,b)},request:async()=>{assert.fail("no GET under policy mismatch");}}).forOwner(A);assert.equal((await p.reconcile(f.target)).outcome,"unknown");}));
 }finally{await db.close();}
});
// Real synthetic SQL component proof only; PGlite is serialized, not concurrent
// PostgreSQL, hosted provider admission or complete run/final-proof/lifecycle success.
