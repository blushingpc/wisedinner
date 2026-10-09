import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { reviewNutrition } from "./catalog-review.ts";
import { loadUsdaMap } from "./usda.ts";
import { preparationData } from "./prepared-selection.ts";
import { projectPurchased, reviewedBasket, stageReviewed, type WeekApproval } from "./reviewed-week.ts";
import type { SourceFood } from "./catalog-evidence.ts";

test("missing USDA cache remains blocked even when original source food is present", () => {
  const map = loadUsdaMap();
  const foods: SourceFood[] = JSON.parse(readFileSync("docs/ingredient-catalog/usda-evidence.json", "utf8")).foods;
  delete map["ground-turkey"];
  const review = reviewNutrition(map, foods).find(r => r.sku_id === "ground-turkey");
  assert.ok(review);
  assert.equal(review.status, "blocked");
  assert.ok(review.reasons.some(reason => reason.includes("Cached USDA entry unavailable")));
});
test("preparation copying refuses sparse arrays and accessors without executing them", () => {
  assert.throws(() => preparationData(new Array(2)));
  let calls = 0;
  const rows: string[] = [];
  Object.defineProperty(rows, "0", { get() { calls++; return "knife"; } });
  assert.throws(() => preparationData(rows));
  assert.equal(calls, 0);
});
test("preparation copying refuses inherited structure and preserves plain values", () => {
  assert.throws(() => preparationData(Object.create({ tools: [] })));
  assert.deepEqual(preparationData({ tools: ["knife"], known: true }), { tools: ["knife"], known: true });
});
test("purchase projection refuses missing quantity rows without changing original data", () => {
  const approval: WeekApproval = JSON.parse(readFileSync("docs/ingredient-catalog/reviewed-week-approval.json", "utf8"));
  const basket = reviewedBasket(), stage = stageReviewed(approval, basket);
  const before = JSON.stringify(stage.edible), quantities = structuredClone(basket.quantities);
  delete quantities["ground-turkey"];
  assert.throws(() => projectPurchased(stage.edible, quantities), /quantity review unavailable/);
  assert.equal(JSON.stringify(stage.edible), before);
});
