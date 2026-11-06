import { CURRENT_PRODUCT_ENROLLMENT_V2, productEnrollmentMatchesHost, type CheckedProductEnrollmentV2 } from "./current-product-enrollment.server.ts";
import {createCurrentIntegrationReferenceV11Async,CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY} from "./current-integration-reference-v11.server.ts";
import {createCurrentIntegrationReferenceV10,CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY} from "./current-integration-reference-v10.server.ts";
import { readCurrentBundledCapsule } from "./current-bundled-capsule.server.ts";
import { currentPrivateHostInputs, createCurrentLifecyclePrivateProducerForHost } from "./current-lifecycle-private-producer.server.ts";
import { withCurrentIntegrationPrivateConfiguration } from "./current-integration-configuration.server.ts";
import { isProxy } from "node:util/types";
import { AsyncLocalStorage } from "node:async_hooks";
import { gunzipSync } from "node:zlib";
import { createCurrentIntegrationRuntime, type CurrentIntegrationRuntimeDependencies, type CurrentIntegrationSource, type CurrentIntegrationSourceIdentity, CURRENT_INTEGRATION_ROUTES } from "./current-integration-runtime.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { createCurrentGuidePolicy, CURRENT_GUIDE_POLICY } from "./generated-current-guide-policy.ts";
import { referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { revenueCatProvider, supabaseBillingRepository } from "./billing.ts";
import { inspectCurrentProviderReadiness } from "./current-provider-readiness.server.ts";
import { createCurrentAccountLifecycle } from "./current-account-lifecycle.server.ts";
import { createCurrentIntegrationReferenceV5, CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY } from "./current-integration-reference-v5.server.ts";
import { createCurrentIntegrationReferenceV7, CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY } from "./current-integration-reference-v7.server.ts";
import { createCurrentIntegrationReferenceV9, CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY } from "./current-integration-reference-v9.server.ts";
import { resolveCurrentIntegrationLifecycleConfiguration } from "./current-integration-configuration.server.ts";
import { appleRead } from "./apple-token-custody.server.ts";

type Route = keyof typeof CURRENT_INTEGRATION_ROUTES;
export type CurrentIntegrationHostResolver = Readonly<{
  resolve(request: Request, route: Route): CurrentIntegrationRuntimeDependencies | Promise<CurrentIntegrationRuntimeDependencies>;
}>;
const resolvers = new AsyncLocalStorage<CurrentIntegrationHostResolver["resolve"]>();
// Cache only immutable prepared source per clock, never an owner, admission or
// access closure. Loading still happens after the runtime admits the request.
const preparedSources = new WeakMap<() => number, Map<string, CurrentIntegrationSource | Promise<CurrentIntegrationSource>>>();

/** Pure host construction. The accepted runtime owns issuer/bridge/engine,
 * request-local access, SQL fences, source leases and recovery. */
export function createCurrentIntegrationHost(deps: CurrentIntegrationRuntimeDependencies = {}) {
  return createCurrentIntegrationRuntime(deps);
}

/** Server-only async-context injection, not an endpoint or a global owner cache.
 * Tests and Main's later host adapter supply existing private ports here.
 * The default production path below always remains an actual maintained caller. */
export function withCurrentIntegrationHostResolver<T>(resolver: CurrentIntegrationHostResolver, work: () => T): T {
  if (!resolver || isProxy(resolver)) throw Error("host_resolver_invalid");
  const descriptor = Object.getOwnPropertyDescriptor(resolver, "resolve");
  if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "function") throw Error("host_resolver_invalid");
  const fn = descriptor.value;
  return resolvers.run((request, route) => Reflect.apply(fn, resolver, [request, route]), work);
}

/** The existing capsule is opened only by runtime.source.create after actual
 * owner admission. The accepted binder checks its opaque seal/bytes first.
 * No reseal, price refresh or new reference window is produced here. */
