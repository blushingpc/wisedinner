// authored recipes → snapshot rows. a variant is a full recipe of its own (ingredients = base rows with the swap map
// applied, plus adds); recipe_variants links it back to its base with the swap kind.
import type { Recipe, RecipeIngredient, RecipeVariant, Sku } from "../../packages/solver/src/types.ts";
import type { AuthoredRecipe, Ing } from "./authored/types.ts";
import type { AuthoredSku } from "./authored/skus.ts";

export const TAGS = ["healthy", "would_order"];

export function expandRecipes(authored: AuthoredRecipe[]) {
  const recipes: Recipe[] = [];
  const ingredients: RecipeIngredient[] = [];
  const variants: RecipeVariant[] = [];
  const seen = new Set<string>();
  const push = (id: string, name: string, meal_type: Recipe["meal_type"], protein: string, minutes: number, steps: string[], rows: Ing[], variantTag?: string) => {
    if (seen.has(id)) throw new Error(`duplicate recipe id ${id}`);
    seen.add(id);
    recipes.push({ id, name, meal_type, tags: [...TAGS, `protein:${protein}`, ...(variantTag ? [`variant:${variantTag}`] : [])], servings: 1, minutes, steps });
    const merged = new Map<string, Ing>();
    for (const r of rows) {
      const prev = merged.get(r[0]);
      if (prev && prev[2] === r[2]) merged.set(r[0], [r[0], prev[1] + r[1], r[2]]);
      else if (prev) throw new Error(`${id}: ${r[0]} listed twice with different units`);
      else merged.set(r[0], r);
    }
    for (const [sku_id, qty, unit] of merged.values()) ingredients.push({ recipe_id: id, sku_id, qty, unit });
  };
  for (const r of authored) {
    push(r.id, r.name, r.meal_type, r.protein, r.minutes, r.steps, r.ingredients);
    for (const v of r.variants) {
      const rows: Ing[] = [];
      for (const row of r.ingredients) {
        if (row[0] in v.swap) {
          const rep = v.swap[row[0]];
          if (rep) rows.push(rep);
        } else rows.push(row);
      }
      for (const k of Object.keys(v.swap)) if (!r.ingredients.some((row) => row[0] === k)) throw new Error(`${v.id}: swap target ${k} is not in ${r.id}`);
      rows.push(...(v.add ?? []));
      push(v.id, v.name, r.meal_type, v.protein, v.minutes ?? r.minutes, v.steps ?? r.steps, rows, v.kind);
      variants.push({ recipe_id: r.id, variant_recipe_id: v.id, kind: v.kind });
    }
  }
  return { recipes, ingredients, variants };
}

export const toSku = (a: AuthoredSku): Sku => ({
  id: a.id,
  name: a.name,
  aisle: a.aisle,
  perishable: a.perishable,
  pack_qty: a.pack_qty,
  pack_unit: a.pack_unit,
  pack_label: a.pack_label,
  canonical_unit: a.canonical_unit,
  grams_per_unit: a.grams_per_unit,
  diet_flags: a.diet_flags,
  baseline_usd: a.baseline_usd,
});
