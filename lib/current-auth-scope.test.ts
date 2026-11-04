import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCurrentAuthScopePreflight, createCurrentAuthScopeRpcObserver, CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, createCurrentAuthScopeEvidenceReader } from "./current-auth-scope.server.ts";
import type { CurrentAuthScopeDependencies, ScopeAdmission, ScopeObservation, ScopeObservationRequest, CurrentScopeReference } from "./current-auth-scope.server.ts";
import { appleDigest } from "./apple-token-custody.server.ts";
import { createAccountDeletionV2AuthAdapter } from "./account-deletion-v2-auth.server.ts";
import type { AuthScopeInput } from "./account-deletion-v2-auth.server.ts";
import type { DeletionV2Policy } from "./account-deletion-v2.server.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";
const H = "a".repeat(64), now = Date.now();
const custodyPolicy = { approved: true as const, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
const policy: DeletionV2Policy = { approved: true, version: "synthetic-scope-only", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
function fixture() {
  const target: AuthScopeInput = { userId: randomUUID(), identityHash: H, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(now + 60000).toISOString() };
  const admission: ScopeAdmission = { authorizationId: randomUUID(), target, deletionPolicy: policy, custodyPolicy, accountRevision: 2, expectedAuthGraphSha256: H, expectedCatalogSha256: H, expectedEngineSha256: H, expiresAt: target.leaseUntil, maxObservationAgeMs: 3000, retained: {} };
  let count = 0, clock = now;
  function observation(request: ScopeObservationRequest): ScopeObservation {
    const references = Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k => [k, k === "retentionAttempts" ? { count: 0, sha256: H, validUntil: null } : { count: 0, sha256: H }])) as ScopeObservation["references"];
    return { contract: CURRENT_AUTH_SCOPE, binding: structuredClone(request.binding), policySha256: request.policySha256, authorizationId: request.authorizationId, scopeSha256: request.scopeSha256, observedAt: new Date(clock).toISOString(), validUntil: new Date(now + 30000).toISOString(), accountRevision: 2, authGraphSha256: H, catalogSha256: H,
      storage: { objects: 0, buckets: 0, multipartUploads: 0, multipartParts: 0, metadataReferences: 0, unknownLinkages: 0 },
      application: { savedWeeks: 0, accountReceipts: 0, pushTokens: 0, pushReceipts: 0, pushJobs: 0, currentPlanCleanupPending: false, privateResidue: 0, unexpectedAccountFields: 0 }, references,
      engine: { metadataSha256: H, authLinks: 0, ownerMatches: 0, unknownLinkages: 0 }, providerOperations: "settled", unclassifiedReferences: 0,
      writeFence: { bindingSha256: appleDigest(request), evidenceSha256: H, validUntil: target.leaseUntil } };
  }
  const deps: CurrentAuthScopeDependencies = { enabled: true, admission, now: () => clock, observe: async request => { count++; return observation(request); } };
  return { target, admission, deps, observation, calls: () => count, time: (x: number) => clock = x };
}
type Mutable = Record<string, unknown>;
test("default-off, invalid configuration and invalid target make zero observation calls", async () => {
  for (const mode of ["disabled", "missing-admission", "bad-policy", "bad-target", "foreign-target", "old-lease", "bad-duration", "bad-clock"]) {
    const f = fixture(), deps = { ...f.deps }, target = { ...f.target };
    if (mode === "disabled") deps.enabled = false;
    if (mode === "missing-admission") deps.admission = undefined;
    if (mode === "bad-policy") deps.admission = { ...f.admission, deletionPolicy: { ...policy, approved: false } as unknown as DeletionV2Policy };
    if (mode === "bad-target") target.workAttempt = 0;
    if (mode === "foreign-target") target.userId = randomUUID();
    if (mode === "old-lease") f.time(now + 60001);
    if (mode === "bad-duration") deps.admission = { ...f.admission, maxObservationAgeMs: 9000 };
    if (mode === "bad-clock") deps.now = () => NaN;
    const preflight = createCurrentAuthScopePreflight(deps); assert.equal(f.calls(), 0);
    assert.deepEqual(await preflight(target), { outcome: "held" }, mode); assert.equal(f.calls(), 0, mode);
  }
  assert.deepEqual(await createCurrentAuthScopePreflight({})(fixture().target), { outcome: "held" });
});
test("configuration/input accessors and prototype data are refused without invoking getters", async () => {
  const f = fixture(); let getters = 0;
  const deps = Object.defineProperty({}, "observe", { enumerable: true, get() { getters++; throw Error("getter"); } });
  assert.deepEqual(await createCurrentAuthScopePreflight(deps)(f.target), { outcome: "held" });
  const target = Object.defineProperty({ ...f.target }, "userId", { enumerable: true, get() { getters++; throw Error("getter"); } });
  assert.deepEqual(await createCurrentAuthScopePreflight(f.deps)(target), { outcome: "held" });
  assert.equal(getters, 0); assert.equal(f.calls(), 0);
});
test("current exact observation yields the unchanged AuthScopeProof with content-bound evidence", async () => {
  const f = fixture(), preflight = createCurrentAuthScopePreflight(f.deps), result = await preflight(f.target);
  assert.equal(result.outcome, "allowed"); if (result.outcome !== "allowed") return;
  const expectedScope = appleDigest(["wd-current-auth-scope-admission-v2", f.admission]);
  const request = { binding: f.target, authorizationId: f.admission.authorizationId, policySha256: appleDigest(policy), scopeSha256: expectedScope, custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
  assert.deepEqual(result.binding, { ...f.target, scopeSha256: expectedScope, policySha256: appleDigest(policy), authorizationId: f.admission.authorizationId, evidenceSha256: appleDigest([CURRENT_AUTH_SCOPE, request, f.observation(request)]), observedAt: new Date(now).toISOString(), validUntil: new Date(now + 3000).toISOString() });
  assert.deepEqual(result.coverage, { coveredAuthGraphSha256: H, storage: "verified_clear", sharedEngine: "verified_preserved", relatedOwnerReferences: "verified_clear" });
  assert.equal(f.calls(), 1);
});
for (const section of ["storage", "application", "engine"] as const) test(`every independent ${section} residue/unknown/closure counter holds`, async () => {
  const base = fixture(), sample = base.observation({ binding: base.target, policySha256: H, authorizationId: base.admission.authorizationId, scopeSha256: H, custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) });
  for (const key of Object.keys(sample[section])) {
    const f = fixture(); const observe = async (req: ScopeObservationRequest) => { const o = structuredClone(f.observation(req)); (o[section] as unknown as Mutable)[key] = key === "currentPlanCleanupPending" ? true : key === "metadataSha256" ? "b".repeat(64) : 1; return o; };
    assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe })(f.target), { outcome: "held" }, `${section}.${key}`);
  }
});
test("unknown/new schema, active/unknown provider work, altered graph/catalog and malformed exact shapes hold", async () => {
  const mutations: ((o: Mutable) => void)[] = [
    o => o.unclassifiedReferences = 1, o => o.providerOperations = "active", o => o.providerOperations = "unknown", o => o.authGraphSha256 = "b".repeat(64), o => o.catalogSha256 = "b".repeat(64),
    o => o.accountRevision = 1, o => o.policySha256 = "b".repeat(64), o => o.authorizationId = randomUUID(), o => o.scopeSha256 = "b".repeat(64), o => o.extra = true,
    o => o.writeFence = null, o => (o.writeFence as Mutable).bindingSha256 = H, o => (o.writeFence as Mutable).evidenceSha256 = "unverified", o => (o.writeFence as Mutable).validUntil = new Date(now + 10).toISOString(),
    o => (o.storage as Mutable).objects = NaN, o => (o.storage as Mutable).objects = -1, o => (o.storage as Mutable).objects = "0", o => (o.references as Mutable).extra = { count: 0, sha256: H },
  ];
  for (const mutate of mutations) { const f = fixture(); assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe: async req => { const o = structuredClone(f.observation(req)); mutate(o as unknown as Mutable); return o; } })(f.target), { outcome: "held" }); }
});
test("owner/original/identity/attempt/lease binding mismatches and stale/future observations hold", async () => {
  for (const key of Object.keys(fixture().target)) {
    const f = fixture(); assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe: async req => { const o = f.observation(req); (o.binding as unknown as Mutable)[key] = key === "workAttempt" ? 2 : key.endsWith("Hash") || key.endsWith("Sha256") ? "b".repeat(64) : key === "leaseUntil" ? new Date(now + 40000).toISOString() : randomUUID(); return o; } })(f.target), { outcome: "held" }, key);
  }
  for (const field of ["observedAt", "validUntil"]) for (const date of ["2026-02-30T00:00:00Z", "garbage", new Date(now - 5000).toISOString(), new Date(now + 120000).toISOString()]) {
    const f = fixture(); assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe: async req => ({ ...f.observation(req), [field]: date }) })(f.target), { outcome: "held" }, field + date);
  }
});
test("snapshot is immutable across constructor, observation and await; current clock is rechecked", async () => {
  const f = fixture(), preflight = createCurrentAuthScopePreflight(f.deps);
  (f.admission.target as unknown as Mutable).workAttempt = 19;
  const original = { ...f.target, workAttempt: 1 }; assert.equal((await preflight(original)).outcome, "allowed");
  const g = fixture(); const p = createCurrentAuthScopePreflight({ ...g.deps, observe: async req => { const o = g.observation(req); req.binding.userId = randomUUID(); g.time(now + 60001); return o; } });
  assert.deepEqual(await p(g.target), { outcome: "held" });
});
test("each retained reference requires exact approved category/count/content, not a blanket preserve", async () => {
  for (const key of Object.keys(CURRENT_AUTH_SCOPE_REFERENCES) as CurrentScopeReference[]) {
    const f = fixture(), row = key === "retentionAttempts" ? { count: 1, sha256: H, validUntil: new Date(now + 45000).toISOString() } : { count: 1, sha256: H }, observe = async (req: ScopeObservationRequest) => ({ ...f.observation(req), references: { ...f.observation(req).references, [key]: row } });
    assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe })(f.target), { outcome: "held" }, key);
    const a = { ...f.admission, retained: { [key]: row } }, result = await createCurrentAuthScopePreflight({ ...f.deps, admission: a, observe })(f.target);
    assert.equal(result.outcome, "allowed", key); if (result.outcome === "allowed") assert.equal(result.coverage.relatedOwnerReferences, "approved_preserved");
    assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, admission: { ...a, retained: { [key]: { ...row, count: 2 } } }, observe })(f.target), { outcome: "held" });
    assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, admission: { ...a, deletionPolicy: { ...policy, retainedEvidence: ["unrelated"] } }, observe })(f.target), { outcome: "held" });
  }
});
test("an observation failure/timeout is held and never retried", async () => {
  const f = fixture(); let calls = 0;
  const p = createCurrentAuthScopePreflight({ ...f.deps, admission: { ...f.admission, maxObservationAgeMs: 5 }, observe: async () => { calls++; return new Promise(() => {}); } });
  assert.deepEqual(await p(f.target), { outcome: "held" }); assert.equal(calls, 1);
  assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe: async () => { throw Error("read unavailable"); } })(f.target), { outcome: "held" });
});
test("RPC port has zero construction I/O, exact URL/bounds; SQL observation alone cannot grant", async () => {
  const f = fixture(); let calls = 0;
  const observe = createCurrentAuthScopeRpcObserver({ origin: "https://fixture.invalid", serverCredential: "synthetic-only", request: async (url, init) => {
    calls++; assert.equal(String(url), "https://fixture.invalid/rest/v1/rpc/wd_current_auth_scope_observe"); assert.equal(init?.method, "POST"); assert.equal(init?.redirect, "error"); assert.equal(init?.cache, "no-store");
    const { p_body } = JSON.parse(String(init?.body)); return Response.json({ ...f.observation(p_body), writeFence: null });
  } });
  assert.equal(calls, 0); assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe })(f.target), { outcome: "held" }); assert.equal(calls, 1);
  for (const response of [() => Response.json({}, { status: 403 }), () => new Response('{"outcome":"held","outcome":"allowed"}'), () => new Response("x".repeat(65537)), () => new Response("{}", { headers: { "Content-Length": "999999" } })]) {
    const bad = createCurrentAuthScopeRpcObserver({ origin: "https://fixture.invalid", serverCredential: "synthetic-only", request: async () => response() });
    await assert.rejects(bad({ binding: f.target, policySha256: H, authorizationId: f.admission.authorizationId, scopeSha256: H, custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) }));
  }
});
test("actual frozen Auth adapter consumes real preflight, keeps terminal Apple dispositions independent and never replays unknown DELETE", async () => {
  for (const disposition of ["unknown", "manual_required", "confirmed", "failed"]) {
    const f = fixture(); let deletes = 0, state = "", missing = false, lose = false;
    const user = { id: f.target.userId, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: randomUUID(), user_id: f.target.userId, provider: "email", id: "synthetic-email", created_at: "2026-10-01T00:00:00Z" }] };
    const request: typeof fetch = async (_url, init) => { if (init?.method === "DELETE") { deletes++; missing = true; if (lose) throw Error("lost original ACK"); return Response.json({}); } return missing ? Response.json({ code: "user_not_found" }, { status: 404 }) : Response.json(user); };
    const id = await supabaseDeletionAuthV2("https://fixture.invalid", "synthetic", request).verifyIdentity(f.target.userId); assert.ok(id); f.target.identityHash = id.identityHash;
    let holdMode = "none";
    const preflight = createCurrentAuthScopePreflight({ ...f.deps, observe: async req => {
      const o = f.observation(req);
      if (holdMode === "file") (o.storage as unknown as Mutable).objects = 1;
      if (holdMode === "provider") (o as unknown as Mutable).providerOperations = "active";
      if (holdMode === "lease") o.binding.workAttempt = 2;
      return o;
    } });
    const adapter = createAccountDeletionV2AuthAdapter({ origin: "https://fixture.invalid", serverCredential: "synthetic", request, now: () => now, preflight, repository: { async command(_ns, action) {
      if (action === "auth_fence") return { owner: f.target.workOwner, attempt: 1, lease: f.target.leaseUntil, authState: "started", disposition, currentIdentityHash: id.identityHash, actualApple: "none", effectiveApple: "linked", apple: "linked", intentId: f.target.deletionOperationId, intentSha256: H, fenceHash: H };
      if (action === "auth_begin") { if (state) return { fresh: false }; state = "started"; return { fresh: true }; }
      if (action === "auth_original") return { state, scopeAdmitted: !!state, scopeHash: H, evidenceHash: H };
      if (action === "auth_record") { state = "confirmed"; return { state, evidenceHash: H }; }
      throw Error("unexpected command");
    } } });
    const target = { userId: f.target.userId, identityHash: id.identityHash, operationId: f.target.authOperationId };
    for (holdMode of ["file", "provider", "lease"]) { assert.equal((await adapter.auth.run(target)).outcome, "not_started"); assert.equal(deletes, 0); assert.equal(state, ""); }
    holdMode = "none";
    if (disposition === "unknown") lose = true;
    assert.equal((await adapter.auth.run(target)).outcome, lose ? "unknown" : "confirmed"); assert.equal(deletes, 1);
    await adapter.auth.run(target); assert.equal(deletes, 1);
    if (lose) { assert.equal((await adapter.auth.reconcile!(target)).outcome, "already_absent"); assert.equal(deletes, 1); }
  }
});

