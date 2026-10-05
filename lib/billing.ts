import { createHash, timingSafeEqual } from "node:crypto";
import { AccountError, UUID, boundedJson, keys, object, type VerifiedAccount } from "./account.ts";

export type BillingEnvironment = "PRODUCTION" | "SANDBOX";
export type AccessState = { state: "trial" | "active" | "expired" | "revoked" | "inactive" | "unknown"; expiresAt: number | null; observedAt: number; reason: string; transactionHash?: string };
export type Access = AccessState & { allowed: boolean; rerollsIncluded: boolean; stale: boolean };
export type BillingBinding = { appUserId: string; held: boolean };
export type BillingConfig = { environment: BillingEnvironment; entitlement: string; products: readonly string[] };
export const billingId = (id: unknown): id is string => typeof id === "string" && id.startsWith("wd_") && UUID.test(id.slice(3));
export function accessAt(state: AccessState | null, now: number, stale = false): Access {
  const current = state ?? { state: "unknown", expiresAt: null, observedAt: 0, reason: "not_verified" };
  const allowed = ["trial", "active"].includes(current.state) && current.expiresAt !== null && current.expiresAt > now;
  return { state: !allowed && ["trial", "active"].includes(current.state) ? "expired" : current.state, expiresAt: current.expiresAt, observedAt: current.observedAt, reason: current.reason, allowed, rerollsIncluded: allowed, stale };
}
function date(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(value)) throw new Error("invalid_date");
  const time = Date.parse(value); if (!Number.isFinite(time)) throw new Error("invalid_date"); return time;
}
export function providerState(raw: unknown, binding: BillingBinding, config: BillingConfig, now: number): AccessState {
  const fail = (reason: string): AccessState => ({ state: "unknown", expiresAt: null, observedAt: now, reason });
  try {
    const response = object(raw); const subscriber = object(response.subscriber);
    if (!Number.isSafeInteger(response.request_date_ms) || Math.abs((response.request_date_ms as number) - now) > 300000) return fail("stale_provider_response");
    const observedAt = response.request_date_ms as number;
    if (binding.held || !billingId(binding.appUserId) || subscriber.original_app_user_id !== binding.appUserId) return fail("identity_review_required");
    const entitlements = object(subscriber.entitlements); const subscriptions = object(subscriber.subscriptions);
    const rawEntitlement = entitlements[config.entitlement];
    if (!rawEntitlement) return { state: "inactive", expiresAt: null, observedAt, reason: "no_entitlement" };
    const entitlement = object(rawEntitlement);
    if (typeof entitlement.product_identifier !== "string" || !config.products.includes(entitlement.product_identifier)) return fail("product_unverified");
    const subscription = object(subscriptions[entitlement.product_identifier]);
    if (subscription.store !== "app_store" || typeof subscription.is_sandbox !== "boolean" || subscription.is_sandbox !== (config.environment === "SANDBOX")) return fail("environment_or_store_mismatch");
    if (subscription.ownership_type !== "PURCHASED") return fail("ownership_review_required");
    if (!["trial", "normal", "intro"].includes(subscription.period_type as string)) return fail("period_unverified");
    if (subscription.refunded_at !== null && subscription.refunded_at !== undefined) {
      date(subscription.refunded_at); return { state: "revoked", expiresAt: null, observedAt, reason: "provider_refund" };
    }
    const entitlementExpiry = date(entitlement.expires_date), subscriptionExpiry = date(subscription.expires_date);
    const purchase = date(subscription.purchase_date);
    if (entitlementExpiry === null || subscriptionExpiry === null || purchase === null || purchase > now || entitlementExpiry <= purchase || subscriptionExpiry <= purchase) return fail("expiry_unverified");
    let expiresAt = Math.min(entitlementExpiry, subscriptionExpiry);
    const eg = date(entitlement.grace_period_expires_date), sg = date(subscription.grace_period_expires_date);
    const issue = date(subscription.billing_issues_detected_at);
    // Only explicit provider/store grace, never a local extension or freshly invented trial.
    if (issue !== null && eg !== null && sg !== null && issue <= now) expiresAt = Math.max(expiresAt, Math.min(eg, sg));
    if (typeof subscription.store_transaction_id !== "string" && typeof subscription.store_transaction_id !== "number") return fail("transaction_unverified");
    const transaction = String(subscription.store_transaction_id);
    if (!/^[A-Za-z0-9._-]{1,256}$/.test(transaction)) return fail("transaction_unverified");
    const transactionHash = createHash("sha256").update(`app_store:${transaction}`).digest("hex");
    return { state: expiresAt > now ? (subscription.period_type === "trial" ? "trial" : "active") : "expired", expiresAt, observedAt, reason: expiresAt > now ? "provider_verified" : "provider_expired", transactionHash };
  } catch { return fail("malformed_provider_state"); }
}

