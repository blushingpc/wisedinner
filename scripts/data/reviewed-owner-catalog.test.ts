import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createReviewedOwnerCatalog } from "./reviewed-owner-catalog.ts";
import { previewRequest, decodePreview, encodePreview, eligibleRecipeIds, REGISTRY, SOURCE_REVISION } from "./reviewed-owner-model.ts";
import * as app from "../../../wisedinner-app/src/data/owner-reviewed-catalog.ts";
import original from "../../data/pipeline/reviewed-week/edible-catalog.json" with { type: "json" };
const context = createReviewedOwnerCatalog();
export const tools = ["stovetop", "nonstick-pan", "spatula", "food-thermometer", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools"];
const base = { owner: "10000000-0000-4000-8000-000000000001", planningRevision: 1, profileRevision: 1, registry: REGISTRY, budget: 60, protein: 150, kcalMin: 1800, kcalMax: 2800, diet: "none", allergies: [], household: 1, stores: ["kroger"], zip: "43215", seed: 7, equipment: tools };
for (const [profile, patch] of [["typical", {}], ["floor", { budget: 45, protein: 100, kcalMin: 1600, kcalMax: 2600 }], ["household-two", { budget: 120, household: 2 }]] as const) for (const seed of [0, 7, 19]) test(`real source ${profile}/${seed}: deterministic full-value portable meal/list join`, () => {
  const request = previewRequest({ ...base, ...patch, seed }), raw = context.solve(request), model = decodePreview(raw, request);
  assert.equal(raw, context.solve(request)); assert.deepEqual(model, app.decodePreview(raw, request)); assert(model.feasible);
  assert.equal(model.days.length, 5); assert.equal(model.days.flatMap(d => d.meals).length, 15); assert.equal(model.totalCents, model.list.reduce((n, r) => n + r.cents, 0));
  for (const day of model.days) for (const meal of day.meals) {
    const r = original.recipes.find(x => x.id === meal.id); assert(r); assert.deepEqual(meal.originalSteps, r.steps); assert.equal(meal.authoredMinutes, r.minutes); assert.equal(meal.sourceServings, r.servings);
    assert.deepEqual(meal.ingredients.map(i => [i.id, i.sourceQty, i.unit]), original.recipe_ingredients.filter(i => i.recipe_id === meal.id).map(i => [i.sku_id, i.qty, i.unit]));
    assert(meal.method.required.every(t => tools.includes(t))); assert.equal(meal.method.cookingVerified, false);
  }
  for (const row of model.list) { assert.equal(row.owned, 0); assert(Number.isInteger(row.packs)); assert(Math.abs(row.physical - row.edible / row.yield) < 1e-9); assert(Math.abs(row.trim + row.edible - row.physical) < 1e-9); assert(Math.abs(row.carryoverPhysical + row.physical - row.purchased) < 1e-9); }
  const carrots = model.list.find(r => r.id === "carrots"); assert(carrots); assert.equal(carrots.yield, .83); assert(carrots.trim > 0); assert.equal(model.productAdmitted, false); assert.equal(model.cookingAdmitted, false);
});
test("same portable/source bytes;63 identities,13 foods and42 original variant links", () => {
  assert.equal(readFileSync("scripts/data/reviewed-owner-model.ts", "utf8"), readFileSync("../wisedinner-app/src/data/owner-reviewed-catalog.ts", "utf8"));
  assert(readFileSync("scripts/data/reviewed-owner-source.json").equals(readFileSync("../wisedinner-app/src/data/reviewed-owner-source.json")));
  assert.equal(original.recipes.length, 63); assert.equal(original.skus.length, 13); assert.equal(original.recipe_variants.length, 42);
  assert.equal(eligibleRecipeIds(previewRequest(base)).length, 63);
});
test("source/approval/quantity/nutrient/yield/pack/price tampering refuses the actual factory", () => {
  for (const path of ["data/pipeline/reviewed-week/edible-catalog.json", "docs/ingredient-catalog/reviewed-week-reviews.json", "docs/ingredient-catalog/reviewed-week-approval.json", "docs/ingredient-catalog/reviewed-week-sources.json", "docs/ingredient-catalog/reviewed-week-labels.json", "docs/ingredient-catalog/usda-evidence.json"]) assert.throws(() => createReviewedOwnerCatalog(p => p === path ? Buffer.concat([readFileSync(p), Buffer.from(" ")]) : readFileSync(p)), /reviewed_source_held/);
});
test("captured reference context rechecks original source bytes before and after computation", () => {
  let changed = false;
  const current = createReviewedOwnerCatalog(p => changed && p === "data/kroger-map.json" ? Buffer.concat([readFileSync(p), Buffer.from(" ")]) : readFileSync(p));
  changed = true; assert.throws(() => current.solve(base), /reviewed_source_held/);
  let reads = 0;
  const late = createReviewedOwnerCatalog(p => { const raw = readFileSync(p); if (p === "data/kroger-map.json" && ++reads === 3) return Buffer.concat([raw, Buffer.from(" ")]); return raw; });
  assert.throws(() => late.solve(base), /reviewed_source_held/);
});
test("all nine allergen vocab values supported, unknown metadata not an unrestricted grant", () => {
  for (const allergy of ["peanuts", "tree-nuts", "dairy", "eggs", "wheat", "soy", "fish", "shellfish", "sesame"]) {
    const request = previewRequest({ ...base, allergies: [allergy] }), ids = eligibleRecipeIds(request);
    if (allergy === "soy") assert.equal(ids.length, 0); if (allergy === "eggs") assert(ids.every(id => !id.includes("eggs")));
    if (ids.length) { const raw = context.solve(request); assert.equal(decodePreview(raw, request).productAdmitted, false); }
  }
});
test("unsupported/known-none/missing tools, store/ZIP and restricted coverage refuse or report a real miss", () => {
  for (const equipment of [[], ["knife"], tools.filter(t => t !== "stovetop")]) assert.throws(() => context.solve({ ...base, equipment }), /reviewed_coverage_held/);
  for (const patch of [{ equipment: null }, { equipment: ["imaginary"] }, { stores: [] }, { stores: ["kroger", "aldi"] }, { zip: "33301" }, { registry: "wrong" }]) assert.throws(() => context.solve({ ...base, ...patch }));
  assert.throws(() => context.solve({ ...base, diet: "gluten-free" }), /reviewed_coverage_held/);
  const request = previewRequest({ ...base, diet: "vegan", budget: 50, protein: 100 }); const model = decodePreview(context.solve(request), request); assert.equal(model.feasible, false); assert(model.violations.length > 0);
});
test("descriptors, sparse/duplicate/prototype/extra request data reject without getter effects", () => {
  let effects = 0; const getter = { ...base }; Object.defineProperty(getter, "protein", { get() { effects++; return 150; }, enumerable: true });
  const toolsGetter = ["knife"]; Object.defineProperty(toolsGetter, "0", { get() { effects++; return "knife"; }, enumerable: true });
  for (const value of [getter, Object.create(base), { ...base, extra: true }, { ...base, equipment: toolsGetter }, { ...base, equipment: new Array(2) }, { ...base, equipment: ["knife", "knife"] }, { ...base, allergies: ["unknown"] }, { ...base, protein: -1 }, { ...base, budget: 60.001 }, { ...base, seed: -1 }]) assert.throws(() => previewRequest(value));
  assert.equal(effects, 0);
});
test("changed wire source/version/IDs/steps/qty/servings/nutrients/pack/cents and duplicate JSON reject both readers", () => {
  const request = previewRequest(base), raw = context.solve(request), model = decodePreview(raw, request), meal = model.days[0]?.meals[0], row = model.list[0]; assert(meal); assert(row);
  const ingredient = meal.ingredients[0]; assert(ingredient);
  const pairs: [string, string][] = [[`"source":"${SOURCE_REVISION}"`, '"source":"wrong"'], ['"version":1', '"version":2'], [JSON.stringify(meal.id), '"legacy-name"'], [JSON.stringify(meal.originalSteps), JSON.stringify([...meal.originalSteps, "Add oil."])], [`"sourceQty":${ingredient.sourceQty}`, `"sourceQty":${ingredient.sourceQty + 1}`], [`"sourceServings":${meal.sourceServings}`, `"sourceServings":${meal.sourceServings + 1}`], [`"protein":${meal.protein}`, '"protein":-1'], [`"packs":${row.packs}`, `"packs":${row.packs + 1}`], [`"yield":${row.yield}`, `"yield":${row.yield / 2}`], [`"totalCents":${model.totalCents}`, `"totalCents":${model.totalCents + 1}`]];
  for (const [before, after] of pairs) { const changed = raw.replace(before, after); assert.notEqual(changed, raw); assert.throws(() => decodePreview(changed, request), before); assert.throws(() => app.decodePreview(changed, request), before); }
  for (const changed of [raw.replace('"version":1', '"version":1,"version":1'), raw + " ", "{}", raw.replace('"family":', '"extra":true,"family":')]) assert.throws(() => decodePreview(changed, request));
  assert.equal(encodePreview(model.days.map(d => d.meals.map(m => m.id)), request), raw);
});
