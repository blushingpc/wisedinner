import { divide, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";

// Internal typed provenance, not source authority or a physical error bound.
export const NOMINAL_DENSITY_KIND = "published-nominal-liquid-density-reference";
export const NOMINAL_DENSITY_FLAG = "nominal-liquid-density-reference-not-product-measurement";
export const NOMINAL_DENSITY_WARNING = "uses-nominal-liquid-density-reference";
export type NominalDensityReference = { readonly kind: typeof NOMINAL_DENSITY_KIND; readonly densityGPerMl: ExactAmount; readonly sourceSha256: string; readonly reviewEffectiveFrom: string };
function fields(value: unknown, names: readonly string[]): Record<string, unknown> {
 if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype,null].includes(Object.getPrototypeOf(value))) throw Error("Invalid nominal density reference");
 const descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors),result:Record<string,unknown>={};
 if(keys.length!==names.length||names.some(k=>!Object.hasOwn(descriptors,k)))throw Error("Invalid nominal density reference");
 for(const key of keys){if(typeof key!=="string"||!names.includes(key))throw Error("Invalid nominal density reference");const d=descriptors[key]!;if(!("value"in d)||!d.enumerable)throw Error("Invalid nominal density reference");result[key]=d.value;}
 return result;
}
export function readNominalDensityReference(value: unknown): NominalDensityReference {
 const r=fields(value,["kind","densityGPerMl","sourceSha256","reviewEffectiveFrom"]),p=fields(r.densityGPerMl,["numerator","denominator"]);
 if(r.kind!==NOMINAL_DENSITY_KIND||typeof r.sourceSha256!=="string"||!/^[a-f0-9]{64}$/.test(r.sourceSha256))throw Error("Invalid nominal density reference");
 if(typeof r.reviewEffectiveFrom!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(r.reviewEffectiveFrom)||Number.isNaN(Date.parse(r.reviewEffectiveFrom+"T00:00:00Z"))||new Date(r.reviewEffectiveFrom+"T00:00:00Z").toISOString().slice(0,10)!==r.reviewEffectiveFrom)throw Error("Invalid nominal density review date");
 for(const key of["numerator","denominator"])if(typeof p[key]!=="string"||(p[key] as string).length>120||!/^[1-9]\d*$/.test(p[key] as string))throw Error("Invalid nominal density reference");
 const d=rational(BigInt(p.numerator as string),BigInt(p.denominator as string));return Object.freeze({kind:NOMINAL_DENSITY_KIND,densityGPerMl:Object.freeze(receipt(d)),sourceSha256:r.sourceSha256,reviewEffectiveFrom:r.reviewEffectiveFrom});
}
export function nominalDensityFactor(value: NominalDensityReference): Rational {
 return divide(rational(BigInt(1)),rational(BigInt(value.densityGPerMl.numerator),BigInt(value.densityGPerMl.denominator)));
}

