import { createCurrentUuidReceiptCleanup, UUID_RECEIPT_CONTRACT, type CurrentUuidReceiptCleanupInput } from "./current-uuid-receipt-cleanup.server.ts";
import type { CurrentUuidOriginalRecoveryStrategy } from "./current-uuid-original-recovery-contract.server.ts";
import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCurrentUuidClaimAuthStrategy, type CurrentUuidClaimAuthConfiguration } from "./current-uuid-claim-auth.server.ts";
import type { CurrentUuidClaimIssueRequest, CurrentUuidIssuedClaimScope } from "./current-uuid-claim-contract.server.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";
import { CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, type ScopeObservationRequest, type ScopeObservation } from "./current-auth-scope.server.ts";
import { UUID_DELETE_PROFILE, LOCAL_DELETE_SCOPE } from "./current-uuid-auth-scope.server.ts";
import { appleDigest, type AppleData } from "./apple-token-custody.server.ts";
import type { DeletionTarget } from "./account-deletion.ts";
const NOW = Date.parse("2026-11-01T04:00:00Z"), ORIGIN = "https://claim.synthetic.invalid", H = "a".repeat(64);
type Claim = { target: DeletionTarget; fence: AppleData };
async function fixture() {
  // Synthetic claim/issuer/SQL facts and fake transports ONLY. No claim exists
  // until claim() is called; no preloaded future work/admission/constant fence.
  const A: string = randomUUID(), B: string = randomUUID(), users = new Map([A, B].map(id => [id, { id, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: randomUUID(), user_id: id, provider: "email", id: "synthetic-lineage-" + id, created_at: "2026-10-01T00:00:00Z" }] }]));
  const missing = new Set<string>(), claims = new Map<string, Claim>(), records = new Map<string, { state: string; scope: AppleData; scopeHash: string; evidenceHash: string }>();
  const calls: { action: string; owner: string; data?: unknown }[] = [], issues: CurrentUuidClaimIssueRequest[] = [];
  let clock = NOW, lose = "", mode = "", attempt = 0;
  let mutateIssue: ((value: CurrentUuidIssuedClaimScope, request: CurrentUuidClaimIssueRequest) => unknown) | undefined;
  const deletionPolicy = { approved: true as const, version: UUID_DELETE_PROFILE, preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
  const custodyPolicy = { approved: true as const, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
  const transport: typeof fetch = async (url, init) => {
    const id = String(url).split("/").at(-1)!; assert.ok(users.has(id)); assert.equal(String(url), ORIGIN + "/auth/v1/admin/users/" + id);
    calls.push({ action: init?.method ?? "GET", owner: id });
    if (init?.method === "DELETE") { assert.equal(init.body, '{"should_soft_delete":false}'); missing.add(id); if (lose === "delete") throw Error("synthetic lost effect ACK"); return Response.json(users.get(id)); }
    if (missing.has(id)) { if (lose === "status") throw Error("synthetic unknown GET"); return Response.json({ code: mode === "generic404" ? "gateway_missing" : "user_not_found" }, { status: 404 }); }
    return Response.json(users.get(id));
  };
  const readIdentity = supabaseDeletionAuthV2(ORIGIN, "synthetic-server-only", transport).verifyIdentity;
  const identities = new Map<string, string>();
  for (const id of [A, B]) { const identity = await readIdentity(id); assert.ok(identity); identities.set(id, identity.identityHash); }
  calls.length = 0;
  function claim(id: string, previous?: Claim): Claim {
    const target = previous ? { ...previous.target } : { userId: id, identityHash: identities.get(id)!, operationId: randomUUID() };
    const fence: AppleData = { owner: randomUUID(), attempt: ++attempt, lease: new Date(clock + 60000).toISOString(), intentId: previous?.fence.intentId ?? randomUUID(), intentSha256: previous?.fence.intentSha256 ?? H,
      policySha256: appleDigest(deletionPolicy), currentIdentityHash: target.identityHash, actualApple: "none", effectiveApple: "linked", apple: "linked", authState: "started", disposition: "unknown", fenceHash: appleDigest([target, attempt]), accountRevision: 2 };
    const value = { target, fence }; claims.set(id, value); return value;
  }
  const repository = { async command(ns: string, action: string, body: AppleData): Promise<AppleData> {
    assert.equal(this, repository); assert.equal(ns, "deletion"); const id = String(body.userId); const c = claims.get(id); calls.push({ action, owner: id, data: body });
    if (!c || c.target.operationId !== body.operationId || c.target.identityHash !== body.identityHash) return { error: "original_unresolved" };
    if (action === "auth_fence") { if (mode === "unknownRPC") throw Error("synthetic fence unavailable"); return structuredClone(c.fence); }
    const op = String(body.operationId), prior = records.get(op);
    if (action === "auth_begin") {
      if (prior) return { fresh: false };
      const scope = body.scope as AppleData; records.set(op, { state: "started", scope, scopeHash: appleDigest(scope), evidenceHash: H });
      if (lose === "begin") throw Error("synthetic lost begin ACK"); return { fresh: true };
    }
    if (action === "auth_original") return prior ? { state: prior.state, scopeAdmitted: true, scopeHash: prior.scopeHash, evidenceHash: prior.evidenceHash,
      scopeProfile: mode === "strict-original" ? "strict" : prior.scope.profile, scopeProviderPredicate: prior.scope.providerPredicate, scopePolicySha256: (prior.scope.binding as AppleData).policySha256, scopeAccountRevision: prior.scope.accountRevision } : { state: "unadmitted", scopeAdmitted: false };
    if (action === "auth_record") { assert.ok(prior); prior.state = "confirmed"; prior.evidenceHash = String(body.evidenceHash); if (lose === "record") throw Error("synthetic lost record ACK"); return { state: prior.state, evidenceHash: prior.evidenceHash }; }
    throw Error("unexpected repository action");
  } };
  const issuer = { async issue(input: CurrentUuidClaimIssueRequest): Promise<CurrentUuidIssuedClaimScope | null> {
    assert.equal(this, issuer); calls.push({ action: "issue:" + input.phase, owner: input.target.userId }); issues.push(structuredClone(input));
    if (mode === "issuer-held") return null;
    const current = claims.get(input.target.userId); assert.ok(current); assert.deepEqual(input.fence, current.fence);
    const r = input.fence;
    const value: CurrentUuidIssuedClaimScope = { phase: input.phase, writerManifestSha256: H, writerCatalogSha256: H, admission: {
      authorizationId: randomUUID(), target: { userId: input.target.userId, identityHash: input.target.identityHash, authOperationId: input.target.operationId, deletionOperationId: String(r.intentId), intentSha256: String(r.intentSha256), workOwner: String(r.owner), workAttempt: Number(r.attempt), leaseUntil: String(r.lease) },
      deletionPolicy, custodyPolicy, accountRevision: 2, expectedAuthGraphSha256: H, expectedCatalogSha256: H, expectedEngineSha256: H, expiresAt: new Date(Math.min(clock + 30000, Date.parse(String(r.lease)))).toISOString(), maxObservationAgeMs: 3000, retained: {} } };
    if (mutateIssue) return mutateIssue(value, input) as CurrentUuidIssuedClaimScope;
    return value;
  } };
  const observe = async (r: ScopeObservationRequest): Promise<unknown> => {
    calls.push({ action: "observe", owner: r.binding.userId });
    if (mode === "scope-unknown") return { outcome: "held" };
    const value: ScopeObservation = { contract: CURRENT_AUTH_SCOPE, binding: r.binding, policySha256: r.policySha256, authorizationId: r.authorizationId, scopeSha256: r.scopeSha256, observedAt: new Date(clock).toISOString(), validUntil: new Date(clock + 20000).toISOString(), accountRevision: 2,
      authGraphSha256: H, catalogSha256: mode === "catalog-mismatch" ? "b".repeat(64) : H, storage: { objects: 0, buckets: 0, multipartUploads: 0, multipartParts: 0, metadataReferences: 0, unknownLinkages: 0 },
      application: { savedWeeks: 0, accountReceipts: mode === "receipts-present" ? 1 : 0, pushTokens: 0, pushReceipts: 0, pushJobs: 0, currentPlanCleanupPending: false, privateResidue: 0, unexpectedAccountFields: 0 },
      references: Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k => [k, { count: 0, sha256: H, ...(k === "retentionAttempts" ? { validUntil: null } : {}) }])) as ScopeObservation["references"],
      engine: { metadataSha256: H, authLinks: 0, ownerMatches: 0, unknownLinkages: 0 }, providerOperations: "settled", unclassifiedReferences: 0, writeFence: null };
    return value;
  };
  const observeLocalDenial = async (r: ScopeObservationRequest) => {
    calls.push({ action: "local", owner: r.binding.userId });
    return { contract: LOCAL_DELETE_SCOPE, profile: UUID_DELETE_PROFILE, providerPredicate: "account-uuid-only", binding: r.binding, policySha256: r.policySha256, authorizationId: r.authorizationId, scopeSha256: r.scopeSha256,
      observedAt: new Date(clock).toISOString(), validUntil: new Date(clock + 20000).toISOString(), accountRevision: 2, writerManifestSha256: H, writerCatalogSha256: mode === "writer-mismatch" ? "b".repeat(64) : H, writeFence: null,
      denial: { accountState: "deletion_pending", custodyGate: "closed", ordinaryOwnerWrites: "denied", allowedOriginalProgress: "same-original-only", durability: "persisted-until-original-resolution", barrierRevision: 3, unknownWriters: 0 } };
  };
  const config: CurrentUuidClaimAuthConfiguration = { origin: ORIGIN, serverCredential: "synthetic-server-only", repository, issuer, observe, observeLocalDenial, deletionPolicy, custodyPolicy, request: transport, now: () => clock, timeoutMs: 1000 };
  return { A, B, config, calls, issues, records, claims, claim, users, count: (a: string) => calls.filter(c => c.action === a).length, mode: (x: string) => { mode = x; }, lose: (x: string) => { lose = x; }, time: (x: number) => { clock = x; }, issueMutation: (fn: typeof mutateIssue) => { mutateIssue = fn; } };
}
test("owner-bound prepare identity lookup has no future target/admission and constructors have zero IO", async () => {
  const f = await fixture(), strategy = createCurrentUuidClaimAuthStrategy(f.config), a = strategy.forOwner(f.A), b = strategy.forOwner(f.B);
  assert.equal(strategy.profile, UUID_DELETE_PROFILE); assert.equal(f.calls.length, 0); assert.equal(f.claims.size, 0);
  assert.equal((await a.verifyIdentity(f.A))?.userId, f.A); assert.equal(await a.verifyIdentity(f.B), null); assert.equal((await b.verifyIdentity(f.B))?.userId, f.B);
  assert.equal(f.count("auth_fence"), 0); assert.equal(f.count("issue:run"), 0); assert.equal(f.count("DELETE"), 0);
});
test("fresh random actual claim -> private issuer -> accepted preflight/provider chain, independently for two owners", async () => {
  const f = await fixture(), strategy = createCurrentUuidClaimAuthStrategy(f.config);
  const a = f.claim(f.A), b = f.claim(f.B); assert.notEqual(a.fence.owner, b.fence.owner); assert.notEqual(a.target.operationId, b.target.operationId);
  for (const c of [a, b]) { const start = f.calls.length, result = await strategy.forOwner(c.target.userId).auth.run(c.target); assert.equal(result.outcome, "confirmed"); assert.ok(f.calls.slice(start).every(x => x.owner === c.target.userId)); }
  assert.equal(f.count("DELETE"), 2); assert.equal(f.count("auth_begin"), 2); assert.equal(f.count("observe"), 2); assert.equal(f.count("local"), 2);
  for (const i of f.issues) { assert.equal(i.phase, "run"); assert.deepEqual(i.fence, f.claims.get(i.target.userId)!.fence); }
});
test("held issuer, unknown RPC, observation or independently pinned catalog/writer mismatch cannot admit", async () => {
  for (const mode of ["issuer-held", "unknownRPC", "scope-unknown", "catalog-mismatch", "writer-mismatch", "receipts-present"]) {
    const f = await fixture(), c = f.claim(f.A); f.mode(mode); const result = await createCurrentUuidClaimAuthStrategy(f.config).forOwner(f.A).auth.run(c.target);
    assert.equal(result.outcome, "not_started", mode); assert.equal(f.count("DELETE"), 0); assert.equal(f.count("auth_begin"), 0);
  }
});
test("issued phase, owner/identity/original/claim/policy/deadline must exactly match current fence, never repinned", async () => {
  for (const mode of ["phase", "owner", "identity", "auth", "original", "intent", "workOwner", "attempt", "lease", "expired", "policy", "custody", "version", "revision", "extra", "writer-hash"]) {
    const f = await fixture(), c = f.claim(f.A);
    f.issueMutation(v => { const a = structuredClone(v) as CurrentUuidIssuedClaimScope, row = a.admission as unknown as AppleData, t = a.admission.target;
      if (mode === "phase") return { ...a, phase: "reconcile" };
      if (mode === "owner") t.userId = f.B; if (mode === "identity") t.identityHash = "b".repeat(64); if (mode === "auth") t.authOperationId = randomUUID(); if (mode === "original") t.deletionOperationId = randomUUID();
      if (mode === "intent") t.intentSha256 = "b".repeat(64); if (mode === "workOwner") t.workOwner = randomUUID(); if (mode === "attempt") t.workAttempt++; if (mode === "lease") t.leaseUntil = new Date(NOW + 50000).toISOString();
      if (mode === "expired") row.expiresAt = new Date(NOW - 1).toISOString(); if (mode === "revision") row.accountRevision = 3;
      if (mode === "policy") row.deletionPolicy = { ...a.admission.deletionPolicy, receiptSeconds: 700 }; if (mode === "custody") row.custodyPolicy = { ...a.admission.custodyPolicy, version: "other" }; if (mode === "version") row.deletionPolicy = { ...a.admission.deletionPolicy, version: "strict" };
      if (mode === "extra") return { ...a, allowed: true }; if (mode === "writer-hash") return { ...a, writerCatalogSha256: "unverified" }; return a;
    });
    assert.equal((await createCurrentUuidClaimAuthStrategy(f.config).forOwner(f.A).auth.run(c.target)).outcome, "not_started", mode); assert.equal(f.count("auth_begin"), 0); assert.equal(f.count("DELETE"), 0);
  }
});
test("fence changes during issuance are rejected by accepted provider's bound actual rereads", async () => {
  for (const field of ["owner", "attempt", "lease", "fenceHash", "policySha256"]) {
    const f = await fixture(), c = f.claim(f.A); f.issueMutation(v => { c.fence[field] = field === "attempt" ? 999 : field === "lease" ? new Date(NOW + 50000).toISOString() : field === "owner" ? randomUUID() : "b".repeat(64); return v; });
    assert.equal((await createCurrentUuidClaimAuthStrategy(f.config).forOwner(f.A).auth.run(c.target)).outcome, "not_started", field); assert.equal(f.count("DELETE"), 0); assert.equal(f.count("auth_begin"), 0);
  }
});
for (const loss of ["begin", "delete", "record", "status"]) test(`lost ${loss} ACK, replacement work claim and original reconcile never send a second DELETE`, async () => {
  const f = await fixture(), c = f.claim(f.A);
  const recovery: CurrentUuidOriginalRecoveryStrategy = { forOwner(owner) { assert.equal(owner, f.A); return { async reconcile(t) { assert.equal(t.userId, owner); return { ...t, outcome: loss === "begin" ? "unknown" : loss === "record" ? "confirmed" : "already_absent", evidenceHash: H }; } }; } };
  const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, originalRecovery: recovery }); f.lose(loss);
  const result = await strategy.forOwner(f.A).auth.run(c.target); assert.equal(result.outcome, "unknown"); const deletes = f.count("DELETE"), original = structuredClone(f.records.get(c.target.operationId));
  f.lose(""); const next = f.claim(f.A, c); assert.notEqual(next.fence.owner, c.fence.owner); assert.notEqual(next.fence.attempt, c.fence.attempt);
  const recovered = await strategy.forOwner(f.A).auth.reconcile!(next.target); assert.equal(recovered.outcome, loss === "begin" ? "unknown" : loss === "record" ? "confirmed" : "already_absent"); assert.equal(f.count("DELETE"), deletes);
  const stored = f.records.get(c.target.operationId)!; assert.equal(stored.scopeHash, original?.scopeHash); assert.deepEqual(stored.scope, original?.scope);
  assert.deepEqual(f.issues.map(i => i.phase), ["run"]); // Recovery port is synthetic here; Main must prove its actual SQL implementation.
});
test("already-started, unadmitted or strict stored original never grants a fresh operation", async () => {
  const f = await fixture(), c = f.claim(f.A), strategy = createCurrentUuidClaimAuthStrategy(f.config);
  assert.equal((await strategy.forOwner(f.A).auth.reconcile!(c.target)).outcome, "unknown"); assert.equal(f.count("DELETE"), 0);
  f.lose("delete"); await strategy.forOwner(f.A).auth.run(c.target); assert.equal(f.count("DELETE"), 1);
  f.lose(""); f.mode("strict-original"); assert.equal((await strategy.forOwner(f.A).auth.reconcile!(c.target)).outcome, "unknown"); assert.equal(f.count("DELETE"), 1);
  f.mode("generic404"); assert.equal((await strategy.forOwner(f.A).auth.reconcile!(c.target)).outcome, "unknown"); assert.equal(f.count("DELETE"), 1);
});
test("foreign caller/target has zero issuer/repository/provider IO and target originals are detached", async () => {
  const f = await fixture(), c = f.claim(f.A), port = createCurrentUuidClaimAuthStrategy(f.config).forOwner(f.B);
  assert.equal((await port.auth.run(c.target)).outcome, "not_started"); assert.equal((await port.auth.reconcile!(c.target)).outcome, "unknown"); assert.equal(f.calls.length, 0);
  const a = createCurrentUuidClaimAuthStrategy(f.config).forOwner(f.A), original = structuredClone(c.target);
  f.issueMutation((v, input) => { input.target.userId = f.B; (input.fence as AppleData).owner = randomUUID(); return v; });
  assert.equal((await a.auth.run(c.target)).outcome, "confirmed"); assert.deepEqual(c.target, original);
});
test("config/input/issuer accessors/proxies/metadata are never executed; policy config is immutable", async () => {
  const f = await fixture(), c = f.claim(f.A); let gets = 0; const getter = () => { gets++; throw Error("getter"); };
  const proxy = new Proxy({}, { getPrototypeOf() { gets++; throw Error("proxy"); }, ownKeys() { gets++; throw Error("proxy"); } });
  for (const input of [undefined, {}, proxy, Object.create(f.config), { ...f.config, skipProof: true }, { ...f.config, timeoutMs: { valueOf: getter } }, Object.defineProperty({ ...f.config }, "issuer", { get: getter }), { ...f.config, issuer: Object.defineProperty({}, "issue", { get: getter }) }]) {
    const port = createCurrentUuidClaimAuthStrategy(input as CurrentUuidClaimAuthConfiguration).forOwner(f.A); assert.equal((await port.auth.run(c.target)).outcome, "not_started");
  }
  assert.equal(f.calls.length, 0);
  for (const fn of [f.config.issuer.issue, f.config.repository.command, f.config.request!, f.config.observe]) for (const k of ["bind", "name"]) Object.defineProperty(fn, k, { get: getter });
  const strategy = createCurrentUuidClaimAuthStrategy(f.config);
  (f.config as unknown as AppleData).deletionPolicy = { ...f.config.deletionPolicy, version: "mutated-after-construction" };
  (f.config as unknown as AppleData).issuer = { issue() { throw Error("replaced issuer must not execute"); } };
  assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, "confirmed");
  const bad = Object.defineProperty({ ...c.target }, "userId", { get: getter }); await assert.rejects(strategy.forOwner(f.A).auth.run(bad)); assert.equal(gets, 0);
});
test("issuer output accessor/proxy, stale lease and timeout remain no-effect without retries", async () => {
  for (const mode of ["accessor", "proxy", "stale", "expired-after-issue", "timeout"]) {
    const f = await fixture(), c = f.claim(f.A); let gets = 0;
    f.issueMutation(v => {
      if (mode === "accessor") return Object.defineProperty({ ...v }, "admission", { get() { gets++; throw Error("getter"); } });
      if (mode === "proxy") return new Proxy({}, { ownKeys() { gets++; throw Error("proxy"); } });
      if (mode === "stale") { c.fence.lease = new Date(NOW - 1).toISOString(); return v; }
      if (mode === "expired-after-issue") { f.time(NOW + 60001); return v; }
      return new Promise(() => {});
    });
    const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, timeoutMs: 5 });
    assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, "not_started", mode); assert.equal(f.count("DELETE"), 0); assert.equal(f.count("issue:run"), 1); assert.equal(gets, 0);
  }
});


