import assert from "node:assert/strict";
import { test } from "node:test";
import { SKUS } from "./authored/skus.ts";
import { loadUsdaMap, nutritionProblems, nutritionRows, pickUsdaFood, resolveUsdaMap, type Food, type UsdaMap } from "./usda.ts";

const sku = (id: string) => SKUS.find((s) => s.id === id)!;
// Synthetic identity fixtures only. They are not candidate production source records or new nutrient values.
const entry = (description: string, fdc_id = 123) => ({ description, fdc_id, protein_g: 3, kcal: 100, fat_g: 2, carbs_g: 15, matched_at: "2026-10-04" });
const food = (description: string, fdcId = 123, dataType = "SR Legacy"): Food => ({ description, fdcId, dataType, foodNutrients: [
  { nutrientId: 1003, value: 3 }, { nutrientId: 1004, value: 2 }, { nutrientId: 1005, value: 15 }, { nutrientId: 1008, value: 100 },
] });

test("historical soy proxies cannot become pea or almond nutrition rows", () => {
  const map = loadUsdaMap();
  map["plant-yogurt"] = entry("SILK Plain soy yogurt", 175227);
  map["pea-protein"] = entry("Beverages, Protein powder soy based", 173181);
  assert.throws(() => nutritionRows(map), /nutrition review required:[\s\S]*plant-yogurt[\s\S]*pea-protein/);
});

test("cached and manually flagged mismatches fail the same identity gate", async () => {
  for (const flag of [{}, { manual: true }]) {
    const cached = { "pea-protein": { ...entry("Soy protein powder", 173181), ...flag } };
    const fetchers = { byId: async () => { throw new Error("must not fetch"); }, search: async () => { throw new Error("must not search"); } };
    await assert.rejects(resolveUsdaMap(cached, fetchers, "2026-10-04", [sku("pea-protein")]), /pea-protein: nutrition identity/);
  }
});

test("a pin refresh cannot bless the soy record or mutate the cached map", async () => {
  const cached = { "plant-yogurt": { ...entry("SILK Plain soy yogurt", 175227), pinned: true } };
  const original = structuredClone(cached);
  await assert.rejects(resolveUsdaMap(cached, { byId: async () => food("SILK Plain soy yogurt", 175227), search: async () => [] }, "2026-10-05", [sku("plant-yogurt")]), /plant-yogurt: nutrition identity/);
  assert.deepEqual(cached, original);
});

test("renaming a known rejected source ID cannot bypass the identity gate", () => {
  for (const [id, description, fdcId] of [["pea-protein", "Pea protein powder", 173181], ["plant-yogurt", "Yogurt, almond milk", 175227]] as const) {
    assert.ok(nutritionProblems({ [id]: entry(description, fdcId) }, [sku(id)]).some((p) => p.includes("nutrition identity")));
  }
});

test("automatic search requires an exact identity, not the first relevant food", () => {
  assert.equal(pickUsdaFood("Pea protein powder", [food("Soy protein powder", 1, "Foundation"), food("Whey protein powder", 2)]), undefined);
  assert.equal(pickUsdaFood("Pea protein powder", [food("Pea, raw")]), undefined);
  const exact = food("Pea protein powder", 3);
  assert.equal(pickUsdaFood("Pea protein powder", [food("Soy protein powder", 1, "Foundation"), exact]), exact);
  const foundation = food("Pea protein powder", 4, "Foundation");
  assert.equal(pickUsdaFood("Pea protein powder", [exact, foundation]), foundation);
  assert.ok(pickUsdaFood("Rice, white, raw", [food("RICE white RAW")]));
});

test("a missing exact search result stops rather than persisting a heuristic match", async () => {
  const cached = {};
  await assert.rejects(resolveUsdaMap(cached, { byId: async () => food("unused"), search: async () => [food("Soy protein powder", 1, "Foundation")] }, "2026-10-04", [sku("pea-protein")]), /pea-protein: no exact source match/);
  assert.deepEqual(cached, {});
});

test("a pinned lookup must return the requested source ID", async () => {
  const cached = { "white-rice": { ...entry("Rice, white, raw", 123), pinned: true } };
  await assert.rejects(resolveUsdaMap(cached, { byId: async () => food("Rice, white, raw", 124), search: async () => [] }, "2026-10-04", [sku("white-rice")]), /white-rice: requested source ID was not returned/);
});

test("nutrition validation reports missing and unknown SKUs and non-finite or negative macros", () => {
  assert.deepEqual(nutritionProblems({}, [sku("white-rice")]), ["white-rice: missing nutrition match"]);
  const map: UsdaMap = { "white-rice": entry("Rice, white, raw"), orphan: entry("Unknown food") };
  assert.ok(nutritionProblems(map, [sku("white-rice")]).includes("orphan: unknown nutrition SKU"));
  delete map.orphan;
  for (const field of ["protein_g", "kcal", "fat_g", "carbs_g"] as const) for (const value of [-1, NaN, Infinity]) {
    assert.ok(nutritionProblems({ "white-rice": { ...map["white-rice"], [field]: value } }, [sku("white-rice")]).includes(`white-rice: invalid ${field}`));
  }
  assert.ok(nutritionProblems({ "white-rice": { ...map["white-rice"], kcal: 0 } }, [sku("white-rice")]).includes("white-rice: invalid kcal"));
});

test("valid existing matches retain values and refreshed pins update only the result copy", async () => {
  const cached = { "white-rice": { ...entry("Rice, white, raw", 123), pinned: true } };
  const original = structuredClone(cached);
  const result = await resolveUsdaMap(cached, { byId: async () => food("Rice, white, raw", 123), search: async () => [] }, "2026-10-05", [sku("white-rice")]);
  assert.equal(result["white-rice"].matched_at, "2026-10-05");
  assert.deepEqual(cached, original);
  const ordinary = { "white-rice": entry("Rice, white, raw", 123) };
  assert.deepEqual(await resolveUsdaMap(ordinary, { byId: async () => { throw new Error("must not fetch"); }, search: async () => { throw new Error("must not search"); } }, "2026-10-05", [sku("white-rice")]), ordinary);
});

test("the authored pea query no longer asks the source for soy powder", () => {
  assert.equal(sku("pea-protein").usda, "Pea protein powder");
});

test("missing nutrients or energy cannot be invented during search or pin refresh", async () => {
  const missing = food("Lentils, raw", 172420);
  missing.foodNutrients = missing.foodNutrients.filter(n => n.nutrientId !== 1008);
  assert.equal(pickUsdaFood("Lentils, raw", [missing]), undefined);
  const cached = { lentils: { ...entry("Lentils, raw", 172420), pinned: true } };
  await assert.rejects(resolveUsdaMap(cached, { byId: async () => missing, search: async () => [] }, "2026-10-04", [sku("lentils")]), /invalid kcal/);
  const noCarbs = food("Lentils, raw", 172420);
  noCarbs.foodNutrients = noCarbs.foodNutrients.filter(n => n.nutrientId !== 1005);
  assert.equal(pickUsdaFood("Lentils, raw", [noCarbs]), undefined);
});

test("skin-only potatoes and single-ingredient blend proxies fail even when renamed or manual", () => {
  for (const [id, description, source] of [["russet-potatoes", "Potatoes, flesh and skin, raw", 170032], ["frozen-peppers-onions", "Peppers and onions", 170022], ["taco-seasoning", "Taco seasoning", 171319]] as const) {
    assert.ok(nutritionProblems({ [id]: { ...entry(description, source), manual: true } }, [sku(id)]).some(p => p.includes("nutrition identity")));
  }
});
