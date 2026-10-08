import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { supabaseDeletionAuth, AuthDeletionError } from "./account-deletion-auth.ts";
import { accountDeletionWorker, DeletionProgressError, type DeletionRepository, type DeletionTarget } from "./account-deletion.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002", OP = "20000000-0000-4000-8000-000000000001", OWNER = "30000000-0000-4000-8000-000000000001";
const origin = "https://fixture.invalid", credential = "synthetic-server-credential";
const user = (provider = "email") => ({ id: A, created_at: "2026-10-01T00:00:00Z", is_anonymous: false, app_metadata: { provider: "apple" }, user_metadata: { apple: false, secret: "private-body-marker" }, email: "synthetic@example.invalid", identities: [{ identity_id: OWNER, user_id: A, provider, id: "synthetic-provider-subject", created_at: "2026-10-01T00:00:00Z", identity_data: { secret: "private-body-marker" } }] });
const missing = () => Response.json({ code: "user_not_found", msg: "User not found" }, { status: 404 });
type Mode = "normal" | "loss" | "present" | "delete404" | "delete500" | "storage" | "wrong-user" | "malformed" | "redirect" | "oversize" | "timeout";
async function dry(mode: Mode = "normal", provider = "email", timeout = 8000) {
  let current: unknown = user(provider), deletes = 0, reads = 0;
  const work: Record<string, unknown> = { user_id: A, owner: OWNER, attempt: 1, lease_until: new Date(Date.now() + 60000).toISOString(), identity_hash: null, apple_linkage: provider === "apple" ? "linked" : "none", apple_state: provider === "apple" ? "done" : "not_required", auth_state: "started", auth_operation: OP, complete: false };
  const request: typeof fetch = async (value, init) => {
    const url = new URL(String(value)); assert.equal(url.origin, origin); assert.equal(init!.redirect, "error"); assert.equal(init!.cache, "no-store"); assert(init!.signal);
    assert.equal(new Headers(init!.headers).get("apikey"), credential); assert.equal(new Headers(init!.headers).get("authorization"), `Bearer ${credential}`);
    if (url.pathname === "/rest/v1/wd_accounts") { assert.equal(url.searchParams.get("user_id"), `eq.${A}`); return Response.json([{ user_id: A, state: "deletion_pending" }]); }
    if (url.pathname === "/rest/v1/wd_deletion_work") return Response.json([structuredClone(work)]);
    assert.equal(url.pathname, `/auth/v1/admin/users/${A}`); assert.equal(url.search, "");
    if (init!.method === "GET") { reads++; return current == null ? missing() : Response.json(current); }
    assert.equal(init!.method, "DELETE"); assert.equal(init!.body, '{"should_soft_delete":false}'); deletes++;
    if (mode === "loss") { current = null; throw Error("private-body-marker"); }
    if (mode === "timeout") return new Promise<Response>(() => {});
    if (mode === "delete404") return missing();
    if (mode === "delete500" || mode === "storage") return Response.json({ code: "unexpected_failure", msg: "private-body-marker storage-owned" }, { status: 500 });
    if (mode === "wrong-user") return Response.json({ ...user(), id: B });
    if (mode === "malformed") return Response.json({ user: null });
    if (mode === "oversize") return Response.json({ extra: "x".repeat(32769) });
    if (mode === "redirect") return new Response(null, { status: 302, headers: { location: "https://wrong.invalid" } });
    if (mode !== "present") current = null;
    return Response.json({});
  };
  const adapter = supabaseDeletionAuth(origin, credential, request, timeout), verified = await adapter.verifyIdentity(A); assert(verified);
  work.identity_hash = verified.identityHash;
  const target: DeletionTarget = { userId: A, identityHash: verified.identityHash, operationId: OP };
  return { adapter, target, verified, request, work, get deletes() { return deletes; }, get reads() { return reads; }, set current(value: unknown) { current = value; } };
}

