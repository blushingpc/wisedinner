import { configured, rateLimited, select } from "../../db";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: { params: Promise<{ version: string }> }) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (rateLimited(req, 60)) return Response.json({ error: "too many requests" }, { status: 429 });
  const { version } = await ctx.params;
  const n = Number(version);
  if (!Number.isInteger(n) || n < 1) return Response.json({ error: "version must be a positive integer" }, { status: 400 });
  try {
    const rows = await select<{ version: number; url: string; sha256: string; created_at: string }>("data_snapshots", `select=version,url,sha256,created_at&version=eq.${n}`);
    if (!rows[0]) return Response.json({ error: "no such version" }, { status: 404 });
    return Response.json(rows[0], { headers: { "cache-control": "public, max-age=86400, s-maxage=86400" } });
  } catch (e) {
    console.error("data/[version]", (e as Error).message);
    return Response.json({ error: "could not read" }, { status: 502 });
  }
}
