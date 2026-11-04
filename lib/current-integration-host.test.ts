import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCurrentIntegrationHost, withCurrentIntegrationHostResolver, resolveCurrentIntegrationServerConfiguration, loadCurrentIntegrationHostSource, resolveCurrentIntegrationProductionConfiguration } from "./current-integration-host.server.ts";
import { CURRENT_INTEGRATION_ROUTES, type CurrentIntegrationRuntimeDependencies, type CurrentIntegrationSource, type CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";
import { POST as sessionPOST } from "../app/api/v1/current/session/route.ts";
import { POST as readPOST } from "../app/api/v1/current/read/route.ts";
import { POST as applePOST } from "../app/api/v1/account/apple-credential/route.ts";
import { POST as deletionPOST } from "../app/api/v1/account/deletion-v2/route.ts";
import { supabaseVerifier, supabaseAccountRepository, object } from "./account.ts";
import { supabaseBillingRepository, revenueCatProvider } from "./billing.ts";
import { createCurrentOwnerSupabaseRpcDriver } from "./generated-current-rpc-driver.ts";
import { admitVerifiedReferenceOwner, isIssuedVerifiedOwnerScope } from "./generated-owner-scope.ts";
import { createCurrentOwnerSubscriptionAccess } from "./current-subscription-scope-bridge.server.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { createCurrentAccountLifecycle, type LifecycleAdmission } from "./current-account-lifecycle.server.ts";
import { createReferenceSessionHandlerV2 } from "./generated-plan-session.ts";
import { syntheticV2 } from "./generated-plan-v2.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { createHash } from "node:crypto";

// Load the unchanged native consumer at runtime. Its separate App compiler
// target is not added to this backend project's ES2017 compilation unit.
const nativeDecoderUrl = new URL("../../wisedinner-app/src/features/current-ui/owner-read-validation.ts", import.meta.url);
const { decodeOwnerRead } = await import(nativeDecoderUrl.href);
const nativeDeletionUrl = new URL("../../wisedinner-app/src/features/current-ui/owner-deletion-v2.ts", import.meta.url);
const { createOwnerDeletionController, admitDeletionReadiness } = await import(nativeDeletionUrl.href);

// Fake TRANSPORT payloads only. The actual HTTP exports, host/runtime, issuer,
// Supabase adapters, billing reconcileAccess and current/read parsers execute.
// No SQL/PGlite or network; this is not the original150/150/7 feasibility gate.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;
type Route = keyof typeof CURRENT_INTEGRATION_ROUTES;
const HOST = "https://host.synthetic.invalid", TARGET = "https://zpvqxtklvjitofpbddrn.supabase.co";
const NOW = Date.parse("2026-10-31T12:00:00Z"), WEEK = "com.wisedinner.app.protein.weekly", YEAR = "com.wisedinner.app.protein.yearly";
const key = (role: string) => "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".synthetic";
const handlers = { currentSession: sessionPOST, currentRead: readPOST, appleCredential: applePOST, deletion: deletionPOST };
let sequence = 20000, sharedSource: CurrentIntegrationSource | undefined;
function actualSource() { return sharedSource ??= loadCurrentIntegrationHostSource(() => NOW); }
function identityOf(source: CurrentIntegrationSource): CurrentIntegrationSourceIdentity {
  const p = source.reviewedReferenceData;
  return { sourceSha256: source.sourceSha256, sourcePolicyBasisSha256: source.sourcePolicyBasisSha256,
    configurationSha256: p.configurationSha256, reviewedDataSha256: p.reviewedDataSha256, evidenceManifestSha256: p.evidenceManifestSha256,
    guidePolicy: source.guidePolicy, window: source.referenceWindow };
}
function envelope(operation = "capabilities", payload: unknown = {}, extra: Record<string, unknown> = {}) {
  const s = actualSource();
  const value = { contract: "wd-joined-session-proposal-v2", operation, operationId: randomUUID(), sourceSha256: s.sourceSha256,
    expectedSourcePolicyBasisSha256: s.sourcePolicyBasisSha256, payload, ...extra };
  return { ...value, intentSha256: referenceOperationDigest(value) };
}
function fixture() {
  const n = ++sequence, A = "10000000-0000-4000-8000-" + String(n).padStart(12, "0"), B = "10000000-0000-4000-8000-" + String(n + 100000).padStart(12, "0");
  const ids = new Map([[A, "wd_" + A], [B, "wd_" + B]]), revisions = new Map([[A, 1], [B, 1]]);
  const calls: { kind: string; owner: string; body?: Data }[] = [];
  let clock = NOW, original: Request | undefined, flip: (() => void) | undefined, failed = false, authOwner: string | undefined, period = "normal";
  let accountError = false, expiredProvider = false, stored: Data | undefined;
  const token = (id: string) => "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ sub: id, iss: TARGET + "/auth/v1", aud: "authenticated", role: "authenticated", exp: Math.floor(clock / 1000) + 3600 })).toString("base64url") + ".synthetic";
  const transport: typeof fetch = async (input, init) => {
    const url = new URL(String(input)), headers = new Headers(init?.headers);
    if (url.origin === TARGET) {
      const userToken = headers.get("authorization")?.slice(7) ?? "";
      if (url.pathname === "/auth/v1/user") {
        const claims = JSON.parse(Buffer.from(userToken.split(".")[1], "base64url").toString("utf8")), owner = authOwner ?? claims.sub;
        calls.push({ kind: "auth", owner }); assert.equal(headers.get("apikey"), key("anon"));
        return Response.json({ id: owner, is_anonymous: false, email_confirmed_at: "2026-10-01T00:00:00Z", identities: [{ provider: "email" }] });
      }
      const body = JSON.parse(String(init?.body));
      if (url.pathname.endsWith("/wd_account_command")) {
        const owner = JSON.parse(Buffer.from(userToken.split(".")[1], "base64url").toString("utf8")).sub;
        calls.push({ kind: "account", owner });
        return Response.json(accountError ? { error: "account_inactive" } : { preferences: {}, revision: revisions.get(owner) });
      }
      assert.equal(headers.get("apikey"), key("service_role"));
      if (url.pathname.endsWith("/wd_billing_command")) {
        const owner = body.p_body.userId; assert.ok(ids.has(owner)); calls.push({ kind: "billing:" + body.p_action, owner, body: body.p_body });
        if (body.p_action === "begin") return Response.json({ generation: 1, binding: { appUserId: ids.get(owner), held: false }, cached: null });
        if (body.p_action === "commit") return Response.json(body.p_body.state);
        throw Error("unexpected billing mutation");
      }
      assert.ok(url.pathname.endsWith("/wd_current_plan_rpc"));
      const owner = body.p_owner; assert.ok(ids.has(owner));
      assert.equal(body.p_account_revision, revisions.get(owner));
      assert.equal(body.p_scope_key, hash({ protocol: "joined-session-v2", namespace: "wd-current-catalog-1300-v1/" + owner }));
      calls.push({ kind: "rpc:" + body.p_action, owner, body });
      assert.notEqual(body.p_action, "commit", "malformed write must not persist a plan");
      return Response.json(body.p_action === "read_state" ? { state: null, meta: null }
        : { operation: owner === A ? stored ?? null : null, meta: null, operationRecordSha256: owner === A && stored ? hash(stored) : null });
    }
    assert.equal(url.origin, "https://api.revenuecat.com");
    const bound = decodeURIComponent(url.pathname.split("/").at(-1)!);
    const owner = [...ids].find(([, id]) => id === bound)?.[0]; assert.ok(owner);
    calls.push({ kind: "provider", owner }); if (flip) { const action = flip; flip = undefined; action(); }
    if (failed) throw Error("private-provider-failure");
    const iso = (n: number) => new Date(n).toISOString();
    const expires = expiredProvider ? clock - 1 : clock + 100000;
    return Response.json({ request_date_ms: clock, subscriber: { original_app_user_id: bound,
      entitlements: { wisedinner_pro: { product_identifier: WEEK, expires_date: iso(expires) } },
      subscriptions: { [WEEK]: { store: "app_store", is_sandbox: true, ownership_type: "PURCHASED", period_type: period, purchase_date: iso(clock - 10000), expires_date: iso(expires), store_transaction_id: "synthetic-transaction-" + owner } } } });
  };
  const verify = supabaseVerifier(TARGET, key("anon"), transport, () => clock), accounts = supabaseAccountRepository(TARGET, key("anon"), transport);
  const identity = {
    async verify(r: Request) { assert.equal(r, original, "the SAME original Request reaches every real verifier"); return verify(r); },
    async readAccount(a: Awaited<ReturnType<typeof verify>>) {
      const row = object(await accounts.execute(a, { action: "read", body: {}, key: null }));
      assert.deepEqual(Object.keys(row).sort(), ["preferences", "revision"]);
      return { userId: a.id, state: "active" as const, revision: row.revision as number };
    },
  };
  const config = { environment: "SANDBOX" as const, entitlement: "wisedinner_pro", products: [WEEK, YEAR] };
  const repository = supabaseBillingRepository(TARGET, key("service_role"), transport), provider = revenueCatProvider("synthetic-private-provider-key", transport);
  const deps: CurrentIntegrationRuntimeDependencies = { hostOrigin: HOST, supabase: { origin: TARGET, publicAuthKey: key("anon"), serverCredential: key("service_role") },
    owner: { identity, rpc: createCurrentOwnerSupabaseRpcDriver(TARGET, key("service_role"), transport) },
    subscription: { environment: "SANDBOX", config, repository, provider }, flags: { currentSession: true, currentRead: true }, request: transport, now: () => clock };
  const attachSource = () => { const source = actualSource(); return { ...deps, source: { expected: identityOf(source), create: () => source } }; };
  const makeRequest = (route: Route, body: unknown, owner = A) => new Request(HOST + CURRENT_INTEGRATION_ROUTES[route], {
    method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + token(owner) }, body: JSON.stringify(body) });
  async function send(route: Route, body: unknown, owner = A, configured: CurrentIntegrationRuntimeDependencies = attachSource()) {
    const request = makeRequest(route, body, owner); original = request;
    return withCurrentIntegrationHostResolver({ resolve(r, which) { assert.equal(r, request); assert.equal(which, route); assert.equal(r.bodyUsed, false); return configured; } },
      async () => { const response = await handlers[route](request); return { status: response.status, body: await response.json(), headers: response.headers }; });
  }
  return { A, B, calls, deps, config, identity, repository, provider, makeRequest, send, attachSource, setOriginal: (r: Request) => { original = r; },
    flip: (action: () => void) => { flip = action; }, switchAuth: () => { authOwner = B; }, revision: () => { revisions.set(A, revisions.get(A)! + 1); },
    deactivate: () => { accountError = true; }, fail: () => { failed = true; }, expire: () => { expiredProvider = true; }, trial: () => { period = "trial"; }, clock: (n: number) => { clock = n; }, store: (s: Data) => { stored = s; } };
}

