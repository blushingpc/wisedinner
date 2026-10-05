import {createHash,randomUUID} from "node:crypto";
import type {Mailbox,Outbound} from "./mail.ts";
export type SendLedger={command:(action:string,body:Record<string,unknown>)=>Promise<Record<string,unknown>>};
export class SupportSendError extends Error{constructor(code:string){super(code);}}
export function sendIdentity(mail:Outbound){
 const fingerprint=createHash("sha256").update(JSON.stringify([mail.to,mail.subject,mail.text,mail.inReplyTo??null,mail.references??[]])).digest("hex");
 const id=createHash("sha256").update(mail.inReplyTo?`reply\0${mail.inReplyTo}`:`digest\0${fingerprint}`).digest("hex");
 return {id,fingerprint};
}
// Prepared guard, not an outbound-content queue. Unknown SMTP outcomes remain held for a person.
export function guardedMailbox(mail:Mailbox,ledger:SendLedger):Mailbox{return {
 unread:()=>mail.unread(),markSeen:uid=>mail.markSeen(uid),
 async send(outbound){
  const identity=sendIdentity(outbound),owner=randomUUID();
  const reserved=await ledger.command("reserve",{...identity,owner});
  if(reserved.state==="accepted"&&typeof reserved.messageId==="string")return {messageId:reserved.messageId};
  if(reserved.state!=="reserved")throw new SupportSendError(typeof reserved.error==="string"?reserved.error:"send_held");
  const permitted=await ledger.command("begin",{id:identity.id,owner});
  if(permitted.state!=="sending")throw new SupportSendError("send_held");
  try{
   const result=await mail.send(outbound);
   if(typeof result.messageId!=="string"||!result.messageId||result.messageId.length>1024)throw new SupportSendError("send_outcome_unknown");
   const finished=await ledger.command("accept",{id:identity.id,owner,messageId:result.messageId});
   if(finished.state!=="accepted")throw new SupportSendError("send_outcome_unknown");
   return result;
  }catch{
   try{await ledger.command("hold",{id:identity.id,owner});}catch{/* durable sending row itself blocks automatic retry */}
   throw new SupportSendError("send_outcome_unknown");
  }
 }
};}
export function sendLedgerRepository(url:string,key:string,request:typeof fetch=fetch):SendLedger{return {async command(action,body){
 try{const r=await request(`${url.replace(/\/$/,"")}/rest/v1/rpc/wd_support_send`,{method:"POST",headers:{apikey:key,Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({p_action:action,p_body:body}),cache:"no-store",redirect:"error",signal:AbortSignal.timeout(8000)});
 if(!r.ok)throw Error();const value=await r.json();if(!value||typeof value!=="object"||Array.isArray(value))throw Error();return value;
 }catch{throw new SupportSendError("send_ledger_unavailable");}
}};}
export function configuredSendLedger(){
 if(process.env.WD_SUPPORT_DURABLE_SENDS_ENABLED!=="true")return undefined;
 const url=process.env.SUPABASE_URL??process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new SupportSendError("send_ledger_not_configured");
 return sendLedgerRepository(url,key);
}
