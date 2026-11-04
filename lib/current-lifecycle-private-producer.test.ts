import test from "node:test";
import assert from "node:assert/strict";
import {createHash,randomUUID,randomBytes,generateKeyPairSync} from "node:crypto";
import {readFile,readdir} from "node:fs/promises";
import {resolve,dirname,basename} from "node:path";
import {createCurrentLifecyclePrivateProducer,withCurrentPrivateHostInputs,type CurrentLifecycleRelease} from "./current-lifecycle-private-producer.server.ts";
import {LIFECYCLE_MANIFEST,LIFECYCLE_PROJECTION,LIFECYCLE_METADATA,LIFECYCLE_REQUIRED_MIGRATIONS} from "./current-lifecycle-deployment-manifest.server.ts";
import {CURRENT_CONTACT_CATALOG_IDENTITY,CURRENT_CONTACT_CATALOG_PROFILE} from "./current-legacy-contact-catalog-profile.server.ts";
import {CURRENT_AUTH_SCOPE_REFERENCES} from "./current-auth-scope.server.ts";
import {UUID_DELETE_PROFILE} from "./current-uuid-auth-scope.server.ts";
import {appleDigest} from "./apple-token-custody.server.ts";
import {supabaseDeletionAuthV2,deletionIntentHash,deletionRecoveryHash} from "./account-deletion-v2.server.ts";
import {POST as deletionPOST} from "../app/api/v1/account/deletion-v2/route.ts";
import {POST as readPOST} from "../app/api/v1/current/read/route.ts";
const ORIGIN="https://zpvqxtklvjitofpbddrn.supabase.co",HOST="https://host.synthetic.invalid",A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",H="a".repeat(64),NOW=Date.parse("2026-11-01T12:00:00Z");
// Explicit fixture policies ONLY. No duration or supplied approval is live authority.
const policy={approved:true as const,version:UUID_DELETE_PROFILE,preparedSeconds:900,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
const custody={approved:true as const,version:"synthetic-only",credentialSeconds:600,recoverySeconds:600,evidenceSeconds:3600,retainedEvidence:["apple_credential_recovery"]};
const sha=(v:string)=>createHash("sha256").update(v).digest("hex"),iso=(n:number)=>new Date(n).toISOString();
function jwt(role:string,id=A,now=NOW){return[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({role,ref:"zpvqxtklvjitofpbddrn",exp:Math.floor(now/1000)+86400,sub:id,iss:ORIGIN+"/auth/v1",aud:"authenticated",auth_time:Math.floor(now/1000),amr:[{method:"password",timestamp:Math.floor(now/1000)}]})).toString("base64url"),Buffer.alloc(32,1).toString("base64url")].join(".");}
function releaseFixture(now=NOW,overrides:Record<string,unknown>={}){
 const m={contract:LIFECYCLE_MANIFEST,releaseId:"synthetic-release-only",project:"zpvqxtklvjitofpbddrn",origin:ORIGIN,profile:UUID_DELETE_PROFILE,observerProfile:CURRENT_CONTACT_CATALOG_PROFILE,catalogIdentity:CURRENT_CONTACT_CATALOG_IDENTITY,sourcePins:{"lib/current-lifecycle-projection.server.ts":H} as Record<string,string>,migrationPins:Object.fromEntries(LIFECYCLE_REQUIRED_MIGRATIONS.map(k=>[k,H])),policyRecordId:"synthetic-policy-record",deletionPolicySha256:appleDigest(policy),custodyPolicySha256:appleDigest(custody),sourceIdentitySha256:H,expectedCatalogSha256:H,expectedEngineSha256:H,writerManifestSha256:H,writerCatalogSha256:H,retentionSchemaSha256:H,retentionEraserSha256:H,projectionIdentity:LIFECYCLE_PROJECTION,referenceBounds:Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k=>[k,128])),domain:{catalogObjectCount:40,classifiedDomainCount:40,unknownDomainCount:0,overflow:false},capture:{searchPath:"",role:"postgres",recipeSha256:H,receiptSha256:H},observedAt:iso(now-1),validUntil:iso(now+600000),...overrides};
 const bytes=JSON.stringify(m),release:CurrentLifecycleRelease={expectation:{sha256:sha(bytes),releaseId:m.releaseId,sourcePins:m.sourcePins,migrationPins:m.migrationPins,policyRecordId:m.policyRecordId,deletionPolicySha256:m.deletionPolicySha256,custodyPolicySha256:m.custodyPolicySha256,recipeSha256:H},policyRecord:{id:m.policyRecordId,deletionPolicy:policy,custodyPolicy:custody,validUntil:iso(now+600000)}};
 return {m,bytes,release};
}
function original(id=A){const operationId=randomUUID(),cap=randomBytes(32).toString("base64url");return{operationId,cap,intentSha256:deletionIntentHash(id,operationId,1,deletionRecoveryHash(operationId,cap),appleDigest(policy))};}
function request(o=original(),operation="prepare",id=A,now=NOW){return new Request(HOST+"/api/v1/account/deletion-v2",{method:"POST",headers:{"content-type":"application/json",authorization:operation==="status"?"Deletion-Recovery "+o.cap:"Bearer "+jwt("authenticated",id,now),"x-wd-deletion-recovery":o.cap,"x-wd-deletion-intent-sha256":o.intentSha256},body:JSON.stringify({contract:"wd-account-deletion-v2",operation,operationId:o.operationId,...(operation==="status"?{intentSha256:o.intentSha256}:{expectedAccountRevision:1,...(operation==="confirm"?{intentSha256:o.intentSha256,confirmation:"DELETE MY ACCOUNT"}:{})})})});}
function authRow(id:string){return{id,is_anonymous:false,created_at:"2026-10-01T00:00:00Z",identities:[{identity_id:id,user_id:id,provider:"email",id:"fixture-"+id,created_at:"2026-10-01T00:00:00Z"}]};}
function fixture(id=A){
 const f=releaseFixture(),calls:string[]=[];let now=NOW,revision=1,mode="good",gets=0;
 const r=request(original(id),"prepare",id),config={enabled:true,origin:ORIGIN,publicAuthKey:jwt("anon"),serverCredential:jwt("service_role"),manifestBytes:f.bytes,release:f.release,originalRequest:r,prepare:true,request:undefined as unknown as typeof fetch,now:()=>now};
 const transport:typeof fetch=async(url,init)=>{const u=new URL(String(url));assert.equal(u.origin,ORIGIN);assert.notEqual(init?.method,"DELETE");calls.push(u.pathname);
 if(u.pathname==="/auth/v1/user")return Response.json({...authRow(mode==="foreign"?B:id),email_confirmed_at:iso(NOW)});
 if(u.pathname.startsWith("/auth/v1/admin/users/")){gets++;return Response.json(authRow(id));}
 const b=JSON.parse(String(init?.body));
 if(u.pathname.endsWith("wd_account_command")){assert.equal(b.p_action,"read");return Response.json({preferences:{},revision});}
 if(u.pathname.endsWith("wd_current_lifecycle_deployment_metadata")){
  if(mode==="lost")throw Error("synthetic ACK lost");if(mode==="revision")revision++;
  return Response.json({contract:LIFECYCLE_METADATA,...b.p_body,observedAt:iso(now),validUntil:iso(now+2500),sourceIdentitySha256:H,catalogSha256:mode==="drift"?"b".repeat(64):H,engineSha256:H,writerManifestSha256:H,writerCatalogSha256:H,retentionSchemaSha256:H,retentionEraserSha256:H,domain:f.m.domain});}
 if(u.pathname.endsWith("wd_current_contact_preflight"))return Response.json({outcome:mode==="matched"?"matched":mode==="ambiguous"?"ambiguous":"clear",matched:{waitlist:mode==="matched"?1:0,supportMessages:0,supportThreads:0,supportMessagesV2:0},ambiguousCount:mode==="ambiguous"?1:0,contactScopeSha256:H});
 throw Error("unexpected fixture action");};config.request=transport;
 return{...f,config,calls,transport,owner:{id,token:jwt("authenticated",id),authenticatedAt:NOW/1000,providers:["email"]},mode:(m:string)=>{mode=m;},expire:()=>{now=NOW+600001;},get gets(){return gets;}};
}
test("pure constructor captures request-local verified owner and actual identity helper, returns real projection selectors",async()=>{
 const f=fixture(),p=createCurrentLifecyclePrivateProducer(f.config);assert.deepEqual(f.calls,[]);assert.equal(p.inspect().productionReady,false);
 const out=await p.forOwner(f.owner);assert.ok(out);assert.equal(out.observer.profile,CURRENT_CONTACT_CATALOG_PROFILE);assert.ok(out.template.selectors.length);assert.equal(f.gets,2);assert.equal(f.config.originalRequest.bodyUsed,false);
 assert.equal(out.template.selectors[0].userId,A);assert.notEqual(out.template.selectors[0].identityHash,sha(f.owner.token));
 const admission=await out.retention.readAdmission({policySha256:appleDigest(policy),custodyPolicySha256:appleDigest(custody),now:NOW});assert.equal((admission as {outcome:string}).outcome,"admitted");
 assert.ok(!JSON.stringify(p.inspect()).includes(f.owner.token));
});
for(const mode of ["foreign","revision","drift","lost","matched","ambiguous"])test("producer rejects "+mode+" without prepare,clear or provider effect",async()=>{const f=fixture();f.mode(mode);assert.equal(await createCurrentLifecyclePrivateProducer(f.config).forOwner(f.owner),null);assert.ok(f.calls.every(x=>!x.includes("worker")&&!x.includes("cleanup")));});
test("invalid/expired/rehashed manifest and unknown policy, disabled and getter/proxy inputs stay inert",async()=>{
 let traps=0;const f=fixture();const getter=Object.defineProperty({...f.config},"release",{get(){traps++;throw Error();},enumerable:true}),proxy=new Proxy(f.config,{ownKeys(){traps++;throw Error();}});
 for(const c of [undefined,{...f.config,enabled:false},{...f.config,now:()=>NaN},{...f.config,originalRequest:new Proxy(f.config.originalRequest,{getPrototypeOf(){traps++;throw Error();}})},getter,proxy,{...f.config,extra:true},{...f.config,release:null},{...f.config,manifestBytes:f.bytes+" "},{...f.config,release:{...f.release,policyRecord:{...f.release.policyRecord,id:"foreign"}}}])assert.equal(await createCurrentLifecyclePrivateProducer(c as never).forOwner(f.owner),null);
 assert.equal(traps,0);assert.deepEqual(f.calls,[]);f.expire();assert.equal(await createCurrentLifecyclePrivateProducer(f.config).forOwner(f.owner),null);assert.deepEqual(f.calls,[]);
});
test("captured receiver without bind/name metadata; detached mutable release; A/B/A and concurrent owners",async()=>{
 const a=fixture(),b=fixture(B),fn=a.config.request;Object.defineProperty(fn,"bind",{get(){assert.fail("bind metadata");}});Reflect.deleteProperty(fn,"name");const prior=Object.getPrototypeOf(fn);Object.setPrototypeOf(fn,Object.defineProperty(Object.create(prior),"name",{get(){assert.fail("inherited name metadata");}}));
 const pa=createCurrentLifecyclePrivateProducer(a.config),pb=createCurrentLifecyclePrivateProducer(b.config);Object.assign(a.release.policyRecord,{id:"changed-after-capture"});
 const [one,two]=await Promise.all([pa.forOwner(a.owner),pb.forOwner(b.owner)]);assert.ok(one&&two);assert.equal(one.template.selectors[0].userId,A);assert.equal(two.template.selectors[0].userId,B);assert.ok(await pa.forOwner(a.owner));Object.setPrototypeOf(fn,prior);
});
test("actual default POST installs producer (not resolver/forOwner injection), missing release held; read bypasses private getters",async()=>{
 const f=fixture(),pair=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
 const env={WD_CURRENT_INTEGRATION_HOST_ORIGIN:HOST,SUPABASE_URL:ORIGIN,SUPABASE_ANON_KEY:jwt("anon"),SUPABASE_SERVICE_ROLE_KEY:jwt("service_role"),WD_CURRENT_UUID_LIFECYCLE_ENABLED:"true",WD_CURRENT_LIFECYCLE_DEPLOYMENT_MANIFEST_JSON:f.bytes,APPLE_SIGNIN_CLIENT_ID:"com.wisedinner.app",APPLE_SIGNIN_TEAM_ID:"TESTTEAM01",APPLE_SIGNIN_KEY_ID:"TESTKEY001",APPLE_SIGNIN_PRIVATE_KEY:pair.privateKey.export({type:"pkcs8",format:"pem"}).toString(),WD_CURRENT_LIFECYCLE_MATERIAL_JSON:JSON.stringify({profile:UUID_DELETE_PROFILE,profilePolicyVersion:UUID_DELETE_PROFILE,secretSeconds:300,keyVersion:"test",keyring:{test:randomBytes(32).toString("base64")},applePolicy:custody,deletionPolicy:policy,validUntil:iso(NOW+600000)})};
 // Metadata/current owner are real factories, retention inventory intentionally absent.
 const response=await withCurrentPrivateHostInputs({environment:env,release:f.release,request:f.transport,now:()=>NOW},()=>deletionPOST(f.config.originalRequest));assert.equal(response.status,503);assert.ok(f.calls.some(p=>p.endsWith("wd_current_contact_preflight")),"actual default producer invoked");
 const held=fixture();await withCurrentPrivateHostInputs({environment:env,release:null,request:held.transport,now:()=>NOW},()=>deletionPOST(held.config.originalRequest));assert.ok(held.calls.every(p=>p==="/auth/v1/user"));
 let privateReads=0;const hostile=Object.defineProperty({},"WD_CURRENT_LIFECYCLE_DEPLOYMENT_MANIFEST_JSON",{get(){privateReads++;throw Error();}});
 // Request-local input capture rejects accessors rather than evaluate them.
 assert.throws(()=>withCurrentPrivateHostInputs({environment:hostile,release:null,request:f.transport,now:()=>NOW},()=>{}));assert.equal(privateReads,0);
 const read=new Request(HOST+"/api/v1/current/read",{method:"POST",body:"{}"});const out=await withCurrentPrivateHostInputs({environment:{WD_CURRENT_INTEGRATION_HOST_ORIGIN:HOST},release:null,request:async()=>{assert.fail("read disabled must not transport");},now:()=>NOW},()=>readPOST(read));assert.equal(out.status,503);
});



