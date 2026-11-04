// Exact decimal/rational arithmetic for the explicit generated-meal reference planner.
export type Rational = { n: bigint; d: bigint };
const Z = BigInt(0), O = BigInt(1), TEN = BigInt(10);
function gcd(a: bigint, b: bigint): bigint { while (b !== Z) { const r = a % b; a = b; b = r; } return a; }
export function rational(n: bigint, d = O): Rational {
  if (n < Z || d <= Z) throw new Error("Invalid nonnegative rational");
  const g = gcd(n, d); return { n: n / g, d: d / g };
}
export function decimal(value: unknown): Rational {
  if (typeof value !== "string" || value.length > 120 || !/^(0|[1-9]\d*)(\.\d+)?$/.test(value)) throw new Error("Invalid exact decimal");
  const [whole, fraction = ""] = value.split(".");
  return rational(BigInt(`${whole}${fraction}`), TEN ** BigInt(fraction.length));
}
export function add(a: Rational, b: Rational): Rational { return rational(a.n * b.d + b.n * a.d, a.d * b.d); }
export function multiply(a: Rational, b: Rational): Rational { return rational(a.n * b.n, a.d * b.d); }
export function divide(a: Rational, b: Rational): Rational { if (b.n === Z) throw new Error("Zero divisor"); return rational(a.n * b.d, a.d * b.n); }
export function compare(a: Rational, b: Rational): number { const n = a.n * b.d - b.n * a.d; return n < Z ? -1 : n > Z ? 1 : 0; }
export function distance(a: Rational, b: Rational): Rational { const n = a.n * b.d - b.n * a.d; return rational(n < Z ? -n : n, a.d * b.d); }
export function approximate(a: Rational): number { return Number(a.n) / Number(a.d); }
export function receipt(a: Rational) { return { numerator: String(a.n), denominator: String(a.d) }; }
export function floorScaled(a: Rational, scale: number): number { return Number(a.n * BigInt(scale) / a.d); }
export function ceilScaled(a: Rational, scale: number): number { return Number((a.n * BigInt(scale) + a.d - O) / a.d); }
export function display(a: Rational): string { return approximate(a).toFixed(6).replace(/\.?0+$/, "") || "0"; }
export const zero = () => rational(Z);
export type ExactRange = { min: Rational; max: Rational };
export function range(min: unknown, max: unknown): ExactRange {
  const result = { min: decimal(min), max: decimal(max) };
  if (compare(result.min, result.max) > 0) throw new Error("Reversed range"); return result;
}
export function sumRange(a: ExactRange, b: ExactRange): ExactRange { return { min: add(a.min, b.min), max: add(a.max, b.max) }; }
export function scaleRange(a: ExactRange, scale: Rational): ExactRange { return { min: multiply(a.min, scale), max: multiply(a.max, scale) }; }
export function presentRange(a: ExactRange) { return { min: display(a.min), max: display(a.max), exactMin: receipt(a.min), exactMax: receipt(a.max) }; }
export function presentCost(a: ExactRange) { return { ...presentRange(a), minCents: floorScaled(a.min, 100), maxCents: ceilScaled(a.max, 100) }; }
