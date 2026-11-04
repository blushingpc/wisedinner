import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCurrentUuidScopeRpcPorts, createCurrentSparseUuidScopeRpcPorts, createCurrentContactUuidScopeRpcPorts, type CurrentUuidScopeRpcConfiguration } from "./current-uuid-scope-rpc.server.ts";
import { createCurrentUuidAuthScopePreflight, UUID_DELETE_PROFILE, LOCAL_DELETE_SCOPE } from "./current-uuid-auth-scope.server.ts";
import { CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, type ScopeAdmission, type ScopeObservationRequest, type ScopeObservation } from "./current-auth-scope.server.ts";
import { appleDigest } from "./apple-token-custody.server.ts";
const TARGET = "https://zpvqxtklvjitofpbddrn.supabase.co", H = "a".repeat(64), NOW = Date.parse("2026-11-01T02:00:00Z");
function service(role = "service_role", ref = "zpvqxtklvjitofpbddrn", exp = NOW / 1000 + 3600) {
  // Deterministic synthetic material; no signing key or credential is generated.
  return Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url") + "." + Buffer.from(JSON.stringify({ role, ref, exp })).toString("base64url") + "." + Buffer.alloc(32, 7).toString("base64url");
}
type Row = Record<string, unknown>;
function fixture() {
  // Synthetic reviewed observations only; neither RPC is called on a provider.
  const target = { userId: randomUUID(), identityHash: H, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(NOW + 60000).toISOString() };
  const admission: ScopeAdmission = { authorizationId: randomUUID(), target, accountRevision: 2, expectedAuthGraphSha256: H, expectedCatalogSha256: H, expectedEngineSha256: H, expiresAt: target.leaseUntil, maxObservationAgeMs: 3000, retained: {},
    deletionPolicy: { approved: true, version: UUID_DELETE_PROFILE, preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] },
    custodyPolicy: { approved: true, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] } };
  const expectedRequest: ScopeObservationRequest = { binding: target, policySha256: appleDigest(admission.deletionPolicy), authorizationId: admission.authorizationId, scopeSha256: appleDigest(["wd-current-auth-scope-admission-v2", admission]), custodyPolicy: admission.custodyPolicy, custodyPolicySha256: appleDigest(admission.custodyPolicy) };
  let clock = NOW, calls = 0, clockCalls = 0;
  const records: { url: string; init: RequestInit }[] = [];
  let respond: (rpc: string, req: ScopeObservationRequest, init: RequestInit) => Response | Promise<Response> = (rpc, req) => Response.json(rpc === "wd_current_auth_scope_observe" ? scope(req) : local(req));
  function scope(r: ScopeObservationRequest): ScopeObservation {
    return { contract: CURRENT_AUTH_SCOPE, binding: r.binding, policySha256: r.policySha256, authorizationId: r.authorizationId, scopeSha256: r.scopeSha256, observedAt: new Date(clock).toISOString(), validUntil: new Date(NOW + 30000).toISOString(), accountRevision: 2, authGraphSha256: H, catalogSha256: H,
      storage: { objects: 0, buckets: 0, multipartUploads: 0, multipartParts: 0, metadataReferences: 0, unknownLinkages: 0 }, application: { savedWeeks: 0, accountReceipts: 0, pushTokens: 0, pushReceipts: 0, pushJobs: 0, currentPlanCleanupPending: false, privateResidue: 0, unexpectedAccountFields: 0 },
      references: Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k => [k, { count: 0, sha256: H, ...(k === "retentionAttempts" ? { validUntil: null } : {}) }])) as ScopeObservation["references"],
      engine: { metadataSha256: H, authLinks: 0, ownerMatches: 0, unknownLinkages: 0 }, providerOperations: "settled", unclassifiedReferences: 0, writeFence: null };
  }
  function local(r: ScopeObservationRequest) {
    return { contract: LOCAL_DELETE_SCOPE, profile: UUID_DELETE_PROFILE, providerPredicate: "account-uuid-only", binding: r.binding, policySha256: r.policySha256, authorizationId: r.authorizationId, scopeSha256: r.scopeSha256,
      observedAt: new Date(clock).toISOString(), validUntil: new Date(NOW + 30000).toISOString(), accountRevision: 2, writerManifestSha256: H, writerCatalogSha256: H, writeFence: null,
      denial: { accountState: "deletion_pending", custodyGate: "closed", ordinaryOwnerWrites: "denied", allowedOriginalProgress: "same-original-only", durability: "persisted-until-original-resolution", barrierRevision: 3, unknownWriters: 0 } };
  }
  const config: CurrentUuidScopeRpcConfiguration = { origin: TARGET, serverCredential: service(), expectedRequest,
    now() { assert.equal(this, config); clockCalls++; return clock; },
    async request(url, init) {
      assert.equal(this, config); calls++; assert.ok(init); records.push({ url: String(url), init });
      const u = new URL(String(url)); assert.equal(u.origin, TARGET); assert.equal(u.search, "");
      assert.ok(["/rest/v1/rpc/wd_current_auth_scope_observe", "/rest/v1/rpc/wd_current_local_deletion_barrier"].includes(u.pathname));
      return await respond(u.pathname.split("/").at(-1)!, JSON.parse(String(init.body)).p_body, init);
    } };
  return { config, expectedRequest, target, admission, scope, local, records, calls: () => calls, clockCalls: () => clockCalls, time: (n: number) => { clock = n; }, respond: (fn: typeof respond) => { respond = fn; } };
}
test("named current-contact ports retain independent request/credential guards and closed paths", async () => {
  const f = fixture(); let calls = 0;
  const config = { ...f.config, request: async (url: string | URL | Request, init?: RequestInit) => {
    calls++; const name = new URL(String(url)).pathname.split("/").at(-1);
    assert.ok(["wd_current_contact_auth_scope_observe", "wd_current_contact_local_deletion_barrier"].includes(name!));
    assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error"); assert.ok(init?.signal);
    assert.deepEqual(JSON.parse(String(init?.body)).p_body, f.expectedRequest);
    return Response.json(name === "wd_current_contact_auth_scope_observe" ? f.scope(f.expectedRequest) : f.local(f.expectedRequest));
  }, now: () => NOW };
  const ports = createCurrentContactUuidScopeRpcPorts(config);
  assert.equal(calls, 0);
  assert.deepEqual(await ports.observe({ ...f.expectedRequest, authorizationId: randomUUID() }), { outcome: "held" }); assert.equal(calls, 0);
  assert.deepEqual(await ports.observe(f.expectedRequest), f.scope(f.expectedRequest));
  assert.deepEqual(await ports.observeLocalDenial(f.expectedRequest), f.local(f.expectedRequest)); assert.equal(calls, 2);
  for (const bad of [undefined, { ...config, origin: TARGET + "/foreign" }, { ...config, serverCredential: service("anon") }, { ...config, rpc: "anything" }]) {
    assert.deepEqual(await createCurrentContactUuidScopeRpcPorts(bad).observe(f.expectedRequest), { outcome: "held" });
  }
  assert.equal(calls, 2);
});