test("run composes actual receipt factory after fence and rechecks before issuer/final provider", async () => {
  const f = await fixture(), c = f.claim(f.A); let count = 1;
  const cleanup = createCurrentUuidReceiptCleanup({ policy: f.config.deletionPolicy, now: () => NOW, timeoutMs: 1000, maxObservationAgeMs: 1000,
    async rpc(name, body) {
      assert.equal(name, "wd_current_ephemeral_deletion_receipt_cleanup"); f.calls.push({ action: "receipt", owner: body.userId });
      assert.deepEqual(body, { userId: f.A, authOperationId: c.target.operationId, deletionOperationId: c.fence.intentId, intentSha256: c.fence.intentSha256, identityHash: c.target.identityHash, workOwner: c.fence.owner, workAttempt: c.fence.attempt, leaseUntil: c.fence.lease, accountRevision: 2, policySha256: c.fence.policySha256, policy: f.config.deletionPolicy });
      const { policy: ignored, ...binding } = body; assert.equal(ignored.version, UUID_DELETE_PROFILE); count = 0;
      return { contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding, removed: 1, remaining: count, observedAt: new Date(NOW).toISOString() };
    } });
  const observe = f.config.observe;
  const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, receiptCleanup: cleanup, async observe(r) { const raw = await observe(r) as ScopeObservation; return { ...raw, application: { ...raw.application, accountReceipts: count } }; } });
  assert.equal(f.calls.length, 0); await strategy.forOwner(f.A).verifyIdentity(f.A); assert.equal(f.count("receipt"), 0); f.calls.length = 0;
  assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, "confirmed");
  const actions = f.calls.map(c => c.action); assert.deepEqual(actions.slice(0, 5), ["auth_fence", "observe", "receipt", "auth_fence", "issue:run"]);
  assert.ok(actions.lastIndexOf("observe") > actions.indexOf("issue:run")); assert.ok(actions.indexOf("DELETE") > actions.lastIndexOf("observe")); assert.equal(f.count("DELETE"), 1); assert.equal(f.count("receipt"), 1);
});

