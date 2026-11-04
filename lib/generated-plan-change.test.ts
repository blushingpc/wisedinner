import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { describeReplacementChanges } from "./generated-plan-change.ts";
import { presentReplacement, presentAlternatives } from "./generated-plan-presenter.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const labels = [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }];
function preview(recipeId = "b", servings = amount("3"), otherServings = amount("4")) {
  const f = setup(), request = { ...f.request, selectedDays: [f.request.selectedDays[0]!] }, assignments = f.assignments.filter(row => row.date === request.selectedDays[0]).map(row => row.personId === "p2" ? { ...row, sourceServings: otherServings } : row), target = assignments[0]!;
  const intent = { personId: target.personId, assignmentId: target.assignmentId, expectedRecipeSha256: target.recipeSha256, replacementRecipeId: recipeId, sourceServings: servings }, result = f.planner.previewReplacement(assignments, request, intent);
  assert.equal(result.outcome, "preview"); if (result.outcome !== "preview") throw new Error("Expected synthetic preview");
  return { ...f, request, assignments, intent, preview: result };
}

test("selected-person ingredient removals stay separate from shared household groceries", () => {
  const f = preview(), result = describeReplacementChanges(f.preview);
  assert.equal(result.outcome, "changes"); if (result.outcome !== "changes") return;
  assert.deepEqual(result.ingredients.map(row => [row.ingredientId, row.kind]), [["food-a", "removed"], ["food-b", "added"]]);
  assert.equal(result.ingredients[0]!.quantity.before.numerator, "150");
  const shared = result.groceries.find(row => row.skuId === "buy-a")!; assert.equal(shared.kind, "quantity-changed"); assert.deepEqual(shared.needed, { before: amount("350"), after: amount("200"), direction: "decrease", magnitude: amount("150") });
  assert.equal(shared.packCountDelta, 0); assert.equal(f.preview.removedBuyIds.length, 0); assert.equal(result.groceries.find(row => row.skuId === "buy-b")!.kind, "added-row");
});

test("same recipe portion changes show exact food and demand differences even with unchanged item and pack counts", () => {
  const f = preview("a", amount("16", "5")), result = describeReplacementChanges(f.preview);
  if (result.outcome !== "changes") throw new Error("Expected exact changes");
  assert.equal(result.ingredients[0]!.kind, "increased"); assert.deepEqual(result.ingredients[0]!.quantity.magnitude, amount("10"));
  assert.equal(result.groceries[0]!.packCountDelta, 0); assert.equal(f.preview.itemCountDelta, 0); assert.deepEqual(result.groceries[0]!.needed.after, amount("360"));
});

test("crossing a whole-pack boundary changes purchase quantities without changing consumed nutrition by the purchased leftover", () => {
  const f = preview("a", amount("16", "5"), amount("69", "10")), result = describeReplacementChanges(f.preview);
  if (result.outcome !== "changes") throw new Error("Expected exact changes");
  const row = result.groceries[0]!; assert.equal(row.packCountDelta, 1); assert.deepEqual(row.needed.after, amount("505")); assert.deepEqual(row.purchasedQuantity.after, amount("1000")); assert.deepEqual(row.purchasedLeftover.after, amount("495"));
  assert.deepEqual(result.ingredients[0]!.quantity.after, amount("160"));
});

test("fractional consumed changes agree with independent cross-multiplication throughout a bounded domain", () => {
  for (let n = 1; n <= 12; n++) {
    const f = preview("a", amount(String(210 + n), "70")), before = JSON.stringify(f.preview), result = describeReplacementChanges(f.preview);
    if (result.outcome !== "changes") throw new Error("Expected fractional change");
    const delta = result.ingredients[0]!.quantity.magnitude; assert.equal(BigInt(delta.numerator) * BigInt(70), BigInt(50 * n) * BigInt(delta.denominator));
    assert.equal(JSON.stringify(f.preview), before); assert.ok(Object.isFrozen(result));
  }
});

test("a target-bound no-op remains an explicit empty change, never an invented ingredient", () => {
  const f = preview("a"), result = describeReplacementChanges(f.preview);
  if (result.outcome !== "changes") throw new Error("Expected no-op changes");
  assert.deepEqual(result.ingredients, []); assert.deepEqual(result.groceries, []); assert.deepEqual(result.target, f.preview.target);
});

