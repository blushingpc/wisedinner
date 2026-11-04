import {readRateReferenceConfiguration,quoteRateReference,type RateFact} from "./generated-regional-rate-reference.ts";
import { compare, divide, multiply, rational, receipt, zero, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { BaseUnit, ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { readNominalDensityReference, NOMINAL_DENSITY_FLAG, type NominalDensityReference } from "./generated-nominal-density.ts";
import { readNominalPreparationYieldReference, NOMINAL_PREPARATION_YIELD_FLAG, type NominalPreparationYieldReference } from "./generated-nominal-preparation-yield.ts";
import { readNominalEggReference, NOMINAL_EGG_FLAG, type NominalEggReference } from "./generated-nominal-egg.ts";
import { readRetailerReferenceConfiguration, type RetailerReferencePackFact } from "./generated-retailer-reference.ts";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
// Explicit additive row contract. Existing pack entrypoints never accept rates.
export { quoteRateReference as quoteRegionalRateEstimates, readRateReferenceConfiguration } from "./generated-regional-rate-reference.ts";
export type { RateFact, RateConfiguration, RateDemand, RateQuote } from "./generated-regional-rate-reference.ts";

// Pure internal arithmetic over an explicitly configured registry. Source hashes
// bind supplied evidence; they do not prove its truth, approval or currentness.
// Averages do not establish physical-store prices, inventory, fees or checkout.
export type RegionalPackFact = {
  readonly id: string; readonly skuId: string; readonly unit: BaseUnit; readonly formDigest: string;
  readonly region: "Northeast" | "Midwest" | "South" | "West"; readonly packQuantity: ExactAmount;
  readonly packPriceCents: { readonly min: number; readonly max: number }; readonly currency: "USD";
  readonly observedOn: string | null; readonly usableThrough: string; readonly sourceSha256: string;
  // A monthly series does not supply an exact observation day. Never substitute
  // publication or renewed admission dates into the legacy point-date field.
  readonly monthlyPriceBasis?:
    | { readonly observationPeriod: string; readonly publishedOn: string; readonly reviewEffectiveFrom: string }
    | { readonly observationPeriod: string; readonly publishedOn: null; readonly knownAvailableBy: string; readonly reviewEffectiveFrom: string };
  readonly basis: "modeled-regional-average" | "observed-regional-average" | "synthetic-test-only"; readonly flags: readonly string[];
};
export type RegionalPackQuoteRow = {
  readonly kind?: "pack";
  readonly skuId: string; readonly category: string; readonly unit: BaseUnit; readonly formDigest: string;
  readonly needed: ExactAmount; readonly ownedUsed: ExactAmount; readonly ownedRemaining: ExactAmount; readonly toBuy: ExactAmount;
  readonly packQuantity: ExactAmount | null; readonly packCount: number; readonly purchasedQuantity: ExactAmount; readonly purchasedLeftover: ExactAmount;
  readonly estimatedLineCents: { readonly min: number; readonly max: number }; readonly factId: string | null; readonly flags: readonly string[];
  readonly nominalDensityReference?: NominalDensityReference;
  readonly nominalPreparationYieldReference?: NominalPreparationYieldReference;
  readonly nominalEggReference?: NominalEggReference;
};
export type RegionalWeightQuoteRow = Omit<RegionalPackQuoteRow,"kind"|"packQuantity"|"packCount"> & {readonly kind:"weight";readonly packQuantity?:never;readonly packCount?:never;readonly rate:RateFact;readonly quantityBasis:string};
export type RegionalQuoteRow=RegionalPackQuoteRow;
export type AnyRegionalQuoteRow=RegionalPackQuoteRow|RegionalWeightQuoteRow;
export function isPurchasedQuoteRow(row:AnyRegionalQuoteRow):boolean{return row.kind==="weight"?row.purchasedQuantity.numerator!=="0":row.packCount>0;}
export function purchasedQuoteCovers(before:AnyRegionalQuoteRow,after:AnyRegionalQuoteRow):boolean {
 if(before.skuId!==after.skuId||before.formDigest!==after.formDigest||before.unit!==after.unit||(before.kind==="weight")!==(after.kind==="weight"))return false;
 const a=exact(before.purchasedQuantity),b=exact(after.toBuy);return compare(a,b)>=0;
}
export const REFERENCE_PRICE_FALLBACK_POLICY = "wd-price-reference-fallback-v1";
// Context only, not retailer stock or exact pricing. Empty means explicit no
// preference. This resource bound covers100listed labels plus one reviewed Other.
export const MAX_REFERENCE_STORE_IDS = 101;
export type ReferencePackFact = Omit<RegionalPackFact, "region" | "basis" | "observedOn" | "monthlyPriceBasis"> & {
  readonly kind: "national-reference" | "manufacturer-reference"; readonly sourceUrl: string; readonly reviewEffectiveFrom: string;
  readonly sourceBasis:
    | { readonly geography: "US-national"; readonly observationPeriod: string; readonly observedOn: null; readonly publishedOn: string; readonly knownAvailableBy?: never }
    | { readonly geography: "US-national"; readonly observationPeriod: string; readonly observedOn: null; readonly publishedOn: null; readonly knownAvailableBy: string }
    | { readonly geography: "manufacturer-reference-not-regional"; readonly manufacturer: string; readonly capturedOn: string; readonly observedOn: null; readonly publishedOn: null };
};
type PriceFact = RegionalPackFact | ReferencePackFact;
type PriceBasis = RegionalPackFact["basis"] | ReferencePackFact["kind"];
export type ReferencePriceDisclosure = { readonly factId: string; readonly kind: ReferencePackFact["kind"]; readonly sourceBasis: ReferencePackFact["sourceBasis"]; readonly sourceUrl: string; readonly sourceSha256: string; readonly reviewEffectiveFrom: string; readonly usableThrough: string };
export type RegionalQuoteOutcome =
  | { readonly outcome: "quoted"; readonly scope: "regional-average-typical-whole-pack-ingredient-estimate" | "mixed-geography-reference-typical-whole-pack-ingredient-estimate"; readonly region: RegionalPackFact["region"]; readonly storeIds: readonly string[]; readonly asOfDate: string; readonly currency: "USD"; readonly rows: readonly RegionalQuoteRow[]; readonly ownedRemaining: readonly { readonly skuId: string; readonly unit: BaseUnit; readonly formDigest: string; readonly quantity: ExactAmount }[]; readonly estimatedTotalCents: { readonly min: number; readonly max: number }; readonly budgetRemainingCents: { readonly min: number; readonly max: number }; readonly withinBudgetAtUpperEstimate: boolean; readonly uniqueBuyItemCount: number; readonly factPins: readonly { readonly id: string; readonly sourceSha256: string; readonly factSha256: string; readonly basis: PriceBasis }[]; readonly referenceEstimates?: { readonly policy: typeof REFERENCE_PRICE_FALLBACK_POLICY; readonly sources: readonly ReferencePriceDisclosure[] }; readonly liveRetailerPricing: false; readonly checkoutChargesIncluded: false; readonly adoptionGranted: false }
  | { readonly outcome: "held"; readonly code: "regional_pack_fact_needed" | "regional_pack_fact_ambiguous" | "regional_pack_fact_not_current" | "reference_pack_fact_ambiguous" | "reference_pack_fact_not_current" | "regional_quote_capacity_exceeded" | "quantity_reference_not_current" }
  | { readonly outcome: "error"; readonly code: "invalid_regional_quote_input" | "incompatible_regional_pantry" };

// Additive trusted-host opt-in. V1 types, policy, parser and public signature
// remain closed to retailer facts; neither entry point grants source adoption.
export const REFERENCE_PRICE_FALLBACK_POLICY_V2 = "wd-price-reference-fallback-v2";
export const DOCUMENTARY_VALUATION_POLICY = "wd-dated-documentary-reference-v1";
export type ReferencePriceConfigurationV2 = Readonly<{ policy: typeof REFERENCE_PRICE_FALLBACK_POLICY_V2; facts: readonly (ReferencePackFact | RetailerReferencePackFact)[]; valuationPolicy?: typeof DOCUMENTARY_VALUATION_POLICY }>;
type PriceFactV2 = PriceFact | RetailerReferencePackFact;
type PriceBasisV2 = PriceBasis | RetailerReferencePackFact["kind"];
export type ReferencePriceDisclosureV2 = Omit<ReferencePriceDisclosure, "kind" | "sourceBasis"> & { readonly kind: ReferencePackFact["kind"] | RetailerReferencePackFact["kind"]; readonly sourceBasis: ReferencePackFact["sourceBasis"] | RetailerReferencePackFact["sourceBasis"] };
type QuoteBase = Omit<Extract<RegionalQuoteOutcome, { outcome: "quoted" }>, "factPins" | "referenceEstimates">;
type InternalQuoteSuccess = QuoteBase & {
  readonly factPins: readonly { readonly id: string; readonly sourceSha256: string; readonly factSha256: string; readonly basis: PriceBasisV2 }[];
  readonly referenceEstimates?: { readonly policy: typeof REFERENCE_PRICE_FALLBACK_POLICY | typeof REFERENCE_PRICE_FALLBACK_POLICY_V2; readonly sources: readonly ReferencePriceDisclosureV2[]; readonly valuationPolicy?: typeof DOCUMENTARY_VALUATION_POLICY; readonly planningDate?: string };
};
type InternalQuoteOutcome = Exclude<RegionalQuoteOutcome, { outcome: "quoted" }> | InternalQuoteSuccess;
export type RegionalQuoteOutcomeV2 = Exclude<RegionalQuoteOutcome, { outcome: "quoted" }> | (Omit<InternalQuoteSuccess, "referenceEstimates"> & { readonly referenceEstimates?: { readonly policy: typeof REFERENCE_PRICE_FALLBACK_POLICY_V2; readonly sources: readonly ReferencePriceDisclosureV2[]; readonly valuationPolicy?: typeof DOCUMENTARY_VALUATION_POLICY; readonly planningDate?: string } });
export type RegionalQuoteSuccessV3=Omit<Extract<RegionalQuoteOutcomeV2,{outcome:"quoted"}>,"rows"|"factPins"> & {readonly purchasePolicy:"wd-mixed-purchases-v3";readonly rows:readonly AnyRegionalQuoteRow[];readonly factPins:readonly {readonly id:string;readonly sourceSha256:string;readonly factSha256:string;readonly basis:PriceBasisV2|"dated-variable-weight-reference"}[]};
export type RegionalQuoteOutcomeV3=Exclude<RegionalQuoteOutcomeV2,{outcome:"quoted"}>|RegionalQuoteSuccessV3;
type Data = Record<string, unknown>;
type Requirement = { skuId: string; category: string; unit: BaseUnit; formDigest: string; perishable: boolean; quantity: Rational; nominalDensityReference?: NominalDensityReference; nominalPreparationYieldReference?: NominalPreparationYieldReference; nominalEggReference?: NominalEggReference };
type Stock = { skuId: string; unit: BaseUnit; formDigest: string; quantity: Rational };
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
class Capacity extends Error {}
function invalid(): never { throw new Error("Invalid regional quote input"); }
function record(value: unknown, fields: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Data = {};
  if (fields.some(key => !Object.hasOwn(descriptors, key))) invalid();
  for (const key of keys) {
    if (typeof key !== "string" || ![...fields, ...optional].includes(key)) invalid();
    const descriptor = descriptors[key]!; if (!("value" in descriptor) || !descriptor.enumerable) invalid(); result[key] = descriptor.value;
  }
  return result;
}
function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: unknown[] = [];
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) invalid();
  for (let i = 0; i < value.length; i++) { const descriptor = descriptors[String(i)]; if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid(); result.push(descriptor.value); }
  return result;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function digest(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) invalid(); return result; }
