import type { VerifiedAccount } from "./account.ts";
import { UUID } from "./generated-runtime-identity.ts";
import { issueLocalReferenceScopeV2, type LocalReferenceScope } from "./generated-plan-state.ts";
import { hash } from "../scripts/data/price-evidence.ts";

export type OwnerAccountState = Readonly<{ userId: string; state: "active" | "deletion_pending" | "deleted"; revision: number }>;
export type OwnerScopeDependencies = Readonly<{
  // Server-owned adapters only. The verifier must independently verify Auth,
  // and the reader must use that verified identity, not caller-supplied JSON.
  verify: (request: Request) => Promise<VerifiedAccount>;
  readAccount: (account: VerifiedAccount) => Promise<OwnerAccountState>;
}>;
export type VerifiedOwnerScope =
  | Readonly<{ outcome: "ready"; ownerId: string; accountRevision: number; storageKey: string; scope: LocalReferenceScope }>
  | Readonly<{ outcome: "denied"; code: "owner_session_invalid" | "owner_inactive" }>
  | Readonly<{ outcome: "held"; code: "owner_verification_unavailable" | "owner_store_unavailable" | "owner_state_invalid" | "owner_scope_unavailable" }>;
const issuedOwners = new WeakSet<object>();
// Provenance only. Callers must still recheck Auth/account/membership and SQL
// commit guards; this is not a cross-process or indefinitely fresh lease.
export function isIssuedVerifiedOwnerScope(value: unknown): value is Extract<VerifiedOwnerScope, { outcome: "ready" }> {
  return !!value && typeof value === "object" && issuedOwners.has(value);
}

// Server-only binding for the current catalog's existing V2 kernel. No endpoint
// or connection is opened here. A ready OWNER scope is not a catalog, membership,
// persistence, source-policy or nutritional grant. SQL must recheck the active
// owner/revision atomically at commit; process-local scope generations cannot
// establish hosted RLS or cross-process revocation.
export async function admitVerifiedReferenceOwner(request: Request, dependencies: OwnerScopeDependencies): Promise<VerifiedOwnerScope> {
  let account: VerifiedAccount;
  try {
    account = await dependencies.verify(request);
    if (!account || !UUID.test(account.id)) return Object.freeze({ outcome: "denied", code: "owner_session_invalid" });
  } catch (error) {
    const status = error && typeof error === "object" && "status" in error ? error.status : null;
    return Object.freeze(status === 401 || status === 403
      ? { outcome: "denied", code: "owner_session_invalid" }
      : { outcome: "held", code: "owner_verification_unavailable" });
  }
  let state: OwnerAccountState;
  try { state = await dependencies.readAccount(account); }
  catch { return Object.freeze({ outcome: "held", code: "owner_store_unavailable" }); }
  const ownerId = account.id.toLowerCase();
  if (!state || typeof state.userId !== "string" || state.userId.toLowerCase() !== ownerId) {
    return Object.freeze({ outcome: "held", code: "owner_state_invalid" });
  }
  if (state.state === "deletion_pending" || state.state === "deleted") return Object.freeze({ outcome: "denied", code: "owner_inactive" });
  if (state.state !== "active" || !Number.isSafeInteger(state.revision) || state.revision < 1) {
    return Object.freeze({ outcome: "held", code: "owner_state_invalid" });
  }
  // Stable across tokens and account revisions. Revision changes revoke older
  // in-process handles without moving or deleting the owner's saved namespace.
  // Distinct from every historical starter/installation/proposal namespace.
  const namespace = `wd-current-catalog-1300-v1/${ownerId}`;
  try {
    const scope = issueLocalReferenceScopeV2(namespace, state.revision);
    const storageKey = hash({ protocol: "joined-session-v2", namespace });
    const admitted = Object.freeze({ outcome: "ready" as const, ownerId, accountRevision: state.revision, storageKey, scope });
    issuedOwners.add(admitted);
    return admitted;
  } catch { return Object.freeze({ outcome: "held", code: "owner_scope_unavailable" }); }
}
