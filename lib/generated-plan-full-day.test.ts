import test from "node:test";
import assert from "node:assert/strict";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { createReferenceOperationHandler, referenceOperationDigest } from "./generated-plan-operations.ts";
import { op } from "./generated-plan-state.test-support.ts";

function fixture(policy = true) {
  const f = setup(), rows = f.rows.map(row => ({ ...row, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n"), configuration = { ...f.configuration, sourcePin: { sha256: sha(bytes), recordCount: rows.length }, ...(policy ? { schedulePolicy: "wd-seven-day-three-meals-v1" } : {}) };
  const binding = createJoinedReferencePlanner(bytes, configuration); if (binding.outcome !== "ready") throw new Error("Expected binding");
  const request = { ...f.request, budgetCents: 50000, slots: ["breakfast", "lunch", "dinner"], people: f.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, coverage: "full-day" } })) };
  const assignments = f.assignments.flatMap(a => request.slots.map(slot => ({ ...a, assignmentId: a.assignmentId + slot, slot })));
  return { ...f, bytes, configuration, planner: binding.planner, request, assignments };
}
test("explicit full-day policy evaluates all42 person meals without relabelling targets", () => {
  const f = fixture(), result = f.planner.evaluateJoined(f.assignments, f.request);
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.projection.assignments.length, 42); assert.equal(result.projection.personDays.length, 14);
  assert.equal(result.fullDayCoverage?.policy, "wd-seven-day-three-meals-v1");
  assert.ok(result.projection.assignments.every(a => f.request.people.some(p => p.personId === a.personId)));
});
test("unconfigured planner preserves the old full-day policy hold", () => {
  const f = fixture(false), result = f.planner.evaluateJoined(f.assignments, f.request);
  assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.reasons.some(r => r.code === "goal_coverage_policy_required"));
});
test("full-day binding refuses reduced days slots or selected-meal target semantics", () => {
  const f = fixture();
  for (const request of [{ ...f.request, selectedDays: f.request.selectedDays.slice(1) }, { ...f.request, slots: ["dinner"] }, { ...f.request, people: f.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, coverage: "selected-meals" } })) }]) {
    const result = f.planner.evaluateJoined(f.assignments, request); assert.equal(result.outcome, "held");
  }
});
test("full-day policy does not suppress Unknown calorie or exclusion holds", () => {
  const f = fixture();
  for (const patch of [{ proteinGoal: { kind: "unknown" } }, { calorieGoal: { kind: "known", kcalPerDay: "2100", coverage: "full-day" } }, { exclusions: { kind: "unmapped", text: "custom ingredient" } }]) {
    const result = f.planner.evaluateJoined(f.assignments, { ...f.request, people: [{ ...f.request.people[0], ...patch }, f.request.people[1]] });
    assert.equal(result.outcome, "held");
    if (result.outcome === "held") assert.ok(result.reasons.some(r => ["goal_required", "calorie_constraint_not_connected", "exclusion_mapping_required"].includes(r.code)));
  }
});
test("full-day low budget keeps scoped no-fit rather than relaxed success", () => {
  const f = fixture(), result = f.planner.evaluateJoined(f.assignments, { ...f.request, budgetCents: 1 });
  assert.equal(result.outcome, "no_fit"); if (result.outcome === "no_fit") assert.equal(result.scope, "evaluated-assignments-only");
});
test("full42assignment bounded search uses the same full-day evaluator deterministically", () => {
  const f = fixture(), grid = { recipeIds: ["a"], portionsByPerson: f.request.people.map((p, i) => ({ personId: p.personId, profileRevision: p.profileRevision, sourceServings: [{ numerator: String(i + 3), denominator: "1" }] })), maxRecipeUsesPerPerson: 21, maxEvaluations: 2, seed: "full-day-fixture" };
  const result = f.planner.planJoined(f.request, grid); assert.equal(result.outcome, "success");
  if (result.outcome === "success") assert.equal(result.projection.assignments.length, 42);
  assert.deepEqual(f.planner.planJoined(f.request, grid), result);
});
test("operation presenter labels full planned-day coverage and still declares conditional unsaved output", async () => {
  const f = fixture(), bound = createReferenceOperationHandler(f.bytes, f.configuration, { labels: [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }], authorize: () => "allow" });
  if (bound.outcome !== "ready") throw new Error("Expected handler");
  const intent = { contract: "wd-joined-plan-draft-v1", operationId: op(1), operation: "evaluateJoined", sourceSha256: f.configuration.sourcePin.sha256, payload: { request: f.request, assignments: f.assignments } };
  const response = await bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }) }));
  const body = await response.json(); assert.equal(body.result.proteinCoverage, "planned-breakfast-lunch-dinner"); assert.equal(body.result.saved, false); assert.equal(body.productionReady, false);
});