test("reconcile without recovery is unknown, independent of absent Auth/held issuer and emits zero IO", async () => {
  const f = await fixture(), c = f.claim(f.A); f.mode("issuer-held");
  const result = await createCurrentUuidClaimAuthStrategy(f.config).forOwner(f.A).auth.reconcile!(c.target);
  assert.equal(result.outcome, "unknown"); assert.equal(f.calls.length, 0);
});

test("owner-bound structural recovery is captured, correlated and independent of issuer/cleanup", async () => {
  const f = await fixture(), c = f.claim(f.A); let n = 0;
  const port = { async reconcile(t: DeletionTarget) { assert.equal(this, port); n++; return { ...t, outcome: "already_absent" as const, evidenceHash: H }; } };
  const recovery = { forOwner(owner: string) { assert.equal(this, recovery); assert.equal(owner, f.A); return port; } };
  const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, originalRecovery: recovery });
  assert.equal(n, 0);
  // Actual accepted run used the fake DELETE transport and removed Auth in this
  // fixture. Recovery implementation remains an explicitly structural port.
  assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, "confirmed"); assert.equal(f.count("DELETE"), 1);
  f.calls.length = 0; f.mode("issuer-held");
  assert.equal((await strategy.forOwner(f.A).auth.reconcile!(c.target)).outcome, "already_absent"); assert.equal(n, 1); assert.equal(f.calls.length, 0);
});


