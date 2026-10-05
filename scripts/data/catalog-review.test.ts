import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { reviewNutrition, sourceMacros, nutritionFingerprint } from "./catalog-review.ts";
import { SKUS } from "./authored/skus.ts";
import { loadUsdaMap } from "./usda.ts";
import type { SourceFood } from "./catalog-evidence.ts";

const foods: SourceFood[] = JSON.parse(readFileSync("docs/ingredient-catalog/usda-evidence.json", "utf8")).foods;
const map = loadUsdaMap();
test("reviewed raw ingredients retain original USDA precision, not rounded convenience values", () => {
  for (const id of ["ground-turkey", "ground-beef", "eggs", "lentils", "white-rice", "quinoa", "frozen-edamame"]) {
    const values = sourceMacros(foods.find(f => f.fdcId === map[id].fdc_id)!);
    for (const field of ["protein_g", "fat_g", "carbs_g", "kcal"] as const) assert.equal(map[id][field], values[field], `${id}: ${field}`);
  }
});
test("every active SKU has an outcome; wrong identities and unknown yields remain blocked", () => {
  const reviews = reviewNutrition(map, foods);
  assert.deepEqual(reviews.map(r => r.sku_id), SKUS.map(s => s.id));
  for (const id of ["pea-protein", "plant-yogurt", "russet-potatoes", "chicken-thighs", "canned-tuna", "frozen-peppers-onions", "taco-seasoning", "tzatziki", "pancake-mix"]) {
    const review = reviews.find(r => r.sku_id === id)!;
    assert.equal(review.status, "blocked", id); assert.ok(review.reasons.length, id);
  }
});
test("source omissions, arithmetic changes and piece-weight changes cannot retain approval", () => {
  const copy = structuredClone(foods);
  copy.find(f => f.fdcId === map["brown-rice"].fdc_id)!.nutrients = [];
  assert.equal(reviewNutrition(map, copy).find(r => r.sku_id === "brown-rice")!.status, "blocked");
  const changed = structuredClone(map); changed["brown-rice"].protein_g += 1;
  assert.equal(reviewNutrition(changed, foods).find(r => r.sku_id === "brown-rice")!.status, "blocked");
  const egg = SKUS.find(s => s.id === "eggs")!;
  assert.notEqual(nutritionFingerprint(egg, map.eggs), nutritionFingerprint({ ...egg, grams_per_unit: 60 }, map.eggs));
  const substituted = structuredClone(map); substituted["brown-rice"] = { ...map["white-rice"] };
  assert.match(reviewNutrition(substituted, foods).find(r => r.sku_id === "brown-rice")!.reasons.join(" "), /Source identity changed/);
});
