import { configured, rateLimited, select } from "../../db";
import { latest } from "@/lib/data-latest";

export const dynamic = "force-dynamic";

// the app checks this on launch (at most once a day) and swaps its bundled snapshot when the version rises. the body
// also carries live app config (config.founders_invite_url from app_config, empty when unset or unreadable); the
// config never lives inside the snapshot blob and a config read failure never breaks the pointer.
export async function GET(req: Request) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (rateLimited(req, 60)) return Response.json({ error: "too many requests" }, { status: 429 });
  try {
    const body = await latest(select);
    if (!body) return Response.json({ error: "no snapshot yet" }, { status: 404 });
    return Response.json(body, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
  } catch (e) {
    console.error("data/latest", (e as Error).message);
    return Response.json({ error: "could not read" }, { status: 502 });
  }
}
