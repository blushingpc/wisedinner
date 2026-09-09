import type { MealType, Unit, VariantKind } from "../../../packages/solver/src/types.ts";

// one ingredient row: sku id, quantity, unit. g-skus take g | kg | oz | lb; ml-skus take ml | l | fl_oz | cup | tbsp | tsp;
// each-skus take each (fractions allowed: 0.5 each = half an onion).
export type Ing = [skuId: string, qty: number, unit: Unit];

export type AuthoredVariant = {
  id: string; // slug, unique across recipes
  name: string; // sentence case, shown to users
  kind: VariantKind;
  protein: string; // headline protein, e.g. "tofu"
  swap: Record<string, Ing | null>; // base sku id → replacement row (null removes the row)
  add?: Ing[]; // extra rows
  minutes?: number;
  steps?: string[]; // when omitted the base steps are reused with the swapped names
};

export type AuthoredRecipe = {
  id: string; // slug = the photo id in public/img/menu for the 27 bases
  name: string; // sentence case, exactly as in REDESIGN-V4 §4
  meal_type: MealType;
  protein: string; // headline protein source, e.g. "chicken breast"
  minutes: number;
  ingredients: Ing[]; // one person-serving
  steps: string[]; // 3 to 5 short sentence-case steps, no dashes or middots
  variants: AuthoredVariant[]; // exactly two: one protein_swap, one carb_swap (veg_swap allowed as a third)
};
