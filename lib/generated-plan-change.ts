import type { ReferenceReplacementOutcome, ReferenceReplacementOutcomeV2 } from "./generated-joined-plan.ts";
import type { ConsumedAssignment } from "./generated-person-plan.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import { add, compare, distance, rational, receipt, zero, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { shoppingRowIdentity } from "./generated-plan-shopping.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { REPLACEMENT_PROTEIN_RULE, REPLACEMENT_RULE_V2 } from "./generated-plan-protein-tolerance.ts";

type Preview = Extract<ReferenceReplacementOutcome, { outcome: "preview" }>;
type Quote = Preview["before"]["quote"];
export type QuantityChange = { readonly before: ExactAmount; readonly after: ExactAmount; readonly direction: "increase" | "decrease" | "unchanged"; readonly magnitude: ExactAmount };
export type ReplacementChanges = {
  readonly outcome: "changes"; readonly target: Preview["target"];
  readonly foodBasis: "source-consumed-input-not-protein-or-reviewed-practical-measure";
  readonly ingredients: readonly { readonly ingredientId: string; readonly name: string; readonly preparedState: string; readonly baseUnit: "g" | "ml"; readonly kind: "added" | "removed" | "increased" | "decreased"; readonly quantity: QuantityChange }[];
  readonly groceries: readonly { readonly itemKey: string; readonly skuId: string; readonly unit: string; readonly kind: "added-row" | "removed-row" | "quantity-changed"; readonly needed: QuantityChange; readonly ownedUsed: QuantityChange; readonly toBuy: QuantityChange; readonly purchasedQuantity: QuantityChange; readonly purchasedLeftover: QuantityChange; readonly packCountDelta: number }[];
};
class ChangeFault extends Error { readonly code: string; readonly held: boolean; constructor(code: string, held = false) { super("Replacement changes refused"); this.code = code; this.held = held; } }
function invalid(): never { throw new ChangeFault("replacement_change_binding_invalid"); }
function within(value: Rational, max: number): Rational { if (String(value.n).length > max || String(value.d).length > max) throw new ChangeFault("replacement_change_capacity_review", true); return value; }
function exact(value: ExactAmount): Rational { if (!value || Object.keys(value).sort().join("|") !== "denominator|numerator") invalid(); for (const part of [value.numerator, value.denominator]) if (typeof part !== "string" || part.length > 240 || !/^(0|[1-9]\d*)$/.test(part)) invalid(); return rational(BigInt(value.numerator), BigInt(value.denominator)); }
function change(before: Rational, after: Rational): QuantityChange { const cmp = compare(after, before); return { before: receipt(before), after: receipt(after), direction: cmp > 0 ? "increase" : cmp < 0 ? "decrease" : "unchanged", magnitude: receipt(within(distance(before, after), 480)) }; }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function bare(assignment: ConsumedAssignment) { const { assignmentId, personId, profileRevision, date, slot, recipeId, recipeSha256, sourceServings } = assignment; return { assignmentId, personId, profileRevision, date, slot, recipeId, recipeSha256, sourceServings }; }
function foods(assignment: ConsumedAssignment) {
  const result = new Map<string, { food: ConsumedAssignment["consumedIngredients"][number]; quantity: Rational }>();
  for (const food of assignment.consumedIngredients) {
    if (food.baseUnit !== "g" && food.baseUnit !== "ml") invalid();
    const key = JSON.stringify([food.ingredientId, food.name, food.preparedState, food.baseUnit]), quantity = exact(food.amount); if (!quantity.n) invalid();
    const prior = result.get(key); result.set(key, { food, quantity: within(prior ? add(prior.quantity, quantity) : quantity, 240) });
  }
  return result;
}
function groceries(quote: Quote) { const result = new Map<string, Quote["rows"][number]>(); for (const row of quote.rows) { const key = shoppingRowIdentity(quote, row).itemKey; if (result.has(key)) invalid(); result.set(key, row); } return result; }

