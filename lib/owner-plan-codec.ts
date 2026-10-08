// Server-only, unbound composition. No default admission, transaction connection or route binding.
import {AccountError, UUID} from './account.ts';
export const FORMAT="owner-plan-v2-proposal-2026-10-08";
export const MAX_BYTES=131072;
export const PINS=Object.freeze({
  "source": "3818a97bf958c585fce2bdb1e6c97e1d215ff74bfc9b9da970d85640b3098545",
  "catalog": "fc9d0a9aea0813234dcf1371fabdb200eeae1d36c6553f8de3c31853a4f4c2f5",
  "solver": "d6f6c1c23b59b6b82234713601004fb252eb101b3addf4ab0949820642ea46a3",
  "nutrients": "9b77e5053cb0a2b1cb6c3bf491bb78db9935248aaacd6b62bea738d5e24e10f6",
  "answersVersion": 3,
  "weekVersion": 2
});
export type Pins=typeof PINS;
export type PlanningState={answers:unknown;draft:unknown;week:unknown;checks:unknown};
export type Command={format:typeof FORMAT;pins:Pins;expectedRevision:number;state:PlanningState};
export type Receipt={format:typeof FORMAT;pins:Pins;serverRevision:number;state:PlanningState|null};
function refuse(code='invalid_full_state'):never{throw new AccountError(400,code);}
// Canonical bounded JSON based exclusively on own data descriptors. No stringify of untrusted objects.
export function ownCopy(value:unknown):unknown{
 let nodes=10000;const active=new Set<object>();
 function walk(v:unknown,depth:number):unknown{
  if(--nodes<0||depth>12)refuse();
  if(v===null||typeof v==='boolean')return v;
  if(typeof v==='number'){if(!Number.isFinite(v)||Math.abs(v)>Number.MAX_SAFE_INTEGER)refuse();return v;}
  if(typeof v==='string'){if(v.length>4096)refuse();return v;}
  if(!v||typeof v!=='object'||active.has(v))refuse();
  const proto=Object.getPrototypeOf(v);if(Array.isArray(v)?proto!==Array.prototype:proto!==null&&proto!==Object.prototype)refuse();
  active.add(v);const fields=Object.getOwnPropertyDescriptors(v);let out:unknown;
  if(Array.isArray(v)){
   const n=fields.length?.value;if(!Number.isInteger(n)||n>256||Reflect.ownKeys(fields).length!==n+1)refuse();
   out=Array.from({length:n},(_,i)=>{const d=fields[String(i)];if(!d||!('value'in d)||!d.enumerable)refuse();return walk(d.value,depth+1);});
  }else{
   const obj:Record<string,unknown>={};
   for(const k of Reflect.ownKeys(fields).sort()){if(typeof k!=='string'||['__proto__','constructor','prototype'].includes(k))refuse();const d=fields[k]!;if(!('value'in d)||!d.enumerable)refuse();obj[k]=walk(d.value,depth+1);}
   out=obj;
  }
  active.delete(v);return out;
 }
 const out=walk(value,0);if(Buffer.byteLength(JSON.stringify(out))>MAX_BYTES)refuse('state_too_large');return out;
}
export const canonical=(v:unknown)=>JSON.stringify(ownCopy(v));
function record(v:unknown,keys:readonly string[]):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join()!==[...keys].sort().join())refuse();return v as Record<string,unknown>;}
const revision=(v:unknown)=>{if(!Number.isInteger(v)||(v as number)<0||(v as number)>2147483646)refuse('invalid_revision');return v as number;};
const pins=(v:unknown)=>{if(canonical(v)!==canonical(PINS))refuse('incompatible_source');};
export function commandShape(v:unknown):Command{
 const c=record(ownCopy(v),['format','pins','expectedRevision','state']);
 if(c.format!==FORMAT)refuse('unsupported_format');pins(c.pins);revision(c.expectedRevision);if(c.expectedRevision===2147483646)refuse('invalid_revision');record(c.state,['answers','draft','week','checks']);
 return c as Command;
}
export function receiptShape(v:unknown):Receipt{
 const c=record(ownCopy(v),['format','pins','serverRevision','state']);
 if(c.format!==FORMAT)refuse('unsupported_format');pins(c.pins);revision(c.serverRevision);
 if(c.state===null&&c.serverRevision!==0||c.state!==null&&c.serverRevision===0)refuse();if(c.state!==null)record(c.state,['answers','draft','week','checks']);return c as Receipt;
}
export type CanonicalAdmission=(state:unknown,verifiedOwner:string)=>Promise<unknown>;
export function ownerPlanCodec(admit:CanonicalAdmission){
 if(typeof admit!=='function')throw new AccountError(503,'admission_unavailable');
 const admitState=async(value:unknown,owner:string):Promise<PlanningState>=>{
  if(!UUID.test(owner))throw new AccountError(401,'invalid_session');
  const input=ownCopy(value);record(input,['answers','draft','week','checks']);
  try{const output=ownCopy(await admit(ownCopy(input),owner));if(canonical(output)!==canonical(input))refuse('noncanonical_state');return output as PlanningState;}
  catch(e){if(e instanceof AccountError&&['invalid_full_state','noncanonical_state','source_changed'].includes(e.message))throw e;throw new AccountError(400,'invalid_full_state');}
 };
 return{admitState,async decodeCommand(v:unknown,owner:string){const c=commandShape(v);return{...c,state:await admitState(c.state,owner)};},async decodeReceipt(v:unknown,owner:string){const r=receiptShape(v);return{...r,state:r.state===null?null:await admitState(r.state,owner)};}};
}
