import assert from "node:assert/strict";
import { test } from "node:test";
import { RECIPES } from "./authored/recipes.ts";
import { expandRecipes } from "./expand.ts";
import { EQUIPMENT, PREPARATION_VERSION, preparationCoverage, resolvePreparation } from "./authored/preparation.ts";

const id = "egg-white-and-veggie-scramble-with-toast";
const source = () => structuredClone(expandRecipes(RECIPES));
test("base and potato instructions consume both declared whole eggs, preserve quantities and use doneness rather than time", () => {
  const actual = source();
  for (const recipeId of [id, id + "-potatoes"]) {
    const recipe = actual.recipes.find(row => row.id === recipeId)!;
    assert.match(recipe.steps.join(" "), /whisk.*two eggs.*egg whites/i);
    assert.match(recipe.steps.join(" "), /firm.*160 F.*stricter package/i);
    assert.equal(actual.ingredients.find(row => row.recipe_id === recipeId && row.sku_id === "eggs")!.qty, 2);
  }
});
test("every existing base and variant materializes independently; coverage holds all unauthored equipment records by exact ID", () => {
  const actual = source(), coverage = preparationCoverage();
  assert.equal(actual.recipes.length, RECIPES.length + RECIPES.reduce((sum, base) => sum + base.variants.length, 0));
  assert.deepEqual(coverage.map(row => row.id), actual.recipes.map(row => row.id));
  assert.equal(coverage.filter(row => row.state === "authored-local").length, 4);
  for (const entry of coverage) {
    const result = resolvePreparation(actual, entry.id, EQUIPMENT);
    assert.equal(result.state === "authored-local", entry.state === "authored-local", entry.id);
  }
  for (const base of RECIPES) for (const variant of base.variants) {
    assert.notEqual(actual.recipes.find(row => row.id === variant.id)!.steps, base.steps, variant.id);
  }
});
test("four authored methods account for exact full ingredient rows and have variant-specific protein treatment", () => {
  const actual = source();
  for (const recipeId of [id, id + "-eggs", id + "-tofu", id + "-potatoes"]) {
    const before = JSON.stringify(actual);
    const result = resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, recipeId.endsWith("-potatoes") ? "boiled-potatoes" : "pan-toast");
    assert.equal(result.state, "authored-local");
    if (result.state !== "authored-local") throw Error("missing authoring");
    assert.deepEqual(result.ingredients, actual.ingredients.filter(row => row.recipe_id === recipeId).map(row => [row.sku_id, row.qty, row.unit]));
    assert.match(result.method.steps.join(" "), /measured oil/);
    assert.match(result.method.steps.join(" "), /peppers and onions/);
    assert.match(result.method.steps.join(" "), recipeId.endsWith("-tofu") ? /tofu/ : recipeId.endsWith("-eggs") ? /four eggs/ : /two eggs.*egg whites/);
    assert.doesNotMatch(result.method.steps.join(" "), recipeId.endsWith("-tofu") ? /egg whites|four eggs|160 F/ : /tofu/);
    assert.match(result.method.steps.join(" "), recipeId.endsWith("-potatoes") ? /potatoes.*water.*drain/ : /bread.*dry nonstick pan/);
    assert.equal(JSON.stringify(actual), before);
  }
});
test("equipment subset chooses authored pan alternative without assuming toaster, oven, microwave or air fryer", () => {
  const owned = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer"];
  const result = resolvePreparation(source(), id, owned);
  assert.equal(result.state, "authored-local");
  if (result.state !== "authored-local") throw Error("missing alternative");
  assert.equal(result.method.id, "pan-toast");
  assert.ok(result.method.equipment.every(item => owned.includes(item)));
  assert.equal(resolvePreparation(source(), id, owned.filter(item => item !== "food-thermometer")).state, "held");
  assert.equal(resolvePreparation(source(), id, owned, PREPARATION_VERSION, "authored-primary").state, "held");
});
test("potato microwave and saucepan alternatives have their own honest steps and required tools", () => {
  const result = resolvePreparation(source(), id + "-potatoes", EQUIPMENT, PREPARATION_VERSION, "boiled-potatoes");
  assert.equal(result.state, "authored-local");
  if (result.state !== "authored-local") throw Error("missing alternative");
  assert.doesNotMatch(result.method.steps.join(" "), /microwave/);
  assert.ok(result.method.equipment.includes("saucepan"));
  assert.equal(result.timing.alternativeMinutes, null);
  assert.equal(result.timing.measured, false);
  const primary = resolvePreparation(source(), id + "-potatoes", EQUIPMENT);
  assert.equal(primary.state, "authored-local");
  if (primary.state === "authored-local") assert.match(primary.method.steps.join(" "), /microwave-safe.*fork/i);
});
test("unknown, sparse, duplicate, accessor and missing equipment refuse without invoking getters", () => {
  let reads = 0;
  const accessor: string[] = [];
  Object.defineProperty(accessor, "0", { get() { reads++; return "stovetop"; } });
  for (const owned of [null, [], ["air-fryer"], ["stovetop", "stovetop"], new Array<string>(2), accessor]) {
    assert.equal(resolvePreparation(source(), id, owned).state, "held");
  }
  assert.equal(reads, 0);
  assert.equal(resolvePreparation(source(), "unknown", EQUIPMENT).state, "held");
  assert.equal(resolvePreparation(source(), id, EQUIPMENT, PREPARATION_VERSION, "oven-guessed").state, "held");
});
test("stale version and changed or late materialization refuse; successful result copies cannot alter subsequent reads", () => {
  assert.equal(resolvePreparation(source(), id, EQUIPMENT, "old-version").state, "held");
  const mutations = [
    (s: ReturnType<typeof source>) => { s.ingredients.find(row => row.recipe_id === id)!.qty++; },
    (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === id)!.steps[0] = "Add unlisted sauce."; },
    (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === id)!.minutes++; },
    (s: ReturnType<typeof source>) => { s.recipes.push(structuredClone(s.recipes.find(row => row.id === id)!)); },
  ];
  for (const mutate of mutations) { const changed = source(); mutate(changed); assert.equal(resolvePreparation(changed, id, EQUIPMENT).state, "held"); }
  const earlier = resolvePreparation(source(), id, EQUIPMENT);
  if (earlier.state !== "authored-local") throw Error("normal result missing");
  earlier.ingredients[0][1] = 999;
  earlier.method.steps[0] = "Unknown method";
  const later = resolvePreparation(source(), id, EQUIPMENT);
  if (later.state !== "authored-local") throw Error("later normal result missing");
  assert.equal(later.ingredients[0][1], 8);
  assert.notEqual(later.method.steps[0], "Unknown method");
});
test("optional seasoning omission keeps complete instructions and cannot certify extras, diet safety, price or nutrients", () => {
  const actual = source(), before = JSON.stringify(actual);
  const result = resolvePreparation(actual, id + "-tofu", EQUIPMENT);
  assert.equal(result.state, "authored-local");
  if (result.state !== "authored-local") throw Error("missing result");
  assert.equal(result.seasoning.prompt, "Seasoning of your choice");
  assert.equal(result.seasoning.recommended, "Black pepper");
  assert.equal(result.seasoning.optional, true);
  assert.equal(result.seasoning.includedInQuotedTotal, false);
  assert.equal(result.seasoning.includedInNutrients, false);
  assert.equal(result.seasoning.allergenStatus, "unknown");
  assert.equal(result.restrictionAdmission, false);
  assert.equal(result.crossLaneAccepted, false);
  assert.equal(result.safety.allergySafe, false);
  assert.equal(result.safety.kitchenVerified, false);
  assert.equal(result.safety.timeAloneProvesDoneness, false);
  assert.doesNotMatch(result.method.steps.join(" "), /\b(?:pepper|salt|sauce|seasoning)\b/);
  assert.equal(JSON.stringify(actual), before);
  assert.equal("totalCents" in result, false);
  assert.equal("protein" in result, false);
});
