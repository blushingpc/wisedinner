import test from "node:test";
import assert from "node:assert/strict";
import { densityFixture, amount } from "./generated-nominal-density.test-support.ts";
import { prepareReferencePurchaseRequirements, preparePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { presentGroceries } from "./generated-plan-presenter.ts";
import { setup } from "./generated-joined-plan.test-support.ts";

// Original sources are never edited; all following rows and public points are synthetic.

const proof="a".repeat(64),density={kind:"published-nominal-liquid-density-reference",densityGPerMl:amount(9,10),sourceSha256:proof,reviewEffectiveFrom:"2026-10-19"};
const correspondence={id:"synthetic-density",ingredientId:"food-a",preparedState:"liquid",consumedUnit:"g",skuId:"liquid-a",purchaseState:"liquid",purchaseUnit:"ml",formDigest:"b".repeat(64),category:"pantry",perishable:false,factor:{min:amount(10,9),max:amount(10,9)},sourceSha256:proof,nominalDensityReference:density};
const demand={assignmentId:"p1",recipeId:"synthetic",recipeSha256:"c".repeat(64),ingredientId:"food-a",preparedState:"liquid",baseUnit:"g",amount:amount(90)};
const request={region:"South",storeIds:["synthetic-store"],asOfDate:"2026-10-19",budgetCents:1000};

test("v3 explicitly binds nominal mass density while old manifest versions cannot admit this claim",()=>{
 const f=densityFixture(),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected reviewed nominal source");
 const q=r.quantityForFamily({familyId:"family-0"});assert.equal(q.outcome,"prepared");if(q.outcome!=="prepared")throw Error("Expected nominal mapping");
 assert.deepEqual(q.correspondences[0]!.factor,{min:amount(10,9),max:amount(10,9)});assert(q.sourceFlags.includes("nominal-liquid-density-reference-not-product-measurement"));
 for(const schema of["wd-reviewed-public-pack-manifest-v1","wd-reviewed-public-pack-manifest-v2"]){f.manifest.schema=schema;assert.equal(f.bind().outcome,"error");}
});

test("reference preparation retains factor-bound quantity-model provenance while legacy physical preparation refuses",()=>{
 const p=prepareReferencePurchaseRequirements([demand],[correspondence]);assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected nominal conversion");
 assert.deepEqual(p.requirements[0],{skuId:"liquid-a",category:"pantry",unit:"ml",formDigest:"b".repeat(64),purchasedNeed:{numerator:100,denominator:1},perishable:false,nominalDensityReference:density});
 assert.notEqual(preparePurchaseRequirements([demand],[correspondence]).outcome,"prepared");
});

test("a fully owned nominal-volume row keeps uncertainty without inventing a price fact",()=>{
 const requirement={skuId:"liquid-a",category:"pantry",unit:"ml",formDigest:"b".repeat(64),perishable:false,purchasedNeed:{numerator:100,denominator:1},nominalDensityReference:density};
 const q=quoteRegionalEstimates(request,[requirement],[{skuId:"liquid-a",unit:"ml",formDigest:"b".repeat(64),quantity:{numerator:100,denominator:1}}],[]);assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected owned nominal input");
 assert.deepEqual(q.estimatedTotalCents,{min:0,max:0});assert.equal(q.factPins.length,0);assert.equal(q.uniqueBuyItemCount,0);assert.deepEqual(q.rows[0]!.nominalDensityReference,density);assert(q.rows[0]!.flags.includes("nominal-liquid-density-reference-not-product-measurement"));
});

test("customer groceries show selected nominal-density warning without raw source or individual prices",()=>{
 const f=setup(),result=f.planner.evaluateJoined(f.assignments,f.request);assert.equal(result.outcome,"success");if(result.outcome!=="success")throw Error("Expected fixture");
 const changed={...result,quote:{...result.quote,rows:result.quote.rows.map((row,index)=>index?row:{...row,flags:[...row.flags,"nominal-liquid-density-reference-not-product-measurement"]})}};
 const view=presentGroceries(changed,[{skuId:"buy-a",displayName:"Fixture A",aisle:"Pantry"},{skuId:"buy-b",displayName:"Fixture B",aisle:"Pantry"}]);assert.equal(view.outcome,"groceries");if(view.outcome==="groceries")assert(view.warnings.includes("uses-nominal-liquid-density-reference"));
});

test("a nominal quantity review cannot become available early merely because pantry covers the cost",()=>{
 const f=densityFixture();f.densities[0]!.reviewedOn="2026-10-20";f.manifest.families[0]!.priceReviews=[];
 const r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected quantity-only review");const mapping=r.quantityForFamily({familyId:"family-0"});assert.equal(mapping.outcome,"prepared");if(mapping.outcome!=="prepared")throw Error("Expected quantity-only mapping");
 const p=prepareReferencePurchaseRequirements([demand],mapping.correspondences);assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected nominal requirement");const c=mapping.correspondences[0]!;
 const q=quoteRegionalEstimates(request,p.requirements,[{skuId:c.skuId,unit:"ml",formDigest:c.formDigest,quantity:{numerator:100,denominator:1}}],[]);
 assert.deepEqual(q,{outcome:"held",code:"quantity_reference_not_current"});
 assert.equal(c.nominalDensityReference!.reviewEffectiveFrom,"2026-10-20");
});

test("density evidence must describe pinned mass-density inputs, never dimensionless or cooked proxies",()=>{
 const mutations:((f:ReturnType<typeof densityFixture>)=>void)[]=[
 f=>{f.densities[0]!.measurementKind="specific-gravity";},f=>{f.densities[0]!.measurementKind="bulk-density";},f=>{f.densities[0]!.unit="ml/g";},f=>{f.densities[0]!.densityGPerMl=amount(0);},f=>{f.densities[0]!.recordRows[0]!.fdcId=11;},f=>{f.densities[0]!.recordRows[0]!.foodRowSha256="9".repeat(64);},f=>{f.densities[0]!.ingredientSignature="9".repeat(64);},f=>{f.manifest.families[0]!.purchase.state="cooked";},f=>{f.densities[0]!.sourceUrl="https://example.invalid/source?private=not-admitted";},f=>{Object.assign(f.densities[0]!,{temperatureC:20});},f=>{f.densities[0]!.scope="measured-current-product";}];
 for(const mutate of mutations){const f=densityFixture();mutate(f);assert.equal(f.bind().outcome,"error");}
});

test("quantity provenance rejects wrong dimensions reciprocal intervals source pins dates and hidden getters",()=>{
 const variants=[{...correspondence,factor:{min:amount(1),max:amount(1)}},{...correspondence,sourceSha256:"e".repeat(64)},{...correspondence,consumedUnit:"ml"},{...correspondence,purchaseUnit:"g"},{...correspondence,factor:{min:amount(1),max:amount(10,9)}},{...correspondence,nominalDensityReference:{...density,reviewEffectiveFrom:"2026-02-30"}},{...correspondence,nominalDensityReference:{...density,densityGPerMl:amount(0)}}];
 for(const value of variants)assert.equal(prepareReferencePurchaseRequirements([demand],[value]).outcome,"error");
 let calls=0;const hidden={...density};Object.defineProperty(hidden,"densityGPerMl",{enumerable:true,get(){calls++;return amount(9,10);}});assert.equal(prepareReferencePurchaseRequirements([demand],[{...correspondence,nominalDensityReference:hidden}]).outcome,"error");assert.equal(calls,0);
 const badRequirement={skuId:"liquid-a",category:"pantry",unit:"g",formDigest:"b".repeat(64),perishable:false,purchasedNeed:{numerator:100,denominator:1},nominalDensityReference:density};assert.equal(quoteRegionalEstimates(request,[badRequirement],[],[]).outcome,"error");
});

test("reviewed density aliases retain one physical volume item and one source-bound owned binding",()=>{
 const f=densityFixture(true),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected reviewed liquid group");const p=r.forFamilies({familyIds:["family-1","family-0"],region:"South",asOfDate:"2026-10-19"});assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected group facts");
 assert.equal(p.correspondences.length,2);assert.equal(p.pantryPurchaseBindings.length,1);assert.equal(p.regionalPackFacts.length,1);assert(p.sourceFlags.includes("synthetic-warning-0"));assert(p.sourceFlags.includes("synthetic-warning-1"));assert(p.sourceFlags.includes("nominal-liquid-density-reference-not-product-measurement"));
 const ds=[demand,{...demand,assignmentId:"p2",ingredientId:"food-b",preparedState:"ready-to-use"}],prepared=prepareReferencePurchaseRequirements(ds,p.correspondences);assert.equal(prepared.outcome,"prepared");if(prepared.outcome!=="prepared")throw Error("Expected one physical need");assert.equal(prepared.requirements.length,1);assert.deepEqual(prepared.requirements[0]!.purchasedNeed,{numerator:200,denominator:1});
 const c=p.correspondences[0]!,q=quoteRegionalEstimates(request,prepared.requirements,[{skuId:c.skuId,unit:"ml",formDigest:c.formDigest,quantity:{numerator:100,denominator:1}}],p.regionalPackFacts);assert.equal(q.outcome,"quoted");if(q.outcome==="quoted"){assert.equal(q.uniqueBuyItemCount,1);assert.deepEqual(q.rows[0]!.ownedUsed,amount(100));assert.deepEqual(q.rows[0]!.toBuy,amount(100));assert.deepEqual(q.rows[0]!.purchasedLeftover,amount(400));assert.equal(q.rows[0]!.packCount,1);}
});

