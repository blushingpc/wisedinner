import { configured, rateLimited, select } from "../../db";

export const dynamic = "force-dynamic";

// the app checks this on launch (at most once a day) and swaps its bundled snapshot when the version rises
export async function GET(req: Request) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (rateLimited(req, 60)) return Response.json({ error: "too many requests" }, { status: 429 });
  try {
    const rows = await select<{ version: number; url: string; sha256: string; created_at: string }>("data_snapshots", "select=version,url,sha256,created_at&order=version.desc&limit=1");
    if (!rows[0]) return Response.json({ error: "no snapshot yet" }, { status: 404 });
    const { version, url, sha256, created_at } = rows[0];
    return Response.json({ version, url, sha256, created_at }, { headers: { "cache-control": "public, max-age=300, s-maxage=300" } });
  } catch (e) {
    console.error("data/latest", (e as Error).message);
    return Response.json({ error: "could not read" }, { status: 502 });
  }
}
