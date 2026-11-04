import test from "node:test";
import assert from "node:assert/strict";
import { AccountError, type VerifiedAccount } from "./account.ts";
import { createCurrentSubscriptionRuntime, type CurrentSubscriptionRuntimeDeps } from "./current-subscription-runtime.server.ts";
import type { AccessState, BillingEvent, BillingRepository } from "./billing.ts";
import type { RestoreRepository } from "./billing-restore.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const IA = "wd_20000000-0000-4000-8000-000000000001", IB = "wd_20000000-0000-4000-8000-000000000002";
const OP = "30000000-0000-4000-8000-000000000001";
const WEEK = "com.wisedinner.app.protein.weekly", YEAR = "com.wisedinner.app.protein.yearly";
const NOW = 2000000000000, APP = "app8fbde20e05", AUTH = "synthetic-header-".repeat(4);
const iso = (n: number) => new Date(n).toISOString();
function customer(id = IA, subscription = {}, entitlement = {}) {
  return { request_date_ms: NOW, subscriber: { original_app_user_id: id,
    entitlements: { wisedinner_pro: { product_identifier: WEEK, expires_date: iso(NOW + 10000), ...entitlement } },
    subscriptions: { [WEEK]: { store: "app_store", is_sandbox: true, ownership_type: "PURCHASED", period_type: "normal", purchase_date: iso(NOW - 10000), expires_date: iso(NOW + 10000), store_transaction_id: "private-transaction-sentinel", ...subscription } } } };
}
function request(method = "GET", body?: unknown, owner = A, query = "") {
  return new Request(`https://fixture.invalid/private${query}`, { method, headers: { authorization: owner, ...(body !== undefined ? { "content-type": "application/json" } : {}) }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
}
function fixture() {
  const calls: string[] = [], events = new Map<string, BillingEvent>(), cache = new Map<string, AccessState>(), generations = new Map<string, number>();
  const held = new Set<string>(); let raw: unknown = customer(), outage = false;
  const ids = (id: string) => id === A ? IA : IB;
  const repo: BillingRepository = {
    async bind(id) { calls.push(`bind:${id}`); return { appUserId: ids(id), held: held.has(id) }; },
    async begin(id, env) { calls.push(`begin:${id}:${env}`); const gen = (generations.get(id) ?? 0) + 1; generations.set(id, gen); return { generation: gen, binding: { appUserId: ids(id), held: held.has(id) }, cached: cache.get(id) ?? null }; },
    async commit(id, env, gen, state) { calls.push(`commit:${id}:${env}`); if (gen === generations.get(id) && state.observedAt >= (cache.get(id)?.observedAt ?? 0)) cache.set(id, state); return cache.get(id)!; },
    async enqueue(e) { calls.push("enqueue"); const old = events.get(e.id); if (old && old.fingerprint !== e.fingerprint) throw new AccountError(409, "idempotency_conflict"); events.set(e.id, e); if (e.identityHold) for (const id of [A, B]) if (e.appUserIds.includes(ids(id))) held.add(id); },
  };
  const deps: CurrentSubscriptionRuntimeDeps = { enabled: true, configurationAdmitted: true, environment: "SANDBOX", appId: APP, entitlement: "wisedinner_pro", products: [WEEK, YEAR],
    verify: async r => { calls.push("verify"); const id = r.headers.get("authorization"); if (id !== A && id !== B) throw new AccountError(401, "invalid_session"); return { id, token: "private-session-sentinel", providers: ["email"], authenticatedAt: 1 }; },
    assertActive: async a => { calls.push(`active:${a.id}`); }, repository: repo, provider: { async fetch(id) { calls.push(`fetch:${id}`); if (outage) throw Error("private-provider-sentinel"); return raw; } }, now: () => NOW, webhook: { authorization: AUTH, mode: "authorization-header" } };
  return { deps, calls, repo, events, cache, held, setRaw(v: unknown) { raw = v; }, setOutage() { outage = true; } };
}

test("construction is dormant; config is copied, malformed/default-off dependencies cannot call ports", async () => {
  for (const patch of [{ enabled: false }, { configurationAdmitted: false }, { environment: "other" }, { entitlement: "other" }, { products: [WEEK, "old-monthly"] }, { products: [WEEK, YEAR, WEEK] }, { appId: "" }]) {
    const f = fixture(); const r = createCurrentSubscriptionRuntime({ ...f.deps, ...patch } as CurrentSubscriptionRuntimeDeps);
    assert.deepEqual(f.calls, []);
    for (const handle of [r.identity, r.access, r.webhook]) { const response = await handle(request()); assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store"); }
    assert.equal((await r.reconcileRestore(request(), OP)).status, "held");
    await assert.rejects(r.processInbox(), /billing_not_configured/); assert.deepEqual(f.calls, []);
  }
  let getters = 0; const f = fixture(), evil = { ...f.deps };
  Object.defineProperty(evil, "environment", { get() { getters++; throw Error("must not read getter"); } });
  assert.equal((await createCurrentSubscriptionRuntime(evil).identity(request())).status, 503); assert.equal(getters, 0);
  const accessorProducts = [WEEK, YEAR]; Object.defineProperty(accessorProducts, "0", { get() { getters++; throw Error("product getter must not execute"); } });
  assert.equal((await createCurrentSubscriptionRuntime({ ...f.deps, products: accessorProducts }).access(request())).status, 503); assert.equal(getters, 0);
  const products = [WEEK, YEAR]; const r = createCurrentSubscriptionRuntime({ ...f.deps, products }); products[0] = "old-monthly";
  assert.equal((await r.access(request())).status, 200);
});

test("identity uses the exact server binding, validates method/query and never returns private fields", async () => {
  const f = fixture(), r = createCurrentSubscriptionRuntime(f.deps);
  assert.equal((await r.identity(request("POST", {}))).status, 405); assert.equal((await r.identity(request("GET", undefined, A, "?owner=other"))).status, 400);
  assert.equal(f.calls.length, 0);
  const [a, b] = await Promise.all([r.identity(request()), r.identity(request("GET", undefined, B))]);
  assert.deepEqual(await a.json(), { apiVersion: 1, appUserId: IA, held: false }); assert.deepEqual(await b.json(), { apiVersion: 1, appUserId: IB, held: false }); assert.notEqual(IA, `wd_${A}`);
  const inactive = createCurrentSubscriptionRuntime({ ...f.deps, assertActive: async () => { throw new AccountError(410, "account_inactive"); } });
  const before = f.calls.filter(x => x.startsWith("bind")).length; assert.equal((await inactive.identity(request())).status, 410); assert.equal(f.calls.filter(x => x.startsWith("bind")).length, before);
});

test("real access adapter consumes empty body once and rejects client success/owner claims", async () => {
  const f = fixture(), r = createCurrentSubscriptionRuntime(f.deps);
  for (const body of [{ owner: B }, { success: true }, { tier: "paid" }, { appUserId: IB }, { localTrialStartedAt: NOW }]) assert.equal((await r.access(request("POST", body))).status, 400);
  assert.equal(f.calls.some(x => x.startsWith("fetch")), false);
  const response = await r.access(request("POST", {})), raw = await response.text(), access = JSON.parse(raw);
  assert.equal(access.allowed, true); assert.equal(access.state, "active"); assert.equal(access.appUserId, IA); assert.equal(access.rerollsIncluded, true);
  for (const secret of ["transactionHash", "private-session", "private-transaction"]) assert.equal(raw.includes(secret), false);
});

for (const [name, subscription, entitlement, expected] of [
  ["trial", { period_type: "trial" }, {}, "trial"], ["expired", { expires_date: iso(NOW - 1) }, {}, "expired"],
  ["refunded", { refunded_at: iso(NOW - 1) }, {}, "revoked"], ["production mismatch", { is_sandbox: false }, {}, "unknown"],
  ["store", { store: "play_store" }, {}, "unknown"], ["family ownership", { ownership_type: "FAMILY_SHARED" }, {}, "unknown"],
  ["product", {}, { product_identifier: "old-monthly" }, "unknown"], ["null expiry", { expires_date: null }, {}, "unknown"],
] as const) test(`current access wrapper preserves ${name} semantics`, async () => {
  const f = fixture(); f.setRaw(customer(IA, subscription, entitlement)); const r = createCurrentSubscriptionRuntime(f.deps), body = await (await r.access(request())).json();
  assert.equal(body.state, expected); assert.equal(body.allowed, expected === "trial");
});

test("wrong owner/entitlement/no provider evidence never grants; outage uses existing bounded cache only", async () => {
  const f = fixture(), r = createCurrentSubscriptionRuntime(f.deps); f.setRaw(customer(IB)); assert.equal((await (await r.access(request())).json()).allowed, false);
  f.setRaw({ request_date_ms: NOW, subscriber: { original_app_user_id: IA, entitlements: {}, subscriptions: {}, success: true } }); assert.equal((await (await r.access(request())).json()).state, "inactive");
  f.setOutage(); assert.equal((await (await r.access(request())).json()).allowed, false);
  f.cache.set(A, { state: "active", expiresAt: NOW + 1, observedAt: NOW, reason: "provider_verified", transactionHash: "secret-hash" });
  const cached = await (await r.access(request())).json(); assert.equal(cached.allowed, true); assert.equal(cached.stale, true); assert.equal(cached.transactionHash, undefined);
  f.cache.set(A, { state: "trial", expiresAt: NOW, observedAt: NOW - 1, reason: "provider_verified" }); assert.equal((await (await r.access(request())).json()).allowed, false);
  assert.equal((await (await r.access(request("GET", undefined, B))).json()).allowed, false);
});

test("bind/begin mismatch and held identity cannot fetch or grant; provider errors are safe", async () => {
  const f = fixture(), mismatch: BillingRepository = { ...f.repo, begin: async () => ({ generation: 1, binding: { appUserId: IB, held: false }, cached: null }) };
  const r = createCurrentSubscriptionRuntime({ ...f.deps, repository: mismatch }); assert.equal((await r.access(request())).status, 503); assert.equal(f.calls.some(x => x.startsWith("fetch")), false);
  f.held.add(A); const h = createCurrentSubscriptionRuntime(f.deps); assert.equal((await (await h.identity(request())).json()).held, true); assert.equal((await (await h.access(request())).json()).allowed, false);
  const broken = createCurrentSubscriptionRuntime({ ...f.deps, verify: async () => { throw Error("private-secret-sentinel"); } }); assert.equal((await (await broken.access(request())).text()).includes("private-secret"), false);
});

function webhook(patch = {}) { return { api_version: "1.0", event: { id: "event_1", type: "RENEWAL", app_id: APP, app_user_id: IA, aliases: [], environment: "SANDBOX", event_timestamp_ms: NOW, ...patch } }; }
function hookRequest(body: unknown, auth = AUTH) { return new Request("https://fixture.invalid/webhook", { method: "POST", headers: { "content-type": "application/json", authorization: auth }, body: JSON.stringify(body) }); }
test("private sandbox webhook authenticates/deduplicates durably and never grants from events", async () => {
  const f = fixture(), r = createCurrentSubscriptionRuntime(f.deps);
  assert.equal((await r.webhook(request())).status, 405); assert.equal((await r.webhook(hookRequest(webhook(), "wrong"))).status, 401);
  for (const patch of [{ environment: "PRODUCTION" }, { app_id: "other_app" }, { type: "TEST" }]) assert.equal((await r.webhook(hookRequest(webhook(patch)))).status, 200);
  assert.equal(f.events.size, 0);
  assert.equal((await r.webhook(hookRequest(webhook()))).status, 200); assert.equal((await r.webhook(hookRequest(webhook()))).status, 200); assert.equal(f.events.size, 1);
  assert.equal((await r.webhook(hookRequest(webhook({ type: "EXPIRATION" })))).status, 409); assert.equal(f.cache.size, 0);
  assert.equal((await r.webhook(hookRequest(webhook({ id: "transfer", type: "TRANSFER", environment: undefined, transferred_from: [IA], transferred_to: [IB] })))).status, 200);
  assert.equal((await (await r.access(request())).json()).allowed, false);
  const failing = createCurrentSubscriptionRuntime({ ...f.deps, repository: { ...f.repo, enqueue: async () => { throw Error("private-db-sentinel"); } } }); const response = await failing.webhook(hookRequest(webhook())); assert.equal(response.status, 503); assert.equal((await response.text()).includes("private-db"), false);
});

test("enqueue ACK waits for durable commit; missing/signature-only config remains off", async () => {
  const f = fixture(); let release: () => void = () => {}, returned = false;
  const r = createCurrentSubscriptionRuntime({ ...f.deps, repository: { ...f.repo, enqueue: async () => new Promise<void>(resolve => { release = resolve; }) } });
  const pending = r.webhook(hookRequest(webhook())).then(x => { returned = true; return x; }); await new Promise(resolve => setImmediate(resolve)); assert.equal(returned, false); release(); assert.equal((await pending).status, 200);
  for (const w of [undefined, { authorization: AUTH, mode: "hmac" }, { authorization: "short", mode: "authorization-header" }]) {
    const bad = createCurrentSubscriptionRuntime({ ...f.deps, webhook: w } as CurrentSubscriptionRuntimeDeps); assert.equal((await bad.webhook(hookRequest(webhook()))).status, 503);
  }
});

test("out-of-order provider observations and bounded inbox keep existing reconciliation semantics", async () => {
  const f = fixture(); let release: (v: unknown) => void = () => {}, n = 0;
  const r = createCurrentSubscriptionRuntime({ ...f.deps, provider: { fetch: async () => ++n === 1 ? new Promise(resolve => { release = resolve; }) : customer(IA, { refunded_at: iso(NOW - 1) }) }, inbox: { claim: async (env, limit) => { assert.equal(env, "SANDBOX"); assert.equal(limit, 1); return [{ id: "old_event", environment: "SANDBOX", accountIds: [A], attempt: 1 }]; }, finish: async (_e, status) => { assert.equal(status, "processed"); } } });
  const slow = r.access(request()); await new Promise(resolve => setImmediate(resolve)); assert.equal((await (await r.access(request())).json()).state, "revoked"); release(customer()); assert.equal((await (await slow).json()).allowed, false);
  await assert.rejects(r.processInbox(6), /invalid_limit/); assert.deepEqual(await r.processInbox(1), { processed: 1, retried: 0, held: 0 });
});

function restoreFixture() {
  const f = fixture(), actions: string[] = [];
  const intent = { operation: OP, targetBinding: IA, environment: "SANDBOX", app: APP, product: WEEK, entitlement: "wisedinner_pro", createdAt: NOW - 10, expiresAt: NOW + 10000, status: "pending", attempt: 0 };
  const proof = { ...intent, sourceBinding: IA, store: "app_store", sourceRoot: "a".repeat(64), targetRoot: "a".repeat(64), sourceTransaction: "b".repeat(64), targetTransaction: "c".repeat(64), originalPurchaseAt: NOW - 10000, observedAt: NOW, ownership: "PURCHASED", sourceRevoked: false, state: "active", refunded: false };
  const { createdAt: _c, status: _s, attempt: _a, ...exactProof } = proof; void _c; void _s; void _a;
  const repository: RestoreRepository = { async execute(action, body) { actions.push(action); assert.equal(body.operation, OP); if (action === "intent" || action === "read") return { ...intent }; if (action === "claim") { intent.status = "leased"; return { status: "leased", attempt: ++intent.attempt }; } if (action === "hold") { intent.status = "held"; return { status: "held", reason: body.reason }; } if (action === "prepare") { intent.status = "prepared"; return { status: "prepared" }; } if (action === "commit") { intent.status = "completed"; return { status: "completed" }; } throw Error("unsupported"); } };
  return { ...f, actions, intent, exactProof, repository };
}
test("restore requires explicit intent, verified owner and exact durable target/scope before any claim/proof", async () => {
  const f = restoreFixture(); let observed = 0; const r = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: f.repository, proof: { observe: async () => { observed++; return f.exactProof; } } } });
  for (const body of [{}, { intent: "restore", owner: B }, { intent: "restore", verified: true }]) assert.equal((await r.requestRestore(request("POST", body), OP, WEEK)).status, "held");
  assert.equal(f.actions.length, 0);
  assert.equal((await r.requestRestore(request("POST", { intent: "restore" }), OP, "old-monthly")).status, "held"); assert.equal(f.actions.length, 0);
  assert.equal((await r.requestRestore(request("POST", { intent: "restore" }), OP, WEEK)).status, "pending");
  for (const patch of [{ targetBinding: IB }, { environment: "PRODUCTION" }, { product: "old-monthly" }, { entitlement: "other" }, { app: "other" }, { operation: B }]) {
    const original = { ...f.intent }; Object.assign(f.intent, patch); assert.equal((await r.reconcileRestore(request(), OP)).status, "held"); Object.assign(f.intent, original);
  }
  assert.equal((await r.reconcileRestore(request("GET", undefined, B), OP)).status, "held"); assert.equal(observed, 0); assert.equal(f.actions.includes("claim"), false);
  assert.equal((await r.reconcileRestore(request(), OP)).status, "completed"); assert.equal(observed, 1);
  const claims = f.actions.filter(x => x === "claim").length; assert.equal((await r.reconcileRestore(request(), OP)).status, "completed"); assert.equal(observed, 1); assert.equal(f.actions.filter(x => x === "claim").length, claims);
});

