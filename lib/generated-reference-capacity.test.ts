import test from "node:test";
import assert from "node:assert/strict";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import * as purchase from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";

const amount = (numerator: string) => ({ numerator, denominator: "1" });
const { preparePurchaseRequirements, prepareReferencePurchaseRequirements } = purchase;
function inputs(n: number) {
  const demands = Array.from({ length: n }, (_, i) => ({ assignmentId: "assignment-" + i, recipeId: "fixture", recipeSha256: "a".repeat(64), ingredientId: "food-" + i, preparedState: "raw", baseUnit: "g", amount: amount("1") }));
  const correspondences = demands.map((row, i) => ({ id: "map-" + i, ingredientId: row.ingredientId, preparedState: "raw", consumedUnit: "g", skuId: "buy-" + i, purchaseState: "raw", purchaseUnit: "g", formDigest: "d".repeat(64), category: "pantry", perishable: false, factor: { min: amount("1"), max: amount("1") }, sourceSha256: "e".repeat(64) }));
  const requirements = correspondences.map(row => ({ skuId: row.skuId, category: row.category, unit: "g", formDigest: row.formDigest, perishable: false, purchasedNeed: { numerator: 1, denominator: 1 } }));
  const pantry = requirements.map(row => ({ skuId: row.skuId, unit: row.unit, formDigest: row.formDigest, quantity: { numerator: 1, denominator: 1 } }));
  return { demands, correspondences, requirements, pantry };
}
const quoteRequest = { region: "South", storeIds: ["fixture-shop"], budgetCents: 10000, asOfDate: "2026-10-18" };

test("current preparation supports80and1000foods while legacy preparation retains its79boundary", () => {
  for (const n of [79, 80, 1000, 1001]) {
    const f = inputs(n), legacy = preparePurchaseRequirements(f.demands, f.correspondences), current = prepareReferencePurchaseRequirements(f.demands, f.correspondences);
    assert.equal(legacy.outcome, n <= 79 ? "prepared" : "held"); assert.equal(current.outcome, n <= 1000 ? "prepared" : "held");
    if (current.outcome === "prepared") assert.equal(current.requirements.length, n);
    if (n > 1000) assert.deepEqual(current, { outcome: "held", code: "quote_requirement_capacity_exceeded" });
  }
});

test("regional reference quotes cover80and1000owned foods and explicitly hold1001without truncation", () => {
  for (const n of [79, 80, 1000, 1001]) {
    const f = inputs(n), result = quoteRegionalEstimates(quoteRequest, f.requirements, f.pantry, []);
    assert.equal(result.outcome, n <= 1000 ? "quoted" : "held");
    if (result.outcome === "quoted") { assert.equal(result.rows.length, n); assert.equal(result.ownedRemaining.length, n); assert.equal(result.uniqueBuyItemCount, 0); assert.deepEqual(result.estimatedTotalCents, { min: 0, max: 0 }); }
    else if (n > 1000) assert.equal(result.code, "regional_quote_capacity_exceeded");
  }
});

test("a closed80ingredient source passes the full current projector preparation and quote path", () => {
  const original = setup(), row = structuredClone(original.rows[0]!), f = inputs(80);
  row.recipe.ingredients = f.demands.map(food => ({ id: food.ingredientId, name: "Synthetic " + food.ingredientId, quantity: "1", unit: "g", state: "raw" }));
  row.recipe.steps[0]!.allocations = row.recipe.ingredients.map(food => ({ id: food.id, quantity: food.quantity, unit: food.unit }));
  row.recipe_sha256 = sha(JSON.stringify(canonicalReferenceData(row.recipe))); row.nutrition.source_refresh.exact_recipe_body_sha256 = row.recipe_sha256; row.nutrition.source_refresh.recipe_sha256_unchanged = row.recipe_sha256;
  const bytes = Buffer.from(JSON.stringify(row) + "\n"), facts = f.correspondences.map((food, i) => ({ id: "pack-" + i, skuId: food.skuId, unit: "g", formDigest: food.formDigest, region: "South", packQuantity: amount("1"), packPriceCents: { min: 1, max: 2 }, currency: "USD", observedOn: "2026-10-01", usableThrough: "2026-10-31", sourceSha256: "f".repeat(64), basis: "synthetic-test-only", flags: ["not-real-food-or-market-data"] }));
  const bound = createJoinedReferencePlanner(bytes, { sourcePin: { sha256: sha(bytes), recordCount: 1 }, correspondences: f.correspondences, regionalPackFacts: facts });
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const request = { ...original.request, people: [original.request.people[0]], selectedDays: [original.request.selectedDays[0]] }, assignments = [{ ...original.assignments[0]!, recipeSha256: row.recipe_sha256 }];
  for (const covered of [40, 80]) {
    const pantry = f.pantry.slice(0, covered).map(stock => ({ ...stock, quantity: { numerator: 3, denominator: 2 } })), result = bound.planner.evaluateJoined(assignments, { ...request, pantry });
    assert.equal(result.outcome, "success"); if (result.outcome !== "success") continue;
    assert.equal(result.quote.rows.length, 80); assert.equal(result.quote.uniqueBuyItemCount, 80 - covered); assert.equal(result.quote.estimatedTotalCents.max, (80 - covered) * 4);
    assert.deepEqual(result.projection.personDays[0]!.nutrition.totals!.protein_g.min, amount("90")); assert.equal(result.productReady, false);
  }
});

test("larger current preparation remains exact and deterministic without changing caller data", () => {
  const f = inputs(168), before = JSON.stringify(f), result = prepareReferencePurchaseRequirements(f.demands, f.correspondences);
  assert.equal(result.outcome, "prepared"); assert.deepEqual(prepareReferencePurchaseRequirements([...f.demands].reverse(), [...f.correspondences].reverse()), result); assert.equal(JSON.stringify(f), before);
  const foreign = { ...f.correspondences[0]!, purchaseState: "cooked", consumedUnit: "ml" };
  assert.equal(prepareReferencePurchaseRequirements([f.demands[0]], [foreign]).outcome, "held");
});
