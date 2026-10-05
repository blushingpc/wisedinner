import {test} from "node:test";
import assert from "node:assert/strict";
import {freshness,observedOperation,operationStatus,dryRunAlerts,type OpsRepository} from "./operations.ts";
test("last attempt cannot replace last success or certify stale/future support polling",()=>{
 const now=Date.parse("2026-10-05T04:00:00Z"),p={check:"support-poll" as const,lastAttempt:new Date(now).toISOString(),lastSuccess:new Date(now-16*60_000).toISOString(),generation:3,error:"none" as const};
 assert.equal(freshness(p,now,15*60_000).healthy,false);assert.equal(freshness({...p,lastSuccess:new Date(now+1).toISOString()},now,15*60_000).healthy,false);assert.equal(freshness({...p,lastSuccess:new Date(now-1000).toISOString()},now,15*60_000).healthy,true);
});
test("liveness/provider failure records only coarse state without swallowing original operation",async()=>{
 const calls:{action:string;body:Record<string,unknown>}[]=[],repo:OpsRepository={command:async(action,body)=>(calls.push({action,body}),{})};
 await assert.rejects(observedOperation("database",async()=>{throw Error("synthetic private detail");},repo));assert.equal(calls[1].body.error,"unavailable");assert.ok(!JSON.stringify(calls).includes("private detail"));
 assert.equal(await observedOperation("database",async()=>false,repo,x=>x),false);assert.equal(calls[3].body.error,"unavailable");
 assert.equal((await operationStatus(undefined)).state,"not-activated");assert.equal((await operationStatus({command:async()=>{throw Error("private");}})).state,"unavailable");
});
test("dry alerts acknowledge after transport only; repeated consumption deduplicates and recovery stays separate",async()=>{
 const events=[{id:"synthetic-failure",check:"database",state:"failure"}],repo:OpsRepository={command:async(action)=>action==="alerts"?{events:[...events]}:(events.splice(0),{})};let sends=0;
 await assert.rejects(dryRunAlerts(repo,async()=>{throw Error("unavailable");}));assert.equal(events.length,1);
 assert.equal(await dryRunAlerts(repo,async()=>{sends++;}),1);assert.equal(await dryRunAlerts(repo,async()=>{sends++;}),0);assert.equal(sends,1);
});
