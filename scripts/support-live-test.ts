// live check of the support loop (BACKEND-V1 §7): sends two test emails to the support mailbox (a pricing
// question and a refund request), makes sure both sit unread, then runs one poll with the real mailbox and the
// real Claude triage against an in-memory store (the database store is exercised by the cron once the keys land).
// run: node --env-file-if-exists=.env.local scripts/support-live-test.ts
import { ImapFlow } from "imapflow";
import nodemailer from "nodemailer";
import { gmail } from "../lib/support/mail.ts";
import { classifyWithClaude } from "../lib/support/classify.ts";
import { handlePoll, type Store, type Thread } from "../lib/support/handler.ts";

const addr = process.env.SUPPORT_GMAIL_ADDRESS!;
const pass = process.env.SUPPORT_GMAIL_APP_PASSWORD!;
const escalateTo = process.env.SUPPORT_ESCALATION_TO ?? "";
const tag = `live-${Date.now().toString(36)}`;

function memoryStore(): Store & { threads: Thread[]; messages: { thread_id: string; direction: string; ai: boolean; body: string }[] } {
  const threads: Thread[] = [];
  const messages: { thread_id: string; direction: string; ai: boolean; body: string; message_id?: string }[] = [];
  const status = new Map<string, string>();
  return {
    threads,
    messages,
    async findThread(inReplyTo, from, subject) {
      const m = inReplyTo ? messages.find((x) => x.message_id === inReplyTo) : undefined;
      return (m && threads.find((t) => t.id === m.thread_id)) ?? threads.find((t) => t.from_email === from && t.subject === subject) ?? null;
    },
    async createThread(t) {
      const th = { id: `t${threads.length + 1}`, from_email: t.from_email, subject: t.subject, status: "open", message_id: t.message_id };
      threads.push(th);
      return th;
    },
    async logMessage(m) {
      messages.push(m);
    },
    async setStatus(id, s) {
      status.set(id, s);
      const t = threads.find((x) => x.id === id);
      if (t) t.status = s;
    },
    async sentLast24h() {
      return 0;
    },
    async hasMessage(id) {
      return messages.some((m) => m.message_id === id);
    },
  };
}

async function send(subject: string, text: string) {
  const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: addr, pass } });
  const info = await t.sendMail({ from: `Live test <${addr}>`, to: addr, subject, text });
  return info.messageId;
}

// Gmail files self-sent mail as read; flip both test messages back to unseen so the poll sees them
async function markUnseen(subjects: string[]) {
  const c = new ImapFlow({ host: "imap.gmail.com", port: 993, secure: true, auth: { user: addr, pass }, logger: false });
  await c.connect();
  try {
    const lock = await c.getMailboxLock("INBOX");
    try {
      for (const s of subjects) {
        const uids = await c.search({ subject: s }, { uid: true });
        if (uids && uids.length) await c.messageFlagsRemove(uids, ["\\Seen"], { uid: true });
      }
    } finally {
      lock.release();
    }
  } finally {
    await c.logout();
  }
}

async function main() {
  const q = `How much does it cost? [${tag}]`;
  const r = `Refund please [${tag}]`;
  await send(q, "Hi, I saw the pre-order. Is the app free, and what does the paid plan cost after? Thanks");
  await send(r, "I was charged for a plan I did not want. I want a refund for this month.");
  console.log("sent two test emails; waiting 20 s for delivery");
  await new Promise((res) => setTimeout(res, 20_000));
  await markUnseen([q, r]);
  const store = memoryStore();
  const result = await handlePoll(gmail(), store, classifyWithClaude, escalateTo);
  console.log(JSON.stringify({ seen: result.seen, replied: result.replied, escalated: result.escalated, skipped: result.skipped }, null, 2));
  for (const t of store.threads) console.log(`thread ${t.subject} → ${t.status}`);
  for (const m of store.messages) console.log(`  ${m.direction} ai=${m.ai}: ${m.body.slice(0, 160).replace(/\s+/g, " ")}`);
  if (result.digest) console.log(`digest → ${escalateTo}:\n${result.digest.slice(0, 400)}`);
  const ours = store.threads.filter((t) => t.subject.includes(tag));
  const ok = ours.some((t) => t.status === "auto_replied") && ours.some((t) => t.status === "escalated");
  console.log(ok ? "PASS: auto-reply and escalation paths both exercised" : "FAIL: one of the paths did not run");
  process.exit(ok ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
