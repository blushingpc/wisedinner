import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { accountHandler, AccountError, type AccountRepository, type VerifiedAccount } from "./account.ts";
import { billingAccessHandler, supabaseBillingRepository } from "./billing.ts";
import { injectedAccountCoordinator } from "../../wisedinner-app/src/account/index.ts";
import { type AuthPort, type StoragePort } from "../../wisedinner-app/src/account/session.ts";

// Node-only contract test. No backend/SQL code is imported into the native product.
test("dry app billing client -> actual access handler -> unchanged 0006/0007 memory SQL, ownership/expiry/held/tombstone", async () => {
  const db = await PGlite.create("memory://");
  const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
  const K = "20000000-0000-4000-8000-000000000001";
  let owner = A, signedIn = false, currentId = "", n = 0, now = 2000000000000, period = "normal", sandbox = false, refund = false, outage = false;
  let providerCalls = 0; const expiry = now + 10000, ids: string[] = [], listeners = new Set<(ignored: unknown) => void>();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$;
      create function auth.uid() returns uuid language sql stable as $$ select (auth.jwt()->>'sub')::uuid $$;
      create function auth.role() returns text language sql stable as $$ select auth.jwt()->>'role' $$;`);
    for (const migration of ["0006_wd_accounts.sql", "0007_wd_billing.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
    const command = async (role: "authenticated" | "service_role", id: string, sql: string, params: unknown[]) => db.transaction(async tx => {
      await tx.query("select set_config('request.jwt.claims',$1,true)", [JSON.stringify({ role, sub: id, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) }] })]);
      await tx.exec(`set local role ${role}`);
      const result = (await tx.query<{ result: Record<string, unknown> }>(sql, params)).rows[0]!.result;
      if (result.error) throw new AccountError(result.error === "account_inactive" ? 410 : result.error === "account_missing" ? 404 : 503, "dry_command_denied");
      return result;
    });
    const repository: AccountRepository = { execute: (u, c) => command("authenticated", u.id, "select public.wd_account_command($1,$2::jsonb,$3::uuid) as result", [c.action, JSON.stringify(c.body), c.key]) };
    const billing = supabaseBillingRepository("https://sql.invalid", "synthetic-server-only", async (_url, init) => {
      const p = JSON.parse(init!.body as string) as { p_action: string; p_body: Record<string, unknown> };
      try { return Response.json(await command("service_role", String(p.p_body.userId ?? A), "select public.wd_billing_command($1,$2::jsonb) as result", [p.p_action, JSON.stringify(p.p_body)])); }
      catch (error) { return Response.json({ error: error instanceof AccountError && error.status === 410 ? "account_inactive" : "billing_unavailable" }); }
    });
    const verify = async (request: Request): Promise<VerifiedAccount> => {
      const token = request.headers.get("authorization")?.slice(7);
      const id = token === "e30.QQ.c2ln" ? A : token === "e30.Qg.c2ln" ? B : null;
      if (!id) throw new AccountError(401, "invalid_session");
      return { id, token: token!, authenticatedAt: Math.floor(Date.now() / 1000), providers: [] };
    };
    const active = async (u: VerifiedAccount) => { await repository.execute(u, { action: "read", body: {}, key: null }); };
    const account = accountHandler({ verify, repository });
    const handler = billingAccessHandler({ verify, assertActive: active, repository: billing, config: { environment: "PRODUCTION", entitlement: "dry_entitlement", products: ["dry_monthly", "dry_annual"] }, now: () => now,
      provider: { async fetch(id) {
        providerCalls++; if (outage) throw Error("synthetic_private_provider_detail");
        const iso = (v: number) => new Date(v).toISOString();
        return { request_date_ms: now, subscriber: { original_app_user_id: id,
          entitlements: { dry_entitlement: { product_identifier: "dry_monthly", expires_date: iso(expiry), grace_period_expires_date: null } },
          subscriptions: { dry_monthly: { store: "app_store", is_sandbox: sandbox, ownership_type: "PURCHASED", period_type: period, purchase_date: iso(now - 86400000), expires_date: iso(expiry), grace_period_expires_date: null, refunded_at: refund ? iso(now - 1) : null, unsubscribe_detected_at: iso(now - 1), billing_issues_detected_at: null, store_transaction_id: `dry_${id}` } } } };
      } } });
    const transport: typeof fetch = async (url, init) => {
      assert.equal(init!.cache, "no-store"); assert.equal(init!.redirect, "error");
      const request = new Request(String(url), init);
      const path = new URL(String(url)).pathname;
      if (path.startsWith("/api/v1/account")) return account(request);
      if (path === "/api/v1/access") { if (init!.method === "POST") { assert.equal(init!.body, "{}"); assert.equal(new Headers(init!.headers).get("idempotency-key"), null); } return handler(request); }
      // Identity route's exact flat contract, same active check and real service-only binding RPC.
      const u = await verify(request); await active(u);
      return Response.json({ apiVersion: 1, ...await billing.bind(u.id) }, { headers: { "Cache-Control": "no-store" } });
    };
    const storage: StoragePort = { getItem: async () => null, setItem: async () => {}, removeItem: async () => {} };
    const auth: AuthPort = { getSession: async () => ({ data: { session: signedIn ? { access_token: `e30.${owner === A ? "QQ" : "Qg"}.c2ln` } : null }, error: null }), getUser: async () => ({ data: { user: { id: owner, is_anonymous: false } }, error: null }), refreshSession: async () => ({ data: { session: null }, error: null }), signOut: async () => { signedIn = false; return { error: null }; }, onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) };
    const c = injectedAccountCoordinator({ auth, protectedStorage: storage, privateStorage: storage, fetch: transport, uuid: () => `30000000-0000-4000-8000-${String(++n).padStart(12, "0")}`, apiOrigin: "https://dry.invalid", billing: { now: () => now, identity: {
      configure(id) { ids.push(id); currentId = id; }, async logIn(id) { ids.push(id); currentId = id; }, async getAppUserID() { return currentId; }, addCustomerInfoUpdateListener(cb) { listeners.add(cb); }, removeCustomerInfoUpdateListener(cb) { return listeners.delete(cb); },
    } } });
    const client = c.billing!;
    await c.session.start(); signedIn = true; await c.acceptVerifiedSession();
    await assert.rejects(client.connect()); assert.equal(ids.length, 0);
    await c.client.initialize(K); await client.connect(); const boundA = ids[0]!;
    assert.notEqual(boundA, `wd_${A}`); assert.match(boundA, /^wd_[0-9a-f-]{36}$/);
    assert.equal((await client.reconcile("POST")).state, "active");
    period = "trial"; now++; assert.equal((await client.reconcile()).state, "trial");
    outage = true; now++; const cached = await client.reconcile(); assert.equal(cached.allowed, true); assert.equal(cached.stale, true); assert.equal(cached.expiresAt, expiry);
    now = expiry; assert.equal(client.view(), null); assert.equal((await client.reconcile()).allowed, false);
    owner = B; signedIn = true; await c.acceptVerifiedSession(); await c.client.initialize(K); await client.connect(); const boundB = ids.at(-1)!; assert.notEqual(boundB, boundA);
    assert.equal((await client.reconcile()).state, "unknown", "outage with no B cache cannot inherit A");
    outage = false; sandbox = true; now = expiry + 1; assert.equal((await client.reconcile()).state, "unknown");
    sandbox = false; refund = true; now++; assert.equal((await client.reconcile()).state, "revoked");
    await db.query("update public.wd_billing_bindings set held=true where user_id=$1", [B]); now++;
    const before = providerCalls; assert.equal((await client.reconcile()).allowed, false); assert.equal(providerCalls, before);
    await assert.rejects(client.connect(), /identity_held/);
    await repository.execute(await verify(new Request("https://dry.invalid", { headers: { Authorization: "Bearer e30.Qg.c2ln" } })), { action: "begin_deletion", body: { confirmation: "DELETE MY ACCOUNT" }, key: B });
    await assert.rejects(client.connect()); assert.throws(() => c.client.initialize(K), /closed/); assert.equal(client.view(), null);
    assert.equal((await repository.execute(await verify(new Request("https://dry.invalid", { headers: { Authorization: "Bearer e30.QQ.c2ln" } })), { action: "read", body: {}, key: null }) as { revision: number }).revision, 1);
    c.session.dispose(); client.dispose(); assert.equal(listeners.size, 0);
  } finally { await db.close(); }
});
