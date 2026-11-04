import { canonicalReferenceData } from "./generated-plan-data.ts";
import { isIssuedVerifiedOwnerScope, type VerifiedOwnerScope } from "./generated-owner-scope.ts";
import type { ReferenceEnvelopeV2, ReferenceStatePortV2, StoredReferenceOperationV2 } from "./generated-plan-state.ts";
import { hash } from "../scripts/data/price-evidence.ts";

type ReadyOwner = Extract<VerifiedOwnerScope, { outcome: "ready" }>;
type Action = "read_state" | "read_operation" | "commit";
export type CurrentOwnerRpcDriver = Readonly<{
  // Trusted server adapter to the reviewed RPC only. Opens no connection here.
  call(input: Readonly<{ ownerId: string; accountRevision: number; scopeKey: string; action: Action; body: Record<string, unknown>; accessExpiresAt?: number | null }>): Promise<unknown>;
}>;
const SHA = /^[a-f0-9]{64}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
function refuse(): never { throw new Error("Current owner state unavailable"); }
function copy<T>(value: T, limit = 8 * 1024 * 1024): T {
  const copied = canonicalReferenceData(value);
  if (Buffer.byteLength(JSON.stringify(copied), "utf8") > limit) refuse();
  return copied as T;
}
function object(value: unknown, fields: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join() !== fields) refuse();
  return value as Record<string, unknown>;
}
function revision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0 || value >= Number.MAX_SAFE_INTEGER) refuse();
  return value;
}
function envelope(value: unknown): ReferenceEnvelopeV2 {
  const data = object(copy(value), "current,draft,revision"); revision(data.revision);
  for (const key of ["current", "draft"]) if (data[key] !== null && (!data[key] || typeof data[key] !== "object" || Array.isArray(data[key]))) refuse();
  // The V2 repository independently decodes the complete stored V2 week/basis.
  return data as ReferenceEnvelopeV2;
}
function operation(value: unknown): StoredReferenceOperationV2 {
  const data = object(copy(value), "intentSha256,operationId,receipt");
  if (typeof data.operationId !== "string" || !UUID.test(data.operationId) || typeof data.intentSha256 !== "string" || !SHA.test(data.intentSha256)) refuse();
  const receipt = data.receipt as StoredReferenceOperationV2["receipt"];
  if (!receipt || receipt.operationId !== data.operationId) refuse();
  if (receipt.outcome === "acknowledged") {
    object(receipt, "committedSourcePolicyBasisSha256,operationId,outcome,state"); envelope(receipt.state);
    if (typeof receipt.committedSourcePolicyBasisSha256 !== "string" || !SHA.test(receipt.committedSourcePolicyBasisSha256)) refuse();
  } else if (receipt.outcome === "not_applied") {
    object(receipt, "operationId,outcome,result");
    if (!receipt.result || typeof receipt.result !== "object" || Array.isArray(receipt.result)) refuse();
  } else refuse();
  return data as StoredReferenceOperationV2;
}
function metadata(value: unknown): { revision: number; recordSha256: string } | null {
  if (value === null) return null;
  const meta = object(value, "recordSha256,revision");
  if (typeof meta.recordSha256 !== "string" || !SHA.test(meta.recordSha256)) refuse();
  return { revision: revision(meta.revision), recordSha256: meta.recordSha256 };
}

// Explicit V2 adapter, not a V1 cast. Reads across short RPC transactions must
// agree on one revision/digest. Commit is an atomic server-side CAS plus receipt.
// The SQL rechecks account lifecycle/revision at every call. This module is not
// an endpoint, paid-access grant, live catalog grant or deployment.
export function createCurrentOwnerRpcStatePort(driver: CurrentOwnerRpcDriver, owner: ReadyOwner): ReferenceStatePortV2 {
  if (!isIssuedVerifiedOwnerScope(owner) || typeof driver?.call !== "function") refuse();
  return Object.freeze({
    async transaction<T>(body: Parameters<ReferenceStatePortV2["transaction"]>[0]): Promise<T> {
      let active = true, committed = false, observed: ReferenceEnvelopeV2 | null | undefined;
      let baseline: ReturnType<typeof metadata> | undefined;
      const reads = new Map<string, StoredReferenceOperationV2 | null>();
      const check = (scope: string) => { if (!active || committed || scope !== owner.storageKey) refuse(); };
      const observe = (value: unknown) => {
        const meta = metadata(value);
        if (baseline !== undefined && hash(baseline) !== hash(meta)) refuse();
        baseline = meta; return meta;
      };
      const call = async (action: Action, payload: Record<string, unknown>) => {
        try { return copy(await driver.call({ ownerId: owner.ownerId, accountRevision: owner.accountRevision, scopeKey: owner.storageKey, action, body: copy(payload, 16 * 1024 * 1024) }), 16 * 1024 * 1024); }
        catch { return refuse(); }
      };
      try {
        return await body({
          async readState(scope) {
            check(scope);
            const reply = object(await call("read_state", {}), "meta,state"), meta = observe(reply.meta);
            const state = reply.state === null ? null : envelope(reply.state);
            if (state === null ? meta !== null : !meta || state.revision !== meta.revision || hash(state) !== meta.recordSha256) refuse();
            observed = state; return copy(state);
          },
          async readOperation(scope, id) {
            check(scope); if (typeof id !== "string" || !UUID.test(id)) refuse();
            const reply = object(await call("read_operation", { operationId: id }), "meta,operation,operationRecordSha256"); observe(reply.meta);
            const stored = reply.operation === null ? null : operation(reply.operation);
            if (stored === null ? reply.operationRecordSha256 !== null : stored.operationId !== id || hash(stored) !== reply.operationRecordSha256) refuse();
            reads.set(id, stored); return copy(stored);
          },
          async commit(scope, stateValue, operationValue) {
            check(scope);
            const state = envelope(stateValue), stored = operation(operationValue), previous = observed ?? { current: null, draft: null, revision: 0 };
            if (observed === undefined || !reads.has(stored.operationId) || reads.get(stored.operationId) !== null) refuse();
            if (stored.receipt.outcome === "acknowledged") {
              if (state.revision !== previous.revision + 1 || hash(envelope(stored.receipt.state)) !== hash(state)) refuse();
            } else if (hash(state) !== hash(copy(previous))) refuse();
            const reply = object(await call("commit", { operation: stored, expectedRevision: previous.revision, expectedRecordSha256: baseline?.recordSha256 ?? null, stateRecordSha256: hash(state), operationRecordSha256: hash(stored) }), "operation,operationRecordSha256,outcome");
            const confirmed = operation(reply.operation);
            if (!["committed", "known"].includes(reply.outcome as string) || hash(confirmed) !== reply.operationRecordSha256 || hash(confirmed) !== hash(stored)) refuse();
            committed = true;
          },
        }) as T;
      } finally { active = false; }
    },
  });
}
