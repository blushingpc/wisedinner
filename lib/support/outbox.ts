import { randomUUID } from "node:crypto";
import { withSignOff } from "./kb.ts";
import { voiceProblems } from "./voice.ts";
import { policyProblems } from "./policy.ts";
import type { Classifier } from "./classify.ts";
import type { Mailbox, Outbound } from "./mail.ts";
import type { PollResult } from "./handler.ts";

export type SupportOutbox = { command: (action: string, body: Record<string, unknown>) => Promise<Record<string, unknown>> };
type Work = { id: string; kind: "inbound" | "digest"; state: string; owner: string; attempt: number; input: { messageId: string; from: string; subject: string; text: string; inReplyTo: string | null; threadSubject: string }; payload: Outbound | null; approved: { intent: string; summary: string } | null };
export class SupportOutboxError extends Error {}
const stripRe = (s: string) => s.replace(/^\s*(re|fwd?):\s*/i, "").trim();
const claim = (work: Work) => ({ id: work.id, owner: work.owner, attempt: work.attempt });

export function supportOutboxRepository(url: string, key: string, request: typeof fetch = fetch): SupportOutbox {
  const origin = new URL(url);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.search || origin.hash || origin.username || origin.password) throw new SupportOutboxError("outbox_not_configured");
  return { async command(action, body) {
    try {
      const r = await request(`${origin.origin}/rest/v1/rpc/wd_support_progress`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_action: action, p_body: body }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
      if (!r.ok) throw Error();
      const value = await r.json(); if (!value || typeof value !== "object" || Array.isArray(value)) throw Error();
      if (value.error) throw new SupportOutboxError(["send_cap", "send_held", "stale_claim", "identity_conflict", "invalid_command"].includes(value.error) ? value.error : "outbox_unavailable");
      return value;
    } catch (e) { throw e instanceof SupportOutboxError ? e : new SupportOutboxError("outbox_unavailable"); }
  } };
}
export function configuredSupportOutbox(): SupportOutbox | undefined {
  if (process.env.WD_SUPPORT_OUTBOX_ENABLED !== "true") return undefined;
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (process.env.WD_SUPPORT_DURABLE_SENDS_ENABLED !== "true" || !url || !key) throw new SupportOutboxError("outbox_not_configured");
  return supportOutboxRepository(url, key);
}

// Separate durable progress from inbound dedupe. Every payload/claim/send permission comes from private SQL.
export async function handleOutboxPoll(mail: Mailbox, classify: Classifier, escalateTo: string, repo: SupportOutbox): Promise<PollResult & { deferred: number }> {
  const inbox = await mail.unread(10);
  const result = { seen: inbox.length, replied: 0, escalated: 0, skipped: 0, skippedAuto: 0, deferred: 0, digestDeferred: false };
  const uids = new Map(inbox.map(m => [m.messageId, m.uid]));
  for (const m of inbox.slice(0, 10)) {
    if (m.autoSubmitted && m.autoSubmitted.trim().toLowerCase() !== "no") { await mail.markSeen(m.uid); result.skippedAuto++; continue; }
    const input = { messageId: m.messageId, from: m.from, subject: m.subject, text: m.text, inReplyTo: m.inReplyTo ?? null, threadSubject: stripRe(m.subject) || "(no subject)" };
    if (Buffer.byteLength(JSON.stringify(input)) > 24576) { result.deferred++; continue; }
    const recorded = await repo.command("record", { input });
    if (recorded.state === "done" || recorded.state === "held") result.skipped++;
  }
  const exclude: string[] = [], owner = randomUUID();
  for (let index = 0; index < 4; index++) {
    // Freeze current escalation membership before the last bounded claim. Existing digest wins on replay.
    if (index === 3 && escalateTo) await repo.command("digest", { to: escalateTo });
    let work = (await repo.command("claim", { owner, exclude })).work as Work | null;
    if (!work) {
      if (index < 3 && escalateTo) { await repo.command("digest", { to: escalateTo }); work = (await repo.command("claim", { owner, exclude })).work as Work | null; }
      if (!work) break;
    }
    exclude.push(work.id);
    try {
      if (work.state === "triage") {
        const i = work.input;
        const triage = i.text.trim() ? await classify({ from: i.from, subject: i.subject, body: i.text }) : { intent: "escalate", category: "other", reason: "empty message", reply: "" };
        const drafted = triage.intent === "informational" && triage.reply.trim();
        const policy = drafted ? policyProblems(triage.reply) : [], voice = drafted ? voiceProblems(triage.reply) : [];
        const reason = policy.length ? `policy-fail: ${policy.join("; ")}` : voice.length ? `voice-fail: ${voice.join("; ")}` : triage.reason || "needs a person";
        const reply = Boolean(drafted && !policy.length && !voice.length);
        const payload: Outbound | null = reply ? { to: i.from, subject: i.subject ? `Re: ${stripRe(i.subject)}` : "Re: your question", text: withSignOff(triage.reply), inReplyTo: i.messageId, references: [i.messageId] } : null;
        const approved = { intent: reply ? "reply" : "escalate", summary: `${i.from} · ${i.subject || "(no subject)"} · ${triage.category}\n  ${reason}\n  ${i.text.slice(0, 300).replace(/\s+/g, " ")}` };
        work = (await repo.command("approve", { ...claim(work), approved, payload })).work as Work;
      }
      if (work.kind === "inbound") await repo.command("inbound", claim(work));
      if (work.approved?.intent === "escalate") { await repo.command("status", claim(work)); result.escalated++; continue; }
      if (work.state !== "accepted") {
        work = (await repo.command("reserve", claim(work))).work as Work;
        if (work.state !== "accepted") {
          await repo.command("begin", claim(work));
          // begin acknowledgement is the transport boundary. Lost/uncertain outcomes are never retried.
          const out = await mail.send(work.payload!);
          work = (await repo.command("accept", { ...claim(work), messageId: out.messageId })).work as Work;
        }
      }
      await repo.command("outbound", claim(work));
      if (work.kind === "inbound") {
        await repo.command("status", claim(work));
        const uid = uids.get(work.input.messageId); if (uid !== undefined) await mail.markSeen(uid);
      }
      await repo.command("finish", claim(work));
      if (work.kind === "inbound") result.replied++;
    } catch {
      result.deferred++; if (work?.kind === "digest") result.digestDeferred = true;
      try { await repo.command("release", claim(work!)); } catch { /* durable lease/state denies replay until safe recovery */ }
    }
  }
  return result;
}
