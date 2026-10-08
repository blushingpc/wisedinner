import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { RECIPES } from "./authored/recipes.ts";
import { EQUIPMENT, PREPARATION_VERSION, resolvePreparation } from "./authored/preparation.ts";
import { expandRecipes } from "./expand.ts";
import { preparedMaterialization, PREPARED_INPUT_SHA256, RECONCILED_STEP_IDS } from "./prepared-materialization.ts";
import { preparedCatalog, restrictedPreparedCatalog, solvePreparedRestricted } from "./prepared-selection.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { BASE } from "../../packages/solver/src/profiles.ts";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";

const bytes = () => readFileSync("data/snapshot.json", "utf8");
const source = () => structuredClone(expandRecipes(RECIPES));
const candidate = () => preparedMaterialization(bytes(), source(), PREPARATION_VERSION);
const sha = (text: string) => createHash("sha256").update(text).digest("hex");
const context = (ownedEquipment: readonly string[] = EQUIPMENT) => ({ source: source(), version: PREPARATION_VERSION, ownedEquipment });
const input = { ...BASE, budget: 200, protein_per_day: 60, kcal_min: 100, kcal_max: 5000, seed: 7 };

test("exact83 LOCAL candidate changes only three steps; all other values/order and public bytes remain exact", () => {
  const beforeBytes = bytes(), original = JSON.parse(beforeBytes), authored = source(), beforeSource = JSON.stringify(authored);
  const result = preparedMaterialization(beforeBytes, authored, PREPARATION_VERSION);
  assert.equal(sha(beforeBytes), PREPARED_INPUT_SHA256); assert.equal(Buffer.byteLength(beforeBytes), 208918);
  assert.equal(result.snapshot.recipes.length, 83);
  assert.deepEqual(result.snapshot.recipes.map(row => row.id), original.recipes.map((row: { id: string }) => row.id));
  assert.deepEqual(result.snapshot.recipes, authored.recipes);
  assert.deepEqual(result.diffs.map(row => row.id), RECONCILED_STEP_IDS);
  assert.ok(result.diffs.every(row => JSON.stringify(row.before) !== JSON.stringify(row.after)));
  const restored = structuredClone(result.snapshot);
  for (const diff of result.diffs) restored.recipes.find(row => row.id === diff.id)!.steps = [...diff.before];
  assert.deepEqual(restored, original); // includes all dates/prices/stores/source fields and other80 rows
  assert.deepEqual(result.snapshot.recipe_ingredients, authored.ingredients); assert.deepEqual(result.snapshot.recipe_variants, authored.variants);
  assert.equal(JSON.stringify(authored), beforeSource); assert.equal(bytes(), beforeBytes);
  validateSnapshot(result.snapshot);
});

test("actual source directions and separate actual resolver include eggs/whites, tofu and potato quantities/physical handling without invented extras or timing", () => {
  const result = candidate(), base = RECONCILED_STEP_IDS[0];
  const eggRows = result.snapshot.recipe_ingredients.filter(row => row.recipe_id === base);
  assert.ok(eggRows.some(row => row.sku_id === "eggs" && row.qty === 2 && row.unit === "each"));
  assert.ok(eggRows.some(row => row.sku_id === "egg-whites" && row.qty === 8 && row.unit === "oz"));
  const stepText = (id: string) => result.snapshot.recipes.find(row => row.id === id)!.steps.join(" ");
  assert.match(stepText(base), /two eggs.*egg whites/); assert.match(stepText(base), /160 F.*stricter package/);
  assert.match(stepText(RECONCILED_STEP_IDS[1]), /Drain and pat dry.*measured oil.*package directions/);
  assert.match(stepText(RECONCILED_STEP_IDS[2]), /covered microwave-safe bowl with water.*fork/);
  for (const row of result.preparations.recipes) {
    assert.deepEqual(row.preparation, resolvePreparation(source(), row.id, EQUIPMENT, PREPARATION_VERSION));
    assert.equal(row.crossLaneAccepted, false); assert.equal(row.restrictionAdmission, false);
    if (row.preparation.state === "authored-local") {
      assert.deepEqual(row.preparation.ingredients, result.snapshot.recipe_ingredients.filter(i => i.recipe_id === row.id).map(i => [i.sku_id, i.qty, i.unit]));
      assert.equal(row.preparation.timing.measured, false);
      assert.equal(row.preparation.timing.declaredMinutes, result.snapshot.recipes.find(i => i.id === row.id)!.minutes);
      assert.equal(row.preparation.seasoning.optional, true); assert.equal(row.preparation.seasoning.includedInQuotedTotal, false);
      assert.equal(row.preparation.seasoning.includedInNutrients, false); assert.equal(row.preparation.seasoning.allergenStatus, "unknown");
      assert.equal(row.preparation.safety.kitchenVerified, false); assert.equal(row.preparation.safety.allergySafe, false);
    }
  }
});

