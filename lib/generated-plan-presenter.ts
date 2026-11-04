import type {ReferenceEvaluationSuccessV3} from "./generated-joined-plan.ts";
import {isPurchasedQuoteRow} from "./generated-regional-quote.ts";
import type { ReferenceEvaluationSuccess, ReferenceReplacementOutcome, ReferenceEvaluationSuccessV2, ReferenceReplacementOutcomeV2, ReferenceAlternativesOutcomeV2, NonShoppingUsageV2 } from "./generated-joined-plan.ts";
import type { ConsumedAssignment } from "./generated-person-plan.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import type { createReferencePlanRepository } from "./generated-plan-state.ts";
import { ownCopy } from "./owner-plan-codec.ts";
import { shoppingRowIdentity, reconcileShoppingChecks } from "./generated-plan-shopping.ts";
import { UUID } from "./generated-runtime-identity.ts";
import { describeReplacementChanges, describeReplacementChangesV2, type ReplacementChanges } from "./generated-plan-change.ts";
import type { ReferenceAlternativesOutcome } from "./generated-plan-alternatives.ts";
import type { ReviewedImageIndex, ImageLookupOutcome } from "./generated-plan-images.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import type { ReferencePriceDisclosure, ReferencePriceDisclosureV2 } from "./generated-regional-quote.ts";

// Internal DTO projections of actual canonical results only. Never accept a
// client JSON success/receipt as evidence. No accepted API/native UI binding.
import { NOMINAL_DENSITY_FLAG, NOMINAL_DENSITY_WARNING } from "./generated-nominal-density.ts";
import { NOMINAL_PREPARATION_YIELD_FLAG, NOMINAL_PREPARATION_YIELD_WARNING } from "./generated-nominal-preparation-yield.ts";
import { NOMINAL_EGG_FLAG, NOMINAL_EGG_WARNING } from "./generated-nominal-egg.ts";

type ErrorView = { readonly outcome: "error"; readonly code: string };
type HeldView = { readonly outcome: "held"; readonly code: string };
type Label = { skuId: string; displayName: string; aisle: string };
type PackBuyRow = {
  readonly kind?:"pack";
  readonly itemKey: string; readonly skuId: string; readonly displayName: string; readonly unit: string;
  readonly packCount: number; readonly packQuantity: ExactAmount | null; readonly purchasedQuantity: ExactAmount; readonly toBuy: ExactAmount;
  readonly fingerprint: string; readonly hasSourceLimitations: boolean; readonly accessibilityText: string;
  readonly checked?: boolean;
};
type BuyRow=PackBuyRow | (Omit<PackBuyRow,"kind"|"packCount"|"packQuantity"> & {readonly kind:"weight";readonly packCount?:never;readonly packQuantity?:never;readonly quantityBasis:string;readonly valuation:"dated-documentary";readonly capturedOn:string});
type HomeRow = { readonly itemKey: string; readonly skuId: string; readonly displayName: string; readonly unit: string; readonly used: ExactAmount; readonly remainingOwned: ExactAmount; readonly fingerprint: string };
export type GroceryView = {
  readonly outcome: "groceries"; readonly mode: "private-reference-only"; readonly groups: readonly { readonly aisle: string; readonly items: readonly PackBuyRow[] }[];
  readonly alreadyAtHome: readonly HomeRow[]; readonly estimatedTotalCents: { readonly min: number; readonly max: number }; readonly budgetRemainingCents: { readonly min: number; readonly max: number };
  readonly uniqueBuyItemCount: number; readonly storeIds: readonly string[]; readonly asOfDate: string; readonly currency: "USD";
  readonly liveRetailerPricing: false; readonly checkoutChargesIncluded: false; readonly productionReady: false; readonly warnings: readonly string[];
  readonly referenceEstimates?: { readonly policy: "wd-price-reference-fallback-v1"; readonly sources: readonly Omit<ReferencePriceDisclosure, "sourceUrl" | "sourceSha256" | "factId">[] };
};
export type RecipeView = {
  readonly outcome: "recipe"; readonly mode: "private-reference-only"; readonly recipeId: string; readonly recipeSha256: string; readonly assignmentId: string; readonly personId: string;
  readonly title: string; readonly originalBatchRecipe: ConsumedAssignment["recipe"]; readonly originalBatchServings: number;
  readonly personPortion: { readonly sourceServings: ExactAmount; readonly consumedIngredients: ConsumedAssignment["consumedIngredients"]; readonly foodQuantityBasis: "source-ingredient-input-allocation"; readonly conditionalNutrition: ConsumedAssignment["nutrition"] };
  readonly image: { readonly status: "held"; readonly code: "reviewed-image-binding-needed" | "image-source-mismatch" } | { readonly status: "held"; readonly code: "image-publication-needed"; readonly approvedLocalBinding: Extract<ImageLookupOutcome, { outcome: "binding" }> }; readonly practicalServing: { readonly status: "held"; readonly code: "meal-measure-needed" };
  readonly elapsedMinutes: null; readonly timingNote: string | null; readonly preparationScalingReviewed: false; readonly productionReady: false;
  readonly sourceLimitations: { readonly recipe: readonly string[]; readonly holds: readonly string[]; readonly nutrition: readonly string[] }; readonly warnings: readonly string[];
};

