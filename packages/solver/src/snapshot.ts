import { AISLES, DIETS, UNITS, type Diet, type DietFlag, type Recipe, type Snapshot, type Template } from "./types.ts";
import { packCanonical, toCanonical, UnitError } from "./units.ts";

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown) => typeof v === "string" && v.length > 0;

// throws one error listing every violation; a snapshot that passes can be solved against
export function validateSnapshot(raw: unknown): Snapshot {
  const bad: string[] = [];
  if (!isRecord(raw)) throw new Error("snapshot: not an object");
  const s = raw as unknown as Snapshot;
  for (const k of ["stores", "skus", "store_prices", "nutrition", "recipes", "recipe_ingredients", "recipe_variants"] as const) {
    if (!Array.isArray(s[k])) bad.push(`${k}: missing`);
  }
  if (bad.length) throw new Error(`snapshot invalid:\n${bad.join("\n")}`);
  if (!num(s.version)) bad.push("version: missing");
  if (!str(s.generated_at)) bad.push("generated_at: missing");

  const storeIds = new Set<string>();
  for (const st of s.stores) {
    if (!str(st.id) || storeIds.has(st.id)) bad.push(`store ${st.id}: bad or duplicate id`);
    storeIds.add(st.id);
    if (!num(st.price_index) || st.price_index <= 0) bad.push(`store ${st.id}: price_index`);
    if (typeof st.live !== "boolean") bad.push(`store ${st.id}: live flag`);
  }

  const skuIds = new Set<string>();
  const skuById = new Map(s.skus.map((k) => [k.id, k]));
  for (const k of s.skus) {
    if (!str(k.id) || skuIds.has(k.id)) bad.push(`sku ${k.id}: bad or duplicate id`);
    skuIds.add(k.id);
    if (!str(k.name)) bad.push(`sku ${k.id}: name`);
    if (!(AISLES as readonly string[]).includes(k.aisle)) bad.push(`sku ${k.id}: aisle ${k.aisle}`);
    if (!num(k.pack_qty) || k.pack_qty <= 0) bad.push(`sku ${k.id}: pack_qty`);
    if (!(UNITS as readonly string[]).includes(k.pack_unit)) bad.push(`sku ${k.id}: pack_unit ${k.pack_unit}`);
    if (!["g", "ml", "each"].includes(k.canonical_unit)) bad.push(`sku ${k.id}: canonical_unit`);
    if (!num(k.grams_per_unit) || k.grams_per_unit <= 0) bad.push(`sku ${k.id}: grams_per_unit`);
    if (!num(k.baseline_usd) || k.baseline_usd <= 0) bad.push(`sku ${k.id}: baseline_usd`);
    if (!Array.isArray(k.diet_flags)) bad.push(`sku ${k.id}: diet_flags`);
    else {
      for (const f of k.diet_flags as string[]) if (!(DIETS as readonly string[]).includes(f) || f === "none") bad.push(`sku ${k.id}: diet flag ${f}`);
      if (k.diet_flags.includes("vegan") && !(k.diet_flags.includes("vegetarian") && k.diet_flags.includes("dairy-free")))
        bad.push(`sku ${k.id}: vegan implies vegetarian and dairy-free`);
    }
    try {
      packCanonical(k);
    } catch (e) {
      bad.push(`sku ${k.id}: ${(e as Error).message}`);
    }
  }

  const nutritionFor = new Set(s.nutrition.map((n) => n.sku_id));
  for (const n of s.nutrition) {
    if (!skuIds.has(n.sku_id)) bad.push(`nutrition ${n.sku_id}: unknown sku`);
    if (!num(n.protein_g) || !num(n.kcal) || n.kcal <= 0) bad.push(`nutrition ${n.sku_id}: protein/kcal`);
  }

  for (const p of s.store_prices) {
    if (!skuIds.has(p.sku_id)) bad.push(`price ${p.sku_id}@${p.store_id}: unknown sku`);
    if (!storeIds.has(p.store_id)) bad.push(`price ${p.sku_id}@${p.store_id}: unknown store`);
    if (!num(p.shelf_price) || p.shelf_price <= 0) bad.push(`price ${p.sku_id}@${p.store_id}: shelf_price`);
    if (!str(p.as_of)) bad.push(`price ${p.sku_id}@${p.store_id}: as_of`);
    const sku = skuById.get(p.sku_id);
    if (sku && num(p.unit_price)) {
      try {
        if (Math.abs(p.unit_price * packCanonical(sku) - p.shelf_price) > 0.011) bad.push(`price ${p.sku_id}@${p.store_id}: unit_price does not match shelf_price over the pack`);
      } catch {
        /* reported on the sku */
      }
    }
  }

  const recipeIds = new Set<string>();
  for (const r of s.recipes) {
    if (!str(r.id) || recipeIds.has(r.id)) bad.push(`recipe ${r.id}: bad or duplicate id`);
    recipeIds.add(r.id);
    if (!str(r.name)) bad.push(`recipe ${r.id}: name`);
    if (!["breakfast", "lunch", "dinner"].includes(r.meal_type)) bad.push(`recipe ${r.id}: meal_type`);
    if (!num(r.servings) || r.servings <= 0) bad.push(`recipe ${r.id}: servings`);
  }
  const ingredientsOf = new Map<string, number>();
  for (const i of s.recipe_ingredients) {
    if (!recipeIds.has(i.recipe_id)) bad.push(`ingredient ${i.recipe_id}/${i.sku_id}: unknown recipe`);
    const sku = skuById.get(i.sku_id);
    if (!sku) bad.push(`ingredient ${i.recipe_id}/${i.sku_id}: unknown sku`);
    else {
      if (!nutritionFor.has(i.sku_id)) bad.push(`ingredient ${i.recipe_id}/${i.sku_id}: sku has no nutrition`);
      if (!num(i.qty) || i.qty <= 0) bad.push(`ingredient ${i.recipe_id}/${i.sku_id}: qty`);
      try {
        toCanonical(i.qty, i.unit, sku);
      } catch (e) {
        bad.push(`ingredient ${i.recipe_id}/${i.sku_id}: ${(e as UnitError).message}`);
      }
    }
    ingredientsOf.set(i.recipe_id, (ingredientsOf.get(i.recipe_id) ?? 0) + 1);
  }
  for (const id of recipeIds) if (!ingredientsOf.get(id)) bad.push(`recipe ${id}: no ingredients`);
  for (const v of s.recipe_variants) {
    if (!recipeIds.has(v.recipe_id) || !recipeIds.has(v.variant_recipe_id)) bad.push(`variant ${v.recipe_id}→${v.variant_recipe_id}: unknown recipe`);
    if (!["protein_swap", "carb_swap", "veg_swap"].includes(v.kind)) bad.push(`variant ${v.recipe_id}→${v.variant_recipe_id}: kind`);
  }

  if (bad.length) throw new Error(`snapshot invalid:\n${bad.join("\n")}`);
  return s;
}

