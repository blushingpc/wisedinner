import { configured, rateLimited, select } from "../db";

export const dynamic = "force-dynamic";

// the Delivery Gap for the list screen (Courier tier; the gate lives in the app). the newest delivery quote for a
// store at a ZIP, optionally for one exact list (list_hash from scripts/data/instacart.ts). every figure is an
// estimate from a priced Instacart cart, never a modeled markup; 404 when no quote exists yet (no key: none do).
const STORE = /^[a-z0-9-]{1,40}$/;
const ZIP = /^\d{5}$/;
const HASH = /^[a-f0-9]{32}$/;

type Quote = { list_hash: string; store_id: string; zip: string; subtotal: number | string; fees: number | string; quoted_at: string };
const num = (v: number | string) => Math.round(Number(v) * 100) / 100;

export async function GET(req: Request) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (rateLimited(req, 60)) return Response.json({ error: "too many requests" }, { status: 429 });
  const url = new URL(req.url);
  const store = url.searchParams.get("store") ?? "";
  const zip = url.searchParams.get("zip") ?? "";
  const listHash = url.searchParams.get("list_hash") ?? "";
  if (!STORE.test(store) || !ZIP.test(zip)) return Response.json({ error: "store and a 5-digit zip are required" }, { status: 400 });
  if (listHash && !HASH.test(listHash)) return Response.json({ error: "list_hash must be 32 hex characters" }, { status: 400 });
  try {
    const filter = `store_id=eq.${store}&zip=eq.${zip}${listHash ? `&list_hash=eq.${listHash}` : ""}`;
    const rows = await select<Quote>("delivery_quotes", `select=list_hash,store_id,zip,subtotal,fees,quoted_at&${filter}&order=quoted_at.desc&limit=1`);
    const q = rows[0];
    if (!q) return Response.json({ error: "no quote yet" }, { status: 404 });
    const subtotal = num(q.subtotal);
    const fees = num(q.fees);
    return Response.json(
      {
        store: q.store_id,
        zip: q.zip,
        list_hash: q.list_hash,
        subtotal_usd: subtotal,
        fees_usd: fees,
        total_usd: Math.round((subtotal + fees) * 100) / 100,
        quoted_at: q.quoted_at,
        estimate: true,
        label: "Delivered, estimated",
        exact_list: Boolean(listHash), // false when the quote is the store's newest list, not this one
      },
      { headers: { "cache-control": "public, max-age=3600, s-maxage=3600" } },
    );
  } catch (e) {
    console.error("delivery", (e as Error).message);
    return Response.json({ error: "could not read" }, { status: 502 });
  }
}
