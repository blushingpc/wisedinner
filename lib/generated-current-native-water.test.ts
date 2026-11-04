import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createReviewedCurrentNativeTapCookingWaterClassifier, createTapCookingWaterClassifier, REVIEWED_CURRENT_NATIVE_PIN } from "./generated-tap-cooking-water.ts";
import type { ConsumedDemand } from "../packages/solver/src/generated-plan-requirements.ts";

// Local source-bound engineering tests. Provider, price and adoption facts are
// established separately; these fixtures do not certify any of them.
const main = "C:/Users/borgh/Documents/ChatGPT/wisedinner";
const original = readFileSync(main + "/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl", "utf8");
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
assert.equal(sha(original), "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0");
function ordered(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(ordered);
  return v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, ordered((v as Record<string, unknown>)[k])])) : v;
}
const rows = original.trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
const source = rows.map(row => { const r = structuredClone(row); delete r.nutrition.ingredient_details; return JSON.stringify(ordered(r)); }).join("\n") + "\n";
assert.equal(sha(source), REVIEWED_CURRENT_NATIVE_PIN.sha256);
const derivation = JSON.parse(readFileSync("C:/Users/borgh/Projects/wisedinner-app/tasks/apple-preorder-minimum-2026-10-22/native-integration-20261030/CURRENT-PLANNING-DERIVATION.json", "utf8"));
const cases = JSON.parse(readFileSync(main + "/reports/backend-readiness-20261016-01/plan-review-20261018-01/parallel-coordination-20261020/parallel-packets/contracts/contract-freeze-02/source-bound-cases.json", "utf8"));
const configuration = { ...cases.fixtureEvidence.cookingWaterConfiguration, sourcePin: REVIEWED_CURRENT_NATIVE_PIN, derivation };
const heldSource = { outcome: "held", code: "tap_water_source_mismatch" };
const heldReview = { outcome: "held", code: "tap_water_review_required" };
const row = rows.find(r => r.recipe.ingredients.some((i: { id: string }) => i.id === "process_water"));
function demand(id: string, amount = { numerator: "300", denominator: "1" }): ConsumedDemand {
  const ingredient = row.recipe.ingredients.find((i: { id: string }) => i.id === id);
  return { assignmentId: "meal", recipeId: row.id, recipeSha256: row.recipe_sha256, ingredientId: id, preparedState: ingredient.state, baseUnit: ingredient.unit, amount };
}

test("only the independently reviewed current derivative binds", () => {
  const current = createReviewedCurrentNativeTapCookingWaterClassifier(source, configuration);
  assert.equal(current.outcome, "ready");
  assert.deepEqual(createTapCookingWaterClassifier(source, configuration), { outcome: "error", code: "invalid_tap_water_configuration" });
  assert.deepEqual(createReviewedCurrentNativeTapCookingWaterClassifier(source + " ", configuration), heldSource);
  assert.deepEqual(createReviewedCurrentNativeTapCookingWaterClassifier(source.replace('"potable"', '"bottled"'), configuration), heldSource);
});

test("parent proof, complete row manifest and exact source pin cannot be substituted", () => {
  const changed = structuredClone(configuration);
  changed.derivation.parentSourcePin.sha256 = "0".repeat(64);
  assert.deepEqual(createReviewedCurrentNativeTapCookingWaterClassifier(source, changed), heldReview);
  const missing = structuredClone(configuration);
  missing.derivation.sourceRows.pop();
  assert.deepEqual(createReviewedCurrentNativeTapCookingWaterClassifier(source, missing), heldReview);
  assert.deepEqual(createReviewedCurrentNativeTapCookingWaterClassifier(source, { ...configuration, sourcePin: { ...REVIEWED_CURRENT_NATIVE_PIN, recordCount: 1299 } }), heldSource);
});

test("water is excluded from food purchases while food and lexical amounts are preserved", () => {
  const binding = createReviewedCurrentNativeTapCookingWaterClassifier(source, configuration);
  assert.equal(binding.outcome, "ready");
  if (binding.outcome !== "ready") throw Error("Missing classifier");
  const foodId = row.recipe.ingredients.find((i: { id: string }) => i.id !== "process_water").id;
  for (const amount of [{ numerator: "0", denominator: "7" }, { numerator: "2", denominator: "4" }, { numerator: "300", denominator: "1" }]) {
    const input = [demand("process_water", amount), demand(foodId, { numerator: "2", denominator: "4" })];
    const before = structuredClone(input), result = binding.partition(input);
    assert.equal(result.outcome, "partitioned");
    if (result.outcome !== "partitioned") throw Error("Missing partition");
    assert.deepEqual(result.utilityUsage, [input[0]]);
    assert.deepEqual(result.foodDemands, [input[1]]);
    assert.deepEqual(input, before);
    assert.match(result.basisSha256, /^[a-f0-9]{64}$/);
  }
});

test("forged recipe hashes and unsupported forms remain rejected", () => {
  const binding = createReviewedCurrentNativeTapCookingWaterClassifier(source, configuration);
  if (binding.outcome !== "ready") throw Error("Missing classifier");
  assert.deepEqual(binding.partition([{ ...demand("process_water"), recipeSha256: "0".repeat(64) }]), { outcome: "error", code: "invalid_tap_water_demands" });
  assert.deepEqual(binding.partition([{ ...demand("process_water"), preparedState: "bottled" }]), heldSource);
  const changed = structuredClone(configuration);
  changed.reviewedForms[0].exactForm.name = "Any water";
  assert.deepEqual(createReviewedCurrentNativeTapCookingWaterClassifier(source, changed), heldReview);
});
