import test from "node:test";
import assert from "node:assert/strict";
import { checkReplacementProteinTolerance } from "./generated-plan-protein-tolerance.ts";
const amount = (n: number | string, d = "1") => ({ numerator: String(n), denominator: d });
const point = (n: number | string, d = "1") => ({ min: amount(n, d), max: amount(n, d) });
const interval = (min: number, max: number) => ({ min: amount(min), max: amount(max) });

test("standing floor, rounded percentage and exact inclusive endpoints", () => {
  for (const [old, next, expected] of [[10, 15, "permitted"], [10, 16, "no_fit"], [50, 58, "permitted"], [50, 59, "no_fit"], [100, 85, "permitted"], [100, 84, "no_fit"], [0, 5, "permitted"], [0, 6, "no_fit"]] as const) assert.equal(checkReplacementProteinTolerance(point(old), point(next)).outcome, expected);
  assert.equal(checkReplacementProteinTolerance(point("49999", "1000"), point("57999", "1000")).outcome, "no_fit");
  assert.equal(checkReplacementProteinTolerance(point(50), point("580001", "10000")).outcome, "no_fit");
});

test("point domain agrees with independent integer rounding oracle", () => {
  for (let old = 0; old <= 5000; old += 17) for (const delta of [-17, -8, -5, 0, 5, 8, 17]) {
    const candidate = Math.max(0, old + delta * 20), tolerance = Math.max(5, Math.floor((old * 15 + 1000) / 2000)), expected = Math.abs(candidate - old) <= tolerance * 20;
    assert.equal(checkReplacementProteinTolerance(point(old, "20"), point(candidate, "20")).outcome, expected ? "permitted" : "no_fit");
  }
});

test("conditional ranges distinguish proof, definite rejection and uncertainty", () => {
  assert.equal(checkReplacementProteinTolerance(interval(90, 96), interval(90, 96)).outcome, "permitted");
  assert.equal(checkReplacementProteinTolerance(interval(30, 40), interval(36, 42)).outcome, "held");
  assert.equal(checkReplacementProteinTolerance(interval(30, 40), interval(50, 55)).outcome, "no_fit");
  for (let low = 0; low < 80; low += 7) for (let next = 0; next < 100; next += 9) {
    const result = checkReplacementProteinTolerance(interval(low, low + 3), interval(next, next + 4));
    for (let a = low * 2; a <= (low + 3) * 2; a++) for (let b = next * 2; b <= (next + 4) * 2; b++) {
      const allowed = Math.abs(a - b) / 2 <= Math.max(5, Math.round(a / 2 * .15));
      if (result.outcome === "permitted") assert.equal(allowed, true);
      if (result.outcome === "no_fit") assert.equal(allowed, false);
    }
  }
});

test("malformed, reversed, override and executable ranges are rejected without getters", () => {
  let reads = 0; const hostile = Object.defineProperty({}, "min", { enumerable: true, get() { reads++; return amount(30); } });
  for (const value of [hostile, null, { ...point(30), tolerance: 100 }, interval(31, 30), { min: amount(1, "0"), max: amount(2) }, { min: amount("1".repeat(241)), max: amount(2) }]) assert.equal(checkReplacementProteinTolerance(value, point(30)).outcome, "error");
  assert.equal(reads, 0);
});
