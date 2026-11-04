import test from "node:test";
import assert from "node:assert/strict";
import { densityPlanFixture } from "./generated-nominal-density.test-support.ts";
import { presentGroceries, presentReplacement } from "./generated-plan-presenter.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

test("joined evaluator and person-only preview preserve nominal quantity uncertainty and one physical item",()=>{
 const f=densityPlanFixture(),result=f.planner.evaluateJoined(f.assignments,f.request);assert.equal(result.outcome,"success");if(result.outcome!=="success")throw Error("Expected14assignment synthetic week");assert.equal(result.projection.assignments.length,14);assert.equal(result.quote.uniqueBuyItemCount,1);assert.deepEqual(result.quote.estimatedTotalCents,{min:560,max:560});assert(result.quote.rows[0]!.nominalDensityReference);
 const view=presentGroceries(result,f.labels);assert.equal(view.outcome,"groceries");if(view.outcome!=="groceries")throw Error("Expected customer view");assert(view.warnings.includes("uses-nominal-liquid-density-reference"));assert.equal(JSON.stringify(view).includes("densityGPerMl"),false);for(const row of view.groups.flatMap(g=>g.items))for(const key of["estimatedLineCents","packPriceCents","sourceSha256","nominalDensityReference"])assert.equal(Object.hasOwn(row,key),false);
 const target=f.assignments[0]!,preview=f.planner.previewReplacement(f.assignments,f.request,{assignmentId:target.assignmentId,personId:target.personId,expectedRecipeSha256:target.recipeSha256,replacementRecipeId:"b",sourceServings:{numerator:"3",denominator:"1"}});assert.equal(preview.outcome,"preview");if(preview.outcome!=="preview")throw Error("Expected eligible same-protein person swap");assert.deepEqual(preview.after.projection.assignments.filter(a=>a.personId==="p2"),result.projection.assignments.filter(a=>a.personId==="p2"));assert.deepEqual(preview.after.quote.estimatedTotalCents,{min:580,max:580});const shown=presentReplacement(preview,f.labels);assert.equal(shown.outcome,"replacement-preview");if(shown.outcome==="replacement-preview"){assert(shown.before.warnings.includes("uses-nominal-liquid-density-reference"));assert(shown.after.warnings.includes("uses-nominal-liquid-density-reference"));}
 assert.equal(f.planner.evaluateJoined(f.assignments,{...f.request,budgetCents:0}).outcome,"no_fit");
});

test("fully owned nominal conversion still warns and refuses evaluation before model review",()=>{
 const f=densityPlanFixture(),pantry=f.planner.preparePantry(f.entries);assert.equal(pantry.outcome,"prepared");if(pantry.outcome!=="prepared")throw Error("Expected measured mlstock");const request={...f.request,pantry:pantry.pantry},result=f.planner.evaluateJoined(f.assignments,request);assert.equal(result.outcome,"success");if(result.outcome!=="success")throw Error("Expected owned stock");assert.deepEqual(result.quote.estimatedTotalCents,{min:0,max:0});assert.equal(result.quote.factPins.length,0);const view=presentGroceries(result,f.labels);assert.equal(view.outcome,"groceries");if(view.outcome==="groceries")assert(view.warnings.includes("uses-nominal-liquid-density-reference"));
 assert.equal(f.planner.evaluateJoined(f.assignments,{...request,asOfDate:"2026-10-18"}).outcome,"held");
});

test("nominal quote and source-model warning survive committed acknowledgement loss and repository reconstruction",async()=>{
 const f=densityPlanFixture(),memory=memoryPort(),scope=issueLocalReferenceScope("synthetic-nominal-density-memory",1),repo=createReferencePlanRepository({planner:f.planner,transactions:memory.port}),command={kind:"install-current",operationId:op(1001),weekId:op(1002),expectedRevision:0,request:f.request,assignments:f.assignments};
 memory.failOnce("after-commit");assert.equal((await repo.applyPlanCommand(scope,command)).outcome,"unknown");const recovered=createReferencePlanRepository({planner:f.planner,transactions:memory.port}),status=await recovered.getOperationStatus(scope,op(1001));assert.equal(status.outcome,"committed");const duplicate=await recovered.applyPlanCommand(scope,command);assert.equal(duplicate.outcome,"acknowledged");if(duplicate.outcome==="acknowledged"){assert.equal(duplicate.state.revision,1);assert(duplicate.state.current!.quote.rows[0]!.nominalDensityReference);}
});

