import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createAccountDeletionV2AuthAdapter } from "./account-deletion-v2-auth.server.ts";
import type { AuthScopeInput, AuthScopeProof } from "./account-deletion-v2-auth.server.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";
import { appleDigest } from "./apple-token-custody.server.ts";
import type { AppleRepository } from "./apple-token-custody.server.ts";

const userId = "10000000-0000-4000-8000-000000000001";
async function fixture(actualApple = false, disposition = "unknown") {
  const originalId = randomUUID(), operationId = randomUUID(); let deleted = false, deletes = 0, lose = "", changed = false, generic404 = false;
  const user = { id: userId, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: randomUUID(), user_id: userId, provider: actualApple ? "apple" : "email", id: "synthetic-provider-id", created_at: "2026-10-01T00:00:00Z" }] };
  const request: typeof fetch = async (url, init) => { assert.equal(String(url), "https://fixture.invalid/auth/v1/admin/users/" + userId); if (init?.method === "DELETE") { deletes++; deleted = true; if (lose === "delete") throw Error("synthetic lost ACK"); return Response.json({}); } if (deleted) return Response.json({ code: generic404 ? "gateway_missing" : "user_not_found" }, { status: 404 }); return Response.json(changed ? { ...user, identities: [{ ...user.identities[0], id: "changed-current-identity" }] } : user); };
  const accepted = await supabaseDeletionAuthV2("https://fixture.invalid", "synthetic", request).verifyIdentity(userId); assert.ok(accepted);
  const target = { userId, identityHash: accepted.identityHash, operationId };
  const fence = { owner: randomUUID(), attempt: 1, lease: new Date(Date.now() + 120000).toISOString(), apple: "linked", appleState: "held", authState: "started", intentId: originalId, intentSha256: "a".repeat(64), disposition, currentIdentityHash: target.identityHash, actualApple: actualApple ? "linked" : "none", effectiveApple: "linked", fenceHash: "f".repeat(64) };
  let state = "", scopeHash = "";
  const repository: AppleRepository = { async command(ns, action, b) {
    assert.equal(ns, "deletion"); assert.equal(b.userId, userId); assert.equal(b.identityHash, target.identityHash); assert.equal(b.operationId, operationId);
    if (action === "auth_fence") return { ...fence };
    if (action === "auth_begin") { if (state) return { fresh: false }; state = "started"; scopeHash = appleDigest(b.scope); if (lose === "begin") throw Error("synthetic begin ACK loss"); return { fresh: true }; }
    if (action === "auth_original") return { state, scopeAdmitted: !!state, scopeHash, evidenceHash: "c".repeat(64) };
    if (action === "auth_record") { state = "confirmed"; return { state, evidenceHash: b.evidenceHash }; } throw Error("unexpected SQL command");
  } };
  const preflight = async (x: AuthScopeInput): Promise<AuthScopeProof> => ({ outcome: "allowed", binding: { ...x, scopeSha256: "b".repeat(64), policySha256: "c".repeat(64), authorizationId: randomUUID(), evidenceSha256: "d".repeat(64), observedAt: new Date(Date.now() - 1000).toISOString(), validUntil: new Date(Date.now() + 30000).toISOString() }, coverage: { coveredAuthGraphSha256: "e".repeat(64), storage: "verified_clear", sharedEngine: "verified_preserved", relatedOwnerReferences: "verified_clear" } });
  const deps = { origin: "https://fixture.invalid", serverCredential: "synthetic", repository, preflight, request };
  return { deps, target, fence, adapter: () => createAccountDeletionV2AuthAdapter(deps), deletes: () => deletes, lose: (x: string) => lose = x, change: () => changed = true, missing: () => deleted = true, generic: () => generic404 = true, state: () => state };
}
for (const disposition of ["unknown", "failed", "manual_required", "confirmed"]) test(`actual V2 Auth permits independent scope after Apple ${disposition}, including historical unlink`, async () => {
  const f = await fixture(false, disposition); const result = await f.adapter().auth.run(f.target); assert.equal(result.outcome, "confirmed"); assert.equal(f.deletes(), 1);
  assert.equal((await f.adapter().auth.run(f.target)).outcome, "not_started"); assert.equal(f.deletes(), 1);
});
test("missing/held/wrong/stale preflight and changed current identity have zero DELETE", async () => {
  for (const mode of ["missing", "held", "foreign", "stale", "invalid-time", "source"]) {
    const f = await fixture(true);
    if (mode === "source") f.change();
    const base = f.deps.preflight;
    const adapter = createAccountDeletionV2AuthAdapter({ ...f.deps, preflight: mode === "missing" ? undefined : async x => { if (mode === "held") return { outcome: "held" }; const p = await base(x); if (p.outcome !== "allowed") return p; if (mode === "foreign") p.binding.userId = randomUUID(); if (mode === "stale") p.binding.validUntil = "2020-01-01T00:00:00Z"; if (mode === "invalid-time") p.binding.validUntil = "bad"; return p; } });
    assert.equal((await adapter.auth.run(f.target)).outcome, "not_started"); assert.equal(f.deletes(), 0); assert.equal(f.state(), "");
  }
});
for (const boundary of ["begin", "delete"]) test(`Auth lost ${boundary} ACK is never a new DELETE grant`, async () => {
  const f = await fixture(true); f.lose(boundary); assert.equal((await f.adapter().auth.run(f.target)).outcome, "unknown"); const count = f.deletes();
  f.lose(""); await f.adapter().auth.run(f.target); assert.equal(f.deletes(), count);
  if (boundary === "delete") { assert.equal((await f.adapter().auth.reconcile!(f.target)).outcome, "already_absent"); assert.equal(f.deletes(), 1); }
});
test("generic404 or absent original cannot settle Auth; scope does not authorize broader target", async () => {
  const f = await fixture(); f.missing(); assert.equal((await f.adapter().auth.reconcile!(f.target)).outcome, "unknown"); assert.equal(f.deletes(), 0);
  const g = await fixture(); g.lose("delete"); await g.adapter().auth.run(g.target); g.generic(); assert.equal((await g.adapter().auth.reconcile!(g.target)).outcome, "unknown"); assert.equal(g.deletes(), 1);
  assert.equal((await g.adapter().auth.run({ ...g.target, operationId: randomUUID() })).outcome, "not_started");
});
