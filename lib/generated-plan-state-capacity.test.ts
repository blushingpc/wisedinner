import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { preparePantryBasis } from "./generated-plan-pantry-basis.ts";

test("valid large pantry state is retained rather than forced into the old131072byte codec", async () => {
  const f = setup(), { request, assignments } = f, memory = memoryPort(), scope = issueLocalReferenceScope("state-large-pantry", 1);
  const pantry = Array.from({ length: 500 }, (_, i) => ({ skuId: `fixture-unused-${i}-${"x".repeat(200)}`, unit: "g", formDigest: "f".repeat(64), quantity: { numerator: i + 1, denominator: 3 } }));
  const purchaseBindings = pantry.map((row, i) => ({ id: "binding-" + i, ingredientId: "fixture-owned-" + i, preparedState: "raw", baseUnit: "g", skuId: row.skuId, formDigest: row.formDigest, sourceSha256: "e".repeat(64) }));
  const bound = createJoinedReferencePlanner(f.bytes, { ...f.configuration, pantryIntake: { measureFacts: [], purchaseBindings } }); if (bound.outcome !== "ready") throw new Error("Expected large synthetic pantry registry");
  const planner = bound.planner, repository = createReferencePlanRepository({ planner, transactions: memory.port });
  const entries = pantry.map((row, i) => ({ pantryId: "observation-" + i, kind: "known", ingredientId: "fixture-owned-" + i, preparedState: "raw", baseUnit: "g", amount: { numerator: String(row.quantity.numerator), denominator: "3" }, unit: "g" }));
  const prepared = preparePantryBasis(planner.preparePantry, entries); if (prepared.outcome !== "ready") throw new Error("Expected complete provenance");
  const command = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: { ...request, pantry: prepared.pantry }, assignments, pantryBasis: prepared.basis };
  const { pantryBasis, ...numericOnly } = command; void pantryBasis;
  assert.deepEqual(await repository.applyPlanCommand(scope, numericOnly), { outcome: "held", code: "pantry_provenance_migration_required" });
  assert.ok(Buffer.byteLength(JSON.stringify(command)) > 131072);
  assert.equal(planner.evaluateJoined(assignments, command.request).outcome, "success");
  const result = await repository.applyPlanCommand(scope, command); assert.equal(result.outcome, "acknowledged"); if (result.outcome !== "acknowledged") return;
  assert.equal(result.state.current!.quote.ownedRemaining.length, 500);
  const restarted = createReferencePlanRepository({ planner, transactions: memory.port }), read = await restarted.read(scope); assert.equal(read.outcome, "read");
  if (read.outcome === "read") assert.deepEqual(read.state, result.state);
  const draftRequest = { ...command.request, selectedDays: request.selectedDays.map(value => value.replace("2026-10-", "2026-11-")) }, draftAssignments = assignments.map(value => ({ ...value, assignmentId: value.assignmentId + "new", date: value.date.replace("2026-10-", "2026-11-") }));
  const drafted = await restarted.applyPlanCommand(scope, { operationId: op(2), kind: "create-week-draft", expectedRevision: 1, weekId: op(101), request: draftRequest, assignments: draftAssignments, pantryBasis: prepared.basis });
  assert.equal(drafted.outcome, "acknowledged"); if (drafted.outcome === "acknowledged") { assert.deepEqual(drafted.state.current, result.state.current); assert.equal(drafted.state.draft!.quote.ownedRemaining.length, 500); }
});
