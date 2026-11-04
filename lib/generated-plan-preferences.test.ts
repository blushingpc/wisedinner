import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";

const amount = (numerator: string) => ({ numerator, denominator: "1" });
function fixture(ids = ["a"]) {
  const base = setup(), request = { ...base.request, people: [{ ...base.request.people[0]!, preferences: { preferredRecipeIds: ids } }], selectedDays: [base.request.selectedDays[0]!] };
  const grid = { recipeIds: ["a", "b"], portionsByPerson: [{ personId: "p1", profileRevision: 1, sourceServings: [amount("3")] }], maxRecipeUsesPerPerson: 1, maxEvaluations: 8, seed: "preferences-fixture-only" };
  return { ...base, request, grid };
}

test("nonempty preferences require an explicit ranking policy, not a guessed default", () => {
  const { planner, request, grid } = fixture(), result = planner.planJoined(request, grid);
  assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.reasons.some(reason => reason.code === "preference_ranking_policy_required"));
});

test("explicit cost-first and preferences-first rank the same feasible grid differently", () => {
  const { planner, request, grid } = fixture();
  for (const preferencePolicy of ["cost-first", "preferences-first"] as const) {
    const result = planner.planJoined(request, { ...grid, preferencePolicy });
    assert.equal(result.outcome, "success"); if (result.outcome !== "success") continue;
    assert.equal(result.projection.assignments[0]!.recipeId, preferencePolicy === "cost-first" ? "b" : "a");
    assert.equal(result.search.preferencePolicy, preferencePolicy); assert.equal(result.search.preferredAssignmentCount, preferencePolicy === "cost-first" ? 0 : 1); assert.equal(result.search.complete, true);
  }
});

test("unknown preferred source IDs refuse in both manual evaluation and search", () => {
  const { planner, request, grid, assignments } = fixture(["missing"]);
  const selected = assignments.filter(value => value.personId === "p1" && value.date === request.selectedDays[0]);
  assert.deepEqual(planner.evaluateJoined(selected, request), { outcome: "error", code: "preferred_recipe_missing" });
  assert.deepEqual(planner.planJoined(request, { ...grid, preferencePolicy: "cost-first" }), { outcome: "error", code: "preferred_recipe_missing" });
});

test("a known preference outside the explicit grid remains visible and is not a hard exclusion", () => {
  const { planner, request, grid } = fixture(), result = planner.planJoined(request, { ...grid, recipeIds: ["b"], preferencePolicy: "preferences-first" });
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.projection.assignments[0]!.recipeId, "b"); assert.equal(result.search.preferredAssignmentCount, 0);
  assert.deepEqual(result.search.unavailablePreferences, [{ personId: "p1", recipeId: "a", reasons: ["outside_explicit_grid"] }]);
});

test("preferences never relax the actual household budget or protein goal", () => {
  const { planner, request, grid } = fixture(), result = planner.planJoined({ ...request, budgetCents: 400 }, { ...grid, preferencePolicy: "preferences-first" });
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.projection.assignments[0]!.recipeId, "b"); assert.equal(result.search.preferredAssignmentCount, 0); assert.ok(result.quote.estimatedTotalCents.max <= 400);
  const impossible = planner.planJoined({ ...request, people: [{ ...request.people[0]!, proteinGoal: { kind: "known", gramsPerDay: "100", coverage: "selected-meals" } }] }, { ...grid, preferencePolicy: "preferences-first" });
  assert.equal(impossible.outcome, "no_fit");
});

test("source nutrition holds are reported for unavailable preferred recipes", () => {
  const base = setup(true), f = fixture(["b"]), result = base.planner.planJoined(f.request, { ...f.grid, preferencePolicy: "preferences-first" });
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.search.complete, false); assert.deepEqual(result.search.unavailablePreferences, [{ personId: "p1", recipeId: "b", reasons: ["incomplete_nutrition"] }]);
});

test("preference ordering is set-like, deterministic and never mutates caller input", () => {
  const { planner, request, grid } = fixture(["b", "a"]), before = JSON.stringify({ request, grid });
  const first = planner.planJoined(request, { ...grid, preferencePolicy: "preferences-first" });
  const second = planner.planJoined({ ...request, people: [{ ...request.people[0]!, preferences: { preferredRecipeIds: ["a", "b"] } }] }, { ...grid, recipeIds: ["b", "a"], preferencePolicy: "preferences-first" });
  assert.equal(first.outcome, "success"); assert.deepEqual(first, second); assert.equal(JSON.stringify({ request, grid }), before); assert.ok(Object.isFrozen(first));
});

