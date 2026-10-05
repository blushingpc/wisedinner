import test from "node:test";
import assert from "node:assert/strict";
import { AccountError } from "./account.ts";
import { accessAt, billingAccessHandler, billingId, parseBillingEvent, processBillingInbox, providerState, reconcileAccess, revenueCatProvider, webhookHandler, type AccessState, type BillingConfig, type BillingEvent, type BillingRepository } from "./billing.ts";
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const binding = { appUserId: `wd_${A}`, held: false };
const now = 2000000000000;
const config: BillingConfig = { environment: "PRODUCTION", entitlement: "fixture_protein", products: ["fixture_monthly", "fixture_annual"] };
const iso = (ms: number) => new Date(ms).toISOString();
function customer(subscriptionPatch = {}, entitlementPatch = {}, subscriberPatch = {}) {
  return { request_date_ms: now, subscriber: { original_app_user_id: binding.appUserId,
    entitlements: { fixture_protein: { product_identifier: "fixture_monthly", expires_date: iso(now+86400000), grace_period_expires_date: null, ...entitlementPatch } },
    subscriptions: { fixture_monthly: { store: "app_store", is_sandbox: false, ownership_type: "PURCHASED", period_type: "normal", purchase_date: iso(now-86400000), expires_date: iso(now+86400000), grace_period_expires_date: null, refunded_at: null, billing_issues_detected_at: null, store_transaction_id: "fixture_transaction_1", ...subscriptionPatch } }, ...subscriberPatch } };
}
const event = (patch = {}) => ({ api_version: "1.0", event: { id: "fixture_event_1", app_id: "fixture_app", type: "RENEWAL", app_user_id: binding.appUserId, aliases: [], environment: "PRODUCTION", event_timestamp_ms: now, ...patch } });
function repository() {
  let cached: AccessState | null = null; let generation = 0; const events = new Map<string, BillingEvent>();
  const repo: BillingRepository = { bind: async () => binding,
    begin: async id => { if (id !== A) throw new AccountError(410, "account_inactive"); return { generation: ++generation, binding, cached }; },
    commit: async (_id, _env, gen, state) => { if (gen === generation && (!cached || state.observedAt >= cached.observedAt)) cached = state; return cached!; },
    enqueue: async e => { const old = events.get(e.id); if (old && old.fingerprint !== e.fingerprint) throw new AccountError(409, "idempotency_conflict"); events.set(e.id, e); } };
  return { repo, events, setCached: (s: AccessState) => { cached = s; } };
}
for (const [name, patch, expected] of [
  ["trial", { period_type: "trial" }, "trial"], ["paid renewal", {}, "active"], ["canceled but not expired", { unsubscribe_detected_at: iso(now-1000) }, "active"],
  ["expired", { expires_date: iso(now-1000) }, "expired"], ["refunded", { refunded_at: iso(now-1000) }, "revoked"],
  ["sandbox never grants production", { is_sandbox: true }, "unknown"], ["wrong store", { store: "play_store" }, "unknown"],
  ["unreviewed family ownership", { ownership_type: "FAMILY_SHARED" }, "unknown"], ["no infinite null expiry", { expires_date: null }, "unknown"], ["missing transaction", { store_transaction_id: null }, "unknown"],
] as const) test(`provider state: ${name}`, () => {
  const state = providerState(customer(patch), binding, config, now); assert.equal(state.state, expected);
  assert.equal(accessAt(state, now).allowed, ["trial", "active"].includes(expected));
  assert.equal(accessAt(state, now).rerollsIncluded, accessAt(state, now).allowed);
});
test("provider grace must be explicit in both records; billing retry does not invent extra time", () => {
  const expired = { expires_date: iso(now-1000), billing_issues_detected_at: iso(now-2000) };
  assert.equal(providerState(customer(expired), binding, config, now).state, "expired");
  assert.equal(providerState(customer({ ...expired, grace_period_expires_date: iso(now+10000) }, { grace_period_expires_date: iso(now+10000) }), binding, config, now).state, "active");
});
test("wrong identities, aliases and unverified products/pending flags never grant", () => {
  for (const original of [`wd_${B}`, "$RCAnonymousID:fixture"]) assert.equal(providerState(customer({}, {}, { original_app_user_id: original }), binding, config, now).state, "unknown");
  assert.equal(providerState(customer(), { ...binding, held: true }, config, now).state, "unknown");
  assert.equal(providerState(customer({}, { product_identifier: "other_product" }), binding, config, now).state, "unknown");
  assert.equal(providerState(customer({}, {}, { entitlements: {}, pendingPurchase: true, success: true }), binding, config, now).state, "inactive");
  assert.equal(providerState({ localTrialStartedAt: now, success: true }, binding, config, now).state, "unknown");
});
test("provider outage uses only existing verified expiry, never a fresh trial or local grace", async () => {
  const r = repository(); const provider = { fetch: async () => { throw new Error("private provider detail"); } };
  assert.equal((await reconcileAccess(A, r.repo, provider, config, now)).allowed, false);
  r.setCached(providerState(customer({ period_type: "trial" }), binding, config, now));
  const cached = await reconcileAccess(A, r.repo, provider, config, now+1000); assert.equal(cached.allowed, true); assert.equal(cached.stale, true); assert.equal(cached.transactionHash, undefined);
  assert.equal((await reconcileAccess(A, r.repo, provider, config, now+86400000)).allowed, false);
});
test("late/out-of-order responses cannot overwrite newer provider truth", async () => {
  const r = repository(); let release: (value: unknown) => void = () => {};
  const slow = reconcileAccess(A, r.repo, { fetch: async () => new Promise(resolve => { release = resolve; }) }, config, now);
  await Promise.resolve();
  assert.equal((await reconcileAccess(A, r.repo, { fetch: async () => customer({ refunded_at: iso(now-1000) }) }, config, now)).state, "revoked");
  release(customer()); assert.equal((await slow).allowed, false);
});
test("webhook schema reduces payload to private identity references, not customer attributes or entitlement claims", () => {
  const parsed = parseBillingEvent(event({ subscriber_attributes: { private: "never persist" }, aliases: [binding.appUserId, `wd_${B}`], expiration_at_ms: now+86400000 }));
  assert.equal(parsed.identityHold, true); assert.equal(JSON.stringify(parsed).includes("never persist"), false); assert.equal(JSON.stringify(parsed).includes("expiration_at_ms"), false);
  assert.equal(parseBillingEvent(event({ type: "TRANSFER", environment: undefined, app_user_id: undefined, transferred_from: [binding.appUserId], transferred_to: [`wd_${B}`] })).environment, "UNKNOWN");
  assert.throws(() => parseBillingEvent(event({ aliases: Array(101).fill("unknown") })), /invalid_identity_list/);
  assert.throws(() => parseBillingEvent({ ...event(), api_version: "2.0" }), /webhook_version/);
});
test("authenticated webhook durably deduplicates, separates app/environment and rejects byte abuse", async () => {
  const r = repository(); const authorization = "fixture_".repeat(8);
  const handle = webhookHandler({ authorization, appId: "fixture_app", environment: "PRODUCTION", repository: r.repo });
  const request = (body: unknown, auth = authorization) => new Request("https://test.invalid/api/v1/billing/webhook", { method: "POST", headers: { "Content-Type": "application/json", Authorization: auth }, body: JSON.stringify(body) });
  const unauthorized=await handle(request(event(), "untrusted"));assert.equal(unauthorized.status,401);assert.equal(unauthorized.headers.get("cache-control"),"no-store");
  assert.equal((await handle(request(event({ environment: "SANDBOX" })))).status, 200); assert.equal(r.events.size, 0);
  assert.equal((await handle(request(event({ app_id: "other_app" })))).status, 200); assert.equal(r.events.size, 0);
  assert.equal((await handle(request(event()))).status, 200); assert.equal((await handle(request(event()))).status, 200); assert.equal(r.events.size, 1);
  assert.equal((await handle(request(event({ type: "EXPIRATION" })))).status, 409);
  assert.equal((await handle(request({ oversized: "x".repeat(66000) }))).status, 413);
  const unavailable = webhookHandler({ authorization, appId: "fixture_app", environment: "PRODUCTION", repository: { ...r.repo, enqueue: async () => { throw new Error("private DB detail"); } } });
  const response = await unavailable(request(event())); assert.equal(response.status, 503);assert.equal(response.headers.get("cache-control"),"no-store"); assert.equal((await response.text()).includes("private"), false);
});
test("actual access handler derives ownership from verified session and denies client success/tier flags", async () => {
  const r = repository(); let fetched = false;
  const handle = billingAccessHandler({ verify: async () => ({ id: A, token: "synthetic", authenticatedAt: null, providers: [] }), assertActive: async () => {}, repository: r.repo, provider: { fetch: async id => { fetched = true; assert.equal(id, binding.appUserId); return customer(); } }, config, now: () => now });
  const url = "https://test.invalid/api/v1/access";
  assert.equal((await handle(new Request(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ user_id: B, success: true, tier: "protein" }) }))).status, 400); assert.equal(fetched, false);
  const response = await handle(new Request(url)); assert.equal((await response.json()).allowed, true);
  const deleted = billingAccessHandler({ verify: async () => ({ id: B, token: "old", authenticatedAt: null, providers: [] }), assertActive: async () => { throw new AccountError(410, "account_inactive"); }, repository: r.repo, provider: { fetch: async () => { throw new Error("must not fetch"); } }, config });
  assert.equal((await deleted(new Request(url))).status, 410);
});
test("bounded inbox re-reconciles current truth; outages retry, deleted accounts do not bootstrap", async () => {
  const r = repository(); const statuses: string[] = [];
  const inbox = { claim: async () => [{ id: "old_expiration", environment: "PRODUCTION" as const, accountIds: [A], attempt: 1 }, { id: "deleted", environment: "PRODUCTION" as const, accountIds: [B], attempt: 1 }], finish: async (_event: unknown, status: string) => { statuses.push(status); } };
  assert.deepEqual(await processBillingInbox(inbox, r.repo, { fetch: async () => customer() }, config, now), { processed: 2, retried: 0, held: 0 });
  assert.deepEqual(statuses, ["processed", "processed"]);
  assert.equal((await processBillingInbox(inbox, r.repo, { fetch: async () => { throw new Error("outage"); } }, config, now)).retried, 1);
});
test("provider adapter encodes only bound opaque IDs and never exposes its secret", async () => {
  let called = false;
  const provider = revenueCatProvider("synthetic-secret", async (url, options) => { called = true; assert.equal(url, `https://api.revenuecat.com/v1/subscribers/${binding.appUserId}`); assert.equal(new Headers(options?.headers).get("x-platform"), null); return Response.json(customer()); });
  assert.equal(billingId(binding.appUserId), true); assert.equal(billingId("unknown"), false);
  await assert.rejects(provider.fetch("unbound"), /billing_configuration/); assert.equal(called, false);
  assert.equal(providerState(await provider.fetch(binding.appUserId), binding, config, now).state, "active");
});
