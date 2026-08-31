import { configured, count, EMAIL, insert, rateLimited } from "../db";

const SOURCES = new Set(["hero", "plan", "drop", "pricing", "thanks"]);

export async function POST(req: Request) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
  if (rateLimited(req)) return Response.json({ error: "too many requests" }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website) return Response.json({ status: "ok", position: 0 }); // honeypot: pretend

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!email || email.length > 254 || !EMAIL.test(email)) return Response.json({ error: "that doesn't look like an email" }, { status: 400 });
  const source = typeof body.source === "string" && SOURCES.has(body.source) ? body.source : "hero";
  const quiz = body.quiz && typeof body.quiz === "object" && JSON.stringify(body.quiz).length < 4000 ? body.quiz : null;

  const res = await insert("waitlist", { email, source, quiz });
  if (!res.ok && res.duplicate) return Response.json({ status: "already" });
  if (!res.ok) {
    console.error("waitlist insert failed", res.status, res.body);
    return Response.json({ error: "could not save" }, { status: 502 });
  }
  return Response.json({ status: "ok", position: await count("waitlist") });
}
