import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Staple } from "../../../data/staples.ts";
import { solve, type SolveInput } from "./solver.ts";

const staples: Staple[] = JSON.parse(readFileSync("data/staples.json", "utf8"));

const base: SolveInput = {
  budget: 60,
  protein_per_day: 150,
  kcal_min: 1800,
  kcal_max: 2800,
  diet: "none",
  household: 1,
};

test("typical week: under budget, protein met, kcal in range, five days", () => {
  const out = solve(base, staples);
  assert.equal(out.feasible, true);
  assert.ok(out.est_total <= base.budget, `total ${out.est_total} over budget`);
  assert.ok(out.protein_per_day >= base.protein_per_day);
  assert.ok(out.kcal_per_day >= base.kcal_min && out.kcal_per_day <= base.kcal_max, `kcal/day ${out.kcal_per_day}`);
  assert.equal(out.days.length, 5);
  assert.equal(out.protein_shortfall_g, 0);
  assert.equal(out.list.reduce((a, i) => a + i.price_usd, 0).toFixed(2), out.est_total.toFixed(2));
});

test("vegan week: every item carries the vegan flag", () => {
  const out = solve({ ...base, budget: 50, protein_per_day: 120, diet: "vegan" }, staples);
  assert.equal(out.feasible, true);
  const flags = new Map(staples.map((s) => [s.name, s.diet_flags]));
  for (const item of out.list) assert.ok(flags.get(item.name)?.includes("vegan"), `${item.name} is not vegan`);
});

test("infeasible budget: reports shortfall, never overspends", () => {
  const out = solve({ ...base, budget: 10, protein_per_day: 200 }, staples);
  assert.equal(out.feasible, false);
  assert.ok(out.protein_shortfall_g > 0);
  assert.ok(out.est_total <= 10);
});

test("deterministic: same input, same output", () => {
  assert.deepEqual(solve(base, staples), solve(base, staples));
});

test("perishables only land mon-wed; day totals add up to the week", () => {
  const out = solve(base, staples);
  const perishable = new Set(staples.filter((s) => s.perishable).map((s) => s.name));
  for (const d of out.days.slice(3)) for (const i of d.items) assert.ok(!perishable.has(i.name), `${i.name} on ${d.day}`);
  const weekProtein = out.days.reduce((a, d) => a + d.protein_g, 0);
  assert.ok(Math.abs(weekProtein - out.protein_per_day * 5) <= 5);
});