function unit(value: unknown): BaseUnit { if (value !== "g" && value !== "ml" && value !== "each") invalid(); return value; }
function integer(value: unknown, positive = false): number { if (!Number.isSafeInteger(value) || (value as number) < (positive ? 1 : 0)) invalid(); return value as number; }
function date(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(`${result}T00:00:00.000Z`)) || new Date(`${result}T00:00:00.000Z`).toISOString().slice(0, 10) !== result) invalid();
  return result;
}
function region(value: unknown): RegionalPackFact["region"] { if (typeof value !== "string" || !["Northeast", "Midwest", "South", "West"].includes(value)) invalid(); return value as RegionalPackFact["region"]; }
function exact(value: unknown): Rational {
  const fields = record(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof fields[key] !== "string" || fields[key].length > 240 || !/^(0|[1-9]\d*)$/.test(fields[key])) invalid();
  return rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string));
}
function numericRatio(value: unknown): Rational { const fields = record(value, ["numerator", "denominator"]); return rational(BigInt(integer(fields.numerator)), BigInt(integer(fields.denominator, true))); }
function requirement(value: unknown): Requirement {
  const fields = record(value, ["skuId", "category", "unit", "formDigest", "perishable", "purchasedNeed"], ["nominalDensityReference", "nominalPreparationYieldReference", "nominalEggReference"]); if (typeof fields.perishable !== "boolean") invalid();
  const nominalDensityReference = Object.hasOwn(fields, "nominalDensityReference") ? readNominalDensityReference(fields.nominalDensityReference) : null;
  const nominalPreparationYieldReference = Object.hasOwn(fields, "nominalPreparationYieldReference") ? readNominalPreparationYieldReference(fields.nominalPreparationYieldReference) : null;
  const nominalEggReference = Object.hasOwn(fields, "nominalEggReference") ? readNominalEggReference(fields.nominalEggReference) : null;
  if ([nominalDensityReference, nominalPreparationYieldReference, nominalEggReference].filter(Boolean).length > 1) invalid();
  if (nominalDensityReference && fields.unit !== "ml") invalid();
  if (nominalPreparationYieldReference && fields.unit !== "g") invalid();
  if (nominalEggReference && fields.unit !== "each") invalid();
  return { skuId: text(fields.skuId), category: text(fields.category), unit: unit(fields.unit), formDigest: digest(fields.formDigest), perishable: fields.perishable, quantity: numericRatio(fields.purchasedNeed), ...(nominalDensityReference ? { nominalDensityReference } : {}), ...(nominalPreparationYieldReference ? { nominalPreparationYieldReference } : {}), ...(nominalEggReference ? { nominalEggReference } : {}) };
}
function stock(value: unknown): Stock {
  const fields = record(value, ["skuId", "unit", "formDigest", "quantity"]);
  return { skuId: text(fields.skuId), unit: unit(fields.unit), formDigest: digest(fields.formDigest), quantity: numericRatio(fields.quantity) };
}
function fact(value: unknown): RegionalPackFact {
  const fields = record(value, ["id", "skuId", "unit", "formDigest", "region", "packQuantity", "packPriceCents", "currency", "observedOn", "usableThrough", "sourceSha256", "basis", "flags"], ["monthlyPriceBasis"]);
  const quantity = exact(fields.packQuantity), prices = record(fields.packPriceCents, ["min", "max"]), min = integer(prices.min, true), max = integer(prices.max, true), usableThrough = date(fields.usableThrough);
  let observedOn: string | null, monthlyPriceBasis: RegionalPackFact["monthlyPriceBasis"];
  if (Object.hasOwn(fields, "monthlyPriceBasis")) {
    const monthly = record(fields.monthlyPriceBasis, ["observationPeriod", "publishedOn", "reviewEffectiveFrom"], ["knownAvailableBy"]), period = text(monthly.observationPeriod), reviewEffectiveFrom = date(monthly.reviewEffectiveFrom);
    let availableBy: string;
    if (monthly.publishedOn === null) {
      // Capture can establish known availability, never exact publication or
      // survey day. Keep that evidence precision in the fact's immutable pin.
      const knownAvailableBy = date(monthly.knownAvailableBy);
      availableBy = knownAvailableBy; monthlyPriceBasis = { observationPeriod: period, publishedOn: null, knownAvailableBy, reviewEffectiveFrom };
    } else {
      if (Object.hasOwn(monthly, "knownAvailableBy")) invalid();
      const publishedOn = date(monthly.publishedOn);
      availableBy = publishedOn; monthlyPriceBasis = { observationPeriod: period, publishedOn, reviewEffectiveFrom };
    }
    if (fields.observedOn !== null || !/^\d{4}-(0[1-9]|1[0-2])$/.test(period) || period > availableBy.slice(0, 7) || availableBy > reviewEffectiveFrom || reviewEffectiveFrom > usableThrough) invalid();
    observedOn = null;
  } else { observedOn = date(fields.observedOn); if (observedOn > usableThrough) invalid(); }
  if (quantity.n === BigInt(0) || min > max || fields.currency !== "USD" || typeof fields.basis !== "string" || !["modeled-regional-average", "observed-regional-average", "synthetic-test-only"].includes(fields.basis)) invalid();
  return { id: text(fields.id), skuId: text(fields.skuId), unit: unit(fields.unit), formDigest: digest(fields.formDigest), region: region(fields.region), packQuantity: receipt(quantity), packPriceCents: { min, max }, currency: "USD", observedOn, usableThrough, sourceSha256: digest(fields.sourceSha256), basis: fields.basis as RegionalPackFact["basis"], flags: list(fields.flags, 100).map(text), ...(monthlyPriceBasis ? { monthlyPriceBasis } : {}) };
}
function referenceFact(value: unknown): ReferencePackFact {
  const fields = record(value, ["id", "skuId", "unit", "formDigest", "packQuantity", "packPriceCents", "currency", "sourceSha256", "sourceUrl", "kind", "sourceBasis", "reviewEffectiveFrom", "usableThrough", "flags"]);
  const quantity = exact(fields.packQuantity), cents = record(fields.packPriceCents, ["min", "max"]), min = integer(cents.min, true), max = integer(cents.max, true), reviewEffectiveFrom = date(fields.reviewEffectiveFrom), usableThrough = date(fields.usableThrough), sourceUrl = text(fields.sourceUrl), url = new URL(sourceUrl);
  if (quantity.n === BigInt(0) || min > max || fields.currency !== "USD" || url.protocol !== "https:" || url.username || url.password || url.search || url.hash || reviewEffectiveFrom > usableThrough) invalid();
  let sourceBasis: ReferencePackFact["sourceBasis"];
  if (fields.kind === "national-reference") {
    const b = record(fields.sourceBasis, ["geography", "observationPeriod", "observedOn", "publishedOn"], ["knownAvailableBy"]), observationPeriod = text(b.observationPeriod);
    if (b.geography !== "US-national" || b.observedOn !== null || !/^\d{4}-(0[1-9]|1[0-2])$/.test(observationPeriod)) invalid();
    if (b.publishedOn === null) { const knownAvailableBy = date(b.knownAvailableBy); if (observationPeriod > knownAvailableBy.slice(0, 7) || knownAvailableBy > reviewEffectiveFrom) invalid(); sourceBasis = { geography: "US-national", observationPeriod, observedOn: null, publishedOn: null, knownAvailableBy }; }
    else { if (Object.hasOwn(b, "knownAvailableBy")) invalid(); const publishedOn = date(b.publishedOn); if (observationPeriod > publishedOn.slice(0, 7) || publishedOn > reviewEffectiveFrom) invalid(); sourceBasis = { geography: "US-national", observationPeriod, observedOn: null, publishedOn }; }
  } else if (fields.kind === "manufacturer-reference") {
    const b = record(fields.sourceBasis, ["geography", "manufacturer", "capturedOn", "observedOn", "publishedOn"]), capturedOn = date(b.capturedOn);
    if (b.geography !== "manufacturer-reference-not-regional" || b.observedOn !== null || b.publishedOn !== null || capturedOn > reviewEffectiveFrom) invalid();
    sourceBasis = { geography: "manufacturer-reference-not-regional", manufacturer: text(b.manufacturer), capturedOn, observedOn: null, publishedOn: null };
  } else invalid();
  return { id: text(fields.id), skuId: text(fields.skuId), unit: unit(fields.unit), formDigest: digest(fields.formDigest), packQuantity: receipt(quantity), packPriceCents: { min, max }, currency: "USD", sourceSha256: digest(fields.sourceSha256), sourceUrl, kind: fields.kind as ReferencePackFact["kind"], sourceBasis, reviewEffectiveFrom, usableThrough, flags: list(fields.flags, 98).map(text) };
}
// Trusted host configuration parser only, not source or consumer approval.
export function readReferencePriceConfiguration(value: unknown): { readonly policy: typeof REFERENCE_PRICE_FALLBACK_POLICY; readonly facts: readonly ReferencePackFact[] } {
  const config = record(value, ["policy", "facts"]); if (config.policy !== REFERENCE_PRICE_FALLBACK_POLICY) invalid();
  const facts = list(config.facts, 20000).map(referenceFact); if (new Set(facts.map(f => f.id)).size !== facts.length) invalid();
  return freeze({ policy: REFERENCE_PRICE_FALLBACK_POLICY, facts });
}
const parsedReferenceSnapshots=new WeakSet<object>();
export function readReferencePriceConfigurationV2(value: unknown): ReferencePriceConfigurationV2 {
  if(value&&typeof value==="object"&&parsedReferenceSnapshots.has(value))return value as ReferencePriceConfigurationV2;
  const config = record(copyReferenceData(value), ["policy", "facts"], ["valuationPolicy"]);
  if (config.policy !== REFERENCE_PRICE_FALLBACK_POLICY_V2) invalid();
  if (Object.hasOwn(config, "valuationPolicy") && config.valuationPolicy !== DOCUMENTARY_VALUATION_POLICY) invalid();
  const rows = list(config.facts, 20000).map(row => record(row, ["id", "skuId", "unit", "formDigest", "packQuantity", "packPriceCents", "currency", "sourceSha256", "sourceUrl", "kind", "sourceBasis", "reviewEffectiveFrom", "usableThrough", "flags"]));
  const retail = readRetailerReferenceConfiguration({ policy: "wd-retailer-reference-source-v1", facts: rows.filter(row => row.kind === "retailer-reference") });
  if ("outcome" in retail) invalid();
  let nextRetail = 0;
  const facts = rows.map(row => row.kind === "retailer-reference" ? retail.facts[nextRetail++]! : referenceFact(row));
  if (new Set(facts.map(row => row.id)).size !== facts.length) invalid();
  if (Object.hasOwn(config, "valuationPolicy") && !facts.length) invalid();
  const snapshot:ReferencePriceConfigurationV2=freeze({ policy: REFERENCE_PRICE_FALLBACK_POLICY_V2, facts, ...(Object.hasOwn(config, "valuationPolicy") ? { valuationPolicy: DOCUMENTARY_VALUATION_POLICY } : {}) });
  parsedReferenceSnapshots.add(snapshot);return snapshot;
}
function effectiveFrom(value: PriceFactV2): string | null { return "kind" in value ? value.reviewEffectiveFrom : value.monthlyPriceBasis?.reviewEffectiveFrom ?? value.observedOn; }
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function subtract(a: Rational, b: Rational): Rational { return rational(a.n * b.d - b.n * a.d, a.d * b.d); }
function safe(value: bigint): number { if (value > MAX) throw new Capacity(); return Number(value); }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

