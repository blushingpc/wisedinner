import test from'node:test';import assert from'node:assert/strict';import{EventEmitter}from'node:events';
import{Pool}from'pg';
import{ownerPlanPostgres,CONNECTION_PREFLIGHT,type OwnerPlanConnection,type PoolFactory}from'./owner-plan-postgres.ts';
import{ownerPlanRepository}from'./owner-plan-server.ts';import{setup,A,B,key,owner,command,empty,draft,admitState,memoryRepository,claims,rpc}from'./owner-plan.fixture.ts';
const config:OwnerPlanConnection={enabled:true,host:'fixture.invalid',port:5432,database:'fixture',user:'wd_owner_plan_login',password:'synthetic-only',mode:'transaction',max:1,connectionTimeoutMs:100,statementTimeoutMs:100,lockTimeoutMs:50,transactionTimeoutMs:500,disposeTimeoutMs:1000};
function dry(failAt='',permitted=true){
 const calls:{sql:string;args?:unknown[]}[]=[],releases:boolean[]=[],client=new EventEmitter(),pool=new EventEmitter();let ends=0,connects=0;
 Object.assign(client,{query:async(sql:string,args?:unknown[])=>{calls.push({sql,args});if(sql===failAt)throw Error('synthetic secret driver error');return{rows:sql===CONNECTION_PREFLIGHT?[{permitted}]:[{value:7}]};},release:(discard=false)=>{releases.push(discard);}});
 Object.assign(pool,{connect:async()=>{connects++;if(failAt==='acquire')throw Error('synthetic private URL');return client;},end:async()=>{ends++;if(failAt==='end')throw Error('synthetic');}});
 const adapter=ownerPlanPostgres(config,()=>pool as unknown as ReturnType<PoolFactory>);
 return{adapter,pool,client,calls,releases,get ends(){return ends;},get connects(){return connects;}};
}
test('actual installed pg exports exist; lazy explicit bounded TLS config; no import connection',async()=>{
 assert.equal(typeof Pool,'function');let made=0;const d=dry();const adapter=ownerPlanPostgres(config,c=>{made++;assert.equal((c.ssl as {rejectUnauthorized:boolean}).rejectUnauthorized,true);assert.equal(c.user,'wd_owner_plan_login');return d.pool as unknown as ReturnType<PoolFactory>;});assert.equal(made,0);await adapter.dispose();assert.equal(made,0);
 for(const change of[{enabled:false},{host:'https://unsafe.invalid'},{user:'postgres'},{max:20},{mode:'bad'},{statementTimeoutMs:0}])assert.throws(()=>ownerPlanPostgres({...config,...change} as OwnerPlanConnection),/postgres_/);
});
test('one client forwards parameters, drains unawaited queries, commits then releases once and fences handles',async()=>{
 const d=dry();let held!:Parameters<Parameters<typeof d.adapter.transaction>[0]>[0];
 await d.adapter.transaction(async tx=>{held=tx;const r=await tx.query('select $1',[7]);assert.deepEqual(r.rows,[{value:7}]);void tx.query('select $2',[8]);});
 assert.deepEqual(d.calls.map(c=>c.sql).slice(1),['BEGIN',"select set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$3,true)",'select $1','select $2','COMMIT']);assert.deepEqual(d.releases,[false]);assert.equal(d.connects,1);await assert.rejects(held.query('select 1'),/stale_query/);await d.adapter.dispose();assert.equal(d.ends,1);await assert.rejects(d.adapter.transaction(async()=>{}),/disposed/);
});
for(const mode of['acquire','BEGIN','select failure','COMMIT','ROLLBACK'])test('finite safe error '+mode,async()=>{
 const d=dry(mode);await assert.rejects(d.adapter.transaction(async tx=>{if(mode==='ROLLBACK')throw Error('synthetic callback private');await tx.query('select failure');}),e=>!String(e).includes('synthetic')&&/postgres_/.test(String(e)));assert.equal(d.connects,1);if(mode!=='acquire')assert.equal(d.releases.length,1);if(mode==='COMMIT'||mode==='ROLLBACK')assert.equal(d.releases[0],true);await d.adapter.dispose();
});
test('callback rollback, nested transaction refusal and caught query failure cannot commit',async()=>{
 const d=dry();await assert.rejects(d.adapter.transaction(async()=>d.adapter.transaction(async()=>{})),/nested/);assert.equal(d.calls.at(-1)!.sql,'ROLLBACK');
 const q=dry('select failure');await assert.rejects(q.adapter.transaction(async tx=>{await tx.query('select failure').catch(()=>{});}),/transaction_failed/);assert.equal(q.calls.at(-1)!.sql,'ROLLBACK');await d.adapter.dispose();await q.adapter.dispose();
});
test('transaction control, multi-statements, comment escapes and prepared names cannot bypass the owned boundary',async()=>{
 for(const sql of ['COMMIT','select 1; COMMIT','/* x */ BEGIN','set local role service_role','PREPARE named AS SELECT 1']){
  const d=dry();await assert.rejects(d.adapter.transaction(async tx=>{await assert.rejects(tx.query(sql),/invalid_query/);}),/transaction_failed/);assert.equal(d.calls.at(-1)!.sql,'ROLLBACK');assert.equal(d.calls.some(c=>c.sql===sql),false);await d.adapter.dispose();
 }
});
test('privilege and idle errors hold; no body or automatic reconnect/retry',async()=>{
 const d=dry('',false);let bodies=0;await assert.rejects(d.adapter.transaction(async()=>{bodies++;}),/privilege_refused/);assert.equal(bodies,0);await d.adapter.dispose();
 const i=dry();await i.adapter.transaction(async()=>{});i.pool.emit('error',Error('synthetic idle secret'));await assert.rejects(i.adapter.transaction(async()=>{bodies++;}),/idle_error/);assert.equal(i.connects,1);await i.adapter.dispose();
});
test('callback deadline and delayed outstanding query never commit/release before settlement',async()=>{
 const d=dry();let settle!:(v:{rows:Record<string,unknown>[]})=>void,entered!:()=>void;const entry=new Promise<void>(r=>{entered=r;});const original=(d.client as unknown as {query:(s:string,args?:unknown[])=>Promise<unknown>}).query;
 Object.assign(d.client,{query:async(sql:string,args?:unknown[])=>{if(sql==='select delayed'){entered();return new Promise(r=>{settle=r;});}return original(sql,args);}});
 const pending=d.adapter.transaction(async tx=>{void tx.query('select delayed');return new Promise(()=>{});});void pending.catch(()=>{});await entry;await new Promise(r=>setTimeout(r,550));assert.deepEqual(d.releases,[]);settle({rows:[]});await assert.rejects(pending,/transaction_timeout/);assert.equal(d.calls.at(-1)!.sql,'ROLLBACK');assert.deepEqual(d.releases,[true]);await d.adapter.dispose();
});
test('narrow staging policy composes actual repository/admission/SQL; forged owner/transaction and Auth replay denied',async()=>{
 const db=await setup();try{
  const preflight=await db.query<{permitted:boolean}>(CONNECTION_PREFLIGHT);assert.equal(preflight.rows[0]!.permitted,false,'emulated administrator is never the production login');
  const repo=memoryRepository(db);const ack=await repo.save(owner(),key(),command(empty(),0));assert.equal(ack.serverRevision,1);assert.deepEqual((await repo.read(owner())).state,empty());
  await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:A,role:'wd_owner_plan_stage'})]);await db.exec('set role wd_owner_plan_stage');
  await assert.rejects(db.query('insert into public.wd_proposal_plan_replay values($1,$2,$3::jsonb,txid_current())',[B,key(),'{}']),/row-level security/);
  await assert.rejects(db.query('insert into public.wd_proposal_plan_replay values($1,$2,$3::jsonb,0)',[A,key(),'{}']),/row-level security/);
  await assert.rejects(db.query('select * from public.wd_proposal_plan_replay'),/permission denied/);
  await claims(db,'authenticated',A);assert.equal((await rpc(db,'save',command(draft(),1),key())).error,'replay_required');
  await db.exec('reset role');const factory=ownerPlanRepository({admit:admitState,transactions:{transaction:async f=>db.transaction(tx=>f(tx))}});await assert.rejects(factory.save(owner(),key(),command(empty(),0)),/revision_conflict/);
 }finally{await db.close();}
});
test('idle client faults, disposal timeout and release errors stay safe and never retry',async()=>{
 const d=dry();let settle!:(v:void)=>void,entered!:()=>void;const entry=new Promise<void>(r=>{entered=r;});const p=d.adapter.transaction(async()=>{entered();await new Promise<void>(r=>{settle=r;});});void p.catch(()=>{});await entry;d.client.emit('error',Error('synthetic client secret'));settle();await assert.rejects(p,/transaction_failed/);assert.deepEqual(d.releases,[true]);await d.adapter.dispose();await d.adapter.dispose();assert.equal(d.ends,1);
 const h=dry();let finish!:()=>void;Object.assign(h.pool,{end:()=>new Promise<void>(r=>{finish=r;})});await h.adapter.transaction(async()=>{});await assert.rejects(h.adapter.dispose(),/dispose_timeout/);finish();
 const r=dry();Object.assign(r.client,{release(){throw Error('synthetic release private');}});await assert.rejects(r.adapter.transaction(async()=>{}),/release_failed/);await r.adapter.dispose();
});
