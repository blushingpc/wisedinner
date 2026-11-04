import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, randomBytes, sign, verify } from "node:crypto";
import { parseCurrentPrivateLifecycleMaterial } from "./current-private-lifecycle-config.server.ts";

// In-memory synthetic keys/policies only. No file/env/key-store or transport.
const NOW = Date.parse("2026-11-01T01:00:00.000Z"), UNTIL = "2026-11-01T02:00:00.000Z";
const pair = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const pem = pair.privateKey.export({ format: "pem", type: "pkcs8" }).toString();
const publicPem = pair.publicKey.export({ format: "pem", type: "spki" }).toString();
const token = (claims: Record<string, unknown> = {}) => [Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),
  Buffer.from(JSON.stringify({ role: "service_role", ref: "zpvqxtklvjitofpbddrn", exp: NOW / 1000 + 86400, ...claims })).toString("base64url"), Buffer.alloc(32, 1).toString("base64url")].join(".");
function fixture() {
  return { origin: "https://zpvqxtklvjitofpbddrn.supabase.co", serverCredential: token(), profile: "strict", profilePolicyVersion: "fixture-strict-v1",
    clientId: "com.wisedinner.app", teamId: "TESTTEAM01", keyId: "TESTKEY001", privateKeyPem: pem, publicKeyPem: publicPem,
    secretSeconds: 60, keyVersion: "fixture-1", keyring: new Map([["fixture-1", randomBytes(32)]]),
    applePolicy: { approved: true, version: "fixture-custody-v1", credentialSeconds: 60, recoverySeconds: 120, evidenceSeconds: 180, retainedEvidence: ["apple_credential_recovery"] },
    deletionPolicy: { approved: true, version: "fixture-strict-v1", preparedSeconds: 60, pendingSeconds: 120, recoverySeconds: 180, receiptSeconds: 240, retainedEvidence: ["deletion_receipt"] }, validUntil: UNTIL };
}
function held(value: unknown) {
  const parser = parseCurrentPrivateLifecycleMaterial(value);
  assert.equal(parser.detach(NOW) === null, true, "invalid material must remain unavailable");
  const report = parser.inspect(NOW);
  assert.equal(report.readiness, "unavailable"); assert.equal(report.admitted, false);
  assert.equal(report.providerVerified, false); assert.equal(report.productionReady, false);
  return report;
}

test("actual validated private material is detached, cryptographically usable, never an admission", () => {
  const input = fixture(), parser = parseCurrentPrivateLifecycleMaterial(input), material = parser.detach(NOW);
  assert.ok(material); assert.equal(material.signer.type, "private"); assert.equal(material.profile, "strict");
  const message = Buffer.from("synthetic-test"), signature = sign("sha256", message, material.signer);
  assert.equal(verify("sha256", message, pair.publicKey, signature), true);
  assert.equal(material.keyring.get("fixture-1")?.length, 32);
  assert.equal(material.applePolicy.credentialSeconds, 60); assert.equal(material.deletionPolicy.receiptSeconds, 240);
  assert.deepEqual(parser.inspect(NOW), { readiness: "unavailable", missingNames: ["privateAdmission", "originalProfileBinding", "strictWriteFence"], reasons: ["material_valid_private_admission_required"], admitted: false, providerVerified: false, productionReady: false });
});

test("UUID profile is explicit material selection with its own policy label, never a strong fence or legacy conversion", () => {
  const input = fixture(); input.profile = "wd-owner-uuid-delete-v1"; input.profilePolicyVersion = input.deletionPolicy.version = "fixture-uuid-v1";
  const parser = parseCurrentPrivateLifecycleMaterial(input); assert.equal(parser.detach(NOW)?.profile, "wd-owner-uuid-delete-v1");
  assert.deepEqual(parser.inspect(NOW).missingNames, ["privateAdmission", "originalProfileBinding", "localDenial"]);
  held({ ...input, profile: "uuid" }); held({ ...input, profile: true }); held({ ...input, profilePolicyVersion: "fixture-strict-v1" });
  held({ ...input, enabled: true }); held({ ...input, writeFence: true }); held({ ...input, localDenial: true });
});