export function quoteRegionalEstimates(requestValue: unknown, requirementValues: unknown, pantryValues: unknown, configuredFactValues: unknown, referenceConfiguration?: unknown): RegionalQuoteOutcome {
  // Version is not caller-controlled JSON. The V1 parser can never admit a
  // retailer kind; this cast only narrows the shared engine's versioned result.
  return quoteRegionalEstimatesInternal(requestValue, requirementValues, pantryValues, configuredFactValues, referenceConfiguration, "v1") as RegionalQuoteOutcome;
}

export function quoteRegionalEstimatesV2(requestValue: unknown, requirementValues: unknown, pantryValues: unknown, configuredFactValues: unknown, referenceConfiguration?: unknown): RegionalQuoteOutcomeV2 {
  return quoteRegionalEstimatesInternal(requestValue, requirementValues, pantryValues, configuredFactValues, referenceConfiguration, "v2") as RegionalQuoteOutcomeV2;
}

function quoteRegionalEstimatesInternal(requestValue: unknown, requirementValues: unknown, pantryValues: unknown, configuredFactValues: unknown, referenceConfiguration: unknown, version: "v1" | "v2"): InternalQuoteOutcome {
  try {
    const fields = record(requestValue, ["region", "storeIds", "budgetCents", "asOfDate"]), selectedRegion = region(fields.region), storeIds = list(fields.storeIds, MAX_REFERENCE_STORE_IDS).map(text), budget = integer(fields.budgetCents), asOfDate = date(fields.asOfDate);
    if (new Set(storeIds).size !== storeIds.length) invalid();
    if (Array.isArray(requirementValues) && requirementValues.length > 1000) throw new Capacity();
    const required = list(requirementValues, 1000).map(requirement).sort((a, b) => order(a.skuId, b.skuId)), owned = list(pantryValues, 1000).map(stock).sort((a, b) => order(a.skuId, b.skuId)), facts = list(configuredFactValues, 20000).map(fact);
    let references: (ReferencePackFact | RetailerReferencePackFact)[] = [], documentary = false;
    if (referenceConfiguration !== undefined) {
      const configured = version === "v1" ? readReferencePriceConfiguration(referenceConfiguration) : readReferencePriceConfigurationV2(referenceConfiguration);
      references = [...configured.facts];
      documentary = version === "v2" && "valuationPolicy" in configured && configured.valuationPolicy === DOCUMENTARY_VALUATION_POLICY;
    }
    if (new Set(required.map(row => row.skuId)).size !== required.length || new Set(owned.map(row => row.skuId)).size !== owned.length || new Set([...facts, ...references].map(row => row.id)).size !== facts.length + references.length) invalid();
    const ownedMap = new Map(owned.map(row => [row.skuId, row])), remaining = new Map(owned.map(row => [row.skuId, row.quantity]));
    const rows: RegionalPackQuoteRow[] = [], pins = new Map<string, { id: string; sourceSha256: string; factSha256: string; basis: PriceBasisV2 }>(), disclosures = new Map<string, ReferencePriceDisclosureV2>();
    let minTotal = BigInt(0), maxTotal = BigInt(0);
    for (const need of required) {
      if (need.nominalDensityReference && asOfDate < need.nominalDensityReference.reviewEffectiveFrom) return { outcome: "held", code: "quantity_reference_not_current" };
      if (need.nominalPreparationYieldReference && asOfDate < need.nominalPreparationYieldReference.reviewEffectiveFrom) return { outcome: "held", code: "quantity_reference_not_current" };
      if (need.nominalEggReference && asOfDate < need.nominalEggReference.reviewEffectiveFrom) return { outcome: "held", code: "quantity_reference_not_current" };
      const owned = ownedMap.get(need.skuId);
      if (owned && (owned.unit !== need.unit || owned.formDigest !== need.formDigest)) return { outcome: "error", code: "incompatible_regional_pantry" };
      const ownedQuantity = owned?.quantity ?? zero(), used = compare(ownedQuantity, need.quantity) < 0 ? ownedQuantity : need.quantity, leftOwned = subtract(ownedQuantity, used), toBuy = subtract(need.quantity, used);
      if (owned) remaining.set(need.skuId, leftOwned);
      let selected: PriceFactV2 | null = null, packCount = 0, bought = zero(), lineMin = 0, lineMax = 0;
      if (toBuy.n !== BigInt(0)) {
        const candidates = facts.filter(row => row.skuId === need.skuId && row.region === selectedRegion && row.unit === need.unit && row.formDigest === need.formDigest);
        if (candidates.length > 1) return { outcome: "held", code: "regional_pack_fact_ambiguous" };
        const regional = candidates[0], from = regional ? effectiveFrom(regional) : null;
        if (regional && from !== null && asOfDate >= from && asOfDate <= regional.usableThrough) selected = regional;
        else {
          if (referenceConfiguration === undefined) return { outcome: "held", code: regional ? "regional_pack_fact_not_current" : "regional_pack_fact_needed" };
          // The request date is always the real planning day. Only explicitly
          // admitted documentary references may retain historical valuations;
          // their original dates/values/IDs stay untouched. Regional facts and
          // quantity-reference effective dates keep their ordinary strict gates.
          const matching = references.filter(row => row.skuId === need.skuId && row.unit === need.unit && row.formDigest === need.formDigest), current = matching.filter(row => row.reviewEffectiveFrom <= asOfDate && (documentary || row.usableThrough >= asOfDate));
          if (!current.length) return { outcome: "held", code: matching.length ? "reference_pack_fact_not_current" : "regional_pack_fact_needed" };
          // V1 admits only ordinary references and retains its exact behavior.
          // V2's ordinary tier outranks retailer references, even cheaper ones.
          const ordinary = current.filter(row => row.kind !== "retailer-reference");
          const tier = version === "v2" && ordinary.length ? ordinary : current;
          if (tier.length !== 1) return { outcome: "held", code: "reference_pack_fact_ambiguous" };
          selected = tier[0]!;
        }
        const packQuantity = exact(selected.packQuantity), quotient = divide(toBuy, packQuantity), count = (quotient.n + quotient.d - BigInt(1)) / quotient.d;
        packCount = safe(count); bought = multiply(packQuantity, rational(count)); lineMin = safe(count * BigInt(selected.packPriceCents.min)); lineMax = safe(count * BigInt(selected.packPriceCents.max));
        if ([receipt(bought), receipt(subtract(bought, toBuy))].some(value => value.numerator.length > 240 || value.denominator.length > 240)) throw new Capacity();
        minTotal += BigInt(lineMin); maxTotal += BigInt(lineMax); safe(maxTotal);
        pins.set(selected.id, { id: selected.id, sourceSha256: selected.sourceSha256, factSha256: hash("kind" in selected && selected.kind === "retailer-reference" ? canonicalReferenceData(selected) : selected), basis: "kind" in selected ? selected.kind : selected.basis });
        if ("kind" in selected) disclosures.set(selected.id, { factId: selected.id, kind: selected.kind, sourceBasis: selected.sourceBasis, sourceUrl: selected.sourceUrl, sourceSha256: selected.sourceSha256, reviewEffectiveFrom: selected.reviewEffectiveFrom, usableThrough: selected.usableThrough });
      }
      const priceFlags = selected && "kind" in selected ? [...selected.flags, "reference-not-regional-average", "reference-not-live-retailer-offer"] : selected?.flags ?? [];
      const quantityFlags = [...(need.nominalDensityReference ? [NOMINAL_DENSITY_FLAG] : []), ...(need.nominalPreparationYieldReference ? [NOMINAL_PREPARATION_YIELD_FLAG] : []), ...(need.nominalEggReference ? [NOMINAL_EGG_FLAG] : [])];
      rows.push({ skuId: need.skuId, category: need.category, unit: need.unit, formDigest: need.formDigest, needed: receipt(need.quantity), ownedUsed: receipt(used), ownedRemaining: receipt(leftOwned), toBuy: receipt(toBuy), packQuantity: selected?.packQuantity ?? null, packCount, purchasedQuantity: receipt(bought), purchasedLeftover: receipt(subtract(bought, toBuy)), estimatedLineCents: { min: lineMin, max: lineMax }, factId: selected?.id ?? null, flags: quantityFlags.length ? [...new Set([...priceFlags, ...quantityFlags])] : priceFlags, ...(need.nominalDensityReference ? { nominalDensityReference: need.nominalDensityReference } : {}), ...(need.nominalPreparationYieldReference ? { nominalPreparationYieldReference: need.nominalPreparationYieldReference } : {}), ...(need.nominalEggReference ? { nominalEggReference: need.nominalEggReference } : {}) });
    }
    const min = safe(minTotal), max = safe(maxTotal);
    return freeze({ outcome: "quoted", scope: disclosures.size ? "mixed-geography-reference-typical-whole-pack-ingredient-estimate" : "regional-average-typical-whole-pack-ingredient-estimate", region: selectedRegion, storeIds, asOfDate, currency: "USD", rows, ownedRemaining: owned.map(row => ({ skuId: row.skuId, unit: row.unit, formDigest: row.formDigest, quantity: receipt(remaining.get(row.skuId)!) })), estimatedTotalCents: { min, max }, budgetRemainingCents: { min: budget - max, max: budget - min }, withinBudgetAtUpperEstimate: max <= budget, uniqueBuyItemCount: rows.filter(row => row.packCount > 0).length, factPins: [...pins.values()].sort((a, b) => order(a.id, b.id)), ...(disclosures.size ? { referenceEstimates: { policy: version === "v1" ? REFERENCE_PRICE_FALLBACK_POLICY : REFERENCE_PRICE_FALLBACK_POLICY_V2, sources: [...disclosures.values()].sort((a, b) => order(a.factId, b.factId)), ...(documentary ? { valuationPolicy: DOCUMENTARY_VALUATION_POLICY, planningDate: asOfDate } : {}) } } : {}), liveRetailerPricing: false, checkoutChargesIncluded: false, adoptionGranted: false });
  } catch (error) { return error instanceof Capacity ? { outcome: "held", code: "regional_quote_capacity_exceeded" } : { outcome: "error", code: "invalid_regional_quote_input" }; }
}

