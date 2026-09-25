import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateWeek, solve } from "../src/engine.ts";
import { swapCandidates } from "../src/swaps.ts";
import { proteinMatches, proteinTolerance } from "../src/makeable.ts";
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

// Courier's filters leave few candidates on a tight week, so the property tests run over every slot of two weeks
const tight = solve({ ...BASE, budget: 57, seed: 1 }, snap);
const allSlots = [week, tight].flatMap((w) => Array.from({ length: 15 }, (_, s) => ({ w, s, c: swapCandidates(w, s, snap, 20) })));

test("every candidate is makeable from the week's list: no new sku, usesExisting true", () => {
  assert.ok(allSlots.some((x) => x.c.length > 0), "no slot of either week has a candidate");
  for (const { w, s, c } of allSlots) {
    const existing = new Set(w.list.map((i) => i.sku_id));
    for (const x of c) {
      const parts = snap.recipe_ingredients.filter((i) => i.recipe_id === x.recipe_id).map((i) => i.sku_id);
      assert.ok(parts.every((id) => existing.has(id)), `slot ${s} ${x.recipe_id} needs a new sku`);
      assert.equal(x.usesExisting, true);
      assert.deepEqual(x.newItems, []);
    }
  }
});

test("every candidate lands within the protein tolerance of the meal it replaces, as displayed", () => {
  for (const { w, s, c } of allSlots) {
    const cur = w.days[Math.floor(s / 3)].items[s % 3].protein_g;
    for (const x of c) {
      assert.ok(proteinMatches(x.protein_g, cur), `slot ${s} ${x.recipe_id}: ${x.protein_g} g vs ${cur} g (±${proteinTolerance(cur)})`);
      const ids = w.days.map((d, di) => d.items.map((i, si) => (di * 3 + si === s ? x.recipe_id : i.recipe_id)));
      assert.equal(evaluateWeek(ids, w.input, snap).days[Math.floor(s / 3)].items[s % 3].protein_g, x.protein_g, `slot ${s} ${x.recipe_id} protein_g is not the displayed figure`);
    }
  }
});

test("an explicit tolerance widens or narrows the candidate set against the default", () => {
  // the slot with the most default candidates across both weeks; a fixed 10 g window is wider than the default
  // for any meal under 67 g, a 10% window is narrower than max(5 g, 15%) for every meal
  const best = allSlots.reduce((a, b) => (b.c.length > a.c.length ? b : a));
  const { w, s } = best;
  const cur = w.days[Math.floor(s / 3)].items[s % 3].protein_g;
  const dflt = swapCandidates(w, s, snap, 50);
  const fixed = swapCandidates(w, s, snap, 50, 10);
  const pct = swapCandidates(w, s, snap, 50, (g) => Math.round(g * 0.1));
  const ids = (c: typeof dflt) => new Set(c.map((x) => x.recipe_id));
  const subset = (a: typeof dflt, b: typeof dflt) => a.every((x) => ids(b).has(x.recipe_id));
  // a fixed 10 g window is wider than the default under 67 g and narrower above; the set must follow the window
  if (10 >= proteinTolerance(cur)) assert.ok(subset(dflt, fixed), `10 g window (wider than ${proteinTolerance(cur)} g) dropped a default candidate`);
  else assert.ok(subset(fixed, dflt), `10 g window (narrower than ${proteinTolerance(cur)} g) added a candidate`);
  // a 10% window is narrower than max(5 g, 15%) for every meal
  assert.ok(Math.round(cur * 0.1) < proteinTolerance(cur));
  assert.ok(subset(pct, dflt), "10% window added a candidate");
  for (const x of fixed) assert.ok(Math.abs(x.protein_g - cur) <= 10, `${x.recipe_id} outside 10 g`);
  for (const x of pct) assert.ok(Math.abs(x.protein_g - cur) <= Math.round(cur * 0.1), `${x.recipe_id} outside 10%`);
  // the parameter is threaded: a zero window keeps only exact matches, a huge one keeps every feasible makeable dish
  const none = swapCandidates(w, s, snap, 50, 0);
  const all = swapCandidates(w, s, snap, 50, 1000);
  for (const x of none) assert.equal(x.protein_g, cur);
  assert.ok(subset(dflt, all) && subset(none, dflt));
  assert.ok(all.length >= dflt.length && dflt.length >= none.length);
  assert.deepEqual(swapCandidates(w, s, snap, 50, undefined), dflt, "undefined must be the default");
  // and on the matcher itself
  assert.equal(proteinMatches(26, 20), false);
  assert.equal(proteinMatches(26, 20, 10), true);
  assert.equal(proteinMatches(26, 20, (g) => Math.round(g * 0.1)), false);
  assert.equal(proteinMatches(22, 20, (g) => Math.round(g * 0.1)), true);
});

test("evaluateWeek accepts the flat 15-id form the app uses to apply a swap", () => {
  const { w, s, c } = allSlots.find((x) => x.c.length > 0)!;
  const nested = w.days.map((d) => d.items.map((i) => i.recipe_id));
  const flat = w.days.flatMap((d) => d.items.map((i) => i.recipe_id));
  flat[s] = c[0].recipe_id;
  nested[Math.floor(s / 3)][s % 3] = c[0].recipe_id;
  assert.deepEqual(evaluateWeek(flat, w.input, snap), evaluateWeek(nested, w.input, snap));
  assert.throws(() => evaluateWeek(flat.slice(0, 14), w.input, snap), /15 recipe ids/);
});

test("tolerance: the larger of 5 g and 15% of the replaced meal", () => {
  assert.equal(proteinTolerance(20), 5);
  assert.equal(proteinTolerance(40), 6);
  assert.equal(proteinTolerance(60), 9);
  assert.ok(proteinMatches(25, 20) && !proteinMatches(26, 20));
});

test("ranking: fewest extra packs, then cheaper, then closest protein, then more protein", () => {
  const { w, s, c } = allSlots.find((x) => x.c.length > 1) ?? { w: week, s: 11, c: swapCandidates(week, 11, snap, 10) };
  const cur = w.days[Math.floor(s / 3)].items[s % 3].protein_g;
  for (let i = 1; i < c.length; i++) {
    const a = c[i - 1];
    const b = c[i];
    const key = (x: typeof a) => [x.extraPacks, x.deltaCost, Math.abs(x.protein_g - cur), -x.protein_g, x.recipe_id] as const;
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
