import { configured } from "../../db.ts";
import { classifyWithClaude } from "../../../../lib/support/classify.ts";
import { handlePoll } from "../../../../lib/support/handler.ts";
import { gmail, mailConfigured } from "../../../../lib/support/mail.ts";
import { dbStore } from "../../../../lib/support/store.ts";
import {configuredOperations,observedOperation} from "../../../../lib/operations.ts";
import {configuredSendLedger,guardedMailbox} from "../../../../lib/support/send-ledger.ts";
import {configuredSupportOutbox,handleOutboxPoll} from "../../../../lib/support/outbox.ts";

export const dynamic = "force-dynamic";
// one poll is an IMAP round trip plus, per new message, one Claude call and three PostgREST calls (about 8 s each);
// a backlog of seven took more than 60 s on the first live run and the function was cut off mid-triage
export const maxDuration = 300;

// the support cron (vercel.json: every 5 minutes). Vercel sends Authorization: Bearer <CRON_SECRET>; the same
// header lets the pipeline exercise it locally. nothing here is public.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const headers={"cache-control":"no-store"};
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return Response.json({ error: "unauthorized" }, { status: 401,headers });
  if (!configured()) return Response.json({ error: "database not configured" }, { status: 503,headers });
  if (!mailConfigured()) return Response.json({ error: "mailbox not configured" }, { status: 503,headers });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "assistant not configured" }, { status: 503,headers });
  try {
    const result = await observedOperation("support-poll",()=>{
      const outbox=configuredSupportOutbox();
      const mail=gmail();
      if(outbox)return handleOutboxPoll(mail,classifyWithClaude,process.env.SUPPORT_ESCALATION_TO??"",outbox);
      const ledger=configuredSendLedger();
      return handlePoll(ledger?guardedMailbox(mail,ledger):mail, dbStore(), classifyWithClaude, process.env.SUPPORT_ESCALATION_TO ?? "");
    },configuredOperations());
    const { digest: _digest, ...counts } = result;
    void _digest;
    return Response.json({ status: "ok", ...counts }, { headers: { "cache-control": "no-store" } });
  } catch {
    console.error("support poll failed: provider unavailable");
    return Response.json({ error: "poll failed" }, { status: 502,headers });
  }
}