test("missing restore proof and unknown/foreign original never invent entitlement or replay purchase", async () => {
  const f = restoreFixture(), r = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: f.repository } });
  assert.equal((await r.reconcileRestore(request(), OP)).reason, "proof_unavailable"); assert.equal(f.actions.includes("prepare"), false); assert.equal(f.cache.size, 0);
  const unavailable = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: { execute: async () => { throw Error("private-original-sentinel"); } } } });
  const held = await unavailable.reconcileRestore(request(), OP); assert.equal(held.status, "held"); assert.equal(JSON.stringify(held).includes("private-original"), false);
  const cross = restoreFixture(); cross.exactProof.sourceBinding = IB; const denied = createCurrentSubscriptionRuntime({ ...cross.deps, restore: { repository: cross.repository, proof: { observe: async () => cross.exactProof } } }); assert.equal((await denied.reconcileRestore(request(), OP)).reason, "proof_invalid"); assert.equal(cross.actions.includes("commit"), false);
});

test("lost restore commit ACK reads the same original, no second proof or commit for completed retry", async () => {
  const f = restoreFixture(); let observed = 0, commits = 0;
  const repo: RestoreRepository = { async execute(action, body) { const result = await f.repository.execute(action, body); if (action === "commit") { commits++; throw Error("lost-ACK"); } return result; } };
  const r = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: repo, proof: { observe: async () => { observed++; return f.exactProof; } } } });
  assert.equal((await r.reconcileRestore(request(), OP)).status, "completed"); assert.equal((await r.reconcileRestore(request(), OP)).status, "completed"); assert.equal(observed, 1); assert.equal(commits, 1);
});

