import {createHash} from "node:crypto";
import {packCanonical} from "../../packages/solver/src/units.ts";
import type {AuthoredSku} from "./authored/skus.ts";
export const hash=(v:unknown)=>createHash("sha256").update(JSON.stringify(v)).digest("hex");
export const normalize=(v:string)=>v.normalize("NFKC").replace(/[®™]/g,"").toLowerCase().replace(/\s+/g," ").trim();
export const packFingerprint=(s:AuthoredSku)=>hash([s.id,s.name,s.pack_qty,s.pack_unit,s.canonical_unit,s.grams_per_unit]);
export type Offer={productId:string;description:string;items:{itemId?:string;size?:string;soldBy?:string;fulfillment?:{instore?:boolean};price?:{regular?:number;promo?:number}}[]};
export type PackReview={status:"reviewed";sku_id:string;product_id:string;description:string;item_id:string;pack_size:string;pack_canonical:number;sku_fingerprint:string;form_basis:string;source_urls:string[];reviewed_at:string;revision:string;sold_by:"UNIT"};
export type Evidence={product_id:string;offer_id:string;description:string;pack_size:string;pack_canonical:number;location_id:string;store_id:string;zip:string;channel:"instore";observed_at:string;regular_cents:number;mapping_revision:string;review:PackReview;observation_digest:string};
export type ExactPrice={sku_id:string;store_id:string;region:string;shelf_price:number;unit_price:number;source:"kroger-api";confidence:number;as_of:string;provenance:Evidence};
export function reviewValid(s:AuthoredSku,r:PackReview|undefined):r is PackReview {
 return !!r && r.status==="reviewed" && r.sku_id===s.id && r.sku_fingerprint===packFingerprint(s) && r.sold_by==="UNIT" && typeof r.item_id==="string" && !!r.item_id && r.form_basis?.length>10 && Array.isArray(r.source_urls) && r.source_urls.length>0 && r.source_urls.every(u=>/^https:\/\//.test(u)) && Number.isFinite(Date.parse(r.reviewed_at)) && !!r.revision && r.pack_canonical===packCanonical(s);
}
export function exactOffer(p:Offer,s:AuthoredSku,r:PackReview|undefined):{p:Offer;size:number;price:number}|null {
 if(!reviewValid(s,r) || p.productId!==r.product_id || normalize(p.description)!==normalize(r.description)) return null;
 // Multipacks, ranges and catch-weight need a separately modeled purchase contract; never scale their prices.
 if(/\b(pack|pk)\b|\d\s*[x×]|\b(about|approx|average|variable|per|weight)\b|\d\s*[-–]\s*\d/i.test(r.pack_size)) return null;
 const item=p.items.find(i=>i.itemId===r.item_id && normalize(i.size??"")===normalize(r.pack_size));
 const price=item?.price?.regular;
 if(!item || item.soldBy!=="UNIT" || item.fulfillment?.instore!==true || !Number.isFinite(price) || price!<=0 || Math.abs(price!*100-Math.round(price!*100))>1e-7) return null;
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
export function quarantinePrices(rows:ExactPrice[],skus:AuthoredSku[]) {
 const accepted:ExactPrice[]=[],quarantine:{sku_id:string;store_id:string;region:string;as_of:string;reason:string}[]=[];
 for(const r of rows){const s=skus.find(s=>s.id===r.sku_id);if(s&&observationValid(r,s))accepted.push(r);else quarantine.push({sku_id:r.sku_id,store_id:r.store_id,region:r.region,as_of:r.as_of,reason:"Original immutable identity/form/physical-pack/location/channel/observation review missing or stale. Today's map does not certify this history."});}
 return {accepted,quarantine};
}
