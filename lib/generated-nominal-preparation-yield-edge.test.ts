import test from "node:test";
import assert from "node:assert/strict";
import { rawYieldFixture, amount } from "./generated-nominal-preparation-yield.test-support.ts";
import { readNominalPreparationYieldReference, nominalPreparationYieldFactor } from "./generated-nominal-preparation-yield.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates, REFERENCE_PRICE_FALLBACK_POLICY } from "./generated-regional-quote.ts";

const reference={kind:"published-nominal-raw-preparation-yield-reference",preparedPerPurchased:amount(49,50),sourceSha256:"a".repeat(64),reviewEffectiveFrom:"2026-10-19"};
test("raw reference strict parser normalizes and freezes its own copy without invoking getters",()=>{
 const input={...reference,preparedPerPurchased:amount(98,100)},r=readNominalPreparationYieldReference(input);input.preparedPerPurchased.numerator="1";assert.deepEqual(r.preparedPerPurchased,amount(49,50));assert(Object.isFrozen(r));assert(Object.isFrozen(r.preparedPerPurchased));assert.deepEqual(nominalPreparationYieldFactor(r),{n:BigInt(50),d:BigInt(49)});
 const variants:unknown[]=[{...reference,preparedPerPurchased:amount("1".repeat(121),1)},{...reference,preparedPerPurchased:{numerator:"01",denominator:"2"}},{...reference,preparedPerPurchased:{numerator:"1",denominator:"-2"}},{...reference,kind:"cooked-yield"},{...reference,sourceSha256:"not-a-proof"},{...reference,reviewEffectiveFrom:"2026-13-01"}];
 const symbol={...reference};Object.assign(symbol,{[Symbol("hidden")]:true});variants.push(symbol);let calls=0;const accessor={...reference};Object.defineProperty(accessor,"sourceSha256",{enumerable:true,get(){calls++;return"a".repeat(64);}});variants.push(accessor);const hidden={...reference};Object.defineProperty(hidden,"sourceSha256",{enumerable:false,value:"a".repeat(64)});variants.push(hidden);for(const v of variants)assert.throws(()=>readNominalPreparationYieldReference(v));assert.equal(calls,0);
});

test("valid extremely small nominal yield holds at existing numeric quote capacity instead of rounding",()=>{
 const factor=amount("1"+"0".repeat(119)),ref={...reference,preparedPerPurchased:amount(1,"1"+"0".repeat(119))},c={id:"tiny-yield",ingredientId:"x",preparedState:"raw sliced",consumedUnit:"g",skuId:"raw",purchaseState:"raw whole",purchaseUnit:"g",formDigest:"b".repeat(64),category:"produce",perishable:true,factor:{min:factor,max:factor},sourceSha256:reference.sourceSha256,nominalPreparationYieldReference:ref},d={assignmentId:"a",recipeId:"r",recipeSha256:"c".repeat(64),ingredientId:"x",preparedState:"raw sliced",baseUnit:"g",amount:amount(1)};
 assert.deepEqual(prepareReferencePurchaseRequirements([d],[c]),{outcome:"held",code:"quote_quantity_capacity_exceeded"});
});

test("raw estimate disclosure survives an explicitly configured nonregional price reference",()=>{
 const f=rawYieldFixture(),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected synthetic source");const p=r.quantityForFamily({familyId:"family-0"});assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected raw preparation");const c=p.correspondences[0]!,prepared=prepareReferencePurchaseRequirements([{assignmentId:"a",recipeId:"a",recipeSha256:f.rows[0]!.recipe_sha256,ingredientId:c.ingredientId,preparedState:c.preparedState,baseUnit:"g",amount:amount(98)}],p.correspondences);assert.equal(prepared.outcome,"prepared");if(prepared.outcome!=="prepared")throw Error("Expected demand");
 const fact={id:"synthetic-manufacturer-only",skuId:c.skuId,unit:"g",formDigest:c.formDigest,packQuantity:amount(100),packPriceCents:{min:200,max:200},currency:"USD",sourceSha256:"f".repeat(64),sourceUrl:"https://example.invalid/synthetic-only",kind:"manufacturer-reference",sourceBasis:{geography:"manufacturer-reference-not-regional",manufacturer:"synthetic",capturedOn:"2026-10-19",observedOn:null,publishedOn:null},reviewEffectiveFrom:"2026-10-19",usableThrough:"2026-10-19",flags:["synthetic-only"]};
 const q=quoteRegionalEstimates({region:"South",storeIds:["synthetic"],budgetCents:500,asOfDate:"2026-10-19"},prepared.requirements,[],[],{policy:REFERENCE_PRICE_FALLBACK_POLICY,facts:[fact]});assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected reference quote");assert.equal(q.scope,"mixed-geography-reference-typical-whole-pack-ingredient-estimate");assert(q.rows[0]!.nominalPreparationYieldReference);assert(q.rows[0]!.flags.includes("nominal-raw-preparation-yield-reference-not-product-measurement"));assert(q.rows[0]!.flags.includes("reference-not-regional-average"));assert.equal(q.adoptionGranted,false);assert.equal(q.liveRetailerPricing,false);
 const wrong={...prepared.requirements[0]!,unit:"ml"};assert.equal(quoteRegionalEstimates({region:"South",storeIds:["synthetic"],budgetCents:500,asOfDate:"2026-10-19"},[wrong],[],[]).outcome,"error");
});

test("raw package and yield review dates remain attached without prices, and synthetic yield cannot promote price basis",()=>{
 for(const source of["package","yield"]){const f=rawYieldFixture();f.manifest.families[0]!.priceReviews=[];if(source==="package")f.packages[0]!.reviewedOn="2026-10-20";else f.yields[0]!.reviewedOn="2026-10-20";const r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected future source");const p=r.quantityForFamily({familyId:"family-0"});assert.equal(p.outcome,"prepared");if(p.outcome==="prepared")assert.equal(p.correspondences[0]!.nominalPreparationYieldReference!.reviewEffectiveFrom,"2026-10-20");}
 const f=rawYieldFixture();f.packages.forEach(p=>{p.evidenceLevel="primary-source-web-extract";});f.category.evidenceLevel="primary-source-web-extract";const r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected synthetic yield");const p=r.forPlanning({familyId:"family-0",region:"South",asOfDate:"2026-10-19"});assert.equal(p.outcome,"prepared");if(p.outcome==="prepared")assert.equal(p.regionalPackFacts[0]!.basis,"synthetic-test-only");
});

test("raw source warning capacity refuses excess rather than truncating upstream limitations",()=>{
 const f=rawYieldFixture(),m=JSON.parse(f.sources.matches.toString());m.matches["a".repeat(64)].flags=Array.from({length:49},(_,i)=>"source-warning-"+i);f.sources.matches=Buffer.from(JSON.stringify(m));assert.equal(f.bind().outcome,"error");
});
