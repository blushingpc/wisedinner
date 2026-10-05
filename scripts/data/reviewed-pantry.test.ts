import assert from "node:assert/strict";
import {test} from "node:test";
import {overnightApproval,overnightBasket,overnightCandidates} from "./overnight-food.ts";
import {stageReviewed,digest} from "./reviewed-week.ts";
import {solveRestricted} from "./catalog-selection.ts";
import {BASE} from "../../packages/solver/src/profiles.ts";
import {evaluateReviewedPantry,pantryBasis,purchaseBalance} from "./reviewed-pantry.ts";
test("physical fractional pantry subtracts before rounding, never infinite free stock",()=>{
 assert.deepEqual(purchaseBalance(2.2,.5),{requiredPacks:2.2,ownedPacks:.5,ownedUsedPacks:.5,buyPacks:2,ownedCarryoverPacks:0,newCarryoverPacks:.2999999999999998});
 assert.equal(purchaseBalance(2.2,1).buyPacks,2);assert.equal(purchaseBalance(2.2,3).buyPacks,0);assert.equal(purchaseBalance(1.5,.5).buyPacks,1);
 for(const n of [-1,NaN,Infinity,101])assert.throws(()=>purchaseBalance(1,n));
});
test("actual reviewed solve and evaluation preserve nutrients, trim, cents and household physical quantities",()=>{
 const stage=stageReviewed(overnightApproval(),overnightBasket(),overnightCandidates()),input={...BASE,seed:7},out=solveRestricted(input,stage.purchased,[],stage.basket.safety),ids=out.days.flatMap(d=>d.items.map(i=>i.recipe_id));
 const base=evaluateReviewedPantry(ids,input,stage,[]),oats=stage.edible.skus.find(s=>s.id==="oats")!,owned=[{skuId:oats.id,fraction:.1,purchaseBasis:pantryBasis(oats)}];
 assert.equal(base.totalCents,Math.round(out.est_total*100));assert.equal(base.feasible,true);
 const partial=evaluateReviewedPantry(ids,input,stage,owned);assert.deepEqual(partial.days,base.days);assert.ok(partial.totalCents<=base.totalCents);assert.ok(partial.rows.find(r=>r.skuId==="oats")!.buyPacks>0,"one tenth of a pack does not cover the whole week");
 assert.equal(digest(partial),digest(evaluateReviewedPantry(ids,input,stage,owned)));
 const doubled=evaluateReviewedPantry(ids,{...input,household:2,budget:120},stage,owned);assert.equal(doubled.rows.find(r=>r.skuId==="oats")!.requiredPacks,2*partial.rows.find(r=>r.skuId==="oats")!.requiredPacks);assert.deepEqual(doubled.days,partial.days);
 for(const row of partial.rows)assert.ok(Math.abs(row.physicalPrepared-row.edibleConsumed-row.trim)<1e-9);
 assert.throws(()=>evaluateReviewedPantry(ids,{...input,pantry:["oats"]},stage,owned));assert.throws(()=>evaluateReviewedPantry(ids,input,stage,[{...owned[0],purchaseBasis:"stale"}]));assert.throws(()=>evaluateReviewedPantry(ids,input,stage,[owned[0],owned[0]]));
 assert.throws(()=>evaluateReviewedPantry(ids,input,stage,owned,["soy"]));const stale=structuredClone(stage);stale.basket.quantities.carrots.edible_per_purchased=1;assert.throws(()=>evaluateReviewedPantry(ids,input,stale,owned));
});
