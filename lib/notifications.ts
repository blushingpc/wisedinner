import {AccountError,boundedJson,keys,object,UUID,type VerifiedAccount} from "./account.ts";
export type PushConfig={projectId:string;environment:"production"|"development"};
export type PushRepository={command:(account:VerifiedAccount,action:string,body:Record<string,unknown>,key:string)=>Promise<unknown>};
export function notificationHandler(deps:{verify:(r:Request)=>Promise<VerifiedAccount>;repository:PushRepository;config:PushConfig}){
 return async(request:Request)=>{try{
 const account=await deps.verify(request),body=await boundedJson(request,4096),key=request.headers.get("idempotency-key");
 if(!key||!UUID.test(key)||new URL(request.url).search)throw new AccountError(400,"invalid_request");
 let action:string;
 if(request.method==="POST"){
 keys(body,["deviceId","revision","projectId","environment","permission","token"]);
 if(typeof body.deviceId!=="string"||!UUID.test(body.deviceId)||body.projectId!==deps.config.projectId||body.environment!==deps.config.environment||!["granted","denied","undetermined"].includes(body.permission as string))throw new AccountError(400,"invalid_registration");
 if(body.permission!=="granted"){action="revoke";keys(body,["deviceId","projectId","environment","permission"]);}
 else{if(!Number.isSafeInteger(body.revision)||(body.revision as number)<0||typeof body.token!=="string"||!/^(ExpoPushToken|ExponentPushToken)\[[A-Za-z0-9_-]{16,128}\]$/.test(body.token))throw new AccountError(400,"invalid_registration");action="register";}
 }else if(request.method==="DELETE"){
 keys(body,["deviceId","all"]);if(body.all===true&&body.deviceId===undefined)action="revoke_all";else if(body.all===undefined&&typeof body.deviceId==="string"&&UUID.test(body.deviceId))action="revoke";else throw new AccountError(400,"invalid_request");
 }else throw new AccountError(405,"method_not_allowed");
 const payload=action==="register"?{deviceId:body.deviceId,projectId:deps.config.projectId,environment:deps.config.environment,token:body.token,revision:body.revision}:action==="revoke"?{deviceId:body.deviceId}:{};
 const result=await deps.repository.command(account,action,payload,key);
 return Response.json({apiVersion:1,...object(result)},{headers:{"Cache-Control":"no-store"}});
 }catch(e){const safe=e instanceof AccountError?e:new AccountError(503,"notifications_unavailable");return Response.json({error:safe.message},{status:safe.status,headers:{"Cache-Control":"no-store"}});}};
}
export function supabasePushRepository(url:string,key:string,request:typeof fetch=fetch):PushRepository{return {command:async(account,action,body,id)=>{
 const r=await request(`${url.replace(/\/$/,"")}/rest/v1/rpc/wd_push_command`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${account.token}`,"Content-Type":"application/json"},body:JSON.stringify({p_action:action,p_body:body,p_key:id}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw new AccountError(503,"notifications_unavailable");const j=object(await r.json());if(j.error)throw new AccountError(j.error==="account_inactive"?410:j.error==="rate_limited"?429:["revision_conflict","idempotency_conflict","token_owned_elsewhere"].includes(j.error as string)?409:400,String(j.error));return j;
}};}
export type PushJob={id:string;userId:string;deviceId:string;projectId:string;environment:PushConfig["environment"];token:string;body:string;attempt:number};
export type PushResult={status:"ok"|"error";id?:string;details?:{error?:string}};
export type DeliveryRepository={claim:(id:string)=>Promise<PushJob|null>;allowed:(job:PushJob)=>Promise<boolean>;finish:(job:PushJob,state:"ticket"|"retry"|"held"|"uncertain",ticket?:string)=>Promise<void>;disable:(job:PushJob)=>Promise<void>};
export function receiptAction(r:PushResult){if(r.status==="ok")return "complete";const code=r.details?.error;return code==="DeviceNotRegistered"?"disable":code==="MessageRateExceeded"?"retry":"held";}
// No real transport or schedule is bound. Claim must atomically prevent duplicate concurrent jobs.
export async function deliverNotification(id:string,repo:DeliveryRepository,send:(job:PushJob)=>Promise<PushResult>,config:PushConfig,enabled=false){
 if(!enabled)return {state:"disabled"};const job=await repo.claim(id);if(!job)return {state:"duplicate_or_unavailable"};
 if(job.projectId!==config.projectId||job.environment!==config.environment||!await repo.allowed(job)){await repo.finish(job,"held");return {state:"held"};}
 try{const ticket=await send(job);if(ticket.status==="ok"&&typeof ticket.id==="string"&&UUID.test(ticket.id)){await repo.finish(job,"ticket",ticket.id);return {state:"ticket"};}
 const action=receiptAction(ticket);if(action==="disable")await repo.disable(job);await repo.finish(job,action==="retry"?"retry":"held");return {state:action};}
 catch{await repo.finish(job,"uncertain");return {state:"uncertain"};} // Never blindly resend after an ambiguous accepted request.
}
export function pushDeliveryRepository(url:string,key:string,request:typeof fetch=fetch){
 async function call(action:string,body:unknown){const r=await request(`${url}/rest/v1/rpc/wd_push_delivery`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_action:action,p_body:body}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});if(!r.ok)throw new AccountError(503,"push_repository_unavailable");const j=object(await r.json());if(j.error)throw new AccountError(503,"push_command_rejected");return j;}
 return {claim:async(id:string)=>(await call("claim",{id})).job as PushJob|null,allowed:async(job:PushJob)=>(await call("allowed",{id:job.id,attempt:job.attempt})).allowed===true,finish:async(job:PushJob,state:string,ticket?:string)=>{await call("finish",{id:job.id,attempt:job.attempt,state,ticket});},disable:async(job:PushJob)=>{await call("disable",{id:job.id,attempt:job.attempt});},enqueue:async(job:Omit<PushJob,"token"|"attempt">)=>{await call("enqueue",job);},receipt:async(id:string,ticket:string,result:PushResult)=>{await call("receipt",{id,ticket,result:receiptAction(result)});}};
}
