import test from "node:test";
import assert from "node:assert/strict";
import { createCurrentOwnerSubscriptionAccess, type CurrentOwnerSubscriptionAccessInput } from "./current-subscription-scope-bridge.server.ts";
import { admitVerifiedReferenceOwner, isIssuedVerifiedOwnerScope, type OwnerAccountState, type OwnerScopeDependencies, type VerifiedOwnerScope } from "./generated-owner-scope.ts";
import type { AccessState, BillingRepository } from "./billing.ts";

const WEEK = "com.wisedinner.app.protein.weekly", YEAR = "com.wisedinner.app.protein.yearly", NOW = 2000000000000;
let sequence = 5000;
const uuid = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
type Owner = Extract<VerifiedOwnerScope, { outcome: "ready" }>;
function ready(scope: VerifiedOwnerScope): Owner { assert.equal(scope.outcome, "ready"); if (scope.outcome !== "ready") throw Error("synthetic scope unavailable"); return scope; }
function fixture() {
  const n = ++sequence, id = uuid(n), other = uuid(n + 10000), billingId = `wd_${uuid(n + 20000)}`;
  const request = new Request("https://fixture.invalid/current", { method: "POST", headers: { authorization: "synthetic-original-context" }, body: "opaque-original-body" });
  const calls: string[] = []; let currentId = id, currentState: OwnerAccountState = { userId: id, state: "active", revision: 1 }, clock = NOW;
  const identity: OwnerScopeDependencies = {
    async verify(r) { assert.equal(r, request, "exact Request identity retained"); assert.equal(r.headers.get("authorization"), "synthetic-original-context"); calls.push("verify"); return { id: currentId, token: "synthetic-original-token", providers: ["email"], authenticatedAt: 1 }; },
    async readAccount(account) { calls.push(`read:${account.id}`); assert.equal(account.token, "synthetic-original-token"); return { ...currentState }; },
  };
  const iso = (n: number) => new Date(n).toISOString();
  let cached: AccessState | null = null, generation = 0, patch: Record<string, unknown> = {};
  let fetchHook: (() => Promise<void>) | undefined;
  const repository: BillingRepository = {
    async bind() { throw Error("bridge must use actual reconcileAccess, not separate bind engine"); },
    async begin(owner, environment) { calls.push(`begin:${owner}:${environment}`); assert.equal(owner, id); return { generation: ++generation, binding: { appUserId: billingId, held: false }, cached }; },
    async commit(owner, environment, gen, state) { calls.push(`commit:${owner}:${environment}`); assert.equal(owner, id); assert.equal(gen, generation); cached = state; return state; },
    async enqueue() { throw Error("no webhook"); },
  };
  const input: CurrentOwnerSubscriptionAccessInput = { enabled: true, identity, repository, config: { environment: "SANDBOX", entitlement: "wisedinner_pro", products: [WEEK, YEAR] }, now: () => clock,
    provider: { async fetch(bound) { calls.push(`fetch:${bound}`); assert.equal(bound, billingId); if (fetchHook) await fetchHook(); return { request_date_ms: NOW, subscriber: { original_app_user_id: billingId,
      entitlements: { wisedinner_pro: { product_identifier: WEEK, expires_date: iso(NOW + 10000) } }, subscriptions: { [WEEK]: { store: "app_store", is_sandbox: true, ownership_type: "PURCHASED", period_type: "normal", purchase_date: iso(NOW - 10000), expires_date: iso(NOW + 10000), store_transaction_id: "synthetic-private-transaction", ...patch } } } }; } } };
  return { id, other, request, calls, input, identity,
    issue: async () => ready(await admitVerifiedReferenceOwner(request, identity)),
    setOwner: (owner: string) => { currentId = owner; }, setState: (state: OwnerAccountState) => { currentState = state; }, setClock: (n: number) => { clock = n; },
    patch: (p: Record<string, unknown>) => { patch = p; }, fetchHook: (f: () => Promise<void>) => { fetchHook = f; }, setCached: (s: AccessState) => { cached = s; } };
}