test("named sparse ports retain independent request/credential guards and closed paths", async () => {
  const f = fixture(); let calls = 0;
  const config = { ...f.config, request: async (url: string | URL | Request, init?: RequestInit) => {
    calls++; const name = new URL(String(url)).pathname.split("/").at(-1);
    assert.ok(["wd_current_sparse_auth_scope_observe", "wd_current_sparse_local_deletion_barrier"].includes(name!));
    assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error"); assert.ok(init?.signal);
    assert.deepEqual(JSON.parse(String(init?.body)).p_body, f.expectedRequest);
    return Response.json(name === "wd_current_sparse_auth_scope_observe" ? f.scope(f.expectedRequest) : f.local(f.expectedRequest));
  }, now: () => NOW };
  const ports = createCurrentSparseUuidScopeRpcPorts(config);
  assert.equal(calls, 0);
  assert.deepEqual(await ports.observe({ ...f.expectedRequest, authorizationId: randomUUID() }), { outcome: "held" }); assert.equal(calls, 0);
  assert.deepEqual(await ports.observe(f.expectedRequest), f.scope(f.expectedRequest));
  assert.deepEqual(await ports.observeLocalDenial(f.expectedRequest), f.local(f.expectedRequest)); assert.equal(calls, 2);
  for (const bad of [undefined, { ...config, origin: TARGET + "/foreign" }, { ...config, serverCredential: service("anon") }, { ...config, rpc: "anything" }]) {
    assert.deepEqual(await createCurrentSparseUuidScopeRpcPorts(bad).observe(f.expectedRequest), { outcome: "held" });
  }
  assert.equal(calls, 2);
});