test("explicit constructor and invalid targets cannot leak or call transport", async () => {
  let calls = 0; const request: typeof fetch = async () => { calls++; throw Error("no request expected"); };
  for (const bad of ["http://fixture.invalid", "https://fixture.invalid/auth/v1", "https://u:p@fixture.invalid", "https://fixture.invalid/?x=1", "https://fixture.invalid/#x", "https://fixture.invalid:444", "https://fixture.invalid/a/..", "https://localhost", "https://127.0.0.1"]) assert.throws(() => supabaseDeletionAuth(bad, credential, request), AuthDeletionError);
  const adapter = supabaseDeletionAuth(origin, credential, request); assert.equal(calls, 0);
  for (const value of [{ userId: "../users", identityHash: "a".repeat(64), operationId: OP }, { userId: A, identityHash: "bad", operationId: OP }, { userId: A, identityHash: "a".repeat(64), operationId: "bad" }, { userId: A, identityHash: "a".repeat(64), operationId: OP, owner: A }]) await assert.rejects(adapter.auth.run(value as DeletionTarget), AuthDeletionError);
  let getter = 0; const accessor = { identityHash: "a".repeat(64), operationId: OP, get userId() { getter++; return A; } }; await assert.rejects(adapter.auth.run(accessor), AuthDeletionError); assert.equal(getter, 0); assert.equal(calls, 0);
});
test("authoritative lineage stable ordering, editable facts excluded, Apple and unknown held", async () => {
  const f = await dry(); const first = f.verified;
  f.current = { ...user(), email: "other@example.invalid", user_metadata: { apple: true }, app_metadata: { provider: "apple" }, updated_at: "2026-10-08T00:00:00Z" };
  assert.deepEqual(await f.adapter.verifyIdentity(A), first); assert.equal(first.apple, "none");
  const apple = await dry("normal", "apple"); assert.equal(apple.verified.apple, "linked");
  const two = { ...user(), identities: [user().identities[0], { ...user("google").identities[0], identity_id: OP }] }; f.current = two;
  const before = await f.adapter.verifyIdentity(A); f.current = { ...two, identities: [...two.identities].reverse() }; assert.deepEqual(await f.adapter.verifyIdentity(A), before);
  for (const value of [{ ...user(), identities: undefined }, { ...user(), identities: [] }, { ...user(), is_anonymous: true }, { ...user(), id: B }, { ...user(), created_at: "bad" }, user("unsupported"), { ...user(), identities: [{ ...user().identities[0], user_id: B }] }, { ...user(), identities: [user().identities[0], user().identities[0]] }]) { f.current = value; assert.equal(await f.adapter.verifyIdentity(A), null); }
  assert(!JSON.stringify(first).includes("private-body-marker")); assert(!JSON.stringify(first).includes("@"));
});
test("one documented hard delete plus authoritative absence; wrong durable operation/prerequisite refuses", async () => {
  const f = await dry(), input = structuredClone(f.target); const result = await f.adapter.auth.run(input);
  assert.equal(result.outcome, "confirmed"); assert.equal(f.deletes, 1); assert.deepEqual(input, f.target); assert.match(result.evidenceHash, /^[a-f0-9]{64}$/);
  for (const patch of [{ auth_operation: OWNER }, { identity_hash: "b".repeat(64) }, { apple_linkage: "unknown" }, { apple_linkage: "linked", apple_state: "held" }, { auth_state: "held" }, { lease_until: "2020-01-01T00:00:00Z" }]) { const g = await dry(); Object.assign(g.work, patch); assert.equal((await g.adapter.auth.run(g.target)).outcome, "unknown"); assert.equal(g.deletes, 0); }
  const g = await dry(); g.current = { ...user(), identities: [{ ...user().identities[0], identity_id: OP }] }; assert.equal((await g.adapter.auth.run(g.target)).outcome, "unknown"); assert.equal(g.deletes, 0);
});
test("unknown destructive outcomes never retry; exact durable held provenance can reconcile absence", async t => {
  for (const mode of ["loss", "present", "delete404", "delete500", "storage", "wrong-user", "malformed", "redirect", "oversize", "timeout"] as Mode[]) await t.test(mode, async () => {
    const f = await dry(mode, "email", mode === "timeout" ? 20 : 8000); const p = await f.adapter.auth.run(f.target); assert.equal(p.outcome, "unknown"); assert.equal(f.deletes, 1);
    f.work.auth_state = "held";
    const reconciled = await f.adapter.auth.reconcile!(f.target); assert.equal(reconciled.outcome, mode === "loss" ? "already_absent" : "unknown"); assert.equal(f.deletes, 1);
    assert(!JSON.stringify(p).includes("private-body-marker")); assert(!JSON.stringify(p).includes(credential));
    if (mode === "loss") { f.work.auth_operation = OWNER; assert.equal((await f.adapter.auth.reconcile!(f.target)).outcome, "unknown"); }
  });
});
test("read timeout/denial/wrong-code/redirect/oversize cannot prove absence or trigger deletion", async () => {
  for (const response of [() => missing(), () => Response.json({ code: "validation_failed" }, { status: 404 }), () => Response.json({ code: "not_admin" }, { status: 403 }), () => Response.json({}, { status: 500 }), () => Response.json({ huge: "x".repeat(33000) }), () => new Response("bad", { headers: { "content-type": "application/json" } }), () => new Response(null, { status: 301 })]) {
    const f = await dry(); const request: typeof fetch = async (url, init) => String(url).includes("/auth/v1/") ? response() : f.request(url, init);
    const a = supabaseDeletionAuth(origin, credential, request); assert.equal((await a.auth.run(f.target)).outcome, "unknown"); f.work.auth_state = "held";
    assert.equal((await a.auth.reconcile!(f.target)).outcome, response().status === 404 && (await response().json()).code === "user_not_found" ? "already_absent" : "unknown"); assert.equal(f.deletes, 0);
  }
  const f = await dry(); const a = supabaseDeletionAuth(origin, credential, async () => new Promise<Response>(() => {}), 10); assert.equal((await a.auth.run(f.target)).outcome, "unknown"); assert.equal(f.deletes, 0);
});
test("deferred identity/claim changes and late responses cannot approve or retarget deletion", async () => {
  const f = await dry(); let entered!: () => void, resume!: () => void;
  const reached = new Promise<void>(r => { entered = r; }), paused = new Promise<void>(r => { resume = r; });
  const a = supabaseDeletionAuth(origin, credential, async (url, init) => {
    if (String(url).includes("/auth/v1/") && init!.method === "GET") { const old = await f.request(url, init); entered(); await paused; return old; } return f.request(url, init);
  });
  const running = a.auth.run(f.target); await reached; f.work.attempt = 2; resume(); assert.equal((await running).outcome, "unknown"); assert.equal(f.deletes, 0);
  const g = await dry(); const b = supabaseDeletionAuth(origin, credential, async (url, init) => {
    const response = await g.request(url, init); if (init!.method === "DELETE") { g.current = { ...user(), identities: [{ ...user().identities[0], identity_id: OP }] }; } return response;
  });
  assert.equal((await b.auth.run(g.target)).outcome, "unknown"); assert.equal(g.deletes, 1);
  for (const value of [{ ...user(), created_at: "2026-10-02T00:00:00Z" }, { ...user(), identities: [{ ...user().identities[0], id: "different-subject" }] }]) {
    const changed = await dry(); changed.current = value; assert.equal((await changed.adapter.auth.run(changed.target)).outcome, "unknown"); assert.equal(changed.deletes, 0);
  }
});

