import {AccountError,boundedJson,keys} from "../account.ts";
type FormDependencies={configured:()=>boolean;limited:(request:Request)=>boolean;insert:(table:string,row:Record<string,unknown>)=>Promise<{ok:boolean;status?:number}>};
const EMAIL=/^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The real route and isolated tests share this bounded path. No mailbox or assistant is involved.
export function supportFormHandler(deps:FormDependencies){return async(request:Request)=>{
 if(!deps.configured())return Response.json({error:"not configured"},{status:503});
 if(deps.limited(request))return Response.json({error:"too many requests"},{status:429});
 try{
 const body=await boundedJson(request,8192);keys(body,["name","email","message","website"]);
 for(const [key,max] of Object.entries({name:120,email:254,message:2000,website:200})){
  if(body[key]!==undefined&&(typeof body[key]!=="string"||(body[key] as string).length>max))throw new AccountError(400,"invalid_support_request");
 }
 if(body.website)return Response.json({status:"ok"});
 const name=String(body.name??"").trim(),email=String(body.email??"").trim().toLowerCase(),message=String(body.message??"").trim();
 if(!EMAIL.test(email)||message.length<2)throw new AccountError(400,"invalid_support_request");
 const id=crypto.randomUUID();
 const thread=await deps.insert("support_threads",{id,channel:"form",from_email:email,subject:"Support form",status:"open"});
 if(!thread.ok)throw new AccountError(502,"could_not_save");
 const saved=await deps.insert("support_messages_v2",{thread_id:id,direction:"in",body:name?`${name}\n\n${message}`:message,ai:false});
 if(!saved.ok)throw new AccountError(502,"could_not_save");
 return Response.json({status:"ok"});
 }catch(e){return Response.json({error:e instanceof AccountError?e.message:"could_not_save"},{status:e instanceof AccountError?e.status:502});}
};}
