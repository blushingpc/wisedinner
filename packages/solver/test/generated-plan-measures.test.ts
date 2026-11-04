import test from "node:test";
import assert from "node:assert/strict";
import { toBaseQuantity } from "../src/generated-plan-measures.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const input = (changes: Record<string, unknown> = {}) => ({ ingredientId: "fixture-food", preparedState: "dry", baseUnit: "g", amount: amount("2"), unit: "piece", ...changes });
const fact = (changes: Record<string, unknown> = {}) => ({ id: "fixture-piece", ingredientId: "fixture-food", preparedState: "dry", baseUnit: "g", fromUnit: "piece", factor: amount("25"), sourceSha256: "a".repeat(64), basis: { kind: "food-specific", description: "Synthetic test piece, not a real ingredient fact." }, ...changes });

test("base quantities remain exact including zero, without invented measure facts", () => {
  assert.deepEqual(toBaseQuantity(input({ amount: amount("0", "7"), unit: "g" }), []), { outcome: "success", quantity: amount("0"), unit: "g", evidence: null });
  assert.equal(toBaseQuantity(input({ unit: "g", factId: "ignored" }), []).outcome, "error");
});

test("piece, food-specific cup and tablespoon facts convert exact fractions", () => {
  const cases = [
    { unit: "piece", factor: amount("25"), basis: fact().basis, expected: amount("25", "2") },
    { unit: "cup", factor: amount("96"), basis: { kind: "volume", convention: "Synthetic declared cup convention" }, expected: amount("48") },
    { unit: "tbsp", factor: amount("15"), basis: { kind: "volume", convention: "Synthetic declared tablespoon convention" }, expected: amount("15", "2") },
  ];
  for (const row of cases) {
    const result = toBaseQuantity(input({ amount: amount("1", "2"), unit: row.unit }), [fact({ fromUnit: row.unit, factor: row.factor, basis: row.basis })]);
    assert.equal(result.outcome, "success");
    if (result.outcome !== "success") throw new Error("Expected supported synthetic conversion");
    assert.deepEqual(result.quantity, row.expected);
    assert.equal(result.evidence?.sourceSha256, "a".repeat(64));
  }
});

test("package fractions require exact declared pack quantity and unit", () => {
  const pack = fact({ id: "fixture-pack", fromUnit: "package-fraction", factor: amount("240"), basis: { kind: "package", packageId: "fixture-pack-240g", packageQuantity: amount("240"), packageUnit: "g" } });
  const result = toBaseQuantity(input({ unit: "package-fraction", amount: amount("1", "3") }), [pack]);
  assert.equal(result.outcome, "success");
  if (result.outcome === "success") assert.deepEqual(result.quantity, amount("80"));
  assert.equal(toBaseQuantity(input(), [fact({ ...pack, factor: amount("239") })]).outcome, "error");
  assert.equal(toBaseQuantity(input(), [fact({ ...pack, basis: { ...pack.basis, packageUnit: "ml" } })]).outcome, "error");
});

test("missing, custom and ambiguous measures stay held instead of guessed", () => {
  assert.deepEqual(toBaseQuantity(input(), []), { outcome: "held", code: "measure_fact_needed" });
  assert.deepEqual(toBaseQuantity(input({ unit: "handful" }), []), { outcome: "held", code: "unsupported_measure_unit" });
  assert.deepEqual(toBaseQuantity(input(), [fact(), fact({ id: "second", sourceSha256: "b".repeat(64) })]), { outcome: "held", code: "measure_fact_ambiguous" });
  const result = toBaseQuantity(input({ factId: "second" }), [fact(), fact({ id: "second", factor: amount("30") })]);
  assert.equal(result.outcome, "success");
  if (result.outcome === "success") assert.deepEqual(result.quantity, amount("60"));
});