test("native decoder accepts actual read HTTP disabled/missing configuration without consuming the request or invoking ports", async () => {
  const f = fixture(), requestId = randomUUID();
  const body = { contract: "wd-current-owner-read-v1", operation: "metadata", requestId, target: "current" };
  for (const [deps, code] of [
    [{}, "current_owner_read_disabled"],
    [{ ...f.deps, flags: { currentRead: false } }, "current_owner_read_disabled"],
    [{ ...f.deps, hostOrigin: undefined }, "owner_read_unavailable"],
    [{ ...f.deps, supabase: undefined, owner: undefined }, "owner_read_unavailable"],
    // The accepted runtime closes all flags when supplied ports are malformed.
    [{ ...f.deps, owner: { identity: {}, rpc: {} } }, "current_owner_read_disabled"],
  ] as const) {
    const request = f.makeRequest("currentRead", body); f.setOriginal(request);
    const response = await withCurrentIntegrationHostResolver({ resolve: () => deps as CurrentIntegrationRuntimeDependencies }, () => readPOST(request));
    assert.equal(response.status, 503); assert.equal(request.bodyUsed, false);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal(response.headers.get("x-content-type-options"), "nosniff");
    const wire = await response.text();
    assert.deepEqual(decodeOwnerRead(wire, { requestId, operation: "metadata", owner: f.A, target: "current" }, response.status), { outcome: "unavailable", code });
    assert.deepEqual(JSON.parse(wire), { contract: body.contract, result: { outcome: "held", code } });
  }
  assert.equal(f.calls.length, 0);
});

