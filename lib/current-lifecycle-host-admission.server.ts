import type { CurrentIntegrationRuntimeDependencies, CurrentLifecycleAdmission, CurrentLifecycleHandlers } from "./current-integration-runtime.server.ts";
import { createCurrentAccountLifecycle, type LifecycleAdmission } from "./current-account-lifecycle.server.ts";
import { createCurrentAuthScopePreflight, type CurrentAuthScopeDependencies, type ScopeAdmission } from "./current-auth-scope.server.ts";
import { createCurrentRetentionCleanup, createCurrentRetentionRpcPorts, type CurrentRetentionCleanupDependencies } from "./current-retention-cleanup.server.ts";
import { appleDigest, appleOrigin, appleText, appleRead, appleExact, appleUuid, appleIntent, appleEqual, APPLE_CUSTODY, inspectApplePolicy, type AppleClient } from "./apple-token-custody.server.ts";
import { inspectDeletionV2Policy, deletionRecoveryHash, deletionIntentHash, DELETION_V2 } from "./account-deletion-v2.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";

// Private server configuration, never an endpoint DTO or environment loader.
// Policies/targets/schema/eraser/freshness and the observer's maintained fence
// must come from independently admitted inputs. This module grants none of them.
export type CurrentLifecycleHostConfiguration = Readonly<{
  admission?: Omit<CurrentLifecycleAdmission, "preflight" | "cleanup">;
  scope?: CurrentAuthScopeDependencies;
  retention?: Pick<CurrentRetentionCleanupDependencies, "schemaSha256" | "eraserSha256" | "maxRecords" | "freshnessMs" | "clockSkewMs" | "readAdmission">;
}>;
type Port = NonNullable<CurrentIntegrationRuntimeDependencies["lifecycle"]>;
type Base = Omit<CurrentLifecycleAdmission, "preflight" | "cleanup">;
const held = Object.freeze({ outcome: "held" as const });
const unavailable = async () => { throw Error("lifecycle_not_configured"); };
const noClient: AppleClient = Object.freeze({ clientId: "", keys: unavailable, exchange: unavailable, revoke: unavailable });

function data<T extends object>(value: T): T {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("configuration");
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).some(k => typeof k !== "string" || !("value" in ds[k]))) throw Error("configuration");
  return Object.fromEntries(Object.entries(ds).map(([k, d]) => [k, d.value])) as T;
}
// Capture receiver and own function value once. Never touch fn.bind/name/length.
function method<T extends object, K extends keyof T>(receiver: T, key: K): T[K] {
  const fn = data(receiver)[key]; if (typeof fn !== "function") throw Error("configuration");
  return ((...args: unknown[]) => Reflect.apply(fn, receiver, args)) as T[K];
}
function keys(value: ReadonlyMap<string, Buffer> | undefined): ReadonlyMap<string, Buffer> {
  const result = new Map<string, Buffer>();
  if (value !== undefined) for (const [name, bytes] of Map.prototype.entries.call(value)) {
    if (typeof name !== "string" || !Buffer.isBuffer(bytes)) throw Error("configuration");
    // Builtin iterator reads the typed-array slots, not an overridden valueOf.
    result.set(name, Buffer.from([...Uint8Array.prototype.values.call(bytes)]));
  }
  return result;
}
function capture(value: Base): Base {
  const v = data(value); appleOrigin(v.origin); appleText(v.serverCredential, 16384);
  if (typeof v.enabled !== "boolean") throw Error("configuration");
  const r = v.repositories && data(v.repositories), client = v.client && data(v.client);
  return Object.freeze({ enabled: v.enabled, origin: v.origin, serverCredential: v.serverCredential, verify: method(value, "verify"),
    ...(v.request ? { request: method(value, "request") } : {}), ...(v.now ? { now: method(value, "now") } : {}),
    ...(r ? { repositories: Object.freeze({ apple: Object.freeze({ command: method(r.apple, "command") }), deletion: Object.freeze({ account: method(r.deletion, "account"), worker: method(r.deletion, "worker") }) }) } : {}),
    ...(client ? { client: Object.freeze({ clientId: client.clientId, keys: method(v.client!, "keys"), exchange: method(v.client!, "exchange"), revoke: method(v.client!, "revoke") }) } : {}),
    keyVersion: v.keyVersion, keyring: keys(v.keyring),
    ...(v.applePolicy !== undefined ? { applePolicy: copyReferenceData(v.applePolicy) as Base["applePolicy"] } : {}),
    ...(v.deletionPolicy !== undefined ? { deletionPolicy: copyReferenceData(v.deletionPolicy) as Base["deletionPolicy"] } : {}),
  });
}
function scopeSnapshot(value: CurrentAuthScopeDependencies): CurrentAuthScopeDependencies {
  const s = data(value);
  return Object.freeze({ enabled: s.enabled, ...(s.admission !== undefined ? { admission: copyReferenceData(s.admission) as ScopeAdmission } : {}),
    ...(s.observe ? { observe: method(value, "observe") } : {}), ...(s.now ? { now: method(value, "now") } : {}) });
}