export function loadCurrentIntegrationHostSource(now: () => number = Date.now): CurrentIntegrationSource {
  const capsule = JSON.parse(readCurrentBundledCapsule("v4", import.meta.url));
  const binder = createReviewedCurrentSourceBinder(capsule, now);
  if (!binder.reviewedReferenceData) throw Error("host_source_unavailable");
  const source = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64"), { maxOutputLength: 11357534 }).toString("utf8");
  const guide = createCurrentGuidePolicy(source, capsule.configuration);
  return Object.freeze({ ...binder, reviewedReferenceData: binder.reviewedReferenceData,
    guidePolicy: Object.freeze({ version: CURRENT_GUIDE_POLICY, sha256: guide.sha256 }) });
}

// Documented private names only. No values are discovered until a request.
// JSON source identity is the exact reviewed opaque descriptor, not a new seal.
// Provider JSON is independently collected Main metadata, not a verification
// Boolean or a purchase grant. No lifecycle policy/fence is inferred from env.
export const CURRENT_INTEGRATION_HOST_CONFIG_NAMES = Object.freeze([
  "WD_CURRENT_INTEGRATION_HOST_ORIGIN", "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY",
  "WD_CURRENT_OWNER_API_ENABLED", "WD_CURRENT_OWNER_READ_API_ENABLED",
  "WD_REVENUECAT_CONFIGURATION_VERIFIED", "WD_BILLING_ENVIRONMENT", "REVENUECAT_SECRET_API_KEY",
  "WD_CURRENT_SOURCE_IDENTITY_JSON", "WD_CURRENT_PROVIDER_READINESS_JSON", "WD_CURRENT_REFERENCE_PROFILE",
  "REVENUECAT_SUBSCRIBER_READ_API_KEY",
] as const);
function configuration(value: unknown): Record<string, string | undefined> {
  if (!value || typeof value !== "object" || Array.isArray(value) || isProxy(value)) throw Error("host_configuration_invalid");
  const result: Record<string, string | undefined> = Object.create(null);
  for (const key of CURRENT_INTEGRATION_HOST_CONFIG_NAMES) {
    const field = Object.getOwnPropertyDescriptor(value, key);
    if (field && (!("value" in field) || field.value !== undefined && typeof field.value !== "string")) throw Error("host_configuration_invalid");
    result[key] = field?.value;
  }
  return result;
}
function json(value: string | undefined): unknown {
  if (!value || value.length > 131072) return undefined;
  try { return copyReferenceData(JSON.parse(value)); } catch { return undefined; }
}

/** Request-time adapter. It does not read files, invoke a provider, load a source
 * factory, authenticate an owner, or contact a configured target. Unknown
 * metadata leaves new-session/source/billing admission explicitly unavailable.
 * currentRead needs none of those mutation prerequisites. */
