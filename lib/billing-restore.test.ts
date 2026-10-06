import test from "node:test";
import assert from "node:assert/strict";
import { reconcileExplicitRestore, requestExplicitRestore } from "./billing-restore.ts";
import type { RestoreRepository, RestoreProofAdapter } from "./billing-restore.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002", OP = "20000000-0000-4000-8000-000000000001";
const now = 2000000000000;
const scope = { environment: "PRODUCTION" as const, app: "fixture_app", product: "fixture_monthly", entitlement: "fixture_pro" };
function ports() {
  const calls: { action: string; body: Record<string, unknown> }[] = [];
  const i = { ...scope, operation: OP, targetBinding: `wd_${B}`, createdAt: now - 300000, expiresAt: now + 100000, status: "pending", attempt: 0 };
  const proof = { ...scope, operation: OP, targetBinding: i.targetBinding, sourceBinding: `wd_${A}`, store: "app_store", sourceRoot: "a".repeat(64), targetRoot: "a".repeat(64), sourceTransaction: "b".repeat(64), targetTransaction: "c".repeat(64), originalPurchaseAt: now - 86400000, observedAt: now, expiresAt: now + 100000, ownership: "PURCHASED", sourceRevoked: true, state: "active", refunded: false };
  const repository: RestoreRepository = { async execute(action, body) {
    calls.push({ action, body });
    if (action === "read") return { ...i };
    if (action === "claim") { i.status = "leased"; return { status: "leased", attempt: ++i.attempt }; }
    if (action === "hold") { i.status = "held"; return { status: "held", reason: body.reason }; }
    if (action === "prepare") { i.status = "prepared"; return { status: "prepared" }; }
    if (action === "commit") { i.status = "completed"; return { status: "completed" }; }
    if (action === "intent") return body;
    throw Error("unexpected private port");
  } };
  return { i, proof, calls, repository };
}

