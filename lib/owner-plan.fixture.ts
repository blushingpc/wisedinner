// TEST ONLY: PGlite, app parser and emulated Auth/storage. Never imported by production.
import {AccountError,UUID} from './account.ts';
import {SessionBoundary, type AuthPort, type StoragePort, type Identity} from '../../wisedinner-app/src/account/session.ts';
import {OwnerLocalPlannerState, type LocalPlanningState} from '../../wisedinner-app/src/account/planner-state.ts';
import {snapshot} from '../../wisedinner-app/src/data/snapshot.ts';
import {CATALOG} from '../../wisedinner-app/src/features/kitchen.ts';
import {ALLERGEN_IDS} from '../../wisedinner-app/src/data/ingredient-tags.ts';
import {MAX_STORES} from '../../wisedinner-app/src/config.ts';

import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
const pins=[{"relative":"src/account/billing.ts","sha256":"214703af61c86e3ba60099ba8e5e9467b99053f2b32860e190985715c8031dca","bytes":12315},{"relative":"src/account/cache.ts","sha256":"a87e090cf5298040d335a1cb8119390686586f14d3c5eac855b73467c17899de","bytes":5446},{"relative":"src/account/client.ts","sha256":"8828545e48e7066e69ce0847c823191f4f208bc32ef695e168e309b519ce7c62","bytes":2411},{"relative":"src/account/contract.ts","sha256":"a7e2323889f4a134caf44f0814fcded5a30ba0d4fee5c2c5b652bbc98ef83473","bytes":4039},{"relative":"src/account/deletion.ts","sha256":"230effa6616410c1b5741ec70d80431eb5ba107bc8922d9ffff721ad642473af","bytes":9434},{"relative":"src/account/index.ts","sha256":"a31be8c34c925e12e5bfb699f650774034594ab028753ee1e3fabafe0328a536","bytes":4924},{"relative":"src/account/planner-admission.ts","sha256":"86dc841452440fbe772ecf42b706142865389eb25793950e22ba2b990c341b6a","bytes":1505},{"relative":"src/account/planner-state.ts","sha256":"7b4c645617b09d7061a04ce24289e874ef90ed0c638477fa4e799585a6d1f5bc","bytes":11179},{"relative":"src/account/session.ts","sha256":"1a38eabf3970c974850c3807c99756ad42311db2dc94ba1600ea0a6a9458c609","bytes":10012},{"relative":"src/account/transport.ts","sha256":"a636e0e8ddb933290be8ed05483c6a36185df5626ee5536b2beff93178d50b64","bytes":7098},{"relative":"src/config.ts","sha256":"9ad35c4f787db4e617e0e68f9ddac89b0bdf5393468683d173925ad778dbf775","bytes":1812},{"relative":"src/data/aisles.json","sha256":"dfa638c2367ced071fa36345ce0a5a5640661c40313525be13593c7265e333e5","bytes":1922},{"relative":"src/data/delivery-model.json","sha256":"5d4185268052f14444cd1292df1a5be7d8f41a73147507baee2157e098ec9fd4","bytes":538},{"relative":"src/data/ingredient-tags.json","sha256":"ce0d3d42106f670aa369c98b6c47f77cbc513dc53bce16a39901d7562b2e1509","bytes":7355},{"relative":"src/data/ingredient-tags.ts","sha256":"62e75fc775d9c7c2afb4da312c49ba09a02a2ab9669c2e872fd60ed4ffbbf5d6","bytes":2328},{"relative":"src/data/meal-display.json","sha256":"8a8422c505014c14e73334c4e1253926d742fd08def1165213142c07c33304a5","bytes":4638},{"relative":"src/data/menu.json","sha256":"ece12d1ad0227a2481533b0c73e284bb252d67af7c606367f2f47f9fbb641199","bytes":7643},{"relative":"src/data/pantry-catalog.json","sha256":"b1ff459cad6c01907ca33c37573f1ddea558ec0e22af0a6161df391563d3eb75","bytes":24279},{"relative":"src/data/photos.ts","sha256":"10dd9ba88cc49cb32b99bb83e06ba6108e038b64996423b3f90eb38e5837424b","bytes":3226},{"relative":"src/data/receipt.fixture.json","sha256":"d3a59c79eb94546d55790cfbf64d84ca1072ff23cc981faf483bad4b5b2532b5","bytes":1207},{"relative":"src/data/snapshot.ts","sha256":"d23b040fc3fd20831d71b4926aca54d64b110c67f848bd25708cb0538223b1d2","bytes":11849},{"relative":"src/data/staples.json","sha256":"fc4393d57f45d88ca13787d754ba9fe08554af3841ab1886f321cfbcf60eee7b","bytes":11038},{"relative":"src/data/staples.ts","sha256":"be343fd650b64433dbcba59200235506a58a9c825535e1217f11bcad2427fa8f","bytes":574},{"relative":"src/data/stores.json","sha256":"6f77c1d4a8ee6711755551a34a5be8d1e74e23e26d8e51a36e9a94845984172f","bytes":795},{"relative":"src/data/templates.ts","sha256":"2ea33415ce6e4a2d2daec939c671524a29c6c855f18b6dc6de532456e3dd5c64","bytes":7683},{"relative":"src/features/allergies.ts","sha256":"3cd28cb749f78f551e1dee3ab652f51832ee65f83b35617d7425a057402d3b0b","bytes":2722},{"relative":"src/features/diet.ts","sha256":"1e9d8873339201f8044bf66a75cc1cdf6bff528b60f02b7a7965541b8d317280","bytes":1005},{"relative":"src/features/kitchen.ts","sha256":"cf9f8cad305e764672f79826142f12143af29df496176ff3256575c5ad02dd3b","bytes":11299},{"relative":"src/solver/consumed-nutrients.ts","sha256":"9b77e5053cb0a2b1cb6c3bf491bb78db9935248aaacd6b62bea738d5e24e10f6","bytes":2238},{"relative":"src/solver/core/solver.test.ts","sha256":"5f97a94bf6b64a304dbd7d3bdddc9659f87926c79d0c7bf7f741a9b96af0aac3","bytes":5664},{"relative":"src/solver/core/solver.ts","sha256":"af8058cc449800c1df22d7e177e90fa525c356de10fa2c088133cc7188cb5032","bytes":12026},{"relative":"src/solver/core/tsconfig.json","sha256":"f1c56335f6c3489fdb15edb7237161d6a5ced416a78b0992696cbfa9ec63860c","bytes":890},{"relative":"src/solver/data/staples.ts","sha256":"85c636d145eb4d0a950deed8623ee2240c5d30b32963c86fcb5aee959ea5535c","bytes":157},{"relative":"src/solver/data/templates.ts","sha256":"4811437bf07b99a40bb0b14cc24bec368a5cd0ab502e3653f2201966dcd0a50c","bytes":161},{"relative":"src/solver/delivery.ts","sha256":"c1f8442b06cb0b3e74d76e44a9273ca67e7c3ad965d2911a12ec04737d51d6b6","bytes":2023},{"relative":"src/solver/exclusions.ts","sha256":"79f5fd4211c27ee0438e900168172e56058affa61d552fbd07859a5f2281aa71","bytes":2080},{"relative":"src/solver/index.ts","sha256":"a5ab67d43459562f365db6e552f2b8601082ab2ed1b95e2036db6c1f6d7a54e3","bytes":27744},{"relative":"src/solver/pricing.ts","sha256":"021eff049f1b674b4e587db833034e51ba8c7a5ce9567856c025798f81caef0f","bytes":948},{"relative":"src/store/answers-migrate.ts","sha256":"dac4e2ac664941109247463f26a57ae117cb11333f787a1f7656c205e558ab3b","bytes":2882},{"relative":"src/store/answers-pure.ts","sha256":"90f266d8aa06923e4bff163ae169efa56ec8b64ac1c6a14a922427c7f775a698","bytes":5764},{"relative":"src/store/storage-boundary.ts","sha256":"2542c43755fcfe50b0ffb01f9156259b1a27a1ac39b20ef76ce754c97539e7e5","bytes":12154},{"relative":"src/store/week-admission.ts","sha256":"e7cb78b47010737e2741f0f645e5fa1a03a20602cd9bc99cb5e130b98db8d743","bytes":4466}];
export function assertSources(){for(const p of pins){const bytes=readFileSync(new URL('../../wisedinner-app/'+p.relative,import.meta.url));if(bytes.length!==p.bytes||createHash('sha256').update(bytes).digest('hex')!==p.sha256)throw new Error('App fixture source changed');}}
function refuse(code='invalid_full_state'):never{throw new AccountError(400,code);}
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {type VerifiedAccount} from './account.ts';
import {solveWeek, type Answers} from '../../wisedinner-app/src/solver/index.ts';
import {FORMAT,PINS,canonical,ownCopy,MAX_BYTES,ownerPlanCodec,receiptShape as coreReceiptShape,type Command,type Receipt} from './owner-plan-codec.ts';
export const A='10000000-0000-4000-8000-000000000001',B='10000000-0000-4000-8000-000000000002';
let nonce=0;export const key=()=>`20000000-0000-4000-8000-${String(++nonce).padStart(12,'0')}`;
export const owner=(id=A):VerifiedAccount=>({id,token:'e30.c3ludGhldGlj.c2ln',authenticatedAt:Math.floor(Date.now()/1000),providers:['email']});
export function complete():LocalPlanningState{
 const answers:Answers={budget:64.01,protein:100,calories:'not-sure',diet:'none',allergies:[],household:1,pantry:[{id:'eggs',qty:0.5},{id:'custom:fixture',qty:0.25,name:'Synthetic pantry item'}],stores:[]};
 const result=solveWeek(answers,7);
 return {answers,draft:{budget:64.01,protein:120},week:{seed:7,generatedAt:'2026-10-08T00:00:00.000Z',answers:structuredClone(answers),result},checks:result.list.length?{[result.list[0]!.id]:true}:{}};
}
export const empty=():LocalPlanningState=>({answers:null,draft:{},week:null,checks:{}});
export const draft=():LocalPlanningState=>({answers:null,draft:{budget:64.01,pantry:[{id:'eggs',qty:0.5}]},week:null,checks:{}});
export const command=(state=complete(),expectedRevision=0):Omit<Command,'state'>&{state:LocalPlanningState}=>({format:FORMAT,pins:PINS,expectedRevision,state});
export async function setup(){
 const db=await PGlite.create('memory://');
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
   create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
   create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
   create function auth.uid()returns uuid language sql stable as $$select(auth.jwt()->>'sub')::uuid$$;
   create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
   create table public.unrelated_sentinel(id integer primary key);insert into public.unrelated_sentinel values(7);`);
  for(const m of ['0006_wd_accounts.sql','0007_wd_billing.sql','0009_wd_notifications.sql','0013_wd_account_deletion.sql','0014_wd_billing_restore.sql','0015_wd_week_metadata_boundary.sql'])await db.exec(await readFile(new URL('../supabase/migrations/'+m,import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/0016_wd_owner_plan.sql',import.meta.url),'utf8'));
  await db.exec(await readFile(new URL('../supabase/migrations/0017_wd_owner_plan_connection.sql',import.meta.url),'utf8'));
  await db.query('insert into public.wd_proposal_plan_policy(policy,environment)values($1::jsonb,$2)',[canonical(sqlPolicy()),'PRODUCTION']);
  for(const id of [A,B]){await claims(db,'authenticated',id);await rpc(db,'initialize',{},key(),'wd_account_command');await eligible(db,id);}
  await db.exec('reset role');return db;
 }catch(e){await db.close();throw e;}
}
export async function claims(db:PGlite,role:'anon'|'authenticated'|'service_role',id:string|null=A){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,role,is_anonymous:false,amr:[{method:'otp',timestamp:Math.floor(Date.now()/1000)}]})]);await db.exec('set role '+role);}
export async function rpc(db:PGlite,action:string,body:unknown={},id:string|null=null,fn='wd_proposal_plan_command'){return (await db.query<{result:Record<string,unknown>}>(`select public.${fn}($1,$2::jsonb,$3::uuid) as result`,[action,JSON.stringify(body),id])).rows[0]!.result;}
// Existing server-only billing design. Entire provider/claim/transaction setup is synthetic.
export async function eligible(db:PGlite,id=A,state='active',environment='PRODUCTION',expiresAt=Date.now()+86400000){
 await claims(db,'service_role',id);
 const bill=async(action:string,body:unknown)=>(await db.query<{r:Record<string,unknown>}>('select public.wd_billing_command($1,$2::jsonb)r',[action,JSON.stringify(body)])).rows[0]!.r;
 await bill('bind',{userId:id});const begun=await bill('begin',{userId:id,environment});
 const stateValue={state,expiresAt:state==='active'||state==='trial'?expiresAt:null,observedAt:Date.now(),reason:'synthetic_fixture',...(state==='active'||state==='trial'?{transactionHash:(id===A?'a':'b').repeat(64)}:{})};
 return bill('commit',{userId:id,environment,generation:begun.generation,state:stateValue});
}

export async function parserFixture(owner:string){
 let signed=false,currentOwner=owner;const memory=new Map<string,string>();
 const storage:StoragePort={getItem:async k=>memory.get(k)??null,setItem:async(k,v)=>{memory.set(k,v);},removeItem:async k=>{memory.delete(k);}};
 const auth:AuthPort={getSession:async()=>({data:{session:signed?{access_token:'e30.c3ludGhldGlj.c2ln'}:null},error:null}),getUser:async()=>({data:{user:{id:currentOwner,is_anonymous:false}},error:null}),refreshSession:async()=>({data:{session:null},error:null}),signOut:async()=>{signed=false;return {error:null};},onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}})};
 const session=new SessionBoundary(auth,storage);await session.start();signed=true;await session.validate();
 const planner=new OwnerLocalPlannerState(session,storage);planner.bind();
 return {session,planner,memory,async switchOwner(next:string){currentOwner=next;signed=true;await session.validate();planner.bind();},dispose(){planner.dispose();session.dispose();}};
}
export async function admitState(v:unknown,owner:string):Promise<LocalPlanningState>{
 assertSources();
const copied=ownCopy(v);const f=await parserFixture(owner);
 try{const admitted=await f.planner.save(f.planner.begin(),copied);if(canonical(admitted)!==canonical(copied))refuse('noncanonical_state');return ownCopy(admitted) as LocalPlanningState;}
 catch(e){if(e instanceof AccountError)throw e;return refuse('invalid_full_state');}finally{f.dispose();}
}
export const sqlPolicy=()=>({format:FORMAT,pins:PINS,maxBytes:MAX_BYTES,maxStores:MAX_STORES,stores:snapshot.stores.map(s=>s.id),pantryIds:CATALOG.map(p=>p.id),allergens:[...ALLERGEN_IDS]});

// Review-only cloud receipt consumer. No product import or activation. Unknown outcome retains command/key.
export class ProposalClient{
 private session:SessionBoundary;private transport:(method:'GET'|'PUT',bearer:string,key:string|null,c:Command|null)=>Promise<unknown>;
 private cloudRevision=0;private serial=0;private pending:{identity:Identity;serial:number;key:string;command:Command}|null=null;
 private receipt:Receipt|null=null;
 constructor(session:SessionBoundary,transport:ProposalClient['transport']){this.session=session;this.transport=transport;session.observeReset(()=>{this.serial++;this.cloudRevision=0;this.receipt=null;this.pending=null;});}
 view(){if(this.receipt)this.session.capture();return this.receipt?ownCopy(this.receipt) as Receipt:null;}
 held(){return this.pending?{key:this.pending.key,expectedRevision:this.pending.command.expectedRevision}:null;}
 private accept(value:Receipt){
  if(value.serverRevision<this.cloudRevision||value.serverRevision===this.cloudRevision&&this.receipt!==null&&canonical(value.state)!==canonical(this.receipt.state))throw new AccountError(409,'receipt_revision_conflict');
  this.cloudRevision=value.serverRevision;this.receipt=ownCopy(value) as Receipt;return this.view();
 }
 async read(){if(this.pending)throw new AccountError(409,'retry_same_key_required');const identity=this.session.capture(),serial=++this.serial;const value=receiptShape(await this.transport('GET',this.session.bearer(identity),null,null));this.session.assert(identity);if(serial!==this.serial)throw new AccountError(409,'stale_response');if(value.state!==null)await admitState(value.state,identity.owner);this.session.assert(identity);if(serial!==this.serial)throw new AccountError(409,'stale_response');return this.accept(value);}
 async save(key:string,state:unknown){if(this.pending)throw new AccountError(409,'retry_same_key_required');if(!UUID.test(key))refuse();const identity=this.session.capture(),serial=++this.serial;const c=await decodeCommand({format:FORMAT,pins:PINS,expectedRevision:this.cloudRevision,state},identity.owner);this.session.assert(identity);if(serial!==this.serial)throw new AccountError(409,'stale_response');this.pending={identity,serial,key,command:c};return this.send();}
 async retry(){if(!this.pending)throw new AccountError(409,'no_pending_operation');return this.send();}
 private async send(){const p=this.pending!;this.session.assert(p.identity);let raw:unknown;
  try{raw=await this.transport('PUT',this.session.bearer(p.identity),p.key,ownCopy(p.command) as Command);}catch{throw new AccountError(503,'outcome_unknown_retry_same_key');}
  this.session.assert(p.identity);if(p!==this.pending||p.serial!==this.serial)throw new AccountError(409,'stale_response');
  const ack=receiptShape(raw);if(ack.serverRevision!==p.command.expectedRevision+1||canonical(ack.state)!==canonical(p.command.state))refuse('receipt_mismatch');
  await admitState(ack.state,p.identity.owner);this.session.assert(p.identity);if(p!==this.pending||p.serial!==this.serial)throw new AccountError(409,'stale_response');
  const accepted=this.accept(ack);this.pending=null;return accepted;
 }
}

// TEST ONLY physical-transaction substitute. Claims/roles/provider rows are emulated, never hosted proof.
import {ownerPlanRepository,ownerPlanHandler,type SqlTransaction,type OwnerPlanRepository} from './owner-plan-server.ts';
export const receiptShape=(value:unknown)=>coreReceiptShape(value) as Omit<Receipt,'state'>&{state:LocalPlanningState|null};
export const decodeCommand=(value:unknown,owner:string)=>ownerPlanCodec(admitState).decodeCommand(value,owner);
export function memoryRepository(db:PGlite,failAfterWrite:()=>void=()=>{}){
 const repository=ownerPlanRepository({admit:admitState,transactions:{transaction:async body=>db.transaction(async tx=>{const result=await body(tx as SqlTransaction);failAfterWrite();return result;})}});
 return repository as Omit<OwnerPlanRepository,'read'|'save'>&{read(a:VerifiedAccount):Promise<ReturnType<typeof receiptShape>>;save(a:VerifiedAccount,k:string,c:Command):Promise<ReturnType<typeof receiptShape>>};
}
export const proposalHandler=(deps:{verify(r:Request):Promise<VerifiedAccount>;repository:OwnerPlanRepository})=>ownerPlanHandler({...deps,admit:admitState});
