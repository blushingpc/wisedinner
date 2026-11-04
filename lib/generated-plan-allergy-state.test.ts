import test from "node:test";
import assert from "node:assert/strict";
import { allergySetup } from "./generated-plan-household-allergies.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

let serial = 0;
function fixture() {
  const f = allergySetup(false), memory = memoryPort(), scope = issueLocalReferenceScope("allergy-state-" + serial++, 1);
  const repository = createReferencePlanRepository({ planner: f.planner, transactions: memory.port, newWeekPolicy: "wd-new-week-reconfirm-v1" });
  const install = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments };
  return { ...f, memory, scope, repository, install };
}
function revised(f: ReturnType<typeof fixture>) {
  const configuration = structuredClone(f.configuration); configuration.householdAllergies.ingredientFacts[0]!.sourceSha256 = "e".repeat(64);
  const bound = createJoinedReferencePlanner(f.bytes, configuration); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw Error("Synthetic revised source review");
  return { configuration, planner: bound.planner, repository: createReferencePlanRepository({ planner: bound.planner, transactions: f.memory.port, newWeekPolicy: "wd-new-week-reconfirm-v1" }) };
}

test("allergy review basis survives a durable save and repository reopen", async () => {
  const f = fixture(), evaluation = f.planner.evaluateJoined(f.assignments, f.request); assert.equal(evaluation.outcome, "success");
  const saved = await f.repository.applyPlanCommand(f.scope, f.install); assert.equal(saved.outcome, "acknowledged"); if (saved.outcome !== "acknowledged" || evaluation.outcome !== "success") return;
  assert.equal((saved.state.current as unknown as { allergyBasisSha256: string }).allergyBasisSha256, evaluation.allergyBasisSha256);
  const reopen = createReferencePlanRepository({ planner: f.planner, transactions: f.memory.port });
  const read = await reopen.read(f.scope); assert.equal(read.outcome, "read"); if (read.outcome === "read") assert.deepEqual(read.state.current, saved.state.current);
});

test("changed review proof cannot silently mutate shopping checks on a saved allergy plan", async () => {
  const f = fixture(), saved = await f.repository.applyPlanCommand(f.scope, f.install); assert.equal(saved.outcome, "acknowledged"); if (saved.outcome !== "acknowledged") return;
  const checks = saved.state.current!.shoppingChecks; assert.equal(checks.status, "ready"); if (checks.status !== "ready") return;
  const row = checks.rows[0]!;
  const next = revised(f), result = await next.repository.applyPlanCommand(f.scope, { operationId: op(2), kind: "set-shopping-check", expectedRevision: 1, weekId: op(100), itemKey: row.itemKey, fingerprint: row.fingerprint, checked: true });
  assert.deepEqual(result, { outcome: "held", code: "saved_allergy_basis_changed" });
  const state = await f.repository.read(f.scope); assert.equal(state.outcome, "read"); if (state.outcome === "read") assert.equal(state.state.revision, 1);
});

test("changed review proof invalidates a new-week draft, preserving the current week", async () => {
  const f = fixture(); await f.repository.applyPlanCommand(f.scope, f.install);
  const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "new", date: a.date.replace("2026-10-", "2026-11-") }));
  const created = await f.repository.applyPlanCommand(f.scope, { operationId: op(2), kind: "create-week-draft", expectedRevision: 1, weekId: op(101), request, assignments, pantryConfirmation: { kind: "reconfirmed", stockSha256: referenceOperationDigest([]) } });
  assert.equal(created.outcome, "acknowledged");
  const result = await revised(f).repository.applyPlanCommand(f.scope, { operationId: op(3), kind: "confirm-new-week", expectedRevision: 2, weekId: op(101) });
  assert.deepEqual(result, { outcome: "error", code: "stale_week_draft" });
  const state = await f.repository.read(f.scope); if (state.outcome === "read") assert.equal(state.state.current!.weekId, op(100));
});

test("actual session read/status retain known commit but hold a view with changed allergy evidence", async () => {
  const f = fixture(), labels = [{ skuId: "buy-a", displayName: "Synthetic A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Synthetic B", aisle: "Pantry" }];
  function client(configuration = f.configuration) {
    const b = createReferenceSessionHandler(f.bytes, configuration, { labels, transactions: f.memory.port, resolveScope: () => f.scope }); assert.equal(b.outcome, "ready"); if (b.outcome !== "ready") throw Error("Synthetic session");
    return async (operation: string, payload: unknown, id: number) => { const input = { contract: REFERENCE_SESSION_CONTRACT, operation, operationId: op(id), sourceSha256: f.configuration.sourcePin.sha256, payload }; const response = await b.handle(new Request("http://private.invalid/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...input, intentSha256: referenceOperationDigest(input) }) })); return (await response.json()).result; };
  }
  const send = client(); f.memory.failOnce("after-commit");
  const initial = { expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, pantryEntries: [] };
  assert.equal((await send("installCurrent", initial, 1)).outcome, "unknown");
  const current = await send("operationStatus", { targetOperationId: op(1) }, 2); assert.equal(current.outcome, "committed"); assert.equal(current.receipt.state.current.view.outcome, "saved-week");
  const changed = client(revised(f).configuration), read = await changed("readCurrent", {}, 3); assert.equal(read.outcome, "read"); assert.equal(read.state.current.view.code, "saved_view_basis_changed");
  const status = await changed("operationStatus", { targetOperationId: op(1) }, 4); assert.equal(status.outcome, "committed"); assert.equal(status.receipt.saved, true); assert.equal(status.receipt.state.current.view.code, "saved_view_basis_changed");
});
