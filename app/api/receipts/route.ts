import { configured, rateLimited, upsert } from "../db";

// app ingest for receipt calibration: sku, store, price, region per line; user_hash only (no PII, no image).
// rows land unverified; the pipeline's receipt source only uses verified rows.
const MAX_ITEMS = 100;
const ID = /^[a-z0-9-]{1,60}$/;

export async function POST(req: Request) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (rateLimited(req, 10)) return Response.json({ error: "too many requests" }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const user_hash = typeof body.user_hash === "string" && /^[a-f0-9]{64}$/.test(body.user_hash) ? body.user_hash : null;
  const store_id = typeof body.store === "string" && ID.test(body.store) ? body.store : null;
  const region = typeof body.region === "string" && /^\d{5}$/.test(body.region) ? body.region : null;
  if (!user_hash) return Response.json({ error: "user_hash must be 64 hex characters" }, { status: 400 });
  if (!store_id) return Response.json({ error: "store is required" }, { status: 400 });
  if (!region) return Response.json({ error: "region must be a 5 digit ZIP" }, { status: 400 });
  const items = Array.isArray(body.items) ? body.items : [];
  if (!items.length || items.length > MAX_ITEMS) return Response.json({ error: `items must hold 1 to ${MAX_ITEMS} lines` }, { status: 400 });
  const observed_at = typeof body.observed_at === "string" && !Number.isNaN(Date.parse(body.observed_at)) ? new Date(body.observed_at).toISOString() : new Date().toISOString();
  const rows: Record<string, unknown>[] = [];
  for (const it of items) {
    if (!it || typeof it !== "object") continue;
    const { sku, price } = it as { sku?: unknown; price?: unknown };
    if (typeof sku !== "string" || !ID.test(sku)) continue;
    if (typeof price !== "number" || !(price > 0 && price < 1000)) continue;
    rows.push({ user_hash, store_id, region, sku_id: sku, price: Math.round(price * 100) / 100, observed_at, verified: false });
  }
  if (!rows.length) return Response.json({ error: "no valid lines" }, { status: 400 });
  try {
    await upsert("receipts", rows, "id");
  } catch (e) {
    console.error("receipts insert failed", (e as Error).message);
    return Response.json({ error: "could not save" }, { status: 502 });
  }
  return Response.json({ status: "ok", accepted: rows.length });
}
