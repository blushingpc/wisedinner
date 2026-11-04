import { AccountError, UUID, object, type VerifiedAccount } from "./account.ts";
import { billingAccessHandler, billingId, processBillingInbox, webhookHandler, type BillingConfig, type BillingEnvironment, type BillingInbox, type BillingProvider, type BillingRepository } from "./billing.ts";
import { reconcileExplicitRestore, requestExplicitRestore, type RestoreProofAdapter, type RestoreRepository, type RestoreScope } from "./billing-restore.ts";

export type CurrentSubscriptionRuntimeDeps = Readonly<{
  enabled: boolean; configurationAdmitted: boolean; environment: BillingEnvironment; appId: string;
  entitlement: "wisedinner_pro"; products: readonly string[];
  verify(request: Request): Promise<VerifiedAccount>; assertActive(account: VerifiedAccount): Promise<void>;
  repository: BillingRepository; provider: BillingProvider; now?: () => number;
  webhook?: Readonly<{ authorization: string; mode: "authorization-header" }>;
  inbox?: BillingInbox; restore?: Readonly<{ repository: RestoreRepository; proof?: RestoreProofAdapter }>;
}>;
export type CurrentSubscriptionRuntime = Readonly<{
  identity(request: Request): Promise<Response>; access(request: Request): Promise<Response>; webhook(request: Request): Promise<Response>;
  processInbox(limit?: number): Promise<{ processed: number; retried: number; held: number }>;
  requestRestore(request: Request, operation: string, product: string): Promise<Record<string, unknown>>;
  reconcileRestore(request: Request, operation: string): Promise<Record<string, unknown>>;
}>;

const PRODUCTS = ["com.wisedinner.app.protein.weekly", "com.wisedinner.app.protein.yearly"] as const;
const STATES = ["trial", "active", "expired", "revoked", "inactive", "unknown"];
const RESTORE_STATES = ["pending", "held", "leased", "prepared", "completed"];
const REASONS = new Set(["not_verified", "identity_review_required", "stale_provider_response", "no_entitlement", "product_unverified", "environment_or_store_mismatch", "ownership_review_required", "period_unverified", "provider_refund", "expiry_unverified", "transaction_unverified", "provider_verified", "provider_expired", "malformed_provider_state", "transaction_owner_review_required"]);
const ERRORS = new Set(["billing_not_configured", "billing_unavailable", "billing_identity_unavailable", "invalid_session", "account_inactive", "account_missing", "rate_limited", "invalid_query", "method_not_allowed", "json_required", "body_required", "payload_too_large", "invalid_json", "invalid_shape", "unknown_field", "webhook_unauthorized", "webhook_version", "invalid_webhook", "invalid_environment", "invalid_identity_list", "invalid_identity", "invalid_app", "idempotency_conflict", "webhook_unavailable"]);
const RESTORE_REASONS = new Set(["proof_unavailable", "proof_invalid", "outcome_unknown", "intent_required", "intent_unavailable", "intent_expired", "lease_unavailable", "stale_lease", "reconciliation_required", "ownership_or_generation_conflict", "account_inactive"]);
const headers = { "Cache-Control": "no-store" };
const json = (body: unknown, status = 200) => Response.json(body, { status, headers });
const held = (reason = "intent_unavailable") => ({ status: "held", reason });