type CustomerRetailerDisclosureV2 = { readonly kind: "retailer-reference"; readonly sourceBasis: { readonly geography: "retailer-reference-not-regional"; readonly capturedOn: string; readonly observedOn: string | null; readonly publishedOn: string | null }; readonly reviewEffectiveFrom: string; readonly usableThrough: string };
export type GroceryViewV2 = Omit<GroceryView, "referenceEstimates"> & { readonly referenceEstimates?: { readonly policy: "wd-price-reference-fallback-v2"; readonly valuationPolicy?: "wd-dated-documentary-reference-v1"; readonly planningDate?: string; readonly sources: readonly (Omit<ReferencePriceDisclosure, "sourceUrl" | "sourceSha256" | "factId"> | CustomerRetailerDisclosureV2)[] } };
export type GroceryViewV3=Omit<GroceryViewV2,"groups">&{readonly groups:readonly {readonly aisle:string;readonly items:readonly BuyRow[]}[]};
export function nonShoppingUsageV2(evaluation: ReferenceEvaluationSuccessV2|ReferenceEvaluationSuccessV3): NonShoppingUsageV2 {
  const partition = evaluation.utilityPartition;
  if (!partition) return null;
  const items = partition.utilityUsage.map(row => {
    const assignment = evaluation.projection.assignments.find(a => a.assignmentId === row.assignmentId);
    if (!assignment || row.baseUnit !== "ml") throw Error("Invalid utility source identity");
    return { assignmentId: row.assignmentId, personId: assignment.personId, recipeId: row.recipeId, ingredientId: row.ingredientId, displayName: "Cooking water" as const, unit: "ml" as const, quantity: row.amount };
  });
  return freeze({ policy: partition.policy, items, warnings: items.length ? ["tap-cooking-water-excluded-from-food-groceries" as const] : [] });
}
function customerDisclosureV2(row: ReferencePriceDisclosureV2) {
  const { kind, sourceBasis, reviewEffectiveFrom, usableThrough } = row;
  return kind === "retailer-reference" && sourceBasis.geography === "retailer-reference-not-regional"
    ? { kind, sourceBasis: { geography: sourceBasis.geography, capturedOn: sourceBasis.capturedOn, observedOn: sourceBasis.observedOn, publishedOn: sourceBasis.publishedOn }, reviewEffectiveFrom, usableThrough }
    : { kind, sourceBasis, reviewEffectiveFrom, usableThrough };
}

type SaveResult = Awaited<ReturnType<ReturnType<typeof createReferencePlanRepository>["applyPlanCommand"]>>;
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function labels(value: unknown): Map<string, Label> {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 20000) throw new Error("Invalid labels");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result = new Map<string, Label>();
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) throw new Error("Invalid labels");
  for (let i = 0; i < value.length; i++) {
    const descriptor = descriptors[String(i)]; if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("Invalid labels");
    const row = ownCopy(descriptor.value) as Label;
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join("|") !== "aisle|displayName|skuId") throw new Error("Invalid labels");
    for (const value of [row.skuId, row.displayName, row.aisle]) if (typeof value !== "string" || !value.trim() || value.length > 500 || /\$\s*\d|\bUSD\s*\d/i.test(value)) throw new Error("Invalid labels");
    if (result.has(row.skuId)) throw new Error("Invalid labels"); result.set(row.skuId, row);
  }
  return result;
}

