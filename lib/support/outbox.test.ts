import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { handleOutboxPoll, SupportOutboxError, type SupportOutbox, supportOutboxRepository, configuredSupportOutbox } from "./outbox.ts";
import type { Mailbox, Outbound, Inbound } from "./mail.ts";
import type { Classifier } from "./classify.ts";

const OWNER = "10000000-0000-4000-8000-000000000001", OTHER = "10000000-0000-4000-8000-000000000002";
type Fault = { action: string; after?: boolean };
async function fixture(fault?: Fault, digest = false, cap = false) {
  // Actual SQL, one ephemeral WASM connection; verified Auth claims are emulated, never hosted proof.
  const db = await PGlite.create("memory://");
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
    grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.role()returns text language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb->>'role'$$;
    create table public.support_threads(id uuid primary key default gen_random_uuid(),channel text not null,from_email text not null,subject text not null default '',status text not null default 'open',message_id text,created_at timestamptz default now(),updated_at timestamptz default now());
    create unique index support_threads_message_id on public.support_threads(message_id)where message_id is not null;
    create table public.support_messages_v2(id uuid primary key default gen_random_uuid(),thread_id uuid references public.support_threads(id),direction text not null,body text not null,ai boolean default false,message_id text,created_at timestamptz default now());
    create unique index support_messages_v2_message_id on public.support_messages_v2(message_id)where message_id is not null;
    create table public.unrelated_grant_sentinel(id integer);grant select on public.unrelated_grant_sentinel to authenticated;`);
  for (const file of ["0011_wd_support_sends.sql", "0012_wd_support_outbox.sql"]) await db.exec(await readFile(new URL(`../../supabase/migrations/${file}`, import.meta.url), "utf8"));
  const login = async (role = "service_role") => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role })]); await db.exec(`set role ${role}`); };
  const raw = async (action: string, body: Record<string, unknown>) => {
    const r = (await db.query<{ r: Record<string, unknown> }>("select public.wd_support_progress($1,$2::jsonb)r", [action, JSON.stringify(body)])).rows[0].r;
    if (r.error) throw new SupportOutboxError(String(r.error)); return r;
  };
  let injected = false, classified = 0;
  const repo: SupportOutbox = { async command(action, body) { if (fault?.action === action && !injected && !fault.after) { injected = true; throw Error("synthetic_boundary_failure"); } const r = await raw(action, body); if (fault?.action === action && !injected && fault.after) { injected = true; throw Error("synthetic_ack_lost"); } return r; } };
  const seen = new Set<number>(), sends: Outbound[] = [];
  const input: Inbound = { uid: 1, messageId: "synthetic-inbound", from: "synthetic@example.invalid", subject: "Fixture", text: "Question", date: "2000-01-01" };
  let failMail = true;
  const mail: Mailbox = { unread: async () => seen.has(input.uid) ? [] : [input], markSeen: async uid => { if (fault?.action === "seen" && failMail && !fault.after) { failMail = false; throw Error("synthetic_seen_failure"); } seen.add(uid); if (fault?.action === "seen" && failMail && fault.after) { failMail = false; throw Error("synthetic_seen_ack_lost"); } }, send: async payload => { sends.push(structuredClone(payload)); if (fault?.action === "smtp" && failMail) { failMail = false; throw Error("synthetic_uncertain_transport"); } return { messageId: `synthetic-smtp-${sends.length}` }; } };
  const classify: Classifier = async () => { classified++; if (fault?.action === "classification" && !injected) { injected = true; throw Error("synthetic_classifier_outage"); } return digest ? { intent: "escalate", category: "refund", reason: "needs a person", reply: "" } : { intent: "informational", category: "other", reason: "fixture", reply: "Prices are estimates." }; };
  const admin = async (sql: string) => { await db.exec("reset role"); await db.exec(sql); await login(); };
  if (cap) await admin(`insert into public.support_threads(id,channel,from_email)values('${OTHER}','email','legacy@example.invalid');insert into public.support_messages_v2(thread_id,direction,body,message_id)select '${OTHER}','out','synthetic','legacy-'||n from generate_series(1,450)n;`);
  await login();
  const poll = () => handleOutboxPoll(mail, classify, digest ? "operator@example.invalid" : "", repo);
  const query = async <T>(sql: string) => { await db.exec("reset role"); const rows = (await db.query<T>(sql)).rows; await login(); return rows; };
  return { db, repo, raw, mail, input, sends, seen, poll, login, query, admin, get classified() { return classified; } };
}

for (const fault of [{ action: "outbound" }, { action: "inbound", after: true }, { action: "cap" }, { action: "digest" }] as Fault[]) test(`recovery regression passes actual SQL: ${fault.action}`, async () => {
  const f = await fixture(fault.action === "cap" || fault.action === "digest" ? undefined : fault, fault.action === "digest", fault.action === "cap" || fault.action === "digest");
  try {
    const initial = await f.poll(); assert(!JSON.stringify(initial).includes("synthetic@example.invalid"), "poll counts never expose private payload");
    if (fault.action === "cap" || fault.action === "digest") { assert.equal(f.sends.length, 0); await f.admin("update public.support_messages_v2 set created_at=now()-interval '25 hours';"); }
    await f.poll();
    assert.equal(f.sends.length, 1, "one approved payload sent, no resend");
    assert.equal((await f.query("select * from public.support_messages_v2 where message_id='synthetic-smtp-1'")).length, 1);
    const states = await f.query<{ state: string }>("select state from public.wd_support_work"); assert(states.every(r => r.state === "done"));
    assert.equal(f.classified, 1, "persisted triage never reclassified");
    assert.equal(f.seen.size, fault.action === "digest" ? 0 : 1);
  } finally { await f.db.close(); }
});

test("failure injection resumes each safe persistence/log/status/seen boundary without changed content", async () => {
  for (const fault of [
    { action: "classification" }, { action: "record" }, { action: "record", after: true }, { action: "claim" }, { action: "claim", after: true },
    { action: "approve" }, { action: "approve", after: true }, { action: "inbound" },
    { action: "reserve" }, { action: "reserve", after: true }, { action: "begin" },
    { action: "accept", after: true }, { action: "outbound" }, { action: "outbound", after: true },
    { action: "status" }, { action: "status", after: true }, { action: "seen" }, { action: "seen", after: true }, { action: "finish" }, { action: "finish", after: true },
  ] as Fault[]) {
    const f = await fixture(fault);
    try {
      await f.poll().catch(() => {});
      if (fault.action === "classification") assert.equal((await f.query("select * from public.support_messages_v2 where direction='in'")).length, 0, "classifier outage does not complete inbound dedupe");
      if (fault.action === "claim") await f.admin("update public.wd_support_work set lease_until=now()-interval '1 second';");
      await f.poll();
      assert.equal(f.sends.length, 1, `single transport: ${fault.action}/${fault.after}`); assert.equal(f.seen.size, 1);
      assert.equal((await f.query("select * from public.support_messages_v2 where message_id='synthetic-smtp-1'")).length, 1);
      assert.equal((await f.query<{ state: string }>("select state from public.wd_support_work"))[0].state, "done");
      if (!(fault.action === "classification" || fault.action === "approve" && !fault.after)) assert.equal(f.classified, 1, "approved payload reused");
    } finally { await f.db.close(); }
  }
});

test("uncertain SMTP, begin acknowledgement or unrecorded acceptance are held without another send", async () => {
  for (const fault of [{ action: "smtp" }, { action: "begin", after: true }, { action: "accept" }] as Fault[]) {
    const f = await fixture(fault);
    try { await f.poll(); await f.poll(); assert.equal(f.sends.length, fault.action === "begin" ? 0 : 1); assert.equal((await f.query<{ state: string }>("select state from public.wd_support_work"))[0].state, "held"); assert.equal(f.seen.size, 0); }
    finally { await f.db.close(); }
  }
});

test("digest membership, identity, payload and accepted finalization survive restart/deferral", async () => {
  for (const fault of [{ action: "digest" }, { action: "digest", after: true }, { action: "outbound" }, { action: "finish" }, { action: "finish", after: true }] as Fault[]) {
    const f = await fixture(fault, true);
    try {
      await f.poll().catch(() => {});
      const before = await f.query<{ id: string; payload: unknown }>("select id,payload from public.wd_support_work where kind='digest'");
      f.input.uid = 99;
      await f.poll(); assert.equal(f.sends.length, 1); assert.equal(f.classified, 1); assert.equal(f.seen.size, 0);
      const after = await f.query("select id,payload from public.wd_support_work where kind='digest'"); assert.equal(after.length, 1);
      if (before.length) assert.deepEqual(after, before, "immutable digest membership/payload");
      assert((await f.query<{ state: string }>("select state from public.wd_support_work")).every(r => r.state === "done"));
    } finally { await f.db.close(); }
  }
});

test("last rolling slot is shared by reply/digest, accepted logs count once and frozen deferral recovers", async () => {
  const f = await fixture(undefined, false, true);
  try {
    await f.admin("update public.support_messages_v2 set created_at=now()-interval '25 hours' where message_id='legacy-1';");
    const escalation = { ...f.input, uid: 2, messageId: "synthetic-refund", text: "Refund" };
    const mail: Mailbox = { ...f.mail, unread: async () => [f.input, escalation].filter(i => !f.seen.has(i.uid)) };
    const classifier: Classifier = async i => i.body === "Refund" ? { intent: "escalate", category: "refund", reason: "person required", reply: "" } : { intent: "informational", category: "other", reason: "fixture", reply: "Prices are estimates." };
    const result = await handleOutboxPoll(mail, classifier, "operator@example.invalid", f.repo);
    assert.equal(f.sends.length, 1); assert.equal(result.digestDeferred, true);
    const frozen = await f.query("select id,payload from public.wd_support_work where kind='digest'"); assert.equal(frozen.length, 1);
    await f.admin("update public.support_messages_v2 set created_at=now()-interval '25 hours' where message_id like 'legacy-%';");
    await handleOutboxPoll(mail, async () => { throw Error("must_not_reclassify"); }, "changed-operator@example.invalid", f.repo);
    assert.equal(f.sends.length, 2); assert.equal(f.sends[1].to, "operator@example.invalid", "deferred recipient/content frozen before restart");
    assert.deepEqual(await f.query("select id,payload from public.wd_support_work where kind='digest'"), frozen);
    assert.equal((await f.query("select * from public.wd_support_sends where state='accepted'")).length, 2);
    assert.equal((await f.query("select * from public.support_messages_v2 where message_id like 'synthetic-smtp-%'")).length, 2);
    assert((await f.query<{ state: string }>("select state from public.wd_support_work")).every(r => r.state === "done"));
  } finally { await f.db.close(); }
});

test("digest byte budget preserves oversized cohort membership across bounded batches", async () => {
  const f = await fixture();
  try {
    for (let index = 0; index < 10; index++) {
      const input = { messageId: `synthetic-long-${index}`, from: f.input.from, subject: "Fixture", threadSubject: "Fixture", text: "Question", inReplyTo: null };
      await f.raw("record", { input }); const work = (await f.raw("claim", { owner: OWNER, exclude: [] })).work as { id: string; attempt: number };
      const context = { id: work.id, owner: OWNER, attempt: work.attempt };
      await f.raw("approve", { ...context, approved: { intent: "escalate", summary: '"'.repeat(4000) }, payload: null });
      await f.raw("inbound", context); await f.raw("status", context);
    }
    await f.raw("digest", { to: "operator@example.invalid" });
    await f.raw("digest", { to: "operator@example.invalid" });
    await f.raw("digest", { to: "operator@example.invalid" });
    const batches = await f.query<{ input: { members: string[] }; payload: unknown }>("select input,payload from public.wd_support_work where kind='digest'");
    const members = batches.flatMap(b => b.input.members);
    assert.equal(members.length, 10); assert.equal(new Set(members).size, 10, "membership is neither lost nor duplicated");
    assert(batches.every(b => Buffer.byteLength(JSON.stringify(b.payload)) <= 32768));
  } finally { await f.db.close(); }
});

test("SQL claims/grants/content/cap reject clients, competing owners and stale attempts", async () => {
  const f = await fixture();
  try {
    await f.login("anon"); await assert.rejects(f.raw("claim", { owner: OWNER, exclude: [] }), /permission denied/);
    await f.login("authenticated"); await assert.rejects(f.raw("record", {}), /permission denied/); await assert.rejects(f.db.query("select * from public.wd_support_work"), /permission denied/);
    assert.equal((await f.db.query("select * from public.unrelated_grant_sentinel")).rows.length, 0);
    await f.login(); await assert.rejects(f.db.query("insert into public.wd_support_work(id,kind,input,input_hash)values(repeat('a',64),'inbound','{}','x')"), /permission denied/);
    const input = { messageId: f.input.messageId, from: f.input.from, subject: f.input.subject, text: f.input.text, inReplyTo: null, threadSubject: "Fixture" };
    await f.raw("record", { input });
    const a = (await f.raw("claim", { owner: OWNER, exclude: [] })).work as { id: string; attempt: number };
    assert.equal((await f.raw("claim", { owner: OTHER, exclude: [] })).work, null);
    await assert.rejects(f.raw("approve", { id: a.id, owner: OTHER, attempt: a.attempt, approved: {}, payload: null }), /stale_claim/);
    await f.admin("update public.wd_support_work set lease_until=now()-interval '1 second';");
    const b = (await f.raw("claim", { owner: OTHER, exclude: [] })).work as { id: string; attempt: number };
    await assert.rejects(f.raw("release", { id: a.id, owner: OWNER, attempt: a.attempt }), /stale_claim/);
    const context = { id: b.id, owner: OTHER, attempt: b.attempt }, approved = { intent: "reply", summary: "synthetic" }, payload = { to: input.from, subject: "Re: Fixture", text: "Prices are estimates.", inReplyTo: input.messageId, references: [input.messageId] };
    await f.raw("approve", { ...context, approved, payload });
    await assert.rejects(f.raw("approve", { ...context, approved, payload: { ...payload, text: "changed" } }), /identity_conflict/);
    await f.raw("reserve", context); await f.raw("release", context);
    const c = (await f.raw("claim", { owner: OWNER, exclude: [] })).work as { id: string; attempt: number };
    const next = { id: c.id, owner: OWNER, attempt: c.attempt };
    await f.raw("reserve", next); assert.equal((await f.query("select * from public.wd_support_sends")).length, 1, "pre-send retry retains one reservation");
    await f.raw("begin", next); await f.admin("update public.wd_support_work set lease_until=now()-interval '1 second';");
    assert.equal((await f.raw("claim", { owner: OTHER, exclude: [] })).work, null);
    assert.equal((await f.query<{ state: string }>("select state from public.wd_support_work"))[0].state, "held", "crashed sender never released by lease expiry");
    await assert.rejects(f.raw("record", { input: { ...input, text: "changed" } }), /identity_conflict/);
  } finally { await f.db.close(); }
});

test("new poll preserves automatic skip, empty escalation, voice/policy gates, and ledger outage denies SMTP", async () => {
  const f = await fixture();
  try {
    f.input.autoSubmitted = "auto-replied"; await f.poll(); assert.equal(f.classified, 0); assert.equal(f.sends.length, 0); assert.equal(f.seen.size, 1);
    f.seen.clear(); f.input.autoSubmitted = undefined;
    await assert.rejects(handleOutboxPoll(f.mail, async () => { throw Error("must_not_classify"); }, "", { command: async () => { throw Error("synthetic_ledger_denied"); } })); assert.equal(f.sends.length, 0);
  } finally { await f.db.close(); }
  for (const reply of ["We will refund you in full.", "Hello — welcome.", ""]) {
    const g = await fixture(); try { if (!reply) g.input.text = ""; const classifier: Classifier = async () => ({ intent: "informational", category: "other", reason: "fixture", reply }); await handleOutboxPoll(g.mail, classifier, "", g.repo); assert.equal(g.sends.length, 0); assert.equal((await g.query<{ state: string }>("select state from public.wd_support_work"))[0].state, "escalated"); } finally { await g.db.close(); }
  }
});

test("HTTP adapter and default-off configuration redact private errors and deny unsafe origins", async () => {
  const calls: RequestInit[] = [];
  const repo = supportOutboxRepository("https://fixture.supabase.co", "synthetic-key", async (_url, init) => { calls.push(init!); return new Response("private recipient/body failure", { status: 403 }); });
  await assert.rejects(repo.command("claim", { owner: OWNER, exclude: [] }), /^Error: outbox_unavailable$/);
  assert.equal(calls[0].redirect, "error"); assert.equal(calls[0].cache, "no-store");
  assert.throws(() => supportOutboxRepository("https://fixture.supabase.co/?key=private", "synthetic"));
  const previous = process.env.WD_SUPPORT_OUTBOX_ENABLED; delete process.env.WD_SUPPORT_OUTBOX_ENABLED;
  try { assert.equal(configuredSupportOutbox(), undefined); } finally { if (previous !== undefined) process.env.WD_SUPPORT_OUTBOX_ENABLED = previous; }
});
