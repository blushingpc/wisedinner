import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { setup } from "./generated-joined-plan.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createAllocationEvidenceReader } from "./generated-allocation-evidence.ts";

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const seal = (value: unknown) => sha(JSON.stringify(canonicalReferenceData(value)));
const exact = (numerator: string, denominator = "1") => ({ numerator, denominator });
const regions = ["Northeast", "Midwest", "South", "West"];
function fixture(options: { mainIngredientChanges?: Record<string, unknown>; breakfastFood?: "a" | "b" | "none"; breakfastMin?: string; breakfastMax?: string; quantity?: string; utility?: boolean; mixed?: boolean; mainDenominator?: string } = {}) {
  const rows = structuredClone(setup().rows), mainSource = { kind: "synthetic-main-reference" }, sourceRef = seal(mainSource), flags = ["synthetic-main-only"], flagsRef = seal(flags);
  if (options.quantity) { rows[0]!.recipe.ingredients[0]!.quantity = options.quantity; rows[0]!.recipe.steps[0]!.allocations[0]!.quantity = options.quantity; }
  if (options.utility) { rows[0]!.recipe.ingredients.push({ id: "process_water", name: "Water for cooking", quantity: "50", unit: "g", state: "potable tap water" }); rows[0]!.recipe.steps[0]!.allocations.push({ id: "process_water", quantity: "50", unit: "g" }); }
  if (options.mixed) { rows[0]!.recipe.ingredients.push({ ...rows[1]!.recipe.ingredients[0]! }); rows[0]!.recipe.steps[0]!.allocations.push({ ...rows[1]!.recipe.steps[0]!.allocations[0]! }); }
  for (const row of rows) { const hash = seal(row.recipe); row.recipe_sha256 = hash; row.nutrition.source_refresh.exact_recipe_body_sha256 = hash; row.nutrition.source_refresh.recipe_sha256_unchanged = hash; }
  const line = { ingredient: { ...rows[0]!.recipe.ingredients[0], quantity: "50", ...options.mainIngredientChanges }, utility_excluded: false, purchase: { yield: { holds: ["synthetic-yield-limit"] } }, flags, regions: Object.fromEntries(regions.map(region => [region, { exact_min: exact("1", options.mainDenominator), exact_max: exact("2", options.mainDenominator), source: { kind: mainSource.kind, reference: sourceRef }, flagsRef, observed_checkout: false }])) };
  const ingredientLines: Record<string, unknown> = { [seal(line)]: line };
  if (options.utility) { const utility = { ingredient: rows[0]!.recipe.ingredients[1], utility_excluded: true, purchase: null, regions: {}, flags: ["grocery-utility-exclusion"] }; ingredientLines[seal(utility)] = utility; }
  const main = { schema: "wd-generated-planner-catalog-v1", budgetBasis: "fractional-ingredient-allocation", wholePackCheckoutSupported: false, productAccepted: false, regions, ingredientLines, priceSources: { [sourceRef]: mainSource }, priceFlags: { [flagsRef]: flags } };
  const selected = options.breakfastFood === "a" ? rows[0]! : rows[1]!, ingredient = { ...selected.recipe.ingredients[0], quantity: "100" };
  const breakfastIngredient = { ingredient, ingredient_sha256: seal(ingredient), nutrition_flags: ["synthetic-density-reference"], nutrition_holds: [], regions: Object.fromEntries(regions.map(region => [region, { status: "calculated-conditional-estimate", cost_usd: { exact_min: options.breakfastMin ?? "3", exact_max: options.breakfastMax ?? "4" }, flags: ["synthetic-breakfast-only"], holds: [], source: { kind: "synthetic-breakfast-reference" } }])) };
  const breakfast = [{ id: "fixture-breakfast-price", flags: ["synthetic-only"], acceptance: { planner_eligible: false, kitchen_tested: false, allergen_reviewed: false, app_imported: false }, ingredients: options.breakfastFood === "none" ? [] : [breakfastIngredient] }];
  const currentBytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n"), mainBytes = Buffer.from(JSON.stringify(main)), breakfastBytes = Buffer.from(breakfast.map(row => JSON.stringify(row)).join("\n") + "\n");
  const pins = { current: { sha256: sha(currentBytes), recordCount: rows.length }, mainSha256: sha(mainBytes), breakfastSha256: sha(breakfastBytes), breakfastRecordCount: breakfast.length };
  return { rows, currentBytes, mainBytes, breakfastBytes, pins, bind() { return createAllocationEvidenceReader(currentBytes, mainBytes, breakfastBytes, pins); } };
}
function ready(f = fixture()) { const bound = f.bind(); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw new Error("Expected private synthetic price evidence"); return { ...f, reader: bound.reader }; }

