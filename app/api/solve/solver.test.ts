import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Staple } from "../../../data/staples.ts";
import { solve, type SolveInput } from "./solver.ts";

const staples: Staple[] = JSON.parse(readFileSync("data/staples.json", "utf8"));
const byName = new Map(staples.map((s) => [s.name, s]));

const base: SolveInput = {
  budget: 60,
  protein_per_day: 150,
  kcal_min: 1800,
  kcal_max: 2800,
  diet: "none",
  household: 1,
};

function assertWeek(input: SolveInput) {
  const out = solve(input, staples);
  assert.equal(out.feasible, true, `infeasible, shortfall ${out.protein_shortfall_g}`);
  assert.ok(out.est_total <= input.budget, `total ${out.est_total} over budget`);
  assert.ok(out.protein_per_day >= input.protein_per_day);
  assert.equal(out.days.length, 5);
  for (const d of out.days) {
    assert.ok(d.protein_g >= input.protein_per_day - 1, `${d.day}: ${d.protein_g} g`);
    assert.ok(d.kcal >= input.kcal_min - 1 && d.kcal <= input.kcal_max + 1, `${d.day}: ${d.kcal} kcal`);
  }
  assert.equal(out.protein_shortfall_g, 0);
  assert.equal(out.list.reduce((a, i) => a + i.price_usd, 0).toFixed(2), out.est_total.toFixed(2));
  // day totals add up to what the list actually contains
  const listProtein = out.list.reduce((a, i) => a + byName.get(i.name)!.protein_g * i.qty, 0);
  const dayProtein = out.days.reduce((a, d) => a + d.protein_g, 0) * input.household;
  assert.ok(Math.abs(listProtein - dayProtein) <= 3, `list ${listProtein} vs days ${dayProtein}`);
  return out;
}

test("typical week: every day meets protein and kcal, under budget", () => {
  assertWeek(base);
});

test("household of two: per-person days still hold", () => {
  assertWeek({ ...base, budget: 120, household: 2 });
});

test("vegan week: every item carries the vegan flag", () => {
  const out = assertWeek({ ...base, budget: 50, protein_per_day: 100, diet: "vegan" });
  for (const item of out.list) assert.ok(byName.get(item.name)?.diet_flags.includes("vegan"), `${item.name} is not vegan`);
});

test("infeasible budget: reports shortfall, never overspends", () => {
  const out = solve({ ...base, budget: 10, protein_per_day: 200 }, staples);
  assert.equal(out.feasible, false);
  assert.ok(out.protein_shortfall_g > 0);
  assert.ok(out.protein_per_day < 200);
  assert.ok(out.est_total <= 10);
});

test("kcal ceiling breached by the protein target is not feasible", () => {
  const out = solve({ ...base, budget: 100, protein_per_day: 200, kcal_min: 1200, kcal_max: 1400, diet: "dairy-free" }, staples);
  assert.equal(out.feasible, false);
});

test("deterministic: same input, same output", () => {
  assert.deepEqual(solve(base, staples), solve(base, staples));
});

test("perishables only land mon-wed", () => {
  const out = solve(base, staples);
  for (const d of out.days.slice(3)) for (const i of d.items) assert.ok(!byName.get(i.name)?.perishable, `${i.name} on ${d.day}`);
});