test("request-local verified owner object is not mutable across A/B calls", async () => {
  const f = fixture(); const a: VerifiedAccount = { id: A, token: "synthetic", providers: ["email"], authenticatedAt: 1 };
  const r = createCurrentSubscriptionRuntime({ ...f.deps, verify: async () => a, assertActive: async account => { assert.equal(account.id, A); a.id = B; } });
  assert.equal((await (await r.identity(request())).json()).appUserId, IA);
});

test("account deactivation during a provider outage cannot return cached allowed access", async () => {
  const f = fixture(); let inactive = false;
  f.cache.set(A, { state: "active", expiresAt: NOW + 10000, observedAt: NOW, reason: "provider_verified" });
  const r = createCurrentSubscriptionRuntime({ ...f.deps, assertActive: async () => { if (inactive) throw new AccountError(410, "account_inactive"); }, provider: { fetch: async () => { inactive = true; throw Error("outage"); } } });
  const response = await r.access(request()); assert.equal(response.status, 410); assert.equal((await response.json()).allowed, undefined);
});

test("malformed cached public scalars and private error strings are never reflected", async () => {
  const f = fixture(); f.setOutage();
  f.cache.set(A, { state: "inactive", expiresAt: "private-sentinel" as unknown as number, observedAt: NOW, reason: "private-sentinel" });
  const response = await createCurrentSubscriptionRuntime(f.deps).access(request()); assert.equal(response.status, 503); assert.equal((await response.text()).includes("private-sentinel"), false);
  const broken = createCurrentSubscriptionRuntime({ ...f.deps, verify: async () => { throw new AccountError(401, "private-sentinel"); } });
  assert.deepEqual(await (await broken.identity(request())).json(), { error: "billing_unavailable" });
});

