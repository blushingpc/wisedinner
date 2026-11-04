import { randomUUID } from "node:crypto";
import { types } from "node:util";
import type { DeletionTarget, VerifiedDeletionIdentity } from "./account-deletion.ts";
import type { AuthScopeInput } from "./account-deletion-v2-auth.server.ts";
import { inspectDeletionV2Policy, type DeletionV2Policy } from "./account-deletion-v2.server.ts";
import { appleDigest, appleExact, appleObject, appleHash, appleUuid, inspectApplePolicy, type AppleData, type ApplePolicy, type AppleRepository } from "./apple-token-custody.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, copyCurrentScopeAdmission, createCurrentAuthScopeEvidenceReader, type CurrentScopeReference, type ScopeAdmission, type ScopeReference, type RetentionScopeReference, type ScopeObservation, type ScopeObservationRequest } from "./current-auth-scope.server.ts";
import { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";
import type { CurrentUuidClaimScopeIssuer } from "./current-uuid-claim-contract.server.ts";

// Private trusted-server interfaces. Neither a selector nor a fact request is a
// final UUID proof. Selectors independently project sanitized current-target
// evidence; they are never supplied by an endpoint, environment or RPC reply.
export type ClaimProjectionRequest = Readonly<{
  phase: "run" | "reconcile"; binding: AuthScopeInput; accountRevision: number;
  reference: CurrentScopeReference; projection: string; policySha256: string; projectionIdentitySha256: string;
}>;
export type ClaimProjection = Readonly<{
  projectionIdentitySha256: string; value: ScopeReference | RetentionScopeReference;
}>;
export type ClaimReferenceSelector = Readonly<{
  reference: CurrentScopeReference; projection: string; userId: string; identityHash: string;
  policySha256: string; maxCount: number;
  select(input: ClaimProjectionRequest): Promise<ClaimProjection | null>;
}>;
export type CurrentUuidClaimTemplate = Readonly<{
  deletionPolicy: DeletionV2Policy; custodyPolicy: ApplePolicy;
  expectedCatalogSha256: string; expectedEngineSha256: string;
  writerManifestSha256: string; writerCatalogSha256: string;
  validUntil: string; maxObservationAgeMs: number; selectors: readonly ClaimReferenceSelector[];
}>;
export type ClaimIdentitySnapshot = Readonly<
  { outcome: "present"; identity: VerifiedDeletionIdentity; observedAt: string } |
  { outcome: "absent"; userId: string; observedAt: string } |
  { outcome: "unknown" }
>;
export type CurrentUuidClaimScopeDependencies = Readonly<{
  template: CurrentUuidClaimTemplate; repository: AppleRepository;
  observe(request: ScopeObservationRequest): Promise<unknown>;
  readIdentity(userId: string): Promise<ClaimIdentitySnapshot>; now(): number;
}>;
const keys = Object.keys(CURRENT_AUTH_SCOPE_REFERENCES) as CurrentScopeReference[];
function held(): never { throw Error("claim_scope_held"); }
function own(value: unknown): Record<string, PropertyDescriptor> {
  if (!value || typeof value !== "object" || types.isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) held();
  const d = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(d).some(k => typeof k !== "string") || Object.values(d).some(v => !("value" in v) || !v.enumerable)) held();
  return d;
}
function data(value: unknown): unknown {
  // Reject proxies before reflection, including nested objects. Never execute a
  // getter/toJSON or function property while snapshotting configuration/results.
  let nodes = 0;
  function inspect(v: unknown, depth: number) {
    if (++nodes > 20000 || depth > 16) held();
    if (!v || typeof v !== "object") return;
    if (types.isProxy(v)) held();
    const d = Object.getOwnPropertyDescriptors(v);
    for (const x of Object.values(d)) { if (!("value" in x)) held(); inspect(x.value, depth + 1); }
  }
  inspect(value, 0); return copyReferenceData(value);
}
function freeze<T>(v: T): T {
  if (v && typeof v === "object") { Object.values(v).forEach(freeze); Object.freeze(v); } return v;
}
function time(v: unknown): number {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) held();
  const t = Date.parse(v), day = v.slice(0, 10);
  if (!Number.isSafeInteger(t) || new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day) held();
  return t;
}
function positive(v: unknown, max = 2147483647): number {
  if (!Number.isSafeInteger(v) || Number(v) < 1 || Number(v) > max) held(); return v as number;
}
function callable(v: unknown): (...args: never[]) => unknown {
  if (typeof v !== "function" || types.isProxy(v)) held(); return v as (...args: never[]) => unknown;
}
function target(v: unknown): DeletionTarget {
  const t = appleExact(data(v), ["userId", "identityHash", "operationId"]);
  return { userId: appleUuid(t.userId), identityHash: appleHash(t.identityHash), operationId: appleUuid(t.operationId) };
}
function binding(t: DeletionTarget, f: AppleData, policyHash: string, now: number): AuthScopeInput {
  appleExact(f, ["owner", "attempt", "lease", "apple", "appleState", "authState", "intentId", "intentSha256", "disposition", "currentIdentityHash", "actualApple", "effectiveApple", "policySha256", "retainedEvidence", "fenceHash"]);
  if (f.currentIdentityHash !== t.identityHash || f.policySha256 !== policyHash || !["started", "held"].includes(String(f.authState))
    || !["not_required", "confirmed", "manual_required", "failed", "unknown"].includes(String(f.disposition))
    || !["linked", "none"].includes(String(f.actualApple)) || !["linked", "none"].includes(String(f.apple)) || f.effectiveApple !== f.apple || time(f.lease) <= now) held();
  appleHash(f.fenceHash);
  return { userId: t.userId, identityHash: t.identityHash, authOperationId: t.operationId,
    deletionOperationId: appleUuid(f.intentId), intentSha256: appleHash(f.intentSha256), workOwner: appleUuid(f.owner), workAttempt: positive(f.attempt), leaseUntil: String(f.lease) };
}

