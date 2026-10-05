import {randomUUID} from "node:crypto";
export type Check="database"|"support-poll";
export type Probe={check:Check;lastAttempt:string|null;lastSuccess:string|null;error:"none"|"configuration"|"unavailable"|"interrupted";generation:number};
export function freshness(p:Probe,now:number,maxAgeMs:number){
 const t=p.lastAttempt?Date.parse(p.lastAttempt):NaN,s=p.lastSuccess?Date.parse(p.lastSuccess):NaN;
 const stale=!Number.isFinite(s)||s>now||now-s>maxAgeMs;
 const attemptInFuture=Number.isFinite(t)&&t>now;
 return {check:p.check,lastAttempt:p.lastAttempt,lastSuccess:p.lastSuccess,error:p.error,healthy:!stale&&!attemptInFuture&&p.error==="none",stale,attemptInFuture};
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
 try{const rows=(await repo.command("read",{})).checks as Probe[];return {state:"available",checks:rows.map(p=>freshness(p,now,p.check==="support-poll"?15*60_000:26*60*60_000))};}
 catch{return {state:"unavailable",checks:[]};}
}
export async function dryRunAlerts(repo:OpsRepository,transport:(event:{id:string;check:Check;state:string})=>Promise<void>){
 const events=(await repo.command("alerts",{})).events as {id:string;check:Check;state:string}[];
 for(const event of events){await transport(event);await repo.command("ack",{id:event.id});}return events.length;
}
