import { SKUS } from "./authored/skus.ts";
import type { Diet, Snapshot } from "../../packages/solver/src/types.ts";

// Same vocabulary as the app, different lookup key and explicit unknown state.
export const ALLERGENS = ["peanuts", "tree-nuts", "dairy", "eggs", "wheat", "soy", "fish", "shellfish", "sesame"] as const;
export type Allergen = (typeof ALLERGENS)[number];
export type Category = "meat" | "poultry" | "fish" | "shellfish" | "dairy" | "eggs" | "honey" | "gluten";
export type SafetyReview = {
  sku_id: string; status: "reviewed" | "unreviewed";
  allergens: Allergen[] | null; diet: Category[] | null;
  known_allergens: Allergen[]; known_diet: Category[];
  basis: string; sources: string[]; reviewed_at: string;
  package_cross_contact: "unverified";
};
export type SafetyTable = Record<string, SafetyReview>;
const FDA = "https://www.fda.gov/food/nutrition-food-labeling-and-critical-foods/food-allergies";

const SIMPLE: Record<string, [Allergen[], Category[]]> = {
  "chicken-breast": [[], ["poultry"]], "chicken-thighs": [[], ["poultry"]],
  "ground-turkey": [[], ["poultry"]], "ground-beef": [[], ["meat"]], "pork-loin": [[], ["meat"]],
  eggs: [["eggs"], ["eggs"]], lentils: [[], []], "white-rice": [[], []], "brown-rice": [[], []], quinoa: [[], []],
  "russet-potatoes": [[], []], "sweet-potatoes": [[], []], bananas: [[], []], apples: [[], []],
  avocados: [[], []], onions: [[], []], carrots: [[], []], "bell-peppers": [[], []],
  romaine: [[], []], tomatoes: [[], []], cucumber: [[], []], asparagus: [[], []],
  "frozen-broccoli": [[], []], "frozen-edamame": [["soy"], []], honey: [[], ["honey"]],
};

const KNOWN: Record<string, [Allergen[], Category[]]> = {
  "frozen-chicken-breast": [[], ["poultry"]], "deli-turkey": [[], ["poultry"]], "canned-chicken": [[], ["poultry"]],
  "frozen-tilapia": [["fish"], ["fish"]], "frozen-salmon": [["fish"], ["fish"]], "canned-tuna": [["fish"], ["fish"]],
  "frozen-shrimp": [["shellfish"], ["shellfish"]],
  "egg-whites": [["eggs"], ["eggs"]], "greek-yogurt": [["dairy"], ["dairy"]],
  "cottage-cheese": [["dairy"], ["dairy"]], milk: [["dairy"], ["dairy"]], "string-cheese": [["dairy"], ["dairy"]],
  "shredded-cheddar": [["dairy"], ["dairy"]], "shredded-mozzarella": [["dairy"], ["dairy"]], parmesan: [["dairy"], ["dairy"]], butter: [["dairy"], ["dairy"]],
  "plant-yogurt": [["tree-nuts"], []], "whey-protein": [["dairy"], ["dairy"]],
  tofu: [["soy"], []], tempeh: [["soy"], []], "peanut-butter": [["peanuts"], []],
  spaghetti: [["wheat"], ["gluten"]], "ww-spaghetti": [["wheat"], ["gluten"]], penne: [["wheat"], ["gluten"]],
  "ww-bread": [["wheat"], ["gluten"]], "flour-tortillas": [["wheat"], ["gluten"]], "ww-buns": [["wheat"], ["gluten"]],
  "pancake-mix": [["wheat", "dairy"], ["gluten", "dairy"]], breadcrumbs: [["wheat"], ["gluten"]],
  "soy-sauce": [["soy", "wheat"], ["gluten"]], "teriyaki-sauce": [["soy", "wheat"], ["gluten"]],
  pesto: [["dairy", "tree-nuts"], ["dairy"]], "caesar-dressing": [["eggs", "dairy", "fish"], ["eggs", "dairy", "fish"]],
  tzatziki: [["dairy"], ["dairy"]], hummus: [["sesame"], []],
};

export const SAFETY: SafetyTable = Object.fromEntries(SKUS.map(s => {
  const simple = SIMPLE[s.id];
  const known = simple ?? KNOWN[s.id] ?? [[], []];
  return [s.id, {
    sku_id: s.id, status: simple ? "reviewed" : "unreviewed",
    allergens: simple ? [...simple[0]] : null, diet: simple ? [...simple[1]] : null,
    known_allergens: [...known[0]], known_diet: [...known[1]],
    basis: simple ? "Inherent ingredient categories for the authored plain single ingredient only. Not a package cross-contact clearance."
      : "Original package ingredient statement not reviewed. Known tags are conservative clues, not a complete list; oats also need gluten/package review.",
    sources: [FDA], reviewed_at: "2026-10-04", package_cross_contact: "unverified",
  } satisfies SafetyReview];
}));

const EXCLUDES: Record<Diet, Category[]> = {
  none: [], vegetarian: ["meat", "poultry", "fish", "shellfish"],
  vegan: ["meat", "poultry", "fish", "shellfish", "dairy", "eggs", "honey"],
  "dairy-free": ["dairy"], "gluten-free": ["gluten"],
};

export function ingredientAllowed(id: string, diet: Diet, allergies: readonly string[], table = SAFETY): boolean {
  if (!(diet in EXCLUDES)) throw new Error("Unknown diet restriction");
  if (allergies.some(a => !(ALLERGENS as readonly string[]).includes(a))) throw new Error("Unknown allergen restriction");
  if (diet === "none" && allergies.length === 0) return true; // legacy unrestricted behavior preserved
  const review = table[id];
  if (!review || review.sku_id !== id || review.status !== "reviewed" || !Array.isArray(review.allergens) || !Array.isArray(review.diet)) return false;
  if (review.allergens.some(a => !(ALLERGENS as readonly string[]).includes(a)) || review.diet.some(c => !["meat", "poultry", "fish", "shellfish", "dairy", "eggs", "honey", "gluten"].includes(c))) return false;
  return !review.allergens.some(a => allergies.includes(a)) && !review.diet.some(c => EXCLUDES[diet].includes(c));
}

// Filter FULL compiled ingredient rows, so sauce, seasoning and variant additions cannot evade exclusions.
export function eligibleSnapshot(snapshot: Snapshot, diet: Diet, allergies: readonly string[], table = SAFETY): Snapshot {
  ingredientAllowed("", diet, allergies, table); // validate restrictions even for an empty catalog
  if (diet === "none" && allergies.length === 0) return snapshot;
  const ids = new Set(snapshot.recipes.filter(r => {
    const rows = snapshot.recipe_ingredients.filter(i => i.recipe_id === r.id);
    return rows.length > 0 && rows.every(i => ingredientAllowed(i.sku_id, diet, allergies, table));
  }).map(r => r.id));
  // Do not turn a surviving variant into a new base and silently relax repeat caps.
  for (const link of snapshot.recipe_variants) if (!ids.has(link.recipe_id)) ids.delete(link.variant_recipe_id);
  return {
    ...snapshot, recipes: snapshot.recipes.filter(r => ids.has(r.id)),
    recipe_ingredients: snapshot.recipe_ingredients.filter(i => ids.has(i.recipe_id)),
    recipe_variants: snapshot.recipe_variants.filter(v => ids.has(v.recipe_id) && ids.has(v.variant_recipe_id)),
  };
}
