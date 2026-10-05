import {test} from "node:test";
import assert from "node:assert/strict";
import {AccountError,type VerifiedAccount} from "./account.ts";
import {notificationHandler,deliverNotification,receiptAction,type PushJob,type DeliveryRepository} from "./notifications.ts";
const id="10000000-0000-4000-8000-000000000001",device="20000000-0000-4000-8000-000000000001",project="30000000-0000-4000-8000-000000000001";
const account:VerifiedAccount={id,token:"synthetic",authenticatedAt:1,providers:[]},config={projectId:project,environment:"production" as const};
const request=(body:unknown,method="POST")=>new Request("https://example.invalid/api/v1/notifications",{method,headers:{"Content-Type":"application/json","Idempotency-Key":id},body:JSON.stringify(body)});
test("permission refusal is a successful owned revoke, not an app-access or paid gate",async()=>{
 let called=false;const h=notificationHandler({verify:async()=>account,config,repository:{command:async(a,action,body)=>{assert.equal(a.id,id);assert.equal(action,"revoke");assert.deepEqual(body,{deviceId:device});called=true;return {revoked:true};}}});
 assert.equal((await h(request({deviceId:device,projectId:project,environment:"production",permission:"denied"}))).status,200);assert.equal(called,true);
});
test("push registration rejects forged owner/environment/project, invalid session and oversized/malformed input",async()=>{
 const h=notificationHandler({verify:async()=>account,config,repository:{command:async()=>({registered:true})}}),valid={deviceId:device,projectId:project,environment:"production",permission:"granted",revision:0,token:"ExpoPushToken[synthetic-token-12345]"};
 for(const body of [{...valid,user_id:device},{...valid,environment:"development"},{...valid,projectId:id},{...valid,token:"no"},{...valid,token:"x".repeat(5000)},null])assert.ok((await h(request(body))).status>=400);
 const unauth=notificationHandler({verify:async()=>{throw new AccountError(401,"invalid_session");},config,repository:{command:async()=>({})}});assert.equal((await unauth(request(valid))).status,401);
});
test("disabled transport, inactive/opt-out/project mismatch and duplicate jobs cannot send",async()=>{
 const job:PushJob={id,userId:id,deviceId:device,projectId:project,environment:"production",token:"synthetic",body:"Synthetic test only",attempt:1};let claimed=false,sends=0;const states:string[]=[];
 const repo:DeliveryRepository={claim:async()=>claimed?null:(claimed=true,job),allowed:async()=>false,finish:async(_,s)=>{states.push(s);},disable:async()=>{}};
 assert.equal((await deliverNotification(id,repo,async()=>{sends++;return {status:"ok",id};},config)).state,"disabled");assert.equal(claimed,false);
 assert.equal((await deliverNotification(id,repo,async()=>{sends++;return {status:"ok",id};},config,true)).state,"held");assert.equal(sends,0);
 assert.equal((await deliverNotification(id,repo,async()=>{sends++;return {status:"ok",id};},config,true)).state,"duplicate_or_unavailable");assert.deepEqual(states,["held"]);
});
test("tickets are not delivery proof; terminal versus retryable receipts and uncertain send remain explicit",async()=>{
 assert.equal(receiptAction({status:"error",details:{error:"DeviceNotRegistered"}}),"disable");assert.equal(receiptAction({status:"error",details:{error:"MessageRateExceeded"}}),"retry");assert.equal(receiptAction({status:"error",details:{error:"InvalidCredentials"}}),"held");assert.equal(receiptAction({status:"ok"}),"complete");
 const states:string[]=[],job:PushJob={id,userId:id,deviceId:device,projectId:project,environment:"production",token:"synthetic",body:"Synthetic",attempt:1};let disabled=false;
 const repo:DeliveryRepository={claim:async()=>job,allowed:async()=>true,finish:async(_,s)=>{states.push(s);},disable:async()=>{disabled=true;}};
 assert.equal((await deliverNotification(id,repo,async()=>{throw Error("network ambiguity");},config,true)).state,"uncertain");
 assert.equal((await deliverNotification(id,repo,async()=>({status:"error",details:{error:"DeviceNotRegistered"}}),config,true)).state,"disable");assert.equal(disabled,true);assert.deepEqual(states,["uncertain","held"]);
});
