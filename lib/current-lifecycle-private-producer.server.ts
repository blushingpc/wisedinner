import { AsyncLocalStorage } from "node:async_hooks";
import { isProxy } from "node:util/types";
import { supabaseVerifier, supabaseAccountRepository, type VerifiedAccount } from "./account.ts";
import { supabaseDeletionAuthV2, inspectDeletionV2Policy } from "./account-deletion-v2.server.ts";
import { appleDigest, appleExact, appleHash, appleHttp, appleUuid, inspectApplePolicy } from "./apple-token-custody.server.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { checkCurrentLifecycleDeploymentManifest, lifecycleCopy, lifecycleFreeze, lifecycleInt, lifecycleOwn, lifecycleTime, type LifecycleManifestExpectation } from "./current-lifecycle-deployment-manifest.server.ts";
import { createCurrentLifecycleProjectionRepository } from "./current-lifecycle-projection.server.ts";
import { CURRENT_CONTACT_CATALOG_PROFILE, CURRENT_CONTACT_CATALOG_IDENTITY } from "./current-legacy-contact-catalog-profile.server.ts";
import type { CurrentIntegrationPrivateConfiguration, CurrentOwnerLifecycleInputs } from "./current-integration-configuration.server.ts";

export type CurrentLifecyclePolicyRecord = Readonly<{id:string;deletionPolicy:unknown;custodyPolicy:unknown;validUntil:string}>;
export type CurrentLifecycleRelease = Readonly<{expectation:LifecycleManifestExpectation;policyRecord:CurrentLifecyclePolicyRecord}>;
// No deployed manifest/policy approval has been supplied. Main replaces this
// closed release record only after independent exact-byte release review.
// Environment JSON cannot supply the expectation or approve its own digest.
export const CURRENT_LIFECYCLE_RELEASE: CurrentLifecycleRelease | null = null;
export const CURRENT_PRIVATE_PRODUCER_CONFIG_NAMES = Object.freeze(["WD_CURRENT_LIFECYCLE_DEPLOYMENT_MANIFEST_JSON"] as const);
export type CurrentPrivateHostInputs = Readonly<{environment:unknown;request:typeof fetch;now():number;release:CurrentLifecycleRelease|null}>;
const hostInputs = new AsyncLocalStorage<CurrentPrivateHostInputs>();
/** Trusted server composition, not a public endpoint or owner/admission port. */
export function withCurrentPrivateHostInputs<T>(input:CurrentPrivateHostInputs,work:()=>T):T {
 const d=lifecycleOwn(input,["environment","request","now","release"]);
 const fn=d.request.value,clock=d.now.value;
 if(typeof fn!=="function"||typeof clock!=="function"||isProxy(fn)||isProxy(clock))throw Error("private_host_configuration");
 const environment=d.environment.value;
 if(!environment||typeof environment!=="object"||isProxy(environment))throw Error("private_host_configuration");
 const ds=Object.getOwnPropertyDescriptors(environment);
 if(Reflect.ownKeys(ds).some(k=>typeof k!=="string")||Object.values(ds).some(v=>!("value"in v)))throw Error("private_host_configuration");
 const snapshot=Object.freeze(Object.fromEntries(Object.entries(ds).map(([k,v])=>[k,v.value])));
 const release=d.release.value===null?null:lifecycleFreeze(lifecycleCopy(d.release.value) as CurrentLifecycleRelease);
 const request:typeof fetch=(url,init)=>Reflect.apply(fn,input,[url,init]) as Promise<Response>;
 return hostInputs.run(Object.freeze({environment:snapshot,release,request,now:()=>Reflect.apply(clock,input,[]) as number}),work);
}
export function currentPrivateHostInputs():CurrentPrivateHostInputs {
 return hostInputs.getStore()??{environment:process.env,request:fetch,now:Date.now,release:CURRENT_LIFECYCLE_RELEASE};
}
export type CurrentPrivateProducerConfiguration = Readonly<{
 enabled:boolean;origin:string;publicAuthKey:string;serverCredential:string;
 manifestBytes:string;release:CurrentLifecycleRelease|null;originalRequest:Request;prepare:boolean;
 request:typeof fetch;now():number;
}>;
/** Pure constructor; actual request-time facts never become expected authority. */
export function createCurrentLifecyclePrivateProducer(config?:CurrentPrivateProducerConfiguration):CurrentIntegrationPrivateConfiguration & {inspect():Readonly<{state:"held"|"configured";reason:string;providerVerified:false;productionReady:false}>} {
 let c:Omit<CurrentPrivateProducerConfiguration,"request"|"now">|undefined;
 let transport:typeof fetch=fetch,clock:()=>number=Date.now,reason="private_configuration_missing";
 try {
  const d=lifecycleOwn(config,["enabled","origin","publicAuthKey","serverCredential","manifestBytes","release","originalRequest","prepare","request","now"]);
  if(d.enabled.value!==true||d.origin.value!=="https://zpvqxtklvjitofpbddrn.supabase.co")throw Error();
  if(typeof d.publicAuthKey.value!=="string"||!d.publicAuthKey.value||typeof d.serverCredential.value!=="string"||!d.serverCredential.value||typeof d.manifestBytes.value!=="string"||!d.manifestBytes.value)throw Error();
  if(isProxy(d.originalRequest.value)||!(d.originalRequest.value instanceof Request)||typeof d.prepare.value!=="boolean")throw Error();
  const fn=d.request.value,now=d.now.value;
  if(typeof fn!=="function"||typeof now!=="function"||isProxy(fn)||isProxy(now))throw Error();
  const release=lifecycleCopy(d.release.value) as CurrentLifecycleRelease;
  lifecycleOwn(release,["expectation","policyRecord"]);lifecycleOwn(release.policyRecord,["id","deletionPolicy","custodyPolicy","validUntil"]);
  c=Object.freeze({enabled:true,origin:d.origin.value,publicAuthKey:d.publicAuthKey.value,serverCredential:d.serverCredential.value,manifestBytes:d.manifestBytes.value,release:lifecycleFreeze(release),originalRequest:d.originalRequest.value,prepare:d.prepare.value});
  transport=(url,init)=>Reflect.apply(fn,config,[url,init]);clock=()=>Reflect.apply(now,config,[]);reason="request_facts_unobserved";
 }catch{c=undefined;}
 const captured=c;
 return Object.freeze({inspect:()=>Object.freeze({state:captured?"configured" as const:"held" as const,reason,providerVerified:false as const,productionReady:false as const}),async forOwner(value:Readonly<Omit<VerifiedAccount,"providers"> & {providers:readonly string[]}>):Promise<CurrentOwnerLifecycleInputs|null>{
  try {
   if(!captured)return null;
   const a=appleExact(lifecycleCopy(value),["id","token","authenticatedAt","providers"]);appleUuid(a.id);
   if(typeof a.token!=="string"||!a.token||a.token.length>16384||!Array.isArray(a.providers)||a.providers.some(v=>typeof v!=="string")||a.authenticatedAt!==null&&!Number.isSafeInteger(a.authenticatedAt)||captured.originalRequest.signal.aborted)throw Error();
   const start=lifecycleInt(clock(),0,Number.MAX_SAFE_INTEGER),r=captured.release!;
   const manifest=checkCurrentLifecycleDeploymentManifest(captured.manifestBytes,r.expectation,start);
   const record=r.policyRecord;
   if(!manifest||record.id!==manifest.policyRecordId||lifecycleTime(record.validUntil)<=start)throw Error();
   const policy=inspectDeletionV2Policy(record.deletionPolicy),custody=inspectApplePolicy(record.custodyPolicy);
   if(appleDigest(policy)!==manifest.deletionPolicySha256||appleDigest(custody)!==manifest.custodyPolicySha256)throw Error();
   const verify=supabaseVerifier(captured.origin,captured.publicAuthKey,transport,clock),accounts=supabaseAccountRepository(captured.origin,captured.publicAuthKey,transport);
   const identity=supabaseDeletionAuthV2(captured.origin,captured.serverCredential,transport,3000).verifyIdentity;
   async function current(){
    const owner=await verify(captured!.originalRequest);
    if(owner.id!==a.id||owner.token!==a.token)throw Error();
    const row=appleExact(await accounts.execute(owner,{action:"read",body:{},key:null}),["preferences","revision"]);
    const revision=lifecycleInt(row.revision,1),id=await identity(owner.id);
    if(!id||id.userId!==owner.id)throw Error();appleHash(id.identityHash);
    return {owner,revision,identityHash:id.identityHash};
   }
   const before=await current();
   const q=Object.freeze({userId:before.owner.id,identityHash:before.identityHash,accountRevision:before.revision,manifestIdentity:manifest.releaseId,profile:manifest.observerProfile,catalogIdentity:manifest.catalogIdentity});
   const repository=createCurrentLifecycleProjectionRepository({manifest,expectedMetadataRequest:q,deletionPolicy:policy,custodyPolicy:custody,serverCredential:captured.serverCredential,request:transport,now:clock,timeoutMs:3000});
   const metadata=await repository.readMetadata(q);if(!metadata)throw Error();
   if(captured.prepare){
    const reply=await appleHttp(captured.origin+"/rest/v1/rpc/wd_current_contact_preflight",{method:"POST",headers:{apikey:captured.serverCredential,authorization:"Bearer "+captured.serverCredential,"content-type":"application/json"},body:JSON.stringify({p_body:{userId:q.userId,accountRevision:q.accountRevision}})},transport,16384,3000);
    if(reply.status!==200)throw Error();
    const contact=appleExact(parseReferenceJson(reply.text),["outcome","matched","ambiguousCount","contactScopeSha256"]),matches=appleExact(contact.matched,["waitlist","supportMessages","supportThreads","supportMessagesV2"]);
    appleHash(contact.contactScopeSha256);
    if(contact.outcome!=="clear"||lifecycleInt(contact.ambiguousCount)!==0||Object.values(matches).some(v=>lifecycleInt(v)!==0))throw Error();
   }
   const after=await current(),end=lifecycleInt(clock(),0,Number.MAX_SAFE_INTEGER);
   if(after.owner.id!==before.owner.id||after.revision!==before.revision||after.identityHash!==before.identityHash||end<start||end-start>3000||end>=lifecycleTime(manifest.validUntil)||end>=lifecycleTime(record.validUntil))throw Error();
   reason="private_facts_current";
   return Object.freeze({template:Object.freeze({deletionPolicy:policy,custodyPolicy:custody,expectedCatalogSha256:manifest.expectedCatalogSha256,expectedEngineSha256:manifest.expectedEngineSha256,writerManifestSha256:manifest.writerManifestSha256,writerCatalogSha256:manifest.writerCatalogSha256,validUntil:new Date(Math.min(lifecycleTime(manifest.validUntil),lifecycleTime(record.validUntil))).toISOString(),maxObservationAgeMs:3000,selectors:repository.selectors()}),observer:Object.freeze({profile:CURRENT_CONTACT_CATALOG_PROFILE,catalogIdentity:CURRENT_CONTACT_CATALOG_IDENTITY}),retention:Object.freeze({schemaSha256:manifest.retentionSchemaSha256,eraserSha256:manifest.retentionEraserSha256,maxRecords:128,freshnessMs:3000,clockSkewMs:1000,async readAdmission(input:Readonly<{policySha256:string;custodyPolicySha256:string;now:number}>){
    try{const i=appleExact(lifecycleCopy(input),["policySha256","custodyPolicySha256","now"]);if(i.policySha256!==manifest.deletionPolicySha256||i.custodyPolicySha256!==manifest.custodyPolicySha256||Math.abs(lifecycleInt(i.now,0,Number.MAX_SAFE_INTEGER)-clock())>1000)throw Error();
     const m=await repository.readMetadata(q),now=lifecycleInt(clock(),0,Number.MAX_SAFE_INTEGER);if(!m||now>=lifecycleTime(record.validUntil))throw Error();
     return {outcome:"admitted",registryId:"wd-apple-custody-v1",policySha256:i.policySha256,custodyPolicySha256:i.custodyPolicySha256,schemaSha256:m.retentionSchemaSha256,eraserSha256:m.retentionEraserSha256,observedAt:Date.parse(m.observedAt),validUntil:Math.min(Date.parse(m.validUntil),lifecycleTime(manifest.validUntil),lifecycleTime(record.validUntil),now+3000)};
    }catch{return {outcome:"held"};}
   }})});
  }catch{reason="private_facts_missing_drifted_or_expired";return null;}
 }});
}

