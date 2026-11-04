import { copyReferenceData } from "./generated-plan-data.ts";
import { compare, distance, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";

// Standing founder rule, not a caller-tunable ranking or goal policy.
export const REPLACEMENT_PROTEIN_RULE = "max-5g-rounded-15percent-no-override-v1";
// Later approved new-app behavior: variable portions/protein are allowed when
// every person's evaluated day still meets the goal and no groceries are added.
// The historical V1 policy above remains unchanged and is not caller-tunable.
export const REPLACEMENT_RULE_V2 = "daily-goal-and-reserved-groceries-v2";
type Range = { min: Rational; max: Rational };
function keys(value: unknown, expected: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid range");
  const row = value as Record<string, unknown>;
  if (Object.keys(row).length !== expected.length || expected.some(key => !Object.hasOwn(row, key))) throw new Error("Invalid range");
  return row;
}
function exact(value: unknown): Rational {
  const row = keys(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof row[key] !== "string" || !/^(0|[1-9]\d*)$/.test(row[key]) || row[key].length > 240) throw new Error("Invalid quantity");
  return rational(BigInt(row.numerator as string), BigInt(row.denominator as string));
}
function range(value: unknown): Range {
  const row = keys(copyReferenceData(value), ["min", "max"]), min = exact(row.min), max = exact(row.max);
  if (compare(min, max) > 0) throw new Error("Reversed range");
  return { min, max };
}
function tolerance(protein: Rational): Rational {
  // Exact nonnegative half-up rounding of protein *15/100, without floats.
  const rounded = (protein.n * BigInt(30) + protein.d * BigInt(100)) / (protein.d * BigInt(200));
  return rational(rounded < BigInt(5) ? BigInt(5) : rounded);
}
export function checkReplacementProteinTolerance(previous: unknown, candidate: unknown) {
  try {
    const before = range(previous), after = range(candidate), lower = tolerance(before.min), upper = tolerance(before.max);
    const evidence = { rule: REPLACEMENT_PROTEIN_RULE, toleranceGrams: { min: receipt(lower), max: receipt(upper) } };
    const first = distance(before.min, after.max), second = distance(before.max, after.min), worst = compare(first, second) > 0 ? first : second;
    if (compare(worst, lower) <= 0) return { outcome: "permitted", ...evidence } as const;
    const separation = compare(after.min, before.max) > 0 ? distance(after.min, before.max) : compare(before.min, after.max) > 0 ? distance(before.min, after.max) : rational(BigInt(0));
    if (compare(separation, upper) > 0) return { outcome: "no_fit", code: "replacement_protein_tolerance_exceeded", ...evidence } as const;
    // Conservative sufficient proof only. Do not infer a point estimate or
    // widen tolerance from overlapping conditional source ranges.
    return { outcome: "held", code: "replacement_protein_tolerance_uncertain", ...evidence } as const;
  } catch { return { outcome: "error", code: "invalid_replacement_protein_range" } as const; }
}