// Actual canonical internal results only, never an authorization boundary for a
// JSON success flag. Defensive copying refuses executable caller data. These
// deltas are food/purchase quantities, not prices, nutrition or cooking proof.
export function describeReplacementChanges(value: Preview): ReplacementChanges | { readonly outcome: "error" | "held"; readonly code: string } { return changes(value, 1); }
export function describeReplacementChangesV2(value: Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }>): ReplacementChanges | { readonly outcome: "error" | "held"; readonly code: string } { return changes(value as unknown as Preview, 2); }
function changes(value: Preview, version: 1 | 2): ReplacementChanges | { readonly outcome: "error" | "held"; readonly code: string } {
  try {
    const preview = copyReferenceData(value) as Preview, { before, after, target } = preview;
    if (preview.outcome !== "preview" || !target || before.requestSha256 !== preview.requestSha256 || after.requestSha256 !== preview.requestSha256 || before.sourceSha256 !== after.sourceSha256 || before.assignmentsSha256 !== preview.baseAssignmentsSha256) invalid();
    const digest = hash({ sourceSha256: before.sourceSha256, requestSha256: before.requestSha256, base: before.assignmentsSha256, after: after.assignmentsSha256, beforeQuote: before.quote, quote: after.quote, target, replacementProteinRule: version === 2 ? REPLACEMENT_RULE_V2 : REPLACEMENT_PROTEIN_RULE, ...(version === 2 ? { sourcePolicyBasisSha256: (preview as unknown as Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }>).sourcePolicyBasisSha256, nonShoppingUsageBefore: (preview as unknown as Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }>).nonShoppingUsageBefore, nonShoppingUsageAfter: (preview as unknown as Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }>).nonShoppingUsageAfter, beforeUtilityPartition: (before as unknown as Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }>["before"]).utilityPartition, afterUtilityPartition: (after as unknown as Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }>["after"]).utilityPartition, ...(before.allergyBasisSha256 || after.allergyBasisSha256 ? { beforeAllergyBasisSha256: before.allergyBasisSha256 ?? null, afterAllergyBasisSha256: after.allergyBasisSha256 ?? null } : {}) } : {}) });
    if (digest !== preview.previewSha256 || hash(before.projection.assignments.map(bare)) !== before.assignmentsSha256 || hash(after.projection.assignments.map(bare)) !== after.assignmentsSha256) invalid();
    const next = new Map(after.projection.assignments.map(row => [row.assignmentId, row]));
    if (next.size !== after.projection.assignments.length || before.projection.assignments.length !== next.size) invalid();
    const oldTarget = before.projection.assignments.find(row => row.assignmentId === target.assignmentId), newTarget = next.get(target.assignmentId);
    if (!oldTarget || !newTarget || oldTarget.personId !== target.personId || newTarget.personId !== target.personId || oldTarget.profileRevision !== newTarget.profileRevision || oldTarget.date !== newTarget.date || oldTarget.slot !== newTarget.slot) invalid();
    for (const row of before.projection.assignments) if (row.assignmentId !== target.assignmentId && hash(canonicalReferenceData(row)) !== hash(canonicalReferenceData(next.get(row.assignmentId)))) invalid();
    const oldFoods = foods(oldTarget), newFoods = foods(newTarget), ingredients: ReplacementChanges["ingredients"][number][] = [];
    for (const key of [...new Set([...oldFoods.keys(), ...newFoods.keys()])].sort(order)) {
      const old = oldFoods.get(key), next = newFoods.get(key), quantity = change(old?.quantity ?? zero(), next?.quantity ?? zero()); if (quantity.direction === "unchanged") continue;
      const food = (old ?? next)!.food; ingredients.push({ ingredientId: food.ingredientId, name: food.name, preparedState: food.preparedState, baseUnit: food.baseUnit, kind: !old ? "added" : !next ? "removed" : quantity.direction === "increase" ? "increased" : "decreased", quantity });
    }
    const oldRows = groceries(before.quote), newRows = groceries(after.quote), result: ReplacementChanges["groceries"][number][] = [];
    for (const itemKey of [...new Set([...oldRows.keys(), ...newRows.keys()])].sort(order)) {
      const old = oldRows.get(itemKey), next = newRows.get(itemKey), row = (old ?? next)!;
      const amount = (field: "needed" | "ownedUsed" | "toBuy" | "purchasedQuantity" | "purchasedLeftover") => change(old ? exact(old[field]) : zero(), next ? exact(next[field]) : zero());
      const values = { needed: amount("needed"), ownedUsed: amount("ownedUsed"), toBuy: amount("toBuy"), purchasedQuantity: amount("purchasedQuantity"), purchasedLeftover: amount("purchasedLeftover"), packCountDelta: (next?.packCount ?? 0) - (old?.packCount ?? 0) };
      if (!values.packCountDelta && [values.needed, values.ownedUsed, values.toBuy, values.purchasedQuantity, values.purchasedLeftover].every(value => value.direction === "unchanged")) continue;
      result.push({ itemKey, skuId: row.skuId, unit: row.unit, kind: !old ? "added-row" : !next ? "removed-row" : "quantity-changed", ...values });
    }
    return freeze({ outcome: "changes", target, foodBasis: "source-consumed-input-not-protein-or-reviewed-practical-measure", ingredients, groceries: result });
  } catch (error) { return error instanceof ChangeFault ? { outcome: error.held ? "held" : "error", code: error.code } : { outcome: "error", code: "replacement_change_binding_invalid" }; }
}
