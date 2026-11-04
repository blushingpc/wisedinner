import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { appleDigest } from "./apple-token-custody.server.ts";
import { createCurrentUuidReceiptCleanup, UUID_RECEIPT_CONTRACT, UUID_RECEIPT_RPC, type CurrentUuidReceiptCleanupConfiguration, type CurrentUuidReceiptCleanupInput } from "./current-uuid-receipt-cleanup.server.ts";
const now = Date.now(), H = "a".repeat(64);
function setup() {
  const policy = { approved: true as const, version: "wd-owner-uuid-delete-v1", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
  const input: CurrentUuidReceiptCleanupInput = { userId: randomUUID(), authOperationId: randomUUID(), deletionOperationId: randomUUID(), intentSha256: H, identityHash: H, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(now + 60000).toISOString(), accountRevision: 2, policySha256: appleDigest(policy) };
  const calls: unknown[][] = [];
  const config: CurrentUuidReceiptCleanupConfiguration = { policy, now: () => now, timeoutMs: 50, maxObservationAgeMs: 1000, async rpc(name, body) {
    assert.equal(this, config); calls.push([name, body]);
    const { policy: ignored, ...binding } = body; assert.equal(ignored.version, policy.version);
    return { contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding, removed: 1, remaining: 0, observedAt: new Date(now).toISOString() };
  } };
  return { config, input, calls, policy };
}
test("zero constructor IO; exact concrete RPC and correlated detached receipt, no scope authority", async () => {
  const f = setup(), port = createCurrentUuidReceiptCleanup(f.config); assert.equal(f.calls.length, 0);
  const r = await port.clear(f.input); assert.equal(r.outcome, "cleared"); assert.equal(f.calls.length, 1); assert.equal(f.calls[0][0], UUID_RECEIPT_RPC);
  assert.equal("allowed" in r, false); assert.equal("scope" in r, false); assert.ok(Object.isFrozen(r));
});
test("policy/config methods snapshotted; original receiver preserved without bind/name metadata", async () => {
  const f = setup(); let metadata = 0;
  Object.defineProperty(f.config.rpc, "bind", { get() { metadata++; throw Error(); } });
  delete (f.config.rpc as { name?: string }).name;
  const proto = Object.create(Function.prototype); Object.defineProperty(proto, "name", { get() { metadata++; throw Error(); } }); Object.setPrototypeOf(f.config.rpc, proto);
  const port = createCurrentUuidReceiptCleanup(f.config);
  f.policy.pendingSeconds = 2; Object.assign(f.config, { rpc() { throw Error("replacement"); }, now() { throw Error("replacement"); } });
  assert.equal((await port.clear(f.input)).outcome, "cleared"); assert.equal(metadata, 0);
  assert.equal((f.calls[0][1] as { policy: { pendingSeconds: number } }).policy.pendingSeconds, 600);
});
test("input snapshot survives concurrent caller mutation", async () => {
  const f = setup(); let release!: (v: unknown) => void;
  Object.assign(f.config, { rpc(_name: string, body: CurrentUuidReceiptCleanupInput) { f.calls.push([body]); return new Promise(r => { release = r; }); } });
  const pending = createCurrentUuidReceiptCleanup(f.config).clear(f.input), original = { ...f.input };
  Object.assign(f.input, { userId: randomUUID(), workAttempt: 8 });
  release({ contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding: original, removed: 0, remaining: 0, observedAt: new Date(now).toISOString() });
  assert.equal((await pending).outcome, "cleared"); assert.deepEqual(f.calls[0][0], { ...original, policy: f.policy });
});
for (const field of ["rpc", "now", "policy"]) test("own accessor configuration is inert: " + field, async () => {
  const f = setup(); let reads = 0; Object.defineProperty(f.config, field, { get() { reads++; throw Error(); } });
  assert.deepEqual(await createCurrentUuidReceiptCleanup(f.config).clear(f.input), { outcome: "held" }); assert.equal(reads, 0); assert.equal(f.calls.length, 0);
});
test("inherited ports, proxies and malformed configurations are inert", async () => {
  const f = setup(); let traps = 0;
  for (const c of [Object.create(f.config), new Proxy(f.config, { getPrototypeOf() { traps++; throw Error(); } }), { ...f.config, timeoutMs: 0 }, { ...f.config, policy: { ...f.policy, version: "strict" } }]) assert.equal((await createCurrentUuidReceiptCleanup(c).clear(f.input)).outcome, "held");
  assert.equal(traps, 0); assert.equal(f.calls.length, 0);
});
for (const patch of [{ workAttempt: 0 }, { accountRevision: 1.5 }, { leaseUntil: new Date(now - 1).toISOString() }, { leaseUntil: "2026-02-30T00:00:00Z" }, { policySha256: H }, { userId: "foreign" }, { extra: true }]) test("invalid input has zero RPC: " + JSON.stringify(patch), async () => {
  const f = setup(); assert.equal((await createCurrentUuidReceiptCleanup(f.config).clear({ ...f.input, ...patch })).outcome, "held"); assert.equal(f.calls.length, 0);
});
test("input getter is never evaluated", async () => {
  const f = setup(); let reads = 0; Object.defineProperty(f.input, "identityHash", { get() { reads++; throw Error(); } });
  assert.equal((await createCurrentUuidReceiptCleanup(f.config).clear(f.input)).outcome, "held"); assert.equal(reads, 0); assert.equal(f.calls.length, 0);
});
test("network failure/timeout is unknown and performs no retry", async () => {
  for (const rpc of [async () => { throw Error("private transport error"); }, () => new Promise(() => {})]) {
    const f = setup(); let n = 0; Object.assign(f.config, { timeoutMs: 5, rpc() { n++; return rpc(); } });
    assert.deepEqual(await createCurrentUuidReceiptCleanup(f.config).clear(f.input), { outcome: "unknown" }); assert.equal(n, 1);
  }
});
test("malformed, mismatched, stale and accessor ACKs stay unknown; explicit held remains held", async () => {
  const f = setup(), good = { contract: UUID_RECEIPT_CONTRACT, outcome: "cleared", binding: f.input, removed: 0, remaining: 0, observedAt: new Date(now).toISOString() };
  let getter = 0; const accessor = Object.defineProperty({}, "outcome", { get() { getter++; throw Error(); } });
  for (const raw of [{}, { ...good, extra: true }, { ...good, removed: 2 }, { ...good, remaining: 1 }, { ...good, binding: { ...f.input, workOwner: randomUUID() } }, { ...good, observedAt: new Date(now - 2000).toISOString() }, accessor]) {
    Object.assign(f.config, { async rpc() { return raw; } }); assert.equal((await createCurrentUuidReceiptCleanup(f.config).clear(f.input)).outcome, "unknown");
  }
  assert.equal(getter, 0); Object.assign(f.config, { async rpc() { return { outcome: "held" }; } }); assert.equal((await createCurrentUuidReceiptCleanup(f.config).clear(f.input)).outcome, "held");
});
test("invalid and regressing clocks never manufacture clear", async () => {
  const f = setup(); Object.assign(f.config, { now: () => NaN }); assert.equal((await createCurrentUuidReceiptCleanup(f.config).clear(f.input)).outcome, "held"); assert.equal(f.calls.length, 0);
  let n = 0; Object.assign(f.config, { now: () => n++ === 0 ? now : now - 1 }); assert.equal((await createCurrentUuidReceiptCleanup(f.config).clear(f.input)).outcome, "unknown"); assert.equal(f.calls.length, 1);
});