export function resolveCurrentIntegrationServerConfiguration(value: unknown, now: () => number = Date.now, request: typeof fetch = fetch, productEnrollment: CheckedProductEnrollmentV2 | null = CURRENT_PRODUCT_ENROLLMENT_V2): CurrentIntegrationRuntimeDependencies {
  try {
    const c = configuration(value), enabled = c.WD_CURRENT_OWNER_API_ENABLED === "true" && c.WD_REVENUECAT_CONFIGURATION_VERIFIED === "true";
    const origin = c.SUPABASE_URL ?? c.NEXT_PUBLIC_SUPABASE_URL;
    const publicAuthKey = c.SUPABASE_ANON_KEY ?? c.NEXT_PUBLIC_SUPABASE_ANON_KEY, serverCredential = c.SUPABASE_SERVICE_ROLE_KEY;
    const environment = c.WD_BILLING_ENVIRONMENT;
    const v5 = c.WD_CURRENT_REFERENCE_PROFILE === "wd-current-reference-v5";
    const v7 = c.WD_CURRENT_REFERENCE_PROFILE === "wd-current-reference-v7";
    const v11=c.WD_CURRENT_REFERENCE_PROFILE === "wd-current-reference-v11";
    const v10=c.WD_CURRENT_REFERENCE_PROFILE === "wd-current-reference-v10";
    const v9 = c.WD_CURRENT_REFERENCE_PROFILE === "wd-current-reference-v9";
    if (c.WD_CURRENT_REFERENCE_PROFILE !== undefined && !v5 && !v7 && !v9 && !v10 && !v11 && c.WD_CURRENT_REFERENCE_PROFILE !== "wd-current-reference-v4") throw Error("source_profile");
    const expected = v11 ? CURRENT_INTEGRATION_REFERENCE_V11_IDENTITY : v10 ? CURRENT_INTEGRATION_REFERENCE_V10_IDENTITY : v9 ? CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY : v7 ? CURRENT_INTEGRATION_REFERENCE_V7_IDENTITY : v5 ? CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY : json(c.WD_CURRENT_SOURCE_IDENTITY_JSON);
    if ((v5 || v7 || v9 || v10 || v11) && c.WD_CURRENT_SOURCE_IDENTITY_JSON !== undefined && referenceConfigurationDigest(json(c.WD_CURRENT_SOURCE_IDENTITY_JSON)) !== referenceConfigurationDigest(expected)) throw Error("source_identity");
    const rawReadiness = json(c.WD_CURRENT_PROVIDER_READINESS_JSON);
    // Evaluate expiry against the actual host clock; never refresh receipt
    // collectedAt/validUntil, scope, environment, product or offer observations.
    const providerReadiness = rawReadiness && typeof rawReadiness === "object" && !Array.isArray(rawReadiness)
      ? { ...rawReadiness, evaluatedAt: new Date(now()).toISOString() } : undefined;
    const projection = inspectCurrentProviderReadiness(providerReadiness);
    const readKey = c.REVENUECAT_SUBSCRIBER_READ_API_KEY ?? c.REVENUECAT_SECRET_API_KEY;
    const productsReady = productEnrollment === null
      ? projection.region === "USA" && projection.environment === environment?.toLowerCase() && projection.subscription.status === "externally_accepted"
      : productEnrollmentMatchesHost(productEnrollment, { origin, environment, subscriberReadKey: readKey, readiness: providerReadiness, now: now() });
    const subscription: CurrentIntegrationRuntimeDependencies["subscription"] = enabled && origin && serverCredential && readKey && productsReady && (environment === "SANDBOX" || environment === "PRODUCTION")
      ? { environment, config: { environment, entitlement: "wisedinner_pro", products: ["com.wisedinner.app.protein.weekly", "com.wisedinner.app.protein.yearly"] },
        repository: supabaseBillingRepository(origin, serverCredential, request), provider: revenueCatProvider(readKey, request) } : undefined;
    return {
      hostOrigin: c.WD_CURRENT_INTEGRATION_HOST_ORIGIN,
      flags: { currentSession: enabled, currentRead: c.WD_CURRENT_OWNER_READ_API_ENABLED === "true", appleCredential: false, deletion: false },
      ...(origin && publicAuthKey && serverCredential ? { supabase: { origin, publicAuthKey, serverCredential } } : {}),
      ...(enabled && expected && typeof expected === "object" && !Array.isArray(expected) ? {
        source: { expected: expected as CurrentIntegrationSourceIdentity, create: () => {
          const profile = v11 ? "v11" : v10 ? "v10" : v9 ? "v9" : v7 ? "v7" : v5 ? "v5" : "v4";
          let profiles = preparedSources.get(now);
          let source = profiles?.get(profile);
          if (!source) {
            if (!profiles) { profiles = new Map(); preparedSources.set(now, profiles); }
            if (v11) {
              const preparing = createCurrentIntegrationReferenceV11Async(now), cache = profiles;
              source = preparing; cache.set(profile, preparing);
              // Rejections retire only this preparation. A later admitted call
              // may retry pure local work; no pending/error is marked ready.
              void preparing.then(value => { if (cache.get(profile) === preparing) cache.set(profile, value); }, () => { if (cache.get(profile) === preparing) cache.delete(profile); });
            } else {
              source = v10 ? createCurrentIntegrationReferenceV10(now) : v9 ? createCurrentIntegrationReferenceV9(now) : v7 ? createCurrentIntegrationReferenceV7(now) : v5 ? createCurrentIntegrationReferenceV5(now) : loadCurrentIntegrationHostSource(now);
              profiles.set(profile, source);
            }
          }
          return source;
        } },
      } : {}),
      subscription, providerReadiness, now, request,
    };
  } catch { return {}; }
}

