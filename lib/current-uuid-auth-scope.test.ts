import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCurrentUuidAuthScopePreflight, UUID_DELETE_PROFILE, LOCAL_DELETE_SCOPE, isIssuedUuidAuthScopeProof, type CurrentUuidAuthScopeDependencies } from "./current-uuid-auth-scope.server.ts";
import { CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, createCurrentAuthScopePreflight, type ScopeAdmission, type ScopeObservationRequest, type ScopeObservation } from "./current-auth-scope.server.ts";
const H = "a".repeat(64), NOW = Date.parse("2026-11-01T01:00:00Z");
function fixture() {
  // Entirely synthetic facts. No production local-denial RPC is implemented.
  const target = { userId: randomUUID(), identityHash: H, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(NOW + 60000).toISOString() };
  const admission: ScopeAdmission = { authorizationId: randomUUID(), target, accountRevision: 2, expectedAuthGraphSha256: H, expectedCatalogSha256: H, expectedEngineSha256: H, expiresAt: target.leaseUntil, maxObservationAgeMs: 3000, retained: {},
    deletionPolicy: { approved: true, version: UUID_DELETE_PROFILE, preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] },
    custodyPolicy: { approved: true, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] } };
  let clock = NOW, reads = 0, localReads = 0;
  function observation(r: ScopeObservationRequest): ScopeObservation {
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
  const strip = (r: ScopeObservationRequest) => observation(r);
  const deps: CurrentUuidAuthScopeDependencies = { enabled: true, admission, writerManifestSha256: H, writerCatalogSha256: H, now: () => clock, observe: async r => { reads++; return strip(r); }, observeLocalDenial: async r => { localReads++; return local(r); } };
  return { admission, target, deps, observation: strip, local, time: (n: number) => { clock = n; }, reads: () => reads, locals: () => localReads };
}
type Row = Record<string, unknown>;
test("explicit UUID proof uses all observed facts and durable synthetic local denial; strict null-fence profile stays held", async () => {
  const f = fixture(), p = await createCurrentUuidAuthScopePreflight(f.deps)(f.target);
  assert.equal(p.outcome, "allowed"); assert.equal(isIssuedUuidAuthScopeProof(p), true);
  if (p.outcome !== "allowed") throw Error("missing proof");
  assert.equal(p.profile, UUID_DELETE_PROFILE); assert.equal(p.providerPredicate, "account-uuid-only"); assert.equal(p.strongWriteFence, null); assert.equal(p.accountRevision, 2);
  assert.equal(Object.isFrozen(p.binding), true); assert.equal(p.binding.validUntil, new Date(NOW + 3000).toISOString());
  assert.equal(isIssuedUuidAuthScopeProof({ ...p }), false);
  assert.deepEqual(await createCurrentAuthScopePreflight({ enabled: true, admission: f.admission, observe: f.deps.observe, now: f.deps.now })(f.target), { outcome: "held" });
});
test("missing real port, disabled selection and old policy cannot even collect scope facts", async () => {
  for (const mode of ["off", "local", "observe", "legacy-policy", "bad-manifest", "extra", "inherited"] as const) {
    const f = fixture(); let deps = { ...f.deps };
    if (mode === "off") deps.enabled = false; if (mode === "local") deps.observeLocalDenial = undefined; if (mode === "observe") deps.observe = undefined;
    if (mode === "legacy-policy") deps.admission = { ...f.admission, deletionPolicy: { ...f.admission.deletionPolicy, version: "strict-original" } };
    if (mode === "bad-manifest") deps.writerManifestSha256 = "unreviewed";
    if (mode === "extra") deps = { ...deps, skipFence: true } as typeof deps;
    if (mode === "inherited") deps = Object.create(deps);
    assert.deepEqual(await createCurrentUuidAuthScopePreflight(deps)(f.target), { outcome: "held" }, mode); assert.equal(f.reads(), 0); assert.equal(f.locals(), 0);
  }
});
test("all original storage/application/schema/engine/reference/freshness failures still prevent local admission", async () => {
  const mutations: ((o: Row) => void)[] = [o => o.accountRevision = 3, o => o.policySha256 = "b".repeat(64), o => o.catalogSha256 = "b".repeat(64), o => o.authGraphSha256 = "b".repeat(64), o => o.providerOperations = "active", o => o.unclassifiedReferences = 1,
    o => (o.storage as Row).objects = 1, o => (o.storage as Row).unknownLinkages = 1, o => (o.application as Row).privateResidue = 1, o => (o.engine as Row).authLinks = 1, o => (o.engine as Row).unknownLinkages = 1,
    o => o.observedAt = "2026-02-30T00:00:00Z", o => o.validUntil = new Date(NOW - 1).toISOString(), o => o.writeFence = { bindingSha256: H, evidenceSha256: H, validUntil: new Date(NOW + 5000).toISOString() }];
  for (const mutate of mutations) {
    const f = fixture(), p = createCurrentUuidAuthScopePreflight({ ...f.deps, observe: async r => { const o = f.observation(r); mutate(o); return o; } });
    assert.deepEqual(await p(f.target), { outcome: "held" }); assert.equal(f.locals(), 0);
  }
});
test("cross-profile, foreign uid/revision/policy/catalog and TTL-only local facts cannot authorize", async () => {
  const mutations: ((o: ReturnType<ReturnType<typeof fixture>["local"]>) => void)[] = [o => o.profile = "strict" as typeof UUID_DELETE_PROFILE, o => o.binding = { ...o.binding, userId: randomUUID() }, o => o.accountRevision = 3, o => o.policySha256 = "b".repeat(64),
    o => o.authorizationId = randomUUID(), o => o.scopeSha256 = "b".repeat(64), o => o.writerManifestSha256 = "b".repeat(64), o => o.writerCatalogSha256 = "b".repeat(64), o => o.denial.durability = "ttl-only", o => o.denial.accountState = "active", o => o.denial.custodyGate = "open", o => o.denial.ordinaryOwnerWrites = "allowed", o => o.denial.allowedOriginalProgress = "any", o => o.denial.unknownWriters = 1, o => o.denial.barrierRevision = 0,
    o => o.observedAt = new Date(NOW + 1).toISOString(), o => o.validUntil = new Date(NOW - 1).toISOString()];
  for (const mutate of mutations) { const f = fixture(); assert.deepEqual(await createCurrentUuidAuthScopePreflight({ ...f.deps, observeLocalDenial: async r => { const o = f.local(r); mutate(o); return o; } })(f.target), { outcome: "held" }); }
});
test("exact retained row and parent expiry remain mandatory and clip UUID proof", async () => {
  const f = fixture(), row = { count: 1, sha256: H, validUntil: new Date(NOW + 1000).toISOString() }, observe = async (r: ScopeObservationRequest) => { const o = f.observation(r); return { ...o, references: { ...o.references, retentionAttempts: row } }; };
  assert.deepEqual(await createCurrentUuidAuthScopePreflight({ ...f.deps, observe })(f.target), { outcome: "held" });
  const admission = { ...f.admission, retained: { retentionAttempts: row } };
  const p = await createCurrentUuidAuthScopePreflight({ ...f.deps, admission, observe })(f.target);
  assert.equal(p.outcome, "allowed"); if (p.outcome === "allowed") assert.equal(p.binding.validUntil, row.validUntil);
  for (const bad of [{ ...row, count: 129 }, { ...row, sha256: "b".repeat(64) }, { ...row, validUntil: null }]) {
    assert.deepEqual(await createCurrentUuidAuthScopePreflight({ ...f.deps, admission, observe: async r => { const o = await observe(r); return { ...o, references: { ...o.references, retentionAttempts: bad } }; } })(f.target), { outcome: "held" });
  }
});
test("accessors and inherited configuration never execute; receiver forwarding never reads function metadata", async () => {
  const f = fixture(); let gets = 0;
  const getter = Object.defineProperty({ ...f.deps }, "observeLocalDenial", { get() { gets++; throw Error("getter"); } });
  assert.deepEqual(await createCurrentUuidAuthScopePreflight(getter)(f.target), { outcome: "held" });
  const badTarget = Object.defineProperty({ ...f.target }, "userId", { get() { gets++; throw Error("getter"); } });
  assert.deepEqual(await createCurrentUuidAuthScopePreflight(f.deps)(badTarget), { outcome: "held" });
  const fn = async function (this: CurrentUuidAuthScopeDependencies, r: ScopeObservationRequest) { assert.equal(this.observeLocalDenial, fn); return f.local(r); };
  Object.defineProperty(fn, "bind", { get() { gets++; throw Error("bind"); } }); Object.defineProperty(fn, "name", { get() { gets++; throw Error("name"); } });
  const configured = { ...f.deps, observeLocalDenial: fn };
  // The receiver is the explicitly captured configuration object.
  assert.equal((await createCurrentUuidAuthScopePreflight(configured)(f.target)).outcome, "allowed"); assert.equal(gets, 0);
});
test("configuration and input snapshots survive mutation; local await rechecks expiry and never retries", async () => {
  const f = fixture(), p = createCurrentUuidAuthScopePreflight(f.deps), original = structuredClone(f.target);
  (f.admission as unknown as Row).accountRevision = 99; f.target.userId = randomUUID(); assert.equal((await p(original)).outcome, "allowed");
  const g = fixture(); let calls = 0;
  const q = createCurrentUuidAuthScopePreflight({ ...g.deps, observeLocalDenial: async r => { calls++; const o = g.local(r); r.binding.userId = randomUUID(); g.time(NOW + 4000); return o; } });
  assert.deepEqual(await q(g.target), { outcome: "held" }); assert.equal(calls, 1);
  const h = fixture();
  assert.deepEqual(await createCurrentUuidAuthScopePreflight({ ...h.deps, observeLocalDenial: async () => { throw Error("RPC unimplemented"); } })(h.target), { outcome: "held" });
  assert.deepEqual(await createCurrentUuidAuthScopePreflight({ ...h.deps, admission: { ...h.admission, maxObservationAgeMs: 5 }, observeLocalDenial: async () => new Promise(() => {}) })(h.target), { outcome: "held" });
});
