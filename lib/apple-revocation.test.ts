import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import { createAppleRevocationProvider, createAppleCustodyDeletionPorts } from "./apple-revocation.server.ts";
import { sealAppleTokens } from "./apple-token-custody.server.ts";
import type { AppleData, AppleRepository } from "./apple-token-custody.server.ts";

function fixture(count = 2) {
  const userId = randomUUID(), identityHash = "a".repeat(64), target = { userId, identityHash, operationId: randomUUID() }, key = randomBytes(32), keyring = new Map([["test", key]]);
  const credentials = Array.from({ length: count }, () => { const lineageId = randomUUID(); return { lineageId, envelope: sealAppleTokens({ refresh_token: randomBytes(24).toString("hex"), access_token: randomBytes(24).toString("hex"), id_token: "synthetic", token_type: "Bearer", expires_in: 1 }, { origin: "https://fixture.invalid", ownerId: userId, operationId: randomUUID(), intentSha256: "b".repeat(64), clientId: "fixture.native", appleIdentityHash: randomBytes(32).toString("hex"), lineageId, keyVersion: "test", policySha256: "c".repeat(64) }, key) }; });
  const states = new Map<string, string>(credentials.map(x => [x.lineageId, "admitted"])); let taken = false, calls = 0, mode = "success", currentHash = identityHash, unknownHistory = false;
  const repo: AppleRepository = { async command(ns, action, b) {
    assert.equal(ns, "revocation"); assert.equal(b.userId, userId); assert.equal(b.operationId, target.operationId);
    if (action === "snapshot_original") { if (taken) return { fresh: false }; taken = true; return { fresh: true, credentials }; }
    if (action === "begin_original") { const old = states.get(String(b.lineageId)); if (old !== "admitted") return { fresh: false }; states.set(String(b.lineageId), "started"); return { fresh: true }; }
    if (action === "record_original") { states.set(String(b.lineageId), String(b.outcome)); return {}; }
    if (action === "status_original") return { complete: !unknownHistory && count > 0 && [...states.values()].every(x => x === "confirmed"), unknown: unknownHistory || [...states.values()].some(x => ["started", "admitted", "unknown"].includes(x)), refused: [...states.values()].includes("refused"), evidenceHash: "d".repeat(64) };
    throw Error("unexpected command");
  } };
  const deps = { repository: repo, keyring, timeoutMs: 100, verifyIdentity: async () => ({ userId, identityHash: currentHash, evidenceHash: "e".repeat(64), apple: "none" as const }), client: { clientId: "fixture.native", keys: async () => ({}), exchange: async () => ({ status: 400, value: {} }), revoke: async () => { calls++; if (mode === "timeout") throw Error("synthetic timeout"); return mode !== "refuse"; } } };
  return { target, deps, credentials, states, calls: () => calls, mode: (m: string) => mode = m, change: () => currentHash = "f".repeat(64), unknown: () => unknownHistory = true };
}
test("all historical owned lineages revoke after unlink; duplicate run/reconcile never resend", async () => {
  const f = fixture(), p = createAppleRevocationProvider(f.deps); assert.equal((await p.run(f.target)).outcome, "confirmed"); assert.equal(f.calls(), 2);
  assert.equal((await p.run(f.target)).outcome, "confirmed"); assert.equal((await p.reconcile!(f.target)).outcome, "confirmed"); assert.equal(f.calls(), 2);
});
for (const mode of ["timeout", "refuse"]) test(`Apple ${mode} preserves original nonactive ciphertext and uncertainty`, async () => {
  const f = fixture(); f.mode(mode); const p = createAppleRevocationProvider(f.deps); assert.equal((await p.run(f.target)).outcome, mode === "refuse" ? "failed" : "unknown");
  assert.ok(f.credentials.every(x => x.envelope.ciphertext)); await p.reconcile!(f.target); await p.run(f.target); assert.equal(f.calls(), 2);
});
test("foreign/tampered/old-key/current-hash/unknown inventory cannot count as all-token success", async () => {
  for (const kind of ["foreign", "tamper", "key", "source", "unknown", "client"]) {
    const f = fixture(1); if (kind === "foreign") f.credentials[0].envelope.binding.ownerId = randomUUID(); if (kind === "tamper") f.credentials[0].envelope.tag = "A".repeat(22); if (kind === "key") f.deps.keyring.clear(); if (kind === "source") f.change(); if (kind === "unknown") f.unknown();
    if (kind === "client") f.deps.client.clientId = "foreign.client";
    assert.equal((await createAppleRevocationProvider(f.deps).run(f.target)).outcome, "unknown"); assert.equal(f.calls(), kind === "unknown" ? 1 : 0);
  }
});
test("effective-linkage pair preserves actual identityHash and supplies basis only to atomic original admit", async () => {
  for (const history of ["empty", "present", "unknown"]) {
    const userId = randomUUID(), current = { userId, identityHash: "a".repeat(64), evidenceHash: "b".repeat(64), apple: "none" as const }; let admitted: AppleData | undefined;
    const pair = createAppleCustodyDeletionPorts({ repository: { command: async (_ns, action, body) => action === "effective_basis" ? { history, revision: 0, inventoryHash: "c".repeat(64), provenance: "complete-private-registry-v1" } : (admitted = body, { outcome: "admitted" }) }, original: { account: async () => ({}), worker: async () => ({}) }, verifyIdentity: async () => current, auth: { run: async t => ({ ...t, outcome: "unknown", evidenceHash: "d".repeat(64) }) }, apple: { run: async t => ({ ...t, outcome: "unknown", evidenceHash: "e".repeat(64) }) } });
    const effective = await pair.providers.verifyIdentity(userId); assert.equal(effective?.identityHash, current.identityHash); assert.equal(effective?.apple, history === "empty" ? "none" : "linked");
    await pair.repository.worker("admit", { userId, identityHash: current.identityHash, identityEvidence: effective!.evidenceHash, appleLinkage: effective!.apple }); assert.ok(admitted?.basis);
  }
});
test("whole revocation budget bounds an unresponsive repository", async () => {
  const f = fixture(1);
  const hanging = createAppleRevocationProvider({ ...f.deps, timeoutMs: 10, repository: { command: async () => new Promise(() => {}) } });
  const outcome = await Promise.race([hanging.run(f.target).then(x => x.outcome), new Promise(resolve => setTimeout(() => resolve("unbounded"), 200))]);
  assert.equal(outcome, "unknown"); assert.equal(f.calls(), 0);
});
test("late original begin acknowledgement cannot authorize a provider call after deadline", async () => {
  const f = fixture(1), original = f.deps.repository;
  const repository: AppleRepository = { command: async (ns, action, body) => { if (action === "begin_original") await new Promise(resolve => setTimeout(resolve, 40)); return original.command(ns, action, body); } };
  const p = createAppleRevocationProvider({ ...f.deps, timeoutMs: 10, repository });
  assert.equal((await p.run(f.target)).outcome, "unknown"); await new Promise(resolve => setTimeout(resolve, 70)); assert.equal(f.calls(), 0);
});