export function createCurrentLifecycleHostAdapter(configuration?: CurrentLifecycleHostConfiguration): Port {
  let base: Base | undefined, scope: CurrentAuthScopeDependencies | undefined;
  let cleanup: ReturnType<typeof createCurrentRetentionCleanup> | undefined;
  let preflight = createCurrentAuthScopePreflight({});
  try {
    const c = data(configuration!);
    if (c.admission) base = capture(c.admission);
    if (base && c.scope && c.retention) {
      scope = scopeSnapshot(c.scope);
      const r = data(c.retention), deletionPolicy = inspectDeletionV2Policy(base.deletionPolicy), custodyPolicy = inspectApplePolicy(base.applePolicy);
      // Different policies cannot borrow each other's independently reviewed scope.
      if (!scope.admission || appleDigest(scope.admission.deletionPolicy) !== appleDigest(deletionPolicy) || appleDigest(scope.admission.custodyPolicy) !== appleDigest(custodyPolicy)) throw Error("policy_mismatch");
      const ports = createCurrentRetentionRpcPorts(base.origin, base.serverCredential, base.request);
      preflight = createCurrentAuthScopePreflight(scope);
      cleanup = createCurrentRetentionCleanup({ deletionPolicy, custodyPolicy, schemaSha256: r.schemaSha256, eraserSha256: r.eraserSha256,
        maxRecords: r.maxRecords, freshnessMs: r.freshnessMs, clockSkewMs: r.clockSkewMs,
        readAdmission: method(c.retention, "readAdmission"), repository: ports, eraseExpired: ports.eraseExpired,
        ...(base.now ? { clock: base.now } : {}) });
    }
  } catch { scope = undefined; cleanup = undefined; preflight = createCurrentAuthScopePreflight({}); }
  const original = base;
  // The actual scope decoder preserves its exact128-reference bound, parent
  // expiry, resolved-attempt and orphan semantics. No TTL/flag creates a fence.
  const scopedCleanup = Object.freeze({ async verify(input: Readonly<{ policySha256: string; now: number }>) {
    if (!cleanup || !scope?.admission) return held;
    try {
      const v = copyReferenceData(input) as typeof input;
      if (v.policySha256 !== appleDigest(scope.admission.deletionPolicy)) return held;
      if ((await preflight(scope.admission.target)).outcome !== "allowed") return held;
      return await cleanup.verify(v);
    } catch { return held; }
  } });
  function composed(value: Base): CurrentLifecycleAdmission {
    return Object.freeze({ ...capture(value), preflight, cleanup: scopedCleanup });
  }
  // Exposed host data is an independent snapshot; mutating it cannot change
  // captured original repositories, policy/key bytes or private scope inputs.
  let admission: CurrentLifecycleAdmission | undefined;
  try { if (original) admission = composed(original); } catch { /* off */ }
  return Object.freeze({ ...(admission ? { admission } : {}), create(supplied?: CurrentLifecycleAdmission): CurrentLifecycleHandlers {
    let current: CurrentLifecycleAdmission | undefined;
    try {
      if (original) {
        const candidate = supplied ? data(supplied) : original;
        if (candidate.origin !== original.origin || candidate.serverCredential !== original.serverCredential) throw Error("target_mismatch");
        // Override only current mutation material. Original identity/transport/
        // repository ports survive a missing policy/key/admission for status.
        current = composed({ ...original, enabled: candidate.enabled, client: candidate.client, keyVersion: candidate.keyVersion,
          keyring: candidate.keyring, applePolicy: candidate.applePolicy, deletionPolicy: candidate.deletionPolicy });
      }
    } catch { /* malformed complete ingress remains off, never evaluated */ }
    const actual = createCurrentAccountLifecycle(current ? { ...current, enabled: current.enabled === true, client: current.client ?? noClient,
      keyVersion: current.keyVersion ?? "", keyring: current.keyring ?? new Map(), applePolicy: current.applePolicy, deletionPolicy: current.deletionPolicy,
      preflight, cleanup: scopedCleanup } as LifecycleAdmission : undefined);
    const handle = (kind: keyof CurrentLifecycleHandlers) => async (request: Request): Promise<Response> => {
      try {
        // Count the ORIGINAL bytes while the accepted bounded/fatal UTF8 reader
        // decodes. Re-encoding decoded text loses a legal UTF8 BOM and cannot
        // establish the accepted Content-Length precondition.
        let bytes = 0;
        const counter = new TransformStream<Uint8Array, Uint8Array>({ transform(chunk, controller) { bytes += chunk.byteLength; controller.enqueue(chunk); } });
        const stream = request.clone().body;
        const body = data(parseReferenceJson(await appleRead(stream?.pipeThrough(counter) ?? null, kind === "custody" ? 32768 : 16384, request.signal)) as Record<string, unknown>);
        if (body.operation === "status") return await actual[kind](request);
        const a = scope?.admission;
        if (!current?.enabled || !a || !cleanup || !current.client || !current.keyVersion || current.keyring?.get(current.keyVersion)?.length !== 32
          || appleDigest(current.deletionPolicy) !== appleDigest(a.deletionPolicy) || appleDigest(current.applePolicy) !== appleDigest(a.custodyPolicy)) return await createCurrentAccountLifecycle()[kind](request);
        // Reject malformed public commands before configured() can erase any
        // retained credential. The accepted handlers still validate every DTO.
        const type = request.headers.get("content-type"), length = request.headers.get("content-length");
        if (request.method !== "POST" || (kind === "deletion" ? !/^application\/json(?:\s*;|\s*$)/i.test(type ?? "") : type?.split(";")[0].trim() !== "application/json")
          || !/^Bearer [^\s]+$/.test(request.headers.get("authorization") ?? "") || request.headers.has("content-encoding")) throw Error("invalid_request");
        if (kind === "deletion") {
          const lifecycle = request.headers.get("x-wd-deletion-lifecycle");
          if (new URL(request.url).search || lifecycle !== null && lifecycle !== "wd-prepared-retirement-v1") throw Error("invalid_request");
        }
        if (length !== null && (!(kind === "deletion" ? /^(0|[1-9]\d*)$/ : /^\d+$/).test(length)
          || kind === "deletion" && Number(length) > 16384 || Number(length) !== bytes)) throw Error("invalid_request");
        if (kind === "deletion") {
          const preparing = body.operation === "prepare";
          if (!preparing && body.operation !== "confirm" || body.contract !== DELETION_V2) throw Error("invalid_request");
          appleExact(body, ["contract", "operation", "operationId", "expectedAccountRevision", ...(preparing ? [] : ["intentSha256", "confirmation"])]);
          const id = appleUuid(body.operationId), revision = body.expectedAccountRevision;
          if (!Number.isSafeInteger(revision) || (revision as number) < 1) throw Error("invalid_revision");
          const recovery = deletionRecoveryHash(id, request.headers.get("x-wd-deletion-recovery") ?? "");
          if (deletionIntentHash(a.target.userId, id, revision as number, recovery, appleDigest(a.deletionPolicy)) !== a.target.intentSha256
            || !preparing && (body.intentSha256 !== a.target.intentSha256 || body.confirmation !== "DELETE MY ACCOUNT")) throw Error("intent_mismatch");
        } else {
          appleExact(body, ["contract", "operation", "operationId", "authorizationCode", "identityToken", "nonce"]);
          if (body.contract !== APPLE_CUSTODY || body.operation !== "exchange") throw Error("invalid_request");
          const id = appleUuid(body.operationId), nonce = appleUuid(body.nonce), code = appleText(body.authorizationCode, 4096), token = appleText(body.identityToken, 20480);
          if (!/^[\x21-\x7e]+$/.test(code) || !appleEqual(request.headers.get("x-wd-apple-intent-sha256") ?? "",
            appleIntent(a.target.userId, id, code, token, nonce, current.client.clientId, appleDigest(a.custodyPolicy)))) throw Error("invalid_request");
          deletionRecoveryHash(a.target.deletionOperationId, request.headers.get("x-wd-deletion-recovery") ?? "");
        }
        const operation = kind === "deletion" ? body.operationId : request.headers.get("x-wd-deletion-operation-id");
        if (operation !== a.target.deletionOperationId || request.headers.get("x-wd-deletion-intent-sha256") !== a.target.intentSha256) return await createCurrentAccountLifecycle()[kind](request);
        // Do not run retention erasure for an unverified/cross-owner caller.
        const owner = copyReferenceData(await current.verify(request)) as Awaited<ReturnType<Base["verify"]>>;
        if (owner.id !== a.target.userId) return await createCurrentAccountLifecycle()[kind](request);
        if (kind === "deletion" && body.operation === "confirm") {
          const now = (current.now ?? Date.now)() / 1000;
          if (owner.authenticatedAt === null || owner.authenticatedAt > now || now - owner.authenticatedAt > 300) throw Error("recent_auth_required");
        }
        return await actual[kind](request);
      } catch { return await createCurrentAccountLifecycle()[kind](request); }
    };
    return Object.freeze({ custody: handle("custody"), deletion: handle("deletion") });
  } });
}