test("actual receipt port held/unknown/malformed/late ACK and changed durable tuple deny destruction without retry", async () => {
  for (const mode of ["held", "unknown", "foreign", "remaining", "stale", "drift", "throw", "timeout"]) {
    const f = await fixture(), c = f.claim(f.A); let n = 0;
    if (mode === "no-revision") delete c.fence.accountRevision;
    const cleanup = createCurrentUuidReceiptCleanup({ policy: f.config.deletionPolicy, now: () => NOW, timeoutMs: 5, maxObservationAgeMs: 1000,
      async rpc(_name, body) {
        n++; f.calls.push({ action: "receipt", owner: body.userId });
        if (mode === "held" || mode === "unknown") return { outcome: mode };
        if (mode === "throw") throw Error("synthetic lost receipt ACK"); if (mode === "timeout") return new Promise(() => {});
        if (mode === "drift") c.fence.owner = randomUUID();
        const { policy: ignored, ...binding } = body; assert.equal(ignored.version, UUID_DELETE_PROFILE);
        return { contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding: mode === "foreign" ? { ...binding, workOwner: randomUUID() } : binding, removed: 1, remaining: mode === "remaining" ? 1 : 0, observedAt: new Date(NOW - (mode === "stale" ? 2000 : 0)).toISOString() };
      } });
    const result = await createCurrentUuidClaimAuthStrategy({ ...f.config, receiptCleanup: cleanup }).forOwner(f.A).auth.run(c.target);
    assert.ok(["not_started", "unknown"].includes(result.outcome), mode); assert.equal(n, mode === "no-revision" ? 0 : 1, mode);
    assert.equal(f.count("issue:run"), 0, mode); assert.equal(f.count("auth_begin"), 0, mode); assert.equal(f.count("DELETE"), 0, mode);
  }
});

