import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateWeek } from "../src/engine.ts";
import { PRICE_BUFFER } from "../src/pricing.ts";
import { miniSnapshot } from "./helpers.ts";
import type { SolveInput } from "../src/types.ts";

const s = miniSnapshot();
const input: SolveInput = { budget: 100, protein_per_day: 10, kcal_min: 100, kcal_max: 9000, diet: "none", household: 1, stores: ["a"], zip: "43215" };
const week = (lunch: string[], dinner: string[]) => [0, 1, 2, 3, 4].map((d) => ["oatmeal", lunch[d] ?? lunch[0], dinner[d] ?? dinner[0]]);
const row = (out: ReturnType<typeof evaluateWeek>, id: string) => out.list.find((i) => i.sku_id === id)!;

test("half an onion Monday and half Wednesday = one onion", () => {
  const ids = week(["onion-rice", "tofu-rice", "onion-rice", "tofu-rice", "tofu-rice"], ["tofu-rice"]);
  const out = evaluateWeek(ids, input, s);
  assert.equal(row(out, "onion").qty, 1);
  assert.equal(row(out, "onion").price_usd, Math.round(0.8 * PRICE_BUFFER * 100) / 100);
});

test("three thirds do not become two packs", () => {
  const third = miniSnapshot({ recipe_ingredients: [...s.recipe_ingredients.filter((i) => i.recipe_id !== "onion-rice"), { recipe_id: "onion-rice", sku_id: "onion", qty: 1 / 3, unit: "each" }, { recipe_id: "onion-rice", sku_id: "rice", qty: 4, unit: "oz" }] });
  const out = evaluateWeek(week(["onion-rice", "onion-rice", "onion-rice", "tofu-rice", "tofu-rice"], ["tofu-rice"]), input, third);
  assert.equal(row(out, "onion").qty, 1);
});

test("8 oz of a 32 oz $4.00 bag costs $1.00 raw and shows as a quarter pack", () => {
  const out = evaluateWeek(week(["tofu-rice"], ["tofu-rice"]), input, s); // 8 oz rice × 10 meals = 2.5 bags
  assert.equal(row(out, "rice").qty, 3);
  assert.equal(row(out, "rice").eaten, 2.5);
  const one = evaluateWeek([["oatmeal", "onion-rice", "chicken-rice"]].concat(Array(4).fill(["oatmeal", "onion-rice", "chicken-rice"])), input, s);
  const meal = one.days[0].items[2];
  assert.ok(meal.portion.includes("rice 1/4"), meal.portion);
});

test("household multiplies before rounding", () => {
  const two = evaluateWeek(week(["onion-rice", "tofu-rice", "tofu-rice", "tofu-rice", "tofu-rice"], ["tofu-rice"]), { ...input, household: 2 }, s);
  assert.equal(row(two, "onion").qty, 1);
  const three = evaluateWeek(week(["onion-rice", "tofu-rice", "tofu-rice", "tofu-rice", "tofu-rice"], ["tofu-rice"]), { ...input, household: 3 }, s);
  assert.equal(row(three, "onion").qty, 2);
});

test("pantry sku is on the list at $0, still eaten, still counted", () => {
  const ids = week(["tofu-rice"], ["tofu-rice"]);
  const withPantry = evaluateWeek(ids, { ...input, pantry: ["rice"] }, s);
  const without = evaluateWeek(ids, input, s);
  const r = row(withPantry, "rice");
  assert.equal(r.price_usd, 0);
  assert.equal(r.pantry, true);
  assert.equal(r.qty, row(without, "rice").qty);
  assert.equal(r.eaten, row(without, "rice").eaten);
  assert.equal(withPantry.distinct_skus, without.distinct_skus);
  assert.equal(Math.round((without.est_total - withPantry.est_total) * 100) / 100, row(without, "rice").price_usd);
});

test("perishable stretch: a pack two thirds used finishes with no waste penalty; half used is penalised", () => {
  // chicken 8 oz × 4 dinners = 32 oz of a 48 oz pack (2/3): stretched, eaten = qty, no waste line
  const four = evaluateWeek(week(["tofu-rice"], ["chicken-rice", "chicken-rice", "chicken-rice", "chicken-rice", "tofu-rice"]), input, s);
  const c4 = row(four, "chicken");
  assert.equal(c4.qty, 1);
  assert.equal(c4.eaten, c4.qty);
  assert.ok(!four.why.some((w) => w.includes("waste")), four.why.join(";"));
  // 3 dinners = 24 oz of 48 (1/2): more than a third wasted
  const three = evaluateWeek(week(["tofu-rice"], ["chicken-rice", "chicken-rice", "chicken-rice", "tofu-rice", "tofu-rice"]), input, s);
  assert.ok(three.why.some((w) => w.includes("waste")), three.why.join(";"));
});
