// index estimates: for every (sku, store) with no live source, shelf price = national baseline × the store's
// price_index, confidence 0.3. the baseline per sku is the median live Kroger-family price across regions divided
// by the family index (1.00), else the authored baseline_usd (docs/STORE-INDEX.md).
import type { Store } from "../../packages/solver/src/types.ts";
import { packCanonical } from "../../packages/solver/src/units.ts";
import { SKUS } from "./authored/skus.ts";

export type LiveRow = { sku_id: string; store_id: string; region: string; shelf_price: number; unit_price: number; source: string; confidence: number; as_of: string };
export type IndexRow = LiveRow & { source: "index-estimate" };

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};

// national baseline per sku from live rows (Kroger family, index 1.00 for the family; per-banner index applied)
export function baselines(live: LiveRow[], stores: Store[]): Record<string, number> {
  const idx = new Map(stores.map((s) => [s.id, s.price_index]));
  const bySku = new Map<string, number[]>();
  for (const r of live) {
    if (r.source === "index-estimate") continue;
    const i = idx.get(r.store_id) ?? 1;
    const arr = bySku.get(r.sku_id) ?? [];
    arr.push(r.shelf_price / i);
    bySku.set(r.sku_id, arr);
  }
  const out: Record<string, number> = {};
  for (const s of SKUS) {
    const xs = bySku.get(s.id);
    out[s.id] = xs?.length ? Math.round(median(xs) * 100) / 100 : s.baseline_usd;
  }
  return out;
}

export function indexRows(live: LiveRow[], stores: Store[], asOf: string): IndexRow[] {
  const base = baselines(live, stores);
  const have = new Set(live.map((r) => `${r.sku_id}|${r.store_id}`));
  const rows: IndexRow[] = [];
  for (const st of stores) {
    for (const s of SKUS) {
      if (have.has(`${s.id}|${st.id}`)) continue;
      const shelf = Math.round(base[s.id] * st.price_index * 100) / 100;
      rows.push({ sku_id: s.id, store_id: st.id, region: "national", shelf_price: shelf, unit_price: shelf / packCanonical(s), source: "index-estimate", confidence: 0.3, as_of: asOf });
    }
  }
  return rows;
}
