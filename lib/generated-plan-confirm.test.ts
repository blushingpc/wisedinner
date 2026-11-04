import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { op, memoryPort } from "./generated-plan-state.test-support.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";

function fixture() {
  const data = setup(), intent = { assignmentId: data.assignments[0]!.assignmentId, personId: "p1", expectedRecipeSha256: data.assignments[0]!.recipeSha256, replacementRecipeId: "b", sourceServings: { numerator: "3", denominator: "1" } };
  const preview = data.planner.previewReplacement(data.assignments, data.request, intent); if (preview.outcome !== "preview") throw new Error("Expected synthetic preview");
  return { ...data, intent, preview, confirmation: { intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256 } };
}

test("pure replacement confirmation recomputes the preview and returns an unsaved proposal", () => {
  const { planner, assignments, request, confirmation, preview } = fixture(); assert.equal(typeof planner.confirmReplacement, "function");
  const result = planner.confirmReplacement(assignments, request, confirmation); assert.equal(result.outcome, "proposal"); if (result.outcome !== "proposal") return;
  assert.equal(result.saved, false); assert.equal(result.evaluation.assignmentsSha256, preview.after.assignmentsSha256); assert.equal(result.previewSha256, preview.previewSha256);
  for (const previous of preview.before.projection.assignments.slice(1)) assert.deepEqual(result.evaluation.projection.assignments.find(value => value.assignmentId === previous.assignmentId), previous);
});

test("changed request or assignments invalidate a previously valid preview", () => {
  const { planner, assignments, request, confirmation } = fixture();
  assert.deepEqual(planner.confirmReplacement(assignments, { ...request, budgetCents: 9000 }, confirmation), { outcome: "error", code: "stale_replacement_preview" });
  const modified = assignments.map((value, i) => i === 1 ? { ...value, sourceServings: { numerator: "5", denominator: "1" } } : value);
  assert.deepEqual(planner.confirmReplacement(modified, request, confirmation), { outcome: "error", code: "stale_replacement_preview" });
});

test("approval flags, forged hashes and wrong-person intent cannot confirm", () => {
  const { planner, assignments, request, confirmation } = fixture(); let reads = 0;
  const getter = Object.defineProperty({ ...confirmation }, "expectedPreviewSha256", { enumerable: true, get() { reads++; throw new Error("Not read"); } });
  for (const value of [getter, { ...confirmation, approved: true }, { ...confirmation, expectedPreviewSha256: "not-a-hash" }]) assert.equal(planner.confirmReplacement(assignments, request, value).outcome, "error");
  assert.equal(planner.confirmReplacement(assignments, request, { ...confirmation, expectedPreviewSha256: "0".repeat(64) }).outcome, "error");
  assert.equal(planner.confirmReplacement(assignments, request, { ...confirmation, intent: { ...confirmation.intent, personId: "p2" } }).outcome, "error"); assert.equal(reads, 0);
});

test("state confirmation saves only the selected subject with CAS and exact replay", async () => {
  const { planner, assignments, request, confirmation, preview } = fixture(), memory = memoryPort(), scope = issueLocalReferenceScope("confirm-state", 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  const first = await repository.applyPlanCommand(scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments }); assert.equal(first.outcome, "acknowledged");
  const command = { operationId: op(2), kind: "confirm-replacement", expectedRevision: 1, weekId: op(100), ...confirmation }, saved = await repository.applyPlanCommand(scope, command);
  assert.equal(saved.outcome, "acknowledged"); if (saved.outcome !== "acknowledged") return;
  assert.equal(saved.state.revision, 2); assert.equal(saved.state.current!.assignmentsSha256, preview.after.assignmentsSha256); assert.equal(saved.state.current!.quote.estimatedTotalCents.max, 5200);
  assert.deepEqual(await repository.applyPlanCommand(scope, command), saved);
  assert.deepEqual(await repository.applyPlanCommand(scope, { ...command, operationId: op(3) }), { outcome: "error", code: "revision_conflict" });
});

test("known failed confirmation and wrong week preserve acknowledged current state", async () => {
  const { planner, assignments, request, confirmation } = fixture(), memory = memoryPort(), scope = issueLocalReferenceScope("confirm-refusal", 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  const first = await repository.applyPlanCommand(scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments });
  const command = { operationId: op(2), kind: "confirm-replacement", expectedRevision: 1, weekId: op(100), ...confirmation, expectedPreviewSha256: "0".repeat(64) };
  assert.equal((await repository.applyPlanCommand(scope, command)).outcome, "not_applied");
  assert.equal((await repository.applyPlanCommand(scope, { ...command, operationId: op(3), weekId: op(101) })).outcome, "error");
  const after = await repository.read(scope); if (first.outcome === "acknowledged" && after.outcome === "read") assert.deepEqual(after.state, first.state);
});
