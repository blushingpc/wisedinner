import { randomUUID } from "node:crypto";
import { isProxy } from "node:util/types";
import { createCurrentUuidOriginalRecoveryStrategy } from "./current-uuid-original-recovery.server.ts";
import { createAppleRpcRepository, appleDigest, appleExact, appleHash, appleUuid, appleText, appleHttp, appleRead } from "./apple-token-custody.server.ts";
import { createAccountDeletionV2Service, createDeletionV2RpcRepository, inspectDeletionV2Policy, inspectDeletionV2Receipt, type DeletionV2StatusRecovery, type DeletionV2StatusRecoveryInput } from "./account-deletion-v2.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";

export type CurrentOriginalStatusRecoveryDependencies = Readonly<{
 origin:string;serverCredential:string;request:typeof fetch;now():number;timeoutMs?:number;
}>;
const TARGET="https://zpvqxtklvjitofpbddrn.supabase.co";
function invalid():never{throw Error("original_status_recovery_held");}
function own(value:unknown):Record<string,unknown>{
 if(!value||typeof value!=="object"||isProxy(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value)))invalid();
 const ds=Object.getOwnPropertyDescriptors(value);
 if(Reflect.ownKeys(ds).some(k=>typeof k!=="string")||Object.values(ds).some(d=>!("value" in d)))invalid();
 return Object.fromEntries(Object.entries(ds).map(([k,d])=>[k,d.value]));
}
function copy(value:unknown):unknown{
 let nodes=0;
 function check(v:unknown,depth:number){if(++nodes>1024||depth>12||isProxy(v))invalid();if(v&&typeof v==="object")for(const d of Object.values(Object.getOwnPropertyDescriptors(v))){if(!("value" in d))invalid();check(d.value,depth+1);}}
 check(value,0);return copyReferenceData(value);
}
function freeze<T>(v:T):T{if(v&&typeof v==="object"){Object.values(v).forEach(freeze);Object.freeze(v);}return v;}
function positive(v:unknown):number{if(!Number.isSafeInteger(v)||Number(v)<1||Number(v)>2147483647)invalid();return Number(v);}
function stamp(v:unknown):number{if(typeof v!=="string"||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)$/.test(v))invalid();const n=Date.parse(v);if(!Number.isSafeInteger(n)||new Date(v.slice(0,10)+"T00:00:00Z").toISOString().slice(0,10)!==v.slice(0,10))invalid();return n;}
/** Private optional service hook. Constructor has no I/O/clock/env/secret loads.
 * Input is the already capability-validated durable original from the maintained
 * status service, never an owner/policy or authority supplied by a request body.
 * Only same-original claim, GET reconcile, proof, complete, release and status.
 * Unknown ACKs are never retried; existing original receipt is the fallback. */
