import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAccountDeletionUuidAuthAdapter, type UuidAuthDependencies } from "./account-deletion-uuid-auth.server.ts";
import { createCurrentUuidAuthScopePreflight, UUID_DELETE_PROFILE, LOCAL_DELETE_SCOPE, type UuidAuthScopeProof } from "./current-uuid-auth-scope.server.ts";
import { CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, type ScopeAdmission, type ScopeObservationRequest, type ScopeObservation } from "./current-auth-scope.server.ts";
import { createAccountDeletionV2AuthAdapter } from "./account-deletion-v2-auth.server.ts";
import type { AuthScopeProof } from "./account-deletion-v2-auth.server.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";
import { appleDigest, type AppleRepository } from "./apple-token-custody.server.ts";
const H = "a".repeat(64), NOW = Date.parse("2026-11-01T01:00:00Z"), ORIGIN = "https://uuid.synthetic.invalid";
async function fixture() {
  // All provider, policy, local-denial and original-profile facts are synthetic.
  // Real0023does not yet expose the original-profile projection used below.
  const uid = randomUUID(), foreign = randomUUID(), user = { id: uid, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: randomUUID(), user_id: uid, provider: "email", id: "synthetic-id", created_at: "2026-10-01T00:00:00Z" }] };
  let missing = false, deletes = 0, gets = 0, mode = "empty", loss = "", state = "", scopeHash = "", originalProfile = true, originalProfileName = UUID_DELETE_PROFILE, scopeStored: Extract<UuidAuthScopeProof, { outcome: "allowed" }> | undefined;
  let clock = NOW, disposition = "unknown", identityChanged = false, preflightMode = "normal", fenceRevision = false;
  const effects: string[] = [];
  const transport: typeof fetch = async (url, init) => {
    assert.equal(String(url), ORIGIN + "/auth/v1/admin/users/" + uid); effects.push(init?.method ?? "GET");
    if (init?.method === "DELETE") {
      assert.equal(init.body, '{"should_soft_delete":false}'); deletes++; missing = true;
      if (mode === "identity-race") identityChanged = true; // after final GET, no CAS in supported API
      if (loss === "delete") throw Error("lost DELETE ACK");
      if (mode === "foreign") return Response.json({ ...user, id: foreign });
      if (mode === "error-user") return Response.json({ ...user, error: "unverified" });
      if (mode === "malformed") return Response.json({ id: uid, created_at: 42 });
      if (mode === "duplicate") return new Response('{"id":"' + uid + '","id":"' + foreign + '"}');
      if (mode === "extra-wrapper") return Response.json({ user, error: "unverified" });
      if (mode === "null-user") return Response.json({ user: null });
      if (mode === "non200") return Response.json({}, { status: 502 });
      return Response.json(mode === "user" || mode === "identity-race" ? user : mode === "wrapped" ? { user } : {});
    }
    gets++;
    if (missing) {
      if (loss === "status") throw Error("lost status ACK");
      if (mode === "generic404") return Response.json({ code: "gateway_missing" }, { status: 404 });
      if (mode === "still-present") return Response.json(user);
      return Response.json({ code: "user_not_found" }, { status: 404 });
    }
    return Response.json(identityChanged ? { ...user, identities: [{ ...user.identities[0], id: "changed-lineage" }] } : user);
  };
  const identity = await supabaseDeletionAuthV2(ORIGIN, "synthetic-only", transport).verifyIdentity(uid); assert.ok(identity); gets = 0; effects.length = 0;
  const target = { userId: uid, identityHash: identity.identityHash, authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(NOW + 60000).toISOString() };
  const admission: ScopeAdmission = { authorizationId: randomUUID(), target, accountRevision: 2, expectedAuthGraphSha256: H, expectedCatalogSha256: H, expectedEngineSha256: H, expiresAt: target.leaseUntil, maxObservationAgeMs: 3000, retained: {},
    deletionPolicy: { approved: true, version: UUID_DELETE_PROFILE, preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] },
    custodyPolicy: { approved: true, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] } };
  const observe = async (r: ScopeObservationRequest): Promise<ScopeObservation> => ({ contract: CURRENT_AUTH_SCOPE, binding: r.binding, policySha256: r.policySha256, authorizationId: r.authorizationId, scopeSha256: r.scopeSha256, observedAt: new Date(clock).toISOString(), validUntil: new Date(NOW + 30000).toISOString(), accountRevision: 2, authGraphSha256: H, catalogSha256: H,
    storage: { objects: 0, buckets: 0, multipartUploads: 0, multipartParts: 0, metadataReferences: 0, unknownLinkages: 0 }, application: { savedWeeks: 0, accountReceipts: 0, pushTokens: 0, pushReceipts: 0, pushJobs: 0, currentPlanCleanupPending: false, privateResidue: 0, unexpectedAccountFields: 0 },
    references: Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k => [k, { count: 0, sha256: H, ...(k === "retentionAttempts" ? { validUntil: null } : {}) }])) as ScopeObservation["references"], engine: { metadataSha256: H, authLinks: 0, ownerMatches: 0, unknownLinkages: 0 }, providerOperations: "settled", unclassifiedReferences: 0, writeFence: null });
  const observeLocalDenial = async (r: ScopeObservationRequest) => ({ contract: LOCAL_DELETE_SCOPE, profile: UUID_DELETE_PROFILE, providerPredicate: "account-uuid-only", binding: r.binding, policySha256: r.policySha256, authorizationId: r.authorizationId, scopeSha256: r.scopeSha256, observedAt: new Date(clock).toISOString(), validUntil: new Date(NOW + 30000).toISOString(), accountRevision: 2, writerManifestSha256: H, writerCatalogSha256: H, writeFence: null,
    denial: { accountState: "deletion_pending", custodyGate: "closed", ordinaryOwnerWrites: "denied", allowedOriginalProgress: "same-original-only", durability: "persisted-until-original-resolution", barrierRevision: 3, unknownWriters: 0 } });
  const actualPreflight = createCurrentUuidAuthScopePreflight({ enabled: true, admission, observe, observeLocalDenial, writerManifestSha256: H, writerCatalogSha256: H, now: () => clock });
  const repository: AppleRepository = { async command(ns, action, b) {
    assert.equal(ns, "deletion"); assert.equal(b.userId, uid); assert.equal(b.operationId, target.authOperationId); effects.push(action);
    if (action === "auth_fence") return { owner: target.workOwner, attempt: target.workAttempt + (fenceRevision ? 1 : 0), lease: target.leaseUntil, authState: "started", disposition,
      intentId: target.deletionOperationId, intentSha256: H, policySha256: appleDigest(admission.deletionPolicy), currentIdentityHash: target.identityHash, actualApple: "none", effectiveApple: "linked", apple: "linked", fenceHash: H };
    if (action === "auth_begin") { if (state) return { fresh: false }; state = "started"; scopeStored = b.scope as typeof scopeStored; scopeHash = appleDigest(b.scope); if (loss === "begin") throw Error("lost begin ACK"); return { fresh: true }; }
    if (action === "auth_original") return { state, scopeAdmitted: !!scopeStored, scopeHash, evidenceHash: H, ...(originalProfile && scopeStored ? { scopeProfile: originalProfileName, scopeProviderPredicate: scopeStored.providerPredicate, scopeAccountRevision: scopeStored.accountRevision, scopePolicySha256: scopeStored.binding.policySha256 } : {}) };
    if (action === "auth_record") { state = "confirmed"; if (loss === "record") throw Error("lost record ACK"); return { state, evidenceHash: b.evidenceHash }; }
    throw Error("unexpected SQL command");
  } };
  const deps: UuidAuthDependencies = { enabled: true, profile: UUID_DELETE_PROFILE, admission, origin: ORIGIN, serverCredential: "synthetic-only", repository, request: transport, now: () => clock,
    preflight: async input => {
      if (preflightMode === "held") return { outcome: "held" };
      const p = await actualPreflight(input);
      if (preflightMode === "clone" && p.outcome === "allowed") return { ...p };
      if (preflightMode === "identity") identityChanged = true;
      if (preflightMode === "attempt") fenceRevision = true;
      if (preflightMode === "expire") clock += 4000;
      return p;
    } };
  const effectTarget = { userId: uid, identityHash: target.identityHash, operationId: target.authOperationId };
  return { deps, target: effectTarget, admission, actualPreflight, adapter: () => createAccountDeletionUuidAuthAdapter(deps), deletes: () => deletes, gets: () => gets, state: () => state, effects,
    mode: (x: string) => { mode = x; }, loss: (x: string) => { loss = x; }, disposition: (x: string) => { disposition = x; }, pf: (x: string) => { preflightMode = x; }, originalProfile: (x: boolean) => { originalProfile = x; }, profileName: (x: string) => { originalProfileName = x; }, identityChanged: () => identityChanged };
}
for (const response of ["empty", "user", "wrapped"]) test(`supported hard DELETE ${response} response plus exact sameUID absence settles original`, async () => {
  const f = await fixture(); f.mode(response); const p = await f.adapter().auth.run(f.target);
  assert.equal(p.outcome, "confirmed"); assert.equal(f.deletes(), 1); assert.equal(f.state(), "confirmed");
  assert.ok(f.effects.indexOf("auth_begin") < f.effects.indexOf("DELETE")); assert.equal(f.effects.filter(x => x === "GET").length, 3);
  assert.doesNotMatch(JSON.stringify(p), /synthetic-id|identities|created_at|synthetic-only/);
  await f.adapter().auth.run(f.target); assert.equal(f.deletes(), 1);
});
test("Apple terminal dispositions and historical email login do not gate independent UUID Auth deletion", async () => {
  for (const disposition of ["unknown", "manual_required", "failed", "confirmed", "not_required"]) { const f = await fixture(); f.disposition(disposition); assert.equal((await f.adapter().auth.run(f.target)).outcome, "confirmed"); assert.equal(f.deletes(), 1); }
});
test("foreign/malformed nonempty response, wrong404 or still-present UID is unknown, never proof or replay", async () => {
  for (const mode of ["foreign", "malformed", "error-user", "duplicate", "extra-wrapper", "null-user", "non200", "generic404", "still-present"]) {
    const f = await fixture(); f.mode(mode); assert.equal((await f.adapter().auth.run(f.target)).outcome, "unknown", mode); assert.equal(f.deletes(), 1);
    await f.adapter().auth.run(f.target); assert.equal(f.deletes(), 1);
  }
});
for (const boundary of ["begin", "delete", "record", "status"]) test(`lost ${boundary} ACK is durable unknown; reconciliation never sends DELETE`, async () => {
  const f = await fixture(); f.loss(boundary); assert.equal((await f.adapter().auth.run(f.target)).outcome, "unknown"); const count = f.deletes();
  f.loss(""); await f.adapter().auth.run(f.target); assert.equal(f.deletes(), count);
  const r = await f.adapter().auth.reconcile!(f.target); assert.equal(r.outcome, boundary === "begin" ? "unknown" : boundary === "record" ? "confirmed" : "already_absent"); assert.equal(f.deletes(), count);
});
test("already-started original, absent profile projection or wrong profile can never become a fresh DELETE grant", async () => {
  const f = await fixture(); f.loss("delete"); await f.adapter().auth.run(f.target); assert.equal(f.state(), "started");
  f.loss(""); f.originalProfile(false); assert.equal((await f.adapter().auth.reconcile!(f.target)).outcome, "unknown"); assert.equal(f.deletes(), 1);
  f.originalProfile(true); f.profileName("strict-unknown-original"); assert.equal((await f.adapter().auth.reconcile!(f.target)).outcome, "unknown");
  f.profileName(UUID_DELETE_PROFILE); assert.equal((await f.adapter().auth.reconcile!(f.target)).outcome, "already_absent"); assert.equal(f.deletes(), 1);
  const g = await fixture(); assert.equal((await g.adapter().auth.reconcile!(g.target)).outcome, "unknown"); assert.equal(g.deletes(), 0);
});
test("missing selection/old policy/foreign target/revision/policy or cloned proof deny before destructive admission", async () => {
  for (const mode of ["off", "profile", "old-policy", "foreign", "revision", "policy", "held", "clone", "identity", "attempt", "expire"]) {
    const f = await fixture(); const deps = { ...f.deps }; let target = f.target;
    if (mode === "off") deps.enabled = false; if (mode === "profile") deps.profile = undefined;
    if (mode === "old-policy") deps.admission = { ...f.admission, deletionPolicy: { ...f.admission.deletionPolicy, version: "legacy-strict" } };
    if (mode === "foreign") target = { ...target, userId: randomUUID() };
    if (mode === "revision") deps.admission = { ...f.admission, accountRevision: 3 };
    if (mode === "policy") deps.admission = { ...f.admission, deletionPolicy: { ...f.admission.deletionPolicy, receiptSeconds: 700 } };
    if (["held", "clone", "identity", "attempt", "expire"].includes(mode)) f.pf(mode);
    assert.equal((await createAccountDeletionUuidAuthAdapter(deps).auth.run(target)).outcome, "not_started", mode); assert.equal(f.deletes(), 0); assert.equal(f.effects.includes("auth_begin"), false);
  }
});
test("input/config/repository getters are not evaluated and post-construction configuration is detached", async () => {
  const f = await fixture(); let gets = 0;
  const bad = Object.defineProperty({ ...f.deps }, "admission", { get() { gets++; throw Error("getter"); } });
  assert.equal((await createAccountDeletionUuidAuthAdapter(bad).auth.run(f.target)).outcome, "not_started");
  const repo = Object.defineProperty({}, "command", { get() { gets++; throw Error("getter"); } });
  assert.equal((await createAccountDeletionUuidAuthAdapter({ ...f.deps, repository: repo as AppleRepository }).auth.run(f.target)).outcome, "not_started");
  const adapter = f.adapter(); assert.equal(f.effects.length, 0);
  assert.equal(await adapter.verifyIdentity(randomUUID()), null); assert.equal(f.effects.length, 0);
  const target = { ...f.target }; (f.admission as unknown as Record<string, unknown>).accountRevision = 99;
  assert.equal((await adapter.auth.run(target)).outcome, "confirmed"); assert.equal(gets, 0);
});
test("identity link after final check is not conditionally atomic: supported profile deletes sameUID only", async () => {
  const f = await fixture(); f.mode("identity-race"); const p = await f.adapter().auth.run(f.target);
  assert.equal(f.identityChanged(), true); assert.equal(p.outcome, "confirmed"); assert.equal(p.userId, f.target.userId); assert.equal(f.deletes(), 1);
  const proof = await f.actualPreflight({ ...f.admission.target }); assert.equal(proof.outcome, "allowed");
  if (proof.outcome === "allowed") { assert.equal(proof.providerPredicate, "account-uuid-only"); assert.equal(proof.strongWriteFence, null); }
});

test("strict and UUID adapters reject each other's proof rather than silently converting an original", async () => {
  const f = await fixture();
  const strict = createAccountDeletionV2AuthAdapter({ origin: f.deps.origin, serverCredential: f.deps.serverCredential, repository: f.deps.repository, request: f.deps.request, now: f.deps.now,
    preflight: async x => await f.actualPreflight(x) as unknown as AuthScopeProof });
  assert.equal((await strict.auth.run(f.target)).outcome, "not_started"); assert.equal(f.deletes(), 0);
  const uuid = createAccountDeletionUuidAuthAdapter({ ...f.deps, preflight: async x => {
    const proof = await f.actualPreflight(x); if (proof.outcome !== "allowed") return proof;
    return { outcome: "allowed", binding: proof.binding, coverage: proof.coverage } as unknown as UuidAuthScopeProof;
  } });
  assert.equal((await uuid.auth.run(f.target)).outcome, "not_started"); assert.equal(f.deletes(), 0); assert.equal(f.effects.includes("auth_begin"), false);
});
