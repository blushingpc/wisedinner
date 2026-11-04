import {copyReferenceData} from "./generated-plan-data.ts";
import { aggregateRequirements, type RequirementAggregationOutcome } from "../packages/solver/src/generated-plan-requirements.ts";
import { add, compare, multiply, rational, receipt, zero, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount, BaseUnit } from "../packages/solver/src/generated-plan-measures.ts";
import { ratio, type Requirement } from "../scripts/data/store-estimates.ts";
import { textId } from "../scripts/data/store-estimate-model.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { readNominalDensityReference, nominalDensityFactor, type NominalDensityReference } from "./generated-nominal-density.ts";
import { readNominalPreparationYieldReference, nominalPreparationYieldFactor, type NominalPreparationYieldReference } from "./generated-nominal-preparation-yield.ts";
import { readNominalEggReference, nominalEggCountFactor, type NominalEggReference } from "./generated-nominal-egg.ts";

// Quantity correspondence is shared preparation, not a price/model/availability
// approval. Regional averages must not be labelled physical retailer offers.
export type PurchaseCorrespondence = {
  readonly id: string; readonly ingredientId: string; readonly preparedState: string; readonly consumedUnit: BaseUnit;
  readonly skuId: string; readonly purchaseState: string; readonly purchaseUnit: BaseUnit; readonly formDigest: string;
  readonly category: string; readonly perishable: boolean; readonly factor: { readonly min: ExactAmount; readonly max: ExactAmount }; readonly sourceSha256: string;
  readonly nominalDensityReference?: NominalDensityReference;
  readonly nominalPreparationYieldReference?: NominalPreparationYieldReference;
  readonly nominalEggReference?: NominalEggReference;
};
export type ReferencePurchaseRequirement = Requirement & { readonly nominalDensityReference?: NominalDensityReference; readonly nominalPreparationYieldReference?: NominalPreparationYieldReference; readonly nominalEggReference?: NominalEggReference };
export type PurchasePreparationOutcome =
  | Exclude<RequirementAggregationOutcome, { outcome: "success" }>
  | { readonly outcome: "prepared"; readonly requirements: readonly ReferencePurchaseRequirement[]; readonly correspondencePins: readonly { readonly id: string; readonly sourceSha256: string; readonly correspondenceSha256: string }[]; readonly pricingActivation: false }
  | { readonly outcome: "held"; readonly code: "purchase_basis_needed" | "purchase_basis_ambiguous" | "quote_quantity_capacity_exceeded" | "quote_requirement_capacity_exceeded" }
  | { readonly outcome: "error"; readonly code: "invalid_purchase_correspondence" | "incompatible_purchase_correspondence" };
type Data = Record<string, unknown>;
type BoundFact = PurchaseCorrespondence & { exactMax: Rational };
const FIELDS = ["id", "ingredientId", "preparedState", "consumedUnit", "skuId", "purchaseState", "purchaseUnit", "formDigest", "category", "perishable", "factor", "sourceSha256"];
function invalid(): never { throw new Error("Invalid purchase correspondence"); }
function record(value: unknown, expected: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Data = {};
  if (expected.some(key => !Object.hasOwn(descriptors, key))) invalid();
  for (const key of keys) {
    if (typeof key !== "string" || ![...expected, ...optional].includes(key)) invalid();
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) invalid();
    result[key] = descriptor.value;
  }
  return result;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function identifier(value: unknown): string { const result = text(value); textId(result); return result; }