test("density groups refuse contradictory points provenance editions or unreviewed physical input changes",()=>{
 for(const change of[(f:ReturnType<typeof densityFixture>)=>{f.densities[1]!.densityGPerMl=amount(1);},(f:ReturnType<typeof densityFixture>)=>{f.densities[1]!.sourceSha256="e".repeat(64);},(f:ReturnType<typeof densityFixture>)=>{f.densities[1]!.sourceEdition="different-source-edition";},(f:ReturnType<typeof densityFixture>)=>{f.densities[1]!.temperatureC="20";},(f:ReturnType<typeof densityFixture>)=>{f.manifest.families[1]!.purchase.unit="g";},(f:ReturnType<typeof densityFixture>)=>{f.manifest.purchaseGroups[0]!.scope="cooked-yield";}]){const f=densityFixture(true);change(f);assert.equal(f.bind().outcome,"error");}
});

test("same purchase identity cannot combine incompatible quantity models or strip a declared model",()=>{
 const second={...correspondence,id:"second",ingredientId:"food-b",sourceSha256:"d".repeat(64),nominalDensityReference:{...density,sourceSha256:"d".repeat(64)}},ds=[demand,{...demand,assignmentId:"p2",ingredientId:"food-b"}];
 assert.deepEqual(prepareReferencePurchaseRequirements(ds,[correspondence,second]),{outcome:"error",code:"incompatible_purchase_correspondence"});
 const {nominalDensityReference,...unmarked}=second;void nominalDensityReference;assert.equal(prepareReferencePurchaseRequirements(ds,[correspondence,unmarked]).outcome,"error");
});