test("a restore original substituted during a later read is held before claim or observation", async () => {
  const f = restoreFixture(); let reads = 0, observed = 0;
  const repository: RestoreRepository = { execute: async (action, body) => { const raw = await f.repository.execute(action, body); if (action === "read" && ++reads > 1) return { ...raw, targetBinding: IB }; return raw; } };
  const r = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository, proof: { observe: async () => { observed++; return f.exactProof; } } } });
  assert.equal((await r.reconcileRestore(request(), OP)).status, "held"); assert.equal(f.actions.includes("claim"), false); assert.equal(observed, 0);
});

test("a restore proof timeout/unknown result never prepares or grants; different source requires revocation proof", async () => {
  const f = restoreFixture(), r = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: f.repository, proof: { observe: async () => { throw Error("unknown-provider-result"); } } } });
  assert.equal((await r.reconcileRestore(request(), OP)).reason, "outcome_unknown"); assert.equal(f.actions.includes("prepare"), false); assert.equal(f.cache.size, 0);
  const valid = restoreFixture(); valid.exactProof.sourceBinding = IB; valid.exactProof.sourceRevoked = true;
  const withProof = createCurrentSubscriptionRuntime({ ...valid.deps, restore: { repository: valid.repository, proof: { observe: async () => valid.exactProof } } });
  assert.equal((await withProof.reconcileRestore(request(), OP)).status, "completed", "synthetic proof only: unchanged restore engine accepts full same-root, revoked-source proof; actual SQL generation/lineage remains Main's separate check");
});