export function presentRecipe(evaluation: ReferenceEvaluationSuccess, personId: string, assignmentId: string, images?: ReviewedImageIndex): RecipeView | ErrorView {
  const selected = evaluation.projection.assignments.find(value => value.assignmentId === assignmentId && value.personId === personId);
  if (!selected) return { outcome: "error", code: "recipe_subject_missing" };
  let image: RecipeView["image"] = { status: "held", code: "reviewed-image-binding-needed" };
  if (images) {
    if (images.sourceSha256 !== evaluation.sourceSha256) image = { status: "held", code: "image-source-mismatch" };
    else try {
      const binding = copyReferenceData(images.lookup(selected.recipeId, selected.recipeSha256)) as ImageLookupOutcome;
      if (binding.outcome === "binding") image = { status: "held", code: "image-publication-needed", approvedLocalBinding: binding };
      else if (binding.outcome === "error") image = { status: "held", code: "image-source-mismatch" };
    } catch { image = { status: "held", code: "image-source-mismatch" }; }
  }
  return freeze({ outcome: "recipe", mode: "private-reference-only", recipeId: selected.recipeId, recipeSha256: selected.recipeSha256, assignmentId, personId, title: selected.recipe.title, originalBatchRecipe: selected.recipe, originalBatchServings: selected.recipe.servings,
    personPortion: { sourceServings: selected.sourceServings, consumedIngredients: selected.consumedIngredients, foodQuantityBasis: "source-ingredient-input-allocation", conditionalNutrition: selected.nutrition },
    image, practicalServing: { status: "held", code: "meal-measure-needed" }, elapsedMinutes: null, timingNote: typeof selected.recipe.timing_note === "string" ? selected.recipe.timing_note : null, preparationScalingReviewed: false, productionReady: false,
    sourceLimitations: { recipe: selected.sourceFlags, holds: selected.sourceHolds, nutrition: selected.nutrition.flags }, warnings: ["conditional-input-nutrition-not-measured-cooked-food", "original-batch-method-not-a-reviewed-scaled-method", "allergen-and-kitchen-review-not-established"] });
}

