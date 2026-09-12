import assert from "node:assert/strict";
import { test } from "node:test";
import { solve } from "../src/engine.ts";
import { regenerateSlot } from "../src/regenerate.ts";
import { BASE } from "../src/profiles.ts";
import { loadSnapshot, miniSnapshot } from "./helpers.ts";

const snap = loadSnapshot();
const week = solve(BASE, snap);
const ids = (w: typeof week) => w.days.map((d) => d.items.map((i) => i.recipe_id));

test("changes only the target slot and keeps every other recipe", () => {
  const out = regenerateSlot(week, 5, 7, snap); // tue dinner
  assert.ok(out.changed, out.why.join("; "));
  const a = ids(week);
  const b = ids(out);
  for (let d = 0; d < 5; d++) for (let s = 0; s < 3; s++) if (d * 3 + s !== 5) assert.equal(b[d][s], a[d][s], `slot ${d * 3 + s} moved`);
  assert.notEqual(b[1][2], a[1][2]);
});

test("keeps feasibility, budget and protein on every day", () => {
  for (const slot of [0, 4, 8, 14]) {
    const out = regenerateSlot(week, slot, 11, snap);
    if (!out.changed) continue;
    assert.ok(out.feasible, `slot ${slot}: ${out.why.join("; ")}`);
    assert.ok(out.est_total <= BASE.budget);
    for (const d of out.days) assert.ok(d.protein_g >= BASE.protein_per_day - 1, `${d.day} ${d.protein_g}`);
  }
});

test("same seed same result; another seed stays valid", () => {
  const a = regenerateSlot(week, 2, 5, snap);
  const b = regenerateSlot(week, 2, 5, snap);
  assert.deepEqual(a, b);
  const c = regenerateSlot(week, 2, 6, snap);
  assert.ok(c.feasible);
});

test("returns changed:false with a plain-words why when nothing else fits", () => {
  const mini = miniSnapshot();
  const input = { budget: 100, protein_per_day: 10, kcal_min: 100, kcal_max: 9000, diet: "none" as const, household: 1, stores: ["a"], zip: "43215" };
  const w = solve(input, mini); // one breakfast recipe only
  const out = regenerateSlot(w, 0, 1, mini);
  assert.equal(out.changed, false);
  assert.ok(out.why.some((x) => x.includes("no other breakfast")));
  assert.deepEqual(ids(out), ids(w));
});

test("an infeasible week never gets worse", () => {
  // at the $45 floor with an out-of-reach protein target: infeasible for protein, not short-circuited by the floor
  const bad = solve({ ...BASE, budget: 45, protein_per_day: 200 }, snap);
  assert.equal(bad.feasible, false);
  const out = regenerateSlot(bad, 8, 3, snap);
  assert.ok(out.est_total <= bad.est_total + 0.01 || out.protein_shortfall_g <= bad.protein_shortfall_g);
});

test("the list is re-consolidated after the swap", () => {
  const out = regenerateSlot(week, 5, 7, snap);
  const total = Math.round(out.list.reduce((a, i) => a + i.price_usd, 0) * 100) / 100;
  assert.equal(total, out.est_total);
  assert.equal(out.distinct_skus, out.list.length);
});

test("slotIndex out of range throws", () => {
  assert.throws(() => regenerateSlot(week, 15, 1, snap));
  assert.throws(() => regenerateSlot(week, -1, 1, snap));
});