test("native decoder accepts actual read HTTP resolver/runtime/service failures with sanitized no-retry unavailability", async () => {
  const f = fixture(), requestId = randomUUID();
  const body = { contract: "wd-current-owner-read-v1", operation: "metadata", requestId, target: "current" };
  class BrokenUrlRequest extends Request { get url(): string { throw Error("synthetic-private-runtime-failure"); } }
  for (const kind of ["resolver", "runtime", "service"] as const) {
    const request = kind === "runtime" ? new BrokenUrlRequest(HOST + CURRENT_INTEGRATION_ROUTES.currentRead, { method: "POST", body: JSON.stringify(body) }) : f.makeRequest("currentRead", body);
    f.setOriginal(request);
    const response = await withCurrentIntegrationHostResolver({ resolve() {
      if (kind === "resolver") throw Error("synthetic-private-resolver-failure");
      return kind === "service" ? { ...f.deps, owner: { ...f.deps.owner!, identity: { ...f.identity, verify: async () => { throw Error("synthetic-private-identity-failure"); } } } } : f.deps;
    } }, () => readPOST(request));
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
    if (kind !== "service") assert.equal(request.bodyUsed, false);
    const wire = await response.text(); assert.equal(wire.includes("synthetic-private"), false);
    const reply = decodeOwnerRead(wire, { requestId, operation: "metadata", owner: f.A, target: "current" }, response.status);
    assert.deepEqual(reply, { outcome: "unavailable", code: "owner_read_unavailable" });
    assert.equal(Object.hasOwn(reply, "saved"), false); assert.equal(Object.hasOwn(reply, "disposition"), false);
    assert.equal(Object.hasOwn(reply, "retryAuthorized"), false);
  }
  assert.equal(f.calls.length, 0);
});

