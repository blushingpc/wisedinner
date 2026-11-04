import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createCurrentOwnerReadService, CURRENT_OWNER_READ_CONTRACT } from "./current-owner-read.server.ts";
import { syntheticV2, op } from "./generated-plan-v2.test-support.ts";
import { createReferenceSessionHandlerV2 } from "./generated-plan-session.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { sourcePolicyHashV2 } from "./generated-source-policy-basis-v2.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import type { CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";

const A = op(701), B = op(702), requestId = op(703);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test-only mutable wire fixtures; full tuples and digests are asserted at the real boundary.
type Data = Record<string, any>;
const canonical = (x: unknown) => canonicalReferenceData(x) as Data;
const key = (id: string) => hash({ protocol: "joined-session-v2", namespace: `wd-current-catalog-1300-v1/${id}` });
function seal(week: Data) {
  const { contentSha256: ignored, sourcePolicyBasis, utilityPartition, ...body } = week; void ignored;
  week.contentSha256 = sourcePolicyHashV2(["wd-joined-session-content-v2", hash(canonical(body)), sourcePolicyBasis.basisSha256, sourcePolicyHashV2(utilityPartition)]);
}
async function fixture() {
  const f = syntheticV2();
  const rows = f.rows.map(row => ({ ...row, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
  const sha = createHash("sha256").update(bytes).digest("hex");
  const request = { ...f.request, slots: ["breakfast", "lunch", "dinner"] };
  const assignments = f.assignments.flatMap(row => request.slots.map(slot => ({ ...row, assignmentId: row.assignmentId + slot, slot })));
  let committedState: unknown, committedOperation: unknown;
  const transactions: typeof f.port = { transaction: body => f.port.transaction(tx => body({ ...tx, async commit(scope, state, operation) { await tx.commit(scope, state, operation); committedState = state; committedOperation = operation; } })) };
  const producer = createReferenceSessionHandlerV2(bytes, { ...f.configuration, sourcePin: { sha256: sha, recordCount: 2 } }, { ...f.options, transactions });
  assert.equal(producer.outcome, "ready"); if (producer.outcome !== "ready") throw Error("fixture producer not ready");
  const original = { ...f.envelope("installCurrent", { ...f.initial, request, assignments }), sourceSha256: sha, expectedSourcePolicyBasisSha256: producer.sourcePolicyBasis.basisSha256 };
  // Use the producer's public digest, not a test-specific hashing convention.
  const { referenceOperationDigest } = await import("./generated-plan-operations.ts");
  const { intentSha256: ignored, ...intent } = original; void ignored; original.intentSha256 = referenceOperationDigest(intent);
  const response = await producer.handle(new Request("https://synthetic.invalid/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(original) }));
  const reply = await response.json(); assert.equal(reply.result.outcome, "acknowledged", JSON.stringify(reply.result));
  let state = canonical(committedState), stored: Data = canonical(committedOperation);
  const revision = 1;
  let owner = A, stateKind = "active", calls = 0, mutateOwner = false, badDigest = false, missing = false;
  const driver: CurrentOwnerRpcDriver = { async call(input) {
    calls++; assert.equal(input.action === "commit", false); assert.equal(input.ownerId, owner); assert.equal(input.accountRevision, revision); assert.equal(input.scopeKey, key(owner));
    const current = owner === A ? state : null, operation = owner === A && !missing ? stored : null;
    if (mutateOwner) owner = B;
    const meta = current ? { revision: current.revision, recordSha256: hash(current) } : null;
    return input.action === "read_state" ? { state: current, meta: badDigest && meta ? { ...meta, recordSha256: "0".repeat(64) } : meta } : { operation, meta, operationRecordSha256: operation ? badDigest ? "0".repeat(64) : hash(operation) : null };
  } };
  const service = createCurrentOwnerReadService({ enabled: true, identity: {
    verify: async () => ({ id: owner, token: "synthetic", authenticatedAt: 1, providers: ["email"] }),
    readAccount: async () => ({ userId: owner, revision, state: stateKind as "active" }),
  }, rpc: driver });
  const metadata = (extra = {}) => ({ contract: CURRENT_OWNER_READ_CONTRACT, operation: "metadata", requestId, target: "current", ...extra });
  const status = (extra = {}) => ({ contract: CURRENT_OWNER_READ_CONTRACT, operation: "operationStatus", requestId, targetOperationId: original.operationId, targetIntentSha256: original.intentSha256, ...extra });
  async function send(body: unknown) { const response = await service(new Request("https://synthetic.invalid/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })); return { status: response.status, body: await response.json() as Data }; }
  return { f, producer, original, service, metadata, status, send, state: () => state, stored: () => stored, setState: (x: Data) => { state = canonical(x); }, setStored: (x: Data) => { stored = canonical(x); }, owner: (id: string) => { owner = id; }, deactivate: () => { stateKind = "deletion_pending"; }, changeDuringRead: () => { mutateOwner = true; }, corruptDigest: () => { badDigest = true; }, missing: () => { missing = true; }, calls: () => calls };
}
function noPrices(value: unknown): void {
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) { assert.doesNotMatch(key, /estimatedLine|packPrice|unitPrice|sourceUrl|factPins|rawReceipt|providerReceipt/); noPrices(child); }
}

test("T1: actual producer serialization: exact 42 tuples, original request/digests and total-only projection", async () => {
  const f = await fixture(), result = (await f.send(f.metadata())).body.result, week = f.state().current;
  assert.equal(result.outcome, "metadata"); assert.equal(result.stateRevision, 1);
  assert.equal(result.week.assignments.length, 42); assert.deepEqual(result.week.assignments, week.assignments); assert.deepEqual(result.week.request, week.request);
  for (const key of ["requestSha256", "assignmentsSha256", "contentSha256", "sourceSha256"]) assert.equal(result.week[key], week[key]);
  assert.deepEqual(result.week.groceries.estimatedTotalCents, week.quote.estimatedTotalCents); noPrices(result);
  assert.equal((await f.send(f.metadata({ target: "draft" }))).body.result.week, null);
});

test("T1 negatives: extra keys, malformed, wrong revision, wrong digest/source/profile and A-B-A", async () => {
  const f = await fixture();
  for (const extra of [{ ownerId: B }, { scopeKey: key(B) }, { unexpected: 1 }, { expectedStateRevision: -1 }, { target: "history" }, { requestId: "bad" }]) assert.equal((await f.send(f.metadata(extra))).status, 400);
  assert.equal((await f.send(f.metadata({ expectedStateRevision: 99 }))).body.result.code, "stale_read");
  f.owner(B); assert.equal((await f.send(f.metadata())).body.result.week, null); f.owner(A); assert.equal((await f.send(f.metadata())).body.result.week.assignments.length, 42);
  const original = structuredClone(f.state());
  for (const change of [(w: Data) => { w.sourceSha256 = "0".repeat(64); }, (w: Data) => { w.assignments[0].profileRevision++; seal(w); }, (w: Data) => { w.requestSha256 = "0".repeat(64); seal(w); }, (w: Data) => { w.assignmentsSha256 = "0".repeat(64); seal(w); }, (w: Data) => { w.assignments[0].sourceServings.numerator = "NaN"; seal(w); }]) {
    const bad = structuredClone(original); change(bad.current); f.setState(bad); assert.equal((await f.send(f.metadata())).body.result.outcome, "held");
  }
  f.setState(original); f.corruptDigest(); assert.equal((await f.send(f.metadata())).body.result.code, "owner_read_unavailable");
});

test("T1: changing identity in flight and inactive owner never release another owner's metadata", async () => {
  const f = await fixture(); f.changeDuringRead(); assert.equal((await f.send(f.metadata())).body.result.code, "owner_changed_during_read");
  const inactive = await fixture(); inactive.deactivate(); assert.equal((await inactive.send(inactive.metadata())).body.result.code, "owner_inactive"); assert.equal(inactive.calls(), 0);
  const deny = createCurrentOwnerReadService({ enabled: true, identity: { verify: async () => { throw { status: 401 }; }, readAccount: async () => { throw Error("not called"); } }, rpc: { call: async () => { throw Error("not called"); } } });
  assert.equal((await (await deny(new Request("https://synthetic.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(inactive.metadata()) }))).json()).result.code, "owner_session_invalid");
});

test("T2: exact older receipt survives later state/source; unknown and unavailable source never authorize retry", async () => {
  const f = await fixture(), later = structuredClone(f.state()); later.revision = 9; f.setState(later);
  const result = (await f.send(f.status({ originalEnvelope: f.original }))).body.result;
  assert.equal(result.saved, true); assert.equal(result.state.revision, 1); assert.equal(result.sourceBinding.sourceSha256, f.original.sourceSha256); assert.equal(result.retryAuthorized, false); noPrices(result);
  assert.equal((await f.send(f.status({ targetIntentSha256: "0".repeat(64) }))).body.result.code, "original_intent_mismatch");
  const forged = { ...f.original, sourceSha256: "0".repeat(64) }; assert.equal((await f.send(f.status({ originalEnvelope: forged }))).status, 400);
  f.setStored({ operationId: f.original.operationId, intentSha256: f.original.intentSha256, receipt: { outcome: "not_applied", operationId: f.original.operationId, result: { outcome: "held", reasons: [{ code: "source_old", packPriceCents: 999 }], providerReceipt: "must-not-leak" } } });
  const held = (await f.send(f.status())).body.result; assert.equal(held.saved, false); assert.equal(held.sourceBinding.code, "source_binding_unavailable"); noPrices(held);
  const bound = (await f.send(f.status({ originalEnvelope: f.original }))).body.result; assert.equal(bound.sourceBinding.status, "verified-original-envelope");
  f.missing(); const absent = (await f.send(f.status())).body.result; assert.equal(absent.disposition, "unresolved"); assert.equal(absent.retryAuthorized, false); assert.equal(absent.saved, undefined);
});

test("T3: actual request parser refuses duplicate keys, malformed UTF8 and capacity with defined result", async () => {
  const f = await fixture();
  for (const body of ['{"contract":"a","contract":"b"}', '{"x":NaN}', '{}', '{']) {
    const response = await f.service(new Request("https://synthetic.invalid", { method: "POST", headers: { "content-type": "application/json" }, body })); assert.equal(response.status, 400); assert.ok((await response.json()).result);
  }
  const response = await f.service(new Request("https://synthetic.invalid", { method: "POST", headers: { "content-type": "application/json", "content-length": String(8 * 1024 * 1024 + 1) }, body: "{}" }));
  assert.equal(response.status, 413); assert.equal((await response.json()).result.code, "body_capacity_exceeded");
  const huge = await f.service(new Request("https://synthetic.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: " ".repeat(8 * 1024 * 1024 + 1) })); assert.equal(huge.status, 413); assert.ok((await huge.json()).result);
  const utf8 = await f.service(new Request("https://synthetic.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: new Uint8Array([255]) })); assert.equal(utf8.status, 400);
});

test("T2/T3: oversized RPC response and invalid saved render keep uniform results and original commit truth", async () => {
  const f = await fixture(), original = structuredClone(f.stored());
  const broken = structuredClone(original); broken.receipt.state.current.contentSha256 = "0".repeat(64); f.setStored(broken);
  const result = (await f.send(f.status())).body.result;
  assert.equal(result.outcome, "held"); assert.equal(result.saved, true); assert.equal(result.disposition, "acknowledged"); assert.equal(result.retryAuthorized, false);
  // Above both existing RPC response and endpoint response ceilings. The existing
  // strict RPC ingress refuses first, so the outer endpoint returns a bounded
  // held envelope. No cap is raised and no undefined result escapes.
  const huge = { ...original, receipt: { outcome: "not_applied", operationId: original.operationId, result: { outcome: "held", reasons: Array.from({ length: 1800 }, () => "x".repeat(10000)) } } };
  const service = createCurrentOwnerReadService({ enabled: true, identity: { verify: async () => ({ id: A, token: "synthetic", authenticatedAt: 1, providers: ["email"] }), readAccount: async () => ({ userId: A, state: "active", revision: 1 }) }, rpc: { call: async () => ({ meta: null, operation: huge, operationRecordSha256: hash(canonical(huge)) }) } });
  const response = await service(new Request("https://synthetic.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f.status()) }));
  const body = await response.json(); assert.equal(body.requestId, requestId); assert.equal(body.result.outcome, "held"); assert.equal(body.result.saved, undefined); assert.equal(body.result.statusRequired, true); assert.equal(body.result.code, "owner_read_unavailable");
  const changed = await fixture(); changed.changeDuringRead(); changed.corruptDigest(); const denied = (await changed.send(changed.status())).body.result; assert.equal(denied.code, "owner_changed_during_read"); assert.equal(denied.saved, undefined);
});
