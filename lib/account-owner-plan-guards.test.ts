// Isolated LOCAL inputs/dry driver only. No Auth/SQL/native/provider request.
import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {AccountError,boundedJson,supabaseVerifier} from './account.ts';
import {ownerPlanRepository,type TransactionPort} from './owner-plan-server.ts';
import {ownerPlanPostgres,CONNECTION_PREFLIGHT,type OwnerPlanConnection,type PoolFactory} from './owner-plan-postgres.ts';
import {FORMAT,PINS} from './owner-plan-codec.ts';
import {owner} from './owner-plan.fixture.ts';
import {currentAdmission} from './owner-plan-postgres.fixture.ts';
test('content-type empty/missing/invalid segments refuse; normalized valid JSON remains accepted',async()=>{
 for(const type of ['', '; charset=utf8','text/plain','application/jsonish']){
  const r=new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':type},body:'{}'});
  await assert.rejects(boundedJson(r),e=>e instanceof AccountError&&e.status===415&&e.message==='json_required');
 }
 await assert.rejects(boundedJson(new Request('https://fixture.invalid',{method:'POST'})),/json_required/);
 assert.deepEqual(await boundedJson(new Request('https://fixture.invalid',{method:'POST',headers:{'Content-Type':'APPLICATION/JSON ; charset=utf8'},body:'{}'})),{});
});
test('empty/malformed JWT segments never authorize; verified good server claims retain behavior',async()=>{
 let calls=0;const now=2000000000000,verify=supabaseVerifier('https://auth.invalid','synthetic',async()=>{calls++;return Response.json({id:owner().id,is_anonymous:false,email_confirmed_at:new Date(now-60000).toISOString(),identities:[{provider:'email'}]});},()=>now);
 for(const header of ['Bearer','Bearer e30..c2ln','Bearer .e30.c2ln','Bearer e30.c2ln.'])await assert.rejects(verify(new Request('https://fixture.invalid',{headers:{Authorization:header}})),/invalid_session/);
 assert.equal(calls,0);
 for(const payload of ['not-json',JSON.stringify({sub:owner().id})]){
  await assert.rejects(verify(new Request('https://fixture.invalid',{headers:{Authorization:'Bearer e30.'+Buffer.from(payload).toString('base64url')+'.c2ln'}})),/invalid_session/);
 }
 const claims={sub:owner().id,iss:'https://auth.invalid/auth/v1',aud:'authenticated',role:'authenticated',exp:now/1000+100,amr:[{method:'otp',timestamp:now/1000-5}]};
 const good=await verify(new Request('https://fixture.invalid',{headers:{Authorization:'Bearer e30.'+Buffer.from(JSON.stringify(claims)).toString('base64url')+'.c2ln'}}));
 assert.equal(good.id,owner().id);assert.equal(good.authenticatedAt,now/1000-5);assert.deepEqual(good.providers,['email']);assert.equal(calls,3);
});
function repository(rows:unknown[]){
 const transactions:TransactionPort={transaction:async body=>body({query:async<T extends Record<string,unknown>>(sql:string)=>({rows:(sql.startsWith('select public.wd_proposal_plan_command')?rows:[]) as T[]})})};
 return ownerPlanRepository({admit:currentAdmission,transactions});
}
test('empty/multiple/missing SQL result rows fail closed at actual repository boundary',async()=>{
 for(const rows of [[],[undefined],[null],[{result:{}},{result:{}}]])await assert.rejects(repository(rows).read(owner()),e=>e instanceof AccountError&&e.status===503&&e.message==='owner_plan_unavailable');
});
test('RPC own error whitelist preserves status; prototype/extra/unknown errors stay unavailable',async()=>{
 for(const [error,status] of [['account_inactive',410],['account_missing',404],['eligibility_required',403],['invalid_command',400],['revision_conflict',409],['idempotency_conflict',409],['replay_required',409],['rate_limited',429]] as const)await assert.rejects(repository([{result:{error}}]).read(owner()),e=>e instanceof AccountError&&e.status===status&&e.message===error);
 for(const result of [{error:'__proto__'},{error:'constructor'},{error:'provider-private'},{error:'account_inactive',extra:true}])await assert.rejects(repository([{result}]).read(owner()),e=>e instanceof AccountError&&e.status===503&&e.message==='owner_plan_unavailable');
 const valid={format:FORMAT,pins:PINS,serverRevision:0,state:null};
 assert.deepEqual(await repository([{result:valid}]).read(owner()),valid);
});
test('empty/ambiguous/malformed actual adapter privilege rows cannot BEGIN or execute body',async()=>{
 const config:OwnerPlanConnection={enabled:true,host:'fixture.invalid',port:5432,database:'fixture',user:'wd_owner_plan_login',password:'synthetic-only',mode:'transaction',max:1,connectionTimeoutMs:100,statementTimeoutMs:100,lockTimeoutMs:50,transactionTimeoutMs:500,disposeTimeoutMs:1000};
 for(const rows of [[],[undefined],[null],[{}],[{permitted:'true'}],[{permitted:true},{permitted:true}]]){
  const calls:string[]=[],released:boolean[]=[],client=new EventEmitter(),pool=new EventEmitter();let bodies=0;
  Object.assign(client,{query:async(sql:string)=>{calls.push(sql);return{rows};},release:(discard=false)=>released.push(discard)});
  Object.assign(pool,{connect:async()=>client,end:async()=>{}});
  const adapter=ownerPlanPostgres(config,()=>pool as unknown as ReturnType<PoolFactory>);
  try{await assert.rejects(adapter.transaction(async()=>{bodies++;}),/postgres_privilege_refused/);assert.equal(bodies,0);assert.deepEqual(calls,[CONNECTION_PREFLIGHT]);assert.deepEqual(released,[false]);}finally{await adapter.dispose();}
 }
});