test("native decoder accepts unchanged successful read HTTP metadata for A/B/A without billing or source", async () => {
  const f = fixture();
  for (const owner of [f.A, f.B, f.A]) {
    const requestId = randomUUID(), r = await f.send("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId, target: "current" }, owner, f.deps);
    assert.equal(r.status, 200); assert.equal(r.headers.get("cache-control"), "no-store");
    assert.equal(r.body.requestId, requestId);
    assert.deepEqual(decodeOwnerRead(JSON.stringify(r.body), { requestId, operation: "metadata", owner, target: "current" }, r.status), { outcome: "metadata", stateRevision: 0, target: "current", week: null });
  }
  assert.equal(f.calls.some(c => c.kind === "provider" || c.kind.startsWith("billing:") || c.kind === "rpc:commit"), false);
});

test("actual four exported POST handlers delegate original Request through a private receiver-safe resolver; defaults off", async () => {
  let gets = 0, calls = 0;
  const resolve = function (this: { marker: string }, r: Request) { assert.equal(this.marker, "captured"); assert.equal(r.bodyUsed, false); calls++; return {}; };
  Object.defineProperty(resolve, "name", { get() { gets++; throw Error("name"); } });
  Object.defineProperty(resolve, "bind", { get() { gets++; throw Error("bind"); } });
  for (const route of Object.keys(handlers) as Route[]) {
    const request = new Request(HOST + CURRENT_INTEGRATION_ROUTES[route], { method: "POST", body: "{}" });
    const resolver = { marker: "captured", resolve };
    const response = await withCurrentIntegrationHostResolver(resolver, () => handlers[route](request));
    assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store"); assert.equal(request.bodyUsed, false);
  }
  assert.equal(calls, 4); assert.equal(gets, 0);
});

test("pure construction/inspect and server configuration reject getters, inherited ports and absent metadata with no effects", () => {
  let effects = 0;
  const forbidden = () => { effects++; throw Error("must not call"); };
  createCurrentIntegrationHost({ hostOrigin: HOST, request: forbidden, source: { expected: {} as CurrentIntegrationSourceIdentity, create: forbidden } }).inspect();
  const getter = Object.defineProperty({}, "WD_CURRENT_OWNER_API_ENABLED", { get() { effects++; return "true"; } });
  assert.deepEqual(resolveCurrentIntegrationServerConfiguration(getter), {});
  const nested = Object.defineProperty({}, "verify", { get() { effects++; return forbidden; } });
  createCurrentIntegrationHost({ owner: { identity: nested, rpc: {} } } as CurrentIntegrationRuntimeDependencies).inspect();
  assert.throws(() => withCurrentIntegrationHostResolver(Object.defineProperty({}, "resolve", { get() { effects++; return forbidden; } }) as never, forbidden));
  const inherited = Object.create({ get resolve() { effects++; return forbidden; } });
  assert.throws(() => withCurrentIntegrationHostResolver(inherited, forbidden));
  const c = resolveCurrentIntegrationServerConfiguration({ WD_CURRENT_INTEGRATION_HOST_ORIGIN: HOST, SUPABASE_URL: TARGET, SUPABASE_ANON_KEY: key("anon"), SUPABASE_SERVICE_ROLE_KEY: key("service_role"),
    WD_CURRENT_OWNER_API_ENABLED: "true", WD_REVENUECAT_CONFIGURATION_VERIFIED: "true", WD_CURRENT_OWNER_READ_API_ENABLED: "true", WD_BILLING_ENVIRONMENT: "SANDBOX", REVENUECAT_SECRET_API_KEY: "synthetic" });
  const inspected = createCurrentIntegrationHost(c).inspect();
  assert.equal(inspected.routes.currentSession.state, "unsupported"); assert.equal(inspected.routes.currentRead.state, "configured"); assert.equal(inspected.subscription.state, "unsupported");
  assert.equal(effects, 0);
});

test("actual exported session lazily binds sealed currentV4/guide after real Auth issuer; capabilities are not a paid grant", async () => {
  const f = fixture(), deps = f.attachSource(); let loads = 0;
  deps.source = { ...deps.source!, create() { loads++; assert.ok(f.calls.some(c => c.kind === "account")); return actualSource(); } };
  const host = createCurrentIntegrationHost(deps); host.inspect(); assert.equal(loads, 0); assert.equal(f.calls.length, 0);
  const r = await f.send("currentSession", envelope("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1" }), f.A, deps);
  assert.equal(r.status, 200); assert.equal(loads, 1); assert.equal(r.body.result.reviewedReferenceData.reviewRevision, 4); assert.equal(r.body.result.reviewedReferenceData.sourcePin.recordCount, 1300);
  assert.equal(r.headers.get("X-WiseDinner-Guide-Policy-Sha256"), actualSource().guidePolicy.sha256);
  assert.equal(f.calls.some(c => c.kind === "provider"), false);
});

test("actual POST mutations execute real Supabase billing repository + revenueCatProvider + reconcileAccess for active/trial", async () => {
  for (const trial of [false, true]) {
    const f = fixture(); if (trial) f.trial();
    const r = await f.send("currentSession", envelope("saveCurrent"));
    assert.notEqual(r.status, 403); assert.notEqual(r.status, 503);
    const commits = f.calls.filter(c => c.kind === "billing:commit"); assert.ok(commits.length);
    assert.equal(commits[0].body!.state.state, trial ? "trial" : "active"); assert.equal(commits[0].body!.state.reason, "provider_verified");
    assert.ok(f.calls.some(c => c.kind === "provider")); assert.equal(f.calls.some(c => c.kind === "rpc:commit"), false);
    assert.doesNotMatch(JSON.stringify(r.body), /synthetic-private-provider-key|synthetic-transaction/);
  }
});

test("A/B/A actual HTTP reads and paid checks never share owner or access closure; concurrent resolver contexts stay isolated", async () => {
  const f = fixture();
  for (const owner of [f.A, f.B, f.A]) {
    const start = f.calls.length;
    const r = await f.send("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }, owner);
    assert.equal(r.status, 200); assert.equal(r.body.result.outcome, "metadata");
    assert.ok(f.calls.slice(start).every(c => c.owner === owner)); assert.equal(f.calls.slice(start).some(c => c.kind === "provider"), false);
    const paid = await f.send("currentSession", envelope("saveCurrent"), owner); assert.notEqual(paid.status, 403);
  }
  const a = fixture(), b = fixture();
  const read = (x: ReturnType<typeof fixture>) => x.send("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" });
  const results = await Promise.all([read(a), read(b)]); assert.ok(results.every(r => r.status === 200));
  assert.ok(a.calls.every(c => c.owner === a.A)); assert.ok(b.calls.every(c => c.owner === b.A));
});

