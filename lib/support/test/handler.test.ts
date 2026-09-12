import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { simpleParser } from "mailparser";
import { DAILY_SEND_CAP, handlePoll, type Store, type Thread } from "../handler.ts";
import { autoSubmittedOf, type Inbound, type Mailbox, type Outbound } from "../mail.ts";
import type { Classifier } from "../classify.ts";
import { FOOTER } from "../kb.ts";

// fixture emails (.eml) → Inbound, the way mail.ts parses them
async function fixture(name: string, uid: number): Promise<Inbound> {
  const parsed = await simpleParser(readFileSync(`lib/support/test/fixtures/${name}.eml`));
  return { uid, messageId: parsed.messageId!, inReplyTo: parsed.inReplyTo ?? undefined, from: parsed.from!.value[0].address!.toLowerCase(), subject: parsed.subject ?? "", text: (parsed.text ?? "").trim(), date: new Date().toISOString(), autoSubmitted: autoSubmittedOf(parsed.headers.get("auto-submitted")) };
}

function fakeMail(inbox: Inbound[]) {
  const sent: Outbound[] = [];
  const seen: number[] = [];
  const mail: Mailbox = {
    async unread() {
      return inbox;
    },
    async markSeen(uid) {
      seen.push(uid);
    },
    async send(m) {
      sent.push(m);
      return { messageId: `<out-${sent.length}@test>` };
    },
  };
  return { mail, sent, seen };
}

function fakeStore(sentToday = 0) {
  const threads: Thread[] = [];
  const messages: { thread_id: string; direction: string; body: string; ai: boolean; message_id?: string }[] = [];
  const status = new Map<string, string>();
  const store: Store = {
    async findThread(inReplyTo, from, subject) {
      if (inReplyTo) {
        const m = messages.find((x) => x.message_id === inReplyTo);
        if (m) return threads.find((t) => t.id === m.thread_id) ?? null;
      }
      return threads.find((t) => t.from_email === from && t.subject === subject) ?? null;
    },
    async createThread(t) {
      const th = { id: `t${threads.length + 1}`, from_email: t.from_email, subject: t.subject, status: "open", message_id: t.message_id };
      threads.push(th);
      status.set(th.id, "open");
      return th;
    },
    async logMessage(m) {
      messages.push(m);
    },
    async setStatus(id, s) {
      status.set(id, s);
    },
    async sentLast24h() {
      return sentToday;
    },
    async hasMessage(id) {
      return messages.some((m) => m.message_id === id);
    },
  };
  return { store, threads, messages, status };
}

// a deterministic stand-in for Claude: pricing questions are informational, refunds escalate
const classify: Classifier = async (e) => {
  if (/refund|charged|delete my|lawyer/i.test(e.body)) return { intent: "escalate", category: /refund|charged/i.test(e.body) ? "refund" : "data-deletion", reason: "money or data: a person decides", reply: "" };
  return { intent: "informational", category: "pricing", reason: "", reply: "The pre-order build is free. Protein Plan is $8.99 a month or $59 a year at launch, with a 14 day trial.\n\nWiseDinner support" };
};

test("pricing question: auto reply from the same mailbox, thread auto_replied, message marked read, both directions logged", async () => {
  const inbox = [await fixture("pricing-question", 11)];
  const { mail, sent, seen } = fakeMail(inbox);
  const { store, threads, messages, status } = fakeStore();
  const r = await handlePoll(mail, store, classify, "founder@example.com");
  assert.deepEqual({ seen: r.seen, replied: r.replied, escalated: r.escalated, skipped: r.skipped }, { seen: 1, replied: 1, escalated: 0, skipped: 0 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "sam@example.com");
  assert.equal(sent[0].subject, "Re: How much does it cost?");
  assert.equal(sent[0].inReplyTo, inbox[0].messageId);
  assert.ok(sent[0].text.endsWith(FOOTER), "footer present");
  assert.deepEqual(seen, [11]);
  assert.equal(threads.length, 1);
  assert.equal(status.get(threads[0].id), "auto_replied");
  assert.deepEqual(messages.map((m) => [m.direction, m.ai]), [["in", false], ["out", true]]);
  assert.equal(r.digest, undefined);
});

test("refund request: left unread, thread escalated, one digest to the escalation address", async () => {
  const inbox = [await fixture("refund-request", 12)];
  const { mail, sent, seen } = fakeMail(inbox);
  const { store, threads, status } = fakeStore();
  const r = await handlePoll(mail, store, classify, "founder@example.com");
  assert.equal(r.escalated, 1);
  assert.equal(r.replied, 0);
  assert.deepEqual(seen, []);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "founder@example.com");
  assert.match(sent[0].subject, /^Support: 1 to answer/);
  assert.match(sent[0].text, /refund/);
  assert.match(sent[0].text, /still unread/);
  assert.equal(status.get(threads[0].id), "escalated");
});