export function presentGroceries(evaluation: ReferenceEvaluationSuccess, configuredLabels: unknown, acknowledgedCheckRows?: unknown): GroceryView | ErrorView | HeldView { return groceries(evaluation, configuredLabels, acknowledgedCheckRows, 1) as GroceryView | ErrorView | HeldView; }
export function presentGroceriesV2(evaluation: ReferenceEvaluationSuccessV2, configuredLabels: unknown, acknowledgedCheckRows?: unknown): GroceryViewV2 | ErrorView | HeldView { return groceries(evaluation as unknown as ReferenceEvaluationSuccess, configuredLabels, acknowledgedCheckRows, 2) as GroceryViewV2 | ErrorView | HeldView; }
export function presentGroceriesV3(evaluation:ReferenceEvaluationSuccessV3,configuredLabels:unknown,acknowledgedCheckRows?:unknown):GroceryViewV3|ErrorView|HeldView{return groceries(evaluation,configuredLabels,acknowledgedCheckRows,2) as GroceryViewV3|ErrorView|HeldView;}
export function presentRecipeV3(evaluation:ReferenceEvaluationSuccessV3,personId:string,assignmentId:string,images?:ReviewedImageIndex){return presentRecipeV2(evaluation as unknown as ReferenceEvaluationSuccessV2,personId,assignmentId,images);}
function groceries(evaluation: ReferenceEvaluationSuccess|ReferenceEvaluationSuccessV2|ReferenceEvaluationSuccessV3, configuredLabels: unknown, acknowledgedCheckRows: unknown, version: 1 | 2) {
  let named: Map<string, Label>;
  try { named = labels(configuredLabels); } catch { return { outcome: "error", code: "invalid_grocery_labels" }; }
  const quote = evaluation.quote, groups = new Map<string, BuyRow[]>(), alreadyAtHome: HomeRow[] = [];
  const checks = acknowledgedCheckRows === undefined ? null : reconcileShoppingChecks(quote, acknowledgedCheckRows);
  if (checks && checks.outcome !== "reconciled") return checks;
  const checksByKey = checks ? new Map(checks.rows.map(row => [row.itemKey, row.checked])) : null;
  for (const row of quote.rows) {
    const used = row.ownedUsed.numerator !== "0";
    if (!isPurchasedQuoteRow(row) && !used) continue;
    const label = named.get(row.skuId); if (!label) return { outcome: "held", code: "grocery_label_needed" };
    const { itemKey, fingerprint } = shoppingRowIdentity(quote, row);
    if(row.kind==="weight"&&isPurchasedQuoteRow(row))groups.set(label.aisle,[...(groups.get(label.aisle)??[]),{kind:"weight",itemKey,skuId:row.skuId,displayName:label.displayName,unit:row.unit,purchasedQuantity:row.purchasedQuantity,toBuy:row.toBuy,fingerprint,hasSourceLimitations:true,quantityBasis:row.quantityBasis,valuation:"dated-documentary",capturedOn:row.rate.capturedOn,accessibilityText:`${label.displayName}, variable purchased weight in grams`,...(checksByKey?{checked:checksByKey.get(itemKey)!}:{})}]);
    if (row.kind!=="weight"&&row.packCount) groups.set(label.aisle, [...(groups.get(label.aisle) ?? []), { itemKey, skuId: row.skuId, displayName: label.displayName, unit: row.unit, packCount: row.packCount, packQuantity: row.packQuantity, purchasedQuantity: row.purchasedQuantity, toBuy: row.toBuy, fingerprint, hasSourceLimitations: row.flags.length > 0, accessibilityText: `${label.displayName}, ${row.packCount} estimated packs`, ...(checksByKey ? { checked: checksByKey.get(itemKey)! } : {}) }]);
    if (used) alreadyAtHome.push({ itemKey, skuId: row.skuId, displayName: label.displayName, unit: row.unit, used: row.ownedUsed, remainingOwned: row.ownedRemaining, fingerprint });
  }
  return freeze({ outcome: "groceries", mode: "private-reference-only", groups: [...groups].sort(([a], [b]) => order(a, b)).map(([aisle, items]) => ({ aisle, items })), alreadyAtHome, estimatedTotalCents: quote.estimatedTotalCents, budgetRemainingCents: quote.budgetRemainingCents, uniqueBuyItemCount: quote.uniqueBuyItemCount, storeIds: quote.storeIds, asOfDate: quote.asOfDate, currency: "USD", liveRetailerPricing: false, checkoutChargesIncluded: false, productionReady: false, ...(quote.referenceEstimates ? { referenceEstimates: { policy: quote.referenceEstimates.policy, ...(version === 2 && "valuationPolicy" in quote.referenceEstimates ? { valuationPolicy: quote.referenceEstimates.valuationPolicy, planningDate: quote.asOfDate } : {}), sources: version === 2 ? (quote.referenceEstimates.sources as unknown as readonly ReferencePriceDisclosureV2[]).map(customerDisclosureV2) : quote.referenceEstimates.sources.map(({ kind, sourceBasis, reviewEffectiveFrom, usableThrough }) => ({ kind, sourceBasis, reviewEffectiveFrom, usableThrough })) } } : {}), warnings: [quote.referenceEstimates ? "includes-nonregional-reference-estimates" : "regional-typical-pack-estimate", ...(version === 2 && (quote.referenceEstimates?.sources as unknown as readonly ReferencePriceDisclosureV2[] | undefined)?.some(row => row.kind === "retailer-reference") ? ["includes-retailer-reference-estimates"] : []), "checkout-charges-not-included", "source-adoption-not-established", ...(quote.rows.some(row=>row.kind==="weight")?["uses-dated-variable-weight-reference"]:[]), ...(quote.rows.some(row => row.flags.includes(NOMINAL_DENSITY_FLAG)) ? [NOMINAL_DENSITY_WARNING] : []), ...(quote.rows.some(row => row.flags.includes(NOMINAL_PREPARATION_YIELD_FLAG)) ? [NOMINAL_PREPARATION_YIELD_WARNING] : []), ...(quote.rows.some(row => row.flags.includes(NOMINAL_EGG_FLAG)) ? [NOMINAL_EGG_WARNING] : [])] });
}

