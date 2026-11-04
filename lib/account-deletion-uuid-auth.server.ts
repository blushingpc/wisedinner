import type { DeletionProvider, DeletionTarget, DeletionProof, VerifiedDeletionIdentity } from "./account-deletion.ts";
import type { AuthScopeInput } from "./account-deletion-v2-auth.server.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";
import { copyCurrentScopeAdmission, type ScopeAdmission } from "./current-auth-scope.server.ts";
import { UUID_DELETE_PROFILE, isIssuedUuidAuthScopeProof, type UuidAuthScopeProof } from "./current-uuid-auth-scope.server.ts";
import { appleObject, appleExact, appleUuid, appleHash, appleOrigin, appleText, appleDigest, appleHttp, checkedApple, type AppleRepository, type AppleData } from "./apple-token-custody.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";

export type UuidAuthDependencies = Readonly<{
  enabled?: boolean; profile?: typeof UUID_DELETE_PROFILE; admission?: ScopeAdmission;
  origin: string; serverCredential: string; repository: AppleRepository;
  preflight?: (input: AuthScopeInput) => Promise<UuidAuthScopeProof>; request?: typeof fetch; now?: () => number; timeoutMs?: number;
}>;
// This profile intentionally does not promise identity conditionality through GoTrue.
// Original strict adapter stays protected. No default activation or environment lookup.
export function createAccountDeletionUuidAuthAdapter(deps: UuidAuthDependencies): { verifyIdentity: (id: string) => Promise<VerifiedDeletionIdentity | null>; auth: DeletionProvider } {
  let admission: ScopeAdmission | undefined, origin = "", credential = "", now = Date.now, request: typeof fetch = fetch, timeout = 3000;
  let command: AppleRepository["command"] | undefined, preflight: UuidAuthDependencies["preflight"];
  let actual: (id: string) => Promise<VerifiedDeletionIdentity | null> = async () => null;
  try {
    if (!deps || ![Object.prototype, null].includes(Object.getPrototypeOf(deps))) throw Error("configuration");
    const fields = Object.getOwnPropertyDescriptors(deps), names = ["enabled", "profile", "admission", "origin", "serverCredential", "repository", "preflight", "request", "now", "timeoutMs"];
    if (Reflect.ownKeys(fields).some(k => typeof k !== "string" || !names.includes(k)) || Object.values(fields).some(d => !("value" in d))) throw Error("configuration");
    if (fields.enabled?.value !== true || fields.profile?.value !== UUID_DELETE_PROFILE || typeof fields.preflight?.value !== "function") throw Error("profile_required");
    admission = copyCurrentScopeAdmission(fields.admission?.value);
    if (admission.deletionPolicy.version !== UUID_DELETE_PROFILE) throw Error("profile_policy_required");
    origin = appleOrigin(appleText(fields.origin?.value, 2048)); credential = appleText(fields.serverCredential?.value, 16384);
    now = fields.now?.value ?? Date.now; request = fields.request?.value ?? fetch; timeout = fields.timeoutMs?.value ?? 3000;
    if (typeof now !== "function" || typeof request !== "function" || !Number.isInteger(timeout) || timeout < 1 || timeout > 8000) throw Error("configuration");
    const repo = fields.repository?.value;
    if (!repo || ![Object.prototype, null].includes(Object.getPrototypeOf(repo))) throw Error("configuration");
    const rd = Object.getOwnPropertyDescriptors(repo);
    if (Reflect.ownKeys(rd).length !== 1 || !("value" in rd.command) || typeof rd.command.value !== "function") throw Error("configuration");
    const fn = rd.command.value, pf = fields.preflight.value, transport = request;
    command = (ns, action, body) => Reflect.apply(fn, repo, [ns, action, body]);
    preflight = input => Reflect.apply(pf, deps, [input]);
    request = (input, init) => Reflect.apply(transport, deps, [input, init]);
    actual = supabaseDeletionAuthV2(origin, credential, request, timeout).verifyIdentity;
  } catch { admission = undefined; }
  const admitted = admission;
  const target = (input: DeletionTarget): DeletionTarget => { const t = appleExact(copyReferenceData(input), ["userId", "identityHash", "operationId"]); return { userId: appleUuid(t.userId), identityHash: appleHash(t.identityHash), operationId: appleUuid(t.operationId) }; };
  const proof = (t: DeletionTarget, outcome: DeletionProof["outcome"], basis: unknown): DeletionProof => ({ ...t, outcome, evidenceHash: appleDigest([UUID_DELETE_PROFILE, origin, t, outcome, basis]) });
  const matches = (t: DeletionTarget) => admitted && t.userId === admitted.target.userId && t.identityHash === admitted.target.identityHash && t.operationId === admitted.target.authOperationId;
  async function fence(t: DeletionTarget) {
    if (!matches(t) || !command || !admitted) throw Error("profile_binding_required");
    const f = checkedApple(copyReferenceData(await command("deletion", "auth_fence", t)));
    if (f.owner !== admitted.target.workOwner || f.attempt !== admitted.target.workAttempt || f.lease !== admitted.target.leaseUntil || f.intentId !== admitted.target.deletionOperationId || f.intentSha256 !== admitted.target.intentSha256
      || f.policySha256 !== appleDigest(admitted.deletionPolicy) || f.currentIdentityHash !== t.identityHash || !["started", "held"].includes(String(f.authState))
      || !["not_required", "confirmed", "manual_required", "failed", "unknown"].includes(String(f.disposition)) || !["linked", "none"].includes(String(f.actualApple))
      || f.effectiveApple !== f.apple || !["linked", "none"].includes(String(f.apple)) || Date.parse(String(f.lease)) <= now() || !Number.isSafeInteger(now())) throw Error("profile_fence_held");
    appleHash(f.fenceHash); return f;
  }
  function scope(value: UuidAuthScopeProof): Extract<UuidAuthScopeProof, { outcome: "allowed" }> {
    if (!admitted || !isIssuedUuidAuthScopeProof(value) || value.profile !== UUID_DELETE_PROFILE || value.providerPredicate !== "account-uuid-only" || value.strongWriteFence !== null
      || value.accountRevision !== admitted.accountRevision || value.binding.policySha256 !== appleDigest(admitted.deletionPolicy) || value.binding.authorizationId !== admitted.authorizationId
      || value.binding.scopeSha256 !== appleDigest(["wd-current-auth-scope-admission-v2", admitted]) || Date.parse(value.binding.validUntil) <= now() || Date.parse(value.binding.observedAt) > now()) throw Error("uuid_scope_held");
    for (const key of Object.keys(admitted.target) as (keyof AuthScopeInput)[]) if (value.binding[key] !== admitted.target[key]) throw Error("uuid_scope_binding");
    return value;
  }
  async function http(t: DeletionTarget, method: "GET" | "DELETE") {
    return appleHttp(origin + "/auth/v1/admin/users/" + encodeURIComponent(t.userId), { method, headers: { apikey: credential, Authorization: `Bearer ${credential}`, "content-type": "application/json", "X-Supabase-Api-Version": "2024-01-01" }, ...(method === "DELETE" ? { body: '{"should_soft_delete":false}' } : {}) }, request, 32768, timeout);
  }
  function absent(r: { status: number; text: string }) {
    if (r.status !== 404) return false;
    const v = appleObject(parseReferenceJson(r.text));
    return Object.keys(v).every(k => ["code", "error_code", "msg", "message"].includes(k)) && (v.code === "user_not_found" || v.error_code === "user_not_found")
      && (v.code == null || v.code === 404 || v.code === "user_not_found") && (v.error_code == null || v.error_code === "user_not_found");
  }
  function deleteReply(text: string, uid: string) {
    const response = appleObject(parseReferenceJson(text)); if (!Object.keys(response).length) return;
    // GoTrue/SDK UserResponse: a user object or {user: user}. Only bounded transient
    // parsing; never persist/hash/log the returned identity or metadata payload.
    const user = appleObject(Object.hasOwn(response, "user") ? appleExact(response, ["user"]).user : response);
    if (["error", "error_code", "code", "message", "msg"].some(k => Object.hasOwn(user, k))) throw Error("delete_response_unverified");
    if (user.id !== uid || typeof user.created_at !== "string" || !Number.isFinite(Date.parse(user.created_at)) || user.is_anonymous != null && typeof user.is_anonymous !== "boolean") throw Error("delete_response_unverified");
    if (user.identities !== undefined && (!Array.isArray(user.identities) || user.identities.some(i => !i || typeof i !== "object" || Array.isArray(i) || i.user_id !== undefined && i.user_id !== uid))) throw Error("delete_response_unverified");
  }
  function originalProfile(original: AppleData) {
    // Existing0023auth_original lacks these persisted-scope projections. A forward
    // migration must expose them from STORED scope, never echo supplied arguments.
    if (!admitted || original.scopeProfile !== UUID_DELETE_PROFILE || original.scopeProviderPredicate !== "account-uuid-only" || original.scopePolicySha256 !== appleDigest(admitted.deletionPolicy)
      || original.scopeAccountRevision !== admitted.accountRevision || original.scopeAdmitted !== true) throw Error("original_profile_unverified");
    appleHash(original.scopeHash);
  }
  return { verifyIdentity: id => admitted && id === admitted.target.userId ? actual(id) : Promise.resolve(null), auth: {
    async run(value) {
      const t = target(value); let attempted = false;
      try {
        if (!admitted || !preflight || !command || !matches(t)) return proof(t, "not_started", "profile-unavailable");
        const f = await fence(t), identity = await actual(t.userId);
        if (!identity || identity.identityHash !== t.identityHash || identity.apple !== f.actualApple) return proof(t, "not_started", "current-identity-unavailable");
        const authorization = scope(await preflight(copyReferenceData(admitted.target) as AuthScopeInput));
        const current = await actual(t.userId);
        if (!current || current.identityHash !== t.identityHash || appleDigest(await fence(t)) !== appleDigest(f)) return proof(t, "not_started", "source-changed-before-begin");
        scope(authorization); attempted = true;
        const start = checkedApple(await command("deletion", "auth_begin", { ...t, fenceHash: appleHash(f.fenceHash), scope: authorization }));
        if (start.fresh !== true) return proof(t, "unknown", "original-already-admitted");
        const deleted = await http(t, "DELETE"); if (deleted.status !== 200) return proof(t, "unknown", "delete-response-unverified");
        deleteReply(deleted.text, t.userId);
        if (!absent(await http(t, "GET"))) return proof(t, "unknown", "post-delete-absence-unverified");
        const recorded = checkedApple(await command("deletion", "auth_record", { ...t, outcome: "confirmed", evidenceHash: appleDigest([UUID_DELETE_PROFILE, "delete200-exact404", t, authorization.binding.evidenceSha256]) }));
        return recorded.state === "confirmed" ? proof(t, "confirmed", appleHash(recorded.evidenceHash)) : proof(t, "unknown", "record-unverified");
      } catch { return proof(t, attempted ? "unknown" : "not_started", "original-effect-or-admission-unverified"); }
    },
    async reconcile(value) {
      const t = target(value);
      try {
        if (!command || !matches(t)) return proof(t, "unknown", "profile-unavailable");
        await fence(t);
        const original = checkedApple(await command("deletion", "auth_original", t)); originalProfile(original);
        if (original.state === "confirmed") return proof(t, "confirmed", appleHash(original.evidenceHash));
        if (original.state !== "started" || !absent(await http(t, "GET"))) return proof(t, "unknown", "no-original-admitted-absence-proof");
        const recorded = checkedApple(await command("deletion", "auth_record", { ...t, outcome: "confirmed", evidenceHash: appleDigest([UUID_DELETE_PROFILE, "original-admitted-exact404", t, original.scopeHash]) }));
        return recorded.state === "confirmed" ? proof(t, "already_absent", appleHash(recorded.evidenceHash)) : proof(t, "unknown", "record-unverified");
      } catch { return proof(t, "unknown", "read-only-original-reconciliation-held"); }
    }
  } };
}
