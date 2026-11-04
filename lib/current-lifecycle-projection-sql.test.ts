import {checkCurrentLifecycleDeploymentManifest,LIFECYCLE_MANIFEST,LIFECYCLE_PROJECTION} from "./current-lifecycle-deployment-manifest.server.ts";
import {createCurrentLifecycleProjectionRepository,type LifecycleMetadataRequest} from "./current-lifecycle-projection.server.ts";
import {CURRENT_AUTH_SCOPE_REFERENCES} from "./current-auth-scope.server.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { readFile,readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { randomUUID,randomBytes,generateKeyPairSync,createHash } from "node:crypto";
import { appleDigest,type AppleData } from "./apple-token-custody.server.ts";
import { createCurrentContactUuidScopeRpcPorts } from "./current-uuid-scope-rpc.server.ts";
import { CURRENT_CONTACT_CATALOG_PROFILE,CURRENT_CONTACT_CATALOG_METADATA,CURRENT_CONTACT_CATALOG_IDENTITY } from "./current-legacy-contact-catalog-profile.server.ts";
import { CURRENT_AUTH_SCOPE,type ScopeObservationRequest,type CurrentScopeReference } from "./current-auth-scope.server.ts";
import { createCurrentUuidLifecycleHostAdapter,type CurrentUuidLifecycleHostConfiguration } from "./current-uuid-lifecycle-host-admission.server.ts";
import { parseCurrentPrivateLifecycleMaterial } from "./current-private-lifecycle-config.server.ts";
import { supabaseDeletionAuthV2,deletionIntentHash,deletionRecoveryHash } from "./account-deletion-v2.server.ts";
import { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";
import type { CurrentUuidClaimTemplate } from "./current-uuid-claim-scope.server.ts";
const receiptPath=process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;assert.ok(receiptPath,"Actual Main local slot required, never skip");
const slot=JSON.parse(await readFile(receiptPath,"utf8"));assert.equal(slot.contract,"wd-local-source-test-slot-v1");assert.equal(slot.taskId,"backend-private-schema-v208");assert.equal(slot.workerThreadId,"01a14edc-e4d0-7882-9abf-9ccaa2e854b6");assert.equal(resolve(slot.workspace),resolve(process.cwd()));assert.ok(Date.parse(slot.at)<=Date.now()&&Date.parse(slot.validUntil)>Date.now());assert.ok(slot.argv.includes("lib/current-lifecycle-projection-sql.test.ts"));
const {PGlite}=await import("@electric-sql/pglite");
const A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",ORIGIN="https://zpvqxtklvjitofpbddrn.supabase.co";
const policy={approved:true as const,version:UUID_DELETE_PROFILE,preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
const custodyPolicy={approved:true as const,version:"synthetic-only",credentialSeconds:600,recoverySeconds:600,evidenceSeconds:3600,retainedEvidence:["apple_credential_recovery"]};
function freezeFixture<T>(v:T):T{if(v&&typeof v==="object"){Object.values(v).forEach(freezeFixture);Object.freeze(v);}return v;}
const sha=(v:string)=>createHash("sha256").update(v).digest("hex");
test("combined0032+0033: exact accepted source closure with unchanged issuer/contact journeys",async t=>{
 const db=await PGlite.create();try{
const syntheticRoleDDL = `create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create role supabase_auth_admin nologin;
create table auth.users(id uuid primary key,email varchar(255),email_confirmed_at timestamptz,email_change varchar(255),created_at timestamptz,updated_at timestamptz,confirmed_at timestamptz,email_change_confirm_status smallint,deleted_at timestamptz,is_anonymous boolean not null default false);
alter table auth.users owner to supabase_auth_admin;alter table auth.users enable row level security;create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    grant select on auth.users,auth.identities to service_role;
    create schema storage;grant usage on schema storage to service_role;
    create table storage.buckets(id text primary key,owner uuid,owner_id text);
    create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
    grant select on all tables in schema storage to service_role;`;

 await db.exec(syntheticRoleDDL);
 const directory=new URL("../supabase/migrations/",import.meta.url),names=(await readdir(directory)).filter(n=>/^00\d\d_.*\.sql$/.test(n)&&[1,2,3,4,5,6,7,13,14,18,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33].includes(Number(n.slice(0,4)))).sort();assert.equal(names.length,25);
 const ddl=new Map<string,string>();for(const n of names)ddl.set(n,await readFile(new URL(n,directory),"utf8"));
 const sourcePackage=sha(names.map(n=>n+"|"+sha(ddl.get(n)!)).join("\\n"));
 for(const n of names){
 if(n.startsWith("0030_"))await db.exec("grant all on public.waitlist,public.support_messages,public.support_threads,public.support_messages_v2,public.receipts,public.delivery_quotes,public.shared_weeks,public.store_prices to anon,authenticated,service_role");
 await db.exec(ddl.get(n)!);
}
await db.exec(`insert into public.support_threads(id,channel,from_email)select ('20000000-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'form','other-'||n||'@example.invalid' from generate_series(1,10)n;
insert into public.support_messages_v2(thread_id,direction,body)select ('20000000-0000-4000-8000-'||lpad(((n-1)%10+1)::text,12,'0'))::uuid,'in','synthetic' from generate_series(1,24)n;
insert into public.waitlist(email)select 'wait-'||n||'@example.invalid' from generate_series(1,3)n;`);
 const reviewedSourcePackageSha256=sourcePackage,version=(await db.query<{v:string}>("select version() v")).rows[0].v;
  const observerDDL = ddl.get("0031_wd_current_legacy_contact_scope.sql")!;
  const barrierDDL = ddl.get("0031_wd_current_legacy_contact_scope.sql")!;
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
 const observeSql=(q:ScopeObservationRequest,local=false)=>serial(async()=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:"service_role"})]);await db.exec("set role service_role");return(await db.query<{r:unknown}>(`select public.${local?"wd_current_contact_local_deletion_barrier":"wd_current_contact_auth_scope_observe"}($1::jsonb) r`,[JSON.stringify(q)])).rows[0].r;});
 const observe=async(q:ScopeObservationRequest,local=false)=>{
  const ports=createCurrentContactUuidScopeRpcPorts({origin:ORIGIN,serverCredential:credential,expectedRequest:q,now:Date.now,async request(url,init){
   const name=new URL(String(url)).pathname.split("/").at(-1);assert.equal(init?.method,"POST");assert.equal(init?.redirect,"error");
   assert.deepEqual(JSON.parse(String(init?.body)).p_body,q);
   assert.ok(["wd_current_contact_auth_scope_observe","wd_current_contact_local_deletion_barrier"].includes(name!));
   return Response.json(await observeSql(q,name==="wd_current_contact_local_deletion_barrier"));
  }});
  return local?ports.observeLocalDenial(q):ports.observe(q);
 };
 const early=(body:unknown,role="service_role")=>serial(async()=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role})]);await db.exec("set role "+role);return(await db.query<{r:AppleData}>("select public.wd_current_contact_preflight($1::jsonb) r",[JSON.stringify(body)])).rows[0].r;});
 const counts=()=>admin("select (select count(*)::int from public.support_messages_v2) messages,(select count(*)::int from public.support_threads) threads,(select count(*)::int from public.waitlist) waitlist");
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
 await admin("insert into auth.users(id,email,email_confirmed_at,email_change_confirm_status)values($1,'owner-a@example.invalid',now(),0),($2,'owner-b@example.invalid',now(),0)",[A,B]);await admin("insert into public.wd_accounts(user_id)values($1),($2)",[A,B]);
 const identity=await supabaseDeletionAuthV2(ORIGIN,"synthetic",transport).verifyIdentity(A);assert.ok(identity);const H=identity.identityHash;
 const repository={async command(ns:"custody"|"revocation"|"deletion",action:string,body:AppleData){actions.push(ns+":"+action);return rpc({custody:"wd_apple_custody_command",revocation:"wd_apple_revocation_command",deletion:"wd_apple_deletion_command"}[ns],action,body);}};
 const releaseNow=Date.now();
 const domainCount=Number((await admin("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage','wd_current_private','wd_deletion_v2_private','wd_apple_private') and c.relkind in('r','p','v','m','f')")).rows[0].n);
 const m={contract:LIFECYCLE_MANIFEST,releaseId:"synthetic-maintained32",project:"zpvqxtklvjitofpbddrn",origin:ORIGIN,profile:UUID_DELETE_PROFILE,observerProfile:CURRENT_CONTACT_CATALOG_PROFILE,catalogIdentity:CURRENT_CONTACT_CATALOG_IDENTITY,
 sourcePins:{"lib/current-lifecycle-projection.server.ts":sha(await readFile(new URL("./current-lifecycle-projection.server.ts",import.meta.url),"utf8"))},
 migrationPins:Object.fromEntries(names.map(n=>["supabase/migrations/"+n,sha(ddl.get(n)!)])),policyRecordId:"synthetic-local-policy-no-live-authority",
 deletionPolicySha256:appleDigest(policy),custodyPolicySha256:appleDigest(custodyPolicy),sourceIdentitySha256:await metadata("select encode(sha256(convert_to(concat(pg_get_functiondef('public.wd_current_lifecycle_deployment_metadata(jsonb)'::regprocedure),pg_get_functiondef('public.wd_current_lifecycle_projection(jsonb)'::regprocedure),pg_get_functiondef('public.wd_current_contact_legacy_empty(jsonb)'::regprocedure),pg_get_functiondef('public.wd_current_original_status_material(jsonb)'::regprocedure)),'UTF8')),'hex') hash"),
 expectedCatalogSha256:approvedOperator.expectedCatalogSha256,expectedEngineSha256:approvedOperator.expectedEngineSha256,writerManifestSha256:approvedOperator.writerManifestSha256,writerCatalogSha256:approvedOperator.writerCatalogSha256,...{retentionSchemaSha256:retentionMeta.schemaSha256,retentionEraserSha256:retentionMeta.eraserSha256},
 projectionIdentity:LIFECYCLE_PROJECTION,referenceBounds:Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k=>[k,128])),
 domain:{catalogObjectCount:domainCount,classifiedDomainCount:domainCount,unknownDomainCount:0 as const,overflow:false as const},
 capture:{searchPath:"" as const,role:"postgres",recipeSha256:sha("synthetic-local-complete-maintained-formulas"),receiptSha256:sourcePackage},observedAt:new Date(releaseNow).toISOString(),validUntil:approvedOperator.validUntil};
 const manifestBytes=JSON.stringify(m);
 const manifest=checkCurrentLifecycleDeploymentManifest(manifestBytes,{sha256:sha(manifestBytes),releaseId:m.releaseId,sourcePins:m.sourcePins,migrationPins:m.migrationPins,policyRecordId:m.policyRecordId,deletionPolicySha256:m.deletionPolicySha256,custodyPolicySha256:m.custodyPolicySha256,recipeSha256:m.capture.recipeSha256},releaseNow);assert.ok(manifest);
 const metadataRequest:LifecycleMetadataRequest={userId:A,identityHash:H,accountRevision:1,manifestIdentity:m.releaseId,profile:m.observerProfile,catalogIdentity:m.catalogIdentity};
 const credential=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),Buffer.from(JSON.stringify({role:"service_role",ref:"zpvqxtklvjitofpbddrn",exp:Math.floor(releaseNow/1000)+86400})).toString("base64url"),Buffer.alloc(32,1).toString("base64url")].join(".");
 let projectionCalls=0;
 const projectSql=(name:string,body:unknown,role="service_role")=>serial(async()=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role})]);await db.exec("set role "+role);return(await db.query<{r:AppleData}>(`select public.${name}($1::jsonb) r`,[JSON.stringify(body)])).rows[0].r;});
 const projectionTransport:typeof fetch=async(url,init)=>{assert.equal(init?.method,"POST");assert.equal(init?.redirect,"error");const name=new URL(String(url)).pathname.split("/").at(-1)!;assert.ok(["wd_current_lifecycle_projection","wd_current_lifecycle_deployment_metadata"].includes(name));projectionCalls++;return Response.json(await projectSql(name,JSON.parse(String(init?.body)).p_body));};
 const projectionRepo=createCurrentLifecycleProjectionRepository({manifest,expectedMetadataRequest:metadataRequest,deletionPolicy:policy,custodyPolicy,serverCredential:credential,request:projectionTransport,now:Date.now,timeoutMs:8000});
 const selectors=projectionRepo.selectors();
 assert.equal(selectors.length,19);
 const template:CurrentUuidClaimTemplate={deletionPolicy:policy,custodyPolicy,expectedCatalogSha256:approvedOperator.expectedCatalogSha256,expectedEngineSha256:approvedOperator.expectedEngineSha256,writerManifestSha256:approvedOperator.writerManifestSha256,writerCatalogSha256:approvedOperator.writerCatalogSha256,validUntil:approvedOperator.validUntil,maxObservationAgeMs:8000,selectors};
 const key=generateKeyPairSync("ec",{namedCurve:"prime256v1"}),now=Date.now();

 const material=parseCurrentPrivateLifecycleMaterial({origin:ORIGIN,serverCredential:credential,profile:UUID_DELETE_PROFILE,profilePolicyVersion:UUID_DELETE_PROFILE,clientId:"com.wisedinner.app",teamId:"TESTTEAM01",keyId:"TESTKEY001",privateKeyPem:key.privateKey.export({type:"pkcs8",format:"pem"}).toString(),secretSeconds:60,keyVersion:"test",keyring:new Map([["test",randomBytes(32)]]),applePolicy:custodyPolicy,deletionPolicy:policy,validUntil:new Date(now+600000).toISOString()}).detach(now);assert.ok(material);
 const config:CurrentUuidLifecycleHostConfiguration={enabled:true,material,template,ports:{async observe(q){factRequests.push(structuredClone(q));return observe(q);},observeLocalDenial:q=>observe(q,true)},verify:async r=>({id:r.headers.get("authorization")==="Bearer B"?B:A,token:"synthetic",authenticatedAt:Math.floor(Date.now()/1000),providers:["email"]}),request:transport,now:Date.now,repositories:{apple:repository,deletion:{account:(account,action,body)=>rpc("wd_deletion_v2_account_command",action,body,account.id,"authenticated"),worker:(action,body)=>rpc("wd_deletion_v2_worker_command",action,body)}},retention:{...retentionMeta,maxRecords:128,freshnessMs:3000,clockSkewMs:1000,async readAdmission(q){return{outcome:"admitted",registryId:"wd-apple-custody-v1",...retentionMeta,policySha256:q.policySha256,custodyPolicySha256:q.custodyPolicySha256,observedAt:Date.now(),validUntil:Date.now()+2000};}}};
 function original(){const operationId=randomUUID(),capability=randomBytes(32).toString("base64url");return{operationId,capability,intentSha256:deletionIntentHash(A,operationId,1,deletionRecoveryHash(operationId,capability),appleDigest(policy))};}
 function request(o:ReturnType<typeof original>,operation:"prepare"|"confirm"|"status",owner=A){return new Request(ORIGIN+"/api/v1/account/deletion-v2",{method:"POST",headers:{"content-type":"application/json",authorization:operation==="status"?"Deletion-Recovery "+o.capability:"Bearer "+(owner===A?"A":"B"),"x-wd-deletion-recovery":o.capability,"x-wd-deletion-intent-sha256":o.intentSha256},body:JSON.stringify({contract:"wd-account-deletion-v2",operation,operationId:o.operationId,...(operation==="status"?{intentSha256:o.intentSha256}:{expectedAccountRevision:1,...(operation==="confirm"?{intentSha256:o.intentSha256,confirmation:"DELETE MY ACCOUNT"}:{})})})});}
 async function trial(fn:()=>Promise<void>){await admin("begin");try{await fn();}finally{await serial(async()=>{await db.exec("rollback;reset role");});}}


 await t.test("new metadata exact empty-path formulas match independently captured pre-target release; no effect",()=>trial(async()=>{
  const before=deletes;const raw=await projectSql("wd_current_lifecycle_deployment_metadata",metadataRequest);
  assert.equal(raw.contract,"wd-current-lifecycle-deployment-metadata-v1");
  assert.equal(raw.catalogSha256,approvedOperator.expectedCatalogSha256);
  assert.equal(raw.writerManifestSha256,approvedOperator.writerManifestSha256);
  assert.equal(raw.writerCatalogSha256,approvedOperator.writerCatalogSha256);
  assert.equal(raw.retentionSchemaSha256,retentionMeta.schemaSha256);
  assert.ok(await projectionRepo.readMetadata(metadataRequest));assert.equal(deletes,before);
  assert.ok(!JSON.stringify(raw).includes("@"));assert.equal(raw.allowed,undefined);
 }));
 await t.test("0032 exact service EXECUTE and empty rendering path, no raw private table privileges",()=>trial(async()=>{
  for(const name of ["wd_current_lifecycle_projection","wd_current_lifecycle_deployment_metadata"]){
   const r=(await admin("select proconfig=ARRAY['search_path=\"\"'] empty_path,has_function_privilege('service_role',oid,'EXECUTE') svc,has_function_privilege('anon',oid,'EXECUTE') anon,has_function_privilege('authenticated',oid,'EXECUTE') authenticated from pg_proc where oid=to_regprocedure($1)",["public."+name+"(jsonb)"])).rows[0];assert.deepEqual(r,{empty_path:true,svc:true,anon:false,authenticated:false});
  }
  const r=(await admin("select has_table_privilege('service_role','wd_apple_private.credentials','SELECT') c,has_table_privilege('service_role','wd_deletion_v2_private.intents','SELECT') i,has_function_privilege('service_role','public.wd_current_contact_inventory(uuid)','EXECUTE') raw")).rows[0];assert.deepEqual(r,{c:false,i:false,raw:false});
 }));

 await t.test("exact accepted0033 installed after0032; original source/role/ACL/path and live capability holds retained",()=>trial(async()=>{
  assert.equal(sha(ddl.get("0033_wd_current_original_status_recovery.sql")!),"003980319d96836904c968a7160d6c65e6bff4b428caf15c72c75f558c20a729");
  const r=(await admin("select encode(sha256(convert_to(prosrc,'UTF8')),'hex') body,pg_get_function_identity_arguments(oid) args,proowner::regrole::text owner,prosecdef definer,proconfig=ARRAY['search_path=\"\"'] empty_path from pg_proc where oid='public.wd_current_original_status_material(jsonb)'::regprocedure")).rows[0];
  assert.deepEqual(r,{body:"c7044b179e6f209d193e9fc62f91492db2ad97ef2e7dfec7d734b9473b469b70",args:"p_body jsonb",owner:"wd_deletion_v2_internal",definer:true,empty_path:true});
  assert.deepEqual(await projectSql("wd_current_original_status_material",{operationId:randomUUID(),intentSha256:"0".repeat(64),recoveryHash:"0".repeat(64)}),{outcome:"held"});
 }));
 for(const [label,sql]of Object.entries({
  missing:"drop function public.wd_current_original_status_material(jsonb)",
  extra:"create function public.unreviewed_recovery_extra(jsonb) returns jsonb language sql as $$select '{}'::jsonb$$",
  overload:"create function public.wd_current_original_status_material(text) returns jsonb language sql as $$select '{}'::jsonb$$",
  source:"create or replace function public.wd_current_original_status_material(p_body jsonb)returns jsonb language plpgsql security definer set search_path='' as $$begin return '{\"outcome\":\"held\"}';end$$",
  owner:"alter function public.wd_current_original_status_material(jsonb) owner to postgres",
  acl:"grant execute on function public.wd_current_original_status_material(jsonb) to authenticated",
  path:"alter function public.wd_current_original_status_material(jsonb) set search_path=public"
 }))await t.test("combined recovery participant exact drift denial: "+label,()=>trial(()=>currentProjection(async(q,fact)=>{
  assert.ok(await projectionRepo.select(q),"same actual live original is clear before drift");
  const before=deletes;await admin(sql);
  assert.deepEqual(await observe(fact),{outcome:"held"});
  assert.equal(await projectionRepo.select(q),null);
  assert.equal(await projectionRepo.readMetadata({...metadataRequest,accountRevision:2}),null);
  if(label==="missing")assert.deepEqual(await projectSql("wd_current_lifecycle_deployment_metadata",{...metadataRequest,accountRevision:2}),{outcome:"held"});
  assert.equal(deletes,before);
 })));
 // Exact new bridge participants are part of the complete closed source set.
 for(const helper of ["role","uid","evidence"])for(const drift of ["missing","owner","acl","path","source","volatility"]){
  await t.test("managed JWT bridge exact drift denial: "+helper+"/"+drift,()=>trial(()=>currentProjection(async(q,fact)=>{
   assert.ok(await projectionRepo.select(q),"same actual original clear before exact bridge drift");const before=deletes;
   const name="public.wd_current_auth_"+helper,returns=helper==="role"?"text":helper==="uid"?"uuid":"jsonb";
   const sql=drift==="missing"?"drop function "+name+"()":drift==="owner"?"alter function "+name+"() owner to wd_deletion_v2_internal":drift==="acl"?"grant execute on function "+name+"() to authenticated":drift==="path"?"alter function "+name+"() set search_path=public":drift==="volatility"?"alter function "+name+"() immutable":"create or replace function "+name+"()returns "+returns+" language sql stable security definer set search_path='' as $$select null::"+returns+"$$";
   await admin(sql);assert.deepEqual(await observe(fact),{outcome:"held"});assert.equal(await projectionRepo.select(q),null);assert.equal(deletes,before);
  })));
 }
 for(const role of ["anon","authenticated"])await t.test("0032 fixed RPC denied "+role,()=>trial(async()=>{
  for(const name of ["wd_current_lifecycle_deployment_metadata","wd_current_lifecycle_projection"]){
   await admin("savepoint denied");await assert.rejects(projectSql(name,metadataRequest,role),(e:unknown)=>!!e&&typeof e==="object"&&"code"in e&&e.code==="42501");
   await serial(async()=>{await db.exec("rollback to denied;reset role");});
  }
 }));
 for(const [label,patch]of Object.entries({foreign:{userId:randomUUID()},revision:{accountRevision:2},extra:{approved:true},url:{url:"https://invalid"},profile:{profile:"strict"},identity:{identityHash:"bad"}})){
  await t.test("metadata closed "+label,()=>trial(async()=>{assert.deepEqual(await projectSql("wd_current_lifecycle_deployment_metadata",{...metadataRequest,...patch}),{outcome:"held"});}));
 }
 for(const [label,sql]of Object.entries({
  overload:"create function public.wd_current_lifecycle_projection(text) returns jsonb language sql as $$select '{}'::jsonb$$",
  source:"create or replace function public.wd_current_lifecycle_deployment_metadata(p_body jsonb)returns jsonb language plpgsql security definer set search_path='' as $$begin return '{}';end$$",
  grant:"grant execute on function public.wd_current_lifecycle_projection(jsonb) to authenticated",
  searchPath:"alter function public.wd_current_lifecycle_deployment_metadata(jsonb) set search_path=public",
  owner:"alter function public.wd_current_lifecycle_deployment_metadata(jsonb) owner to postgres",
  unknown:"create table public.unclassified_owner(owner_id uuid)",
  engine:"create table public.ce_unclassified(owner_id uuid)"
 }))await t.test("0032 deployment drift is not rebased: "+label,()=>trial(async()=>{
  await admin(sql);assert.equal(await projectionRepo.readMetadata(metadataRequest),null);
  const before=deletes,o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create();
  await port.deletion(request(o,"prepare"));await port.deletion(request(o,"confirm"));assert.equal(deletes,before);
 }));
 async function currentProjection(check:(q:ReturnType<typeof projectionInput>,fact:ScopeObservationRequest)=>Promise<void>){
  const o=original();let checked=false,failure:unknown;
  const c:CurrentUuidLifecycleHostConfiguration={...config,ports:{observeLocalDenial:q=>observe(q,true),async observe(fact:ScopeObservationRequest){
   if(!checked){checked=true;try{await check(projectionInput(fact),fact);}catch(e){failure=e;}}
   throw Error("synthetic stop after assertions while actual lease live; no effect");
  }}};
  const before=deletes,port=createCurrentUuidLifecycleHostAdapter(c).create();
  assert.equal((await port.deletion(request(o,"prepare"))).status,200);await port.deletion(request(o,"confirm"));
  assert.ok(checked,"actual issuer must request facts");assert.equal(deletes,before);if(failure)throw failure;
 }
 function projectionInput(fact:ScopeObservationRequest){
  const base={phase:"run" as const,binding:fact.binding,accountRevision:2,reference:"accountTombstone" as CurrentScopeReference,projection:CURRENT_AUTH_SCOPE+"/accountTombstone",policySha256:appleDigest(policy)};
  return {...base,projectionIdentitySha256:appleDigest(["wd-current-uuid-claim-target-projection-v1",base])};
 }
 const projectionWire=(q:ReturnType<typeof projectionInput>)=>({...q,manifestIdentity:m.releaseId,custodyPolicy,custodyPolicySha256:appleDigest(custodyPolicy),projectionVersion:LIFECYCLE_PROJECTION});
 async function retained(seconds=600,resolved=true){
  const operation=randomUUID(),lineage=randomUUID(),attempt=randomUUID(),historical=sha(operation);
  await admin("insert into wd_apple_private.owners(owner_id)values($1) on conflict do nothing",[A]);
  await admin("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,created_at,expires_at)values($1,$2,$3,'synthetic.native',$3,$3,$3,$4,$5,'stored',now()-make_interval(secs=>3601-$6::integer),now()+make_interval(secs=>$6::integer)-interval '1 second')",[operation,A,historical,JSON.stringify(custodyPolicy),appleDigest(custodyPolicy),seconds]);
  await admin("insert into wd_apple_private.credentials(lineage_id,operation_id,owner_id,client_id,apple_identity_hash,policy_hash,envelope,state,expires_at,recovery_until)values($1,$2,$3,'synthetic.native',$4,$5,null,'erased',now()-interval '1 second',now()-interval '1 second')",[lineage,operation,A,historical,appleDigest(custodyPolicy)]);
  await admin("insert into wd_apple_private.current_retention_attempts(lineage_id,owner_id,operation_id,intent_hash,policy_hash,attempt_id,readback_at)values($1,$2,$3,$4,$5,$6,case when $7::boolean then now() else null end)",[lineage,A,operation,historical,appleDigest(custodyPolicy),attempt,resolved]);return{operation,lineage,attempt};
 }
 function referenceInput(q:ReturnType<typeof projectionInput>,reference:CurrentScopeReference){const base={phase:q.phase,binding:q.binding,accountRevision:q.accountRevision,reference,projection:CURRENT_AUTH_SCOPE+"/"+reference,policySha256:q.policySha256};return{...base,projectionIdentitySha256:appleDigest(["wd-current-uuid-claim-target-projection-v1",base])};}
 await t.test("resolved retention attempts are counted, digest binds readback and expiry is minimum actual parent",()=>trial(()=>currentProjection(async q=>{
  const rq=referenceInput(q,"retentionAttempts");const empty=await projectionRepo.select(rq);assert.ok(empty);assert.deepEqual({...empty.value,count:0},empty.value);assert.equal((empty.value as {validUntil:unknown}).validUntil,null);
  const first=await retained(600,true);await retained(300,true);
  const a=await projectionRepo.select(rq);assert.ok(a);assert.equal(a.value.count,2);
  const until=(await admin("select min(expires_at)::text t from wd_apple_private.exchanges where owner_id=$1",[A])).rows[0].t;assert.equal(Date.parse(String((a.value as {validUntil:unknown}).validUntil)),Date.parse(String(until)));
  await admin("update wd_apple_private.current_retention_attempts set readback_at=null where lineage_id=$1",[first.lineage]);
  const b=await projectionRepo.select(rq);assert.ok(b);assert.equal(b.value.count,a.value.count);assert.notEqual(b.value.sha256,a.value.sha256);
  assert.ok(!JSON.stringify(b).includes(first.lineage));
 })));
 for(const defect of ["expired","policy","foreign","parent","overflow"]){
  await t.test("real retained projection fails closed: "+defect,()=>trial(()=>currentProjection(async q=>{
   const row=await retained();const rq=referenceInput(q,"retentionAttempts");assert.ok(await projectionRepo.select(rq));
   if(defect==="expired")await admin("update wd_apple_private.exchanges set created_at=created_at-interval '1 day',expires_at=expires_at-interval '1 day' where operation_id=$1",[row.operation]);
   if(defect==="policy")await admin("update wd_apple_private.current_retention_attempts set policy_hash=repeat('0',64) where lineage_id=$1",[row.lineage]);
   if(defect==="foreign"){await admin("insert into wd_apple_private.owners(owner_id)values($1) on conflict do nothing",[B]);await admin("update wd_apple_private.current_retention_attempts set owner_id=$2 where lineage_id=$1",[row.lineage,B]);}
   if(defect==="parent")await admin("update wd_apple_private.exchanges set expires_at=expires_at+interval '1 second' where operation_id=$1",[row.operation]);
   if(defect==="overflow")for(let i=0;i<128;i++)await retained();
   assert.equal(await projectionRepo.select(rq),null);
  })));
 }
 await t.test("all19 projections independently equal actual observer while real claim is live",()=>trial(()=>currentProjection(async(q,fact)=>{
  for(const name of ["wd_current_auth_scope_observe","wd_current_sparse_auth_scope_observe"]){assert.deepEqual(await projectSql(name,fact),{outcome:"held"},"old strict/sparse do not auto-admit new function set");}
  const beforeCalls=projectionCalls;
  const actual=await observe(fact) as {outcome?:string;references:Record<string,unknown>};assert.notEqual(actual.outcome,"held");
  for(const reference of Object.keys(CURRENT_AUTH_SCOPE_REFERENCES) as CurrentScopeReference[]){
   const base={...q,reference,projection:CURRENT_AUTH_SCOPE+"/"+reference};const partial=Object.fromEntries(Object.entries(base).filter(([k])=>k!=="projectionIdentitySha256"));
   base.projectionIdentitySha256=appleDigest(["wd-current-uuid-claim-target-projection-v1",partial]);
   const projected=await projectionRepo.select(base);assert.ok(projected,reference);assert.deepEqual(projected.value,actual.references[reference],reference);
  }
  assert.equal(projectionCalls-beforeCalls,19);
 })));
 for(const [label,mutate]of Object.entries({
  owner:(q:AppleData)=>({...q,binding:{...(q.binding as AppleData),userId:B}}),
  revision:(q:AppleData)=>({...q,accountRevision:1}),
  work:(q:AppleData)=>({...q,binding:{...(q.binding as AppleData),workOwner:randomUUID()}}),
  attempt:(q:AppleData)=>({...q,binding:{...(q.binding as AppleData),workAttempt:99}}),
  lease:(q:AppleData)=>({...q,binding:{...(q.binding as AppleData),leaseUntil:new Date(1).toISOString()}}),
  policy:(q:AppleData)=>({...q,policySha256:"0".repeat(64)}),
  reference:(q:AppleData)=>({...q,reference:"arbitrary_table"}),
  phase:(q:AppleData)=>({...q,phase:"future"}),
  projected:(q:AppleData)=>({...q,projection:"arbitrary_sql"}),
  extra:(q:AppleData)=>({...q,sql:"select * from auth.users"}),
  reconcile:(q:AppleData)=>({...q,phase:"reconcile"})
 }))await t.test("actual durable projection held: "+label,()=>trial(async()=>{
  await currentProjection(async q=>{
   const wire=projectionWire(q),before=deletes;
   assert.ok(await projectionRepo.select(q),"unmodified same live tuple must pass");
   assert.deepEqual(await projectSql("wd_current_lifecycle_projection",mutate(wire)),{outcome:"held"});assert.equal(deletes,before);
  });
 }));

 await t.test("private early diagnostic unrelated183 aggregate is clear, no body/row IDs and no mutation",()=>trial(async()=>{
  assert.equal(CURRENT_CONTACT_CATALOG_PROFILE,"wd-current-confirmed-contact-v1");
  assert.equal(sha(ddl.get("0031_wd_current_legacy_contact_scope.sql")!),CURRENT_CONTACT_CATALOG_METADATA.migrationSha256);
  assert.deepEqual((await counts()).rows[0],{messages:24,threads:10,waitlist:3});
  const value=await early({userId:A,accountRevision:1});assert.equal(value.outcome,"clear");assert.deepEqual(value.matched,{waitlist:0,supportMessages:0,supportThreads:0,supportMessagesV2:0});
  assert.ok(!JSON.stringify(value).includes("@"));assert.equal((await admin("select count(*)::int n from wd_deletion_v2_private.intents")).rows[0].n,0);
  assert.deepEqual(await early({userId:A,accountRevision:1,historical:true}),{outcome:"held"});
 }));
 await t.test("early diagnostic is service-only and cannot create an original",()=>trial(async()=>{
  for(const role of ["anon","authenticated"]){
   await admin("savepoint role_denied");
   await assert.rejects(early({userId:A,accountRevision:1},role),(e:unknown)=>!!e&&typeof e==="object"&&"code"in e&&e.code==="42501");
   await serial(async()=>{await db.exec("rollback to role_denied;reset role");});
  }
  assert.deepEqual(await early({userId:A,accountRevision:1,approved:true}),{outcome:"held"});
  assert.equal((await admin("select count(*)::int n from wd_deletion_v2_private.intents")).rows[0].n,0);
 }));
 for(const [name,sql]of Object.entries({
  waitlist:"insert into public.waitlist(email)values(' OWNER-A@EXAMPLE.INVALID ')",
  support:"insert into public.support_messages(email,message)values('owner-a@example.invalid','synthetic')",
  parent:"insert into public.support_threads(channel,from_email)values('form','owner-a@example.invalid')",
  pendingChange:"update auth.users set email_change='next@example.invalid' where id='"+A+"'",
  unconfirmed:"update auth.users set email_confirmed_at=null where id='"+A+"'",
  anonymous:"update auth.users set is_anonymous=true where id='"+A+"'"
 }))await t.test("actual matching/unsupported contact holds zero fake effect: "+name,()=>trial(async()=>{
  await admin(sql);const diag=await early({userId:A,accountRevision:1});assert.notEqual(diag.outcome,"clear");
  if(["waitlist","support","parent"].includes(name))assert.ok(Object.values(diag.matched as object).some(n=>Number(n)>0));
  const before=deletes,o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create();
  assert.equal((await port.deletion(request(o,"prepare"))).status,200);
  await port.deletion(request(o,"confirm"));assert.equal(deletes,before);
 }));
 await t.test("private matching projection binds real content, not only count",()=>trial(async()=>{
  await admin("insert into public.support_messages(email,message)values('owner-a@example.invalid','first synthetic body')");
  const a=await early({userId:A,accountRevision:1});assert.equal(a.outcome,"matched");
  await admin("update public.support_messages set message='second synthetic body' where email='owner-a@example.invalid'");
  const b=await early({userId:A,accountRevision:1});assert.deepEqual(a.matched,b.matched);
  assert.notEqual(a.contactScopeSha256,b.contactScopeSha256);
  assert.ok(!JSON.stringify(b).includes("synthetic body"));
 }));
 await t.test("plus/dot/same-domain are not invented aliases",()=>trial(async()=>{
  await admin("insert into public.waitlist(email)values('owner-a+tag@example.invalid'),('own.er-a@example.invalid'),('other@example.invalid')");
  assert.equal((await early({userId:A,accountRevision:1})).outcome,"clear");
 }));
 await t.test("actual inherited child and conflicting legacy contact counts never disappear",()=>trial(async()=>{
  await serial(async()=>{await db.exec("reset role;insert into public.support_messages(id,email,message)values('30000000-0000-4000-8000-000000000001','owner-a@example.invalid','synthetic');insert into public.support_threads(id,channel,from_email,legacy_id)values('30000000-0000-4000-8000-000000000002','form','other@example.invalid','30000000-0000-4000-8000-000000000001');insert into public.support_messages_v2(thread_id,direction,body)values('30000000-0000-4000-8000-000000000002','out','synthetic');");});
  const d=await early({userId:A,accountRevision:1});assert.equal(d.outcome,"ambiguous");assert.equal((d.matched as AppleData).supportMessagesV2,1);assert.ok(Number(d.ambiguousCount)>0);
 }));
 await t.test("existing malformed contact and orphan are held, no source Boolean clearance",()=>trial(async()=>{
  await serial(async()=>{await db.exec("reset role;set session_replication_role=replica;insert into public.waitlist(email)values('unsupported');insert into public.support_messages_v2(thread_id,direction,body)values('90000000-0000-4000-8000-000000000001','in','synthetic');set session_replication_role=origin;");});
  const d=await early({userId:A,accountRevision:1});assert.equal(d.outcome,"ambiguous");assert.equal(d.ambiguousCount,2);
 }));
 for(const [name,sql]of Object.entries({
  truncate:"truncate public.waitlist",
  insert:"insert into public.waitlist(email)values('owner-a@example.invalid')",
  update:"update public.waitlist set email='owner-a@example.invalid' where email='wait-1@example.invalid'",
  parentDelete:"delete from public.support_threads where id='40000000-0000-4000-8000-000000000001'",
  parentMove:"update public.support_threads set from_email='escaped@example.invalid' where id='40000000-0000-4000-8000-000000000001'",
  childMove:"update public.support_messages_v2 set thread_id='40000000-0000-4000-8000-000000000001' where id=(select id from public.support_messages_v2 limit 1)"
 }))await t.test("local confirm-first late writer denied: "+name,()=>trial(async()=>{
  // Writer-first target row is admitted while active. Confirm prevents later modification.
  await admin("insert into public.support_threads(id,channel,from_email)values('40000000-0000-4000-8000-000000000001','form','owner-a@example.invalid')");
  const o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create();await port.deletion(request(o,"prepare"));
  await rpc("wd_deletion_v2_account_command","confirm",{operationId:o.operationId,recoveryHash:deletionRecoveryHash(o.operationId,o.capability),expectedAccountRevision:1,intentSha256:o.intentSha256,confirmation:"DELETE MY ACCOUNT"},A,"authenticated");
  await admin("savepoint writer");
  const runtimeWrite=(statement:string)=>serial(async()=>{
   await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:"service_role"})]);
   await db.exec("set role service_role");return db.query(statement);
  });
  await assert.rejects(runtimeWrite(sql),(e:unknown)=>!!e&&typeof e==="object"&&"code"in e&&e.code==="23514");
  await serial(async()=>{await db.exec("rollback to writer;reset role");});
  await runtimeWrite("insert into public.waitlist(email)values('new-unrelated@example.invalid')");
 }));
 for(const loss of [false,true])await t.test(loss?"required lost effect ACK recovers original GET with no second DELETE":"required fresh prepare/confirm/random claim/receipt/issuer/finalproof makes ONE effect",()=>trial(async()=>{
  const o=original(),port=createCurrentUuidLifecycleHostAdapter(config).create();deletes=0;authGets=0;clears=0;receiptHeld=0;lose=loss;factRequests.length=0;
  const prepared=await port.deletion(request(o,"prepare"));assert.equal(prepared.status,200);const prep=await prepared.json();assert.equal(prep.result.intentState,"prepared");
  assert.equal(deletes,0);assert.equal(factRequests.length,0,"no future source scope required before prepare");
  const response=await port.deletion(request(o,"confirm"));assert.equal(response.status,200);const initial=await response.json();
  assert.equal(deletes,1,"required real join; diagnostic="+JSON.stringify({clears,receiptHeld,factRequests:factRequests.length,authDeletion:initial.result.authDeletion,actions:actions.slice(-12)}));
  if(loss){assert.notEqual(initial.result.authDeletion,"confirmed");
   const beforeMaterial={gets:authGets,clears,facts:factRequests.length,deletes};
   const material=await projectSql("wd_current_original_status_material",{operationId:o.operationId,intentSha256:o.intentSha256,recoveryHash:deletionRecoveryHash(o.operationId,o.capability)});
   assert.equal(material.contract,"wd-current-original-status-material-v1");assert.equal(material.operationId,o.operationId);assert.equal(material.intentSha256,o.intentSha256);assert.equal(material.policySha256,appleDigest(policy));assert.equal(material.accountRevision,2);
   assert.equal((material.target as AppleData).userId,A);assert.equal((material.target as AppleData).identityHash,H);
   const durable=(await admin("select scope_hash from wd_apple_private.auth_attempts where owner_id=$1",[A])).rows[0];assert.equal(material.scopeHash,durable.scope_hash);
   assert.deepEqual(await projectSql("wd_current_original_status_material",{operationId:o.operationId,intentSha256:o.intentSha256,recoveryHash:"0".repeat(64)}),{outcome:"held"});
   assert.deepEqual({gets:authGets,clears,facts:factRequests.length,deletes},beforeMaterial,"original capability material adds no provider/scope/clear effect");
   await admin("update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id=$1",[A]);
   const stored=await admin("select scope_hash from wd_apple_private.auth_attempts where owner_id=$1",[A]);
   const beforeRecovery={gets:authGets,clears,facts:factRequests.length};
   const recovered=await port.deletion(request(o,"confirm"));assert.equal(recovered.status,200);assert.equal((await recovered.json()).result.authDeletion,"confirmed");
   assert.equal((await admin("select scope_hash from wd_apple_private.auth_attempts where owner_id=$1",[A])).rows[0].scope_hash,stored.rows[0].scope_hash);
   assert.ok(authGets>beforeRecovery.gets,"recovery uses original GET");assert.equal(clears,beforeRecovery.clears,"no repeated receipt clear");assert.equal(factRequests.length,beforeRecovery.facts,"no scope issuance/reobservation in original recovery");
  }else assert.equal(initial.result.authDeletion,"confirmed");
  assert.equal(deletes,1);assert.equal((await admin("select count(*)::int n from public.wd_account_receipts where user_id=$1",[A])).rows[0].n,0);
  const status=await port.deletion(request(o,"status"));assert.equal(status.status,200);assert.equal((await status.json()).result.authDeletion,"confirmed");assert.equal(deletes,1);
  assert.deepEqual((await counts()).rows[0],{messages:24,threads:10,waitlist:3},"unrelated183 fixtures never erased by Auth cleanup");
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
 for(const [name,sql]of Object.entries({catalog:"grant execute on function public.wd_current_contact_key(text) to public",view:"alter view public.store_prices set(security_invoker=false)",trigger:"alter table public.waitlist disable trigger wd_current_contact_guard",authColumn:"alter table auth.users alter column email type text",revision:"update public.wd_accounts set revision=revision+1 where user_id='"+A+"'",lease:"update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id='"+A+"'",attempt:"update public.wd_deletion_work set attempt=attempt+1 where user_id='"+A+"'",receipt:"insert into public.wd_account_receipts(user_id,id,request,result)values('"+A+"',gen_random_uuid(),'{}','{}')"}))await t.test("real claim observation boundary drift prevents Auth effect: "+name,()=>trial(async()=>{
  const o=original();let changed=false;const c={...config,ports:{...config.ports!,async observe(q:ScopeObservationRequest){if(!changed){changed=true;await admin(sql);}return config.ports!.observe(q);}}};
  const port=createCurrentUuidLifecycleHostAdapter(c).create(),before=deletes;assert.equal((await port.deletion(request(o,"prepare"))).status,200);
  const response=await port.deletion(request(o,"confirm"));assert.equal(response.status,200);assert.notEqual((await response.json()).result.authDeletion,"confirmed");assert.equal(deletes,before);assert.equal(changed,true);
  assert.equal((await admin("select count(*)::int n from wd_apple_private.auth_attempts where owner_id=$1",[A])).rows[0].n,0);
 }));
 await t.test("actual contact change between independent issuer fact and final proof denies without identityHash substitution",()=>trial(async()=>{
  let reads=0;const before=deletes;
  const c={...config,ports:{...config.ports!,async observe(q:ScopeObservationRequest){
   if(++reads===3)await admin("update auth.users set email='changed@example.invalid' where id=$1",[A]);
   return config.ports!.observe(q);
  }}};
  const o=original(),port=createCurrentUuidLifecycleHostAdapter(c).create();
  assert.equal((await port.deletion(request(o,"prepare"))).status,200);
  await port.deletion(request(o,"confirm"));assert.ok(reads>=3);assert.equal(deletes,before);
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

