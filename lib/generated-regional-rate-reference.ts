import { copyReferenceData } from "./generated-plan-data.ts";
import { compare, divide, multiply, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";

// Trusted-host documentary configuration, never a source approval or stock probe.
// Purchased demand has already passed the separate quantity/preparation boundary.
export const RATE_REFERENCE_POLICY = "wd-variable-weight-reference-v1";
export const RATE_FORMS = Object.freeze({
  "255996d0456f7c889bc3218b3faf430dd43f69deb9e3cb41e216fd414e671852": "apricot",
  "7f567ae075daff9d3d5852a98905fda6614ca56068035e0c608c7c81eef6e8fa": "bell-pepper",
  "dfb2c23b56bef8b3f8d383603f6beaf1ca478dc64149fd9b149f207c252aa839": "bell-pepper",
  "1b1c71573af90931c4b5b988bae0b279066c936849da4285104a324edd7dfe02": "bell-pepper",
  "339c07740997cf1f3581e09a9758ea9642f0486f76975b50a89a44aa09ab12df": "protein_cod",
  "8d560ae686b804a6d094814d51d9d42ffc09f0405a45602405b96b8d2e1e361d": "protein_salmon",
});
export type WeightUnit = "g" | "lb";
export type RateFact = Readonly<{
  id: string; formId: string; skuId: string; ingredientId: string; purchaseState: string;
  productName: string; sourceUrl: string; sourceSha256: string;
  country: "US"; currency: "USD"; scope: "retailer-listing-reference-not-regional";
  retailerId: string; capturedOn: string; observedOn: null; publishedOn: null;
  sourceContext: string; referenceAmount: ExactAmount; referenceUnit: WeightUnit;
  priceCents: Readonly<{ min: number; max: number }>;
}>;
export type RateConfiguration = Readonly<{ policy: typeof RATE_REFERENCE_POLICY; valuation: "dated-documentary"; facts: readonly RateFact[] }>;
export type RateDemand = Readonly<{
  consumer: typeof RATE_REFERENCE_POLICY; country: "US"; currency: "USD"; planningDate: string;
  formId: string; skuId: string; purchaseState: string;
  quantityBasis: string; quantitySourceSha256: string;
  purchasedDemand: Readonly<{ unit: WeightUnit; min: ExactAmount; max: ExactAmount }>;
}>;
export type RateQuote =
  | Readonly<{ outcome: "quoted"; kind: "variable-weight-reference"; formId: string; skuId: string;
    purchasedWeight: RateDemand["purchasedDemand"]; quantityBasis: string; quantitySourceSha256: string;
    estimatedLineCents: Readonly<{ min: number; max: number }>; currency: "USD";
    planningDate: string; source: RateFact; valuation: "dated-documentary";
    disclosure: string; liveRetailerPricing: false; checkoutChargesIncluded: false; adoptionGranted: false }>
  | Readonly<{ outcome: "held"; code: "unsupported_rate_consumer" | "rate_source_needed" | "rate_source_ambiguous" | "rate_source_future" }>
  | Readonly<{ outcome: "error"; code: "invalid_rate_reference_input" }>;

function invalid(): never { throw new Error("Invalid rate reference input"); }
function object(v: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) invalid();
  const o = v as Record<string, unknown>;
  if (Object.keys(o).length !== keys.length || keys.some(k => !Object.hasOwn(o, k))) invalid();
  return o;
}
function text(v: unknown): string { if (typeof v !== "string" || !v.trim() || v.length > 1000) invalid(); return v; }
function digest(v: unknown): string { const s = text(v); if (!/^[a-f0-9]{64}$/.test(s)) invalid(); return s; }
function day(v: unknown): string { const s = text(v); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s)) || new Date(s).toISOString().slice(0, 10) !== s) invalid(); return s; }
function amount(v: unknown, positive = false): Rational {
  const o = object(v, ["numerator", "denominator"]);
  if (typeof o.numerator !== "string" || typeof o.denominator !== "string" || !/^\d{1,80}$/.test(o.numerator) || !/^[1-9]\d{0,79}$/.test(o.denominator)) invalid();
  const r = rational(BigInt(o.numerator), BigInt(o.denominator)); if (positive && r.n === BigInt(0)) invalid(); return r;
}
function unit(v: unknown): WeightUnit { if (v !== "g" && v !== "lb") invalid(); return v; }
function grams(r: Rational, u: WeightUnit): Rational { return u === "g" ? r : multiply(r, rational(BigInt(45359237), BigInt(100000))); }
function safe(v: bigint): number { const n = Number(v); if (!Number.isSafeInteger(n) || n < 0) invalid(); return n; }
function identity(o: Record<string, unknown>): void {
  const form = digest(o.formId);
  if (!Object.hasOwn(RATE_FORMS, form) || o.skuId !== `wd-meal-form-v1-${form.slice(0, 24)}`) invalid();
  text(o.purchaseState);
}
function freeze<T>(v: T): T {
  if (v && typeof v === "object") { for (const x of Object.values(v)) freeze(x); Object.freeze(v); }
  return v;
}
function fact(value: unknown): RateFact {
  const o = object(value, ["id", "formId", "skuId", "ingredientId", "purchaseState", "productName", "sourceUrl", "sourceSha256", "country", "currency", "scope", "retailerId", "capturedOn", "observedOn", "publishedOn", "sourceContext", "referenceAmount", "referenceUnit", "priceCents"]);
  identity(o);
  if (o.ingredientId !== RATE_FORMS[o.formId as keyof typeof RATE_FORMS] || o.country !== "US" || o.currency !== "USD" || o.scope !== "retailer-listing-reference-not-regional" || o.observedOn !== null || o.publishedOn !== null) invalid();
  for (const k of ["id", "productName", "retailerId", "sourceContext"]) text(o[k]);
  const url = new URL(text(o.sourceUrl)); if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) invalid();
  digest(o.sourceSha256); day(o.capturedOn); amount(o.referenceAmount, true); unit(o.referenceUnit);
  const price = object(o.priceCents, ["min", "max"]);
  if (!Number.isSafeInteger(price.min) || !Number.isSafeInteger(price.max) || (price.min as number) <= 0 || (price.max as number) < (price.min as number)) invalid();
  return o as unknown as RateFact;
}
const parsedRateSnapshots=new WeakSet<object>();
export function readRateReferenceConfiguration(value: unknown): RateConfiguration {
  if(value&&typeof value==="object"&&parsedRateSnapshots.has(value))return value as RateConfiguration;
  const o = object(copyReferenceData(value), ["policy", "valuation", "facts"]);
  if (o.policy !== RATE_REFERENCE_POLICY || o.valuation !== "dated-documentary" || !Array.isArray(o.facts) || o.facts.length > 100) invalid();
  const facts = o.facts.map(fact); if (new Set(facts.map(f => f.id)).size !== facts.length) invalid();
  const snapshot:RateConfiguration=freeze({ policy: RATE_REFERENCE_POLICY, valuation: "dated-documentary" as const, facts });parsedRateSnapshots.add(snapshot);return snapshot;
}

