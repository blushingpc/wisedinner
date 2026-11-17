import { FIXED_REBUILT_PIN, fixedRebuiltConfigurationMatches } from "./fixed-rebuilt-admission.ts";
import { createCurrentMealCoverage, mealCoverageHash, readFixedRebuiltDonorGuide } from "./generated-current-meal-coverage.ts";
import type { CurrentGuidePolicy } from "./generated-joined-plan.ts";

export function createFixedRebuiltGuidePolicy(source: unknown, configuration: unknown) {
  if (!fixedRebuiltConfigurationMatches(configuration)) throw Error("fixed_guide_configuration_mismatch");
  const coverage = createCurrentMealCoverage(source, {
    configuration,
    sourcePin: FIXED_REBUILT_PIN,
    configurationSha256: mealCoverageHash(configuration),
    asOfDate: "2026-11-15",
    region: "South",
    storeIds: ["wd-reference-estimate:no-shop-preference"],
  });
  if (coverage.outcome !== "ready") throw Error("fixed_guide_coverage_held:" + coverage.code);
  const rows = new Map(coverage.rows.map(row => [row.recipeId, row]));
  const descriptor = Object.freeze({
    version: "wd-current-guide-policy-v1",
    sourceSha256: coverage.sourceSha256,
    configurationSha256: coverage.configurationSha256,
    domainsSha256: mealCoverageHash(coverage.rows.map(row => [
      row.recipeId, row.recipeSha256, row.guideDomains.map(domain => [domain.sourceServings, domain.guideSha256]),
    ])),
    rule: "source-derived-original-full-batch-only",
  });
  const check: CurrentGuidePolicy["check"] = input => {
    const row = rows.get(input.recipeId);
    if (row?.recipeSha256 !== input.recipeSha256) return { outcome: "held", reasons: ["source_or_recipe_basis_changed"] };
    try {
      const numerator = BigInt(input.sourceServings.numerator);
      const denominator = BigInt(input.sourceServings.denominator);
      if (numerator > BigInt(0) && denominator > BigInt(0) && row.guideDomains.some(domain =>
        domain.kind === "source-derived-original-full-batch" &&
        numerator * BigInt(domain.sourceServings.denominator) === BigInt(domain.sourceServings.numerator) * denominator)) {
        return { outcome: "allowed" };
      }
    } catch { /* Invalid or unreviewed serving amounts are held below. */ }
    return { outcome: "held", reasons: ["source_serving_guide_required"] };
  };
  return Object.freeze({ descriptor, sha256: mealCoverageHash(descriptor), summary: coverage.summary, check });
}

export function createFixedRebuiltDonorGuidePolicy(source: unknown, parent: CurrentGuidePolicy) {
  const donor = readFixedRebuiltDonorGuide(source);
  if (!donor) throw Error("fixed_donor_guide_integrity_held");
  const check: CurrentGuidePolicy["check"] = input => {
    if (input.recipeId !== donor.recipeId) return parent.check(input);
    if (input.recipeSha256 !== donor.recipeSha256) {
      return { outcome: "held", reasons: ["source_or_recipe_basis_changed"] };
    }
    const { numerator, denominator } = input.sourceServings;
    if (!/^[1-9][0-9]*$/.test(numerator) || !/^[1-9][0-9]*$/.test(denominator) || numerator !== denominator) {
      return { outcome: "held", reasons: ["source_serving_guide_required"] };
    }
    return { outcome: "allowed" };
  };
  return Object.freeze({ check, donor });
}
