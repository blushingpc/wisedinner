import assert from "node:assert/strict";
import { test } from "node:test";
import { MIN_BUDGET, MIN_BUDGET_WHY, evaluateWeek, solve } from "../src/engine.ts";
import { regenerateSlot } from "../src/regenerate.ts";
import { swapCandidates } from "../src/swaps.ts";
import { BASE } from "../src/profiles.ts";
import { loadSnapshot } from "./helpers.ts";

const snap = loadSnapshot();

test("budget floor: below $45 the solver returns the ordinary infeasible shape with an empty week", () => {
  assert.equal(MIN_BUDGET, 45);
  const out = solve({ ...BASE, budget: 44.99 }, snap);
  const ok = solve({ ...BASE, budget: 60, seed: 1 }, snap);
  assert.equal(out.feasible, false);
  assert.deepEqual(out.why, [MIN_BUDGET_WHY]);
  assert.equal(out.est_total, 0);
  assert.deepEqual(out.list, []);
  assert.equal(out.days.length, 5);
  assert.ok(out.days.every((d) => d.items.length === 0 && d.protein_g === 0));
  assert.ok(out.protein_shortfall_g > 0);
  assert.deepEqual(Object.keys(out).sort(), Object.keys(ok).filter((k) => k !== "alt_total").sort(), "same SolveOutput shape as a solved week");
  assert.equal(out.store_mode, ok.store_mode);
});

test("budget floor: exactly $45 is not short-circuited", () => {
  const out = solve({ ...BASE, budget: 45, protein_per_day: 100, kcal_min: 1600, kcal_max: 2600, seed: 1 }, snap);
  assert.ok(!out.why.includes(MIN_BUDGET_WHY));
  assert.ok(out.list.length > 0, "a real search ran");
});

test("budget floor: regenerateSlot and swapCandidates on a floor week are no-ops, never a crash", () => {
  const out = solve({ ...BASE, budget: 30 }, snap);
  const re = regenerateSlot(out, 8, 3, snap);
  assert.equal(re.changed, false);
  assert.deepEqual(re.why, [MIN_BUDGET_WHY]);
  assert.deepEqual(swapCandidates(out, 8, snap), []);
  // a real week re-priced under the floor (evaluateWeek keeps its items): regenerate still refuses and says why
  const real = solve({ ...BASE, budget: 45, protein_per_day: 100, kcal_min: 1600, kcal_max: 2600, seed: 3 }, snap);
  const repriced = evaluateWeek(real.days.map((d) => d.items.map((i) => i.recipe_id)), { ...real.input, budget: 44.99 }, snap);
  const re2 = regenerateSlot(repriced, 5, 7, snap);
  assert.equal(re2.changed, false);
  assert.ok(re2.why.includes(MIN_BUDGET_WHY));
});