export function createCurrentUuidClaimScopeIssuer(deps?: CurrentUuidClaimScopeDependencies): CurrentUuidClaimScopeIssuer {
  let configured: CurrentUuidClaimTemplate | undefined;
  let command: ((action: string, t: DeletionTarget) => Promise<AppleData>) | undefined;
  let observe: ((request: ScopeObservationRequest) => Promise<unknown>) | undefined;
  let identity: ((id: string) => Promise<ClaimIdentitySnapshot>) | undefined;
  let clock: (() => number) | undefined;
  const selectors = new Map<CurrentScopeReference, { metadata: Omit<ClaimReferenceSelector, "select">; select: (q: ClaimProjectionRequest) => Promise<ClaimProjection | null> }>();
  try {
    const d = own(deps);
    if (Object.keys(d).sort().join() !== ["template", "repository", "observe", "readIdentity", "now"].sort().join()) held();
    const td = own(d.template.value);
    const names = ["deletionPolicy", "custodyPolicy", "expectedCatalogSha256", "expectedEngineSha256", "writerManifestSha256", "writerCatalogSha256", "validUntil", "maxObservationAgeMs", "selectors"];
    if (Object.keys(td).sort().join() !== names.sort().join()) held();
    const list = td.selectors.value;
    if (!Array.isArray(list) || types.isProxy(list) || Object.getPrototypeOf(list) !== Array.prototype || list.length > keys.length) held();
    const ld = Object.getOwnPropertyDescriptors(list);
    if (Reflect.ownKeys(ld).length !== list.length + 1) held();
    for (let i = 0; i < list.length; i++) {
      if (!("value" in ld[String(i)])) held();
      const raw = ld[String(i)].value, sd = own(raw);
      if (Object.keys(sd).sort().join() !== ["reference", "projection", "userId", "identityHash", "policySha256", "maxCount", "select"].sort().join()) held();
      const m = data(Object.fromEntries(Object.entries(sd).filter(([k]) => k !== "select").map(([k, v]) => [k, v.value]))) as Omit<ClaimReferenceSelector, "select">;
      if (!keys.includes(m.reference) || selectors.has(m.reference) || m.projection !== CURRENT_AUTH_SCOPE + "/" + m.reference) held();
      appleUuid(m.userId); appleHash(m.identityHash); appleHash(m.policySha256); positive(m.maxCount, 128);
      const fn = callable(sd.select.value);
      selectors.set(m.reference, { metadata: freeze(m), select: q => Promise.resolve(Reflect.apply(fn, raw, [q])) as Promise<ClaimProjection | null> });
    }
    const metadata = data(Object.fromEntries(Object.entries(td).filter(([k]) => k !== "selectors").map(([k, v]) => [k, v.value]))) as Omit<CurrentUuidClaimTemplate, "selectors">;
    const policy = inspectDeletionV2Policy(metadata.deletionPolicy); inspectApplePolicy(metadata.custodyPolicy);
    if (policy.version !== UUID_DELETE_PROFILE) held();
    for (const h of [metadata.expectedCatalogSha256, metadata.expectedEngineSha256, metadata.writerManifestSha256, metadata.writerCatalogSha256]) appleHash(h);
    time(metadata.validUntil); positive(metadata.maxObservationAgeMs, 8000);
    for (const { metadata: m } of selectors.values()) if (m.policySha256 !== appleDigest(policy) || !policy.retainedEvidence.includes(CURRENT_AUTH_SCOPE_REFERENCES[m.reference])) held();
    const repo = d.repository.value, rd = own(repo);
    if (Object.keys(rd).join() !== "command") held();
    const fn = callable(rd.command.value), ob = callable(d.observe.value), id = callable(d.readIdentity.value), cl = callable(d.now.value);
    command = (action, t) => Promise.resolve(Reflect.apply(fn, repo, ["deletion", action, t])) as Promise<AppleData>;
    observe = q => Promise.resolve(Reflect.apply(ob, deps, [q]));
    identity = idValue => Promise.resolve(Reflect.apply(id, deps, [idValue])) as Promise<ClaimIdentitySnapshot>;
    clock = () => Reflect.apply(cl, deps, []) as number;
    configured = freeze({ ...metadata, selectors: [] });
  } catch { configured = undefined; }
  const template = configured;
  return Object.freeze({ async issue(input) {
    try {
      if (!template || !command || !observe || !identity || !clock) return null;
      const req = appleExact(data(input), ["phase", "target", "fence"]);
      if (req.phase !== "run" && req.phase !== "reconcile") held();
      const phase: "run" | "reconcile" = req.phase;
      const t = target(req.target), supplied = data(req.fence);
      const now = () => { const n = clock!(); if (!Number.isSafeInteger(n) || n < 0) held(); return n; };
      const started = now(), policySha256 = appleDigest(template.deletionPolicy);
      if (time(template.validUntil) <= started) held();
      async function bounded<T>(promise: Promise<T>): Promise<T> {
        let timer: ReturnType<typeof setTimeout> | undefined;
        try { return await Promise.race([promise, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("claim_read_timeout")), template!.maxObservationAgeMs); })]); }
        finally { clearTimeout(timer); }
      }
      const f = data(await bounded(command("auth_fence", freeze({ ...t })))) as AppleData;
      if (appleDigest(f) !== appleDigest(supplied)) held();
      const b = binding(t, f, policySha256, now());
      if (appleDigest(f.retainedEvidence) !== appleDigest(template.deletionPolicy.retainedEvidence)) held();
      const id = appleObject(data(await bounded(identity(t.userId))));
      if (id.outcome === "present") {
        appleExact(id, ["outcome", "identity", "observedAt"]);
        const user = appleExact(id.identity, ["userId", "identityHash", "evidenceHash", "apple"]);
        if (user.userId !== t.userId || user.identityHash !== t.identityHash || user.apple !== f.actualApple) held();
        appleHash(user.evidenceHash);
      } else if (phase === "reconcile" && id.outcome === "absent") {
        appleExact(id, ["outcome", "userId", "observedAt"]); if (id.userId !== t.userId) held();
      } else held();
      const idTime = time(id.observedAt);
      if (idTime > now() || now() - idTime > template.maxObservationAgeMs) held();
      const original = data(await bounded(command("auth_original", freeze({ ...t })))) as AppleData;
      if (phase === "run") {
        // A valid current fence establishes the original parent. This exact SQL
        // response means no Auth attempt was admitted; any durable attempt is
        // reconciliation-only, never new run authority.
        if (appleDigest(original) !== appleDigest({ error: "original_unresolved" })) held();
      } else {
        if (original.scopeAdmitted !== true || original.scopeProfile !== UUID_DELETE_PROFILE || original.scopeProviderPredicate !== "account-uuid-only"
          || original.scopePolicySha256 !== policySha256 || !["started", "confirmed"].includes(String(original.state))) held();
        appleHash(original.scopeHash); positive(original.scopeAccountRevision);
      }
      const authorizationId = randomUUID();
      const factRequest: ScopeObservationRequest = freeze({ binding: b, policySha256, authorizationId,
        scopeSha256: appleDigest(["wd-current-uuid-claim-NON-AUTHORIZING-fact-read-v1", phase, t, f, authorizationId]),
        custodyPolicy: template.custodyPolicy, custodyPolicySha256: appleDigest(template.custodyPolicy) });
      const raw = data(await bounded(observe(factRequest))) as ScopeObservation;
      if (!raw || typeof raw !== "object") held();
      if (raw.contract !== CURRENT_AUTH_SCOPE || appleDigest(raw.binding) !== appleDigest(b) || raw.authorizationId !== authorizationId
        || raw.scopeSha256 !== factRequest.scopeSha256 || raw.policySha256 !== policySha256 || raw.catalogSha256 !== template.expectedCatalogSha256
        || raw.engine?.metadataSha256 !== template.expectedEngineSha256 || raw.writeFence !== null || raw.unclassifiedReferences !== 0 || raw.providerOperations !== "settled") held();
      const factAt = time(raw.observedAt), factAfter = now();
      if (factAt > factAfter || factAfter - factAt > template.maxObservationAgeMs || time(raw.validUntil) <= factAfter
        || time(raw.validUntil) > Math.min(time(template.validUntil), time(b.leaseUntil))) held();
      const accountRevision = positive(raw.accountRevision), expiresAt = new Date(Math.min(time(template.validUntil), time(b.leaseUntil), time(raw.validUntil))).toISOString();
      if (phase === "reconcile" && original.scopeAccountRevision !== accountRevision) held();
      const refs = appleExact(raw.references, keys), retained: ScopeAdmission["retained"] = {};
      for (const key of keys) {
        const actual = appleExact(refs[key], key === "retentionAttempts" ? ["count", "sha256", "validUntil"] : ["count", "sha256"]);
        if (actual.count === 0) continue;
        positive(actual.count, 128); appleHash(actual.sha256);
        const selector = selectors.get(key);
        if (!selector || selector.metadata.userId !== t.userId || selector.metadata.identityHash !== t.identityHash || Number(actual.count) > selector.metadata.maxCount) held();
        const q = { phase, binding: b, accountRevision, reference: key, projection: selector.metadata.projection, policySha256 };
        const projectionIdentitySha256 = appleDigest(["wd-current-uuid-claim-target-projection-v1", q]);
        const expected = appleExact(data(await bounded(selector.select(freeze({ ...q, projectionIdentitySha256 })))), ["projectionIdentitySha256", "value"]);
        if (expected.projectionIdentitySha256 !== projectionIdentitySha256 || appleDigest(expected.value) !== appleDigest(actual)) held();
        (retained as Record<string, unknown>)[key] = expected.value;
      }
      const a = freeze(copyCurrentScopeAdmission({ authorizationId, target: b, deletionPolicy: template.deletionPolicy, custodyPolicy: template.custodyPolicy,
        accountRevision, expectedAuthGraphSha256: appleHash(raw.authGraphSha256), expectedCatalogSha256: template.expectedCatalogSha256, expectedEngineSha256: template.expectedEngineSha256,
        expiresAt, maxObservationAgeMs: template.maxObservationAgeMs, retained }));
      // Only the final, genuinely echoed request goes to the common reader.
      // Never rewrite a fact response into a fabricated final response.
      const reader = createCurrentAuthScopeEvidenceReader({ enabled: true, admission: a, now, observe });
      const evidence = await reader(b);
      const comparable = (o: unknown) => {
        const v = appleObject(o);
        return Object.fromEntries(Object.entries(v).filter(([k]) => !["scopeSha256", "observedAt", "validUntil"].includes(k)));
      };
      if (evidence.outcome !== "observed" || appleDigest(comparable(evidence.observation)) !== appleDigest(comparable(raw))
        || evidence.observation.writeFence !== null) held();
      const afterFence = data(await bounded(command("auth_fence", freeze({ ...t }))));
      if (appleDigest(afterFence) !== appleDigest(f)) held();
      if (appleDigest(data(await bounded(command("auth_original", freeze({ ...t }))))) !== appleDigest(original)) held();
      const after = now();
      if (after < started || after - started > template.maxObservationAgeMs || after >= time(expiresAt) || after - idTime > template.maxObservationAgeMs) held();
      return freeze({ phase, admission: a, writerManifestSha256: template.writerManifestSha256, writerCatalogSha256: template.writerCatalogSha256 });
    } catch { return null; }
  } });
}
