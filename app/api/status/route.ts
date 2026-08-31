import blocked from "@/data/blocked.json" with { type: "json" };
import status from "@/data/status.json" with { type: "json" };

// the loop's heartbeat. public, no auth, nothing secret: what the loop wrote last cycle + what vercel knows about this deploy.
export function GET() {
  return Response.json(
    {
      last_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
      ...status,
      blocked_founder: blocked, // exported by the loop via gh each cycle and committed — no runtime github call, no token
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
