import type { AuthScopeInput, AuthScopeProof } from "./account-deletion-v2-auth.server.ts";
import { inspectDeletionV2Policy, type DeletionV2Policy } from "./account-deletion-v2.server.ts";
import { inspectApplePolicy, type ApplePolicy, appleDigest, appleExact, appleHash, appleHttp, appleOrigin, appleText, appleUuid } from "./apple-token-custody.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";

// Server-only, unbound factory. Neither this module nor construction performs I/O.
export const CURRENT_AUTH_SCOPE = "wd-current-auth-scope-observation-v2";
export const CURRENT_AUTH_SCOPE_REFERENCES = {
  accountTombstone: "deletion_receipt",
  billingBindings: "billing_evidence", billingStates: "billing_evidence", billingTransactions: "billing_evidence", billingEvents: "billing_evidence",
  restoreIntents: "billing_evidence", restoreLineages: "billing_evidence", restoreAliases: "billing_evidence", restoreFences: "billing_evidence",
  deletionWork: "deletion_receipt", deletionIntents: "deletion_receipt",
  appleOwners: "apple_credential_recovery", appleExchanges: "apple_credential_recovery", appleCredentials: "apple_credential_recovery",
  retentionAttempts: "apple_credential_recovery",
  appleBindings: "deletion_receipt", appleGroups: "apple_credential_recovery", appleRevocations: "apple_credential_recovery", authAttempts: "deletion_receipt",
} as const;
export type CurrentScopeReference = keyof typeof CURRENT_AUTH_SCOPE_REFERENCES;
export type ScopeReference = Readonly<{ count: number; sha256: string }>;
export type RetentionScopeReference = ScopeReference & Readonly<{ validUntil: string | null }>;
export type ScopeObservationRequest = Readonly<{ binding: AuthScopeInput; policySha256: string; authorizationId: string; scopeSha256: string; custodyPolicy: ApplePolicy; custodyPolicySha256: string }>;
type ScopeReferences = Readonly<Record<Exclude<CurrentScopeReference, "retentionAttempts">, ScopeReference> & { retentionAttempts: RetentionScopeReference }>;
export type ScopeAdmission = Readonly<{
  authorizationId: string; target: AuthScopeInput; deletionPolicy: DeletionV2Policy; custodyPolicy: ApplePolicy; accountRevision: number;
  expectedAuthGraphSha256: string; expectedCatalogSha256: string; expectedEngineSha256: string;
  expiresAt: string; maxObservationAgeMs: number;
  // Exact reviewed retained rows/projections, never permission to retain a whole category.
  retained: Partial<ScopeReferences>;
}>;
export type ScopeObservation = Readonly<{
  contract: typeof CURRENT_AUTH_SCOPE; binding: AuthScopeInput; policySha256: string; authorizationId: string; scopeSha256: string;
  observedAt: string; validUntil: string; accountRevision: number;
  authGraphSha256: string; catalogSha256: string;
  storage: Readonly<{ objects: number; buckets: number; multipartUploads: number; multipartParts: number; metadataReferences: number; unknownLinkages: number }>;
  application: Readonly<{ savedWeeks: number; accountReceipts: number; pushTokens: number; pushReceipts: number; pushJobs: number; currentPlanCleanupPending: boolean; privateResidue: number; unexpectedAccountFields: number }>;
  references: ScopeReferences;
  engine: Readonly<{ metadataSha256: string; authLinks: number; ownerMatches: number; unknownLinkages: number }>;
  providerOperations: "settled" | "active" | "unknown";
  unclassifiedReferences: number;
  // RPC alone returns null: an actual trusted host must independently prove and
  // maintain write quiescence THROUGH Auth DELETE. A short TTL is not a fence.
  writeFence: null | Readonly<{ bindingSha256: string; evidenceSha256: string; validUntil: string }>;
}>;
export type CurrentAuthScopeDependencies = Readonly<{
  enabled?: boolean; admission?: ScopeAdmission;
  observe?: (request: ScopeObservationRequest) => Promise<unknown>; now?: () => number;
}>;
const bindingKeys = ["userId", "identityHash", "authOperationId", "deletionOperationId", "intentSha256", "workOwner", "workAttempt", "leaseUntil"];
const referenceKeys = Object.keys(CURRENT_AUTH_SCOPE_REFERENCES) as CurrentScopeReference[];
function fail(): never { throw Error("current_auth_scope_held"); }
function integer(x: unknown, minimum = 0): number { if (!Number.isSafeInteger(x) || (x as number) < minimum || (x as number) > 2147483647) fail(); return x as number; }
function time(x: unknown): number {
  if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(x)) fail();
  const value = Date.parse(x); if (!Number.isSafeInteger(value)) fail();
  const [year, month, day] = x.slice(0, 10).split("-").map(Number);
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || Number(x.slice(11, 13)) > 23 || Number(x.slice(14, 16)) > 59 || Number(x.slice(17, 19)) > 59) fail();
  return value;
}
function binding(x: unknown): AuthScopeInput {
  const b = appleExact(x, bindingKeys);
  for (const k of ["userId", "authOperationId", "deletionOperationId", "workOwner"]) appleUuid(b[k]);
  appleHash(b.identityHash); appleHash(b.intentSha256); integer(b.workAttempt, 1); time(b.leaseUntil);
  return b as AuthScopeInput;
}
function reference(x: unknown): ScopeReference { const r = appleExact(x, ["count", "sha256"]); integer(r.count); appleHash(r.sha256); return r as ScopeReference; }
function retentionReference(x: unknown): RetentionScopeReference {
  const r = appleExact(x, ["count", "sha256", "validUntil"]); integer(r.count); appleHash(r.sha256);
  if ((r.count as number) > 128 || (r.count === 0 ? r.validUntil !== null : r.validUntil === null)) fail();
  if (r.validUntil !== null) time(r.validUntil);
  return r as RetentionScopeReference;
}
function admission(x: unknown): ScopeAdmission {
  const a = appleExact(x, ["authorizationId", "target", "deletionPolicy", "custodyPolicy", "accountRevision", "expectedAuthGraphSha256", "expectedCatalogSha256", "expectedEngineSha256", "expiresAt", "maxObservationAgeMs", "retained"]);
  appleUuid(a.authorizationId); binding(a.target); integer(a.accountRevision, 1); time(a.expiresAt); integer(a.maxObservationAgeMs, 1); if ((a.maxObservationAgeMs as number) > 8000) fail();
  const p = inspectDeletionV2Policy(a.deletionPolicy); inspectApplePolicy(a.custodyPolicy);
  for (const k of ["expectedAuthGraphSha256", "expectedCatalogSha256", "expectedEngineSha256"]) appleHash(a[k]);
  const retained = appleExact(a.retained, Object.keys(a.retained as object));
  if (Object.keys(retained).some(k => !referenceKeys.includes(k as CurrentScopeReference))) fail();
  for (const [k, v] of Object.entries(retained)) {
    if (!p.retainedEvidence.includes(CURRENT_AUTH_SCOPE_REFERENCES[k as CurrentScopeReference]) || (k === "retentionAttempts" ? retentionReference(v) : reference(v)).count < 1) fail();
  }
  return a as ScopeAdmission;
}

