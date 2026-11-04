import test from "node:test";
import assert from "node:assert/strict";
import {readFile,readdir} from "node:fs/promises";
import {resolve} from "node:path";
import {randomUUID,randomBytes} from "node:crypto";
import {appleDigest,type AppleData} from "./apple-token-custody.server.ts";
import {createCurrentOriginalStatusHandler} from "./current-original-status-recovery.server.ts";
import {deletionRecoveryHash,deletionIntentHash} from "./account-deletion-v2.server.ts";
import {withCurrentIntegrationHostResolver} from "./current-integration-host.server.ts";
import {POST} from "../app/api/v1/account/deletion-v2/route.ts";
const A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",H="a".repeat(64),ORIGIN="https://zpvqxtklvjitofpbddrn.supabase.co",HOST="https://host.synthetic.invalid";
// Explicit synthetic private prior admission through real SQL; not a final scope
// issuer success, deployment manifest, provider CAS or live deletion acceptance.
const policy={approved:true as const,version:"wd-owner-uuid-delete-v1",preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
test("original-status public POST -> real SQL journal -> accepted GET-only recovery; serialized local component",async t=>{
 const receiptPath=process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;assert.ok(receiptPath,"Actual local slot required before PGlite; no skips");const slot=JSON.parse(await readFile(receiptPath,"utf8"));assert.equal(slot.taskId,"backend-private-recovery-v208");assert.equal(slot.actualExecutorThreadId,"01a192f8-e59a-71a2-9149-1158d9e93c50");assert.equal(resolve(slot.workspace),resolve(process.cwd()));assert.ok(Date.parse(slot.validUntil)>Date.now());
 const {PGlite}=await import("@electric-sql/pglite");
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
 await db.exec(await readFile(new URL("0033_wd_current_original_status_recovery.sql",directory),"utf8"));
 async function admin(sql:string,args:unknown[]=[]){await db.exec("reset role");return db.query<AppleData>(sql,args);}
 async function role(principal="service_role") {await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify(principal==="service_role"?{role:principal}:{role:principal,sub:A,is_anonymous:false,amr:[{method:"password",timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec("set role "+principal);}
 async function rpc(name:string,action:string,body:unknown,principal="service_role"):Promise<AppleData>{assert.match(name,/^wd_[a-z0-9_]+$/);await role(principal);return(await db.query<{r:AppleData}>(`select public.${name}($1,$2::jsonb)r`,[action,JSON.stringify(body)])).rows[0].r;}
 async function trial(fn:()=>Promise<void>){await admin("begin");try{await fn();}finally{await db.exec("rollback");await db.exec("reset role");}}
 async function prepare(){
  await admin("insert into auth.users values($1),($2)",[A,B]);await admin("insert into public.wd_accounts(user_id)values($1),($2)",[A,B]);
  const op=randomUUID(),capability=randomBytes(32).toString("base64url"),recoveryHash=deletionRecoveryHash(op,capability),intentSha256=deletionIntentHash(A,op,1,recoveryHash,appleDigest(policy)),owner=randomUUID(),basis=await rpc("wd_apple_deletion_command","effective_basis",{userId:A});
  assert.equal((await rpc("wd_apple_deletion_command","admit_original",{original:{userId:A,operationId:op,recoveryHash,expectedAccountRevision:1,identityHash:H,identityEvidence:H,appleLinkage:"none",policy,policyHash:appleDigest(policy),intentSha256},basis:{userId:A,currentIdentityHash:H,identityEvidence:H,actualApple:"none",effectiveApple:"none",inventoryRevision:basis.revision,inventoryHash:basis.inventoryHash}})).outcome,"admitted");
  assert.equal((await rpc("wd_deletion_v2_account_command","confirm",{operationId:op,recoveryHash,expectedAccountRevision:1,intentSha256,confirmation:"DELETE MY ACCOUNT"},"authenticated")).intentState,"confirmed");
  const claimed=await rpc("wd_deletion_v2_worker_command","claim",{operationId:op,intentSha256,owner}),work=claimed.work as AppleData;
  assert.equal(work.owner,owner);assert.equal(work.attempt,1);
  const advance={operationId:op,intentSha256,owner,attempt:work.attempt};assert.ok((await rpc("wd_deletion_v2_worker_command","cleanup",advance)).receipt);
  await rpc("wd_deletion_v2_worker_command","apple_unavailable",advance);await rpc("wd_deletion_v2_worker_command","begin",{...advance,dependency:"auth"});
  const target={userId:A,identityHash:H,operationId:String(work.auth_operation)},f=await rpc("wd_apple_deletion_command","auth_fence",target);
  const scope={outcome:"allowed",profile:policy.version,providerPredicate:"account-uuid-only",strongWriteFence:null,accountRevision:2,
   binding:{userId:A,identityHash:H,authOperationId:target.operationId,deletionOperationId:op,intentSha256,workOwner:owner,workAttempt:1,leaseUntil:f.lease,policySha256:appleDigest(policy),scopeSha256:H,authorizationId:randomUUID(),evidenceSha256:H,observedAt:new Date().toISOString(),validUntil:f.lease},
   coverage:{coveredAuthGraphSha256:H,storage:"verified_clear",sharedEngine:"verified_preserved",relatedOwnerReferences:"approved_preserved"}};
  assert.equal((await rpc("wd_apple_deletion_command","auth_begin",{...target,fenceHash:f.fenceHash,scope})).fresh,true);
  const saved=await rpc("wd_apple_deletion_command","auth_original",target);assert.equal(saved.scopeProfile,policy.version);assert.equal(saved.scopeAccountRevision,2);
  const scopeBytes=(await admin("select md5(scope::text) h from wd_apple_private.auth_attempts where operation_id=$1",[target.operationId])).rows[0].h;return{target,op,saved,scopeBytes,capability,intentSha256,advance};
 }

 type Original=Awaited<ReturnType<typeof prepare>>;
 function port(f:Original,options:{lostGet?:boolean;lostRecord?:boolean;lostClaim?:boolean;lostProof?:boolean;lostComplete?:boolean;drift?:string;materialMissing?:boolean}={}){
  let deletes=0,gets=0,records=0;const actions:string[]=[];
  const transport:typeof fetch=async(input,init)=>{
   const url=new URL(String(input));assert.equal(url.origin,ORIGIN);
   if(url.pathname==="/auth/v1/admin/users/"+A){
    assert.equal(init?.body,undefined);if(init?.method==="DELETE"){deletes++;assert.equal(deletes,1,"test setup may execute only the ONE original synthetic effect");await admin("delete from auth.users where id=$1",[A]);throw Error("synthetic original DELETE effect ACK lost");}
    assert.equal(init?.method,"GET");gets++;if(options.lostGet)throw Error("synthetic GET lost");if(options.drift)await admin(options.drift);
    const present=await admin("select id from auth.users where id=$1",[A]);return present.rows.length?Response.json({id:A}):Response.json({code:"user_not_found"},{status:404});
   }
   const name=url.pathname.split("/").at(-1)!,body=JSON.parse(String(init?.body));assert.match(name,/^wd_[a-z0-9_]+$/);
   if(name==="wd_current_original_status_material"){
    actions.push("material");if(options.materialMissing)return Response.json({outcome:"held"});await role();return Response.json((await db.query<{r:AppleData}>("select public.wd_current_original_status_material($1::jsonb)r",[JSON.stringify(body.p_body)])).rows[0].r);
   }
   assert.ok(["wd_apple_deletion_command","wd_deletion_v2_worker_command"].includes(name));const action=body.p_action;actions.push(action);
   assert.ok(["status","claim","proof","complete","release","auth_fence","auth_original","auth_record"].includes(action),"no auth_begin/receipt-clear/newscope/Apple effect");
   if(name==="wd_apple_deletion_command"&&action==="auth_record")records++;
   const response=await rpc(name,action,body.p_body);
   if(options.lostRecord&&action==="auth_record"||options.lostClaim&&action==="claim"||options.lostProof&&action==="proof"||options.lostComplete&&action==="complete")throw Error("synthetic original journal ACK lost");
   return Response.json(response);
  };
  const service=createCurrentOriginalStatusHandler({origin:ORIGIN,serverCredential:"synthetic-private-test-only",request:transport,now:Date.now,timeoutMs:3000});
  const forbidden=async():Promise<never>=>{assert.fail("no Apple effect");};
  const request=(capability=f.capability,intentSha256=f.intentSha256,extra:Record<string,unknown>={})=>new Request(HOST+"/api/v1/account/deletion-v2",{method:"POST",headers:{"content-type":"application/json",authorization:"Deletion-Recovery "+capability},body:JSON.stringify({contract:"wd-account-deletion-v2",operation:"status",operationId:f.op,intentSha256,...extra})});
  const send=(r=request())=>withCurrentIntegrationHostResolver({resolve:()=>({hostOrigin:HOST,flags:{deletion:true},lifecycle:{create:()=>({deletion:service,custody:forbidden})}})},()=>POST(r));
  return{transport,send,request,actions,counts:()=>({deletes,gets,records})};
 }
 async function priorLostEffect(f:Original,p:ReturnType<typeof port>){await assert.rejects(p.transport(ORIGIN+"/auth/v1/admin/users/"+A,{method:"DELETE"}));await rpc("wd_deletion_v2_worker_command","release",f.advance);}
 await t.test("ONE actual fake DELETE loses ACK; status without JWT/current keys/policy/manifest GET-recovers and preserves immutable original",()=>trial(async()=>{
  const f=await prepare(),p=port(f);await priorLostEffect(f,p);const beforeScope=f.scopeBytes;
  const response=await p.send();assert.equal(response.status,200);const text=await response.text(),receipt=JSON.parse(text).result;assert.equal(receipt.authDeletion,"confirmed");assert.equal(receipt.intentState,"settled");assert.equal(receipt.appleRevocation,"not_required");assert.deepEqual(p.counts(),{deletes:1,gets:1,records:1});
  assert.doesNotMatch(text,/scopeHash|identityHash|recoveryHash|policySha256|serverCredential|userId/);
  const stored=await admin("select md5(scope::text) h from wd_apple_private.auth_attempts where operation_id=$1",[f.target.operationId]);assert.equal(stored.rows[0].h,beforeScope);
  assert.equal((await(await p.send()).json()).result.authDeletion,"confirmed");assert.deepEqual(p.counts(),{deletes:1,gets:1,records:1});
 }));
 await t.test("present Auth user remains unknown and never DELETEs or records",()=>trial(async()=>{const f=await prepare(),p=port(f);await rpc("wd_deletion_v2_worker_command","release",f.advance);const response=await p.send();assert.equal(response.status,200);assert.equal((await response.json()).result.authDeletion,"unknown");assert.deepEqual(p.counts(),{deletes:0,gets:1,records:0});}));
 for(const mode of ["lostGet","lostRecord","lostClaim","lostProof","lostComplete","materialMissing"] as const)await t.test("lost/missing recovery boundary preserves durable original and no blind replay: "+mode,()=>trial(async()=>{
  const f=await prepare(),p=port(f,{[mode]:true});await priorLostEffect(f,p);const initial=await rpc("wd_deletion_v2_worker_command","status",{operationId:f.op,intentSha256:f.intentSha256,recoveryHash:deletionRecoveryHash(f.op,f.capability)});
  const response=await p.send();assert.equal(response.status,200);assert.deepEqual((await response.json()).result,initial);assert.equal(p.counts().deletes,1);assert.ok(p.counts().gets<=1);assert.ok(p.counts().records<=1);
 }));
 for(const [name,sql]of Object.entries({lease:"update public.wd_deletion_work set lease_until=now()-interval '1 second'",owner:"update public.wd_deletion_work set owner=gen_random_uuid()",attempt:"update public.wd_deletion_work set attempt=attempt+1",intent:"update wd_deletion_v2_private.intents set intent_hash=repeat('b',64)",policy:"update wd_deletion_v2_private.intents set policy_hash=repeat('b',64)"}))await t.test("GET await drift remains unknown without auth_record: "+name,()=>trial(async()=>{const f=await prepare(),p=port(f,{drift:sql});await priorLostEffect(f,p);const response=await p.send();assert.equal(response.status,200);assert.equal((await response.json()).result.authDeletion,"unknown");assert.equal(p.counts().deletes,1);assert.equal(p.counts().records,0);}));
 await t.test("lost auth_record ACK then explicit public status reads durable confirmation, never repeats GET/DELETE/record",()=>trial(async()=>{
  const f=await prepare(),p=port(f,{lostRecord:true});await priorLostEffect(f,p);assert.equal((await(await p.send()).json()).result.authDeletion,"unknown");assert.deepEqual(p.counts(),{deletes:1,gets:1,records:1});
  assert.equal((await(await p.send()).json()).result.authDeletion,"confirmed");assert.deepEqual(p.counts(),{deletes:1,gets:1,records:1});assert.equal((await admin("select md5(scope::text) h from wd_apple_private.auth_attempts where operation_id=$1",[f.target.operationId])).rows[0].h,f.scopeBytes);
 }));
 await t.test("lost claim ACK cannot trigger a blind second claim/provider effect while lease is owned",()=>trial(async()=>{
  const f=await prepare(),p=port(f,{lostClaim:true});await priorLostEffect(f,p);assert.equal((await(await p.send()).json()).result.authDeletion,"unknown");assert.equal((await(await p.send()).json()).result.authDeletion,"unknown");assert.deepEqual(p.counts(),{deletes:1,gets:0,records:0});
 }));
 await t.test("bad capability/foreign intent/body owner cannot reach material/claim/GET",()=>trial(async()=>{const f=await prepare(),p=port(f);for(const r of [p.request(randomBytes(32).toString("base64url")),p.request(f.capability,"b".repeat(64)),p.request(f.capability,f.intentSha256,{userId:B})])assert.equal((await p.send(r)).status,409);assert.equal(p.actions.includes("material"),false);assert.deepEqual(p.counts(),{deletes:0,gets:0,records:0});}));
 await t.test("strict/missing/tampered stored original profile remains unknown without GET",()=>trial(async()=>{const f=await prepare(),p=port(f);await priorLostEffect(f,p);await admin("update wd_apple_private.auth_attempts set scope=scope-'profile' where operation_id=$1",[f.target.operationId]);const r=await p.send();assert.equal(r.status,200);assert.equal((await r.json()).result.authDeletion,"unknown");assert.equal(p.counts().gets,0);}));
 await t.test("service-only material RPC and private tables deny anon/authenticated; empty read cannot grant",()=>trial(async()=>{
  const f=await prepare();for(const principal of ["anon","authenticated"]){await role(principal);await db.exec("savepoint denied");await assert.rejects(db.query("select public.wd_current_original_status_material($1::jsonb)",[JSON.stringify({operationId:f.op,intentSha256:f.intentSha256,recoveryHash:deletionRecoveryHash(f.op,f.capability)})]));await db.exec("rollback to savepoint denied;release savepoint denied");await db.exec("savepoint denied");await assert.rejects(db.query("select * from wd_apple_private.auth_attempts"));await db.exec("rollback to savepoint denied;release savepoint denied");}
  await role();const r=(await db.query<{r:unknown}>("select public.wd_current_original_status_material($1::jsonb)r",[JSON.stringify({operationId:f.op,intentSha256:f.intentSha256,recoveryHash:H})])).rows[0].r;assert.deepEqual(r,{outcome:"held"});
 }));
 }finally{await db.close();}
});
// PGlite serializes this real local SQL component. No two-connection PostgreSQL,
// hosted permission, provider identity-CAS or full lifecycle activation proof.