export type BillingRepository = {
  bind: (userId: string) => Promise<BillingBinding>;
  begin: (userId: string, environment: BillingEnvironment) => Promise<{ generation: number; binding: BillingBinding; cached: AccessState | null }>;
  commit: (userId: string, environment: BillingEnvironment, generation: number, state: AccessState) => Promise<AccessState>;
  enqueue: (event: BillingEvent) => Promise<void>;
};
export type BillingProvider = { fetch: (appUserId: string) => Promise<unknown> };
export async function reconcileAccess(userId: string, repository: BillingRepository, provider: BillingProvider, config: BillingConfig, now: number): Promise<Access & { appUserId: string }> {
  if (!UUID.test(userId)) throw new AccountError(401, "invalid_session");
  const job = await repository.begin(userId, config.environment);
  if (!billingId(job.binding.appUserId)) throw new AccountError(503, "billing_identity_unavailable");
  if (job.binding.held) return { ...accessAt({ state: "unknown", expiresAt: null, observedAt: now, reason: "identity_review_required" }, now), appUserId: job.binding.appUserId };
  let raw: unknown;
  try { raw = await provider.fetch(job.binding.appUserId); }
  catch { return { ...accessAt(job.cached, now, true), appUserId: job.binding.appUserId }; }
  const state = providerState(raw, job.binding, config, now);
  const committed = await repository.commit(userId, config.environment, job.generation, state);
  return { ...accessAt(committed, now), appUserId: job.binding.appUserId };
}
export function revenueCatProvider(key: string, fetchImpl: typeof fetch = fetch): BillingProvider {
  return { async fetch(id) {
    if (!billingId(id) || !key) throw new AccountError(503, "billing_configuration");
    // Vendor GET can create a missing customer. Never called live by this run. Only a known bound identity.
    const response = await fetchImpl(`https://api.revenuecat.com/v1/subscribers/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${key}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new AccountError(503, "billing_provider_unavailable");
    // Provider payload is transient; subscriber attributes, emails and raw transaction IDs are never persisted.
    return await response.json();
  } };
}
export type BillingEvent = { id: string; type: string; appId: string | null; environment: BillingEnvironment | "UNKNOWN"; timestamp: number; appUserIds: string[]; identityHold: boolean; fingerprint: string };
export function parseBillingEvent(value: unknown): BillingEvent {
  const envelope = object(value); keys(envelope, ["api_version", "event"]);
  if (envelope.api_version !== "1.0") throw new AccountError(400, "webhook_version");
  const event = object(envelope.event);
  if (typeof event.id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(event.id) || typeof event.type !== "string" || !/^[A-Z_]{1,64}$/.test(event.type) || !Number.isSafeInteger(event.event_timestamp_ms) || (event.event_timestamp_ms as number) < 0) throw new AccountError(400, "invalid_webhook");
  const environment = event.environment ?? (event.type === "TRANSFER" ? "UNKNOWN" : undefined);
  if (!["PRODUCTION", "SANDBOX", "UNKNOWN"].includes(environment as string)) throw new AccountError(400, "invalid_environment");
  const arrays = [event.aliases ?? [], event.transferred_from ?? [], event.transferred_to ?? []];
  if (arrays.some(x => !Array.isArray(x) || x.length > 100 || x.some((id: unknown) => typeof id !== "string" || id.length > 256))) throw new AccountError(400, "invalid_identity_list");
  if (event.app_user_id !== undefined && (typeof event.app_user_id !== "string" || event.app_user_id.length > 256)) throw new AccountError(400, "invalid_identity");
  const ids = [...new Set([event.app_user_id, ...arrays.flat()].filter(billingId))].sort();
  if (event.app_id !== undefined && (typeof event.app_id !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(event.app_id))) throw new AccountError(400, "invalid_app");
  const parsed = { id: event.id, type: event.type, appId: typeof event.app_id === "string" ? event.app_id : null, environment: environment as BillingEvent["environment"], timestamp: event.event_timestamp_ms as number, appUserIds: ids, identityHold: event.type === "TRANSFER" || ids.length > 1 || event.type === "TEMPORARY_ENTITLEMENT_GRANT" };
  return { ...parsed, fingerprint: createHash("sha256").update(JSON.stringify(parsed)).digest("hex") };
}
export function webhookHandler(deps: { authorization: string; appId: string; environment: BillingEnvironment; repository: BillingRepository }) {
  const noStore={headers:{"Cache-Control":"no-store"}};
  return async (request: Request) => {
    try {
      const supplied = request.headers.get("authorization") ?? "";
      const expectedBytes = Buffer.from(deps.authorization), suppliedBytes = Buffer.from(supplied);
      if (expectedBytes.length < 32 || expectedBytes.length > 512 || suppliedBytes.length !== expectedBytes.length || !timingSafeEqual(suppliedBytes, expectedBytes)) throw new AccountError(401, "webhook_unauthorized");
      const event = parseBillingEvent(await boundedJson(request, 65536));
      if (event.appId !== deps.appId) return Response.json({ ignored: "different_app" },noStore);
      if (event.type === "TEST") return Response.json({ ignored: "dashboard_test" },noStore);
      if (event.environment !== "UNKNOWN" && event.environment !== deps.environment) return Response.json({ ignored: "different_environment" },noStore);
      await deps.repository.enqueue(event); // Durable commit BEFORE 200; worker processing/activation is separate.
      return Response.json({ accepted: true },noStore);
    } catch (error) {
      const safe = error instanceof AccountError ? error : new AccountError(503, "webhook_unavailable");
      return Response.json({ error: safe.message }, { ...noStore,status: safe.status });
    }
  };
}
export type ClaimedBillingEvent = { id: string; environment: BillingEnvironment; accountIds: string[]; attempt: number };
export type BillingInbox = { claim: (environment: BillingEnvironment, limit: number) => Promise<ClaimedBillingEvent[]>; finish: (event: ClaimedBillingEvent, status: "processed" | "retry" | "held") => Promise<void> };
export async function processBillingInbox(inbox: BillingInbox, repository: BillingRepository, provider: BillingProvider, config: BillingConfig, now = Date.now(), limit = 5) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 5) throw new AccountError(400, "invalid_limit");
  const events = await inbox.claim(config.environment, limit); let processed = 0; let retried = 0; let held = 0;
  for (const event of events) {
    let status: "processed" | "retry" | "held" = "processed";
    if (event.environment !== config.environment || event.accountIds.length > 100 || event.accountIds.some(id => !UUID.test(id))) status = "held";
    else for (const id of event.accountIds) {
      try {
        const access = await reconcileAccess(id, repository, provider, config, now);
        if (access.reason.includes("review_required")) status = "held";
        else if (access.stale && status !== "held") status = "retry";
      } catch (error) { if (!(error instanceof AccountError && error.status === 410) && status !== "held") status = "retry"; }
    }
    await inbox.finish(event, status);
    if (status === "processed") processed++; else if (status === "retry") retried++; else held++;
  }
  return { processed, retried, held };
}
export function billingAccessHandler(deps: { verify: (r: Request) => Promise<VerifiedAccount>; assertActive: (a: VerifiedAccount) => Promise<void>; repository: BillingRepository; provider: BillingProvider; config: BillingConfig; now?: () => number }) {
  return async (request: Request): Promise<Response> => {
    try {
      const account = await deps.verify(request); await deps.assertActive(account);
      if (new URL(request.url).search) throw new AccountError(400, "invalid_query");
      if (request.method === "POST") keys(await boundedJson(request), []);
      else if (request.method !== "GET") throw new AccountError(405, "method_not_allowed");
      const result = await reconcileAccess(account.id, deps.repository, deps.provider, deps.config, (deps.now ?? Date.now)());
      return Response.json({ apiVersion: 1, ...result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const safe = error instanceof AccountError ? error : new AccountError(503, "billing_unavailable");
      return Response.json({ error: safe.message }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
    }
  };
}
export function supabaseBillingRepository(url: string, serviceKey: string, fetchImpl: typeof fetch = fetch): BillingRepository {
  async function command(action: string, body: unknown): Promise<Record<string, unknown>> {
    const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/wd_billing_command`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_action: action, p_body: body }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new AccountError(503, "billing_unavailable");
    const result = object(await response.json());
    if (result.error) throw new AccountError(result.error === "account_inactive" ? 410 : result.error === "rate_limited" ? 429 : 503, result.error === "account_inactive" ? "account_inactive" : result.error === "rate_limited" ? "rate_limited" : "billing_unavailable");
    return result;
  }
  return {
    bind: async userId => await command("bind", { userId }) as BillingBinding,
    begin: async (userId, environment) => await command("begin", { userId, environment }) as { generation: number; binding: BillingBinding; cached: AccessState | null },
    commit: async (userId, environment, generation, state) => await command("commit", { userId, environment, generation, state }) as AccessState,
    enqueue: async event => { await command("enqueue", event); },
  };
}
export function supabaseBillingInbox(url: string, serviceKey: string, fetchImpl: typeof fetch = fetch): BillingInbox {
  async function command(action: string, body: unknown) {
    const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/wd_billing_command`, { method: "POST", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_action: action, p_body: body }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new AccountError(503, "billing_inbox_unavailable");
    const result = object(await response.json()); if (result.error) throw new AccountError(503, "billing_inbox_unavailable"); return result;
  }
  return { claim: async (environment, limit) => (await command("claim_events", { environment, limit })).events as ClaimedBillingEvent[], finish: async (event, status) => { await command("finish_event", { ...event, status }); } };
}
