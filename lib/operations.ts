import {randomUUID} from "node:crypto";
export type Check="database"|"support-poll";
export type Probe={check:Check;lastAttempt:string|null;lastSuccess:string|null;error:"none"|"configuration"|"unavailable"|"interrupted";generation:number};
const timeLimit=8_640_000_000_000_000;
const validClock=(value:number)=>Number.isSafeInteger(value)&&Math.abs(value)<=timeLimit;
function ownRecord(value:unknown,keys:string[]):Record<string,unknown>{
 if(!value||typeof value!=="object"||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Reflect.ownKeys(value).length!==keys.length)throw Error("operations_unavailable");
 const result:Record<string,unknown>={};
 for(const key of keys){const property=Object.getOwnPropertyDescriptor(value,key);if(!property||!("value" in property)||!property.enumerable)throw Error("operations_unavailable");result[key]=property.value;}
 return result;
}
// PostgreSQL timestamptz JSON/text spells UTC or an explicit offset and retains
// up to six fractional digits. Compare microseconds without Date.parse truncation.
function timestamp(value:unknown):bigint|null{
 if(value===null)return null;
 if(typeof value!=="string"||value.length>64)throw Error("operations_unavailable");
 const match=/^(\d{4,6})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?([Zz]|[+-](?:\d{2}|\d{4}|\d{6}|\d{2}:\d{2}(?::\d{2})?))$/.exec(value);
 if(!match)throw Error("operations_unavailable");
 const [,y,m,d,h,min,s,fraction="",zone]=match,year=Number(y),month=Number(m),day=Number(d),hour=Number(h),minute=Number(min),second=Number(s);
 if(year<1||month<1||month>12||day<1||day>31||hour>23||minute>59||second>59)throw Error("operations_unavailable");
 const date=new Date(0);date.setUTCFullYear(year,month-1,day);date.setUTCHours(hour,minute,second,0);
 if(!validClock(date.getTime())||date.getUTCFullYear()!==year||date.getUTCMonth()!==month-1||date.getUTCDate()!==day)throw Error("operations_unavailable");
 let offset=0;
 if(zone.toUpperCase()!=="Z"){const digits=zone.slice(1).replaceAll(":",""),oh=Number(digits.slice(0,2)),om=Number(digits.slice(2,4)||"0"),os=Number(digits.slice(4,6)||"0");if(oh>23||om>59||os>59)throw Error("operations_unavailable");offset=(zone[0]==="+"?1:-1)*(oh*3600+om*60+os);}
 const micros=BigInt(date.getTime())*BigInt(1000)-BigInt(offset)*BigInt(1_000_000)+BigInt(fraction.padEnd(6,"0"));
 if(micros>BigInt(timeLimit)*BigInt(1000)||micros< -BigInt(timeLimit)*BigInt(1000))throw Error("operations_unavailable");
 return micros;
}
function probe(value:unknown,publicProjection=false):Probe{
 const keys=["check","lastAttempt","lastSuccess","error","generation"];
 // The independent observer rechecks the existing public projection. Its
 // derived flags are data only; they cannot certify temporal freshness.
 if(publicProjection&&value&&typeof value==="object"&&Reflect.ownKeys(value).length===8)keys.push("healthy","stale","attemptInFuture");
 const p=ownRecord(value,keys);
 if(keys.length===8&&keys.slice(5).some(key=>typeof p[key]!=="boolean"))throw Error("operations_unavailable");
 if((p.check!=="database"&&p.check!=="support-poll")||!["none","configuration","unavailable","interrupted"].includes(p.error as string)||!Number.isSafeInteger(p.generation)||(p.generation as number)<0)throw Error("operations_unavailable");
 timestamp(p.lastAttempt);timestamp(p.lastSuccess);
 return {check:p.check,lastAttempt:p.lastAttempt as string|null,lastSuccess:p.lastSuccess as string|null,error:p.error as Probe["error"],generation:p.generation as number};
}
export function freshness(p:Probe,now:number,maxAgeMs:number){
 p=probe(p,true);
 const t=timestamp(p.lastAttempt),s=timestamp(p.lastSuccess),valid=validClock(now)&&Number.isSafeInteger(maxAgeMs)&&maxAgeMs>=0&&maxAgeMs<=timeLimit;
 const current=valid?BigInt(now)*BigInt(1000):null;
 const stale=current===null||s===null||s>current||current-s>BigInt(maxAgeMs)*BigInt(1000);
 const attemptInFuture=current!==null&&t!==null&&t>current;
 return {check:p.check,lastAttempt:p.lastAttempt,lastSuccess:p.lastSuccess,error:p.error,healthy:!stale&&!attemptInFuture&&t!==null&&p.error==="none",stale,attemptInFuture};
}
export type OpsRepository={command:(action:string,body:Record<string,unknown>)=>Promise<Record<string,unknown>>};
export function operationsRepository(url:string,key:string,request:typeof fetch=fetch):OpsRepository{return {command:async(action,body)=>{
 const r=await request(`${url}/rest/v1/rpc/wd_operations`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_action:action,p_body:body}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(5000)});
 if(!r.ok)throw Error("operations_unavailable");return await r.json();
}};}
export async function observedOperation<T>(check:Check,operation:()=>Promise<T>,repo:OpsRepository|undefined,successful:(value:T)=>boolean=()=>true){
 const attempt=randomUUID();if(repo)try{await repo.command("begin",{check,attempt});}catch{/* monitoring must not create a duplicate customer action */}
 try{const value=await operation();if(repo)try{await repo.command("finish",{check,attempt,error:successful(value)?"none":"unavailable"});}catch{}return value;}
 catch(e){if(repo)try{await repo.command("finish",{check,attempt,error:"unavailable"});}catch{}throw e;}
}
export function configuredOperations(){
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 return process.env.WD_OPERATIONS_ENABLED==="true"&&url&&key?operationsRepository(url,key):undefined;
}
export async function operationStatus(repo:OpsRepository|undefined,now=Date.now()){
 if(!repo)return {state:"not-activated",checks:[]};
 if(!validClock(now))return {state:"unavailable",checks:[]};
 try{
  const rows=ownRecord(await repo.command("read",{}),["checks"]).checks;
  if(!Array.isArray(rows)||Object.getPrototypeOf(rows)!==Array.prototype||rows.length!==2||Reflect.ownKeys(rows).length!==3)throw Error("operations_unavailable");
  const probes=[0,1].map(i=>{const property=Object.getOwnPropertyDescriptor(rows,String(i));if(!property||!("value" in property)||!property.enumerable)throw Error("operations_unavailable");return probe(property.value);});
  if(new Set(probes.map(p=>p.check)).size!==2)throw Error("operations_unavailable");
  return {state:"available",checks:probes.map(p=>freshness(p,now,p.check==="support-poll"?15*60_000:26*60*60_000))};
 }
 catch{return {state:"unavailable",checks:[]};}
}
export async function dryRunAlerts(repo:OpsRepository,transport:(event:{id:string;check:Check;state:string})=>Promise<void>){
 const events=(await repo.command("alerts",{})).events as {id:string;check:Check;state:string}[];
 for(const event of events){await transport(event);await repo.command("ack",{id:event.id});}return events.length;
}
