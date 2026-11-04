import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { issueLocalReferenceScope, revokeLocalReferenceScope } from "./generated-plan-state.ts";
import { setup } from "./generated-joined-plan.test-support.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

const labels = [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }];
let serial = 0;
function fixture() {
  const f = setup(), memory = memoryPort(), scope = issueLocalReferenceScope("session-test-" + serial++, 1);
  const binding = createReferenceSessionHandler(f.bytes, f.configuration, { labels, transactions: memory.port, resolveScope: () => scope, newWeekPolicy: "wd-new-week-reconfirm-v1" });
  if (binding.outcome !== "ready") throw new Error("Expected binding");
  const bound = binding;
  function envelope(operation: string, payload: unknown, id = 1, override = {}) { const intent = { contract: REFERENCE_SESSION_CONTRACT, operation, operationId: op(id), sourceSha256: f.configuration.sourcePin.sha256, payload, ...override }; return { ...intent, intentSha256: referenceOperationDigest(intent) }; }
  async function send(operation: string, payload: unknown, id = 1, override = {}) { const response = await bound.handle(new Request("http://private.invalid/session", { method: "POST", body: JSON.stringify(envelope(operation, payload, id, override)), headers: { "content-type": "application/json" } })); return { status: response.status, body: await response.json(), headers: response.headers }; }
  const initial = { weekId: op(100), expectedRevision: 0, request: f.request, assignments: f.assignments, pantryEntries: [] };
  return { ...f, memory, scope, bound, envelope, send, initial };
}
test("composed boundary persists once, replays receipts and exposes no ingredient prices", async () => {
  const f = fixture(), result = await f.send("installCurrent", f.initial);
  assert.equal(result.body.result.outcome, "acknowledged"); assert.equal(result.body.result.state.revision, 1);
  assert.equal(result.body.result.state.current.view.outcome, "saved-week");
  assert.equal(result.body.result.state.current.view.meals.length, 14);
  assert.equal(result.body.apiAccepted, false); assert.equal(result.body.productionReady, false);
  const replay = await f.send("installCurrent", f.initial); assert.deepEqual(replay.body, result.body);
  for (const key of ["packPriceCents", "estimatedLineCents", "factPins", "intentSha256Internal"]) assert.equal(JSON.stringify(result.body.result).includes('"' + key + '"'), false);
  assert.equal(result.headers.get("cache-control"), "no-store");
  assert.equal((await f.send("operationStatus", { targetOperationId: op(1) }, 2)).body.result.outcome, "committed");
});
test("lost acknowledgement and rollback recover by the exact request operation ID", async () => {
  const f = fixture(); f.memory.failOnce("after-commit");
  const lost = await f.send("installCurrent", f.initial); assert.equal(lost.body.result.outcome, "unknown");
  assert.equal((await f.send("installCurrent", f.initial)).body.result.code, "operation_status_required");
  const status = await f.send("operationStatus", { targetOperationId: op(1) }, 2); assert.equal(status.body.result.outcome, "committed"); assert.equal(status.body.result.receipt.state.revision, 1);
  const next = { ...f.initial, expectedRevision: 1 }; f.memory.failOnce("before-commit");
  assert.equal((await f.send("saveCurrent", next, 3)).body.result.outcome, "unknown");
  assert.equal((await f.send("operationStatus", { targetOperationId: op(3) }, 4)).body.result.outcome, "not_found");
  assert.equal((await f.send("readCurrent", {}, 5)).body.result.state.revision, 1);
});
test("stale and changed-intent writes cannot replace current state", async () => {
  const f = fixture(); await f.send("installCurrent", f.initial);
  assert.equal((await f.send("saveCurrent", f.initial, 2)).body.result.code, "revision_conflict");
  assert.equal((await f.send("installCurrent", { ...f.initial, expectedRevision: 1 })).body.result.code, "idempotency_conflict");
});
test("no fit, Unknown, unsupported pantry and bad digests are explicit and unsaved", async () => {
  const f = fixture();
  assert.equal((await f.send("installCurrent", { ...f.initial, request: { ...f.request, budgetCents: 1 } })).body.result.outcome, "not_applied");
  const unknown = { ...f.request, people: [{ ...f.request.people[0], proteinGoal: { kind: "unknown" } }, f.request.people[1]] };
  assert.equal((await f.send("installCurrent", { ...f.initial, request: unknown }, 2)).body.result.result.outcome, "held");
  assert.equal((await f.send("installCurrent", { ...f.initial, pantryEntries: [{ id: "unbound" }] }, 3)).body.result.code, "pantry_intake_not_configured");
  const bad = f.envelope("readCurrent", {}); bad.intentSha256 = "0".repeat(64);
  const response = await f.bound.handle(new Request("http://private.invalid", { method: "POST", body: JSON.stringify(bad), headers: { "content-type": "application/json" } })); assert.equal(response.status, 409);
  assert.equal((await f.send("readCurrent", {}, 4)).body.result.state.current, null);
});
test("new-week request and confirmation use the same durable boundary", async () => {
  const f = fixture(); await f.send("installCurrent", f.initial);
  const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "n", date: a.date.replace("2026-10-", "2026-11-") }));
  const payload = { ...f.initial, expectedRevision: 1, weekId: op(101), request, assignments, pantryReconfirmed: true };
  assert.equal((await f.send("createWeekDraft", { ...payload, pantryReconfirmed: false }, 2)).body.result.code, "new_week_pantry_reconfirmation_required");
  const created = await f.send("createWeekDraft", payload, 2); assert.equal(created.body.result.state.current.weekId, op(100));
  const confirmed = await f.send("confirmNewWeek", { expectedRevision: 2, weekId: op(101) }, 3); assert.equal(confirmed.body.result.state.current.weekId, op(101)); assert.equal(confirmed.body.result.state.draft, null);
});
test("pure evaluation is composed without pretending it is saved", async () => {
  const f = fixture(), result = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments });
  assert.equal(result.body.result.outcome, "week-proposal"); assert.equal(result.body.result.saved, false);
  assert.equal((await f.send("readCurrent", {}, 2)).body.result.state.current, null);
});
test("missing, revoked and unavailable trusted scope fail closed without JSON grants", async () => {
  const f = fixture(); revokeLocalReferenceScope(f.scope);
  const revoked = await f.send("readCurrent", {}); assert.notEqual(revoked.body.result.outcome, "read");
  const unbound = createReferenceSessionHandler(f.bytes, f.configuration, { labels, transactions: f.memory.port });
  assert.equal(unbound.outcome, "ready"); if (unbound.outcome !== "ready") return;
  const response = await unbound.handle(new Request("http://private.invalid", { method: "POST", body: JSON.stringify(f.envelope("readCurrent", {})), headers: { "content-type": "application/json" } })); assert.equal(response.status, 503);
  assert.equal((await f.send("readCurrent", {}, 4, { authorized: true })).status, 400);
});

