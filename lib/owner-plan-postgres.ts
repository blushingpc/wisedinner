// Unbound server-only connection factory. No environment fallback or import-time pool.
import {Pool,type PoolConfig,type PoolClient} from 'pg';
import {AsyncLocalStorage} from 'node:async_hooks';
import {AccountError} from './account.ts';
import type{SqlTransaction,TransactionPort}from './owner-plan-server.ts';

export type OwnerPlanConnection={
 enabled:boolean;host:string;port:number;database:string;user:'wd_owner_plan_login';password:string;
 mode:'direct'|'session'|'transaction';certificateAuthority?:string;
 max:number;connectionTimeoutMs:number;statementTimeoutMs:number;lockTimeoutMs:number;transactionTimeoutMs:number;disposeTimeoutMs:number;
};
type DriverClient={query(sql:string,parameters?:unknown[]):Promise<{rows:Record<string,unknown>[]}>;
 release(discard?:boolean):void;on(event:'error',listener:(error:Error)=>void):unknown;removeListener(event:'error',listener:(error:Error)=>void):unknown};
type DriverPool={connect():Promise<DriverClient>;end():Promise<void>;on(event:'error',listener:(error:Error)=>void):unknown};
export type PoolFactory=(config:PoolConfig)=>DriverPool;
const fail=(code:string):never=>{throw new AccountError(503,code);};
const integer=(v:number,min:number,max:number)=>Number.isInteger(v)&&v>=min&&v<=max;
function configuration(c:OwnerPlanConnection):PoolConfig{
 if(!c||c.enabled!==true)fail('postgres_not_configured');
 if(!/^[a-z0-9.-]+$/i.test(c.host)||c.host.length>253||!integer(c.port,1,65535)||!c.database||c.database.length>63||c.user!=='wd_owner_plan_login'||typeof c.password!=='string'||!c.password||!['direct','session','transaction'].includes(c.mode))fail('postgres_invalid_config');
 if(!integer(c.max,1,4)||!integer(c.connectionTimeoutMs,100,10000)||!integer(c.statementTimeoutMs,100,10000)||!integer(c.lockTimeoutMs,1,c.statementTimeoutMs)||!integer(c.transactionTimeoutMs,c.statementTimeoutMs,30000)||!integer(c.disposeTimeoutMs,100,30000)||c.certificateAuthority!==undefined&&(typeof c.certificateAuthority!=='string'||!c.certificateAuthority.trim()))fail('postgres_invalid_config');
 return{host:c.host,port:c.port,database:c.database,user:c.user,password:c.password,ssl:{rejectUnauthorized:true,...(c.certificateAuthority?{ca:c.certificateAuthority}:{})},max:c.max,min:0,connectionTimeoutMillis:c.connectionTimeoutMs,idleTimeoutMillis:10000,maxLifetimeSeconds:60,application_name:'wisedinner-owner-plan',options:'-c statement_timeout='+c.statementTimeoutMs+' -c lock_timeout='+c.lockTimeoutMs};
}
// Default-off, exact role/privilege preflight on EVERY acquired connection.
// PUBLIC grants and nested memberships count: cannot quietly reuse an administrator.
export const CONNECTION_PREFLIGHT=`
with recursive members as(
 select r.oid,r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolcanlogin,r.rolinherit
 from pg_roles r where r.rolname=session_user
 union
 select r.oid,r.rolname,r.rolsuper,r.rolbypassrls,r.rolcreatedb,r.rolcreaterole,r.rolreplication,r.rolcanlogin,r.rolinherit
 from pg_roles r join pg_auth_members m on m.roleid=r.oid join members x on x.oid=m.member
)
select session_user='wd_owner_plan_login'
 and (select count(*) from members)=3
 and not exists(select 1 from members where rolname not in ('wd_owner_plan_login','authenticated','wd_owner_plan_stage')
   or rolsuper or rolbypassrls or rolcreatedb or rolcreaterole or rolreplication
   or (rolname='wd_owner_plan_login' and (not rolcanlogin or rolinherit))
   or (rolname='wd_owner_plan_stage' and (rolcanlogin or rolinherit)))
 and pg_has_role(session_user,'authenticated','SET') and pg_has_role(session_user,'wd_owner_plan_stage','SET')
 -- NOINHERIT login checks alone do not constrain a role after SET ROLE.
 -- CONNECT/schema USAGE are permitted; creation, TEMP, sequences and ownership are not.
 and not exists(select 1 from members x where has_database_privilege(x.oid,current_database(),'CREATE,TEMP')
   or x.oid=(select datdba from pg_database where datname=current_database()))
 and not exists(select 1 from pg_namespace n cross join members x
   where n.nspname not like 'pg_%' and n.nspname<>'information_schema'
   and (has_schema_privilege(x.oid,n.oid,'CREATE') or n.nspowner=x.oid))
 and not exists(select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace cross join members x
   where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and t.relkind in ('r','p','v','m','S','f')
   and (t.relowner=x.oid or (t.relkind='S' and has_sequence_privilege(x.oid,t.oid,'USAGE,SELECT,UPDATE'))))
 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace join members x on x.oid=p.proowner
   where n.nspname not like 'pg_%' and n.nspname<>'information_schema')
 and not exists(select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace
   where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and t.relkind in ('r','p','v','m','S','f')
   and (t.relowner=(select oid from pg_roles where rolname=session_user)
     or (t.relkind<>'S' and has_table_privilege(session_user,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
     or (t.relkind='S' and has_sequence_privilege(session_user,t.oid,'USAGE,SELECT,UPDATE'))))
 and has_table_privilege('wd_owner_plan_stage','public.wd_proposal_plan_replay','INSERT')
 and not has_table_privilege('authenticated','public.wd_proposal_plan_replay','INSERT')
 and not exists(select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace
   where n.nspname not like 'pg_%' and n.nspname<>'information_schema' and t.relkind in ('r','p','v','m','f')
   and ((has_table_privilege('wd_owner_plan_stage',t.oid,'SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     or (has_table_privilege('wd_owner_plan_stage',t.oid,'INSERT') and t.oid<>'public.wd_proposal_plan_replay'::regclass))
   or (has_table_privilege('authenticated',t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
     and not(n.nspname='public' and t.relname in ('wd_accounts','wd_proposal_plan_documents')))))
 and not exists(select 1 from pg_class t join pg_namespace n on n.oid=t.relnamespace
   where n.nspname='public' and t.relname in ('wd_accounts','wd_proposal_plan_documents')
   and has_table_privilege('authenticated',t.oid,'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'))
 and not exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
   where n.nspname not like 'pg_%' and n.nspname<>'information_schema'
   and (has_function_privilege(session_user,p.oid,'EXECUTE')
     or has_function_privilege('authenticated',p.oid,'EXECUTE')
     or has_function_privilege('wd_owner_plan_stage',p.oid,'EXECUTE'))
   and p.oid not in ('auth.uid()'::regprocedure,'auth.role()'::regprocedure,'auth.jwt()'::regprocedure,
     'public.wd_account_command(text,jsonb,uuid)'::regprocedure,
     'public.wd_proposal_plan_command(text,jsonb,uuid)'::regprocedure))
 as permitted`;