test("pure factory returns only fixed typed ports; real request receiver/path/headers/body and no retry", async () => {
  const f = fixture(), before = structuredClone(f.expectedRequest), ports = createCurrentUuidScopeRpcPorts(f.config);
  assert.deepEqual(Object.keys(ports).sort(), ["observe", "observeLocalDenial"]); assert.equal(Object.isFrozen(ports), true);
  assert.equal(f.calls(), 0); assert.equal(f.clockCalls(), 0); assert.equal(JSON.stringify(ports), "{}");
  assert.deepEqual(await ports.observe(f.expectedRequest), f.scope(f.expectedRequest));
  assert.deepEqual(await ports.observeLocalDenial(f.expectedRequest), f.local(f.expectedRequest));
  assert.equal(f.calls(), 2); assert.deepEqual(f.expectedRequest, before);
  for (const { init } of f.records) {
    assert.equal(init.method, "POST"); assert.equal(init.redirect, "error"); assert.equal(init.cache, "no-store"); assert.ok(init.signal);
    const h = new Headers(init.headers); assert.equal(h.get("apikey"), f.config.serverCredential); assert.equal(h.get("authorization"), "Bearer " + f.config.serverCredential); assert.equal(h.get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(init.body)), { p_body: before });
  }
});
test("actual accepted UUID preflight consumes both real ports;200 cannot grant through bad local writer/catalog facts", async () => {
  const f = fixture(), ports = createCurrentUuidScopeRpcPorts(f.config);
  const preflight = createCurrentUuidAuthScopePreflight({ enabled: true, admission: f.admission, writerManifestSha256: H, writerCatalogSha256: H, now: () => NOW, ...ports });
  const proof = await preflight(f.target); assert.equal(proof.outcome, "allowed"); assert.equal(f.calls(), 2);
  if (proof.outcome === "allowed") { assert.equal(proof.strongWriteFence, null); assert.equal(proof.profile, UUID_DELETE_PROFILE); assert.equal(proof.providerPredicate, "account-uuid-only"); }
  for (const mode of ["catalog", "writer", "unknown", "retention", "schema", "expired"]) {
    const g = fixture(); g.respond((rpc, r) => {
      if (rpc === "wd_current_auth_scope_observe") { const o = g.scope(r); return Response.json(mode === "retention" ? { ...o, references: { ...o.references, retentionAttempts: { count: 1, sha256: H, validUntil: new Date(NOW + 20000).toISOString() } } } : mode === "schema" ? { ...o, catalogSha256: "b".repeat(64) } : o); }
      const o = g.local(r); if (mode === "catalog") o.writerCatalogSha256 = "b".repeat(64); if (mode === "writer") o.denial.ordinaryOwnerWrites = "allowed"; if (mode === "unknown") o.denial.unknownWriters = 1; if (mode === "expired") o.validUntil = new Date(NOW - 1).toISOString(); return Response.json(o);
    });
    const p = createCurrentUuidScopeRpcPorts(g.config);
    assert.deepEqual(await createCurrentUuidAuthScopePreflight({ enabled: true, admission: g.admission, writerManifestSha256: H, writerCatalogSha256: H, now: () => NOW, ...p })(g.target), { outcome: "held" }, mode);
  }
});
test("missing configuration, client key, foreign project/origin and malformed timeout fail closed before clock/network", async () => {
  const f = fixture();
  const bad: unknown[] = [undefined, {}, Object.create(f.config), { ...f.config, origin: TARGET + "/" }, { ...f.config, origin: "https://foreign.supabase.co" }, { ...f.config, origin: "http://zpvqxtklvjitofpbddrn.supabase.co" },
    { ...f.config, serverCredential: service("anon") }, { ...f.config, serverCredential: service("authenticated") }, { ...f.config, serverCredential: service("service_role", "foreign") }, { ...f.config, serverCredential: "sb_publishable_synthetic" }, { ...f.config, serverCredential: "unknown-opaque" },
    { ...f.config, serverCredential: service() + "\r\nX: value" }, { ...f.config, timeoutMs: 0 }, { ...f.config, timeoutMs: 8001 }, { ...f.config, timeoutMs: 1.5 }, { ...f.config, rpc: "some_other_rpc" }, { ...f.config, expectedRequest: { ...f.expectedRequest, extra: true } }, Object.defineProperty({ ...f.config }, "hidden", { value: "unknown" })];
  for (const c of bad) { const ports = createCurrentUuidScopeRpcPorts(c as CurrentUuidScopeRpcConfiguration); assert.deepEqual(await ports.observe(f.expectedRequest), { outcome: "held" }); assert.deepEqual(await ports.observeLocalDenial(f.expectedRequest), { outcome: "held" }); }
  assert.equal(f.calls(), 0); assert.equal(f.clockCalls(), 0);
});
test("every foreign original request binding/policy/scope is rejected before transport", async () => {
  const f = fixture(), ports = createCurrentUuidScopeRpcPorts(f.config);
  const bad: unknown[] = [];
  for (const k of ["userId", "identityHash", "authOperationId", "deletionOperationId", "intentSha256", "workOwner", "workAttempt", "leaseUntil"]) {
    bad.push({ ...f.expectedRequest, binding: { ...f.target, [k]: k === "workAttempt" ? 2 : k === "leaseUntil" ? new Date(NOW + 50000).toISOString() : k.endsWith("Hash") || k.endsWith("Sha256") ? "b".repeat(64) : randomUUID() } });
  }
  bad.push({ ...f.expectedRequest, authorizationId: randomUUID() }, { ...f.expectedRequest, policySha256: "b".repeat(64) }, { ...f.expectedRequest, scopeSha256: "b".repeat(64) }, { ...f.expectedRequest, custodyPolicySha256: "b".repeat(64) }, { ...f.expectedRequest, custodyPolicy: { ...f.admission.custodyPolicy, version: "changed" } }, { ...f.expectedRequest, extra: "x".repeat(17000) }, { ...f.expectedRequest, binding: { ...f.target, workAttempt: 2147483648 } }, { ...f.expectedRequest, binding: { ...f.target, leaseUntil: "2026-02-30T00:00:00Z" } });
  for (const r of bad) { assert.deepEqual(await ports.observe(r as ScopeObservationRequest), { outcome: "held" }); assert.deepEqual(await ports.observeLocalDenial(r as ScopeObservationRequest), { outcome: "held" }); }
  assert.equal(f.calls(), 0);
});
test("configuration, request and policy accessors/proxies/toJSON are rejected with zero getter/trap execution", async () => {
  const f = fixture(); let reads = 0;
  const getter = () => { reads++; throw Error("getter"); };
  const proxy = new Proxy({}, { getPrototypeOf() { reads++; throw Error("prototype trap"); }, ownKeys() { reads++; throw Error("keys trap"); } });
  for (const config of [Object.defineProperty({ ...f.config }, "request", { get: getter }), { ...f.config, expectedRequest: proxy }, proxy]) {
    assert.deepEqual(await createCurrentUuidScopeRpcPorts(config as CurrentUuidScopeRpcConfiguration).observe(f.expectedRequest), { outcome: "held" });
  }
  const ports = createCurrentUuidScopeRpcPorts(f.config);
  for (const r of [proxy, Object.create(f.expectedRequest), Object.defineProperty({ ...f.expectedRequest }, "binding", { get: getter }), { ...f.expectedRequest, toJSON: getter }, { ...f.expectedRequest, custodyPolicy: Object.defineProperty({ ...f.admission.custodyPolicy }, "version", { get: getter }) }]) assert.deepEqual(await ports.observe(r as ScopeObservationRequest), { outcome: "held" });
  assert.equal(reads, 0); assert.equal(f.calls(), 0);
});
test("method/clock receiver capture ignores bind/name metadata and later configuration mutation", async () => {
  const f = fixture(); let gets = 0;
  for (const fn of [f.config.request!, f.config.now!]) for (const k of ["bind", "name"]) Object.defineProperty(fn, k, { get() { gets++; throw Error("metadata"); } });
  const original = structuredClone(f.expectedRequest), key = f.config.serverCredential, ports = createCurrentUuidScopeRpcPorts(f.config);
  (f.config as unknown as Row).origin = "https://foreign.invalid"; (f.config as unknown as Row).serverCredential = "changed"; (f.target as unknown as Row).userId = randomUUID();
  assert.equal(f.calls(), 0); assert.deepEqual(await ports.observe(original), f.scope(original)); assert.equal(new Headers(f.records[0].init.headers).get("apikey"), key); assert.equal(gets, 0);
});
test("detached request body is stable across await and semantically reordered own keys are supported", async () => {
  const f = fixture(), ports = createCurrentUuidScopeRpcPorts(f.config), original = structuredClone(f.expectedRequest);
  f.respond((_rpc, r) => { f.target.userId = randomUUID(); return Response.json(f.scope(r)); });
  const r = Object.fromEntries(Object.entries(original).reverse()) as unknown as ScopeObservationRequest;
  assert.deepEqual(await ports.observe(r), f.scope(original)); assert.deepEqual(r, original); assert.deepEqual(JSON.parse(String(f.records[0].init.body)), { p_body: original });
});
for (const mode of ["missingRPC", "503", "429", "201", "unknown", "network", "lostACK", "malformed", "duplicate", "oversize", "length-large", "length-invalid", "length-mismatch", "truncated", "utf8", "no-body", "redirect", "foreign-url", "content-type", "untyped-response"] as const) test(`single read ${mode} remains held with exactly one transport attempt`, async () => {
  const f = fixture(); f.respond((_rpc, r) => {
    if (mode === "network" || mode === "lostACK") throw Error("synthetic private transport failure");
    if (mode === "missingRPC") return Response.json({ code: "PGRST202" }, { status: 404 });
    if (mode === "503" || mode === "429" || mode === "201") return Response.json({}, { status: Number(mode) });
    if (mode === "unknown") return Response.json({ outcome: "unknown" });
    if (mode === "malformed") return new Response('{"contract":', { headers: { "content-type": "application/json" } });
    if (mode === "duplicate") return new Response('{"contract":"a","contract":"b"}', { headers: { "content-type": "application/json" } });
    if (mode === "oversize") return new Response(" ".repeat(65537), { headers: { "content-type": "application/json" } });
    if (mode === "length-large") return new Response("{}", { headers: { "content-type": "application/json", "content-length": "65537" } });
    if (mode === "length-invalid") return new Response("{}", { headers: { "content-type": "application/json", "content-length": "-1" } });
    if (mode === "untyped-response") return { status: 200 } as unknown as Response;
    if (mode === "length-mismatch") return new Response("{}", { headers: { "content-type": "application/json", "content-length": "20" } });
    if (mode === "truncated") return new Response(new ReadableStream({ start(c) { c.enqueue(Buffer.from('{"contract":')); c.error(Error("stream cut")); } }), { headers: { "content-type": "application/json" } });
    if (mode === "utf8") return new Response(new Uint8Array([255, 254]), { headers: { "content-type": "application/json" } });
    if (mode === "no-body") return new Response(null, { headers: { "content-type": "application/json" } });
    if (mode === "content-type") return new Response(JSON.stringify(f.scope(r)), { headers: { "content-type": "text/plain" } });
    const response = Response.json(f.scope(r));
    Object.defineProperty(response, mode === "redirect" ? "redirected" : "url", { value: mode === "redirect" ? true : "https://foreign.invalid/" }); return response;
  });
  const p = createCurrentUuidScopeRpcPorts(f.config); assert.deepEqual(await p.observe(f.expectedRequest), { outcome: "held" }); assert.equal(f.calls(), 1); assert.equal(JSON.stringify(p), "{}");
});
test("response correspondence rejects swapped scope/local payload, foreignUID and changed request pins", async () => {
  const mutations: ((o: Row) => void)[] = [o => o.contract = LOCAL_DELETE_SCOPE, o => o.binding = { ...fixture().target }, o => o.policySha256 = "b".repeat(64), o => o.scopeSha256 = "b".repeat(64), o => o.authorizationId = randomUUID(), o => o.observedAt = new Date(NOW + 1).toISOString(), o => o.validUntil = new Date(NOW - 1).toISOString(), o => o.validUntil = new Date(NOW + 120000).toISOString()];
  for (const mutate of mutations) { const f = fixture(); f.respond((_rpc, r) => { const o = f.scope(r) as unknown as Row; mutate(o); return Response.json(o); }); assert.deepEqual(await createCurrentUuidScopeRpcPorts(f.config).observe(f.expectedRequest), { outcome: "held" }); assert.equal(f.calls(), 1); }
  const f = fixture(); f.respond((_rpc, r) => Response.json(f.scope(r))); assert.deepEqual(await createCurrentUuidScopeRpcPorts(f.config).observeLocalDenial(f.expectedRequest), { outcome: "held" });
});
test("expired request/credential and invalid clock hold before network; expiry during await holds after one call", async () => {
  const f = fixture(), p = createCurrentUuidScopeRpcPorts(f.config); f.time(NOW + 60000); assert.deepEqual(await p.observe(f.expectedRequest), { outcome: "held" }); assert.equal(f.calls(), 0);
  const g = fixture(), expired = createCurrentUuidScopeRpcPorts({ ...g.config, now: () => NOW, serverCredential: service("service_role", "zpvqxtklvjitofpbddrn", NOW / 1000 - 1) }); assert.deepEqual(await expired.observe(g.expectedRequest), { outcome: "held" }); assert.equal(g.calls(), 0);
  const h = fixture(); h.respond((_rpc, r) => { const o = h.scope(r); h.time(NOW + 60001); return Response.json(o); }); assert.deepEqual(await createCurrentUuidScopeRpcPorts(h.config).observe(h.expectedRequest), { outcome: "held" }); assert.equal(h.calls(), 1);
  for (const clock of [NaN, -1]) { const f = fixture(); f.time(clock); assert.deepEqual(await createCurrentUuidScopeRpcPorts(f.config).observe(f.expectedRequest), { outcome: "held" }); assert.equal(f.calls(), 0); }
});
test("timeout has one bounded attempt, aborts original transport signal and never retries late result", async () => {
  const f = fixture(); let signal: AbortSignal | null | undefined;
  f.respond((_rpc, _r, init) => { signal = init.signal; return new Promise(() => {}); });
  // Receiver-sensitive fixture methods require the original configured receiver.
  const configured = { ...f.config, timeoutMs: 5, now: () => NOW, request: (u: RequestInfo | URL, i?: RequestInit) => Reflect.apply(f.config.request!, f.config, [u, i]) };
  assert.deepEqual(await createCurrentUuidScopeRpcPorts(configured).observe(f.expectedRequest), { outcome: "held" }); assert.equal(f.calls(), 1); assert.equal(signal?.aborted, true);
});

