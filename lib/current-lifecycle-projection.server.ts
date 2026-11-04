import { isProxy } from "node:util/types";
import { appleDigest,appleExact,appleHash,appleHttp,appleObject,appleText,appleUuid,inspectApplePolicy,type ApplePolicy } from "./apple-token-custody.server.ts";
import { inspectDeletionV2Policy,type DeletionV2Policy } from "./account-deletion-v2.server.ts";
import { CURRENT_AUTH_SCOPE,CURRENT_AUTH_SCOPE_REFERENCES,type CurrentScopeReference } from "./current-auth-scope.server.ts";
import type { ClaimProjection,ClaimProjectionRequest,ClaimReferenceSelector } from "./current-uuid-claim-scope.server.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { isCheckedLifecycleDeploymentManifest,LIFECYCLE_METADATA,LIFECYCLE_PROJECTION,lifecycleCopy,lifecycleFreeze,lifecycleHeld,lifecycleInt,lifecycleOwn,lifecycleTime,type LifecycleDeploymentManifest } from "./current-lifecycle-deployment-manifest.server.ts";
export type LifecycleMetadataRequest=Readonly<{userId:string;identityHash:string;accountRevision:number;manifestIdentity:string;profile:string;catalogIdentity:string}>;
export type LifecycleDeploymentMetadata=LifecycleMetadataRequest & Readonly<{
 contract:typeof LIFECYCLE_METADATA;observedAt:string;validUntil:string;sourceIdentitySha256:string;catalogSha256:string;engineSha256:string;writerManifestSha256:string;writerCatalogSha256:string;retentionSchemaSha256:string;retentionEraserSha256:string;
 domain:Readonly<{catalogObjectCount:number;classifiedDomainCount:number;unknownDomainCount:number;overflow:boolean}>;
}>;
export type LifecycleProjectionConfiguration=Readonly<{
 manifest:LifecycleDeploymentManifest;expectedMetadataRequest:LifecycleMetadataRequest;
 deletionPolicy:DeletionV2Policy;custodyPolicy:ApplePolicy;serverCredential:string;
 request?:typeof fetch;now?:()=>number;timeoutMs?:number;
}>;
export type LifecycleProjectionRepository=Readonly<{
 readMetadata(input:LifecycleMetadataRequest):Promise<LifecycleDeploymentMetadata|null>;
 select(input:ClaimProjectionRequest):Promise<ClaimProjection|null>;
 selectors():readonly ClaimReferenceSelector[];
}>;
const keys=Object.keys(CURRENT_AUTH_SCOPE_REFERENCES) as CurrentScopeReference[];
const requestKeys=["userId","identityHash","accountRevision","manifestIdentity","profile","catalogIdentity"];
const bindingKeys=["userId","identityHash","authOperationId","deletionOperationId","intentSha256","workOwner","workAttempt","leaseUntil"];
export function createCurrentLifecycleProjectionRepository(config?:LifecycleProjectionConfiguration):LifecycleProjectionRepository{
 let m:LifecycleDeploymentManifest|undefined,expected:LifecycleMetadataRequest|undefined,policy:DeletionV2Policy|undefined,custody:ApplePolicy|undefined;
 let key="",credentialExpiry=0,timeout=3000;
 let clock=Date.now,transport:typeof fetch=fetch;
 try{
  if(!config||isProxy(config))lifecycleHeld();
  const d=lifecycleOwn(config,["manifest","expectedMetadataRequest","deletionPolicy","custodyPolicy","serverCredential",...Object.keys(Object.getOwnPropertyDescriptors(config??{})).filter(k=>["request","now","timeoutMs"].includes(k))]);
  if(!isCheckedLifecycleDeploymentManifest(d.manifest.value))lifecycleHeld();m=d.manifest.value;
  expected=appleExact(lifecycleCopy(d.expectedMetadataRequest.value),requestKeys) as LifecycleMetadataRequest;
  appleUuid(expected.userId);appleHash(expected.identityHash);lifecycleInt(expected.accountRevision,1);
  if(expected.manifestIdentity!==m!.releaseId||expected.profile!==m!.observerProfile||expected.catalogIdentity!==m!.catalogIdentity)lifecycleHeld();
  policy=inspectDeletionV2Policy(lifecycleCopy(d.deletionPolicy.value));custody=inspectApplePolicy(lifecycleCopy(d.custodyPolicy.value));
  if(appleDigest(policy)!==m!.deletionPolicySha256||appleDigest(custody)!==m!.custodyPolicySha256)lifecycleHeld();
  key=appleText(d.serverCredential.value,16384);const parts=key.split(".");
  if(parts.length!==3||parts.some(p=>!/^[A-Za-z0-9_-]+$/.test(p)))lifecycleHeld();
  const decode=(p:string)=>{const b=Buffer.from(p,"base64url");if(b.toString("base64url")!==p)lifecycleHeld();return parseReferenceJson(new TextDecoder("utf-8",{fatal:true}).decode(b));};
  const h=appleObject(decode(parts[0])),c=appleObject(decode(parts[1]));
  if(h.alg!=="HS256"||h.typ!=="JWT"||Object.keys(h).some(k=>!["alg","typ","kid"].includes(k))||c.role!=="service_role"||c.ref!=="zpvqxtklvjitofpbddrn"||Buffer.from(parts[2],"base64url").length!==32||Buffer.from(parts[2],"base64url").toString("base64url")!==parts[2])lifecycleHeld();
  credentialExpiry=lifecycleInt(c.exp,1,Number.MAX_SAFE_INTEGER)*1000;if(!Number.isSafeInteger(credentialExpiry))lifecycleHeld();
  timeout=lifecycleInt(d.timeoutMs?.value??3000,1,8000);
  const fn=d.request?.value??fetch,now=d.now?.value??Date.now;
  if(typeof fn!=="function"||typeof now!=="function"||isProxy(fn)||isProxy(now))lifecycleHeld();
  // Preserve original receiver; never read bind/name/length.
  transport=(url,init)=>Promise.resolve(Reflect.apply(fn,config,[url,init]));
  clock=()=>Reflect.apply(now,config,[]);
  expected=lifecycleFreeze(expected);policy=lifecycleFreeze(policy);custody=lifecycleFreeze(custody);
 }catch{m=undefined;}
 const manifest=m,owner=expected,p=policy,cp=custody;
 async function call(name:"wd_current_lifecycle_projection"|"wd_current_lifecycle_deployment_metadata",body:unknown):Promise<unknown>{
  if(!manifest||!owner||!p||!cp)lifecycleHeld();
  const start=lifecycleInt(clock(),0,Number.MAX_SAFE_INTEGER);
  if(start<lifecycleTime(manifest.observedAt)||start>=lifecycleTime(manifest.validUntil)||start>=credentialExpiry)lifecycleHeld();
  const wire=JSON.stringify({p_body:body});if(Buffer.byteLength(wire)>16384)lifecycleHeld();
  const reply=await appleHttp(manifest.origin+"/rest/v1/rpc/"+name,{method:"POST",headers:{apikey:key,Authorization:"Bearer "+key,"content-type":"application/json"},body:wire},transport,65536,timeout);
  const end=lifecycleInt(clock(),0,Number.MAX_SAFE_INTEGER);
  if(end<start||end-start>timeout||end>=lifecycleTime(manifest.validUntil)||end>=credentialExpiry||reply.status!==200)lifecycleHeld();
  return lifecycleCopy(parseReferenceJson(reply.text));
 }
 async function readMetadata(input:LifecycleMetadataRequest):Promise<LifecycleDeploymentMetadata|null>{
  try{
   if(!manifest||!owner)return null;
   const q=appleExact(lifecycleCopy(input),requestKeys);if(appleDigest(q)!==appleDigest(owner))lifecycleHeld();
   const o=appleExact(await call("wd_current_lifecycle_deployment_metadata",q),["contract",...requestKeys,"observedAt","validUntil","sourceIdentitySha256","catalogSha256","engineSha256","writerManifestSha256","writerCatalogSha256","retentionSchemaSha256","retentionEraserSha256","domain"]);
   for(const k of requestKeys)if(o[k]!==q[k])lifecycleHeld();
   if(o.contract!==LIFECYCLE_METADATA)lifecycleHeld();
   for(const [actual,expectedKey]of [["sourceIdentitySha256","sourceIdentitySha256"],["catalogSha256","expectedCatalogSha256"],["engineSha256","expectedEngineSha256"],["writerManifestSha256","writerManifestSha256"],["writerCatalogSha256","writerCatalogSha256"],["retentionSchemaSha256","retentionSchemaSha256"],["retentionEraserSha256","retentionEraserSha256"]] as const)if(appleHash(o[actual])!==manifest[expectedKey])lifecycleHeld();
   if(appleDigest(o.domain)!==appleDigest(manifest.domain))lifecycleHeld();
   const now=lifecycleInt(clock(),0,Number.MAX_SAFE_INTEGER),at=lifecycleTime(o.observedAt),until=lifecycleTime(o.validUntil);
   if(at>now||now-at>timeout||until<=now||until<at)lifecycleHeld();
   return lifecycleFreeze(o as LifecycleDeploymentMetadata);
  }catch{return null;}
 }
 async function select(input:ClaimProjectionRequest):Promise<ClaimProjection|null>{
  try{
   if(!manifest||!owner||!p||!cp)return null;
   const q=appleExact(lifecycleCopy(input),["phase","binding","accountRevision","reference","projection","policySha256","projectionIdentitySha256"]);
   const b=appleExact(q.binding,bindingKeys);
   for(const k of ["userId","authOperationId","deletionOperationId","workOwner"])appleUuid(b[k]);
   appleHash(b.identityHash);appleHash(b.intentSha256);lifecycleInt(b.workAttempt,1);lifecycleInt(q.accountRevision,1);
   if(b.userId!==owner.userId||b.identityHash!==owner.identityHash||!["run","reconcile"].includes(String(q.phase))||!keys.includes(q.reference as CurrentScopeReference)||q.projection!==CURRENT_AUTH_SCOPE+"/"+q.reference||q.policySha256!==manifest.deletionPolicySha256)lifecycleHeld();
   const base=Object.fromEntries(Object.entries(q).filter(([k])=>k!=="projectionIdentitySha256"));
   if(q.projectionIdentitySha256!==appleDigest(["wd-current-uuid-claim-target-projection-v1",base]))lifecycleHeld();
   if(!p.retainedEvidence.includes(CURRENT_AUTH_SCOPE_REFERENCES[q.reference as CurrentScopeReference])||lifecycleTime(b.leaseUntil)<=clock())lifecycleHeld();
   const o=appleExact(await call("wd_current_lifecycle_projection",{...q,manifestIdentity:manifest.releaseId,custodyPolicy:cp,custodyPolicySha256:manifest.custodyPolicySha256,projectionVersion:LIFECYCLE_PROJECTION}),["projectionIdentitySha256","value"]);
   if(o.projectionIdentitySha256!==q.projectionIdentitySha256||lifecycleTime(b.leaseUntil)<=clock())lifecycleHeld();
   const value=appleExact(o.value,q.reference==="retentionAttempts"?["count","sha256","validUntil"]:["count","sha256"]);
   const count=lifecycleInt(value.count,0,manifest.referenceBounds[q.reference as CurrentScopeReference]);appleHash(value.sha256);
   if(q.reference==="retentionAttempts"&&(count===0?value.validUntil!==null:value.validUntil===null||lifecycleTime(value.validUntil)<=clock()))lifecycleHeld();
   return lifecycleFreeze(o as ClaimProjection);
  }catch{return null;}
 }
 return Object.freeze({readMetadata,select,selectors():readonly ClaimReferenceSelector[]{
  if(!manifest||!owner||!p)return Object.freeze([]);
  return Object.freeze(keys.filter(k=>p.retainedEvidence.includes(CURRENT_AUTH_SCOPE_REFERENCES[k])).map(reference=>Object.freeze({reference,projection:CURRENT_AUTH_SCOPE+"/"+reference,userId:owner.userId,identityHash:owner.identityHash,policySha256:manifest.deletionPolicySha256,maxCount:manifest.referenceBounds[reference],select})));
 }});
}

