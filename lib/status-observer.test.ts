import {test} from "node:test";
import assert from "node:assert/strict";
import {inspectStatus,observeStatus,deliverObserverEvent,OBSERVER_LIMITS,type ObserverPorts,type ObserverState} from "./status-observer.ts";
import {operationStatus} from "./operations.ts";
const NOW=Date.parse("2026-10-07T01:00:00Z"),target="https://observer-fixture.invalid/api/status",cfg={enabled:true,target,timeoutMs:100};
async function status(){return {db:{ok:true,status:200,ms:1},operations:await operationStatus({command:async()=>({checks:["database","support-poll"].map(check=>({check,lastAttempt:new Date(NOW).toISOString(),lastSuccess:new Date(NOW).toISOString(),error:"none",generation:1}))})},NOW)};}
function response(body:unknown,url=target){const r=Response.json(body);Object.defineProperty(r,"url",{value:url});return r;}
function fixture(body:unknown){
 let state:ObserverState|null=null,requests=0,sends=0,reads=0,saves=0;let now=NOW;
 const ports:ObserverPorts={clock:()=>({utcMs:now,sampledAtMs:now}),request:async()=>{requests++;return response(body);},store:{read:()=>{reads++;return structuredClone(state);},compareAndSwap:(revision,next)=>{saves++;if(revision!==(state?.revision??0))return false;state=structuredClone(next);return true;}},transport:async()=>{sends++;return "acknowledged";}};
 return {ports,state:()=>structuredClone(state)!,counts:()=>({requests,sends,reads,saves}),setNow:(v:number)=>{now=v;},setState:(v:ObserverState)=>{state=v;}};
}
test("default disabled/nontrigger paths do not invoke getters, request, clock, storage, transport or timers",async()=>{
 let getters=0;const ports=new Proxy({},{get(){getters++;throw Error("side effect");}}) as ObserverPorts;
 const disabled={enabled:false,get target(){getters++;throw Error("side effect");}};
 assert.deepEqual(await observeStatus(undefined,ports),{state:"disabled",durable:false});assert.equal((await observeStatus(disabled,ports)).state,"disabled");
 assert.equal((await deliverObserverEvent(disabled,ports,1)).state,"disabled");assert.equal(getters,0);
 const accessor={get enabled(){getters++;return true;}};assert.equal((await observeStatus(accessor,ports)).state,"disabled");assert.equal(getters,0);
});
test("unconfigured/unbound target cannot allocate ports or fallback to env",async()=>{
 let effects=0;const ports=new Proxy({},{get(){effects++;throw Error("side effect");}}) as ObserverPorts;
 for(const target of [undefined,"http://observer-fixture.invalid/api/status","https://u:p@observer-fixture.invalid/api/status","https://observer-fixture.invalid/api/status?secret=x","https://observer-fixture.invalid/wrong","https://observer-fixture.invalid/api/status#x"]){assert.equal((await observeStatus({enabled:true,target},ports)).state,"unconfigured");}
 assert.equal((await observeStatus(cfg)).state,"unbound");assert.equal(effects,0);
});
test("actual operations public projection is recomputed and accepted locally, without mutating response or sending",async()=>{
 const body=await status(),original=structuredClone(body),f=fixture(body);const result=await observeStatus(cfg,f.ports);
 assert.deepEqual(result.observation,{health:"healthy",reason:"current"});assert.equal(result.durable,true);assert.deepEqual(body,original);assert.equal(f.counts().sends,0);assert.equal(f.state().events.length,0);
});
test("both expected checks must exist exactly once; unknown/malformed/getter/sparse projections hold",async()=>{
 const body=await status();for(const checks of [[],[body.operations.checks[0]],[body.operations.checks[0],body.operations.checks[0]],[{...body.operations.checks[0],check:"unknown"},body.operations.checks[1]],Array(2)])assert.equal(inspectStatus({...body,operations:{state:"available",checks}},NOW).health,"held");
 let getters=0;const malformed={get db(){getters++;return body.db;},operations:body.operations};assert.equal(inspectStatus(malformed,NOW).health,"held");assert.equal(getters,0);
});
test("HTTP/server healthy flags alone never grant health; invalid current db, private errors and flags fail closed",async()=>{
 const body=await status();for(const db of [{ok:true},{...body.db,ok:"true"},{...body.db,status:503},{...body.db,error:"synthetic private error"},{...body.db,ms:Infinity}])assert.notEqual(inspectStatus({...body,db},NOW).health,"healthy");
 assert.equal(inspectStatus({...body,db:{ok:false,status:0,ms:2,error:"unavailable"}},NOW).reason,"database");
 assert.equal(inspectStatus({...body,operations:{state:"not-activated",checks:[]}},NOW).health,"held");assert.equal(inspectStatus({...body,operations:{state:"unavailable",checks:[]}},NOW).health,"failure");
 const falseFlag=structuredClone(body);falseFlag.operations.checks[0].healthy=false;assert.notEqual(inspectStatus(falseFlag,NOW).health,"healthy");
});
test("last success, exact support/database age, UTC precision and future/error timestamps are independently checked",async()=>{
 const body=await status();
 for(const [i,age] of [[0,26*3600000],[1,15*60000]]){
  const boundary=structuredClone(body);boundary.operations.checks[i].lastSuccess=new Date(NOW-age).toISOString();assert.equal(inspectStatus(boundary,NOW).health,"healthy");
  boundary.operations.checks[i].lastSuccess=new Date(NOW-age-1).toISOString();assert.equal(inspectStatus(boundary,NOW).reason,"stale");
 }
 for(const field of ["lastAttempt","lastSuccess"] as const)for(const stamp of [null,"yesterday","2026-02-30T00:00:00Z","2026-10-07T01:00:00",new Date(NOW+1).toISOString()]){const b=structuredClone(body);b.operations.checks[1][field]=stamp;assert.notEqual(inspectStatus(b,NOW).health,"healthy");}
 const micro=structuredClone(body);micro.operations.checks[1].lastSuccess="2026-10-07T00:59:59.123456+00:00";assert.equal(inspectStatus(micro,NOW).health,"healthy");
 const microFuture=structuredClone(body);microFuture.operations.checks[1].lastSuccess="2026-10-07T01:00:00.000001Z";assert.equal(inspectStatus(microFuture,NOW).reason,"future");
 for(const error of ["configuration","interrupted","unavailable"] as const){const b=structuredClone(body);b.operations.checks[1].error=error;assert.equal(inspectStatus(b,NOW).health,"failure");}
 for(const now of [NaN,Infinity,-1,null,"now"]){assert.notEqual(inspectStatus(body,now).health,"healthy");}
});
test("missing, stale, future or reversed independent clock holds before request/storage or durable finish",async()=>{
 for(const value of [{utcMs:NaN,sampledAtMs:NOW},{utcMs:NOW,sampledAtMs:NOW-101},{utcMs:NOW,sampledAtMs:NOW+1}]){const f=fixture(await status());f.ports.clock=()=>value;assert.equal((await observeStatus(cfg,f.ports)).state,"clock_held");assert.deepEqual(f.counts(),{requests:0,sends:0,reads:0,saves:0});}
 const f=fixture(await status());let calls=0;f.ports.clock=()=>({utcMs:calls++?NOW-1:NOW,sampledAtMs:NOW-1});assert.equal((await observeStatus(cfg,f.ports)).durable,false);assert.equal(f.state().observation,null);
});
test("failure persists independently, unchanged failure deduplicates, recovery reserves a separate coarse event",async()=>{
 const f=fixture({db:{ok:false,status:503,ms:1},operations:{state:"unavailable",checks:[]},private:"synthetic confidential body"});
 assert.equal((await observeStatus(cfg,f.ports)).observation?.reason,"database");await observeStatus(cfg,f.ports);assert.equal(f.state().events.length,1);
 f.ports.request=async()=>response(await status());await observeStatus(cfg,f.ports);await observeStatus(cfg,f.ports);
 assert.deepEqual(f.state().events.map(e=>e.transition),["failure","recovery"]);assert(!JSON.stringify(f.state()).includes("confidential"));assert.equal(f.counts().sends,0);
});
test("finite timeout covers request and stalled response body; abort/cancel never claims health",async()=>{
 for(const body of [false,true]){const f=fixture(null);let signal:AbortSignal|undefined,cancelled=0;
  f.ports.request=async(_,s)=>{signal=s;if(!body)return new Promise<Response>(()=>{});const r=new Response(new ReadableStream({cancel(){cancelled++;}}),{headers:{"content-type":"application/json"}});Object.defineProperty(r,"url",{value:target});return r;};
  const result=await observeStatus({...cfg,timeoutMs:15},f.ports);assert.equal(result.observation?.reason,"timeout");assert.equal(signal?.aborted,true);if(body)assert.equal(cancelled,1);
 }
});
test("response target, redirect, byte/header/depth/array/UTF8/malformed bounds are refused without private output",async()=>{
 const cases=[()=>response(awaitableNever()),()=>response({},"https://other.invalid/api/status"),()=>{const r=response({});Object.defineProperty(r,"redirected",{value:true});return r;},()=>new Response("x".repeat(65537),{headers:{"content-type":"application/json"}}),()=>new Response(new Uint8Array([255]),{headers:{"content-type":"application/json"}}),()=>new Response("{} trailing",{headers:{"content-type":"application/json"}}),()=>new Response("{}",{headers:{"content-type":"application/json","content-length":"999999"}})];
 function awaitableNever(){return {db:{get ok(){throw Error("synthetic private");}}};}
 for(const make of cases){const f=fixture(null);f.ports.request=async()=>{const r=make();if(!r.url)Object.defineProperty(r,"url",{value:target});return r;};const result=await observeStatus(cfg,f.ports);assert.notEqual(result.observation?.health,"healthy");assert(!JSON.stringify(result).includes("private"));}
 let deep:unknown={};for(let i=0;i<10;i++)deep={deep};assert.equal(inspectStatus(deep,NOW).health,"held");assert.equal(inspectStatus({large:Array(129).fill(0)},NOW).health,"held");
});
test("older request completion is fenced even at equal clock; neither result erases newer state",async()=>{
 const f=fixture(null);let finish!: (r:Response)=>void,calls=0;f.ports.request=async()=>++calls===1?new Promise<Response>(resolve=>{finish=resolve;}):response(await status());
 const older=observeStatus(cfg,f.ports);while(!finish)await new Promise(resolve=>setImmediate(resolve));assert.equal((await observeStatus(cfg,f.ports)).durable,true);finish(response({db:{ok:false,status:0,ms:0}}));assert.equal((await older).state,"superseded");assert.equal(f.state().observation?.health,"healthy");assert.equal(f.state().events.length,0);
});
test("clock reversal below a completed observation and lost clock after transport cannot establish durable acknowledgement",async()=>{
 const f=fixture(await status());let calls=0;f.ports.clock=()=>({utcMs:NOW+(calls++?50:0),sampledAtMs:NOW+(calls>1?50:0)});assert.equal((await observeStatus(cfg,f.ports)).durable,true);f.ports.clock=()=>({utcMs:NOW+25,sampledAtMs:NOW+25});assert.equal((await observeStatus(cfg,f.ports)).state,"storage_unavailable");
 const g=fixture({db:{ok:false,status:0,ms:0}});await observeStatus(cfg,g.ports);calls=0;g.ports.clock=()=>({utcMs:calls++?NaN:NOW,sampledAtMs:NOW});assert.equal((await deliverObserverEvent(cfg,g.ports,1)).state,"uncertain");assert.equal(g.state().events[0].delivery,"uncertain");
});
test("wire duplicate/escaped-equivalent keys, quoted braces and controls have bounded lexical handling",async()=>{
 const normal=JSON.stringify(await status());for(const text of [normal.replace('"ok":true','"ok":false,"ok":true'),normal.replace('"ok":true','"ok":false,"\\u006fk":true'),normal+'{}',normal.replace('"db":','"db":undefined,')]){const f=fixture(null);f.ports.request=async()=>{const r=new Response(text,{headers:{"content-type":"application/json"}});Object.defineProperty(r,"url",{value:target});return r;};assert.notEqual((await observeStatus(cfg,f.ports)).observation?.health,"healthy");}
 const body={...await status(),note:'quoted { braces } backslash \\ newline\n café'};assert.equal((await observeStatus(cfg,fixture(body).ports)).observation?.health,"healthy");
});
test("state corruption/target mismatch, CAS conflicts and save failure cannot acknowledge durable success",async()=>{
 const f=fixture(await status());f.ports.store.compareAndSwap=()=>false;assert.equal((await observeStatus(cfg,f.ports)).state,"storage_conflict");assert.equal(f.counts().requests,0);
 const g=fixture(await status());let saves=0;const save=g.ports.store.compareAndSwap;g.ports.store.compareAndSwap=(rev,next)=>{if(++saves===2)throw Error("synthetic private storage");return save(rev,next);};const result=await observeStatus(cfg,g.ports);assert.equal(result.durable,false);assert.equal(g.state().observation,null);
 g.setState({...g.state(),target:"https://other.invalid/api/status"});assert.equal((await observeStatus(cfg,g.ports)).state,"storage_unavailable");
 const h=fixture(null);h.ports.store.read=()=>({get revision(){throw Error("must not invoke");}});assert.equal((await observeStatus(cfg,h.ports)).state,"storage_unavailable");
});
test("dry delivery acknowledges only after durable reservation and exact acknowledgement, repeat consumption is inert",async()=>{
 const f=fixture({db:{ok:false,status:0,ms:0}});await observeStatus(cfg,f.ports);f.ports.transport=async event=>{assert.equal(f.state().events[0].delivery,"uncertain");assert.deepEqual(Object.keys(event).sort(),["id","transition"]);return "acknowledged";};
 assert.equal((await deliverObserverEvent(cfg,f.ports,1)).state,"acknowledged");const state=f.state();assert.equal((await deliverObserverEvent(cfg,f.ports,1)).state,"acknowledged");assert.deepEqual(f.state(),state);
});
test("transport exception/timeout/ambiguous acknowledgement never automatically resends; save-after-ack failure stays uncertain",async()=>{
 for(const mode of ["throw","timeout","ambiguous","ack-save"]){const f=fixture({db:{ok:false,status:0,ms:0}});await observeStatus(cfg,f.ports);let sends=0;f.ports.transport=async()=>{sends++;if(mode==="throw")throw Error("synthetic private transport");if(mode==="timeout")return new Promise(()=>{});return (mode==="ambiguous"?"unknown":"acknowledged") as "acknowledged";};
  if(mode==="ack-save"){const save=f.ports.store.compareAndSwap;f.ports.store.compareAndSwap=(rev,next)=>{if(next.events[0].delivery==="acknowledged")throw Error("storage");return save(rev,next);};}
  const first=await deliverObserverEvent({...cfg,timeoutMs:15},f.ports,1);assert.notEqual(first.state,"acknowledged");assert.equal(f.state().events[0].delivery,"uncertain");await observeStatus(cfg,f.ports);assert.equal((await deliverObserverEvent(cfg,f.ports,1)).state,"uncertain");assert.equal(sends,1);
 }
});
test("delivery save-before-send conflict invokes no transport; event capacity and safe-generation overflow hold",async()=>{
 const f=fixture({db:{ok:false,status:0,ms:0}});await observeStatus(cfg,f.ports);f.ports.store.compareAndSwap=()=>false;assert.equal((await deliverObserverEvent(cfg,f.ports,1)).state,"storage_conflict");assert.equal(f.counts().sends,0);
 const g=fixture(await status());await observeStatus(cfg,g.ports);g.setState({...g.state(),revision:20,generation:20,conclusive:"failure",events:Array.from({length:OBSERVER_LIMITS.events},(_,i)=>({id:i+1,transition:"failure",delivery:"uncertain",attempt:i+1}))});assert.equal((await observeStatus(cfg,g.ports)).state,"event_capacity_held");
 g.setState({...g.state(),revision:Number.MAX_SAFE_INTEGER,generation:Number.MAX_SAFE_INTEGER});assert.equal((await observeStatus(cfg,g.ports)).durable,false);
});
