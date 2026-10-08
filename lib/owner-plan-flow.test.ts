// LOCAL ONLY: actual installed modules; synthetic Auth/provider records and
// serialized memory SQL, never a genuine PostgreSQL/hosted/provider binding.
import test from 'node:test';
import assert from 'node:assert/strict';
import {supabaseVerifier,accountHandler,AccountError} from './account.ts';
import {composeOwnerPlanServer,type SqlTransaction} from './owner-plan-server.ts';
import {canonical,FORMAT,PINS} from './owner-plan-codec.ts';
import {setup,parserFixture,complete,empty,A,B,key} from './owner-plan.fixture.ts';
import {nativeOwnerFixture} from '../../wisedinner-app/tests/native-owner-account-fixture.ts';
import {admitOwnerPlan} from '../../wisedinner-app/src/account/owner-plan-admission.ts';
import {DurableOwnerPlanClient} from '../../wisedinner-app/src/account/owner-plan-durable.ts';
import {OwnerPlanJournal} from '../../wisedinner-app/src/account/owner-plan-journal.ts';
import {OwnerPlanTransport} from '../../wisedinner-app/src/account/owner-plan-transport.ts';
import {OwnerLocalPlannerState} from '../../wisedinner-app/src/account/planner-state.ts';
import {createOwnerPlannerScreen} from '../../wisedinner-app/src/features/owner-planner-screen.ts';
const utf8={byteLength:(s:string)=>new TextEncoder().encode(s).byteLength,decode:(b:Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(b)};
async function joined(){
 const db=await setup(),n=await nativeOwnerFixture(true,true),c=n.composition,r=c.root;
 const admit=async(value:unknown,id:string)=>{
  const parsed=admitOwnerPlan(value,utf8),f=await parserFixture(id);
  try{const actual=await f.planner.save(f.planner.begin(),parsed);assert.equal(canonical(actual),canonical(value));return actual;}finally{f.dispose();}
 };
 const verify=supabaseVerifier('https://auth.invalid','synthetic-public',n.fetcher);
 const server=composeOwnerPlanServer({verify,admit,transactions:{transaction:async body=>db.transaction(async tx=>body(tx as SqlTransaction))}});
 const management=accountHandler({verify,repository:{execute:async(a,cmd)=>db.transaction(async tx=>{
  await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:a.id,role:'authenticated',is_anonymous:false,amr:[{method:'otp',timestamp:a.authenticatedAt}]})]);
  await tx.exec('set local role authenticated');
  const value=(await tx.query<{result:Record<string,unknown>}>('select public.wd_account_command($1,$2::jsonb,$3::uuid) as result',[cmd.action,JSON.stringify(cmd.body),cmd.key])).rows[0]!.result;
  if(value.error)throw new AccountError(409,String(value.error));return value;
 })}});
 n.serverRoute(async(url,init)=>url.pathname==='/api/v1/account'&&init?.method==='DELETE'?management(new Request(url,init)):null);
 const sent:{body:string;key:string}[]=[],instances:DurableOwnerPlanClient[]=[];
 let lose=false;
 const fetcher:typeof fetch=async(url,options)=>{
  assert.equal(String(url),'https://api.invalid/proposal/owner-plan-v2');
  if(options?.method==='PUT'){
   const body=String(options.body),k=new Headers(options.headers).get('idempotency-key')!;
   const id=c.account.session.capture().owner,j=JSON.parse(n.privateData.memory.get(`wd.owner.plan.pending.v1.${id}`)!);
   assert.equal(j.pending.body,body);assert.equal(j.pending.key,k);assert.equal(j.pending.ack,null);sent.push({body,key:k});
  }
  const response=await server.handler(new Request(String(url),options));
  if(lose){lose=false;await response.body?.cancel();throw Error('synthetic lost post-commit acknowledgement');}
  return response;
 };
 const client=(planner=c.account.planner)=>{
  const deps={session:c.account.session,cache:c.account.cache,billing:c.account.billing!};
  const transport=new OwnerPlanTransport(deps,'https://api.invalid',fetcher,utf8,10000);
  const value=new DurableOwnerPlanClient(deps,planner,new OwnerPlanJournal(n.privateData.port,'https://api.invalid','production',utf8),transport,utf8);instances.push(value);return value;
 };
 r.mount();await n.verify();assert.equal(await r.connect(),true);
 return{db,n,c,r,server,management,sent,client,lose(){lose=true;},async close(){instances.forEach(i=>i.dispose());await c.dispose();await db.close();}};
}
test('installed SDK/account/root -> durable transport -> verified server -> isolated SQL -> whole local receipt', {timeout:120000},async t=>{
 const f=await joined();
 try{
  await t.test('full state, exact cents, consumed nutrient/list/checks and physical partial pantry survive both boundaries',async()=>{
   const state=complete(),ack=await f.client().save(key(),state);
   assert.equal(canonical(ack.state),canonical(state));assert.equal(ack.serverRevision,1);
   assert.equal(state.answers!.budget,64.01);assert.equal(state.answers!.pantry[0]!.qty,0.5);
   assert.equal(canonical(f.c.account.planner.view().saved),canonical(state));
   const raw=JSON.parse(f.n.privateData.memory.get(`wd.planner.local.v1.${A}`)!);
   assert.equal(raw.cloudCommit.serverRevision,1);assert.equal(raw.version,2);
   assert.equal(JSON.parse(f.n.privateData.memory.get(`wd.owner.plan.pending.v1.${A}`)!).pending,null);
   await f.db.exec('reset role');assert.equal((await f.db.query<{revision:number}>('select revision from public.wd_proposal_plan_documents where user_id=$1',[A])).rows[0]!.revision,1);
  });
  await t.test('lost actual SQL commit reply explicitly replays original durable key/body after client and planner restart',async()=>{
   const client=f.client();f.lose();await assert.rejects(client.save(key(),empty()),/unknown/);
   const first=f.sent.at(-1)!;client.dispose();
   const planner=new OwnerLocalPlannerState(f.c.account.session,f.n.privateData.port);planner.bind();await planner.hydrate(planner.begin());
   try{const restored=f.client(planner);assert.equal((await restored.held())!.key,first.key);const ack=await restored.recover();
    assert.deepEqual(f.sent.at(-1),first);assert.equal(ack.serverRevision,2);assert.equal(canonical(planner.view().saved),canonical(empty()));
   }finally{planner.dispose();}
  });
  await t.test('a genuine later cloud receipt cannot overwrite newer local user edits',async()=>{
   await f.c.account.planner.hydrate(f.c.account.planner.begin());const client=f.client();f.lose();await assert.rejects(client.save(key(),empty()));
   const newer={...empty(),draft:{budget:75}};await f.c.account.planner.save(f.c.account.planner.begin(),newer);
   const bytes=f.n.privateData.memory.get(`wd.planner.local.v1.${A}`);
   await assert.rejects(client.recover(),/planner_changed/);assert.equal(f.n.privateData.memory.get(`wd.planner.local.v1.${A}`),bytes);
   assert.ok(JSON.parse(f.n.privateData.memory.get(`wd.owner.plan.pending.v1.${A}`)!).pending.ack);
  });
  await t.test('owner switch preserves A held journal and B starts an independent empty cloud document',async()=>{
   const held=f.n.privateData.memory.get(`wd.owner.plan.pending.v1.${A}`);await f.r.logout();f.n.owner(B);await f.n.verify();assert.equal(await f.r.connect(),true);
   assert.equal(f.c.account.planner.view().saved,null);const ack=await f.client().save(key(),empty());assert.equal(ack.serverRevision,1);
   assert.equal(f.n.privateData.memory.get(`wd.owner.plan.pending.v1.${A}`),held);
   await f.db.exec('reset role');assert.equal((await f.db.query<{n:number}>('select count(*)::integer n from public.wd_proposal_plan_documents')).rows[0]!.n,2);
  });
  await t.test('wrong source and stale CAS refuse actual server writes and preserve local bytes',async()=>{
   const identity=f.c.account.session.capture(),bytes=f.n.privateData.memory.get(`wd.planner.local.v1.${B}`);
   const request=(body:unknown)=>new Request('https://api.invalid/proposal/owner-plan-v2',{method:'PUT',headers:{authorization:'Bearer '+f.c.account.session.bearer(identity),'content-type':'application/json','idempotency-key':key()},body:JSON.stringify(body)});
   const base={format:FORMAT,pins:PINS,expectedRevision:0,state:empty()};
   assert.equal((await f.server.handler(request({...base,pins:{...PINS,source:'0'.repeat(64)}}))).status,400);
   assert.equal((await f.server.handler(request(base))).status,409);
   assert.equal(f.n.privateData.memory.get(`wd.planner.local.v1.${B}`),bytes);
   await f.db.exec('reset role');assert.equal((await f.db.query<{revision:number}>('select revision from public.wd_proposal_plan_documents where user_id=$1',[B])).rows[0]!.revision,1);
  });
  await t.test('actual owner screen reroll refuses unchanged; account tombstone SQL retains other owner and sentinel',async()=>{
   const screen=createOwnerPlannerScreen(f.r.getSnapshot().adapter);screen.mount();const before=f.n.privateData.memory.get(`wd.planner.local.v1.${B}`);
   assert.equal(screen.replaceMeal(0,'dinner').status,'unavailable');assert.equal(f.n.privateData.memory.get(`wd.planner.local.v1.${B}`),before);screen.unmount();
   const ticket=f.r.prepareDeletion()!;assert.ok(ticket);const deletion=await f.r.requestDeletion(ticket);
   assert.equal(deletion.outcome,'accepted');assert.equal(deletion.observed?.state,'deletion_pending');assert.equal((deletion.observed as {subscriptionCancelled:boolean}).subscriptionCancelled,false);
   assert.throws(()=>f.c.account.session.capture());assert.equal(f.r.getSnapshot().status,'closed');await f.db.exec('reset role');
   assert.equal((await f.db.query<{n:number}>('select count(*)::integer n from public.wd_proposal_plan_documents where user_id=$1',[B])).rows[0]!.n,0);
   assert.equal((await f.db.query<{n:number}>('select count(*)::integer n from public.wd_proposal_plan_documents where user_id=$1',[A])).rows[0]!.n,1);
   assert.equal((await f.db.query<{id:number}>('select id from public.unrelated_sentinel')).rows[0]!.id,7);f.n.untouched();
  });
 }finally{await f.close();}
});