test("real default producer/HTTP with maintained SQL: fresh effect, original no-JWT GET recovery and contact holds",async t=>{
 const receiptPath=process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;assert.ok(receiptPath,"current slot before PGlite, no skip");
 const slot=JSON.parse(await readFile(receiptPath,"utf8"));assert.equal(slot.contract,"wd-local-source-test-slot-v1");assert.equal(slot.taskId,"backend-private-host-v208");assert.equal(slot.actualTaskId,"backend-private-host-finish-v234");assert.equal(slot.actualExecutorThreadId,"01a192ed-0c8f-7411-a5b6-f40ea6104f07");assert.equal(slot.workerThreadId,"01a192ed-0c8f-7411-a5b6-f40ea6104f07");assert.equal(resolve(slot.workspace),resolve(process.cwd()));assert.ok(Date.parse(slot.validUntil)>Date.now());assert.ok(slot.argv.includes("lib/current-lifecycle-private-producer.test.ts"));
 const lock=JSON.parse(await readFile(resolve(dirname(receiptPath),"../../../../..","relay-local-sql-exclusive-slot.lock"),"utf8"));assert.equal(lock.taskId,slot.actualTaskId);assert.equal(lock.nonce,basename(receiptPath).replace(/-slot\.json$/,""));assert.ok(Number.isSafeInteger(lock.pid)&&lock.pid>0);
 const {PGlite}=await import("@electric-sql/pglite");const db=await PGlite.create();
 type AppleData=Record<string,unknown>;type CurrentScopeReference=keyof typeof CURRENT_AUTH_SCOPE_REFERENCES;

 function freezeFixture<T>(v:T):T{if(v&&typeof v==="object"){Object.values(v).forEach(freezeFixture);Object.freeze(v);}return v;}
 try{
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
  await db.exec("begin read only;set local search_path=''");
  assert.equal((await db.query<{p:string}>("select current_setting('search_path') p")).rows[0].p,'""');
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

 const single=(name:string,body:unknown)=>serial(async()=>{assert.match(name,/^wd_[a-z0-9_]+$/);await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:"service_role"})]);await db.exec("set role service_role");return(await db.query<{r:unknown}>(`select public.${name}($1::jsonb)r`,[JSON.stringify(body)])).rows[0].r;});
 let effects=0,lost=false,originalReadMode="sql";const actions:string[]=[];
 const transport:typeof fetch=async(url,init)=>{
  const u=new URL(String(url));assert.equal(u.origin,ORIGIN,"synthetic local only");actions.push((init?.method??"GET")+":"+u.pathname);
  const token=new Headers(init?.headers).get("authorization")?.replace(/^Bearer /,"")??"";
  const uid=token.split(".").length===3?JSON.parse(Buffer.from(token.split(".")[1],"base64url").toString()).sub??A:A;
  if(u.pathname==="/auth/v1/user")return Response.json({...authRow(uid),email_confirmed_at:iso(Date.now())});
  if(u.pathname.startsWith("/auth/v1/admin/users/")){
   const id=u.pathname.split("/").at(-1)!;if(init?.method==="DELETE"){effects++;await admin("delete from auth.users where id=$1",[id]);if(lost)throw Error("synthetic local effect ACK lost");return Response.json({});}
   const row=await admin("select id from auth.users where id=$1",[id]);return row.rows.length?Response.json(authRow(id)):Response.json({code:"user_not_found"},{status:404});
  }
  const name=u.pathname.split("/").at(-1)!,body=JSON.parse(String(init?.body));
  if(body.p_action)actions.push("rpc-action:"+body.p_action);
  if(name==="wd_apple_deletion_command"&&body.p_action==="auth_original"){
   if(originalReadMode==="lost")throw Error("synthetic original read ACK lost");
   if(originalReadMode==="extra")return Response.json({error:"original_unresolved",extra:true});
  }
  if(name==="wd_account_command")return Response.json(await serial(async()=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role:"authenticated",sub:uid,is_anonymous:false,amr:[{method:"password",timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec("set role authenticated");return(await db.query<{r:unknown}>("select public.wd_account_command($1,$2::jsonb,$3::uuid)r",[body.p_action,JSON.stringify(body.p_body),body.p_key])).rows[0].r;}));
  if(name==="wd_current_ephemeral_deletion_receipt_cleanup")return Response.json(await single(name,body.p));
  if(["wd_current_lifecycle_deployment_metadata","wd_current_lifecycle_projection","wd_current_contact_preflight","wd_current_contact_auth_scope_observe","wd_current_contact_local_deletion_barrier","wd_current_original_status_material"].includes(name))return Response.json(await single(name,body.p_body));
  assert.ok(["wd_deletion_v2_account_command","wd_deletion_v2_worker_command","wd_apple_deletion_command","wd_apple_custody_command","wd_apple_revocation_command","wd_current_retention_inventory_command","wd_current_credential_expiry_command"].includes(name),"fixed maintained RPC: "+name);
  return Response.json(await rpc(name,body.p_action,body.p_body,uid,name==="wd_deletion_v2_account_command"?"authenticated":"service_role"));
 };
 const now=Date.now(),sourceIdentity=(await metadata("select encode(sha256(convert_to(concat(pg_get_functiondef('public.wd_current_lifecycle_deployment_metadata(jsonb)'::regprocedure),pg_get_functiondef('public.wd_current_lifecycle_projection(jsonb)'::regprocedure),pg_get_functiondef('public.wd_current_contact_legacy_empty(jsonb)'::regprocedure),pg_get_functiondef('public.wd_current_original_status_material(jsonb)'::regprocedure)),'UTF8')),'hex') hash"));
 const count=Number((await admin("select count(*)::int n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','auth','storage','wd_current_private','wd_deletion_v2_private','wd_apple_private') and c.relkind in('r','p','v','m','f')")).rows[0].n);
 const f=releaseFixture(now,{sourceIdentitySha256:sourceIdentity,expectedCatalogSha256:approvedOperator.expectedCatalogSha256,expectedEngineSha256:approvedOperator.expectedEngineSha256,writerManifestSha256:approvedOperator.writerManifestSha256,writerCatalogSha256:approvedOperator.writerCatalogSha256,retentionSchemaSha256:retentionMeta.schemaSha256,retentionEraserSha256:retentionMeta.eraserSha256,domain:{catalogObjectCount:count,classifiedDomainCount:count,unknownDomainCount:0,overflow:false}});
 // Fixture release captured independently BEFORE owner/original setup. All source
 // file pins are actual maintained package bytes, never a future scope response.
 f.m.sourcePins=Object.fromEntries(await Promise.all(["current-lifecycle-private-producer.server.ts","current-integration-host.server.ts","current-integration-configuration.server.ts","current-lifecycle-deployment-manifest.server.ts","current-lifecycle-projection.server.ts","current-uuid-lifecycle-host-admission.server.ts","current-uuid-claim-scope.server.ts","current-uuid-claim-auth.server.ts","current-uuid-scope-rpc.server.ts","current-original-status-recovery.server.ts","account-deletion-v2.server.ts"].map(async n=>["lib/"+n,sha(await readFile(new URL("./"+n,import.meta.url),"utf8"))])));
 assert.equal(LIFECYCLE_REQUIRED_MIGRATIONS.length,25);assert.ok(LIFECYCLE_REQUIRED_MIGRATIONS.includes("supabase/migrations/0033_wd_current_original_status_recovery.sql"));
 f.m.migrationPins=Object.fromEntries(LIFECYCLE_REQUIRED_MIGRATIONS.map(k=>[k,sha(ddl.get(k.split("/").at(-1)!)!)]));
 const bytes=JSON.stringify(f.m),release:CurrentLifecycleRelease={...f.release,expectation:{...f.release.expectation,sha256:sha(bytes),sourcePins:f.m.sourcePins,migrationPins:f.m.migrationPins}};
 const pair=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
 const env={WD_CURRENT_INTEGRATION_HOST_ORIGIN:HOST,SUPABASE_URL:ORIGIN,SUPABASE_ANON_KEY:jwt("anon",A,now),SUPABASE_SERVICE_ROLE_KEY:jwt("service_role",A,now),WD_CURRENT_UUID_LIFECYCLE_ENABLED:"true",WD_CURRENT_LIFECYCLE_DEPLOYMENT_MANIFEST_JSON:bytes,APPLE_SIGNIN_CLIENT_ID:"com.wisedinner.app",APPLE_SIGNIN_TEAM_ID:"TESTTEAM01",APPLE_SIGNIN_KEY_ID:"TESTKEY001",APPLE_SIGNIN_PRIVATE_KEY:pair.privateKey.export({type:"pkcs8",format:"pem"}).toString(),WD_CURRENT_LIFECYCLE_MATERIAL_JSON:JSON.stringify({profile:UUID_DELETE_PROFILE,profilePolicyVersion:UUID_DELETE_PROFILE,secretSeconds:300,keyVersion:"test",keyring:{test:randomBytes(32).toString("base64")},applePolicy:custody,deletionPolicy:policy,validUntil:iso(now+600000)})};
 await db.exec("commit;reset role");
 await admin("insert into auth.users(id,email,email_confirmed_at,email_change_confirm_status)values($1,'a@example.invalid',now(),0),($2,'b@example.invalid',now(),0)",[A,B]);await admin("insert into public.wd_accounts(user_id)values($1),($2)",[A,B]);
 const identity=await supabaseDeletionAuthV2(ORIGIN,env.SUPABASE_SERVICE_ROLE_KEY,transport).verifyIdentity(A);assert.ok(identity);
 const send=(r:Request,environment:unknown=env)=>withCurrentPrivateHostInputs({environment,release,request:transport,now:Date.now},()=>deletionPOST(r));
 async function trial(fn:()=>Promise<void>){await admin("begin");try{await fn();}finally{await serial(async()=>{await db.exec("rollback;reset role");});}}
 for(const mode of ["matched","ambiguous"])await t.test("early "+mode+" contact holds before prepare and preserves records",()=>trial(async()=>{
  await serial(async()=>{await db.exec("reset role");await db.exec(mode==="matched"?"insert into public.waitlist(email)values('a@example.invalid')":"insert into public.support_messages(id,email,message)values('30000000-0000-4000-8000-000000000001','a@example.invalid','synthetic');insert into public.support_threads(id,channel,from_email,legacy_id)values('30000000-0000-4000-8000-000000000002','form','other@example.invalid','30000000-0000-4000-8000-000000000001')");});
  const before=effects,o=original(),r=await send(request(o,"prepare",A,Date.now()));assert.equal(r.status,503);assert.equal(effects,before);
  assert.equal(Number((await admin("select count(*)::int n from wd_deletion_v2_private.intents")).rows[0].n),0);
  assert.equal(Number((await admin(mode==="matched"?"select count(*)::int n from public.waitlist":"select count(*)::int n from public.support_messages")).rows[0].n),1);
 }));
 for(const mode of ["extra","lost"])await t.test("original read "+mode+" is not a fresh-scope sentinel",()=>trial(async()=>{
  originalReadMode=mode;try{const before=effects,o=original();assert.equal((await send(request(o,"prepare",A,Date.now()))).status,200);const response=await send(request(o,"confirm",A,Date.now()));assert.equal(response.status,200);assert.equal((await response.json()).result.authDeletion,"unknown");assert.equal(effects,before);}finally{originalReadMode="sql";}
 }));
 for(const lose of [false,true])await t.test(lose?"one local effect ACK lost then original no-JWT GET recovery":"fresh actual default POST through issuer/preflight gives one local fake effect",()=>trial(async()=>{
  lost=lose;const before=effects,o=original();
  const prepared=await send(request(o,"prepare",A,Date.now()));assert.equal(prepared.status,200,JSON.stringify(await prepared.clone().json()));
  const confirmed=await send(request(o,"confirm",A,Date.now()));const body=await confirmed.json();
  if(confirmed.status!==200||effects!==before+1){
   const gateSource=(await admin("select prosrc s from pg_proc where oid='public.wd_current_contact_legacy_empty(jsonb)'::regprocedure")).rows[0].s as string;
   const match=gateSource.match(/if \((select count\(\*\) from pg_proc[^;]*?)\)<>51/);assert.ok(match,"actual exact count guard");
   const actual=(await admin("select ("+match[1]+") as n")).rows[0];
   t.diagnostic(JSON.stringify({kind:"protected0032and0033composition",expectedCount:51,actualCount:Number(actual.n),newFunction:"wd_current_original_status_material(jsonb)",response:body,actions:actions.slice(-18)}));
  }
  assert.equal(confirmed.status,200,JSON.stringify(body));assert.equal(effects,before+1,JSON.stringify(body));assert.equal(body.result.authDeletion,lose?"unknown":"confirmed");
  const priorActions=actions.length;
  const status=await send(request(o,"status",A,Date.now()),{WD_CURRENT_INTEGRATION_HOST_ORIGIN:HOST,SUPABASE_URL:ORIGIN,SUPABASE_SERVICE_ROLE_KEY:env.SUPABASE_SERVICE_ROLE_KEY});
  assert.equal(status.status,200);assert.equal((await status.json()).result.authDeletion,"confirmed");assert.equal(effects,before+1);
  assert.ok(!actions.slice(priorActions).some(x=>x.startsWith("DELETE")||x.includes("cleanup")||x.includes("scope_observe")||["rpc-action:scope_admit","rpc-action:auth_begin","rpc-action:admit_original"].includes(x)));
  if(lose)assert.ok(actions.slice(priorActions).some(x=>x.startsWith("GET:/auth/v1/admin/users/")),"actual original GET required");
 }));
 }finally{await db.close();}
});







