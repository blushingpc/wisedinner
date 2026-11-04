
import {readFile,writeFile} from "node:fs/promises";
import {dirname,join,resolve,basename} from "node:path";
import {CURRENT_SPARSE_CATALOG_METADATA} from "./current-sparse-catalog-profile.server.ts";
import type {ScopeObservationRequest} from "./current-auth-scope.server.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {generateKeyPairSync,randomBytes,randomUUID} from "node:crypto";
import {withCurrentIntegrationPrivateConfiguration,resolveCurrentIntegrationLifecycleConfiguration,type CurrentIntegrationPrivateConfiguration} from "./current-integration-configuration.server.ts";
import {resolveCurrentIntegrationProductionConfiguration,withCurrentIntegrationHostResolver} from "./current-integration-host.server.ts";
import {POST as deletionPOST} from "../app/api/v1/account/deletion-v2/route.ts";
import {POST as applePOST} from "../app/api/v1/account/apple-credential/route.ts";
import {UUID_DELETE_PROFILE} from "./current-uuid-auth-scope.server.ts";
import {CURRENT_AUTH_SCOPE} from "./current-auth-scope.server.ts";
import {CURRENT_SPARSE_CATALOG_PROFILE,CURRENT_SPARSE_CATALOG_IDENTITY} from "./current-sparse-catalog-profile.server.ts";
import {appleDigest} from "./apple-token-custody.server.ts";
import {deletionIntentHash,deletionRecoveryHash} from "./account-deletion-v2.server.ts";
const HOST="https://host.synthetic.invalid",TARGET="https://zpvqxtklvjitofpbddrn.supabase.co",A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",H="a".repeat(64),NOW=Date.parse("2026-11-01T12:00:00Z");
// Explicit SYNTHETIC policy/material/transport only. Never a live admission.
const deletionPolicy={approved:true as const,version:UUID_DELETE_PROFILE,preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
const applePolicy={approved:true as const,version:"synthetic-only",credentialSeconds:600,recoverySeconds:600,evidenceSeconds:3600,retainedEvidence:["apple_credential_recovery"]};
function jwt(role:string,owner=A){return[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({role,ref:"zpvqxtklvjitofpbddrn",exp:Math.floor(NOW/1000)+86400,sub:owner,iss:TARGET+"/auth/v1",aud:"authenticated",auth_time:Math.floor(NOW/1000)})).toString("base64url"),Buffer.alloc(32,1).toString("base64url")].join(".");}
function fixture(owner=A){
 const pair=generateKeyPairSync("ec",{namedCurve:"prime256v1"}),calls:string[]=[],admitted:string[]=[];let clock=NOW,lost=false;
 const env={WD_CURRENT_INTEGRATION_HOST_ORIGIN:HOST,SUPABASE_URL:TARGET,SUPABASE_ANON_KEY:jwt("anon"),SUPABASE_SERVICE_ROLE_KEY:jwt("service_role"),
 WD_CURRENT_UUID_LIFECYCLE_ENABLED:"true",APPLE_SIGNIN_CLIENT_ID:"com.wisedinner.app",APPLE_SIGNIN_TEAM_ID:"TESTTEAM01",APPLE_SIGNIN_KEY_ID:"TESTKEY001",APPLE_SIGNIN_PRIVATE_KEY:pair.privateKey.export({type:"pkcs8",format:"pem"}).toString(),
 WD_CURRENT_LIFECYCLE_MATERIAL_JSON:JSON.stringify({profile:UUID_DELETE_PROFILE,profilePolicyVersion:UUID_DELETE_PROFILE,secretSeconds:60,keyVersion:"test",keyring:{test:randomBytes(32).toString("base64")},applePolicy,deletionPolicy,validUntil:new Date(NOW+600000).toISOString()})};
 const transport:typeof fetch=async(input,init)=>{
  const url=new URL(String(input));assert.equal(url.origin,TARGET,"no external providers");assert.notEqual(init?.method,"DELETE");calls.push(url.pathname);
  if(url.pathname==="/auth/v1/user")return Response.json({id:owner,is_anonymous:false,email_confirmed_at:"2026-10-01T00:00:00Z",identities:[{provider:"email"}]});
  const body=JSON.parse(String(init?.body));
  if(url.pathname.endsWith("wd_deletion_v2_worker_command")){
   assert.equal(body.p_action,"status");if(lost)throw Error("synthetic lost status ACK");
   return Response.json({contract:"wd-account-deletion-v2",operationId:body.p_body.operationId,intentSha256:body.p_body.intentSha256,receiptRevision:1,intentState:"unknown",applicationData:"unknown",authDeletion:"unknown",appleRevocation:"unknown",manualAppleRemoval:"recommended",subscriptionCancelled:false,clientDisposition:"reauthentication_available",retainedEvidence:["deletion_receipt"],nextAction:"original_status_required"});
  }
  throw Error("unexpected mutation or inventory "+url.pathname);
 };
 const ports:CurrentIntegrationPrivateConfiguration={async forOwner(account){admitted.push(account.id);return {template:{deletionPolicy,custodyPolicy:applePolicy,expectedCatalogSha256:H,expectedEngineSha256:H,writerManifestSha256:H,writerCatalogSha256:H,validUntil:new Date(NOW+600000).toISOString(),maxObservationAgeMs:3000,selectors:[{reference:"accountTombstone",projection:CURRENT_AUTH_SCOPE+"/accountTombstone",userId:account.id,identityHash:H,policySha256:appleDigest(deletionPolicy),maxCount:1,async select(){return null;}}]},retention:{schemaSha256:H,eraserSha256:H,maxRecords:128,freshnessMs:3000,clockSkewMs:0,async readAdmission(){return{outcome:"held"};}},observer:{profile:CURRENT_SPARSE_CATALOG_PROFILE,catalogIdentity:CURRENT_SPARSE_CATALOG_IDENTITY}};}};
 const operationId=randomUUID(),cap=randomBytes(32).toString("base64url"),intent=deletionIntentHash(owner,operationId,1,deletionRecoveryHash(operationId,cap),appleDigest(deletionPolicy));
 function request(status=false,headers:Record<string,string>={},suffix=""){
  return new Request(HOST+"/api/v1/account/deletion-v2"+suffix,{method:"POST",headers:{"content-type":"application/json",authorization:status?"Deletion-Recovery "+cap:"Bearer "+jwt("authenticated",owner),"x-wd-deletion-recovery":cap,"x-wd-deletion-intent-sha256":intent,...headers},body:JSON.stringify(status?{contract:"wd-account-deletion-v2",operation:"status",operationId,intentSha256:intent}:{contract:"wd-account-deletion-v2",operation:"prepare",operationId,expectedAccountRevision:1})});
 }
 async function send(r:Request,privateConfig:CurrentIntegrationPrivateConfiguration|null=ports,config:unknown=env){const work=()=>withCurrentIntegrationHostResolver({resolve:()=>resolveCurrentIntegrationProductionConfiguration(config,r,"deletion",transport,()=>clock)},()=>deletionPOST(r));return privateConfig?withCurrentIntegrationPrivateConfiguration(privateConfig,work):work();}
 return{env,calls,admitted,ports,request,transport,send,expired:()=>{clock=NOW+600001;},lose:()=>{lost=true;}};
}
test("private loader defaults/malformed material never contact transport or infer grants",async()=>{
 const f=fixture();for(const c of [{},{...f.env,WD_CURRENT_UUID_LIFECYCLE_ENABLED:"false"},{...f.env,WD_CURRENT_LIFECYCLE_MATERIAL_JSON:"{}"},{...f.env,APPLE_SIGNIN_PRIVATE_KEY:"invalid"}])assert.equal((await f.send(f.request(),f.ports,c)).status,503);
 assert.deepEqual(f.calls,[]);assert.deepEqual(f.admitted,[]);
});
test("actual POST composes UUID adapter with request-time material; independent retention hold causes zero mutations",async()=>{
 const f=fixture();assert.equal((await f.send(f.request())).status,503);assert.deepEqual(f.admitted,[A]);assert.ok(f.calls.every(x=>x==="/auth/v1/user"));
});
test("missing producer remains closed, configuration material cannot self-admit",async()=>{
 const f=fixture();assert.equal((await f.send(f.request(),null)).status,503);assert.equal(f.calls.some(x=>x.includes("rpc")),false);
});
test("query/lifecycle/invalid and mismatched content-length reject before owner, cleanup or provider",async()=>{
 const f=fixture();for(const r of [f.request(false,{},"?bad=1"),f.request(false,{"x-wd-deletion-lifecycle":"future"}),f.request(false,{"content-length":"x"}),f.request(false,{"content-length":"1"}),f.request(false,{"content-encoding":"gzip"})])assert.equal((await f.send(r)).status,503);
 assert.deepEqual(f.calls,[]);assert.deepEqual(f.admitted,[]);
});
test("sparse catalogue identity and foreign owner selectors cannot authorize new effects",async()=>{
 const f=fixture();for(const mode of ["catalog","owner"]){const p:CurrentIntegrationPrivateConfiguration={async forOwner(a){const i=await f.ports.forOwner(a);assert.ok(i);return mode==="catalog"?{...i,observer:{profile:CURRENT_SPARSE_CATALOG_PROFILE,catalogIdentity:H as typeof CURRENT_SPARSE_CATALOG_IDENTITY}}:{...i,template:{...i.template,selectors:i.template.selectors.map(s=>({...s,userId:B}))}};}};assert.equal((await f.send(f.request(),p)).status,503);}
 assert.ok(f.calls.every(x=>x==="/auth/v1/user"));
});
test("status recovery uses actual original repository with no JWT or current template; lost ACK never causes mutation",async()=>{
 const f=fixture(),forbid:CurrentIntegrationPrivateConfiguration={async forOwner(){assert.fail("status must not request new owner admission");}};
 let r=await f.send(f.request(true),forbid);assert.equal(r.status,200);const original=await r.text();assert.equal(JSON.parse(original).result.authDeletion,"unknown");
 f.lose();r=await f.send(f.request(true),forbid);assert.equal(r.status,409);assert.equal((await r.json()).result.retryAuthorized,false);
 assert.deepEqual(f.calls,["/rest/v1/rpc/wd_deletion_v2_worker_command","/rest/v1/rpc/wd_deletion_v2_worker_command"]);
});
test("concurrent A/B/A private producers remain request-local, no shared owner admission",async()=>{
 const a=fixture(A),b=fixture(B);await Promise.all([a.send(a.request()),b.send(b.request())]);await a.send(a.request());assert.deepEqual(a.admitted,[A,A]);assert.deepEqual(b.admitted,[B]);
});
test("expired material and hostile configuration/receiver metadata do not execute getters",async()=>{
 const f=fixture();f.expired();assert.equal((await f.send(f.request())).status,503);assert.deepEqual(f.calls,[]);
 let effects=0;const hostile=Object.defineProperty({},"forOwner",{get(){effects++;throw Error();}});assert.throws(()=>withCurrentIntegrationPrivateConfiguration(hostile as never,()=>{}));
 const proxy=new Proxy(f.ports,{getPrototypeOf(){effects++;throw Error();}});assert.throws(()=>withCurrentIntegrationPrivateConfiguration(proxy,()=>{}));
 const getter=Object.defineProperty({...f.env},"APPLE_SIGNIN_PRIVATE_KEY",{get(){effects++;throw Error();}});assert.equal(await resolveCurrentIntegrationLifecycleConfiguration(getter,f.request(),f.transport,()=>NOW),undefined);assert.equal(effects,0);
});
test("actual Apple POST missing material stays original closed envelope without provider effects",async()=>{
 const f=fixture(),r=new Request(HOST+"/api/v1/account/apple-credential",{method:"POST",headers:{"content-type":"application/json"},body:"{}"});
 const response=await withCurrentIntegrationHostResolver({resolve:()=>resolveCurrentIntegrationProductionConfiguration({},r,"appleCredential",f.transport,()=>NOW)},()=>applePOST(r));assert.equal(response.status,503);assert.equal((await response.json()).result.providerEffect,"none");assert.deepEqual(f.calls,[]);
});


