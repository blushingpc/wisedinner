import type { Snapshot, SolveInput, Store, StoreMode } from "./types.ts";
import { round2 } from "./units.ts";

// the +10% buffer lives here and nowhere else (BACKEND-V1 §2h): snapshot prices are raw shelf prices.
export const PRICE_BUFFER = 1.1;

export type PriceRow = { price_usd: number; as_of: string; store: string; observed: boolean }; // buffered pack price
export type PriceMap = Map<string, PriceRow>; // sku id → price at one store (or the min across stores)
export type PriceBook = {
  stores: Store[]; // chosen stores, input order
  live: Store[]; // chosen stores with observed prices in this snapshot
  mode: StoreMode;
  modesAvailable: ("singleStore" | "bestPerItem")[];
  maps: Map<string, PriceMap>; // store id → map; "__min__" when bestPerItem is available
};

// closest observed region for a store: an exact ZIP match, else the ZIP sharing the longest prefix, else any
function pickRegion<T extends { region: string }>(rows: T[], zip: string): T {
  let best = rows[0];
  let score = -1;
  for (const r of rows) {
    let n = 0;
    while (n < r.region.length && n < zip.length && r.region[n] === zip[n]) n++;
    if (r.region === "national") n = 0;
    if (n > score) {
      score = n;
      best = r;
    }
  }
  return best;
}

// one price map for one store: observed rows first (region closest to the ZIP), else baseline × price_index
export function priceMapFor(s: Snapshot, store: Store, zip: string): PriceMap {
  const byId = new Map<string, { region: string; shelf_price: number; as_of: string }[]>();
  for (const p of s.store_prices) {
    if (p.store_id !== store.id) continue;
    const arr = byId.get(p.sku_id) ?? [];
    arr.push(p);
    byId.set(p.sku_id, arr);
  }
  const map: PriceMap = new Map();
  for (const k of s.skus) {
    const rows = byId.get(k.id);
    if (rows?.length) {
      const r = pickRegion(rows, zip);
      map.set(k.id, { price_usd: round2(r.shelf_price * PRICE_BUFFER), as_of: r.as_of, store: store.id, observed: true });
    } else {
      map.set(k.id, { price_usd: round2(k.baseline_usd * store.price_index * PRICE_BUFFER), as_of: s.generated_at, store: store.id, observed: false });
    }
  }
  return map;
}

export function buildPriceBook(s: Snapshot, input: SolveInput): PriceBook {
  if (!input.stores?.length || input.stores.length > 3) throw new Error("choose one to three stores");
  const stores = input.stores.map((id) => {
    const st = s.stores.find((x) => x.id === id);
    if (!st) throw new Error(`unknown store ${id}`);
    return st;
  });
  const live = stores.filter((st) => st.live);
  const maps = new Map<string, PriceMap>();
  for (const st of stores) maps.set(st.id, priceMapFor(s, st, input.zip));
  let modesAvailable: PriceBook["modesAvailable"] = [];
  let mode: StoreMode = "estimate";
  if (live.length >= 2) {
    modesAvailable = ["singleStore", "bestPerItem"];
    mode = input.mode ?? "singleStore";
    // min across live stores on observed rows only; a sku no live store observed is pinned to the first live store
    const min: PriceMap = new Map();
    for (const k of s.skus) {
      let best: PriceRow | undefined;
      for (const st of live) {
        const r = maps.get(st.id)!.get(k.id)!;
        if (r.observed && (!best || r.price_usd < best.price_usd)) best = r;
      }
      min.set(k.id, best ?? maps.get(live[0].id)!.get(k.id)!);
    }
    maps.set("__min__", min);
  } else if (live.length === 1) {
    modesAvailable = ["singleStore"];
    mode = "singleStore";
  }
  return { stores, live, mode, modesAvailable, maps };
}

// the stores a solve runs at: every live store in singleStore, the anchor (first live, else first chosen) otherwise
export function runStores(book: PriceBook): { id: string; mapKey: string }[] {
  if (book.mode === "bestPerItem") return [{ id: book.live[0].id, mapKey: "__min__" }];
  if (book.mode === "singleStore") return book.live.map((st) => ({ id: st.id, mapKey: st.id }));
  return [{ id: book.stores[0].id, mapKey: book.stores[0].id }];
}
