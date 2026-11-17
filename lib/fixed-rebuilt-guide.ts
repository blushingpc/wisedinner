import { FIXED_REBUILT_PIN, fixedRebuiltConfigurationMatches } from "./fixed-rebuilt-admission.ts";
import { mealCoverageHash, originalGuide, readFixedRebuiltDonorGuide } from "./generated-current-meal-coverage.ts";
import type { CurrentGuidePolicy } from "./generated-joined-plan.ts";
import { createRevisedCatalogReaderAsync, type CatalogYieldControl } from "./generated-plan-catalog.ts";

export async function createFixedRebuiltGuidePolicy(source: unknown, configuration: unknown, yieldControl: CatalogYieldControl) {
  if (!fixedRebuiltConfigurationMatches(configuration)) throw Error("fixed_guide_configuration_mismatch");
  const catalog = await createRevisedCatalogReaderAsync(FIXED_REBUILT_PIN, yieldControl)(source);
  if (catalog.outcome !== "success") throw Error("fixed_guide_coverage_held:" + catalog.code);
  const guideRows = [];
  for (let offset = 0; offset < catalog.recipes.length; offset += 8) {
    const batch = catalog.recipes.slice(offset, offset + 8);
    for (const row of batch) {
      const guide = originalGuide(row, catalog.sourceSha256);
      guideRows.push({
        recipeId: row.id,
        recipeSha256: row.recipeSha256,
        domain: guide ? { sourceServings: guide.sourceServings, guideSha256: guide.guideSha256 } : null,
      });
    }
    await yieldControl();
  }
  const rows = new Map(guideRows.map(row => [row.recipeId, row]));
  const descriptor = Object.freeze({
    version: "wd-current-guide-policy-v1",
    sourceSha256: catalog.sourceSha256,
    configurationSha256: mealCoverageHash(configuration),
    domainsSha256: mealCoverageHash(guideRows.map(row => [
      row.recipeId, row.recipeSha256, row.domain ? [[row.domain.sourceServings, row.domain.guideSha256]] : [],
    ])),
    rule: "source-derived-original-full-batch-only",
  });
  const check: CurrentGuidePolicy["check"] = input => {
    const row = rows.get(input.recipeId);
    if (row?.recipeSha256 !== input.recipeSha256) return { outcome: "held", reasons: ["source_or_recipe_basis_changed"] };
    try {
      const numerator = BigInt(input.sourceServings.numerator);
      const denominator = BigInt(input.sourceServings.denominator);
      if (row.domain && numerator > BigInt(0) && denominator > BigInt(0) &&
        numerator * BigInt(row.domain.sourceServings.denominator) === BigInt(row.domain.sourceServings.numerator) * denominator) {
        return { outcome: "allowed" };
      }
    } catch { /* Invalid or unreviewed serving amounts are held below. */ }
    return { outcome: "held", reasons: ["source_serving_guide_required"] };
  };
  return Object.freeze({ descriptor, sha256: mealCoverageHash(descriptor), check });
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
