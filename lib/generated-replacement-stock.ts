import { add, compare, decimal, multiply, rational, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import type { RevisedRecipeProjection } from "./generated-plan-catalog.ts";
import type { RegionalQuoteSuccessV3 } from "./generated-regional-quote.ts";

type Row = Record<string, unknown>;
const object = (value: unknown): value is Row => !!value && typeof value === "object" && !Array.isArray(value);
const formKey = (id: unknown, state: unknown, unit: unknown) => JSON.stringify([id, state, unit]);
function exact(value: unknown): Rational {
  if (!object(value) || typeof value.numerator !== "string" || typeof value.denominator !== "string") throw Error("amount_required");
  return rational(BigInt(value.numerator), BigInt(value.denominator));
}
function sourceAmount(value: string): Rational {
  const [whole, denominator] = value.split("/");
  return denominator ? rational(BigInt(whole!), BigInt(denominator)) : decimal(value);
}

// Reject only when the candidate alone needs more than the entire household
// has. The exact preview still checks cumulative use, checkout, and nutrition.
export function createReplacementStockFilter(correspondences: unknown, utility: unknown, quote: Pick<RegionalQuoteSuccessV3, "rows" | "ownedRemaining">) {
  const forms = new Map<string, Row | null>();
  if (Array.isArray(correspondences)) for (const row of correspondences) {
    if (!object(row)) continue;
    const key = formKey(row.ingredientId, row.preparedState, row.consumedUnit);
    forms.set(key, forms.has(key) ? null : row);
  }
  const utilities = new Set<string>();
  if (object(utility) && Array.isArray(utility.reviewedForms)) for (const row of utility.reviewedForms) {
    if (object(row) && object(row.exactForm)) {
      const f = row.exactForm;
      utilities.add(JSON.stringify([f.id, f.name, f.state, f.unit]));
    }
  }
  const stock = new Map(quote.rows.map(row => [row.skuId, {
    unit: row.unit, formDigest: row.formDigest,
    amount: add(add(exact(row.purchasedQuantity), exact(row.ownedUsed)), exact(row.ownedRemaining)),
  }]));
  // The quote retains pantry stock even when the current schedule uses none.
  for (const row of quote.ownedRemaining) if (!stock.has(row.skuId)) {
    stock.set(row.skuId, { unit: row.unit, formDigest: row.formDigest, amount: exact(row.quantity) });
  }
  return (recipe: RevisedRecipeProjection["recipe"], servings: ExactAmount): boolean => {
    try {
      const scale = rational(BigInt(servings.numerator), BigInt(servings.denominator) * BigInt(recipe.servings));
      const minimum = new Map<string, { unit: string; formDigest: string; amount: Rational }>();
      for (const item of recipe.ingredients) {
        if (utilities.has(JSON.stringify([item.id, item.name, item.state, item.unit]))) continue;
        const form = forms.get(formKey(item.id, item.state, item.unit));
        if (!form || typeof form.skuId !== "string" || typeof form.purchaseUnit !== "string" ||
            typeof form.formDigest !== "string" || !object(form.factor)) return true;
        const amount = multiply(multiply(sourceAmount(item.quantity), scale), exact(form.factor.min));
        const previous = minimum.get(form.skuId);
        if (previous && (previous.unit !== form.purchaseUnit || previous.formDigest !== form.formDigest)) return true;
        minimum.set(form.skuId, { unit: form.purchaseUnit, formDigest: form.formDigest,
          amount: previous ? add(previous.amount, amount) : amount });
      }
      for (const [skuId, need] of minimum) {
        const available = stock.get(skuId);
        if (!available) { if (need.amount.n > BigInt(0)) return false; continue; }
        if (available.unit !== need.unit || available.formDigest !== need.formDigest) return true;
        if (compare(need.amount, available.amount) > 0) return false;
      }
      return true;
    } catch { return true; }
  };
}
