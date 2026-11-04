import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { setup } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import type { ReferenceSearchOutcome } from "./generated-plan-search.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
function options() { return { recipeIds: ["a", "b"], portionsByPerson: [{ personId: "p1", profileRevision: 1, sourceServings: [amount("3")] }, { personId: "p2", profileRevision: 1, sourceServings: [amount("4")] }], maxRecipeUsesPerPerson: 7, maxEvaluations: 16, seed: "fixture-only" }; }

test("search produces a two-person full week through the canonical evaluator with explicit limits", () => {
  const { planner, request } = setup(); assert.equal(typeof planner.planJoined, "function");
  const result = planner.planJoined(request, options()); assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.projection.assignments.length, 14); assert.equal(result.productReady, false); assert.ok(result.search.evaluations <= 16);
  assert.equal(result.search.optimization, "best-observed-in-explicit-bounded-grid");
  for (const day of result.projection.personDays) assert.deepEqual(day.nutrition.totals!.protein_g.min, amount(day.personId === "p1" ? "90" : "120"));
});

test("finite-grid optimum agrees with independently evaluating every possible one-meal assignment", () => {
  const { planner, request, rows } = setup(), selected = { ...request, people: [request.people[0]], selectedDays: [request.selectedDays[0]] }, config = { ...options(), portionsByPerson: [options().portionsByPerson[0]], maxEvaluations: 8 };
  const oracle = rows.map(row => planner.evaluateJoined([{ assignmentId: "oracle", personId: "p1", profileRevision: 1, date: selected.selectedDays[0], slot: "dinner", recipeId: row.id, recipeSha256: row.recipe_sha256, sourceServings: amount("3") }], selected)).flatMap(value => value.outcome === "success" ? [value.quote.estimatedTotalCents.max] : []);
  const result = planner.planJoined(selected, config); assert.equal(result.outcome, "success"); if (result.outcome === "success") { assert.equal(result.quote.estimatedTotalCents.max, Math.min(...oracle)); assert.equal(result.search.complete, true); assert.equal(result.search.evaluations, 2); }
});

test("fully exhausted supported failures concern the explicit finite grid, not all possible food", () => {
  const { planner, request } = setup(), result = planner.planJoined({ ...request, people: [request.people[0]], selectedDays: [request.selectedDays[0]], budgetCents: 1 }, { ...options(), portionsByPerson: [options().portionsByPerson[0]], maxEvaluations: 8 });
  assert.equal(result.outcome, "no_fit"); if (result.outcome === "no_fit") { assert.equal(result.scope, "explicit-finite-grid-only"); assert.equal(result.search.complete, true); assert.equal(result.week, null); }
});

test("bounded exhaustion without a feasible week is held, never a global no-fit", () => {
  const { planner, request } = setup(), result = planner.planJoined({ ...request, people: [request.people[0]], selectedDays: [request.selectedDays[0]] }, { ...options(), portionsByPerson: [{ personId: "p1", profileRevision: 1, sourceServings: [amount("1")] }], maxEvaluations: 1 });
  assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.reasons.some(reason => reason.code === "search_limit_reached"));
});

test("Unknown goals and incomplete candidate data stay held", () => {
  const { planner, request } = setup(), unknown = planner.planJoined({ ...request, people: [{ ...request.people[0], proteinGoal: { kind: "unknown" } }, request.people[1]] }, options()); assert.equal(unknown.outcome, "held");
  const incomplete = setup(true), result = incomplete.planner.planJoined(incomplete.request, { ...options(), recipeIds: ["b"] });
  assert.equal(result.outcome, "held");
  const partial = incomplete.planner.planJoined(incomplete.request, options()); assert.equal(partial.outcome, "success");
  if (partial.outcome === "success") { assert.equal(partial.search.complete, false); assert.deepEqual(partial.search.incompleteCandidateRecipeIds, ["b"]); }
});

test("source grids cannot smuggle foreign people, stale revisions, duplicate portions or executable values", () => {
  const { planner, request } = setup(); let reads = 0;
  const getter = Object.defineProperty(options(), "seed", { enumerable: true, get() { reads++; throw new Error("Not called"); } });
  for (const config of [getter, { ...options(), recipeIds: ["missing"] }, { ...options(), portionsByPerson: [{ ...options().portionsByPerson[0], personId: "removed" }, options().portionsByPerson[1]] }, { ...options(), portionsByPerson: [{ ...options().portionsByPerson[0], profileRevision: 0 }, options().portionsByPerson[1]] }, { ...options(), portionsByPerson: [{ ...options().portionsByPerson[0], sourceServings: [amount("3"), amount("6", "2")] }, options().portionsByPerson[1]] }, { ...options(), maxEvaluations: 0 }, { ...options(), maxEvaluations: 257 }, { ...options(), forceSavings: true }]) assert.equal(planner.planJoined(request, config).outcome, "error");
  assert.equal(reads, 0);
});

test("repeat constraint is explicit and deterministic, not silently relaxed", () => {
  const { planner, request } = setup(), result = planner.planJoined(request, { ...options(), recipeIds: ["a"], maxRecipeUsesPerPerson: 1 });
  assert.equal(result.outcome, "no_fit"); if (result.outcome === "no_fit") assert.equal(result.scope, "explicit-finite-grid-only");
});

test("same seed and semantically reordered grids produce identical immutable results without input mutation", () => {
  const { planner, request } = setup(), config = options(), before = JSON.stringify({ request, config }), first = planner.planJoined(request, config);
  assert.deepEqual(planner.planJoined({ ...request, people: [...request.people].reverse(), selectedDays: [...request.selectedDays].reverse() }, { ...config, recipeIds: [...config.recipeIds].reverse(), portionsByPerson: [...config.portionsByPerson].reverse() }), first);
  assert.equal(JSON.stringify({ request, config }), before); assert.ok(Object.isFrozen(first));
});

const currentSource = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl";
test("the actual1300-ID grid is supported without adopting missing purchase/price facts", { skip: !existsSync(currentSource) && "Pinned external source unavailable; not actual-source acceptance" }, () => {
  const bytes = readFileSync(currentSource), bound = createJoinedReferencePlanner(bytes, { correspondences: [], regionalPackFacts: [] });
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const rows: { id: string; sections: string[]; recipe: { equipment: string[] }; nutrition: { status: string } }[] = bytes.toString("utf8").trim().split(/\r?\n/).map(line => JSON.parse(line));
  const selected = rows.find(row => row.nutrition.status === "complete-conditional-USDA-input-estimate")!, fixture = setup();
  const request = { ...fixture.request, people: [{ ...fixture.request.people[0], proteinGoal: { kind: "known", gramsPerDay: "1", coverage: "selected-meals" } }], selectedDays: [fixture.request.selectedDays[0]], slots: [selected.sections[0]], equipment: selected.recipe.equipment };
  const result: ReferenceSearchOutcome = bound.planner.planJoined(request, { ...options(), recipeIds: rows.map(row => row.id), portionsByPerson: [{ personId: "p1", profileRevision: 1, sourceServings: [amount("1")] }], maxEvaluations: 1 });
  assert.equal(rows.length, 1300); assert.equal(result.outcome, "held");
  if (result.outcome === "held") assert.ok(result.reasons.some(reason => ["purchase_basis_needed", "search_limit_reached", "incomplete_candidate_nutrition"].includes(reason.code)));
});