test("same-original status survives missing current key, policy and expired material without new proof",async()=>{
 const f=fixture();const config={...f.env,APPLE_SIGNIN_PRIVATE_KEY:undefined,WD_CURRENT_LIFECYCLE_MATERIAL_JSON:undefined};f.expired();
 const r=await f.send(f.request(true),null,config);assert.equal(r.status,200);assert.equal((await r.json()).result.authDeletion,"unknown");assert.deepEqual(f.admitted,[]);assert.deepEqual(f.calls,["/rest/v1/rpc/wd_deletion_v2_worker_command"]);
});


test("maintained POST status and named sparse SQL transport against the actual recorded schema; serialized synthetic local fixture only",async()=>{
 const receiptPath=process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;assert.ok(receiptPath,"genuine exclusive slot required before PGlite");
 const slot=JSON.parse(await readFile(receiptPath,"utf8"));assert.equal(slot.taskId,"backend-private-host-v208");assert.equal(slot.actualTaskId,"backend-private-host-finish-v234");assert.ok(basename(receiptPath!).endsWith("-slot.json"));assert.equal(slot.actualExecutorThreadId,"01a192ed-0c8f-7411-a5b6-f40ea6104f07");assert.equal(resolve(slot.workspace),resolve(process.cwd()));assert.ok(Date.parse(slot.validUntil)>Date.now());
 const {PGlite}=await import("@electric-sql/pglite");
 type Data=Record<string,unknown>;
 const policy=deletionPolicy,custody=applePolicy,recoveryCapability=randomBytes(32).toString("base64url");
 const db=await PGlite.create();
 try {
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
 create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
 create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
 create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
 create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
 create table auth.users(id uuid primary key);
 create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
 grant select on auth.users,auth.identities to service_role;
 create schema storage;grant usage on schema storage to service_role;
 create table storage.buckets(id text primary key,owner uuid,owner_id text);
 create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
 create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
 create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
 grant select on all tables in schema storage to service_role;`);
 const { readdir }=await import("node:fs/promises");
 const directory=new URL("../supabase/migrations/",import.meta.url);
 const names=(await readdir(directory)).filter(n=>/^00\d\d_.*\.sql$/.test(n));
 const apply=async(n:number)=>{const f=names.find(f=>Number(f.slice(0,4))===n);assert.ok(f);await db.exec(await readFile(new URL(f,directory),"utf8"));};
 for(const n of [1,2,3,4,5,6,7,13,14,18,19,20])await apply(n);
 // Exact observed default-result table ACLs only, no invented subsystem.
 const relations=CURRENT_SPARSE_CATALOG_METADATA.relations;
 assert.ok(relations&&typeof relations==="object"&&!Array.isArray(relations));
 for(const name of Object.keys(relations)) await db.exec("grant all on public."+name+" to anon,authenticated,service_role");
 // Independently observed176 view default ACL, not an empty-ACL substitute.
 await db.exec("grant all on public.store_prices to anon,authenticated,service_role");
 for(const name of CURRENT_SPARSE_CATALOG_METADATA.absentRelations)assert.equal((await db.query<{r:string|null}>("select to_regclass($1) r",["public."+name])).rows[0].r,null);
 // Check source function baseline before forward wrappers move/replace names.
 const baseline=await db.query("select proname,encode(sha256(convert_to(prosrc,'UTF8')),'hex') sha from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and left(proname,3)='wd_' order by proname");
 await writeFile(join(dirname(receiptPath!),"source-baseline-functions.json"),JSON.stringify(baseline.rows,null,2));
 const captured=CURRENT_SPARSE_CATALOG_METADATA.baselineFunctions;
 assert.ok(Array.isArray(captured));assert.equal(baseline.rows.length,captured.length);
 for(const row of baseline.rows as {proname:string;sha:string}[]){
  const record: {name:string;metadata:{source_sha256:string}}|undefined=captured.find((v:{name:string})=>v.name===row.proname);
  assert.ok(record);assert.equal(row.sha,record.metadata.source_sha256,"actual maintained baseline matches160 before forward replacements");
 }
 for(let n=21;n<=29;n++)await apply(n);
 // Secure rendering projection from maintained DDL, before any target/observer.
 await db.exec("set search_path=pg_catalog,pg_temp");
 const qualifiedLegacy=await db.query("SELECT 'relation' AS kind,c.relname AS name,jsonb_build_object('owner',pg_get_userbyid(c.relowner),'kind',c.relkind,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,'columns',(SELECT jsonb_agg(jsonb_build_array(a.attname,pg_catalog.format_type(a.atttypid,a.atttypmod),a.attnotnull)ORDER BY a.attnum)FROM pg_catalog.pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),'nonowner_grants',(SELECT coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),x.privilege_type,x.is_grantable)ORDER BY coalesce(r.rolname,'PUBLIC'),x.privilege_type),'[]')FROM aclexplode(coalesce(c.relacl,acldefault('r',c.relowner)))x LEFT JOIN pg_roles r ON r.oid=x.grantee WHERE x.grantee<>c.relowner),'column_acl',(SELECT coalesce(jsonb_agg(jsonb_build_array(a.attname,a.attacl::text)ORDER BY a.attnum),'[]')FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND a.attacl IS NOT NULL),'policies',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',p.polname,'command',p.polcmd,'permissive',p.polpermissive,'roles',(SELECT array_agg(coalesce(r.rolname,'PUBLIC')ORDER BY coalesce(r.rolname,'PUBLIC'))FROM unnest(p.polroles)x LEFT JOIN pg_roles r ON r.oid=x),'qual_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polqual,p.polrelid),''),'UTF8')),'hex'),'check_sha256',encode(sha256(convert_to(coalesce(pg_get_expr(p.polwithcheck,p.polrelid),''),'UTF8')),'hex'))ORDER BY p.polname),'[]')FROM pg_policy p WHERE p.polrelid=c.oid),'constraints',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',x.conname,'type',x.contype,'source_sha256',encode(sha256(convert_to(pg_get_constraintdef(x.oid,true),'UTF8')),'hex'))ORDER BY x.conname),'[]')FROM pg_constraint x WHERE x.conrelid=c.oid AND x.contype<>'n'),'triggers',(SELECT coalesce(jsonb_agg(jsonb_build_object('name',t.tgname,'function_schema',pn.nspname,'function',p.proname,'enabled',t.tgenabled,'source_md5',md5(p.prosrc))ORDER BY t.tgname),'[]')FROM pg_trigger t JOIN pg_proc p ON p.oid=t.tgfoid JOIN pg_namespace pn ON pn.oid=p.pronamespace WHERE t.tgrelid=c.oid AND NOT t.tgisinternal))AS metadata FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relname IN ('best_prices','delivery_quotes','receipts','shared_weeks','support_messages','support_messages_v2','support_threads','waitlist','wd_ops_alerts','wd_ops_checks','wd_proposal_plan_documents','wd_proposal_plan_policy','wd_proposal_plan_receipts','wd_proposal_plan_replay','wd_push_projects','wd_support_sends','wd_support_work') ORDER BY c.relname");
 await writeFile(join(dirname(receiptPath!),"source-qualified-legacy.json"),JSON.stringify(qualifiedLegacy.rows,null,2));
 await db.exec("set search_path=public");
 const beforeForward=await db.query("select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) signature,p.proowner::regrole::text owner,p.prosecdef definer,p.proconfig config,(select coalesce(jsonb_agg(jsonb_build_array(coalesce(r.rolname,'PUBLIC'),x.privilege_type,x.is_grantable) order by coalesce(r.rolname,'PUBLIC'),x.privilege_type),'[]') from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x left join pg_roles r on r.oid=x.grantee where x.grantee<>p.proowner) grants,encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') sha from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','wd_current_private','wd_deletion_v2_private','wd_apple_private') order by n.nspname,p.proname");
 await writeFile(join(dirname(receiptPath!),"source-forward-functions.json"),JSON.stringify(beforeForward.rows,null,2));
 await apply(30);
 async function admin(sql:string,args:unknown[]=[]){
  if(/^rollback\b/i.test(sql)){await db.exec(sql);await db.exec("reset role");return {rows:[] as Data[]};}
  await db.exec("reset role");
  if(sql.includes(";")&&args.length===0){await db.exec(sql);return {rows:[] as Data[]};}
  return db.query<Data>(sql,args);
 }
 async function principal(role="service_role",id=A){await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:id,is_anonymous:false,amr:[{method:"password",timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec("set role "+role);}
 async function rpc(name:string,action:string,body:unknown,role="service_role"){await principal(role);return(await db.query<{r:Data}>("select public."+name+"($1,$2::jsonb) r",[action,JSON.stringify(body)])).rows[0].r;}
 async function observe(q:ScopeObservationRequest,name="wd_current_sparse_auth_scope_observe"){await principal();return(await db.query<{r:Data}>("select public."+name+"($1::jsonb) r",[JSON.stringify(q)])).rows[0].r;}
 async function prepare(){
  await admin("insert into auth.users values($1),($2)",[A,B]);await admin("insert into public.wd_accounts(user_id)values($1),($2)",[A,B]);
  const operationId=randomUUID(),owner=randomUUID(),basis=await rpc("wd_apple_deletion_command","effective_basis",{userId:A});
  const original={userId:A,operationId,recoveryHash:deletionRecoveryHash(operationId,recoveryCapability),expectedAccountRevision:1,identityHash:H,identityEvidence:H,appleLinkage:"none",policy,policyHash:appleDigest(policy),intentSha256:H};
  assert.equal((await rpc("wd_apple_deletion_command","admit_original",{original,basis:{userId:A,currentIdentityHash:H,identityEvidence:H,actualApple:"none",effectiveApple:"none",inventoryRevision:basis.revision,inventoryHash:basis.inventoryHash}})).outcome,"admitted");
  assert.equal((await rpc("wd_deletion_v2_account_command","confirm",{operationId,recoveryHash:deletionRecoveryHash(operationId,recoveryCapability),expectedAccountRevision:1,intentSha256:H,confirmation:"DELETE MY ACCOUNT"},"authenticated")).intentState,"confirmed");
  const cmd={operationId,intentSha256:H,owner},work=(await rpc("wd_deletion_v2_worker_command","claim",cmd)).work as Data;
  assert.equal(work.owner,owner);assert.equal(work.attempt,1);
  await rpc("wd_deletion_v2_worker_command","cleanup",{...cmd,attempt:work.attempt});
  await rpc("wd_deletion_v2_worker_command","apple_unavailable",{...cmd,attempt:work.attempt});
  await rpc("wd_deletion_v2_worker_command","begin",{...cmd,attempt:work.attempt,dependency:"auth"});
  const binding={userId:A,identityHash:H,authOperationId:work.auth_operation as string,deletionOperationId:operationId,intentSha256:H,workOwner:owner,workAttempt:work.attempt as number,leaseUntil:work.lease_until as string};
  await principal();const clear=(await db.query<{r:Data}>("select public.wd_current_ephemeral_deletion_receipt_cleanup($1::jsonb)r",[JSON.stringify({...binding,accountRevision:2,policySha256:appleDigest(policy),policy})])).rows[0].r;
  assert.equal(clear.outcome,"cleared");assert.equal(clear.removed,1);
  return {binding,policySha256:appleDigest(policy),authorizationId:randomUUID(),scopeSha256:H,custodyPolicy:custody,custodyPolicySha256:appleDigest(custody)} as ScopeObservationRequest;
 }

 await admin("begin");const q=await prepare();
 const facts=await observe(q);assert.equal(facts.contract,CURRENT_AUTH_SCOPE);assert.equal(facts.writeFence,null);
 const denial=await observe(q,"wd_current_sparse_local_deletion_barrier");assert.equal(denial.writeFence,null);assert.equal(denial.profile,UUID_DELETE_PROFILE);
 assert.deepEqual(await observe(q,"wd_current_auth_scope_observe"),{outcome:"held"},"strict default is not relaxed");
 const f=fixture(),calls:string[]=[];
 const sqlTransport:typeof fetch=async(input,init)=>{const url=new URL(String(input));assert.equal(url.origin,TARGET);assert.notEqual(init?.method,"DELETE");const b=JSON.parse(String(init?.body));calls.push(url.pathname+":"+b.p_action);if(url.pathname==="/rest/v1/rpc/wd_current_original_status_material")return Response.json({outcome:"held"});assert.equal(url.pathname,"/rest/v1/rpc/wd_deletion_v2_worker_command");assert.equal(b.p_action,"status");return Response.json(await rpc("wd_deletion_v2_worker_command","status",b.p_body));};
 const body={contract:"wd-account-deletion-v2",operation:"status",operationId:q.binding.deletionOperationId,intentSha256:q.binding.intentSha256};
 const r=new Request(HOST+"/api/v1/account/deletion-v2",{method:"POST",headers:{"content-type":"application/json",authorization:"Deletion-Recovery "+recoveryCapability},body:JSON.stringify(body)});
 const env={...f.env,WD_CURRENT_LIFECYCLE_MATERIAL_JSON:undefined,APPLE_SIGNIN_PRIVATE_KEY:undefined};
 const response=await withCurrentIntegrationHostResolver({resolve:()=>resolveCurrentIntegrationProductionConfiguration(env,r,"deletion",sqlTransport,Date.now)},()=>deletionPOST(r));
 assert.equal(response.status,200);const result=await response.json();assert.equal(result.operationId,body.operationId);assert.equal(result.result.authDeletion,"unknown");
 assert.deepEqual(calls,["/rest/v1/rpc/wd_deletion_v2_worker_command:status","/rest/v1/rpc/wd_current_original_status_material:undefined"],"legacy synthetic package lacks current recovery material; retain durable unknown");assert.equal((await admin("select count(*)::int n from auth.users")).rows[0].n,2);
 // Separate clean transaction for a genuine prepare via the maintained POST.
 // Synthetic independently approved operator policy/schema only. No final UUID
 // proof is invented, and prepare must not issue a scope or contact providers.
 await admin("rollback");await admin("begin");await admin("insert into auth.users values($1)",[B]);await admin("insert into public.wd_accounts(user_id)values($1)",[B]);
 const meta=(await admin("select wd_apple_private.current_retention_schema() m")).rows[0].m as {schemaSha256:string;eraserSha256:string};
 const b=fixture(B),effects:string[]=[];
 const prepareTransport:typeof fetch=async(input,init)=>{
  const u=new URL(String(input));assert.equal(u.origin,TARGET);assert.notEqual(init?.method,"DELETE");effects.push(u.pathname);
  if(u.pathname==="/auth/v1/user")return Response.json({id:B,is_anonymous:false,email_confirmed_at:"2026-10-01T00:00:00Z",identities:[{provider:"email"}]});
  if(u.pathname==="/auth/v1/admin/users/"+B){assert.equal(init?.method,"GET");assert.equal((await admin("select id from auth.users where id=$1",[B])).rows.length,1);return Response.json({id:B,is_anonymous:false,created_at:"2026-10-01T00:00:00Z",identities:[{identity_id:B,user_id:B,provider:"email",id:"fixture-"+B,created_at:"2026-10-01T00:00:00Z"}]});}
  const name=u.pathname.split("/").at(-1)!;assert.match(name,/^wd_[a-z0-9_]+$/);const command=JSON.parse(String(init?.body));
  assert.equal(name.includes("scope_observe"),false);assert.equal(name.includes("local_deletion_barrier"),false);assert.notEqual(name,"wd_current_credential_expiry_command","no due erasures in this prepare fixture");
  if(name==="wd_deletion_v2_account_command"){await principal("authenticated",B);return Response.json((await db.query<{r:Data}>("select public.wd_deletion_v2_account_command($1,$2::jsonb) r",[command.p_action,JSON.stringify(command.p_body)])).rows[0].r);}
  return Response.json(await rpc(name,command.p_action,command.p_body));
 };
 const privateConfig:CurrentIntegrationPrivateConfiguration={async forOwner(owner){assert.equal(owner.id,B);const i=await b.ports.forOwner(owner);assert.ok(i);return{...i,retention:{...meta,maxRecords:128,freshnessMs:3000,clockSkewMs:1000,async readAdmission(q){return{outcome:"admitted",registryId:"wd-apple-custody-v1",...meta,policySha256:q.policySha256,custodyPolicySha256:q.custodyPolicySha256,observedAt:Date.now(),validUntil:Date.now()+2000};}}};}};
 const preparedRequest=b.request();const prepared=await withCurrentIntegrationPrivateConfiguration(privateConfig,()=>withCurrentIntegrationHostResolver({resolve:()=>resolveCurrentIntegrationProductionConfiguration(b.env,preparedRequest,"deletion",prepareTransport,Date.now)},()=>deletionPOST(preparedRequest)));
 assert.equal(prepared.status,200);assert.equal((await prepared.json()).result.intentState,"prepared");assert.equal((await admin("select count(*)::int n from auth.users")).rows[0].n,1);
 assert.ok(effects.includes("/rest/v1/rpc/wd_current_retention_inventory_command"));assert.ok(effects.includes("/rest/v1/rpc/wd_deletion_v2_account_command"));

 }finally{await db.close();}
});


test("captured private producer does not inspect Function.bind/name and abort prevents all reads",async()=>{
 const f=fixture();let getters=0;for(const k of ["bind","name"])Object.defineProperty(f.ports.forOwner,k,{get(){getters++;throw Error("hostile metadata");}});
 assert.equal((await f.send(f.request())).status,503);assert.equal(getters,0);assert.deepEqual(f.admitted,[A]);
 const before=f.calls.length,controller=new AbortController();controller.abort();const r=new Request(f.request(),{signal:controller.signal});assert.equal((await f.send(r)).status,503);assert.equal(f.calls.length,before);
});


