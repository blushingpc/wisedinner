import type { DeletionProvider, DeletionTarget, DeletionProof, VerifiedDeletionIdentity } from "./account-deletion.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";
import { appleObject, appleExact, appleUuid, appleHash, appleOrigin, appleText, appleDigest, appleHttp, checkedApple } from "./apple-token-custody.server.ts";
import type { AppleData, AppleRepository } from "./apple-token-custody.server.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";

export type AuthScopeInput = { userId: string; identityHash: string; authOperationId: string; deletionOperationId: string; intentSha256: string; workOwner: string; workAttempt: number; leaseUntil: string };
export type AuthScopeProof = { outcome: "held" } | { outcome: "allowed"; binding: AuthScopeInput & { scopeSha256: string; policySha256: string; authorizationId: string; evidenceSha256: string; observedAt: string; validUntil: string }; coverage: { coveredAuthGraphSha256: string; storage: "verified_clear" | "approved_cleanup_complete"; sharedEngine: "verified_clear" | "verified_preserved"; relatedOwnerReferences: "verified_clear" | "approved_preserved" } };
export type V2AuthDependencies = { origin: string; serverCredential: string; repository: AppleRepository; preflight?: (input: AuthScopeInput) => Promise<AuthScopeProof>; request?: typeof fetch; now?: () => number; timeoutMs?: number };

