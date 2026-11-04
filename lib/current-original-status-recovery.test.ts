import test from "node:test";
import assert from "node:assert/strict";
import {randomUUID,randomBytes} from "node:crypto";
import {createCurrentOriginalStatusRecovery,createCurrentOriginalStatusHandler} from "./current-original-status-recovery.server.ts";
import {createAccountDeletionV2Service,type DeletionV2StatusRecovery} from "./account-deletion-v2.server.ts";
const TARGET="https://zpvqxtklvjitofpbddrn.supabase.co",H="a".repeat(64);
function fixture(){
 const operationId=randomUUID(),capability=randomBytes(32).toString("base64url");let reads=0,recovery=0,effects=0;
 const receipt={contract:"wd-account-deletion-v2",operationId,intentSha256:H,receiptRevision:1,intentState:"confirmed",applicationData:"cleared",authDeletion:"unknown",appleRevocation:"not_required",manualAppleRemoval:"not_required",subscriptionCancelled:false,clientDisposition:"return_unauthenticated",retainedEvidence:["deletion_receipt"],nextAction:"original_status_required"};
 const forbidden=async():Promise<never>=>{effects++;throw Error("must not invoke Auth/provider/account");};
 function service(port?:DeletionV2StatusRecovery,failed=false){return createAccountDeletionV2Service({enabled:true,verify:forbidden,repository:{account:forbidden,async worker(action){assert.equal(action,"status");reads++;return failed?{error:"recovery_unavailable"}:structuredClone(receipt);}},providers:{verifyIdentity:forbidden,auth:{run:forbidden,reconcile:forbidden}},statusRecovery:port});}
 function request(extra:Record<string,unknown>={},authorization="Deletion-Recovery "+capability){return new Request(TARGET,{method:"POST",headers:{"content-type":"application/json",authorization},body:JSON.stringify({contract:"wd-account-deletion-v2",operation:"status",operationId,intentSha256:H,...extra})});}
 const port:DeletionV2StatusRecovery={async recover(input){recovery++;assert.equal(reads,1);assert.equal(Object.isFrozen(input),true);assert.equal(input.operationId,operationId);return{...receipt,receiptRevision:2,intentState:"settled",authDeletion:"confirmed",nextAction:"none"};}};
 return{receipt,port,service,request,counts:()=>({reads,recovery,effects})};
}
test("optional status hook runs only after original validated durable read, without fresh Auth/current policy",async()=>{const f=fixture(),r=await f.service(f.port)(f.request());assert.equal(r.status,200);assert.equal((await r.json()).result.authDeletion,"confirmed");assert.deepEqual(f.counts(),{reads:1,recovery:1,effects:0});});
test("bad original capability/receipt never invokes recovery",async()=>{const f=fixture();assert.equal((await f.service(f.port)(f.request({},"Bearer fresh-jwt-is-not-recovery"))).status,409);assert.equal((await f.service(f.port,true)(f.request())).status,409);assert.equal(f.counts().recovery,0);assert.equal(f.counts().effects,0);});
test("original status bytes preserved when hook absent, throws or gives unverified/foreign/downgraded result",async()=>{
 for(const mode of ["absent","throws","foreign","apple","revision","getter","proxy"]){const f=fixture();let getters=0;
 const recover=async()=>{if(mode==="throws")throw Error("private failure");if(mode==="getter")return Object.defineProperty({},"contract",{get(){getters++;throw Error();}});if(mode==="proxy")return new Proxy({},{getPrototypeOf(){getters++;throw Error();}});return{...f.receipt,authDeletion:"confirmed",intentState:"settled",...(mode==="foreign"?{operationId:randomUUID()}:mode==="apple"?{appleRevocation:"confirmed"}:mode==="revision"?{receiptRevision:0}:{})};};
 const expected=await(await f.service()(f.request())).text(),actual=await(await f.service(mode==="absent"?undefined:{recover})(f.request())).text();assert.equal(actual,expected,mode);assert.equal(getters,0);assert.equal(f.counts().effects,0);}
});
test("capture status hook receiver/function once without bind/name or getter execution",async()=>{const f=fixture();let getters=0;let calls=0;const receivers=new WeakMap<object,number>();const port={async recover(){calls++;assert.equal(receivers.get(this),1);return f.receipt;}};receivers.set(port,1);for(const name of ["bind","name"])Object.defineProperty(port.recover,name,{get(){getters++;throw Error();}});
 // Closed own-method hook retains the original receiver.
 assert.equal((await f.service(port)(f.request())).status,200);assert.equal(calls,1);const hostile=Object.defineProperty({},"recover",{get(){getters++;throw Error();}});assert.equal((await f.service(hostile as never)(f.request())).status,200);assert.equal(getters,0);
});
test("bridge construction does not read clock/env/provider; malformed inputs cannot execute getters",async()=>{
 let effects=0;const forbidden=()=>{effects++;throw Error("must not read");};const p=createCurrentOriginalStatusRecovery({origin:TARGET,serverCredential:"synthetic",request:forbidden,now:forbidden});assert.equal(effects,0);
 const hostile=Object.defineProperty({},"operationId",{get(){effects++;throw Error();}});await assert.rejects(p.recover(hostile as never));assert.equal(effects,0);
 for(const d of [undefined,new Proxy({},{getPrototypeOf(){effects++;throw Error();}}),Object.defineProperty({},"origin",{get(){effects++;throw Error();}})])createCurrentOriginalStatusRecovery(d as never);assert.equal(effects,0);
});
test("missing/foreign target material holds before claim/GET, no input mutation",async()=>{const f=fixture();let calls=0;const request:typeof fetch=async()=>{calls++;return Response.json({outcome:"held"});};const p=createCurrentOriginalStatusRecovery({origin:TARGET,serverCredential:"synthetic",request,now:Date.now});const input={operationId:f.receipt.operationId,intentSha256:H,recoveryHash:H,receipt:f.receipt};const original=structuredClone(input);assert.deepEqual(await p.recover(input),f.receipt);assert.equal(calls,1);assert.deepEqual(input,original);
});
test("invalid configuration and timeout bounds stay closed with original status",async()=>{for(const timeoutMs of [0,8001,1.5]){const f=fixture();let calls=0;const p=createCurrentOriginalStatusRecovery({origin:TARGET,serverCredential:"synthetic",timeoutMs,request:async()=>{calls++;throw Error();},now:Date.now});assert.deepEqual(await p.recover({operationId:f.receipt.operationId,intentSha256:H,recoveryHash:H,receipt:f.receipt}),f.receipt);assert.equal(calls,0);}});


test("concrete maintained status-only handler is pure/default-closed and refuses new prepare/confirm before transport",async()=>{
 let reads=0,clocks=0;const handler=createCurrentOriginalStatusHandler({origin:TARGET,serverCredential:"synthetic",request:async()=>{reads++;throw Error();},now:()=>{clocks++;return Date.now();}});assert.equal(reads,0);assert.equal(clocks,0);
 for(const operation of ["prepare","confirm"]){const response=await handler(new Request(TARGET,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({operation})}));assert.equal(response.status,503);}
 const f=fixture();assert.equal((await createCurrentOriginalStatusHandler()(f.request())).status,503);assert.equal(reads,0);assert.equal(clocks,0);
});