test("real issued owner + actual reconcileAccess grants current active/trial; constructor has no I/O and body untouched", async () => {
  for (const state of ["active", "trial"] as const) {
    const f = fixture(), owner = await f.issue(); assert.equal(isIssuedVerifiedOwnerScope(owner), true); f.calls.length = 0;
    if (state === "trial") f.patch({ period_type: "trial" });
    const access = createCurrentOwnerSubscriptionAccess(f.request, f.input); assert.equal(f.calls.length, 0);
    const result = await access(owner); assert.equal(result.allowed, true); assert.equal(result.state, state); assert.equal(result.rerollsIncluded, true); assert.equal(result.stale, false); assert.equal(result.reason, "provider_verified");
    assert.equal(f.calls.filter(x => x === "verify").length, 2); assert.equal(f.calls.filter(x => x.startsWith("fetch:")).length, 1);
    assert.deepEqual(Object.keys(result).sort(), ["state", "expiresAt", "observedAt", "reason", "allowed", "rerollsIncluded", "stale"].sort());
    assert.equal(JSON.stringify(result).includes("private-transaction"), false); assert.equal("appUserId" in result, false); assert.equal(f.request.bodyUsed, false); assert.equal(await f.request.text(), "opaque-original-body");
  }
});
test("disabled, malformed and accessor host inputs make no external calls", async () => {
  const f = fixture(), owner = await f.issue(); f.calls.length = 0;
  const variants: unknown[] = [null, {}, { ...f.input, enabled: false }, { ...f.input, config: { ...f.input.config, environment: "unknown" } }, { ...f.input, config: { ...f.input.config, entitlement: "other" } }, { ...f.input, config: { ...f.input.config, products: [WEEK, "old-monthly"] } }, { ...f.input, config: { ...f.input.config, products: [WEEK, YEAR, WEEK] } }, { ...f.input, identity: {} }, { ...f.input, provider: {} }];
  let getters = 0; const evil = { ...f.input }; Object.defineProperty(evil, "enabled", { get() { getters++; return true; } }); variants.push(evil);
  const identity = { ...f.identity }; Object.defineProperty(identity, "verify", { get() { getters++; throw Error("private"); } }); variants.push({ ...f.input, identity });
  const products = [WEEK, YEAR]; Object.defineProperty(products, "0", { get() { getters++; return WEEK; } }); variants.push({ ...f.input, config: { ...f.input.config, products } });
  const config = { ...f.input.config }; Object.defineProperty(config, "environment", { get() { getters++; return "SANDBOX"; } }); variants.push({ ...f.input, config });
  const repository = { ...f.input.repository }; Object.defineProperty(repository, "begin", { get() { getters++; throw Error("private"); } }); variants.push({ ...f.input, repository });
  const provider = { ...f.input.provider }; Object.defineProperty(provider, "fetch", { get() { getters++; throw Error("private"); } }); variants.push({ ...f.input, provider }); variants.push({ ...f.input, now: "private-malformed-clock" });
  for (const input of variants) { const port = createCurrentOwnerSubscriptionAccess(f.request, input as CurrentOwnerSubscriptionAccessInput); assert.equal((await port(owner)).allowed, false); }
  assert.equal(getters, 0); assert.equal(f.calls.length, 0);
});
test("only issuer-branded original scopes are accepted; clones, forged keys and denied scopes cause zero I/O", async () => {
  const f = fixture(), owner = await f.issue(); f.calls.length = 0; const access = createCurrentOwnerSubscriptionAccess(f.request, f.input);
  const variants = [{ ...owner }, JSON.parse(JSON.stringify(owner)), { ...owner, storageKey: "forged" }, { ...owner, ownerId: f.other }, { ...owner, accountRevision: 2 }, { outcome: "denied", code: "owner_inactive" }, null];
  for (const value of variants) assert.equal((await access(value as Owner)).allowed, false);
  assert.equal(f.calls.length, 0);
});
test("current request Auth mismatch and account owner/revision/inactive states deny before provider", async () => {
  for (const change of ["auth", "account", "revision", "pending", "deleted"] as const) {
    const f = fixture(), owner = await f.issue(); f.calls.length = 0;
    if (change === "auth") f.setOwner(f.other);
    else f.setState({ userId: change === "account" ? f.other : f.id, state: change === "pending" ? "deletion_pending" : change === "deleted" ? "deleted" : "active", revision: change === "revision" ? 2 : 1 });
    assert.equal((await createCurrentOwnerSubscriptionAccess(f.request, f.input)(owner)).allowed, false); assert.equal(f.calls.some(x => x.startsWith("begin:") || x.startsWith("fetch:")), false);
  }
});
test("mid-provider Auth/owner/revision/deletion change is reverified and cannot return allowed", async () => {
  for (const change of ["auth", "account", "revision", "pending", "deleted"] as const) {
    const f = fixture(), owner = await f.issue(); f.calls.length = 0;
    f.fetchHook(async () => { if (change === "auth") f.setOwner(f.other); else f.setState({ userId: change === "account" ? f.other : f.id, state: change === "pending" ? "deletion_pending" : change === "deleted" ? "deleted" : "active", revision: change === "revision" ? 2 : 1 }); });
    const result = await createCurrentOwnerSubscriptionAccess(f.request, f.input)(owner); assert.equal(result.allowed, false); assert.equal(f.calls.filter(x => x.startsWith("fetch:")).length, 1); assert.equal(JSON.stringify(result).includes("token"), false);
  }
});
test("a genuine other-owner scope/storage key is not authorized by this request, even through a reused port", async () => {
  const a = fixture(), b = fixture(), oa = await a.issue(), ob = await b.issue(); assert.notEqual(oa.storageKey, ob.storageKey); a.calls.length = 0;
  const access = createCurrentOwnerSubscriptionAccess(a.request, a.input); assert.equal((await access(ob)).allowed, false); assert.equal(a.calls.some(x => x.startsWith("fetch:")), false); assert.equal((await access(oa)).allowed, true);
});
test("simultaneous requests/owners keep exact independent verifier context and grant state", async () => {
  const a = fixture(), b = fixture(), oa = await a.issue(), ob = await b.issue(); let release: () => void = () => {};
  a.fetchHook(() => new Promise<void>(resolve => { release = resolve; })); b.patch({ refunded_at: new Date(NOW - 1).toISOString() });
  const ap = createCurrentOwnerSubscriptionAccess(a.request, a.input)(oa); await new Promise(resolve => setImmediate(resolve)); const br = await createCurrentOwnerSubscriptionAccess(b.request, b.input)(ob); assert.equal(br.allowed, false); release(); assert.equal((await ap).allowed, true);
});
test("invalid clock, clock regression and expiry during provider wait cannot grant", async () => {
  for (const n of [NaN, Infinity, -1, 1.5]) { const f = fixture(), owner = await f.issue(); f.calls.length = 0; f.setClock(n); assert.equal((await createCurrentOwnerSubscriptionAccess(f.request, f.input)(owner)).allowed, false); assert.equal(f.calls.length, 0); }
  for (const n of [NOW - 1, NOW + 10000]) { const f = fixture(), owner = await f.issue(); f.fetchHook(async () => { f.setClock(n); }); assert.equal((await createCurrentOwnerSubscriptionAccess(f.request, f.input)(owner)).allowed, false); }
});
test("real provider expiry/refund/environment/ownership/unknown observations cannot grant", async () => {
  for (const patch of [{ expires_date: new Date(NOW - 1).toISOString() }, { refunded_at: new Date(NOW - 1).toISOString() }, { is_sandbox: false }, { ownership_type: "FAMILY_SHARED" }, { store_transaction_id: null }]) { const f = fixture(), owner = await f.issue(); f.patch(patch); const r = await createCurrentOwnerSubscriptionAccess(f.request, f.input)(owner); assert.equal(r.allowed, false); }
});
test("failed provider and account methods return sanitized no-access, even with verified cached access", async () => {
  const f = fixture(), owner = await f.issue(); f.setCached({ state: "active", expiresAt: NOW + 10000, observedAt: NOW, reason: "provider_verified" });
  const inputs = [{ ...f.input, provider: { fetch: async () => { throw Error("private-secret-provider"); } } }, { ...f.input, identity: { ...f.identity, verify: async () => { throw Error("private-secret-auth"); } } }, { ...f.input, identity: { ...f.identity, readAccount: async () => { throw Error("private-secret-account"); } } }, { ...f.input, repository: { ...f.input.repository, commit: async () => { throw Error("private-secret-db"); } } }];
  for (const input of inputs) { const r = await createCurrentOwnerSubscriptionAccess(f.request, input)(owner); assert.equal(r.allowed, false); assert.equal(JSON.stringify(r).includes("private-secret"), false); }
});
test("host config and methods are captured without retaining mutable configuration arrays", async () => {
  const f = fixture(), owner = await f.issue(), products = [WEEK, YEAR], config = { ...f.input.config, products }, input = { ...f.input, config };
  const port = createCurrentOwnerSubscriptionAccess(f.request, input); products[0] = "old-monthly"; config.entitlement = "other"; input.identity = { verify: async () => { throw Error("replaced"); }, readAccount: async () => { throw Error("replaced"); } };
  assert.equal((await port(owner)).allowed, true);
});
test("aborted original request denies without provider I/O", async () => {
  const f = fixture(), owner = await f.issue(), abort = new AbortController(); abort.abort(); const request = new Request(f.request.url, { signal: abort.signal }); f.calls.length = 0;
  assert.equal((await createCurrentOwnerSubscriptionAccess(request, f.input)(owner)).allowed, false); assert.equal(f.calls.length, 0);
});

