import { sha256Hex } from "./generated-runtime-bytes.ts";
import { rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { BaseUnit, ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";

const POLICY = "wd-retailer-reference-source-v1" as const;
const FACT_DOMAIN = "wd-retailer-reference-fact-v1" as const;
const MAX_FACTS = 20000;
const MAX_FLAGS = 98;
const MAX_TEXT = 500;
const MAX_RATIONAL_DIGITS = 240;
type Data = Record<string, unknown>;

export type OfferContextV1 = {
  readonly channel: "online-public" | "identified-store";
  readonly geographyDescription: string;
  readonly storeId: string | null;
  readonly fulfilment: string | null;
};

export type RetailerSourceBasisV1 = {
  readonly geography: "retailer-reference-not-regional";
  readonly retailerId: string;
  readonly productId: string;
  readonly offerContext: OfferContextV1;
  readonly capturedOn: string;
  readonly observedOn: string | null;
  readonly publishedOn: string | null;
};

export type RetailerReferencePackFact = {
  readonly id: string;
  readonly skuId: string;
  readonly unit: BaseUnit;
  readonly formDigest: string;
  readonly packQuantity: ExactAmount;
  readonly packPriceCents: { readonly min: number; readonly max: number };
  readonly currency: "USD";
  readonly kind: "retailer-reference";
  readonly sourceSha256: string;
  readonly sourceUrl: string;
  readonly sourceBasis: RetailerSourceBasisV1;
  readonly reviewEffectiveFrom: string;
  readonly usableThrough: string;
  readonly flags: readonly string[];
};

export type RetailerReferenceConfigurationV1 = {
  readonly policy: typeof POLICY;
  readonly facts: readonly RetailerReferencePackFact[];
};

export type RetailerReadOutcomeV1 = RetailerReferenceConfigurationV1
  | { readonly outcome: "error"; readonly code: "invalid_retailer_reference_configuration" };

function invalid(): never {
  throw new Error("Invalid retailer reference configuration");
}

function record(value: unknown, fields: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (fields.some(field => !Object.hasOwn(descriptors, field))) invalid();
  const result: Data = {};
  for (const key of keys) {
    if (typeof key !== "string" || !fields.includes(key)) invalid();
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) invalid();
    result[key] = descriptor.value;
  }
  return result;
}

function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) invalid();
  const result: unknown[] = [];
  for (let index = 0; index < value.length; index++) {
    const descriptor = descriptors[String(index)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    result.push(descriptor.value);
  }
  return result;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_TEXT) invalid();
  return value;
}

function digest(value: unknown): string {
  const result = text(value);
  if (!/^[a-f0-9]{64}$/.test(result)) invalid();
  return result;
}

function unit(value: unknown): BaseUnit {
  if (value !== "g" && value !== "ml" && value !== "each") invalid();
  return value;
}

function isoDate(value: unknown): string {
  const result = text(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) invalid();
  const time = Date.parse(`${result}T00:00:00.000Z`);
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== result) invalid();
  return result;
}

function exactAmount(value: unknown, positive: boolean): { value: ExactAmount; exact: Rational } {
  const amount = record(value, ["numerator", "denominator"]);
  const numerator = amount.numerator;
  const denominator = amount.denominator;
  if (typeof numerator !== "string" || numerator.length > MAX_RATIONAL_DIGITS || !/^(0|[1-9]\d*)$/.test(numerator)) invalid();
  if (typeof denominator !== "string" || denominator.length > MAX_RATIONAL_DIGITS || !/^(0|[1-9]\d*)$/.test(denominator)) invalid();
  const exact = rational(BigInt(numerator), BigInt(denominator));
  if (positive && exact.n === BigInt(0)) invalid();
  return { value: receipt(exact), exact };
}

function cents(value: unknown): { min: number; max: number } {
  const price = record(value, ["min", "max"]);
  const min = price.min;
  const max = price.max;
  if (typeof min !== "number" || !Number.isSafeInteger(min) || min <= 0) invalid();
  if (typeof max !== "number" || !Number.isSafeInteger(max) || max < min) invalid();
  return { min, max };
}

