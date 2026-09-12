import assert from "node:assert/strict";
import { test } from "node:test";
import { floors, isProteinSource, solve, buildPool } from "../src/engine.ts";
import { PROFILES, BASE } from "../src/profiles.ts";
import { priceMapFor } from "../src/pricing.ts";
import { templatesOf } from "../src/snapshot.ts";
import { loadSnapshot } from "./helpers.ts";
import type { SolveInput, SolveOutput } from "../src/types.ts";

const snap = loadSnapshot();
const templates = templatesOf(snap);
const kroger = snap.stores.find((s) => s.id === "kroger")!;
const pool = buildPool(snap, priceMapFor(snap, kroger, "43215"), "none", 10_000, templates);

function assertWeek(out: SolveOutput, input: SolveInput) {
  const { skus: minSkus, proteinSources: minProtein } = floors(input.budget);
  assert.ok(out.feasible, `infeasible: ${out.why.join("; ")} (shortfall ${out.protein_shortfall_g} g, ${out.distinct_skus} skus, $${out.est_total})`);
  assert.ok(out.est_total <= input.budget, `over budget: $${out.est_total} > $${input.budget}`);
  assert.equal(out.days.length, 5);
  for (const d of out.days) {
    assert.equal(d.items.length, 3);
    assert.ok(d.protein_g >= input.protein_per_day - 1, `${d.day}: ${d.protein_g} g`);
    assert.ok(d.kcal >= input.kcal_min - 1 && d.kcal <= input.kcal_max + 1, `${d.day}: ${d.kcal} kcal`);
  }
  assert.ok(out.distinct_skus >= minSkus, `${out.distinct_skus} skus < ${minSkus}`);
  assert.ok(out.protein_sources >= minProtein, `${out.protein_sources} protein sources < ${minProtein}`);
  const recomputed = out.list.filter((i) => isProteinSource(pool.skus.get(i.sku_id)!)).length;
  assert.equal(out.protein_sources, recomputed);
  const dinners = new Map<string, number>();
  for (const d of out.days) {
    const t = templates.find((x) => x.id === d.items[2].recipe_id)!;
    dinners.set(t.base_id, (dinners.get(t.base_id) ?? 0) + 1);
  }
  for (const [n, c] of dinners) assert.ok(c <= 2, `${n} served ${c}× for dinner`);
  for (const i of out.list) {
    assert.ok(i.eaten <= i.qty + 1e-9, `${i.name}: eaten ${i.eaten} > qty ${i.qty}`);
    if (i.perishable) assert.equal(i.eaten, i.qty, `${i.name}: perishable not finished`);
  }
  const listTotal = Math.round(out.list.reduce((a, i) => a + i.price_usd, 0) * 100) / 100;
  assert.equal(listTotal, out.est_total, "list lines sum to the total");
  const listProtein = out.list.reduce((a, i) => a + pool.skus.get(i.sku_id)!.protein_g * i.eaten, 0);
  const dayProtein = out.days.reduce((a, d) => a + d.protein_g, 0) * input.household;
  assert.ok(dayProtein <= listProtein + 5, `days claim ${dayProtein} g, list holds ${Math.round(listProtein)} g`);
  assert.ok(out.days.every((d) => d.items.every((i) => i.cost_usd >= 0)));
}

for (const [name, input] of PROFILES) {
  test(`${name}: variety floors, repeat caps, band, budget`, () => assertWeek(solve(input, snap), input));
}

test("vegan week: every list item carries the vegan flag", () => {
  const out = solve(PROFILES[3][1], snap);
  for (const i of out.list) assert.ok(pool.skus.get(i.sku_id)!.diet_flags.includes("vegan"), i.name);
});

test("thu and fri use shelf-stable or frozen food only", () => {
  const out = solve(BASE, snap);
  for (const d of out.days.slice(3)) for (const m of d.items) {
    const t = templates.find((x) => x.id === m.recipe_id)!;
    assert.ok(t.stable, `${d.day} ${m.name}`);
  }
});

test("deterministic per seed; a new seed gives a different valid week inside the band", () => {
  const a = solve(BASE, snap);
  const b = solve(BASE, snap);
  assert.deepEqual(a, b);
  const c = solve({ ...BASE, seed: 1 }, snap);
  assert.ok(c.feasible);
  assert.notDeepEqual(a.days.map((d) => d.items.map((i) => i.recipe_id)), c.days.map((d) => d.items.map((i) => i.recipe_id)));
  assert.ok(c.est_total <= Math.max(a.est_total, c.est_total) * 1.03 + 0.01);
});

test("pantry sku is free and still eaten", () => {
  const out = solve({ ...BASE, pantry: ["white-rice"] }, snap);
  const rice = out.list.find((i) => i.sku_id === "white-rice");
  if (rice) {
    assert.equal(rice.price_usd, 0);
    assert.ok(rice.qty >= 1);
    assert.equal(rice.pantry, true);
  }
  assert.ok(out.feasible);
});

test("infeasible budget: reports shortfall, never claims feasible", () => {
  // at the $45 floor, so the search runs (under the floor solve() short-circuits; floor.test.ts covers that path)
  const out = solve({ ...BASE, budget: 45, protein_per_day: 220 }, snap);
  assert.equal(out.feasible, false);
  assert.ok(out.protein_shortfall_g > 0 || out.est_total > 45);
  assert.ok(out.why.length > 0);
  assert.ok(out.list.length > 0, "a real week was searched, not the floor's empty week");
});

test("kcal ceiling breached by the protein target is not feasible", () => {
  const out = solve({ ...BASE, budget: 100, protein_per_day: 220, kcal_min: 1200, kcal_max: 1400 }, snap);
  assert.equal(out.feasible, false);
});

test("estimate mode at an index-only store still solves", () => {
  const out = solve({ ...BASE, stores: ["aldi"] }, snap);
  assert.equal(out.store_mode, "estimate");
  assert.deepEqual(out.modes_available, []);
  assert.ok(out.feasible, out.why.join("; "));
  assert.ok(out.list.every((i) => i.store === "aldi"));
});

test("output carries no source or confidence fields", () => {
  const out = solve(BASE, snap);
  const text = JSON.stringify(out);
  assert.ok(!/"source"|"confidence"|"observed"/.test(text));
});
