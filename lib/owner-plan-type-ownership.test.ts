// LOCAL memory SQL with the actual exported preflight/adapter; no physical connection.
import test from 'node:test';
import assert from 'node:assert/strict';
import {CONNECTION_PREFLIGHT,type OwnerPlanConnection} from './owner-plan-postgres.ts';
import {narrowSql,sqlDriver} from './owner-plan-postgres.fixture.ts';
const config:OwnerPlanConnection={enabled:true,host:'fixture.invalid',port:5432,database:'fixture',user:'wd_owner_plan_login',password:'synthetic-only',mode:'transaction',max:1,connectionTimeoutMs:100,statementTimeoutMs:100,lockTimeoutMs:50,transactionTimeoutMs:1000,disposeTimeoutMs:1000};
test('member-owned enum is refused by installed adapter before BEGIN or body',async()=>{
 const f=await narrowSql(),d=sqlDriver(f.db,config);let bodies=0;
 try{
  await f.admin("create type fixture_check.owned_enum as enum ('x');alter type fixture_check.owned_enum owner to wd_owner_plan_stage;revoke all on type fixture_check.owned_enum from wd_owner_plan_stage");
  const owner=await f.db.query<{name:string}>("select r.rolname name from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_roles r on r.oid=t.typowner where n.nspname='fixture_check' and t.typname='owned_enum'");
  assert.equal(owner.rows[0]?.name,'wd_owner_plan_stage');
  await assert.rejects(d.adapter.transaction(async()=>{bodies++;}),/postgres_privilege_refused/);
  assert.equal(bodies,0);assert.deepEqual(d.calls,[CONNECTION_PREFLIGHT]);assert.deepEqual(d.releases,[false]);
 }finally{await d.adapter.dispose();await f.db.close();}
});
test('enum/domain/free-standing composite ownership across the complete role closure',async t=>{
 const f=await narrowSql();
 try{
  await f.admin("create type fixture_check.enum_value as enum ('x');create domain fixture_check.domain_value as integer;create type fixture_check.composite_value as (value integer)");
  for(const role of ['wd_owner_plan_login','authenticated','wd_owner_plan_stage'])for(const kind of ['enum','domain','composite'])await t.test(role+' '+kind,async()=>{
   await f.admin('alter type fixture_check.'+kind+'_value owner to '+role+';revoke all on type fixture_check.'+kind+'_value from '+role);
   const d=sqlDriver(f.db,config);let bodies=0;
   try{
    assert.equal((await f.db.query<{permitted:boolean}>(CONNECTION_PREFLIGHT)).rows[0]?.permitted,false);
    await assert.rejects(d.adapter.transaction(async()=>{bodies++;}),/postgres_privilege_refused/);
    assert.equal(bodies,0);assert.deepEqual(d.calls,[CONNECTION_PREFLIGHT]);assert.deepEqual(d.releases,[false]);
   }finally{await d.adapter.dispose();await f.admin('alter type fixture_check.'+kind+'_value owner to postgres;revoke all on type fixture_check.'+kind+'_value from '+role);}
   assert.equal((await f.db.query<{permitted:boolean}>(CONNECTION_PREFLIGHT)).rows[0]?.permitted,true);
  });
 }finally{await f.db.close();}
});
test('inherited/settable member type owner refuses despite NOINHERIT login/stage',async()=>{
 const f=await narrowSql(),d=sqlDriver(f.db,config);
 try{
  await f.admin("create domain fixture_check.inherited_value as integer;alter domain fixture_check.inherited_value owner to authenticated;grant authenticated to wd_owner_plan_stage with inherit true");
  assert.equal((await f.db.query<{allowed:boolean}>("select pg_has_role('wd_owner_plan_stage','authenticated','USAGE') allowed")).rows[0]?.allowed,true);
  await assert.rejects(d.adapter.transaction(async()=>assert.fail('member-owned type body must not run')),/postgres_privilege_refused/);
  assert.deepEqual(d.calls,[CONNECTION_PREFLIGHT]);
 }finally{await d.adapter.dispose();await f.db.close();}
});
test('unrelated-owned user types and genuine system types keep intended narrow fixture allowed',async()=>{
 const f=await narrowSql(),d=sqlDriver(f.db,config);let bodies=0;
 try{
  await f.admin("create role fixture_unrelated nologin;create type fixture_check.other_enum as enum ('x');create domain fixture_check.other_domain as integer;create type fixture_check.other_composite as (value integer);alter type fixture_check.other_enum owner to fixture_unrelated;alter type fixture_check.other_domain owner to fixture_unrelated;alter type fixture_check.other_composite owner to fixture_unrelated");
  const rows=await f.db.query<{system_types:number;other_types:number}>("select count(*)filter(where n.nspname='pg_catalog')::integer system_types,count(*)filter(where r.rolname='fixture_unrelated')::integer other_types from pg_type t join pg_namespace n on n.oid=t.typnamespace join pg_roles r on r.oid=t.typowner");
  assert.ok((rows.rows[0]?.system_types??0)>0);assert.ok((rows.rows[0]?.other_types??0)>=3);
  await d.adapter.transaction(async()=>{bodies++;});assert.equal(bodies,1);assert.equal(d.calls[0],CONNECTION_PREFLIGHT);assert.equal(d.calls[1],'BEGIN');assert.equal(d.calls.at(-1),'COMMIT');assert.deepEqual(d.releases,[false]);
 }finally{await d.adapter.dispose();await f.db.close();}
});
