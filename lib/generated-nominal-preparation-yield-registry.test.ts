import test from "node:test";
import assert from "node:assert/strict";
import { rawYieldFixture, amount } from "./generated-nominal-preparation-yield.test-support.ts";
import { densityFixture } from "./generated-nominal-density.test-support.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";

test("v4 raw preparation claim is explicit and cannot enter v1/v2/v3 or waive source holds",()=>{
 const f=rawYieldFixture(),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected raw reference");
 const q=r.quantityForFamily({familyId:"family-0"});assert.equal(q.outcome,"prepared");if(q.outcome!=="prepared")throw Error("Expected quantity");
 assert.deepEqual(q.correspondences[0]!.factor,{min:amount(50,49),max:amount(50,49)});assert.equal(q.correspondences[0]!.nominalPreparationYieldReference!.kind,"published-nominal-raw-preparation-yield-reference");assert(q.sourceFlags.includes("nominal-raw-preparation-yield-reference-not-product-measurement"));
 for(const schema of["wd-reviewed-public-pack-manifest-v1","wd-reviewed-public-pack-manifest-v2","wd-reviewed-public-pack-manifest-v3"]){f.manifest.schema=schema;assert.equal(f.bind().outcome,"error");}
 const held=rawYieldFixture(),m=JSON.parse(held.sources.matches.toString());m.matches["a".repeat(64)].holds=["missing-source-review"];held.sources.matches=Buffer.from(JSON.stringify(m));assert.equal(held.bind().outcome,"error");
});

test("v4 preserves existing v3 density quantities and price views byte for byte",()=>{
 const f=densityFixture(true),prior=f.bind();assert.equal(prior.outcome,"ready");if(prior.outcome!=="ready")throw Error("Expected v3");const before=prior.forFamilies({familyIds:["family-0","family-1"],region:"South",asOfDate:"2026-10-19"});f.manifest.schema="wd-reviewed-public-pack-manifest-v4";const current=f.bind();assert.equal(current.outcome,"ready");if(current.outcome!=="ready")throw Error("Expected backwards compatible v4");assert.deepEqual(current.forFamilies({familyIds:["family-1","family-0"],region:"South",asOfDate:"2026-10-19"}),before);
});

test("explicit raw preparation group combines one raw purchase and one pantry deduction",()=>{
 const f=rawYieldFixture(true),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected raw group");const p=r.forFamilies({familyIds:["family-1","family-0"],region:"South",asOfDate:"2026-10-19"});assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected source facts");
 assert.equal(p.correspondences.length,2);assert.equal(p.pantryPurchaseBindings.length,1);assert.equal(p.regionalPackFacts.length,1);assert.equal(p.regionalPackFacts[0]!.basis,"synthetic-test-only");assert(!p.regionalPackFacts[0]!.flags.some(x=>x.includes("Large-egg")));
 const demands=f.rows.map((row,i)=>({assignmentId:"person-"+i,recipeId:row.id,recipeSha256:row.recipe_sha256,ingredientId:"food-"+(i?"b":"a"),preparedState:row.recipe.ingredients[0]!.state,baseUnit:"g",amount:amount(49)})),prepared=prepareReferencePurchaseRequirements(demands,p.correspondences);assert.equal(prepared.outcome,"prepared");if(prepared.outcome!=="prepared")throw Error("Expected one raw need");assert.equal(prepared.requirements.length,1);assert.deepEqual(prepared.requirements[0]!.purchasedNeed,{numerator:100,denominator:1});
 const c=p.correspondences[0]!,q=quoteRegionalEstimates({region:"South",storeIds:["synthetic"],asOfDate:"2026-10-19",budgetCents:100},prepared.requirements,[{skuId:c.skuId,unit:"g",formDigest:c.formDigest,quantity:{numerator:60,denominator:1}}],p.regionalPackFacts);assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected exact raw basket");assert.deepEqual(q.rows[0]!.ownedUsed,amount(60));assert.deepEqual(q.rows[0]!.toBuy,amount(40));assert.deepEqual(q.rows[0]!.purchasedLeftover,amount(60));assert.equal(q.uniqueBuyItemCount,1);assert.equal(q.rows[0]!.packCount,1);
});

test("raw reference requires matching rows, raw preparation kind, purchase state and dimensions",()=>{
 const changes:((f:ReturnType<typeof rawYieldFixture>)=>void)[]=[f=>{f.yields[0]!.measurementKind="cooked-mass-fraction";},f=>{f.yields[0]!.unit="ml/g";},f=>{f.yields[0]!.preparation="cooked-sliced";},f=>{f.yields[0]!.purchaseState="cooked";},f=>{f.yields[0]!.scope="measured-brand";},f=>{f.yields[0]!.recordRows[0]!.fdcId=11;},f=>{f.yields[0]!.recordRows[0]!.foodRowSha256="f".repeat(64);},f=>{f.yields[0]!.preparedPerPurchased=amount(101,100);},f=>{f.manifest.families[0]!.purchase.unit="ml";},f=>{f.yields[0]!.sourceUrl="https://example.invalid/data?private=not-admitted";}];
 for(const change of changes){const f=rawYieldFixture();change(f);assert.equal(f.bind().outcome,"error");}
});

test("raw yield groups cannot hide a different cut, point, provenance or old no-transition scope",()=>{
 const changes:((f:ReturnType<typeof rawYieldFixture>)=>void)[]=[f=>{f.yields[1]!.preparation="raw-diced";},f=>{f.yields[1]!.preparedPerPurchased=amount(97,100);},f=>{f.yields[1]!.sourceSha256="e".repeat(64);},f=>{f.yields[1]!.sourceEdition="other-edition";},f=>{f.manifest.purchaseGroups[0]!.scope="same-food-input-grams-no-physical-transition";}];
 for(const change of changes){const f=rawYieldFixture(true);change(f);assert.equal(f.bind().outcome,"error");}
});

test("raw quantity review dates, source changes, constructor mutation and price separation stay bound",()=>{
 const f=rawYieldFixture(true);f.manifest.families[0]!.priceReviews=[];f.manifest.purchaseGroups[0]!.reviewedOn="2026-10-20";const r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected future quantity review");const q=r.quantityForFamilies({familyIds:["family-0","family-1"]});assert.equal(q.outcome,"prepared");if(q.outcome!=="prepared")throw Error("Expected future mapping");assert.equal(q.correspondences[0]!.nominalPreparationYieldReference!.reviewEffectiveFrom,"2026-10-20");const before=q;f.yields[0]!.preparedPerPurchased=amount(1);f.sources.catalog.fill(0);assert.deepEqual(r.quantityForFamilies({familyIds:["family-1","family-0"]}),before);
 const fresh=rawYieldFixture(true),a=fresh.bind();assert.equal(a.outcome,"ready");if(a.outcome!=="ready")throw Error("Expected quantity");const original=a.quantityForFamilies({familyIds:["family-0","family-1"]});fresh.manifest.families[0]!.priceReviews=[];const noPrice=fresh.bind();assert.equal(noPrice.outcome,"ready");if(noPrice.outcome!=="ready")throw Error("Expected unpriced");assert.deepEqual(noPrice.quantityForFamilies({familyIds:["family-1","family-0"]}),original);fresh.yields.forEach(y=>{y.sourceSha256="e".repeat(64);});const changed=fresh.bind();assert.equal(changed.outcome,"ready");if(changed.outcome!=="ready")throw Error("Expected changed source");assert.notDeepEqual(changed.quantityForFamilies({familyIds:["family-0","family-1"]}),original);
});