test("exact food/form/unit matching scales source input allocations without another yield or checkout claim", () => {
  const { reader } = ready(), a = reader.estimateRecipe("a", "South"), b = reader.estimateRecipe("b", "South");
  assert.equal(a.outcome, "estimate"); if (a.outcome !== "estimate" || b.outcome !== "estimate") return;
  assert.equal(a.status, "conditional"); assert.deepEqual(a.wholeBatchUsd, { min: exact("2"), max: exact("4") }); assert.deepEqual(a.perSourceServingUsd, { min: exact("1"), max: exact("2") });
  assert.deepEqual(b.wholeBatchUsd, { min: exact("6"), max: exact("8") }); assert.equal(a.wholePackCheckoutSupported, false); assert.equal(a.observedRegionalMean, false); assert.equal(a.productAccepted, false);
  assert.ok(a.flags.includes("synthetic-yield-limit")); assert.equal(a.basis, "ingredient-input-allocation-only");
});

test("missing or differently named/state/unit food never borrows a convenient price or promotes a subtotal", () => {
  for (const changes of [{ name: "Different food" }, { state: "cooked" }, { unit: "ml" }, { id: "different-id" }]) {
    const { reader } = ready(fixture({ mainIngredientChanges: changes, breakfastFood: "none" })), result = reader.estimateRecipe("a", "South");
    if (result.outcome !== "estimate") throw new Error("Expected held allocation estimate"); assert.equal(result.status, "held"); assert.equal(result.wholeBatchUsd, null); assert.equal(result.perSourceServingUsd, null); assert.equal(result.knownSubtotalUsd, null); assert.equal(result.missingIngredients[0]!.ingredientId, "food-a");
  }
});

test("multiple model ranges use a flagged envelope and retain every source limit", () => {
  const { reader } = ready(fixture({ breakfastFood: "a", breakfastMin: "1", breakfastMax: "5" })), result = reader.estimateRecipe("a", "South");
  if (result.outcome !== "estimate") throw new Error("Expected estimate");
  assert.deepEqual(result.wholeBatchUsd, { min: exact("1"), max: exact("5") }); assert.ok(result.flags.includes("multiple-source-model-envelope")); assert.ok(result.flags.includes("synthetic-main-only")); assert.ok(result.flags.includes("synthetic-breakfast-only"));
});

test("a known subtotal stays explicitly partial when another ingredient lacks evidence", () => {
  const { reader } = ready(fixture({ mixed: true, breakfastFood: "none" })), result = reader.estimateRecipe("a", "Midwest");
  if (result.outcome !== "estimate") throw new Error("Expected held allocation");
  assert.equal(result.status, "held"); assert.equal(result.wholeBatchUsd, null); assert.equal(result.perSourceServingUsd, null);
  assert.deepEqual(result.knownSubtotalUsd, { min: exact("2"), max: exact("4") }); assert.equal(result.missingIngredients[0]!.ingredientId, "food-b");
});

test("source hashes guard before parse and malformed or promoted evidence refuses", () => {
  const f = fixture(); assert.equal(createAllocationEvidenceReader(f.currentBytes, Buffer.from("invalid-json"), f.breakfastBytes, f.pins).outcome, "error");
  for (const mutate of [(main: Record<string, unknown>) => { main.wholePackCheckoutSupported = true; }, (main: Record<string, unknown>) => { main.productAccepted = true; }, (main: Record<string, unknown>) => { main.priceFlags = {}; }]) {
    const main = JSON.parse(f.mainBytes.toString()); mutate(main); const bytes = Buffer.from(JSON.stringify(main));
    assert.equal(createAllocationEvidenceReader(f.currentBytes, bytes, f.breakfastBytes, { ...f.pins, mainSha256: sha(bytes) }).outcome, "error");
  }
  assert.equal(fixture({ breakfastMin: "1/0" }).bind().outcome, "error"); assert.equal(fixture({ breakfastMin: "5", breakfastMax: "4" }).bind().outcome, "error");
});

