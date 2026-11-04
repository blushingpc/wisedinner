import { randomUUID } from "node:crypto";
import type { CurrentUuidOriginalRecoveryStrategy } from "./current-uuid-original-recovery-contract.server.ts";
import { UUID_RECEIPT_CONTRACT, type CurrentUuidReceiptCleanup, type CurrentUuidReceiptCleanupInput } from "./current-uuid-receipt-cleanup.server.ts";
import { isProxy } from "node:util/types";
import type { CurrentUuidClaimAuthStrategy, CurrentUuidClaimScopeIssuer, CurrentUuidClaimIssueRequest } from "./current-uuid-claim-contract.server.ts";
import type { DeletionTarget, DeletionProof } from "./account-deletion.ts";
import type { ScopeObservationRequest } from "./current-auth-scope.server.ts";
import { CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, copyCurrentScopeAdmission } from "./current-auth-scope.server.ts";
import { createCurrentUuidAuthScopePreflight, UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";
import { createAccountDeletionUuidAuthAdapter } from "./account-deletion-uuid-auth.server.ts";
import { supabaseDeletionAuthV2, inspectDeletionV2Policy, type DeletionV2Policy } from "./account-deletion-v2.server.ts";
import { appleObject, appleExact, appleUuid, appleHash, appleText, appleOrigin, appleDigest, checkedApple, inspectApplePolicy, type AppleRepository, type ApplePolicy, type AppleData } from "./apple-token-custody.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";

export type CurrentUuidClaimAuthConfiguration = Readonly<{
  origin: string; serverCredential: string; repository: AppleRepository; issuer: CurrentUuidClaimScopeIssuer;
  observe(request: ScopeObservationRequest): Promise<unknown>;
  observeLocalDenial(request: ScopeObservationRequest): Promise<unknown>;
  deletionPolicy: DeletionV2Policy; custodyPolicy: ApplePolicy;
  request?: typeof fetch; now?: () => number; timeoutMs?: number;
  originalRecovery?: CurrentUuidOriginalRecoveryStrategy; receiptCleanup?: CurrentUuidReceiptCleanup;
}>;
function closed(): never { throw Error("uuid_claim_auth_unavailable"); }
function own(value: unknown): AppleData {
  if (isProxy(value)) closed();
  const row = appleObject(value);
  if (Object.values(Object.getOwnPropertyDescriptors(row)).some(d => !d.enumerable)) closed();
  return row;
}
function detach(value: unknown): unknown {
  let nodes = 0;
  const check = (v: unknown, depth: number): void => {
    if (++nodes > 4096 || depth > 16 || isProxy(v)) closed();
    if (v && typeof v === "object") {
      const ds = Object.getOwnPropertyDescriptors(v);
      if (Object.values(ds).some(d => !("value" in d))) closed();
      for (const d of Object.values(ds)) check(d.value, depth + 1);
    }
  };
  check(value, 0); return copyReferenceData(value);
}
function capture(receiver: unknown, key: string): (...args: unknown[]) => unknown {
  const fn = own(receiver)[key]; if (typeof fn !== "function" || isProxy(fn)) closed();
  return (...args) => Reflect.apply(fn, receiver, args);
}
function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) closed();
  const t = Date.parse(value), [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!Number.isSafeInteger(t) || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate() || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) closed();
  return t;
}
function target(value: unknown): DeletionTarget {
  const t = appleExact(detach(value), ["userId", "identityHash", "operationId"]);
  return { userId: appleUuid(t.userId), identityHash: appleHash(t.identityHash), operationId: appleUuid(t.operationId) };
}
/** Private owner-bound composition; no scope/claim prediction, default activation,
 * constructor I/O, provider retry, env discovery or mutable target cache. */
