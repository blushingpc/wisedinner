import { add, rational, receipt, zero, type Rational } from "./generated-meal-ranges.ts";
import type { BaseUnit, ExactAmount } from "./generated-plan-measures.ts";

// Consumed demand only. Do not cast this to quoteBaskets' purchasedNeed:
// reviewed SKU/form/yield correspondence and pantry deduction are later steps.
export type ConsumedDemand = {
  readonly assignmentId: string; readonly recipeId: string; readonly recipeSha256: string;
  readonly ingredientId: string; readonly preparedState: string; readonly baseUnit: BaseUnit; readonly amount: ExactAmount;
};
export type AggregatedConsumedRequirement = {
  readonly key: string; readonly ingredientId: string; readonly preparedState: string; readonly baseUnit: BaseUnit; readonly quantity: ExactAmount;
  readonly trace: readonly { readonly assignmentId: string; readonly recipeId: string; readonly recipeSha256: string; readonly amount: ExactAmount }[];
};
type ErrorCode = "invalid_requirement_input" | "duplicate_assignment_demand" | "assignment_source_conflict" | "recipe_source_conflict";
export type RequirementAggregationOutcome =
  | { readonly outcome: "success"; readonly basis: "consumed-base-quantities-only"; readonly purchasedBasisSupported: false; readonly requirements: readonly AggregatedConsumedRequirement[] }
  | { readonly outcome: "error"; readonly code: ErrorCode }
  | { readonly outcome: "held"; readonly code: "quantity_capacity_exceeded" };
type Data = Record<string, unknown>;
type ParsedDemand = ConsumedDemand & { exactAmount: Rational; key: string };
const KEYS = ["assignmentId", "recipeId", "recipeSha256", "ingredientId", "preparedState", "baseUnit", "amount"];
function invalid(): never { throw new Error("Invalid consumed demand"); }
function record(value: unknown, expected: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Data = {};
  if (keys.length !== expected.length || expected.some(key => !Object.hasOwn(descriptors, key))) invalid();
  for (const key of keys) {
    if (typeof key !== "string" || !expected.includes(key)) invalid();
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) invalid();
    result[key] = descriptor.value;
  }
  return result;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function amount(value: unknown): Rational {
  const values = record(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof values[key] !== "string" || values[key].length > 120 || !/^(0|[1-9]\d*)$/.test(values[key])) invalid();
  return rational(BigInt(values.numerator as string), BigInt(values.denominator as string));
}
function parse(value: unknown): ParsedDemand {
  const fields = record(value, KEYS), ingredientId = text(fields.ingredientId), preparedState = text(fields.preparedState);
  if (fields.baseUnit !== "g" && fields.baseUnit !== "ml" && fields.baseUnit !== "each") invalid();
  if (typeof fields.recipeSha256 !== "string" || !/^[a-f0-9]{64}$/.test(fields.recipeSha256)) invalid();
  const exactAmount = amount(fields.amount);
  return { assignmentId: text(fields.assignmentId), recipeId: text(fields.recipeId), recipeSha256: fields.recipeSha256, ingredientId, preparedState, baseUnit: fields.baseUnit, amount: receipt(exactAmount), exactAmount, key: JSON.stringify([ingredientId, preparedState, fields.baseUnit]) };
}
function list(value: unknown): ParsedDemand[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 5000) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: ParsedDemand[] = [];
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) invalid();
  for (let i = 0; i < value.length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    result.push(parse(descriptor.value));
  }
  return result;
}
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

export function aggregateRequirements(value: unknown): RequirementAggregationOutcome {
  let demands: ParsedDemand[];
  try { demands = list(value); } catch { return { outcome: "error", code: "invalid_requirement_input" }; }
  demands.sort((a, b) => order(a.key, b.key) || order(a.assignmentId, b.assignmentId));
  const assignmentSources = new Map<string, string>(), recipeSources = new Map<string, string>(), seen = new Set<string>();
  const groups = new Map<string, { ingredientId: string; preparedState: string; baseUnit: BaseUnit; quantity: Rational; trace: { assignmentId: string; recipeId: string; recipeSha256: string; amount: ExactAmount }[] }>();
  for (const demand of demands) {
    const binding = JSON.stringify([demand.recipeId, demand.recipeSha256]), previousAssignment = assignmentSources.get(demand.assignmentId);
    if (previousAssignment !== undefined && previousAssignment !== binding) return { outcome: "error", code: "assignment_source_conflict" };
    assignmentSources.set(demand.assignmentId, binding);
    const previousRecipe = recipeSources.get(demand.recipeId);
    if (previousRecipe !== undefined && previousRecipe !== demand.recipeSha256) return { outcome: "error", code: "recipe_source_conflict" };
    recipeSources.set(demand.recipeId, demand.recipeSha256);
    const consumptionKey = JSON.stringify([demand.assignmentId, demand.key]);
    if (seen.has(consumptionKey)) return { outcome: "error", code: "duplicate_assignment_demand" };
    seen.add(consumptionKey);
    const group = groups.get(demand.key) ?? { ingredientId: demand.ingredientId, preparedState: demand.preparedState, baseUnit: demand.baseUnit, quantity: zero(), trace: [] };
    group.quantity = add(group.quantity, demand.exactAmount);
    // Resource bound, not a serving/budget policy. Never round a large exact sum.
    if (group.quantity.n.toString().length > 240 || group.quantity.d.toString().length > 240) return { outcome: "held", code: "quantity_capacity_exceeded" };
    group.trace.push({ assignmentId: demand.assignmentId, recipeId: demand.recipeId, recipeSha256: demand.recipeSha256, amount: demand.amount });
    groups.set(demand.key, group);
  }
  const requirements = [...groups].sort(([a], [b]) => order(a, b)).map(([key, group]) => ({ key, ingredientId: group.ingredientId, preparedState: group.preparedState, baseUnit: group.baseUnit, quantity: receipt(group.quantity), trace: group.trace }));
  return deepFreeze({ outcome: "success", basis: "consumed-base-quantities-only", purchasedBasisSupported: false, requirements });
}
