import {CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY} from "./current-integration-reference-v11.server.ts";
import {CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY} from "./current-integration-reference-v10.server.ts";
import { CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY } from "./current-integration-reference-v9.server.ts";
import { CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY } from "./current-integration-reference-v5.server.ts";
import { AccountError, object, supabaseAccountRepository, supabaseVerifier, type VerifiedAccount } from "./account.ts";
import { createCurrentOwnerReadService } from "./current-owner-read.server.ts";
import { createCurrentOwnerIntegrationHandler, type CurrentOwnerServiceDependencies } from "./generated-current-owner-service.ts";
import { createCurrentOwnerSupabaseRpcDriver } from "./generated-current-rpc-driver.ts";
import type { CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";
import type { OwnerScopeDependencies } from "./generated-owner-scope.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { referenceAdmissionDigest, referenceAdmissionFor, referenceConfigurationDigest, reviewedReferenceDataDigest, type ReviewedReferenceDataV1 } from "./generated-reviewed-reference-data.ts";
import type { BillingEnvironment, BillingConfig, BillingRepository, BillingProvider, Access } from "./billing.ts";
import { createCurrentOwnerSubscriptionAccess } from "./current-subscription-scope-bridge.server.ts";
import { inspectCurrentProviderReadiness } from "./current-provider-readiness.server.ts";
import type { AppleClient, ApplePolicy, AppleRepository } from "./apple-token-custody.server.ts";
import type { DeletionV2Policy, DeletionV2Repository } from "./account-deletion-v2.server.ts";
import type { AuthScopeInput, AuthScopeProof } from "./account-deletion-v2-auth.server.ts";

// Server entry only. No env discovery, source loading, provider request or
// account initialization during construction or inspect(). Main mounts these
// handlers in its private snapshot; canonical Next routes remain independent.
export type CurrentIntegrationHandler = (request: Request) => Promise<Response>;
export const CURRENT_INTEGRATION_ROUTES = Object.freeze({
  currentSession: "/api/v1/current/session", currentRead: "/api/v1/current/read",
  appleCredential: "/api/v1/account/apple-credential", deletion: "/api/v1/account/deletion-v2",
});
export const CURRENT_GUIDE_HEADERS = Object.freeze({ version: "X-WiseDinner-Guide-Policy", sha256: "X-WiseDinner-Guide-Policy-Sha256" });
type Route = keyof typeof CURRENT_INTEGRATION_ROUTES;
export type CurrentIntegrationSourceIdentity = Readonly<{
  sourceSha256: string; sourcePolicyBasisSha256: string; configurationSha256: string;
  reviewedDataSha256: string; evidenceManifestSha256: string;
  guidePolicy: Readonly<{ version: string; sha256: string }>;
  window: Readonly<{ firstDay: string; lastDay: string; commitBefore: number }>;
}>;
export type CurrentIntegrationSource = Readonly<{
  sourceSha256: string; sourcePolicyBasisSha256: string;
  reviewedReferenceData: ReviewedReferenceDataV1;
  referenceWindow: CurrentIntegrationSourceIdentity["window"];
  guidePolicy: CurrentIntegrationSourceIdentity["guidePolicy"];
  bind: CurrentOwnerServiceDependencies["bind"];
}>;
export type CurrentRetentionVerification = Readonly<{ outcome: "held" }> | Readonly<{
  outcome: "verified"; policySha256: string; evidenceSha256: string; validUntil: number;
}>;
// Frozen consumer contract only. The actual lifecycle, scope and retention
// implementations are injected after Main acceptance, never imported live.
export type CurrentLifecycleAdmission = Readonly<{
  enabled: boolean; origin: string; serverCredential: string;
  verify: (request: Request) => Promise<VerifiedAccount>;
  client?: AppleClient; keyVersion?: string; keyring?: ReadonlyMap<string, Buffer>;
  applePolicy?: ApplePolicy; deletionPolicy?: DeletionV2Policy;
  preflight?: (input: AuthScopeInput) => Promise<AuthScopeProof>;
  cleanup?: Readonly<{ verify(input: Readonly<{ policySha256: string; now: number }>): Promise<CurrentRetentionVerification> }>;
  request?: typeof fetch; now?: () => number;
  repositories?: Readonly<{ apple: AppleRepository; deletion: DeletionV2Repository }>;
}>;
export type CurrentLifecycleHandlers = Readonly<{ custody: CurrentIntegrationHandler; deletion: CurrentIntegrationHandler }>;
export type CurrentIntegrationRuntimeDependencies = Readonly<{
  hostOrigin?: string;
  flags?: Partial<Readonly<Record<Route, boolean>>>;
  supabase?: Readonly<{ origin: string; publicAuthKey: string; serverCredential: string }>;
  // Trusted ports must implement the same independent verification/SQL fences.
  // They are not customer DTOs or a substitute for real hosted acceptance.
  owner?: Readonly<{ identity: OwnerScopeDependencies; rpc: CurrentOwnerRpcDriver }>;
  subscription?: Readonly<{ environment: BillingEnvironment; repository: BillingRepository; provider: BillingProvider; config: BillingConfig }>;
  providerReadiness?: unknown;
  source?: Readonly<{ expected: CurrentIntegrationSourceIdentity; create(): CurrentIntegrationSource }>;
  lifecycle?: Readonly<{ admission?: CurrentLifecycleAdmission; create(admission?: CurrentLifecycleAdmission): CurrentLifecycleHandlers }>;
  request?: typeof fetch; now?: () => number;
}>;
type Readiness = Readonly<{ state: "off" | "configured" | "verified" | "unsupported"; code: string }>;
const TARGET = "https://zpvqxtklvjitofpbddrn.supabase.co";
const SHA = /^[a-f0-9]{64}$/;
const SOURCE = "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c";
const noAccess: Access = Object.freeze({ state: "unknown", allowed: false, rerollsIncluded: false, stale: true, reason: "not_verified", observedAt: 0, expiresAt: null });
const state = (value: Readiness["state"], code: string): Readiness => Object.freeze({ state: value, code });
function origin(value: unknown): value is string {
  try { if (typeof value !== "string") return false; const u = new URL(value); return u.protocol === "https:" && !u.username && !u.password && !u.port && !u.search && !u.hash && u.pathname === "/" && u.origin === value; } catch { return false; }
}
function credential(value: unknown, role: "anon" | "service_role"): value is string {
  if (typeof value !== "string" || !value || value.length > 8192 || /[\s\x00-\x1f\x7f]/.test(value)) return false;
  if (value.startsWith(role === "anon" ? "sb_publishable_" : "sb_secret_")) return value.length > 20;
  try { return object(JSON.parse(Buffer.from(value.split(".")[1] ?? "", "base64url").toString("utf8"))).role === role; } catch { return false; }
}
function isFinalV5(value: CurrentIntegrationSourceIdentity): boolean {
  return referenceConfigurationDigest(value) === referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY);
}
function fixedCurrentRevision(value: CurrentIntegrationSourceIdentity): 9 | 10 | 11 | null {
  if(referenceConfigurationDigest(value)===referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY))return 11;
  if(referenceConfigurationDigest(value)===referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY))return 10;
  const digest = referenceConfigurationDigest(value);
  return digest === referenceConfigurationDigest(CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY) ? 9 : null;
}
function sourceIdentity(value: CurrentIntegrationSourceIdentity): CurrentIntegrationSourceIdentity | null {
  try {
    const v = copyReferenceData(value) as CurrentIntegrationSourceIdentity;
    if ((v.sourceSha256 !== SOURCE && fixedCurrentRevision(v) === null) || ![v.sourcePolicyBasisSha256, v.configurationSha256, v.reviewedDataSha256, v.evidenceManifestSha256, v.guidePolicy.sha256].every(s => typeof s === "string" && SHA.test(s))
      || !/^[a-zA-Z0-9_.-]{1,100}$/.test(v.guidePolicy.version)
      || (!(v.window.firstDay === "2026-10-30" && v.window.lastDay === "2026-11-05" && v.window.commitBefore === Date.parse("2026-11-06T00:00:00Z")) && !isFinalV5(v) && fixedCurrentRevision(v) === null)) return null;
    return Object.freeze({ ...v, guidePolicy: Object.freeze({ ...v.guidePolicy }), window: Object.freeze({ ...v.window }) });
  } catch { return null; }
}
function checkedSource(value: CurrentIntegrationSource, expected: CurrentIntegrationSourceIdentity): CurrentIntegrationSource {
  const receiver = value; value = data(value);
  const p = copyReferenceData(value.reviewedReferenceData) as ReviewedReferenceDataV1;
  const { reviewedDataSha256, ...body } = p;
  const actual: CurrentIntegrationSourceIdentity = { sourceSha256: value.sourceSha256, sourcePolicyBasisSha256: value.sourcePolicyBasisSha256,
    configurationSha256: p.configurationSha256, reviewedDataSha256, evidenceManifestSha256: p.evidenceManifestSha256, guidePolicy: value.guidePolicy, window: value.referenceWindow };
  if (typeof value.bind !== "function" || p.schema !== "wd-reviewed-reference-data-v1" || p.reviewRevision !== (fixedCurrentRevision(expected) ?? (isFinalV5(expected) ? 5 : 4)) || p.sourcePin.recordCount !== 1300 || p.sourcePin.sha256 !== expected.sourceSha256
    || p.sourcePolicyBasis.basisSha256 !== expected.sourcePolicyBasisSha256 || reviewedReferenceDataDigest(body) !== reviewedDataSha256
    || referenceConfigurationDigest(p.configuration) !== expected.configurationSha256
    || referenceAdmissionDigest(referenceAdmissionFor(p)) !== expected.evidenceManifestSha256
    || referenceConfigurationDigest(p.window) !== referenceConfigurationDigest(expected.window)
    || referenceConfigurationDigest(actual) !== referenceConfigurationDigest(expected)) throw Error("source_identity_unavailable");
  // The producer's sealed binder independently validates full source/config and
  // applies guide eligibility. This digest check cannot create that authority.
  return Object.freeze({ ...value, guidePolicy: expected.guidePolicy, referenceWindow: expected.window, bind: method(receiver, "bind") });
}
// Capture own data only. Receivers are retained solely for calling captured
// methods, never spread/read again. Reflect.apply does not inspect function
// name/length/bind getters, and preserves repository methods using this.
function data<T>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("configuration");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(k => typeof k !== "string" || !("value" in descriptors[k]))) throw Error("configuration");
  return Object.fromEntries(Object.entries(descriptors).map(([k, d]) => [k, d.value])) as T;
}
function method<T extends object, K extends keyof T>(port: T, key: K): T[K] {
  const fn = data(port)[key]; if (typeof fn !== "function") throw Error("configuration");
  return ((...args: unknown[]) => Reflect.apply(fn, port, args)) as T[K];
}
function capturedAdmission(value: CurrentLifecycleAdmission | undefined): CurrentLifecycleAdmission | undefined {
  if (!value) return undefined;
  const v = data(value);
  return Object.freeze({ ...v, verify: method(value, "verify"),
    ...(v.now ? { now: method(value, "now") } : {}),
    ...(v.request ? { request: method(value, "request") } : {}),
    ...(v.preflight ? { preflight: method(value, "preflight") } : {}),
    ...(v.keyring ? { keyring: new Map([...Map.prototype.entries.call(v.keyring)].map(([k, b]) => [k, Buffer.from(b)])) } : {}),
    ...(v.client ? { client: Object.freeze({ ...data(v.client), keys: method(v.client, "keys"), exchange: method(v.client, "exchange"), revoke: method(v.client, "revoke") }) } : {}),
    ...(v.applePolicy ? { applePolicy: copyReferenceData(v.applePolicy) as ApplePolicy } : {}),
    ...(v.deletionPolicy ? { deletionPolicy: copyReferenceData(v.deletionPolicy) as DeletionV2Policy } : {}),
    ...(v.repositories ? { repositories: (() => { const r = data(v.repositories!); return Object.freeze({ apple: Object.freeze({ command: method(r.apple, "command") }), deletion: Object.freeze({ account: method(r.deletion, "account"), worker: method(r.deletion, "worker") }) }); })() } : {}),
    ...(v.cleanup ? { cleanup: Object.freeze({ verify: method(v.cleanup, "verify") }) } : {}),
  });
}
function unavailable(route: Route, code: string, status = 503): Response {
  const contract = route === "currentRead" ? "wd-current-owner-read-v1" : route === "appleCredential" ? "wd-apple-custody-v1" : route === "deletion" ? "wd-account-deletion-v2" : "wd-joined-session-proposal-v2";
  return Response.json({ contract, productionReady: false, result: { outcome: "held", code, retryAuthorized: false } }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
function noStore(response: Response): Response {
  // Rewrap without reading/teeing the body. Never decode or discard a committed
  // original ACK to manufacture an outer response/header validation failure.
  const headers = new Headers(response.headers); headers.set("Cache-Control", "no-store"); headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export function createCurrentIntegrationRuntime(deps: CurrentIntegrationRuntimeDependencies = {}) {
  // Invalid/accessor config becomes closed rather than executing a getter.
  let d: CurrentIntegrationRuntimeDependencies;
  try { d = data(deps); } catch { d = {}; }
  const host = d.hostOrigin;
  let flags: NonNullable<CurrentIntegrationRuntimeDependencies["flags"]> = {}, config: CurrentIntegrationRuntimeDependencies["supabase"];
  let suppliedOwner: CurrentIntegrationRuntimeDependencies["owner"];
  let now: () => number = Date.now, fetcher: typeof fetch = fetch;
  try {
    flags = Object.freeze(data(d.flags ?? {})); config = d.supabase && Object.freeze(data(d.supabase));
    if (d.now !== undefined) now = method(deps, "now")!;
    if (d.request !== undefined) fetcher = method(deps, "request")!;
    if (d.owner) { const o = data(d.owner); suppliedOwner = Object.freeze({ identity: Object.freeze({ verify: method(o.identity, "verify"), readAccount: method(o.identity, "readAccount") }), rpc: Object.freeze({ call: method(o.rpc, "call") }) }); }
  } catch { config = undefined; suppliedOwner = undefined; flags = {}; }
  const validHost = origin(host);
  const validConfig = !!config && config.origin === TARGET && credential(config.publicAuthKey, "anon") && credential(config.serverCredential, "service_role") && config.publicAuthKey !== config.serverCredential;
  const validOwner = validConfig;
  let subscription: CurrentIntegrationRuntimeDependencies["subscription"];
  try {
    if (d.subscription) {
      const b = data(d.subscription), c = data(b.config);
      const products = copyReferenceData(c.products) as string[];
      if (!["SANDBOX", "PRODUCTION"].includes(b.environment) || c.environment !== b.environment || c.entitlement !== "wisedinner_pro" || products.length !== 2 || new Set(products).size !== 2 || !products.includes("com.wisedinner.app.protein.weekly") || !products.includes("com.wisedinner.app.protein.yearly")) throw Error("billing_configuration");
      subscription = Object.freeze({ environment: b.environment, config: Object.freeze({ ...c, products: Object.freeze(products) }),
        repository: Object.freeze({ bind: method(b.repository, "bind"), begin: method(b.repository, "begin"), commit: method(b.repository, "commit"), enqueue: method(b.repository, "enqueue") }),
        provider: Object.freeze({ fetch: method(b.provider, "fetch") }) });
    }
  } catch { subscription = undefined; }
  const validBilling = !!subscription;
  let expected: CurrentIntegrationSourceIdentity | null = null, sourceFactory: (() => CurrentIntegrationSource) | undefined;
  try { if (d.source) { const src = data(d.source); expected = sourceIdentity(src.expected); sourceFactory = method(d.source, "create"); } } catch { /* held */ }
  let sourceState: Readiness = expected && sourceFactory ? state("configured", "source_not_loaded") : state("unsupported", "source_unavailable");
  let source: CurrentIntegrationSource | null = null, attemptedSource = false;
  let lifecycleFactory: NonNullable<CurrentIntegrationRuntimeDependencies["lifecycle"]>["create"] | undefined;
  let admission: CurrentLifecycleAdmission | undefined, validLifecycle = false;
  try { if (d.lifecycle) { const l = data(d.lifecycle); lifecycleFactory = method(d.lifecycle, "create"); admission = capturedAdmission(l.admission); validLifecycle = !admission || admission.origin === TARGET; } } catch { /* held */ }
  const providerReadiness = inspectCurrentProviderReadiness(d.providerReadiness);
  let owner: { identity: OwnerScopeDependencies; rpc: CurrentOwnerRpcDriver } | null = null;
  function ownerPorts() {
    if (owner) return owner;
    if (!validOwner || !config) throw Error("owner_configuration_unavailable");
    if (suppliedOwner) return owner = suppliedOwner;
    const verify = supabaseVerifier(config.origin, config.publicAuthKey, fetcher, now), accounts = supabaseAccountRepository(config.origin, config.publicAuthKey, fetcher);
    return owner = { identity: { verify, async readAccount(account) {
      const row = object(await accounts.execute(account, { action: "read", body: {}, key: null }));
      if (Object.keys(row).sort().join() !== "preferences,revision" || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1 || !row.preferences || typeof row.preferences !== "object" || Array.isArray(row.preferences)) throw new AccountError(503, "owner_state_invalid");
      return { userId: account.id, state: "active", revision: row.revision as number };
    } }, rpc: createCurrentOwnerSupabaseRpcDriver(config.origin, config.serverCredential, fetcher) };
  }
  async function bind(...args: Parameters<CurrentOwnerServiceDependencies["bind"]>) {
    if (!expected || !sourceFactory) return null;
    if (!attemptedSource) {
      attemptedSource = true;
      try { source = checkedSource(sourceFactory(), expected); sourceState = state("verified", "local_source_identity_matched"); }
      catch { sourceState = state("unsupported", "source_identity_unavailable"); }
    }
    if (!source) return null;
    const kernel = await source.bind(...args);
    // A changed/missing lease must be caught before executing any operation,
    // never by throwing away a possibly committed response afterward.
    if (!kernel || kernel.newWeekCommitBefore !== expected.window.commitBefore) return null;
    return { newWeekCommitBefore: kernel.newWeekCommitBefore, async handle(request: Request) {
      // The accepted pure evaluator also serves historic projections. At the
      // current route boundary a closed reference lease cannot price ANY new
      // evaluation/replacement. Independent original reads use currentRead and
      // remain available without this source or billing admission.
      let timestamp: number;
      try { timestamp = now(); } catch { timestamp = NaN; }
      if (!Number.isSafeInteger(timestamp) || timestamp < 0 || timestamp >= expected.window.commitBefore) {
        const response = Response.json({ contract: "wd-joined-session-proposal-v2", productionReady: false, result: { outcome: "error", code: Number.isSafeInteger(timestamp) && timestamp >= expected.window.commitBefore ? "reference_snapshot_expired" : "reference_clock_unavailable", saved: false } }, { status: 409, headers: { "Cache-Control": "no-store", "X-WiseDinner-Reference-Through": expected.window.lastDay } });
        return response;
      }
      const response = noStore(await kernel.handle(request));
      // Trusted immutable binder identity, never request-supplied authority.
      response.headers.set("X-WiseDinner-Source", expected.sourceSha256);
      response.headers.set("X-WiseDinner-Reference-Through", expected.window.lastDay);
      response.headers.set(CURRENT_GUIDE_HEADERS.version, expected.guidePolicy.version);
      response.headers.set(CURRENT_GUIDE_HEADERS.sha256, expected.guidePolicy.sha256);
      try { response.headers.set("X-WiseDinner-Clock-Utc", new Date(now()).toISOString()); } catch { /* Keep original outcome. */ }
      return response;
    } };
  }
  function routeStatus(route: Route): Readiness {
    if (flags[route] !== true) return state("off", "route_disabled");
    if (!validHost) return state("unsupported", "host_configuration_unavailable");
    if (route === "currentRead" || route === "currentSession") {
      if (!validOwner) return state("unsupported", "owner_configuration_unavailable");
      if (route === "currentSession" && (!expected || typeof sourceFactory !== "function" || sourceState.state === "unsupported")) return state("unsupported", "source_unavailable");
    } else if (!validLifecycle) return state("unsupported", "lifecycle_unavailable");
    // Configuration is never real Auth/provider/SDK/hosted acceptance.
    return state("configured", "handler_configured");
  }
  function wrap(route: Route): CurrentIntegrationHandler {
    return async request => {
      const readiness = routeStatus(route); if (readiness.state !== "configured") return unavailable(route, readiness.code);
      try {
        const url = new URL(request.url);
        if (url.origin !== host || url.pathname !== CURRENT_INTEGRATION_ROUTES[route] || url.search || url.hash) return unavailable(route, "runtime_identity_mismatch", 409);
        if (request.method !== "POST") return unavailable(route, "method_not_allowed", 405);
        if (request.signal.aborted) return unavailable(route, "request_aborted", 499);
        if (route === "currentRead") return noStore(await createCurrentOwnerReadService({ enabled: true, ...ownerPorts() })(request));
        if (route === "currentSession") {
          const headers = [["X-WiseDinner-Source", expected!.sourceSha256], [CURRENT_GUIDE_HEADERS.version, expected!.guidePolicy.version], [CURRENT_GUIDE_HEADERS.sha256, expected!.guidePolicy.sha256]];
          if (headers.some(([key, value]) => request.headers.has(key) && request.headers.get(key) !== value)) return unavailable(route, "runtime_identity_mismatch", 409);
          return noStore(await createCurrentOwnerIntegrationHandler({ enabled: true, ...ownerPorts(), access: validBilling ? createCurrentOwnerSubscriptionAccess(request, { enabled: true, identity: ownerPorts().identity, repository: subscription!.repository, provider: subscription!.provider, config: subscription!.config, now }) : async () => noAccess, bind, now })(request));
        }
        // Request-local pair. Missing key/policy/cleanup is handled by the
        // accepted lifecycle, after independently admitted original recovery.
        // No prepare/provider probe or body consumption occurs in this layer.
        const pair = lifecycleFactory!(capturedAdmission(admission));
        const handler = method(pair, route === "appleCredential" ? "custody" : "deletion");
        return noStore(await handler(request));
      } catch { return unavailable(route, "runtime_unavailable"); }
    };
  }
  const routes = Object.freeze({ currentSession: wrap("currentSession"), currentRead: wrap("currentRead"), appleCredential: wrap("appleCredential"), deletion: wrap("deletion") });
  return Object.freeze({ routes, sourceManifest: CURRENT_INTEGRATION_SOURCE_MANIFEST, inspect() {
    return Object.freeze({ productionReady: false, routes: Object.freeze(Object.fromEntries((Object.keys(CURRENT_INTEGRATION_ROUTES) as Route[]).map(key => [key, routeStatus(key)]))),
      source: sourceState, providerReadiness, subscription: validBilling ? state("configured", "provider_operation_not_verified") : state("unsupported", "subscription_unavailable"),
      verification: Object.freeze({ hosted: false, provider: false, native: false, device: false }) });
  } });
}

// A closed superset of current transitive runtime dependencies, not a file
// discovery side effect or secret-value projection. Main repins all bytes and
// expands accepted peer graphs before assembling the private HTTPS snapshot.
export const CURRENT_INTEGRATION_SOURCE_MANIFEST = Object.freeze({
  routes: CURRENT_INTEGRATION_ROUTES,
  entry: "lib/current-integration-runtime.server.ts",
  requiredPeerModules: Object.freeze(["lib/current-account-lifecycle.server.ts", "lib/generated-current-guide-policy.ts", "lib/current-auth-scope.server.ts", "lib/current-retention-cleanup.server.ts", "lib/current-subscription-runtime.server.ts", "lib/current-provider-readiness.server.ts"]),
  peerGraphsAccepted: false,
  environmentNames: Object.freeze(["SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY", "REVENUECAT_SECRET_API_KEY", "WD_BILLING_ENVIRONMENT", "WD_CURRENT_OWNER_API_ENABLED", "WD_CURRENT_OWNER_READ_API_ENABLED", "WD_ACCOUNT_DELETION_V2_ENABLED", "WD_ACCOUNT_DELETION_V2_RETENTION_POLICY"]),
  codeAndAssets: Object.freeze([
    "lib/current-integration-reference-v11.server.ts", "lib/generated-current-source-capsule-v11.json",
    "lib/fixtures/current-original-batch-guide-bindings-v1.json",
    "lib/fixtures/current-reviewed-practical-guides-v1.json",
    "lib/generated-current-guide-policy.ts",
    "lib/generated-current-meal-coverage.ts",

    "lib/current-integration-runtime.server.ts", "lib/generated-current-source-capsule-v4.json",
    "lib/current-integration-reference-v5.server.ts", "lib/generated-current-source-capsule-v5.json",
    "lib/current-subscription-scope-bridge.server.ts", "lib/current-provider-readiness.server.ts", "lib/billing-restore.ts",
    "lib/account-deletion-v2-auth.server.ts",
    "lib/account-deletion-v2.server.ts",
    "lib/account-deletion.ts",
    "lib/account.ts",
    "lib/apple-revocation.server.ts",
    "lib/apple-token-custody.server.ts",
    "lib/billing.ts",
    "lib/current-owner-read.server.ts",
    "lib/generated-current-owner-server.ts",
    "lib/generated-current-owner-service.ts",
    "lib/generated-current-reviewed-source.ts",
    "lib/generated-current-rpc-driver.ts",
    "lib/generated-current-rpc-state.ts",
    "lib/generated-household-allergies.ts",
    "lib/generated-joined-plan.ts",
    "lib/generated-nominal-density.ts",
    "lib/generated-nominal-egg.ts",
    "lib/generated-nominal-preparation-yield.ts",
    "lib/generated-owner-scope.ts",
    "lib/generated-person-plan.ts",
    "lib/generated-plan-alternatives.ts",
    "lib/generated-plan-catalog.ts",
    "lib/generated-plan-change.ts",
    "lib/generated-plan-data.ts",
    "lib/generated-plan-images.ts",
    "lib/generated-plan-json.ts",
    "lib/generated-plan-operations.ts",
    "lib/generated-plan-pantry-basis.ts",
    "lib/generated-plan-pantry.ts",
    "lib/generated-plan-presenter.ts",
    "lib/generated-plan-protein-tolerance.ts",
    "lib/generated-plan-quote.ts",
    "lib/generated-plan-search.ts",
    "lib/generated-plan-session.ts",
    "lib/generated-plan-shopping.ts",
    "lib/generated-plan-state.ts",
    "lib/generated-regional-quote.ts",
    "lib/generated-retailer-reference.ts",
    "lib/generated-reviewed-method-lineage.ts",
    "lib/generated-reviewed-practical-seals-v2.json",
    "lib/generated-reviewed-reference-data.ts",
    "lib/generated-runtime-bytes.ts",
    "lib/generated-runtime-error.ts",
    "lib/generated-runtime-http.ts",
    "lib/generated-runtime-identity.ts",
    "lib/generated-source-clock.ts",
    "lib/generated-source-policy-basis-v2.ts",
    "lib/generated-tap-cooking-water.ts",
    "lib/owner-plan-codec.ts",
    "packages/solver/src/generated-meal-ranges.ts",
    "packages/solver/src/generated-plan-contract.ts",
    "packages/solver/src/generated-plan-measures.ts",
    "packages/solver/src/generated-plan-requirements.ts",
    "packages/solver/src/types.ts",
    "packages/solver/src/units.ts",
    "scripts/data/authored/skus.ts",
    "scripts/data/authored/stores.ts",
    "scripts/data/price-evidence.ts",
    "scripts/data/store-estimate-model.ts",
    "scripts/data/store-estimates.ts",
  ]),
});