test("preparation water is excluded only under the exact source utility identity, not made free food", () => {
  const { reader } = ready(fixture({ utility: true })), result = reader.estimateRecipe("a", "South");
  if (result.outcome !== "estimate") throw new Error("Expected source allocation"); assert.equal(result.status, "conditional"); assert.equal(result.utilityExclusions.length, 1); assert.equal(result.pricedIngredientCount, 1); assert.deepEqual(result.wholeBatchUsd, { min: exact("2"), max: exact("4") });
});

test("exact quantity scaling agrees with independent rational arithmetic throughout a bounded domain", () => {
  for (let n = 1; n <= 24; n++) {
    const f = ready(fixture({ quantity: `${n}/3` })), before = sha(f.currentBytes), result = f.reader.estimateRecipe("a", "West");
    if (result.outcome !== "estimate" || !result.wholeBatchUsd) throw new Error("Expected complete conditional input cost");
    assert.equal(BigInt(result.wholeBatchUsd.min.numerator) * BigInt(150), BigInt(n) * BigInt(result.wholeBatchUsd.min.denominator));
    assert.equal(BigInt(result.wholeBatchUsd.max.numerator) * BigInt(75), BigInt(n) * BigInt(result.wholeBatchUsd.max.denominator)); assert.equal(sha(f.currentBytes), before);
  }
});

test("unknown recipe/region and constructor getters refuse without implicit defaults", () => {
  const f = ready(); assert.equal(f.reader.estimateRecipe("missing", "South").outcome, "error"); assert.equal(f.reader.estimateRecipe("a", "unknown").outcome, "error"); let reads = 0;
  const pins = Object.defineProperty({ ...f.pins }, "mainSha256", { enumerable: true, get() { reads++; throw new Error("Not read"); } });
  assert.equal(createAllocationEvidenceReader(f.currentBytes, f.mainBytes, f.breakfastBytes, pins).outcome, "error"); assert.equal(reads, 0);
});

test("source pin metadata is snapshotted without freezing or following caller-owned configuration", () => {
  const f = fixture(), bound = f.bind(); if (bound.outcome !== "ready") throw new Error("Expected synthetic binding");
  const expected = f.pins.current.sha256; bound.reader.audit(); assert.equal(Object.isFrozen(f.pins.current), false);
  f.pins.current.sha256 = "0".repeat(64); assert.equal(bound.reader.audit().sourcePins.current.sha256, expected);
});

test("valid combined source rationals beyond240digits remain exact within the legacy1234digit envelope", () => {
  const a = String(BigInt(10) ** BigInt(130) + BigInt(7)), b = String(BigInt(10) ** BigInt(137) + BigInt(9));
  const { reader } = ready(fixture({ mixed: true, mainDenominator: a, breakfastMin: `1/${b}`, breakfastMax: `2/${b}` })), result = reader.estimateRecipe("a", "Northeast");
  if (result.outcome !== "estimate") throw new Error("Expected synthetic allocation estimate");
  assert.equal(result.status, "conditional"); assert.ok(result.wholeBatchUsd!.min.denominator.length > 240);
  const min = result.wholeBatchUsd!.min;
  assert.equal(BigInt(min.numerator) * BigInt(a) * BigInt(b), BigInt(2) * (BigInt(a) + BigInt(b)) * BigInt(min.denominator));
});

const root = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake", current = root + "/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl", main = root + "/runtime/meal-planner/catalog-08d1e15ba2a14ab686abbdebf02f8a57/catalog.json", breakfast = root + "/runtime/breakfast-cost-repair/repair-20261015-01/export-01/calculations.jsonl";
test("actual current1300 and sealed main/breakfast evidence audit preserves missing ingredients and every source hold", { skip: ![current, main, breakfast].every(existsSync) && "External pinned source missing; not current evidence acceptance" }, () => {
  const bytes = [readFileSync(current), readFileSync(main), readFileSync(breakfast)], before = bytes.map(sha), bound = createAllocationEvidenceReader(bytes[0], bytes[1], bytes[2]);
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const audit = bound.reader.audit(); assert.equal(audit.recipes, 1300); assert.equal(audit.ingredientOccurrences, 10189); assert.equal(audit.exactMatchedOccurrences, 8339); assert.equal(audit.completeAllocationRecipes, 572); assert.equal(audit.missingSignatures.length, 58); assert.equal(audit.wholePackCheckoutSupported, false); assert.equal(audit.observedRegionalMean, false); assert.equal(audit.currentHeldNutritionRecipes, 5);
  assert.deepEqual(bytes.map(sha), before);
});
