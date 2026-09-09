import type { Snapshot } from "./types.ts";
import { templatesOf } from "./snapshot.ts";
import { PRICE_BUFFER, priceMapFor } from "./pricing.ts";
import { packCanonical, round2 } from "./units.ts";

// per-serving numbers for menu display: Σ(qty × unit_price) at one store (buffered like the solver) and macros
// from nutrition per 100 g × grams. estimates by construction; the site marks them estimate: true.
export function servingCost(recipeId: string, s: Snapshot, storeId: string, zip = "00000"): number {
  const store = s.stores.find((x) => x.id === storeId);
  if (!store) throw new Error(`unknown store ${storeId}`);
  const map = priceMapFor(s, store, zip);
  const t = templatesOf(s).find((x) => x.id === recipeId);
  if (!t) throw new Error(`unknown recipe ${recipeId}`);
  const skus = new Map(s.skus.map((k) => [k.id, k]));
  let c = 0;
  for (const p of t.parts) {
    const k = skus.get(p.sku)!;
    const raw = map.get(k.id)!.price_usd / PRICE_BUFFER;
    c += (p.qty / packCanonical(k)) * raw * PRICE_BUFFER;
  }
  return round2(c);
}

export function servingNutrition(recipeId: string, s: Snapshot): { protein_g: number; kcal: number } {
  const t = templatesOf(s).find((x) => x.id === recipeId);
  if (!t) throw new Error(`unknown recipe ${recipeId}`);
  const skus = new Map(s.skus.map((k) => [k.id, k]));
  const nut = new Map(s.nutrition.map((n) => [n.sku_id, n]));
  let protein = 0;
  let kcal = 0;
  for (const p of t.parts) {
    const k = skus.get(p.sku)!;
    const n = nut.get(k.id)!;
    const grams = p.qty * k.grams_per_unit;
    protein += (n.protein_g * grams) / 100;
    kcal += (n.kcal * grams) / 100;
  }
  return { protein_g: Math.round(protein), kcal: Math.round(kcal) };
}
