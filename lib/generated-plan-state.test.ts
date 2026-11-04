import test from "node:test";
import assert from "node:assert/strict";
import { createReferencePlanRepository, issueLocalReferenceScope, revokeLocalReferenceScope, type ReferenceStatePort, type ReferenceEnvelope, type StoredReferenceOperation } from "./generated-plan-state.ts";
import { setup } from "./generated-joined-plan.test-support.ts";

const op = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
function memoryPort() {
  const states = new Map<string, ReferenceEnvelope>(), operations = new Map<string, StoredReferenceOperation>();
  let serial: Promise<unknown> = Promise.resolve(), failure: "before-commit" | "after-commit" | null = null;
  const port: ReferenceStatePort = { transaction<T>(body: Parameters<ReferenceStatePort["transaction"]>[0]): Promise<T> {
    const run = serial.then(async () => {
      const nextStates = structuredClone(states), nextOperations = structuredClone(operations);
      const result = await body({
        async readState(scope) { return structuredClone(nextStates.get(scope) ?? null); },
        async readOperation(scope, id) { return structuredClone(nextOperations.get(scope + id) ?? null); },
        async commit(scope, state, operation) { nextStates.set(scope, structuredClone(state)); nextOperations.set(scope + operation.operationId, structuredClone(operation)); },
      });
      const injected = failure; failure = null;
      if (injected === "before-commit") throw new Error("Fixture rollback");
      states.clear(); nextStates.forEach((v, k) => states.set(k, v)); operations.clear(); nextOperations.forEach((v, k) => operations.set(k, v));
      if (injected === "after-commit") throw new Error("Fixture acknowledgement lost");
      return result;
    });
    serial = run.catch(() => undefined); return run as Promise<T>;
  } };
  return { port, failOnce(mode: typeof failure) { failure = mode; }, tamperState(mutate: (state: ReferenceEnvelope) => ReferenceEnvelope) { for (const [key, state] of states) states.set(key, mutate(structuredClone(state))); } };
}
function fixture(namespace: string) {
  const { planner, request, assignments } = setup(), memory = memoryPort(), scope = issueLocalReferenceScope(namespace, 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  const command = (changes = {}) => ({ operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments, ...changes });
  return { planner, request, assignments, memory, scope, repository, command };
}

test("one acknowledged transaction saves the evaluated week and its exact receipt", async () => {
  const { repository, scope, command } = fixture("state-basic"), result = await repository.applyPlanCommand(scope, command());
  assert.equal(result.outcome, "acknowledged"); if (result.outcome !== "acknowledged") return;
  assert.equal(result.state.revision, 1); assert.equal(result.state.current!.weekId, op(100)); assert.equal(result.state.draft, null);
  const read = await repository.read(scope); assert.equal(read.outcome, "read"); if (read.outcome === "read") assert.deepEqual(read.state, result.state);
  const status = await repository.getOperationStatus(scope, op(1)); assert.equal(status.outcome, "committed"); if (status.outcome === "committed") assert.deepEqual(status.receipt, result);
});

test("same intent replays without evaluating again and changed intent conflicts", async () => {
  const { planner, memory, scope, command } = fixture("state-replay"); let evaluations = 0;
  const repository = createReferencePlanRepository({ transactions: memory.port, planner: { ...planner, evaluateJoined(...args) { evaluations++; return planner.evaluateJoined(...args); } } });
  const first = await repository.applyPlanCommand(scope, command()); assert.deepEqual(await repository.applyPlanCommand(scope, command()), first); assert.equal(evaluations, 1);
  assert.deepEqual(await repository.applyPlanCommand(scope, command({ expectedRevision: 1 })), { outcome: "error", code: "idempotency_conflict" });
});

test("concurrent stale edits cannot overwrite an acknowledged revision", async () => {
  const { repository, scope, command } = fixture("state-cas"); await repository.applyPlanCommand(scope, command());
  const results = await Promise.all([repository.applyPlanCommand(scope, command({ operationId: op(2), kind: "save-current", expectedRevision: 1 })), repository.applyPlanCommand(scope, command({ operationId: op(3), kind: "save-current", expectedRevision: 1 }))]);
  assert.equal(results.filter(value => value.outcome === "acknowledged").length, 1); assert.ok(results.some(value => value.outcome === "error" && value.code === "revision_conflict"));
});

test("creating a new dated draft and cancellation preserve the current week exactly", async () => {
  const { repository, scope, command, request, assignments } = fixture("state-new-week"), first = await repository.applyPlanCommand(scope, command());
  if (first.outcome !== "acknowledged") throw new Error("Expected initial save");
  const dates = request.selectedDays.map(value => value.replace("2026-10-", "2026-11-")), nextRequest = { ...request, selectedDays: dates }, nextAssignments = assignments.map(value => ({ ...value, assignmentId: value.assignmentId + "new", date: value.date.replace("2026-10-", "2026-11-") }));
  const next = await repository.applyPlanCommand(scope, command({ operationId: op(2), kind: "create-week-draft", expectedRevision: 1, weekId: op(101), request: nextRequest, assignments: nextAssignments }));
  assert.equal(next.outcome, "acknowledged"); if (next.outcome !== "acknowledged") return;
  assert.deepEqual(next.state.current, first.state.current); assert.equal(next.state.draft!.weekId, op(101));
  const held = await repository.applyPlanCommand(scope, { operationId: op(3), kind: "confirm-new-week", expectedRevision: 2, weekId: op(101) }); assert.equal(held.outcome, "held");
  const canceled = await repository.applyPlanCommand(scope, { operationId: op(4), kind: "cancel-week-draft", expectedRevision: 2, weekId: op(101) });
  assert.equal(canceled.outcome, "acknowledged"); if (canceled.outcome === "acknowledged") { assert.deepEqual(canceled.state.current, first.state.current); assert.equal(canceled.state.draft, null); }
});

test("rejected constraints, changed current dates and overlapping draft never replace current", async () => {
  const { repository, scope, command, request } = fixture("state-rejection"); const first = await repository.applyPlanCommand(scope, command());
  const rejected = await repository.applyPlanCommand(scope, command({ operationId: op(2), kind: "save-current", expectedRevision: 1, request: { ...request, budgetCents: 1 } })); assert.equal(rejected.outcome, "not_applied");
  assert.equal((await repository.applyPlanCommand(scope, command({ operationId: op(3), kind: "create-week-draft", expectedRevision: 1, weekId: op(101) }))).outcome, "error");
  const read = await repository.read(scope); if (read.outcome === "read" && first.outcome === "acknowledged") assert.deepEqual(read.state.current, first.state.current);
});

test("lost acknowledgement requires status recovery and survives repository restart", async () => {
  const { repository, scope, command, planner, memory } = fixture("state-lost-ack"); memory.failOnce("after-commit");
  assert.deepEqual(await repository.applyPlanCommand(scope, command()), { outcome: "unknown", operationId: op(1), statusRequired: true });
  assert.deepEqual(await repository.applyPlanCommand(scope, command()), { outcome: "held", code: "operation_status_required" });
  const restarted = createReferencePlanRepository({ planner, transactions: memory.port }), status = await restarted.getOperationStatus(scope, op(1));
  assert.equal(status.outcome, "committed"); const replay = await restarted.applyPlanCommand(scope, command()); assert.equal(replay.outcome, "acknowledged");
  const resolved = await repository.getOperationStatus(scope, op(1)); assert.equal(resolved.outcome, "committed"); assert.deepEqual(await repository.applyPlanCommand(scope, command()), replay);
});

test("known fresh status after rollback allows the same intent without inventing success", async () => {
  const { repository, scope, command, memory } = fixture("state-rollback"); memory.failOnce("before-commit");
  assert.equal((await repository.applyPlanCommand(scope, command())).outcome, "unknown");
  assert.deepEqual(await repository.getOperationStatus(scope, op(1)), { outcome: "not_found", operationId: op(1) });
  assert.equal((await repository.applyPlanCommand(scope, command())).outcome, "acknowledged");
});

test("scopes cannot be supplied as JSON and owner/session transitions cannot leak old state", async () => {
  const { repository, scope, command } = fixture("state-owner"); await repository.applyPlanCommand(scope, command());
  assert.equal((await repository.read({} as typeof scope)).outcome, "error");
  const other = issueLocalReferenceScope("state-other-owner", 1), otherRead = await repository.read(other); if (otherRead.outcome === "read") assert.equal(otherRead.state.current, null);
  revokeLocalReferenceScope(scope); assert.deepEqual(await repository.read(scope), { outcome: "error", code: "local_scope_inactive" });
  const nextSession = issueLocalReferenceScope("state-owner", 2), recovered = await repository.read(nextSession); assert.equal(recovered.outcome, "read"); if (recovered.outcome === "read") assert.equal(recovered.state.current!.weekId, op(100));
});

test("unknown fields and getters are refused without executing supplied code", async () => {
  const { repository, scope, command } = fixture("state-hostile"); let reads = 0;
  const getter = Object.defineProperty(command(), "assignments", { enumerable: true, get() { reads++; throw new Error("Not called"); } });
  for (const value of [getter, command({ accountId: "forged" }), command({ expectedRevision: NaN }), command({ operationId: "not-uuid" })]) assert.equal((await repository.applyPlanCommand(scope, value)).outcome, "error");
  assert.equal(reads, 0);
});

test("persisted quote corruption is detected after canonical object-key reordering", async () => {
  const { repository, scope, command, memory } = fixture("state-corrupt"); await repository.applyPlanCommand(scope, command());
  memory.tamperState(state => ({ ...state, current: { ...state.current!, quote: { ...state.current!.quote, uniqueBuyItemCount: 77 } } }));
  assert.deepEqual(await repository.read(scope), { outcome: "error", code: "stored_state_invalid" });
});

test("a port cannot return an otherwise valid receipt for another operation ID", async () => {
  const { repository, scope, command, planner, memory } = fixture("state-status-binding"); await repository.applyPlanCommand(scope, command());
  const wrong: ReferenceStatePort = { transaction(body) { return memory.port.transaction(tx => body({ ...tx, readOperation(scope) { return tx.readOperation(scope, op(1)); } })); } };
  const checked = createReferencePlanRepository({ planner, transactions: wrong });
  assert.deepEqual(await checked.getOperationStatus(scope, op(2)), { outcome: "error", code: "stored_receipt_invalid" });
});

test("a new trusted session generation invalidates every old handle", async () => {
  const { repository, scope, command } = fixture("state-generation"); await repository.applyPlanCommand(scope, command());
  issueLocalReferenceScope("state-generation", 2);
  assert.deepEqual(await repository.read(scope), { outcome: "error", code: "local_scope_inactive" });
  assert.deepEqual(await repository.getOperationStatus(scope, op(1)), { outcome: "error", code: "local_scope_inactive" });
});