test("missing material reports only fixed field names without defaults or activation", () => {
  const parser = parseCurrentPrivateLifecycleMaterial(); assert.equal(parser.detach(NOW), null);
  assert.ok(parser.inspect(NOW).missingNames.includes("applePolicy")); assert.ok(parser.inspect(NOW).missingNames.includes("privateKeyPem"));
  const input = fixture();
  for (const name of Object.keys(input).filter(k => k !== "publicKeyPem")) {
    const { [name]: removed, ...partial } = input as Record<string, unknown>; void removed;
    assert.equal(parseCurrentPrivateLifecycleMaterial(partial).detach(NOW), null, name);
  }
  assert.ok(parseCurrentPrivateLifecycleMaterial({ ...input, publicKeyPem: undefined }).detach(NOW));
});

test("target, credential role/project, client and Team/Key IDs cannot borrow another scope", () => {
  const input = fixture();
  for (const origin of ["https://other.supabase.co", input.origin + "/", input.origin + "?x=1", "http://zpvqxtklvjitofpbddrn.supabase.co"]) held({ ...input, origin });
  for (const serverCredential of [token({ ref: "other" }), token({ role: "anon" }), "opaque_unknown", token({ exp: 1 })]) held({ ...input, serverCredential });
  for (const clientId of ["other.app", "com.wisedinner.app.web", ""]) held({ ...input, clientId });
  for (const name of ["teamId", "keyId"]) for (const value of ["lowercase1", "SHORT", "TESTTEAM01-extra", 123]) held({ ...input, [name]: value });
});

test("expiry, invalid clock and credential lifetime never renew material", () => {
  const parser = parseCurrentPrivateLifecycleMaterial(fixture());
  for (const clock of [Date.parse(UNTIL), Date.parse(UNTIL) + 1, NaN, Infinity, -1, 1.1]) {
    assert.equal(parser.detach(clock), null); assert.deepEqual(parser.inspect(clock).reasons, ["material_expired_or_clock_invalid"]);
  }
  for (const validUntil of ["2026-02-30T01:00:00.000Z", "2026-11-01", "bad", 1]) held({ ...fixture(), validUntil });
  held({ ...fixture(), validUntil: "2026-11-03T00:00:00.000Z" });
  for (const secretSeconds of [undefined, 0, -1, 1.5, 15777001]) held({ ...fixture(), secretSeconds });
});

test("wrong curve, encrypted/malformed/signing-public-key mismatch and keyring mismatch are held", () => {
  const other = generateKeyPairSync("ec", { namedCurve: "secp384r1" });
  held({ ...fixture(), privateKeyPem: other.privateKey.export({ type: "pkcs8", format: "pem" }).toString() });
  held({ ...fixture(), publicKeyPem: other.publicKey.export({ type: "spki", format: "pem" }).toString() });
  for (const privateKeyPem of ["not-pem", publicPem, pair.privateKey, 1]) held({ ...fixture(), privateKeyPem });
  held({ ...fixture(), keyVersion: "absent" }); held({ ...fixture(), keyring: new Map() });
  held({ ...fixture(), keyring: new Map([["fixture-1", Buffer.alloc(31)]]) });
  held({ ...fixture(), keyring: { "fixture-1": Buffer.alloc(32) } });
});

test("actual policy validators reject unapproved, unknown and malformed values; no guessed durations", () => {
  for (const name of ["applePolicy", "deletionPolicy"] as const) {
    const input = fixture();
    for (const value of [null, {}, { ...input[name], approved: false }, { ...input[name], extra: true }, { ...input[name], recoverySeconds: 0 }, { ...input[name], retainedEvidence: [] }]) held({ ...input, [name]: value });
  }
});

test("a strict signer field cannot hide a second PEM block or trailing data", () => {
  held({ ...fixture(), privateKeyPem: pem + pem });
  held({ ...fixture(), privateKeyPem: pem + "ignored-trailing-data" });
  held({ ...fixture(), publicKeyPem: publicPem + publicPem });
});