test("an existing restore intent for another allowed product cannot acknowledge the requested product", async () => {
  const f = restoreFixture();
  const r = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: f.repository } });
  assert.equal((await r.requestRestore(request("POST", { intent: "restore" }), OP, YEAR)).status, "held");
  const denied = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: { execute: async (action, body) => action === "intent" ? { error: "idempotency_conflict" } : f.repository.execute(action, body) } } });
  assert.equal((await denied.requestRestore(request("POST", { intent: "restore" }), OP, WEEK)).status, "held");
});

test("lost intent ACK reads only the same original; unknown remains held without retrying intent", async () => {
  const f = restoreFixture(); let intents = 0;
  const repo: RestoreRepository = { execute: async (action, body) => { if (action === "intent") { intents++; throw Error("unknown-intent-ACK"); } return f.repository.execute(action, body); } };
  const r = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: repo } });
  assert.equal((await r.requestRestore(request("POST", { intent: "restore" }), OP, WEEK)).status, "pending"); assert.equal(intents, 1);
  const unknown = createCurrentSubscriptionRuntime({ ...f.deps, restore: { repository: { execute: async () => { throw Error("unknown"); } } } });
  assert.equal((await unknown.requestRestore(request("POST", { intent: "restore" }), OP, WEEK)).reason, "outcome_unknown");
});
