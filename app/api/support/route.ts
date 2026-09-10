import { configured, EMAIL, insert, rateLimited } from "../db";

// the site's support form → a support thread (channel form) with its first message. the response shape is
// unchanged for app/support/form.tsx. form threads stay "open" for a person; the email poller does not answer them.
export async function POST(req: Request) {
  if (!configured()) return Response.json({ error: "not configured" }, { status: 503 });
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

  const id = crypto.randomUUID();
  const thread = await insert("support_threads", { id, channel: "form", from_email: email, subject: "Support form", status: "open" });
  if (!thread.ok) {
    console.error("support thread insert failed", thread.status, thread.body);
    return Response.json({ error: "could not save" }, { status: 502 });
  }
  const msg = await insert("support_messages_v2", { thread_id: id, direction: "in", body: name ? `${name}\n\n${message}` : message, ai: false });
  if (!msg.ok) {
    console.error("support message insert failed", msg.status, msg.body);
    return Response.json({ error: "could not save" }, { status: 502 });
  }
  return Response.json({ status: "ok" });
}
