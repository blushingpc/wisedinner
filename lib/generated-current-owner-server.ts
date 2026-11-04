import { AccountError, object, supabaseAccountRepository, supabaseVerifier } from "./account.ts";
import { reconcileAccess, revenueCatProvider, supabaseBillingRepository, type BillingEnvironment } from "./billing.ts";
import { createCurrentOwnerIntegrationHandler, type CurrentOwnerServiceDependencies } from "./generated-current-owner-service.ts";
import { createCurrentOwnerSupabaseRpcDriver } from "./generated-current-rpc-driver.ts";

type CurrentOwnerServerConfiguration = Readonly<{
  enabled: boolean;
  supabaseUrl: string;
  publicAuthKey: string;
  serverRpcKey: string;
  revenueCatLookupKey: string;
  billingEnvironment: BillingEnvironment;
  bind: CurrentOwnerServiceDependencies["bind"];
  fetch?: typeof fetch;
  now?: () => number;
}>;
const products = ["com.wisedinner.app.protein.weekly", "com.wisedinner.app.protein.yearly"] as const;

// Explicit server composition using existing independently verifying adapters.
// No .env/key-store discovery, new endpoint or network request at construction.
// Enabling this private handler still needs reviewed source loading, target
// migration and a separately configured server transport before mobile use.
export function createCurrentOwnerServer(configuration: CurrentOwnerServerConfiguration) {
  if (configuration.enabled !== true) return async () => Response.json({ error: "current_owner_service_disabled", mode: "private-owner-integration-only", productionReady: false }, { status: 503, headers: { "Cache-Control": "no-store" } });
  if (!["PRODUCTION", "SANDBOX"].includes(configuration.billingEnvironment) || typeof configuration.bind !== "function"
    || !configuration.publicAuthKey || !configuration.revenueCatLookupKey) throw new AccountError(503, "current_owner_configuration_invalid");
  const fetcher = configuration.fetch ?? fetch, now = configuration.now ?? Date.now;
  // This constructor also pins the exact project and rejects other destinations.
  const rpc = createCurrentOwnerSupabaseRpcDriver(configuration.supabaseUrl, configuration.serverRpcKey, fetcher);
  const verify = supabaseVerifier(configuration.supabaseUrl, configuration.publicAuthKey, fetcher, now);
  const accounts = supabaseAccountRepository(configuration.supabaseUrl, configuration.publicAuthKey, fetcher);
  const billing = supabaseBillingRepository(configuration.supabaseUrl, configuration.serverRpcKey, fetcher);
  const provider = revenueCatProvider(configuration.revenueCatLookupKey, fetcher);
  return createCurrentOwnerIntegrationHandler({
    enabled: true, now, rpc,
    identity: {
      verify,
      async readAccount(account) {
        // The authenticated RPC independently derives auth.uid(), refuses an
        // inactive account and returns its own revision; no body owner is used.
        const row = object(await accounts.execute(account, { action: "read", body: {}, key: null }));
        if (Object.keys(row).sort().join() !== "preferences,revision" || !Number.isSafeInteger(row.revision) || (row.revision as number) < 1 || !row.preferences || typeof row.preferences !== "object" || Array.isArray(row.preferences)) throw new AccountError(503, "owner_state_invalid");
        return { userId: account.id, state: "active", revision: row.revision as number };
      },
    },
    access: owner => reconcileAccess(owner.ownerId, billing, provider, { environment: configuration.billingEnvironment, entitlement: "wisedinner_pro", products }, now()),
    bind: configuration.bind,
  });
}
