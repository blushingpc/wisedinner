import { isProxy } from "node:util/types";
import type { ScopeObservationRequest } from "./current-auth-scope.server.ts";
import { CURRENT_AUTH_SCOPE } from "./current-auth-scope.server.ts";
import { LOCAL_DELETE_SCOPE } from "./current-uuid-auth-scope.server.ts";
import { appleHttp, appleOrigin, appleText, appleObject, appleExact, appleUuid, appleHash, appleDigest, inspectApplePolicy } from "./apple-token-custody.server.ts";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";

export type CurrentUuidScopeRpcPorts = Readonly<{
  observe(request: ScopeObservationRequest): Promise<unknown>;
  observeLocalDenial(request: ScopeObservationRequest): Promise<unknown>;
}>;
export type CurrentUuidScopeRpcConfiguration = Readonly<{
  origin: string; serverCredential: string;
  // Independently supplied private request binding, NOT a policy/admission grant.
  expectedRequest: ScopeObservationRequest;
  request?: typeof fetch; now?: () => number; timeoutMs?: number;
}>;
const TARGET = "https://zpvqxtklvjitofpbddrn.supabase.co", PROJECT = "zpvqxtklvjitofpbddrn";
const LIMIT = 65536, REQUEST_LIMIT = 16384;
const scopeFields = ["contract", "binding", "policySha256", "authorizationId", "scopeSha256", "observedAt", "validUntil", "accountRevision", "authGraphSha256", "catalogSha256", "storage", "application", "references", "engine", "providerOperations", "unclassifiedReferences", "writeFence"];
const localFields = ["contract", "profile", "providerPredicate", "binding", "policySha256", "authorizationId", "scopeSha256", "observedAt", "validUntil", "accountRevision", "writerManifestSha256", "writerCatalogSha256", "denial", "writeFence"];
const held = Object.freeze({ outcome: "held" });
function unavailable(): never { throw Error("uuid_scope_rpc_unavailable"); }
function instant(value: unknown): number {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) unavailable();
  const n = Date.parse(value), [y, m, d] = value.slice(0, 10).split("-").map(Number);
  if (!Number.isSafeInteger(n) || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate() || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) unavailable();
  return n;
}
function noProxies(value: unknown, depth = 0, state = { nodes: 0 }): void {
  if (++state.nodes > 512 || depth > 8 || isProxy(value)) unavailable();
  if (value && typeof value === "object") {
    const ds = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(ds).some(k => typeof k !== "string") || Object.values(ds).some(d => !("value" in d))) unavailable();
    for (const d of Object.values(ds)) noProxies(d.value, depth + 1, state);
  }
}
function exactRequest(value: unknown): ScopeObservationRequest {
  noProxies(value);
  const row = appleExact(copyReferenceData(value), ["binding", "policySha256", "authorizationId", "scopeSha256", "custodyPolicy", "custodyPolicySha256"]);
  const b = appleExact(row.binding, ["userId", "identityHash", "authOperationId", "deletionOperationId", "intentSha256", "workOwner", "workAttempt", "leaseUntil"]);
  for (const k of ["userId", "authOperationId", "deletionOperationId", "workOwner"]) appleUuid(b[k]);
  appleHash(b.identityHash); appleHash(b.intentSha256); instant(b.leaseUntil);
  if (!Number.isSafeInteger(b.workAttempt) || Number(b.workAttempt) < 1 || Number(b.workAttempt) > 2147483647) unavailable();
  appleHash(row.policySha256); appleUuid(row.authorizationId); appleHash(row.scopeSha256); appleHash(row.custodyPolicySha256);
  const policy = inspectApplePolicy(row.custodyPolicy);
  if (typeof policy.version !== "string" || appleDigest(policy) !== row.custodyPolicySha256) unavailable();
  return row as ScopeObservationRequest;
}
function bodyOf(value: unknown): string {
  // One detached, canonical whole-request serialization per invocation. The
  // original object is never changed or retained across the transport await.
  const body = JSON.stringify({ p_body: canonicalReferenceData(exactRequest(value)) });
  if (Buffer.byteLength(body) > REQUEST_LIMIT) unavailable();
  return body;
}
function serviceMaterial(value: unknown): { key: string; expiresAt: number } {
  // Same structural legacy service-JWT format as maintained private material.
  // This does NOT authenticate its signature or prove remote credential validity.
  const key = appleText(value, 16384), parts = key.split(".");
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) unavailable();
  const decode = (part: string): unknown => {
    const bytes = Buffer.from(part, "base64url"); if (bytes.toString("base64url") !== part) unavailable();
    return parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  };
  const h = appleObject(decode(parts[0])), c = appleObject(decode(parts[1]));
  if (h.alg !== "HS256" || h.typ !== "JWT" || Object.keys(h).some(k => !["alg", "typ", "kid"].includes(k)) || h.kid !== undefined && (typeof h.kid !== "string" || !h.kid || h.kid.length > 100)) unavailable();
  const signature = Buffer.from(parts[2], "base64url");
  if (signature.toString("base64url") !== parts[2] || signature.length !== 32 || c.role !== "service_role" || c.ref !== PROJECT || !Number.isSafeInteger(c.exp) || Number(c.exp) < 1 || !Number.isSafeInteger(Number(c.exp) * 1000)) unavailable();
  return { key, expiresAt: Number(c.exp) * 1000 };
}
/** Pure configured server transport. Returns facts/held, never deletion admission.
 * No ambient discovery, constructor clock/source/provider I/O, SQL, or retries.
 * The peer-owned local barrier is not presumed installed or effective. */
