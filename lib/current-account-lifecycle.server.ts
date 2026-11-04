import { createAppleTokenCustodyService, createAppleRpcRepository, createTrustedAppleIdentityReader, inspectApplePolicy, appleRead, appleDigest, appleReceipt, type AppleRepository, type AppleClient, type AppleData } from "./apple-token-custody.server.ts";
import { createAccountDeletionV2Service, createDeletionV2RpcRepository, deletionRecoveryHash, inspectDeletionV2Policy, type DeletionV2Repository } from "./account-deletion-v2.server.ts";
import { createAccountDeletionV2AuthAdapter, type AuthScopeInput, type AuthScopeProof } from "./account-deletion-v2-auth.server.ts";
import { createAppleCustodyDeletionPorts, createAppleRevocationProvider } from "./apple-revocation.server.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";
import type { CurrentUuidClaimAuthStrategy } from "./current-uuid-claim-contract.server.ts";
import type { VerifiedAccount } from "./account.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";

export type LifecycleAdmission = Readonly<{
  enabled: true; origin: string; serverCredential: string;
  verify(request: Request): Promise<VerifiedAccount>;
  client: AppleClient; keyVersion: string; keyring: ReadonlyMap<string, Buffer>;
  applePolicy: unknown; deletionPolicy: unknown;
  preflight(input: AuthScopeInput): Promise<AuthScopeProof>;
  // Explicit private strategy only, never selected by a public body or mode flag.
  uuidAuth?: CurrentUuidClaimAuthStrategy;
  // A Main-owned execution/evidence port, not an environment flag. Its actual
  // implementation and current target coverage must be independently admitted.
  cleanup: { verify(input: { policySha256: string; now: number }): Promise<{ outcome: "verified"; evidenceSha256: string; validUntil: number; policySha256: string } | { outcome: "held" }> };
  request?: typeof fetch; now?: () => number;
  repositories?: { apple: AppleRepository; deletion: DeletionV2Repository };
}>;
const disabled = () => Response.json({ contract: "wd-account-deletion-v2", result: { outcome: "held", code: "deletion_v2_disabled" } }, { status: 503, headers: { "cache-control": "no-store" } });
export function createCurrentAccountLifecycle(admission?: LifecycleAdmission) {
  // No ambient env/key/config loader. Routes remain off until Main binds actual
  // policy, target-scope and cleanup evidence. Construction has no IO.
  let applePolicy: unknown, deletionPolicy: unknown;
  try { applePolicy = canonicalReferenceData(admission?.applePolicy); deletionPolicy = canonicalReferenceData(admission?.deletionPolicy); } catch { /* Mutations stay off; original status does not require a current policy. */ }
  const deps = admission ? { ...admission, applePolicy, deletionPolicy, keyring: new Map([...(admission.keyring ?? new Map<string, Buffer>())].map(([v, k]) => [v, Buffer.from(k)])), client: { ...admission.client }, cleanup: { ...admission.cleanup }, ...(admission.repositories ? { repositories: { apple: { ...admission.repositories.apple }, deletion: { ...admission.repositories.deletion } } } : {}) } : undefined;
  async function read(request: Request): Promise<Record<string, unknown>> {
    return parseReferenceJson(await appleRead(request.clone().body, 16384, request.signal)) as Record<string, unknown>;
  }
  async function configured() {
    if (deps?.enabled !== true || typeof deps.preflight !== "function" || typeof deps.cleanup?.verify !== "function") return false;
    try {
      inspectApplePolicy(deps.applePolicy); const policy = inspectDeletionV2Policy(deps.deletionPolicy);
      if (policy.version === UUID_DELETE_PROFILE ? deps.uuidAuth?.profile !== UUID_DELETE_PROFILE : deps.uuidAuth !== undefined) return false;
      if (deps.keyring.get(deps.keyVersion)?.length !== 32) return false;
      const now = deps.now?.() ?? Date.now(), policySha256 = appleDigest(policy), proof = await deps.cleanup.verify({ policySha256, now });
      return proof.outcome === "verified" && proof.policySha256 === policySha256 && /^[a-f0-9]{64}$/.test(proof.evidenceSha256) && Number.isSafeInteger(proof.validUntil) && proof.validUntil > now;
    } catch { return false; }
  }
  function repositories() {
    if (!deps) throw Error("lifecycle_disabled");
    return deps.repositories ?? { apple: createAppleRpcRepository(deps.origin, deps.serverCredential, deps.request), deletion: createDeletionV2RpcRepository(deps.origin, deps.serverCredential, deps.request) };
  }
  async function command(name: string, action: string, body: unknown): Promise<AppleData> {
    if (!deps) throw Error("lifecycle_disabled");
    const origin = new URL(deps.origin); if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw Error("invalid_origin");
    const response = await (deps.request ?? fetch)(origin.origin + "/rest/v1/rpc/" + name, { method: "POST", redirect: "error", signal: AbortSignal.timeout(3000), headers: { apikey: deps.serverCredential, authorization: "Bearer " + deps.serverCredential, "content-type": "application/json" }, body: JSON.stringify({ p_action: action, p_body: body }) });
    const text = await appleRead(response.body, 262144); if (!response.ok) throw Error("lifecycle_transport_unknown");
    const result = parseReferenceJson(text); if (!result || typeof result !== "object" || Array.isArray(result)) throw Error("lifecycle_transport_unknown");
    return result as AppleData;
  }
  return Object.freeze({
    async custody(request: Request) {
      if (deps?.enabled !== true) return appleReceipt(null, null, { outcome: "held", code: "custody_disabled", custody: "not_admitted", statusRequired: false, providerEffect: "none" }, 503);
      try {
        const body = await read(request), repos = repositories();
        let apple = repos.apple;
        if (body.operation !== "status") {
          if (!(await configured())) return appleReceipt(null, null, { outcome: "held", code: "custody_not_configured", custody: "not_admitted", statusRequired: false, providerEffect: "none" }, 503);
          const owner = await deps.verify(request), operationId = request.headers.get("x-wd-deletion-operation-id"), intentSha256 = request.headers.get("x-wd-deletion-intent-sha256"), capability = request.headers.get("x-wd-deletion-recovery");
          if (!operationId || !intentSha256 || !capability || !/^[a-f0-9]{64}$/.test(intentSha256)) throw Error("prepared_binding_required");
          const target = { userId: owner.id, operationId, intentSha256, recoveryHash: deletionRecoveryHash(operationId, capability) };
          const before = await command("wd_current_prepared_custody_command", "preflight", { target, body: {} });
          if (before.outcome !== "allowed") throw Error("prepared_binding_required");
          apple = { command: (ns, action, data) => ns === "custody" ? command("wd_current_prepared_custody_command", action, { target, body: data }) : repos.apple.command(ns, action, data) };
        }
        return await createAppleTokenCustodyService({ enabled: true, deletionCompositionAdmitted: true, verify: deps.verify, identity: createTrustedAppleIdentityReader(deps.origin, deps.serverCredential, deps.request), repository: apple, client: deps.client, origin: deps.origin, clientId: deps.client.clientId, keyVersion: deps.keyVersion, keyring: deps.keyring, policy: deps.applePolicy, now: deps.now })(request);
      } catch { return appleReceipt(null, null, { outcome: "held", code: "scope_unverified", custody: "unknown", statusRequired: true, providerEffect: "unknown" }, 409); }
    },
    async deletion(request: Request) {
      if (deps?.enabled !== true) return disabled();
      try {
        const body = await read(request), repos = repositories();
        if (body.operation !== "status" && !(await configured())) return disabled();
        const retiring = request.headers.get("x-wd-deletion-lifecycle") === "wd-prepared-retirement-v1";
        const apple: AppleRepository = { command: (ns, action, data) => repos.apple.command(ns, retiring && ns === "deletion" && action === "admit_original" ? "admit_original_retiring" : action, data) };
        const auth = body.operation !== "status" && deps.uuidAuth
          ? deps.uuidAuth.forOwner((await deps.verify(request)).id)
          : createAccountDeletionV2AuthAdapter({ origin: deps.origin, serverCredential: deps.serverCredential, repository: apple, preflight: deps.preflight, request: deps.request, now: deps.now });
        // This closure captures an effective identity basis. It MUST be fresh
        // per request; sharing it across owners permits a stale basis race.
        const pair = createAppleCustodyDeletionPorts({ repository: apple, original: repos.deletion, verifyIdentity: auth.verifyIdentity, auth: auth.auth, apple: createAppleRevocationProvider({ repository: apple, client: deps.client, keyring: deps.keyring, timeoutMs: 3000, verifyIdentity: auth.verifyIdentity }) });
        const repository: DeletionV2Repository = { ...pair.repository, worker: (action, data) => pair.repository.worker(action === "admit_retiring" ? "admit" : action, data) };
        return await createAccountDeletionV2Service({ enabled: true, verify: deps.verify, repository, providers: pair.providers, policy: body.operation === "status" ? undefined : deps.deletionPolicy, now: deps.now })(request);
      } catch { return disabled(); }
    },
    async eraseExpiredCredential(input: { ownerId: string; lineageId: string; policySha256: string }) {
      if (!(await configured())) return { outcome: "held" as const, code: "policy_required" };
      // Executes the scoped SQL erase, not just a validation Boolean. Main must
      // invoke it under its approved expiry operations; no scheduler added.
      try {
        const r = await command("wd_current_credential_expiry_command", "erase_expired", input);
        if (Object.keys(r).length === 1 && ["policy_required", "cleanup_pending", "invalid_command"].includes(String(r.error))) return { error: r.error };
        if (Object.keys(r).sort().join() !== "lineageId,outcome,policySha256" || r.outcome !== "erased" || r.lineageId !== input.lineageId || r.policySha256 !== input.policySha256) throw Error("cleanup_ack_unverified");
        return Object.freeze(r);
      } catch { return { outcome: "unknown" as const, code: "cleanup_status_required", statusRequired: true, retryAuthorized: false }; }
    }
  });
}
