import { createHash, createCipheriv, createDecipheriv, randomBytes, randomUUID, createPublicKey, sign, verify, timingSafeEqual } from "node:crypto";
import type { KeyObject, JsonWebKey } from "node:crypto";
import type { VerifiedAccount } from "./account.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";

export const APPLE_CUSTODY = "wd-apple-custody-v1";
export type AppleData = Record<string, unknown>;
export class AppleCustodyError extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
export function appleFail(code = "custody_unavailable"): never { throw new AppleCustodyError(code); }
export function appleObject(x: unknown): AppleData {
  if (!x || typeof x !== "object" || Array.isArray(x) || ![Object.prototype, null].includes(Object.getPrototypeOf(x))) appleFail("invalid_request");
  if (Reflect.ownKeys(x).some(k => typeof k !== "string") || Object.values(Object.getOwnPropertyDescriptors(x)).some(d => !("value" in d))) appleFail("invalid_request");
  return x as AppleData;
}
export function appleExact(x: unknown, fields: readonly string[]): AppleData {
  const v = appleObject(x); if (Object.keys(v).sort().join() !== [...fields].sort().join()) appleFail("invalid_request"); return v;
}
export function appleUuid(x: unknown): string { if (typeof x !== "string" || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(x)) appleFail("invalid_id"); return x; }
export function appleSha(x: string): string { return createHash("sha256").update(x).digest("hex"); }
export function appleDigest(x: unknown): string { return appleSha(JSON.stringify(canonicalReferenceData(x))); }
export function appleHash(x: unknown): string { if (typeof x !== "string" || !/^[a-f0-9]{64}$/.test(x)) appleFail("invalid_digest"); return x; }
export function appleText(x: unknown, max = 1024): string { if (typeof x !== "string" || !x || Buffer.byteLength(x) > max || /[\x00-\x1f\x7f]/.test(x)) appleFail("invalid_request"); return x; }
export function appleEqual(a: string, b: string): boolean { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }
// Preserve the shared duplicate-key/grammar guard without its recipe-specific
// 10k value-string ceiling truncating encrypted credentials. Keys remain intact.
export function parseAppleJson(text: string): unknown {
  if (Buffer.byteLength(text) > 4194304) appleFail("capacity_exceeded");
  let guard = "", cursor = 0;
  while (cursor < text.length) {
    if (text[cursor] !== '"') { guard += text[cursor++]; continue; }
    const start = cursor++;
    while (cursor < text.length) { const c = text[cursor++]; if (c === "\\") cursor++; else if (c === '"') break; }
    const literal = text.slice(start, cursor); JSON.parse(literal);
    let next = cursor; while (/\s/.test(text[next] ?? "") && next < text.length) next++;
    guard += text[next] === ":" ? literal : '"value"';
  }
  parseReferenceJson(guard); return JSON.parse(text);
}
export function appleOrigin(x: string): string { const u = new URL(x); if (u.protocol !== "https:" || u.port || u.username || u.password || u.pathname !== "/" || u.search || u.hash) appleFail("custody_not_configured"); return u.origin; }
export async function appleRead(body: ReadableStream<Uint8Array> | null, max: number, signal?: AbortSignal): Promise<string> {
  if (!body) appleFail("invalid_request"); const reader = body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel().catch(() => {}); }; signal?.addEventListener("abort", abort, { once: true });
  try { for (;;) { if (signal?.aborted) appleFail("transport_unknown"); const c = await reader.read(); if (c.done) break; size += c.value.length; if (size > max) appleFail("capacity_exceeded"); chunks.push(c.value); } if (signal?.aborted) appleFail("transport_unknown"); return new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)); }
  finally { signal?.removeEventListener("abort", abort); void reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export async function appleHttp(url: string, init: RequestInit, request: typeof fetch, max = 65536, timeoutMs = 3000): Promise<{ status: number; text: string }> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8000) appleFail("custody_not_configured");
  const controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
  try { return await Promise.race([(async () => {
    const r = await request(url, { ...init, redirect: "error", cache: "no-store", signal: controller.signal });
    if (r.redirected || r.url && r.url !== url) appleFail();
    const n = r.headers.get("content-length"); if (n !== null && (!/^\d+$/.test(n) || Number(n) > max)) appleFail("capacity_exceeded");
    const text = r.body ? await appleRead(r.body, max, controller.signal) : "";
    if (n !== null && Number(n) !== Buffer.byteLength(text)) appleFail();
    return { status: r.status, text };
  })(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AppleCustodyError("transport_unknown")); }, timeoutMs); })]); }
  finally { clearTimeout(timer); controller.abort(); }
}
export type ApplePolicy = Readonly<{ approved: true; version: string; credentialSeconds: number; recoverySeconds: number; evidenceSeconds: number; retainedEvidence: readonly string[] }>;
export function inspectApplePolicy(x: unknown): ApplePolicy {
  if (x === undefined || x === null) appleFail("policy_required");
  const p = appleExact(x, ["approved", "version", "credentialSeconds", "recoverySeconds", "evidenceSeconds", "retainedEvidence"]);
  if (p.approved !== true || !/^[a-zA-Z0-9_.-]{1,100}$/.test(String(p.version))) appleFail("policy_required");
  for (const k of ["credentialSeconds", "recoverySeconds", "evidenceSeconds"]) if (!Number.isSafeInteger(p[k]) || (p[k] as number) < 1 || (p[k] as number) > 2147483647) appleFail("policy_required");
  if (!Array.isArray(p.retainedEvidence) || !p.retainedEvidence.includes("apple_credential_recovery") || p.retainedEvidence.length > 10 || p.retainedEvidence.some(x => typeof x !== "string" || !/^[a-z_]{1,64}$/.test(x))) appleFail("policy_required");
  return canonicalReferenceData(p) as ApplePolicy;
}
export type AppleIdentity = { ownerId: string; identityHash: string; appleIdentityHash: string; subject: string };
export function decodeTrustedAppleIdentity(input: unknown, ownerId: string, origin: string): AppleIdentity {
  const u = appleObject(input); if (u.id !== appleUuid(ownerId) || u.is_anonymous !== false || u.deleted_at != null || u.is_sso_user === true) appleFail("identity_unverified");
  const created = appleText(u.created_at); if (!Number.isFinite(Date.parse(created)) || !Array.isArray(u.identities) || !u.identities.length || u.identities.length > 16) appleFail("identity_unverified");
  const seen = new Set<string>(); const rows = u.identities.map(value => {
    const v = appleObject(value), id = appleUuid(v.identity_id), date = appleText(v.created_at);
    if (seen.has(id) || v.user_id !== ownerId || !["apple", "email", "google"].includes(String(v.provider)) || !Number.isFinite(Date.parse(date))) appleFail("identity_unverified"); seen.add(id);
    return [id, v.provider as string, appleText(v.id), ownerId, date];
  }).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
  const apples = rows.filter(x => x[1] === "apple"); if (apples.length !== 1) appleFail("identity_unverified");
  return { ownerId, identityHash: appleDigest(["wd-supabase-auth-lineage-1", appleOrigin(origin), ownerId, created, rows]), appleIdentityHash: appleDigest(["wd-apple-identity-1", appleOrigin(origin), ...apples[0]]), subject: apples[0][2] };
}
export function createTrustedAppleIdentityReader(origin: string, serverKey: string, request: typeof fetch = fetch) {
  const base = appleOrigin(origin); appleText(serverKey, 16384);
  return async (owner: VerifiedAccount) => {
    const r = await appleHttp(base + "/auth/v1/user", { headers: { apikey: serverKey, Authorization: `Bearer ${owner.token}` } }, request, 32768);
    if (r.status !== 200) appleFail("identity_unverified"); return decodeTrustedAppleIdentity(parseAppleJson(r.text), owner.id, base);
  };
}
export type AppleJwk = JsonWebKey & { kid?: string; use?: string; alg?: string };
function b64(x: string): Buffer { if (!/^[A-Za-z0-9_-]+$/.test(x) || Buffer.from(x, "base64url").toString("base64url") !== x) appleFail("identity_unverified"); return Buffer.from(x, "base64url"); }
export function verifyAppleIdToken(token: string, keys: unknown, expected: { subject: string; clientId: string; nonce: string; now: number; code?: string }): AppleData {
  if (!Number.isSafeInteger(expected.now) || expected.now < 0) appleFail("custody_not_configured");
  appleText(token, 20480); const parts = token.split("."); if (parts.length !== 3) appleFail("identity_unverified");
  const h = appleObject(parseAppleJson(b64(parts[0]).toString("utf8"))), claims = appleObject(parseAppleJson(b64(parts[1]).toString("utf8")));
  if (h.alg !== "RS256" || Object.keys(h).some(k => !["alg", "kid", "typ"].includes(k)) || h.typ != null && h.typ !== "JWT") appleFail("identity_unverified");
  const set = appleExact(keys, ["keys"]); if (!Array.isArray(set.keys) || set.keys.length > 32) appleFail("identity_unverified");
  const candidates = set.keys.map(appleObject).filter(k => k.kid === appleText(h.kid) && k.kty === "RSA" && k.alg === "RS256" && k.use === "sig"); if (candidates.length !== 1) appleFail("identity_unverified");
  if (!verify("RSA-SHA256", Buffer.from(parts[0] + "." + parts[1]), createPublicKey({ key: candidates[0] as AppleJwk, format: "jwk" }), b64(parts[2]))) appleFail("identity_unverified");
  if (claims.iss !== "https://appleid.apple.com" || claims.aud !== expected.clientId || claims.sub !== expected.subject || claims.nonce !== appleSha(expected.nonce) || !Number.isSafeInteger(claims.iat) || !Number.isSafeInteger(claims.exp) || (claims.iat as number) > expected.now || (claims.exp as number) <= expected.now || (claims.exp as number) <= (claims.iat as number)) appleFail("identity_unverified");
  if (expected.code !== undefined) {
    if (typeof claims.c_hash !== "string") appleFail("code_binding_required");
    const hash = createHash("sha256").update(expected.code, "ascii").digest().subarray(0, 16).toString("base64url"); if (!appleEqual(claims.c_hash, hash)) appleFail("code_binding_mismatch");
  }
  return claims;
}
export function appleIntent(owner: string, operation: string, code: string, token: string, nonce: string, clientId: string, policyHash: string): string {
  return appleDigest([APPLE_CUSTODY, appleUuid(owner), appleUuid(operation), appleSha(code), appleSha(token), appleSha(nonce), appleText(clientId), appleHash(policyHash)]);
}
export type AppleBinding = { origin: string; ownerId: string; operationId: string; intentSha256: string; clientId: string; appleIdentityHash: string; lineageId: string; keyVersion: string; policySha256: string };
export type AppleEnvelope = { version: 1; binding: AppleBinding; iv: string; tag: string; ciphertext: string };
export type AppleTokens = { refresh_token: string; access_token: string; id_token: string; token_type: "Bearer"; expires_in: number };
export function inspectAppleTokens(x: unknown): AppleTokens {
  const p = appleExact(x, ["refresh_token", "access_token", "id_token", "token_type", "expires_in"]);
  appleText(p.refresh_token, 16384); appleText(p.access_token, 16384); appleText(p.id_token, 20480);
  if (p.token_type !== "Bearer" || !Number.isSafeInteger(p.expires_in) || (p.expires_in as number) < 1) appleFail(); return p as AppleTokens;
}
function aad(binding: AppleBinding): Buffer {
  appleExact(binding, ["origin", "ownerId", "operationId", "intentSha256", "clientId", "appleIdentityHash", "lineageId", "keyVersion", "policySha256"]);
  return Buffer.from(JSON.stringify(["wd-apple-credential-aead-v1", 1, appleOrigin(binding.origin), appleUuid(binding.ownerId), appleUuid(binding.operationId), appleHash(binding.intentSha256), appleText(binding.clientId), "https://appleid.apple.com", appleHash(binding.appleIdentityHash), appleUuid(binding.lineageId), appleText(binding.keyVersion, 100), appleHash(binding.policySha256)]));
}
export function sealAppleTokens(tokens: AppleTokens, binding: AppleBinding, key: Buffer): AppleEnvelope {
  if (key.length !== 32) appleFail("custody_not_configured"); const iv = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, iv, { authTagLength: 16 }); cipher.setAAD(aad(binding));
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(inspectAppleTokens(tokens))), cipher.final()]);
  return { version: 1, binding: { ...binding }, iv: iv.toString("base64url"), tag: cipher.getAuthTag().toString("base64url"), ciphertext: ciphertext.toString("base64url") };
}
export function openAppleTokens(input: unknown, keyring: ReadonlyMap<string, Buffer>): AppleTokens {
  const v = appleExact(input, ["version", "binding", "iv", "tag", "ciphertext"]), binding = appleObject(v.binding) as AppleBinding, associated = aad(binding), key = keyring.get(binding.keyVersion);
  if (v.version !== 1 || !key || key.length !== 32) appleFail("credential_unavailable");
  const iv = b64(appleText(v.iv)), tag = b64(appleText(v.tag)), ciphertext = b64(appleText(v.ciphertext, 100000)); if (iv.length !== 12 || tag.length !== 16) appleFail("credential_unavailable");
  const decipher = createDecipheriv("aes-256-gcm", key, iv, { authTagLength: 16 }); decipher.setAAD(associated); decipher.setAuthTag(tag);
  try { return inspectAppleTokens(parseAppleJson(Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8"))); } catch { return appleFail("credential_unavailable"); }
}
export type AppleRepository = { command(namespace: "custody" | "revocation" | "deletion", action: string, body: AppleData): Promise<AppleData> };
export function checkedApple(x: unknown): AppleData {
  const r = appleObject(x);
  if (r.error) appleFail(["original_conflict", "original_unresolved", "original_status_required", "credential_capacity", "credential_unavailable", "credential_unverified", "account_inactive", "identity_unverified", "invalid_command", "invalid_progress", "scope_unverified", "policy_required", "revision_conflict", "intent_conflict"].includes(String(r.error)) ? String(r.error) : "custody_unavailable");
  return r;
}
export function createAppleRpcRepository(origin: string, serverKey: string, request: typeof fetch = fetch): AppleRepository {
  const base = appleOrigin(origin); appleText(serverKey, 16384);
  return { async command(namespace, action, body) {
    const name = { custody: "wd_apple_custody_command", revocation: "wd_apple_revocation_command", deletion: "wd_apple_deletion_command" }[namespace];
    const r = await appleHttp(base + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: serverKey, Authorization: `Bearer ${serverKey}`, "content-type": "application/json" }, body: JSON.stringify({ p_action: action, p_body: body }) }, request, 4194304);
    if (r.status !== 200) appleFail(); return checkedApple(parseAppleJson(r.text));
  } };
}
export type AppleClient = { readonly clientId: string; keys(): Promise<unknown>; exchange(code: string): Promise<{ status: number; value: unknown }>; revoke(token: string): Promise<boolean> };
export function createAppleClient(config: { clientId: string; teamId: string; keyId: string; signer: KeyObject; secretSeconds: number; timeoutMs: number; now?: () => number }, request: typeof fetch = fetch): AppleClient {
  const { clientId, teamId, keyId, signer, secretSeconds, timeoutMs } = config;
  appleText(clientId); if (!/^[A-Z0-9]{10}$/.test(teamId) || !/^[A-Z0-9]{10}$/.test(keyId) || signer.type !== "private" || signer.asymmetricKeyType !== "ec" || signer.asymmetricKeyDetails?.namedCurve !== "prime256v1" || !Number.isInteger(secretSeconds) || secretSeconds < 1 || secretSeconds > 15777000) appleFail("custody_not_configured");
  const secret = () => { const now = Math.floor((config.now?.() ?? Date.now()) / 1000); const h = Buffer.from(JSON.stringify({ alg: "ES256", kid: keyId })).toString("base64url"), p = Buffer.from(JSON.stringify({ iss: teamId, sub: clientId, aud: "https://appleid.apple.com", iat: now, exp: now + secretSeconds })).toString("base64url"), data = h + "." + p; return data + "." + sign("sha256", Buffer.from(data), { key: signer, dsaEncoding: "ieee-p1363" }).toString("base64url"); };
  return {
    clientId,
    async keys() { const r = await appleHttp("https://appleid.apple.com/auth/keys", {}, request, 65536, timeoutMs); if (r.status !== 200) appleFail(); return parseAppleJson(r.text); },
    async exchange(code) { const r = await appleHttp("https://appleid.apple.com/auth/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: secret(), code, grant_type: "authorization_code" }).toString() }, request, 65536, timeoutMs); return { status: r.status, value: parseAppleJson(r.text) }; },
    async revoke(token) { const r = await appleHttp("https://appleid.apple.com/auth/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ client_id: clientId, client_secret: secret(), token, token_type_hint: "refresh_token" }).toString() }, request, 4096, timeoutMs); if (r.status === 200 && r.text === "") return true; if (r.status === 400 && ["invalid_request", "invalid_client", "invalid_grant", "unauthorized_client"].includes(String(appleObject(parseAppleJson(r.text)).error))) return false; return appleFail("transport_unknown"); }
  };
}
export function appleReceipt(operationId: string | null, intentSha256: string | null, result: AppleData, status = 200): Response {
  const outcomes = ["stored", "reused_existing", "held", "unresolved"], states = ["stored", "reused_existing", "not_admitted", "admitted", "started", "refused", "unknown", "revoking", "revoke_unknown", "erased", "unresolved"];
  const codes = ["credentials_stored", "credentials_reused", "custody_disabled", "policy_required", "invalid_request", "invalid_id", "invalid_digest", "identity_unverified", "code_binding_required", "code_binding_mismatch", "original_intent_mismatch", "original_conflict", "exchange_refused", "original_status_required", "credential_erased", "original_unresolved", "custody_unavailable", "capacity_exceeded", "credential_capacity", "credential_unavailable", "credential_unverified", "custody_not_configured", "transport_unknown", "account_inactive", "auth_required", "invalid_command", "invalid_progress", "scope_unverified", "revision_conflict", "intent_conflict"];
  const state = result.custody === "reused" ? "reused_existing" : result.custody;
  const publicResult = { outcome: outcomes.includes(String(result.outcome)) ? result.outcome : "held", code: codes.includes(String(result.code)) ? result.code : "custody_unavailable", custody: states.includes(String(state)) ? state : "unknown", statusRequired: result.statusRequired !== false, manualRecovery: ["none", "new_interactive_sign_in", "apple_removal_may_be_required"].includes(String(result.manualRecovery)) ? result.manualRecovery : ["stored", "reused_existing"].includes(String(result.outcome)) || state === "not_admitted" ? "none" : "new_interactive_sign_in", providerEffect: ["none", "exchange_confirmed", "unknown"].includes(String(result.providerEffect)) ? result.providerEffect : "unknown", retryAuthorized: false };
  const body = { contract: APPLE_CUSTODY, operationId, intentSha256, result: publicResult }; if (Buffer.byteLength(JSON.stringify(body)) > 16384) return appleReceipt(null, null, { outcome: "held", code: "capacity_exceeded", statusRequired: true }, 413);
  return Response.json(body, { status, headers: { "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
export type AppleCustodyDependencies = { enabled: boolean; deletionCompositionAdmitted: boolean; verify(request: Request): Promise<VerifiedAccount>; identity(account: VerifiedAccount): Promise<AppleIdentity>; repository: AppleRepository; client: AppleClient; origin: string; clientId: string; keyVersion: string; keyring: ReadonlyMap<string, Buffer>; policy?: unknown; now?: () => number };
export function createAppleTokenCustodyService(input: AppleCustodyDependencies) {
  // Bind a snapshot, including key bytes, before any async source/provider read.
  let policy: unknown; try { policy = input.policy === undefined ? undefined : canonicalReferenceData(input.policy); } catch { policy = undefined; }
  const deps: AppleCustodyDependencies = { ...input, policy, keyring: new Map([...input.keyring].map(([v, k]) => [v, Buffer.from(k)])), client: { ...input.client }, repository: { ...input.repository } };
  return async (request: Request): Promise<Response> => {
    let operationId: string | null = null, intent: string | null = null, admissionAttempted = false, statusReadAttempted = false;
    try {
      if (request.method !== "POST" || request.headers.get("content-type")?.split(";")[0].trim() !== "application/json" || request.headers.has("content-encoding")) appleFail("invalid_request");
      const text = await appleRead(request.body, 32768, request.signal), n = request.headers.get("content-length"); if (n !== null && (!/^\d+$/.test(n) || Number(n) !== Buffer.byteLength(text))) appleFail("invalid_request");
      const v = appleObject(parseAppleJson(text)); operationId = appleUuid(v.operationId); if (v.contract !== APPLE_CUSTODY) appleFail("invalid_request");
      if (!/^Bearer [^\s]+$/.test(request.headers.get("authorization") ?? "")) appleFail("auth_required");
      let owner: VerifiedAccount; try { owner = await deps.verify(request); appleUuid(owner.id); } catch { return appleReceipt(operationId, intent, { outcome: "held", code: "auth_required", custody: "not_admitted", statusRequired: false, providerEffect: "none" }, 401); }
      if (v.operation === "status") {
        appleExact(v, ["contract", "operation", "operationId", "intentSha256"]); intent = appleHash(v.intentSha256);
        // This read may target an already committed original. Transport failure
        // or a malformed ACK cannot establish absence or authorize replay.
        statusReadAttempted = true;
        const r = checkedApple(await deps.repository.command("custody", "status", { ownerId: owner.id, operationId, intentSha256: intent }));
        // Match the existing SQL's exchange state and optional credential-state
        // overlay, not arbitrary strings or a missing-state fallback.
        if (Object.keys(r).some(k => !["state", "custody"].includes(k)) || typeof r.state !== "string" || !["admitted", "started", "stored", "reused", "refused", "unknown", "erased", "unresolved"].includes(r.state)) appleFail("custody_unavailable");
        const state = r.state;
        if (Object.hasOwn(r, "custody") && (typeof r.custody !== "string" || (r.custody !== state && (!["stored", "reused"].includes(state) || !["erased", "revoking", "revoke_unknown", "unknown"].includes(r.custody))))) appleFail("custody_unavailable");
        return appleReceipt(operationId, intent, { outcome: state === "stored" ? "stored" : state === "reused" ? "reused_existing" : "unresolved", code: r.custody === "erased" ? "credential_erased" : "original_status_required", custody: r.custody ?? state, statusRequired: true, providerEffect: state === "reused" ? "none" : state === "stored" ? "exchange_confirmed" : "unknown" });
      }
      appleExact(v, ["contract", "operation", "operationId", "authorizationCode", "identityToken", "nonce"]); if (v.operation !== "exchange") appleFail("invalid_request");
      if (!deps.enabled || !deps.deletionCompositionAdmitted) appleFail("custody_disabled");
      const policy = inspectApplePolicy(deps.policy), policyHash = appleDigest(policy), code = appleText(v.authorizationCode, 4096), token = appleText(v.identityToken, 20480), nonce = appleUuid(v.nonce);
      if (!/^[\x21-\x7e]+$/.test(code)) appleFail("invalid_request");
      intent = appleIntent(owner.id, operationId, code, token, nonce, deps.clientId, policyHash);
      if (!appleEqual(request.headers.get("x-wd-apple-intent-sha256") ?? "", intent)) appleFail("original_intent_mismatch");
      const key = deps.keyring.get(deps.keyVersion); if (!key || key.length !== 32) appleFail("custody_not_configured");
      const identity = await deps.identity(owner); if (identity.ownerId !== owner.id) appleFail("identity_unverified");
      const keys = await deps.client.keys(), now = Math.floor((deps.now?.() ?? Date.now()) / 1000);
      verifyAppleIdToken(token, keys, { subject: identity.subject, clientId: deps.clientId, nonce, now, code });
      const original = { ownerId: owner.id, operationId, intentSha256: intent, clientId: deps.clientId, appleIdentityHash: identity.appleIdentityHash, identityHash: identity.identityHash, codeHash: appleSha(code), policy, policySha256: policyHash };
      const reuse = checkedApple(await deps.repository.command("custody", "lookup_reuse", original)); let reuseLineage: string | null = null;
      if (reuse.credential) { const envelope = appleObject(reuse.credential) as AppleEnvelope; openAppleTokens(envelope, deps.keyring); if (envelope.binding.ownerId !== owner.id || envelope.binding.clientId !== deps.clientId || envelope.binding.appleIdentityHash !== identity.appleIdentityHash || envelope.binding.origin !== appleOrigin(deps.origin)) appleFail("identity_unverified"); reuseLineage = envelope.binding.lineageId; }
      const beforeAdmit = await deps.identity(owner);
      if (beforeAdmit.ownerId !== owner.id || beforeAdmit.identityHash !== identity.identityHash || beforeAdmit.appleIdentityHash !== identity.appleIdentityHash) appleFail("identity_unverified");
      // This RPC may commit before its acknowledgement is lost or malformed.
      // Only original status can resolve that uncertainty, including reuse.
      admissionAttempted = true;
      const admission = checkedApple(await deps.repository.command("custody", "admit", { ...original, reuseLineage }));
      if (admission.state === "reused") return appleReceipt(operationId, intent, { outcome: "reused_existing", code: "credentials_reused", custody: "reused_existing", statusRequired: false, providerEffect: "none" });
      if (admission.fresh !== true) return appleReceipt(operationId, intent, { outcome: admission.state === "stored" ? "stored" : "held", code: "original_status_required", custody: String(admission.state), statusRequired: true, providerEffect: admission.state === "stored" ? "exchange_confirmed" : "unknown" }, admission.state === "stored" ? 200 : 409);
      const started = checkedApple(await deps.repository.command("custody", "begin", { ownerId: owner.id, operationId, intentSha256: intent })); if (started.fresh !== true) appleFail("original_status_required");
      const response = await deps.client.exchange(code);
      if (response.status !== 200) {
        const error = appleObject(response.value);
        if (response.status === 400 && ["invalid_request", "invalid_client", "invalid_grant", "unauthorized_client", "unsupported_grant_type", "invalid_scope"].includes(String(error.error))) {
          await deps.repository.command("custody", "refuse", { ownerId: owner.id, operationId, intentSha256: intent }); appleFail("exchange_refused");
        }
        appleFail("transport_unknown");
      }
      const tokens = inspectAppleTokens(response.value); verifyAppleIdToken(tokens.id_token, keys, { subject: identity.subject, clientId: deps.clientId, nonce, now: Math.floor((deps.now?.() ?? Date.now()) / 1000) });
      const claims = appleObject(parseAppleJson(Buffer.from(tokens.id_token.split(".")[1], "base64url").toString("utf8")));
      if (claims.c_hash !== undefined) verifyAppleIdToken(tokens.id_token, keys, { subject: identity.subject, clientId: deps.clientId, nonce, now, code });
      if (claims.at_hash !== undefined && claims.at_hash !== createHash("sha256").update(tokens.access_token, "ascii").digest().subarray(0, 16).toString("base64url")) appleFail("identity_unverified");
      const current = await deps.identity(owner); if (current.ownerId !== owner.id || current.identityHash !== identity.identityHash || current.appleIdentityHash !== identity.appleIdentityHash) appleFail("identity_unverified");
      const binding: AppleBinding = { origin: appleOrigin(deps.origin), ownerId: owner.id, operationId, intentSha256: intent, clientId: deps.clientId, appleIdentityHash: identity.appleIdentityHash, lineageId: randomUUID(), keyVersion: deps.keyVersion, policySha256: policyHash };
      const stored = checkedApple(await deps.repository.command("custody", "store", { ownerId: owner.id, operationId, intentSha256: intent, envelope: sealAppleTokens(tokens, binding, key) }));
      if (stored.state !== "stored") appleFail("original_status_required");
      return appleReceipt(operationId, intent, { outcome: "stored", code: "credentials_stored", custody: "stored", statusRequired: false, providerEffect: "exchange_confirmed" });
    } catch (error) {
      const code = error instanceof AppleCustodyError ? error.code : "custody_unavailable";
      const originalUncertain = admissionAttempted || statusReadAttempted;
      return appleReceipt(operationId, intent, { outcome: "held", code, custody: originalUncertain ? "unknown" : "not_admitted", statusRequired: originalUncertain, providerEffect: originalUncertain ? "unknown" : "none" }, code === "auth_required" ? 401 : code === "capacity_exceeded" ? 413 : ["custody_disabled", "policy_required", "custody_not_configured"].includes(code) ? 503 : 409);
    }
  };
}
