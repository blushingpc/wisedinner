import { createHash } from "node:crypto";

// Preparation only. This module has no credentials, provider client or write executor.
export const EMAIL_AUTH_TARGET = "zpvqxtklvjitofpbddrn";
export const EMAIL_AUTH_SOURCE_PINS = Object.freeze({
  backendCommit: "d8ec162d9328afd3b8c0b1b95aa7ab1731760713",
  appCommit: "b49f4a9e5c917fb294f0d157eddba440dcd2ab9d",
  backendAccount: "ffe836ee9db2ac11178168d579c1391d86318da19aa5956614c96595dbf4a86b",
  nativeSdk: "19a19e274c7355aac2354d1d80de4a54b29a567ca06526040f786c96fa293352",
  session: "1a38eabf3970c974850c3807c99756ad42311db2dc94ba1600ea0a6a9458c609",
  installedAuthSdk: "7552500e375665e28acf23fb552ccbf1ef11379afab15859b2f670f1ae9aee9f",
  authSdkVersion: "2.117.3",
});
const BEFORE_SHA = "5697760229a6ecae7251be9003557d5031486c1fb6588e80943fe67933e5104f";
export const EMAIL_AUTH_OWNED_FIELDS = Object.freeze([
  "mailer_otp_length", "mailer_otp_exp", "smtp_host", "smtp_port", "smtp_user",
  "smtp_admin_email", "smtp_sender_name", "mailer_subjects_confirmation",
  "mailer_subjects_magic_link", "mailer_templates_confirmation_content", "mailer_templates_magic_link_content",
]);
const GUARDS = ["external_email_enabled", "mailer_autoconfirm", "disable_signup", "external_apple_enabled",
  "external_google_enabled", "mailer_secure_email_change_enabled", "mailer_allow_unverified_email_sign_ins",
  "hook_send_email_enabled", "smtp_max_frequency", "rate_limit_email_sent", "rate_limit_otp",
  "security_captcha_enabled", "site_url", "uri_allow_list"];
const TEMPLATES = ["confirmation", "magic_link", "recovery", "email_change", "invite", "reauthentication"];
const UNOWNED_MAIL = ["recovery", "email_change", "invite", "reauthentication"];
type Scalar = string | number | boolean | null;
type Slot = { present: false } | { present: true; value: Scalar };
type Observation = {
  contract: string; project: string; observedAt: string; owned: Record<string, Slot>;
  guards: Record<string, Slot>; templateHashes: Record<string, string>;
  unownedMailHashes: Record<string, { template: string; subject: string }>;
  smtpPasswordState: "missing" | "null" | "empty" | "present-unverified";
};
type Json = Scalar | Json[] | { [key: string]: Json };
export class EmailAuthPlanError extends Error {
  constructor(code: string) { super(code); }
}
const refuse = (code: string): never => { throw new EmailAuthPlanError(code); };
const sha = (value: string) => createHash("sha256").update(value).digest("hex");

