import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { sha } from "./generated-joined-plan.test-support.ts";
import { createRevisedCatalogReader } from "./generated-plan-catalog.ts";
import { discoverReplacementAlternatives } from "./generated-plan-alternatives.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
function fixture(held = false) {
  const f = setup(held), request = { ...f.request, selectedDays: [f.request.selectedDays[0]!] }, assignments = f.assignments.filter(row => row.date === request.selectedDays[0]);
  const grid = { personId: "p1", assignmentId: assignments[0]!.assignmentId, expectedRecipeSha256: f.rows[0]!.recipe_sha256, candidates: [{ recipeId: "a", sourceServings: amount("16", "5") }, { recipeId: "b", sourceServings: amount("3") }], maxEvaluations: 8, limit: 8 };
  return { ...f, request, assignments, grid };
}

test("eligible alternatives carry actual selected-person previews and never mutate another assignment", () => {
  const { planner, request, assignments, grid } = fixture(), result = planner.findReplacements(assignments, request, grid);
  assert.equal(result.outcome, "alternatives"); if (result.outcome !== "alternatives") return;
  assert.equal(result.candidates.length, 2); assert.equal(result.search.complete, true); assert.equal(result.saved, false); assert.equal(result.productReady, false);
  for (const candidate of result.candidates) {
    assert.equal(candidate.preview.saved, false); assert.equal(candidate.preview.before.assignmentsSha256, result.baseAssignmentsSha256);
    assert.deepEqual(candidate.preview.after.projection.assignments.find(row => row.personId === "p2"), candidate.preview.before.projection.assignments.find(row => row.personId === "p2"));
  }
  const b = result.candidates.find(row => row.recipeId === "b")!; assert.equal(b.preview.itemCountDelta, 1); assert.equal(b.preview.after.quote.estimatedTotalCents.max, 1200);
});

test("candidate grid ordering is canonical and input remains untouched", () => {
  const { planner, request, assignments, grid } = fixture(), before = JSON.stringify({ request, assignments, grid }), first = planner.findReplacements(assignments, request, grid);
  assert.equal(first.outcome, "alternatives"); assert.deepEqual(planner.findReplacements([...assignments].reverse(), request, { ...grid, candidates: [...grid.candidates].reverse() }), first);
  assert.equal(JSON.stringify({ request, assignments, grid }), before); assert.ok(Object.isFrozen(first));
});

test("unchanged choices are reported without consuming an evaluation", () => {
  const { planner, request, assignments, grid } = fixture(), result = planner.findReplacements(assignments, request, { ...grid, candidates: [{ recipeId: "a", sourceServings: amount("6", "2") }, grid.candidates[1]], maxEvaluations: 1 });
  assert.equal(result.outcome, "alternatives"); if (result.outcome !== "alternatives") return;
  assert.equal(result.search.evaluatedCandidateCount, 1); assert.equal(result.search.unchangedCandidateCount, 1); assert.equal(result.search.complete, true); assert.equal(result.excluded[0]!.result.outcome, "unchanged");
});

test("evaluation limits and result limits disclose untested and withheld candidates separately", () => {
  const { planner, request, assignments, grid } = fixture();
  const bounded = planner.findReplacements(assignments, request, { ...grid, maxEvaluations: 1 });
  assert.equal(bounded.outcome, "alternatives"); if (bounded.outcome === "alternatives") { assert.equal(bounded.search.complete, false); assert.equal(bounded.search.notEvaluatedCount, 1); }
  const limited = planner.findReplacements(assignments, request, { ...grid, limit: 1 });
  assert.equal(limited.outcome, "alternatives"); if (limited.outcome === "alternatives") { assert.equal(limited.candidates.length, 1); assert.equal(limited.search.eligibleCandidateCount, 2); assert.equal(limited.search.unreturnedEligibleCount, 1); assert.equal(limited.search.complete, true); }
});

test("held nutrition candidates remain unselected and prevent a complete eligibility claim", () => {
  const { planner, request, assignments, grid } = fixture(true), result = planner.findReplacements(assignments, request, grid);
  assert.equal(result.outcome, "alternatives"); if (result.outcome !== "alternatives") return;
  assert.deepEqual(result.candidates.map(row => row.recipeId), ["a"]); assert.equal(result.search.heldCandidateCount, 1); assert.equal(result.search.complete, false); assert.equal(result.excluded[0]!.result.outcome, "held");
});

test("ineligible budget and protein candidates return their real constraint results", () => {
  const { planner, request, assignments, grid } = fixture();
  const result = planner.findReplacements(assignments, { ...request, budgetCents: 1000 }, { ...grid, candidates: [{ recipeId: "a", sourceServings: amount("1") }, grid.candidates[1]] });
  assert.equal(result.outcome, "alternatives"); if (result.outcome !== "alternatives") return;
  assert.equal(result.candidates.length, 0); assert.equal(result.search.complete, true); assert.ok(result.excluded.every(row => row.result.outcome === "no_fit"));
});

