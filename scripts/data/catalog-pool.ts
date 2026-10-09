// Offline bounded pool seam, not a solver-core port or public-route connection.
import type { Snapshot, SolveInput, Template } from "../../packages/solver/src/types.ts";
import { templatesOf, dietOk } from "../../packages/solver/src/snapshot.ts";
import { buildPriceBook } from "../../packages/solver/src/pricing.ts";
import { solve, belowMinimum } from "../../packages/solver/src/engine.ts";

export const POOL_LIMIT = 96;
function seededOrder(seed: number, id: string) {
  let hash = (2166136261 ^ seed) >>> 0;
  for (let i = 0; i < id.length; i++) { hash ^= id.charCodeAt(i); hash = Math.imul(hash, 16777619) >>> 0; }
  return hash;
}

export function shortlistCatalog(snapshot: Snapshot, input: SolveInput, anchors: string[] = [], limit = POOL_LIMIT): Snapshot {
  if (!Number.isInteger(limit) || limit < 3 || limit > POOL_LIMIT) throw new Error("Pool limit must be 3..96");
  if (snapshot.recipes.length <= limit) return snapshot; // exact old-path compatibility
  const templates = templatesOf(snapshot);
  const byId = new Map(templates.map(t => [t.id, t]));
  const parents = new Map(snapshot.recipe_variants.map(v => [v.variant_recipe_id, v.recipe_id]));
  const chosen = new Set<string>();
  const closure = (id: string) => {
    const chain: string[] = []; const seen = new Set<string>();
    while (id) {
      if (seen.has(id)) throw new Error("Cyclic recipe family");
      if (!byId.has(id)) throw new Error(`Unknown pool anchor or parent ${id}`);
      seen.add(id); chain.push(id); id = parents.get(id) ?? "";
    }
    return chain;
  };
  const add = (id: string) => {
    const chain = closure(id).filter(x => !chosen.has(x));
    if (chosen.size + chain.length > limit) return false;
    chain.forEach(x => chosen.add(x)); return true;
  };
  for (const id of anchors) if (!add(id)) throw new Error("Anchor recipes exceed bounded pool capacity");
  const nutrition = new Map(snapshot.nutrition.map(n => [n.sku_id, n]));
  const skus = new Map(snapshot.skus.map(k => [k.id, k]));
  const book = buildPriceBook(snapshot, input);
  const firstStore = book.stores[0];
  if (!firstStore) throw new Error("Chosen stores unavailable");
  const map = book.maps.get(book.mode === "bestPerItem" ? "__min__" : firstStore.id)!;
  const eligible = templates.filter(t => dietOk(t, input.diet) && t.parts.every(p => map.has(p.sku) && map.get(p.sku)!.price_usd <= input.budget));
  const cost = (t: Template) => t.parts.reduce((sum, p) => sum + p.frac * map.get(p.sku)!.price_usd, 0);
  const protein = (t: Template) => t.parts.reduce((sum, p) => sum + p.qty * skus.get(p.sku)!.grams_per_unit * nutrition.get(p.sku)!.protein_g / 100, 0);
  // Deterministic interleaving of cost, protein efficiency, protein and seeded variety; no hard constraint changes.
  const queues = ["breakfast", "main"].flatMap(slot => {
    const group = eligible.filter(t => slot === "breakfast" ? t.meal_type === "breakfast" : t.meal_type !== "breakfast");
    return [cost, (t: Template) => cost(t) / Math.max(protein(t), 1), (t: Template) => -protein(t), (t: Template) => seededOrder(input.seed ?? 0, t.id)]
      .map(key => [...group].sort((a, b) => key(a) - key(b) || a.id.localeCompare(b.id)));
  });
  for (let index = 0; index < snapshot.recipes.length && chosen.size < limit; index++) {
    for (const queue of queues) {
      const t = queue[index]; if (t) add(t.id);
      if (chosen.size === limit) break;
    }
  }
  return {
    ...snapshot, recipes: snapshot.recipes.filter(r => chosen.has(r.id)),
    recipe_ingredients: snapshot.recipe_ingredients.filter(i => chosen.has(i.recipe_id)),
    recipe_variants: snapshot.recipe_variants.filter(v => chosen.has(v.recipe_id) && chosen.has(v.variant_recipe_id)),
  };
}

export function solveBounded(input: SolveInput, snapshot: Snapshot, anchors: string[] = []) {
  const selected = belowMinimum(input) ? snapshot : shortlistCatalog(snapshot, input, anchors);
  if (!belowMinimum(input) && (!selected.recipes.some(r => r.meal_type === "breakfast") || !selected.recipes.some(r => r.meal_type !== "breakfast"))) throw new Error("Not enough recipes in the bounded pool");
  return { snapshot: selected, out: solve(input, selected) };
}