test("credential header/signature structure cannot be replaced by valid claims alone", () => {
  const parts = token().split(".");
  for (const header of ["not-json", Buffer.from('{"alg":"none","typ":"JWT"}').toString("base64url")]) held({ ...fixture(), serverCredential: [header, parts[1], parts[2]].join(".") });
  held({ ...fixture(), serverCredential: [parts[0], parts[1], "A"].join(".") });
});

test("input and detached map/buffer/policy/signer mutation cannot alter the captured material", () => {
  const input = fixture(), parser = parseCurrentPrivateLifecycleMaterial(input), first = parser.detach(NOW)!;
  const byte = first.keyring.get("fixture-1")![0]; input.keyring.get("fixture-1")!.fill(byte ^ 255); input.keyring.clear();
  input.applePolicy.credentialSeconds = 999; input.deletionPolicy.retainedEvidence.push("other"); input.origin = "https://other.invalid"; input.privateKeyPem = "bad";
  first.keyring.get("fixture-1")!.fill(byte ^ 255); (first.keyring as Map<string, Buffer>).clear();
  Object.defineProperty(first.signer, "export", { get() { throw Error("must not read mutated wrapper"); } });
  const second = parser.detach(NOW)!; assert.equal(second.keyring.get("fixture-1")![0], byte);
  assert.equal(second.applePolicy.credentialSeconds, 60); assert.deepEqual(second.deletionPolicy.retainedEvidence, ["deletion_receipt"]);
  assert.equal(verify("sha256", Buffer.from("still-captured"), pair.publicKey, sign("sha256", Buffer.from("still-captured"), second.signer)), true);
  assert.throws(() => { (second.applePolicy as { credentialSeconds: number }).credentialSeconds = 100; });
});

test("own-data capture rejects accessors, inherited/proxy/unknown ports without touching metadata or methods", () => {
  let calls = 0; const poison = () => { calls++; throw Error("private detail"); };
  held(Object.defineProperty(fixture(), "privateKeyPem", { get: poison }));
  held(Object.assign(Object.create({ inherited: true }), fixture()));
  held(new Proxy(fixture(), { ownKeys: poison, get: poison, getPrototypeOf: poison }));
  held({ ...fixture(), request: poison }); held({ ...fixture(), now: poison }); held({ ...fixture(), [Symbol("secret")]: 1 });
  const policy = Object.defineProperty(fixture().applePolicy, "version", { get: poison }); held({ ...fixture(), applePolicy: policy });
  const ring = fixture().keyring; Object.defineProperty(ring, Symbol.iterator, { get: poison }); held({ ...fixture(), keyring: ring });
  const bytes = Buffer.alloc(32); Object.defineProperty(bytes, "length", { get: poison }); held({ ...fixture(), keyring: new Map([["fixture-1", bytes]]) });
  const proxyBytes = new Proxy(Buffer.alloc(32), { getPrototypeOf: poison, get: poison }); held({ ...fixture(), keyring: new Map([["fixture-1", proxyBytes]]) });
  assert.equal(calls, 0);
});

test("inspect contains only labels and false claims; material cannot be accidentally serialized", () => {
  const input = fixture(), parser = parseCurrentPrivateLifecycleMaterial(input), report = parser.inspect(NOW), text = JSON.stringify(report);
  assert.deepEqual(Object.keys(report).sort(), ["admitted", "missingNames", "productionReady", "providerVerified", "readiness", "reasons"]);
  for (const secret of [pem, input.serverCredential, input.origin, input.teamId, input.keyId, input.deletionPolicy.version]) assert.equal(text.includes(secret), false);
  assert.equal(JSON.stringify(parser), "{}"); assert.throws(() => JSON.stringify(parser.detach(NOW)), /private_material_not_serializable/);
  assert.equal(Object.isFrozen(report), true); assert.equal(Object.isFrozen(report.missingNames), true);
});

test("parse, inspect and detach perform zero network/provider calls", () => {
  const saved = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("forbidden"); };
  try { const parser = parseCurrentPrivateLifecycleMaterial(fixture()); parser.inspect(NOW); assert.ok(parser.detach(NOW)); held({}); assert.equal(calls, 0); }
  finally { globalThis.fetch = saved; }
});
