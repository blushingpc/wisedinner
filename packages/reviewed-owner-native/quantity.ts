import type {Nutrition,Snapshot} from "./core/types.ts";
import type {SafetyTable} from "./ingredient-safety.ts";
import {validateSnapshot} from "./core/snapshot.ts";
import {packCanonical,toCanonical} from "./core/units.ts";
import source from "./source.ts";
export type QuantityReview = {
  sku_id: string; source: string; identity: string; accessed: string;
  source_basis: "raw-edible" | "dry" | "frozen-edible" | "piece-edible";
  edible_per_purchased: number; yield_source: string; yield_row: string; limits: string;
  nutrition: Nutrition;
  purchase_basis?: string;
};
export type ReviewBundle = { quantities: Record<string, QuantityReview>; safety: SafetyTable; input_digest: string; source_digest: string; blocked: string[] };

// Static correspondence, not a runtime SHA implementation. The exact tuple and original
// review digest are authenticated by the build-time source manifest and full source equality.
const digest=(v:unknown)=>JSON.stringify(v);
const purchaseBasis=(s:Snapshot["skus"][number])=>{const original=source.edible.skus.find(v=>v.id===s.id),review=Object.entries(source.reviews.quantities).find(([id])=>id===s.id)?.[1];if(!original||!review||digest([s.id,s.pack_qty,s.pack_unit,s.pack_label,s.canonical_unit,s.grams_per_unit])!==digest([original.id,original.pack_qty,original.pack_unit,original.pack_label,original.canonical_unit,original.grams_per_unit]))throw Error("reviewed_native_basis_held");return review.purchase_basis;};
export function projectPurchased(edible: Snapshot, reviews: Record<string, QuantityReview>): Snapshot {
  for (const sku of edible.skus) {
    const r = reviews[sku.id];
    if (!r || r.sku_id !== sku.id || !r.source || !r.yield_source || !r.yield_row || !Number.isFinite(r.edible_per_purchased) || r.edible_per_purchased <= 0 || r.edible_per_purchased > 1) throw new Error(`${sku.id}: quantity review unavailable`);
    if (r.purchase_basis !== purchaseBasis(sku)) throw new Error(`${sku.id}: purchase basis changed; review stale`);
    const n = edible.nutrition.find(n => n.sku_id === sku.id);
    if (!n || digest(n) !== digest(r.nutrition) || [n.protein_g,n.kcal,n.fat_g,n.carbs_g].some(v => !Number.isFinite(v) || v < 0)) throw new Error(`${sku.id}: original source nutrients missing or stale`);
    if (sku.canonical_unit !== "g" && r.edible_per_purchased !== 1) throw new Error(`${sku.id}: piece/density yield needs separate review`);
  }
  return validateSnapshot({ ...edible,
    // Physical pack labels, quantity, density and prices are NOT changed. This nutrient projection is private purchase-equivalent accounting, NOT edible per-100-g data.
    nutrition: edible.nutrition.map(n => { const review = reviews[n.sku_id]; if (!review) throw new Error(`${n.sku_id}: quantity review unavailable`); const y = review.edible_per_purchased; return { ...n, protein_g: n.protein_g*y, kcal: n.kcal*y, fat_g: n.fat_g*y, carbs_g: n.carbs_g*y }; }),
    recipe_ingredients: edible.recipe_ingredients.map(i => { const review = reviews[i.sku_id]; if (!review) throw new Error(`${i.sku_id}: quantity review unavailable`); return { ...i, qty: i.qty / review.edible_per_purchased }; }),
  });
}

export function purchaseArithmetic(sku: Snapshot["skus"][number], edibleCanonical: number, household: number, review: QuantityReview) {
  if (!Number.isFinite(edibleCanonical) || edibleCanonical <= 0 || !Number.isInteger(household) || household <= 0) throw new Error("Invalid serving/household");
  const y = review.edible_per_purchased;
  if (!Number.isFinite(y) || y <= 0 || y > 1) throw new Error("Unavailable edible yield");
  const edible = edibleCanonical * household, usedPurchased = edible/y, pack = packCanonical(sku);
  const packs = Math.ceil(usedPurchased/pack-1e-6), purchased = packs*pack;
  return { canonical_unit: sku.canonical_unit, packs, purchased, usedPurchased, edible, usableEdibleCapacity: purchased*y,
    preparationRefuse: y === 1 ? 0 : usedPurchased-edible, unpreparedCarryover: purchased-usedPurchased, edibleCarryoverEstimate: purchased*y-edible };
}

export function canonicalRow(row: Snapshot["recipe_ingredients"][number], snapshot: Snapshot) {
  return toCanonical(row.qty, row.unit, snapshot.skus.find(s => s.id === row.sku_id)!);
}
