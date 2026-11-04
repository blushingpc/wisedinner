import test from "node:test";
import assert from "node:assert/strict";
import { syntheticV2, labelsV2 } from "./generated-plan-v2.test-support.ts";
import { presentGroceriesV2, presentRecipeV2, presentReplacementV2 } from "./generated-plan-presenter.ts";
test("retailer DTO is sanitized and money remains household aggregate only", () => {
  const f = syntheticV2(), evaluation = f.binding.planner.evaluateJoined(f.assignments, f.request); if (evaluation.outcome !== "success") throw Error("Expected evaluation");
  const view = presentGroceriesV2(evaluation, labelsV2); assert.equal(view.outcome, "groceries"); if (view.outcome !== "groceries") return;
  assert.equal(view.referenceEstimates!.policy, "wd-price-reference-fallback-v2"); assert.ok(view.warnings.includes("includes-retailer-reference-estimates"));
  for (const key of ["retailerId", "productId", "offerContext", "sourceUrl", "sourceSha256", "factId", "packPriceCents", "estimatedLineCents", "nonShoppingUsage"]) assert.equal(JSON.stringify(view).includes('"' + key + '"'), false, key);
  assert.deepEqual(view.referenceEstimates!.sources[0], { kind: "retailer-reference", sourceBasis: { geography: "retailer-reference-not-regional", capturedOn: "2026-10-18", observedOn: null, publishedOn: null }, reviewEffectiveFrom: "2026-10-18", usableThrough: "2026-10-18" });
});
test("V2 recipe preserves complete original directions/ingredients/nutrition and explicit separate usage", () => {
  const f = syntheticV2(), evaluation = f.binding.planner.evaluateJoined(f.assignments, f.request); if (evaluation.outcome !== "success") throw Error("Expected evaluation");
  const meal = presentRecipeV2(evaluation, "p1", f.assignments[0]!.assignmentId); assert.equal(meal.outcome, "recipe"); if (meal.outcome !== "recipe") return;
  assert.deepEqual(meal.originalBatchRecipe, f.rows[0]!.recipe); assert.equal(meal.nonShoppingUsage, null);
});
test("V2 replacement change validator accepts complete versioned preview proof", () => {
  const f = syntheticV2(), a = f.assignments[0]!;
  const preview = f.binding.planner.previewReplacement(f.assignments, f.request, { assignmentId: a.assignmentId, personId: a.personId, expectedRecipeSha256: a.recipeSha256, replacementRecipeId: "a", sourceServings: { numerator: "4", denominator: "1" } });
  assert.equal(preview.outcome, "preview"); if (preview.outcome !== "preview") return;
  const view = presentReplacementV2(preview, labelsV2); assert.equal(view.outcome, "replacement-preview");
});