function sourceUrl(value: unknown): string {
  const result = text(value);
  if (/[^\S\r\n]|[\u0000-\u001f\u007f]/u.test(result) || /%(?![a-f0-9]{2})/i.test(result) || /[?#]/.test(result)) invalid();
  let parsed: URL;
  try {
    parsed = new URL(result);
  } catch {
    return invalid();
  }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.search || parsed.hash) invalid();
  return result;
}

function nullableText(value: unknown): string | null {
  return value === null ? null : text(value);
}

function offerContext(value: unknown): OfferContextV1 {
  const fields = record(value, ["channel", "geographyDescription", "storeId", "fulfilment"]);
  const channel = fields.channel;
  if (channel !== "online-public" && channel !== "identified-store") invalid();
  const geographyDescription = text(fields.geographyDescription);
  const storeId = nullableText(fields.storeId);
  const fulfilment = nullableText(fields.fulfilment);
  if (channel === "online-public" && storeId !== null) invalid();
  if (channel === "identified-store" && storeId === null) invalid();
  return { channel, geographyDescription, storeId, fulfilment };
}

function sourceBasis(value: unknown): RetailerSourceBasisV1 {
  const fields = record(value, ["geography", "retailerId", "productId", "offerContext", "capturedOn", "observedOn", "publishedOn"]);
  if (fields.geography !== "retailer-reference-not-regional") invalid();
  return {
    geography: "retailer-reference-not-regional",
    retailerId: text(fields.retailerId),
    productId: text(fields.productId),
    offerContext: offerContext(fields.offerContext),
    capturedOn: isoDate(fields.capturedOn),
    observedOn: fields.observedOn === null ? null : isoDate(fields.observedOn),
    publishedOn: fields.publishedOn === null ? null : isoDate(fields.publishedOn),
  };
}

function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child);
    Object.freeze(value);
  }
  return value;
}

function hash(value: unknown): string {
  const canonical = canonicalReferenceData(value);
  return sha256Hex(JSON.stringify(canonical));
}

function readFact(value: unknown): RetailerReferencePackFact {
  const fields = record(value, [
    "id", "skuId", "unit", "formDigest", "packQuantity", "packPriceCents", "currency", "kind",
    "sourceSha256", "sourceUrl", "sourceBasis", "reviewEffectiveFrom", "usableThrough", "flags",
  ]);
  const skuId = text(fields.skuId);
  const parsedUnit = unit(fields.unit);
  const formDigest = digest(fields.formDigest);
  const packQuantity = exactAmount(fields.packQuantity, true).value;
  const packPriceCents = cents(fields.packPriceCents);
  if (fields.currency !== "USD" || fields.kind !== "retailer-reference") invalid();
  const sourceSha256 = digest(fields.sourceSha256);
  const parsedSourceUrl = sourceUrl(fields.sourceUrl);
  const parsedSourceBasis = sourceBasis(fields.sourceBasis);
  const reviewEffectiveFrom = isoDate(fields.reviewEffectiveFrom);
  const usableThrough = isoDate(fields.usableThrough);
  if (parsedSourceBasis.capturedOn > reviewEffectiveFrom || (parsedSourceBasis.observedOn !== null && parsedSourceBasis.observedOn > reviewEffectiveFrom) || (parsedSourceBasis.publishedOn !== null && parsedSourceBasis.publishedOn > reviewEffectiveFrom) || reviewEffectiveFrom > usableThrough) invalid();
  const flags = list(fields.flags, MAX_FLAGS).map(flag => text(flag));
  if (new Set(flags).size !== flags.length) invalid();

  const normalizedWithoutId = {
    skuId,
    unit: parsedUnit,
    formDigest,
    packQuantity,
    packPriceCents,
    currency: "USD" as const,
    kind: "retailer-reference" as const,
    sourceSha256,
    sourceUrl: parsedSourceUrl,
    sourceBasis: parsedSourceBasis,
    reviewEffectiveFrom,
    usableThrough,
    flags,
  };
  const id = text(fields.id);
  if (!/^rr1:[a-f0-9]{64}$/.test(id) || id !== `rr1:${hash([FACT_DOMAIN, normalizedWithoutId])}`) invalid();
  return { id, ...normalizedWithoutId };
}

export function readRetailerReferenceConfiguration(value: unknown): RetailerReadOutcomeV1 {
  try {
    const copied = copyReferenceData(value);
    const configuration = record(copied, ["policy", "facts"]);
    if (configuration.policy !== POLICY) invalid();
    const facts = list(configuration.facts, MAX_FACTS).map(readFact);
    const ids = new Set<string>();
    for (const fact of facts) {
      if (ids.has(fact.id)) invalid();
      ids.add(fact.id);
    }
    return freeze({ policy: POLICY, facts });
  } catch {
    return { outcome: "error", code: "invalid_retailer_reference_configuration" };
  }
}