// Capture data properties without evaluating config getters or retaining mutable
// owner/config objects. No factory reads environment, keys, customers or providers.
function data<T extends object>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("configuration");
  const entries = Object.entries(Object.getOwnPropertyDescriptors(value));
  if (entries.some(([, d]) => !("value" in d))) throw Error("configuration");
  return Object.fromEntries(entries.map(([k, d]) => [k, d.value])) as T;
}
function method<T extends object, K extends keyof T>(port: T, key: K): T[K] {
  const fn = data(port)[key]; if (typeof fn !== "function") throw Error("configuration");
  return fn.bind(port);
}
function safeError(error: unknown): Response {
  const status = error instanceof AccountError && [400, 401, 404, 405, 409, 410, 413, 415, 429, 503].includes(error.status) ? error.status : 503;
  return json({ error: error instanceof AccountError && ERRORS.has(error.message) ? error.message : "billing_unavailable" }, status);
}
function restoreResult(raw: Record<string, unknown>): Record<string, unknown> {
  if (typeof raw.status !== "string" || !RESTORE_STATES.includes(raw.status)) return held();
  return { status: raw.status, ...(raw.status === "held" ? { reason: typeof raw.reason === "string" && RESTORE_REASONS.has(raw.reason) ? raw.reason : "intent_unavailable" } : {}) };
}

/** Server-only, injected composition. It does not activate routes or a worker.
 * Configuration admission never supplies membership or a StoreKit result.
 */