test("owner/revision/inactive flip during real provider await and unknown provider cannot authorize actual exported write", async () => {
  for (const mode of ["owner", "revision", "inactive", "unknown", "expired"] as const) {
    const f = fixture();
    if (mode === "unknown") f.fail(); else if (mode === "expired") f.expire(); else f.flip(mode === "owner" ? f.switchAuth : mode === "revision" ? f.revision : f.deactivate);
    const r = await f.send("currentSession", envelope("saveCurrent"));
    assert.equal(r.status, 403, mode); assert.equal(r.body.error, "verified_membership_required");
    assert.equal(f.calls.some(c => c.kind.startsWith("rpc:")), false);
  }
});

test("client owner/revision/storageKey cannot override actual issuer; genuine foreign and forged scopes never grant", async () => {
  const f = fixture();
  const r = await f.send("currentSession", envelope("saveCurrent", { ownerId: f.B, accountRevision: 999, storageKey: "forged" }));
  assert.notEqual(r.status, 403); assert.ok(f.calls.every(c => c.owner === f.A)); assert.equal(f.calls.some(c => c.kind === "rpc:commit"), false);
  const request = f.makeRequest("currentSession", {}); f.setOriginal(request);
  const owner = await admitVerifiedReferenceOwner(request, f.identity); assert.equal(owner.outcome, "ready");
  if (owner.outcome !== "ready") throw Error("fixture owner unavailable"); assert.equal(isIssuedVerifiedOwnerScope(owner), true);
  const bridge = createCurrentOwnerSubscriptionAccess(request, { enabled: true, identity: f.identity, repository: f.repository, provider: f.provider, config: f.config, now: () => NOW });
  const before = f.calls.length;
  for (const forged of [{ ...owner }, { ...owner, ownerId: f.B }, { ...owner, storageKey: "forged" }, { ...owner, accountRevision: 999 }]) assert.equal((await bridge(forged)).allowed, false);
  assert.equal(f.calls.length, before); assert.throws(() => Object.defineProperty(owner, "storageKey", { value: "forged" }));
  const foreignRequest = f.makeRequest("currentSession", {}, f.B); f.setOriginal(foreignRequest);
  const foreign = await admitVerifiedReferenceOwner(foreignRequest, f.identity); assert.equal(foreign.outcome, "ready");
  if (foreign.outcome !== "ready") throw Error("foreign fixture unavailable");
  assert.notEqual(foreign.storageKey, owner.storageKey); f.setOriginal(request);
  const start = f.calls.length; assert.equal((await bridge(foreign)).allowed, false);
  assert.ok(f.calls.slice(start).every(c => c.kind === "auth" || c.kind === "account"), "genuine foreign scope cannot reach billing or provider");
});

function serverMetadataConfiguration() {
  const manifest = "d".repeat(64), scopes = { weekly_product: "a".repeat(64), yearly_product: "b".repeat(64) };
  const metadata = { version: 2, evaluatedAt: new Date(NOW).toISOString(), environment: "sandbox", region: "USA",
    auth: { environment: "sandbox", region: "USA", supabaseConfigured: true, otpFlow: "email_code" },
    email: { environment: "sandbox", region: "USA", provider: "unknown", domainConfigured: false, smtpConfigured: false },
    subscription: { configured: true, environment: "sandbox", region: "USA", weeklyProductId: WEEK, weeklyPriceCents: 400,
      yearlyProductId: YEAR, yearlyPriceCents: 14900, entitlementId: "wisedinner_pro", trial: { weekly: { days: null }, yearly: { days: null } } },
    evidence: { collectorManifestSha256: manifest, expectedCollectorManifestSha256: manifest, expectedScopeFingerprints: scopes,
      receipts: (["weekly_product", "yearly_product"] as const).map(kind => ({ kind, level: "external", environment: "sandbox", region: "USA",
        productId: kind === "weekly_product" ? WEEK : YEAR, entitlementId: "wisedinner_pro", scopeSha256: scopes[kind], evidenceSha256: "c".repeat(64),
        collectorManifestSha256: manifest, collectedAt: new Date(NOW - 1000).toISOString(), validUntil: new Date(NOW + 1000).toISOString() })) } };
  return { WD_CURRENT_INTEGRATION_HOST_ORIGIN: HOST, SUPABASE_URL: TARGET, SUPABASE_ANON_KEY: key("anon"), SUPABASE_SERVICE_ROLE_KEY: key("service_role"),
    WD_CURRENT_OWNER_API_ENABLED: "true", WD_REVENUECAT_CONFIGURATION_VERIFIED: "true", WD_CURRENT_OWNER_READ_API_ENABLED: "true",
    WD_BILLING_ENVIRONMENT: "SANDBOX", REVENUECAT_SECRET_API_KEY: "synthetic-server-key", WD_CURRENT_SOURCE_IDENTITY_JSON: JSON.stringify(identityOf(actualSource())),
    WD_CURRENT_PROVIDER_READINESS_JSON: JSON.stringify(metadata) };
}

