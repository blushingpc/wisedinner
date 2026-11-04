import test from "node:test";
import assert from "node:assert/strict";
import { prepareReferencePurchaseRequirements, preparePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { presentGroceries } from "./generated-plan-presenter.ts";
import { setup } from "./generated-joined-plan.test-support.ts";

const amount=(n:number|string,d:number|string=1)=>({numerator:String(n),denominator:String(d)});
const proof="a".repeat(64),formDigest="b".repeat(64);
const reference={kind:"published-nominal-raw-preparation-yield-reference",preparedPerPurchased:amount(49,50),sourceSha256:proof,reviewEffectiveFrom:"2026-10-19"};
const correspondence={id:"synthetic-raw-yield",ingredientId:"food-a",preparedState:"raw, cleaned and sliced",consumedUnit:"g",skuId:"synthetic-whole-produce",purchaseState:"raw, whole",purchaseUnit:"g",formDigest,category:"produce",perishable:true,factor:{min:amount(50,49),max:amount(50,49)},sourceSha256:proof,nominalPreparationYieldReference:reference};
const demand={assignmentId:"p1",recipeId:"synthetic",recipeSha256:"c".repeat(64),ingredientId:"food-a",preparedState:"raw, cleaned and sliced",baseUnit:"g",amount:amount(98)};
const request={region:"South",storeIds:["synthetic-shop"],asOfDate:"2026-10-19",budgetCents:1000};
const stock=(n:number)=>({skuId:correspondence.skuId,unit:"g",formDigest,quantity:{numerator:n,denominator:1}});
function prepared(){const p=prepareReferencePurchaseRequirements([demand],[correspondence]);assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected published nominal raw preparation mapping");return p;}

test("published raw input yield uses exact inverse and retains typed provenance; legacy physical path refuses",()=>{
 const p=prepared();assert.deepEqual(p.requirements[0],{skuId:correspondence.skuId,category:"produce",unit:"g",formDigest,purchasedNeed:{numerator:100,denominator:1},perishable:true,nominalPreparationYieldReference:reference});
 assert.notEqual(preparePurchaseRequirements([demand],[correspondence]).outcome,"prepared");
});

test("fully owned raw stock retains uncertainty and review date without a fabricated price",()=>{
 const p=prepared(),q=quoteRegionalEstimates(request,p.requirements,[stock(150)],[]);
 assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected known raw stock quote");
 assert.deepEqual(q.rows[0]!.nominalPreparationYieldReference,reference);assert(q.rows[0]!.flags.includes("nominal-raw-preparation-yield-reference-not-product-measurement"));
 assert.deepEqual(q.rows[0]!.ownedUsed,amount(100));assert.deepEqual(q.rows[0]!.ownedRemaining,amount(50));assert.equal(q.uniqueBuyItemCount,0);assert.equal(q.factPins.length,0);
 assert.deepEqual(quoteRegionalEstimates({...request,asOfDate:"2026-10-18"},p.requirements,[stock(150)],[]),{outcome:"held",code:"quantity_reference_not_current"});
});

test("yield provenance rejects bad unit, factor, source, date and invalid or hidden ratios",()=>{
 const variants=[{...correspondence,purchaseUnit:"ml"},{...correspondence,consumedUnit:"ml"},{...correspondence,sourceSha256:"f".repeat(64)},{...correspondence,factor:{min:amount(1),max:amount(1)}},{...correspondence,factor:{min:amount(1),max:amount(50,49)}},...[amount(0),amount(101,100),amount(1,0)].map(value=>({...correspondence,nominalPreparationYieldReference:{...reference,preparedPerPurchased:value}})),{...correspondence,nominalPreparationYieldReference:{...reference,reviewEffectiveFrom:"2026-02-30"}},{...correspondence,nominalPreparationYieldReference:{...reference,cooked:true}}];
 for(const c of variants)assert.equal(prepareReferencePurchaseRequirements([demand],[c]).outcome,"error");
 let calls=0;const ref={...reference};Object.defineProperty(ref,"preparedPerPurchased",{enumerable:true,get(){calls++;return amount(49,50);}});
 assert.equal(prepareReferencePurchaseRequirements([demand],[{...correspondence,nominalPreparationYieldReference:ref}]).outcome,"error");assert.equal(calls,0);
});

test("one purchase cannot merge conflicting yield evidence or erase a declared preparation model",()=>{
 const second={...correspondence,id:"second",ingredientId:"food-b",sourceSha256:"d".repeat(64),nominalPreparationYieldReference:{...reference,sourceSha256:"d".repeat(64)}},ds=[demand,{...demand,assignmentId:"p2",ingredientId:"food-b"}];
 assert.deepEqual(prepareReferencePurchaseRequirements(ds,[correspondence,second]),{outcome:"error",code:"incompatible_purchase_correspondence"});
 const{nominalPreparationYieldReference,...unmarked}=second;void nominalPreparationYieldReference;assert.equal(prepareReferencePurchaseRequirements(ds,[correspondence,unmarked]).outcome,"error");
});

test("density and raw preparation references cannot be combined into one ambiguous conversion",()=>{
 const c={...correspondence,nominalDensityReference:{kind:"published-nominal-liquid-density-reference",densityGPerMl:amount(49,50),sourceSha256:proof,reviewEffectiveFrom:"2026-10-19"}};
 assert.equal(prepareReferencePurchaseRequirements([demand],[c]).outcome,"error");
});

test("customer grocery warning discloses nominal raw preparation without individual prices",()=>{
 const f=setup(),result=f.planner.evaluateJoined(f.assignments,f.request);assert.equal(result.outcome,"success");if(result.outcome!=="success")throw Error("Expected synthetic fixture");
 const changed={...result,quote:{...result.quote,rows:result.quote.rows.map((row,index)=>index?row:{...row,flags:[...row.flags,"nominal-raw-preparation-yield-reference-not-product-measurement"]})}};
 const view=presentGroceries(changed,[{skuId:"buy-a",displayName:"Fixture A",aisle:"Produce"},{skuId:"buy-b",displayName:"Fixture B",aisle:"Pantry"}]);assert.equal(view.outcome,"groceries");if(view.outcome!=="groceries")throw Error("Expected groceries");assert(view.warnings.includes("uses-nominal-raw-preparation-yield-reference"));assert(!JSON.stringify(view).includes("estimatedLineCents"));
});

test("nominal raw-yield purchase stock and packs match a bounded independent exact oracle",()=>{
 const gcd=(a:bigint,b:bigint):bigint=>b?gcd(b,a%b):a,exact=(n:bigint,d=BigInt(1))=>{const g=gcd(n,d);return amount(String(n/g),String(d/g));};let cases=0;
 for(const[n,d]of[[BigInt(1),BigInt(2)],[BigInt(4),BigInt(5)],[BigInt(49),BigInt(50)],[BigInt(1),BigInt(1)]])for(const input of[1,49,98,101,300])for(const owned of[0,1,50,500]){
  const c={...correspondence,factor:{min:exact(d,n),max:exact(d,n)},nominalPreparationYieldReference:{...reference,preparedPerPurchased:exact(n,d)}},p=prepareReferencePurchaseRequirements([{...demand,amount:amount(input)}],[c]);assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected exact raw preparation");
  const fact={id:"synthetic-pack",skuId:c.skuId,unit:"g",formDigest,region:"South",packQuantity:amount(100),packPriceCents:{min:200,max:201},currency:"USD",observedOn:"2026-10-19",usableThrough:"2026-10-19",sourceSha256:"f".repeat(64),basis:"synthetic-test-only",flags:["synthetic-only"]};
  const q=quoteRegionalEstimates(request,p.requirements,[stock(owned)],[fact]);assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected exact pack quote");
  const needN=BigInt(input)*d,needD=n,usedN=BigInt(owned)*needD<needN?BigInt(owned)*needD:needN,netN=needN-usedN,count=(netN+needD*BigInt(100)-BigInt(1))/(needD*BigInt(100));
  assert.deepEqual(q.rows[0]!.needed,exact(needN,needD));assert.deepEqual(q.rows[0]!.ownedUsed,exact(usedN,needD));assert.deepEqual(q.rows[0]!.ownedRemaining,exact(BigInt(owned)*needD-usedN,needD));assert.deepEqual(q.rows[0]!.purchasedLeftover,exact(count*BigInt(100)*needD-netN,needD));assert.equal(q.rows[0]!.packCount,Number(count));assert.deepEqual(q.estimatedTotalCents,{min:Number(count)*200,max:Number(count)*201});assert(q.rows[0]!.flags.includes("nominal-raw-preparation-yield-reference-not-product-measurement"));cases++;
 }
 assert.equal(cases,80);
});