test("v2 rejects v1 and strict retention count/content/deadline shapes without replay", async () => {
  for (const mutate of [
    (o: Mutable) => o.contract = "wd-current-auth-scope-observation-v1",
    (o: Mutable) => (o.references as Mutable).retentionAttempts = { count: 0, sha256: H },
    (o: Mutable) => (o.references as Mutable).retentionAttempts = { count: 0, sha256: H, validUntil: new Date(now + 60000).toISOString() },
    (o: Mutable) => (o.references as Mutable).retentionAttempts = { count: 1, sha256: H, validUntil: null },
    (o: Mutable) => (o.references as Mutable).retentionAttempts = { count: 129, sha256: H, validUntil: new Date(now + 60000).toISOString() },
  ]) {
    const f = fixture(); let calls = 0;
    assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, observe: async req => { calls++; const o = f.observation(req); mutate(o as unknown as Mutable); return o; } })(f.target), { outcome: "held" });
    assert.equal(calls, 1);
  }
});
test("nonempty retention requires exact admitted expiry and clips proof to existing evidence deadline", async () => {
  const f = fixture(), deadline = new Date(now + 1000).toISOString();
  const row = { count: 1, sha256: H, validUntil: deadline };
  const admission = { ...f.admission, retained: { retentionAttempts: row } };
  const observe = async (req: ScopeObservationRequest) => ({ ...f.observation(req), references: { ...f.observation(req).references, retentionAttempts: row } });
  const result = await createCurrentAuthScopePreflight({ ...f.deps, admission, observe })(f.target);
  assert.equal(result.outcome, "allowed"); if (result.outcome === "allowed") assert.equal(result.binding.validUntil, deadline);
  for (const changed of [{ ...row, sha256: "b".repeat(64) }, { ...row, count: 2 }, { ...row, validUntil: new Date(now + 2000).toISOString() }, { ...row, validUntil: new Date(now - 1).toISOString() }]) {
    assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, admission, observe: async req => ({ ...await observe(req), references: { ...f.observation(req).references, retentionAttempts: changed } }) })(f.target), { outcome: "held" });
  }
  assert.deepEqual(await createCurrentAuthScopePreflight({ ...f.deps, admission: { ...admission, custodyPolicy: { ...custodyPolicy, approved: false } } as unknown as ScopeAdmission, observe })(f.target), { outcome: "held" });
});

// Common observation facts deliberately confer no strict deletion authorization.
test("shared reader emits observation evidence only; a null fence still holds strict factory", async () => {
  const f = fixture(), deps = { ...f.deps, observe: async (r: ScopeObservationRequest) => ({ ...f.observation(r), writeFence: null }) };
  const evidence = await createCurrentAuthScopeEvidenceReader(deps)(f.target);
  assert.equal(evidence.outcome, "observed");
  if (evidence.outcome === "observed") assert.equal(evidence.observation.writeFence, null);
  assert.deepEqual(await createCurrentAuthScopePreflight(deps)(f.target), { outcome: "held" });
});

test("shared evidence cannot mutate the private policy snapshot used by subsequent observations", async () => {
  const f = fixture(), read = createCurrentAuthScopeEvidenceReader(f.deps);
  const first = await read(f.target); assert.equal(first.outcome, "observed");
  if (first.outcome !== "observed") throw Error("missing observation");
  (first.request.custodyPolicy as unknown as Mutable).version = "mutated-caller-copy";
  const second = await read(f.target); assert.equal(second.outcome, "observed");
  if (second.outcome !== "observed") throw Error("missing observation");
  assert.equal(second.request.custodyPolicy.version, custodyPolicy.version);
});