// Actual durable SQL, explicit memory target, service claims emulated. One connection.
async function workerFixture(provider = "email", lose = false) {
  const db = await PGlite.create("memory://");
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;create table auth.users(id uuid primary key);`);
    for (const file of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0009_wd_notifications.sql", "0013_wd_account_deletion.sql", "0015_wd_week_metadata_boundary.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    await db.query("insert into auth.users values($1),($2)", [A, B]);
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "authenticated", sub: A, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) }] })]);
    await db.exec("set role authenticated"); await db.query("select public.wd_account_command('initialize','{}',$1)", [OP]); await db.query("select public.wd_account_command('begin_deletion',$1::jsonb,$2)", [JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }), OWNER]); await db.exec("reset role");
    const repo: DeletionRepository = { command: async (action, body) => db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: "service_role" })]); await tx.exec("set local role service_role");
      const r = (await tx.query<{ r: Awaited<ReturnType<DeletionRepository["command"]>> & { error?: string } }>("select public.wd_deletion_command($1,$2::jsonb) r", [action, JSON.stringify(body)])).rows[0].r;
      if (r.error) throw new DeletionProgressError(r.error); return r;
    }) };
    let deletes = 0, apple = 0;
    const request: typeof fetch = async (value, init) => {
      const url = new URL(String(value)); assert.equal(url.origin, origin); assert.equal(init!.redirect, "error"); assert.equal(init!.cache, "no-store");
      if (url.pathname.startsWith("/rest/v1/")) {
        const table = url.pathname.endsWith("wd_accounts") ? "wd_accounts" : "wd_deletion_work"; assert.equal(url.searchParams.get("user_id"), `eq.${A}`);
        const columns = url.searchParams.get("select")!; assert.equal(columns, table === "wd_accounts" ? "user_id,state" : "user_id,owner,attempt,lease_until,identity_hash,apple_linkage,apple_state,auth_state,auth_operation,complete");
        return Response.json((await db.query(`select ${columns} from public.${table} where user_id=$1`, [A])).rows);
      }
      assert.equal(url.pathname, `/auth/v1/admin/users/${A}`);
      if (init!.method === "DELETE") { deletes++; assert.equal(init!.body, '{"should_soft_delete":false}'); await db.query("delete from auth.users where id=$1", [A]); if (lose) throw Error("synthetic acknowledgement loss"); return Response.json({}); }
      assert.equal(init!.method, "GET"); return (await db.query("select id from auth.users where id=$1", [A])).rows.length ? Response.json(user(provider)) : missing();
    };
    const adapter = supabaseDeletionAuth(origin, credential, request);
    const worker = () => accountDeletionWorker(repo, { ...adapter, apple: { run: async t => { apple++; return { ...t, outcome: "unknown", evidenceHash: "a".repeat(64) }; } } });
    return { db, worker, get deletes() { return deletes; }, get apple() { return apple; } };
  } catch (e) { await db.close(); throw e; }
}
test("real worker/SQL no-Apple completion, unknown acknowledgement/restart recovery and Apple prerequisite", async () => {
  for (const lose of [false, true]) { const f = await workerFixture("email", lose); try {
    const first = await f.worker()(A); assert.equal(first.state, lose ? "deletion_pending" : "deleted"); assert.equal(f.deletes, 1); assert.equal(f.apple, 0);
    assert.equal((await f.worker()(A)).state, "deleted"); assert.equal((await f.worker()(A)).state, "deleted"); assert.equal(f.deletes, 1);
    assert.equal((await f.db.query<{ state: string }>("select state from public.wd_accounts where user_id=$1", [A])).rows[0].state, "deleted"); assert.equal((await f.db.query("select * from auth.users where id=$1", [B])).rows.length, 1);
  } finally { await f.db.close(); } }
  const f = await workerFixture("apple"); try { assert.equal((await f.worker()(A)).state, "deletion_pending"); assert.equal(f.apple, 1); assert.equal(f.deletes, 0); assert.equal((await f.worker()(A)).state, "deletion_pending"); assert.equal(f.deletes, 0); } finally { await f.db.close(); }
  const unknown = await workerFixture("unsupported"); try { assert.equal((await unknown.worker()(A)).state, "deletion_pending"); assert.equal(unknown.apple, 0); assert.equal(unknown.deletes, 0); } finally { await unknown.db.close(); }
});