test("explicit production config reconciles genuine production state without changing the engine", async () => {
  const f = fixture(), owner = await f.issue(); f.patch({ is_sandbox: false });
  const result = await createCurrentOwnerSubscriptionAccess(f.request, { ...f.input, config: { ...f.input.config, environment: "PRODUCTION" } })(owner);
  assert.equal(result.allowed, true); assert.equal(f.calls.includes(`begin:${f.id}:PRODUCTION`), true); assert.equal(f.calls.includes(`commit:${f.id}:PRODUCTION`), true);
});

test("malformed account getters/coercions and thrown clock details are sanitized without evaluation", async () => {
  const f = fixture(), owner = await f.issue(); let getters = 0;
  const state = { userId: f.id, state: "active", revision: 1 }; Object.defineProperty(state, "revision", { get() { getters++; return 1; } });
  const coercion = { toString() { getters++; return "active"; } };
  for (const value of [state, { userId: f.id, state: coercion, revision: 1 }]) {
    const input = { ...f.input, identity: { ...f.identity, readAccount: async () => value as OwnerAccountState } };
    assert.equal((await createCurrentOwnerSubscriptionAccess(f.request, input)(owner)).allowed, false);
  }
  assert.equal(getters, 0); f.calls.length = 0;
  const r = await createCurrentOwnerSubscriptionAccess(f.request, { ...f.input, now: () => { throw Error("private-clock"); } })(owner);
  assert.equal(r.allowed, false); assert.equal(JSON.stringify(r).includes("private-clock"), false); assert.equal(f.calls.length, 0);
});

