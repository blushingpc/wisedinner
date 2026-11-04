import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceSnapshotClockPolicy } from "./generated-source-clock.ts";
import { syntheticV2, op } from "./generated-plan-v2.test-support.ts";
import { createReferencePlanRepositoryV2 } from "./generated-plan-state.ts";
import { createReferenceSessionFactoryV2 } from "./generated-plan-session.ts";

test("server snapshot clock refuses backdating, invalid windows and the exact expiry boundary", () => {
  let now = Date.parse("2026-10-30T12:00:00Z");
  const clock = createReferenceSnapshotClockPolicy("2026-10-30", "2026-10-30", () => now);
  assert.equal(clock.check({ asOfDate: "2026-10-30", planStartDate: "2026-11-02" }), null);
  assert.equal(clock.check({ asOfDate: "2026-10-29" })?.code, "reference_clock_mismatch");
  now = clock.commitBefore - 1; assert.equal(clock.check({ asOfDate: "2026-10-30" }), null);
  now++; assert.equal(clock.check({ asOfDate: "2026-10-30" })?.code, "reference_snapshot_expired");
  now = NaN; assert.equal(clock.check({ asOfDate: "2026-10-30" })?.code, "reference_clock_unavailable");
  assert.throws(() => createReferenceSnapshotClockPolicy("2026-02-31", "2026-10-30"));
  assert.throws(() => createReferenceSnapshotClockPolicy("2026-10-30", "2026-02-31"));
});
test("expiry creates an immutable not-applied receipt without changing a saved week; known receipts survive", async () => {
  const f = syntheticV2(); let expired = false;
  const policy = () => expired ? { outcome: "error" as const, code: "reference_snapshot_expired" } : null;
  const repo = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port, newWeekRequestPolicy: policy });
  const install = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  const saved = await repo.applyPlanCommand(f.scope, install); assert.equal(saved.outcome, "acknowledged");
  const before = await repo.read(f.scope);
  expired = true;
  assert.deepEqual(await repo.applyPlanCommand(f.scope, install), saved);
  const changed = { ...install, kind: "save-current", expectedRevision: 1, operationId: op(2) };
  const blocked = await repo.applyPlanCommand(f.scope, changed);
  assert.deepEqual(blocked, { outcome: "not_applied", operationId: op(2), result: { outcome: "error", code: "reference_snapshot_expired" } });
  assert.deepEqual(await repo.read(f.scope), before);
  assert.deepEqual(await repo.applyPlanCommand(f.scope, changed), blocked);
  assert.equal((await repo.getOperationStatus(f.scope, op(1))).outcome, "committed");
});
test("clock is checked again after computation; retained unknown writes still require original status", async () => {
  const f = syntheticV2(); let calls = 0;
  const repo = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port,
    newWeekRequestPolicy: () => ++calls === 1 ? null : { outcome: "error", code: "reference_snapshot_expired" } });
  const command = { operationId: op(3), kind: "install-current", expectedRevision: 0, weekId: op(101), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  const result = await repo.applyPlanCommand(f.scope, command);
  assert.equal(result.outcome, "not_applied");
  const state = await repo.read(f.scope); assert.equal(state.outcome, "read"); if (state.outcome === "read") assert.equal(state.state.revision, 0);
  const g = syntheticV2(); const uncertain = createReferencePlanRepositoryV2({ planner: g.binding.planner, sourcePolicyBasis: g.binding.sourcePolicyBasis, transactions: g.port });
  g.memory.failOnce("after-commit"); const original = { ...command, operationId: op(4), expectedSourcePolicyBasisSha256: g.binding.sourcePolicyBasis.basisSha256 };
  assert.equal((await uncertain.applyPlanCommand(g.scope, original)).outcome, "unknown");
  assert.equal((await uncertain.applyPlanCommand(g.scope, original)).outcome, "held");
  assert.equal((await uncertain.getOperationStatus(g.scope, op(4))).outcome, "committed");
});
test("prepared factory keeps owner repositories isolated and preserves private protocol flags", async () => {
  const f = syntheticV2(), g = syntheticV2();
  const factory = createReferenceSessionFactoryV2(f.bytes, f.configuration); assert.equal(factory.outcome, "ready"); if (factory.outcome !== "ready") return;
  const a = factory.bind(f.options), b = factory.bind(g.options); assert.equal(a.outcome, "ready"); assert.equal(b.outcome, "ready"); if (a.outcome !== "ready" || b.outcome !== "ready") return;
  const first = await f.send("installCurrent", f.initial, 10, f.binding.sourcePolicyBasis.basisSha256, a);
  assert.equal(first.body.result.outcome, "acknowledged"); assert.equal(first.body.apiAccepted, false); assert.equal(first.body.productionReady, false);
  const second = await g.send("readCurrent", {}, 11, null, b);
  assert.equal(second.body.result.outcome, "read"); assert.equal(second.body.result.state.current, null);
  const closed = factory.bind({ ...f.options, newWeekRequestPolicy: () => ({ outcome: "error", code: "reference_snapshot_expired" }) });
  assert.equal(closed.outcome, "ready"); if (closed.outcome !== "ready") return;
  const plan = await f.send("planJoined", { request: f.request, searchGrid: [] }, 12, f.binding.sourcePolicyBasis.basisSha256, closed);
  assert.equal(plan.body.result.code, "reference_snapshot_expired");
});