test("wrong person missing assignment and stale source refuse without a replacement", () => {
  const { planner, request, assignments, grid } = fixture();
  for (const change of [{ personId: "p2" }, { assignmentId: "missing" }, { expectedRecipeSha256: "0".repeat(64) }]) assert.equal(planner.findReplacements(assignments, request, { ...grid, ...change }).outcome, "error");
});

test("unknown source IDs duplicate equivalent portions and malformed bounds refuse", () => {
  const { planner, request, assignments, grid } = fixture();
  for (const change of [{ candidates: [{ recipeId: "missing", sourceServings: amount("1") }] }, { candidates: [{ recipeId: "a", sourceServings: amount("3") }, { recipeId: "a", sourceServings: amount("6", "2") }] }, { candidates: [] }, { maxEvaluations: 0 }, { maxEvaluations: 257 }, { limit: 0 }, { limit: 33 }, { candidates: [{ recipeId: "a", sourceServings: amount("0") }] }, { candidates: [{ recipeId: "a", sourceServings: amount("1", "0") }] }, { allowOverBudget: true }]) assert.equal(planner.findReplacements(assignments, request, { ...grid, ...change }).outcome, "error");
});

test("getters and unknown nested candidate fields are refused before invocation", () => {
  const { planner, request, assignments, grid } = fixture(); let reads = 0;
  const hostile = Object.defineProperty({ ...grid }, "candidates", { enumerable: true, get() { reads++; throw new Error("Not read"); } });
  assert.equal(planner.findReplacements(assignments, request, hostile).outcome, "error"); assert.equal(reads, 0);
  assert.equal(planner.findReplacements(assignments, request, { ...grid, candidates: [{ ...grid.candidates[0], approved: true }] }).outcome, "error");
});

test("unsupported base constraints return the exact held/no-fit outcome rather than suggestions", () => {
  const { planner, request, assignments, grid } = fixture();
  assert.equal(planner.findReplacements(assignments, { ...request, budgetCents: 1 }, grid).outcome, "no_fit");
  assert.equal(planner.findReplacements(assignments, { ...request, people: [{ ...request.people[0]!, proteinGoal: { kind: "unknown" } }, request.people[1]] }, grid).outcome, "held");
});

test("every returned alternative is still usable by the unchanged confirmation boundary", () => {
  const { planner, request, assignments, grid } = fixture(), result = planner.findReplacements(assignments, request, grid);
  assert.equal(result.outcome, "alternatives"); if (result.outcome !== "alternatives") return;
  for (const row of result.candidates) {
    const intent = { assignmentId: grid.assignmentId, personId: grid.personId, expectedRecipeSha256: grid.expectedRecipeSha256, replacementRecipeId: row.recipeId, sourceServings: row.sourceServings };
    const confirmation = planner.confirmReplacement(assignments, request, { intent, expectedPreviewSha256: row.preview.previewSha256, expectedRequestSha256: result.requestSha256, expectedAssignmentsSha256: result.baseAssignmentsSha256 });
    assert.equal(confirmation.outcome, "proposal"); if (confirmation.outcome === "proposal") assert.equal(confirmation.evaluation.assignmentsSha256, row.preview.after.assignmentsSha256);
  }
});

test("the discovery coordinator evaluates its base once and calls the shared preview only for changed candidates", () => {
  const { planner, request, assignments, grid, rows } = fixture(), bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
  const catalog = createRevisedCatalogReader({ sha256: sha(bytes), recordCount: rows.length })(bytes); assert.equal(catalog.outcome, "success"); if (catalog.outcome !== "success") return;
  let baseCalls = 0, previewCalls = 0;
  const result = discoverReplacementAlternatives(catalog, assignments, request, grid, (a, r) => { baseCalls++; return planner.evaluateJoined(a, r); }, (_before, r, intent) => { previewCalls++; return planner.previewReplacement(assignments, r, intent); });
  assert.equal(result.outcome, "alternatives"); assert.equal(baseCalls, 1); assert.equal(previewCalls, 2);
});

test("an unexpected candidate error stops discovery without returning partial eligible success", () => {
  const { planner, request, assignments, grid, rows } = fixture(), bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
  const catalog = createRevisedCatalogReader({ sha256: sha(bytes), recordCount: rows.length })(bytes); if (catalog.outcome !== "success") throw new Error("Expected synthetic catalog");
  let previews = 0;
  const result = discoverReplacementAlternatives(catalog, assignments, request, grid, planner.evaluateJoined, () => { previews++; return { outcome: "error", code: "injected_candidate_fault" }; });
  assert.deepEqual(result, { outcome: "error", code: "injected_candidate_fault" }); assert.equal(previews, 1);
});
