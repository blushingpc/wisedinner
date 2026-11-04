import type { AuthScopeInput } from "./account-deletion-v2-auth.server.ts";
import { createCurrentAuthScopeEvidenceReader, copyCurrentScopeAdmission, type ScopeAdmission, type ScopeObservationRequest, type CurrentScopeEvidence } from "./current-auth-scope.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { appleDigest, appleExact, appleHash } from "./apple-token-custody.server.ts";

export const UUID_DELETE_PROFILE = "wd-owner-uuid-delete-v1";
export const LOCAL_DELETE_SCOPE = "wd-current-local-delete-scope-v1";
export type UuidAuthScopeProof = { outcome: "held" } | Readonly<{
  outcome: "allowed"; profile: typeof UUID_DELETE_PROFILE; providerPredicate: "account-uuid-only"; strongWriteFence: null;
  accountRevision: number; binding: CurrentScopeEvidence["binding"]; coverage: CurrentScopeEvidence["coverage"];
  localDenial: Readonly<{ evidenceSha256: string; writerManifestSha256: string; writerCatalogSha256: string; barrierRevision: number }>;
}>;
export type CurrentUuidAuthScopeDependencies = Readonly<{
  enabled?: boolean; admission?: ScopeAdmission; writerManifestSha256?: string; writerCatalogSha256?: string;
  observe?: (request: ScopeObservationRequest) => Promise<unknown>;
  // Trusted server injection ONLY. No production RPC implementation/default exists yet.
  observeLocalDenial?: (request: ScopeObservationRequest) => Promise<unknown>; now?: () => number;
}>;
const issued = new WeakSet<object>();
export function isIssuedUuidAuthScopeProof(value: unknown): value is Extract<UuidAuthScopeProof, { outcome: "allowed" }> {
  return !!value && typeof value === "object" && issued.has(value);
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) throw Error("uuid_scope_held");
  const t = Date.parse(value), day = value.slice(0, 10);
  if (!Number.isSafeInteger(t) || new Date(day + "T00:00:00Z").toISOString().slice(0, 10) !== day) throw Error("uuid_scope_held");
  return t;
}
function positive(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1 || Number(value) > 2147483647) throw Error("uuid_scope_held");
  return value as number;
}
export function createCurrentUuidAuthScopePreflight(deps: CurrentUuidAuthScopeDependencies = {}): (input: AuthScopeInput) => Promise<UuidAuthScopeProof> {
  let a: ScopeAdmission | undefined, manifest = "", catalog = "";
  let local: CurrentUuidAuthScopeDependencies["observeLocalDenial"], now = Date.now;
  let read = createCurrentAuthScopeEvidenceReader({});
  try {
    if (!deps || ![Object.prototype, null].includes(Object.getPrototypeOf(deps))) throw Error("configuration");
    const ds = Object.getOwnPropertyDescriptors(deps), allowed = ["enabled", "admission", "writerManifestSha256", "writerCatalogSha256", "observe", "observeLocalDenial", "now"];
    if (Reflect.ownKeys(ds).some(k => typeof k !== "string" || !allowed.includes(k)) || Object.values(ds).some(d => !("value" in d))) throw Error("configuration");
    if (ds.enabled?.value !== true || typeof ds.observe?.value !== "function" || typeof ds.observeLocalDenial?.value !== "function") throw Error("configuration");
    a = copyCurrentScopeAdmission(ds.admission?.value);
    // A distinct policy is part of the durable original intent/hash, not an env switch.
    if (a.deletionPolicy.version !== UUID_DELETE_PROFILE) throw Error("profile_policy_required");
    manifest = appleHash(ds.writerManifestSha256?.value); catalog = appleHash(ds.writerCatalogSha256?.value);
    now = ds.now?.value ?? Date.now; if (typeof now !== "function") throw Error("configuration");
    const observe = ds.observe.value, localMethod = ds.observeLocalDenial.value;
    local = request => Reflect.apply(localMethod, deps, [request]);
    read = createCurrentAuthScopeEvidenceReader({ enabled: true, admission: a, now, observe: request => Reflect.apply(observe, deps, [request]) });
  } catch { a = undefined; }
  const admitted = a;
  return async input => {
    try {
      if (!admitted || !local) return { outcome: "held" };
      const evidence = await read(input); if (evidence.outcome !== "observed" || evidence.observation.writeFence !== null) return { outcome: "held" };
      const started = now(); if (!Number.isSafeInteger(started) || started < instant(evidence.binding.observedAt)) throw Error("clock");
      let timer: ReturnType<typeof setTimeout> | undefined;
      let raw: unknown;
      try { raw = await Promise.race([local(copyReferenceData(evidence.request) as ScopeObservationRequest), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("local_denial_timeout")), admitted.maxObservationAgeMs); })]); }
      finally { clearTimeout(timer); }
      const value = copyReferenceData(raw), o = appleExact(value, ["contract", "profile", "providerPredicate", "binding", "policySha256", "authorizationId", "scopeSha256", "observedAt", "validUntil", "accountRevision", "writerManifestSha256", "writerCatalogSha256", "denial", "writeFence"]);
      const after = now();
      if (!Number.isSafeInteger(after) || after < started || o.contract !== LOCAL_DELETE_SCOPE || o.profile !== UUID_DELETE_PROFILE || o.providerPredicate !== "account-uuid-only" || o.writeFence !== null
        || appleDigest(o.binding) !== appleDigest(evidence.request.binding) || o.policySha256 !== evidence.request.policySha256 || o.authorizationId !== evidence.request.authorizationId || o.scopeSha256 !== evidence.request.scopeSha256
        || o.accountRevision !== admitted.accountRevision || o.writerManifestSha256 !== manifest || o.writerCatalogSha256 !== catalog) throw Error("local_binding");
      const observedAt = instant(o.observedAt), validUntil = instant(o.validUntil);
      if (observedAt > after || after - observedAt > admitted.maxObservationAgeMs || validUntil <= after || validUntil < observedAt || validUntil > Math.min(instant(admitted.expiresAt), instant(evidence.request.binding.leaseUntil))) throw Error("local_expired");
      const denial = appleExact(o.denial, ["accountState", "custodyGate", "ordinaryOwnerWrites", "allowedOriginalProgress", "durability", "barrierRevision", "unknownWriters"]);
      if (denial.accountState !== "deletion_pending" || !["closed", "deletion_reserved"].includes(String(denial.custodyGate)) || denial.ordinaryOwnerWrites !== "denied" || denial.allowedOriginalProgress !== "same-original-only"
        || denial.durability !== "persisted-until-original-resolution" || denial.unknownWriters !== 0) throw Error("denial_unavailable");
      const expires = Math.min(instant(evidence.binding.validUntil), validUntil, observedAt + admitted.maxObservationAgeMs);
      if (expires <= after) throw Error("scope_expired");
      const proof: Extract<UuidAuthScopeProof, { outcome: "allowed" }> = freeze({ outcome: "allowed", profile: UUID_DELETE_PROFILE, providerPredicate: "account-uuid-only", strongWriteFence: null,
        accountRevision: admitted.accountRevision, binding: { ...evidence.binding, validUntil: new Date(expires).toISOString(), evidenceSha256: appleDigest([UUID_DELETE_PROFILE, evidence.request, evidence.observation, value]) }, coverage: evidence.coverage,
        localDenial: { evidenceSha256: appleDigest([LOCAL_DELETE_SCOPE, evidence.request, value]), writerManifestSha256: manifest, writerCatalogSha256: catalog, barrierRevision: positive(denial.barrierRevision) } });
      issued.add(proof); return proof;
    } catch { return { outcome: "held" }; }
  };
}
