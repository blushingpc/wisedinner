import test from 'node:test';
import assert from 'node:assert/strict';
import {AccountError,accountHandler,supabaseVerifier} from './account.ts';
import {PINS,FORMAT,MAX_BYTES,canonical,ownCopy} from './owner-plan-codec.ts';
import {decodeCommand,receiptShape,admitState,memoryRepository,proposalHandler,ProposalClient,parserFixture} from './owner-plan.fixture.ts';
import {A,B,key,owner,complete,empty,draft,command,setup,claims,rpc,eligible} from './owner-plan.fixture.ts';

async function waitForEntry(started:Promise<void>,pending:Promise<unknown>,timeoutMs=10000){
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  await Promise.race([started,pending.then(()=>{throw Error('operation settled before transport entry');}),new Promise<never>((_resolve,reject)=>{timer=setTimeout(()=>reject(Error('transport entry deadline')),timeoutMs);})]);
 }finally{clearTimeout(timer);}
}

test('deferred synchronization is finite and preserves actual early operation errors',async t=>{
 await t.test('early rejection propagates the original error',async()=>{
  const error=Error('synthetic pre-transport failure');
  await assert.rejects(waitForEntry(new Promise(()=>{}),Promise.reject(error)),e=>e===error);
 });
 await t.test('normal entry does not wait for the deferred operation',async()=>{
  await waitForEntry(Promise.resolve(),new Promise(()=>{}));
 });
 await t.test('missing entry times out and early success is refused',async()=>{
  await assert.rejects(waitForEntry(new Promise(()=>{}),new Promise(()=>{}),20),/transport entry deadline/);
  await assert.rejects(waitForEntry(new Promise(()=>{}),Promise.resolve()),/operation settled before transport entry/);
 });
});

test('descriptor-safe codec and actual current owner-local admission',async t=>{
 const value=complete(),before=canonical(value);
 await t.test('complete, empty and draft canonical state consumed by real SessionBoundary/OwnerLocalPlannerState',async()=>{
  for(const state of [value,empty(),draft()])assert.equal(canonical(await admitState(state,A)),canonical(state));
  assert.equal(value.answers!.budget,64.01);assert.equal(value.answers!.pantry[0]!.qty,0.5);assert(value.week!.result.list.length>0);
  assert.equal(canonical(value),before);
 });
 await t.test('accessor, hidden, cycle, prototype, sparse, duplicate, unsafe and unknown payloads never execute getters',async()=>{
  let getters=0;const accessor=Object.defineProperty({},'state',{enumerable:true,get(){getters++;throw Error('private');}});
  const cycle:Record<string,unknown>={};cycle.self=cycle;
  const badState=[{...empty(),tier:'protein'},{...empty(),checks:{unknown:true}},{...empty(),draft:{stores:['unknown']}},{...empty(),draft:{budget:64.011}},{...empty(),draft:{pantry:[{id:'eggs',qty:1},{id:'eggs',qty:2}]}},{...empty(),draft:{pantry:[{id:'unknown',qty:1}]}},{...empty(),draft:{protein:NaN}},{...empty(),draft:{pantry:new Array(1)}}];
  for(const bad of [accessor,cycle,Object.create(empty()),Object.defineProperty({},'hidden',{value:true}),{a:Symbol('x')},{a:Infinity},{a:undefined},{a:Array(257).fill(0)},{a:'x'.repeat(4097)}])assert.throws(()=>ownCopy(bad));
  for(const bad of badState)await assert.rejects(admitState(bad,A));assert.equal(getters,0);
  const array:unknown[]=[];Object.setPrototypeOf(array,{});assert.throws(()=>ownCopy(array));
 });
 await t.test('version/source/catalog/solver/nutrient/state/credentials/owner injection and tampered nutrients refuse',async()=>{
  for(const change of ['source','catalog','solver','nutrients'])await assert.rejects(decodeCommand({...command(value),pins:{...PINS,[change]:'0'.repeat(64)}},A));
  for(const c of [{...command(value),format:'backend-v6'}, {...command(value),owner:B},{...command(value),access_token:'synthetic'}, {...command(value),expectedRevision:-1},{...command(value),pins:{...PINS,weekVersion:1}}])await assert.rejects(decodeCommand(c,A));
  const nutrients=structuredClone(value);nutrients.week!.result.days[0]!.protein_g++;await assert.rejects(admitState(nutrients,A));
  const result=structuredClone(value);result.week!.result.est_total+=0.01;await assert.rejects(admitState(result,A));
  const rows=structuredClone(value);rows.week!.result.list.push(rows.week!.result.list[0]!);await assert.rejects(admitState(rows,A));
  assert.equal(canonical(value),before);
 });
 await t.test('byte boundary and cloned output',async()=>{
  const big=Object.fromEntries(Array.from({length:40},(_,i)=>['k'+i,'x'.repeat(4000)]));assert(Buffer.byteLength(JSON.stringify(big))>MAX_BYTES);assert.throws(()=>ownCopy(big));
  const copy=await admitState(value,A);copy.checks={};assert.equal(canonical(value),before);
  assert.throws(()=>receiptShape({format:FORMAT,pins:PINS,serverRevision:0,state:empty()}));
 });
});

