import {test} from "node:test";
import assert from "node:assert/strict";
import {BASE} from "../../packages/solver/src/profiles.ts";
import {toCanonical} from "../../packages/solver/src/units.ts";
import {solveRestricted} from "./catalog-selection.ts";
import {pricingStage,reviewedRequirements,evaluatePricedWeek,weekSelectionRevision} from "./store-estimate-week.ts";
import {pantryBasis} from "./reviewed-pantry.ts";
import {fixtureModel,fixtureRequest,fixtureFacts,fixtureScope,fixtureCalibration,fixtureStores,sourceFor} from "./store-estimate-fixtures.ts";
import {decimalQuantity,multiply,ratio,type QuoteRequest,quoteBaskets} from "./store-estimates.ts";
import {scopeKey} from "./store-estimate-model.ts";
const stage=pricingStage(),input={...BASE,seed:0},out=solveRestricted(input,stage.purchased,[],stage.basket.safety),ids=out.days.flatMap(d=>d.items.map(i=>i.recipe_id));
const packSizes=Object.fromEntries(stage.edible.skus.map(s=>[s.id,multiply(decimalQuantity(s.pack_qty),decimalQuantity(toCanonical(1,s.pack_unit,s)))]));
function args(profile=input,owned:Parameters<typeof reviewedRequirements>[3]=[],allergies:string[]=[],edit?:(r:QuoteRequest)=>void):Parameters<typeof quoteBaskets>{
 const checked=reviewedRequirements(ids,profile,stage,owned,allergies),model=fixtureModel([...new Set(checked.requirements.map(r=>r.category))]),request=fixtureRequest(model,"alternatives",[fixtureStores[0].id],Math.round(profile.budget*100));
 request.selectionRevision=weekSelectionRevision(profile,stage,allergies);edit?.(request);
 const facts=fixtureFacts(checked.requirements,packSizes),cal=fixtureCalibration(model,fixtureScope(request,checked.requirements,request.storeIds[0]),Array(9).fill(3000),"week-test");
 request.calibrationPins=[{scopeDigest:scopeKey(cal.scope),digest:cal.digest}];
 return [request,checked.requirements,checked.pantry,fixtureStores,facts,sourceFor(facts,facts.map(f=>f.cell)),model,[cal]];
}
test("actual reviewed week keeps source nutrients/trim and rational purchased amounts through new packs",()=>{
 const a=args(),week=evaluatePricedWeek(ids,input,stage,[],[],a);assert(week.quotes.alternatives[0].feasible);assert.equal(week.recipeIds.length,15);
 const carrots=a[1].find(r=>r.skuId==="carrots")!,trim=week.consumption.find(r=>r.skuId==="carrots")!;assert(carrots);assert.equal(stage.basket.quantities.carrots.edible_per_purchased,.83);assert(trim.trim>0);
 assert(Math.abs(carrots.purchasedNeed.numerator/carrots.purchasedNeed.denominator-trim.physicalPrepared)<1e-8);
 const eggs=a[1].find(r=>r.skuId==="eggs")!;assert.equal(eggs.unit,"each");assert(a[4].filter(f=>f.skuId==="eggs").every(f=>f.packQuantity.numerator%f.packQuantity.denominator===0));
 assert.equal(week.days[0].protein_g,reviewedRequirements(ids,input,stage).food.days[0].protein_g);
});
test("partial reviewed pantry changes packs/carryover, never authored consumption, refuse or nutrients",()=>{
 const onion=stage.edible.skus.find(s=>s.id==="onions")!,owned=[{skuId:onion.id,fraction:.5,purchaseBasis:pantryBasis(onion)}];
 const zero=evaluatePricedWeek(ids,input,stage,[],[],args()),partial=evaluatePricedWeek(ids,input,stage,owned,[],args(input,owned));assert.deepEqual(zero.days,partial.days);
 const before=zero.consumption.find(r=>r.skuId===onion.id)!,after=partial.consumption.find(r=>r.skuId===onion.id)!;assert.equal(before.trim,after.trim);assert.equal(before.edibleConsumed,after.edibleConsumed);
 assert(partial.quotes.alternatives[0].lines.find(l=>l.skuId===onion.id)!.ownedUsed.numerator>0);
 assert.throws(()=>reviewedRequirements(ids,input,stage,[{...owned[0],purchaseBasis:"stale"}]));
 const household=reviewedRequirements(ids,{...input,household:2},stage);const original=reviewedRequirements(ids,input,stage);assert.deepEqual(household.requirements.map(r=>r.purchasedNeed),original.requirements.map(r=>multiply(r.purchasedNeed,ratio(2))));
});
test("profile edits must freeze/revalidate every rule; price pass is not protein feasibility",()=>{
 const edited={...input,protein_per_day:300};assert.throws(()=>evaluatePricedWeek(ids,edited,stage,[],[],args()),/selection/);
 const week=evaluatePricedWeek(ids,edited,stage,[],[],args(edited));assert.equal(week.quotes.alternatives[0].withinBudget,true);assert.equal(week.quotes.alternatives[0].feasible,false);assert(week.quotes.alternatives[0].failureKinds.includes("food"));
 assert.throws(()=>evaluatePricedWeek(ids,input,stage,[],[],args(input,[],[],r=>r.budgetCents++)),/budget/);
 const changed=args();changed[1][0].purchasedNeed=ratio(1);assert.throws(()=>evaluatePricedWeek(ids,input,stage,[],[],changed),/requirements/);
});
test("unapproved IDs, unknown safety, variant edits and missing/stale yield cannot become price-only successes",()=>{
 assert.throws(()=>reviewedRequirements(["not-approved",...ids.slice(1)],input,stage));
 const unknown=structuredClone(stage);unknown.basket.safety.onions.status="unreviewed";assert.throws(()=>reviewedRequirements(ids,input,unknown),/source|review/i);
 const variant=structuredClone(stage);variant.edible.recipe_ingredients[0].qty++;assert.throws(()=>reviewedRequirements(ids,input,variant),/catalog/);
 const missing=structuredClone(stage);delete missing.basket.quantities.carrots;assert.throws(()=>reviewedRequirements(ids,input,missing));
 const stale=structuredClone(stage);stale.basket.quantities.carrots.edible_per_purchased=1;assert.throws(()=>reviewedRequirements(ids,input,stale),/source|review/i);
 assert.throws(()=>reviewedRequirements(ids,input,stage,[],["soy"]));
 assert.throws(()=>reviewedRequirements(ids,{...input,pantry:["onions"]},stage),/infinite/);
});