test("server metadata is evaluated at actual request clock without renewing receipts; stale/absent evidence holds billing only", () => {
  const env = serverMetadataConfiguration(), original = env.WD_CURRENT_PROVIDER_READINESS_JSON;
  const fresh = createCurrentIntegrationHost(resolveCurrentIntegrationServerConfiguration(env, () => NOW)).inspect();
  assert.equal(fresh.subscription.state, "configured"); assert.equal(fresh.providerReadiness.subscription.status, "externally_accepted");
  assert.equal(fresh.providerReadiness.subscription.purchase.weekly, "pending"); assert.equal(fresh.verification.provider, false);
  assert.deepEqual(fresh.providerReadiness.subscription.trial, { weekly: "not_configured", yearly: "not_configured" });
  const stale = createCurrentIntegrationHost(resolveCurrentIntegrationServerConfiguration(env, () => NOW + 2000)).inspect();
  assert.equal(stale.subscription.state, "unsupported"); assert.equal(stale.routes.currentRead.state, "configured");
  assert.ok(stale.providerReadiness.issues.includes("evidence_stale")); assert.equal(env.WD_CURRENT_PROVIDER_READINESS_JSON, original);
  const absent = createCurrentIntegrationHost(resolveCurrentIntegrationServerConfiguration({ ...env, WD_CURRENT_PROVIDER_READINESS_JSON: "" }, () => NOW)).inspect();
  assert.equal(absent.subscription.state, "unsupported"); assert.equal(absent.routes.currentRead.state, "configured");
});

test("maintained server source factory/cache is consumed through actual POST with real owner ports, not an unused resolver", async () => {
  const f = fixture(), clock = () => NOW, env = serverMetadataConfiguration();
  const first = resolveCurrentIntegrationServerConfiguration(env, clock), second = resolveCurrentIntegrationServerConfiguration(env, clock);
  assert.ok(first.source); assert.ok(second.source);
  createCurrentIntegrationHost(first).inspect(); assert.equal(f.calls.length, 0);
  // Actual accepted factories with fake transport ports; no global fetch patch
  // and no invocation of the default real provider transport.
  const deps = { ...first, owner: f.deps.owner, request: f.deps.request, subscription: f.deps.subscription };
  const a = await f.send("currentSession", envelope(), f.A, deps); assert.equal(a.status, 200);
  const source = first.source.create(); assert.equal(source, second.source.create(), "only immutable prepared source is reused");
  const b = await f.send("currentSession", envelope(), f.B, { ...deps, source: second.source }); assert.equal(b.status, 200);
  assert.ok(f.calls.some(c => c.owner === f.A)); assert.ok(f.calls.some(c => c.owner === f.B)); assert.equal(f.calls.some(c => c.kind === "provider"), false);
});