test("foreign targets changed hashes and unrelated assignment edits refuse the change projection", () => {
  const f = preview();
  const foreign = { ...f.preview, target: { personId: "p2", assignmentId: f.preview.target.assignmentId } };
  const unrelated = JSON.parse(JSON.stringify(f.preview)); unrelated.after.projection.assignments[1].consumedIngredients[0].amount.numerator = "999";
  for (const value of [foreign, unrelated, { ...f.preview, previewSha256: "0".repeat(64) }, { ...f.preview, requestSha256: "0".repeat(64) }]) assert.equal(describeReplacementChanges(value).outcome, "error");
});

test("a caller getter is rejected without invocation rather than treated as actual backend evidence", () => {
  const f = preview(); let reads = 0;
  const value = Object.defineProperty({ ...f.preview }, "target", { enumerable: true, get() { reads++; throw new Error("Not read"); } });
  assert.equal(describeReplacementChanges(value).outcome, "error"); assert.equal(reads, 0);
});

test("customer replacement changes expose quantities and household totals but no ingredient or pack line prices", () => {
  const f = preview(), result = presentReplacement(f.preview, labels);
  assert.equal(result.outcome, "replacement-preview"); if (result.outcome !== "replacement-preview") return;
  assert.equal(result.changes.ingredients.length, 2); assert.equal(result.changes.groceries.length, 2);
  const text = JSON.stringify(result); for (const key of ["estimatedLineCents", "packPriceCents", "factPins", "sourceSha256"]) assert.equal(text.includes('"' + key + '"'), false);
});

test("customer alternative projections reuse exact recipe and quantity views without raw quote rows", () => {
  const f = preview(), alternatives = f.planner.findReplacements(f.assignments, f.request, { personId: f.intent.personId, assignmentId: f.intent.assignmentId, expectedRecipeSha256: f.intent.expectedRecipeSha256, candidates: [{ recipeId: "a", sourceServings: amount("16", "5") }, { recipeId: "b", sourceServings: amount("3") }], maxEvaluations: 8, limit: 8 });
  if (alternatives.outcome !== "alternatives") throw new Error("Expected synthetic alternatives");
  const result = presentAlternatives(alternatives, labels); assert.equal(result.outcome, "replacement-alternatives"); if (result.outcome !== "replacement-alternatives") return;
  assert.equal(result.candidates.length, 2); assert.equal(result.candidates[0]!.recipe.personId, f.intent.personId); assert.equal(result.saved, false);
  const text = JSON.stringify(result); for (const key of ["estimatedLineCents", "packPriceCents", "factPins"]) assert.equal(text.includes('"' + key + '"'), false);
});

test("defensive internal malformed or oversized quantity packets refuse or hold without partial deltas", () => {
  const f = preview(), malformed = JSON.parse(JSON.stringify(f.preview));
  malformed.before.projection.assignments[0].consumedIngredients[0].amount.denominator = "0"; assert.equal(describeReplacementChanges(malformed).outcome, "error");
  const oversized = JSON.parse(JSON.stringify(f.preview)), original = oversized.before.projection.assignments[0].consumedIngredients[0];
  oversized.before.projection.assignments[0].consumedIngredients = [7, 9].map(n => ({ ...original, amount: amount("1", String(BigInt(10) ** BigInt(239) + BigInt(n))) }));
  assert.deepEqual(describeReplacementChanges(oversized), { outcome: "held", code: "replacement_change_capacity_review" });
});

test("empty alternative lists still reject malformed labels and do not manufacture eligible results", () => {
  const f = preview(), alternatives = f.planner.findReplacements(f.assignments, f.request, { personId: f.intent.personId, assignmentId: f.intent.assignmentId, expectedRecipeSha256: f.intent.expectedRecipeSha256, candidates: [{ recipeId: "a", sourceServings: amount("3") }], maxEvaluations: 1, limit: 1 });
  if (alternatives.outcome !== "alternatives") throw new Error("Expected explicit empty alternatives");
  const result = presentAlternatives(alternatives, labels); assert.equal(result.outcome, "replacement-alternatives"); if (result.outcome === "replacement-alternatives") { assert.equal(result.candidates.length, 0); assert.equal(result.search.unchangedCandidateCount, 1); }
  assert.deepEqual(presentAlternatives(alternatives, [{ skuId: "buy-a", displayName: "$4.00 fixture", aisle: "Pantry" }]), { outcome: "error", code: "invalid_grocery_labels" });
});
