import { randomUUID } from "node:crypto";
import { AccountError, UUID, boundedJson, keys, object } from "./account.ts";
import type { VerifiedAccount } from "./account.ts";

// Server-internal only. No route, provider operation or configured live proof adapter.
// The adapter must verify ORIGINAL store lineage, both owners and revocation independently.
// TRANSFER/SDK/cache/login hints, latest renewal IDs and client 'verified' assertions are not proof.
export type RestoreScope = { environment: "PRODUCTION" | "SANDBOX"; app: string; product: string; entitlement: string };
export type RestoreIntent = RestoreScope & { operation: string; targetBinding: string; createdAt: number; expiresAt: number; status: string; attempt: number };
export type RestoreRepository = { execute(action: string, body: Record<string, unknown>): Promise<Record<string, unknown>> };
export type RestoreProofAdapter = { observe(intent: Readonly<RestoreIntent>, mode: "inspect" | "reconcile", signal: AbortSignal): Promise<unknown> };
type Result = Record<string, unknown>;
const fields = ["operation", "sourceBinding", "targetBinding", "environment", "app", "store", "product", "entitlement", "sourceRoot", "targetRoot", "sourceTransaction", "targetTransaction", "originalPurchaseAt", "observedAt", "expiresAt", "ownership", "sourceRevoked", "state", "refunded"];
const hash = /^[a-f0-9]{64}$/, binding = /^wd_[a-f0-9-]{36}$/;
const age = 300000; // Existing provider-observation freshness bound, not a claim of store authenticity.
function scopeValid(scope: RestoreScope) {
  return ["PRODUCTION", "SANDBOX"].includes(scope.environment) && [scope.app, scope.product, scope.entitlement].every(x => typeof x === "string" && /^[A-Za-z0-9._-]{1,128}$/.test(x));
}
function intent(value: Result): RestoreIntent {
  if (typeof value.operation !== "string" || !UUID.test(value.operation) || typeof value.targetBinding !== "string" || !binding.test(value.targetBinding)
    || !scopeValid(value as RestoreScope) || !Number.isSafeInteger(value.createdAt) || !Number.isSafeInteger(value.expiresAt) || !Number.isSafeInteger(value.attempt)
    || !["pending", "held", "leased", "prepared", "completed"].includes(value.status as string)) throw new AccountError(503, "restore_intent_unavailable");
  // Freeze a projection, never provider/raw account data.
  return Object.freeze({ operation: value.operation, targetBinding: value.targetBinding, environment: value.environment, app: value.app, product: value.product, entitlement: value.entitlement, createdAt: value.createdAt, expiresAt: value.expiresAt, status: value.status, attempt: value.attempt }) as RestoreIntent;
}
function normalizedProof(raw: unknown, i: RestoreIntent, now: number): Result | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const descriptors = Object.getOwnPropertyDescriptors(raw);
  if (Reflect.ownKeys(raw).length !== fields.length || fields.some(k => !descriptors[k] || !Object.hasOwn(descriptors[k], "value"))) return null;
  const p: Result = Object.fromEntries(fields.map(k => [k, descriptors[k].value]));
  if (fields.some(k => ["object", "function", "undefined", "symbol"].includes(typeof p[k])) || p.operation !== i.operation || p.targetBinding !== i.targetBinding
    || p.environment !== i.environment || p.app !== i.app || p.product !== i.product || p.entitlement !== i.entitlement || p.store !== "app_store"
    || typeof p.sourceBinding !== "string" || !binding.test(p.sourceBinding) || p.ownership !== "PURCHASED" || p.refunded !== false || typeof p.sourceRevoked !== "boolean"
    || (p.sourceBinding !== i.targetBinding && !p.sourceRevoked) || !["active", "trial"].includes(p.state as string)
    || ["sourceRoot", "targetRoot", "sourceTransaction", "targetTransaction"].some(k => typeof p[k] !== "string" || !hash.test(p[k] as string)) || p.sourceRoot !== p.targetRoot
    || ["originalPurchaseAt", "observedAt", "expiresAt"].some(k => !Number.isSafeInteger(p[k]) || (p[k] as number) < 0)
    || (p.originalPurchaseAt as number) > (p.observedAt as number) || (p.observedAt as number) < i.createdAt || (p.observedAt as number) > now || now - (p.observedAt as number) > age || (p.expiresAt as number) <= now) return null;
  return p;
}

// This is a private caller seam, NOT an exported HTTP handler or public DTO. Target derives from verify().
export async function requestExplicitRestore(request: Request, operation: string, deps: {
  verify(request: Request): Promise<VerifiedAccount>; repository: RestoreRepository; scope: RestoreScope;
}): Promise<Result> {
  if (request.method !== "POST" || new URL(request.url).search || !UUID.test(operation) || !scopeValid(deps.scope)) throw new AccountError(400, "explicit_restore_required");
  const body = await boundedJson(request, 256); keys(body, ["intent"]);
  if (body.intent !== "restore") throw new AccountError(400, "explicit_restore_required");
  const account = await deps.verify(request);
  if (!UUID.test(account.id) || !account.providers.length || account.authenticatedAt === null) throw new AccountError(401, "verified_account_required");
  return deps.repository.execute("intent", { operation, target: account.id, ...deps.scope });
}

// Only read-only proof observation is offered. No method here can replay a vendor restore/purchase.
export async function reconcileExplicitRestore(operation: string, repository: RestoreRepository, adapter?: RestoreProofAdapter, now = () => Date.now()): Promise<Result> {
  if (!UUID.test(operation)) return { status: "held", reason: "intent_required" };
  let i: RestoreIntent;
  try { i = intent(await repository.execute("read", { operation })); } catch { return { status: "held", reason: "intent_unavailable" }; }
  if (i.status === "completed") return { status: "completed" };
  const lease = randomUUID();
  const claim = await repository.execute("claim", { operation, lease });
  if (claim.status !== "leased") return claim;
  const command = { operation, lease, attempt: claim.attempt };
  const hold = (reason: string) => repository.execute("hold", { ...command, reason });
  if (!adapter) return hold("proof_unavailable");
  let raw: unknown;
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    raw = await Promise.race([
      adapter.observe(i, i.attempt || i.status !== "pending" ? "reconcile" : "inspect", controller.signal),
      new Promise<never>((_resolve, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error("proof_timeout")); }, 8000); })
    ]);
  } catch { return hold("outcome_unknown"); }
  finally { if (timer) clearTimeout(timer); }
  let clock: number;
  try { clock = now(); } catch { return hold("proof_invalid"); }
  if (!Number.isSafeInteger(clock) || clock < 0) return hold("proof_invalid");
  let p: Result | null;
  try { p = normalizedProof(raw, i, clock); } catch { p = null; }
  if (!p) return hold("proof_invalid");
  const prepared = await repository.execute("prepare", { ...command, proof: p });
  if (prepared.status !== "prepared") return prepared;
  try { return await repository.execute("commit", command); }
  catch {
    // Uncertain commit: read its durable result, never assume failure or replay the external action.
    try { const read = object(await repository.execute("read", { operation })); if (read.status === "completed") return { status: "completed" }; return await hold("outcome_unknown"); }
    catch { return { status: "held", reason: "outcome_unknown" }; }
  }
}