export function createCurrentSubscriptionRuntime(input: CurrentSubscriptionRuntimeDeps): CurrentSubscriptionRuntime {
  let config: BillingConfig | undefined, appId = "", enabled = false;
  let verify: CurrentSubscriptionRuntimeDeps["verify"] | undefined, active: CurrentSubscriptionRuntimeDeps["assertActive"] | undefined;
  let repository: BillingRepository | undefined, provider: BillingProvider | undefined, inbox: BillingInbox | undefined;
  let restore: CurrentSubscriptionRuntimeDeps["restore"] | undefined, hook: CurrentSubscriptionRuntimeDeps["webhook"] | undefined;
  let now: () => number = Date.now;
  try {
    const d = data(input);
    if (!Array.isArray(d.products)) throw Error("configuration");
    const pd = Object.getOwnPropertyDescriptors(d.products);
    if (Object.getOwnPropertyDescriptor(d.products, "length")?.value !== 2 || Object.values(pd).some(p => !("value" in p)) || typeof pd[0]?.value !== "string" || typeof pd[1]?.value !== "string") throw Error("configuration");
    const products: string[] = [pd[0].value, pd[1].value];
    if (d.enabled !== true || d.configurationAdmitted !== true || !["PRODUCTION", "SANDBOX"].includes(d.environment) || d.entitlement !== "wisedinner_pro"
      || products.length !== 2 || new Set(products).size !== 2 || PRODUCTS.some(p => !products.includes(p)) || typeof d.appId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(d.appId)) throw Error("configuration");
    config = Object.freeze({ environment: d.environment, entitlement: d.entitlement, products: Object.freeze(products) }); appId = d.appId;
    verify = method(d, "verify"); active = method(d, "assertActive");
    repository = Object.freeze({ bind: method(d.repository, "bind"), begin: method(d.repository, "begin"), commit: method(d.repository, "commit"), enqueue: method(d.repository, "enqueue") });
    provider = Object.freeze({ fetch: method(d.provider, "fetch") });
    if (d.now !== undefined) now = method(d, "now")!;
    if (d.inbox) inbox = Object.freeze({ claim: method(d.inbox, "claim"), finish: method(d.inbox, "finish") });
    if (d.restore) { const r = data(d.restore); restore = Object.freeze({ repository: Object.freeze({ execute: method(r.repository, "execute") }), ...(r.proof ? { proof: Object.freeze({ observe: method(r.proof, "observe") }) } : {}) }); }
    if (d.webhook) { const w = data(d.webhook); if (w.mode === "authorization-header" && typeof w.authorization === "string" && Buffer.byteLength(w.authorization) >= 32 && Buffer.byteLength(w.authorization) <= 512) hook = Object.freeze(w); }
    enabled = true;
  } catch { enabled = false; }
  const available = () => enabled && config !== undefined && repository !== undefined && provider !== undefined && verify !== undefined && active !== undefined;
  const clock = () => { const n = now(); if (!Number.isSafeInteger(n) || n < 0) throw new AccountError(503, "billing_unavailable"); return n; };
  async function owner(request: Request): Promise<VerifiedAccount> {
    const value = data(await verify!(request));
    if (!UUID.test(value.id) || !Array.isArray(value.providers) || value.providers.some(p => typeof p !== "string")) throw new AccountError(401, "invalid_session");
    const account = Object.freeze({ id: value.id, token: value.token, authenticatedAt: value.authenticatedAt, providers: [...value.providers] });
    await active!(account); return account;
  }
  async function binding(account: VerifiedAccount) {
    const b = data(await repository!.bind(account.id));
    if (!billingId(b.appUserId) || typeof b.held !== "boolean") throw new AccountError(503, "billing_identity_unavailable");
    return Object.freeze({ appUserId: b.appUserId, held: b.held });
  }
  async function original(operation: string, account: VerifiedAccount, expectedBinding: string, repo: RestoreRepository) {
    const r = data(await repo.execute("read", { operation }));
    if (r.operation !== operation || r.targetBinding !== expectedBinding || r.environment !== config!.environment || r.app !== appId || r.entitlement !== config!.entitlement
      || typeof r.product !== "string" || !config!.products.includes(r.product) || typeof r.status !== "string" || !RESTORE_STATES.includes(r.status)) throw Error("restore_scope");
    await active!(account); return r;
  }
  return Object.freeze({
    async identity(request) {
      if (!available()) return json({ error: "billing_not_configured" }, 503);
      try {
        if (request.method !== "GET") throw new AccountError(405, "method_not_allowed");
        if (new URL(request.url).search || request.body !== null) throw new AccountError(400, "invalid_query");
        const a = await owner(request), b = await binding(a); return json({ apiVersion: 1, ...b });
      } catch (error) { return safeError(error); }
    },
    async access(request) {
      if (!available()) return json({ error: "billing_not_configured" }, 503);
      let account: VerifiedAccount | undefined, bound: Awaited<ReturnType<typeof binding>> | undefined;
      const scoped: BillingRepository = {
        bind: async () => { throw new AccountError(503, "billing_unavailable"); }, enqueue: async () => { throw new AccountError(503, "billing_unavailable"); },
        async begin(id, env) {
          if (!account || id !== account.id || env !== config!.environment) throw new AccountError(503, "billing_identity_unavailable");
          bound = await binding(account); const job = await repository!.begin(id, env);
          if (job.binding.appUserId !== bound.appUserId) throw new AccountError(503, "billing_identity_unavailable");
          return { ...job, binding: { appUserId: bound.appUserId, held: bound.held || job.binding.held } };
        },
        async commit(id, env, generation, state) {
          if (!account || id !== account.id || env !== config!.environment) throw new AccountError(503, "billing_identity_unavailable");
          await active!(account); return repository!.commit(id, env, generation, state);
        },
      };
      const response = await billingAccessHandler({ verify: async r => (account = await owner(r)), assertActive: async () => {}, repository: scoped,
        provider: { fetch: async id => { if (!bound || id !== bound.appUserId) throw Error("billing_identity_unavailable"); return provider!.fetch(id); } }, config: config!, now: clock })(request);
      const r = object(await response.json());
      if (!response.ok) return safeError(new AccountError(response.status, typeof r.error === "string" ? r.error : "billing_unavailable"));
      if (!bound || r.appUserId !== bound.appUserId || typeof r.state !== "string" || !STATES.includes(r.state)
        || r.expiresAt !== null && (!Number.isSafeInteger(r.expiresAt) || (r.expiresAt as number) < 0)
        || !Number.isSafeInteger(r.observedAt) || (r.observedAt as number) < 0) return json({ error: "billing_unavailable" }, 503);
      // An outage returns cached state without commit. Recheck the current
      // account even on that path before projecting any allowed response.
      try { if (!account) throw Error("invalid_session"); await active!(account); } catch (error) { return safeError(error); }
      return json({ apiVersion: 1, appUserId: bound.appUserId, state: r.state, expiresAt: r.expiresAt, observedAt: r.observedAt,
        reason: typeof r.reason === "string" && REASONS.has(r.reason) ? r.reason : "not_verified", allowed: r.allowed === true, rerollsIncluded: r.rerollsIncluded === true, stale: r.stale === true });
    },
    async webhook(request) {
      if (!available() || !hook) return json({ error: "billing_not_configured" }, 503);
      if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
      if (new URL(request.url).search) return json({ error: "invalid_query" }, 400);
      const response = await webhookHandler({ authorization: hook.authorization, appId, environment: config!.environment, repository: repository! })(request);
      const body = object(await response.json());
      return response.ok ? json(body.accepted === true ? { accepted: true } : { ignored: ["different_app", "dashboard_test", "different_environment"].includes(String(body.ignored)) ? body.ignored : "different_app" })
        : safeError(new AccountError(response.status, typeof body.error === "string" ? body.error : "webhook_unavailable"));
    },
    async processInbox(limit = 5) {
      if (!available() || !inbox) throw new AccountError(503, "billing_not_configured");
      try { return await processBillingInbox(inbox, repository!, provider!, config!, clock(), limit); }
      catch (error) { throw new AccountError(error instanceof AccountError && error.message === "invalid_limit" ? 400 : 503, error instanceof AccountError && error.message === "invalid_limit" ? "invalid_limit" : "billing_unavailable"); }
    },
    async requestRestore(request, operation, product) {
      if (!available() || !restore || !UUID.test(operation) || !config!.products.includes(product)) return held();
      let account: VerifiedAccount | undefined, dispatched = false;
      const readOriginal = async () => {
        if (!account) return held(); const b = await binding(account);
        const raw = await original(operation, account, b.appUserId, restore!.repository);
        return raw.product === product ? restoreResult(raw) : held();
      };
      try {
        const result = await requestExplicitRestore(request, operation, { verify: async r => { account = await owner(r); await binding(account); return account; },
          repository: { execute: async (action, body) => { dispatched = true; return restore!.repository.execute(action, body); } },
          scope: { environment: config!.environment, app: appId, product, entitlement: config!.entitlement } });
        if (result.error) return held();
        return await readOriginal();
      } catch {
        if (!dispatched) return held();
        // Intent may have committed before its ACK was lost. Observe only that
        // original; never issue a second intent or a vendor purchase/restore.
        try { return await readOriginal(); } catch { return held("outcome_unknown"); }
      }
    },
    async reconcileRestore(request, operation) {
      if (!available() || !restore || !UUID.test(operation) || request.method !== "GET" || new URL(request.url).search || request.body !== null) return held();
      try {
        const a = await owner(request), b = await binding(a), raw = await original(operation, a, b.appUserId, restore.repository);
        if (raw.status === "completed") return { status: "completed" };
        // Scope-check EVERY reread/command so a changed original cannot be
        // substituted between the preflight and the existing engine's read.
        const scope: RestoreScope = { environment: config!.environment, app: appId, product: String(raw.product), entitlement: config!.entitlement };
        const repo: RestoreRepository = { async execute(action, body) {
          if (body.operation !== operation) throw Error("restore_scope");
          const current = await original(operation, a, b.appUserId, restore!.repository);
          if (current.product !== scope.product) throw Error("restore_scope");
          if (action === "read") return current;
          return restore!.repository.execute(action, body);
        } };
        const proof = restore.proof;
        const guardedProof: RestoreProofAdapter | undefined = proof ? { async observe(i, mode, signal) {
          const current = await original(operation, a, b.appUserId, restore!.repository);
          if (i.targetBinding !== b.appUserId || i.product !== scope.product || current.product !== scope.product) throw Error("restore_scope");
          return proof.observe(i, mode, signal);
        } } : undefined;
        return restoreResult(await reconcileExplicitRestore(operation, repo, guardedProof, clock));
      } catch { return held("outcome_unknown"); }
    },
  });
}
