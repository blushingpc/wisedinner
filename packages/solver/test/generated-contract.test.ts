import test from "node:test";
import assert from "node:assert/strict";
import { parsePeople, resolveGoalReturn } from "../src/generated-plan-contract.ts";

const person = (personId = "p1", changes: Record<string, unknown> = {}) => ({ personId, profileRevision: 1, label: `Fixture ${personId}`, proteinGoal: { kind: "known", gramsPerDay: "35", coverage: "selected-meals" }, exclusions: { kind: "none" }, ...changes });

test("different goals stay attached to stable person IDs through reorder", () => {
  const a = person("p1"), b = person("p3", { proteinGoal: { kind: "known", gramsPerDay: "70.5", coverage: "selected-meals" } });
  const result = parsePeople([b, a]); assert.equal(result.outcome, "validated");
  if (result.outcome === "validated") {
    assert.equal(result.people[0]!.personId, "p3"); assert.equal(result.people[1]!.personId, "p1");
    assert.deepEqual(result.people[0]!.proteinGoal, b.proteinGoal); assert.deepEqual(result.people[1]!.proteinGoal, a.proteinGoal);
    assert.deepEqual(result.holds, []);
  }
});

test("Unknown goal returns to the exact person and revision without a default target", () => {
  const people = [person("p1"), person("p3", { proteinGoal: { kind: "unknown" } })];
  assert.deepEqual(resolveGoalReturn(people, "p3", 1), { outcome: "held", code: "goal_required", returnTo: { personId: "p3", profileRevision: 1, field: "proteinGoal" } });
  assert.deepEqual(resolveGoalReturn([...people].reverse(), "p3", 1), resolveGoalReturn(people, "p3", 1));
  const parsed = parsePeople(people);
  assert.equal(parsed.outcome, "validated");
  if (parsed.outcome === "validated") assert.deepEqual(parsed.holds, [{ code: "goal_required", personId: "p3", field: "proteinGoal" }]);
});

test("removed and stale goal callbacks never target an array-index successor", () => {
  assert.deepEqual(resolveGoalReturn([person("p1"), person("p3")], "p2", 1), { outcome: "error", code: "person_missing" });
  assert.deepEqual(resolveGoalReturn([person("p3", { profileRevision: 2 })], "p3", 1), { outcome: "error", code: "stale_profile" });
  const result = resolveGoalReturn([person("p3")], "p3", 1); assert.equal(result.outcome, "ready");
});

test("known calories remain separate and held until a connected consumer exists", () => {
  const calorieGoal = { kind: "known", kcalPerDay: "1800.5", coverage: "selected-meals" };
  const result = parsePeople([person("p1", { calorieGoal })]); assert.equal(result.outcome, "validated");
  if (result.outcome === "validated") {
    assert.deepEqual(result.people[0]!.calorieGoal, calorieGoal);
    assert.ok(result.holds.some(row => row.code === "calorie_constraint_not_connected" && row.personId === "p1"));
  }
  const unset = parsePeople([person("p1", { calorieGoal: { kind: "unset" } })]);
  assert.equal(unset.outcome, "validated"); if (unset.outcome === "validated") assert.deepEqual(unset.holds, []);
});

test("none, unknown, custom and mapped restrictions stay distinct with explicit holds", () => {
  const rows = [person("none"), person("unknown", { exclusions: { kind: "unknown" } }), person("custom", { exclusions: { kind: "unmapped", text: "Synthetic custom exclusion" } }), person("mapped", { exclusions: { kind: "mapped", ingredientIds: ["fixture-food"], allergenIds: [], mappingRevision: 2, scope: "person" } })];
  const result = parsePeople(rows); assert.equal(result.outcome, "validated");
  if (result.outcome === "validated") {
    assert.ok(!result.holds.some(row => row.personId === "none"));
    assert.ok(result.holds.some(row => row.personId === "unknown" && row.code === "exclusion_status_required"));
    assert.ok(result.holds.some(row => row.personId === "custom" && row.code === "exclusion_mapping_required"));
    assert.ok(result.holds.some(row => row.personId === "mapped" && row.code === "exclusion_scope_policy_required"));
  }
});

test("invalid custom goals and unsupported fields refuse instead of guessing", () => {
  for (const grams of ["", "0", "-1", "NaN", "Infinity", "1001", 35, NaN, Infinity]) {
    assert.deepEqual(parsePeople([person("p1", { proteinGoal: { kind: "known", gramsPerDay: grams, coverage: "selected-meals" } })]), { outcome: "error", code: "invalid_people_input" });
  }
  for (const bad of [person("p1", { profileRevision: -1 }), person("p1", { profileRevision: Number.MAX_SAFE_INTEGER + 1 }), person("p1", { accountId: "must-not-authorize" }), person("p1", { proteinGoal: { kind: "unknown", gramsPerDay: "150" } }), person("p1", { calorieGoal: undefined })]) {
    assert.deepEqual(parsePeople([bad]), { outcome: "error", code: "invalid_people_input" });
  }
  assert.deepEqual(parsePeople([person("p1"), person("p1")]), { outcome: "error", code: "invalid_people_input" });
});

test("full-day coverage is retained with a policy hold rather than claimed as covered", () => {
  const result = parsePeople([person("p1", { proteinGoal: { kind: "known", gramsPerDay: "150", coverage: "full-day" } })]);
  assert.equal(result.outcome, "validated");
  if (result.outcome === "validated") assert.ok(result.holds.some(row => row.code === "goal_coverage_policy_required"));
});

test("accessors, symbols, sparse lists and nested surplus fields refuse without reading getters", () => {
  let reads = 0;
  const getter = Object.defineProperty(person(), "proteinGoal", { enumerable: true, get() { reads++; throw new Error("Must not read getter"); } });
  const decorated = Object.assign([person()], { extra: undefined });
  for (const rows of [[getter], [{ ...person(), [Symbol("extra")]: true }], new Array(1), decorated, [person("p1", { preferences: { preferredRecipeIds: ["fixture"], extra: undefined } })]]) {
    assert.deepEqual(parsePeople(rows), { outcome: "error", code: "invalid_people_input" });
  }
  assert.equal(reads, 0);
});

test("person parsing is non-mutating and returns immutable normalized values", () => {
  const source = [person("p1", { preferences: { preferredRecipeIds: ["fixture"] } })], before = JSON.stringify(source);
  Object.freeze(source[0]!.proteinGoal); Object.freeze(source[0]); Object.freeze(source);
  const result = parsePeople(source); assert.equal(result.outcome, "validated");
  assert.equal(JSON.stringify(source), before);
  if (result.outcome === "validated") { assert.ok(Object.isFrozen(result.people)); assert.ok(Object.isFrozen(result.people[0]!.proteinGoal)); }
});