test("strategy independently rejects malformed trusted cleanup correlation and accessor results", async () => {
  for (const mode of ["foreign", "stale", "future", "extra", "accessor", "expired"]) {
    const f = await fixture(), c = f.claim(f.A); let reads = 0, calls = 0;
    const cleanup = { async clear(b: CurrentUuidReceiptCleanupInput) {
      calls++;
      const r = { contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding: b, removed: 0, remaining: 0, observedAt: new Date(NOW).toISOString() };
      if (mode === "foreign") return { ...r, binding: { ...b, authOperationId: randomUUID() } };
      if (mode === "stale" || mode === "future") return { ...r, observedAt: new Date(NOW + (mode === "stale" ? -1 : 1)).toISOString() };
      if (mode === "extra") return { ...r, allowed: true };
      if (mode === "expired") f.time(NOW + 60001);
      if (mode === "accessor") return Object.defineProperty(r, "remaining", { get() { reads++; throw Error(); } });
      return r;
    } };
    const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, receiptCleanup: cleanup as unknown as CurrentUuidClaimAuthConfiguration["receiptCleanup"] });
    assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, "unknown", mode); assert.equal(reads, 0); assert.equal(calls, 1); assert.equal(f.count("issue:run"), 0); assert.equal(f.count("DELETE"), 0);
  }
});

