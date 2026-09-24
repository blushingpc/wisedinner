// Kroger Product API: client-credentials token cached for its TTL (data/.kroger-token.json, gitignored), one
// /v1/locations call per ZIP to pick the nearest Kroger-family store, then /v1/products with filter.locationId
// (product.compact alone has no prices). each sku is matched to one Kroger product once and remembered in
// data/kroger-map.json (committed); unmapped skus are listed for the founder. prices are normalised to our pack:
// kroger unit price × our pack size, so an 8 lb bag prices our 3 lb bag correctly.
// run: node scripts/data/kroger.ts  (needs KROGER_CLIENT_ID / KROGER_CLIENT_SECRET / KROGER_SCOPE)
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { log, required, today } from "./env.ts";
import { SKUS, type AuthoredSku } from "./authored/skus.ts";
import { packCanonical, toCanonical } from "../../packages/solver/src/units.ts";
import type { Unit } from "../../packages/solver/src/types.ts";

export const ZIPS = ["43215", "90012", "77002", "30303", "98101"]; // Columbus, Los Angeles, Houston, Atlanta, Seattle (BACKEND-V1 addendum)
const MAP = "data/kroger-map.json";
const TOKEN = "data/.kroger-token.json";
const API = "https://api.kroger.com/v1";

type MapEntry = { productId: string; description: string; size: string; term: string; matched_at: string; pinned?: boolean };
export type KrogerMap = Record<string, MapEntry>;
export type PriceRow = { sku_id: string; store_id: string; region: string; shelf_price: number; unit_price: number; source: "kroger-api"; confidence: number; as_of: string };

