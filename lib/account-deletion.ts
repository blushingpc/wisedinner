import {randomUUID} from "node:crypto";
import {finishAccountDeletion} from "./account.ts";

export type DeletionRepository={command:(action:string,body:Record<string,unknown>)=>Promise<{work:DeletionWork;state:string}>};
export type DeletionWork={user_id:string;owner:string;attempt:number;identity_hash:string|null;apple_linkage:"unknown"|"linked"|"none";apple_state:string;auth_state:string;apple_operation:string;auth_operation:string;complete:boolean};
export type VerifiedDeletionIdentity={userId:string;identityHash:string;evidenceHash:string;apple:"linked"|"none"|"unknown"};
export type DeletionTarget={userId:string;identityHash:string;operationId:string};
export type DeletionProof=DeletionTarget&{outcome:"confirmed"|"already_absent"|"not_started"|"unknown";evidenceHash:string};
// Trusted server adapters only. No token/raw provider payload crosses this interface.
// Reconcile must prove this exact stable operation/identity through documented read-only/idempotent behavior.
// not_started must establish settled non-execution with no in-flight operation, not a transient missing record.
// Absent reconciliation, an unknown destructive call remains held. No live adapter is implemented here.
export type DeletionProvider={run:(target:DeletionTarget)=>Promise<DeletionProof>;reconcile?:(target:DeletionTarget)=>Promise<DeletionProof>};
export type DeletionProviders={verifyIdentity:(userId:string)=>Promise<VerifiedDeletionIdentity|null>;apple:DeletionProvider;auth:DeletionProvider};
export class DeletionProgressError extends Error {}
const HASH=/^[a-f0-9]{64}$/;

export function deletionRepository(url:string,key:string,request:typeof fetch=fetch):DeletionRepository {
 let origin:URL;
 try{origin=new URL(url);}catch{throw new DeletionProgressError("deletion_not_configured");}
 if(origin.protocol!=="https:"||origin.pathname!=="/"||origin.username||origin.password||origin.search||origin.hash)throw new DeletionProgressError("deletion_not_configured");
 return {async command(action,body){
  try {
   const response=await request(`${origin.origin}/rest/v1/rpc/wd_deletion_command`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_action:action,p_body:body}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
   if(!response.ok)throw Error();
   const result=await response.json();
   if(!result||typeof result!=="object"||Array.isArray(result))throw Error();
   if(result.error)throw new DeletionProgressError(["invalid_command","account_inactive","claim_busy","stale_claim","identity_conflict","invalid_progress","cleanup_pending"].includes(result.error)?result.error:"deletion_unavailable");
   if(!result.work||typeof result.work!=="object")throw Error();
   return result;
  }catch(error){throw error instanceof DeletionProgressError?error:new DeletionProgressError("deletion_unavailable");}
 }};
}

// One explicit server-owned target per invocation. No HTTP endpoint/dispatcher/schedule.
export function accountDeletionWorker(repo:DeletionRepository,providers:DeletionProviders) {
 return async (userId:string)=>{
  let work:DeletionWork|undefined,dependency="claim";
  const context=()=>({userId,owner:work!.owner,attempt:work!.attempt});
  const command=async(action:string,body:Record<string,unknown>={})=>{const result=await repo.command(action,{...context(),...body});work=result.work;return result;};
  const perform=async(dep:"apple"|"auth")=>{
   dependency=dep==="apple"?"apple_revocation":"auth_deletion";
   const target:DeletionTarget={userId,identityHash:work!.identity_hash!,operationId:dep==="apple"?work!.apple_operation:work!.auth_operation};
   const provider=providers[dep];
   const state=()=>dep==="apple"?work!.apple_state:work!.auth_state;
   const prove=async(proof:DeletionProof)=>{
    if(!proof||Object.keys(proof).some(k=>!["userId","identityHash","operationId","outcome","evidenceHash"].includes(k))||proof.userId!==userId||proof.identityHash!==target.identityHash||proof.operationId!==target.operationId||!HASH.test(proof.evidenceHash)||!["confirmed","already_absent","not_started","unknown"].includes(proof.outcome)||dep==="apple"&&proof.outcome==="already_absent")throw new DeletionProgressError("provider_proof_unverified");
    await command("proof",{dependency:dep,operationId:proof.operationId,identityHash:proof.identityHash,evidenceHash:proof.evidenceHash,outcome:proof.outcome});
   };
   if(state()==="done")return;
   if(state()==="held"||state()==="started") {
    if(!provider.reconcile)throw new DeletionProgressError("provider_review_required");
    await prove(await provider.reconcile(target));
    if(state()==="done")return;
    if(state()!=="pending")throw new DeletionProgressError("provider_review_required");
   }
   await command("begin",{dependency:dep});
   await prove(await provider.run(target));
   if(state()!=="done")throw new DeletionProgressError("provider_dependency_pending");
  };
  const result=await finishAccountDeletion({userId,state:"deletion_pending",appleLinked:false},{
   claim:async id=>{
    const claimed=await repo.command("claim",{userId:id,owner:randomUUID()});work=claimed.work;
    if(work.user_id!==id)throw new DeletionProgressError("identity_conflict");
    if(claimed.state==="deleted"&&work.complete)return {userId:id,state:"deleted",appleLinked:work.apple_linkage==="linked"};
    if(claimed.state!=="deletion_pending")throw new DeletionProgressError("account_inactive");
    if(!work.identity_hash||work.apple_linkage==="unknown") {
     dependency="provider_identity";
     const identity=await providers.verifyIdentity(id);
     if(!identity||Object.keys(identity).some(k=>!["userId","identityHash","evidenceHash","apple"].includes(k))||identity.userId!==id||!HASH.test(identity.identityHash)||!HASH.test(identity.evidenceHash)||!["linked","none","unknown"].includes(identity.apple))throw new DeletionProgressError("provider_identity_unverified");
     await command("identity",{identityHash:identity.identityHash,evidenceHash:identity.evidenceHash,apple:identity.apple});
     if(work.apple_linkage==="unknown")throw new DeletionProgressError("provider_identity_unverified");
    }
    return {userId:id,state:"deletion_pending",appleLinked:work.apple_linkage==="linked"};
   },
   removePush:async()=>{dependency="push_cleanup";await command("cleanup");},
   revokeApple:async()=>{await perform("apple");},deleteAuth:async()=>{await perform("auth");},
   complete:async()=>{dependency="completion";await command("complete");}
  });
  if(result.state==="deletion_pending") {
   if(work?.owner)try{await command("release");}catch{/* lease fence retains progress; unknown never releases to pending */}
   return {...result,dependency};
  }
  return result;
 };
}

export function configuredAccountDeletionWorker(providerFactory:()=>DeletionProviders,request:typeof fetch=fetch) {
 if(process.env.WD_ACCOUNT_DELETION_WORKER_ENABLED!=="true")return undefined;
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(process.env.WD_ACCOUNT_DELETION_ADAPTERS_VERIFIED!=="true"||!url||!key)throw new DeletionProgressError("deletion_not_configured");
 const repo=deletionRepository(url,key,request);
 try{
  const providers=providerFactory();
  if(!providers||typeof providers.verifyIdentity!=="function"||typeof providers.apple?.run!=="function"||typeof providers.auth?.run!=="function")throw Error();
  return accountDeletionWorker(repo,providers);
 }catch{throw new DeletionProgressError("deletion_adapters_unavailable");}
}
