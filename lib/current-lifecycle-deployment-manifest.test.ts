import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFile} from "node:fs/promises";
import {checkCurrentLifecycleDeploymentManifest,LIFECYCLE_MANIFEST,LIFECYCLE_PROJECTION,LIFECYCLE_REQUIRED_MIGRATIONS,isCheckedLifecycleDeploymentManifest,lifecycleCopy} from "./current-lifecycle-deployment-manifest.server.ts";
import {createCurrentLifecycleProjectionRepository} from "./current-lifecycle-projection.server.ts";
import {CURRENT_AUTH_SCOPE_REFERENCES} from "./current-auth-scope.server.ts";
import {CURRENT_CONTACT_CATALOG_PROFILE,CURRENT_CONTACT_CATALOG_IDENTITY} from "./current-legacy-contact-catalog-profile.server.ts";
import {UUID_DELETE_PROFILE} from "./current-uuid-auth-scope.server.ts";
import {appleDigest} from "./apple-token-custody.server.ts";
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const h="a".repeat(64),now=Date.now(),iso=(n:number)=>new Date(n).toISOString();
const policy={approved:true as const,version:UUID_DELETE_PROFILE,preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt"]};
const custody={approved:true as const,version:"synthetic-only",credentialSeconds:600,recoverySeconds:600,evidenceSeconds:600,retainedEvidence:["apple_credential_recovery"]};
function fixture(){
 const m={contract:LIFECYCLE_MANIFEST,releaseId:"synthetic-test-only",project:"zpvqxtklvjitofpbddrn",origin:"https://zpvqxtklvjitofpbddrn.supabase.co",profile:UUID_DELETE_PROFILE,observerProfile:CURRENT_CONTACT_CATALOG_PROFILE,catalogIdentity:CURRENT_CONTACT_CATALOG_IDENTITY,sourcePins:{"lib/current-lifecycle-projection.server.ts":h},migrationPins:Object.fromEntries(LIFECYCLE_REQUIRED_MIGRATIONS.map(k=>[k,h])),policyRecordId:"synthetic-policy-not-approval",deletionPolicySha256:appleDigest(policy),custodyPolicySha256:appleDigest(custody),sourceIdentitySha256:h,expectedCatalogSha256:h,expectedEngineSha256:h,writerManifestSha256:h,writerCatalogSha256:h,retentionSchemaSha256:h,retentionEraserSha256:h,projectionIdentity:LIFECYCLE_PROJECTION,referenceBounds:Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k=>[k,128])),domain:{catalogObjectCount:40,classifiedDomainCount:40,unknownDomainCount:0,overflow:false},capture:{searchPath:"",role:"postgres",recipeSha256:h,receiptSha256:h},observedAt:iso(now-1),validUntil:iso(now+100000)};
 const bytes=JSON.stringify(m),e={sha256:hash(bytes),releaseId:m.releaseId,sourcePins:m.sourcePins,migrationPins:m.migrationPins,policyRecordId:m.policyRecordId,deletionPolicySha256:m.deletionPolicySha256,custodyPolicySha256:m.custodyPolicySha256,recipeSha256:h};
 return{m,bytes,e};
}
test("independently pinned bytes checked before duplicate-key JSON parsing; detached immutable issuance",()=>{
 const {m,bytes,e}=fixture(),checked=checkCurrentLifecycleDeploymentManifest(bytes,e,now);
 assert.ok(checked);assert.ok(isCheckedLifecycleDeploymentManifest(checked));assert.equal(isCheckedLifecycleDeploymentManifest(structuredClone(checked)),false);
 m.referenceBounds.accountTombstone=1;assert.equal(checked.referenceBounds.accountTombstone,128);assert.ok(Object.isFrozen(checked.referenceBounds));
 assert.equal(checkCurrentLifecycleDeploymentManifest(bytes+" ",e,now),null);
 const bad='{"contract":"a","contract":"b"}';assert.equal(checkCurrentLifecycleDeploymentManifest(bad,{...e,sha256:hash(bad)},now),null);
});
test("current complete release requires accepted0033 even when a24-migration artifact is independently pinned",()=>{
 const {m,e}=fixture();const legacy={...m.migrationPins};delete legacy["supabase/migrations/0033_wd_current_original_status_recovery.sql"];
 const bytes=JSON.stringify({...m,migrationPins:legacy});
 assert.equal(checkCurrentLifecycleDeploymentManifest(bytes,{...e,sha256:hash(bytes),migrationPins:legacy},now),null);
 assert.ok(LIFECYCLE_REQUIRED_MIGRATIONS.includes("supabase/migrations/0033_wd_current_original_status_recovery.sql"));
});
for(const kind of ["project","profile","policy","source","migration","omittedAncestor","extraMigration","context","domain","overflow","bound","expired","future","tooLong","extra"]){
 test("manifest closed rejection: "+kind,()=>{
  const {m,e}=fixture();const row=m as unknown as Record<string,unknown>;
  if(kind==="project")row.project="other";if(kind==="profile")row.profile="other";if(kind==="policy")row.policyRecordId="other";
  if(kind==="source")row.sourcePins={"lib/other.ts":h};if(kind==="migration")row.migrationPins={};
  if(kind==="omittedAncestor")row.migrationPins={"supabase/migrations/0032_wd_current_private_lifecycle_projection.sql":h};
  if(kind==="extraMigration")row.migrationPins={...m.migrationPins,"supabase/migrations/0099_unreviewed.sql":h};
  if(kind==="context")row.capture={...m.capture,searchPath:"public"};
  if(kind==="domain")row.domain={...m.domain,unknownDomainCount:1};
  if(kind==="overflow")row.domain={...m.domain,overflow:true};if(kind==="bound")m.referenceBounds.accountTombstone=129;
  if(kind==="expired")row.validUntil=iso(now);if(kind==="future")row.observedAt=iso(now+1);
  if(kind==="tooLong")row.validUntil=iso(now+86400001);if(kind==="extra")row.approved=true;
  const bytes=JSON.stringify(m);assert.equal(checkCurrentLifecycleDeploymentManifest(bytes,{...e,sha256:hash(bytes)},now),null);
 });
}
test("disabled/forged/config accessors/proxies cause zero constructor or method I/O",async()=>{
 let calls=0,traps=0;const {bytes,e}=fixture();const manifest=checkCurrentLifecycleDeploymentManifest(bytes,e,now)!;
 const base={manifest,expectedMetadataRequest:{userId:"10000000-0000-4000-8000-000000000001",identityHash:h,accountRevision:1,manifestIdentity:manifest.releaseId,profile:manifest.observerProfile,catalogIdentity:manifest.catalogIdentity},deletionPolicy:policy,custodyPolicy:custody,serverCredential:"bad",request:async()=>{calls++;throw Error("must not call");}};
 const getter=Object.defineProperty({...base},"serverCredential",{get(){traps++;return"bad";},enumerable:true});
 const proxy=new Proxy(base,{ownKeys(){traps++;throw Error("trap");}});
 for(const v of [undefined,{...base,manifest:{...manifest}},getter,proxy,{...base,extra:true}]){const repo=createCurrentLifecycleProjectionRepository(v as never);assert.equal(await repo.readMetadata(base.expectedMetadataRequest),null);assert.deepEqual(repo.selectors(),[]);}
 assert.equal(calls,0);assert.equal(traps,0);
 assert.throws(()=>lifecycleCopy(new Proxy({},{ownKeys(){traps++;return[];}})));assert.equal(traps,0);
});
test("source-only runtime has no Node fs/env/discovery or eager secret-loading seam",async()=>{
 const source=await readFile(new URL("./current-lifecycle-projection.server.ts",import.meta.url),"utf8");
 assert.doesNotMatch(source,/node:fs|process\.env|readFile|setInterval/);
});

