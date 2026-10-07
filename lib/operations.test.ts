import {test} from "node:test";
import assert from "node:assert/strict";
import {freshness,observedOperation,operationStatus,dryRunAlerts,operationsRepository,configuredOperations,type OpsRepository,type Probe} from "./operations.ts";
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
const NOW=Date.parse("2026-10-06T12:00:00Z"),SUPPORT_AGE=15*60_000,DB_AGE=26*60*60_000;
const healthyProbe=(check:Probe["check"]):Probe=>({check,lastAttempt:"2026-10-06T11:59:00+00:00",lastSuccess:"2026-10-06T11:59:30.000001+00:00",error:"none",generation:1});
const read=(checks:unknown,now=NOW)=>operationStatus({command:async()=>({checks})},now);
test("NaN clock cannot certify healthy freshness",()=>assert.equal(freshness(healthyProbe("database"),NaN,DB_AGE).healthy,false));
test("read refuses missing support-poll",async()=>assert.deepEqual(await read([healthyProbe("database")]),{state:"unavailable",checks:[]}));
test("read refuses duplicate database",async()=>assert.deepEqual(await read([healthyProbe("database"),healthyProbe("database")]),{state:"unavailable",checks:[]}));
test("read refuses unknown check",async()=>assert.deepEqual(await read([healthyProbe("database"),{...healthyProbe("support-poll"),check:"unknown"}]),{state:"unavailable",checks:[]}));
test("complete SQL-shaped pair stays available, ordered, immutable and healthy after normal finish",async()=>{
 const rows=[healthyProbe("support-poll"),healthyProbe("database")],before=structuredClone(rows),out=await read(rows);
 assert.equal(out.state,"available");assert.deepEqual(out.checks.map(p=>p.check),["support-poll","database"]);assert(out.checks.every(p=>p.healthy));
 assert.deepEqual(Object.keys(out.checks[0]),["check","lastAttempt","lastSuccess","error","healthy","stale","attemptInFuture"]);assert.deepEqual(rows,before);
 const nullRecord=Object.assign(Object.create(null),rows[0]);assert.equal((await read([nullRecord,rows[1]])).state,"available");
});
test("PostgreSQL UTC/offset text and six-digit precision preserve original strings and chronology",()=>{
 for(const lastSuccess of ["2026-10-06T11:59:30.123456Z","2026-10-06T11:59:30.123456+00:00","2026-10-06 11:59:30.123456+00","2026-10-06T11:59:30.123456+0000","2026-10-06T11:59:30.123456+000000","2026-10-06T11:59:30.123456+00:00:00","2026-10-06T17:29:30.123456+05:30","2026-10-06T07:59:30.123456-04:00","2026-10-06T12:00:00.123456+00:00:30"]){
  const out=freshness({...healthyProbe("support-poll"),lastSuccess},NOW,SUPPORT_AGE);assert.equal(out.healthy,true);assert.equal(out.lastSuccess,lastSuccess);
 }
});
test("exact existing thresholds and microsecond future/old checks never substitute latest attempt",()=>{
 for(const [check,age]of [["database",DB_AGE],["support-poll",SUPPORT_AGE]] as const){
  const p=healthyProbe(check),boundary=new Date(NOW-age).toISOString();
  assert.equal(freshness({...p,lastSuccess:boundary},NOW,age).healthy,true);
  assert.equal(freshness({...p,lastAttempt:new Date(NOW).toISOString(),lastSuccess:new Date(NOW-age-1).toISOString()},NOW,age).healthy,false);
  const microOlder=new Date(NOW-age-1).toISOString().replace(".999Z",".999999Z");assert.equal(freshness({...p,lastSuccess:microOlder},NOW,age).stale,true);
  const future="2026-10-06T12:00:00.000001+00:00";assert.equal(freshness({...p,lastSuccess:future},NOW,age).healthy,false);
  const attempt=freshness({...p,lastAttempt:future},NOW,age);assert.equal(attempt.healthy,false);assert.equal(attempt.attemptInFuture,true);
  assert.equal(freshness({...p,lastAttempt:new Date(NOW).toISOString(),lastSuccess:new Date(NOW).toISOString()},NOW,0).healthy,true);
 }
});
test("unattempted/null, failed, interrupted and recovered rows stay honest without fabricated success",async()=>{
 const initial:Probe={check:"database",lastAttempt:null,lastSuccess:null,error:"interrupted",generation:0};
 assert.equal((await read([initial,{...initial,check:"support-poll"}])).state,"available");assert((await read([initial,{...initial,check:"support-poll"}])).checks.every(p=>!p.healthy&&p.stale));
 for(const error of ["configuration","unavailable","interrupted"] as const)assert.equal(freshness({...healthyProbe("database"),error},NOW,DB_AGE).healthy,false);
 assert.equal(freshness({...healthyProbe("database"),lastAttempt:null},NOW,DB_AGE).healthy,false);
 assert.equal(freshness({...healthyProbe("database"),lastSuccess:null},NOW,DB_AGE).healthy,false);
 assert.equal(freshness(initial,NOW,DB_AGE).healthy,false);
 assert.equal(freshness({...healthyProbe("database"),generation:3,error:"none"},NOW,DB_AGE).healthy,true);
});
test("freshness rechecks public projection without trusting derived flags; RPC rows remain strict",async()=>{
 const publicProbe={...healthyProbe("database"),generation:0,healthy:false,stale:true,attemptInFuture:true};
 assert.equal(freshness(publicProbe,NOW,DB_AGE).healthy,true);
 const staleProjection={...publicProbe,lastSuccess:new Date(NOW-DB_AGE-1).toISOString(),healthy:true,stale:false,attemptInFuture:false};
 assert.equal(freshness(staleProjection,NOW,DB_AGE).healthy,false);
 assert.equal((await read([publicProbe,healthyProbe("support-poll")])).state,"unavailable");
 let getters=0;const accessor={...publicProbe};Object.defineProperty(accessor,"healthy",{enumerable:true,get(){getters++;return true;}});
 assert.throws(()=>freshness(accessor,NOW,DB_AGE),/operations_unavailable/);assert.equal(getters,0);
});
test("invalid clock and age policy fail closed; invalid clock reads no repository",async()=>{
 for(const now of [NaN,Infinity,-Infinity,8_640_000_000_000_001,-8_640_000_000_000_001,Number.MAX_SAFE_INTEGER,0.5]){
  assert.equal(freshness(healthyProbe("database"),now,DB_AGE).healthy,false);let calls=0;
  assert.deepEqual(await operationStatus({command:async()=>{calls++;return {checks:[]};}},now),{state:"unavailable",checks:[]});assert.equal(calls,0);
 }
 for(const age of [NaN,Infinity,-Infinity,-1,0.5,8_640_000_000_000_001])assert.equal(freshness(healthyProbe("database"),NOW,age).healthy,false);
 assert.deepEqual(await operationStatus(undefined,NaN),{state:"not-activated",checks:[]});
});
test("wrong/null/bad/out-of-range timestamps, coarse errors and generations refuse without leakage",async()=>{
 const badTimes=["yesterday","","2026-02-30T12:00:00Z","2026-10-06T12:00:00","2026-10-06T24:00:00Z","2026-10-06T12:00:60Z","2026-10-06T12:00:00.1234567Z","2026-10-06T12:00:00+99:00","2026-10-06T12:00:00+00:0000","999999-01-01T00:00:00Z","x".repeat(65),undefined,42,{}];
 for(const field of ["lastAttempt","lastSuccess"] as const)for(const value of badTimes)assert.deepEqual(await read([{...healthyProbe("database"),[field]:value},healthyProbe("support-poll")]),{state:"unavailable",checks:[]});
 for(const generation of [-1,0.5,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,"1",null])assert.deepEqual(await read([{...healthyProbe("database"),generation},healthyProbe("support-poll")]),{state:"unavailable",checks:[]});
 for(const error of [null,undefined,1,{}, "synthetic private error"])assert.deepEqual(await read([{...healthyProbe("database"),error},healthyProbe("support-poll")]),{state:"unavailable",checks:[]});
 assert.equal((await read([{...healthyProbe("database"),generation:Number.MAX_SAFE_INTEGER},healthyProbe("support-poll")])).state,"available");
});
test("complete bounded own-data shape rejects missing/extra/private/sparse/accessor rows with zero getters",async()=>{
 let getters=0;const p=healthyProbe("database"),q=healthyProbe("support-poll"),accessor=Object.defineProperty({...p},"lastSuccess",{enumerable:true,get(){getters++;throw Error("private getter");}});
 const arrayAccessor=[p,q];Object.defineProperty(arrayAccessor,"0",{enumerable:true,get(){getters++;return p;}});
 const extraArray=[p,q];Object.defineProperty(extraArray,"extra",{get(){getters++;return "private";}});
 const missing={...p} as Partial<Probe>;delete missing.generation;
 const hidden=Object.defineProperty({...p},"generation",{value:1,enumerable:false});
 for(const checks of [undefined,null,{},[],[p],[p,q,p],Array(2),Array(1000),[accessor,q],arrayAccessor,extraArray,[missing,q],[hidden,q],[{...p,healthy:true},q],[{...p,privateDetail:"synthetic only"},q],[Object.assign(Object.create({inherited:true}),p),q]]){
  const out=await read(checks);assert.deepEqual(out,{state:"unavailable",checks:[]});assert.equal(JSON.stringify(out).includes("private"),false);
 }
 const bodies=[null,[],{checks:[p,q],extra:true},Object.defineProperty({},"checks",{enumerable:true,get(){getters++;return [p,q];}})];
 for(const body of bodies)assert.deepEqual(await operationStatus({command:async()=>body as Record<string,unknown>},NOW),{state:"unavailable",checks:[]});
 assert.throws(()=>freshness(accessor,NOW,DB_AGE),/^Error: operations_unavailable$/);assert.equal(getters,0);
});
test("observed operation retains return/error identity and begin/finish best effort without replay",async()=>{
 let actions=0,runs=0;const failing:OpsRepository={command:async()=>{actions++;throw Error("synthetic private DB");}},value={ok:true};
 assert.equal(await observedOperation("database",async()=>{runs++;return value;},failing),value);assert.equal(runs,1);assert.equal(actions,2);
 const original=Error("synthetic original error");await assert.rejects(observedOperation("database",async()=>{throw original;},failing),e=>e===original);
 const out=await operationStatus(failing,NOW);assert.deepEqual(out,{state:"unavailable",checks:[]});assert(!JSON.stringify(out).includes("private"));
});
test("repository timeout/no-store/redirect and default-off configuration remain unchanged with local request only",async()=>{
 const calls:{url:string;options:RequestInit|undefined}[]=[],request=(async(url,options)=>{calls.push({url:String(url),options});return Response.json({checks:[]});}) as typeof fetch;
 await operationsRepository("https://synthetic.invalid","synthetic-key",request).command("read",{});
 assert.equal(calls[0].url,"https://synthetic.invalid/rest/v1/rpc/wd_operations");assert.equal(calls[0].options?.redirect,"error");assert.equal(calls[0].options?.cache,"no-store");assert(calls[0].options?.signal instanceof AbortSignal);
 const names=["WD_OPERATIONS_ENABLED","SUPABASE_URL","NEXT_PUBLIC_SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"],before=names.map(n=>process.env[n]);
 try{
  for(const n of names)delete process.env[n];assert.equal(configuredOperations(),undefined);
  process.env.SUPABASE_URL="https://synthetic.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic-key";assert.equal(configuredOperations(),undefined);
  process.env.WD_OPERATIONS_ENABLED="false";assert.equal(configuredOperations(),undefined);
  process.env.WD_OPERATIONS_ENABLED="true";assert(configuredOperations());
  delete process.env.SUPABASE_URL;process.env.NEXT_PUBLIC_SUPABASE_URL="https://synthetic.invalid";assert(configuredOperations());
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;assert.equal(configuredOperations(),undefined);
 }finally{names.forEach((n,i)=>{if(before[i]===undefined)delete process.env[n];else process.env[n]=before[i];});}
});
test("dry alert uncertain acknowledgement still rejects after one send without automatic replay",async()=>{
 let sends=0,acks=0;const repo:OpsRepository={command:async action=>{if(action==="alerts")return {events:[{id:"synthetic-event",check:"database",state:"recovery"}]};acks++;throw Error("synthetic acknowledgement unavailable");}};
 await assert.rejects(dryRunAlerts(repo,async()=>{sends++;}));assert.equal(sends,1);assert.equal(acks,1);
});