test("a getter on a host method's bind property is not executed", async () => {
  const f = fixture(), owner = await f.issue(); f.calls.length = 0; let getters = 0;
  const verify = async () => { throw Error("must not call malformed method"); };
  Object.defineProperty(verify, "bind", { get() { getters++; throw Error("private-bind-getter"); } });
  const r = await createCurrentOwnerSubscriptionAccess(f.request, { ...f.input, identity: { ...f.identity, verify } })(owner);
  assert.equal(r.allowed, false); assert.equal(getters, 0); assert.equal(f.calls.length, 0);
});

test("inherited-only identity/repository/provider ports are inert without reading prototype getters", async () => {
  for (const key of ["identity", "repository", "provider"] as const) for (const accessor of [true, false]) {
    const f = fixture(), owner = await f.issue(); f.calls.length = 0; let getters = 0;
    const prototype = Object.create(null);
    Object.defineProperty(prototype, key, accessor ? { get() { getters++; return f.input[key]; } } : { value: f.input[key] });
    const input = Object.create(prototype, Object.getOwnPropertyDescriptors(f.input));
    delete input[key];
    const access = createCurrentOwnerSubscriptionAccess(f.request, input);
    assert.equal(getters, 0, `${key}: constructor must not read inherited port`);
    assert.equal(f.calls.length, 0);
    assert.equal((await access(owner)).allowed, false, `${key}: own port required`);
    assert.equal(getters, 0); assert.equal(f.calls.length, 0);
  }
});

test("deleted function name with inherited name getter is never read and original receivers survive", async () => {
  const f = fixture(), owner = await f.issue(); f.calls.length = 0; let getters = 0;
  const identity = { ...f.identity };
  const verify = async function (this: OwnerScopeDependencies, request: Request) {
    assert.equal(this, identity); return f.identity.verify(request);
  };
  Reflect.deleteProperty(verify, "name");
  const prototype = Object.create(Function.prototype);
  Object.defineProperty(prototype, "name", { get() { getters++; return "private-name"; } });
  Object.setPrototypeOf(verify, prototype); identity.verify = verify;
  const access = createCurrentOwnerSubscriptionAccess(f.request, { ...f.input, identity });
  assert.equal(getters, 0); assert.equal(f.calls.length, 0);
  assert.equal((await access(owner)).allowed, true);
  assert.equal(getters, 0); assert.equal(f.calls.filter(x => x === "verify").length, 2);
});