/** All four actual Next POST exports delegate here without cloning or consuming
 * their Request. Ports may be immutable; access/identity admissions are local to
 * each runtime request. Private lifecycle ports are resolved only for that request. */
export async function currentIntegrationHostPOST(route: Route, request: Request): Promise<Response> {
  const lifecycleRoute = route === "appleCredential" || route === "deletion";
  const closedLifecycle = async () => {
    const closed = createCurrentAccountLifecycle();
    const response = await (route === "appleCredential" ? closed.custody(request) : closed.deletion(request));
    response.headers.set("X-Content-Type-Options", "nosniff");
    return response;
  };
  const readUnavailable = (code: "current_owner_read_disabled" | "owner_read_unavailable") => Response.json(
    { contract: "wd-current-owner-read-v1", result: { outcome: "held", code } },
    { status: 503, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } },
  );
  try {
    const resolve = resolvers.getStore();
    const inputs = resolve ? undefined : currentPrivateHostInputs();
    const production = () => resolveCurrentIntegrationProductionConfiguration(inputs!.environment, request, route, inputs!.request, inputs!.now);
    const deps = resolve ? await resolve(request, route) : lifecycleRoute
      ? await withCurrentIntegrationPrivateConfiguration(createCurrentLifecyclePrivateProducerForHost(inputs!.environment,request,route==="deletion",inputs!.request,inputs!.now,inputs!.release),production)
      : await production();
    const host = createCurrentIntegrationHost(deps);
    if (lifecycleRoute && host.inspect().routes[route].state !== "configured") return closedLifecycle();
    const response = await host.routes[route](request);
    if (lifecycleRoute && response.status === 503) {
      // Only the exact outer runtime refusal lacks an original operation. Never
      // replace an admitted lifecycle receipt, including its unavailable503.
      try {
        const text = await appleRead(response.clone().body, 1024, request.signal);
        const contract = route === "appleCredential" ? "wd-apple-custody-v1" : "wd-account-deletion-v2";
        if (text === JSON.stringify({ contract, productionReady: false, result: { outcome: "held", code: "runtime_unavailable", retryAuthorized: false } })) return closedLifecycle();
      } catch { /* Preserve the original response when classification is uncertain. */ }
    }
    // The native read protocol has a deliberately minimal unavailable envelope.
    // Only503 is pre-read unavailability; original ACK/recovery evidence is on
    //200/409/499 and must pass through unchanged, without inspecting its body.
    if (route === "currentRead" && response.status === 503) return readUnavailable(
      host.inspect().routes.currentRead.state === "off" ? "current_owner_read_disabled" : "owner_read_unavailable",
    );
    return response;
  } catch {
    if (route === "currentRead") return readUnavailable("owner_read_unavailable");
    if (lifecycleRoute) return closedLifecycle();
    return createCurrentIntegrationHost().routes[route](request);
  }
}


/** Maintained default request path. Neither server configuration nor private
 * material grants lifecycle authority; the accepted adapter issues each original
 * from independent current facts. Read/session requests never load private keys. */
export async function resolveCurrentIntegrationProductionConfiguration(value: unknown, request: Request, route: Route, transport: typeof fetch = fetch, now: () => number = Date.now): Promise<CurrentIntegrationRuntimeDependencies> {
  const base = resolveCurrentIntegrationServerConfiguration(value, now, transport);
  if (route !== "appleCredential" && route !== "deletion") return base;
  const lifecycle = await resolveCurrentIntegrationLifecycleConfiguration(value, request, transport, now);
  return { ...base, ...(lifecycle ? { lifecycle, flags: { ...base.flags, appleCredential: true, deletion: true } } : {}) };
}