test("actual default original status works before current flags/Apple/policy/manifest and needs no fresh JWT",async()=>{
 const o=original(),calls:string[]=[],r=request(o,"status");
 const response=await withCurrentPrivateHostInputs({environment:{WD_CURRENT_INTEGRATION_HOST_ORIGIN:HOST,SUPABASE_URL:ORIGIN,SUPABASE_SERVICE_ROLE_KEY:jwt("service_role")},release:null,now:()=>NOW,request:async(url,init)=>{
  calls.push(String(url));assert.equal(String(url),ORIGIN+"/rest/v1/rpc/wd_deletion_v2_worker_command");const b=JSON.parse(String(init?.body));assert.equal(b.p_action,"status");
  return Response.json({contract:"wd-account-deletion-v2",operationId:o.operationId,intentSha256:o.intentSha256,receiptRevision:1,intentState:"unknown",applicationData:"unknown",authDeletion:"unknown",appleRevocation:"unknown",manualAppleRemoval:"recommended",subscriptionCancelled:false,clientDisposition:"reauthentication_available",retainedEvidence:["deletion_receipt"],nextAction:"original_status_required"});
 }},()=>deletionPOST(r));
 assert.equal(response.status,200);assert.equal((await response.json()).operationId,o.operationId);assert.equal(response.headers.get("cache-control"),"no-store");assert.equal(calls.length,1);
});
