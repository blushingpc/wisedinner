import { EMAIL, insert, rateLimited } from "../db";

export async function POST(req: Request) {
  if (rateLimited(req)) return Response.json({ error: "too many requests" }, { status: 429 });
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) ?? {};
  } catch {
    return Response.json({ error: "body must be JSON" }, { status: 400 });
  }
  if (typeof body.website === "string" && body.website) return Response.json({ status: "ok" }); // honeypot: pretend

  const str = (k: string, max: number) => (typeof body[k] === "string" ? (body[k] as string).trim().slice(0, max) : "");
  const name = str("name", 120);
  const email = str("email", 254).toLowerCase();
  const message = str("message", 2000);
  if (!EMAIL.test(email)) return Response.json({ error: "that doesn't look like an email" }, { status: 400 });
  if (message.length < 2) return Response.json({ error: "the message is empty" }, { status: 400 });

  const res = await insert("support_messages", { name: name || null, email, message });
  if (!res.ok) {
    console.error("support insert failed", res.status, res.body);
    return Response.json({ error: "could not save" }, { status: 502 });
  }
  return Response.json({ status: "ok" });
}
