import { sha256Hex } from "../../lib/generated-runtime-bytes.ts";
import {packCanonical} from "../../packages/solver/src/units.ts";
import type {AuthoredSku} from "./authored/skus.ts";
import {STORES} from "./authored/stores.ts";
export const hash=(v:unknown)=>sha256Hex(JSON.stringify(v));
export const normalize=(v:string)=>v.normalize("NFKC").replace(/[®™]/g,"").toLowerCase().replace(/\s+/g," ").trim();
export const packFingerprint=(s:AuthoredSku)=>hash([s.id,s.name,s.pack_qty,s.pack_unit,s.canonical_unit,s.grams_per_unit]);
export type Offer={productId:string;description:string;items:{itemId?:string;size?:string;soldBy?:string;fulfillment?:{instore?:boolean;inStore?:boolean};price?:{regular?:number;promo?:number}}[]};
export type PackReview={status:"reviewed";sku_id:string;product_id:string;description:string;item_id:string;pack_size:string;pack_canonical:number;sku_fingerprint:string;form_basis:string;source_urls:string[];reviewed_at:string;revision:string;sold_by:"UNIT"};
export type Evidence={product_id:string;offer_id:string;description:string;pack_size:string;pack_canonical:number;location_id:string;store_id:string;zip:string;channel:"instore";observed_at:string;regular_cents:number;mapping_revision:string;review:PackReview;observation_digest:string};
export type ExactPrice={sku_id:string;store_id:string;region:string;shelf_price:number;unit_price:number;source:"kroger-api";confidence:number;as_of:string;provenance:Evidence};
export function reviewValid(s:AuthoredSku,r:PackReview|undefined):r is PackReview {
 return !!r && r.status==="reviewed" && r.sku_id===s.id && r.sku_fingerprint===packFingerprint(s) && r.sold_by==="UNIT" && typeof r.item_id==="string" && !!r.item_id && r.form_basis?.length>10 && Array.isArray(r.source_urls) && r.source_urls.length>0 && r.source_urls.every(u=>/^https:\/\//.test(u)) && Number.isFinite(Date.parse(r.reviewed_at)) && !!r.revision && r.pack_canonical===packCanonical(s);
}
// Provider inStore and historical instore indicate a channel, never physical stock.
function instoreIndication(item:Offer["items"][number]):boolean {
 try {
  const d=Object.getOwnPropertyDescriptor(item,"fulfillment"),v=d&&"value" in d?d.value:undefined;
  if(!v||typeof v!=="object"||Array.isArray(v))return false;
  const proto=Object.getPrototypeOf(v);
  if(proto!==null&&proto!==Object.prototype)return false;
  if(proto&&["instore","inStore"].some(k=>Object.getOwnPropertyDescriptor(proto,k)))return false;
  const a=Object.getOwnPropertyDescriptor(v,"instore"),b=Object.getOwnPropertyDescriptor(v,"inStore");
  if(!a&&!b)return false;
  if([a,b].some(d=>d&&(!("value" in d)||typeof d.value!=="boolean")))return false;
  return a&&b?a.value===true&&b.value===true:(a??b)!.value===true;
 }catch{return false;}
}
export function exactOffer(p:Offer,s:AuthoredSku,r:PackReview|undefined):{p:Offer;size:number;price:number}|null {
 if(!reviewValid(s,r) || p.productId!==r.product_id || normalize(p.description)!==normalize(r.description)) return null;
 // Multipacks, ranges and catch-weight need a separately modeled purchase contract; never scale their prices.
 if(/\b(pack|pk)\b|\d\s*[x×]|\b(about|approx|average|variable|per|weight)\b|\d\s*[-–]\s*\d/i.test(r.pack_size)) return null;
 const item=p.items.find(i=>i.itemId===r.item_id && normalize(i.size??"")===normalize(r.pack_size));
 const price=item?.price?.regular;
 if(!item || item.soldBy!=="UNIT" || !instoreIndication(item) || !Number.isFinite(price) || price!<=0 || Math.abs(price!*100-Math.round(price!*100))>1e-7) return null;
 return {p:{...p,items:[item]},size:r.pack_canonical,price:price!};
}
export function recordOffer(p:Offer,s:AuthoredSku,r:PackReview,location:{locationId:string;store_id:string;zip:string},observedAt:string):ExactPrice {
 const hit=exactOffer(p,s,r);
 if(!hit || !/^\d{5}$/.test(location.zip) || !location.locationId || !Number.isFinite(Date.parse(observedAt)) || Date.parse(r.reviewed_at)>Date.parse(observedAt)) throw new Error("Offer identity/form/pack or original observation unavailable");
 const provenance:Omit<Evidence,"observation_digest">={product_id:p.productId,offer_id:r.item_id,description:p.description,pack_size:r.pack_size,pack_canonical:r.pack_canonical,location_id:location.locationId,store_id:location.store_id,zip:location.zip,channel:"instore",observed_at:observedAt,regular_cents:Math.round(hit.price*100),mapping_revision:hash(r),review:structuredClone(r)};
 return {sku_id:s.id,store_id:location.store_id,region:location.zip,shelf_price:hit.price,unit_price:hit.price/hit.size,source:"kroger-api",confidence:1,as_of:observedAt.slice(0,10),provenance:{...provenance,observation_digest:hash(provenance)}};
}
export function observationValid(row:ExactPrice,s:AuthoredSku):boolean {
 try {
 const {observation_digest,...p}=row.provenance;
 if(hash(p)!==observation_digest || p.mapping_revision!==hash(p.review) || !reviewValid(s,p.review) || p.product_id!==p.review.product_id || p.offer_id!==p.review.item_id || normalize(p.description)!==normalize(p.review.description) || p.pack_size!==p.review.pack_size || p.pack_canonical!==p.review.pack_canonical || p.channel!=="instore" || p.store_id!==row.store_id || p.zip!==row.region || !p.location_id || row.sku_id!==s.id || row.source!=="kroger-api" || row.as_of!==p.observed_at.slice(0,10) || !Number.isFinite(Date.parse(p.observed_at)) || Date.parse(p.review.reviewed_at)>Date.parse(p.observed_at) || row.shelf_price!==p.regular_cents/100 || row.unit_price!==row.shelf_price/packCanonical(s)) return false;
 return exactOffer({productId:p.product_id,description:p.description,items:[{itemId:p.offer_id,size:p.pack_size,soldBy:"UNIT",fulfillment:{instore:true},price:{regular:row.shelf_price}}]},s,p.review)!==null;
 }catch{return false;}
}
// Historical integrity above does not certify current usefulness. The caller must
// supply a trusted clock and a reviewed policy; neither is inferred from a cache.
export type PriceLocation={store_id:string;location_id:string;zip:string;channel:"instore"};
export type PriceAdmissionContext={now:string;requested:PriceLocation;policy:{revision:string;max_age_ms:number;locations:PriceLocation[]}};
const own=(v:unknown,key:string):unknown=>{try{if(!v||typeof v!=="object")return undefined;const d=Object.getOwnPropertyDescriptor(v,key);return d&&"value" in d?d.value:undefined;}catch{return undefined;}};
const identity=(v:unknown):v is string=>typeof v==="string"&&v.length>0&&v.trim()===v;
function instant(v:unknown):number|null {
 if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(v))return null;
 const time=Date.parse(v);return Number.isFinite(time)&&new Date(time).toISOString()===(v.length===20?v.slice(0,-1)+".000Z":v)?time:null;
}
function location(v:unknown):PriceLocation|null {
 const store_id=own(v,"store_id"),location_id=own(v,"location_id"),zip=own(v,"zip"),channel=own(v,"channel");
 if(!identity(store_id)||!STORES.some(s=>s.id===store_id&&s.data_source==="kroger-api")||!identity(location_id)||typeof zip!=="string"||!/^\d{5}$/.test(zip)||channel!=="instore")return null;
 return {store_id,location_id,zip,channel};
}
const locationKey=(v:PriceLocation)=>JSON.stringify([v.store_id,v.location_id,v.zip,v.channel]);
function admissionContext(v:unknown){
 try {
 const now=instant(own(v,"now")),requested=location(own(v,"requested")),policy=own(v,"policy"),revision=own(policy,"revision"),age=own(policy,"max_age_ms"),locations=own(policy,"locations");
 if(now===null||!requested||!identity(revision)||typeof age!=="number"||!Number.isSafeInteger(age)||age<0||!Array.isArray(locations)||!locations.length)return null;
 const keys=new Set<string>();
 for(let i=0;i<locations.length;i++){const l=location(own(locations,String(i)));if(!l||keys.has(locationKey(l)))return null;keys.add(locationKey(l));}
 return keys.has(locationKey(requested))?{now,requested,max_age_ms:age}:null;
 }catch{return null;}
}
function currentlyUsable(r:ExactPrice,s:AuthoredSku,c:NonNullable<ReturnType<typeof admissionContext>>):boolean {
 try {
 const p=r.provenance,l=location(p),observed=instant(p.observed_at);
 return !!l&&locationKey(l)===locationKey(c.requested)&&observed!==null&&observed<=c.now&&c.now-observed<=c.max_age_ms&&Number.isSafeInteger(p.regular_cents)&&p.regular_cents>0&&identity(r.sku_id)&&identity(p.product_id)&&identity(p.offer_id)&&identity(p.mapping_revision)&&identity(p.review.revision)&&observationValid(r,s);
 }catch{return false;}
}
export function quarantinePrices(rows:ExactPrice[],skus:AuthoredSku[],context?:unknown) {
 const accepted:ExactPrice[]=[],quarantine:{sku_id:string;store_id:string;region:string;as_of:string;reason:string}[]=[];
 const c=admissionContext(context),counts=new Map<unknown,number>();
 const input:unknown[]=Array.isArray(rows)?Array.from(rows):[undefined];
 // One requested physical location: duplicate SKU observations are ambiguous,
 // including a valid row paired with an invalid or differently located row.
 for(const r of input){const id=own(r,"sku_id");counts.set(id,(counts.get(id)??0)+1);}
 for(const value of input){const r=value as ExactPrice,id=own(r,"sku_id"),matches=skus.filter(s=>s.id===id);
 // Unique SKU branch proves its first match before the runtime-erased assertion.
 if(c&&counts.get(id)===1&&matches.length===1&&currentlyUsable(r,matches[0]!,c))accepted.push(r);
 else {const text=(key:string)=>{const v=own(r,key);return typeof v==="string"?v:"";};quarantine.push({sku_id:text("sku_id"),store_id:text("store_id"),region:text("region"),as_of:text("as_of"),reason:"Held: explicit clock/policy, exact supported requested location, unique observation and immutable identity/pack/integer cents are required; historical integrity alone is insufficient."});}}
 return {accepted,quarantine,context_valid:c!==null};
}
