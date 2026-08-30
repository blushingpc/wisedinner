// server-only: talks to supabase's PostgREST with the service role key. no client lib — three fetches don't need one.
// never import this from a client component (the key would leak). grep-verified in pre-flight.

const url = () => process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = () => process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

export async function insert(table: string, row: Record<string, unknown>) {
  const res = await fetch(`${url()}/rest/v1/${table}`, {
    method: "POST",
    headers: { apikey: key(), authorization: `Bearer ${key()}`, "content-type": "application/json", prefer: "return=minimal" },
    body: JSON.stringify(row),
  });
  if (res.ok) return { ok: true as const };
  const body = await res.text();
  return { ok: false as const, status: res.status, duplicate: res.status === 409 || body.includes("23505"), body };
}

export async function count(table: string) {
  const res = await fetch(`${url()}/rest/v1/${table}?select=id`, {
    method: "HEAD",
    headers: { apikey: key(), authorization: `Bearer ${key()}`, prefer: "count=exact" },
  });
  const range = res.headers.get("content-range") ?? "";
  return Number(range.split("/")[1] ?? 0);
}

// ponytail: in-memory map, per instance, resets on deploy — fine at this scale; move to a KV when it isn't
const hits = new Map<string, number[]>();
export function rateLimited(req: Request, limit = 10) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "local";
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
  return recent.length > limit;
}

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
