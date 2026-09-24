import { readFileSync } from "node:fs";
import type { Snapshot, Sku, Recipe, RecipeIngredient, Nutrition, StorePrice, Store } from "../src/types.ts";
import { validateSnapshot } from "../src/snapshot.ts";

// the committed snapshot (scripts/data/run.ts writes it); tests run from the repo root
export const loadSnapshot = (): Snapshot => validateSnapshot(JSON.parse(readFileSync("data/snapshot.json", "utf8")));

// a hand-built snapshot with exact numbers for the arithmetic tests
export function miniSnapshot(overrides: Partial<Snapshot> = {}): Snapshot {
  const stores: Store[] = [
    { id: "a", chain: "A", banner: "Store A", region_scope: "national", price_index: 1, live: true },
    { id: "b", chain: "B", banner: "Store B", region_scope: "national", price_index: 1.08, live: true },
    { id: "c", chain: "C", banner: "Store C", region_scope: "national", price_index: 0.9, live: false },
  ];
  const sku = (id: string, o: Partial<Sku>): Sku => ({
    id,
    name: id,
    aisle: "pantry",
    perishable: false,
    pack_qty: 1,
    pack_unit: "lb",
    pack_label: "1 lb",
    canonical_unit: "g",
    grams_per_unit: 1,
    diet_flags: ["vegetarian", "vegan", "gluten-free", "dairy-free"],
    baseline_usd: 2,
    ...o,
  });
  const skus: Sku[] = [
    sku("onion", { aisle: "produce", pack_qty: 1, pack_unit: "each", pack_label: "1 onion", canonical_unit: "each", grams_per_unit: 150, baseline_usd: 0.8 }),
    sku("rice", { pack_qty: 32, pack_unit: "oz", pack_label: "32 oz bag", baseline_usd: 4 }),
    sku("chicken", { aisle: "meat", perishable: true, pack_qty: 3, pack_unit: "lb", pack_label: "3 lb", diet_flags: ["gluten-free", "dairy-free"], baseline_usd: 9 }),
    sku("tofu", { aisle: "produce", perishable: true, pack_qty: 14, pack_unit: "oz", pack_label: "14 oz", baseline_usd: 2 }),
    sku("oats", { pack_qty: 42, pack_unit: "oz", pack_label: "42 oz", baseline_usd: 3.5 }),
    sku("whey", { pack_qty: 2, pack_unit: "lb", pack_label: "2 lb", diet_flags: ["vegetarian", "gluten-free"], baseline_usd: 20 }),
  ];
  const nutrition: Nutrition[] = [
    { sku_id: "onion", protein_g: 1.1, kcal: 40, fat_g: 0.1, carbs_g: 9, per: "100g" },
    { sku_id: "rice", protein_g: 7, kcal: 365, fat_g: 0.7, carbs_g: 80, per: "100g" },
    { sku_id: "chicken", protein_g: 22.5, kcal: 120, fat_g: 2.6, carbs_g: 0, per: "100g" },
    { sku_id: "tofu", protein_g: 17, kcal: 144, fat_g: 9, carbs_g: 3, per: "100g" },
    { sku_id: "oats", protein_g: 13, kcal: 379, fat_g: 6.5, carbs_g: 68, per: "100g" },
    { sku_id: "whey", protein_g: 78, kcal: 352, fat_g: 3, carbs_g: 6, per: "100g" },
  ];
  const recipes: Recipe[] = [
    { id: "oatmeal", name: "Protein oatmeal", meal_type: "breakfast", tags: [], servings: 1, minutes: 5, steps: [] },
    { id: "chicken-rice", name: "Chicken and rice", meal_type: "dinner", tags: [], servings: 1, minutes: 20, steps: [] },
    { id: "tofu-rice", name: "Tofu and rice", meal_type: "dinner", tags: [], servings: 1, minutes: 20, steps: [] },
    { id: "onion-rice", name: "Onion rice", meal_type: "lunch", tags: [], servings: 1, minutes: 10, steps: [] },
  ];
  const recipe_ingredients: RecipeIngredient[] = [
    { recipe_id: "oatmeal", sku_id: "oats", qty: 80, unit: "g" },
    { recipe_id: "oatmeal", sku_id: "whey", qty: 40, unit: "g" },
    { recipe_id: "chicken-rice", sku_id: "chicken", qty: 8, unit: "oz" },
    { recipe_id: "chicken-rice", sku_id: "rice", qty: 8, unit: "oz" },
    { recipe_id: "tofu-rice", sku_id: "tofu", qty: 14, unit: "oz" },
    { recipe_id: "tofu-rice", sku_id: "rice", qty: 8, unit: "oz" },
    { recipe_id: "onion-rice", sku_id: "onion", qty: 0.5, unit: "each" },
    { recipe_id: "onion-rice", sku_id: "rice", qty: 4, unit: "oz" },
  ];
  const store_prices: StorePrice[] = [
    { sku_id: "rice", store_id: "a", region: "national", shelf_price: 4, unit_price: 4 / 907.184, as_of: "2026-09-01" },
    { sku_id: "onion", store_id: "a", region: "national", shelf_price: 0.8, unit_price: 0.8, as_of: "2026-09-01" },
    { sku_id: "chicken", store_id: "a", region: "national", shelf_price: 9, unit_price: 9 / 1360.776, as_of: "2026-09-01" },
    { sku_id: "rice", store_id: "b", region: "national", shelf_price: 3, unit_price: 3 / 907.184, as_of: "2026-09-02" },
    { sku_id: "chicken", store_id: "b", region: "national", shelf_price: 12, unit_price: 12 / 1360.776, as_of: "2026-09-02" },
  ];
  return validateSnapshot({ version: 1, generated_at: "2026-09-09", stores, skus, store_prices, nutrition, recipes, recipe_ingredients, recipe_variants: [], ...overrides });
}
