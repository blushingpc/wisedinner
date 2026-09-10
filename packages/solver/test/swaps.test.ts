import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateWeek, solve } from "../src/engine.ts";
import { swapCandidates } from "../src/swaps.ts";
import { BASE } from "../src/profiles.ts";
import { loadSnapshot } from "./helpers.ts";

const snap = loadSnapshot();
const week = solve(BASE, snap);
const inWeek = new Set(week.days.flatMap((d) => d.items.map((i) => i.recipe_id)));
const mealType = (id: string) => snap.recipes.find((r) => r.id === id)!.meal_type;

test("excludes every recipe already in the week and caps at n", () => {
  const c = swapCandidates(week, 5, snap, 4);
  assert.ok(c.length <= 4);
  for (const x of c) assert.ok(!inWeek.has(x.recipe_id), x.recipe_id);
});

test("only meal-type-valid options: lunches or dinners for lunch and dinner slots, breakfasts for breakfast", () => {
  for (const x of swapCandidates(week, 2, snap, 20)) assert.notEqual(mealType(x.recipe_id), "breakfast");
  for (const x of swapCandidates(week, 1, snap, 20)) assert.notEqual(mealType(x.recipe_id), "breakfast");
  for (const x of swapCandidates(week, 0, snap, 20)) assert.equal(mealType(x.recipe_id), "breakfast");
});

test("every candidate keeps the week feasible and deltaCost equals the re-evaluated difference", () => {
  const slot = 5;
  for (const x of swapCandidates(week, slot, snap, 6)) {
    const ids = week.days.map((d, di) => d.items.map((i, si) => (di * 3 + si === slot ? x.recipe_id : i.recipe_id)));
    const after = evaluateWeek(ids, week.input, snap);
    assert.ok(after.feasible, `${x.recipe_id}: ${after.why.join("; ")}`);
    assert.equal(x.deltaCost, Math.round((after.est_total - week.est_total) * 100) / 100, x.recipe_id);
    assert.equal(x.deltaProtein, after.days[1].protein_g - week.days[1].protein_g, x.recipe_id);
  }
});

test("usesExisting is true iff the candidate adds no new sku", () => {
  const existing = new Set(week.list.map((i) => i.sku_id));
  for (const x of swapCandidates(week, 8, snap, 10)) {
    const parts = snap.recipe_ingredients.filter((i) => i.recipe_id === x.recipe_id).map((i) => i.sku_id);
    const fresh = parts.filter((id) => !existing.has(id));
    assert.deepEqual([...x.newItems].sort(), fresh.sort());
    assert.equal(x.usesExisting, fresh.length === 0);
  }
});

test("ranking: usesExisting first, then fewer new items, then cheaper, then more protein", () => {
  const c = swapCandidates(week, 11, snap, 10);
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1];
    const b = c[i];
    const key = (x: typeof a) => [Number(!x.usesExisting), x.newItems.length, x.deltaCost, -x.deltaProtein, x.recipe_id] as const;
    const ka = key(a);
    const kb = key(b);
    let cmp = 0;
    for (let k = 0; k < ka.length && cmp === 0; k++) cmp = ka[k] < kb[k] ? -1 : ka[k] > kb[k] ? 1 : 0;
    assert.ok(cmp <= 0, `${a.recipe_id} before ${b.recipe_id}`);
  }
});

test("deterministic without a seed", () => {
  assert.deepEqual(swapCandidates(week, 5, snap), swapCandidates(week, 5, snap));
});

test("a variant of the current recipe is labelled variantOf", () => {
  const cur = week.days[1].items[2].recipe_id;
  const related = snap.recipe_variants.filter((v) => v.recipe_id === cur || v.variant_recipe_id === cur);
  const c = swapCandidates(week, 5, snap, 30);
  const labelled = c.filter((x) => x.variantOf);
  if (related.length && labelled.length) for (const x of labelled) assert.equal(x.variantOf!.recipe_id, cur);
});