export function createCurrentOriginalStatusRecovery(deps?:CurrentOriginalStatusRecoveryDependencies):DeletionV2StatusRecovery{
 let config:{credential:string;request:typeof fetch;now:()=>number;timeout:number}|undefined;
 try{
  const d=own(deps);
  if(Object.keys(d).some(k=>!["origin","serverCredential","request","now","timeoutMs"].includes(k))||d.origin!==TARGET)invalid();
  const credential=appleText(d.serverCredential,16384),timeout=d.timeoutMs??3000;
  if(!Number.isInteger(timeout)||Number(timeout)<1||Number(timeout)>8000||typeof d.request!=="function"||typeof d.now!=="function"||isProxy(d.request)||isProxy(d.now))invalid();
  const request=d.request,clock=d.now;
  config={credential,timeout:Number(timeout),request:(url,init)=>Reflect.apply(request,deps,[url,init]),now:()=>Reflect.apply(clock,deps,[])};
 }catch{config=undefined;}
 const c=config,active=new Set<string>();
 return Object.freeze({async recover(value:DeletionV2StatusRecoveryInput):Promise<unknown>{
  // First detach caller-owned data; a malformed caller cannot execute getters.
  const input=appleExact(copy(value),["operationId","intentSha256","recoveryHash","receipt"]);
  const original=freeze(inspectDeletionV2Receipt(copy(input.receipt))),operationId=appleUuid(input.operationId),intentSha256=appleHash(input.intentSha256),recoveryHash=appleHash(input.recoveryHash);
  if(!c||original.operationId!==operationId||original.intentSha256!==intentSha256||original.intentState!=="confirmed"||original.applicationData!=="cleared"||original.authDeletion!=="unknown"||active.has(operationId))return original;
  active.add(operationId);
  const status=freeze({operationId,intentSha256,recoveryHash});
  const worker=createDeletionV2RpcRepository(TARGET,c.credential,c.request),repository=createAppleRpcRepository(TARGET,c.credential,c.request);
  let claimed:{owner:string;attempt:number}|undefined,completed=false;
  const now=()=>{const n=c.now();if(!Number.isSafeInteger(n)||n<0)invalid();return n;};
  async function bounded<T>(p:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([p,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("original_status_timeout")),c!.timeout);})]);}finally{clearTimeout(timer);}}
  try{
   async function material(){
    const response=await appleHttp(TARGET+"/rest/v1/rpc/wd_current_original_status_material",{method:"POST",headers:{apikey:c!.credential,authorization:"Bearer "+c!.credential,"content-type":"application/json"},body:JSON.stringify({p_body:status})},c!.request,16384,c!.timeout);
    if(response.status!==200)invalid();
    const m=appleExact(copy(parseReferenceJson(response.text)),["contract","operationId","intentSha256","target","policy","policySha256","scopeHash","accountRevision","validUntil"]);
    const target=appleExact(m.target,["userId","identityHash","operationId"]),policy=inspectDeletionV2Policy(copy(m.policy));
    appleUuid(target.userId);appleHash(target.identityHash);appleUuid(target.operationId);positive(m.accountRevision);appleHash(m.scopeHash);appleHash(m.policySha256);
    if(m.contract!=="wd-current-original-status-material-v1"||m.operationId!==operationId||m.intentSha256!==intentSha256||policy.version!==UUID_DELETE_PROFILE||appleDigest(policy)!==m.policySha256||stamp(m.validUntil)<=now())invalid();
    return freeze({...m,target:{userId:String(target.userId),identityHash:String(target.identityHash),operationId:String(target.operationId)},policy});
   }
   const m=await material(),owner=randomUUID();
   const claim=own(copy(await bounded(worker.worker("claim",{operationId,intentSha256,owner}))));
   const w=own(claim.work),receipt=inspectDeletionV2Receipt(copy(claim.receipt));
   if(receipt.operationId!==operationId||receipt.intentSha256!==intentSha256||receipt.authDeletion!=="unknown"||w.user_id!==m.target.userId||w.identity_hash!==m.target.identityHash||w.auth_operation!==m.target.operationId||w.owner!==owner||w.complete!==false||!["started","held"].includes(String(w.auth_state))||stamp(w.lease_until)<=now())invalid();
   claimed={owner,attempt:positive(w.attempt)};
   // Re-read immutable material after actual work renewal. Stored original scope
   // is never rebound to this new owner/attempt/lease or to current policy.
   if(appleDigest(await material())!==appleDigest(m))invalid();
   const strategy=createCurrentUuidOriginalRecoveryStrategy({origin:TARGET,serverCredential:c.credential,request:c.request,repository,policy:m.policy,now,timeoutMs:c.timeout});
   const proof=await strategy.forOwner(m.target.userId).reconcile(m.target);
   if(proof.userId!==m.target.userId||proof.identityHash!==m.target.identityHash||proof.operationId!==m.target.operationId||!["confirmed","already_absent"].includes(proof.outcome))return original;
   appleHash(proof.evidenceHash);
   if(appleDigest(await material())!==appleDigest(m))invalid();
   const command={operationId,intentSha256,...claimed};
   const recorded=own(copy(await bounded(worker.worker("proof",{...command,dependency:"auth",providerOperationId:proof.operationId,identityHash:proof.identityHash,outcome:proof.outcome,evidenceHash:proof.evidenceHash}))));
   const after=inspectDeletionV2Receipt(copy(recorded.receipt));
   if(after.operationId!==operationId||after.intentSha256!==intentSha256||after.authDeletion!=="confirmed")invalid();
   // Existing complete validates original cleanup, Apple disposition and claim.
   const finished=own(copy(await bounded(worker.worker("complete",command))));
   const final=inspectDeletionV2Receipt(copy(finished.receipt));
   if(final.operationId!==operationId||final.intentSha256!==intentSha256||final.intentState!=="settled"||final.authDeletion!=="confirmed")invalid();
   completed=true;
   return inspectDeletionV2Receipt(copy(await bounded(worker.worker("status",status))));
  }catch{return original;}
  finally{
   if(claimed&&!completed)try{await bounded(worker.worker("release",{operationId,intentSha256,...claimed}));}catch{/* Exact unknown journal remains fenced; no retry. */}
   active.delete(operationId);
  }
 }});
}


/** Concrete status-only handler for the host's existing status-before-material
 * branch. No current policy/key/manifest/producer or fresh JWT dependency.
 * Other operations stay closed and must use the independently admitted normal
 * lifecycle. This is mounted by Main/host owner after separate acceptance. */
export function createCurrentOriginalStatusHandler(deps?:CurrentOriginalStatusRecoveryDependencies):(request:Request)=>Promise<Response>{
 const closed=()=>Response.json({contract:"wd-account-deletion-v2",result:{outcome:"held",code:"deletion_v2_disabled"}},{status:503,headers:{"cache-control":"no-store","X-Content-Type-Options":"nosniff"}});
 try{
  const d=own(deps);
  if(Object.keys(d).some(k=>!["origin","serverCredential","request","now","timeoutMs"].includes(k))||d.origin!==TARGET||typeof d.request!=="function"||typeof d.now!=="function"||isProxy(d.request)||isProxy(d.now))invalid();
  const credential=appleText(d.serverCredential,16384),timeout=d.timeoutMs??3000;
  if(!Number.isInteger(timeout)||Number(timeout)<1||Number(timeout)>8000)invalid();
  const fn=d.request,clock=d.now,request:typeof fetch=(url,init)=>Reflect.apply(fn,deps,[url,init]),now=()=>Reflect.apply(clock,deps,[]) as number;
  const recovery=createCurrentOriginalStatusRecovery({origin:TARGET,serverCredential:credential,request,now,timeoutMs:Number(timeout)});
  const unavailable=async():Promise<never>=>{throw Error("original_status_only");};
  const service=createAccountDeletionV2Service({enabled:true,verify:unavailable,repository:createDeletionV2RpcRepository(TARGET,credential,request),providers:{verifyIdentity:unavailable,auth:{run:unavailable,reconcile:unavailable}},statusRecovery:recovery});
  return async input=>{
   try{const body=own(copy(parseReferenceJson(await appleRead(input.clone().body,16384,input.signal))));if(body.operation!=="status")return closed();}
   catch{return closed();}
   return service(input);
  };
 }catch{return async()=>closed();}
}
