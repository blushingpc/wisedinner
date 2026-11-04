import test from "node:test";
import assert from "node:assert/strict";
import { presentRecipe, presentGroceries, presentReplacement, presentSaveOutcome } from "./generated-plan-presenter.ts";
import { setup } from "./generated-joined-plan.test-support.ts";

const labels = [{ skuId: "buy-a", displayName: "Fixture food A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture food B", aisle: "Produce" }];
function evaluated() {
  const fixture = setup(), result = fixture.planner.evaluateJoined(fixture.assignments, fixture.request);
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") throw new Error("Expected synthetic evaluation"); return { ...fixture, result };
}
function noRowPrices(value: unknown) {
  if (!value || typeof value !== "object") return;
  for (const [key, nested] of Object.entries(value)) { assert.ok(!/price|cost|cents|provider|url|factPins/i.test(key), "Customer row must not expose internal price fields"); noRowPrices(nested); }
}

test("recipe presentation preserves original batch method and separates consumed food from conditional protein", () => {
  const { result, rows, assignments } = evaluated(), view = presentRecipe(result, "p1", assignments[0]!.assignmentId);
  assert.equal(view.outcome, "recipe"); if (view.outcome !== "recipe") return;
  assert.deepEqual(view.originalBatchRecipe, rows[0]!.recipe); assert.equal(view.originalBatchServings, 2);
  assert.deepEqual(view.personPortion.sourceServings, { numerator: "3", denominator: "1" });
  assert.deepEqual(view.personPortion.consumedIngredients[0]!.amount, { numerator: "150", denominator: "1" });
  assert.deepEqual(view.personPortion.conditionalNutrition.totals!.protein_g.min, { numerator: "90", denominator: "1" });
  assert.equal(view.image.status, "held"); assert.equal(view.elapsedMinutes, null); assert.equal(view.practicalServing.status, "held"); assert.equal(view.preparationScalingReviewed, false);
  assert.equal(presentRecipe(result, "p2", assignments[0]!.assignmentId).outcome, "error");
});

test("aisle groceries expose household ranges and whole-pack quantities but no row prices", () => {
  const { result } = evaluated(), view = presentGroceries(result, labels);
  assert.equal(view.outcome, "groceries"); if (view.outcome !== "groceries") return;
  assert.equal(view.groups[0]!.aisle, "Pantry"); assert.equal(view.groups[0]!.items[0]!.packCount, 5);
  assert.deepEqual(view.estimatedTotalCents, { min: 4500, max: 5000 }); assert.equal(view.uniqueBuyItemCount, 1); assert.equal(view.alreadyAtHome.length, 0);
  noRowPrices(view.groups); noRowPrices(view.alreadyAtHome);
  assert.equal(view.liveRetailerPricing, false); assert.equal(view.checkoutChargesIncluded, false);
  assert.deepEqual(view.storeIds, ["fixture-shop"]); assert.ok(Object.isFrozen(view));
});

test("pantry-covered food appears at home, not as zero-priced shopping or extra nutrition", () => {
  const { planner, request, assignments, result } = evaluated(), next = planner.evaluateJoined(assignments, { ...request, pantry: [{ skuId: "buy-a", unit: "g", formDigest: "d".repeat(64), quantity: { numerator: 9000, denominator: 1 } }] });
  if (next.outcome !== "success") throw new Error("Expected pantry-covered evaluation");
  const view = presentGroceries(next, labels); if (view.outcome !== "groceries") throw new Error("Expected groceries");
  assert.equal(view.groups.length, 0); assert.equal(view.uniqueBuyItemCount, 0); assert.deepEqual(view.estimatedTotalCents, { min: 0, max: 0 }); assert.equal(view.alreadyAtHome.length, 1);
  assert.deepEqual(next.projection.personDays, result.projection.personDays); noRowPrices(view.alreadyAtHome);
});

test("missing labels stay held and malformed/price-bearing/getter labels refuse", () => {
  const { result } = evaluated(); assert.equal(presentGroceries(result, []).outcome, "held"); let reads = 0;
  const getter = Object.defineProperty({ ...labels[0] }, "displayName", { enumerable: true, get() { reads++; throw new Error("Not called"); } });
  for (const value of [[getter], [labels[0], labels[0]], [{ ...labels[0], displayName: "$2.99 food" }], [{ ...labels[0], priceCents: 100 }]]) assert.equal(presentGroceries(result, value).outcome, "error");
  assert.equal(reads, 0);
});

test("replacement view shows before/after household effects without pretending to save", () => {
  const { planner, request, assignments } = evaluated(), preview = planner.previewReplacement(assignments, request, { assignmentId: assignments[0]!.assignmentId, personId: "p1", expectedRecipeSha256: assignments[0]!.recipeSha256, replacementRecipeId: "b", sourceServings: { numerator: "3", denominator: "1" } });
  if (preview.outcome !== "preview") throw new Error("Expected preview");
  const view = presentReplacement(preview, labels); assert.equal(view.outcome, "replacement-preview"); if (view.outcome !== "replacement-preview") return;
  assert.equal(view.before.estimatedTotalCents.max, 5000); assert.equal(view.after.estimatedTotalCents.max, 5200); assert.equal(view.saved, false); assert.equal(view.confirmationRequired, true);
  assert.deepEqual(view.addedBuyIds, ["buy-b"]); noRowPrices(view.after.groups); noRowPrices(view.before.groups);
});

test("save presentation distinguishes acknowledged, unknown, held and rejected outcomes", () => {
  const id = "00000000-0000-4000-8000-000000000001";
  assert.equal(presentSaveOutcome({ outcome: "acknowledged", operationId: id, state: { revision: 1, current: null, draft: null } }, id).status, "saved-reference-state");
  assert.equal(presentSaveOutcome({ outcome: "unknown", operationId: id, statusRequired: true }, id).status, "save-status-unknown");
  assert.equal(presentSaveOutcome({ outcome: "held", code: "operation_status_required" }, id).action, "check-operation-status");
  assert.equal(presentSaveOutcome({ outcome: "not_applied", operationId: id, result: { outcome: "held", reasons: [{ code: "goal_required" }] } }, id).status, "not-saved");
  assert.equal(presentSaveOutcome({ outcome: "unknown", operationId: id, statusRequired: true }, id.replace(/1$/, "2")).status, "not-saved");
});

test("grocery row fingerprint changes with required quantity or source fact, never a hidden checkbox default", () => {
  const { result, planner, request, assignments } = evaluated(), before = presentGroceries(result, labels);
  const modified = planner.evaluateJoined(assignments.map(value => ({ ...value, sourceServings: { numerator: "5", denominator: "1" } })), request);
  if (before.outcome !== "groceries" || modified.outcome !== "success") throw new Error("Expected reference groceries");
  const after = presentGroceries(modified, labels); if (after.outcome !== "groceries") throw new Error("Expected reference groceries");
  assert.equal(before.groups[0]!.items[0]!.itemKey, after.groups[0]!.items[0]!.itemKey); assert.notEqual(before.groups[0]!.items[0]!.fingerprint, after.groups[0]!.items[0]!.fingerprint);
  assert.equal(Object.hasOwn(after.groups[0]!.items[0]!, "checked"), false);
});
