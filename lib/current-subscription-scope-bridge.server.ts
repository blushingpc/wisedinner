import type { VerifiedAccount } from "./account.ts";
import { accessAt, reconcileAccess, type Access, type AccessState, type BillingConfig, type BillingProvider, type BillingRepository } from "./billing.ts";
import { admitVerifiedReferenceOwner, isIssuedVerifiedOwnerScope, type OwnerAccountState, type OwnerScopeDependencies } from "./generated-owner-scope.ts";
import type { CurrentOwnerServiceDependencies } from "./generated-current-owner-service.ts";

export type CurrentOwnerSubscriptionAccessInput = Readonly<{
  enabled: boolean; identity: OwnerScopeDependencies; repository: BillingRepository;
  provider: BillingProvider; config: BillingConfig; now?: () => number;
}>;
type Data = Record<string, unknown>;
const PRODUCTS = ["com.wisedinner.app.protein.weekly", "com.wisedinner.app.protein.yearly"] as const;
const STATES: readonly AccessState["state"][] = ["active", "trial", "expired", "revoked", "inactive", "unknown"];
const REASONS = new Set(["not_verified", "identity_review_required", "stale_provider_response", "no_entitlement", "product_unverified", "environment_or_store_mismatch", "ownership_review_required", "period_unverified", "provider_refund", "expiry_unverified", "transaction_unverified", "provider_verified", "provider_expired", "malformed_provider_state", "transaction_owner_review_required"]);
const NO_ACCESS: Access = Object.freeze({ state: "unknown", expiresAt: null, observedAt: 0, reason: "not_verified", allowed: false, rerollsIncluded: false, stale: false });

function data(value: unknown): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_input");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(k => !("value" in descriptors[k as string]))) throw Error("invalid_input");
  return Object.fromEntries(Object.entries(descriptors).map(([k, d]) => [k, d.value]));
}
function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) throw Error("invalid_input");
  const descriptors = Object.getOwnPropertyDescriptors(value), length = Object.getOwnPropertyDescriptor(value, "length")?.value;
  if (!Number.isSafeInteger(length) || length < 0 || length > max || Reflect.ownKeys(descriptors).some(k => !("value" in descriptors[k as string]))) throw Error("invalid_input");
  const result: string[] = [];
  for (let i = 0; i < length; i++) { const entry = Object.getOwnPropertyDescriptor(value, String(i)); if (!entry || !("value" in entry) || typeof entry.value !== "string") throw Error("invalid_input"); result.push(entry.value); }
  return result;
}
function method<T extends object, K extends keyof T>(port: T, key: K, receiver: object = port): T[K] {
  const raw = data(port);
  if (!Object.hasOwn(raw, key)) throw Error("invalid_input");
  const fn = raw[key as string]; if (typeof fn !== "function") throw Error("invalid_input");
  const descriptors = Object.getOwnPropertyDescriptors(fn);
  if (Reflect.ownKeys(descriptors).some(k => !("value" in descriptors[k as string]))) throw Error("invalid_input");
  return ((...args: unknown[]) => Reflect.apply(fn, receiver, args)) as T[K];
}
function verified(value: VerifiedAccount): VerifiedAccount {
  const v = data(value), providers = strings(v.providers, 100);
  if (typeof v.id !== "string" || typeof v.token !== "string" || v.authenticatedAt !== null && (!Number.isSafeInteger(v.authenticatedAt) || (v.authenticatedAt as number) < 0)) throw Error("invalid_identity");
  // Keep the original verifier's token and Auth context for readAccount. None
  // is returned to the caller, and a mutable adapter result cannot switch IDs.
  Object.freeze(providers);
  return Object.freeze({ id: v.id, token: v.token, authenticatedAt: v.authenticatedAt as number | null, providers });
}
function accountState(value: OwnerAccountState): OwnerAccountState {
  const v = data(value);
  if (typeof v.userId !== "string" || typeof v.state !== "string" || !["active", "deletion_pending", "deleted"].includes(v.state) || !Number.isSafeInteger(v.revision) || (v.revision as number) < 1) throw Error("invalid_identity");
  return Object.freeze({ userId: v.userId, state: v.state as OwnerAccountState["state"], revision: v.revision as number });
}

/** One port per original request. Main's parent must construct this inside its
 * request factory, never cache it as a constructor-global current-owner port.
 * No route, body read, provider discovery, environment read or I/O occurs here.
 */
