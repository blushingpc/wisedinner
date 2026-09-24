// Walmart Affiliate / Marketplace item prices, behind WALMART_API_KEY. skus map to walmart.com items in
// data/walmart-map.json (same shape as the Kroger map). skips cleanly while the key is absent.
// run: node scripts/data/walmart.ts
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { has, log, required, today } from "./env.ts";
import { SKUS, type AuthoredSku } from "./authored/skus.ts";
import { packCanonical } from "../../packages/solver/src/units.ts";
import { parseSize } from "./kroger.ts";

const MAP = "data/walmart-map.json";
type MapEntry = { itemId: string; name: string; size: string; term: string; matched_at: string; pinned?: boolean };
export type WalmartMap = Record<string, MapEntry>;
export type WalmartRow = { sku_id: string; store_id: "walmart"; region: string; shelf_price: number; unit_price: number; source: "walmart-api"; confidence: number; as_of: string };

type Item = { itemId: number; name: string; salePrice?: number; size?: string; msrp?: number };

async function search(key: string, term: string): Promise<Item[]> {
  // Walmart Affiliate API v2 search; the key is passed as the WM_SEC.KEY_VERSION/consumer id pair once the
  // partnership exists. until then this is the documented shape and the code path is exercised by tests only.
  const u = new URL("https://developer.api.walmart.com/api-proxy/service/affil/product/v2/search");
  u.searchParams.set("query", term);
  u.searchParams.set("numItems", "10");
  const res = await fetch(u, { headers: { "WM_SEC.KEY_VERSION": "1", "WM_CONSUMER.ID": key, accept: "application/json" } });
  if (!res.ok) throw new Error(`walmart ${res.status}: ${await res.text()}`);
  return ((await res.json()) as { items?: Item[] }).items ?? [];
}

function pick(items: Item[], sku: AuthoredSku) {
  const ours = packCanonical(sku);
  const cands = items
    .map((it) => ({ it, size: parseSize(it.size, sku), price: it.salePrice ?? it.msrp }))
    .filter((c): c is { it: Item; size: number; price: number } => Boolean(c.size && c.price));
  cands.sort((a, b) => Math.abs(Math.log(a.size / ours)) - Math.abs(Math.log(b.size / ours)));
  return cands[0];
}

export async function fetchWalmart(): Promise<{ rows: WalmartRow[]; skipped: boolean }> {
  if (!has("WALMART_API_KEY")) {
    log("walmart", "skipped: WALMART_API_KEY absent");
    return { rows: [], skipped: true };
  }
  const key = required("WALMART_API_KEY");
  const map: WalmartMap = existsSync(MAP) ? JSON.parse(readFileSync(MAP, "utf8")) : {};
  const rows: WalmartRow[] = [];
  const asOf = today();
  for (const sku of SKUS) {
    const items = await search(key, map[sku.id]?.name ?? sku.kroger);
    const c = pick(items, sku);
    if (!c) continue;
    if (!map[sku.id]?.pinned) map[sku.id] = { itemId: String(c.it.itemId), name: c.it.name, size: c.it.size ?? "", term: sku.kroger, matched_at: asOf };
    const unit_price = c.price / c.size;
    rows.push({ sku_id: sku.id, store_id: "walmart", region: "national", shelf_price: Math.round(unit_price * packCanonical(sku) * 100) / 100, unit_price, source: "walmart-api", confidence: 0.85, as_of: asOf });
  }
  writeFileSync(MAP, JSON.stringify(map, null, 2) + "\n");
  log("walmart", `${rows.length} price rows`);
  return { rows, skipped: false };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/data/walmart.ts")) fetchWalmart().catch((e) => { console.error(e); process.exit(1); });
