import { isProxy } from "node:util/types";
import { appleDigest, appleExact, appleHash } from "./apple-token-custody.server.ts";
import { inspectDeletionV2Policy, type DeletionV2Policy } from "./account-deletion-v2.server.ts";

export const UUID_RECEIPT_RPC = "wd_current_ephemeral_deletion_receipt_cleanup";
export const UUID_RECEIPT_CONTRACT = "wd-current-ephemeral-deletion-receipt-v1";
// This is correlation material, NOT scope, provider permission or admission.
export type CurrentUuidReceiptCleanupInput = Readonly<{
  userId: string; authOperationId: string; deletionOperationId: string; intentSha256: string; identityHash: string;
  workOwner: string; workAttempt: number; leaseUntil: string; accountRevision: number; policySha256: string;
}>;
export type CurrentUuidReceiptCleanupResult = Readonly<{ outcome: "held" | "unknown" }> | Readonly<{
  contract: typeof UUID_RECEIPT_CONTRACT; outcome: "cleared"; binding: CurrentUuidReceiptCleanupInput;
  removed: 0 | 1; remaining: 0; observedAt: string;
}>;
export type CurrentUuidReceiptCleanup = Readonly<{ clear(input: CurrentUuidReceiptCleanupInput): Promise<CurrentUuidReceiptCleanupResult> }>;
export type CurrentUuidReceiptCleanupConfiguration = Readonly<{
  policy: DeletionV2Policy; now: () => number; timeoutMs: number; maxObservationAgeMs: number;
  rpc(name: typeof UUID_RECEIPT_RPC, body: CurrentUuidReceiptCleanupInput & { policy: DeletionV2Policy }): Promise<unknown>;
}>;
const fields = ["userId", "authOperationId", "deletionOperationId", "intentSha256", "identityHash", "workOwner", "workAttempt", "leaseUntil", "accountRevision", "policySha256"];
const held = Object.freeze({ outcome: "held" } as const), unknown = Object.freeze({ outcome: "unknown" } as const);
function fail(): never { throw Error("receipt_cleanup_unavailable"); }
// Descriptor-only copy before any validator reads a value. Reject proxy traps too.
function copy(v: unknown, depth = 0): unknown {
  if (depth > 8 || isProxy(v)) fail();
  if (!v || typeof v !== "object") { if (["string", "number", "boolean"].includes(typeof v) || v === null) return v; fail(); }
  if (!Array.isArray(v) && ![Object.prototype, null].includes(Object.getPrototypeOf(v))) fail();
  const ds = Object.getOwnPropertyDescriptors(v);
  if (Reflect.ownKeys(ds).some(k => typeof k !== "string") || Object.values(ds).some(d => !("value" in d))) fail();
  if (Array.isArray(v)) {
    if (v.length > 64 || Object.keys(ds).length !== v.length + 1) fail();
    return Object.freeze(Array.from({ length: v.length }, (_, i) => copy(ds[String(i)]?.value, depth + 1)));
  }
  if (Object.keys(ds).length > 32) fail();
  return Object.freeze(Object.fromEntries(Object.entries(ds).map(([k, d]) => [k, copy(d.value, depth + 1)])));
}
function instant(v: unknown): number {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(v)) fail();
  const n = Date.parse(v), [y, m, d] = v.slice(0, 10).split("-").map(Number);
  if (!Number.isSafeInteger(n) || m < 1 || m > 12 || d < 1 || d > new Date(Date.UTC(y, m, 0)).getUTCDate() || Number(v.slice(11, 13)) > 23 || Number(v.slice(14, 16)) > 59 || Number(v.slice(17, 19)) > 59) fail();
  return n;
}
function positive(v: unknown, max = 2147483647): number { if (!Number.isSafeInteger(v) || Number(v) < 1 || Number(v) > max) fail(); return v as number; }
function binding(v: unknown): CurrentUuidReceiptCleanupInput {
  const b = appleExact(copy(v), fields);
  for (const k of ["userId", "authOperationId", "deletionOperationId", "workOwner"]) if (typeof b[k] !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(b[k] as string)) fail();
  for (const k of ["intentSha256", "identityHash", "policySha256"]) appleHash(b[k]);
  positive(b.workAttempt); positive(b.accountRevision); instant(b.leaseUntil);
  return b as CurrentUuidReceiptCleanupInput;
}
export function createCurrentUuidReceiptCleanup(configuration: CurrentUuidReceiptCleanupConfiguration): CurrentUuidReceiptCleanup {
  let policy: DeletionV2Policy | undefined, clock: (() => number) | undefined;
  let call: ((body: CurrentUuidReceiptCleanupInput & { policy: DeletionV2Policy }) => Promise<unknown>) | undefined;
  let timeout = 0, age = 0, policyHash = "";
  try {
    if (isProxy(configuration) || !configuration || ![Object.prototype, null].includes(Object.getPrototypeOf(configuration))) fail();
    const ds = Object.getOwnPropertyDescriptors(configuration), keys = ["policy", "now", "rpc", "timeoutMs", "maxObservationAgeMs"];
    if (Reflect.ownKeys(ds).some(k => typeof k !== "string" || !keys.includes(k)) || keys.some(k => !ds[k] || !("value" in ds[k]))) fail();
    const p = inspectDeletionV2Policy(copy(ds.policy.value));
    if (p.version !== "wd-owner-uuid-delete-v1") fail();
    policy = copy(p) as DeletionV2Policy; policyHash = appleDigest(policy);
    const now = ds.now.value, rpc = ds.rpc.value;
    if (typeof now !== "function" || typeof rpc !== "function" || isProxy(now) || isProxy(rpc)) fail();
    timeout = positive(ds.timeoutMs.value, 30000); age = positive(ds.maxObservationAgeMs.value, 30000);
    clock = () => Reflect.apply(now, configuration, []);
    call = body => Reflect.apply(rpc, configuration, [UUID_RECEIPT_RPC, body]);
  } catch { policy = undefined; }
  const capturedPolicy = policy, capturedClock = clock, capturedCall = call;
  return Object.freeze({ async clear(input: CurrentUuidReceiptCleanupInput): Promise<CurrentUuidReceiptCleanupResult> {
    let b: CurrentUuidReceiptCleanupInput, started: number;
    try {
      if (!capturedPolicy || !capturedClock || !capturedCall) return held;
      b = binding(input); started = capturedClock();
      if (!Number.isSafeInteger(started) || started < 0 || instant(b.leaseUntil) <= started || b.policySha256 !== policyHash) return held;
    } catch { return held; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const raw = await Promise.race([capturedCall(Object.freeze({ ...b, policy: capturedPolicy })), new Promise<never>((_, reject) => { timer = setTimeout(() => reject(Error("uncertain_ack")), timeout); })]);
      const after = capturedClock();
      if (!Number.isSafeInteger(after) || after < started || instant(b.leaseUntil) <= after) return unknown;
      const value = copy(raw);
      if (appleDigest(value) === appleDigest(held)) return held;
      const r = appleExact(value, ["contract", "outcome", "binding", "removed", "remaining", "observedAt"]);
      if (r.contract !== UUID_RECEIPT_CONTRACT || r.outcome !== "cleared" || ![0, 1].includes(r.removed as number) || r.remaining !== 0 || appleDigest(binding(r.binding)) !== appleDigest(b)) return unknown;
      const observed = instant(r.observedAt);
      if (observed < started - age || observed > after || after - observed > age) return unknown;
      return r as Extract<CurrentUuidReceiptCleanupResult, { outcome: "cleared" }>;
    } catch { return unknown; } finally { clearTimeout(timer); }
  } });
}
