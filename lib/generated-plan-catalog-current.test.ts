import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRevisedCatalogReader, loadRevisedCatalog, CURRENT_REVISED_CATALOG_PIN } from "./generated-plan-catalog.ts";

const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, v]) => [key, stable(v)]));
  return value;
}
function fixture() {
  const recipe = { title: "Synthetic test only", servings: 2, equipment: ["fixture-pan"], ingredients: [{ id: "fixture-food", name: "Synthetic ingredient", quantity: "100", unit: "g", state: "ready" }], steps: [{ id: 1, instruction: "Original synthetic direction remains unchanged.", allocations: [{ id: "fixture-food", quantity: "100", unit: "g" }] }] };
  const recipeHash = sha(JSON.stringify(stable(recipe)));
  const values = (scale: number) => ({ protein_g: { min: String(30 * scale), max: String(30 * scale) }, kcal: { min: String(254 * scale), max: String(254 * scale) }, carbs_g: { min: String(20 * scale), max: String(20 * scale) }, fat_g: { min: String(6 * scale), max: String(6 * scale) } });
  return { id: "fixture-recipe", kind: "main", sections: ["lunch", "dinner"], recipe, recipe_sha256: recipeHash, product_accepted: false, kitchen_tested: false, allergen_reviewed: false, regional_costs: null, image: null, flags: ["synthetic-not-real-food"], holds: [], nutrition: { status: "complete-conditional-USDA-input-estimate", servings: "2", flags: ["conditional-fixture"], missing_ingredients: [] as string[], whole_batch: values(2) as ReturnType<typeof values> | null, per_serving: values(1) as ReturnType<typeof values> | null, partial_whole_batch: values(2), source_refresh: { exact_recipe_body_sha256: recipeHash, recipe_sha256_unchanged: recipeHash, source_archive_sha256: "b".repeat(64) } } };
}
function source(rows = [fixture()]) {
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
  return { bytes, load: createRevisedCatalogReader({ sha256: sha(bytes), recordCount: rows.length }) };
}

test("lossless projection preserves recipe, exact nutrition and all uncertainty", () => {
  const row = fixture(); row.nutrition.per_serving!.protein_g = { min: "61/2", max: "61/2" }; row.nutrition.whole_batch!.protein_g = { min: "61", max: "61" };
  const { bytes, load } = source([row]), before = sha(bytes), result = load(bytes);
  assert.equal(result.outcome, "success");
  if (result.outcome !== "success") throw new Error("Expected synthetic projection");
  const projected = result.recipes[0]!;
  assert.deepEqual(projected.recipe, row.recipe);
  assert.equal(projected.recipeSha256, row.recipe_sha256);
  assert.equal(projected.nutrition.status, "conditional");
  assert.deepEqual(projected.nutrition.perServing!.protein_g.min, { numerator: "61", denominator: "2" });
  assert.equal(projected.capabilities.regionalPrice, "held");
  assert.equal(projected.capabilities.wholePackCheckout, "held");
  assert.equal(projected.capabilities.imageBinding, "held");
  assert.equal(projected.plannerAdopted, false); assert.equal(result.productAccepted, false);
  assert.equal(sha(bytes), before);
  assert.equal(projected.source.product_accepted, false);
  assert.deepEqual(projected.nutrition.flags, row.nutrition.flags);
});

test("exact fractional ingredient quantities retain their original source spelling", () => {
  const row = fixture(); row.recipe.ingredients[0]!.quantity = "4/5"; row.recipe.steps[0]!.allocations[0]!.quantity = "4/5";
  const digest = sha(JSON.stringify(stable(row.recipe))); row.recipe_sha256 = digest;
  row.nutrition.source_refresh.exact_recipe_body_sha256 = digest; row.nutrition.source_refresh.recipe_sha256_unchanged = digest;
  const { bytes, load } = source([row]), result = load(bytes);
  assert.equal(result.outcome, "success");
  if (result.outcome === "success") assert.equal(result.recipes[0]!.recipe.ingredients[0]!.quantity, "4/5");
});

test("incomplete nutrition keeps full totals null and never promotes partial totals", () => {
  const row = fixture(); row.nutrition.status = "held-incomplete"; row.nutrition.missing_ingredients = ["fixture-missing"]; row.nutrition.per_serving = null; row.nutrition.whole_batch = null;
  const { bytes, load } = source([row]), result = load(bytes);
  assert.equal(result.outcome, "success");
  if (result.outcome === "success") {
    assert.equal(result.recipes[0]!.nutrition.status, "held");
    assert.equal(result.recipes[0]!.nutrition.perServing, null);
    assert.deepEqual(result.recipes[0]!.nutrition.missingIngredients, ["fixture-missing"]);
    assert.equal(result.summary.heldNutrition, 1);
  }
});

