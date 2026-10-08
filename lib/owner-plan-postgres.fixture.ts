// TEST ONLY: exact privilege functions in serialized memory SQL; no physical connection.
import assert from 'node:assert/strict';
import {setup,parserFixture} from './owner-plan.fixture.ts';
import {admitOwnerPlan} from '../../wisedinner-app/src/account/owner-plan-admission.ts';
import {canonical} from './owner-plan-codec.ts';
import {ownerPlanPostgres,type PoolFactory,type OwnerPlanConnection} from './owner-plan-postgres.ts';
import {EventEmitter} from 'node:events';
const utf8={byteLength:(v:string)=>new TextEncoder().encode(v).byteLength,decode:(v:Uint8Array)=>new TextDecoder('utf-8',{fatal:true}).decode(v)};
export async function currentAdmission(value:unknown,id:string){const parsed=admitOwnerPlan(value,utf8),f=await parserFixture(id);try{const actual=await f.planner.save(f.planner.begin(),parsed);assert.equal(canonical(actual),canonical(value));return actual;}finally{f.dispose();}}
export async function narrowSql(){
 const db=await setup();try{
  const database=(await db.query<{name:string}>('select current_database()name')).rows[0]!.name,quoted='"'+database.replaceAll('"','""')+'"';
  await db.exec(`reset role;create role wd_owner_plan_login login noinherit nosuperuser nobypassrls nocreatedb nocreaterole noreplication;
   grant authenticated,wd_owner_plan_stage to wd_owner_plan_login;
   revoke all on database ${quoted} from public;grant connect on database ${quoted} to wd_owner_plan_login;
   revoke create on schema public from public;grant usage on schema public,auth to wd_owner_plan_login;
   revoke all on all tables in schema public from authenticated;
   grant select on public.wd_accounts,public.wd_proposal_plan_documents to authenticated;
   revoke all on all functions in schema public,auth from public,authenticated;
   grant execute on function auth.uid(),auth.role(),auth.jwt(),public.wd_account_command(text,jsonb,uuid),public.wd_proposal_plan_command(text,jsonb,uuid) to authenticated;
   create schema fixture_check;create sequence fixture_check.number;
   set session authorization wd_owner_plan_login;`);
  const admin=async(sql:string)=>{await db.exec('set session authorization postgres');try{await db.exec(sql);}finally{await db.exec('set session authorization wd_owner_plan_login');}};
  return{db,quoted,admin};
 }catch(e){await db.close();throw e;}
}
export function sqlDriver(db:Awaited<ReturnType<typeof setup>>,config:OwnerPlanConnection){
 const calls:string[]=[],releases:boolean[]=[],client=new EventEmitter(),pool=new EventEmitter();
 Object.assign(client,{query:async(sql:string,args?:unknown[])=>{calls.push(sql);return db.query(sql,args);},release:(discard=false)=>releases.push(discard)});
 Object.assign(pool,{connect:async()=>client,end:async()=>{}});
 return{adapter:ownerPlanPostgres(config,()=>pool as unknown as ReturnType<PoolFactory>),calls,releases};
}