export type CurrentScopeEvidence = Readonly<{
  outcome: "observed"; request: ScopeObservationRequest; observation: ScopeObservation;
  binding: Extract<AuthScopeProof, { outcome: "allowed" }>["binding"];
  coverage: Extract<AuthScopeProof, { outcome: "allowed" }>["coverage"];
}>;
// Observation validation is not a deletion authorization. It never invents a fence.
export function copyCurrentScopeAdmission(value: unknown): ScopeAdmission { return admission(copyReferenceData(value)); }
export function createCurrentAuthScopeEvidenceReader(deps: CurrentAuthScopeDependencies): (input: AuthScopeInput) => Promise<CurrentScopeEvidence | { outcome: "held" }> {
  // Copy only own data, rejecting accessors/functions/prototype tricks without
  // executing them. A malformed configuration is a closed, zero-I/O adapter.
  let a: ScopeAdmission | undefined;
  let observe: CurrentAuthScopeDependencies["observe"], clock: () => number = Date.now;
  try {
    if (!deps || ![Object.prototype, null].includes(Object.getPrototypeOf(deps))) fail();
    const fields = Object.getOwnPropertyDescriptors(deps);
    if (Reflect.ownKeys(fields).some(k => typeof k !== "string" || !["enabled", "admission", "observe", "now"].includes(k)) || Object.values(fields).some(x => !("value" in x))) fail();
    observe = fields.observe?.value; clock = fields.now?.value ?? Date.now;
    if (typeof clock !== "function") fail();
    if (fields.enabled?.value === true && typeof observe === "function") a = admission(copyReferenceData(fields.admission?.value));
  } catch { a = undefined; }
  const configured = a;
  return async (value): Promise<CurrentScopeEvidence | { outcome: "held" }> => {
    try {
      if (!configured || !observe) return { outcome: "held" };
      const a = configured, b = binding(copyReferenceData(value)), now = clock();
      if (!Number.isSafeInteger(now) || now < 0 || appleDigest(b) !== appleDigest(a.target) || time(b.leaseUntil) <= now || time(a.expiresAt) <= now) fail();
      const policySha256 = appleDigest(a.deletionPolicy), scopeSha256 = appleDigest(["wd-current-auth-scope-admission-v2", a]);
      const req: ScopeObservationRequest = { binding: b, policySha256, authorizationId: a.authorizationId, scopeSha256, custodyPolicy: a.custodyPolicy, custodyPolicySha256: appleDigest(a.custodyPolicy) };
      // The observer receives an independent copy and cannot mutate the expected
      // target/configuration while awaiting an RPC or an external fence read.
      let timer: ReturnType<typeof setTimeout> | undefined;
      let observed: unknown;
      try {
        observed = copyReferenceData(await Promise.race([observe(copyReferenceData(req) as ScopeObservationRequest), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("scope_observation_timeout")), a.maxObservationAgeMs); })]));
      } finally { clearTimeout(timer); }
      const o = appleExact(observed, ["contract", "binding", "policySha256", "authorizationId", "scopeSha256", "observedAt", "validUntil", "accountRevision", "authGraphSha256", "catalogSha256", "storage", "application", "references", "engine", "providerOperations", "unclassifiedReferences", "writeFence"]);
      const after = clock(); if (!Number.isSafeInteger(after) || after < now) fail();
      if (o.contract !== CURRENT_AUTH_SCOPE || appleDigest(binding(o.binding)) !== appleDigest(b) || o.policySha256 !== policySha256 || o.authorizationId !== a.authorizationId || o.scopeSha256 !== scopeSha256 || integer(o.accountRevision, 1) !== a.accountRevision) fail();
      const observedAt = time(o.observedAt), expires = time(o.validUntil);
      if (observedAt > after || after - observedAt > a.maxObservationAgeMs || expires <= after || expires < observedAt || expires > Math.min(time(b.leaseUntil), time(a.expiresAt))) fail();
      if (o.authGraphSha256 !== a.expectedAuthGraphSha256 || o.catalogSha256 !== a.expectedCatalogSha256 || o.providerOperations !== "settled" || integer(o.unclassifiedReferences) !== 0) fail();
      const storage = appleExact(o.storage, ["objects", "buckets", "multipartUploads", "multipartParts", "metadataReferences", "unknownLinkages"]);
      if (Object.values(storage).some(x => integer(x) !== 0)) fail();
      const app = appleExact(o.application, ["savedWeeks", "accountReceipts", "pushTokens", "pushReceipts", "pushJobs", "currentPlanCleanupPending", "privateResidue", "unexpectedAccountFields"]);
      if (app.currentPlanCleanupPending !== false || Object.entries(app).some(([k, v]) => k !== "currentPlanCleanupPending" && integer(v) !== 0)) fail();
      const refs = appleExact(o.references, referenceKeys); let retained = false;
      let proofExpires = Math.min(expires, time(b.leaseUntil), time(a.expiresAt), observedAt + a.maxObservationAgeMs);
      for (const key of referenceKeys) {
        const actual = key === "retentionAttempts" ? retentionReference(refs[key]) : reference(refs[key]), expected = a.retained[key];
        if (key === "retentionAttempts" && actual.count > 0) {
          const deadline = time((actual as RetentionScopeReference).validUntil);
          if (deadline <= after) fail();
          proofExpires = Math.min(proofExpires, deadline);
        }
        if (actual.count > 0) { if (!expected || appleDigest(actual) !== appleDigest(expected)) fail(); retained = true; }
        else if (expected) fail(); // A changed/erased original also invalidates this authorization.
      }
      if (proofExpires <= after) fail();
      const engine = appleExact(o.engine, ["metadataSha256", "authLinks", "ownerMatches", "unknownLinkages"]);
      if (engine.metadataSha256 !== a.expectedEngineSha256 || [engine.authLinks, engine.ownerMatches, engine.unknownLinkages].some(x => integer(x) !== 0)) fail();
      // Evidence is our canonical digest of the strictly decoded observation and
      // approved scope, not an assertion that a supplied hash proves its contents.
      return { outcome: "observed", request: copyReferenceData(req) as ScopeObservationRequest, observation: o as ScopeObservation, binding: { ...b, scopeSha256, policySha256, authorizationId: a.authorizationId, evidenceSha256: appleDigest([CURRENT_AUTH_SCOPE, req, observed]), observedAt: o.observedAt as string, validUntil: new Date(proofExpires).toISOString() }, coverage: { coveredAuthGraphSha256: a.expectedAuthGraphSha256, storage: "verified_clear", sharedEngine: "verified_preserved", relatedOwnerReferences: retained ? "approved_preserved" : "verified_clear" } };
    } catch { return { outcome: "held" }; }
  };
}

