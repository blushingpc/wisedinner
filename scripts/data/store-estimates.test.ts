import {test} from "node:test";
import assert from "node:assert/strict";
import {hash} from "./price-evidence.ts";
import {ceilRatio,addCents,fitModel,verifyModel,verifyCalibration,calibrate,sealRecord,evaluateHeldOut,verifyPhaseSeparation,rawModelPrice,scopeKey,type BasketObservation} from "./store-estimate-model.ts";
import {quoteBaskets,ratio,decimalQuantity,strategyDigest,type Requirement,type PackFact} from "./store-estimates.ts";
import {fixtureModel,fixtureRequest,fixtureFacts,fixtureScope,fixtureCalibration,fixtureStores,fixturePolicy,evidence,sourceFor} from "./store-estimate-fixtures.ts";
const req:Requirement={skuId:"fixture-food",category:"pantry",unit:"g",formDigest:hash("dry-food-reviewed"),purchasedNeed:ratio(900),perishable:false};
function setup(){const model=fixtureModel(["pantry"]),request=fixtureRequest(model),facts=fixtureFacts([req]),scope=fixtureScope(request,[req],request.storeIds[0]),cal=fixtureCalibration(model,scope,Array(9).fill(300),"test");request.calibrationPins=[{scopeDigest:scopeKey(scope),digest:cal.digest}];return {model,request,facts,scope,cal};}
function quote(edit?:(s:ReturnType<typeof setup>)=>void,requirements=[req],pantry:Parameters<typeof quoteBaskets>[2]=[]){const s=setup();edit?.(s);s.request.strategyPolicyDigest=strategyDigest(s.request);s.cal=fixtureCalibration(s.model,fixtureScope(s.request,requirements,s.request.storeIds[0]),Array(9).fill(300),"test");s.request.calibrationPins=[{scopeDigest:scopeKey(s.cal.scope),digest:s.cal.digest}];return quoteBaskets(s.request,requirements,pantry,fixtureStores,s.facts,sourceFor(s.facts,s.facts.map(f=>f.cell)),s.model,[s.cal]);}
test("exact cents and rational quantities reject fractional cents/overflow and round only upwards",()=>{
 assert.equal(ceilRatio(101,ratio(1,3)),34);assert.equal(addCents([101,299]),400);assert.throws(()=>addCents([Number.MAX_SAFE_INTEGER,1]));assert.throws(()=>ceilRatio(1.1,ratio(1)));assert.throws(()=>ceilRatio(Number.MAX_SAFE_INTEGER,ratio(2)));assert.deepEqual(decimalQuantity(.125),ratio(1,8));
});
test("whole offered packs minimize line cost, not unit price; allowance once then explicit charges",()=>{
 const q=quote().alternatives[0];assert.equal(q.rawCents,200);assert.equal(q.allowanceCents,18);assert.equal(q.totalCents,218);assert.equal(q.lines[0].assignments[0].packs,1);assert.deepEqual(q.lines[0].newCarryover,ratio(100));assert.equal(q.status,"fixture-only");
 const smaller=quote(undefined,[{...req,purchasedNeed:ratio(400)}]).alternatives[0];assert.equal(smaller.rawCents,150);assert.deepEqual(smaller.lines[0].purchased,ratio(500));
 const charged=quote(s=>s.request.charges=[{id:"tax",cents:31,storeId:null}]).alternatives[0];assert.equal(charged.totalCents,249);
});
test("compatible physical pantry subtracts once without free nutrients and preserves separate carryover",()=>{
 const q=quote(undefined,[req],[{skuId:req.skuId,unit:"g",formDigest:req.formDigest,quantity:ratio(600)}]).alternatives[0];assert.equal(q.rawCents,150);assert.deepEqual(q.lines[0].ownedUsed,ratio(600));assert.deepEqual(q.lines[0].newCarryover,ratio(200));
 const owned=quote(undefined,[req],[{skuId:req.skuId,unit:"g",formDigest:req.formDigest,quantity:ratio(1000)}]).alternatives[0];assert.equal(owned.rawCents,0);assert.deepEqual(owned.lines[0].ownedCarryover,ratio(100));
 assert.throws(()=>quote(undefined,[req],[{skuId:req.skuId,unit:"each",formDigest:req.formDigest,quantity:ratio(1)}]));
 const perish=quote(undefined,[{...req,purchasedNeed:ratio(300),perishable:true}]).alternatives[0];assert.equal(perish.totalCents,null);assert.match(perish.reasons.join(),/carryover/);
});
test("exact local prices are not adjusted; supported modeled cells have only one factor",()=>{
 const exact=quote().alternatives[0];assert.equal(exact.rawCents,200);
 const modeled=quote(s=>{s.facts=s.facts.map(f=>sealRecord({...f,mode:"baseline"}));}).alternatives[0];assert.equal(modeled.rawCents,220);
 const s=setup();assert.throws(()=>rawModelPrice(s.model,{...s.facts[0].cell,region:"other"},100),/Unsupported/);
});
test("one to three exact ordered stores; split requires intent and matching combined calibration",()=>{
 for(const ids of [[],["unknown"],[fixtureStores[0].id,fixtureStores[0].id],fixtureStores.map(s=>s.id).concat("fourth")])assert.throws(()=>quote(s=>s.request.storeIds=ids));
 const s=setup();s.request=fixtureRequest(s.model,"split",fixtureStores.slice(0,2).map(s=>s.id));const scope=fixtureScope(s.request,[req],null),cal=fixtureCalibration(s.model,scope,Array(9).fill(200),"split");
 s.request.calibrationPins=[{scopeDigest:scopeKey(scope),digest:cal.digest}];
 const q=quoteBaskets(s.request,[req],[],fixtureStores,s.facts,sourceFor(s.facts,s.facts.map(f=>f.cell)),s.model,[cal]);assert.deepEqual(q.alternatives.map(q=>q.scope.quotedStoreId),s.request.storeIds);assert.equal(q.split!.totalCents,218);assert(q.split!.lines.every(l=>l.assignments.every(a=>s.request.storeIds.includes(a.storeId))));assert.equal(quote().split,null);
});
test("source-order deterministic ties and chosen-store order remain stable",()=>{
 const s=setup();s.request=fixtureRequest(s.model,"split",[fixtureStores[1].id,fixtureStores[0].id]);s.facts=s.facts.map(f=>sealRecord({...f,rawCents:200}));const cal=fixtureCalibration(s.model,fixtureScope(s.request,[req],null),Array(9).fill(200),"ties");
 s.request.calibrationPins=[{scopeDigest:scopeKey(cal.scope),digest:cal.digest}];
 const run=()=>quoteBaskets(s.request,[req],[],fixtureStores,s.facts,sourceFor(s.facts,s.facts.map(f=>f.cell)),s.model,[cal]);assert.deepEqual(run(),run());assert.equal(run().split!.lines[0].assignments[0].storeId,fixtureStores[1].id);
 const two=s.facts.filter(f=>f.cell.storeId===fixtureStores[1].id&&f.packQuantity.numerator===1000);two.push(sealRecord({...two[0],id:"tie-second",offerId:"second"}));s.facts=two;assert.equal(run().split!.lines[0].assignments[0].factId,two[0].id);
});
test("edited, stale, future, buffered, wrong form, unit or missing review fail closed",()=>{
 const edits:((f:PackFact)=>PackFact)[]=[f=>({...f,rawCents:f.rawCents+1}),f=>sealRecord({...f,evidence:{...f.evidence,observedAt:"2026-09-01T12:00:00Z"}}),f=>sealRecord({...f,evidence:{...f.evidence,observedAt:"2026-10-06T12:00:00Z"}}),f=>sealRecord({...f,priceBasis:"buffered" as "raw"}),f=>sealRecord({...f,formDigest:"different"}),f=>sealRecord({...f,unit:"each"}),f=>sealRecord({...f,packReviewRevision:""}),f=>sealRecord({...f,packReviewedAt:"2026-10-05T12:00:00Z"})];
 for(const edit of edits){const q=quote(s=>s.facts=s.facts.map(edit)).alternatives[0];assert.equal(q.totalCents,null);assert.equal(q.withinBudget,null);}
});
test("unavailable, ineligible promotion/membership, other channel/region and no generic fallback",()=>{
 for(const patch of [{availablePacks:0},{membershipId:"not-owned"},{promotionId:"not-eligible"}])assert.equal(quote(s=>s.facts=s.facts.map(f=>sealRecord({...f,...patch}))).alternatives[0].totalCents,null);
 assert(quote(s=>{s.facts=s.facts.map(f=>sealRecord({...f,membershipId:"club"}));s.request.membershipIds=["club"];}).alternatives[0].totalCents!==null);
 for(const patch of [{channel:"delivery" as const},{region:"other-region"}])assert.equal(quote(s=>s.facts=s.facts.map(f=>sealRecord({...f,cell:{...f.cell,...patch}}))).alternatives[0].totalCents,null);
 const s=setup(),sources=sourceFor(s.facts,s.facts.map(f=>f.cell));sources[0].uses=["storage"];assert.equal(quoteBaskets(s.request,[req],[],fixtureStores,s.facts,sources,s.model,[s.cal]).alternatives[0].totalCents,null);
});
test("model/calibration seals cannot legitimize a mutated frozen derivation or wrong scope",()=>{
 const s=setup(),m=structuredClone(s.model);m.cells[0].ratio.numerator++;const body:Partial<typeof m>={...m};delete body.digest;m.digest=hash(body);assert.throws(()=>verifyModel(m),/derivation/);
 const c=structuredClone(s.cal);c.upperError=ratio(0);const cb:Partial<typeof c>={...c};delete cb.digest;c.digest=hash(cb);assert.throws(()=>verifyCalibration(c,s.model,s.scope,fixturePolicy));
 assert.throws(()=>verifyCalibration(s.cal,s.model,{...s.scope,strategyPolicyDigest:"different"},fixturePolicy));
 assert.throws(()=>fitModel("bad",[s.model.samples[0],s.model.samples[0]],s.model.sources,s.model.policy));
});
test("full-basket correlated error and finite quantile rank are not item-average protection",()=>{
 const s=setup();assert.equal(s.cal.rank,9);assert.deepEqual(s.cal.upperError,ratio(27,300));
 const insufficient=calibrate(s.model,s.scope,s.cal.rows.slice(0,8),s.cal.sources,s.cal.policy);assert.equal(insufficient.upperError,null);
 s.request.calibrationPins=[{scopeDigest:scopeKey(insufficient.scope),digest:insufficient.digest}];
 const q=quoteBaskets(s.request,[req],[],fixtureStores,s.facts,sourceFor(s.facts,s.facts.map(f=>f.cell)),s.model,[insufficient]);assert.equal(q.alternatives[0].totalCents,null);assert.equal(q.alternatives[0].rawCents,200);
});
test("fit/calibration/held-out source/date pins, declared units, time leakage and frozen revision",()=>{
 const s=setup(),base=s.cal.rows[0];
 for(const patch of [{independentUnit:s.model.fitUnits[0]},{evidence:{...base.evidence,observedAt:s.model.frozenAt}},{priceBasis:"buffered" as "raw"},{scope:{...base.scope,modelDigest:"other-model"}}]){
   const rows=[sealRecord({...base,...patch})];assert.throws(()=>calibrate(s.model,s.scope,rows,sourceFor(rows,s.cal.sources[0].cells),s.cal.policy));
 }
 const held:BasketObservation[]= [sealRecord({...base,id:"held",evidence:evidence("held","2026-10-03T12:00:00Z"),independentUnit:"held-unit",basketDigest:"held-basket",actualCents:345})];
 const result=evaluateHeldOut(s.model,s.cal,held,sourceFor(held,s.cal.sources[0].cells),fixturePolicy);assert.equal(result.overrunCount,1);assert.equal(result.maximumOverrunCents,18);assert.equal(result.fixture,true);
 assert.throws(()=>verifyPhaseSeparation(s.model.samples,s.cal.rows,[{...held[0],independentUnit:s.cal.units[0]}]));
 assert.throws(()=>evaluateHeldOut(s.model,s.cal,[sealRecord({...held[0],independentUnit:s.cal.units[0]})],sourceFor(held,s.cal.sources[0].cells),fixturePolicy));
 const sources=structuredClone(s.cal.sources);sources[0].records[0].observedAt="2026-10-03T12:00:00Z";assert.throws(()=>calibrate(s.model,s.scope,s.cal.rows,sources,s.cal.policy),/pin/);
});
test("stale model, wrong frozen calibration, fractional piece pack and changed strategy stay unsupported",()=>{
 const s=setup();assert.throws(()=>verifyModel(s.model,{...fixturePolicy,asOf:"2026-11-01T18:00:00Z"}),/stale/);
 s.request.calibrationPins[0].digest="edited";
 const q=quoteBaskets(s.request,[req],[],fixtureStores,s.facts,sourceFor(s.facts,s.facts.map(f=>f.cell)),s.model,[s.cal]);assert.equal(q.alternatives[0].totalCents,null);assert.match(q.alternatives[0].reasons.join(),/revision/);
 s.request.strategyPolicyDigest="arbitrary-seal";assert.throws(()=>quoteBaskets(s.request,[req],[],fixtureStores,s.facts,sourceFor(s.facts,s.facts.map(f=>f.cell)),s.model,[s.cal]),/strategy/);
 const piece={...req,unit:"each" as const};const p=setup();p.facts=p.facts.map(f=>sealRecord({...f,unit:"each",packQuantity:ratio(3,2)}));
 assert.equal(quoteBaskets(p.request,[piece],[],fixtureStores,p.facts,sourceFor(p.facts,p.facts.map(f=>f.cell)),p.model,[p.cal]).alternatives[0].totalCents,null);
 const changed=sealRecord({...p.model.samples[0],baselineObservedAt:"2026-10-01T12:00:00Z"});assert.throws(()=>fitModel("time-leak",[changed],sourceFor([changed],[changed.cell]),{...p.model.policy,minSamples:1}),/leakage/);
});