// --- auth: one token per 30 minutes, shared across the run and across runs on the same machine
let mem: { token: string; exp: number } | undefined;
export async function token(): Promise<string> {
  const now = Date.now();
  if (mem && mem.exp > now + 60_000) return mem.token;
  if (existsSync(TOKEN)) {
    try {
      const c = JSON.parse(readFileSync(TOKEN, "utf8")) as { token: string; exp: number };
      if (c.exp > now + 60_000) {
        mem = c;
        return c.token;
      }
    } catch {
      /* refetch */
    }
  }
  const id = required("KROGER_CLIENT_ID");
  const secret = required("KROGER_CLIENT_SECRET");
  const scope = process.env.KROGER_SCOPE || "product.compact";
  const res = await fetch(`${API}/connect/oauth2/token`, {
    method: "POST",
    headers: { authorization: `Basic ${Buffer.from(`${id}:${secret}`).toString("base64")}`, "content-type": "application/x-www-form-urlencoded" },
    body: `grant_type=client_credentials&scope=${encodeURIComponent(scope)}`,
  });
  if (!res.ok) throw new Error(`kroger token ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { access_token: string; expires_in: number };
  mem = { token: j.access_token, exp: now + j.expires_in * 1000 };
  writeFileSync(TOKEN, JSON.stringify(mem));
  return mem.token;
}

// rate limits (429) and the API's occasional 5xx are retried with backoff; anything else throws
async function get<T>(path: string, params: Record<string, string>, attempt = 0): Promise<T> {
  const u = new URL(`${API}${path}`);
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
  const res = await fetch(u, { headers: { authorization: `Bearer ${await token()}`, accept: "application/json" } });
  const text = await res.text();
  const html = text.trimStart().startsWith("<"); // a gateway error page, not the API
  if ((res.status === 429 || res.status >= 500 || html) && attempt < 4) {
    await new Promise((r) => setTimeout(r, 1500 * 2 ** attempt));
    return get(path, params, attempt + 1);
  }
  if (!res.ok) throw new Error(`kroger ${path} ${res.status}: ${text.slice(0, 200)}`);
  return JSON.parse(text) as T;
}

// --- locations: nearest Kroger-family store to a ZIP → { locationId, chain, banner store id }
type Location = { locationId: string; chain: string; name: string; address: { zipCode: string; city: string; state: string } };
const BANNER: Record<string, string> = {
  KROGER: "kroger", RALPHS: "ralphs", "FRED MEYER": "fred-meyer", QFC: "qfc", "KING SOOPERS": "king-soopers", FRYS: "frys", "FRY'S": "frys",
  SMITHS: "smiths", "SMITH'S": "smiths", "HARRIS TEETER": "harris-teeter", DILLONS: "dillons", "FOOD 4 LESS": "food-4-less", "FOOD4LESS": "food-4-less",
  MARIANOS: "marianos", "MARIANO'S": "marianos", "PICK N SAVE": "pick-n-save", "PICK 'N SAVE": "pick-n-save", "CITY MARKET": "king-soopers", "BAKERS": "dillons",
  "JAY C": "kroger", GERBES: "dillons", "PAY LESS": "kroger", "OWENS": "kroger", "METRO MARKET": "pick-n-save", "FOODS CO": "food-4-less", "RULER": "kroger",
};
export async function nearestStore(zip: string): Promise<{ locationId: string; store_id: string; name: string } | null> {
  const j = await get<{ data: Location[] }>("/locations", { "filter.zipCode.near": zip, "filter.radiusInMiles": "100", "filter.limit": "10" });
  const l = (j.data ?? []).find((x) => BANNER[x.chain.toUpperCase()]);
  if (!l) {
    log("kroger", `no Kroger-family store within 100 miles of ${zip}`);
    return null;
  }
  return { locationId: l.locationId, store_id: BANNER[l.chain.toUpperCase()], name: `${l.name} (${l.address.city}, ${l.address.state} ${l.address.zipCode})` };
}

// --- products
type Product = { productId: string; description: string; brand?: string; items: { size?: string; price?: { regular?: number; promo?: number } }[] };

// "8 lb" | "16 oz" | "12 ct" | "1 gal" | "32 fl oz" | "2 lb bag" → canonical qty in the sku's unit family
export function parseSize(size: string | undefined, sku: AuthoredSku): number | null {
  if (!size) return null;
  const m = size.toLowerCase().match(/(\d+\/\d+|\d+(?:\.\d+)?)\s*(fl\.? ?oz|oz|ounces?|lb|lbs|ct|count|each|ea|dozen|gal|gallon|qt|pt|l|ml|g|kg)\b/);
  if (!m) return null;
  const multi = size.toLowerCase().match(/(\d+)\s*(pk|pack)\b/); // "16 oz / 2 pk" → two packs
  const qty = m[1].includes("/") ? Number(m[1].split("/")[0]) / Number(m[1].split("/")[1]) : Number(m[1]); // "1/2 gal"
  const n = qty * (multi ? Number(multi[1]) : 1);
  const u = m[2].replace(/\./g, "").replace(/\s+/g, " ");
  const map: Record<string, [Unit, number]> = {
    "fl oz": ["fl_oz", 1], floz: ["fl_oz", 1], oz: ["oz", 1], ounce: ["oz", 1], ounces: ["oz", 1], lb: ["lb", 1], lbs: ["lb", 1], ct: ["each", 1], count: ["each", 1], each: ["each", 1], ea: ["each", 1],
    dozen: ["each", 12], gal: ["fl_oz", 128], gallon: ["fl_oz", 128], qt: ["fl_oz", 32], pt: ["fl_oz", 16], l: ["l", 1], ml: ["ml", 1], g: ["g", 1], kg: ["kg", 1],
  };
  const hit = map[u];
  if (!hit) return null;
  try {
    return toCanonical(n * hit[1], hit[0], sku);
  } catch {
    return null; // wrong unit family for this sku (e.g. "12 ct" for a gram sku)
  }
}

const STOP = new Set(["and", "the", "of", "in", "with", "pack", "family", "fresh", "count", "ct", "oz", "lb", "fl", "bag", "can", "tub", "jar", "box", "bottle", "carton", "block", "gallon", "packet", "mix"]);
const SYN: Record<string, string> = { bbq: "barbecue", barbeque: "barbecue", garbanzo: "chickpea", chickpeas: "chickpea", lentil: "lentils" };
const words = (s: string) => s.toLowerCase().replace(/[^a-z0-9% ]+/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w) && !/^\d/.test(w)).map((w) => SYN[w] ?? w);

// off-category lines are never the product (hard exclusion); premium lines only lose a price handicap, so a
// store that stocks nothing but organic tofu still prices tofu
const OFF = /\b(soup|snaps?|crisps?|chips|refried|meal|kit|greens|smoothie|juice|bar|cookie|cereal|trail|dip|seltzer|sparkling|drink|soda|beverage|stage \d|baby food|pouch|puffs|dog|cat|pet|treats?|recipe|singles|thin.?sliced|tenderloins?|syrup|yams)\b|\d+\s*(pack|pk)\b/i;
const PREMIUM = /\b(organic|pasture|cage.?free|free.?range|grass.?fed|seasoned|blackened|marinated|roasted|crusted|glazed|natural)\b/i;
const PREMIUM_HANDICAP = 1.3;
// a frozen item is off-target for a fresh sku and the other way round
const FROZEN = /\bfrozen\b/i;

// the value pick: every key word of the search term in the description, no premium words, pack size within
// 4x of ours either way; among those the cheapest per canonical unit (ties: plain Kroger label, then closest size)
export function pickProduct(products: Product[], sku: AuthoredSku): { p: Product; size: number; price: number } | null {
  const cands: { p: Product; size: number; price: number; hit: number; premium: boolean; label: number; sizeGap: number; unit: number }[] = [];
  const ours = packCanonical(sku);
  const keys = words(sku.kroger);
  for (const p of products) {
    const it = p.items?.[0];
    const price = it?.price?.regular;
    const size = parseSize(it?.size, sku);
    if (!price || !size) continue;
    const desc = words(p.description);
    const stem = (a: string, b: string) => a === b || (a.length > 3 && b.length > 3 && (a.startsWith(b) || b.startsWith(a))); // potato / potatoes
    const hit = keys.filter((k) => desc.some((d) => stem(d, k))).length / Math.max(keys.length, 1);
    const brand = (p.brand ?? "").toLowerCase();
    const label = brand === "kroger" || p.description.startsWith("Kroger") ? 1 : 0;
    if ((OFF.test(p.description) && !OFF.test(sku.kroger)) || (FROZEN.test(p.description) && sku.aisle !== "frozen")) continue; // frozen lines never price a fresh sku
    const premium = PREMIUM.test(p.description) && !PREMIUM.test(sku.kroger);
    cands.push({ p, size, price, hit, premium, label, sizeGap: Math.abs(Math.log(size / ours)), unit: (price / size) * (premium ? PREMIUM_HANDICAP : 1) });
  }
  const need = keys.length <= 2 ? 1 : 0.75; // every key word for short terms, three of four otherwise
  const pool = cands.filter((c) => c.hit >= need && c.sizeGap <= Math.log(4));
  if (!pool.length) return null;
  pool.sort((a, b) => a.unit - b.unit || b.label - a.label || a.sizeGap - b.sizeGap);
  return pool[0];
}

// the full term, then the term without its qualifiers, then its first two words: results are pooled (by product
// id) until there are at least ten to choose from, so a narrow term cannot hide the value line
async function searchProducts(term: string, locationId: string): Promise<Product[]> {
  const tries = [term, words(term).join(" "), words(term).slice(0, 2).join(" ")].filter((t, i, a) => t && a.indexOf(t) === i);
  const seen = new Map<string, Product>();
  for (const t of tries) {
    const j = await get<{ data: Product[] }>("/products", { "filter.term": t, "filter.locationId": locationId, "filter.limit": "25" });
    for (const p of j.data ?? []) if (!seen.has(p.productId)) seen.set(p.productId, p);
    if (seen.size >= 10) break;
  }
  return [...seen.values()];
}

export function loadKrogerMap(): KrogerMap {
  return existsSync(MAP) ? (JSON.parse(readFileSync(MAP, "utf8")) as KrogerMap) : {};
}

export async function fetchKroger(): Promise<{ rows: PriceRow[]; map: KrogerMap; unmapped: string[]; zips: Record<string, string> }> {
  const map = loadKrogerMap();
  const rows: PriceRow[] = [];
  const unmapped = new Set<string>();
  const zips: Record<string, string> = {};
  const asOf = today();
  for (const zip of ZIPS) {
    const loc = await nearestStore(zip);
    if (!loc) {
      zips[zip] = "no store";
      continue;
    }
    zips[zip] = `${loc.store_id} ${loc.name}`;
    log("kroger", `${zip} → ${loc.name} [${loc.store_id}]`);
    for (const sku of SKUS) {
      const known = map[sku.id];
      let picked: { p: Product; size: number; price: number } | null = null;
      try {
      if (known) {
        // fetch the known product at this location for its price
        const j = await get<{ data: Product[] }>("/products", { "filter.productId": known.productId, "filter.locationId": loc.locationId });
        const p = j.data?.[0];
        const price = p?.items?.[0]?.price?.regular;
        const size = p ? parseSize(p.items?.[0]?.size, sku) : null;
        if (p && price && size) picked = { p, size, price };
      }
      if (!picked) {
        picked = pickProduct(await searchProducts(sku.kroger, loc.locationId), sku);
        // the map remembers the first store's match; other banners re-search when that product is not sold there
        if (picked && !known) map[sku.id] = { productId: picked.p.productId, description: picked.p.description, size: picked.p.items[0].size ?? "", term: sku.kroger, matched_at: asOf };
      }
      } catch (e) {
        log("kroger", `${sku.id} at ${zip}: ${(e as Error).message.slice(0, 120)}`);
        picked = null;
      }
      if (!picked) {
        unmapped.add(sku.id);
        continue;
      }
      const ours = packCanonical(sku);
      const unit_price = picked.price / picked.size;
      rows.push({ sku_id: sku.id, store_id: loc.store_id, region: zip, shelf_price: Math.round(unit_price * ours * 100) / 100, unit_price, source: "kroger-api", confidence: 0.9, as_of: asOf });
    }
    writeFileSync(MAP, JSON.stringify(map, null, 2) + "\n"); // per store, so a crash keeps the matches so far
  }
  writeFileSync(MAP, JSON.stringify(map, null, 2) + "\n");
  const mapped = SKUS.filter((s) => map[s.id]).length;
  log("kroger", `${rows.length} price rows across ${Object.values(zips).filter((v) => v !== "no store").length} stores; ${mapped}/${SKUS.length} skus mapped; unmapped: ${[...unmapped].join(", ") || "none"}`);
  mkdirSync("data/pipeline", { recursive: true }); // gitignored, so a fresh checkout (CI) has no such directory
  writeFileSync("data/pipeline/kroger-prices.json", JSON.stringify({ zips, rows, unmapped: [...unmapped] }, null, 2));
  return { rows, map, unmapped: [...unmapped], zips };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/data/kroger.ts")) fetchKroger().catch((e) => { console.error(e); process.exit(1); });