test("ingredient, prepared state and base unit must match the exact fact", () => {
  for (const changes of [{ ingredientId: "other-food" }, { preparedState: "cooked" }, { baseUnit: "ml" }]) {
    assert.deepEqual(toBaseQuantity(input(changes), [fact()]), { outcome: "held", code: "measure_fact_needed" });
    assert.deepEqual(toBaseQuantity(input({ ...changes, factId: "fixture-piece" }), [fact()]), { outcome: "held", code: "measure_fact_mismatch" });
  }
  assert.deepEqual(toBaseQuantity(input({ factId: "missing" }), [fact()]), { outcome: "held", code: "measure_fact_needed" });
});

test("conflicting or duplicate evidence IDs refuse rather than selecting one", () => {
  assert.deepEqual(toBaseQuantity(input(), [fact(), fact()]), { outcome: "error", code: "invalid_measure_registry" });
  assert.deepEqual(toBaseQuantity(input(), [fact(), fact({ factor: amount("200") })]), { outcome: "error", code: "invalid_measure_registry" });
});

test("invalid rationals and evidence refuse without exposing supplied values", () => {
  for (const bad of [null, 2, amount("-1"), amount("1", "0"), amount("NaN"), amount("01"), amount("1.5"), { ...amount("1"), extra: undefined }]) {
    assert.deepEqual(toBaseQuantity(input({ amount: bad }), [fact()]), { outcome: "error", code: "invalid_measure_input" });
  }
  for (const bad of [fact({ factor: amount("0") }), fact({ factor: amount("1", "0") }), fact({ sourceSha256: "not-a-hash" }), fact({ basis: {} }), { ...fact(), unused: undefined }]) {
    assert.deepEqual(toBaseQuantity(input(), [bad]), { outcome: "error", code: "invalid_measure_registry" });
  }
});

test("unknown keys, accessors and symbols are rejected before reading their values", () => {
  let reads = 0;
  const getter = Object.defineProperty(input(), "amount", { enumerable: true, get() { reads++; throw new Error("Must not read getter"); } });
  const symbolic = { ...input(), [Symbol("surplus")]: true };
  for (const bad of [null, [], { ...input(), surplus: undefined }, getter, symbolic]) {
    assert.deepEqual(toBaseQuantity(bad, [fact()]), { outcome: "error", code: "invalid_measure_input" });
  }
  const badFact = Object.defineProperty(fact(), "factor", { enumerable: true, get() { reads++; throw new Error("Must not read fact getter"); } });
  assert.deepEqual(toBaseQuantity(input(), [badFact]), { outcome: "error", code: "invalid_measure_registry" });
  assert.equal(reads, 0);
});

test("sparse or decorated registries refuse and never mutate sources", () => {
  const sparse = new Array(1), decorated = Object.assign([fact()], { extra: undefined });
  for (const bad of [null, sparse, decorated]) assert.deepEqual(toBaseQuantity(input(), bad), { outcome: "error", code: "invalid_measure_registry" });
  const request = input(), registry = [fact()], before = JSON.stringify({ request, registry });
  Object.freeze(request.amount); Object.freeze(request); Object.freeze(registry[0]!.factor); Object.freeze(registry[0]); Object.freeze(registry);
  assert.equal(toBaseQuantity(request, registry).outcome, "success");
  assert.equal(JSON.stringify({ request, registry }), before);
});

test("exact conversions preserve arithmetic across the input domain", () => {
  const registry = [fact({ factor: amount("7", "3") })];
  for (let n = 0; n <= 80; n++) for (let d = 1; d <= 20; d++) {
    const result = toBaseQuantity(input({ amount: amount(String(n), String(d)) }), registry);
    assert.equal(result.outcome, "success");
    if (result.outcome !== "success") throw new Error("Supported domain must convert");
    assert.equal(BigInt(result.quantity.numerator) * BigInt(d) * BigInt(3), BigInt(n) * BigInt(7) * BigInt(result.quantity.denominator));
  }
  const large = "900719925474099300001";
  const result = toBaseQuantity(input({ amount: amount(large) }), registry);
  assert.equal(result.outcome, "success");
  if (result.outcome === "success") assert.equal(BigInt(result.quantity.numerator) * BigInt(3), BigInt(large) * BigInt(7) * BigInt(result.quantity.denominator));
});