test("changed bytes refuse before parsing or source adaptation", () => {
  const { bytes, load } = source(), changed = Buffer.from(bytes); changed[0] = 0;
  assert.deepEqual(load(changed), { outcome: "error", code: "source_hash_mismatch" });
});

test("duplicate IDs, wrong recipe hashes and altered acceptance flags refuse", () => {
  const duplicate = fixture(); let selected = source([duplicate, duplicate]);
  assert.equal(selected.load(selected.bytes).outcome, "error");
  for (const mutate of [
    (row: ReturnType<typeof fixture>) => { row.recipe.steps[0]!.instruction = "Unbound replacement"; },
    (row: ReturnType<typeof fixture>) => { row.nutrition.source_refresh.exact_recipe_body_sha256 = "c".repeat(64); },
    (row: ReturnType<typeof fixture>) => { row.product_accepted = true; },
  ]) {
    const row = fixture(); mutate(row); selected = source([row]); assert.equal(selected.load(selected.bytes).outcome, "error");
  }
});

test("reversed, invalid or mismatched source nutrition never passes as complete", () => {
  for (const mutate of [
    (row: ReturnType<typeof fixture>) => { row.nutrition.per_serving!.protein_g = { min: "31", max: "30" }; },
    (row: ReturnType<typeof fixture>) => { row.nutrition.per_serving!.protein_g.min = "1/0"; },
    (row: ReturnType<typeof fixture>) => { row.nutrition.whole_batch!.kcal.max = "999"; },
    (row: ReturnType<typeof fixture>) => { row.nutrition.missing_ingredients = ["missing"]; },
    (row: ReturnType<typeof fixture>) => { row.nutrition.servings = "3"; },
  ]) {
    const row = fixture(); mutate(row); const { bytes, load } = source([row]);
    assert.deepEqual(load(bytes), { outcome: "error", code: "invalid_nutrition_evidence" });
  }
});

test("trusted pin is strict and malformed source cannot enter a catalog", () => {
  let reads = 0;
  const pin = Object.defineProperty({ recordCount: 1 }, "sha256", { enumerable: true, get() { reads++; throw new Error("Must not read getter"); } });
  assert.throws(() => createRevisedCatalogReader(pin), { message: "Invalid revised catalog pin" });
  assert.equal(reads, 0);
  assert.throws(() => createRevisedCatalogReader({ sha256: "x", recordCount: 1 }), { message: "Invalid revised catalog pin" });
  const bytes = Buffer.from("{invalid-json}\n"), load = createRevisedCatalogReader({ sha256: sha(bytes), recordCount: 1 });
  assert.deepEqual(load(bytes), { outcome: "error", code: "invalid_catalog_source" });
});

test("projection is immutable and isolated from later input-byte changes", () => {
  const { bytes, load } = source(), result = load(bytes);
  assert.equal(result.outcome, "success");
  if (result.outcome !== "success") throw new Error("Expected projection");
  assert.ok(Object.isFrozen(result)); assert.ok(Object.isFrozen(result.recipes[0]!.recipe.steps));
  const original = result.recipes[0]!.recipe.steps[0]!.instruction;
  assert.throws(() => { (result.recipes[0]!.recipe.steps[0] as { instruction: string }).instruction = "Mutated"; });
  bytes.fill(0); assert.equal(result.recipes[0]!.recipe.steps[0]!.instruction, original);
});

const CURRENT_SOURCE = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl";
test("actual pinned 1300 revised recipes preserve 1295 conditional and five held totals", { skip: existsSync(CURRENT_SOURCE) ? false : "External current-source artifact absent on this host; not current-source acceptance" }, () => {
  const bytes = readFileSync(CURRENT_SOURCE), before = sha(bytes), result = loadRevisedCatalog(bytes);
  assert.equal(result.outcome, "success");
  if (result.outcome !== "success") throw new Error("Pinned current catalog did not project");
  assert.equal(result.sourceSha256, CURRENT_REVISED_CATALOG_PIN.sha256);
  assert.deepEqual(result.summary, { total: 1300, main: 1000, breakfast: 300, conditionalNutrition: 1295, heldNutrition: 5 });
  assert.equal(new Set(result.recipes.map(row => row.id)).size, 1300);
  for (const row of result.recipes) {
    assert.equal(sha(JSON.stringify(stable(row.recipe))), row.recipeSha256);
    assert.equal(row.plannerAdopted, false);
    assert.equal(row.capabilities.regionalPrice, "held");
    assert.equal(row.source.product_accepted, false);
    if (row.nutrition.status === "held") assert.equal(row.nutrition.perServing, null);
  }
  assert.equal(sha(bytes), before); assert.equal(sha(readFileSync(CURRENT_SOURCE)), before);
});