/** Exact named server inputs only; no discovery or secret store/file load. */
export function createCurrentLifecyclePrivateProducerForHost(environment:unknown,originalRequest:Request,prepare:boolean,request:typeof fetch,now:()=>number,release:CurrentLifecycleRelease|null=CURRENT_LIFECYCLE_RELEASE){
 const read=(name:string):string=>{if(!environment||typeof environment!=="object"||isProxy(environment))throw Error();const d=Object.getOwnPropertyDescriptor(environment,name);if(d&&(!("value"in d)||d.value!==undefined&&typeof d.value!=="string"))throw Error();return d?.value??"";};
 try{return createCurrentLifecyclePrivateProducer({enabled:read("WD_CURRENT_UUID_LIFECYCLE_ENABLED")==="true",origin:read("SUPABASE_URL")||read("NEXT_PUBLIC_SUPABASE_URL"),publicAuthKey:read("SUPABASE_ANON_KEY")||read("NEXT_PUBLIC_SUPABASE_ANON_KEY"),serverCredential:read("SUPABASE_SERVICE_ROLE_KEY"),manifestBytes:read("WD_CURRENT_LIFECYCLE_DEPLOYMENT_MANIFEST_JSON"),release,originalRequest,prepare,request,now});}catch{return createCurrentLifecyclePrivateProducer();}
}



