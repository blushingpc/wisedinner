import { divide, rational, receipt, compare, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";

// Typed nominal edible mass, never actual individual/shell mass or preparation yield.
export const NOMINAL_EGG_KIND = "published-nominal-large-egg-edible-mass-reference";
export const NOMINAL_EGG_FLAG = "nominal-large-egg-edible50g-not-individual-mass-or-preparation-yield";
export const NOMINAL_EGG_WARNING = "uses-nominal-large-egg-count-reference";
export type NominalEggReference = { readonly kind: typeof NOMINAL_EGG_KIND; readonly edibleGPerLargeEgg: ExactAmount; readonly sourceSha256: string; readonly reviewEffectiveFrom: string };
function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
 if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("Invalid nominal egg reference");
 const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Record<string, unknown> = {};
 if (keys.length !== names.length || names.some(k => !Object.hasOwn(descriptors, k))) throw Error("Invalid nominal egg reference");
 for (const key of keys) { if (typeof key !== "string" || !names.includes(key)) throw Error("Invalid nominal egg reference"); const descriptor = descriptors[key]!; if (!("value" in descriptor) || !descriptor.enumerable) throw Error("Invalid nominal egg reference"); result[key] = descriptor.value; }
 return result;
}
export function readNominalEggReference(value: unknown): NominalEggReference {
 const row = fields(value, ["kind", "edibleGPerLargeEgg", "sourceSha256", "reviewEffectiveFrom"]), point = fields(row.edibleGPerLargeEgg, ["numerator", "denominator"]);
 if (row.kind !== NOMINAL_EGG_KIND || typeof row.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(row.sourceSha256)) throw Error("Invalid nominal egg reference");
 if (typeof row.reviewEffectiveFrom !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(row.reviewEffectiveFrom) || Number.isNaN(Date.parse(row.reviewEffectiveFrom + "T00:00:00Z")) || new Date(row.reviewEffectiveFrom + "T00:00:00Z").toISOString().slice(0, 10) !== row.reviewEffectiveFrom) throw Error("Invalid nominal egg review date");
 for (const key of ["numerator", "denominator"]) if (typeof point[key] !== "string" || (point[key] as string).length > 120 || !/^[1-9]\d*$/.test(point[key] as string)) throw Error("Invalid nominal egg reference");
 const mass = rational(BigInt(point.numerator as string), BigInt(point.denominator as string));
 if (compare(mass, rational(BigInt(50))) !== 0) throw Error("Only the reviewed large50g edible reference is supported");
 return Object.freeze({ kind: NOMINAL_EGG_KIND, edibleGPerLargeEgg: Object.freeze(receipt(mass)), sourceSha256: row.sourceSha256, reviewEffectiveFrom: row.reviewEffectiveFrom });
}
export function nominalEggCountFactor(value: NominalEggReference): Rational {
 return divide(rational(BigInt(1)), rational(BigInt(value.edibleGPerLargeEgg.numerator), BigInt(value.edibleGPerLargeEgg.denominator)));
}