test("loop guard: a message with Auto-Submitted: auto-replied is marked read and never reaches the classifier", async () => {
  const inbox = [await fixture("auto-reply", 21)];
  assert.equal(inbox[0].autoSubmitted, "auto-replied", "fixture header parsed");
  const { mail, sent, seen } = fakeMail(inbox);
  const { store, threads, messages } = fakeStore();
  let classified = 0;
  const neverClassify: Classifier = async () => {
    classified++;
    throw new Error("classifier must not run for auto-submitted mail");
  };
  const r = await handlePoll(mail, store, neverClassify, "founder@example.com");
  assert.deepEqual({ seen: r.seen, replied: r.replied, escalated: r.escalated, skipped: r.skipped, skippedAuto: r.skippedAuto }, { seen: 1, replied: 0, escalated: 0, skipped: 0, skippedAuto: 1 });
  assert.equal(classified, 0);
  assert.deepEqual(seen, [21], "marked read");
  assert.equal(sent.length, 0, "nothing sent, no digest");
  assert.equal(threads.length, 0);
  assert.equal(messages.length, 0);
  assert.equal(r.digest, undefined);
});

test("loop guard: plain mail from the support address itself still classifies and is answered", async () => {
  const inbox = [await fixture("self-sent-plain", 22)];
  assert.equal(inbox[0].autoSubmitted, undefined);
  assert.equal(inbox[0].from, "wisedinnersupport@gmail.com");
  const { mail, sent, seen } = fakeMail(inbox);
  const { store, threads, status } = fakeStore();
  const r = await handlePoll(mail, store, classify, "founder@example.com");
  assert.deepEqual({ seen: r.seen, replied: r.replied, escalated: r.escalated, skipped: r.skipped, skippedAuto: r.skippedAuto }, { seen: 1, replied: 1, escalated: 0, skipped: 0, skippedAuto: 0 });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].to, "wisedinnersupport@gmail.com");
  assert.equal(sent[0].subject, "Re: what does the app cost");
  assert.deepEqual(seen, [22]);
  assert.equal(status.get(threads[0].id), "auto_replied");
});

test("a reply to an earlier thread joins it by In-Reply-To; an already-logged unread message is skipped", async () => {
  const first = await fixture("refund-request", 12);
  const { store, threads, messages } = fakeStore();
  const a = fakeMail([first]);
  await handlePoll(a.mail, store, classify, "");
  const followUp: Inbound = { ...first, uid: 13, messageId: "<follow@example.com>", inReplyTo: first.messageId, subject: "Re: Refund please", text: "Any update on my refund?" };
  const b = fakeMail([first, followUp]);
  const r = await handlePoll(b.mail, store, classify, "");
  assert.equal(r.skipped, 1);
  assert.equal(threads.length, 1);
  assert.equal(messages.filter((m) => m.thread_id === threads[0].id && m.direction === "in").length, 2);
});

test("daily send cap: past the cap informational mail is escalated, not answered", async () => {
  const inbox = [await fixture("pricing-question", 11)];
  const { mail, sent } = fakeMail(inbox);
  const { store, threads, status } = fakeStore(DAILY_SEND_CAP);
  const r = await handlePoll(mail, store, classify, "founder@example.com");
  assert.equal(r.replied, 0);
  assert.equal(r.escalated, 1);
  assert.equal(status.get(threads[0].id), "escalated");
  assert.equal(sent.length, 1); // only the digest
  assert.match(sent[0].text, /daily send cap/);
});

test("empty message escalates without calling the classifier", async () => {
  const m = await fixture("pricing-question", 14);
  const { mail } = fakeMail([{ ...m, text: "" }]);
  const { store } = fakeStore();
  let called = 0;
  const r = await handlePoll(mail, store, async (e) => (called++, classify(e)), "");
  assert.equal(called, 0);
  assert.equal(r.escalated, 1);
});