function configured(mode:string){
 const f=fixture(),manifest=checkCurrentLifecycleDeploymentManifest(f.bytes,f.e,now)!;
 const q={userId:"10000000-0000-4000-8000-000000000001",identityHash:h,accountRevision:1,manifestIdentity:manifest.releaseId,profile:manifest.observerProfile,catalogIdentity:manifest.catalogIdentity};
 let calls=0,reads=0,current=now;
 const credential=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),Buffer.from(JSON.stringify({role:"service_role",ref:"zpvqxtklvjitofpbddrn",exp:Math.floor(now/1000)+1000})).toString("base64url"),Buffer.alloc(32,1).toString("base64url")].join(".");
 const input={manifest,expectedMetadataRequest:{...q},deletionPolicy:structuredClone(policy),custodyPolicy:structuredClone(custody),serverCredential:credential,timeoutMs:mode==="timeout"?5:3000,now(){return current;},async request(url:unknown,init?:RequestInit){
  calls++;assert.equal(this,input);assert.equal(String(url),"https://zpvqxtklvjitofpbddrn.supabase.co/rest/v1/rpc/wd_current_lifecycle_deployment_metadata");assert.equal(init?.redirect,"error");assert.equal((init?.headers as Record<string,string>).apikey,credential);
  assert.deepEqual(JSON.parse(String(init?.body)),{p_body:q});
  const row={...q,contract:"wd-current-lifecycle-deployment-metadata-v1",observedAt:iso(now),validUntil:iso(now+3000),sourceIdentitySha256:h,catalogSha256:h,engineSha256:h,writerManifestSha256:h,writerCatalogSha256:h,retentionSchemaSha256:h,retentionEraserSha256:h,domain:manifest.domain} as Record<string,unknown>;
  if(mode==="timeout")return new Promise<Response>(()=>{});
  if(mode==="throw")throw Error("synthetic lost read ACK");
  if(mode==="malformed")return new Response("{",{headers:{"content-type":"application/json"}});
  if(mode==="identity")row.identityHash="b".repeat(64);
  if(mode==="digest")row.catalogSha256="b".repeat(64);
  if(mode==="domain")row.domain={...manifest.domain,unknownDomainCount:1};
  if(mode==="expired")row.validUntil=iso(now);
  if(mode==="future")row.observedAt=iso(now+1);
  if(mode==="extra")row.allowed=true;
  if(mode==="midawait")current=now+200000;
  return Response.json(row);
 }};
 Object.defineProperty(input.request,"bind",{get(){reads++;throw Error("bind accessor must not run");}});
 const repo=createCurrentLifecycleProjectionRepository(input);assert.equal(calls,0);assert.equal(reads,0);
 return{repo,input,q,stats:()=>({calls,reads}),advance:(n:number)=>{current=n;}};
}
test("valid repository captures method receivers and detaches configuration without eager I/O",async()=>{
 const f=configured("valid");f.input.serverCredential="mutated";f.input.expectedMetadataRequest.accountRevision=999;f.input.deletionPolicy.retainedEvidence.length=0;
 const result=await f.repo.readMetadata(f.q);assert.ok(result);assert.ok(Object.isFrozen(result.domain));
 assert.deepEqual(f.stats(),{calls:1,reads:0});assert.equal(f.repo.selectors().length,5);
});
for(const mode of ["throw","malformed","identity","digest","domain","expired","future","extra","midawait","timeout"]){
 test("repository read uncertainty/drift held without retry: "+mode,async()=>{
  const f=configured(mode);assert.equal(await f.repo.readMetadata(f.q),null);assert.deepEqual(f.stats(),{calls:1,reads:0});
 });
}
test("foreign request, expired release and malformed request are zero I/O",async()=>{
 const f=configured("valid");assert.equal(await f.repo.readMetadata({...f.q,userId:"10000000-0000-4000-8000-000000000002"}),null);
 assert.equal(await f.repo.readMetadata({...f.q,approved:true} as never),null);
 f.advance(now+200000);assert.equal(await f.repo.readMetadata(f.q),null);assert.equal(f.stats().calls,0);
});