// Separate from whole-pack quoting: neither zero nor fractional packCount exists.
// There is intentionally no live-price mode, freshness renewal or conversion of
// edible recipe weight to purchased weight here. Dated context always travels.
export function quoteRateReference(demandValue: unknown, configuration: unknown): RateQuote {
  try {
    const o = object(copyReferenceData(demandValue), ["consumer", "country", "currency", "planningDate", "formId", "skuId", "purchaseState", "quantityBasis", "quantitySourceSha256", "purchasedDemand"]);
    if (o.consumer !== RATE_REFERENCE_POLICY) return { outcome: "held", code: "unsupported_rate_consumer" };
    identity(o); if (o.country !== "US" || o.currency !== "USD") invalid();
    const planningDate = day(o.planningDate); text(o.quantityBasis); digest(o.quantitySourceSha256);
    const q = object(o.purchasedDemand, ["unit", "min", "max"]), u = unit(q.unit), min = amount(q.min), max = amount(q.max);
    if (compare(min, max) > 0) invalid();
    const config = readRateReferenceConfiguration(configuration);
    const candidates = config.facts.filter(f => f.formId === o.formId && f.skuId === o.skuId && f.purchaseState === o.purchaseState);
    if (!candidates.length) return { outcome: "held", code: "rate_source_needed" };
    if (candidates.length !== 1) return { outcome: "held", code: "rate_source_ambiguous" };
    const source = candidates[0]!; if (source.capturedOn > planningDate) return { outcome: "held", code: "rate_source_future" };
    const reference = grams(amount(source.referenceAmount, true), source.referenceUnit);
    const lower = multiply(divide(grams(min, u), reference), rational(BigInt(source.priceCents.min)));
    const upper = multiply(divide(grams(max, u), reference), rational(BigInt(source.priceCents.max)));
    return freeze({ outcome: "quoted", kind: "variable-weight-reference", formId: o.formId as string, skuId: o.skuId as string,
      purchasedWeight: { unit: u, min: receipt(min), max: receipt(max) }, quantityBasis: o.quantityBasis as string, quantitySourceSha256: o.quantitySourceSha256 as string,
      estimatedLineCents: { min: safe(lower.n / lower.d), max: safe((upper.n + upper.d - BigInt(1)) / upper.d) }, currency: "USD", planningDate,
      source, valuation: "dated-documentary", disclosure: "Dated listing rate applied to conditional purchased weight; no item weight, stock, future price or checkout claim.",
      liveRetailerPricing: false, checkoutChargesIncluded: false, adoptionGranted: false });
  } catch { return { outcome: "error", code: "invalid_rate_reference_input" }; }
}