// Strict public factory keeps its original strong-fence contract and wire proof.
export function createCurrentAuthScopePreflight(deps: CurrentAuthScopeDependencies): (input: AuthScopeInput) => Promise<AuthScopeProof> {
  const read = createCurrentAuthScopeEvidenceReader(deps);
  return async input => {
    try {
      const evidence = await read(input);
      if (evidence.outcome !== "observed") return { outcome: "held" };
      const fence = appleExact(evidence.observation.writeFence, ["bindingSha256", "evidenceSha256", "validUntil"]);
      if (fence.bindingSha256 !== appleDigest(evidence.request) || time(fence.validUntil) < time(evidence.binding.validUntil)) fail();
      appleHash(fence.evidenceSha256);
      return { outcome: "allowed", binding: evidence.binding, coverage: evidence.coverage };
    } catch { return { outcome: "held" }; }
  };
}

// Optional concrete transport. This read-only SQL observation intentionally has
// writeFence:null; a trusted host needs actual independently verified quiescence
// before composing it with the preflight. No key lookup or environment binding.
export function createCurrentAuthScopeRpcObserver(deps: Readonly<{ origin: string; serverCredential: string; request?: typeof fetch; timeoutMs?: number }>): (request: ScopeObservationRequest) => Promise<unknown> {
  const origin = appleOrigin(deps.origin), key = appleText(deps.serverCredential, 16384), request = deps.request ?? fetch, timeout = deps.timeoutMs ?? 3000;
  if (!Number.isInteger(timeout) || timeout < 1 || timeout > 8000) fail();
  return async input => {
    const r = await appleHttp(origin + "/rest/v1/rpc/wd_current_auth_scope_observe", { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" }, body: JSON.stringify({ p_body: input }) }, request, 65536, timeout);
    if (r.status !== 200) fail(); return parseReferenceJson(r.text);
  };
}