test("unsupported ranking policies and executable configuration are refused", () => {
  const { planner, request, grid } = fixture(); let reads = 0;
  for (const preferencePolicy of ["cheapest", true, null, { value: "cost-first" }]) assert.equal(planner.planJoined(request, { ...grid, preferencePolicy }).outcome, "error");
  const hostile = Object.defineProperty({ ...grid }, "preferencePolicy", { enumerable: true, get() { reads++; throw new Error("Not called"); } });
  assert.equal(planner.planJoined(request, hostile).outcome, "error"); assert.equal(reads, 0);
});

test("two people's soft preferences stay person-specific rather than becoming household exclusions", () => {
  const base = setup(), request = { ...base.request, selectedDays: [base.request.selectedDays[0]!], people: base.request.people.map((person, i) => ({ ...person, preferences: { preferredRecipeIds: [i ? "b" : "a"] } })) };
  const grid = { ...fixture().grid, preferencePolicy: "preferences-first", portionsByPerson: request.people.map((person, i) => ({ personId: person.personId, profileRevision: person.profileRevision, sourceServings: [amount(String(i + 3))] })) };
  const first = base.planner.planJoined(request, grid); assert.equal(first.outcome, "success"); if (first.outcome !== "success") return;
  assert.deepEqual(first.projection.assignments.map(row => [row.personId, row.recipeId]), [["p1", "a"], ["p2", "b"]]); assert.equal(first.search.preferredAssignmentCount, 2);
  const next = base.planner.planJoined({ ...request, people: [{ ...request.people[0]!, preferences: { preferredRecipeIds: ["b"] } }, request.people[1]] }, grid);
  assert.equal(next.outcome, "success"); if (next.outcome !== "success") return;
  assert.deepEqual(next.projection.assignments.find(row => row.personId === "p2"), first.projection.assignments.find(row => row.personId === "p2"));
});

test("preference and cost ranking agree with an independent finite-grid oracle across budget boundaries", () => {
  const { planner, request, grid, rows } = fixture();
  for (const budgetCents of [0, 199, 200, 399, 400, 999, 1000, 2000]) for (const preferencePolicy of ["cost-first", "preferences-first"] as const) {
    const selected = { ...request, budgetCents }, feasible = rows.flatMap(row => {
      const result = planner.evaluateJoined([{ assignmentId: "oracle", personId: "p1", profileRevision: 1, date: request.selectedDays[0], slot: "dinner", recipeId: row.id, recipeSha256: row.recipe_sha256, sourceServings: amount("3") }], selected);
      return result.outcome === "success" ? [{ id: row.id, cost: result.quote.estimatedTotalCents.max, preferred: row.id === "a" ? 1 : 0 }] : [];
    }).sort((a, b) => (preferencePolicy === "preferences-first" ? b.preferred - a.preferred : 0) || a.cost - b.cost || b.preferred - a.preferred);
    const result = planner.planJoined(selected, { ...grid, preferencePolicy });
    assert.equal(result.outcome, feasible.length ? "success" : "no_fit");
    if (result.outcome === "success") { assert.equal(result.projection.assignments[0]!.recipeId, feasible[0]!.id); assert.equal(result.search.preferredAssignmentCount, feasible[0]!.preferred); }
  }
});

test("unsupported equipment and meal sections explain unavailable preferences", () => {
  const { planner, request, grid } = fixture();
  for (const [change, reason] of [[{ equipment: [] }, "equipment_unavailable"], [{ slots: ["breakfast"] }, "meal_section_unavailable"]] as const) {
    const result = planner.planJoined({ ...request, ...change }, { ...grid, preferencePolicy: "preferences-first" });
    assert.equal(result.outcome, "no_fit"); if (result.outcome !== "no_fit") continue;
    assert.deepEqual(result.search.unavailablePreferences, [{ personId: "p1", recipeId: "a", reasons: [reason] }]);
  }
});