test("synthetic density review cannot promote real-looking package and category evidence to a real price",()=>{
 const f=densityFixture();f.packages.forEach(p=>{p.evidenceLevel="primary-source-web-extract";});f.category.evidenceLevel="primary-source-web-extract";const r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected synthetic source");const q=r.forPlanning({familyId:"family-0",region:"South",asOfDate:"2026-10-19"});assert.equal(q.outcome,"prepared");if(q.outcome==="prepared")assert.equal(q.regionalPackFacts[0]!.basis,"synthetic-test-only");
});

test("density source warnings and holds cannot be erased or truncated by the new conversion",()=>{
 for(const mode of["hold","capacity"]){const f=densityFixture(),m=JSON.parse(f.sources.matches.toString());if(mode==="hold")m.matches["a".repeat(64)].holds=["unresolved-source"];else m.matches["a".repeat(64)].flags=Array.from({length:49},(_,i)=>"distinct-warning-"+i);f.sources.matches=Buffer.from(JSON.stringify(m));assert.equal(f.bind().outcome,"error");}
});

test("quantity proof is independent of prices, but density source changes require reconciliation",()=>{
 const f=densityFixture(true),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected original");const original=r.quantityForFamilies({familyIds:["family-0","family-1"]});f.manifest.families[0]!.priceReviews=[];const unpriced=f.bind();assert.equal(unpriced.outcome,"ready");if(unpriced.outcome!=="ready")throw Error("Expected unpriced quantity");assert.deepEqual(unpriced.quantityForFamilies({familyIds:["family-1","family-0"]}),original);
 f.densities.forEach(d=>{d.sourceSha256="f".repeat(64);});const changed=f.bind();assert.equal(changed.outcome,"ready");if(changed.outcome!=="ready")throw Error("Expected newly pinned review");assert.notDeepEqual(changed.quantityForFamilies({familyIds:["family-0","family-1"]}),original);
});

