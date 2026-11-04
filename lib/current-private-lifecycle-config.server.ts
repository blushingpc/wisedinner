import { createPrivateKey, createPublicKey, type KeyObject } from "node:crypto";
import { isProxy } from "node:util/types";
import { appleOrigin, appleText, inspectApplePolicy, type ApplePolicy } from "./apple-token-custody.server.ts";
import { inspectDeletionV2Policy, type DeletionV2Policy } from "./account-deletion-v2.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";

const TARGET = "https://zpvqxtklvjitofpbddrn.supabase.co", CLIENT = "com.wisedinner.app";
const required = ["origin", "serverCredential", "profile", "profilePolicyVersion", "clientId", "teamId", "keyId", "privateKeyPem", "secretSeconds", "keyVersion", "keyring", "applePolicy", "deletionPolicy", "validUntil"] as const;
export type PrivateLifecycleProfile = "strict" | "wd-owner-uuid-delete-v1";
export type PrivateLifecycleMaterial = Readonly<{
  origin: string; serverCredential: string; profile: PrivateLifecycleProfile; profilePolicyVersion: string;
  clientId: string; teamId: string; keyId: string; signer: KeyObject; secretSeconds: number;
  keyVersion: string; keyring: ReadonlyMap<string, Buffer>; applePolicy: ApplePolicy; deletionPolicy: DeletionV2Policy; validUntil: string;
}>;
export type PrivateLifecycleInspection = Readonly<{
  readiness: "unavailable"; missingNames: readonly string[]; reasons: readonly string[];
  admitted: false; providerVerified: false; productionReady: false;
}>;
type Row = Record<string, unknown>;
function invalid(): never { throw Error("private_material_invalid"); }
function data(value: unknown): Row {
  if (!value || typeof value !== "object" || isProxy(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const ds = Object.getOwnPropertyDescriptors(value), row: Row = Object.create(null);
  for (const k of Reflect.ownKeys(ds)) {
    if (typeof k !== "string" || !("value" in ds[k]) || !ds[k].enumerable) invalid();
    Object.defineProperty(row, k, { value: ds[k].value, enumerable: true });
  }
  return row;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
function policyInput(value: unknown): unknown {
  const row = data(value);
  for (const [name, item] of Object.entries(row)) {
    if (name === "retainedEvidence") {
      if (!Array.isArray(item) || isProxy(item) || Object.getPrototypeOf(item) !== Array.prototype || item.length < 1 || item.length > 10) invalid();
      for (const [k, d] of Object.entries(Object.getOwnPropertyDescriptors(item))) {
        if (!("value" in d) || (k !== "length" && typeof d.value !== "string")) invalid();
      }
    } else if (!["string", "number", "boolean"].includes(typeof item)) invalid();
  }
  return copyReferenceData(row);
}
function keys(value: unknown): Map<string, Buffer> {
  if (!value || typeof value !== "object" || isProxy(value) || Object.getPrototypeOf(value) !== Map.prototype || Reflect.ownKeys(value).length) invalid();
  const result = new Map<string, Buffer>();
  // Intrinsic receiver calls do not read user-supplied entries/get/bind/name.
  for (const [version, bytes] of Map.prototype.entries.call(value)) {
    if (result.size >= 32 || typeof version !== "string" || !/^[A-Za-z0-9_.-]{1,100}$/.test(version)
      || isProxy(bytes) || !Buffer.isBuffer(bytes) || Object.getPrototypeOf(bytes) !== Buffer.prototype
      || Reflect.ownKeys(bytes).some(k => typeof k !== "string" || !/^(0|[1-9]\d*)$/.test(k)) || bytes.length !== 32) invalid();
    result.set(version, Buffer.from([...Uint8Array.prototype.values.call(bytes)]));
  }
  if (!result.size) invalid();
  return result;
}
function expiry(value: unknown): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
    || !Number.isSafeInteger(Date.parse(value)) || new Date(value).toISOString() !== value) invalid();
  return value;
}
function signer(value: unknown): KeyObject {
  if (typeof value !== "string" || value.length > 16384 || !/^-----BEGIN PRIVATE KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END PRIVATE KEY-----(?:\r?\n)?$/.test(value)) invalid();
  const key = createPrivateKey({ key: value, format: "pem", type: "pkcs8" });
  if (key.type !== "private" || key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") invalid();
  return key;
}
function credential(value: unknown): { value: string; expiresAt: number } {
  const text = appleText(value, 16384), parts = text.split(".");
  if (parts.length !== 3 || parts.some(p => !/^[A-Za-z0-9_-]+$/.test(p))) invalid();
  const headerBytes = Buffer.from(parts[0], "base64url"), signature = Buffer.from(parts[2], "base64url");
  if (headerBytes.toString("base64url") !== parts[0] || signature.toString("base64url") !== parts[2] || signature.length !== 32) invalid();
  const header = data(parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(headerBytes)));
  if (header.alg !== "HS256" || header.typ !== "JWT" || Object.keys(header).some(k => !["alg", "typ", "kid"].includes(k))
    || header.kid !== undefined && (typeof header.kid !== "string" || !header.kid || header.kid.length > 100)) invalid();
  const payload = Buffer.from(parts[1], "base64url");
  if (payload.toString("base64url") !== parts[1]) invalid();
  const claims = data(parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(payload)));
  // Structural material binding only; this never authenticates a JWT or proves
  // the credential is valid/current remotely. Unknown opaque formats stay held.
  if (claims.role !== "service_role" || claims.ref !== "zpvqxtklvjitofpbddrn" || !Number.isSafeInteger(claims.exp)
    || Number(claims.exp) < 1 || !Number.isSafeInteger(Number(claims.exp) * 1000)) invalid();
  return { value: text, expiresAt: Number(claims.exp) * 1000 };
}

