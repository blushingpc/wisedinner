import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { setup } from "./generated-joined-plan.test-support.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

const POLICY = "wd-new-week-reconfirm-v1" as const;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonicalReferenceData(value))).digest("hex");
function fixture(name: string, policy = true) {
  const f = setup(), memory = memoryPort(), scope = issueLocalReferenceScope("new-week-" + name, 1);
  const repository = createReferencePlanRepository({ planner: f.planner, transactions: memory.port, ...(policy ? { newWeekPolicy: POLICY } : {}) });
  const initial = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments };
  const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")), pantry: [] };
  const assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "new", date: a.date.replace("2026-10-", "2026-11-") }));
  const draft = { operationId: op(2), kind: "create-week-draft", expectedRevision: 1, weekId: op(101), request, assignments, ...(policy ? { pantryConfirmation: { kind: "reconfirmed", stockSha256: digest(request.pantry) } } : {}) };
  const confirm = { operationId: op(3), kind: "confirm-new-week", expectedRevision: 2, weekId: op(101) };
  return { ...f, memory, scope, repository, initial, draft, confirm };
}

test("new-week policy is opt-in; the existing default retention hold remains", async () => {
  const f = fixture("default", false); await f.repository.applyPlanCommand(f.scope, f.initial); await f.repository.applyPlanCommand(f.scope, f.draft);
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.confirm), { outcome: "held", code: "new_week_retention_policy_required" });
});
test("configured new-week draft requires explicit confirmation of exact pantry stock", async () => {
  const f = fixture("pantry"); await f.repository.applyPlanCommand(f.scope, f.initial);
  const { pantryConfirmation, ...missing } = f.draft; void pantryConfirmation;
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, missing), { outcome: "held", code: "new_week_pantry_reconfirmation_required" });
  const wrong = { ...f.draft, pantryConfirmation: { kind: "reconfirmed", stockSha256: "0".repeat(64) } };
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, wrong), { outcome: "error", code: "pantry_confirmation_mismatch" });
  assert.equal((await f.repository.applyPlanCommand(f.scope, f.draft)).outcome, "acknowledged");
});
test("a new draft preserves current state, and confirmation installs fresh unchecked groceries", async () => {
  const f = fixture("confirm"), installed = await f.repository.applyPlanCommand(f.scope, f.initial);
  assert.equal(installed.outcome, "acknowledged"); if (installed.outcome !== "acknowledged") return;
  const created = await f.repository.applyPlanCommand(f.scope, f.draft);
  assert.equal(created.outcome, "acknowledged"); if (created.outcome !== "acknowledged") return;
  assert.deepEqual(created.state.current, installed.state.current);
  assert.equal(created.state.draft!.shoppingChecks.status, "ready");
  const confirmed = await f.repository.applyPlanCommand(f.scope, f.confirm);
  assert.equal(confirmed.outcome, "acknowledged"); if (confirmed.outcome !== "acknowledged") return;
  assert.equal(confirmed.state.current!.weekId, op(101)); assert.equal(confirmed.state.draft, null); assert.equal(confirmed.state.revision, 3);
  assert.deepEqual((confirmed.state.current!.request as typeof f.request).people, f.request.people);
  assert.deepEqual((confirmed.state.current!.request as typeof f.request).storeIds, f.request.storeIds);
  assert.equal(confirmed.state.current!.shoppingChecks.status, "ready");
  if (confirmed.state.current!.shoppingChecks.status === "ready") assert.ok(confirmed.state.current!.shoppingChecks.rows.every(row => row.checked === false));
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.confirm), confirmed);
});
test("old checked items do not carry into the newly confirmed week", async () => {
  const f = fixture("checks"), installed = await f.repository.applyPlanCommand(f.scope, f.initial);
  if (installed.outcome !== "acknowledged" || installed.state.current!.shoppingChecks.status !== "ready") throw new Error("Expected current");
  const row = installed.state.current!.shoppingChecks.rows[0]!;
  const checked = await f.repository.applyPlanCommand(f.scope, { operationId: op(8), kind: "set-shopping-check", expectedRevision: 1, weekId: op(100), itemKey: row.itemKey, fingerprint: row.fingerprint, checked: true });
  assert.equal(checked.outcome, "acknowledged");
  await f.repository.applyPlanCommand(f.scope, { ...f.draft, expectedRevision: 2 });
  const result = await f.repository.applyPlanCommand(f.scope, { ...f.confirm, expectedRevision: 3 });
  assert.equal(result.outcome, "acknowledged"); if (result.outcome === "acknowledged" && result.state.current!.shoppingChecks.status === "ready") assert.ok(result.state.current!.shoppingChecks.rows.every(row => !row.checked));
});
test("lost new-week acknowledgement reconciles by status without repeating the write", async () => {
  const f = fixture("lost"); await f.repository.applyPlanCommand(f.scope, f.initial); await f.repository.applyPlanCommand(f.scope, f.draft); f.memory.failOnce("after-commit");
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.confirm), { outcome: "unknown", operationId: op(3), statusRequired: true });
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.confirm), { outcome: "held", code: "operation_status_required" });
  assert.equal((await f.repository.getOperationStatus(f.scope, op(3))).outcome, "committed");
  const replay = await f.repository.applyPlanCommand(f.scope, f.confirm); assert.equal(replay.outcome, "acknowledged");
  if (replay.outcome === "acknowledged") assert.equal(replay.state.revision, 3);
});
test("failed confirmation rollback leaves old current and draft available", async () => {
  const f = fixture("rollback"); await f.repository.applyPlanCommand(f.scope, f.initial); const before = await f.repository.applyPlanCommand(f.scope, f.draft); f.memory.failOnce("before-commit");
  assert.equal((await f.repository.applyPlanCommand(f.scope, f.confirm)).outcome, "unknown");
  const read = await f.repository.read(f.scope); if (read.outcome === "read" && before.outcome === "acknowledged") assert.deepEqual(read.state, before.state);
  assert.deepEqual(await f.repository.getOperationStatus(f.scope, op(3)), { outcome: "not_found", operationId: op(3) });
});
test("new-week confirmation refuses stale revisions and a different draft subject", async () => {
  const f = fixture("stale"); await f.repository.applyPlanCommand(f.scope, f.initial); await f.repository.applyPlanCommand(f.scope, f.draft);
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, { ...f.confirm, expectedRevision: 1 }), { outcome: "error", code: "revision_conflict" });
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, { ...f.confirm, weekId: op(102) }), { outcome: "error", code: "week_draft_missing" });
});