test("expired/absent source, mismatched guide and absent provider metadata hold while independent currentRead stays usable", async () => {
  const f = fixture(), body = envelope("evaluateJoined");
  for (const deps of [{ ...f.deps }, { ...f.attachSource(), source: { ...f.attachSource().source!, expected: { ...identityOf(actualSource()), guidePolicy: { version: "wrong", sha256: "a".repeat(64) } } } }]) {
    const r = await f.send("currentSession", body, f.A, deps); assert.equal(r.status, 503);
    assert.equal((await f.send("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }, f.A, deps)).status, 200);
  }
  f.clock(Date.parse("2026-11-06T00:00:00Z"));
  const expired = await f.send("currentSession", body); assert.equal(expired.status, 409); assert.equal(expired.body.result.code, "reference_snapshot_expired");
  const missingBilling = { ...f.attachSource(), subscription: undefined };
  assert.equal((await f.send("currentSession", envelope("saveCurrent"), f.A, missingBilling)).status, 403);
  assert.equal((await f.send("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }, f.A, missingBilling)).status, 200);
});

test("actual lifecycle HTTP closed/configuration/resolver/runtime paths delegate unchanged closed factories without body or provider effects", async () => {
  const f = fixture();
  for (const route of ["appleCredential", "deletion"] as const) {
    const closed = createCurrentAccountLifecycle();
    const expected = await (route === "appleCredential" ? closed.custody(new Request(HOST)) : closed.deletion(new Request(HOST)));
    const expectedText = await expected.text();
    for (const mode of ["off", "missing", "host", "factory", "resolver"] as const) {
      const request = f.makeRequest(route, { original: "synthetic-kept-only-on-device" });
      const response = await withCurrentIntegrationHostResolver({ resolve() {
        if (mode === "resolver") throw Error("private-resolver-detail");
        if (mode === "off") return {};
        return { ...f.deps, flags: { [route]: true }, ...(mode === "host" ? { hostOrigin: undefined } : {}),
          ...(mode === "factory" ? { lifecycle: { create() { throw Error("private-factory-detail"); } } } : {}) };
      } }, () => handlers[route](request));
      assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
      assert.equal(response.headers.get("x-content-type-options"), "nosniff");
      assert.equal(await response.text(), expectedText, mode); assert.equal(request.bodyUsed, false);
    }
  }
  assert.equal(f.calls.length, 0);
});

test("actual native deletion client keeps its original journal through closed HTTP then real lifecycle status recovery with missing current policy", async () => {
  const data = new Map<string, string>(), A = "10000000-0000-4000-8000-000000000001";
  let ids = 0, sends = 0, forbiddenCalls = 0, recovery = false, statusReads = 0;
  const forbid = async (): Promise<never> => { forbiddenCalls++; throw Error("must-not-call-provider-or-admission"); };
  const receipt = (b: Data) => ({ contract: "wd-account-deletion-v2", operationId: b.operationId, intentSha256: b.intentSha256,
    receiptRevision: 1, intentState: "unknown", applicationData: "unknown", authDeletion: "unknown", appleRevocation: "unknown",
    manualAppleRemoval: "recommended", subscriptionCancelled: false, clientDisposition: "reauthentication_available",
    retainedEvidence: ["deletion_receipt"], nextAction: "original_status_required" });
  const admission: LifecycleAdmission = { enabled: true, origin: TARGET, serverCredential: "synthetic-only", verify: forbid,
    client: { clientId: "synthetic.native", keys: forbid, exchange: forbid, revoke: forbid }, keyVersion: "absent", keyring: new Map(),
    applePolicy: undefined, deletionPolicy: undefined, preflight: forbid, cleanup: { verify: forbid }, request: forbid,
    repositories: { apple: { command: forbid }, deletion: { account: forbid, async worker(action, body) {
      assert.equal(action, "status"); statusReads++; return receipt(body);
    } } } };
  const origin = "https://synthetic-only.vercel.app";
  const client = createOwnerDeletionController({ readiness: admitDeletionReadiness({ enabled: true, contract: "wd-account-deletion-v2", origin,
    path: "/api/v1/account/deletion-v2", policySha256: "a".repeat(64) }), ports: async () => ({
      secure: { getItem: async (k: string) => data.get(k) ?? null, setItem: async (k: string, v: string) => { data.set(k, v); } },
      bytes: async () => new Uint8Array(32).fill(7), uuid: () => { ids++; return randomUUID(); },
      fetch: async (url: string, init: RequestInit) => { sends++;
        return withCurrentIntegrationHostResolver({ resolve: () => recovery ? { hostOrigin: origin, flags: { deletion: true }, lifecycle: { create: () => createCurrentAccountLifecycle(admission) } } : {} },
          () => deletionPOST(new Request(url, init)));
      },
    }) });
  const identity = { owner: A }, auth = { identity, current: () => true, readRevision: async () => 1,
    session: { assert: (value: unknown) => assert.equal(value, identity), refresh: async () => identity, bearer: () => "synthetic-only" } };
  try {
    const appleRequest = () => new Request(origin + CURRENT_INTEGRATION_ROUTES.appleCredential, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ operation: "exchange" }) });
    const expectedApple = await createCurrentAccountLifecycle(admission).custody(appleRequest());
    const actualApple = await withCurrentIntegrationHostResolver({ resolve: () => ({ hostOrigin: origin, flags: { appleCredential: true }, lifecycle: { create: () => createCurrentAccountLifecycle(admission) } }) }, () => applePOST(appleRequest()));
    assert.equal(actualApple.status, 503); const originalApple = await expectedApple.text();
    assert.equal(JSON.parse(originalApple).result.code, "custody_not_configured");
    assert.equal(await actualApple.text(), originalApple, "keep the actual lifecycle503 receipt rather than replacing it with an outer disabled envelope");
    client.bindOwner(A, 1); assert.equal(await client.prepare(auth), false);
    assert.equal(client.getSnapshot().original, true); assert.equal(client.getSnapshot().phase, "held");
    assert.equal(ids, 1); assert.equal(sends, 1); const journal = [...data.entries()];
    assert.equal(await client.status(), false); assert.deepEqual([...data.entries()], journal);
    assert.equal(await client.prepare(auth), true); assert.equal(ids, 1); assert.equal(sends, 2);
    recovery = true; assert.equal(await client.status(), true);
    const snapshot = client.getSnapshot(); assert.equal(snapshot.receipt.intentState, "unknown");
    assert.equal(snapshot.receipt.subscriptionCancelled, false); assert.equal(snapshot.original, true); assert.equal(snapshot.durable, true);
    assert.equal(ids, 1); assert.equal(statusReads, 1); assert.equal(forbiddenCalls, 0);
    assert.equal(await client.status(), true); assert.equal(ids, 1); assert.equal(statusReads, 2);
  } finally { client.close(); }
});

test("actual account HTTP handlers accept only existing lifecycle port; actual disabled lifecycle remains held without policy/fence", async () => {
  const f = fixture(); const deps = { ...f.deps, flags: { appleCredential: true, deletion: true }, lifecycle: { create: () => createCurrentAccountLifecycle() } };
  for (const route of ["appleCredential", "deletion"] as const) {
    const r = await f.send(route, {}, f.A, deps); assert.equal(r.status, 503); assert.equal(r.headers.get("cache-control"), "no-store");
  }
  assert.equal(f.calls.length, 0);
});

test("original saved ACK recovery through actual HTTP read is independent of source/billing and never repeats commit", async () => {
  // Real producer, clearly synthetic two-row ORIGINAL. Not a current priced
  // week or a change to the protected150g/day150USD/seven-day goal.
  const f = syntheticV2(), rows = f.rows.map(row => ({ ...row, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n"), sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const request = { ...f.request, slots: ["breakfast", "lunch", "dinner"] }, assignments = f.assignments.flatMap(row => request.slots.map(slot => ({ ...row, assignmentId: row.assignmentId + slot, slot })));
  let stored: Data | undefined;
  const transactions: typeof f.port = { transaction: cb => f.port.transaction(tx => cb({ ...tx, async commit(...args) { await tx.commit(...args); stored = canonicalReferenceData(args[2]) as Data; } })) };
  const producer = createReferenceSessionHandlerV2(bytes, { ...f.configuration, sourcePin: { sha256: sourceSha256, recordCount: 2 } }, { ...f.options, transactions });
  assert.equal(producer.outcome, "ready"); if (producer.outcome !== "ready") throw Error("fixture held");
  const intent = { contract: "wd-joined-session-proposal-v2", operation: "installCurrent", operationId: randomUUID(), sourceSha256, payload: { ...f.initial, request, assignments }, expectedSourcePolicyBasisSha256: producer.sourcePolicyBasis.basisSha256 };
  const original = { ...intent, intentSha256: referenceOperationDigest(intent) };
  const response = await producer.handle(new Request(HOST, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(original) }));
  assert.equal((await response.json()).result.outcome, "acknowledged"); assert.ok(stored);
  const h = fixture(); h.store(stored!);
  const status = { contract: "wd-current-owner-read-v1", operation: "operationStatus", requestId: randomUUID(), targetOperationId: original.operationId, targetIntentSha256: original.intentSha256, originalEnvelope: original };
  const deps = { ...h.deps, source: undefined, subscription: undefined, lifecycle: undefined };
  for (const owner of [h.A, h.B, h.A]) {
    const r = await h.send("currentRead", status, owner, deps); assert.equal(r.body.result.retryAuthorized, false);
    assert.equal(r.body.result.saved, owner === h.A ? true : undefined);
    const decoded: { disposition: string; saved?: boolean } = decodeOwnerRead(JSON.stringify(r.body), { requestId: status.requestId, operation: "operationStatus", owner,
      operationId: original.operationId, intentSha256: original.intentSha256, sourceSha256,
      basisSha256: producer.sourcePolicyBasis.basisSha256, weekId: owner === h.A ? r.body.result.state.current.weekId : undefined }, r.status);
    assert.equal(decoded.disposition, owner === h.A ? "acknowledged" : "unresolved");
    assert.equal(decoded.saved, owner === h.A ? true : undefined);
  }
  assert.equal(h.calls.some(c => c.kind === "provider" || c.kind === "rpc:commit"), false);
});



test("closed operator V5 selection reaches actual session POST; V4 remains explicit and foreign selectors fail",async()=>{
 const f=fixture(),env=serverMetadataConfiguration();
 const c={...env,WD_CURRENT_REFERENCE_PROFILE:"wd-current-reference-v5",WD_CURRENT_SOURCE_IDENTITY_JSON:undefined};
 const deps=resolveCurrentIntegrationServerConfiguration(c,()=>NOW,f.deps.request);
 assert.ok(deps.source);const source=deps.source.create();assert.equal(source.reviewedReferenceData.reviewRevision,5);
 const configured={...deps,owner:f.deps.owner};
 const body=envelope("capabilities",{reviewedReferenceData:"wd-reviewed-reference-data-v1"},{expectedSourcePolicyBasisSha256:source.sourcePolicyBasisSha256});
 const r=await f.send("currentSession",body,f.A,configured);assert.equal(r.status,200);assert.equal(r.body.result.reviewedReferenceData.reviewRevision,5);
 assert.equal(r.headers.get("X-WiseDinner-Guide-Policy-Sha256"),source.guidePolicy.sha256);
 assert.equal(f.calls.some(c=>c.kind==="provider"),false);
 assert.equal(resolveCurrentIntegrationServerConfiguration({...c,WD_CURRENT_REFERENCE_PROFILE:"v6"}).source,undefined);
 assert.equal(resolveCurrentIntegrationServerConfiguration({...c,WD_CURRENT_SOURCE_IDENTITY_JSON:env.WD_CURRENT_SOURCE_IDENTITY_JSON}).source,undefined);
 assert.equal(resolveCurrentIntegrationServerConfiguration(env,()=>NOW).source!.create().reviewedReferenceData.reviewRevision,4);
});

test("least-privilege subscriber read alias uses actual bound billing bridge; unknown result never falls back paid",async()=>{
 const f=fixture(),env={...serverMetadataConfiguration(),REVENUECAT_SECRET_API_KEY:undefined,REVENUECAT_SUBSCRIBER_READ_API_KEY:"appl_synthetic_read_only"};
 const deps={...resolveCurrentIntegrationServerConfiguration(env,()=>NOW,f.deps.request),owner:f.deps.owner};
 assert.ok(deps.subscription);const r=await f.send("currentSession",envelope("saveCurrent"),f.A,deps);
 assert.notEqual(r.status,403);assert.ok(f.calls.some(c=>c.kind==="provider"));assert.ok(f.calls.some(c=>c.kind==="billing:commit"));
 f.fail();assert.equal((await f.send("currentSession",envelope("saveCurrent"),f.A,deps)).status,403);
 assert.equal(f.calls.some(c=>c.kind==="rpc:commit"),false);
});

test("maintained production configuration keeps currentRead independent of private material and lifecycle flags",async()=>{
 const f=fixture(),env={...serverMetadataConfiguration(),WD_CURRENT_UUID_LIFECYCLE_ENABLED:"true",WD_CURRENT_LIFECYCLE_MATERIAL_JSON:"unavailable"};
 const request=f.makeRequest("currentRead",{contract:"wd-current-owner-read-v1",operation:"metadata",requestId:randomUUID(),target:"current"});f.setOriginal(request);
 const deps=await resolveCurrentIntegrationProductionConfiguration(env,request,"currentRead",f.deps.request,()=>NOW);
 assert.equal(deps.lifecycle,undefined);const response=await withCurrentIntegrationHostResolver({resolve:()=>({...deps,owner:f.deps.owner})},()=>readPOST(request));
 assert.equal(response.status,200);assert.equal(f.calls.some(c=>c.kind==="provider"),false);
});