test("actual preparation gate is80/3 candidate vs76/7 original, holds both thighs and pork parent; exact83 separate bindings", () => {
  const result = candidate(), after = preparedCatalog(result.snapshot, context()), before = preparedCatalog(JSON.parse(bytes()), context());
  assert.equal(after.snapshot.recipes.length, 80); assert.equal(before.snapshot.recipes.length, 76); assert.equal(before.excluded.length, 7);
  assert.deepEqual(after.excluded.map(row => row.id).sort(), ["bbq-chicken-with-roasted-vegetables-and-rice", "bbq-chicken-with-roasted-vegetables-and-rice-potatoes", "bbq-chicken-with-roasted-vegetables-and-rice-pork"].sort());
  assert.equal(after.excluded.find(row => row.id.endsWith("-pork"))!.reason, "missing-compatible-parent");
  assert.deepEqual(result.preparations.recipes.map(row => row.id), result.snapshot.recipes.map(row => row.id));
  assert.deepEqual(result.preparations.eligibleIds, after.snapshot.recipes.map(row => row.id));
  assert.deepEqual(result.preparations.excluded, after.excluded); assert.equal(result.preparations.recipes.filter(row => row.compatible).length, 80);
  assert.equal(result.preparations.crossLaneAccepted, false); assert.equal(result.preparations.restrictionAdmission, false);
});

test("changed bytes/fields/date/price/order or malformed/stale/missing/duplicate source/version never inherit exact review; getters never run", () => {
  const original = JSON.parse(bytes());
  for (const mutate of [
    (s: typeof original) => { s.version++; }, (s: typeof original) => { s.generated_at = "2099-01-01"; },
    (s: typeof original) => { s.store_prices[0].shelf_price++; }, (s: typeof original) => { s.recipes[0].steps.push("extra oil"); },
    (s: typeof original) => { s.recipe_ingredients[0].qty++; }, (s: typeof original) => { s.recipes.reverse(); }
  ]) { const value = structuredClone(original); mutate(value); assert.throws(() => preparedMaterialization(JSON.stringify(value), source(), PREPARATION_VERSION), /Unexpected reviewed snapshot/); }
  assert.throws(() => preparedMaterialization(bytes() + " ", source(), PREPARATION_VERSION), /snapshot/);
  assert.throws(() => preparedMaterialization("{}", source(), PREPARATION_VERSION), /snapshot/);
  assert.throws(() => preparedMaterialization(bytes(), source(), "old"), /version/);
  for (const mutate of [
    (s: ReturnType<typeof source>) => { s.recipes.pop(); }, (s: ReturnType<typeof source>) => { s.recipes.push(structuredClone(s.recipes[0])); },
    (s: ReturnType<typeof source>) => { s.recipes[0].steps.push("unlisted oil"); }, (s: ReturnType<typeof source>) => { s.ingredients[0].qty++; },
    (s: ReturnType<typeof source>) => { s.recipes[0].id = "unknown"; }, (s: ReturnType<typeof source>) => { s.recipes.reverse(); },
    (s: ReturnType<typeof source>) => { delete s.recipes[0]; }
  ]) { const value = source(); mutate(value); assert.throws(() => preparedMaterialization(bytes(), value, PREPARATION_VERSION), /Unexpected reviewed source|Malformed/); }
  let reads = 0;
  for (const key of ["recipes", "ingredients", "variants"]) {
    const value = source(); Object.defineProperty(value, key, { get() { reads++; throw Error("getter"); } });
    assert.throws(() => preparedMaterialization(bytes(), value, PREPARATION_VERSION), /Malformed/);
  }
  const value = source(); Object.defineProperty(value.recipes[0], "steps", { get() { reads++; return []; } });
  assert.throws(() => preparedMaterialization(bytes(), value, PREPARATION_VERSION), /Malformed/); assert.equal(reads, 0);
});

