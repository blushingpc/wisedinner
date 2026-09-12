import { FOOTER } from "./kb.ts";
import { voiceProblems } from "./voice.ts";
import type { Classifier } from "./classify.ts";
import type { Inbound, Mailbox } from "./mail.ts";

// the support loop for one poll: every unread email becomes (or joins) a thread, is logged, triaged, and either
// answered from the same mailbox (marked read, status auto_replied) or left unread (status escalated) and
// summarised in one digest to SUPPORT_ESCALATION_TO. every message is logged in both directions.
// Gmail sends about 500 messages a day at most: past DAILY_SEND_CAP outbound messages in 24 h, auto-replies
// stop and everything is escalated instead.

export const DAILY_SEND_CAP = 450;

export type Thread = { id: string; from_email: string; subject: string; status: string; message_id: string | null };
export type Store = {
  findThread(inReplyTo: string | undefined, from: string, subject: string): Promise<Thread | null>;
  createThread(t: { channel: "email"; from_email: string; subject: string; message_id: string }): Promise<Thread>;
  logMessage(m: { thread_id: string; direction: "in" | "out"; body: string; ai: boolean; message_id?: string }): Promise<void>;
  setStatus(threadId: string, status: "open" | "auto_replied" | "escalated"): Promise<void>;
  sentLast24h(): Promise<number>;
  hasMessage(messageId: string): Promise<boolean>;
};

// skippedAuto counts mail that declared itself machine-generated (Auto-Submitted other than "no", RFC 3834):
// marked read and never classified, so two autoresponders cannot loop. sender address is never a reason to skip.
export type PollResult = { seen: number; replied: number; escalated: number; skipped: number; skippedAuto: number; digest?: string };

const stripRe = (s: string) => s.replace(/^\s*(re|fwd?):\s*/i, "").trim();
const isAutoSubmitted = (m: Inbound) => Boolean(m.autoSubmitted) && m.autoSubmitted!.trim().toLowerCase() !== "no";

export async function handlePoll(mail: Mailbox, store: Store, classify: Classifier, escalateTo: string): Promise<PollResult> {
  const inbox = await mail.unread();
  const result: PollResult = { seen: inbox.length, replied: 0, escalated: 0, skipped: 0, skippedAuto: 0 };
  const digest: string[] = [];
  let sent = await store.sentLast24h();
  for (const m of inbox) {
    if (isAutoSubmitted(m)) {
      await mail.markSeen(m.uid);
      result.skippedAuto++;
      console.log(`support: skipped-auto ${m.messageId} (Auto-Submitted: ${m.autoSubmitted})`);
      continue;
    }
    if (await store.hasMessage(m.messageId)) {
      result.skipped++; // already logged on a previous poll (left unread on purpose)
      continue;
    }
    const thread = (await store.findThread(m.inReplyTo, m.from, stripRe(m.subject))) ?? (await store.createThread({ channel: "email", from_email: m.from, subject: stripRe(m.subject) || "(no subject)", message_id: m.messageId }));
    // triage before the inbound row is logged: hasMessage() is the dedupe, so a poll that dies mid-triage (function
    // timeout) must leave nothing behind, or the message would be skipped forever on the next poll
    const draft = m.text.trim() ? await classify({ from: m.from, subject: m.subject, body: m.text }) : { intent: "escalate" as const, category: "other", reason: "empty message", reply: "" };
    // send gate: only a confident informational verdict with a draft that passes the copy rules is ever sent; a draft
    // that breaks a rule escalates exactly like a refund, with the offending text in the digest as reason "voice-fail"
    const problems = draft.intent === "informational" && draft.reply.trim() ? voiceProblems(draft.reply) : [];
    const triage = problems.length ? { ...draft, intent: "escalate" as const, reason: `voice-fail: ${problems.join("; ")}`, reply: "" } : draft;
    if (problems.length) console.log(`support: voice-fail ${m.messageId}: ${problems.join("; ")}`);
    await store.logMessage({ thread_id: thread.id, direction: "in", body: m.text || "(empty)", ai: false, message_id: m.messageId });
    const capped = sent >= DAILY_SEND_CAP;
    if (triage.intent === "informational" && !capped) {
      const text = `${triage.reply.trim()}\n\n${FOOTER}`;
      const out = await mail.send({ to: m.from, subject: m.subject ? `Re: ${stripRe(m.subject)}` : "Re: your question", text, inReplyTo: m.messageId, references: [m.messageId] });
      sent++;
      await store.logMessage({ thread_id: thread.id, direction: "out", body: text, ai: true, message_id: out.messageId });
      await store.setStatus(thread.id, "auto_replied");
      await mail.markSeen(m.uid);
      result.replied++;
    } else {
      await store.setStatus(thread.id, "escalated");
      result.escalated++;
      digest.push(`${m.from} · ${m.subject || "(no subject)"} · ${triage.category}${capped ? " · daily send cap reached" : ""}\n  ${triage.reason || "needs a person"}\n  ${m.text.slice(0, 300).replace(/\s+/g, " ")}`);
    }
  }
  if (digest.length && escalateTo) {
    const text = `${digest.length} support email${digest.length === 1 ? "" : "s"} need a person. They are still unread in the support inbox.\n\n${digest.join("\n\n")}\n\nWiseDinner support`;
    await mail.send({ to: escalateTo, subject: `Support: ${digest.length} to answer`, text });
    result.digest = text;
  }
  return result;
}

export const emptyResult = (): PollResult => ({ seen: 0, replied: 0, escalated: 0, skipped: 0, skippedAuto: 0 });
export type { Inbound };