test("actual private restore module projects verified target only; rejects login, anonymous and client hint authority", async () => {
  const p = ports(); let verifies = 0;
  const deps = { scope, repository: p.repository, verify: async () => { verifies++; return { id: B, token: "unused-synthetic", providers: ["apple"], authenticatedAt: 1 }; } };
  const request = (body: unknown) => new Request("https://fixture.invalid/internal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  for (const hint of [{}, { intent: "login" }, { intent: "access" }, { intent: "restore", sourceOwner: A }, { intent: "restore", verified: true }, { intent: "restore", transactionHash: "a".repeat(64) }, { intent: "restore", entitlement: "chosen" }, { intent: "restore", sdk: true }, { intent: "restore", webhook: true }, { intent: "restore", cache: true }]) await assert.rejects(requestExplicitRestore(request(hint), OP, deps));
  assert.equal(verifies, 0); assert.equal(p.calls.length, 0);
  const r = await requestExplicitRestore(request({ intent: "restore" }), OP, deps);
  assert.deepEqual(r, { operation: OP, target: B, ...scope });
  assert.equal(JSON.stringify(p.calls).includes("unused-synthetic"), false);
  await assert.rejects(requestExplicitRestore(request({ intent: "restore" }), OP, { ...deps, verify: async () => ({ id: B, token: "unused", providers: [], authenticatedAt: null }) }), /verified_account_required/);
});

test("no intent/absent adapter/unavailable observation never prepares, grants or replays vendor actions", async () => {
  const p = ports(); let observations = 0;
  const adapter: RestoreProofAdapter = { async observe() { observations++; throw Error("synthetic timeout"); } };
  const missing = { execute: async () => ({ error: "intent_required" }) };
  assert.equal((await reconcileExplicitRestore(OP, missing, adapter)).reason, "intent_unavailable");
  assert.equal(observations, 0);
  assert.equal((await reconcileExplicitRestore(OP, p.repository)).reason, "proof_unavailable");
  assert.equal((await reconcileExplicitRestore(OP, p.repository, adapter)).reason, "outcome_unknown");
  assert.equal(p.calls.some(c => ["prepare", "commit"].includes(c.action)), false);
});

test("normalized proof time boundary, own scalar facts and exact identity/lineage/scope fail closed", async () => {
  const changes = [
    { operation: A }, { sourceBinding: "anonymous" }, { targetBinding: `wd_${A}` }, { sourceRoot: undefined }, { targetRoot: "d".repeat(64) }, { sourceRoot: NaN },
    { sourceTransaction: "raw" }, { targetTransaction: "raw" }, { ownership: "FAMILY_SHARED" }, { sourceRevoked: false }, { state: "expired" }, { state: "unknown" }, { refunded: true },
    { environment: "SANDBOX" }, { app: "other" }, { product: "other" }, { entitlement: "other" }, { store: "test_store" }, { observedAt: now + 1 }, { observedAt: now - 300001 },
    { originalPurchaseAt: now + 1 }, { originalPurchaseAt: -1 }, { expiresAt: now }, { expiresAt: Infinity }, { verified: true }, { attributes: {} }, { observedAt: 0.5 }
  ];
  for (const delta of changes) {
    const p = ports(); const raw = { ...p.proof, ...delta };
    assert.equal((await reconcileExplicitRestore(OP, p.repository, { observe: async () => raw }, () => now)).reason, "proof_invalid");
    assert.equal(p.calls.some(c => ["prepare", "commit"].includes(c.action)), false);
  }
  for (const observedAt of [now, now - 300000]) {
    const p = ports(); const raw = Object.freeze({ ...p.proof, observedAt });
    assert.equal((await reconcileExplicitRestore(OP, p.repository, { observe: async () => raw }, () => now)).status, "completed");
    assert.deepEqual(p.calls.map(c => c.action), ["read", "claim", "prepare", "commit"]);
    assert.equal(raw.observedAt, observedAt);
  }
  let getters = 0;
  const p = ports(); const raw = { ...p.proof };
  Object.defineProperty(raw, "sourceRoot", { get: () => { getters++; throw Error("do not execute"); } });
  assert.equal((await reconcileExplicitRestore(OP, p.repository, { observe: async () => raw }, () => now)).reason, "proof_invalid");
  assert.equal(getters, 0);
  assert.equal((await reconcileExplicitRestore(OP, ports().repository, { observe: async () => p.proof }, () => NaN)).reason, "proof_invalid");
});

test("uncertain commit is read back without replay; completed retry has zero observation/commit effects", async () => {
  for (const committed of [true, false]) {
    const p = ports(); let observations = 0, commits = 0;
    const repository: RestoreRepository = { execute: async (action, body) => {
      if (action === "commit") { commits++; if (committed) await p.repository.execute(action, body); throw Error("unknown local outcome"); }
      return p.repository.execute(action, body);
    } };
    const adapter = { observe: async () => { observations++; return p.proof; } };
    const r = await reconcileExplicitRestore(OP, repository, adapter, () => now);
    assert.equal(r.status, committed ? "completed" : "held"); assert.equal(commits, 1); assert.equal(observations, 1);
    if (committed) { assert.equal((await reconcileExplicitRestore(OP, repository, adapter, () => now)).status, "completed"); assert.equal(observations, 1); assert.equal(commits, 1); }
    else { assert.equal(r.reason, "outcome_unknown"); assert.equal(p.i.status, "held"); }
  }
});

test("an actually stalled read-only proof observation times out and durably holds without preparing", async () => {
  const p = ports(); let signal: AbortSignal | undefined;
  const result = await reconcileExplicitRestore(OP, p.repository, { observe: async (_i, _mode, s) => { signal = s; return new Promise<never>(() => {}); } }, () => now);
  assert.equal(signal!.aborted, true);
  assert.equal(result.reason, "outcome_unknown"); assert.equal(p.i.status, "held");
  assert.equal(p.calls.some(c => c.action === "prepare" || c.action === "commit"), false);
});
