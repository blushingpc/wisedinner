import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import { CURRENT_INTEGRATION_REBUILT_IDENTITY } from "./current-integration-rebuilt-identity.server.ts";
import { FIXED_REBUILT_PIN } from "./fixed-rebuilt-admission.ts";
import { createFixedRebuiltDonorGuidePolicy } from "./fixed-rebuilt-guide.ts";
import { createFixedRebuiltDonorEvaluator, type CurrentGuidePolicy } from "./generated-joined-plan.ts";
import type { PairedReplacementPolicy } from "./generated-paired-replacement.ts";
import { createRevisedCatalogReader } from "./generated-plan-catalog.ts";

const parentHamId = "WD-R6-M-48c87619327f37b3";
const parentHamSha256 = "4cfb8e9b784fa871c07f79aafb225c788634c48afadf81629e5de12b7624a284";
const adjustmentId = "ham-120-to-113g-v1";
const relationSha256 = "9b3506c36c1cb2a4733c7a5a614c65aa0c4aaf4dce7e470c41c14c7b4e1c6412";
const oneServing = Object.freeze({ numerator: "1", denominator: "1" });
const isOneServing = ({ numerator, denominator }: ExactAmount) =>
  /^[1-9][0-9]*$/.test(numerator) && numerator === denominator;

export function createFixedRebuiltPairedPolicy(
  parentSource: string, successorSource: string, parentConfiguration: unknown, parentGuide: CurrentGuidePolicy,
) {
  const parent = createRevisedCatalogReader(FIXED_REBUILT_PIN)(parentSource);
  if (parent.outcome !== "success") throw Error("paired_parent_source_held");
  const guide = createFixedRebuiltDonorGuidePolicy(successorSource, parentGuide);
  const evaluator = createFixedRebuiltDonorEvaluator(successorSource, parentConfiguration, guide);
  if (evaluator.outcome !== "ready") throw Error("paired_adjustment_source_held");
  const original = new Map(parent.recipes.map(recipe => [recipe.id, recipe]));
  const policy: PairedReplacementPolicy = {
    sourceSha256: evaluator.source.sha256,
    basisSha256: evaluator.sourcePolicyBasis.basisSha256,
    reservedReplacements: evaluator.reservedReplacements,
    transition: Object.freeze({
      fromSourceSha256: FIXED_REBUILT_PIN.sha256,
      fromBasisSha256: CURRENT_INTEGRATION_REBUILT_IDENTITY.sourcePolicyBasisSha256,
      evaluateJoined: evaluator.evaluateJoined,
    }),
    resolveTarget(choice) {
      const recipe = original.get(choice.replacementRecipeId);
      if (!recipe || recipe.recipe.servings !== 1 || !isOneServing(choice.sourceServings)) return null;
      return { recipeId: recipe.id, recipeSha256: recipe.recipeSha256, sourceServings: choice.sourceServings };
    },
    resolveDonor(previous, choice) {
      if (choice.adjustmentId !== adjustmentId || previous.recipeId !== parentHamId ||
          previous.recipeSha256 !== parentHamSha256 || !isOneServing(previous.sourceServings)) return null;
      return { recipeId: guide.donor.recipeId, recipeSha256: guide.donor.recipeSha256, sourceServings: oneServing, relationSha256 };
    },
  };
  return Object.freeze({ policy: Object.freeze(policy), evaluator, guide });
}
