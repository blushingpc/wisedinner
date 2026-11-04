import test from "node:test";
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID,randomBytes,generateKeyPairSync,createHash } from "node:crypto";
import { appleDigest,type AppleData } from "./apple-token-custody.server.ts";
import { CURRENT_AUTH_SCOPE,type ScopeObservationRequest,type CurrentScopeReference } from "./current-auth-scope.server.ts";
import { createCurrentUuidLifecycleHostAdapter,type CurrentUuidLifecycleHostConfiguration } from "./current-uuid-lifecycle-host-admission.server.ts";
import { parseCurrentPrivateLifecycleMaterial } from "./current-private-lifecycle-config.server.ts";
import { supabaseDeletionAuthV2,deletionIntentHash,deletionRecoveryHash } from "./account-deletion-v2.server.ts";
import { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";
import type { ClaimReferenceSelector,CurrentUuidClaimTemplate } from "./current-uuid-claim-scope.server.ts";
const receiptPath=process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;assert.ok(receiptPath,"Actual Main local slot required, never skip");
const slot=JSON.parse(await readFile(receiptPath,"utf8"));assert.equal(slot.contract,"wd-local-source-test-slot-v1");assert.equal(slot.taskId,"backend-uuid-lifecycle-composition-20261101");assert.equal(slot.workerThreadId,"01a192ed-0c8f-7411-a5b6-f40ea6104f07");assert.equal(resolve(slot.workspace),resolve(process.cwd()));assert.ok(Date.parse(slot.at)<=Date.now()&&Date.parse(slot.validUntil)>Date.now());assert.ok(slot.argv.includes("lib/current-uuid-lifecycle-sql.test.ts"));
const {PGlite}=await import("@electric-sql/pglite");
const A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",ORIGIN="https://zpvqxtklvjitofpbddrn.supabase.co";
const policy={approved:true as const,version:UUID_DELETE_PROFILE,preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
const custodyPolicy={approved:true as const,version:"synthetic-only",credentialSeconds:600,recoverySeconds:600,evidenceSeconds:3600,retainedEvidence:["apple_credential_recovery"]};
function freezeFixture<T>(v:T):T{if(v&&typeof v==="object"){Object.values(v).forEach(freezeFixture);Object.freeze(v);}return v;}
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
test("current UUID lifecycle: actual fresh SQL composition, no guessed scope or provider",async t=>{
 const db=await PGlite.create();try{
const syntheticRoleDDL = `create role anon;create role authenticated;create role service_role bypassrls;
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
    grant select on all tables in schema storage to service_role;`;

 await db.exec(syntheticRoleDDL);
 const directory=new URL("../supabase/migrations/",import.meta.url),names=(await readdir(directory)).filter(n=>/^00\d\d_.*\.sql$/.test(n)&&Number(n.slice(0,4))<=29).sort();assert.equal(names.length,29);
 const ddl=new Map<string,string>();for(const n of names)ddl.set(n,await readFile(new URL(n,directory),"utf8"));
 assert.equal(sha(names.map(n=>n+"|"+sha(ddl.get(n)!)).join("\n")),"fb026af9c016dff6d008b7065ffb57ae6dd440ec026d649694e3c720e7dbf47e");
 for(const n of names)await db.exec(ddl.get(n)!);
 const reviewedSourcePackageSha256="fb026af9c016dff6d008b7065ffb57ae6dd440ec026d649694e3c720e7dbf47e",version=(await db.query<{v:string}>("select version() v")).rows[0].v;
  const observerDDL = ddl.get("0028_wd_current_reviewed_legacy_scope.sql")!;
  const barrierDDL = ddl.get("0027_wd_current_local_deletion_barrier.sql")!;
  function statement(source: string, start: string, end: string) {
    const a = source.indexOf(start); assert.ok(a >= 0); const b = source.indexOf(end, a); assert.ok(b > a); return source.slice(a, b + end.length);
  }
  const catalogQuery = statement(observerDDL, "select encode(sha256(convert_to(coalesce(jsonb_agg(v order by v::text)", ") s;").replace("into catalog_hash", "as hash");
  const engineQuery = statement(observerDDL, "select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(c.relname", "and c.relkind in('r','p');").replace("into engine_hash", "as hash");
  const manifestQuery = statement(barrierDDL, "select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(ns.nspname,p.proname", "and p.prokind in('f','p');").replace("into manifest_hash", "as hash");
  const writerQuery = statement(barrierDDL, "select encode(sha256(convert_to(jsonb_build_array(o->>'catalogSha256'", "into catalog_hash;").replace("o->>'catalogSha256'", "$1::text").replace("into catalog_hash", "as hash");
  async function metadata(query: string, args: unknown[] = []) { await db.exec("reset role;set search_path=\'\'"); return (await db.query<{ hash: string }>(query, args)).rows[0].hash; }
  const operator = freezeFixture({
    sourcePackageSha256: reviewedSourcePackageSha256, postgresVersion: version,
    expectedCatalogSha256: await metadata(catalogQuery), expectedEngineSha256: await metadata(engineQuery), writerManifestSha256: await metadata(manifestQuery),
    writerCatalogSha256: "", validUntil: new Date(Date.now() + 600000).toISOString(), maxObservationAgeMs: 8000,
    projectionDefinitions: ["accountTombstone", "deletionWork", "deletionIntents", "appleOwners", "appleBindings"] as CurrentScopeReference[]
  });
  // Object is frozen already; construct a second final immutable operator record
  // rather than mutating/adopting a later runtime observation.
  const approvedOperator = freezeFixture({ ...operator, writerCatalogSha256: await metadata(writerQuery, [operator.expectedCatalogSha256]) });
  assert.match(approvedOperator.expectedCatalogSha256, /^[a-f0-9]{64}$/);

 const retentionMeta=(await db.query<{m:{schemaSha256:string;eraserSha256:string}}>("select wd_apple_private.current_retention_schema() m")).rows[0].m;
 let queue:Promise<unknown>=Promise.resolve();const serial=<T>(fn:()=>Promise<T>)=>{const p=queue.then(fn);queue=p.catch(()=>{});return p;};
 const admin=(sql:string,args:unknown[]=[])=>serial(async()=>{await db.exec("reset role");return db.query<AppleData>(sql,args);});
 const rpc=(name:string,action:string,body:unknown,uid=A,principal="service_role")=>serial(async()=>{
  assert.match(name,/^wd_[a-z0-9_]+$/);await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:principal,sub:uid,is_anonymous:false,amr:[{method:"password",timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec("set role "+principal);
  return(await db.query<{r:AppleData}>(`select public.${name}($1,$2::jsonb) r`,[action,JSON.stringify(body)])).rows[0].r;
 });
 const observe=(q:ScopeObservationRequest,local=false)=>serial(async()=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:"service_role"})]);await db.exec("set role service_role");return(await db.query<{r:unknown}>(`select public.${local?"wd_current_local_deletion_barrier":"wd_current_auth_scope_observe"}($1::jsonb) r`,[JSON.stringify(q)])).rows[0].r;});
 let deletes=0,authGets=0,clears=0,lose=false,receiptHeld=0;const actions:string[]=[],factRequests:ScopeObservationRequest[]=[];
 const transport:typeof fetch=async(url,init)=>{
  const path=new URL(String(url)).pathname;
  if(path.startsWith("/auth/v1/admin/users/")){
   const id=path.split("/").at(-1)!;assert.ok([A,B].includes(id));
   if(init?.method==="DELETE"){deletes++;await admin("delete from auth.users where id=$1",[id]);if(lose)throw Error("synthetic_effect_ACK_lost");return Response.json({});}
   assert.equal(init?.method,"GET");authGets++;const present=await admin("select id from auth.users where id=$1",[id]);
   return present.rows.length?Response.json({id,is_anonymous:false,created_at:"2026-10-01T00:00:00Z",identities:[{identity_id:id,user_id:id,provider:"email",id:"fixture-"+id,created_at:"2026-10-01T00:00:00Z"}]}):Response.json({code:"user_not_found"},{status:404});
  }
  const name=path.split("/").at(-1)!,body=JSON.parse(String(init?.body));actions.push(name+":"+(body.p_action??"clear"));
  if(name==="wd_current_ephemeral_deletion_receipt_cleanup"){
   clears++;const r=await serial(async()=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:"service_role"})]);await db.exec("set role service_role");return(await db.query<{r:AppleData}>("select public.wd_current_ephemeral_deletion_receipt_cleanup($1::jsonb) r",[JSON.stringify(body.p)])).rows[0].r;});if(r.outcome==="held")receiptHeld++;return Response.json(r);
  }
  return Response.json(await rpc(name,body.p_action,body.p_body));
 };
 await admin("insert into auth.users values($1),($2)",[A,B]);await admin("insert into public.wd_accounts(user_id)values($1),($2)",[A,B]);
 const identity=await supabaseDeletionAuthV2(ORIGIN,"synthetic",transport).verifyIdentity(A);assert.ok(identity);const H=identity.identityHash;
 const repository={async command(ns:"custody"|"revocation"|"deletion",action:string,body:AppleData){actions.push(ns+":"+action);return rpc({custody:"wd_apple_custody_command",revocation:"wd_apple_revocation_command",deletion:"wd_apple_deletion_command"}[ns],action,body);}};
 const selectors:ClaimReferenceSelector[]=approvedOperator.projectionDefinitions.map(reference=>({reference,projection:CURRENT_AUTH_SCOPE+"/"+reference,userId:A,identityHash:H,policySha256:appleDigest(policy),maxCount:1,async select(q){
  assert.equal(q.binding.userId,A);assert.equal(q.binding.identityHash,H);assert.equal(q.policySha256,appleDigest(policy));assert.equal(q.accountRevision,2);
  const f=await rpc("wd_apple_deletion_command","auth_fence",{userId:A,identityHash:H,operationId:q.binding.authOperationId});assert.equal(f.owner,q.binding.workOwner);assert.equal(f.attempt,q.binding.workAttempt);assert.equal(f.lease,q.binding.leaseUntil);
  const req={binding:q.binding,policySha256:q.policySha256,authorizationId:randomUUID(),scopeSha256:appleDigest(["synthetic-reviewed-independent104",q,randomUUID()]),custodyPolicy,custodyPolicySha256:appleDigest(custodyPolicy)};
  const meta=await observe(req) as {references:Record<string,{count:number;sha256:string}>};const value=meta.references[reference];assert.equal(value.count,1);return{projectionIdentitySha256:q.projectionIdentitySha256,value};
 }}));
 const template:CurrentUuidClaimTemplate={deletionPolicy:policy,custodyPolicy,expectedCatalogSha256:approvedOperator.expectedCatalogSha256,expectedEngineSha256:approvedOperator.expectedEngineSha256,writerManifestSha256:approvedOperator.writerManifestSha256,writerCatalogSha256:approvedOperator.writerCatalogSha256,validUntil:approvedOperator.validUntil,maxObservationAgeMs:8000,selectors};
 const key=generateKeyPairSync("ec",{namedCurve:"prime256v1"}),now=Date.now();
 const credential=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),Buffer.from(JSON.stringify({role:"service_role",ref:"zpvqxtklvjitofpbddrn",exp:Math.floor(now/1000)+86400})).toString("base64url"),Buffer.alloc(32,1).toString("base64url")].join(".");
 const material=parseCurrentPrivateLifecycleMaterial({origin:ORIGIN,serverCredential:credential,profile:UUID_DELETE_PROFILE,profilePolicyVersion:UUID_DELETE_PROFILE,clientId:"com.wisedinner.app",teamId:"TESTTEAM01",keyId:"TESTKEY001",privateKeyPem:key.privateKey.export({type:"pkcs8",format:"pem"}).toString(),secretSeconds:60,keyVersion:"test",keyring:new Map([["test",randomBytes(32)]]),applePolicy:custodyPolicy,deletionPolicy:policy,validUntil:new Date(now+600000).toISOString()}).detach(now);assert.ok(material);
 const config:CurrentUuidLifecycleHostConfiguration={enabled:true,material,template,ports:{async observe(q){factRequests.push(structuredClone(q));return observe(q);},observeLocalDenial:q=>observe(q,true)},verify:async r=>({id:r.headers.get("authorization")==="Bearer B"?B:A,token:"synthetic",authenticatedAt:Math.floor(Date.now()/1000),providers:["email"]}),request:transport,now:Date.now,repositories:{apple:repository,deletion:{account:(account,action,body)=>rpc("wd_deletion_v2_account_command",action,body,account.id,"authenticated"),worker:(action,body)=>rpc("wd_deletion_v2_worker_command",action,body)}},retention:{...retentionMeta,maxRecords:128,freshnessMs:3000,clockSkewMs:1000,async readAdmission(q){return{outcome:"admitted",registryId:"wd-apple-custody-v1",...retentionMeta,policySha256:q.policySha256,custodyPolicySha256:q.custodyPolicySha256,observedAt:Date.now(),validUntil:Date.now()+2000};}}};
 function original(){const operationId=randomUUID(),capability=randomBytes(32).toString("base64url");return{operationId,capability,intentSha256:deletionIntentHash(A,operationId,1,deletionRecoveryHash(operationId,capability),appleDigest(policy))};}
 function request(o:ReturnType<typeof original>,operation:"prepare"|"confirm"|"status",owner=A){return new Request(ORIGIN+"/api/v1/account/deletion-v2",{method:"POST",headers:{"content-type":"application/json",authorization:operation==="status"?"Deletion-Recovery "+o.capability:"Bearer "+(owner===A?"A":"B"),"x-wd-deletion-recovery":o.capability,"x-wd-deletion-intent-sha256":o.intentSha256},body:JSON.stringify({contract:"wd-account-deletion-v2",operation,operationId:o.operationId,...(operation==="status"?{intentSha256:o.intentSha256}:{expectedAccountRevision:1,...(operation==="confirm"?{intentSha256:o.intentSha256,confirmation:"DELETE MY ACCOUNT"}:{})})})});}
 async function trial(fn:()=>Promise<void>){await admin("begin");try{await fn();}finally{await serial(async()=>{await db.exec("rollback;reset role");});}}

 for(const loss of [false,true])await t.test(loss?"required lost effect ACK recovers original GET with no second DELETE":"required fresh prepare/confirm/random claim/receipt/issuer/finalproof makes ONE effect",()=>trial(async()=>{
  const o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create();deletes=0;authGets=0;clears=0;receiptHeld=0;lose=loss;factRequests.length=0;
  const prepared=await port.deletion(request(o,"prepare"));assert.equal(prepared.status,200);const prep=await prepared.json();assert.equal(prep.result.intentState,"prepared");
  assert.equal(deletes,0);assert.equal(factRequests.length,0,"no future source scope required before prepare");
  const response=await port.deletion(request(o,"confirm"));assert.equal(response.status,200);const initial=await response.json();
  assert.equal(deletes,1,"required real join; diagnostic="+JSON.stringify({clears,receiptHeld,factRequests:factRequests.length,authDeletion:initial.result.authDeletion,actions:actions.slice(-12)}));
  if(loss){assert.notEqual(initial.result.authDeletion,"confirmed");await admin("update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id=$1",[A]);
   const stored=await admin("select scope_hash from wd_apple_private.auth_attempts where owner_id=$1",[A]);
   const beforeRecovery={gets:authGets,clears,facts:factRequests.length};
   const recovered=await port.deletion(request(o,"confirm"));assert.equal(recovered.status,200);assert.equal((await recovered.json()).result.authDeletion,"confirmed");
   assert.equal((await admin("select scope_hash from wd_apple_private.auth_attempts where owner_id=$1",[A])).rows[0].scope_hash,stored.rows[0].scope_hash);
   assert.ok(authGets>beforeRecovery.gets,"recovery uses original GET");assert.equal(clears,beforeRecovery.clears,"no repeated receipt clear");assert.equal(factRequests.length,beforeRecovery.facts,"no scope issuance/reobservation in original recovery");
  }else assert.equal(initial.result.authDeletion,"confirmed");
  assert.equal(deletes,1);assert.equal((await admin("select count(*)::int n from public.wd_account_receipts where user_id=$1",[A])).rows[0].n,0);
  const status=await port.deletion(request(o,"status"));assert.equal(status.status,200);assert.equal((await status.json()).result.authDeletion,"confirmed");assert.equal(deletes,1);
 }));
 await t.test("actual pending observation holds; natural started phase clears only before Auth admission",()=>trial(async()=>{
  const o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create();assert.equal((await port.deletion(request(o,"prepare"))).status,200);
  assert.equal((await rpc("wd_deletion_v2_account_command","confirm",{operationId:o.operationId,recoveryHash:deletionRecoveryHash(o.operationId,o.capability),expectedAccountRevision:1,intentSha256:o.intentSha256,confirmation:"DELETE MY ACCOUNT"},A,"authenticated")).intentState,"confirmed");
  const owner=randomUUID(),command={operationId:o.operationId,intentSha256:o.intentSha256,owner};const work=(await rpc("wd_deletion_v2_worker_command","claim",command)).work as AppleData;assert.equal(work.owner,owner);
  await rpc("wd_deletion_v2_worker_command","cleanup",{...command,attempt:work.attempt});await rpc("wd_deletion_v2_worker_command","apple_unavailable",{...command,attempt:work.attempt});
  const binding={userId:A,identityHash:H,authOperationId:String(work.auth_operation),deletionOperationId:o.operationId,intentSha256:o.intentSha256,workOwner:owner,workAttempt:Number(work.attempt),leaseUntil:String(work.lease_until)};
  const q={binding,policySha256:appleDigest(policy),authorizationId:randomUUID(),scopeSha256:appleDigest(["diagnostic-NON-AUTHORIZING",binding]),custodyPolicy,custodyPolicySha256:appleDigest(custodyPolicy)};
  assert.deepEqual(await observe(q),{outcome:"held"},"pending work cannot yield the current revision observation");
  await rpc("wd_deletion_v2_worker_command","begin",{...command,attempt:work.attempt,dependency:"auth"});
  const facts=await observe(q) as {contract:string;accountRevision:number;application:{accountReceipts:number}};assert.equal(facts.contract,CURRENT_AUTH_SCOPE);assert.equal(facts.accountRevision,2);assert.equal(facts.application.accountReceipts,1);
  const reply=await transport(ORIGIN+"/rest/v1/rpc/wd_current_ephemeral_deletion_receipt_cleanup",{method:"POST",body:JSON.stringify({p:{...binding,accountRevision:facts.accountRevision,policySha256:q.policySha256,policy}})});
  const cleared=await reply.json();assert.equal(cleared.outcome,"cleared");assert.equal(cleared.removed,1);assert.equal(cleared.remaining,0);
  assert.deepEqual(cleared.binding,{...binding,accountRevision:facts.accountRevision,policySha256:q.policySha256});
  assert.equal((await admin("select count(*)::int n from wd_apple_private.auth_attempts where owner_id=$1",[A])).rows[0].n,0);
  assert.equal((await admin("select count(*)::int n from public.wd_account_receipts where user_id=$1",[A])).rows[0].n,0);
 }));
 for(const [name,sql]of Object.entries({revision:"update public.wd_accounts set revision=revision+1 where user_id='"+A+"'",lease:"update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id='"+A+"'",attempt:"update public.wd_deletion_work set attempt=attempt+1 where user_id='"+A+"'",receipt:"insert into public.wd_account_receipts(user_id,id,request,result)values('"+A+"',gen_random_uuid(),'{}','{}')"}))await t.test("real claim observation boundary drift prevents Auth effect: "+name,()=>trial(async()=>{
  const o=original();let changed=false;const c={...config,ports:{...config.ports!,async observe(q:ScopeObservationRequest){if(!changed){changed=true;await admin(sql);}return config.ports!.observe(q);}}};
  const port=createCurrentUuidLifecycleHostAdapter(c).create(),before=deletes;assert.equal((await port.deletion(request(o,"prepare"))).status,200);
  const response=await port.deletion(request(o,"confirm"));assert.equal(response.status,200);assert.notEqual((await response.json()).result.authDeletion,"confirmed");assert.equal(deletes,before);assert.equal(changed,true);
  assert.equal((await admin("select count(*)::int n from wd_apple_private.auth_attempts where owner_id=$1",[A])).rows[0].n,0);
 }));
 await t.test("already pending delivery preserves one original and never retries a held unknown effect",()=>trial(async()=>{
  const o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create(),before=deletes;lose=true;assert.equal((await port.deletion(request(o,"prepare"))).status,200);
  const first=await port.deletion(request(o,"confirm"));assert.equal(first.status,200);const initial=await first.json();assert.equal(initial.result.operationId,o.operationId);assert.notEqual(initial.result.authDeletion,"confirmed");assert.equal(deletes,before+1);
  const beforeDuplicate={clears,facts:factRequests.length};
  const duplicate=await port.deletion(request(o,"confirm"));assert.equal(duplicate.status,200);assert.equal((await duplicate.json()).result.operationId,o.operationId);
  assert.equal(deletes,before+1,"duplicate delivery never repeats the unknown effect");assert.equal(clears,beforeDuplicate.clears);assert.equal(factRequests.length,beforeDuplicate.facts);
  assert.equal((await admin("select count(*)::int n from wd_deletion_v2_private.intents where user_id=$1",[A])).rows[0].n,1);
  assert.equal((await admin("select count(*)::int n from wd_apple_private.auth_attempts where owner_id=$1",[A])).rows[0].n,1);
 }));
 await t.test("foreign actor, future revision and missing retention admission remain closed before owner mutation",()=>trial(async()=>{
  const o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create(),before=deletes;
  assert.equal((await port.deletion(request(o,"prepare",B))).status,503);
  const wrong=request(o,"prepare"),body=await wrong.json();body.expectedAccountRevision=2;
  assert.equal((await port.deletion(new Request(wrong.url,{method:"POST",headers:wrong.headers,body:JSON.stringify(body)}))).status,503);
  assert.equal((await createCurrentUuidLifecycleHostAdapter({...config,retention:undefined}).create().deletion(request(o,"prepare"))).status,503);
  assert.equal(deletes,before);assert.equal((await admin("select count(*)::int n from wd_deletion_v2_private.intents")).rows[0].n,0);
 }));
 }finally{await db.close();}
});