export function presentReplacement(preview: Extract<ReferenceReplacementOutcome, { outcome: "preview" }>, configuredLabels: unknown): { readonly outcome: "replacement-preview"; readonly before: GroceryView; readonly after: GroceryView; readonly changes: ReplacementChanges; readonly addedBuyIds: readonly string[]; readonly removedBuyIds: readonly string[]; readonly itemCountDelta: number; readonly previewSha256: string; readonly baseAssignmentsSha256: string; readonly requestSha256: string; readonly confirmationRequired: true; readonly saved: false } | ErrorView | HeldView {
  const changes = describeReplacementChanges(preview); if (changes.outcome !== "changes") return changes;
  const before = presentGroceries(preview.before, configuredLabels); if (before.outcome !== "groceries") return before;
  const after = presentGroceries(preview.after, configuredLabels); if (after.outcome !== "groceries") return after;
  return freeze({ outcome: "replacement-preview", before, after, changes, addedBuyIds: preview.addedBuyIds, removedBuyIds: preview.removedBuyIds, itemCountDelta: preview.itemCountDelta, previewSha256: preview.previewSha256, baseAssignmentsSha256: preview.baseAssignmentsSha256, requestSha256: preview.requestSha256, confirmationRequired: true, saved: false });
}

export function presentAlternatives(alternatives: Extract<ReferenceAlternativesOutcome, { outcome: "alternatives" }>, configuredLabels: unknown, images?: ReviewedImageIndex) {
  try { labels(configuredLabels); } catch { return { outcome: "error", code: "invalid_grocery_labels" } as const; }
  const candidates: { readonly recipeId: string; readonly sourceServings: ExactAmount; readonly recipe: RecipeView; readonly preview: Extract<ReturnType<typeof presentReplacement>, { outcome: "replacement-preview" }> }[] = [];
  for (const row of alternatives.candidates) {
    if (row.preview.target.personId !== alternatives.target.personId || row.preview.target.assignmentId !== alternatives.target.assignmentId) return { outcome: "error", code: "alternative_subject_mismatch" } as const;
    const preview = presentReplacement(row.preview, configuredLabels); if (preview.outcome !== "replacement-preview") return preview;
    const recipe = presentRecipe(row.preview.after, alternatives.target.personId, alternatives.target.assignmentId, images); if (recipe.outcome !== "recipe") return recipe;
    if (recipe.recipeId !== row.recipeId) return { outcome: "error", code: "alternative_source_mismatch" } as const;
    candidates.push({ recipeId: row.recipeId, sourceServings: row.sourceServings, recipe, preview });
  }
  return freeze({ outcome: "replacement-alternatives" as const, mode: "private-reference-only" as const, target: alternatives.target, requestSha256: alternatives.requestSha256, baseAssignmentsSha256: alternatives.baseAssignmentsSha256, candidates, excluded: alternatives.excluded, search: alternatives.search, order: alternatives.order, confirmationRequired: true as const, saved: false as const, productionReady: false as const });
}

export function presentSaveOutcome(result: SaveResult, expectedOperationId: string) {
  const reference = { operationId: expectedOperationId, productionPersistenceVerified: false as const, currentViewPreserved: true as const };
  if (!UUID.test(expectedOperationId) || "operationId" in result && result.operationId !== expectedOperationId) return { ...reference, status: "not-saved", action: "check-operation-status" } as const;
  if (result.outcome === "acknowledged") return { ...reference, status: "saved-reference-state", action: "read-acknowledged-state", revision: result.state.revision, currentWeekId: result.state.current?.weekId ?? null, draftWeekId: result.state.draft?.weekId ?? null } as const;
  if (result.outcome === "unknown" || result.outcome === "held" && result.code === "operation_status_required") return { ...reference, status: "save-status-unknown", action: "check-operation-status" } as const;
  if (result.outcome === "not_applied") return { ...reference, status: "not-saved", action: "resolve-plan-constraints", planResult: result.result } as const;
  return { ...reference, status: "not-saved", action: result.outcome === "error" && result.code === "revision_conflict" ? "refresh-current-state" : "resolve-operation-hold", code: result.code } as const;
}

