import blocked from "@/data/blocked.json" with { type: "json" };
import status from "@/data/status.json" with { type: "json" };
import { configured, ping, select } from "../db";

export const dynamic = "force-dynamic";

// the loop's heartbeat. public, no auth, nothing secret: what the loop wrote last cycle, what vercel knows about this
// deploy, whether the waitlist table answers (a HEAD select; the daily keep-alive in weekly-drop.yml reads db.ok),
// the latest data snapshot version and the support queue depth (counts only).
export async function GET() {
  const db = configured() ? await ping("waitlist") : { ok: false, status: 0, ms: 0, error: "not configured" };
  let snapshot: { version: number; created_at: string } | null = null;
  let support: { open: number; escalated: number } | null = null;
  if (configured()) {
    try {
      const s = await select<{ version: number; created_at: string }>("data_snapshots", "select=version,created_at&order=version.desc&limit=1");
      snapshot = s[0] ?? null;
      const open = await select<{ id: string }>("support_threads", "select=id&status=eq.open");
      const escalated = await select<{ id: string }>("support_threads", "select=id&status=eq.escalated");
      support = { open: open.length, escalated: escalated.length };
    } catch {
      /* the heartbeat stays up even when a table is missing */
    }
  }
  return Response.json(
    {
      last_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
      db,
      snapshot,
      support,
      ...status,
      blocked_founder: blocked, // exported by the loop via gh each cycle and committed — no runtime github call, no token
    },
    { headers: { "cache-control": "no-store" } },
  );
}
