import test from "node:test";
import assert from "node:assert/strict";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createReferenceOperationHandler, referenceOperationDigest } from "./generated-plan-operations.ts";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

// Long synthetic directions exercise the actual16MiB response boundary. They
// are valid catalog inputs, not shortened real recipes or a raised size limit.
function fixture(namespace: string, stepCount = 82) {
  const f = setup(), rows = structuredClone(f.rows), recipe = rows[0]!;
  recipe.recipe.steps = Array.from({ length: stepCount }, (_, i) => ({ id: i + 1, instruction: "Synthetic capacity-only instruction. " + ".".repeat(4950), allocations: i === 0 ? recipe.recipe.steps[0]!.allocations : [] }));
  recipe.recipe_sha256 = sha(JSON.stringify(canonicalReferenceData(recipe.recipe)));
  recipe.nutrition.source_refresh.exact_recipe_body_sha256 = recipe.recipe_sha256;
  recipe.nutrition.source_refresh.recipe_sha256_unchanged = recipe.recipe_sha256;
  for (const row of rows) row.sections = ["breakfast", "lunch", "dinner"];
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
  const configuration = { ...f.configuration, sourcePin: { sha256: sha(bytes), recordCount: 2 }, schedulePolicy: "wd-seven-day-three-meals-v1" };
  const request = { ...f.request, budgetCents: 1000000, slots: ["breakfast", "lunch", "dinner"], people: f.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, coverage: "full-day" } })) };
  const assignments = request.selectedDays.flatMap(date => request.people.flatMap((person, i) => request.slots.map(slot => ({ assignmentId: person.personId + date + slot, personId: person.personId, profileRevision: person.profileRevision, date, slot, recipeId: "a", recipeSha256: recipe.recipe_sha256, sourceServings: { numerator: String(i + 3), denominator: "1" } }))));
  const memory = memoryPort(), scope = issueLocalReferenceScope(namespace, 1);
  const labels = [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }];
  const session = createReferenceSessionHandler(bytes, configuration, { labels, transactions: memory.port, resolveScope: () => scope });
  const pure = createReferenceOperationHandler(bytes, configuration, { labels, authorize: () => "allow" });
  const planner = createJoinedReferencePlanner(bytes, configuration);
  if (session.outcome !== "ready" || pure.outcome !== "ready" || planner.outcome !== "ready") throw Error("Expected valid synthetic capacity bindings");
  const boundSession = session, boundPure = pure;
  const repository = createReferencePlanRepository({ planner: planner.planner, transactions: memory.port });
  const envelope = (contract: string, operation: string, payload: unknown, id: number) => { const intent = { contract, operation, operationId: op(id), sourceSha256: configuration.sourcePin.sha256, payload }; return { ...intent, intentSha256: referenceOperationDigest(intent) }; };
  async function send(operation: string, payload: unknown, id: number, direct = false) {
    const intent = envelope(direct ? "wd-joined-plan-draft-v1" : REFERENCE_SESSION_CONTRACT, operation, payload, id);
    const response = await (direct ? boundPure : boundSession).handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(intent) }));
    const text = await response.text();
    return { intent, response, text, body: JSON.parse(text) };
  }
  return { ...f, recipe, request, assignments, repository, scope, memory, send };
}
function heldEnvelope(result: Awaited<ReturnType<ReturnType<typeof fixture>["send"]>>) {
  assert.equal(result.response.status, 422);
  assert.ok(Buffer.byteLength(result.text) < 16 * 1024 * 1024);
  assert.equal(result.body.contract, result.intent.contract);
  assert.equal(result.body.operation, result.intent.operation);
  assert.equal(result.body.operationId, result.intent.operationId);
  assert.equal(result.body.intentSha256, result.intent.intentSha256);
  assert.equal(result.body.apiAccepted, false); assert.equal(result.body.productionReady, false);
  assert.equal(result.body.mode, "private-conditional-reference-only");
  assert.equal(result.body.result.outcome, "held"); assert.equal(result.body.result.code, "response_capacity_review");
  assert.equal(result.response.headers.get("cache-control"), "no-store");
  assert.equal(result.response.headers.get("x-content-type-options"), "nosniff");
}
test("oversized pure result retains its normal nested envelope and explicitly never saved", async () => {
  const f = fixture("capacity-pure"), result = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments }, 801, true);
  heldEnvelope(result); assert.equal(result.body.replaySemantics, "pure-recompute-no-write");
  assert.equal(result.body.result.saved, false); assert.equal(result.body.result.reconcileOperationStatus, false);
  const read = await f.repository.read(f.scope); assert.equal(read.outcome, "read"); if (read.outcome === "read") assert.equal(read.state.revision, 0);
});
test("composed pure capacity result retains outer correlation without requesting mutation recovery", async () => {
  const f = fixture("capacity-session-pure"), result = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments }, 802);
  heldEnvelope(result); assert.equal(result.body.result.saved, false); assert.equal(result.body.result.reconcileOperationStatus, false);
  const read = await f.send("readCurrent", {}, 803); assert.equal(read.body.result.state.current, null);
});
test("oversized saved view preserves known commit and recovers the target receipt without replay", async () => {
  const f = fixture("capacity-durable"), payload = { expectedRevision: 0, weekId: op(810), request: f.request, assignments: f.assignments, pantryEntries: [] };
  const result = await f.send("installCurrent", payload, 804); heldEnvelope(result);
  assert.equal(result.body.result.saved, true); assert.equal(result.body.result.writeOutcome, "committed");
  assert.equal(result.body.result.targetOperationId, op(804)); assert.equal(result.body.result.revision, 1); assert.equal(result.body.result.reconcileOperationStatus, true);
  const read = await f.repository.read(f.scope); assert.equal(read.outcome, "read"); if (read.outcome === "read") { assert.equal(read.state.revision, 1); assert.equal(read.state.current?.weekId, op(810)); }
  const status = await f.send("operationStatus", { targetOperationId: op(804) }, 805); heldEnvelope(status);
  assert.equal(status.body.result.saved, true); assert.equal(status.body.result.writeOutcome, "committed");
  assert.equal(status.body.result.targetOperationId, op(804)); assert.equal(status.body.result.revision, 1); assert.equal(status.body.result.reconcileOperationStatus, false);
  const receipt = await f.repository.getOperationStatus(f.scope, op(804)); assert.equal(receipt.outcome, "committed");
  const duplicate = await f.send("installCurrent", payload, 804); heldEnvelope(duplicate); assert.deepEqual(duplicate.body.result, result.body.result);
  const display = await f.send("readCurrent", {}, 806); heldEnvelope(display);
  assert.equal(display.body.result.saved, false); assert.equal(display.body.result.writeOutcome, "not-requested"); assert.equal(display.body.result.reconcileOperationStatus, false);
  const after = await f.repository.read(f.scope); assert.equal(after.outcome, "read"); if (after.outcome === "read") assert.equal(after.state.revision, 1);
});
test("under-limit response retains every complete source instruction and normal success semantics", async () => {
  const f = fixture("capacity-under", 2), result = await f.send("evaluateJoined", { request: f.request, assignments: f.assignments }, 807);
  assert.equal(result.response.status, 200); assert.equal(result.body.result.outcome, "week-proposal"); assert.equal(result.body.result.saved, false);
  assert.equal(result.body.result.meals.length, 42);
  assert.ok(result.text.includes(f.recipe.recipe.steps[1]!.instruction));
});
test("lost durable acknowledgement resolves to compact known commit, not a second mutation", async () => {
  const f = fixture("capacity-lost-ack"), payload = { expectedRevision: 0, weekId: op(811), request: f.request, assignments: f.assignments, pantryEntries: [] };
  f.memory.failOnce("after-commit");
  const lost = await f.send("installCurrent", payload, 808); assert.equal(lost.body.result.outcome, "unknown"); assert.equal(lost.response.status, 202);
  const retry = await f.send("installCurrent", payload, 808); assert.equal(retry.body.result.code, "operation_status_required");
  const status = await f.send("operationStatus", { targetOperationId: op(808) }, 809); heldEnvelope(status);
  assert.equal(status.body.result.saved, true); assert.equal(status.body.result.writeOutcome, "committed");
  assert.equal(status.body.result.targetOperationId, op(808)); assert.equal(status.body.result.revision, 1); assert.equal(status.body.result.reconcileOperationStatus, false);
  const read = await f.repository.read(f.scope); assert.equal(read.outcome, "read"); if (read.outcome === "read") assert.equal(read.state.revision, 1);
});
