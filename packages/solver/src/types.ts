// packages/solver: the meal solver over a data snapshot. no deps, relative .ts imports only (node runs it natively,
// the app copies this folder). user-facing shapes carry no source or confidence fields (BACKEND-V1 §1).

export const DIETS = ["none", "vegetarian", "vegan", "gluten-free", "dairy-free"] as const;
export type Diet = (typeof DIETS)[number];
export type DietFlag = Exclude<Diet, "none">;

export const AISLES = ["produce", "meat", "dairy", "bakery", "frozen", "pantry"] as const;
export type Aisle = (typeof AISLES)[number];

export const UNITS = ["g", "kg", "oz", "lb", "ml", "l", "fl_oz", "cup", "tbsp", "tsp", "each"] as const;
export type Unit = (typeof UNITS)[number];
export type CanonicalUnit = "g" | "ml" | "each";

export type Store = {
  id: string;
  chain: string;
  banner: string;
  region_scope: string;
  price_index: number; // relative to the national baseline (1.00); docs/STORE-INDEX.md
  live: boolean; // this snapshot holds observed shelf prices for the store (gates the multi-store modes)
};

export type Sku = {
  id: string;
  name: string; // "chicken breast, boneless skinless" (the part before the comma is the short label)
  aisle: Aisle;
  perishable: boolean;
  pack_qty: number; // as sold, e.g. 32
  pack_unit: Unit; // e.g. "oz"
  pack_label: string; // as printed, e.g. "32 oz tub", "dozen"
  canonical_unit: CanonicalUnit;
  grams_per_unit: number; // grams per canonical unit (1 for g; density for ml; piece weight for each)
  diet_flags: DietFlag[]; // vegan implies vegetarian + dairy-free
  baseline_usd: number; // national baseline shelf price, raw (no buffer); index estimates scale this
};

export type StorePrice = {
  sku_id: string;
  store_id: string;
  region: string; // the ZIP the price was observed in, or "national"
  shelf_price: number; // raw shelf price for one pack (no buffer)
  unit_price: number; // per canonical unit
  as_of: string; // YYYY-MM-DD
};

export type Nutrition = { sku_id: string; protein_g: number; kcal: number; fat_g: number; carbs_g: number; per: "100g" };

export type MealType = "breakfast" | "lunch" | "dinner";
export type Recipe = {
  id: string; // slug; also the photo id (/img/menu/<id>.jpg)
  name: string; // sentence case, as shown
  meal_type: MealType;
  tags: string[]; // healthy, would_order, protein:<source>, variant:<kind>
  servings: number; // the ingredient rows make this many person-servings
  minutes: number;
  steps: string[];
};
export type RecipeIngredient = { recipe_id: string; sku_id: string; qty: number; unit: Unit };
export type VariantKind = "protein_swap" | "carb_swap" | "veg_swap";
export type RecipeVariant = { recipe_id: string; variant_recipe_id: string; kind: VariantKind };

export type Snapshot = {
  version: number;
  generated_at: string; // YYYY-MM-DD
  stores: Store[];
  skus: Sku[];
  store_prices: StorePrice[]; // observed prices only; anything else is baseline × price_index at solve time
  nutrition: Nutrition[];
  recipes: Recipe[];
  recipe_ingredients: RecipeIngredient[];
  recipe_variants: RecipeVariant[];
};

export type StoreMode = "singleStore" | "bestPerItem" | "estimate";

export type SolveInput = {
  budget: number; // weekly, USD, whole household
  protein_per_day: number; // grams, per person
  kcal_min: number; // per person per day
  kcal_max: number;
  diet: Diet;
  household: number; // people eating
  pantry?: string[]; // sku ids already owned: excluded from the total
  seed?: number; // picks among near-optimal weeks; same seed → same week
  stores: string[]; // one to three store ids from snapshot.stores
  zip: string; // the user's ZIP; picks the closest observed region when a store has several
  mode?: "singleStore" | "bestPerItem"; // requested; downgraded when the data does not support it
};

export type PlanItem = {
  name: string; // recipe name
  unit: string; // slot: breakfast | lunch | dinner
  portion: string; // ingredients as pack fractions per person, e.g. "oats 1/12 · whey 1/30"
  protein_g: number; // per person
  kcal: number; // per person
  recipe_id: string;
  cost_usd: number; // this serving's share of the list, per person
};

export type ListItem = {
  name: string; // sku name
  unit: string; // pack label
  qty: number; // packs to buy
  price_usd: number; // buffered, whole packs; 0 when the sku is in the pantry
  perishable: boolean;
  eaten: number; // packs consumed this week (shelf-stable leftovers carry over)
  sku_id: string;
  aisle: Aisle;
  store: string; // store id this pack is priced at
  pantry: boolean;
};

export type SolveOutput = {
  feasible: boolean; // every day in range, every variety floor met, list under budget
  days: { day: string; items: PlanItem[]; protein_g: number; kcal: number }[]; // per person
  list: ListItem[];
  est_total: number; // est. in-store shelf total, buffered prices, whole packs
  protein_per_day: number; // achieved on the weakest day, per person
  kcal_per_day: number; // weekly average, per person
  protein_shortfall_g: number; // grams still missing across the week when infeasible
  price_as_of: string; // oldest price date used
  distinct_skus: number;
  protein_sources: number;
  seed: number;
  why: string[]; // constraints still violated when infeasible (plain words)
  input: SolveInput; // echoed so regenerateSlot / swapCandidates need only (week, snapshot)
  store_mode: StoreMode;
  modes_available: ("singleStore" | "bestPerItem")[];
  stores: { id: string; banner: string; subtotal: number; items: number }[];
  alt_total?: number; // the same list priced in the other available mode
};

export type SwapCandidate = {
  recipe_id: string;
  name: string;
  deltaCost: number; // whole-list total after the swap minus before (household)
  deltaProtein: number; // that day's protein per person after minus before
  usesExisting: boolean; // every ingredient is already on the list or in the pantry
  newItems: string[]; // sku ids the swap would add to the list
  variantOf?: { recipe_id: string; kind: VariantKind }; // when the candidate is a variant of the recipe in the slot
};

// internal pool shapes (exported for tests)
export type Part = { sku: string; qty: number; frac: number }; // qty in the sku's canonical unit per person-serving; frac = qty / pack
export type Template = {
  id: string;
  name: string;
  meal_type: MealType;
  parts: Part[];
  base_id: string; // the recipe this is a variant of (itself for a base)
  variant?: VariantKind;
  diet: Set<DietFlag>;
  stable: boolean; // every part is shelf-stable or frozen
};
export type PoolSku = Sku & {
  packCanonical: number;
  packGrams: number;
  protein_g: number; // per whole pack
  kcal: number; // per whole pack
  price_usd: number; // buffered pack price at the chosen store map
  price_as_of: string;
  store: string;
};
export type Pool = { templates: Template[]; skus: Map<string, PoolSku> };
export type Week = Template[][]; // [day][slot]
