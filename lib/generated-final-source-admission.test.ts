import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {createRevisedCatalogReader} from "./generated-plan-catalog.ts";
import {FINAL_DERIVED_PIN,FINAL_FULL_PIN,isFinalDerivedRow} from "./generated-final-source-admission.ts";
import {sha256Hex} from "./generated-runtime-bytes.ts";
const root="C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/website-refresh-20261027/normal-ui-study/native-integration-20261030/backend-repair-round-v3/http-source-wave-v1/meal-final-review-repair-three/sources/";
test("actual full and practical readers admit1300IDs and all derived manufacturer rows",()=>{
 for(const [name,pin]of [["source-full-derived-v1.jsonl",FINAL_FULL_PIN],["source-practical-derived-v1.jsonl",FINAL_DERIVED_PIN]] as const){
  const source=readFileSync(root+name,"utf8"),loaded=createRevisedCatalogReader(pin)(source);assert.equal(loaded.outcome,"success",JSON.stringify(loaded));if(loaded.outcome!=="success")throw Error();assert.deepEqual(loaded.summary,{total:1300,main:1000,breakfast:300,conditionalNutrition:1300,heldNutrition:0});assert.equal(new Set(loaded.recipes.map(r=>r.id)).size,1300);assert.equal(loaded.recipes.filter(r=>Object.hasOwn(r.source,"derived_lineage")).length,368);
 }
});
test("wrong derived status,amount,state,authority and recomputed source digest refuse",()=>{
 const source=readFileSync(root+"source-practical-derived-v1.jsonl","utf8"),rows=source.trimEnd().split("\n").map(s=>JSON.parse(s)),index=rows.findIndex(r=>r.derived_lineage);
 for(const mutation of [(r:typeof rows[number])=>{r.nutrition.status="complete-conditional-USDA-input-estimate";},(r:typeof rows[number])=>{r.recipe.ingredients[0].quantity="999";},(r:typeof rows[number])=>{r.recipe.ingredients[0].state="foreign";},(r:typeof rows[number])=>{r.derived_lineage.authoritySha256="0".repeat(64);}]){
  const copy=structuredClone(rows);mutation(copy[index]);assert.equal(isFinalDerivedRow(copy[index]),false);const bytes=copy.map(r=>JSON.stringify(r)).join("\n")+"\n";assert.notEqual(createRevisedCatalogReader({sha256:sha256Hex(bytes),recordCount:1300})(bytes).outcome,"success");
 }
});

import {isFinalCountedBreadConsistent} from "./generated-final-source-admission.ts";
import {preparePurchaseRequirements} from "./generated-plan-quote.ts";
import {quoteRegionalEstimatesV3} from "./generated-regional-quote.ts";
test("all32 counted-bread rows reconcile source mass, allocations, original detail and nominal composition",()=>{
 const rows=readFileSync(root+"source-full-derived-v1.jsonl","utf8").trimEnd().split("\n").map(s=>JSON.parse(s));
 const breads=rows.filter(r=>r.recipe.ingredients.some((i:{id:string})=>["r3-bun","r3-croissant"].includes(i.id)));assert.equal(breads.length,32);
 for(const r of breads){const i=r.recipe.ingredients.find((i:{id:string})=>["r3-bun","r3-croissant"].includes(i.id)),mass=i.id==="r3-bun"?86:130;assert.equal(i.quantity,String(mass));assert.equal(isFinalCountedBreadConsistent(r),true);assert.equal(isFinalDerivedRow(r),true);const old=r.nutrition.ingredient_details.find((d:{ingredient:{id:string}})=>d.ingredient.id===i.id);assert.equal(old.ingredient.quantity,"120");assert.equal(r.recipe.servings,2);assert.equal(r.nutrition.derived_contributions.filter((d:{ingredientId:string})=>d.ingredientId===i.id).length,1);
  for(const mutate of [(v:typeof r)=>{v.recipe.ingredients.find((x:{id:string})=>x.id===i.id).quantity="120";},(v:typeof r)=>{v.recipe.steps.flatMap((s:{allocations:unknown[]})=>s.allocations).find((x:{id:string})=>x.id===i.id).quantity="120";},(v:typeof r)=>{v.recipe.steps.forEach((s:{instruction:string})=>s.instruction=s.instruction.replace(/The two (buns|croissants) use a nominal[^.]+\./g,"Use three pieces."));},(v:typeof r)=>{v.recipe.servings=1;}]){const copy=structuredClone(r);mutate(copy);assert.equal(isFinalCountedBreadConsistent(copy),false);assert.equal(isFinalDerivedRow(copy),false);}
 }
});
test("actual bridge and quote buy whole labelled piece packages across demand boundaries, never net-weight pseudo pieces",()=>{
 const c=JSON.parse(readFileSync(root+"../final-configuration.json","utf8"));
 for(const [iid,mass,pack]of [["r3-bun",43,8],["r3-croissant",65,4]]as const){const q=c.correspondences.find((q:{ingredientId:string})=>q.ingredientId===iid);
  for(const pieces of [1,2,3,4,7,8,9,16,17,32]){const demand=[{assignmentId:"count-domain",recipeId:"count-domain",recipeSha256:"c".repeat(64),ingredientId:iid,preparedState:q.preparedState,baseUnit:"g",amount:{numerator:String(mass*pieces),denominator:"1"}}];const prepared=preparePurchaseRequirements(demand,[q]);assert.equal(prepared.outcome,"prepared");if(prepared.outcome!=="prepared")throw Error();const quote=quoteRegionalEstimatesV3({region:"South",storeIds:[],budgetCents:15000,asOfDate:"2026-11-01"},prepared.requirements,[],[],c.referencePrices,c.rateReferences);assert.equal(quote.outcome,"quoted");if(quote.outcome!=="quoted")throw Error();const row=quote.rows[0]!;assert.notEqual(row.kind,"weight");if(row.kind==="weight")throw Error();assert.equal(row.unit,"each");assert.equal(row.packCount,Math.ceil(pieces/pack));assert.deepEqual(row.purchasedQuantity,{numerator:String(row.packCount*pack),denominator:"1"});assert.equal(row.estimatedLineCents.min,row.packCount*c.referencePrices.facts.find((f:{skuId:string})=>f.skuId===q.skuId).packPriceCents.min);}
 }
});
