import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { appleExact, appleHash } from "./apple-token-custody.server.ts";
import { CURRENT_AUTH_SCOPE_REFERENCES } from "./current-auth-scope.server.ts";
import { CURRENT_CONTACT_CATALOG_IDENTITY, CURRENT_CONTACT_CATALOG_PROFILE } from "./current-legacy-contact-catalog-profile.server.ts";
import { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";

export const LIFECYCLE_MANIFEST = "wd-current-lifecycle-deployment-manifest-v1" as const;
export const LIFECYCLE_PROJECTION = "wd-current-lifecycle-projection-v1" as const;
export const LIFECYCLE_METADATA = "wd-current-lifecycle-deployment-metadata-v1" as const;
export const LIFECYCLE_PROJECT = "zpvqxtklvjitofpbddrn";
export const LIFECYCLE_REQUIRED_MIGRATIONS = Object.freeze(["supabase/migrations/0001_waitlist_support.sql","supabase/migrations/0002_backend_v1.sql","supabase/migrations/0003_support_threads.sql","supabase/migrations/0004_store_prices_by_region.sql","supabase/migrations/0005_app_config.sql","supabase/migrations/0006_wd_accounts.sql","supabase/migrations/0007_wd_billing.sql","supabase/migrations/0013_wd_account_deletion.sql","supabase/migrations/0014_wd_billing_restore.sql","supabase/migrations/0018_wd_current_plan.sql","supabase/migrations/0019_wd_current_account_ingress.sql","supabase/migrations/0020_wd_current_exec_acl.sql","supabase/migrations/0021_wd_deletion_lifecycle_v2.sql","supabase/migrations/0022_wd_apple_token_custody.sql","supabase/migrations/0023_wd_deletion_prepared_retirement.sql","supabase/migrations/0024_wd_current_auth_scope.sql","supabase/migrations/0025_wd_current_retention_inventory.sql","supabase/migrations/0026_wd_current_restore_scope_metadata.sql","supabase/migrations/0027_wd_current_local_deletion_barrier.sql","supabase/migrations/0028_wd_current_reviewed_legacy_scope.sql","supabase/migrations/0029_wd_current_ephemeral_deletion_receipt.sql","supabase/migrations/0030_wd_current_sparse_legacy_scope.sql","supabase/migrations/0031_wd_current_legacy_contact_scope.sql","supabase/migrations/0032_wd_current_private_lifecycle_projection.sql","supabase/migrations/0033_wd_current_original_status_recovery.sql"]);
export type DeploymentPins = Readonly<Record<string,string>>;
export type LifecycleDeploymentManifest = Readonly<{
 contract: typeof LIFECYCLE_MANIFEST; releaseId:string; project:typeof LIFECYCLE_PROJECT;
 origin:string; profile:typeof UUID_DELETE_PROFILE; observerProfile:string; catalogIdentity:string;
 sourcePins:DeploymentPins; migrationPins:DeploymentPins; policyRecordId:string;
 deletionPolicySha256:string; custodyPolicySha256:string;
 sourceIdentitySha256:string; expectedCatalogSha256:string; expectedEngineSha256:string;
 writerManifestSha256:string; writerCatalogSha256:string; retentionSchemaSha256:string; retentionEraserSha256:string;
 projectionIdentity:typeof LIFECYCLE_PROJECTION; referenceBounds:Readonly<Record<keyof typeof CURRENT_AUTH_SCOPE_REFERENCES,number>>;
 domain:Readonly<{catalogObjectCount:number;classifiedDomainCount:number;unknownDomainCount:0;overflow:false}>;
 capture:Readonly<{searchPath:"";role:string;recipeSha256:string;receiptSha256:string}>;
 observedAt:string; validUntil:string;
}>;
export type LifecycleManifestExpectation = Readonly<{
 sha256:string; releaseId:string; sourcePins:DeploymentPins; migrationPins:DeploymentPins;
 policyRecordId:string; deletionPolicySha256:string; custodyPolicySha256:string; recipeSha256:string;
}>;
const issued=new WeakSet<object>();
export function lifecycleHeld():never{throw Error("lifecycle_material_held");}
/** Own enumerable data only. No getters, proxy traps, toJSON or function metadata. */
export function lifecycleOwn(value:unknown,keys:readonly string[]):Record<string,PropertyDescriptor>{
 if(!value||typeof value!=="object"||isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))lifecycleHeld();
 const ds=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(ds).some(k=>typeof k!=="string")||Object.keys(ds).sort().join()!==[...keys].sort().join()||Object.values(ds).some(d=>!("value"in d)||!d.enumerable))lifecycleHeld();
 return ds;
}
export function lifecycleCopy(value:unknown):unknown{
 let nodes=0;
 const inspect=(v:unknown,depth:number)=>{
  if(++nodes>4096||depth>12||isProxy(v))lifecycleHeld();
  if(v&&typeof v==="object"){
   if(![Object.prototype,null,Array.prototype].includes(Object.getPrototypeOf(v)))lifecycleHeld();
   const ds=Object.getOwnPropertyDescriptors(v);
   if(Reflect.ownKeys(ds).some(k=>typeof k!=="string")||Object.values(ds).some(d=>!("value"in d)))lifecycleHeld();
   for(const d of Object.values(ds))inspect(d.value,depth+1);
  }else if(typeof v==="function"||typeof v==="symbol"||typeof v==="bigint"||v===undefined)lifecycleHeld();
 };
 inspect(value,0);return copyReferenceData(value);
}
export function lifecycleFreeze<T>(v:T):T{if(v&&typeof v==="object"){Object.values(v).forEach(lifecycleFreeze);Object.freeze(v);}return v;}
export function lifecycleTime(v:unknown):number{
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v))lifecycleHeld();
 const n=Date.parse(v),[y,m,d]=v.slice(0,10).split("-").map(Number);
 if(!Number.isSafeInteger(n)||m<1||m>12||d<1||d>new Date(Date.UTC(y,m,0)).getUTCDate()||Number(v.slice(11,13))>23||Number(v.slice(14,16))>59||Number(v.slice(17,19))>59)lifecycleHeld();
 return n;
}
export function lifecycleInt(v:unknown,min=0,max=2147483647):number{if(!Number.isSafeInteger(v)||Number(v)<min||Number(v)>max)lifecycleHeld();return v as number;}
function label(v:unknown):string{if(typeof v!=="string"||! /^[a-zA-Z0-9_.-]{1,128}$/.test(v))lifecycleHeld();return v;}
function pins(v:unknown,migrations:boolean):DeploymentPins{
 const p=appleExact(v,Object.keys(v as object));const keys=Object.keys(p);
 if(keys.length<1||keys.length>128)lifecycleHeld();
 for(const k of keys){if(!(migrations?/^supabase\/migrations\/00[0-9]{2}_[a-z0-9_]+\.sql$/:/^lib\/[a-z0-9.-]+\.ts$/).test(k))lifecycleHeld();appleHash(p[k]);}
 if(migrations&&keys.sort().join()!==[...LIFECYCLE_REQUIRED_MIGRATIONS].sort().join())lifecycleHeld();
 return p as DeploymentPins;
}
const fields=["contract","releaseId","project","origin","profile","observerProfile","catalogIdentity","sourcePins","migrationPins","policyRecordId","deletionPolicySha256","custodyPolicySha256","sourceIdentitySha256","expectedCatalogSha256","expectedEngineSha256","writerManifestSha256","writerCatalogSha256","retentionSchemaSha256","retentionEraserSha256","projectionIdentity","referenceBounds","domain","capture","observedAt","validUntil"];
export function checkCurrentLifecycleDeploymentManifest(bytes:unknown,expected:LifecycleManifestExpectation,now:number):LifecycleDeploymentManifest|null{
 try{
  // Only primitive UTF-8 JSON text is accepted. Hash exactly that text before parse.
  if(typeof bytes!=="string"||Buffer.byteLength(bytes)>65536||!bytes.length)lifecycleHeld();
  lifecycleInt(now,0,Number.MAX_SAFE_INTEGER);
  const e=appleExact(lifecycleCopy(expected),["sha256","releaseId","sourcePins","migrationPins","policyRecordId","deletionPolicySha256","custodyPolicySha256","recipeSha256"]);
  if(createHash("sha256").update(bytes,"utf8").digest("hex")!==appleHash(e.sha256))lifecycleHeld();
  const m=appleExact(parseReferenceJson(bytes),fields);
  if(m.contract!==LIFECYCLE_MANIFEST||m.project!==LIFECYCLE_PROJECT||m.origin!=="https://"+LIFECYCLE_PROJECT+".supabase.co"||m.profile!==UUID_DELETE_PROFILE||m.observerProfile!==CURRENT_CONTACT_CATALOG_PROFILE||m.catalogIdentity!==CURRENT_CONTACT_CATALOG_IDENTITY||m.projectionIdentity!==LIFECYCLE_PROJECTION)lifecycleHeld();
  for(const k of ["releaseId","policyRecordId"]){label(m[k]);if(m[k]!==e[k])lifecycleHeld();}
  for(const k of ["deletionPolicySha256","custodyPolicySha256","sourceIdentitySha256","expectedCatalogSha256","expectedEngineSha256","writerManifestSha256","writerCatalogSha256","retentionSchemaSha256","retentionEraserSha256"])appleHash(m[k]);
  if(m.deletionPolicySha256!==e.deletionPolicySha256||m.custodyPolicySha256!==e.custodyPolicySha256)lifecycleHeld();
  for(const k of ["sourcePins","migrationPins"]){
   const p=pins(m[k],k==="migrationPins"),q=pins(e[k],k==="migrationPins");
   if(JSON.stringify(Object.entries(p).sort())!==JSON.stringify(Object.entries(q).sort()))lifecycleHeld();
  }
  const b=appleExact(m.referenceBounds,Object.keys(CURRENT_AUTH_SCOPE_REFERENCES));for(const n of Object.values(b))lifecycleInt(n,1,128);
  const d=appleExact(m.domain,["catalogObjectCount","classifiedDomainCount","unknownDomainCount","overflow"]);
  lifecycleInt(d.catalogObjectCount,1,512);if(d.classifiedDomainCount!==d.catalogObjectCount||d.unknownDomainCount!==0||d.overflow!==false)lifecycleHeld();
  const c=appleExact(m.capture,["searchPath","role","recipeSha256","receiptSha256"]);
  if(c.searchPath!==""||!["postgres","supabase_admin"].includes(String(c.role))||c.recipeSha256!==e.recipeSha256)lifecycleHeld();appleHash(c.recipeSha256);appleHash(c.receiptSha256);
  const at=lifecycleTime(m.observedAt),until=lifecycleTime(m.validUntil);
  if(at>now||until<=now||until<=at||until-at>86400000)lifecycleHeld();
  const result=lifecycleFreeze(lifecycleCopy(m) as LifecycleDeploymentManifest);issued.add(result);return result;
 }catch{return null;}
}
export function isCheckedLifecycleDeploymentManifest(v:unknown):v is LifecycleDeploymentManifest{return !!v&&typeof v==="object"&&issued.has(v);}