test("recovery failures, foreign correlation, target mutation and post-entry throw stay unknown without any destructive dependencies", async () => {
  for (const mode of ["foreign-owner", "foreign-identity", "foreign-operation", "accessor", "proxy", "throw", "port-accessor", "not-started", "malformed", "timeout"]) {
    const f = await fixture(), c = f.claim(f.A); let gets = 0, n = 0;
    const port = { async reconcile(t: DeletionTarget) {
      n++; assert.equal(this, port);
      if (mode === "throw") throw Error("synthetic post-record lost ACK"); if (mode === "timeout") return new Promise(() => {});
      if (mode === "foreign-owner") t.userId = f.B;
      if (mode === "foreign-identity") t.identityHash = "b".repeat(64);
      if (mode === "foreign-operation") t.operationId = randomUUID();
      const r = { ...t, outcome: mode === "not-started" ? "not_started" : "confirmed", evidenceHash: H };
      if (mode === "malformed") return { ...r, allowed: true };
      if (mode === "accessor") return Object.defineProperty(r, "outcome", { get() { gets++; throw Error(); } });
      if (mode === "proxy") return new Proxy(r, { ownKeys() { gets++; throw Error(); } });
      return r;
    } };
    const recovery = { forOwner() { if (mode === "port-accessor") return Object.defineProperty({}, "reconcile", { get() { gets++; throw Error(); } }); return port; } };
    const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, timeoutMs: 5, originalRecovery: recovery as unknown as CurrentUuidOriginalRecoveryStrategy });
    const original = structuredClone(c.target);
    assert.equal((await strategy.forOwner(f.A).auth.reconcile!(c.target)).outcome, "unknown", mode);
    assert.deepEqual(c.target, original); assert.equal(gets, 0); assert.equal(n, mode === "port-accessor" ? 0 : 1); assert.equal(f.calls.length, 0);
  }
});

