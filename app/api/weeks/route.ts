import { configured, insert, rateLimited } from "../db";

// share a week from the app: the week JSON (the app's display shape, no PII) → a short id for /w/<id>
const MAX_BYTES = 32 * 1024;
const DIETS = new Set(["none", "vegetarian", "vegan", "gluten-free", "dairy-free"]);
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789"; // no 0/o/1/l/i
const shortId = () => Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => ALPHABET[b % ALPHABET.length]).join("");

export async function POST(req: Request) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (rateLimited(req, 20)) return Response.json({ error: "too many requests" }, { status: 429 });
  const raw = await req.text();
  if (raw.length > MAX_BYTES) return Response.json({ error: "week is too large" }, { status: 413 });
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(raw) ?? {};
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  const num = (k: string, min: number, max: number) => (typeof body[k] === "number" && body[k] >= min && body[k] <= max ? (body[k] as number) : null);
  const budget = num("budget", 10, 999);
  const protein_target = num("protein_target", 20, 400);
  const household = num("household", 1, 4) ?? 1;
  const diet = typeof body.diet === "string" && DIETS.has(body.diet) ? body.diet : "none";
  const stores = Array.isArray(body.stores) ? body.stores.filter((s): s is string => typeof s === "string" && /^[a-z0-9-]{1,40}$/.test(s)).slice(0, 3) : [];
  const week = body.week;
  if (budget === null || protein_target === null) return Response.json({ error: "budget and protein_target are required" }, { status: 400 });
  if (!week || typeof week !== "object" || !Array.isArray((week as { days?: unknown }).days)) return Response.json({ error: "week.days is required" }, { status: 400 });
  const text = JSON.stringify(week);
  if (/"(source|confidence)"\s*:/.test(text)) return Response.json({ error: "week carries internal fields" }, { status: 400 });

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = shortId();
    const res = await insert("shared_weeks", { id, budget, protein_target, diet, household, stores, week });
    if (res.ok) return Response.json({ id, url: `https://www.wisedinner.com/w/${id}` });
    if (!res.duplicate) {
      console.error("shared_weeks insert failed", res.status, res.body);
      return Response.json({ error: "could not save" }, { status: 502 });
    }
  }
  return Response.json({ error: "could not save" }, { status: 502 });
}
