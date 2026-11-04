import test from "node:test";
import assert from "node:assert/strict";
import { syntheticV2 } from "./generated-plan-v2.test-support.ts";

// Isolated synthetic ingredients/prices and goal only, not a user profile or
// current recipe admission. The actual150g/$150case is kept in its own evidence.
function fixture() {
  const f = syntheticV2(), request = structuredClone(f.request);
  request.people[0].proteinGoal.gramsPerDay = "60"; request.budgetCents = 1000000;
  const current = f.assignments[0];
  const intent = { assignmentId: current.assignmentId, personId: current.personId, expectedRecipeSha256: current.recipeSha256,
    replacementRecipeId: current.recipeId, sourceServings: { numerator: "2", denominator: "1" } };
  return { f, request, intent };
}
test("V2 allows changed meal protein/portions when the day goal and existing grocery quantities suffice; V1 stays unchanged", () => {
  const { f, request, intent } = fixture();
  const legacy = f.planner.previewReplacement(f.assignments, request, intent);
  assert.equal(legacy.outcome, "no_fit");
  if (legacy.outcome === "no_fit") assert.equal(legacy.reasons[0].code, "replacement_protein_tolerance_exceeded");
  const result = f.binding.planner.previewReplacement(f.assignments, request, intent);
  assert.equal(result.outcome, "preview");
  if (result.outcome !== "preview") return;
  assert.notDeepEqual(result.before.projection.assignments[0].nutrition.totals!.protein_g, result.after.projection.assignments[0].nutrition.totals!.protein_g);
  assert.equal(result.addedBuyIds.length, 0);
  for (const row of result.after.quote.rows) assert.ok(row.packCount <= (result.before.quote.rows.find(old => old.skuId === row.skuId)?.packCount ?? 0));
});
test("V2 still rejects a day below the user's goal, new ingredients and extra packs despite spare budget", () => {
  const { f, request, intent } = fixture();
  assert.notEqual(f.binding.planner.previewReplacement(f.assignments, request, { ...intent, sourceServings: { numerator: "1", denominator: "1" } }).outcome, "preview");
  for (const patch of [{ sourceServings: { numerator: "8", denominator: "1" } }, { replacementRecipeId: "b", sourceServings: { numerator: "4", denominator: "1" } }]) {
    const result = f.binding.planner.previewReplacement(f.assignments, request, { ...intent, ...patch });
    assert.equal(result.outcome, "no_fit"); if (result.outcome === "no_fit") assert.equal(result.reasons[0].code, "replacement_requires_more_groceries");
  }
});
