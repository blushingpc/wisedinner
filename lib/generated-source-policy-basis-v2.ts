import { sha256Hex } from "./generated-runtime-bytes.ts";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { rational, receipt } from "../packages/solver/src/generated-meal-ranges.ts";

export type SourcePolicyBasisV2 = {
  readonly policy: "wd-source-policy-basis-v2";
  readonly catalogSha256: string;
  readonly purchaseCorrespondencesSha256: string;
  readonly regionalPackFactsSha256: string;
  readonly referencePricePolicy: "wd-price-reference-fallback-v2" | null;
  readonly referenceConfigurationSha256: string | null;
  readonly documentaryValuationPolicy?: "wd-dated-documentary-reference-v1";
  readonly utilityPolicy: "wd-tap-cooking-water-utility-v1" | null;
  readonly utilityConfigurationSha256: string | null;
  readonly basisSha256: string;
};
export function sourcePolicyHashV2(value: unknown): string {
  return sha256Hex(JSON.stringify(canonicalReferenceData(value)));
}
// This does not admit data. The existing complete registry/quote validators run
// first. Reduce their exact rational fields without dropping unused entries,
// nominal proofs, flags or array order. Never use on lexical utility demand rows.
export function normalizeSourcePolicyDataV2(value: unknown): unknown {
  function walk(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === "object") {
      const fields = value as Record<string, unknown>, keys = Object.keys(fields);
      if (keys.length === 2 && keys.includes("numerator") && keys.includes("denominator")) {
        for (const key of keys) if (typeof fields[key] !== "string" || !/^(0|[1-9]\d*)$/.test(fields[key] as string) || (fields[key] as string).length > 240) throw Error("Invalid exact source-policy field");
        return receipt(rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string)));
      }
      return Object.fromEntries(keys.map(key => [key, walk(fields[key])]));
    }
    return value;
  }
  return walk(copyReferenceData(value));
}
export function createSourcePolicyBasisV2(catalogSha256: string, correspondences: unknown, regionalFacts: unknown, referenceConfiguration: unknown | null, utilityConfiguration: unknown | null): SourcePolicyBasisV2 {
  if (!/^[a-f0-9]{64}$/.test(catalogSha256)) throw Error("Invalid catalog digest");
  const documentary = referenceConfiguration !== null && typeof referenceConfiguration === "object" && Object.hasOwn(referenceConfiguration, "valuationPolicy");
  if (documentary && (referenceConfiguration as Record<string, unknown>).valuationPolicy !== "wd-dated-documentary-reference-v1") throw Error("Invalid documentary valuation policy");
  const basis = {
    policy: "wd-source-policy-basis-v2" as const, catalogSha256,
    purchaseCorrespondencesSha256: sourcePolicyHashV2(correspondences),
    regionalPackFactsSha256: sourcePolicyHashV2(regionalFacts),
    referencePricePolicy: referenceConfiguration === null ? null : "wd-price-reference-fallback-v2" as const,
    referenceConfigurationSha256: referenceConfiguration === null ? null : sourcePolicyHashV2(referenceConfiguration),
    ...(documentary ? { documentaryValuationPolicy: "wd-dated-documentary-reference-v1" as const } : {}),
    utilityPolicy: utilityConfiguration === null ? null : "wd-tap-cooking-water-utility-v1" as const,
    utilityConfigurationSha256: utilityConfiguration === null ? null : sourcePolicyHashV2(utilityConfiguration),
  };
  return Object.freeze({ ...basis, basisSha256: sourcePolicyHashV2(["wd-source-policy-basis-v2", basis]) });
}
