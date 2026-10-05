import {test} from "node:test";
import assert from "node:assert/strict";
import {SKUS} from "./authored/skus.ts";
import {pickProduct} from "./kroger.ts";
import {packFingerprint,recordOffer,observationValid,quarantinePrices,type PackReview,type Offer} from "./price-evidence.ts";
const sku=SKUS.find(s=>s.id==="lentils")!;
const review:PackReview={status:"reviewed",sku_id:sku.id,product_id:"fixture-product",description:"Plain Dry Lentils",item_id:"fixture-item",pack_size:"1 lb",pack_canonical:453.592,sku_fingerprint:packFingerprint(sku),form_basis:"Synthetic fixture: plain dry lentils, unit sold one-pound bag",source_urls:["https://example.invalid/synthetic-panel"],reviewed_at:"2026-09-26T00:00:00Z",revision:"fixture-1",sold_by:"UNIT"};
const offer:Offer={productId:review.product_id,description:review.description,items:[{itemId:review.item_id,size:"1 lb",soldBy:"UNIT",fulfillment:{instore:true},price:{regular:2.49}}]};
test("four-pound offer cannot price an authored one-pound bag or approve its own search result",()=>{
 assert.equal(pickProduct([{...offer,items:[{...offer.items[0],size:"4 lb",price:{regular:8}}]}],sku),null);
 assert.equal(pickProduct([offer],sku),null);assert.equal(pickProduct([offer],sku,review)?.price,2.49);
});
test("identity, preparation, offer, multipack, variable weight and price precision fail closed",()=>{
 for(const p of [{...offer,description:"Cooked Plain Dry Lentils"},{...offer,productId:"other"},{...offer,items:[{...offer.items[0],itemId:"other"}]},{...offer,items:[{...offer.items[0],soldBy:"WEIGHT"}]},{...offer,items:[{...offer.items[0],size:"1 lb / 2 pk"}]},{...offer,items:[{...offer.items[0],price:{regular:2.499}}]},{...offer,items:[{...offer.items[0],fulfillment:{instore:false}}]}])assert.equal(pickProduct([p],sku,review),null);
 assert.equal(pickProduct([offer],sku,{...review,sku_fingerprint:"stale"}),null);
});
test("immutable observation binds original mapping, cents, channel, location and source date",()=>{
 const row=recordOffer(offer,sku,review,{locationId:"fixture-location",store_id:"kroger",zip:"43215"},"2026-09-27T12:00:00Z");
 assert.equal(row.shelf_price,2.49);assert.equal(row.as_of,"2026-09-27");assert.ok(observationValid(row,sku));
 for(const mutate of [(r:typeof row)=>{r.as_of="2026-10-04";},(r:typeof row)=>{r.shelf_price=1;},(r:typeof row)=>{r.provenance.review.description="changed";},(r:typeof row)=>{r.region="33101";}]){const r=structuredClone(row);mutate(r);assert.ok(!observationValid(r,sku));}
 assert.equal(quarantinePrices([{...row,provenance:undefined as never}],SKUS).accepted.length,0);
 assert.throws(()=>recordOffer(offer,sku,{...review,reviewed_at:"2026-10-04"},{locationId:"fixture-location",store_id:"kroger",zip:"43215"},"2026-09-27"));
});