test("optional recovery/cleanup configuration accessors are inert; captured receivers ignore replacements", async () => {
  const f = await fixture(), c = f.claim(f.A); let gets = 0, n = 0;
  for (const key of ["originalRecovery", "receiptCleanup"]) {
    const config = Object.defineProperty({ ...f.config }, key, { get() { gets++; throw Error(); } });
    assert.equal((await createCurrentUuidClaimAuthStrategy(config).forOwner(f.A).auth.reconcile!(c.target)).outcome, "unknown");
  }
  const port = { async reconcile(t: DeletionTarget) { assert.equal(this, port); n++; return { ...t, outcome: "already_absent" as const, evidenceHash: H }; } };
  const recovery = { forOwner(owner: string) { assert.equal(this, recovery); assert.equal(owner, f.A); return port; } };
  for (const fn of [recovery.forOwner, port.reconcile]) for (const key of ["bind", "name"]) Object.defineProperty(fn, key, { get() { gets++; throw Error(); } });
  const config = { ...f.config, originalRecovery: recovery }, strategy = createCurrentUuidClaimAuthStrategy(config);
  Object.assign(recovery, { forOwner() { throw Error("replacement"); } }); Object.assign(config, { originalRecovery: {} });
  assert.equal((await strategy.forOwner(f.A).auth.reconcile!(c.target)).outcome, "already_absent");
  assert.equal((await strategy.forOwner(f.B).auth.reconcile!(c.target)).outcome, "unknown"); assert.equal(n, 1); assert.equal(gets, 0); assert.equal(f.calls.length, 0);
});


test("actual-shaped fence without revision obtains fresh non-authorizing correlated facts before receipt cleanup", async () => {
  const f = await fixture(), c = f.claim(f.A); delete c.fence.accountRevision;
  const requests: ScopeObservationRequest[] = []; let n = 0;
  const cleanup = createCurrentUuidReceiptCleanup({ policy: f.config.deletionPolicy, now: () => NOW, timeoutMs: 1000, maxObservationAgeMs: 1000,
    async rpc(_name, body) {
      n++; assert.equal(body.accountRevision, 2); assert.equal(body.deletionOperationId, c.fence.intentId);
      f.calls.push({ action: "receipt", owner: body.userId }); const { policy: ignored, ...binding } = body; assert.equal(ignored.version, UUID_DELETE_PROFILE);
      return { contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding, removed: 1, remaining: 0, observedAt: new Date(NOW).toISOString() };
    } });
  const observe = f.config.observe;
  const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, receiptCleanup: cleanup, async observe(r) {
    requests.push(structuredClone(r)); const value = await observe(r) as ScopeObservation;
    return { ...value, application: { ...value.application, accountReceipts: n === 0 ? 1 : 0 } };
  } });
  assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, "confirmed");
  assert.deepEqual(f.calls.slice(0, 5).map(c => c.action), ["auth_fence", "observe", "receipt", "auth_fence", "issue:run"]);
  assert.equal(n, 1); assert.equal(f.count("DELETE"), 1); assert.equal(requests.length, 2);
  const req = requests[0], { scopeSha256: digest, ...base } = req;
  assert.equal(digest, appleDigest(["wd-uuid-receipt-revision-facts-v1", "NON-AUTHORIZING", base, f.config.deletionPolicy]));
  assert.notEqual(req.authorizationId, requests[1].authorizationId); assert.notEqual(digest, requests[1].scopeSha256);
  assert.deepEqual(req.binding, { userId: f.A, identityHash: c.target.identityHash, authOperationId: c.target.operationId, deletionOperationId: c.fence.intentId, intentSha256: c.fence.intentSha256, workOwner: c.fence.owner, workAttempt: c.fence.attempt, leaseUntil: c.fence.lease });
});


