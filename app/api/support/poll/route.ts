import { configured } from "../../db";
import { classifyWithClaude } from "@/lib/support/classify";
import { handlePoll } from "@/lib/support/handler";
import { gmail, mailConfigured } from "@/lib/support/mail";
import { dbStore } from "@/lib/support/store";

export const dynamic = "force-dynamic";
// one poll is an IMAP round trip plus, per new message, one Claude call and three PostgREST calls (about 8 s each);
// a backlog of seven took more than 60 s on the first live run and the function was cut off mid-triage
export const maxDuration = 300;

// the support cron (vercel.json: every 5 minutes). Vercel sends Authorization: Bearer <CRON_SECRET>; the same
// header lets the pipeline exercise it locally. nothing here is public.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!configured()) return Response.json({ error: "database not configured" }, { status: 503 });
  if (!mailConfigured()) return Response.json({ error: "mailbox not configured" }, { status: 503 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "assistant not configured" }, { status: 503 });
  try {
    const result = await handlePoll(gmail(), dbStore(), classifyWithClaude, process.env.SUPPORT_ESCALATION_TO ?? "");
    const { digest: _digest, ...counts } = result;
    return Response.json({ status: "ok", ...counts }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error("support poll failed", (e as Error).message);
    return Response.json({ error: "poll failed" }, { status: 502 });
  }
}
