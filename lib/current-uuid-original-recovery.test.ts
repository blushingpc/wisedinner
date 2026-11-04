import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { appleDigest, type AppleData } from "./apple-token-custody.server.ts";
import { createCurrentUuidOriginalRecoveryStrategy, type CurrentUuidOriginalRecoveryDependencies } from "./current-uuid-original-recovery.server.ts";
const H="a".repeat(64),E="b".repeat(64);
// Synthetic private policy/transport only; not live authority or full lifecycle.
const policy={approved:true as const,version:"wd-owner-uuid-delete-v1",preparedSeconds:600,pendingSeconds:600,recoverySeconds:600,receiptSeconds:600,retainedEvidence:["deletion_receipt","billing_evidence","apple_credential_recovery"]};
function fixture(){
 const at=Date.now(),t={userId:randomUUID(),identityHash:H,operationId:randomUUID()};let clock=at,gets=0,records=0,reads=0;
 const f:AppleData={owner:randomUUID(),attempt:1,lease:new Date(at+60000).toISOString(),apple:"none",appleState:"not_required",authState:"started",intentId:randomUUID(),intentSha256:H,disposition:"not_required",currentIdentityHash:H,actualApple:"none",effectiveApple:"none",policySha256:appleDigest(policy),retainedEvidence:[...policy.retainedEvidence],fenceHash:H};
 const o:AppleData={state:"started",scopeAdmitted:true,scopeHash:E,evidenceHash:null,scopeProfile:policy.version,scopeProviderPredicate:"account-uuid-only",scopePolicySha256:appleDigest(policy),scopeAccountRevision:2};
 const commands:string[]=[];
 const deps:CurrentUuidOriginalRecoveryDependencies={origin:"https://synthetic.invalid",serverCredential:"synthetic-only-not-a-key",policy:structuredClone(policy),now:()=>clock,timeoutMs:1000,
  repository:{async command(ns,action,body){reads++;assert.equal(ns,"deletion");assert.deepEqual({userId:body.userId,identityHash:body.identityHash,operationId:body.operationId},t);commands.push(action);assert.ok(["auth_fence","auth_original","auth_record"].includes(action));
   if(action==="auth_record"){records++;o.state="confirmed";o.evidenceHash=body.evidenceHash;return{state:"confirmed",evidenceHash:o.evidenceHash};}return structuredClone(action==="auth_fence"?f:o);}},
  async request(url,init){gets++;assert.equal(url,"https://synthetic.invalid/auth/v1/admin/users/"+t.userId);assert.equal(init?.method,"GET");assert.equal(init?.body,undefined);return new Response('{"code":"user_not_found"}',{status:404});}};
 return{t,f,o,deps,at,setClock:(n:number)=>{clock=n;},counts:()=>({gets,records,reads}),commands};
}
test("pure explicit construction, GET404 records exact admitted original once; confirmed replay has no transport",async()=>{
 const x=fixture(),s=createCurrentUuidOriginalRecoveryStrategy(x.deps),p=s.forOwner(x.t.userId);assert.deepEqual(x.counts(),{gets:0,records:0,reads:0});
 assert.equal((await p.reconcile(x.t)).outcome,"already_absent");assert.equal(x.counts().gets,1);assert.equal(x.counts().records,1);assert.equal(x.o.scopeHash,E);
 assert.equal((await p.reconcile(x.t)).outcome,"confirmed");assert.equal(x.counts().gets,1);assert.equal(x.counts().records,1);
});
test("default/malformed config and foreign owner are zero IO; hostile getters/proxies are never evaluated",async()=>{
 const x=fixture();let touched=0;const getter=Object.defineProperty({},"policy",{enumerable:true,get(){touched++;throw Error();}}),proxy=new Proxy({},{ownKeys(){touched++;throw Error();},getPrototypeOf(){touched++;throw Error();}});
 for(const d of [undefined,getter,proxy,{...x.deps,policy:proxy},{...x.deps,timeoutMs:9000},{...x.deps,request:undefined}])assert.equal((await createCurrentUuidOriginalRecoveryStrategy(d as CurrentUuidOriginalRecoveryDependencies).forOwner(x.t.userId).reconcile(x.t)).outcome,"unknown");
 const s=createCurrentUuidOriginalRecoveryStrategy(x.deps);assert.equal((await s.forOwner(randomUUID()).reconcile(x.t)).outcome,"unknown");
 await assert.rejects(()=>s.forOwner(x.t.userId).reconcile(proxy as never));assert.equal(touched,0);assert.deepEqual(x.counts(),{gets:0,records:0,reads:0});
});
test("captured receivers/functions and detached policy survive caller mutation; bind/name getters never read",async()=>{
 const x=fixture(),old=x.deps.repository.command;let touched=0;
 x.deps.repository.command=async function(ns,a,b){assert.equal(this,x.deps.repository);return old(ns,a,b);};
 for(const k of ["bind","name"])Object.defineProperty(x.deps.repository.command,k,{get(){touched++;throw Error();}});
 const s=createCurrentUuidOriginalRecoveryStrategy(x.deps);x.deps.repository.command=async()=>{throw Error();};(x.deps.policy.retainedEvidence as string[]).length=0;
 assert.equal((await s.forOwner(x.t.userId).reconcile(x.t)).outcome,"already_absent");assert.equal(touched,0);
});
for(const [key,value]of Object.entries({scopeAdmitted:false,scopeProfile:"strict",scopeProviderPredicate:"identity-cas",scopePolicySha256:H,scopeHash:"bad",scopeAccountRevision:0,state:"unknown",evidenceHash:H}))test("unadmitted/strict/malformed original holds: "+key,async()=>{
 const x=fixture();x.o[key]=value;assert.equal((await createCurrentUuidOriginalRecoveryStrategy(x.deps).forOwner(x.t.userId).reconcile(x.t)).outcome,"unknown");assert.equal(x.counts().gets,0);assert.equal(x.counts().records,0);
});
for(const [key,value]of Object.entries({owner:"bad",attempt:0,lease:new Date(0).toISOString(),authState:"pending",intentId:"bad",intentSha256:"bad",currentIdentityHash:E,policySha256:H,retainedEvidence:[],fenceHash:"bad",actualApple:"unknown"}))test("complete current fence holds: "+key,async()=>{
 const x=fixture();x.f[key]=value;assert.equal((await createCurrentUuidOriginalRecoveryStrategy(x.deps).forOwner(x.t.userId).reconcile(x.t)).outcome,"unknown");assert.equal(x.counts().gets,0);
});
for(const [status,body]of [[200,'{"id":"present"}'],[404,'{}'],[404,'{"code":"other"}'],[404,'{"code":"user_not_found","user":{}}'],[404,'{"code":"user_not_found","code":"user_not_found"}'],[500,'{"code":"user_not_found"}']] as const)test("only accepted exact404 records: "+status+body,async()=>{
 const x=fixture();const d={...x.deps,request:async()=>new Response(body,{status})};assert.equal((await createCurrentUuidOriginalRecoveryStrategy(d).forOwner(x.t.userId).reconcile(x.t)).outcome,"unknown");assert.equal(x.counts().records,0);
});
for(const mode of ["owner","attempt","lease","intentId","intentSha256","policySha256","authState","scopeHash","revision"])test("source drift during GET prevents record: "+mode,async()=>{
 const x=fixture();const d={...x.deps,request:async()=>{if(mode==="scopeHash")x.o.scopeHash=H;else if(mode==="revision")x.o.scopeAccountRevision=3;else x.f[mode]=mode==="attempt"?2:mode==="lease"?new Date(x.at+30000).toISOString():randomUUID();return new Response('{"error_code":"user_not_found"}',{status:404});}};
 assert.equal((await createCurrentUuidOriginalRecoveryStrategy(d).forOwner(x.t.userId).reconcile(x.t)).outcome,"unknown");assert.equal(x.counts().records,0);
});
test("lost GET has no record; lost record ACK has no retry and next explicit reconcile reads durable confirmation",async()=>{
 const x=fixture(),p=createCurrentUuidOriginalRecoveryStrategy({...x.deps,request:async()=>{throw Error("synthetic_lost_get");}}).forOwner(x.t.userId);assert.equal((await p.reconcile(x.t)).outcome,"unknown");assert.equal(x.counts().records,0);
 const y=fixture(),cmd=y.deps.repository.command;y.deps.repository.command=async(ns,a,b)=>{const r=await cmd(ns,a,b);if(a==="auth_record")throw Error("synthetic_lost_record_ack");return r;};
 const q=createCurrentUuidOriginalRecoveryStrategy(y.deps).forOwner(y.t.userId);assert.equal((await q.reconcile(y.t)).outcome,"unknown");assert.equal(y.counts().records,1);assert.equal((await q.reconcile(y.t)).outcome,"confirmed");assert.equal(y.counts().records,1);assert.equal(y.counts().gets,1);
});
test("expired clock after GET holds and malicious returned descriptors have no getter effects",async()=>{
 const x=fixture();const p=createCurrentUuidOriginalRecoveryStrategy({...x.deps,request:async()=>{x.setClock(x.at+60001);return new Response('{"code":"user_not_found"}',{status:404});}}).forOwner(x.t.userId);assert.equal((await p.reconcile(x.t)).outcome,"unknown");assert.equal(x.counts().records,0);
 let touched=0;const y=fixture();y.deps.repository.command=async()=>Object.defineProperty({},"owner",{enumerable:true,get(){touched++;throw Error();}});assert.equal((await createCurrentUuidOriginalRecoveryStrategy(y.deps).forOwner(y.t.userId).reconcile(y.t)).outcome,"unknown");assert.equal(touched,0);
});

test("post-record fence drift cannot return success or replay the record",async()=>{
 const x=fixture(),cmd=x.deps.repository.command;x.deps.repository.command=async(ns,a,b)=>{const r=await cmd(ns,a,b);if(a==="auth_record")x.f.owner=randomUUID();return r;};
 const p=createCurrentUuidOriginalRecoveryStrategy(x.deps).forOwner(x.t.userId);assert.equal((await p.reconcile(x.t)).outcome,"unknown");assert.equal(x.counts().records,1);assert.equal(x.counts().gets,1);
 // A separate explicit read of the current matching claim can recover the
 // already durable confirmation, without a second provider or record effect.
 assert.equal((await p.reconcile(x.t)).outcome,"confirmed");assert.equal(x.counts().records,1);assert.equal(x.counts().gets,1);
});