test("metadata envelope correlation, freshness, shape and positive revision failures stop before receipt/issuer/provider", async () => {
  for (const mode of ["contract", "owner", "operation", "workOwner", "attempt", "lease", "policy", "nonce", "digest", "stale", "future", "expired", "beyondLease", "clock", "zero", "fraction", "overflow", "string", "extra", "missing", "storage", "application", "reference", "retention", "engine", "hash", "providerUnknown", "fence", "accessor", "proxy", "throw", "timeout"]) {
    const f = await fixture(), c = f.claim(f.A); delete c.fence.accountRevision; let clear = 0, reads = 0, gets = 0;
    const cleanup = createCurrentUuidReceiptCleanup({ policy: f.config.deletionPolicy, now: () => NOW, timeoutMs: 1000, maxObservationAgeMs: 1000, async rpc() { clear++; return { outcome: "held" }; } });
    const observe = f.config.observe;
    const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, timeoutMs: 5, receiptCleanup: cleanup, async observe(req) {
      reads++; const good = await observe(req) as ScopeObservation, row = structuredClone(good) as unknown as AppleData;
      if (mode === "throw") throw Error("synthetic unknown metadata ACK"); if (mode === "timeout") return new Promise(() => {});
      if (mode === "contract") row.contract = "v1";
      if (mode === "owner") row.binding = { ...good.binding, userId: f.B }; if (mode === "operation") row.binding = { ...good.binding, authOperationId: randomUUID() };
      if (mode === "workOwner") row.binding = { ...good.binding, workOwner: randomUUID() }; if (mode === "attempt") row.binding = { ...good.binding, workAttempt: 99 };
      if (mode === "lease") row.binding = { ...good.binding, leaseUntil: new Date(NOW + 50000).toISOString() };
      if (mode === "policy") row.policySha256 = "b".repeat(64); if (mode === "nonce") row.authorizationId = randomUUID(); if (mode === "digest") row.scopeSha256 = "b".repeat(64);
      if (mode === "stale") row.observedAt = new Date(NOW - 1).toISOString(); if (mode === "future") row.observedAt = new Date(NOW + 1).toISOString();
      if (mode === "expired") row.validUntil = new Date(NOW).toISOString(); if (mode === "beyondLease") row.validUntil = new Date(NOW + 60001).toISOString(); if (mode === "clock") f.time(NOW + 60001);
      if (mode === "zero") row.accountRevision = 0; if (mode === "fraction") row.accountRevision = 2.5; if (mode === "overflow") row.accountRevision = 2147483648; if (mode === "string") row.accountRevision = "2";
      if (mode === "extra") row.allowed = true; if (mode === "missing") delete row.accountRevision;
      if (mode === "storage") row.storage = { ...good.storage, objects: "0" }; if (mode === "application") row.application = { ...good.application, accountReceipts: "1" };
      if (mode === "reference") row.references = { ...good.references, extra: {} }; if (mode === "retention") row.references = { ...good.references, retentionAttempts: { count: 1, sha256: H, validUntil: null } };
      if (mode === "engine") row.engine = { ...good.engine, unknownLinkages: -1 }; if (mode === "hash") row.catalogSha256 = "not-a-hash";
      if (mode === "providerUnknown") row.providerOperations = "unknown"; if (mode === "fence") row.writeFence = { allowed: true };
      if (mode === "accessor") return Object.defineProperty(row, "accountRevision", { get() { gets++; throw Error(); } });
      if (mode === "proxy") return new Proxy(row, { ownKeys() { gets++; throw Error(); } });
      return row;
    } });
    const result = await strategy.forOwner(f.A).auth.run(c.target);
    assert.equal(result.outcome, "not_started", mode); assert.equal(reads, 1, mode); assert.equal(gets, 0); assert.equal(clear, 0, mode); assert.equal(f.count("issue:run"), 0); assert.equal(f.count("auth_begin"), 0); assert.equal(f.count("DELETE"), 0);
  }
});

test("metadata hashes are never promoted to issuer authority or final proof; no cleanup/fact read in recovery", async () => {
  for (const finalMismatch of [false, true]) {
    const f = await fixture(), c = f.claim(f.A); delete c.fence.accountRevision; let n = 0;
    const cleanup = createCurrentUuidReceiptCleanup({ policy: f.config.deletionPolicy, now: () => NOW, timeoutMs: 1000, maxObservationAgeMs: 1000, async rpc(_name, body) {
      const { policy: ignored, ...binding } = body; assert.equal(ignored.version, UUID_DELETE_PROFILE);
      return { contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding, removed: 1, remaining: 0, observedAt: new Date(NOW).toISOString() };
    } });
    const observe = f.config.observe;
    const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, receiptCleanup: cleanup, async observe(req) {
      n++; const raw = await observe(req) as ScopeObservation;
      return n === 1 || finalMismatch ? { ...raw, catalogSha256: "b".repeat(64), engine: { ...raw.engine, metadataSha256: "c".repeat(64) } } : raw;
    }, originalRecovery: { forOwner() { return { async reconcile(t) { return { ...t, outcome: "unknown", evidenceHash: H }; } }; } } });
    assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, finalMismatch ? "not_started" : "confirmed");
    assert.equal(f.count("DELETE"), finalMismatch ? 0 : 1); assert.equal(n, 2); assert.equal(f.issues.length, 1);
    const prior = f.calls.length; await strategy.forOwner(f.A).auth.reconcile!(c.target); assert.equal(f.calls.length, prior); assert.equal(n, 2);
  }
});

test("non-authorizing metadata request has a fresh nonce each invocation and cannot mutate original binding", async () => {
  const f = await fixture(), c = f.claim(f.A); delete c.fence.accountRevision; const original = structuredClone(c.target), requests: ScopeObservationRequest[] = [];
  const observe = f.config.observe;
  const strategy = createCurrentUuidClaimAuthStrategy({ ...f.config, receiptCleanup: { async clear() { return { outcome: "held" }; } }, async observe(req) {
    requests.push(structuredClone(req)); const raw = await observe(req); req.binding.userId = f.B; return raw;
  } });
  for (let i = 0; i < 2; i++) assert.equal((await strategy.forOwner(f.A).auth.run(c.target)).outcome, "not_started");
  assert.equal(requests.length, 2); assert.notEqual(requests[0].authorizationId, requests[1].authorizationId); assert.notEqual(requests[0].scopeSha256, requests[1].scopeSha256);
  assert.deepEqual(c.target, original); assert.equal(f.count("issue:run"), 0); assert.equal(f.count("DELETE"), 0);
});