/** Explicit trusted-server data only. No ambient env, IO, clock callbacks,
 * provider constructors, policy defaults or secret-store discovery. PEM parsing
 * produces a local crypto object, never a generated key or provider operation.
 * detach() is private material transport, NOT a LifecycleAdmission. */
export function parseCurrentPrivateLifecycleMaterial(input?: unknown) {
  let captured: PrivateLifecycleMaterial | undefined, pem: string | undefined;
  let missing: readonly string[] = required, reason = "material_missing";
  try {
    const row = input === undefined ? data({}) : data(input);
    if (Object.keys(row).some(k => ![...required, "publicKeyPem"].includes(k))) invalid();
    missing = required.filter(k => row[k] === undefined);
    if (!missing.length) {
      if (typeof row.origin !== "string" || appleOrigin(row.origin) !== TARGET || row.origin !== TARGET) invalid();
      if (row.profile !== "strict" && row.profile !== "wd-owner-uuid-delete-v1") invalid();
      if (row.clientId !== CLIENT || typeof row.teamId !== "string" || !/^[A-Z0-9]{10}$/.test(row.teamId)
        || typeof row.keyId !== "string" || !/^[A-Z0-9]{10}$/.test(row.keyId)) invalid();
      if (!Number.isInteger(row.secretSeconds) || Number(row.secretSeconds) < 1 || Number(row.secretSeconds) > 15777000) invalid();
      const privateSigner = signer(row.privateKeyPem);
      if (row.publicKeyPem !== undefined) {
        if (typeof row.publicKeyPem !== "string" || row.publicKeyPem.length > 16384 || !/^-----BEGIN PUBLIC KEY-----\r?\n(?:[A-Za-z0-9+/=]+\r?\n)+-----END PUBLIC KEY-----(?:\r?\n)?$/.test(row.publicKeyPem)) invalid();
        const publicSigner = createPublicKey(row.publicKeyPem);
        if (!createPublicKey(privateSigner).export({ type: "spki", format: "der" }).equals(publicSigner.export({ type: "spki", format: "der" }))) invalid();
      }
      const keyring = keys(row.keyring);
      if (typeof row.keyVersion !== "string" || !keyring.has(row.keyVersion)) invalid();
      const applePolicy = inspectApplePolicy(policyInput(row.applePolicy));
      const deletionPolicy = inspectDeletionV2Policy(policyInput(row.deletionPolicy));
      if (typeof applePolicy.version !== "string" || row.profilePolicyVersion !== deletionPolicy.version) invalid();
      const server = credential(row.serverCredential), validUntil = expiry(row.validUntil);
      if (Date.parse(validUntil) > server.expiresAt) invalid();
      pem = row.privateKeyPem as string;
      captured = Object.freeze({ origin: TARGET, serverCredential: server.value, profile: row.profile,
        profilePolicyVersion: deletionPolicy.version, clientId: CLIENT, teamId: row.teamId, keyId: row.keyId,
        signer: privateSigner, secretSeconds: row.secretSeconds as number, keyVersion: row.keyVersion, keyring,
        applePolicy: deepFreeze(applePolicy), deletionPolicy: deepFreeze(deletionPolicy), validUntil });
      reason = "material_valid_private_admission_required";
    }
  } catch { captured = undefined; pem = undefined; missing = []; reason = "material_invalid"; }
  const snapshot = captured, privatePem = pem;
  const current = (at: number) => !!snapshot && Number.isSafeInteger(at) && at >= 0 && at < Date.parse(snapshot.validUntil);
  const inspect = (at: number): PrivateLifecycleInspection => Object.freeze({ readiness: "unavailable",
    missingNames: Object.freeze([...missing, "privateAdmission", "originalProfileBinding", ...(snapshot?.profile === "wd-owner-uuid-delete-v1" ? ["localDenial"] : ["strictWriteFence"])]),
    reasons: Object.freeze([snapshot && !current(at) ? "material_expired_or_clock_invalid" : reason]), admitted: false, providerVerified: false, productionReady: false });
  const detach = (at: number): PrivateLifecycleMaterial | null => {
    if (!current(at) || !snapshot || !privatePem) return null;
    // Every consumer gets independent buffers/map/crypto wrapper. Neither a
    // caller mutation nor a previous detached copy can change this capture.
    const result = { ...snapshot, signer: signer(privatePem), keyring: keys(snapshot.keyring) };
    Object.defineProperty(result, "toJSON", { value: () => { throw Error("private_material_not_serializable"); } });
    return Object.freeze(result);
  };
  return Object.freeze({ inspect, detach });
}