// Inspect own data descriptors before reading. No inherited fields, getters or sparse arrays.
function data(value: unknown, depth = 0, budget = { nodes: 0 }): Json {
  if (++budget.nodes > 1024 || depth > 8) return refuse("shape_bound");
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.length > 32768 || /\u0000/.test(value)) return refuse("string_bound");
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) return refuse("number_shape");
    return value;
  }
  if (!value || typeof value !== "object") return refuse("invalid_shape");
  const array = Array.isArray(value);
  if (Object.getPrototypeOf(value) !== (array ? Array.prototype : Object.prototype)) return refuse("prototype_shape");
  const keys = Reflect.ownKeys(value);
  if (keys.length > 128 || keys.some(k => typeof k !== "string" || ["__proto__", "constructor", "prototype"].includes(k))) return refuse("field_shape");
  const entries: [string, Json][] = [];
  for (const key of keys) {
    if (typeof key !== "string") return refuse("field_shape");
    if (array && key === "length") continue;
    const d = Object.getOwnPropertyDescriptor(value, key);
    if (!d || !("value" in d) || !d.enumerable) return refuse("descriptor_shape");
    entries.push([key, data(d.value, depth + 1, budget)]);
  }
  if (array) {
    if (entries.length !== value.length || entries.some(([k], i) => k !== String(i))) return refuse("array_shape");
    return entries.map(([, v]) => v);
  }
  return Object.fromEntries(entries.sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
}
export function canonicalEmailAuthData(value: unknown): string {
  const bytes = JSON.stringify(data(value));
  if (Buffer.byteLength(bytes, "utf8") > 131072) return refuse("payload_bound");
  return bytes;
}
function record(value: unknown, fields: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) return refuse("record_shape");
  const r = value as Record<string, unknown>;
  if (Object.keys(r).length !== fields.length || fields.some(k => !Object.hasOwn(r, k))) return refuse("field_shape");
  return r;
}
function scalar(value: unknown): Scalar {
  if (value === null || typeof value === "string" || typeof value === "boolean" || typeof value === "number") return value;
  return refuse("scalar_shape");
}
function slot(value: unknown): Slot {
  const r = record(value, typeof value === "object" && value !== null && Object.hasOwn(value, "value") ? ["present", "value"] : ["present"]);
  if (r.present === false && !Object.hasOwn(r, "value")) return { present: false };
  if (r.present === true && Object.hasOwn(r, "value")) return { present: true, value: scalar(r.value) };
  return refuse("slot_shape");
}
function slots(value: unknown, fields: readonly string[]): Record<string, Slot> {
  const r = record(value, fields);
  return Object.fromEntries(fields.map(k => [k, slot(r[k])]));
}
function digest(value: unknown): string {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/.test(value)) return refuse("hash_shape");
  return value;
}
function observation(input: unknown): Observation {
  const safe = data(input);
  const r = record(safe, ["contract", "project", "observedAt", "owned", "guards", "templateHashes", "unownedMailHashes", "smtpPasswordState"]);
  if (r.contract !== "wd-email-auth-observation-local-v1" || r.project !== EMAIL_AUTH_TARGET) return refuse("target_or_contract");
  if (typeof r.observedAt !== "string" || !/^2026-10-09T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(r.observedAt) || !Number.isFinite(Date.parse(r.observedAt))) return refuse("observation_time");
  const owned = slots(r.owned, EMAIL_AUTH_OWNED_FIELDS), guards = slots(r.guards, GUARDS);
  const hashes = record(r.templateHashes, TEMPLATES);
  const templateHashes = Object.fromEntries(TEMPLATES.map(k => [k, digest(hashes[k])]));
  const mail = record(r.unownedMailHashes, UNOWNED_MAIL);
  const unownedMailHashes = Object.fromEntries(UNOWNED_MAIL.map(k => {
    const h = record(mail[k], ["template", "subject"]);
    return [k, { template: digest(h.template), subject: digest(h.subject) }];
  }));
  for (const name of ["confirmation", "magic_link"]) {
    const body = owned["mailer_templates_" + name + "_content"];
    if (!body?.present || typeof body.value !== "string" || sha(body.value) !== templateHashes[name]) return refuse("template_correspondence");
  }
  for (const name of UNOWNED_MAIL) if (unownedMailHashes[name]?.template !== templateHashes[name]) return refuse("template_correspondence");
  const state = r.smtpPasswordState;
  if (state !== "missing" && state !== "null" && state !== "empty" && state !== "present-unverified") return refuse("secret_state");
  return { contract: r.contract, project: r.project, observedAt: r.observedAt, owned, guards, templateHashes, unownedMailHashes, smtpPasswordState: state };
}
export function parseEmailAuthObservation(bytes: string): Observation {
  if (typeof bytes !== "string" || Buffer.byteLength(bytes, "utf8") > 131072) return refuse("payload_bound");
  let value: unknown;
  try { value = JSON.parse(bytes); } catch { return refuse("json_shape"); }
  // Exact canonical representation also refuses duplicate keys and ambiguous encodings.
  if (canonicalEmailAuthData(value) !== bytes) return refuse("noncanonical_json");
  return observation(value);
}
function sources(value: unknown) {
  if (canonicalEmailAuthData(value) !== canonicalEmailAuthData(EMAIL_AUTH_SOURCE_PINS)) return refuse("source_drift");
}
function before(input: unknown): Observation {
  const value = observation(input);
  if (sha(canonicalEmailAuthData(value)) !== BEFORE_SHA) return refuse("before_drift");
  return value;
}
const SUBJECT = "Your WiseDinner sign-in code";
const BODY = "<h2>Your WiseDinner sign-in code</h2>\n<p>Enter this six-digit code in WiseDinner:</p>\n<p><strong>{{ .Token }}</strong></p>\n<p>This code expires in 10 minutes and can be used once. If you did not request it, ignore this email.</p>";
const CREDENTIAL = Object.freeze({
  kind: "existing-private-credential-reference", provider: "Resend",
  keyId: "8a83ae78-95d9-4b1e-90ab-f488453eab56", domain: "mail.wisedinner.com",
  path: "C:/Users/borgh/AppData/Local/WiseDinner/secrets/auth-mail/resend-sending.dpapi",
});
const HOLDS = Object.freeze([
  "isolated-owned-auth-and-shared-consumer-validation", "fresh-exact-target-before-delta-rollback-review",
  "coordinator-private-credential-correspondence", "resend-enforced-domain-tls-before-send",
  "explicit-owned-recipient-and-permitted-isolated-send", "mixed-version-and-in-flight-code-transition",
  "current-config-comparison-and-independent-application-verification", "rates-and-capacity-unproved",
]);
const COMPATIBILITY = Object.freeze({
  installedRequest: { method: "signInWithOtp", endpoint: "/auth/v1/otp", signup: "create_user=true",
    repeatLogin: "create_user=false", verification: "verifyOtp/type=email", finalIdentity: "independent-/auth/v1/user" },
  affectedConsumers: {
    mailer_otp_length: "new email OTPs across shared Auth consumers; existing app accepts exactly six digits",
    mailer_otp_exp: "email OTP, magic-link, signup-confirmation, password-recovery, email-change and invitation expiry",
    confirmationTemplate: "first or unconfirmed OTP signup and other shared signup confirmation consumers",
    magicLinkTemplate: "confirmed repeat OTP login and shared magic-link consumers",
    smtp: "all shared Auth email using the built-in mailer, including unchanged recovery/change/invite templates",
  },
  mixedVersions: "eight-digit in-flight codes do not fit the six-digit app; shorter global expiry can invalidate outstanding links; isolated transition review required",
  unchanged: "rates, security, OAuth, auto-confirm, signup, site URL/redirects and other template/subject bytes",
  visibility: "limited coordinator source search does not establish absence of deployed or operator Auth consumers",
  smtpTransport: "port 465 implicit TLS; domain delivery TLS is separately held until Enforced",
  expiryAssessment: "600 seconds is a proposed supported positive interval, not a configured value or tested hosted limit",
});
function proposed(original: Observation): Observation {
  const patch: Record<string, Scalar> = {
    mailer_otp_length: 6, mailer_otp_exp: 600,
    smtp_host: "smtp.resend.com", smtp_port: "465", smtp_user: "resend",
    smtp_admin_email: "no-reply@mail.wisedinner.com", smtp_sender_name: "WiseDinner",
    mailer_subjects_confirmation: SUBJECT, mailer_subjects_magic_link: SUBJECT,
    mailer_templates_confirmation_content: BODY, mailer_templates_magic_link_content: BODY,
  };
  return { ...original, owned: Object.fromEntries(EMAIL_AUTH_OWNED_FIELDS.map(k => [k, { present: true, value: patch[k] ?? refuse("internal_field") }])),
    templateHashes: { ...original.templateHashes, confirmation: sha(BODY), magic_link: sha(BODY) }, smtpPasswordState: "present-unverified" };
}
function freeze<T>(value: T): T {
  if (value && typeof value === "object") { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
export function prepareEmailAuthChange(input: unknown, sourcePins: unknown) {
  sources(sourcePins);
  const original = before(input), after = proposed(original);
  const fields = Object.fromEntries(EMAIL_AUTH_OWNED_FIELDS.map(k => {
    const field = after.owned[k]; if (!field?.present) return refuse("internal_field");
    return [k, field.value];
  }));
  const body = { contract: "wd-email-auth-change-plan-local-v1", project: EMAIL_AUTH_TARGET,
    sourcePins: EMAIL_AUTH_SOURCE_PINS, before: original, expectedNonsecretAfter: after, fields,
    smtpPassword: { field: "smtp_pass", reference: CREDENTIAL, beforeState: original.smtpPasswordState },
    compatibility: COMPATIBILITY,
    proofLevel: "LOCAL", state: "PREPARED_HELD", dispatchAuthority: "NONE", holds: HOLDS };
  return freeze({ ...body, operationId: sha(canonicalEmailAuthData(body)) });
}
export function serializeEmailAuthChange(value: ReturnType<typeof prepareEmailAuthChange>): string {
  const safe = data(value);
  const r = record(safe, ["contract", "project", "sourcePins", "before", "expectedNonsecretAfter", "fields", "smtpPassword", "compatibility", "proofLevel", "state", "dispatchAuthority", "holds", "operationId"]);
  const expected = prepareEmailAuthChange(r.before, r.sourcePins);
  if (canonicalEmailAuthData(safe) !== canonicalEmailAuthData(expected)) return refuse("plan_drift");
  return canonicalEmailAuthData(expected);
}
export function prepareEmailAuthRollback(input: unknown, sourcePins: unknown, currentAfter: unknown, outcome: "known-nonsecret-after" | "unknown") {
  const plan = prepareEmailAuthChange(input, sourcePins);
  if (outcome !== "known-nonsecret-after" && outcome !== "unknown") return refuse("outcome_shape");
  if (outcome === "unknown") return freeze({ state: "HELD", reason: "unknown-outcome-no-replay", dispatchAuthority: "NONE" });
  const current = observation(currentAfter);
  // Observation time changes, but every scoped field/hash/presence must match.
  const compared = { ...current, observedAt: plan.expectedNonsecretAfter.observedAt };
  if (canonicalEmailAuthData(compared) !== canonicalEmailAuthData(plan.expectedNonsecretAfter)) return refuse("after_drift");
  const fields = Object.fromEntries(EMAIL_AUTH_OWNED_FIELDS.map(k => {
    const v = plan.before.owned[k]; if (!v?.present) return refuse("missing_rollback_semantics");
    return [k, v.value];
  }));
  // A management read cannot authenticate the installed password. This is an explicit
  // held proposal; private credential correspondence and null-clearing semantics need review.
  return freeze({ contract: "wd-email-auth-rollback-plan-local-v1", project: EMAIL_AUTH_TARGET,
    forwardOperationId: plan.operationId, state: "PREPARED_HELD", proofLevel: "LOCAL", dispatchAuthority: "NONE",
    fields, smtpPassword: { field: "smtp_pass", restoreState: plan.before.smtpPasswordState,
      hold: "private-credential-correspondence-and-isolated-null-clearing-required" }, holds: HOLDS });
}
