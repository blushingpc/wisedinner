import {freshness, type Probe} from "./operations.ts";

// Server-internal, finite and unbound. No env, fetch, DB, schedule or destination fallback.
export const OBSERVER_LIMITS = Object.freeze({bytes:65536, depth:8, nodes:1024, string:4096, events:8, timeoutMs:5000});
type Health = "healthy" | "failure" | "held";
type Reason = "current" | "database" | "stale" | "future" | "check_error" | "not_activated" | "unavailable" | "malformed" | "timeout" | "clock";
export type Observation = {health:Health;reason:Reason};
export type ObserverEvent = {id:number;transition:"failure"|"recovery";delivery:"reserved"|"uncertain"|"acknowledged";attempt:number|null};
export type ObserverState = {
 revision:number;generation:number;target:string;startedAt:number;
 observedAt:number|null;observation:Observation|null;conclusive:"unknown"|"healthy"|"failure";events:ObserverEvent[];
};
// This port must provide durable atomic CAS outside the monitored database. No live adapter is bound.
export type ObserverStore = {read:()=>unknown;compareAndSwap:(revision:number,next:ObserverState)=>boolean};
export type ObserverPorts = {
 clock:()=>{utcMs:number;sampledAtMs:number};store:ObserverStore;
 request:(target:string,signal:AbortSignal)=>Promise<Response>;
 transport?:(event:Readonly<{id:number;transition:"failure"|"recovery"}>,signal:AbortSignal)=>Promise<"acknowledged">;
};
export type ObserverResult = {state:string;durable:boolean;observation?:Observation;generation?:number;delivery?:string};
type Config={target:string;timeoutMs:number};
const own=(value:unknown,key:string)=>value&&typeof value==="object"?Object.getOwnPropertyDescriptor(value,key):undefined;
const enabled=(value:unknown)=>own(value,"enabled")?.value===true;
function need(value:unknown):asserts value {if(!value)throw Error("refused");}
const integer=(n:unknown):n is number=>typeof n==="number"&&Number.isSafeInteger(n)&&n>=0;
function data(value:unknown,depth=0,count={n:0}):unknown {
 need(depth<=OBSERVER_LIMITS.depth&&++count.n<=OBSERVER_LIMITS.nodes);
 if(value===null||typeof value==="boolean")return value;
 if(typeof value==="string"){need(value.length<=OBSERVER_LIMITS.string);return value;}
 if(typeof value==="number"){need(Number.isFinite(value)&&Math.abs(value)<=Number.MAX_SAFE_INTEGER);return value;}
 need(value&&typeof value==="object");
 const array=Array.isArray(value);need(Object.getPrototypeOf(value)===(array?Array.prototype:Object.prototype)||!array&&Object.getPrototypeOf(value)===null);
 const keys=Reflect.ownKeys(value);need(keys.length<=256&&keys.every(k=>typeof k==="string"));
 if(array){need(value.length<=128&&keys.length===value.length+1);const out=[];for(let i=0;i<value.length;i++){const d=own(value,String(i));need(d&&"value"in d&&d.enumerable);out.push(data(d.value,depth+1,count));}return out;}
 const out:Record<string,unknown>=Object.create(null);
 for(const k of keys as string[]){const d=own(value,k);need(d&&"value"in d&&d.enumerable);out[k]=data(d.value,depth+1,count);}return out;
}
function object(value:unknown):Record<string,unknown>{need(value&&typeof value==="object"&&!Array.isArray(value));return value as Record<string,unknown>;}
function fields(value:Record<string,unknown>,allowed:string[],required=allowed){need(Object.keys(value).every(k=>allowed.includes(k))&&required.every(k=>Object.hasOwn(value,k)));}
function config(value:unknown):Config {
 const c=object(data(value));fields(c,["enabled","target","timeoutMs"],["enabled","target"]);
 need(typeof c.target==="string"&&c.target.length<=2048);
 const u=new URL(c.target);need(u.href===c.target&&u.protocol==="https:"&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname==="/api/status");
 const timeoutMs=c.timeoutMs??OBSERVER_LIMITS.timeoutMs;need(integer(timeoutMs)&&timeoutMs>0&&timeoutMs<=OBSERVER_LIMITS.timeoutMs);
 return {target:c.target,timeoutMs};
}
function clock(ports:ObserverPorts,c:Config){
 const v=object(data(ports.clock()));fields(v,["utcMs","sampledAtMs"]);
 need(integer(v.utcMs)&&v.utcMs<=8640000000000000&&integer(v.sampledAtMs)&&v.sampledAtMs<=v.utcMs&&v.utcMs-v.sampledAtMs<=c.timeoutMs);
 return v.utcMs;
}
function timestamp(value:unknown):{ms:number;subMs:number}|null {
 if(value===null)return null;need(typeof value==="string"&&value.length<=40&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/.test(value));
 const t=Date.parse(value);need(integer(t)&&new Date(t).toISOString().slice(0,19)===value.slice(0,19));
 return {ms:t,subMs:Number((value.match(/\.(\d+)/)?.[1]??"").padEnd(6,"0").slice(3))};
}
export function inspectStatus(value:unknown,now:unknown):Observation {
 try{
  need(integer(now)&&now<=8640000000000000);const body=object(data(value)),db=object(body.db);
  fields(db,["ok","status","ms","error"],["ok","status","ms"]);
  need(typeof db.ok==="boolean"&&integer(db.status)&&db.status<=599&&typeof db.ms==="number"&&db.ms>=0&&db.ms<=60000);
  if(Object.hasOwn(db,"error"))need(["unavailable","not configured"].includes(db.error as string));
  if(!db.ok)return {health:"failure",reason:"database"};
  need(db.status>=200&&db.status<300&&!Object.hasOwn(db,"error"));
  const op=object(body.operations);fields(op,["state","checks"]);need(Array.isArray(op.checks));
  if(op.state==="not-activated"){need(op.checks.length===0);return {health:"held",reason:"not_activated"};}
  if(op.state==="unavailable"){need(op.checks.length===0);return {health:"failure",reason:"unavailable"};}
  need(op.state==="available"&&op.checks.length===2);const seen=new Set<string>();
  for(const row of op.checks){
   const p=object(row);fields(p,["check","lastAttempt","lastSuccess","error","healthy","stale","attemptInFuture"]);
   need((p.check==="database"||p.check==="support-poll")&&!seen.has(p.check));seen.add(p.check);
   need(["none","configuration","unavailable","interrupted"].includes(p.error as string)&&[p.healthy,p.stale,p.attemptInFuture].every(x=>typeof x==="boolean"));
   const attempt=timestamp(p.lastAttempt),success=timestamp(p.lastSuccess);
   if(attempt===null||success===null)return {health:"failure",reason:"stale"};
   if([attempt,success].some(t=>t.ms>now||t.ms===now&&t.subMs>0))return {health:"failure",reason:"future"};
   need(success.ms<attempt.ms||success.ms===attempt.ms&&success.subMs<=attempt.subMs);
   const computed=freshness({...p,generation:0} as Probe,now,p.check==="support-poll"?15*60000:26*3600000);
   if(computed.stale)return {health:"failure",reason:"stale"};
   if(!computed.healthy||!p.healthy||p.stale||p.attemptInFuture)return {health:"failure",reason:"check_error"};
  }
  return {health:"healthy",reason:"current"};
 }catch{return {health:"held",reason:integer(now)?"malformed":"clock"};}
}
function empty(target:string):ObserverState{return {revision:0,generation:0,target,startedAt:0,observedAt:null,observation:null,conclusive:"unknown",events:[]};}
function read(store:ObserverStore,c:Config):ObserverState {
 const raw=store.read();if(raw===null)return empty(c.target);
 const s=object(data(raw));fields(s,["revision","generation","target","startedAt","observedAt","observation","conclusive","events"]);
 need(integer(s.revision)&&integer(s.generation)&&s.generation<=s.revision&&s.target===c.target&&integer(s.startedAt)&&s.startedAt<=8640000000000000);
 need(s.observedAt===null||integer(s.observedAt)&&s.observedAt<=s.startedAt+OBSERVER_LIMITS.timeoutMs);
 need(["unknown","healthy","failure"].includes(s.conclusive as string)&&Array.isArray(s.events)&&s.events.length<=OBSERVER_LIMITS.events);
 if(s.observation!==null){const o=object(s.observation);fields(o,["health","reason"]);need(["healthy","failure","held"].includes(o.health as string)&&["current","database","stale","future","check_error","not_activated","unavailable","malformed","timeout","clock"].includes(o.reason as string));}
 need((s.observedAt===null)===(s.observation===null));const ids=new Set<number>();
 for(const row of s.events){const e=object(row);fields(e,["id","transition","delivery","attempt"]);need(integer(e.id)&&e.id>0&&e.id<=s.generation&&!ids.has(e.id));ids.add(e.id);need(["failure","recovery"].includes(e.transition as string)&&["reserved","uncertain","acknowledged"].includes(e.delivery as string));need(e.delivery==="reserved"?e.attempt===null:integer(e.attempt)&&e.attempt>0&&e.attempt<=s.revision);}
 return s as unknown as ObserverState;
}
function save(store:ObserverStore,previous:ObserverState,next:ObserverState){need(Number.isSafeInteger(next.revision));return store.compareAndSwap(previous.revision,structuredClone(next))===true;}
async function finite<T>(ms:number,work:(signal:AbortSignal)=>Promise<T>):Promise<T>{
 const abort=new AbortController();let timer:ReturnType<typeof setTimeout>|undefined;
 try{return await Promise.race([Promise.resolve().then(()=>work(abort.signal)),new Promise<never>((_,reject)=>{timer=setTimeout(()=>{abort.abort();reject(Error("timeout"));},ms);})]);}
 finally{clearTimeout(timer);abort.abort();}
}
function parseBody(text:string):unknown {
 // Refuse duplicate (including escaped-equivalent) keys before ordinary JSON parsing.
 let i=0,nodes=0;const space=()=>{while(/[\t\n\r ]/.test(text[i]??"~"))i++;};
 function string(){need(text[i++]==='"');const start=i-1;while(i<text.length){const c=text[i++];if(c==='"'){const s=JSON.parse(text.slice(start,i));need(s.length<=OBSERVER_LIMITS.string);return s as string;}if(c==='\\')i++;}throw Error("refused");}
 function value(depth:number){need(depth<=OBSERVER_LIMITS.depth&&++nodes<=OBSERVER_LIMITS.nodes);space();
  if(text[i]==='{'){i++;space();const keys=new Set<string>();if(text[i]==='}'){i++;return;}for(;;){space();const k=string();need(!keys.has(k)&&keys.size<256);keys.add(k);space();need(text[i++]===':');value(depth+1);space();const c=text[i++];if(c==='}')return;need(c===',');}}
  if(text[i]==='['){i++;space();if(text[i]===']'){i++;return;}for(let count=0;;count++){need(count<128);value(depth+1);space();const c=text[i++];if(c===']')return;need(c===',');}}
  if(text[i]==='"'){string();return;}const token=text.slice(i).match(/^(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/)?.[0];need(token);i+=token.length;
 }
 value(0);space();need(i===text.length);return JSON.parse(text);
}
async function responseObservation(c:Config,ports:ObserverPorts):Promise<unknown>{
 return finite(c.timeoutMs,async signal=>{
  const r=await ports.request(c.target,signal);need(!signal.aborted&&r instanceof Response&&r.url===c.target&&!r.redirected);
  if(r.status!==200)return {transportFailure:true};
  need(r.headers.get("content-type")?.split(";")[0].trim()==="application/json");
  const length=r.headers.get("content-length");need(length===null||/^\d+$/.test(length)&&Number(length)<=OBSERVER_LIMITS.bytes);
  const reader=r.body?.getReader();need(reader);const chunks:Uint8Array[]=[];let size=0;
  const cancel=()=>{void reader.cancel().catch(()=>{});};signal.addEventListener("abort",cancel,{once:true});
  try{for(let n=0;;n++){need(n<256);const part=await reader.read();need(!signal.aborted);if(part.done)break;size+=part.value.byteLength;need(size<=OBSERVER_LIMITS.bytes);chunks.push(part.value);}
   const bytes=new Uint8Array(size);let i=0;for(const chunk of chunks){bytes.set(chunk,i);i+=chunk.length;}
   return parseBody(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
  }finally{signal.removeEventListener("abort",cancel);cancel();}
 });
}
export async function observeStatus(value:unknown=undefined,ports?:ObserverPorts):Promise<ObserverResult>{
 if(!enabled(value))return {state:"disabled",durable:false};
 let c:Config;try{c=config(value);}catch{return {state:"unconfigured",durable:false};}
 if(!ports)return {state:"unbound",durable:false};
 let started:number;try{started=clock(ports,c);}catch{return {state:"clock_held",durable:false};}
 let initial:ObserverState,reserved:ObserverState;
 try{initial=read(ports.store,c);need(initial.startedAt<=started&&(initial.observedAt===null||initial.observedAt<=started)&&initial.generation<Number.MAX_SAFE_INTEGER);reserved={...initial,revision:initial.revision+1,generation:initial.generation+1,startedAt:started};if(!save(ports.store,initial,reserved))return {state:"storage_conflict",durable:false};}
 catch{return {state:"storage_unavailable",durable:false};}
 let body:unknown,observation:Observation|undefined;
 try{body=await responseObservation(c,ports);}catch(e){observation={health:"failure",reason:e instanceof Error&&e.message==="timeout"?"timeout":"unavailable"};}
 let finished:number;try{finished=clock(ports,c);need(finished>=started&&finished-started<=c.timeoutMs);}catch{return {state:"clock_held",durable:false,generation:reserved.generation};}
 observation??=body&&typeof body==="object"&&Object.hasOwn(body,"transportFailure")?{health:"failure",reason:"unavailable"}:inspectStatus(body,finished);
 try{
  const current=read(ports.store,c);if(current.generation!==reserved.generation||current.startedAt!==started)return {state:"superseded",durable:false,observation,generation:reserved.generation};
  const next={...current,revision:current.revision+1,observedAt:finished,observation};
  if(observation.health!=="held"){
   const transition=observation.health==="failure"&&current.conclusive!=="failure"?"failure":observation.health==="healthy"&&current.conclusive==="failure"?"recovery":null;
   if(transition){if(next.events.length>=OBSERVER_LIMITS.events)return {state:"event_capacity_held",durable:false,observation};next.events=[...next.events,{id:reserved.generation,transition,delivery:"reserved",attempt:null}];}
   next.conclusive=observation.health;
  }
  if(!save(ports.store,current,next))return {state:"storage_conflict",durable:false,observation};
  return {state:"observed",durable:true,observation,generation:reserved.generation,delivery:"unbound"};
 }catch{return {state:"storage_unavailable",durable:false,observation};}
}
// Explicit finite dispatch only. Persist uncertainty BEFORE invoking a supplied dry transport.
// Reopen/read never sends; uncertain events require separate proof-based operator reconciliation.
export async function deliverObserverEvent(value:unknown,ports:ObserverPorts|undefined,id:number):Promise<ObserverResult>{
 if(!enabled(value))return {state:"disabled",durable:false};
 let c:Config;try{c=config(value);}catch{return {state:"unconfigured",durable:false};}
 if(!ports?.transport)return {state:"unbound",durable:false};
 let started:number;try{started=clock(ports,c);}catch{return {state:"clock_held",durable:false};}
 let attempt:number,event:ObserverEvent;
 try{const current=read(ports.store,c);need(current.startedAt<=started&&(current.observedAt===null||current.observedAt<=started));const found=current.events.find(e=>e.id===id);if(!found)return {state:"event_missing",durable:false};if(found.delivery!=="reserved")return {state:found.delivery,durable:true};
  attempt=current.revision+1;event={...found,delivery:"uncertain",attempt};const next={...current,revision:attempt,events:current.events.map(e=>e.id===id?event:e)};
  if(!save(ports.store,current,next))return {state:"storage_conflict",durable:false};
 }catch{return {state:"storage_unavailable",durable:false};}
 try{const ack=await finite(c.timeoutMs,signal=>ports.transport!({id:event.id,transition:event.transition},signal));need(ack==="acknowledged");const finished=clock(ports,c);need(finished>=started&&finished-started<=c.timeoutMs);}
 catch{return {state:"uncertain",durable:true,delivery:"uncertain"};}
 try{const current=read(ports.store,c),found=current.events.find(e=>e.id===id);need(found?.delivery==="uncertain"&&found.attempt===attempt);const next={...current,revision:current.revision+1,events:current.events.map(e=>e.id===id?{...e,delivery:"acknowledged" as const}:e)};
  if(!save(ports.store,current,next))return {state:"ack_storage_conflict",durable:false,delivery:"uncertain"};return {state:"acknowledged",durable:true,delivery:"acknowledged"};
 }catch{return {state:"ack_storage_unavailable",durable:false,delivery:"uncertain"};}
}
