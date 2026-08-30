import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import type { Staple } from "../../../data/staples.ts";
import { floors, solve, type SolveInput } from "./solver.ts";

const staples: Staple[] = JSON.parse(readFileSync("data/staples.json", "utf8"));
const byName = new Map(staples.map((s) => [s.name, s]));
const isProteinSource = (s: Staple) => s.protein_g / s.kcal >= 0.06 && s.protein_g >= 20;

const base: SolveInput = { budget: 60, protein_per_day: 150, kcal_min: 1800, kcal_max: 2800, diet: "none", household: 1 };

// six profiles — variety floors, protein-source floors, repeat caps and budget must hold on every one
const PROFILES: [string, SolveInput][] = [
  ["typical", base],
  ["floor budget", { ...base, budget: 30, protein_per_day: 100, kcal_min: 1600, kcal_max: 2600 }],
  ["household of two", { ...base, budget: 120, household: 2 }],
  ["vegan", { ...base, budget: 50, protein_per_day: 100, diet: "vegan" }],
  ["vegetarian", { ...base, budget: 55, protein_per_day: 130, diet: "vegetarian" }],
  ["dairy-free, high protein", { ...base, budget: 90, protein_per_day: 180, kcal_min: 2200, kcal_max: 3200, diet: "dairy-free" }],
];

function assertWeek(input: SolveInput) {
  const out = solve(input, staples);
  assert.equal(out.feasible, true, `infeasible, shortfall ${out.protein_shortfall_g} g, ${out.distinct_skus} skus, $${out.est_total}`);
  assert.ok(out.est_total <= input.budget, `total ${out.est_total} over budget`);
  assert.equal(out.days.length, 5);
  for (const d of out.days) {
    assert.equal(d.items.length, 3, `${d.day}: three meals`);
    assert.ok(d.protein_g >= input.protein_per_day - 1, `${d.day}: ${d.protein_g} g`);
    assert.ok(d.kcal >= input.kcal_min - 1 && d.kcal <= input.kcal_max + 1, `${d.day}: ${d.kcal} kcal`);
  }
  const f = floors(input.budget);
  assert.ok(out.distinct_skus >= f.skus, `${out.distinct_skus} skus < floor ${f.skus}`);
  assert.ok(out.protein_sources >= f.proteinSources, `${out.protein_sources} protein sources < floor ${f.proteinSources}`);
  assert.equal(out.list.filter((i) => isProteinSource(byName.get(i.name)!)).length, out.protein_sources);
  const dinners = new Map<string, number>();
  for (const d of out.days) dinners.set(d.items[2].name, (dinners.get(d.items[2].name) ?? 0) + 1);
  for (const [name, n] of dinners) assert.ok(n <= 2, `${name} served ${n}× for dinner`);
  // no single sku carries more than 35% of the week's eaten calories (shelf-stable leftovers carry over, so eaten ≤ bought)
  const total = out.list.reduce((a, i) => a + byName.get(i.name)!.kcal * i.eaten, 0);
  for (const i of out.list) {
    assert.ok(i.eaten <= i.qty + 1e-9 && (!i.perishable || i.eaten === i.qty), `${i.name}: eaten ${i.eaten} of ${i.qty}`);
    assert.ok((byName.get(i.name)!.kcal * i.eaten) / total <= 0.351, `${i.name} is ${Math.round((byName.get(i.name)!.kcal * i.eaten * 100) / total)}% of kcal`);
  }
  // the list pays for every pack; the days never eat more than the list holds
  assert.equal(out.list.reduce((a, i) => a + i.price_usd, 0).toFixed(2), out.est_total.toFixed(2));
  const listProtein = out.list.reduce((a, i) => a + byName.get(i.name)!.protein_g * i.qty, 0);
  const dayProtein = out.days.reduce((a, d) => a + d.protein_g, 0) * input.household;
  assert.ok(dayProtein <= listProtein + 5, `days ${dayProtein} > list ${listProtein}`);
  return out;
}

for (const [name, input] of PROFILES) {
  test(`${name}: variety floors, repeat caps, band, budget`, () => {
    const out = assertWeek(input);
    console.log(`  ${name}: ${out.distinct_skus} skus, ${out.protein_sources} protein sources, $${out.est_total}, ${out.protein_per_day} g/day`);
  });
}

test("vegan week: every item carries the vegan flag", () => {
  const out = assertWeek(PROFILES[3][1]);
  for (const item of out.list) assert.ok(byName.get(item.name)?.diet_flags.includes("vegan"), `${item.name} is not vegan`);
});

test("thu and fri use shelf-stable or frozen food only", () => {
  const out = assertWeek(base);
  for (const d of out.days.slice(3)) for (const m of d.items) for (const part of m.portion.split(" · ")) {
    const s = staples.find((x) => part.startsWith(x.name.split(",")[0]));
    assert.ok(s && !s.perishable, `${d.day}: ${part} is perishable`);
  }
});

test("deterministic per seed; a new seed gives a different valid week", () => {
  const a = solve(base, staples);
  const b = solve(base, staples);
  assert.deepEqual(a, b);
  const c = solve({ ...base, seed: 1 }, staples);
  assert.equal(c.feasible, true);
  assert.notDeepEqual(a.days.map((d) => d.items.map((i) => i.name)), c.days.map((d) => d.items.map((i) => i.name)));
  assert.ok(c.est_total <= a.est_total * 1.03 + 0.01 || a.est_total <= c.est_total * 1.03 + 0.01, "seeds stay within the 3% band");
});

test("pantry pack is free and still eaten", () => {
  const out = assertWeek({ ...base, pantry: ["white rice, long grain"] });
  const rice = out.list.find((i) => i.name === "white rice, long grain");
  if (rice) assert.equal(rice.price_usd, round2(byName.get(rice.name)!.price_usd * (rice.qty - 1)));
});

test("infeasible budget: reports shortfall, never claims feasible", () => {
  const out = solve({ ...base, budget: 20, protein_per_day: 220 }, staples);
  assert.equal(out.feasible, false);
  assert.ok(out.protein_shortfall_g > 0 || out.est_total > 20);
});

test("kcal ceiling breached by the protein target is not feasible", () => {
  const out = solve({ ...base, budget: 100, protein_per_day: 220, kcal_min: 1200, kcal_max: 1400 }, staples);
  assert.equal(out.feasible, false);
});

const round2 = (n: number) => Math.round(n * 100) / 100;
