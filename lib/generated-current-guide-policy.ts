import type { CatalogYieldControl } from "./generated-plan-catalog.ts";
import {PROFILE_METHOD_POLICY,profileMethodDescriptor} from "./generated-profile-method-guides.ts";
import finalAssets from "./fixtures/current-final-practical-guides-v1.json" with {type:"json"};
import finalManifest from "./fixtures/current-final-source-v1.json" with {type:"json"};
import {FINAL_DERIVED_PIN} from "./generated-final-source-admission.ts";
import { createCurrentMealCoverage, createCurrentMealCoverageAsync, mealCoverageHash, PRACTICAL_ASSETS_SHA256 } from "./generated-current-meal-coverage.ts";
import { compare, rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { CurrentGuidePolicy } from "./generated-joined-plan.ts";
import practical from "./fixtures/current-reviewed-practical-guides-v1.json" with { type: "json" };

export const CURRENT_GUIDE_POLICY = "wd-current-guide-policy-v1";
// This host adapter may import coverage. The planner only consumes its callback,
// never imports this module, so configuration validation cannot recurse.
export function createCurrentGuidePolicy(source: unknown, configuration: unknown, profileMethods = false): CurrentGuidePolicy & { readonly descriptor: unknown; readonly sha256: string } {
  const config = configuration as { sourcePin: { sha256: string; recordCount: number } };
  const coverage = createCurrentMealCoverage(source, { configuration, sourcePin: config.sourcePin,
    configurationSha256: mealCoverageHash(configuration), asOfDate: "2026-10-30", region: "South",
    storeIds: ["reference-store-context-only"], ...(profileMethods?{profileMethodPolicy:PROFILE_METHOD_POLICY}:{}), practicalAssets: config.sourcePin.sha256===FINAL_DERIVED_PIN.sha256?finalAssets:practical });
  if (coverage.outcome !== "ready") throw Error("guide_policy_source_unavailable");
  const rows = new Map(coverage.rows.map(row => [row.recipeId, row]));
  const descriptor = Object.freeze({ ...(profileMethods?{profileMethodPolicy:profileMethodDescriptor()}:{}), version: CURRENT_GUIDE_POLICY, sourceSha256: coverage.sourceSha256,
    configurationSha256: coverage.configurationSha256, practicalAssetsSha256: config.sourcePin.sha256===FINAL_DERIVED_PIN.sha256?finalManifest.practicalAssetsSha256:PRACTICAL_ASSETS_SHA256,
    domainsSha256: mealCoverageHash(coverage.rows.map(r => [r.recipeId, r.recipeSha256, r.guideDomains.map(d => [d.sourceServings, d.guideSha256])])),
    rule: "original-full-batch-or-exact-reviewed-serving" });
  return Object.freeze({ descriptor, sha256: mealCoverageHash(descriptor), check(input: Parameters<CurrentGuidePolicy["check"]>[0]) {
    const row = rows.get(input.recipeId);
    try {
      const n = rational(BigInt(input.sourceServings.numerator), BigInt(input.sourceServings.denominator));
      if (row && row.recipeSha256 === input.recipeSha256 && row.guideDomains.some(d => compare(n, rational(BigInt(d.sourceServings.numerator), BigInt(d.sourceServings.denominator))) === 0)) return { outcome: "allowed" as const };
    } catch { /* Invalid rationals do not confer a guide domain. */ }
    return { outcome: "held" as const, reasons: [row?.recipeSha256 === input.recipeSha256 ? "source_serving_guide_required" : "source_or_recipe_basis_changed"] };
  } });
}

export async function createCurrentGuidePolicyAsync(source: unknown, configuration: unknown, profileMethods: boolean, yieldControl: CatalogYieldControl): Promise<CurrentGuidePolicy & { readonly descriptor: unknown; readonly sha256: string }> {
  const config = configuration as { sourcePin: { sha256: string; recordCount: number } };
  const coverage = await createCurrentMealCoverageAsync(source, { configuration, sourcePin: config.sourcePin,
    configurationSha256: mealCoverageHash(configuration), asOfDate: "2026-10-30", region: "South",
    storeIds: ["reference-store-context-only"], ...(profileMethods?{profileMethodPolicy:PROFILE_METHOD_POLICY}:{}), practicalAssets: config.sourcePin.sha256===FINAL_DERIVED_PIN.sha256?finalAssets:practical }, yieldControl);
  if (coverage.outcome !== "ready") throw Error("guide_policy_source_unavailable");
  const rows = new Map(coverage.rows.map(row => [row.recipeId, row]));
  const descriptor = Object.freeze({ ...(profileMethods?{profileMethodPolicy:profileMethodDescriptor()}:{}), version: CURRENT_GUIDE_POLICY, sourceSha256: coverage.sourceSha256,
    configurationSha256: coverage.configurationSha256, practicalAssetsSha256: config.sourcePin.sha256===FINAL_DERIVED_PIN.sha256?finalManifest.practicalAssetsSha256:PRACTICAL_ASSETS_SHA256,
    domainsSha256: mealCoverageHash(coverage.rows.map(r => [r.recipeId, r.recipeSha256, r.guideDomains.map(d => [d.sourceServings, d.guideSha256])])),
    rule: "original-full-batch-or-exact-reviewed-serving" });
  return Object.freeze({ descriptor, sha256: mealCoverageHash(descriptor), check(input: Parameters<CurrentGuidePolicy["check"]>[0]) {
    const row = rows.get(input.recipeId);
    try {
      const n = rational(BigInt(input.sourceServings.numerator), BigInt(input.sourceServings.denominator));
      if (row && row.recipeSha256 === input.recipeSha256 && row.guideDomains.some(d => compare(n, rational(BigInt(d.sourceServings.numerator), BigInt(d.sourceServings.denominator))) === 0)) return { outcome: "allowed" as const };
    } catch { /* Invalid rationals do not confer a guide domain. */ }
    return { outcome: "held" as const, reasons: [row?.recipeSha256 === input.recipeSha256 ? "source_serving_guide_required" : "source_or_recipe_basis_changed"] };
  } });
}
