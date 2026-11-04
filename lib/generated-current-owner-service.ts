import { AccountError } from "./account.ts";
import type { Access } from "./billing.ts";
import { admitVerifiedReferenceOwner, type OwnerScopeDependencies, type VerifiedOwnerScope } from "./generated-owner-scope.ts";
import { createCurrentOwnerRpcStatePort, type CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";
import type { ReferenceStatePortV2 } from "./generated-plan-state.ts";

type Owner = Extract<VerifiedOwnerScope, { outcome: "ready" }>;
type Kernel = { handle(request: Request): Promise<Response>; readonly newWeekCommitBefore?: number };
export type CurrentOwnerServiceDependencies = Readonly<{
  enabled: boolean;
  identity: OwnerScopeDependencies;
  rpc: CurrentOwnerRpcDriver;
  access(owner: Owner): Promise<Access>;
  // Trusted current-source loader only; no client source/config/owner grants.
  bind(owner: Owner, transactions: ReferenceStatePortV2): Promise<Kernel | null>;
  now?: () => number;
}>;
const mutations = new Set(["installCurrent", "saveCurrent", "createWeekDraft", "cancelWeekDraft", "confirmNewWeek", "shoppingCheck", "saveReplacement"]);
const newPricedWeeks = new Set(["installCurrent", "saveCurrent", "createWeekDraft", "confirmNewWeek"]);
const operations = new Set([...mutations, "capabilities", "preparePantry", "evaluateJoined", "planJoined", "findReplacements", "previewReplacement", "confirmReplacement", "readCurrent", "operationStatus"]);
function response(code: string, status: number) {
  return Response.json({ error: code, mode: "private-owner-integration-only", productionReady: false }, { status, headers: { "Cache-Control": "no-store" } });
}
function currentAccess(access: Access, now: number) {
  return Number.isFinite(now) && access?.allowed === true && access.stale === false && ["active", "trial"].includes(access.state)
    && access.reason === "provider_verified" && Number.isSafeInteger(access.observedAt) && access.observedAt <= now
    && now - access.observedAt <= 300000 && Number.isSafeInteger(access.expiresAt) && access.expiresAt! > now;
}
async function ingress(request: Request) {
  const limit = 8 * 1024 * 1024, length = request.headers.get("content-length");
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") throw new AccountError(415, "json_required");
  if (length !== null && (!/^\d+$/.test(length) || Number(length) > limit)) throw new AccountError(413, "payload_too_large");
  const reader = request.body?.getReader(); if (!reader) throw new AccountError(400, "body_required");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const result = await reader.read(); if (result.done) break;
      size += result.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AccountError(413, "payload_too_large"); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = Buffer.concat(chunks);
  let parsed: unknown;
  try { parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new AccountError(400, "invalid_json"); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new AccountError(400, "invalid_shape");
  return { operation: (parsed as Record<string, unknown>).operation, bytes };
}

// Prepared private integration transport. Not mounted, deployed or a production
// acceptance contract. The kernel's original private V2 flags remain unchanged.
// Reads/recovery are available to verified active owners without requiring a
// current purchase; writes require fresh independently reconciled paid access.
export function createCurrentOwnerIntegrationHandler(deps: CurrentOwnerServiceDependencies) {
  return async (request: Request): Promise<Response> => {
    if (deps.enabled !== true) return response("current_owner_service_disabled", 503);
    if (request.method !== "POST") return response("method_not_allowed", 405);
    try {
      const owner = await admitVerifiedReferenceOwner(request, deps.identity);
      if (owner.outcome !== "ready") return response(owner.code, owner.outcome === "denied" ? 401 : 503);
      // Read only the operation for access routing. The exact original bytes,
      // including duplicate-key/integrity checks, still go to the V2 kernel.
      const body = await ingress(request);
      if (typeof body.operation !== "string" || !operations.has(body.operation)) return response("operation_not_supported", 400);
      const changing = mutations.has(body.operation), now = deps.now ?? Date.now;
      if (changing && !currentAccess(await deps.access(owner), now())) return response("verified_membership_required", 403);
      let accessExpiresAt: number | null = null;
      const port = createCurrentOwnerRpcStatePort({ call: input => deps.rpc.call({ ...input, accessExpiresAt: input.action === "commit" ? accessExpiresAt : null }) }, owner);
      const guarded: ReferenceStatePortV2 = { transaction: callback => port.transaction(tx => callback({ ...tx,
        async commit(...args) {
          if (!changing || request.signal.aborted) throw Error("Current commit unavailable");
          // Recheck after planning, immediately before the SQL account/CAS fence.
          const fresh = await admitVerifiedReferenceOwner(request, deps.identity);
          if (fresh.outcome !== "ready" || fresh.ownerId !== owner.ownerId || fresh.accountRevision !== owner.accountRevision
            || fresh.storageKey !== owner.storageKey || request.signal.aborted) throw Error("Current commit unavailable");
          const grant = await deps.access(fresh);
          if (!currentAccess(grant, now())) throw Error("Current commit unavailable");
          accessExpiresAt = grant.expiresAt;
          // Expired-reference rejection receipts are safe to persist without
          // creating a priced week. Only positive new-week commits need this
          // extra SQL lease, alongside the existing fresh membership lease.
          if (newPricedWeeks.has(body.operation as string) && args[2].receipt.outcome === "acknowledged" && sourceCommitBefore !== undefined) {
            if (!Number.isSafeInteger(sourceCommitBefore) || sourceCommitBefore <= now()) throw Error("Current source lease expired");
            accessExpiresAt = Math.min(accessExpiresAt!, sourceCommitBefore);
          }
          await tx.commit(...args);
        },
      })) };
      const kernel = await deps.bind(owner, guarded);
      if (!kernel) return response("reviewed_current_source_unavailable", 503);
      const sourceCommitBefore = kernel.newWeekCommitBefore;
      // Avoid teeing a request: a canceled oversized clone can wait forever for
      // its unconsumed sibling. Feed the exact bounded original bytes onward.
      const original = new Request(request.url, { method: "POST", headers: request.headers, body: body.bytes, signal: request.signal });
      const result = await kernel.handle(original);
      result.headers.set("Cache-Control", "no-store");
      return result;
    } catch (error) { return error instanceof AccountError ? response(error.message, error.status) : response("current_owner_service_unavailable", 503); }
  };
}