export function createAccountDeletionV2AuthAdapter(inputDeps: V2AuthDependencies): { verifyIdentity: (id: string) => Promise<VerifiedDeletionIdentity | null>; auth: DeletionProvider } {
  const deps = { ...inputDeps, repository: { ...inputDeps.repository } };
  const origin = appleOrigin(deps.origin), request = deps.request ?? fetch, now = deps.now ?? Date.now, timeout = deps.timeoutMs ?? 3000;
  appleText(deps.serverCredential, 16384);
  const actual = supabaseDeletionAuthV2(origin, deps.serverCredential, request, timeout).verifyIdentity;
  const target = (input: DeletionTarget) => { const t = appleExact(input, ["userId", "identityHash", "operationId"]); return { userId: appleUuid(t.userId), identityHash: appleHash(t.identityHash), operationId: appleUuid(t.operationId) }; };
  const proof = (t: DeletionTarget, outcome: DeletionProof["outcome"], basis: unknown): DeletionProof => ({ ...t, outcome, evidenceHash: appleDigest(["wd-v2-auth-original-proof-1", origin, t, outcome, basis]) });
  const fence = async (t: DeletionTarget) => {
    const row = checkedApple(await deps.repository.command("deletion", "auth_fence", t));
    appleUuid(row.owner); appleUuid(row.intentId); appleHash(row.intentSha256);
    if (!Number.isSafeInteger(row.attempt) || (row.attempt as number) < 1 || !Number.isFinite(Date.parse(String(row.lease))) || Date.parse(String(row.lease)) <= now() || !["started", "held"].includes(String(row.authState)) || !["not_required", "confirmed", "manual_required", "failed", "unknown"].includes(String(row.disposition))) throw Error("auth_fence_held");
    if (row.currentIdentityHash !== t.identityHash || !["linked", "none"].includes(String(row.actualApple)) || row.effectiveApple !== row.apple || !["linked", "none"].includes(String(row.effectiveApple))) throw Error("auth_basis_held");
    return row;
  };
  const input = (t: DeletionTarget, f: AppleData): AuthScopeInput => ({ userId: t.userId, identityHash: t.identityHash, authOperationId: t.operationId, deletionOperationId: String(f.intentId), intentSha256: String(f.intentSha256), workOwner: String(f.owner), workAttempt: f.attempt as number, leaseUntil: String(f.lease) });
  function scope(value: unknown, expected: AuthScopeInput): AuthScopeProof & { outcome: "allowed" } {
    const row = appleExact(value, ["outcome", "binding", "coverage"]); if (row.outcome !== "allowed") throw Error("scope_held");
    const b = appleExact(row.binding, [...Object.keys(expected), "scopeSha256", "policySha256", "authorizationId", "evidenceSha256", "observedAt", "validUntil"]);
    if (Object.keys(expected).some(k => b[k] !== expected[k as keyof AuthScopeInput])) throw Error("scope_binding_held");
    for (const k of ["scopeSha256", "policySha256", "evidenceSha256"]) appleHash(b[k]); appleUuid(b.authorizationId);
    if (!Number.isFinite(Date.parse(String(b.observedAt))) || !Number.isFinite(Date.parse(String(b.validUntil))) || Date.parse(String(b.observedAt)) > now() || Date.parse(String(b.validUntil)) <= now() || Date.parse(String(b.validUntil)) > Date.parse(expected.leaseUntil)) throw Error("scope_expired");
    const c = appleExact(row.coverage, ["coveredAuthGraphSha256", "storage", "sharedEngine", "relatedOwnerReferences"]); appleHash(c.coveredAuthGraphSha256);
    if (!["verified_clear", "approved_cleanup_complete"].includes(String(c.storage)) || !["verified_clear", "verified_preserved"].includes(String(c.sharedEngine)) || !["verified_clear", "approved_preserved"].includes(String(c.relatedOwnerReferences))) throw Error("scope_unverified");
    return row as AuthScopeProof & { outcome: "allowed" };
  }
  async function http(t: DeletionTarget, method: "GET" | "DELETE") {
    return appleHttp(origin + "/auth/v1/admin/users/" + encodeURIComponent(t.userId), { method, headers: { apikey: deps.serverCredential, Authorization: `Bearer ${deps.serverCredential}`, "content-type": "application/json", "X-Supabase-Api-Version": "2024-01-01" }, ...(method === "DELETE" ? { body: '{"should_soft_delete":false}' } : {}) }, request, 32768, timeout);
  }
  function absent(r: { status: number; text: string }) {
    if (r.status !== 404) return false;
    try { const v = appleObject(parseReferenceJson(r.text)); return Object.keys(v).every(k => ["code", "error_code", "msg", "message"].includes(k)) && (v.code === "user_not_found" || v.error_code === "user_not_found") && (v.code == null || v.code === 404 || v.code === "user_not_found") && (v.error_code == null || v.error_code === "user_not_found"); } catch { return false; }
  }
  return { verifyIdentity: actual, auth: {
    async run(value) {
      const t = target(value); let admissionAttempted = false;
      try {
        const f = await fence(t), identity = await actual(t.userId);
        if (!identity || identity.identityHash !== t.identityHash || identity.apple !== f.actualApple || !deps.preflight) return proof(t, "not_started", "current-identity-or-scope-unavailable");
        const authorization = scope(await deps.preflight(input(t, f)), input(t, f));
        const current = await actual(t.userId); if (!current || current.identityHash !== t.identityHash || appleDigest(await fence(t)) !== appleDigest(f)) return proof(t, "not_started", "source-changed-before-begin");
        scope(authorization, input(t, f));
        admissionAttempted = true;
        const start = checkedApple(await deps.repository.command("deletion", "auth_begin", { ...t, fenceHash: appleHash(f.fenceHash), scope: authorization }));
        if (start.fresh !== true) return proof(t, "unknown", "original-already-admitted");
        const deleted = await http(t, "DELETE");
        if (deleted.status !== 200) return proof(t, "unknown", "delete-response-unverified");
        const body = appleObject(parseReferenceJson(deleted.text));
        // A nonempty identity response must independently match the admitted lineage;
        // the supported hard-delete API also returns an empty object.
        if (Object.keys(body).length) return proof(t, "unknown", "nonempty-delete-response-not-admitted");
        if (!absent(await http(t, "GET"))) return proof(t, "unknown", "post-delete-absence-unverified");
        const recorded = checkedApple(await deps.repository.command("deletion", "auth_record", { ...t, outcome: "confirmed", evidenceHash: appleDigest(["delete200-exact404", t, authorization.binding.evidenceSha256]) }));
        return recorded.state === "confirmed" ? proof(t, "confirmed", recorded.evidenceHash) : proof(t, "unknown", "record-unverified");
      } catch { return proof(t, admissionAttempted ? "unknown" : "not_started", "original-effect-or-admission-unverified"); }
    },
    async reconcile(value) {
      const t = target(value);
      try {
        await fence(t);
        const original = checkedApple(await deps.repository.command("deletion", "auth_original", t));
        if (original.state === "confirmed") return proof(t, "confirmed", original.evidenceHash);
        if (original.state !== "started" || original.scopeAdmitted !== true || !absent(await http(t, "GET"))) return proof(t, "unknown", "no-original-admitted-absence-proof");
        const recorded = checkedApple(await deps.repository.command("deletion", "auth_record", { ...t, outcome: "confirmed", evidenceHash: appleDigest(["original-admitted-exact404", t, original.scopeHash]) }));
        return recorded.state === "confirmed" ? proof(t, "already_absent", recorded.evidenceHash) : proof(t, "unknown", "record-unverified");
      } catch { return proof(t, "unknown", "read-only-original-reconciliation-held"); }
    }
  } };
}
