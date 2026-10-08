// Server-only exports. No environment, connection, factory, scheduler or live route is bound here.
import {AccountError, UUID, boundedJson, type VerifiedAccount} from './account.ts';
import {canonical, ownCopy, ownerPlanCodec, MAX_BYTES, type CanonicalAdmission, type Command, type Receipt} from './owner-plan-codec.ts';

export type SqlTransaction={query<T extends Record<string,unknown>=Record<string,unknown>>(sql:string,parameters?:unknown[]):Promise<{rows:T[]}>};
// A trusted binding must guarantee one physical transaction, rollback on any rejection,
// transaction-local role/claims and a least-privilege login. A two-call HTTP adapter cannot satisfy this port.
export type TransactionPort={transaction<T>(body:(tx:SqlTransaction)=>Promise<T>):Promise<T>};
export type OwnerPlanRepository={read(account:VerifiedAccount):Promise<Receipt>;save(account:VerifiedAccount,key:string,command:Command):Promise<Receipt>};
const errors:Record<string,number>={account_inactive:410,account_missing:404,eligibility_required:403,invalid_command:400,revision_conflict:409,idempotency_conflict:409,replay_required:409,rate_limited:429};
function owner(a:VerifiedAccount){if(!a||typeof a.id!=='string'||!UUID.test(a.id))throw new AccountError(401,'invalid_session');return a.id;}
function result(value:unknown){const r=ownCopy(value) as Record<string,unknown>;if(r&&typeof r.error==='string'){if(Object.keys(r).length!==1||!Object.hasOwn(errors,r.error))throw new AccountError(503,'owner_plan_unavailable');throw new AccountError(errors[r.error],r.error);}return r;}
const context=async(tx:SqlTransaction,id:string,role:'authenticated'|'wd_owner_plan_stage')=>{
 await tx.query("select set_config('request.jwt.claims',$1,true)",[JSON.stringify({sub:id,role,is_anonymous:false})]);
 await tx.query(role==='authenticated'?'set local role authenticated':'set local role wd_owner_plan_stage');
};
const rpc=async(tx:SqlTransaction,action:'read'|'save',command:string,key:string|null)=>{
 const rows=(await tx.query<{result:unknown}>('select public.wd_proposal_plan_command($1,$2::jsonb,$3::uuid) as result',[action,command,key])).rows;
 if(rows.length!==1)throw new AccountError(503,'owner_plan_unavailable');return result(rows[0].result);
};
export function ownerPlanRepository(deps:{admit:CanonicalAdmission;transactions:TransactionPort}):OwnerPlanRepository{
 if(!deps||typeof deps.transactions?.transaction!=='function')throw new AccountError(503,'transaction_unavailable');
 const codec=ownerPlanCodec(deps.admit);
 const transact=async<T>(body:(tx:SqlTransaction)=>Promise<T>)=>{
  try{return await deps.transactions.transaction(async tx=>{if(!tx||typeof tx.query!=='function')throw new AccountError(503,'transaction_unavailable');return body(tx);});}
  catch(e){if(e instanceof AccountError)throw e;throw new AccountError(503,'owner_plan_unavailable');}
 };
 return{
  async read(a){const id=owner(a);return transact(async tx=>{await context(tx,id,'authenticated');return codec.decodeReceipt(await rpc(tx,'read','{}',null),id);});},
  async save(a,key,c){
   const id=owner(a);if(!UUID.test(key))throw new AccountError(400,'idempotency_key_required');
   // Independent exact canonical admission, not a caller-provided validation boolean.
   const checked=await codec.decodeCommand(c,id),bytes=canonical(checked);
   return transact(async tx=>{
    await context(tx,id,'wd_owner_plan_stage');
    await tx.query('insert into public.wd_proposal_plan_replay(user_id,id,command,transaction_id) values($1,$2,$3::jsonb,txid_current())',[id,key,bytes]);
    await context(tx,id,'authenticated');
    const ack=await codec.decodeReceipt(await rpc(tx,'save',bytes,key),id);
    if(ack.serverRevision!==checked.expectedRevision+1||canonical(ack.state)!==canonical(checked.state))throw new AccountError(503,'receipt_mismatch');
    return ack;
   });
  }
 };
}
const safeCodes=new Set([...Object.keys(errors),'invalid_session','invalid_full_state','noncanonical_state','source_changed','invalid_revision','incompatible_source','unsupported_format','state_too_large','idempotency_key_required','json_required','payload_too_large','body_required','invalid_json','invalid_shape','not_found','method_not_allowed','owner_plan_unavailable','receipt_mismatch']);
export function ownerPlanHandler(deps:{verify:(request:Request)=>Promise<VerifiedAccount>;admit:CanonicalAdmission;repository:OwnerPlanRepository}){
 if(!deps||typeof deps.verify!=='function'||typeof deps.repository?.read!=='function'||typeof deps.repository?.save!=='function')throw new AccountError(503,'composition_unavailable');
 const codec=ownerPlanCodec(deps.admit);
 return async(request:Request):Promise<Response>=>{
  try{
   const a=await deps.verify(request),id=owner(a),url=new URL(request.url);if(url.pathname!=='/proposal/owner-plan-v2'||url.search)throw new AccountError(404,'not_found');
   let ack:Receipt;
   if(request.method==='GET')ack=await deps.repository.read(a);
   else if(request.method==='PUT'){const key=request.headers.get('idempotency-key');if(!key||!UUID.test(key))throw new AccountError(400,'idempotency_key_required');ack=await deps.repository.save(a,key,await codec.decodeCommand(await boundedJson(request,MAX_BYTES),id));}
   else throw new AccountError(405,'method_not_allowed');
   return Response.json(await codec.decodeReceipt(ack,id),{headers:{'Cache-Control':'no-store'}});
  }catch(e){const safe=e instanceof AccountError&&safeCodes.has(e.message)?e:new AccountError(503,'owner_plan_unavailable');return Response.json({error:safe.message},{status:safe.status,headers:{'Cache-Control':'no-store'}});}
 };
}
export function composeOwnerPlanServer(deps:{verify:(request:Request)=>Promise<VerifiedAccount>;admit:CanonicalAdmission;transactions:TransactionPort}){
 const repository=ownerPlanRepository(deps);return{repository,handler:ownerPlanHandler({...deps,repository})};
}
