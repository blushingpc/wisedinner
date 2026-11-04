import test from "node:test";
import assert from "node:assert/strict";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";

test("reference snapshot preserves ordinary data and isolates every nested mutable container", () => {
  const input = { rows: Array.from({ length: 1300 }, (_, id) => ({ id, amount: { numerator: String(id), denominator: "1" }, valid: true, optional: null })) };
  const output = copyReferenceData(input); assert.deepEqual(output, input); assert.notEqual(output, input);
  input.rows[0]!.amount.numerator = "changed"; assert.equal((output as typeof input).rows[0]!.amount.numerator, "0");
});

test("snapshot never invokes getters, toJSON or coercion functions", () => {
  let reads = 0; const getter = Object.defineProperty({}, "value", { enumerable: true, get() { reads++; return 1; } });
  for (const value of [getter, { toJSON() { reads++; return {}; } }, { nested: { toString() { reads++; return "allowed"; } } }]) assert.throws(() => copyReferenceData(value));
  assert.equal(reads, 0);
});

test("snapshot rejects sparse, symbolic, hidden, inherited and nonfinite data", () => {
  for (const value of [new Array(1), Object.assign([], { extra: 1 }), { [Symbol("hidden")]: 1 }, Object.defineProperty({}, "hidden", { value: 1 }), new Date(), NaN, Infinity, BigInt(1), undefined, () => 1]) assert.throws(() => copyReferenceData(value));
});

test("cycles and excessive depth are bounded rather than recursively expanding forever", () => {
  const cycle: { self?: unknown } = {}; cycle.self = cycle; assert.throws(() => copyReferenceData(cycle));
  let deep: unknown = null; for (let i = 0; i < 18; i++) deep = [deep]; assert.throws(() => copyReferenceData(deep));
});

test("snapshot size bounds apply before memory expansion", () => {
  assert.throws(() => copyReferenceData("a".repeat(10001)));
  assert.throws(() => copyReferenceData(new Array(20001).fill(0)));
  assert.throws(() => copyReferenceData(new Array(4000).fill("a".repeat(10000))));
});

test("prototype-like data keys remain own data, never prototype mutation", () => {
  const input = JSON.parse('{"__proto__":{"polluted":true},"constructor":"data"}'), output = copyReferenceData(input) as Record<string, unknown>;
  assert.equal(Object.getPrototypeOf(output), Object.prototype); assert.equal(Object.hasOwn(output, "__proto__"), true); assert.equal(Object.hasOwn({}, "polluted"), false);
});

test("canonical snapshots preserve values and serialize identically under nested key reorder", () => {
  for (let i = 0; i < 40; i++) {
    const left = { z: [{ numerator: String(i), denominator: "3" }], a: { present: true, optional: null } };
    const right = { a: { optional: null, present: true }, z: [{ denominator: "3", numerator: String(i) }] };
    assert.equal(JSON.stringify(canonicalReferenceData(left)), JSON.stringify(canonicalReferenceData(right)));
    assert.deepEqual(canonicalReferenceData(left), left);
  }
});
