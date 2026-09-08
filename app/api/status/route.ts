import blocked from "@/data/blocked.json" with { type: "json" };
import status from "@/data/status.json" with { type: "json" };
import { configured, ping } from "../db";

export const dynamic = "force-dynamic";

// the loop's heartbeat. public, no auth, nothing secret: what the loop wrote last cycle, what vercel knows about this
// deploy, and whether the waitlist table answers (a HEAD select; the daily keep-alive in weekly-drop.yml reads db.ok).
export async function GET() {
  const db = configured() ? await ping("waitlist") : { ok: false, status: 0, ms: 0, error: "not configured" };
  return Response.json(
    {
      last_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
      db,
      ...status,
      blocked_founder: blocked, // exported by the loop via gh each cycle and committed — no runtime github call, no token
    },
    { headers: { "cache-control": "no-store" } },
  );
}
