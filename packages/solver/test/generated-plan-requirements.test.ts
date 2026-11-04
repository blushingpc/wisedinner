import test from "node:test";
import assert from "node:assert/strict";
import { aggregateRequirements } from "../src/generated-plan-requirements.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const demand = (assignmentId = "a1", changes: Record<string, unknown> = {}) => ({ assignmentId, recipeId: "fixture-recipe", recipeSha256: "a".repeat(64), ingredientId: "fixture-rice", preparedState: "dry", baseUnit: "g", amount: amount("100"), ...changes });

test("shared consumed requirements sum exactly while keeping assignment/source trace", () => {
  const result = aggregateRequirements([demand("person-one-meal"), demand("person-two-meal", { amount: amount("200") })]);
  assert.equal(result.outcome, "success");
  if (result.outcome !== "success") throw new Error("Expected aggregation");
  assert.equal(result.basis, "consumed-base-quantities-only"); assert.equal(result.purchasedBasisSupported, false);
  assert.equal(result.requirements.length, 1); assert.deepEqual(result.requirements[0]!.quantity, amount("300"));
  assert.deepEqual(result.requirements[0]!.trace.map(row => row.assignmentId), ["person-one-meal", "person-two-meal"]);
});

test("prepared states, units and collision-prone ingredient strings never merge", () => {
  const result = aggregateRequirements([demand("a1"), demand("a2", { preparedState: "cooked" }), demand("a3", { baseUnit: "ml" }), demand("a4", { ingredientId: "a|b", preparedState: "c" }), demand("a5", { ingredientId: "a", preparedState: "b|c" })]);
  assert.equal(result.outcome, "success");
  if (result.outcome === "success") assert.equal(result.requirements.length, 5);
});

test("duplicate assignment demand refuses rather than adding it twice", () => {
  assert.deepEqual(aggregateRequirements([demand(), demand()]), { outcome: "error", code: "duplicate_assignment_demand" });
  assert.deepEqual(aggregateRequirements([demand(), demand("a1", { amount: amount("1") })]), { outcome: "error", code: "duplicate_assignment_demand" });
});

test("one assignment or recipe cannot mix source identities", () => {
  assert.deepEqual(aggregateRequirements([demand(), demand("a1", { ingredientId: "other", recipeId: "other-recipe" })]), { outcome: "error", code: "assignment_source_conflict" });
  assert.deepEqual(aggregateRequirements([demand(), demand("a2", { recipeSha256: "b".repeat(64) })]), { outcome: "error", code: "recipe_source_conflict" });
});

test("fractions, large integers and zero remain exact without purchase claims", () => {
  const cases = [
    [amount("1", "3"), amount("1", "6"), amount("1", "2")],
    [amount("900719925474099300001"), amount("2"), amount("900719925474099300003")],
    [amount("0", "7"), amount("0"), amount("0")],
  ];
  for (const [a, b, expected] of cases) {
    const result = aggregateRequirements([demand("a1", { amount: a }), demand("a2", { amount: b })]);
    assert.equal(result.outcome, "success"); if (result.outcome === "success") assert.deepEqual(result.requirements[0]!.quantity, expected);
  }
});

test("order is deterministic and aggregation never mutates caller data", () => {
  const inputs = [demand("z", { ingredientId: "z" }), demand("a"), demand("b")], before = JSON.stringify(inputs);
  const first = aggregateRequirements(inputs); assert.deepEqual(first, aggregateRequirements([...inputs].reverse()));
  assert.equal(JSON.stringify(inputs), before);
  assert.equal(first.outcome, "success"); if (first.outcome === "success") assert.ok(Object.isFrozen(first.requirements[0]!.trace));
});

test("unknown fields, invalid amounts, sparse arrays and getters refuse without reading getters", () => {
  let reads = 0;
  const getter = Object.defineProperty(demand(), "amount", { enumerable: true, get() { reads++; throw new Error("Must not read getter"); } });
  for (const value of [null, new Array(1), [{ ...demand(), surplus: undefined }], [getter], [{ ...demand(), [Symbol("extra")]: true }], [demand("a", { amount: amount("1", "0") })], [demand("a", { baseUnit: "cups" })]]) {
    assert.deepEqual(aggregateRequirements(value), { outcome: "error", code: "invalid_requirement_input" });
  }
  assert.equal(reads, 0);
});

test("sum capacity is held rather than rounded or treated as impossible", () => {
  const denominators = ["1" + "0".repeat(118) + "3", "1" + "0".repeat(118) + "7", "1" + "0".repeat(118) + "9"];
  assert.deepEqual(aggregateRequirements(denominators.map((d, i) => demand(`a${i}`, { amount: amount("1", d) }))), { outcome: "held", code: "quantity_capacity_exceeded" });
});

test("aggregation agrees with independent exact addition throughout a bounded domain", () => {
  for (let n = 0; n <= 40; n++) for (let d = 1; d <= 15; d++) {
    const result = aggregateRequirements([demand("a1", { amount: amount(String(n), String(d)) }), demand("a2", { amount: amount("2", "3") })]);
    assert.equal(result.outcome, "success");
    if (result.outcome !== "success") throw new Error("Expected domain sum");
    const q = result.requirements[0]!.quantity;
    assert.equal(BigInt(q.numerator) * BigInt(d) * BigInt(3), (BigInt(n) * BigInt(3) + BigInt(2) * BigInt(d)) * BigInt(q.denominator));
  }
});
