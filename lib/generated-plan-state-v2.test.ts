import test from "node:test";
import assert from "node:assert/strict";
import { syntheticV2, op, hashV2 } from "./generated-plan-v2.test-support.ts";
import { createReferencePlanRepositoryV2, createReferencePlanRepository, issueLocalReferenceScope, issueLocalReferenceScopeV2, revokeLocalReferenceScope, type ReferenceStatePortV2 } from "./generated-plan-state.ts";
test("V2 state persists full original basis/utility and domain-separated content", async () => {
  const f = syntheticV2(), repository = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port });
  const command = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  const result = await repository.applyPlanCommand(f.scope, command); assert.equal(result.outcome, "acknowledged"); if (result.outcome !== "acknowledged") return;
  const saved = result.state.current!; assert.deepEqual(saved.sourcePolicyBasis, f.binding.sourcePolicyBasis); assert.equal(saved.utilityPartition, null);
  assert.equal(result.committedSourcePolicyBasisSha256, f.binding.sourcePolicyBasis.basisSha256);
  const { contentSha256, sourcePolicyBasis, utilityPartition, ...body } = saved;
  assert.equal(contentSha256, hashV2(["wd-joined-session-content-v2", hashV2(body), sourcePolicyBasis.basisSha256, hashV2(utilityPartition)]));
  assert.deepEqual(await repository.applyPlanCommand(f.scope, command), result);
  assert.deepEqual(await repository.applyPlanCommand(f.scope, { ...command, expectedRevision: 1 }), { outcome: "error", code: "idempotency_conflict" });
});
test("V1 and V2 namespace/generation handles cannot cross or resurrect after A-B-A", async () => {
  const f = syntheticV2(), v2 = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port });
  const v1 = createReferencePlanRepository({ planner: f.planner, transactions: f.memory.port });
  const a = issueLocalReferenceScopeV2("same-installation", 1), old = issueLocalReferenceScope("same-installation", 1);
  assert.equal((await v2.read(old)).outcome, "error"); assert.equal((await v1.read(a)).outcome, "error");
  issueLocalReferenceScopeV2("same-installation", 2); assert.equal((await v2.read(a)).outcome, "error");
  assert.throws(() => issueLocalReferenceScopeV2("same-installation", 1));
  assert.equal((await v1.read(old)).outcome, "read"); revokeLocalReferenceScope(old); assert.equal((await v1.read(old)).outcome, "error");
});
test("lost acknowledgement/rollback are status-only until exact status reconciles", async () => {
  const f = syntheticV2(), repository = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port });
  const command = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  f.memory.failOnce("after-commit"); assert.equal((await repository.applyPlanCommand(f.scope, command)).outcome, "unknown");
  assert.deepEqual(await repository.applyPlanCommand(f.scope, command), { outcome: "held", code: "operation_status_required" });
  const status = await repository.getOperationStatus(f.scope, op(1)); assert.equal(status.outcome, "committed");
  f.memory.failOnce("before-commit"); const next = { ...command, operationId: op(2), kind: "save-current", expectedRevision: 1 };
  assert.equal((await repository.applyPlanCommand(f.scope, next)).outcome, "unknown");
  assert.equal((await repository.getOperationStatus(f.scope, op(2))).outcome, "not_found");
  const read = await repository.read(f.scope); assert.equal(read.outcome, "read"); if (read.outcome === "read") assert.equal(read.state.revision, 1);
});
test("stale basis refuses a new command before evaluation/commit", async () => {
  const f = syntheticV2(); let commits = 0;
  const port: ReferenceStatePortV2 = { transaction: body => f.port.transaction(tx => body({ ...tx, async commit(...args) { commits++; await tx.commit(...args); } })) };
  const repository = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: port });
  const result = await repository.applyPlanCommand(f.scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: "a".repeat(64) });
  assert.deepEqual(result, { outcome: "error", code: "stale_source_policy_basis", saved: false }); assert.equal(commits, 0);
});

test("V1-shaped and oversized stored state cannot be migrated or silently accepted as V2", async () => {
  const f = syntheticV2(), repository = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port });
  const command = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  assert.equal((await repository.applyPlanCommand(f.scope, command)).outcome, "acknowledged");
  f.memory.tamperState(state => { const current = state.current! as unknown as Record<string, unknown>; delete current.sourcePolicyBasis; delete current.utilityPartition; const { contentSha256: ignored, ...body } = current; void ignored; current.contentSha256 = hashV2(body); return state; });
  assert.equal((await repository.read(f.scope)).outcome, "error");
  f.memory.tamperState(state => ({ ...state, current: { ...state.current!, request: { padding: Array.from({ length: 1000 }, () => "x".repeat(9000)) } } }));
  assert.deepEqual(await repository.read(f.scope), { outcome: "held", code: "state_capacity_review_required" });
});