function createPorts(configuration: CurrentUuidScopeRpcConfiguration | undefined, sparse: boolean | "contact"): CurrentUuidScopeRpcPorts {
  let expectedBody: string | undefined, expected: ScopeObservationRequest | undefined;
  let key = "", expiresAt = 0, timeout = 3000, clock = Date.now, transport: typeof fetch = fetch;
  try {
    if (!configuration || isProxy(configuration)) unavailable();
    const row = appleObject(configuration), ds = Object.getOwnPropertyDescriptors(row);
    if (Reflect.ownKeys(ds).some(k => typeof k !== "string" || !["origin", "serverCredential", "expectedRequest", "request", "now", "timeoutMs"].includes(k)) || Object.values(ds).some(d => !d.enumerable)) unavailable();
    const origin = appleText(ds.origin?.value, 2048); if (origin !== TARGET || appleOrigin(origin) !== TARGET) unavailable();
    const material = serviceMaterial(ds.serverCredential?.value); key = material.key; expiresAt = material.expiresAt;
    expected = exactRequest(ds.expectedRequest?.value); expectedBody = bodyOf(expected);
    timeout = ds.timeoutMs?.value ?? 3000;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > 8000) unavailable();
    const fn = ds.request?.value ?? fetch, now = ds.now?.value ?? Date.now;
    if (typeof fn !== "function" || typeof now !== "function" || isProxy(fn) || isProxy(now)) unavailable();
    // Capture values and receiver, without touching fn.bind/name/length metadata.
    clock = () => Reflect.apply(now, configuration, []);
    transport = async (url, init) => {
      const response = await Reflect.apply(fn, configuration, [url, init]);
      if (!(response instanceof Response)) unavailable();
      if (response.status === 200 && response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") unavailable();
      return response;
    };
  } catch { expectedBody = undefined; expected = undefined; }
  const configuredBody = expectedBody, bound = expected;
  const call = (rpc: "wd_current_auth_scope_observe" | "wd_current_local_deletion_barrier" | "wd_current_sparse_auth_scope_observe" | "wd_current_sparse_local_deletion_barrier" | "wd_current_contact_auth_scope_observe" | "wd_current_contact_local_deletion_barrier", contract: string) => async (input: ScopeObservationRequest): Promise<unknown> => {
    try {
      if (!configuredBody || !bound) return held;
      const body = bodyOf(input); if (body !== configuredBody) return held;
      const started = clock(), lease = instant(bound.binding.leaseUntil);
      if (!Number.isSafeInteger(started) || started < 0 || lease <= started || expiresAt <= started) return held;
      const response = await appleHttp(TARGET + "/rest/v1/rpc/" + rpc, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" }, body }, transport, LIMIT, timeout);
      if (response.status !== 200) return held;
      const after = clock(); if (!Number.isSafeInteger(after) || after < started || lease <= after || expiresAt <= after) return held;
      const raw = copyReferenceData(parseReferenceJson(response.text)), o = appleExact(raw, contract === CURRENT_AUTH_SCOPE ? scopeFields : localFields);
      // Transport correspondence only. Full private schema/catalog/retention and
      // durable writer-denial semantics are checked by accepted UUID preflight.
      if (o.contract !== contract || appleDigest(o.binding) !== appleDigest(bound.binding) || o.policySha256 !== bound.policySha256 || o.authorizationId !== bound.authorizationId || o.scopeSha256 !== bound.scopeSha256) return held;
      const observed = instant(o.observedAt), until = instant(o.validUntil);
      if (observed > after || until <= after || until < observed || until > lease) return held;
      return raw;
    } catch { return held; }
  };
  return Object.freeze({ observe: call(sparse === "contact" ? "wd_current_contact_auth_scope_observe" : sparse ? "wd_current_sparse_auth_scope_observe" : "wd_current_auth_scope_observe", CURRENT_AUTH_SCOPE), observeLocalDenial: call(sparse === "contact" ? "wd_current_contact_local_deletion_barrier" : sparse ? "wd_current_sparse_local_deletion_barrier" : "wd_current_local_deletion_barrier", LOCAL_DELETE_SCOPE) });
}

export function createCurrentUuidScopeRpcPorts(configuration?: CurrentUuidScopeRpcConfiguration): CurrentUuidScopeRpcPorts {
  return createPorts(configuration, false);
}
/** Named closed alternative only. No caller RPC/URL/profile selector exists. */
export function createCurrentSparseUuidScopeRpcPorts(configuration?: CurrentUuidScopeRpcConfiguration): CurrentUuidScopeRpcPorts {
  return createPorts(configuration, true);
}
/** Closed current-confirmed-contact scope only; no public profile selector. */
export function createCurrentContactUuidScopeRpcPorts(configuration?: CurrentUuidScopeRpcConfiguration): CurrentUuidScopeRpcPorts {
  return createPorts(configuration, "contact");
}

