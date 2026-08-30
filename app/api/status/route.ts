import status from "@/data/status.json" with { type: "json" };

// the loop's heartbeat. public, no auth, nothing secret: what the loop wrote last cycle + what vercel knows about this deploy.
export function GET() {
  return Response.json(
    {
      last_commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? "local",
      ...status,
    },
    { headers: { "cache-control": "public, max-age=60" } },
  );
}
