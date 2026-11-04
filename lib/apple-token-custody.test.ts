import test from "node:test";
import assert from "node:assert/strict";
import { createHash, generateKeyPairSync, randomBytes, randomUUID, sign, verify } from "node:crypto";
import { APPLE_CUSTODY, appleDigest, appleIntent, appleSha, sealAppleTokens, openAppleTokens, verifyAppleIdToken, createAppleTokenCustodyService, createAppleClient, appleHttp, decodeTrustedAppleIdentity, inspectApplePolicy, parseAppleJson } from "./apple-token-custody.server.ts";
import type { AppleData, AppleEnvelope, AppleRepository, AppleTokens } from "./apple-token-custody.server.ts";
import { supabaseDeletionAuthV2 } from "./account-deletion-v2.server.ts";

const owner = "10000000-0000-4000-8000-000000000001", other = "10000000-0000-4000-8000-000000000002";
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }), jwk = { ...rsa.publicKey.export({ format: "jwk" }), kid: "synthetic-kid", alg: "RS256", use: "sig" }, keys = { keys: [jwk] };
const policy = { approved: true as const, version: "synthetic-only", credentialSeconds: 3600, recoverySeconds: 3600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
const key = randomBytes(32), keyring = new Map([["test-1", key]]), now = Math.floor(Date.now() / 1000), clientId = "test.native.invalid";
function jwt(nonce: string, code: string, changes: AppleData = {}) {
  const h = Buffer.from(JSON.stringify({ alg: "RS256", kid: jwk.kid })).toString("base64url"), p = Buffer.from(JSON.stringify({ iss: "https://appleid.apple.com", aud: clientId, sub: "synthetic-subject", iat: now - 1, exp: now + 300, nonce: appleSha(nonce), c_hash: createHash("sha256").update(code).digest().subarray(0, 16).toString("base64url"), ...changes })).toString("base64url");
  return h + "." + p + "." + sign("RSA-SHA256", Buffer.from(h + "." + p), rsa.privateKey).toString("base64url");
}
function fixture() {
  const op = randomUUID(), nonce = randomUUID(), code = randomBytes(32).toString("base64url"), token = jwt(nonce, code);
  const intent = appleIntent(owner, op, code, token, nonce, clientId, appleDigest(policy));
  const records = new Map<string, AppleData>(); let envelope: AppleEnvelope | null = null, calls = 0, ownerNow = owner, exchangeMode = "success", lose = "";
  const repo: AppleRepository = { async command(_ns, action, b) {
    if (action === "lookup_reuse") return { credential: envelope };
    const id = String(b.operationId), old = records.get(id);
    if (action === "status") return { state: old && old.ownerId === b.ownerId && old.intentSha256 === b.intentSha256 ? old.state : "unresolved" };
    if (action === "admit") { if (old) { if (old.intentSha256 !== b.intentSha256 || old.ownerId !== b.ownerId) throw Error("conflict"); return { state: old.state, fresh: false }; } const state = b.reuseLineage ? "reused" : "admitted"; records.set(id, { ...b, state }); return { state, fresh: true }; }
    if (!old || old.ownerId !== b.ownerId || old.intentSha256 !== b.intentSha256) throw Error("original_unresolved");
    if (action === "begin") { if (old.state !== "admitted") return { fresh: false }; old.state = "started"; if (lose === "begin") throw Error("lost"); return { fresh: true }; }
    if (action === "store") { envelope = b.envelope as AppleEnvelope; old.state = "stored"; if (lose === "store") throw Error("lost"); return { state: "stored" }; }
    if (action === "refuse") { old.state = "refused"; return {}; } throw Error("unexpected command");
  } };
  const identity = { ownerId: owner, subject: "synthetic-subject", identityHash: "a".repeat(64), appleIdentityHash: "b".repeat(64) };
  const deps = { enabled: true, deletionCompositionAdmitted: true, verify: async () => ({ id: ownerNow, token: "synthetic-session", authenticatedAt: now, providers: ["apple"] }), identity: async () => identity, repository: repo, client: { clientId, keys: async () => keys, exchange: async () => { calls++; if (exchangeMode === "timeout") throw Error("synthetic timeout"); if (exchangeMode === "refuse") return { status: 400, value: { error: "invalid_grant" } }; if (exchangeMode === "500") return { status: 500, value: { error: "internal" } }; return { status: 200, value: { id_token: token, refresh_token: randomBytes(32).toString("base64url"), access_token: randomBytes(32).toString("base64url"), token_type: "Bearer", expires_in: 3600 } }; }, revoke: async () => true }, origin: "https://fixture.invalid", clientId, keyVersion: "test-1", keyring, policy, now: () => now * 1000 };
  const body = { contract: APPLE_CUSTODY, operation: "exchange", operationId: op, authorizationCode: code, identityToken: token, nonce };
  const request = (b: unknown = body, header = intent) => new Request("https://fixture.invalid/api/v1/account/apple-credential", { method: "POST", headers: { authorization: "Bearer synthetic", "content-type": "application/json", "x-wd-apple-intent-sha256": header }, body: typeof b === "string" ? b : JSON.stringify(b) });
  const call = async (b: unknown = body, header = intent) => { const r = await createAppleTokenCustodyService(deps)(request(b, header)); return { status: r.status, ...(await r.json()) as { result: AppleData } }; };
  return { deps, body, request, call, records, intent, nonce, code, token, calls: () => calls, envelope: () => envelope, mode: (x: string) => exchangeMode = x, lose: (x: string) => lose = x, owner: (x: string) => ownerNow = x };
}

test("real custody HTTP stores encrypted original, duplicate/status do not replay, same identity reuses without new exchange", async () => {
  const f = fixture(); const first = await f.call(); assert.equal(first.result.outcome, "stored"); assert.equal(f.calls(), 1);
  assert.deepEqual(Object.keys(first.result).sort(), ["outcome", "code", "custody", "statusRequired", "manualRecovery", "providerEffect", "retryAuthorized"].sort()); assert.equal(first.result.manualRecovery, "none");
  assert.equal((await f.call()).result.outcome, "stored"); // exact original keeps its saved disposition, not a new effect
  assert.equal(f.calls(), 1);
  const n = randomUUID(), c = randomBytes(24).toString("hex"), t = jwt(n, c), op = randomUUID();
  const second = await f.call({ ...f.body, operationId: op, nonce: n, authorizationCode: c, identityToken: t }, appleIntent(owner, op, c, t, n, clientId, appleDigest(policy)));
  assert.equal(second.result.outcome, "reused_existing"); assert.equal(second.result.providerEffect, "none"); assert.equal(f.calls(), 1);
  assert.equal(openAppleTokens(f.envelope(), keyring).token_type, "Bearer");
  assert.equal((await f.call({ contract: APPLE_CUSTODY, operation: "status", operationId: f.body.operationId, intentSha256: f.intent })).result.custody, "stored");
  f.owner(other); assert.equal((await f.call()).result.outcome, "held"); assert.equal(f.calls(), 1);
});
for (const boundary of ["begin", "store"]) test(`lost ${boundary} ACK retains original, no duplicate exchange`, async () => {
  const f = fixture(); f.lose(boundary); assert.equal((await f.call()).result.outcome, "held"); const count = f.calls();
  f.lose(""); await f.call(); assert.equal(f.calls(), count);
  if (boundary === "store") assert.ok(f.envelope());
});
for (const failure of ["throw", "null", "array", "scalar", "missing-state", "error", "unsupported-state", "malformed-custody", "contradictory-custody"]) test(`stored original status ${failure} stays uncertain and recovers read-only`, async () => {
  const f = fixture(); assert.equal((await f.call()).result.outcome, "stored");
  const envelopeHash = appleDigest(f.envelope()), originalHash = appleDigest([...f.records]), commands: string[] = [], command = f.deps.repository.command;
  let failed = true;
  f.deps.client.revoke = async () => { throw Error("status must not revoke"); };
  f.deps.repository.command = async (ns, action, body) => {
    commands.push(ns + ":" + action);
    if (action === "status" && failed) {
      if (failure === "throw") throw Error("synthetic lost status acknowledgement");
      return ({ null: null, array: [], scalar: 1, "missing-state": {}, error: { error: "original_unresolved" }, "unsupported-state": { state: "invented" }, "malformed-custody": { state: "stored", custody: null }, "contradictory-custody": { state: "unresolved", custody: "stored" } }[failure]) as unknown as AppleData;
    }
    return command(ns, action, body);
  };
  const status = { contract: APPLE_CUSTODY, operation: "status", operationId: f.body.operationId, intentSha256: f.intent };
  const lost = await f.call(status);
  assert.equal(lost.result.outcome, "held"); assert.equal(lost.result.custody, "unknown");
  assert.equal(lost.result.statusRequired, true); assert.equal(lost.result.retryAuthorized, false);
  assert.equal((lost as unknown as AppleData).operationId, status.operationId); assert.equal((lost as unknown as AppleData).intentSha256, f.intent);
  failed = false;
  // Each call recreates the real service over the retained original repository.
  const recovered = await f.call(status); assert.equal(recovered.result.outcome, "stored"); assert.equal(recovered.result.custody, "stored");
  for (const wrong of [{ ...status, operationId: randomUUID() }, { ...status, intentSha256: "f".repeat(64) }]) assert.equal((await f.call(wrong)).result.custody, "unresolved");
  f.owner(other); assert.equal((await f.call(status)).result.custody, "unresolved");
  f.owner(owner); assert.equal((await f.call(status)).result.custody, "stored");
  assert.equal(f.calls(), 1); assert.equal(appleDigest(f.envelope()), envelopeHash); assert.equal(appleDigest([...f.records]), originalHash);
  assert.ok(commands.length > 0); assert.ok(commands.every(c => c === "custody:status"));
});
test("reused original status ACK loss preserves the same disposition without exchange or mutation", async () => {
  const f = fixture(); assert.equal((await f.call()).result.outcome, "stored");
  const nonce = randomUUID(), code = randomBytes(24).toString("hex"), token = jwt(nonce, code), operationId = randomUUID();
  const intentSha256 = appleIntent(owner, operationId, code, token, nonce, clientId, appleDigest(policy));
  assert.equal((await f.call({ ...f.body, operationId, nonce, authorizationCode: code, identityToken: token }, intentSha256)).result.outcome, "reused_existing");
  const before = appleDigest([f.envelope(), [...f.records]]), command = f.deps.repository.command, actions: string[] = [];
  let fail = true;
  f.deps.repository.command = async (ns, action, body) => { actions.push(action); if (fail) throw Error("lost reuse status ACK"); return command(ns, action, body); };
  const status = { contract: APPLE_CUSTODY, operation: "status", operationId, intentSha256 };
  const lost = await f.call(status); assert.equal(lost.result.custody, "unknown"); assert.equal(lost.result.statusRequired, true); assert.equal(lost.result.retryAuthorized, false);
  fail = false; const recovered = await f.call(status); assert.equal(recovered.result.outcome, "reused_existing"); assert.equal(recovered.result.providerEffect, "none");
  assert.equal(f.calls(), 1); assert.equal(appleDigest([f.envelope(), [...f.records]]), before); assert.deepEqual(actions, ["status", "status"]);
});
test("pre-admission validation refusal proves no original RPC or exchange effect", async () => {
  const f = fixture(), commands: string[] = [], command = f.deps.repository.command;
  f.deps.repository.command = async (ns, action, body) => { commands.push(action); return command(ns, action, body); };
  const response = await f.call(f.body, "0".repeat(64));
  assert.equal(response.result.code, "original_intent_mismatch");
  assert.equal(response.result.custody, "not_admitted"); assert.equal(response.result.statusRequired, false);
  assert.equal(response.result.retryAuthorized, false); assert.equal(response.result.providerEffect, "none");
  assert.deepEqual(commands, []); assert.equal(f.records.size, 0); assert.equal(f.calls(), 0);
});
for (const boundary of ["before", "after", "malformed"]) test(`original admission ${boundary} ACK failure requires exact status without provider replay`, async () => {
  const f = fixture(), commands: string[] = [], command = f.deps.repository.command;
  f.deps.repository.command = async (ns, action, body) => {
    commands.push(action);
    if (action === "admit" && boundary === "before") throw Error("synthetic transport loss before commit");
    const result = await command(ns, action, body);
    if (action === "admit") {
      if (boundary === "malformed") return null as unknown as AppleData;
      throw Error("synthetic lost admission acknowledgement");
    }
    return result;
  };
  const response = await f.call();
  assert.equal(response.result.outcome, "held"); assert.equal(response.result.custody, "unknown");
  assert.equal(response.result.statusRequired, true); assert.equal(response.result.retryAuthorized, false);
  assert.equal((response as unknown as AppleData).operationId, f.body.operationId);
  assert.equal((response as unknown as AppleData).intentSha256, f.intent);
  assert.equal(f.calls(), 0); assert.equal(commands.includes("begin"), false);
  assert.equal(f.records.size, boundary === "before" ? 0 : 1);
  const stored = f.records.get(f.body.operationId);
  if (stored) { assert.equal(stored.ownerId, owner); assert.equal(stored.intentSha256, f.intent); assert.equal(stored.state, "admitted"); }
  // A new real factory instance reads only the exact original. No exchange retry.
  const status = { contract: APPLE_CUSTODY, operation: "status", operationId: f.body.operationId, intentSha256: f.intent };
  assert.equal((await f.call(status)).result.custody, boundary === "before" ? "unresolved" : "admitted");
  assert.equal((await f.call({ ...status, intentSha256: "f".repeat(64) })).result.custody, "unresolved");
  assert.equal((await f.call({ ...status, operationId: randomUUID() })).result.custody, "unresolved");
  f.owner(other); assert.equal((await f.call(status)).result.custody, "unresolved");
  assert.equal(commands.filter(action => action === "admit").length, 1);
  assert.equal(commands.filter(action => action === "begin").length, 0); assert.equal(f.calls(), 0);
});
for (const boundary of ["before", "after"]) test(`reused original admission ${boundary} ACK loss retains original status and existing credential`, async () => {
  const f = fixture(); assert.equal((await f.call()).result.outcome, "stored");
  const envelope = structuredClone(f.envelope()), commands: string[] = [], command = f.deps.repository.command;
  const nonce = randomUUID(), code = randomBytes(24).toString("hex"), token = jwt(nonce, code), operationId = randomUUID();
  const intentSha256 = appleIntent(owner, operationId, code, token, nonce, clientId, appleDigest(policy));
  f.deps.repository.command = async (ns, action, body) => {
    commands.push(action);
    if (action === "admit" && boundary === "before") throw Error("synthetic reuse admission loss before commit");
    const result = await command(ns, action, body);
    if (action === "admit") throw Error("synthetic lost reused admission acknowledgement");
    return result;
  };
  const response = await f.call({ ...f.body, nonce, authorizationCode: code, identityToken: token, operationId }, intentSha256);
  assert.equal(response.result.outcome, "held"); assert.equal(response.result.custody, "unknown");
  assert.equal(response.result.statusRequired, true); assert.equal(response.result.retryAuthorized, false);
  assert.equal((response as unknown as AppleData).operationId, operationId);
  assert.equal((response as unknown as AppleData).intentSha256, intentSha256);
  assert.equal(f.records.size, boundary === "before" ? 1 : 2);
  const original = f.records.get(operationId);
  if (original) { assert.equal(original.ownerId, owner); assert.equal(original.intentSha256, intentSha256); assert.equal(original.state, "reused"); }
  const status = await f.call({ contract: APPLE_CUSTODY, operation: "status", operationId, intentSha256 });
  assert.equal(status.result.outcome, boundary === "before" ? "unresolved" : "reused_existing");
  if (boundary === "after") assert.equal(status.result.providerEffect, "none");
  assert.deepEqual(f.envelope(), envelope); assert.equal(f.calls(), 1);
  assert.equal(commands.filter(action => action === "admit").length, 1); assert.equal(commands.includes("begin"), false);
});
for (const mode of ["timeout", "500", "refuse"]) test(`provider ${mode} is not silently retried`, async () => {
  const f = fixture(); f.mode(mode); assert.equal((await f.call()).result.outcome, "held"); await f.call(); assert.equal(f.calls(), 1);
  assert.equal([...f.records.values()][0].state, mode === "refuse" ? "refused" : "started");
});
test("strict body, header, nonce, owner, signature and code-substitution negatives have zero exchange", async () => {
  for (const changes of [{ nonce: "wrong" }, { aud: "foreign" }, { sub: "foreign" }, { exp: now - 1 }, { iss: "https://account.apple.com" }, { c_hash: null }, { c_hash: "wrong" }]) {
    const f = fixture(), t = jwt(f.nonce, f.code, changes), body = { ...f.body, identityToken: t };
    assert.equal((await f.call(body, appleIntent(owner, body.operationId, f.code, t, f.nonce, clientId, appleDigest(policy)))).result.outcome, "held"); assert.equal(f.calls(), 0);
  }
  for (const mutate of [(b: AppleData) => ({ ...b, extra: true }), (b: AppleData) => ({ ...b, operationId: "bad" })]) { const f = fixture(); await f.call(mutate(f.body)); assert.equal(f.calls(), 0); }
  const f = fixture(); assert.equal((await f.call(f.body, "wrong")).result.code, "original_intent_mismatch");
  await f.call('{"operationId":"' + f.body.operationId + '","operationId":"' + f.body.operationId + '"}'); assert.equal(f.calls(), 0);
  const huge = await createAppleTokenCustodyService(f.deps)(f.request(" ".repeat(32769))); assert.equal(huge.status, 413); assert.ok((await huge.json()).result);
});
test("default-off/policy/key failures before effects; safe status does not need a current policy", async () => {
  const f = fixture(); f.deps.enabled = false; assert.equal((await f.call()).status, 503); f.deps.enabled = true;
  const handler = createAppleTokenCustodyService({ ...f.deps, policy: undefined }); assert.equal((await handler(f.request())).status, 503); assert.equal(f.calls(), 0);
  assert.throws(() => inspectApplePolicy({ ...policy, recoverySeconds: 0 }));
});
test("request configuration is immutable across provider awaits; unknown repository errors stay redacted", async () => {
  const f = fixture(), exchange = f.deps.client.exchange;
  f.deps.client.exchange = async () => { f.deps.keyVersion = "changed-mid-request"; return exchange(); };
  assert.equal((await f.call()).result.outcome, "stored");
  assert.equal(f.envelope()?.binding.keyVersion, "test-1");
  const g = fixture(), sensitive = randomBytes(32).toString("hex"); g.deps.repository = { command: async () => ({ error: sensitive }) };
  assert.equal(String((await g.call()).result.code).includes(sensitive), false);
});
test("generated AEAD roundtrip and every immutable AAD dimension rejects swaps without plaintext artifacts", () => {
  const tokens: AppleTokens = { refresh_token: randomBytes(24).toString("base64url"), access_token: randomBytes(24).toString("base64url"), id_token: "synthetic-generated-token", token_type: "Bearer", expires_in: 1 };
  const binding = { origin: "https://fixture.invalid", ownerId: owner, operationId: randomUUID(), intentSha256: "c".repeat(64), clientId, appleIdentityHash: "d".repeat(64), lineageId: randomUUID(), keyVersion: "test-1", policySha256: "e".repeat(64) };
  for (let n = 0; n < 20; n++) { const e = sealAppleTokens(tokens, binding, key); assert.deepEqual(openAppleTokens(e, keyring), tokens); assert.ok(!JSON.stringify(e).includes(tokens.refresh_token)); assert.notEqual(e.iv, sealAppleTokens(tokens, binding, key).iv); }
  const e = sealAppleTokens(tokens, binding, key);
  for (const field of Object.keys(binding)) { const changed = structuredClone(e); (changed.binding as unknown as AppleData)[field] = field.endsWith("Id") ? randomUUID() : field.includes("Hash") || field === "intentSha256" ? "f".repeat(64) : field === "origin" ? "https://foreign.invalid" : "changed"; assert.throws(() => openAppleTokens(changed, keyring)); }
  for (const field of ["iv", "tag", "ciphertext"] as const) { const changed = structuredClone(e); changed[field] = "A" + changed[field].slice(1); if (changed[field] === e[field]) changed[field] = "B" + changed[field].slice(1); assert.throws(() => openAppleTokens(changed, keyring)); }
  assert.throws(() => openAppleTokens(e, new Map()));
});
test("bounded credential JSON preserves long values and rejects duplicate escaped keys and malformed grammar", () => {
  for (const length of [0, 1, 10000, 20480, 65536]) { const input = { a: "x".repeat(length), b: ["escaped\\\"value", null, 1] }; assert.deepEqual(parseAppleJson(JSON.stringify(input)), input); }
  for (const text of ['{"a":"' + "x".repeat(12000) + '","\\u0061":"other"}', '{"a":}', '["a":1]', '"unterminated', '{"a":NaN}']) assert.throws(() => parseAppleJson(text));
});
test("trusted identity hash equals actual unchanged accepted Auth verifier", async () => {
  const user = { id: owner, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: randomUUID(), user_id: owner, provider: "apple", id: "synthetic-subject", created_at: "2026-10-01T00:00:00Z" }] };
  const current = decodeTrustedAppleIdentity(user, owner, "https://fixture.invalid");
  const accepted = await supabaseDeletionAuthV2("https://fixture.invalid", "synthetic", async () => Response.json(user)).verifyIdentity(owner);
  assert.equal(current.identityHash, accepted?.identityHash); assert.throws(() => decodeTrustedAppleIdentity(user, other, "https://fixture.invalid"));
});
test("real Apple client signs exact ES256 secret and fixed form routes; transport ignores no abort indefinitely", async () => {
  const ec = generateKeyPairSync("ec", { namedCurve: "prime256v1" }); let exchanges = 0;
  const fake: typeof fetch = async (url, init) => { assert.equal(String(url), "https://appleid.apple.com/auth/token"); const p = new URLSearchParams(String(init?.body)); const secret = p.get("client_secret")!.split("."); assert.equal(verify("sha256", Buffer.from(secret[0] + "." + secret[1]), { key: ec.publicKey, dsaEncoding: "ieee-p1363" }, Buffer.from(secret[2], "base64url")), true); const claims = JSON.parse(Buffer.from(secret[1], "base64url").toString()); assert.equal(claims.sub, clientId); assert.equal(claims.exp - claims.iat, 60); assert.equal(p.has("redirect_uri"), false); exchanges++; return Response.json({ error: "invalid_grant" }, { status: 400 }); };
  const client = createAppleClient({ clientId, teamId: "TESTTEAM01", keyId: "TESTKEY001", signer: ec.privateKey, secretSeconds: 60, timeoutMs: 30 }, fake);
  assert.equal((await client.exchange(randomBytes(24).toString("hex"))).status, 400); assert.equal(exchanges, 1);
  await assert.rejects(appleHttp("https://fixture.invalid", {}, () => new Promise(() => {}), 1024, 10));
  const f = fixture(); assert.throws(() => verifyAppleIdToken(f.token.replace(/.$/, "!"), keys, { subject: "synthetic-subject", clientId, nonce: f.nonce, now }));
});