export function createCurrentUuidClaimAuthStrategy(configuration?: CurrentUuidClaimAuthConfiguration): CurrentUuidClaimAuthStrategy {
  let configured = false, origin = "", credential = "", timeout = 3000;
  let deletion: DeletionV2Policy | undefined, custody: ApplePolicy | undefined;
  let repository: AppleRepository | undefined, issue: ((r: CurrentUuidClaimIssueRequest) => Promise<unknown>) | undefined;
  let observe: ((r: ScopeObservationRequest) => Promise<unknown>) | undefined, local: typeof observe;
  let recoverOwner: ((owner: string) => unknown) | undefined, cleanup: ((input: CurrentUuidReceiptCleanupInput) => Promise<unknown>) | undefined;
  let request: typeof fetch = fetch, now: () => number = Date.now;
  try {
    const c = own(configuration), names = ["origin", "serverCredential", "repository", "issuer", "observe", "observeLocalDenial", "deletionPolicy", "custodyPolicy", "request", "now", "timeoutMs", "originalRecovery", "receiptCleanup"];
    if (Object.keys(c).some(k => !names.includes(k))) closed();
    origin = appleOrigin(appleText(c.origin, 2048)); credential = appleText(c.serverCredential, 16384);
    deletion = inspectDeletionV2Policy(detach(c.deletionPolicy)); custody = inspectApplePolicy(detach(c.custodyPolicy));
    if (deletion.version !== UUID_DELETE_PROFILE) closed();
    if (c.timeoutMs !== undefined && typeof c.timeoutMs !== "number") closed();
    timeout = (c.timeoutMs ?? 3000) as number;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 8000) closed();
    const repo = own(c.repository), issuer = own(c.issuer);
    appleExact(repo, ["command"]); appleExact(issuer, ["issue"]);
    const command = capture(repo, "command"), issued = capture(issuer, "issue"), read = capture(configuration, "observe"), denial = capture(configuration, "observeLocalDenial");
    repository = Object.freeze({ command: async (ns, action, body) => appleObject(detach(await command(ns, action, body))) });
    issue = async r => await issued(r); observe = async r => await read(r); local = async r => await denial(r);
    if (c.request !== undefined) { const transport = capture(configuration, "request"); request = async (u, i) => { const r = await transport(u, i); if (!(r instanceof Response)) closed(); return r; }; }
    if (c.now !== undefined) { const clock = capture(configuration, "now"); now = () => { const n = clock(); if (!Number.isSafeInteger(n) || Number(n) < 0) closed(); return n as number; }; }
    if (c.originalRecovery !== undefined) { const r = own(c.originalRecovery); appleExact(r, ["forOwner"]); const method = capture(r, "forOwner"); recoverOwner = owner => method(owner); }
    if (c.receiptCleanup !== undefined) { const r = own(c.receiptCleanup); appleExact(r, ["clear"]); const method = capture(r, "clear"); cleanup = async input => await method(input); }
    configured = true;
  } catch { configured = false; }
  // These snapshots are never handed back through the owner ports.
  const policy = deletion, custodyPolicy = custody, repo = repository, issuer = issue, read = observe, denial = local, recovery = recoverOwner, clearReceipt = cleanup;
  const proof = (t: DeletionTarget, outcome: DeletionProof["outcome"], tag: string): DeletionProof => ({ ...t, outcome, evidenceHash: appleDigest(["wd-uuid-claim-auth-v1", origin, UUID_DELETE_PROFILE, t, outcome, tag]) });
  async function bounded<T>(work: () => Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try { return await Promise.race([work(), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("claim_read_unknown")), timeout); })]); }
    finally { clearTimeout(timer); }
  }
  return Object.freeze({ profile: UUID_DELETE_PROFILE, forOwner(ownerId) {
    let owner: string | undefined;
    try { owner = appleUuid(ownerId); } catch { /* closed without I/O */ }
    const identity = configured && owner ? supabaseDeletionAuthV2(origin, credential, request, timeout).verifyIdentity : async () => null;
    const invoke = (phase: "run" | "reconcile") => async (input: DeletionTarget): Promise<DeletionProof> => {
      const t = target(input); let entered = false;
      const correlate = (result: unknown): DeletionProof => {
        const r = appleExact(detach(result), ["userId", "identityHash", "operationId", "outcome", "evidenceHash"]);
        if (r.userId !== t.userId || r.identityHash !== t.identityHash || r.operationId !== t.operationId || !["confirmed", "already_absent", "not_started", "unknown"].includes(String(r.outcome))) closed();
        appleHash(r.evidenceHash); return r as DeletionProof;
      };
      try {
        if (!configured || !owner || t.userId !== owner || !repo || !issuer || !policy || !custodyPolicy || !read || !denial) return proof(t, phase === "run" ? "not_started" : "unknown", "private_configuration_or_owner_unavailable");
        if (phase === "reconcile") {
          if (!recovery) return proof(t, "unknown", "original_recovery_unavailable");
          // The separate reviewed recovery implementation owns durable original,
          // full fence, GET-only and record checks. No destructive scope here.
          entered = true;
          const port = own(recovery(owner)); appleExact(port, ["reconcile"]);
          const method = capture(port, "reconcile");
          const result = correlate(await bounded(async () => await method(detach(t))));
          return result.outcome === "not_started" ? proof(t, "unknown", "recovery_outcome_unverified") : result;
        }
        const f = checkedApple(detach(await bounded(() => repo.command("deletion", "auth_fence", { ...t }))));
        appleUuid(f.owner); appleUuid(f.intentId); appleHash(f.intentSha256); appleHash(f.fenceHash);
        if (!Number.isSafeInteger(f.attempt) || Number(f.attempt) < 1 || Number(f.attempt) > 2147483647 || instant(f.lease) <= now() || f.policySha256 !== appleDigest(policy) || f.currentIdentityHash !== t.identityHash
          || !["started", "held"].includes(String(f.authState)) || !["not_required", "confirmed", "manual_required", "failed", "unknown"].includes(String(f.disposition))
          || !["linked", "none"].includes(String(f.actualApple)) || f.effectiveApple !== f.apple || !["linked", "none"].includes(String(f.apple))) closed();
        if (clearReceipt) {
          // This request labels correlation facts only. Its digest/nonce never
          // becomes a ScopeAdmission, allowed proof or approved expected hashes.
          const binding = { userId: t.userId, identityHash: t.identityHash, authOperationId: t.operationId, deletionOperationId: appleUuid(f.intentId), intentSha256: appleHash(f.intentSha256),
            workOwner: appleUuid(f.owner), workAttempt: f.attempt as number, leaseUntil: f.lease as string };
          const base = { binding, policySha256: appleDigest(policy), authorizationId: randomUUID(), custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
          const factRequest: ScopeObservationRequest = { ...base, scopeSha256: appleDigest(["wd-uuid-receipt-revision-facts-v1", "NON-AUTHORIZING", base, policy]) };
          const factStarted = now();
          const facts = appleExact(detach(await bounded(() => read(detach(factRequest) as ScopeObservationRequest))), ["contract", "binding", "policySha256", "authorizationId", "scopeSha256", "observedAt", "validUntil", "accountRevision", "authGraphSha256", "catalogSha256", "storage", "application", "references", "engine", "providerOperations", "unclassifiedReferences", "writeFence"]);
          const factAfter = now(), observedAt = instant(facts.observedAt), validUntil = instant(facts.validUntil);
          if (facts.contract !== CURRENT_AUTH_SCOPE || appleDigest(facts.binding) !== appleDigest(binding) || facts.policySha256 !== base.policySha256 || facts.authorizationId !== base.authorizationId || facts.scopeSha256 !== factRequest.scopeSha256
            || observedAt < factStarted || observedAt > factAfter || factAfter < factStarted || factAfter - factStarted > timeout || validUntil <= factAfter || validUntil > instant(f.lease) || facts.writeFence !== null || facts.providerOperations !== "settled") closed();
          const integer = (v: unknown, minimum = 0): number => { if (!Number.isSafeInteger(v) || Number(v) < minimum || Number(v) > 2147483647) closed(); return v as number; };
          const revision = integer(facts.accountRevision, 1);
          appleHash(facts.authGraphSha256); appleHash(facts.catalogSha256); integer(facts.unclassifiedReferences);
          const storage = appleExact(facts.storage, ["objects", "buckets", "multipartUploads", "multipartParts", "metadataReferences", "unknownLinkages"]);
          for (const value of Object.values(storage)) integer(value);
          const application = appleExact(facts.application, ["savedWeeks", "accountReceipts", "pushTokens", "pushReceipts", "pushJobs", "currentPlanCleanupPending", "privateResidue", "unexpectedAccountFields"]);
          if (typeof application.currentPlanCleanupPending !== "boolean") closed();
          for (const [key, value] of Object.entries(application)) if (key !== "currentPlanCleanupPending") integer(value);
          const references = appleExact(facts.references, Object.keys(CURRENT_AUTH_SCOPE_REFERENCES));
          for (const [key, value] of Object.entries(references)) {
            const ref = appleExact(value, key === "retentionAttempts" ? ["count", "sha256", "validUntil"] : ["count", "sha256"]);
            const count = integer(ref.count); appleHash(ref.sha256);
            if (key === "retentionAttempts") {
              if (count > 128 || (count === 0 ? ref.validUntil !== null : ref.validUntil === null)) closed();
              if (ref.validUntil !== null && instant(ref.validUntil) < validUntil) closed();
            }
          }
          const engine = appleExact(facts.engine, ["metadataSha256", "authLinks", "ownerMatches", "unknownLinkages"]);
          appleHash(engine.metadataSha256); for (const key of ["authLinks", "ownerMatches", "unknownLinkages"]) integer(engine[key]);
          // All counters/hashes above are merely decoded; only revision flows
          // forward. Cleanup checks it durably; final scope reobserves all facts.
          const receiptInput: CurrentUuidReceiptCleanupInput = { ...binding, accountRevision: revision, policySha256: base.policySha256 };
          const started = now(); entered = true;
          const receipt = appleObject(detach(await bounded(() => clearReceipt(detach(receiptInput) as CurrentUuidReceiptCleanupInput))));
          if (appleDigest(receipt) === appleDigest({ outcome: "held" })) return proof(t, "not_started", "receipt_cleanup_held");
          if (appleDigest(receipt) === appleDigest({ outcome: "unknown" })) return proof(t, "unknown", "receipt_cleanup_unknown");
          appleExact(receipt, ["contract", "outcome", "binding", "removed", "remaining", "observedAt"]);
          const after = now(), observed = instant(receipt.observedAt);
          if (receipt.contract !== UUID_RECEIPT_CONTRACT || receipt.outcome !== "cleared" || ![0, 1].includes(receipt.removed as number) || receipt.remaining !== 0
            || appleDigest(receipt.binding) !== appleDigest(receiptInput) || observed < started || observed > after || after < started || after - started > timeout || instant(f.lease) <= after) closed();
          const current = checkedApple(detach(await bounded(() => repo.command("deletion", "auth_fence", { ...t }))));
          if (appleDigest(current) !== appleDigest(f)) closed();
          entered = false; // Correlated local cleanup completed; no Auth effect yet.
        }
        const value = await bounded(() => issuer(detach({ phase, target: t, fence: f }) as CurrentUuidClaimIssueRequest));
        if (value === null) closed();
        const issued = appleExact(detach(value), ["phase", "admission", "writerManifestSha256", "writerCatalogSha256"]);
        if (issued.phase !== phase) closed();
        const a = copyCurrentScopeAdmission(issued.admission), manifest = appleHash(issued.writerManifestSha256), catalog = appleHash(issued.writerCatalogSha256);
        if (appleDigest(a.deletionPolicy) !== appleDigest(policy) || appleDigest(a.custodyPolicy) !== appleDigest(custodyPolicy) || a.deletionPolicy.version !== UUID_DELETE_PROFILE
          || a.target.userId !== owner || a.target.identityHash !== t.identityHash || a.target.authOperationId !== t.operationId || a.target.deletionOperationId !== f.intentId || a.target.intentSha256 !== f.intentSha256
          || a.target.workOwner !== f.owner || a.target.workAttempt !== f.attempt || a.target.leaseUntil !== f.lease || instant(a.expiresAt) <= now() || instant(a.expiresAt) > instant(f.lease) || instant(f.lease) <= now()) closed();
        if (Object.hasOwn(f, "accountRevision") && f.accountRevision !== a.accountRevision) closed();
        const fenceDigest = appleDigest(f);
        const invocationRepository: AppleRepository = { async command(ns, action, body) {
          const raw = await repo.command(ns, action, body);
          if (ns === "deletion" && action === "auth_fence") {
            const current = checkedApple(detach(raw)); if (appleDigest(current) !== fenceDigest) closed(); return current;
          }
          return raw;
        } };
        // Issuance provides private data only. The accepted preflight performs the
        // actual reobservation and is the sole runtime-issued UUID proof producer.
        const preflight = createCurrentUuidAuthScopePreflight({ enabled: true, admission: a, writerManifestSha256: manifest, writerCatalogSha256: catalog, observe: read, observeLocalDenial: denial, now });
        const actual = createAccountDeletionUuidAuthAdapter({ enabled: true, profile: UUID_DELETE_PROFILE, admission: a, origin, serverCredential: credential, repository: invocationRepository, preflight, request, now, timeoutMs: timeout });
        entered = true;
        const result = phase === "run" ? await actual.auth.run(t) : await actual.auth.reconcile!(t);
        return correlate(result);
      } catch { return proof(t, phase === "run" && !entered ? "not_started" : "unknown", entered ? "accepted_provider_outcome_unverified" : "claim_issuance_unavailable"); }
    };
    return Object.freeze({ verifyIdentity: async (uid: string) => owner && uid === owner ? await identity(uid) : null, auth: Object.freeze({ run: invoke("run"), reconcile: invoke("reconcile") }) });
  } });
}