function unit(value: unknown): BaseUnit { if (value !== "g" && value !== "ml" && value !== "each") invalid(); return value; }
function digest(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) invalid(); return value; }
function exact(value: unknown): Rational {
  const values = record(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof values[key] !== "string" || values[key].length > 240 || !/^(0|[1-9]\d*)$/.test(values[key])) invalid();
  return rational(BigInt(values.numerator as string), BigInt(values.denominator as string));
}
function fact(value: unknown, allowNominalDensity: boolean): BoundFact {
  const fields = record(value, FIELDS, allowNominalDensity ? ["nominalDensityReference", "nominalPreparationYieldReference", "nominalEggReference"] : []), factor = record(fields.factor, ["min", "max"]), min = exact(factor.min), max = exact(factor.max);
  if (min.n === BigInt(0) || compare(min, max) > 0 || typeof fields.perishable !== "boolean") invalid();
  const nominalDensityReference = Object.hasOwn(fields, "nominalDensityReference") ? readNominalDensityReference(fields.nominalDensityReference) : null;
  const nominalPreparationYieldReference = Object.hasOwn(fields, "nominalPreparationYieldReference") ? readNominalPreparationYieldReference(fields.nominalPreparationYieldReference) : null;
  const nominalEggReference = Object.hasOwn(fields, "nominalEggReference") ? readNominalEggReference(fields.nominalEggReference) : null;
  if ([nominalDensityReference, nominalPreparationYieldReference, nominalEggReference].filter(Boolean).length > 1) invalid();
  if (nominalDensityReference && (fields.consumedUnit !== "g" || fields.purchaseUnit !== "ml" || nominalDensityReference.sourceSha256 !== fields.sourceSha256 || compare(min, max) !== 0 || compare(max, nominalDensityFactor(nominalDensityReference)) !== 0)) invalid();
  if (nominalPreparationYieldReference && (fields.consumedUnit !== "g" || fields.purchaseUnit !== "g" || nominalPreparationYieldReference.sourceSha256 !== fields.sourceSha256 || compare(min, max) !== 0 || compare(max, nominalPreparationYieldFactor(nominalPreparationYieldReference)) !== 0)) invalid();
  if (nominalEggReference && (fields.consumedUnit !== "g" || fields.purchaseUnit !== "each" || nominalEggReference.sourceSha256 !== fields.sourceSha256 || compare(min, max) !== 0 || compare(max, nominalEggCountFactor(nominalEggReference)) !== 0)) invalid();
  return { id: identifier(fields.id), ingredientId: text(fields.ingredientId), preparedState: text(fields.preparedState), consumedUnit: unit(fields.consumedUnit), skuId: identifier(fields.skuId), purchaseState: text(fields.purchaseState), purchaseUnit: unit(fields.purchaseUnit), formDigest: digest(fields.formDigest), category: identifier(fields.category), perishable: fields.perishable, factor: { min: receipt(min), max: receipt(max) }, sourceSha256: digest(fields.sourceSha256), ...(nominalDensityReference ? { nominalDensityReference } : {}), ...(nominalPreparationYieldReference ? { nominalPreparationYieldReference } : {}), ...(nominalEggReference ? { nominalEggReference } : {}), exactMax: max };
}
const capturedRegistries=new WeakMap<object,BoundFact[]>();
function registry(value: unknown, allowNominalDensity: boolean): BoundFact[] {
  if(allowNominalDensity&&value&&typeof value==="object"){const captured=capturedRegistries.get(value);if(captured)return captured;}
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 20000) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: BoundFact[] = [], ids = new Set<string>();
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) invalid();
  for (let i = 0; i < value.length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    const parsed = fact(descriptor.value, allowNominalDensity);
    if (ids.has(parsed.id)) invalid();
    ids.add(parsed.id); result.push(parsed);
  }
  return result;
}
function quoteRatio(value: Rational): Requirement["purchasedNeed"] | null {
  const maximum = BigInt(Number.MAX_SAFE_INTEGER);
  if (value.n > maximum || value.d > maximum) return null;
  return ratio(Number(value.n), Number(value.d));
}
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

// Detached immutable validation snapshot. This caches arithmetic parsing only,
// never source truth, ownership, admission, expiry or provider facts.
export function captureReferencePurchaseCorrespondences(value:unknown):readonly PurchaseCorrespondence[]{
 const rows=registry(copyReferenceData(value),true),snapshot=deepFreeze(rows.map(({exactMax,...declared})=>{void exactMax;return declared;}));capturedRegistries.set(snapshot,deepFreeze(rows));return snapshot;
}
export function preparePurchaseRequirements(demands: unknown, correspondences: unknown): PurchasePreparationOutcome {
  return prepare(demands, correspondences, 79);
}

