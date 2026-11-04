import test from "node:test";
import assert from "node:assert/strict";
import { rawYieldPlanFixture, amount } from "./generated-nominal-preparation-yield.test-support.ts";
import { presentGroceries, presentReplacement } from "./generated-plan-presenter.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

test("joined raw preparation and selected-person replacement preserve food nutrition and one purchase",()=>{
 const f=rawYieldPlanFixture(),result=f.planner.evaluateJoined(f.assignments,f.request);assert.equal(result.outcome,"success");if(result.outcome!=="success")throw Error("Expected14assignment synthetic week");
 // Seven150g and seven200g ingredient portions =2450g prepared input.
 // Published0.98reference means2500g purchased,25nominal100g packs at20c.
 assert.equal(result.projection.assignments.length,14);assert.deepEqual(result.quote.rows[0]!.needed,amount(2500));assert.deepEqual(result.quote.estimatedTotalCents,{min:500,max:500});assert.equal(result.quote.uniqueBuyItemCount,1);
 const noLoss=rawYieldPlanFixture(false,amount(1)),plain=noLoss.planner.evaluateJoined(noLoss.assignments,noLoss.request);assert.equal(plain.outcome,"success");if(plain.outcome!=="success")throw Error("Expected same inputs with different raw reference");assert.deepEqual(plain.projection,result.projection);assert.deepEqual(plain.quote.rows[0]!.needed,amount(2450));assert.deepEqual(plain.quote.rows[0]!.purchasedLeftover,amount(50));
 const view=presentGroceries(result,f.labels);assert.equal(view.outcome,"groceries");if(view.outcome!=="groceries")throw Error("Expected safe grocery view");assert(view.warnings.includes("uses-nominal-raw-preparation-yield-reference"));for(const key of["preparedPerPurchased","nominalPreparationYieldReference","estimatedLineCents","packPriceCents","sourceSha256"])assert.equal(JSON.stringify(view).includes(key),false);
 const target=f.assignments[0]!,preview=f.planner.previewReplacement(f.assignments,f.request,{assignmentId:target.assignmentId,personId:target.personId,expectedRecipeSha256:target.recipeSha256,replacementRecipeId:"b",sourceServings:amount(3)});assert.equal(preview.outcome,"preview");if(preview.outcome!=="preview")throw Error("Expected same-protein selected-person change");assert.deepEqual(preview.after.projection.assignments.filter(a=>a.personId==="p2"),result.projection.assignments.filter(a=>a.personId==="p2"));assert.deepEqual(preview.after.quote.rows[0]!.needed,amount(130000,49));assert.deepEqual(preview.after.quote.estimatedTotalCents,{min:540,max:540});
 const shown=presentReplacement(preview,f.labels);assert.equal(shown.outcome,"replacement-preview");if(shown.outcome==="replacement-preview"){assert(shown.before.warnings.includes("uses-nominal-raw-preparation-yield-reference"));assert(shown.after.warnings.includes("uses-nominal-raw-preparation-yield-reference"));}assert.equal(f.planner.evaluateJoined(f.assignments,{...f.request,budgetCents:0}).outcome,"no_fit");
});

test("42full-day assignments keep distinct daily protein goals and selected-person raw-yield swaps",()=>{
 const f=rawYieldPlanFixture(false,amount(49,50),true),result=f.planner.evaluateJoined(f.assignments,f.request);assert.equal(result.outcome,"success");if(result.outcome!=="success")throw Error("Expected full42person meals");assert.equal(result.projection.assignments.length,42);assert.equal(result.projection.personDays.length,14);assert.equal(result.fullDayCoverage?.policy,"wd-seven-day-three-meals-v1");assert.deepEqual(result.quote.rows[0]!.needed,amount(2500));assert.deepEqual(result.quote.estimatedTotalCents,{min:500,max:500});
 // The same daily portions are split across3meals, not tripled while retaining the old goal.
 assert.deepEqual(result.projection.personDays.map(p=>p.personId).filter(id=>id==="p2").length,7);
 const target=f.assignments[0]!,preview=f.planner.previewReplacement(f.assignments,f.request,{assignmentId:target.assignmentId,personId:target.personId,expectedRecipeSha256:target.recipeSha256,replacementRecipeId:"b",sourceServings:amount(1)});assert.equal(preview.outcome,"preview");if(preview.outcome!=="preview")throw Error("Expected selected full-day replacement");assert.deepEqual(preview.after.projection.assignments.filter(a=>a.personId==="p2"),result.projection.assignments.filter(a=>a.personId==="p2"));assert.deepEqual(preview.after.quote.rows[0]!.needed,amount(125000,49));assert.deepEqual(preview.after.quote.estimatedTotalCents,{min:520,max:520});assert.equal(f.planner.evaluateJoined(f.assignments,{...f.request,budgetCents:0}).outcome,"no_fit");
});

test("fully owned raw purchase-state grams warn and source review cannot be used early",()=>{
 const f=rawYieldPlanFixture(),pantry=f.planner.preparePantry(f.entries);assert.equal(pantry.outcome,"prepared");if(pantry.outcome!=="prepared")throw Error("Expected known raw grams");const request={...f.request,pantry:pantry.pantry},result=f.planner.evaluateJoined(f.assignments,request);assert.equal(result.outcome,"success");if(result.outcome!=="success")throw Error("Expected fully owned raw stock");
 assert.deepEqual(result.quote.rows[0]!.ownedUsed,amount(2500));assert.deepEqual(result.quote.rows[0]!.ownedRemaining,amount(500));assert.deepEqual(result.quote.estimatedTotalCents,{min:0,max:0});assert.equal(result.quote.factPins.length,0);const view=presentGroceries(result,f.labels);assert.equal(view.outcome,"groceries");if(view.outcome==="groceries")assert(view.warnings.includes("uses-nominal-raw-preparation-yield-reference"));
 assert.equal(f.planner.evaluateJoined(f.assignments,{...request,asOfDate:"2026-10-18"}).outcome,"held");
 assert.equal(f.planner.preparePantry(f.entries.map(e=>({...e,preparedState:"raw, cleaned and sliced"}))).outcome,"held");
});

test("nominal raw preparation survives committed acknowledgement loss and repository reconstruction",async()=>{
 const f=rawYieldPlanFixture(),memory=memoryPort(),scope=issueLocalReferenceScope("synthetic-raw-preparation-memory",1),repo=createReferencePlanRepository({planner:f.planner,transactions:memory.port}),command={kind:"install-current",operationId:op(1101),weekId:op(1102),expectedRevision:0,request:f.request,assignments:f.assignments};
 memory.failOnce("after-commit");assert.equal((await repo.applyPlanCommand(scope,command)).outcome,"unknown");const recovered=createReferencePlanRepository({planner:f.planner,transactions:memory.port}),status=await recovered.getOperationStatus(scope,op(1101));assert.equal(status.outcome,"committed");const duplicate=await recovered.applyPlanCommand(scope,command);assert.equal(duplicate.outcome,"acknowledged");if(duplicate.outcome==="acknowledged"){assert.equal(duplicate.state.revision,1);assert(duplicate.state.current!.quote.rows[0]!.nominalPreparationYieldReference);}
});
