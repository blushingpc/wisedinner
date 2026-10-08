import test from "node:test";
import assert from "node:assert/strict";
import { RECIPES } from "./authored/recipes.ts";
import { expandRecipes } from "./expand.ts";
import { EQUIPMENT, PREPARATION_VERSION, resolvePreparation } from "./authored/preparation.ts";
import { preparedCatalog, restrictedPreparedCatalog, solvePreparedRestricted, preparedRestrictedCandidates, type PreparationContext } from "./prepared-selection.ts";
import { solveRestricted, restrictedCandidates } from "./catalog-selection.ts";
import { eligibleSnapshot, SAFETY } from "./ingredient-safety.ts";
import { solveBounded } from "./catalog-pool.ts";
import { loadSnapshot } from "../../packages/solver/test/helpers.ts";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { BASE } from "../../packages/solver/src/profiles.ts";
import { stageReviewed } from "./reviewed-week.ts";
import { readFileSync } from "node:fs";
import type { WeekApproval } from "./reviewed-week.ts";

const context = (ownedEquipment: readonly string[] = EQUIPMENT): PreparationContext => ({ source: expandRecipes(RECIPES), version: PREPARATION_VERSION, ownedEquipment });
// Actual authored materialization over unchanged committed SKUs/nutrients/prices.
// LOCAL fixture only; no review labels, new recipes, publication or kitchen proof.
const authoredSnapshot = () => {
  const source = expandRecipes(RECIPES);
  return { ...loadSnapshot(), recipes: source.recipes, recipe_ingredients: source.ingredients, recipe_variants: source.variants };
};
const input = { ...BASE, budget: 200, protein_per_day: 60, kcal_min: 100, kcal_max: 5000, seed: 7 };
const ids = (pool: ReturnType<typeof preparedCatalog>) => pool.snapshot.recipes.map(row => row.id);
const base = "egg-white-and-veggie-scramble-with-toast";
test("actual83 source: all equipment admits80 with81 local methods, two thigh holds and pork parent closure; every row/reference/method exact", () => {
  const snapshot = authoredSnapshot(), supplied = context(), before = JSON.stringify({ snapshot, supplied });
  const pool = preparedCatalog(snapshot, supplied);
  assert.equal(snapshot.recipes.length, 83);
  assert.equal(pool.snapshot.recipes.length, 80);
  assert.equal(pool.preparations.length, 80);
  assert.deepEqual(pool.excluded.map(row => row.id).sort(), ["bbq-chicken-with-roasted-vegetables-and-rice", "bbq-chicken-with-roasted-vegetables-and-rice-potatoes", "bbq-chicken-with-roasted-vegetables-and-rice-pork"].sort());
  assert.equal(pool.excluded.find(row => row.id.endsWith("-pork"))!.reason, "missing-compatible-parent");
  validateSnapshot(pool.snapshot);
  assert.equal(pool.crossLaneAccepted, false); assert.equal(pool.restrictionAdmission, false);
  for (const row of pool.preparations) {
    assert.deepEqual(row, resolvePreparation(supplied.source, row.id, EQUIPMENT));
    assert.deepEqual(row.ingredients, pool.snapshot.recipe_ingredients.filter(i => i.recipe_id === row.id).map(i => [i.sku_id, i.qty, i.unit]));
    assert.ok(row.method.equipment.every(tool => supplied.ownedEquipment.includes(tool)));
    assert.ok(row.method.steps.length >= 3); assert.ok(row.method.steps.every(step => step.trim()));
    assert.equal(row.seasoning.prompt, "Seasoning of your choice"); assert.ok(row.seasoning.recommended);
    assert.equal(row.seasoning.optional, true); assert.equal(row.seasoning.includedInQuotedTotal, false); assert.equal(row.seasoning.includedInNutrients, false); assert.equal(row.seasoning.allergenStatus, "unknown");
    assert.equal(row.crossLaneAccepted, false); assert.equal(row.restrictionAdmission, false); assert.equal(row.safety.kitchenVerified, false); assert.equal(row.safety.allergySafe, false);
  }
  assert.equal(JSON.stringify({ snapshot, supplied }), before);
  assert.deepEqual(preparedCatalog(snapshot, supplied), pool);
});
test("committed snapshot source-step mismatches remain excluded, never silently rewritten to authorship", () => {
  const snapshot = loadSnapshot(), supplied = context(), before = JSON.stringify(snapshot), pool = preparedCatalog(snapshot, supplied);
  const stale = snapshot.recipes.filter(row => JSON.stringify(row) !== JSON.stringify(supplied.source.recipes.find(source => source.id === row.id))).map(row => row.id);
  assert.equal(stale.length, 3);
  assert.ok(stale.every(id => !ids(pool).includes(id)));
  assert.ok(pool.excluded.some(row => row.reason === "uncovered-or-mismatched-recipe-source"));
  assert.equal(JSON.stringify(snapshot), before);
});
test("one missing actual tool excludes its method; no guessed appliances and honest no-compatible meal refusal", () => {
  const snapshot = authoredSnapshot();
  for (const owned of [[], ["oven"], ["microwave"], ["airfryer"]]) {
    if (owned.includes("airfryer")) assert.throws(() => preparedCatalog(snapshot, context(owned)), /Unknown preparation equipment/);
    else { assert.equal(preparedCatalog(snapshot, context(owned)).snapshot.recipes.length, 0); assert.throws(() => solveRestricted(input, snapshot, [], undefined, context(owned)), /Not enough reviewed recipes/); }
  }
  const withoutThermometer = preparedCatalog(snapshot, context(EQUIPMENT.filter(tool => tool !== "food-thermometer")));
  assert.equal(ids(withoutThermometer).includes("buffalo-chicken-bowl"), false);
  const noWhisk = preparedCatalog(snapshot, context(EQUIPMENT.filter(tool => tool !== "whisk")));
  assert.equal(ids(noWhisk).includes(base), false);
  assert.equal(ids(noWhisk).includes(base + "-tofu"), false, "compatible child cannot become a base when parent needs whisk");
});
test("only explicit alternative equipment methods can be chosen, unknown requested method refuses", () => {
  const snapshot = authoredSnapshot(), tools = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer"];
  const pool = preparedCatalog(snapshot, context(tools)), row = pool.preparations.find(row => row.id === base)!;
  assert.equal(row.method.id, "pan-toast");
  assert.equal(row.method.equipment.includes("toaster"), false);
  assert.match(row.method.steps.join(" "), /two eggs.*egg whites/);
  assert.match(row.method.steps.join(" "), /160 F/);
  assert.equal(preparedCatalog(snapshot, { ...context(tools), methodId: "guessed-airfryer" }).snapshot.recipes.length, 0);
  const berryTools = ["microwave", "microwave-safe-bowl", "microwave-safe-cover", "bowl", "spoon", "measuring-tools", "food-thermometer"];
  const berry = preparedCatalog(snapshot, context(berryTools)).preparations.find(row => row.id === "greek-yogurt-parfait-with-berries-and-granola")!;
  assert.equal(berry.method.id, "microwave-berries");
  assert.match(berry.method.steps.join(" "), /standing time/);
});
test("malformed equipment/context/source/snapshot accessors, sparse/duplicate/unknown lists refuse without executing getters", () => {
  let reads = 0; const accessor: string[] = [];
  Object.defineProperty(accessor, "0", { get() { reads++; return "oven"; } });
  for (const owned of [new Array<string>(2), accessor, ["oven", "oven"], ["unknown"], null]) assert.throws(() => preparedCatalog(authoredSnapshot(), context(owned as readonly string[])), /Malformed|Unknown/);
  for (const key of ["source", "version", "ownedEquipment"]) {
    const supplied = context(); Object.defineProperty(supplied, key, { get() { reads++; throw Error("Getter executed"); } });
    assert.throws(() => solveRestricted(input, authoredSnapshot(), [], undefined, supplied), /Malformed/);
  }
  const supplied = context(); Object.defineProperty(supplied.source.recipes[0], "steps", { get() { reads++; return []; } });
  assert.throws(() => preparedCatalog(authoredSnapshot(), supplied), /Malformed/);
  const snapshot = authoredSnapshot(); Object.defineProperty(snapshot.skus[0], "name", { get() { reads++; return "invented"; } });
  assert.throws(() => solveRestricted(input, snapshot, [], undefined, context()), /Malformed/);
  const badInput = { ...input }; Object.defineProperty(badInput, "diet", { get() { reads++; return "none"; } });
  assert.throws(() => solveRestricted(badInput, authoredSnapshot(), [], undefined, context()), /Malformed/);
  assert.throws(() => solvePreparedRestricted(badInput, authoredSnapshot(), [], context()), /Malformed/);
  const badWeek = { input: badInput } as Parameters<typeof restrictedCandidates>[0];
  assert.throws(() => restrictedCandidates(badWeek, 0, authoredSnapshot(), [], undefined, context()), /Malformed/);
  assert.throws(() => preparedRestrictedCandidates(badWeek, 0, authoredSnapshot(), [], context()), /Malformed/);
  assert.equal(reads, 0);
  assert.throws(() => preparedCatalog(authoredSnapshot(), { ...context(), version: "old" }), /version/);
  assert.throws(() => preparedCatalog(authoredSnapshot(), null as unknown as PreparationContext), /context|Malformed/);
});
test("snapshot/source ingredient quantity/unit/form/steps/serving/identity and variant-parent edits cannot inherit a matching name", () => {
  for (const mutate of [
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.recipe_ingredients.find(row => row.recipe_id === base)!.qty++; },
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.recipe_ingredients.find(row => row.recipe_id === base)!.unit = "g"; },
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.recipes.find(row => row.id === base)!.steps = ["Add unlisted sauce"]; },
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.recipes.find(row => row.id === base)!.servings = 2; },
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.skus.find(row => row.id === "eggs")!.name = "ready-cooked eggs"; },
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.skus.find(row => row.id === "eggs")!.grams_per_unit++; },
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.skus.find(row => row.id === "eggs")!.pack_qty++; },
    (snapshot: ReturnType<typeof authoredSnapshot>) => { snapshot.recipes.push(structuredClone(snapshot.recipes.find(row => row.id === base)!)); }
  ]) { const snapshot = authoredSnapshot(); mutate(snapshot); assert.equal(ids(preparedCatalog(snapshot, context())).includes(base), false); }
  for (const mutate of [
    (supplied: PreparationContext) => { supplied.source.ingredients.find(row => row.recipe_id === base)!.qty++; },
    (supplied: PreparationContext) => { supplied.source.recipes.find(row => row.id === base)!.name += " alias"; },
    (supplied: PreparationContext) => { supplied.source.recipes.find(row => row.id === base)!.steps.push("extra sauce"); },
    (supplied: PreparationContext) => { supplied.source.recipes.find(row => row.id === base)!.minutes++; }
  ]) { const supplied = context(); mutate(supplied); assert.equal(ids(preparedCatalog(authoredSnapshot(), supplied)).includes(base), false); }
  for (const target of ["snapshot", "source"]) {
    const snapshot = authoredSnapshot(), supplied = context(), links = target === "snapshot" ? snapshot.recipe_variants : supplied.source.variants;
    links.find(row => row.variant_recipe_id === base + "-tofu")!.recipe_id = "protein-pancakes-with-berries";
    assert.equal(ids(preparedCatalog(snapshot, supplied)).includes(base + "-tofu"), false);
  }
  const snapshot = authoredSnapshot(); snapshot.recipes.find(row => row.id === base)!.id = "same-name-alias";
  assert.equal(ids(preparedCatalog(snapshot, context())).includes("same-name-alias"), false);
});
test("existing safety admission cannot be bypassed; generated reviewed-week IDs lack exact authored methods and remain excluded", () => {
  const snapshot = authoredSnapshot(), before = JSON.stringify(snapshot);
  const old = eligibleSnapshot(snapshot, "none", ["soy"], SAFETY), pool = restrictedPreparedCatalog(snapshot, "none", ["soy"], context());
  assert.ok(ids(pool).every(id => old.recipes.some(row => row.id === id)));
  assert.equal(ids(pool).includes("protein-pancakes-with-berries-vegan"), false);
  assert.equal(restrictedPreparedCatalog(snapshot, "vegan", [], context(), {}).snapshot.recipes.length, 0);
  assert.throws(() => solvePreparedRestricted(input, snapshot, ["soy"], context(), {}), /Not enough reviewed/);
  assert.equal(JSON.stringify(snapshot), before);
  const approval = JSON.parse(readFileSync("docs/ingredient-catalog/reviewed-week-approval.json", "utf8")) as WeekApproval;
  const reviewed = stageReviewed(approval);
  const generated = preparedCatalog(reviewed.purchased, context());
  assert.equal(generated.snapshot.recipes.length, 0);
  assert.ok(generated.excluded.length > 0);
  assert.ok(generated.excluded.every(row => row.reason === "uncovered-or-mismatched-recipe-source"));
});
test("ordinary no-context solves/swaps preserve the exact existing path; explicit equipment solve binds selected IDs only with unchanged price/nutrients", () => {
  const snapshot = loadSnapshot(), before = JSON.stringify(snapshot);
  const legacy = solveRestricted(input, snapshot, []);
  assert.deepEqual(legacy, solveBounded(input, eligibleSnapshot(snapshot, input.diet, [])).out);
  assert.deepEqual(restrictedCandidates(legacy, 1, snapshot, []), restrictedCandidates(legacy, 1, snapshot, [], SAFETY, undefined));
  const supplied = context(), prepared = solvePreparedRestricted(input, snapshot, [], supplied), pool = preparedCatalog(snapshot, supplied);
  assert.deepEqual(prepared.out, solveBounded(input, pool.snapshot).out);
  const selectedIds = [...new Set(prepared.out.days.flatMap(day => day.items.map(item => item.recipe_id)))];
  assert.ok(selectedIds.length > 0);
  assert.deepEqual(prepared.preparations.map(row => row.id), selectedIds);
  assert.equal(prepared.crossLaneAccepted, false); assert.equal(prepared.restrictionAdmission, false);
  assert.deepEqual(solvePreparedRestricted(input, snapshot, [], supplied), prepared);
  assert.deepEqual(pool.snapshot.skus, snapshot.skus); assert.deepEqual(pool.snapshot.nutrition, snapshot.nutrition); assert.deepEqual(pool.snapshot.store_prices, snapshot.store_prices);
  assert.equal(JSON.stringify(snapshot), before);
  prepared.preparations[0].method.steps[0] = "Unlisted oil";
  assert.notEqual(solvePreparedRestricted(input, snapshot, [], supplied).preparations[0].method.steps[0], "Unlisted oil");
  const expensive = authoredSnapshot(); for (const sku of expensive.skus) sku.baseline_usd = 10000;
  expensive.store_prices = [];
  assert.throws(() => solvePreparedRestricted({ ...input, budget: 45 }, expensive, [], context()), /no recipe fits this diet at these stores/);
});
test("replacement rechecks all week anchors and binds candidates; stale/unprepared anchors and removed equipment refuse", () => {
  const snapshot = loadSnapshot(), supplied = context(), prepared = solvePreparedRestricted(input, snapshot, [], supplied);
  const pool = preparedCatalog(snapshot, supplied);
  for (const slot of [0, 1, 7]) {
    const swaps = preparedRestrictedCandidates(prepared.out, slot, snapshot, [], supplied);
    assert.deepEqual(swaps.candidates, restrictedCandidates(prepared.out, slot, snapshot, [], undefined, supplied));
    assert.deepEqual(swaps.preparations.map(row => row.id), [...new Set(swaps.candidates.map(row => row.recipe_id))]);
    for (const candidate of swaps.candidates) {
      assert.ok(ids(pool).includes(candidate.recipe_id));
      const weekIds = prepared.out.days.flatMap(day => day.items.map(item => item.recipe_id)); weekIds[slot] = candidate.recipe_id;
      evaluateWeek(weekIds, input, pool.snapshot);
    }
  }
  const bad = structuredClone(prepared.out); bad.days[0].items[0].recipe_id = "bbq-chicken-with-roasted-vegetables-and-rice";
  assert.throws(() => preparedRestrictedCandidates(bad, 1, snapshot, [], supplied), /not in the pool/);
  assert.throws(() => preparedRestrictedCandidates(prepared.out, 1, snapshot, [], context([])), /not in the pool/);
});