export function presentRecipeV2(evaluation: ReferenceEvaluationSuccessV2, personId: string, assignmentId: string, images?: ReviewedImageIndex) {
  const view = presentRecipe(evaluation as unknown as ReferenceEvaluationSuccess, personId, assignmentId, images);
  if (view.outcome !== "recipe") return view;
  const usage = nonShoppingUsageV2(evaluation);
  return freeze({ ...view, nonShoppingUsage: usage ? { ...usage, items: usage.items.filter(row => row.assignmentId === assignmentId && row.personId === personId), warnings: usage.items.some(row => row.assignmentId === assignmentId && row.personId === personId) ? usage.warnings : [] } : null });
}
export function presentReplacementV2(preview: Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }>, configuredLabels: unknown) {
  const changes = describeReplacementChangesV2(preview); if (changes.outcome !== "changes") return changes;
  const before = presentGroceriesV2(preview.before, configuredLabels); if (before.outcome !== "groceries") return before;
  const after = presentGroceriesV2(preview.after, configuredLabels); if (after.outcome !== "groceries") return after;
  return freeze({ outcome: "replacement-preview" as const, before, after, changes, addedBuyIds: preview.addedBuyIds, removedBuyIds: preview.removedBuyIds, itemCountDelta: preview.itemCountDelta, previewSha256: preview.previewSha256, baseAssignmentsSha256: preview.baseAssignmentsSha256, requestSha256: preview.requestSha256, sourcePolicyBasisSha256: preview.sourcePolicyBasisSha256, nonShoppingUsageBefore: preview.nonShoppingUsageBefore, nonShoppingUsageAfter: preview.nonShoppingUsageAfter, confirmationRequired: true as const, saved: false as const });
}
export function presentAlternativesV2(alternatives: Extract<ReferenceAlternativesOutcomeV2, { outcome: "alternatives" }>, configuredLabels: unknown, images?: ReviewedImageIndex) {
  try { labels(configuredLabels); } catch { return { outcome: "error", code: "invalid_grocery_labels" } as const; }
  const candidates = [];
  for (const row of alternatives.candidates) {
    if (row.preview.target.personId !== alternatives.target.personId || row.preview.target.assignmentId !== alternatives.target.assignmentId) return { outcome: "error", code: "alternative_subject_mismatch" } as const;
    const preview = presentReplacementV2(row.preview, configuredLabels); if (preview.outcome !== "replacement-preview") return preview;
    const recipe = presentRecipeV2(row.preview.after, alternatives.target.personId, alternatives.target.assignmentId, images); if (recipe.outcome !== "recipe") return recipe;
    if (recipe.recipeId !== row.recipeId) return { outcome: "error", code: "alternative_source_mismatch" } as const;
    candidates.push({ recipeId: row.recipeId, sourceServings: row.sourceServings, recipe, preview });
  }
  return freeze({ outcome: "replacement-alternatives" as const, mode: "private-reference-only" as const, target: alternatives.target, requestSha256: alternatives.requestSha256, baseAssignmentsSha256: alternatives.baseAssignmentsSha256, candidates, excluded: alternatives.excluded, search: alternatives.search, order: alternatives.order, confirmationRequired: true as const, saved: false as const, productionReady: false as const });
}

export function presentAlternativesV3(alternatives:Extract<ReturnType<import("./generated-joined-plan.ts").PlannerV3["findReplacements"]>,{outcome:"alternatives"}>,configuredLabels:unknown,images?:ReviewedImageIndex){return presentAlternativesV2(alternatives as unknown as Parameters<typeof presentAlternativesV2>[0],configuredLabels,images);}