// Same exact correspondence arithmetic, separate current-reference capacity.
// Never widens the legacy physical-store adapter or adopts new source facts.
export function prepareReferencePurchaseRequirements(demands: unknown, correspondences: unknown): PurchasePreparationOutcome {
  return prepare(demands, correspondences, 1000, true);
}

function prepare(demands: unknown, correspondences: unknown, maximum: number, allowNominalDensity = false): PurchasePreparationOutcome {
  const consumed = aggregateRequirements(demands);
  if (consumed.outcome !== "success") return consumed;
  let facts: BoundFact[];
  try { facts = registry(correspondences, allowNominalDensity); } catch { return { outcome: "error", code: "invalid_purchase_correspondence" }; }
  const byConsumedKey = new Map<string, BoundFact[]>();
  for (const fact of facts) {
    const key = JSON.stringify([fact.ingredientId, fact.preparedState, fact.consumedUnit]);
    byConsumedKey.set(key, [...(byConsumedKey.get(key) ?? []), fact]);
  }
  const purchases = new Map<string, { fact: BoundFact; quantity: Rational }>(), pins = new Map<string, { id: string; sourceSha256: string; correspondenceSha256: string }>();
  for (const required of consumed.requirements) {
    const quantity = exact(required.quantity);
    if (quantity.n === BigInt(0)) continue;
    const candidates = byConsumedKey.get(required.key) ?? [];
    if (!candidates.length) return { outcome: "held", code: "purchase_basis_needed" };
    if (candidates.length !== 1) return { outcome: "held", code: "purchase_basis_ambiguous" };
    const selected = candidates[0]!, previous = purchases.get(selected.skuId);
    if (previous && (previous.fact.purchaseUnit !== selected.purchaseUnit || previous.fact.formDigest !== selected.formDigest || previous.fact.category !== selected.category || previous.fact.perishable !== selected.perishable || previous.fact.purchaseState !== selected.purchaseState || hash(previous.fact.nominalDensityReference ?? null) !== hash(selected.nominalDensityReference ?? null) || hash(previous.fact.nominalPreparationYieldReference ?? null) !== hash(selected.nominalPreparationYieldReference ?? null) || hash(previous.fact.nominalEggReference ?? null) !== hash(selected.nominalEggReference ?? null))) return { outcome: "error", code: "incompatible_purchase_correspondence" };
    const purchasedNeed = add(previous?.quantity ?? zero(), multiply(quantity, selected.exactMax));
    if (!quoteRatio(purchasedNeed)) return { outcome: "held", code: "quote_quantity_capacity_exceeded" };
    purchases.set(selected.skuId, { fact: selected, quantity: purchasedNeed });
    const { exactMax: _internal, ...declaredFact } = selected;
    void _internal;
    pins.set(selected.id, { id: selected.id, sourceSha256: selected.sourceSha256, correspondenceSha256: hash(declaredFact) });
  }
  if (purchases.size > maximum) return { outcome: "held", code: "quote_requirement_capacity_exceeded" };
  const requirements = [...purchases].sort(([a], [b]) => order(a, b)).map(([, value]) => ({ skuId: value.fact.skuId, category: value.fact.category, unit: value.fact.purchaseUnit, formDigest: value.fact.formDigest, purchasedNeed: quoteRatio(value.quantity)!, perishable: value.fact.perishable, ...(value.fact.nominalDensityReference ? { nominalDensityReference: value.fact.nominalDensityReference } : {}), ...(value.fact.nominalPreparationYieldReference ? { nominalPreparationYieldReference: value.fact.nominalPreparationYieldReference } : {}), ...(value.fact.nominalEggReference ? { nominalEggReference: value.fact.nominalEggReference } : {}) }));
  return deepFreeze({ outcome: "prepared", requirements, correspondencePins: [...pins.values()].sort((a, b) => order(a.id, b.id)), pricingActivation: false });
}