export function createCurrentOwnerSubscriptionAccess(request: Request, input: CurrentOwnerSubscriptionAccessInput): CurrentOwnerServiceDependencies["access"] {
  let captured: Readonly<{ identity: OwnerScopeDependencies; repository: BillingRepository; provider: BillingProvider; config: BillingConfig; now: () => number }>;
  try {
    if (!(request instanceof Request)) return async () => NO_ACCESS;
    const raw = data(input); if (raw.enabled !== true) return async () => NO_ACCESS;
    if (["enabled", "identity", "repository", "provider", "config"].some(key => !Object.hasOwn(raw, key))) return async () => NO_ACCESS;
    // Only this validated own-data snapshot supplies fields after admission.
    // The original object is retained solely as the optional clock receiver.
    const d = raw as CurrentOwnerSubscriptionAccessInput, config = data(d.config), products = strings(config.products, 2);
    if ((config.environment !== "PRODUCTION" && config.environment !== "SANDBOX") || config.entitlement !== "wisedinner_pro" || products.length !== 2 || new Set(products).size !== 2 || PRODUCTS.some(p => !products.includes(p))) return async () => NO_ACCESS;
    const verify = method(d.identity, "verify"), readAccount = method(d.identity, "readAccount");
    const identity: OwnerScopeDependencies = Object.freeze({
      async verify(r) { try { return verified(await verify(r)); } catch { throw Error("owner_verification_unavailable"); } },
      async readAccount(a) { try { return accountState(await readAccount(a)); } catch { throw Error("owner_store_unavailable"); } },
    });
    captured = Object.freeze({ identity,
      repository: Object.freeze({ bind: method(d.repository, "bind"), begin: method(d.repository, "begin"), commit: method(d.repository, "commit"), enqueue: method(d.repository, "enqueue") }),
      provider: Object.freeze({ fetch: method(d.provider, "fetch") }),
      config: Object.freeze({ environment: config.environment, entitlement: config.entitlement, products: Object.freeze(products) }),
      now: !Object.hasOwn(raw, "now") || raw.now === undefined ? Date.now : method(d, "now", input)!,
    });
  } catch { return async () => NO_ACCESS; }
  const clock = () => { const now = captured.now(); if (!Number.isSafeInteger(now) || now < 0) throw Error("invalid_clock"); return now; };
  return async owner => {
    if (!isIssuedVerifiedOwnerScope(owner) || request.signal.aborted) return NO_ACCESS;
    try {
      const before = clock();
      const matches = (fresh: Awaited<ReturnType<typeof admitVerifiedReferenceOwner>>) => isIssuedVerifiedOwnerScope(fresh)
        && fresh.ownerId === owner.ownerId && fresh.accountRevision === owner.accountRevision && fresh.storageKey === owner.storageKey;
      if (!matches(await admitVerifiedReferenceOwner(request, captured.identity)) || request.signal.aborted) return NO_ACCESS;
      // Exactly one call to the reviewed engine; its SQL generation, active
      // account, transaction ownership and commit fences remain authoritative.
      const result = await reconcileAccess(owner.ownerId, captured.repository, captured.provider, captured.config, before);
      if (!matches(await admitVerifiedReferenceOwner(request, captured.identity)) || request.signal.aborted) return NO_ACCESS;
      const after = clock(), value = data(result);
      if (after < before || typeof value.state !== "string" || !STATES.includes(value.state as AccessState["state"])
        || value.expiresAt !== null && (!Number.isSafeInteger(value.expiresAt) || (value.expiresAt as number) < 0)
        || !Number.isSafeInteger(value.observedAt) || (value.observedAt as number) < 0 || (value.observedAt as number) > after
        || typeof value.reason !== "string" || !REASONS.has(value.reason) || value.stale !== false) return NO_ACCESS;
      // The same engine's expiry projection is evaluated at return time too.
      // Stale cached access never satisfies the current-owner write gate.
      const access = accessAt({ state: value.state as AccessState["state"], expiresAt: value.expiresAt as number | null, observedAt: value.observedAt as number, reason: value.reason }, after);
      if (access.allowed && (access.reason !== "provider_verified" || after - access.observedAt > 300000)) return NO_ACCESS;
      return Object.freeze({ state: access.state, expiresAt: access.expiresAt, observedAt: access.observedAt, reason: access.reason, allowed: access.allowed, rerollsIncluded: access.rerollsIncluded, stale: access.stale });
    } catch { return NO_ACCESS; }
  };
}