test("changed price basis never silently replaces a saved receipt's displayed grocery estimate", async () => {
  const f = fixture(); await f.send("installCurrent", f.initial);
  const configuration = structuredClone(f.configuration); configuration.regionalPackFacts[0]!.packPriceCents.max += 10;
  const changed = createReferenceSessionHandler(f.bytes, configuration, { labels, transactions: f.memory.port, resolveScope: () => f.scope });
  if (changed.outcome !== "ready") throw new Error("Expected revised binding");
  const response = await changed.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f.envelope("operationStatus", { targetOperationId: op(1) }, 9)) }));
  const result = (await response.json()).result;
  assert.equal(result.outcome, "committed"); assert.equal(result.receipt.saved, true);
  assert.equal(result.receipt.state.current.view.code, "saved_view_basis_changed");
});

test("JSON ordering and repeated receipt reads preserve acknowledged state across a bounded domain", async () => {
  const f = fixture(), first = await f.send("installCurrent", f.initial);
  for (let i = 0; i < 16; i++) {
    const intent = f.envelope("installCurrent", f.initial), keys = Object.keys(intent), ordered = Object.fromEntries([...keys.slice(i % keys.length), ...keys.slice(0, i % keys.length)].reverse().map(k => [k, intent[k as keyof typeof intent]]));
    const response = await f.bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(ordered) }));
    assert.deepEqual((await response.json()).result, first.body.result);
  }
});

test("duplicate JSON keys and a pre-aborted request cannot mutate the repository", async () => {
  const f = fixture(), original = JSON.stringify(f.envelope("readCurrent", {}));
  const duplicate = original.replace('"payload":{}', '"payload":{},"paylo\\u0061d":{}');
  const response = await f.bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: duplicate })); assert.equal(response.status, 400);
  const abort = new AbortController(); abort.abort();
  const stopped = await f.bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f.envelope("installCurrent", f.initial)), signal: abort.signal })); assert.equal(stopped.status, 499);
  assert.equal((await f.send("readCurrent", {}, 10)).body.result.state.current, null);
});

test("caller price mutation cannot split pure proposal and durable save configuration", async () => {
  const f = fixture(), before = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments });
  f.configuration.regionalPackFacts[0]!.packPriceCents.max = 2000;
  const after = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments }, 2);
  assert.deepEqual(after.body.result.groceries.estimatedTotalCents, before.body.result.groceries.estimatedTotalCents);
  const saved = await f.send("installCurrent", f.initial, 3);
  assert.deepEqual(saved.body.result.state.current.view.groceries.estimatedTotalCents, after.body.result.groceries.estimatedTotalCents);
  assert.equal(Object.isFrozen(f.configuration), false);
});
test("session pure operations retain their original catalog snapshot after caller bytes change", async () => {
  const f = fixture(), before = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments });
  f.bytes.fill(0);
  const after = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments }, 2);
  assert.deepEqual(after.body.result, before.body.result);
  assert.equal((await f.send("installCurrent", f.initial, 3)).body.result.outcome, "acknowledged");
});