// recipes that are not a variant of another recipe
export const baseRecipes = (s: Snapshot): Recipe[] => {
  const variants = new Set(s.recipe_variants.map((v) => v.variant_recipe_id));
  return s.recipes.filter((r) => !variants.has(r.id));
};

// every recipe as an internal template: parts in canonical units per person-serving, diet = the intersection of
// the ingredients' flags, base_id from recipe_variants. independent of prices; the pool filters on price later.
export function templatesOf(s: Snapshot): Template[] {
  const skuById = new Map(s.skus.map((k) => [k.id, k]));
  const variantOf = new Map(s.recipe_variants.map((v) => [v.variant_recipe_id, v]));
  const rows = new Map<string, Map<string, number>>();
  for (const i of s.recipe_ingredients) {
    const sku = skuById.get(i.sku_id)!;
    const m = rows.get(i.recipe_id) ?? new Map<string, number>();
    m.set(i.sku_id, (m.get(i.sku_id) ?? 0) + toCanonical(i.qty, i.unit, sku)); // duplicate rows for one sku add up
    rows.set(i.recipe_id, m);
  }
  return s.recipes.map((r) => {
    const m = rows.get(r.id) ?? new Map<string, number>();
    const parts = [...m].map(([sku, q]) => {
      const k = skuById.get(sku)!;
      const qty = q / r.servings;
      return { sku, qty, frac: qty / packCanonical(k) };
    });
    let diet: Set<DietFlag> | undefined;
    for (const p of parts) {
      const f = new Set<DietFlag>(skuById.get(p.sku)!.diet_flags);
      const prev: Set<DietFlag> | undefined = diet;
      diet = prev ? new Set<DietFlag>([...prev].filter((x) => f.has(x))) : f;
    }
    const v = variantOf.get(r.id);
    return {
      id: r.id,
      name: r.name,
      meal_type: r.meal_type,
      parts,
      base_id: v?.recipe_id ?? r.id,
      variant: v?.kind,
      diet: diet ?? new Set<DietFlag>(),
      stable: parts.every((p) => !skuById.get(p.sku)!.perishable),
    };
  });
}

export const dietOk = (t: Template, diet: Diet) => diet === "none" || t.diet.has(diet);

// the snapshot as served to users: same shape, nothing to strip today (no source or confidence fields exist in it).
// kept as the one place to remove internals if any are ever added.
export const toPublicSnapshot = (s: Snapshot): Snapshot => s;