test('memory-only SQL, route and actual app restored state. Claims and provider records are emulated; one serialized connection',async t=>{
 const db=await setup();
 try{
  const repository=memoryRepository(db);let verifiedCalls=0;
  // Actual Auth verifier logic with synthetic Auth response/JWT. No signature or network proof.
  const now=Math.floor(Date.now()/1000);
  const token=(id:string)=>[Buffer.from('{}').toString('base64url'),Buffer.from(JSON.stringify({sub:id,iss:'https://auth.invalid/auth/v1',aud:'authenticated',role:'authenticated',exp:now+3600,amr:[{method:'otp',timestamp:now}]})).toString('base64url'),'c2ln'].join('.');
  const verify=supabaseVerifier('https://auth.invalid','synthetic-public-key',async(_url,init)=>{
   verifiedCalls++;const bearer=new Headers(init!.headers).get('authorization')!.slice(7),id=JSON.parse(Buffer.from(bearer.split('.')[1]!,'base64url').toString()).sub;
   return Response.json({id,is_anonymous:false,identities:[{provider:'email'}]});
  });
  const route=proposalHandler({verify,repository});
  const request=(method:string,id=A,body:unknown=null,k:string|null=null)=>new Request('https://fixture.invalid/proposal/owner-plan-v2',{method,headers:{Authorization:'Bearer '+token(id),...(body?{'Content-Type':'application/json'}:{}),...(k?{'Idempotency-Key':k}:{})},...(body?{body:JSON.stringify(body)}:{})});
  const reset=()=>db.exec('reset role');
  const row=async(id=A)=>{await reset();return (await db.query('select revision,snapshot from public.wd_proposal_plan_documents where user_id=$1',[id])).rows;};
  await t.test('complete cloud route/SQL/JSON round-trip then actual local restore, exact cents/portion/pantry/check equality',async()=>{
   await reset();const c=command(),r=await route(request('PUT',A,c,key()));assert.equal(r.status,200);assert.equal(r.headers.get('cache-control'),'no-store');
   const ack=receiptShape(await r.json());assert.equal(ack.serverRevision,1);assert.equal(canonical(ack.state),canonical(c.state));
   const get=await route(request('GET'));assert.equal(get.status,200);assert.equal(canonical(await get.json()),canonical(ack));
   const f=await parserFixture(A);try{assert.deepEqual(await f.planner.save(f.planner.begin(),ack.state),c.state);assert.deepEqual(await f.planner.hydrate(f.planner.begin()),c.state);}finally{f.dispose();}
   assert.equal(ack.state!.answers!.budget,64.01);assert.equal(ack.state!.answers!.pantry[0]!.qty,0.5);assert.deepEqual(ack.state!.week!.result,c.state.week!.result);
   assert(verifiedCalls>=2);assert.equal((await row()).length,1);
  });
  await t.test('empty and partial draft survive full snapshot, distinct cloud CAS from local tickets',async()=>{
   for(const state of [empty(),draft()]){await reset();const old=await repository.read(owner());const ack=await repository.save(owner(),key(),command(state,old.serverRevision));assert.equal(canonical(ack.state),canonical(state));assert.equal(ack.serverRevision,old.serverRevision+1);}
  });
  await t.test('idempotency original durable receipt, same-key changed-body conflict, stale CAS and reordered object keys',async()=>{
   await reset();const old=await repository.read(owner()),k=key(),c=command(complete(),old.serverRevision),ack=await repository.save(owner(),k,c);
   assert.deepEqual(await repository.save(owner(),k,JSON.parse(canonical(c))),ack);
   await assert.rejects(repository.save(owner(),k,command(empty(),old.serverRevision)),/idempotency_conflict/);
   const newer=await repository.save(owner(),key(),command(draft(),ack.serverRevision));
   assert.deepEqual(await repository.save(owner(),k,c),ack,'retry returns original receipt, not current document');
   await assert.rejects(repository.save(owner(),key(),c),/revision_conflict/);assert.equal((await repository.read(owner())).serverRevision,newer.serverRevision);
  });
  await t.test('anon denied; A/B direct table, receipt/replay and owner-injection bypass denied',async()=>{
   await claims(db,'anon',null);await assert.rejects(rpc(db,'read'),/permission denied/);await assert.rejects(db.query('select * from public.wd_proposal_plan_documents'),/permission denied/);
   await claims(db,'authenticated',B);assert.deepEqual(await rpc(db,'read'),{format:FORMAT,pins:PINS,serverRevision:0,state:null});assert.equal((await db.query('select * from public.wd_proposal_plan_documents')).rows.length,0);
   for(const sql of ['update public.wd_proposal_plan_documents set revision=99',"insert into public.wd_proposal_plan_replay values('"+B+"','"+key()+"','{}',txid_current())",'select * from public.wd_proposal_plan_receipts','select * from public.wd_proposal_plan_replay'])await assert.rejects(db.exec(sql),/permission denied/);
   assert.equal((await rpc(db,'save',{...command(),owner:A},key())).error,'invalid_command');
   assert.equal((await rpc(db,'save',command(),key())).error,'replay_required');
  });
  await t.test('direct malformed/source/version/catalog/state/nutrient/oversize RPC never changes old row; exact replay binding required',async()=>{
   const before=await row();await claims(db,'authenticated',A);const old=await rpc(db,'read');
   const valid=command(complete(),old.serverRevision as number);
   const tamper=structuredClone(valid);tamper.state.week!.result.days[0]!.protein_g++;
   const invalids=[null,{}, {...valid,format:'v1'},{...valid,pins:{...PINS,source:'0'.repeat(64)}},{...valid,pins:{...PINS,catalog:'0'.repeat(64)}},{...valid,state:{...empty(),role:'admin'}},{...valid,expectedRevision:'1'},{...valid,state:{...empty(),draft:{stores:['unknown']}}},{...valid,state:{...empty(),draft:{pantry:[{id:'eggs',qty:1},{id:'eggs',qty:2}]}}},{...valid,state:{...empty(),checks:{unknown:1}}},{...valid,unused:'x'.repeat(131073)}];
   for(const bad of invalids)assert.equal((await rpc(db,'save',bad,key())).error,'invalid_command');
   assert.equal((await rpc(db,'save',tamper,key())).error,'replay_required','raw RPC cannot submit unchecked nutrient values');
   await reset();const k=key();await db.transaction(async tx=>{
    await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:A,role:'service_role',is_anonymous:false})]);await tx.exec('set local role service_role');await tx.query('insert into public.wd_proposal_plan_replay values($1,$2,$3::jsonb,txid_current())',[A,k,canonical(valid)]);
    await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:A,role:'authenticated',is_anonymous:false})]);await tx.exec('set local role authenticated');
    const r=(await tx.query<{r:{error:string}}>("select public.wd_proposal_plan_command('save',$1::jsonb,$2::uuid)r",[canonical(tamper),k])).rows[0]!.r;assert.equal(r.error,'replay_required');
    // Roll back test-only staging so no durable validation artifact remains.
    throw new AccountError(409,'fixture_rollback');
   }).catch(e=>{assert.match(String(e),/fixture_rollback/);});assert.deepEqual(await row(),before);
  });
  await t.test('repository and route independently reject tampered full state, failure after SQL write rolls all bytes/receipts back',async()=>{
   await reset();const old=await repository.read(owner()),bad=command(complete(),old.serverRevision);bad.state.week!.result.est_total++;
   const response=await route(request('PUT',A,bad,key()));assert.equal(response.status,400);const before=await row();
   const failed=memoryRepository(db,()=>{throw Error('synthetic post-write failure');});await assert.rejects(failed.save(owner(),key(),command(complete(),old.serverRevision)),/owner_plan_unavailable/);assert.deepEqual(await row(),before);
   assert.equal((await db.query('select * from public.wd_proposal_plan_replay')).rows.length,0);
  });
  await t.test('expired/unknown/revoked/held/wrong environment and transaction-owner mismatch deny even stable key retries; management remains reachable',async()=>{
   await reset();const old=await repository.read(owner()),k=key(),c=command(empty(),old.serverRevision),ack=await repository.save(owner(),k,c),before=await row();
   for(const state of ['expired','unknown','revoked']){await eligible(db,A,state);await claims(db,'authenticated',A);assert.equal((await rpc(db,'save',c,k)).error,'eligibility_required');assert.equal((await rpc(db,'read',{},null,'wd_account_command')).revision,1);}
   await eligible(db,A,'active','SANDBOX');await claims(db,'authenticated',A);assert.equal((await rpc(db,'save',c,k)).error,'eligibility_required');
   await eligible(db,A);await reset();await db.query('update public.wd_billing_bindings set held=true where user_id=$1',[A]);await claims(db,'authenticated',A);assert.equal((await rpc(db,'save',c,k)).error,'eligibility_required');
   await reset();await db.query('update public.wd_billing_bindings set held=false where user_id=$1',[A]);await db.query('update public.wd_billing_transactions set user_id=$1 where user_id=$2 and environment=$3',[B,A,'PRODUCTION']);await claims(db,'authenticated',A);assert.equal((await rpc(db,'save',c,k)).error,'eligibility_required');
   await reset();await db.query('update public.wd_billing_transactions set user_id=$1 where transaction_hash=$2 and environment=$3',[A,'a'.repeat(64),'PRODUCTION']);assert.deepEqual(await repository.save(owner(),k,c),ack);assert.deepEqual(await row(),before);
  });
  await t.test('serialized overlapping same-CAS commands commit one, preserve newer owner row, and do not claim multi-connection contention',async()=>{
   await reset();const old=await repository.read(owner());const results=await Promise.allSettled([repository.save(owner(),key(),command(empty(),old.serverRevision)),repository.save(owner(),key(),command(draft(),old.serverRevision))]);
   assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal((await repository.read(owner())).serverRevision,old.serverRevision+1);
   const other=await repository.save(owner(B),key(),command(draft(),0));assert.equal(other.serverRevision,1);assert.equal((await repository.read(owner())).serverRevision,old.serverRevision+1);
  });
  await t.test('client unknown outcome holds same command/key, retries original durable receipt with no new operation',async()=>{
   await reset();const f=await parserFixture(A);let failOnce=true;const calls:string[]=[];
   const client=new ProposalClient(f.session,async(method,_bearer,k,c)=>{await reset();if(method==='GET')return repository.read(owner());calls.push(k!);const r=await repository.save(owner(),k!,c!);if(failOnce){failOnce=false;throw Error('transport response lost');}return r;});
   try{await client.read();const k=key();await assert.rejects(client.save(k,complete()),/outcome_unknown_retry_same_key/);assert.equal(client.held()!.key,k);await assert.rejects(client.save(key(),empty()),/retry_same_key_required/);await assert.rejects(client.read(),/retry_same_key_required/);const ack=await client.retry();assert.equal(client.held(),null);assert.deepEqual(calls,[k,k]);assert.equal(canonical(ack!.state),canonical(complete()));}finally{f.dispose();}
  });
  await t.test('old-owner late acknowledgement and readiness revocation cannot install receipt or restore pending UI',{timeout:30000},async()=>{
   await reset();const f=await parserFixture(A);let release!:()=>void;const gate=new Promise<void>(r=>{release=r;});let entered!:()=>void;const started=new Promise<void>(r=>{entered=r;});
   const client=new ProposalClient(f.session,async(method,_token,k,c)=>{await reset();if(method==='GET')return repository.read(owner());const result=await repository.save(owner(),k!,c!);entered();await gate;return result;});
   let pending:Promise<unknown>|undefined,rejected:Promise<void>|undefined;
   try{await client.read();pending=client.save(key(),draft());rejected=assert.rejects(pending);void rejected.catch(()=>{});await waitForEntry(started,pending);await f.switchOwner(B);release();await rejected;assert.equal(client.view(),null);assert.equal(client.held(),null);
    await f.session.invalidate();await assert.rejects(client.save(key(),empty()));assert.equal(client.view(),null);
   }finally{release();await Promise.allSettled([pending,rejected]);f.dispose();}
  });
  await t.test('overlapping client preparations fence older edit before transport; latest committed owner data survives',async()=>{
   await reset();const f=await parserFixture(B);let writes=0;
   const client=new ProposalClient(f.session,async(method,_token,k,c)=>{await reset();if(method==='GET')return repository.read(owner(B));writes++;return repository.save(owner(B),k!,c!);});
   try{await client.read();const old=client.save(key(),complete()),refused=assert.rejects(old,/stale_response/);const fresh=client.save(key(),draft());await refused;assert.equal(canonical((await fresh)!.state),canonical(draft()));assert.equal(writes,1);}finally{f.dispose();}
  });
  await t.test('unchanged v1 metadata contract saves/reads independently and full state refuses zero writes',async()=>{
   await reset();let writes=0;const pin={version:5,sha256:'a'.repeat(64),solverRevision:'fixture',catalogRevision:'fixture',recipeIds:new Set(['main'])};await db.query("insert into public.wd_catalog_pins values('fixture',5,$1,'fixture','[\"main\"]')",[pin.sha256]);
   const v1=accountHandler({verify:async()=>owner(B),pin,repository:{async execute(_a,c){writes++;await claims(db,'authenticated',B);return rpc(db,c.action,c.body,c.key,'wd_account_command');}}});
   const week={snapshotVersion:5,snapshotSha256:pin.sha256,solverRevision:'fixture',catalogRevision:'fixture',recipeIds:Array(15).fill('main'),seed:7},id=key();
   const post=(v:unknown)=>new Request('https://fixture.invalid/api/v1/account/weeks',{method:'POST',headers:{'Content-Type':'application/json','Idempotency-Key':key()},body:JSON.stringify({id,revision:0,week:v})});
   assert.equal((await v1(post(complete()))).status,400);assert.equal(writes,0);const saved=await v1(post(week));assert.equal(saved.status,200);
   const list=await v1(new Request('https://fixture.invalid/api/v1/account/weeks'));const result=await list.json();assert.deepEqual(result.result.weeks[0].week,week);assert.equal('answers'in result.result.weeks[0].week,false);
   assert.equal((await repository.read(owner(B))).serverRevision,2);
  });
  await t.test('actual existing deletion transition cleans proposed documents/receipts/replay, old JWT cannot revive, tombstone and B survive',async()=>{
   await reset();const b=await repository.read(owner(B));await claims(db,'authenticated',A);const deleted=await rpc(db,'begin_deletion',{confirmation:'DELETE MY ACCOUNT'},key(),'wd_account_command');assert.equal(deleted.state,'deletion_pending');
   assert.equal((await rpc(db,'read')).error,'account_inactive');assert.equal((await rpc(db,'save',command(),key())).error,'account_inactive');assert.equal((await rpc(db,'initialize',{},key(),'wd_account_command')).error,'account_inactive');
   assert.equal((await db.query('select * from public.wd_proposal_plan_documents')).rows.length,0);await reset();
   for(const table of ['documents','receipts','replay'])assert.equal((await db.query(`select * from public.wd_proposal_plan_${table} where user_id=$1`,[A])).rows.length,0);
   assert.equal((await db.query<{state:string}>('select state from public.wd_accounts where user_id=$1',[A])).rows[0]!.state,'deletion_pending');assert.deepEqual(await repository.read(owner(B)),b);
   await reset();await db.query("update public.wd_accounts set state='deleted' where user_id=$1",[A]);await assert.rejects(repository.read(owner()),/account_inactive/);assert.equal((await db.query('select * from public.unrelated_sentinel')).rows.length,1);
  });
 }finally{await db.close();}
});
