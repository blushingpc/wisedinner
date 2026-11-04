export type ReadinessStatus = "configured" | "locally_verified" | "externally_accepted" | "pending" | "unsupported";
export type EvidenceKind = "email_domain" | "smtp_configuration" | "smtp_delivery" | "otp_session" | "native_callback" | "apple_sign_in" | "weekly_product" | "yearly_product" | "weekly_purchase" | "yearly_purchase" | "weekly_trial_eligibility" | "yearly_trial_eligibility";
export type ReadinessIssue = "invalid_input" | "invalid_timestamp" | "collector_unavailable" | "evidence_missing" | "evidence_stale" | "evidence_scope_mismatch" | "environment_mismatch" | "region_mismatch" | "product_mismatch" | "entitlement_mismatch" | "redirect_mismatch" | "native_scheme_mismatch" | "trial_unavailable" | "offer_mismatch";
type Environment = "production" | "sandbox" | "unknown";
type TrialStatus = "eligible" | "withheld" | "not_configured";
type Trial = Readonly<{ days: number | null; eligible: boolean | null; offerId: string | null; offerType: "free_trial" | "unknown" | null }>;
export type ProviderReadinessReceipt = Readonly<{
  kind: EvidenceKind; level: "local" | "external"; environment: Environment; region: string | null;
  productId: string | null; entitlementId: string | null; scopeSha256: string; evidenceSha256: string;
  collectorManifestSha256: string; collectedAt: string; validUntil: string;
  offerId?: string; trialDays?: number; offerType?: "free_trial" | "unknown"; eligibility?: "eligible" | "ineligible" | "unknown";
  // Typed for safe collector interchange only. Current source has no callback
  // implementation, so even these exact receipt fields cannot enable one.
  redirectFingerprint?: string; nativeScheme?: string;
}>;
export type ProviderReadinessConfig = Readonly<{
  version: 2; evaluatedAt: string; environment: Environment; region: string | null;
  auth: Readonly<{ environment: Environment; region: string | null; supabaseConfigured: boolean | null; otpFlow: "email_code" | "magic_link" | "unknown"; redirectFingerprint: string | null; expectedRedirectFingerprint: string | null; nativeScheme: string | null; expectedNativeScheme: string | null }>;
  email: Readonly<{ environment: Environment; region: string | null; provider: "supabase_smtp" | "resend_smtp" | "unknown"; domainConfigured: boolean | null; smtpConfigured: boolean | null; tlsMode: "implicit" | "starttls" | "unknown" }>;
  subscription: Readonly<{ configured: boolean | null; environment: Environment; region: string | null; weeklyProductId: string | null; weeklyPriceCents: number | null; yearlyProductId: string | null; yearlyPriceCents: number | null; entitlementId: string | null; trial: Readonly<{ weekly: Trial; yearly: Trial }> }>;
  evidence: Readonly<{ collectorManifestSha256: string | null; expectedCollectorManifestSha256: string | null; expectedScopeFingerprints: Readonly<Partial<Record<EvidenceKind, string>>>; receipts: readonly ProviderReadinessReceipt[] }>;
}>;
export type ProviderReadinessResult = Readonly<{
  version: 2; environment: Environment; region: "USA" | "unsupported";
  auth: Readonly<{ configuration: ReadinessStatus; otp: ReadinessStatus; callback: ReadinessStatus; apple: ReadinessStatus }>;
  email: Readonly<{ provider: "supabase_smtp" | "resend_smtp" | "unknown"; domain: ReadinessStatus; smtp: ReadinessStatus; delivery: ReadinessStatus }>;
  subscription: Readonly<{ status: ReadinessStatus; weekly: ReadinessStatus; yearly: ReadinessStatus; purchase: Readonly<{ weekly: ReadinessStatus; yearly: ReadinessStatus }>; trial: Readonly<{ weekly: TrialStatus; yearly: TrialStatus }>; products: Readonly<{ weeklyUsd: 4; yearlyUsd: 149; entitlement: "wisedinner_pro"; region: "USA" }> }>;
  evidence: Readonly<{ collector: "current" | "unavailable"; acceptedKinds: readonly EvidenceKind[] }>;
  issues: readonly ReadinessIssue[];
}>;
const HASH = /^[a-f0-9]{64}$/i, WEEKLY = "com.wisedinner.app.protein.weekly", YEARLY = "com.wisedinner.app.protein.yearly", ENTITLEMENT = "wisedinner_pro";
const KINDS: readonly EvidenceKind[] = ["email_domain", "smtp_configuration", "smtp_delivery", "otp_session", "native_callback", "apple_sign_in", "weekly_product", "yearly_product", "weekly_purchase", "yearly_purchase", "weekly_trial_eligibility", "yearly_trial_eligibility"];
type Data = Record<string, unknown>;
function own(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  try { const d = Object.getOwnPropertyDescriptor(value, key); return d && Object.hasOwn(d, "value") ? d.value : undefined; } catch { return undefined; }
}
function record(value: unknown): value is Data { return value !== null && typeof value === "object" && !Array.isArray(value); }
function iso(value: unknown): number | null {
  if (typeof value !== "string" || !/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d{3})?Z$/.test(value)) return null;
  const n = Date.parse(value), normalized = value.length === 20 ? value.slice(0, -1) + ".000Z" : value;
  return Number.isFinite(n) && new Date(n).toISOString() === normalized ? n : null;
}
function add(issues: ReadinessIssue[], issue: ReadinessIssue) { if (!issues.includes(issue)) issues.push(issue); }
function array(value: unknown): unknown[] | null {
  if (!Array.isArray(value)) return null;
  try {
    const n = own(value, "length"); if (!Number.isSafeInteger(n) || (n as number) < 0 || (n as number) > 100) return null;
    const out: unknown[] = [];
    for (let i = 0; i < (n as number); i++) { const d = Object.getOwnPropertyDescriptor(value, String(i)); if (!d || !Object.hasOwn(d, "value")) return null; out.push(d.value); }
    return out;
  } catch { return null; }
}
type Scope = { environment: unknown; region: "USA"; productId?: string; entitlementId?: string; offerId?: string; trialDays?: number; offerType?: string; eligibility?: string };
function state(kind: EvidenceKind, ev: unknown, scopes: unknown, receipts: unknown[], now: number, issues: ReadinessIssue[], scope: Scope): ReadinessStatus {
  const wanted = own(scopes, kind);
  if (typeof wanted !== "string" || !HASH.test(wanted)) { add(issues, "evidence_missing"); return "pending"; }
  const manifest = own(ev, "collectorManifestSha256");
  if (typeof manifest !== "string" || !HASH.test(manifest) || manifest !== own(ev, "expectedCollectorManifestSha256")) return "pending";
  let local = false;
  for (const r of receipts) {
    if (!record(r) || own(r, "kind") !== kind || own(r, "collectorManifestSha256") !== manifest) continue;
    const sh = own(r, "scopeSha256"), eh = own(r, "evidenceSha256");
    if (typeof sh !== "string" || !HASH.test(sh) || typeof eh !== "string" || !HASH.test(eh)) continue;
    if (sh !== wanted) { add(issues, "evidence_scope_mismatch"); continue; }
    const collected = iso(own(r, "collectedAt")), until = iso(own(r, "validUntil"));
    if (collected === null || until === null || collected > now || until <= now || until < collected) { add(issues, "evidence_stale"); continue; }
    const fields: [keyof Scope, ReadinessIssue][] = [["environment", "environment_mismatch"], ["region", "region_mismatch"], ["productId", "product_mismatch"], ["entitlementId", "entitlement_mismatch"], ["offerId", "offer_mismatch"], ["trialDays", "offer_mismatch"], ["offerType", "offer_mismatch"], ["eligibility", "trial_unavailable"]];
    let bad = false;
    for (const [key, issue] of fields) if (scope[key] !== undefined && own(r, key) !== scope[key]) { add(issues, issue); bad = true; }
    if (bad) continue;
    if (own(r, "level") === "external") return "externally_accepted";
    if (own(r, "level") === "local") local = true;
  }
  return local ? "locally_verified" : "pending";
}
function configuredState(kind: EvidenceKind, configured: boolean, valid: boolean, ev: unknown, scopes: unknown, receipts: unknown[], now: number, issues: ReadinessIssue[], scope: Scope): ReadinessStatus {
  if (!configured || !valid) return "pending";
  const wanted = own(scopes, kind); if (typeof wanted !== "string" || !HASH.test(wanted)) return "pending";
  return receipts.some(r => record(r) && own(r, "kind") === kind) ? state(kind, ev, scopes, receipts, now, issues, scope) : "configured";
}
function fallback(issues: ReadinessIssue[] = ["invalid_input"]): ProviderReadinessResult {
  return { version: 2, environment: "unknown", region: "unsupported", auth: { configuration: "pending", otp: "pending", callback: "unsupported", apple: "pending" },
    email: { provider: "unknown", domain: "pending", smtp: "pending", delivery: "pending" },
    subscription: { status: "pending", weekly: "pending", yearly: "pending", purchase: { weekly: "pending", yearly: "pending" }, trial: { weekly: "withheld", yearly: "withheld" }, products: { weeklyUsd: 4, yearlyUsd: 149, entitlement: "wisedinner_pro", region: "USA" } },
    evidence: { collector: "unavailable", acceptedKinds: [] }, issues };
}
function inspect(input: unknown): ProviderReadinessResult {
  const issues: ReadinessIssue[] = [];
  const now = iso(own(input, "evaluatedAt")); if (now === null) add(issues, "invalid_timestamp");
  // This private DTO was not accepted as a public wire. v1 is explicitly held
  // rather than allowing an aggregate trial to masquerade as product evidence.
  if (!record(input) || own(input, "version") !== 2) { add(issues, "invalid_input"); return fallback(issues); }
  const rawEnv = own(input, "environment"), env = rawEnv === "production" || rawEnv === "sandbox" ? rawEnv : "unknown";
  const region = own(input, "region") === "USA" ? "USA" : "unsupported";
  if (env === "unknown") add(issues, "environment_mismatch"); if (region !== "USA") add(issues, "region_mismatch");
  const auth = own(input, "auth"), email = own(input, "email"), sub = own(input, "subscription"), ev = own(input, "evidence");
  const rs = array(own(ev, "receipts")), scopes = own(ev, "expectedScopeFingerprints");
  const valid = rs !== null && record(scopes) && record(auth) && record(email) && record(sub) && record(ev);
  if (!valid) add(issues, "invalid_input");
  const manifest = own(ev, "collectorManifestSha256"), collector = typeof manifest === "string" && HASH.test(manifest) && manifest === own(ev, "expectedCollectorManifestSha256");
  if (!collector) add(issues, "collector_unavailable");
  const receipts = rs ?? [], time = now ?? 0, base: Scope = { environment: env, region: "USA" };
  const rootReady = valid && now !== null && env !== "unknown" && region === "USA";
  function sameScope(component: unknown) {
    const environmentMatches = env !== "unknown" && own(component, "environment") === env, regionMatches = region === "USA" && own(component, "region") === "USA";
    if (!environmentMatches) add(issues, "environment_mismatch"); if (!regionMatches) add(issues, "region_mismatch");
    return rootReady && environmentMatches && regionMatches;
  }
  const authScope = sameScope(auth), emailScope = sameScope(email), subScope = sameScope(sub);
  const authConfigured = authScope && own(auth, "supabaseConfigured") === true;
  const configuration: ReadinessStatus = authConfigured ? "configured" : "pending";
  const otp: ReadinessStatus = own(auth, "otpFlow") === "email_code" ? configuredState("otp_session", authConfigured, valid, ev, scopes, receipts, time, issues, base) : "unsupported";
  // Actual current source has numeric email_code and native Apple ID-token
  // sign-in. No input flag, unknown flow, scheme or receipt adds a mail callback.
  // A future implementation requires separately reviewed source support,
  // source pins, configured Auth, exact redirect/scheme and version admission.
  const callback: ReadinessStatus = "unsupported";
  const redirect = own(auth, "redirectFingerprint"), expectedRedirect = own(auth, "expectedRedirectFingerprint"), scheme = own(auth, "nativeScheme"), expectedScheme = own(auth, "expectedNativeScheme");
  if (redirect !== null && redirect !== undefined && (typeof redirect !== "string" || !HASH.test(redirect) || redirect !== expectedRedirect)) add(issues, "redirect_mismatch");
  if (scheme !== null && scheme !== undefined && (typeof scheme !== "string" || scheme !== expectedScheme)) add(issues, "native_scheme_mismatch");
  const apple = authConfigured ? state("apple_sign_in", ev, scopes, receipts, time, issues, base) : "pending";
  const pv = own(email, "provider"), provider = pv === "supabase_smtp" || pv === "resend_smtp" ? pv : "unknown";
  const domain = emailScope && provider !== "unknown" && own(email, "domainConfigured") === true;
  const tlsMode = own(email, "tlsMode");
  const smtp = emailScope && provider !== "unknown" && own(email, "smtpConfigured") === true && (tlsMode === "implicit" || tlsMode === "starttls");
  const domainStatus = configuredState("email_domain", domain, valid, ev, scopes, receipts, time, issues, base);
  const smtpStatus = configuredState("smtp_configuration", smtp, valid, ev, scopes, receipts, time, issues, base);
  const delivery = domain && smtp ? state("smtp_delivery", ev, scopes, receipts, time, issues, base) : "pending";
  const ent = own(sub, "entitlementId"), wc = own(sub, "weeklyProductId") === WEEKLY && own(sub, "weeklyPriceCents") === 400 && ent === ENTITLEMENT;
  const yc = own(sub, "yearlyProductId") === YEARLY && own(sub, "yearlyPriceCents") === 14900 && ent === ENTITLEMENT;
  if (!wc || !yc) { add(issues, "product_mismatch"); if (ent !== ENTITLEMENT) add(issues, "entitlement_mismatch"); }
  const subscriptionConfigured = subScope && own(sub, "configured") === true;
  const weeklyScope: Scope = { ...base, productId: WEEKLY, entitlementId: ENTITLEMENT }, yearlyScope: Scope = { ...base, productId: YEARLY, entitlementId: ENTITLEMENT };
  const weekly = configuredState("weekly_product", subscriptionConfigured && wc, valid, ev, scopes, receipts, time, issues, weeklyScope);
  const yearly = configuredState("yearly_product", subscriptionConfigured && yc, valid, ev, scopes, receipts, time, issues, yearlyScope);
  const weeklyPurchase = subscriptionConfigured && wc ? state("weekly_purchase", ev, scopes, receipts, time, issues, weeklyScope) : "pending";
  const yearlyPurchase = subscriptionConfigured && yc ? state("yearly_purchase", ev, scopes, receipts, time, issues, yearlyScope) : "pending";
  const trialInput = own(sub, "trial"), trialStates: Partial<Record<EvidenceKind, ReadinessStatus>> = {};
  function productTrial(product: "weekly" | "yearly", facts: boolean, scope: Scope): TrialStatus {
    const t = own(trialInput, product), days = own(t, "days");
    if (days === null || days === undefined) return "not_configured";
    const offerId = own(t, "offerId"), kind = product === "weekly" ? "weekly_trial_eligibility" : "yearly_trial_eligibility";
    if (!subscriptionConfigured || !facts || days !== 7 || own(t, "eligible") !== true || typeof offerId !== "string" || !/^[A-Za-z0-9._-]{1,128}$/.test(offerId) || own(t, "offerType") !== "free_trial") return "withheld";
    const status = state(kind, ev, scopes, receipts, time, issues, { ...scope, offerId, trialDays: 7, offerType: "free_trial", eligibility: "eligible" });
    trialStates[kind] = status; return status === "externally_accepted" ? "eligible" : "withheld";
  }
  const trial = { weekly: productTrial("weekly", wc, weeklyScope), yearly: productTrial("yearly", yc, yearlyScope) };
  if (trial.weekly !== "eligible" || trial.yearly !== "eligible") add(issues, "trial_unavailable");
  const status: ReadinessStatus = subscriptionConfigured && wc && yc ? weekly === "externally_accepted" && yearly === "externally_accepted" ? "externally_accepted" : weekly === "locally_verified" && yearly === "locally_verified" ? "locally_verified" : "configured" : "pending";
  const states: Partial<Record<EvidenceKind, ReadinessStatus>> = { otp_session: otp, native_callback: callback, apple_sign_in: apple, email_domain: domainStatus, smtp_configuration: smtpStatus, smtp_delivery: delivery, weekly_product: weekly, yearly_product: yearly, weekly_purchase: weeklyPurchase, yearly_purchase: yearlyPurchase, ...trialStates };
  return { version: 2, environment: env, region, auth: { configuration, otp, callback, apple }, email: { provider, domain: domainStatus, smtp: smtpStatus, delivery },
    subscription: { status, weekly, yearly, purchase: { weekly: weeklyPurchase, yearly: yearlyPurchase }, trial, products: { weeklyUsd: 4, yearlyUsd: 149, entitlement: "wisedinner_pro", region: "USA" } },
    evidence: { collector: collector ? "current" : "unavailable", acceptedKinds: KINDS.filter(k => states[k] === "externally_accepted") }, issues };
}
/** Pure projection of Main-collected metadata. Does not authenticate a collector,
 * perform provider I/O, establish entitlement, or activate a provider/route. */
export function inspectCurrentProviderReadiness(input: unknown): ProviderReadinessResult {
  try { return inspect(input); } catch { return fallback(); }
}