// Explicit private V3 selection. Old V1/V2 entrypoints and pack arithmetic stay unchanged.
// This composes maintained quantity, pack and rate arithmetic; no stock/provider IO.
export function quoteRegionalEstimatesV3(requestValue:unknown,requirementValues:unknown,pantryValues:unknown,configuredFactValues:unknown,referenceConfiguration:unknown,rateConfiguration:unknown):RegionalQuoteOutcomeV3 {
 try {
 const config=readRateReferenceConfiguration(rateConfiguration),request=record(copyReferenceData(requestValue),["region","storeIds","budgetCents","asOfDate"]);
 const needs=list(copyReferenceData(requirementValues),1000);const validated=needs.map(requirement);const stockValues=list(copyReferenceData(pantryValues),1000);const stocks=stockValues.map(stock);
 if(new Set(validated.map(r=>r.skuId)).size!==validated.length||new Set(stocks.map(r=>r.skuId)).size!==stocks.length)invalid();
 const rateSkus=new Set(config.facts.map(f=>f.skuId));
 const validation=quoteRegionalEstimatesV2(requestValue,[],pantryValues,configuredFactValues,referenceConfiguration);if(validation.outcome!=="quoted")return validation;
 const base=quoteRegionalEstimatesV2(requestValue,needs.filter((_,i)=>!rateSkus.has(validated[i]!.skuId)),stockValues.filter((_,i)=>!rateSkus.has(stocks[i]!.skuId)),configuredFactValues,referenceConfiguration);if(base.outcome!=="quoted")return base;
 const rows:AnyRegionalQuoteRow[]=[...base.rows],pins:RegionalQuoteSuccessV3["factPins"][number][]=[...base.factPins],remaining=[...base.ownedRemaining];let min=base.estimatedTotalCents.min,max=base.estimatedTotalCents.max;
 for(const need of validated.filter(n=>rateSkus.has(n.skuId))){
  const matches=config.facts.filter(f=>f.skuId===need.skuId);if(matches.length!==1)return {outcome:"held",code:"regional_pack_fact_ambiguous"};const rate=matches[0]!;
  if(need.unit!=="g")invalid();const owned=stocks.find(s=>s.skuId===need.skuId);if(owned&&(owned.unit!==need.unit||owned.formDigest!==need.formDigest))return {outcome:"error",code:"incompatible_regional_pantry"};
  const ownedQuantity=owned?.quantity??zero(),used=compare(ownedQuantity,need.quantity)<0?ownedQuantity:need.quantity,left=subtract(ownedQuantity,used),buy=subtract(need.quantity,used);
  const quote=quoteRateReference({consumer:"wd-variable-weight-reference-v1",country:"US",currency:"USD",planningDate:request.asOfDate,formId:rate.formId,skuId:rate.skuId,purchaseState:rate.purchaseState,quantityBasis:"Validated whole-week purchased gram demand; exact rational, no physical pack count. Nominal same-state source conversion retains its uncertainty.",quantitySourceSha256:rate.sourceSha256,purchasedDemand:{unit:"g",min:receipt(buy),max:receipt(buy)}},config);
  if(quote.outcome!=="quoted")return quote.outcome==="held"?{outcome:"held",code:"reference_pack_fact_not_current"}:{outcome:"error",code:"invalid_regional_quote_input"};
  min+=quote.estimatedLineCents.min;max+=quote.estimatedLineCents.max;if(!Number.isSafeInteger(min)||!Number.isSafeInteger(max))invalid();
  rows.push({kind:"weight",skuId:need.skuId,category:need.category,unit:"g",formDigest:need.formDigest,needed:receipt(need.quantity),ownedUsed:receipt(used),ownedRemaining:receipt(left),toBuy:receipt(buy),purchasedQuantity:receipt(buy),purchasedLeftover:receipt(zero()),estimatedLineCents:quote.estimatedLineCents,factId:rate.id,flags:["dated-variable-weight-reference","not-live-stock-or-checkout","conditional-purchased-input-weight"],rate,quantityBasis:quote.quantityBasis});
  pins.push({id:rate.id,sourceSha256:rate.sourceSha256,factSha256:hash(canonicalReferenceData(rate)),basis:"dated-variable-weight-reference"});
  if(owned)remaining.push({skuId:need.skuId,unit:need.unit,formDigest:need.formDigest,quantity:receipt(left)});
 }
 for(const owned of stocks)if(rateSkus.has(owned.skuId)&&!validated.some(n=>n.skuId===owned.skuId))remaining.push({skuId:owned.skuId,unit:owned.unit,formDigest:owned.formDigest,quantity:receipt(owned.quantity)});
 const budget=integer(request.budgetCents);return freeze({...base,purchasePolicy:"wd-mixed-purchases-v3",rows:rows.sort((a,b)=>order(a.skuId,b.skuId)),factPins:pins.sort((a,b)=>order(a.id,b.id)),ownedRemaining:remaining.sort((a,b)=>order(a.skuId,b.skuId)),estimatedTotalCents:{min,max},budgetRemainingCents:{min:budget-max,max:budget-min},withinBudgetAtUpperEstimate:max<=budget,uniqueBuyItemCount:rows.filter(isPurchasedQuoteRow).length});
 }catch{return {outcome:"error",code:"invalid_regional_quote_input"};}
}

