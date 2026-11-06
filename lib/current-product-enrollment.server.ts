import { createHash } from "node:crypto";
import { isProxy } from "node:util/types";
import { referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import type { ProviderReadinessResult } from "./current-provider-readiness.server.ts";

export const PRODUCT_ENROLLMENT_V2 = "wd-product-configuration-enrollment-v2" as const;
const WEEK = "com.wisedinner.app.protein.weekly", YEAR = "com.wisedinner.app.protein.yearly";
export type ProductEnrollmentDescriptorV2 = Readonly<{
  contract: typeof PRODUCT_ENROLLMENT_V2; enrollmentId: string; project: "zpvqxtklvjitofpbddrn";
  origin: "https://zpvqxtklvjitofpbddrn.supabase.co"; bundleId: "com.wisedinner.app";
  revenueCatProjectId: string; revenueCatAppId: string; store: "app_store";
  environment: "SANDBOX" | "PRODUCTION"; region: "USA";
  weeklyProductId: typeof WEEK; weeklyPriceCents: 400; yearlyProductId: typeof YEAR; yearlyPriceCents: 14900;
  entitlementId: "wisedinner_pro"; subscriberReadKeySha256: string;
  acceptanceRecordSha256: string; provenanceManifestSha256: string;
  notBefore: number; notAfter: number | null;
}>;
export type ProductEnrollmentExpectationV2 = Readonly<{ descriptorSha256: string; acceptanceRecordSha256: string }>;
export type CheckedProductEnrollmentV2 = Readonly<{ descriptor: ProductEnrollmentDescriptorV2; descriptorSha256: string }>;
const issued = new WeakSet<object>();
const HASH = /^[a-f0-9]{64}$/;
function exact(value: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("product_enrollment_held");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(k => typeof k !== "string") || Object.keys(descriptors).sort().join() !== [...keys].sort().join() || Object.values(descriptors).some(d => !("value" in d) || !d.enumerable)) throw Error("product_enrollment_held");
  return Object.fromEntries(Object.entries(descriptors).map(([k, d]) => [k, d.value]));
}
const fields = ["contract", "enrollmentId", "project", "origin", "bundleId", "revenueCatProjectId", "revenueCatAppId", "store", "environment", "region", "weeklyProductId", "weeklyPriceCents", "yearlyProductId", "yearlyPriceCents", "entitlementId", "subscriberReadKeySha256", "acceptanceRecordSha256", "provenanceManifestSha256", "notBefore", "notAfter"] as const;
/** Trusted code supplies the independently accepted expectation, never a body or
 * environment-derived expected hash. This issues configuration, not observation. */