test("deterministic candidate bytes/hashes, cloned outputs, and actual equipment/restriction/price misses remain honest", () => {
  const first = candidate(), second = candidate(); assert.equal(JSON.stringify(first), JSON.stringify(second));
  assert.equal(sha(JSON.stringify(first.snapshot)), sha(JSON.stringify(second.snapshot)));
  assert.equal(sha(JSON.stringify(first.preparations)), sha(JSON.stringify(second.preparations)));
  first.snapshot.recipes[0].steps[0] = "unlisted sauce";
  first.preparations.recipes[0].compatible = false;
  assert.deepEqual(candidate(), second);
  for (const tools of [[], ["oven"], ["microwave"]]) {
    assert.equal(preparedCatalog(second.snapshot, context(tools)).snapshot.recipes.length, 0);
    assert.throws(() => solvePreparedRestricted(input, second.snapshot, [], context(tools)), /Not enough reviewed/);
  }
  assert.throws(() => preparedCatalog(second.snapshot, context(["airfryer"])), /Unknown/);
  assert.ok(!preparedCatalog(second.snapshot, context(EQUIPMENT.filter(tool => tool !== "food-thermometer"))).snapshot.recipes.some(row => row.id === RECONCILED_STEP_IDS[0]));
  assert.equal(restrictedPreparedCatalog(second.snapshot, "none", ["soy"], context()).snapshot.recipes.length, 0);
  assert.throws(() => solvePreparedRestricted(input, second.snapshot, ["soy"], context()), /Not enough reviewed/);
  const expensive = structuredClone(second.snapshot); expensive.store_prices = []; for (const sku of expensive.skus) sku.baseline_usd = 10000;
  assert.throws(() => solvePreparedRestricted({ ...input, budget: 45 }, expensive, [], context()), /no recipe fits/);
  const wrongQuantity = structuredClone(second.snapshot); wrongQuantity.recipe_ingredients.find(row => row.recipe_id === RECONCILED_STEP_IDS[0])!.qty++;
  assert.ok(!preparedCatalog(wrongQuantity, context()).snapshot.recipes.some(row => row.id === RECONCILED_STEP_IDS[0]));
});

test("actual LOCAL arithmetic solve/evaluate agrees over compatible candidate with unchanged legacy/synthetic prices", () => {
  const result = candidate(), prepared = solvePreparedRestricted(input, result.snapshot, [], context());
  assert.equal(prepared.out.feasible, true);
  const pool = preparedCatalog(result.snapshot, context());
  const evaluated = evaluateWeek(prepared.out.days.flatMap(day => day.items.map(item => item.recipe_id)), prepared.out.input, pool.snapshot);
  assert.deepEqual(evaluated, prepared.out);
  assert.deepEqual(pool.snapshot.nutrition, JSON.parse(bytes()).nutrition); assert.deepEqual(pool.snapshot.store_prices, JSON.parse(bytes()).store_prices);
  assert.deepEqual(prepared.preparations.map(row => row.id), [...new Set(prepared.out.days.flatMap(day => day.items.map(item => item.recipe_id)))]);
});