test("group review availability and package review availability remain bound even with no prices",()=>{
 for(const grouped of[false,true]){const f=densityFixture(grouped);f.manifest.families[0]!.priceReviews=[];if(grouped)f.manifest.purchaseGroups[0]!.reviewedOn="2026-10-20";else f.packages[0]!.reviewedOn="2026-10-20";const r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected future quantity review");const p=r.quantityForFamily({familyId:"family-0"});assert.equal(p.outcome,"prepared");if(p.outcome==="prepared")assert.equal(p.correspondences[0]!.nominalDensityReference!.reviewEffectiveFrom,"2026-10-20");}
});

test("constructor mutation and order cannot alter the admitted nominal quantity model",()=>{
 const f=densityFixture(true),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected fixed group");const before=r.forFamilies({familyIds:["family-0","family-1"],region:"South",asOfDate:"2026-10-19"});f.densities[0]!.densityGPerMl=amount(1);f.sources.records.fill(0);f.manifest.families.reverse();assert.deepEqual(r.forFamilies({familyIds:["family-1","family-0"],region:"South",asOfDate:"2026-10-19"}),before);
});

test("nominal mass-volume purchase and pantry arithmetic agree with an independent bounded exact oracle",()=>{
 const gcd=(a:bigint,b:bigint):bigint=>b?gcd(b,a%b):a,a=(n:bigint,d=BigInt(1))=>{const g=gcd(n,d);return amount(String(n/g),String(d/g));};let checked=0;
 for(const[n,d]of[[BigInt(1),BigInt(2)],[BigInt(9),BigInt(10)],[BigInt(459),BigInt(500)],[BigInt(1),BigInt(1)],[BigInt(2),BigInt(1)]])for(const packMl of[BigInt(5),BigInt(500)]){
 const f=densityFixture();f.densities[0]!.densityGPerMl=amount(String(n),String(d));f.packages[0]!.nominalQuantity=amount(String(packMl));const r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected nominal model");const p=r.forPlanning({familyId:"family-0",region:"South",asOfDate:"2026-10-19"});assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected price");const c=p.correspondences[0]!;
 for(const grams of[BigInt(1),BigInt(9),BigInt(90),BigInt(450),BigInt(459),BigInt(460),BigInt(900)])for(const stockMl of[BigInt(0),BigInt(1),BigInt(100),BigInt(1000)]){const prepared=prepareReferencePurchaseRequirements([{...demand,amount:amount(String(grams))}],p.correspondences);assert.equal(prepared.outcome,"prepared");if(prepared.outcome!=="prepared")throw Error("Expected demand");const needN=grams*d,needD=n,usedN=stockMl*needD<needN?stockMl*needD:needN,netN=needN-usedN,count=(netN+needD*packMl-BigInt(1))/(needD*packMl),total=Number(count*packMl/BigInt(5)),budget=stockMl%BigInt(2)?0:10000;const q=quoteRegionalEstimates({...request,budgetCents:budget},prepared.requirements,[{skuId:c.skuId,unit:"ml",formDigest:c.formDigest,quantity:{numerator:Number(stockMl),denominator:1}}],p.regionalPackFacts);assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected model quote");assert.deepEqual(q.rows[0]!.needed,a(needN,needD));assert.deepEqual(q.rows[0]!.ownedUsed,a(usedN,needD));assert.deepEqual(q.rows[0]!.toBuy,a(netN,needD));assert.deepEqual(q.rows[0]!.purchasedLeftover,a(count*packMl*needD-netN,needD));assert.equal(q.rows[0]!.packCount,Number(count));assert.deepEqual(q.estimatedTotalCents,{min:total,max:total});assert.deepEqual(q.budgetRemainingCents,{min:budget-total,max:budget-total});assert.equal(q.withinBudgetAtUpperEstimate,total<=budget);assert(q.rows[0]!.flags.includes("nominal-liquid-density-reference-not-product-measurement"));checked++;}
 }
 assert.equal(checked,280);
});


