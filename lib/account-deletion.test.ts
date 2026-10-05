import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import {PGlite} from "@electric-sql/pglite";
import {accountDeletionWorker,configuredAccountDeletionWorker,deletionRepository,DeletionProgressError,type DeletionRepository,type DeletionProviders,type DeletionTarget,type DeletionProof} from "./account-deletion.ts";
import {accountHandler,AccountError} from "./account.ts";

const A="10000000-0000-4000-8000-000000000001",B="10000000-0000-4000-8000-000000000002",K="20000000-0000-4000-8000-000000000001",D="30000000-0000-4000-8000-000000000001",OWNER="40000000-0000-4000-8000-000000000001",OTHER="40000000-0000-4000-8000-000000000002";
const H="a".repeat(64),E="b".repeat(64);
type Fault={action:string;after?:boolean;dependency?:string};
async function fixture(apple:"linked"|"none"|"unknown"="linked",fault?:Fault){
 // Actual migrations, explicit disposable memory only. One connection and emulated Auth, not hosted proof.
 const db=await PGlite.create("memory://");
 await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
  create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
  create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
  create table auth.users(id uuid primary key);
  create table public.unrelated_sentinel(id integer);insert into public.unrelated_sentinel values(7);grant select on public.unrelated_sentinel to authenticated;`);
 for(const file of ["0006_wd_accounts.sql","0007_wd_billing.sql","0009_wd_notifications.sql","0013_wd_account_deletion.sql"])await db.exec(await readFile(new URL(`../supabase/migrations/${file}`,import.meta.url),"utf8"));
 const login=async(role="service_role",id?:string,age=0)=>{await db.exec("reset role");await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({role,sub:id,is_anonymous:false,amr:[{method:"oauth",timestamp:Math.floor(Date.now()/1000)-age}]})]);await db.exec(`set role ${role}`);};
 const account=async(action:string,body={},key:string|null=K)=>(await db.query<{r:Record<string,unknown>}>("select public.wd_account_command($1,$2::jsonb,$3::uuid)r",[action,JSON.stringify(body),key])).rows[0].r;
 const admin=async(sql:string,params:unknown[]=[])=>{await db.exec("reset role");const rows=(await db.query<Record<string,unknown>>(sql,params)).rows;await login();return rows;};
 for(const id of [A,B]){await login("authenticated",id);await account("initialize");}
 await admin("insert into auth.users values($1),($2)",[A,B]);
 // Existing 0009 trigger, not a newly invented worker cleanup.
 await db.exec("reset role");
 await db.exec(`insert into public.wd_push_projects values('${D}','development',true);
  insert into public.wd_push_tokens values('${A}','${D}','${D}','development','synthetic-push-token-A',1,'${H}',true,now());
  insert into public.wd_push_tokens values('${B}','${D}','${D}','development','synthetic-push-token-B',1,'${E}',true,now());
  insert into public.wd_push_receipts values('${A}','${K}','${H}','{}',now());
  insert into public.wd_push_jobs(id,user_id,device_id,project_id,environment,body)values('${K}','${A}','${D}','${D}','development','synthetic');
  insert into public.wd_catalog_pins values('fixture',5,'${H}','fixture','["main"]');`);
 await login();
 await db.query("select public.wd_billing_command('bind',$1::jsonb)",[JSON.stringify({userId:A})]);
 await db.query("select public.wd_billing_command('bind',$1::jsonb)",[JSON.stringify({userId:B})]);
 for(const id of [A,B]){await login("authenticated",id);await account("save_week",{id:D,revision:0,week:{snapshotVersion:5,snapshotSha256:H,solverRevision:"fixture",catalogRevision:"fixture",recipeIds:Array(15).fill("main"),seed:7}},D);}
 await login("authenticated",A);await account("begin_deletion",{confirmation:"DELETE MY ACCOUNT"},A);
 await login();
 const raw:DeletionRepository["command"]=async(action,body)=>{
  const r=(await db.query<{r:Awaited<ReturnType<DeletionRepository["command"]>>&{error?:string}}>("select public.wd_deletion_command($1,$2::jsonb)r",[action,JSON.stringify(body)])).rows[0].r;
  if(r.error)throw new DeletionProgressError(r.error);return r;
 };
 let failed=false;
 const trip=(action:string,after:boolean,dependency?:string)=>{if(!failed&&fault?.action===action&&Boolean(fault.after)===after&&(!fault.dependency||fault.dependency===dependency)){failed=true;throw Error("synthetic_boundary_failure");}};
 const repo:DeletionRepository={async command(action,body){trip(action,false,body.dependency as string);const r=await raw(action,body);trip(action,true,body.dependency as string);return r;}};
 const calls={apple:0,auth:0,identity:0,reconcile:0},effects={apple:0,auth:0},proofs=new Map<string,DeletionProof>(),targets:DeletionTarget[]=[];
 let linkage=apple,material=true,outcomeUnknown=false;
 const adapter=(dep:"apple"|"auth")=>({
  async run(target:DeletionTarget){calls[dep]++;targets.push(structuredClone(target));trip(`${dep}_provider`,false);
   assert.equal(target.userId,A);assert.equal(target.identityHash,H);
   if(!material&&dep==="apple")return {...target,outcome:"not_started" as const,evidenceHash:E};
   effects[dep]++;if(dep==="auth")await admin("delete from auth.users where id=$1",[target.userId]);
   const proof={...target,outcome:"confirmed" as const,evidenceHash:E};proofs.set(target.operationId,proof);trip(`${dep}_provider`,true);
   return outcomeUnknown?{...target,outcome:"unknown" as const,evidenceHash:E}:proof;
  },
  async reconcile(target:DeletionTarget){calls.reconcile++;assert.equal(target.userId,A);assert.equal(target.identityHash,H);
   if(outcomeUnknown)return {...target,outcome:"unknown" as const,evidenceHash:E};
   if(proofs.has(target.operationId))return proofs.get(target.operationId)!;
   if(dep==="auth"&&(await admin("select id from auth.users where id=$1",[A])).length===0)return {...target,outcome:"already_absent" as const,evidenceHash:E};
   return {...target,outcome:"not_started" as const,evidenceHash:E};
  }
 });
 const providers:DeletionProviders={async verifyIdentity(id){calls.identity++;trip("identity_provider",false);assert.equal(id,A);const identity={userId:id,identityHash:H,evidenceHash:E,apple:linkage};trip("identity_provider",true);return identity;},apple:adapter("apple"),auth:adapter("auth")};
 const worker=()=>accountDeletionWorker(repo,{...providers}); // New worker instance on every restart; SQL/providers retain evidence.
 const expire=()=>admin("update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id=$1",[A]);
 return {db,login,account,admin,raw,repo,providers,worker,expire,calls,effects,targets,proofs,set linkage(v:"linked"|"none"|"unknown"){linkage=v;},set material(v:boolean){material=v;},set unknown(v:boolean){outcomeUnknown=v;}};
}

test("durable binding reuses confirmed Apple/Auth progress across restarts and final commit failure",async()=>{
 for(const fault of [{action:"auth_provider"},{action:"complete"},{action:"complete",after:true}] as Fault[]){const f=await fixture("linked",fault);try{
  const first=await f.worker()(A);assert.equal(first.state,"deletion_pending");
  const next=await f.worker()(A);assert.deepEqual(next,{state:"deleted",subscriptionCancelled:false});
  assert.equal(f.effects.apple,1);assert.equal(f.effects.auth,1);
  assert.equal((await f.admin("select * from auth.users where id=$1",[A])).length,0);
  assert.equal((await f.admin("select state from public.wd_accounts where user_id=$1",[A]))[0].state,"deleted");
  assert.deepEqual(await f.worker()(A),next);assert.equal(f.effects.apple,1);assert.equal(f.effects.auth,1);
 }finally{await f.db.close();}}
});

test("before/after durable and fake provider boundaries preserve stable identity and safe recovery",async()=>{
 const faults:Fault[]=[{action:"claim"},{action:"claim",after:true},{action:"identity_provider"},{action:"identity_provider",after:true},{action:"identity"},{action:"identity",after:true},{action:"cleanup"},{action:"cleanup",after:true}];
 for(const dependency of ["apple","auth"])for(const action of ["begin","proof"])for(const after of [false,true])faults.push({action,dependency,after});
 for(const dep of ["apple","auth"])for(const after of [false,true])faults.push({action:`${dep}_provider`,after});
 for(const fault of faults){const f=await fixture("linked",fault);try{
  assert.equal((await f.worker()(A)).state,"deletion_pending",JSON.stringify(fault));await f.expire();
  assert.equal((await f.worker()(A)).state,"deleted",JSON.stringify(fault));
  assert.equal(f.effects.apple,1);assert.equal(f.effects.auth,1);
  const row=(await f.admin("select * from public.wd_deletion_work where user_id=$1",[A]))[0];
  assert.equal(row.identity_hash,H);assert.equal(row.complete,true);assert.equal(row.apple_state,"done");assert.equal(row.auth_state,"done");
  assert(f.targets.every(t=>t.userId===A&&t.identityHash===H&&t.operationId===(f.proofs.get(t.operationId)?.operationId)),"all effects bind stable SQL identities");
 }finally{await f.db.close();}}
});

test("unknown outcomes without reconciliation remain pending, never blanket retried",async()=>{
 for(const dep of ["apple","auth"] as const){const f=await fixture("linked",{action:`${dep}_provider`,after:true});try{
  delete f.providers[dep].reconcile;
  const first=await f.worker()(A);assert.equal(first.state,"deletion_pending");
  await f.expire();for(let n=0;n<3;n++)assert.equal((await f.worker()(A)).state,"deletion_pending");
  assert.equal(f.calls[dep],1);assert.equal(f.effects[dep],1);
  assert.equal((await f.admin("select state from public.wd_accounts where user_id=$1",[A]))[0].state,"deletion_pending");
  if(dep==="apple")assert.equal(f.calls.auth,0);
 }finally{await f.db.close();}}
 const f=await fixture();try{f.unknown=true;await f.worker()(A);await f.worker()(A);assert.equal(f.calls.apple,1);assert.equal(f.calls.auth,0);assert.equal((await f.admin("select apple_state from public.wd_deletion_work"))[0].apple_state,"held");}finally{await f.db.close();}
});

test("release acknowledgement loss retains recoverable identity work without destructive effects",async()=>{
 for(const after of [false,true]){const f=await fixture("unknown",{action:"release",after});try{
  assert.equal((await f.worker()(A)).dependency,"provider_identity");assert.equal(f.effects.apple,0);assert.equal(f.effects.auth,0);
  await f.expire();f.linkage="linked";assert.equal((await f.worker()(A)).state,"deleted");assert.equal(f.effects.apple,1);assert.equal(f.effects.auth,1);
 }finally{await f.db.close();}}
});

test("cleanup verification fails closed before providers, without duplicating the existing trigger",async()=>{
 const f=await fixture();try{
  await f.admin(`insert into public.wd_push_tokens values('${A}','${D}','${D}','development','synthetic-late-token',1,'${H}',true,now())`);
  assert.equal((await f.worker()(A)).dependency,"push_cleanup");assert.equal(f.calls.apple,0);assert.equal(f.calls.auth,0);
  await f.admin("delete from public.wd_push_tokens where user_id=$1",[A]);assert.equal((await f.worker()(A)).state,"deleted");assert.equal(f.effects.apple,1);
 }finally{await f.db.close();}
});

test("non-Apple, unknown linkage, missing material and already-absent Auth are distinct",async()=>{
 const none=await fixture("none");try{assert.equal((await none.worker()(A)).state,"deleted");assert.equal(none.calls.apple,0);assert.equal(none.calls.auth,1);}finally{await none.db.close();}
 const unknown=await fixture("unknown");try{
  await unknown.admin("delete from auth.users where id=$1",[A]);
  assert.equal((await unknown.worker()(A)).dependency,"provider_identity");assert.equal(unknown.calls.apple,0);assert.equal(unknown.calls.auth,0);
  unknown.linkage="linked";assert.equal((await unknown.worker()(A)).state,"deleted");assert.equal(unknown.effects.apple,1);
 }finally{await unknown.db.close();}
 const missing=await fixture();try{missing.material=false;assert.equal((await missing.worker()(A)).state,"deletion_pending");assert.equal(missing.effects.apple,0);assert.equal(missing.calls.auth,0);missing.material=true;assert.equal((await missing.worker()(A)).state,"deleted");assert.equal(missing.effects.apple,1);}finally{await missing.db.close();}
 const absent=await fixture("none",{action:"begin",after:true,dependency:"auth"});try{
  await absent.admin("delete from auth.users where id=$1",[A]);await absent.worker()(A);await absent.expire();
  assert.equal((await absent.worker()(A)).state,"deleted");assert.equal(absent.calls.auth,0,"verified already-absent reconciliation avoids another destructive call");
 }finally{await absent.db.close();}
});

test("provider identity/proof mismatch and a mid-operation expired lease cannot falsely complete",async()=>{
 const wrong=await fixture();try{
  wrong.providers.verifyIdentity=async()=>({userId:B,identityHash:H,evidenceHash:E,apple:"none"});
  assert.equal((await wrong.worker()(A)).state,"deletion_pending");assert.equal(wrong.calls.auth,0);assert.equal(wrong.calls.apple,0);
 }finally{await wrong.db.close();}
 const mismatch=await fixture();try{
  mismatch.providers.apple.run=async target=>({...target,identityHash:E,evidenceHash:E,outcome:"confirmed"});
  assert.equal((await mismatch.worker()(A)).state,"deletion_pending");assert.equal(mismatch.calls.auth,0);
  assert.equal((await mismatch.admin("select apple_state from public.wd_deletion_work"))[0].apple_state,"held");
 }finally{await mismatch.db.close();}
 const expired=await fixture();try{
  const run=expired.providers.apple.run;
  expired.providers.apple.run=async target=>{const proof=await run(target);await expired.expire();return proof;};
  assert.equal((await expired.worker()(A)).state,"deletion_pending");assert.equal(expired.effects.apple,1);assert.equal(expired.calls.auth,0);
  assert.equal((await expired.worker()(A)).state,"deleted");assert.equal(expired.effects.apple,1);assert.equal(expired.effects.auth,1);
 }finally{await expired.db.close();}
});

test("enabled factory binds only fake adapters/actual SQL and preserves frozen target progress",async()=>{
 const f=await fixture("none");
 const values={WD_ACCOUNT_DELETION_WORKER_ENABLED:"true",WD_ACCOUNT_DELETION_ADAPTERS_VERIFIED:"true",SUPABASE_URL:"https://fixture.invalid",SUPABASE_SERVICE_ROLE_KEY:"synthetic"};
 const old=Object.fromEntries(Object.keys(values).map(k=>[k,process.env[k]]));let constructed=0;
 try{
  Object.assign(process.env,values);
  const request:typeof fetch=async(_url,init)=>{const command=JSON.parse(init!.body as string);assert.equal(init!.cache,"no-store");assert.equal(init!.redirect,"error");return Response.json(await f.raw(command.p_action,command.p_body));};
  const worker=configuredAccountDeletionWorker(()=>{constructed++;return f.providers;},request)!;
  assert.equal(constructed,1);assert.equal(f.calls.auth,0);
  assert.deepEqual(await worker(A),{state:"deleted",subscriptionCancelled:false});assert.equal(f.effects.auth,1);assert.equal(f.effects.apple,0);
  assert.throws(()=>configuredAccountDeletionWorker(()=>{throw Error("private provider material");},request),/^Error: deletion_adapters_unavailable$/);
  assert.throws(()=>deletionRepository("private malformed url","synthetic"),/^Error: deletion_not_configured$/);
 }finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}await f.db.close();}
});

test("SQL private claims/grants/leases/proofs deny clients, active/other targets and stale owners",async()=>{
 const f=await fixture();try{
  for(const [role,id] of [["anon",undefined],["authenticated",A],["authenticated",B]] as const){await f.login(role,id);await assert.rejects(f.raw("claim",{userId:A,owner:OWNER}),/permission denied/);await assert.rejects(f.db.query("select * from public.wd_deletion_work"),/permission denied/);await assert.rejects(f.db.query("insert into public.wd_deletion_work(user_id)values($1)",[A]),/permission denied/);}
  assert.equal((await f.db.query("select * from public.unrelated_sentinel")).rows.length,1);
  await f.login();await assert.rejects(f.db.query("update public.wd_deletion_work set complete=true"),/permission denied/);
  await assert.rejects(f.raw("claim",{userId:B,owner:OWNER}),/account_inactive/);
  const a=await f.raw("claim",{userId:A,owner:OWNER});const context={userId:A,owner:OWNER,attempt:a.work.attempt};
  await assert.rejects(f.raw("claim",{userId:A,owner:OTHER}),/claim_busy/);
  await assert.rejects(f.raw("identity",{...context,owner:OTHER,identityHash:H,evidenceHash:E,apple:"none"}),/stale_claim/);
  await assert.rejects(f.raw("cleanup",{...context,userId:B}),/account_inactive/);
  await assert.rejects(f.raw("complete",context),/invalid_progress/);
  await assert.rejects(f.raw("identity",{...context,identityHash:H,evidenceHash:E,apple:false}),/invalid_command/);
  await f.raw("identity",{...context,identityHash:H,evidenceHash:E,apple:"linked"});
  await assert.rejects(f.raw("identity",{...context,identityHash:E,evidenceHash:E,apple:"none"}),/identity_conflict/);
  await assert.rejects(f.raw("begin",{...context,dependency:"auth"}),/invalid_progress/);
  await f.raw("begin",{...context,dependency:"apple"});await f.expire();
  await assert.rejects(f.raw("proof",{...context,dependency:"apple",operationId:a.work.apple_operation,identityHash:H,evidenceHash:E,outcome:"confirmed"}),/stale_claim/);
  const b=await f.raw("claim",{userId:A,owner:OTHER});assert.equal(b.work.apple_state,"held");assert.equal(b.work.attempt,a.work.attempt+1);
  await assert.rejects(f.raw("release",context),/stale_claim/);
  await assert.rejects(f.raw("proof",{userId:A,owner:OTHER,attempt:b.work.attempt,dependency:"apple",operationId:b.work.apple_operation,identityHash:E,evidenceHash:E,outcome:"confirmed"}),/invalid_progress/);
  await assert.rejects(f.raw("begin",{userId:A,owner:OTHER,attempt:b.work.attempt,dependency:"apple"}),/invalid_progress/);
 }finally{await f.db.close();}
});

test("SQL bounds malformed commands and does not complete on missing trusted identity/proof",async()=>{
 const f=await fixture();try{
  for(const body of [{},null,[],{userId:A,owner:""},{userId:A,owner:OWNER,limit:100},{userId:A,owner:OWNER,padding:"x".repeat(5000)}])await assert.rejects(f.raw("claim",body as Record<string,unknown>),/invalid_command/);
  await assert.rejects(f.raw("unknown",{userId:A,owner:OWNER}),/invalid_command/);
  assert.equal((await f.admin("select * from public.wd_deletion_work")).length,0);
  f.providers.verifyIdentity=async()=>null;assert.equal((await f.worker()(A)).dependency,"provider_identity");assert.equal(f.calls.auth,0);assert.equal(f.calls.apple,0);
 }finally{await f.db.close();}
});

test("existing SQL/HTTP inactive guards prevent resurrection, retain B and old-session denial",async()=>{
 const f=await fixture();try{
  assert.equal((await f.worker()(A)).state,"deleted");
  for(const table of ["wd_saved_weeks","wd_push_tokens","wd_push_receipts","wd_push_jobs"])assert.equal((await f.admin(`select * from public.${table} where user_id=$1`,[A])).length,0);
  const tomb=(await f.admin("select * from public.wd_accounts where user_id=$1",[A]))[0];assert.deepEqual(tomb.preferences,{});assert.equal(tomb.state,"deleted");
  assert.equal((await f.admin("select * from public.wd_account_receipts where user_id=$1 and id<>$2",[A,A])).length,0,"only explicit deletion intent receipt remains");
  assert.equal((await f.admin("select * from public.wd_saved_weeks where user_id=$1",[B])).length,1);assert.equal((await f.admin("select * from public.wd_push_tokens where user_id=$1",[B])).length,1);assert.equal((await f.admin("select * from auth.users where id=$1",[B])).length,1);
  for(const action of ["bind","begin","commit"]){const r=(await f.db.query<{r:{error:string}}>("select public.wd_billing_command($1,$2::jsonb)r",[action,JSON.stringify({userId:A,environment:"PRODUCTION",generation:1,state:{state:"active",expiresAt:Date.now()+86400000,observedAt:Date.now(),reason:"fixture",transactionHash:H}})])).rows[0].r;assert.equal(r.error,"account_inactive");}
  const binding=(await f.admin("select app_user_id from public.wd_billing_bindings where user_id=$1",[A]))[0].app_user_id;
  const event={id:"synthetic-after-deletion",type:"RENEWAL",environment:"PRODUCTION",timestamp:Date.now(),appUserIds:[binding],identityHold:false,fingerprint:H};
  await f.db.query("select public.wd_billing_command('enqueue',$1::jsonb)",[JSON.stringify(event)]);
  const claimed=(await f.db.query<{r:{events:Array<{accountIds:string[]}>}}>("select public.wd_billing_command('claim_events','{\"environment\":\"PRODUCTION\",\"limit\":1}')r")).rows[0].r.events;
  assert.deepEqual(claimed[0].accountIds,[A]);
  const refresh=(await f.db.query<{r:{error:string}}>("select public.wd_billing_command('begin',$1::jsonb)r",[JSON.stringify({userId:claimed[0].accountIds[0],environment:"PRODUCTION"})])).rows[0].r;assert.equal(refresh.error,"account_inactive");
  const enqueue=(await f.db.query<{r:{error:string}}>("select public.wd_push_delivery('enqueue',$1::jsonb)r",[JSON.stringify({id:K,userId:A,deviceId:D,projectId:D,environment:"development",body:"synthetic"})])).rows[0].r;assert.equal(enqueue.error,"notification_inactive");
  await f.login("authenticated",A);assert.equal((await f.account("initialize",{},B)).error,"account_inactive");assert.equal((await f.account("save_week",{},B)).error,"account_inactive");assert.equal((await f.account("update",{},B)).error,"account_inactive");
  const push=(await f.db.query<{r:{error:string}}>("select public.wd_push_command('register','{}',$1)r",[K])).rows[0].r;assert.equal(push.error,"account_inactive");
  const status=await f.account("deletion_status",{},null);assert.equal(status.state,"deleted");assert(!JSON.stringify(status).includes(H));assert(!JSON.stringify(status).includes("operation"));
  const handle=accountHandler({verify:async()=>({id:A,token:"synthetic-old-verified-session",authenticatedAt:Math.floor(Date.now()/1000),providers:[]}),repository:{async execute(_account,command){const r=await f.account(command.action,command.body,command.key);if(r.error)throw new AccountError(410,"account_inactive");return r;}}});
  const response=await handle(new Request("https://fixture.invalid/api/v1/account",{method:"POST",headers:{"content-type":"application/json","idempotency-key":B},body:"{}"}));assert.equal(response.status,410);assert.equal(response.headers.get("cache-control"),"no-store");
 }finally{await f.db.close();}
});

test("factory stays default-off, fails before provider construction and redacts network errors",async()=>{
 const keys=["WD_ACCOUNT_DELETION_WORKER_ENABLED","WD_ACCOUNT_DELETION_ADAPTERS_VERIFIED","SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY"];
 const old=Object.fromEntries(keys.map(k=>[k,process.env[k]]));let network=0,constructed=0;
 const request:typeof fetch=async()=>{network++;return new Response("private provider token/identity",{status:403});};
 const factory=()=>{constructed++;throw Error("must_not_construct");};
 try{
  delete process.env.WD_ACCOUNT_DELETION_WORKER_ENABLED;assert.equal(configuredAccountDeletionWorker(factory,request),undefined);
  process.env.WD_ACCOUNT_DELETION_WORKER_ENABLED="true";delete process.env.WD_ACCOUNT_DELETION_ADAPTERS_VERIFIED;assert.throws(()=>configuredAccountDeletionWorker(factory,request),/deletion_not_configured/);
  process.env.WD_ACCOUNT_DELETION_ADAPTERS_VERIFIED="true";process.env.SUPABASE_URL="https://fixture.invalid/?private=token";process.env.SUPABASE_SERVICE_ROLE_KEY="synthetic";assert.throws(()=>configuredAccountDeletionWorker(factory,request),/deletion_not_configured/);
  process.env.SUPABASE_URL="https://fixture.invalid";process.env.SUPABASE_SERVICE_ROLE_KEY="";assert.throws(()=>configuredAccountDeletionWorker(factory,request),/deletion_not_configured/);
  assert.equal(constructed,0);assert.equal(network,0);
  const repo=deletionRepository("https://fixture.invalid","synthetic",request);await assert.rejects(repo.command("claim",{userId:A,owner:OWNER}),/^Error: deletion_unavailable$/);assert.equal(network,1);
 }finally{for(const [key,value]of Object.entries(old)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});
