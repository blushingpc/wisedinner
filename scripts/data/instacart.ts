// Instacart Developer Platform: a priced shopping-list page for a list at a ZIP and store, recorded as a
// delivery quote. this is the ONLY Delivery Gap source (no modeled markups anywhere). behind INSTACART_API_KEY;
// skips cleanly while the key is absent.
// run: node scripts/data/instacart.ts  (quotes the committed drop list at each pipeline ZIP for the Kroger banner)
import { createHash } from "node:crypto";
import { has, log, required, today } from "./env.ts";

export type Quote = { list_hash: string; store_id: string; zip: string; subtotal: number; fees: number; source: "instacart-cart"; quoted_at: string; url?: string };
export type ListLine = { name: string; qty: number; unit?: string };

export const listHash = (lines: ListLine[]) =>
  createHash("sha256")
    .update(JSON.stringify(lines.map((l) => [l.name.toLowerCase(), l.qty, l.unit ?? ""]).sort()))
    .digest("hex")
    .slice(0, 32);

// POST /idp/v1/products/products_link → { products_link_url }. pricing comes back on the page (and, where the
// partnership exposes it, in the response); until a key exists nothing here runs.
export async function createQuote(lines: ListLine[], zip: string, storeId: string): Promise<Quote | null> {
  if (!has("INSTACART_API_KEY")) {
    log("instacart", "skipped: INSTACART_API_KEY absent");
    return null;
  }
  const key = required("INSTACART_API_KEY");
  const res = await fetch("https://connect.instacart.com/idp/v1/products/products_link", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      title: "WiseDinner week",
      link_type: "shopping_list",
      line_items: lines.map((l) => ({ name: l.name, quantity: l.qty, unit: l.unit ?? "each" })),
      landing_page_configuration: { partner_linkback_url: "https://www.wisedinner.com", enable_pantry_items: true },
      retailer_key: storeId,
      postal_code: zip,
    }),
  });
  if (!res.ok) throw new Error(`instacart ${res.status}: ${await res.text()}`);
  const j = (await res.json()) as { products_link_url: string; subtotal?: number; fees?: number };
  if (typeof j.subtotal !== "number") {
    log("instacart", `link created without a priced total (${j.products_link_url}); no quote recorded`);
    return null;
  }
  return { list_hash: listHash(lines), store_id: storeId, zip, subtotal: j.subtotal, fees: j.fees ?? 0, source: "instacart-cart", quoted_at: today(), url: j.products_link_url };
}

export async function fetchInstacart(): Promise<{ quotes: Quote[]; skipped: boolean }> {
  if (!has("INSTACART_API_KEY")) {
    log("instacart", "skipped: INSTACART_API_KEY absent");
    return { quotes: [], skipped: true };
  }
  const { drop } = await import("../../data/drop.ts");
  const lines = drop.list.map((i) => ({ name: i.name, qty: i.qty }));
  const quotes: Quote[] = [];
  for (const zip of ["43215", "90012", "77002", "30303", "98101"]) {
    const q = await createQuote(lines, zip, "kroger");
    if (q) quotes.push(q);
  }
  log("instacart", `${quotes.length} quotes`);
  return { quotes, skipped: false };
}

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/data/instacart.ts")) fetchInstacart().catch((e) => { console.error(e); process.exit(1); });