// Internal custody projection over two validated same-owner/source evaluations.
// Called only after the caller verifies the original durable source/basis/owner.
// Not an ingress, price approval, pantry grant or operation retry.
export function retainV3PurchaseCustody(before:RegionalQuoteSuccessV3,after:RegionalQuoteSuccessV3):RegionalQuoteSuccessV3 {
 if(before.purchasePolicy!=="wd-mixed-purchases-v3"||after.purchasePolicy!==before.purchasePolicy||JSON.stringify(canonicalReferenceData([before.region,before.storeIds,before.asOfDate,before.currency]))!==JSON.stringify(canonicalReferenceData([after.region,after.storeIds,after.asOfDate,after.currency])))invalid();
 const oldBySku=new Map(before.rows.map(r=>[r.skuId,r]));if(oldBySku.size!==before.rows.length)invalid();
 for(const row of after.rows){
  const old=oldBySku.get(row.skuId);if(isPurchasedQuoteRow(row)&&(!old||!purchasedQuoteCovers(old,row)))invalid();
  if(old&&((old.kind==="weight")!==(row.kind==="weight")||old.formDigest!==row.formDigest||old.unit!==row.unit))invalid();
  if(row.factId&&isPurchasedQuoteRow(row)){
   const a=before.factPins.filter(f=>f.id===row.factId),b=after.factPins.filter(f=>f.id===row.factId);
   if(a.length!==1||b.length!==1||JSON.stringify(canonicalReferenceData(a))!==JSON.stringify(canonicalReferenceData(b)))invalid();
  }
 }
 const next=new Map(after.rows.map(r=>[r.skuId,r]));const rows:AnyRegionalQuoteRow[]=before.rows.map(old=>{
  if(old.kind==="weight"){if(Object.hasOwn(old,"packCount")||Object.hasOwn(old,"packQuantity")||old.unit!=="g")invalid();}
  else if(old.packCount>0&&(!old.packQuantity||compare(multiply(exact(old.packQuantity),rational(BigInt(old.packCount))),exact(old.purchasedQuantity))!==0))invalid();
  const current=next.get(old.skuId),buy=current?exact(current.toBuy):zero(),purchased=exact(old.purchasedQuantity);if(compare(buy,purchased)>0)invalid();
  const common={needed:current?.needed??receipt(zero()),ownedUsed:current?.ownedUsed??receipt(zero()),ownedRemaining:current?.ownedRemaining??old.ownedRemaining,toBuy:receipt(buy),purchasedLeftover:receipt(subtract(purchased,buy))};
  return {...old,...common};
 });
 for(const row of after.rows)if(!oldBySku.has(row.skuId)){if(isPurchasedQuoteRow(row))invalid();rows.push(row);}
 return freeze({...before,rows:rows.sort((a,b)=>order(a.skuId,b.skuId)),ownedRemaining:after.ownedRemaining});
}
