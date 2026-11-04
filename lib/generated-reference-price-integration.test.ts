import test from "node:test";
import assert from "node:assert/strict";
import { referencePriceFixture as fixture } from "./generated-reference-price.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { presentGroceries, presentReplacement } from "./generated-plan-presenter.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

test("one evaluator carries an explicit immutable reference into truthful customer grocery and replacement views", () => {
  const f = fixture(), before = f.planner.evaluateJoined(f.assignments, f.request); assert.equal(before.outcome, "success"); if (before.outcome !== "success") throw Error("Expected reference estimate");
  assert.equal(before.quote.referenceEstimates?.sources[0]?.kind, "manufacturer-reference");
  const view = presentGroceries(before, f.labels); assert.equal(view.outcome, "groceries"); if (view.outcome !== "groceries") throw Error("Expected grocery view");
  assert.ok(view.warnings.includes("includes-nonregional-reference-estimates")); assert.equal(view.warnings.includes("regional-typical-pack-estimate"), false);
  assert.equal(view.referenceEstimates?.sources[0]?.kind, "manufacturer-reference");
  assert.equal(view.referenceEstimates?.sources[0]?.sourceBasis.geography, "manufacturer-reference-not-regional");
  for (const row of view.groups.flatMap(g => g.items)) for (const key of ["estimatedLineCents", "packPriceCents", "sourceUrl", "factPins"]) assert.equal(Object.hasOwn(row, key), false);
  f.fact.packPriceCents.max = 9999; f.fact.sourceBasis.manufacturer = "MUTATED";
  assert.deepEqual(f.planner.evaluateJoined(f.assignments, f.request), before);
  const a = f.assignments[0]!, preview = f.planner.previewReplacement(f.assignments, f.request, { assignmentId: a.assignmentId, personId: a.personId, expectedRecipeSha256: a.recipeSha256, replacementRecipeId: "b", sourceServings: { numerator: "3", denominator: "1" } });
  assert.equal(preview.outcome, "preview"); if (preview.outcome !== "preview") throw Error("Expected same-person preview");
  assert.deepEqual(preview.after.projection.assignments.filter(a => a.personId === "p2"), before.projection.assignments.filter(a => a.personId === "p2"));
  const presented = presentReplacement(preview, f.labels); assert.equal(presented.outcome, "replacement-preview"); if (presented.outcome === "replacement-preview") assert.ok(presented.after.warnings.includes("includes-nonregional-reference-estimates"));
});
test("explicit fallback never overrides invalid source quantity, impossible budget or missing host policy", () => {
  const f = fixture(); const noPolicy = createJoinedReferencePlanner(f.bytes, { ...f.configuration, referencePrices: { policy: "client-says-yes", facts: [f.fact] } }); assert.equal(noPolicy.outcome, "error");
  const noBudget = f.planner.evaluateJoined(f.assignments, { ...f.request, budgetCents: 0 }); assert.equal(noBudget.outcome, "no_fit");
  const unknown = createJoinedReferencePlanner(f.bytes, { ...f.configuration, correspondences: [] }); assert.equal(unknown.outcome, "ready"); if (unknown.outcome === "ready") assert.equal(unknown.planner.evaluateJoined(f.assignments, f.request).outcome, "held");
});
test("reference quote survives committed lost acknowledgement and repository reconstruction without duplicate saves", async () => {
  const f = fixture(), memory = memoryPort(), scope = issueLocalReferenceScope("synthetic-reference-price-recovery", 1);
  const repo = createReferencePlanRepository({ planner: f.planner, transactions: memory.port });
  const command = { kind: "install-current", operationId: op(903), weekId: op(904), expectedRevision: 0, request: f.request, assignments: f.assignments };
  memory.failOnce("after-commit"); const lost = await repo.applyPlanCommand(scope, command); assert.equal(lost.outcome, "unknown");
  const recovered = createReferencePlanRepository({ planner: f.planner, transactions: memory.port });
  const status = await recovered.getOperationStatus(scope, op(903)); assert.equal(status.outcome, "committed");
  const duplicate = await recovered.applyPlanCommand(scope, command); assert.equal(duplicate.outcome, "acknowledged"); if (duplicate.outcome !== "acknowledged") throw Error("Expected exact prior receipt");
  assert.equal(duplicate.state.revision, 1); assert.equal(duplicate.state.current!.quote.referenceEstimates?.sources[0]?.kind, "manufacturer-reference");
});