test("a pending new-week draft cannot silently revive household settings edited in current week", async () => {
  const f = fixture("settings-change"); await f.repository.applyPlanCommand(f.scope, f.initial); await f.repository.applyPlanCommand(f.scope, f.draft);
  const edited = { ...f.initial, operationId: op(9), kind: "save-current", expectedRevision: 2, request: { ...f.request, budgetCents: 11000 } };
  assert.equal((await f.repository.applyPlanCommand(f.scope, edited)).outcome, "acknowledged");
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, { ...f.confirm, expectedRevision: 3 }), { outcome: "held", code: "new_week_current_settings_changed" });
  const read = await f.repository.read(f.scope); if (read.outcome !== "read") throw new Error("Expected state");
  assert.equal(read.state.current!.weekId, op(100)); assert.equal((read.state.current!.request as typeof f.request).budgetCents, 11000); assert.equal(read.state.draft!.weekId, op(101)); assert.equal(read.state.revision, 3);
});
test("shopping-only changes do not invalidate a household-settings-bound new-week draft", async () => {
  const f = fixture("settings-check"); const first = await f.repository.applyPlanCommand(f.scope, f.initial); await f.repository.applyPlanCommand(f.scope, f.draft);
  if (first.outcome !== "acknowledged" || first.state.current!.shoppingChecks.status !== "ready") throw new Error("Expected current");
  const row = first.state.current!.shoppingChecks.rows[0]!;
  assert.equal((await f.repository.applyPlanCommand(f.scope, { operationId: op(9), kind: "set-shopping-check", expectedRevision: 2, weekId: op(100), itemKey: row.itemKey, fingerprint: row.fingerprint, checked: true })).outcome, "acknowledged");
  assert.equal((await f.repository.applyPlanCommand(f.scope, { ...f.confirm, expectedRevision: 3 })).outcome, "acknowledged");
});

test("an older draft without a household-settings observation cannot invent a confirmation baseline", async () => {
  const f = fixture("missing-settings-binding"); await f.repository.applyPlanCommand(f.scope, f.initial); await f.repository.applyPlanCommand(f.scope, f.draft);
  f.memory.tamperState(state => { const body = structuredClone(state.draft) as unknown as Record<string, unknown>; delete body.contentSha256; delete (body.newWeekPolicy as Record<string, unknown>).currentSettingsSha256; return { ...state, draft: { ...body, contentSha256: digest(body) } as typeof state.draft }; });
  assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.confirm), { outcome: "held", code: "new_week_settings_reconfirmation_required" });
});
