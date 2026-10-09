import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { accountHandler, AccountError, supabaseVerifier, type AccountRepository } from "./account.ts";
import { accountDeletionWorker, type DeletionRepository } from "./account-deletion.ts";
import { injectedAccountCoordinator } from "../../wisedinner-app/src/account/index.ts";
import { parseDeletionStatus } from "../../wisedinner-app/src/account/deletion.ts";
import { type AuthPort, type StoragePort } from "../../wisedinner-app/src/account/session.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002", K = "20000000-0000-4000-8000-000000000001", D = "30000000-0000-4000-8000-000000000001";
const H = "a".repeat(64), E = "b".repeat(64);
// Node-only test. Exact disposable target; no env, credentials, sockets or hosted PostgREST.
test("dry deletion client -> actual Auth verifier/account handler/0006 SQL; AMR, stable receipt, tombstone/B, actual 0013 coarse status", async () => {
  const target = "memory://"; assert.equal(target, "memory://"); const db = await PGlite.create(target);
  let owner = A, live = false, age: number | null = 0, refreshes = 0, n = 0, deletes = 0, providerEffects = 0;
  const now = () => Date.now();
  const claims = (id: string, authenticationAge: number | null) => ({ sub: id, role: "authenticated", aud: "authenticated", iss: "https://auth.invalid/auth/v1", exp: Math.floor(now() / 1000) + 3600, iat: Math.floor(now() / 1000), is_anonymous: false, amr: authenticationAge === null ? [] : [{ method: "oauth", timestamp: Math.floor(now() / 1000) - authenticationAge }] });
  const jwt = (id = owner, authenticationAge = age) => `e30.${Buffer.from(JSON.stringify(claims(id, authenticationAge))).toString("base64url")}.synthetic`;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth;
      grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt() returns jsonb language sql stable as $$ select current_setting('request.jwt.claims',true)::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;`);
    for (const file of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0009_wd_notifications.sql", "0013_wd_account_deletion.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
    // Fake Auth server explicitly accepts synthetic claims; actual verifier still checks user/issuer/AMR.
    const verify = supabaseVerifier("https://auth.invalid", "synthetic-public", async (_url, init) => {
      const token = new Headers(init!.headers).get("authorization")!.slice(7);
      const c = JSON.parse(Buffer.from(token.split(".")[1]!, "base64url").toString());
      return Response.json({ id: c.sub, is_anonymous: false, email_confirmed_at: new Date(now() - 60000).toISOString(), identities: [] });
    }, now);
    const repository: AccountRepository = { async execute(u, command) {
      return db.transaction(async tx => {
        const verifiedClaims = JSON.parse(Buffer.from(u.token.split(".")[1]!, "base64url").toString());
        await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify(verifiedClaims)]); await tx.exec("set local role authenticated");
        const r = (await tx.query<{ r: Record<string, unknown> }>("select public.wd_account_command($1,$2::jsonb,$3::uuid) r", [command.action, JSON.stringify(command.body), command.key])).rows[0]!.r;
        if (r.error) throw new AccountError(r.error === "account_inactive" ? 410 : r.error === "account_missing" ? 404 : r.error === "idempotency_conflict" ? 409 : 400, String(r.error));
        return r;
      });
    } };
    const handler = accountHandler({ verify, repository, now });
    const remote = (method: string, id: string, key = K, path = "", body?: unknown, authAge: number | null = 0) => handler(new Request(`https://dry.invalid/api/v1/account${path}`, { method, headers: { Authorization: `Bearer ${jwt(id, authAge)}`, "Content-Type": "application/json", "Idempotency-Key": key }, body: body === undefined ? undefined : JSON.stringify(body) }));
    for (const id of [A, B]) assert.equal((await remote("POST", id, K, "", {})).status, 200);
    const secure = new Map<string, string>(), privateData = new Map<string, string>([["wd.answers", "legacy"], ["wd.week", "legacy"], ["wd.checks", "legacy"]]);
    const storage = (map: Map<string, string>): StoragePort => ({ getItem: async k => map.get(k) ?? null, setItem: async (k, v) => { map.set(k, v); }, removeItem: async k => { map.delete(k); } });
    const auth: AuthPort = { getSession: async () => ({ data: { session: live ? { access_token: jwt() } : null }, error: null }), getUser: async token => { const u = await verify(new Request("https://dry.invalid", { headers: { Authorization: `Bearer ${token}` } })); return { data: { user: { id: u.id, is_anonymous: false } }, error: null }; }, refreshSession: async () => { refreshes++; return { data: { session: { access_token: jwt() } }, error: null }; }, signOut: async () => { live = false; return { error: null }; }, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) };
    const transport: typeof fetch = async (url, options) => {
      assert.equal(options!.cache, "no-store"); assert.equal(options!.redirect, "error");
      if (options!.method === "DELETE") { deletes++; assert.equal(options!.body, '{"confirmation":"DELETE MY ACCOUNT"}'); assert.equal(new Headers(options!.headers).get("idempotency-key"), D); }
      return handler(new Request(String(url), options));
    };
    const c = injectedAccountCoordinator({ auth, protectedStorage: storage(secure), privateStorage: storage(privateData), fetch: transport, uuid: () => `40000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, apiOrigin: "https://dry.invalid", deletion: {} });
    await c.session.start(); live = true; await c.acceptVerifiedSession();
    assert.equal((await c.deletion!.status()).observed?.state, "active");
    for (const stale of [null, 301]) {
      age = stale; live = true; await c.acceptVerifiedSession(); const before = deletes;
      assert.equal((await c.deletion!.requestIntent({ confirmation: "DELETE MY ACCOUNT", key: D })).reason, "recent_auth_required");
      assert.equal(deletes - before, 1); assert.equal(refreshes, 0);
      assert.equal((await db.query<{ state: string }>("select state from public.wd_accounts where user_id=$1", [A])).rows[0]!.state, "active", "current iat without recent AMR cannot deactivate");
    }
    age = 0; live = true; const a = await c.acceptVerifiedSession(); await c.cache.save(a, { account: await c.client.read() });
    const result = await c.deletion!.requestIntent({ confirmation: "DELETE MY ACCOUNT", key: D });
    assert.deepEqual(result, { outcome: "accepted", observed: { state: "deletion_pending", subscriptionCancelled: false }, cleanup: "complete" });
    assert.equal(secure.get(`wd.account.deleted.${A}`), "inactive"); assert.throws(() => c.client.initialize(K)); assert.equal((await c.deletion!.status()).outcome, "unavailable");
    assert.deepEqual([...privateData.keys()].sort(), ["wd.answers", "wd.checks", "wd.week"]); assert([...privateData.values()].every(v => v === "legacy"));
    assert.equal((await remote("POST", A, B, "", {})).status, 410); assert.equal((await remote("GET", A)).status, 410);
    const repeat = await remote("DELETE", A, D, "", { confirmation: "DELETE MY ACCOUNT" }); assert.equal(repeat.status, 200); assert.deepEqual((await repeat.json()).result, result.observed);
    assert.equal((await db.query("select * from public.wd_account_receipts where user_id=$1", [A])).rows.length, 1);
    const pendingResponse = await remote("GET", A, K, "/deletion"); const pendingStatus = parseDeletionStatus(await pendingResponse.json()); assert.equal(pendingStatus.dependencies!.appleRevocation, "needs_provider_check");
    const progress: DeletionRepository = { command: async (action, body) => db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: "service_role" })]); await tx.exec("set local role service_role");
      return (await tx.query<{ r: Awaited<ReturnType<DeletionRepository["command"]>> }>("select public.wd_deletion_command($1,$2::jsonb)r", [action, JSON.stringify(body)])).rows[0]!.r;
    }) };
    const worker = accountDeletionWorker(progress, { verifyIdentity: async userId => ({ userId, identityHash: H, evidenceHash: E, apple: "none" }), apple: { run: async () => { throw Error("must_not_revoke"); } }, auth: { run: async target => { providerEffects++; return { ...target, outcome: "confirmed", evidenceHash: E }; } } });
    assert.equal((await worker(A)).state, "deleted"); assert.equal(providerEffects, 1);
    // Fake Auth remains available only to exercise SQL's public status contract; this is NOT post-Auth-delete polling proof.
    const deletedStatus = parseDeletionStatus(await (await remote("GET", A, K, "/deletion")).json());
    assert.deepEqual(deletedStatus, { state: "deleted", dependencies: { authDeletion: "complete", sessionInvalidation: "complete", appleRevocation: "not_required", subscriptionCancellation: "not_performed" } });
    assert(!JSON.stringify(deletedStatus).includes(H)); assert(!JSON.stringify(deletedStatus).includes("operation"));
    await c.session.start(); live = true; await assert.rejects(c.acceptVerifiedSession(), /inactive/);
    owner = B; live = true; await c.acceptVerifiedSession(); assert.equal((await c.deletion!.status()).observed?.state, "active"); assert.equal((await c.client.read()).revision, 1);
    const deniedBilling = await db.transaction(async tx => { await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role: "service_role" })]); await tx.exec("set local role service_role"); return (await tx.query<{ r: { error: string } }>("select public.wd_billing_command('bind',$1::jsonb)r", [JSON.stringify({ userId: A })])).rows[0]!.r; });
    assert.equal(deniedBilling.error, "account_inactive"); c.deletion!.dispose(); c.session.dispose();
  } finally { await db.close(); }
});