export function checkCurrentProductEnrollmentV2(value: unknown, compiledExpectation: unknown): CheckedProductEnrollmentV2 | null {
  try {
    const e = exact(compiledExpectation, ["descriptorSha256", "acceptanceRecordSha256"]), d = exact(value, fields);
    if (![e.descriptorSha256, e.acceptanceRecordSha256, d.subscriberReadKeySha256, d.acceptanceRecordSha256, d.provenanceManifestSha256].every(v => typeof v === "string" && HASH.test(v))) return null;
    if (d.contract !== PRODUCT_ENROLLMENT_V2 || d.project !== "zpvqxtklvjitofpbddrn" || d.origin !== "https://zpvqxtklvjitofpbddrn.supabase.co" || d.bundleId !== "com.wisedinner.app" || d.store !== "app_store" || d.region !== "USA"
      || (d.environment !== "SANDBOX" && d.environment !== "PRODUCTION") || d.weeklyProductId !== WEEK || d.yearlyProductId !== YEAR || d.weeklyPriceCents !== 400 || d.yearlyPriceCents !== 14900 || d.entitlementId !== "wisedinner_pro") return null;
    for (const key of ["enrollmentId", "revenueCatProjectId", "revenueCatAppId"] as const) if (typeof d[key] !== "string" || !/^[a-zA-Z0-9_.-]{1,128}$/.test(d[key] as string)) return null;
    if (!Number.isSafeInteger(d.notBefore) || Number(d.notBefore) < 0 || d.notAfter !== null && (!Number.isSafeInteger(d.notAfter) || Number(d.notAfter) <= Number(d.notBefore))) return null;
    if (d.acceptanceRecordSha256 !== e.acceptanceRecordSha256 || referenceConfigurationDigest(d) !== e.descriptorSha256) return null;
    const descriptor = Object.freeze(d) as ProductEnrollmentDescriptorV2;
    const checked = Object.freeze({ descriptor, descriptorSha256: e.descriptorSha256 as string }); issued.add(checked); return checked;
  } catch { return null; }
}
export function isCurrentProductEnrollmentV2(value: unknown, now: number): value is CheckedProductEnrollmentV2 {
  if (!value || typeof value !== "object" || !issued.has(value) || !Number.isSafeInteger(now) || now < 0) return false;
  const d = (value as CheckedProductEnrollmentV2).descriptor;
  return now >= d.notBefore && (d.notAfter === null || now < d.notAfter);
}
/** Actual configured key is compared quietly; no key or fingerprint is returned. */
export function productEnrollmentMatchesHost(value: unknown, input: Readonly<{ origin: unknown; environment: unknown; subscriberReadKey: unknown; readiness: unknown; now: number }>): boolean {
  try {
    if (!isCurrentProductEnrollmentV2(value, input.now) || typeof input.subscriberReadKey !== "string" || !input.subscriberReadKey) return false;
    const d = value.descriptor;
    if (input.origin !== d.origin || input.environment !== d.environment || createHash("sha256").update(input.subscriberReadKey).digest("hex") !== d.subscriberReadKeySha256) return false;
    // Compare configured semantics independently of dated product observations.
    const r = exact(input.readiness, ["version", "evaluatedAt", "environment", "region", "auth", "email", "subscription", "evidence"]);
    const s = exact(r.subscription, ["configured", "environment", "region", "weeklyProductId", "weeklyPriceCents", "yearlyProductId", "yearlyPriceCents", "entitlementId", "trial"]);
    return r.version === 2 && r.environment === d.environment.toLowerCase() && r.region === d.region && s.configured === true && s.environment === r.environment && s.region === d.region
      && s.weeklyProductId === d.weeklyProductId && s.yearlyProductId === d.yearlyProductId && s.weeklyPriceCents === d.weeklyPriceCents && s.yearlyPriceCents === d.yearlyPriceCents && s.entitlementId === d.entitlementId;
  } catch { return false; }
}
export function inspectProductAdmissionV2(value: unknown, readiness: ProviderReadinessResult, now: number) {
  return Object.freeze({ contract: PRODUCT_ENROLLMENT_V2, configuration: isCurrentProductEnrollmentV2(value, now) ? "enrolled" as const : "held" as const,
    // Preserve the original inspector's evidence level. Enrollment adds no kind.
    observation: readiness.subscription.status, purchase: readiness.subscription.purchase, trial: readiness.subscription.trial });
}

// Source-owned stable SANDBOX configuration, independently accepted by the root.
// This declaration follows checker dependencies to avoid a module-init TDZ.
// Enrollment does not admit a subscriber, purchase, trial or production release.
const compiledProductEnrollment = checkCurrentProductEnrollmentV2({
  "contract": "wd-product-configuration-enrollment-v2",
  "enrollmentId": "wd-sandbox-appstore-product-enrollment-20261106",
  "project": "zpvqxtklvjitofpbddrn",
  "origin": "https://zpvqxtklvjitofpbddrn.supabase.co",
  "bundleId": "com.wisedinner.app",
  "revenueCatProjectId": "2b0a1db8",
  "revenueCatAppId": "app8fbde20e05",
  "store": "app_store",
  "environment": "SANDBOX",
  "region": "USA",
  "weeklyProductId": "com.wisedinner.app.protein.weekly",
  "weeklyPriceCents": 400,
  "yearlyProductId": "com.wisedinner.app.protein.yearly",
  "yearlyPriceCents": 14900,
  "entitlementId": "wisedinner_pro",
  "subscriberReadKeySha256": "d0626edac5e74cc84a28a93aa7e5d1b1f043934e764733a1c8d266ffbe8d409f",
  "acceptanceRecordSha256": "049a226bec6a252d54a3a8fb51137124fad83a1c7b49a9de438d7fed19f6160c",
  "provenanceManifestSha256": "4df340ae116fff90476b8a8ddc3ddf5072632732602cdf68945dff116b96effb",
  "notBefore": 1793997356296,
  "notAfter": null
}, {
  "descriptorSha256": "eca765ef67832e3ef5e43896ab259e50a2fdc44c17117837068f4c0f5ef23959",
  "acceptanceRecordSha256": "049a226bec6a252d54a3a8fb51137124fad83a1c7b49a9de438d7fed19f6160c"
});
// A malformed compiled record must not silently select the legacy null path.
if (compiledProductEnrollment === null) throw Error("compiled_product_enrollment_invalid");
export const CURRENT_PRODUCT_ENROLLMENT_V2: CheckedProductEnrollmentV2 | null = compiledProductEnrollment;
