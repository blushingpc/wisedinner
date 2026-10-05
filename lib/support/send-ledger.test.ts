import {test}from "node:test";
import assert from "node:assert/strict";
import {guardedMailbox,sendIdentity,sendLedgerRepository,type SendLedger}from "./send-ledger.ts";
import {handlePoll,type Store}from "./handler.ts";
import type {Mailbox,Outbound}from "./mail.ts";
const message:Outbound={to:"synthetic-recipient.invalid",subject:"Fixture",text:"Synthetic support reply",inReplyTo:"synthetic-inbound"};
function fixture(cap=450){
 const rows=new Map<string,Record<string,unknown>>();let count=0,sends=0;
 const ledger:SendLedger={async command(action,b){const row=rows.get(b.id as string);
  if(action==="reserve"){if(row){if(row.fingerprint!==b.fingerprint)return {error:"send_identity_conflict"};return row.state==="accepted"?{state:"accepted",messageId:row.messageId}:{error:"send_held"};}if(count>=cap)return {error:"send_cap"};count++;rows.set(b.id as string,{...b,state:"reserved"});return {state:"reserved"};}
  if(!row||row.owner!==b.owner)return {error:"send_held"};if(action==="begin"){row.state="sending";return {state:"sending"};}if(action==="accept"){row.state="accepted";row.messageId=b.messageId;return {state:"accepted"};}row.state="held";return {state:"held"};
 }};
 const mail:Mailbox={unread:async()=>[],markSeen:async()=>{},send:async()=>({messageId:`synthetic-out-${++sends}`})};
 return {rows,ledger,mail,get sends(){return sends;}};
}
test("durable wrapper suppresses duplicates and changed-content ownership conflicts",async()=>{
 const f=fixture(),m=guardedMailbox(f.mail,f.ledger);const a=await m.send(message);assert.deepEqual(await m.send(message),a);assert.equal(f.sends,1);
 await assert.rejects(m.send({...message,text:"Changed retry"}),/send_identity_conflict/);
 assert.equal(f.sends,1);assert.equal(sendIdentity(message).id,sendIdentity({...message,to:"other.invalid"}).id);
});
test("cap and ledger outage fail before SMTP, uncertain acceptance is never blindly retried",async()=>{
 const f=fixture(0);await assert.rejects(guardedMailbox(f.mail,f.ledger).send(message),/send_cap/);assert.equal(f.sends,0);
 await assert.rejects(guardedMailbox(f.mail,{command:async()=>{throw Error("unavailable");}}).send(message));assert.equal(f.sends,0);
 const uncertain=fixture(),base=uncertain.ledger;
 const wrapped=guardedMailbox(uncertain.mail,{command:async(a,b)=>{if(a==="accept")throw Error("lost response");return base.command(a,b);}});
 await assert.rejects(wrapped.send(message),/send_outcome_unknown/);await assert.rejects(wrapped.send(message),/send_held/);assert.equal(uncertain.sends,1);
});
test("SMTP rejection stays held and never becomes a successful message",async()=>{
 const f=fixture();const m=guardedMailbox({...f.mail,send:async()=>{throw Error("synthetic transport error");}},f.ledger);
 await assert.rejects(m.send(message),/send_outcome_unknown/);await assert.rejects(m.send(message),/send_held/);assert.equal([...f.rows.values()][0].state,"held");
});
test("actual parallel support polls reproduce old cap race; guarded sends bound it",async()=>{
 const run=async(guard:boolean)=>{const f=fixture(1);let sent=0;
 const store:Store={findThread:async()=>null,createThread:async t=>({id:"fixture",status:"open",...t}),logMessage:async()=>{},setStatus:async()=>{},sentLast24h:async()=>449,hasMessage:async()=>false};
 const poll=(id:string)=>{const mail:Mailbox={unread:async()=>[{uid:1,messageId:id,from:"synthetic.invalid",subject:"Fixture",text:"Question",date:"2000-01-01"}],markSeen:async()=>{},send:async()=>{sent++;return {messageId:`synthetic-${sent}`};}};
 return handlePoll(guard?guardedMailbox(mail,f.ledger):mail,store,async()=>({intent:"informational",category:"other",reason:"fixture",reply:"Prices are estimates."}),"");};
 const results=await Promise.allSettled([poll("inbound-a"),poll("inbound-b")]);return {sent,results};};
 assert.equal((await run(false)).sent,2,"legacy count/send/log path permits two sends with one remaining allowance");
 const checked=await run(true);assert.equal(checked.sent,1);assert.equal(checked.results.filter(r=>r.status==="rejected").length,1);
});
test("ledger HTTP adapter sends only hashes/claims and redacts provider errors",async()=>{
 const calls:RequestInit[]=[];const repo=sendLedgerRepository("https://fixture.supabase.co","synthetic",async(_,o)=>{calls.push(o!);return new Response("private provider error",{status:503});});
 await assert.rejects(repo.command("reserve",{...sendIdentity(message),owner:"synthetic"}),/send_ledger_unavailable/);
 const body=String(calls[0].body);assert.ok(!body.includes(message.to)&&!body.includes(message.text));assert.equal(calls[0].redirect,"error");
});