export function ownerPlanPostgres(config:OwnerPlanConnection,factory:PoolFactory=c=>new Pool(c) as unknown as DriverPool):TransactionPort&{dispose():Promise<void>}{
 const pgConfig=configuration(config),settings={...config};let pool:DriverPool|undefined,disposed=false,idleFault=false,disposing:Promise<void>|undefined;
 const nesting=new AsyncLocalStorage<boolean>();const active=new Set<Promise<unknown>>();
 const getPool=()=>{if(disposed)fail('postgres_disposed');if(idleFault)fail('postgres_idle_error');if(!pool){pool=factory(pgConfig);pool.on('error',()=>{idleFault=true;});}return pool;};
 const run=async<T>(body:(tx:SqlTransaction)=>Promise<T>):Promise<T>=>{
  if(nesting.getStore())fail('postgres_nested_transaction');if(typeof body!=='function')fail('postgres_invalid_callback');
  let client:DriverClient;try{client=await getPool().connect();}catch(e){if(e instanceof AccountError)throw e;return fail('postgres_acquire_failed');}
  let open=true,broken=false,begun=false,committing=false,expired=false,queryFailure=false;
  const onError=()=>{broken=true;open=false;};client.on('error',onError);
  const pending=new Set<Promise<unknown>>();let queue:Promise<unknown>=Promise.resolve();
  const tx:SqlTransaction={query<T extends Record<string,unknown>>(sql:string,parameters?:unknown[]){
   if(!open||expired||disposed||broken)return Promise.reject(new AccountError(503,'postgres_stale_query'));
   // Only text + bound parameters. No prepared statement names or transaction control by callers.
   if(typeof sql!=='string'||sql.length>16384||/[;]|--|\/\*/.test(sql)||!(/^(select|insert)\b/i.test(sql.trim())||/^set local role (authenticated|wd_owner_plan_stage)$/i.test(sql.trim()))){
    queryFailure=true;const refused=Promise.reject(new AccountError(503,'postgres_invalid_query'));void refused.catch(()=>{});return refused;
   }
   const operation=queue.then(async()=>{if(expired||broken)fail('postgres_transaction_failed');try{return await client.query(sql,parameters) as {rows:T[]};}catch{queryFailure=true;return fail('postgres_query_failed');}});
   queue=operation.catch(()=>{});pending.add(operation);void operation.then(()=>pending.delete(operation),()=>pending.delete(operation));return operation;
  }};
  let expire!:(e:AccountError)=>void;const deadline=new Promise<never>((_r,reject)=>{expire=reject;});void deadline.catch(()=>{});
  const timer=setTimeout(()=>{expired=true;open=false;expire(new AccountError(503,'postgres_transaction_timeout'));},settings.transactionTimeoutMs);
  try{
   const proof=await client.query(CONNECTION_PREFLIGHT);if(proof.rows.length!==1||proof.rows[0].permitted!==true)fail('postgres_privilege_refused');
   try{await client.query('BEGIN');begun=true;}catch{broken=true;fail('postgres_begin_failed');}
   await client.query("select set_config('statement_timeout',$1,true),set_config('lock_timeout',$2,true),set_config('idle_in_transaction_session_timeout',$3,true)",[String(settings.statementTimeoutMs),String(settings.lockTimeoutMs),String(settings.transactionTimeoutMs)]);
   const callback=nesting.run(true,()=>body(tx));void callback.catch(()=>{});
   const value=await Promise.race([callback,deadline]);open=false;
   const outstanding=await Promise.allSettled([...pending]);if(outstanding.some(p=>p.status==='rejected')||queryFailure||expired||broken||disposed)fail('postgres_transaction_failed');
   committing=true;await client.query('COMMIT');begun=false;return value;
  }catch(e){
   open=false;await Promise.allSettled([...pending]);
   if(committing){broken=true;return fail('postgres_commit_unknown');}
   if(begun&&!broken){try{await client.query('ROLLBACK');begun=false;}catch{broken=true;return fail('postgres_rollback_failed');}}
   if(e instanceof AccountError)throw e;return fail('postgres_transaction_failed');
  }finally{clearTimeout(timer);open=false;client.removeListener('error',onError);try{client.release(broken||begun||expired);}catch{fail('postgres_release_failed');}}
 };
 return{
  transaction<T>(body:(tx:SqlTransaction)=>Promise<T>){const promise=run(body);active.add(promise);void promise.then(()=>active.delete(promise),()=>active.delete(promise));return promise;},
  dispose(){if(disposing)return disposing;disposed=true;disposing=(async()=>{let timer:ReturnType<typeof setTimeout>|undefined;
   try{await Promise.race([(async()=>{await Promise.allSettled([...active]);await pool?.end();})(),new Promise<never>((_r,reject)=>{timer=setTimeout(()=>reject(new AccountError(503,'postgres_dispose_timeout')),settings.disposeTimeoutMs);})]);}
   catch(e){if(e instanceof AccountError)throw e;fail('postgres_dispose_failed');}finally{clearTimeout(timer);}})();return disposing;
  }
 };
}
// The driver type is intentionally reachable only here, never as a request-supplied client.
export type PhysicalOwnerPlanClient=PoolClient;