test("uninstalled peer local RPC holds actual preflight after one successful scope read, without proof fabrication", async () => {
  const f = fixture(); f.respond((rpc, r) => rpc === "wd_current_auth_scope_observe" ? Response.json(f.scope(r)) : Response.json({ code: "PGRST202", message: "synthetic missing RPC" }, { status: 404 }));
  const ports = createCurrentUuidScopeRpcPorts(f.config);
  const proof = await createCurrentUuidAuthScopePreflight({ enabled: true, admission: f.admission, writerManifestSha256: H, writerCatalogSha256: H, now: () => NOW, ...ports })(f.target);
  assert.deepEqual(proof, { outcome: "held" }); assert.equal(f.calls(), 2);
  assert.equal(f.records[1].url, TARGET + "/rest/v1/rpc/wd_current_local_deletion_barrier");
});

test("unexpected/error-shaped200envelopes do not escape as observation facts", async () => {
  for (const port of ["observe", "observeLocalDenial"] as const) for (const extra of ["error", "raw_private_payload", "outcome"]) {
    const f = fixture(); f.respond((rpc, r) => Response.json({ ...(rpc === "wd_current_auth_scope_observe" ? f.scope(r) : f.local(r)), [extra]: "synthetic-only" }));
    assert.deepEqual(await createCurrentUuidScopeRpcPorts(f.config)[port](f.expectedRequest), { outcome: "held" }); assert.equal(f.calls(), 1);
  }
});
