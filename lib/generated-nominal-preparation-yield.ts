import { compare, divide, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";

// Internal provenance for a published raw preparation estimate. It is neither
// a cooking-yield model nor a measured product or physical error bound.
export const NOMINAL_PREPARATION_YIELD_KIND = "published-nominal-raw-preparation-yield-reference";
export const NOMINAL_PREPARATION_YIELD_FLAG = "nominal-raw-preparation-yield-reference-not-product-measurement";
export const NOMINAL_PREPARATION_YIELD_WARNING = "uses-nominal-raw-preparation-yield-reference";
export type NominalPreparationYieldReference = {
  readonly kind: typeof NOMINAL_PREPARATION_YIELD_KIND;
  readonly preparedPerPurchased: ExactAmount;
  readonly sourceSha256: string;
  readonly reviewEffectiveFrom: string;
};

function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("Invalid nominal raw preparation reference");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Record<string, unknown> = {};
  if (keys.length !== names.length || names.some(key => !Object.hasOwn(descriptors, key))) throw Error("Invalid nominal raw preparation reference");
  for (const key of keys) {
    if (typeof key !== "string" || !names.includes(key)) throw Error("Invalid nominal raw preparation reference");
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) throw Error("Invalid nominal raw preparation reference");
    result[key] = descriptor.value;
  }
  return result;
}

export function readNominalPreparationYieldReference(value: unknown): NominalPreparationYieldReference {
  const row = fields(value, ["kind", "preparedPerPurchased", "sourceSha256", "reviewEffectiveFrom"]), point = fields(row.preparedPerPurchased, ["numerator", "denominator"]);
  if (row.kind !== NOMINAL_PREPARATION_YIELD_KIND || typeof row.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sourceSha256)) throw Error("Invalid nominal raw preparation reference");
  if (typeof row.reviewEffectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewEffectiveFrom) || Number.isNaN(Date.parse(row.reviewEffectiveFrom + "T00:00:00Z")) || new Date(row.reviewEffectiveFrom + "T00:00:00Z").toISOString().slice(0, 10) !== row.reviewEffectiveFrom) throw Error("Invalid nominal raw preparation review date");
  for (const key of ["numerator", "denominator"]) if (typeof point[key] !== "string" || (point[key] as string).length > 120 || !/^[1-9]\d*$/.test(point[key] as string)) throw Error("Invalid nominal raw preparation reference");
  const yieldPoint = rational(BigInt(point.numerator as string), BigInt(point.denominator as string));
  if (compare(yieldPoint, rational(BigInt(1))) > 0) throw Error("Raw preparation yield cannot exceed one");
  return Object.freeze({ kind: NOMINAL_PREPARATION_YIELD_KIND, preparedPerPurchased: Object.freeze(receipt(yieldPoint)), sourceSha256: row.sourceSha256, reviewEffectiveFrom: row.reviewEffectiveFrom });
}

export function nominalPreparationYieldFactor(value: NominalPreparationYieldReference): Rational {
  return divide(rational(BigInt(1)), rational(BigInt(value.preparedPerPurchased.numerator), BigInt(value.preparedPerPurchased.denominator)));
}
