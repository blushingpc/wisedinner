import { createHash } from "node:crypto";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson, REFERENCE_BODY_LIMIT } from "./generated-plan-json.ts";
import { rational, receipt } from "../packages/solver/src/generated-meal-ranges.ts";
import type { RegionalPackFact } from "./generated-regional-quote.ts";
import { hash } from "../scripts/data/price-evidence.ts";

// One reviewed, offline source cohort. Replacing a source requires a new review,
// not a caller-supplied hash. No files, HTTP, pantry mutation or meal/yield match.
export const MILK_EVIDENCE_PINS = Object.freeze({
  prices: "c15d18ae3e35ed9b92450a77ee1f703c70323aa41c1ae88d2589caf013ddbe8e",
  milkYieldPdf: "9bff6a34979abe9e06485413f7ae5ad4fd6376b933e2619967df440d095c6531",
  geography: "ccad459fc646b4ff91eaf31be37b972fd40cff50e1894826d80579c27d346aa0",
  namedMeasures: "51c7783efe7b4f93063beb87c8d9b5b1b1e5a2396062f755432156d630cc19d4",
});
const CATALOG = "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0";
const CUP = "1d0c01f242b14e93e1de9c46be1a9609c698b468f0efb61456ec7ee15609a694";
const INGREDIENT = "r3-milk2", STATE = "pasteurized, refrigerated, weighed in grams; vitamin fortification not a macro distinction";
type Region = RegionalPackFact["region"];
type Data = Record<string, unknown>;
const REGIONS: readonly Region[] = ["Northeast", "Midwest", "South", "West"];
const CITIES: Readonly<Record<string, Region>> = Object.freeze({
  "Atlanta, GA": "South", "Baltimore, MD": "South", "Boston, MA": "Northeast", "Chicago, IL": "Midwest", "Cincinnati, OH": "Midwest", "Cleveland, OH": "Midwest", "Dallas, TX": "South", "Denver, CO": "West", "Detroit, MI": "Midwest", "Hartford, CT": "Northeast", "Houston, TX": "South", "Indianapolis, IN": "Midwest", "Kansas City, MO": "Midwest", "Louisville, KY": "South", "Miami, FL": "South", "Milwaukee, WI": "Midwest", "Minneapolis, MN": "Midwest", "New Orleans, LA": "South", "New York, NY": "Northeast", "Oklahoma City, OK": "South", "Philadelphia, PA": "Northeast", "Phoenix, AZ": "West", "Pittsburgh, PA": "Northeast", "Portland, OR": "West", "Sacramento, CA": "West", "Seattle, WA": "West", "St. Louis, MO": "Midwest", "Syracuse, NY": "Northeast", "Washington, DC": "South", "Wichita, KS": "Midwest",
});
const FLAGS = Object.freeze(["typical-gallon-package-estimate-not-exact-store-pack", "conditional-USDA-named-cup-mass-not-measured-brand-density", "unweighted-surveyed-city-proxy-not-official-regional-average", "price-range-is-observed-city-extrema-not-confidence-or-checkout-bound", "September-2026-observations-not-October-prices", "no-purchase-or-cooking-yield-inferred", "not-known-pantry-package-quantity", "not-live-store-price"]);
const typed = Object.getPrototypeOf(Uint8Array.prototype), buffer = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!, offset = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!, length = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
function invalid(): never { throw new Error("Invalid milk evidence"); }
function record(value: unknown, keys: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const fields = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(fields).length !== keys.length || keys.some(key => !fields[key] || !("value" in fields[key]!) || !fields[key]!.enumerable)) invalid();
  return Object.fromEntries(keys.map(key => [key, fields[key]!.value]));
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function sha(value: unknown): string { const v = text(value); if (!/^[a-f0-9]{64}$/.test(v)) invalid(); return v; }
function date(value: unknown): string { const v = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v + "T00:00:00Z")) || new Date(v + "T00:00:00Z").toISOString().slice(0, 10) !== v) invalid(); return v; }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function sealedBytes(value: unknown, expected: string): Uint8Array {
  const size = length.call(value) as number; if (size > REFERENCE_BODY_LIMIT) invalid();
  const copy = new Uint8Array(new Uint8Array(buffer.call(value), offset.call(value), size));
  if (createHash("sha256").update(copy).digest("hex") !== expected) invalid(); return copy;
}
function json(bytes: Uint8Array): Data { return parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as Data; }
type Freshness = { id: string; sourceSha256: string; candidateSha256: string; observationPeriod: string; effectiveFrom: string; usableThrough: string; priceBand: "observed-city-envelope" };
export type MilkPlanningOutcome = { readonly outcome: "prepared"; readonly regionalPackFacts: readonly RegionalPackFact[]; readonly candidateSha256: string; readonly freshnessReview: Readonly<Freshness>; readonly sourceAdoptionGranted: false; readonly mealYieldEstablished: false; readonly pantryPackageQuantityEstablished: false }
  | { readonly outcome: "held"; readonly code: "milk_purchase_binding_review_needed" | "milk_price_freshness_review_needed" | "milk_price_outside_reviewed_window"; readonly regionalPackFacts: readonly [] }
  | { readonly outcome: "error"; readonly code: "invalid_milk_planning_query" };

export function createReviewedMilkPackEvidence(sourceValue: unknown, trustedConfiguration: unknown = { purchaseBinding: null, freshnessReview: null }) {
  try {
    const sources = record(sourceValue, Object.keys(MILK_EVIDENCE_PINS));
    const bytes = Object.fromEntries(Object.entries(MILK_EVIDENCE_PINS).map(([key, pin]) => [key, sealedBytes(sources[key], pin)]));
    const prices = json(bytes.prices!), measures = json(bytes.namedMeasures!);
    if (prices.reportSection !== "Conventional Reduced Fat" || !Array.isArray(prices.results) || prices.results.length !== 837 || !Array.isArray(measures.measureFacts) || !Array.isArray(measures.evidence) || !Array.isArray(measures.sourcePins)) invalid();
    if (!measures.sourcePins.some((pin: Data) => pin.sha256 === CATALOG)) invalid();
    const cup = measures.measureFacts.find((fact: Data) => fact.id === "usda-named-68a5e15329ef76b91539ca28");
    if (!cup || cup.ingredientId !== INGREDIENT || cup.preparedState !== STATE || cup.baseUnit !== "g" || cup.fromUnit !== "cup" || cup.sourceSha256 !== CUP || hash(cup.factor) !== hash({ numerator: "245", denominator: "1" })) invalid();
    const form = { id: INGREDIENT, name: "2% milk", state: STATE, unit: "g" }, formDigest = hash(form);
    const current = (prices.results as Data[]).filter(row => row.report_year === 2026);
    if (current.length !== 31 || current.some(row => row.report_month !== "Sep" || row.slug_id !== "3356" || row.published_date !== "09/24/2026 10:31:00" || row.oct !== null)) invalid();
    const groups = new Map<Region, { cityState: string; cents: number }[]>(REGIONS.map(region => [region, []]));
    const seen = new Set<string>(); let aggregates = 0;
    for (const row of current) {
      if (row.CityState === "Simple Average, ") { aggregates++; continue; }
      const city = text(row.CityState), region = CITIES[city];
      if (!region || seen.has(city) || typeof row.sep !== "string" || !/^[1-9]\d*\.\d{2}$/.test(row.sep)) invalid();
      seen.add(city); const cents = Number(row.sep.replace(".", "")); if (!Number.isSafeInteger(cents)) invalid(); groups.get(region)!.push({ cityState: city, cents });
    }
    if (aggregates !== 1 || seen.size !== 30) invalid();
    const regional = REGIONS.map(region => {
      const cities = groups.get(region)!.sort((a, b) => a.cityState.localeCompare(b.cityState));
      const sum = cities.reduce((total, city) => total + BigInt(city.cents), BigInt(0));
      return { region, sampleCities: cities.length, cities, meanCentsPerGallon: receipt(rational(sum, BigInt(cities.length))), observedCityRangeCentsPerGallon: { min: Math.min(...cities.map(city => city.cents)), max: Math.max(...cities.map(city => city.cents)) } };
    });
    const candidate = freeze({ version: "wd-reviewed-milk-pack-candidate-v1", ingredientId: INGREDIENT, preparedState: STATE, baseUnit: "g", formDigest, catalogSha256: CATALOG, observationPeriod: "2026-09", publishedOn: "2026-09-24", capturedAsOf: "2026-10-19", sourcePins: { ...MILK_EVIDENCE_PINS }, packageReference: { purchaseUnit: "US gallon", cupsPerGallon: "16", gramsPerNamedCup: "245", conditionalGramsPerGallon: receipt(rational(BigInt(16) * BigInt(245))), namedCupSourceSha256: CUP }, regional, flags: [...FLAGS], completeRegistryEstablished: false, priceFreshnessEstablished: false, mealYieldEstablished: false, pantryPackageQuantityEstablished: false });
    const candidateSha256 = hash(candidate);
    const configured = record(copyReferenceData(trustedConfiguration), ["purchaseBinding", "freshnessReview"]);
    let binding: { skuId: string } | null = null, review: Freshness | null = null;
    if (configured.purchaseBinding !== null) {
      const value = record(configured.purchaseBinding, ["skuId", "ingredientId", "preparedState", "formDigest", "baseUnit", "candidateSha256"]);
      if (value.ingredientId !== INGREDIENT || value.preparedState !== STATE || value.formDigest !== formDigest || value.baseUnit !== "g" || value.candidateSha256 !== candidateSha256) invalid();
      binding = { skuId: text(value.skuId) };
    }
    if (configured.freshnessReview !== null) {
      const value = record(configured.freshnessReview, ["id", "sourceSha256", "candidateSha256", "observationPeriod", "effectiveFrom", "usableThrough", "priceBand"]);
      const from = date(value.effectiveFrom), through = date(value.usableThrough);
      if (value.candidateSha256 !== candidateSha256 || value.observationPeriod !== candidate.observationPeriod || value.priceBand !== "observed-city-envelope" || from < candidate.publishedOn || from > through) invalid();
      review = { id: text(value.id), sourceSha256: sha(value.sourceSha256), candidateSha256, observationPeriod: candidate.observationPeriod, effectiveFrom: from, usableThrough: through, priceBand: value.priceBand };
    }
    const boundSku = binding?.skuId ?? null, freshness = review ? freeze(review) : null;
    return Object.freeze({ outcome: "ready" as const, candidate, candidateSha256, forPlanning(queryValue: unknown): MilkPlanningOutcome {
      try {
        const query = record(copyReferenceData(queryValue), ["asOfDate"]), asOf = date(query.asOfDate);
        if (!boundSku) return { outcome: "held", code: "milk_purchase_binding_review_needed", regionalPackFacts: [] };
        if (!freshness) return { outcome: "held", code: "milk_price_freshness_review_needed", regionalPackFacts: [] };
        if (asOf < freshness.effectiveFrom || asOf > freshness.usableThrough || asOf > candidate.capturedAsOf) return { outcome: "held", code: "milk_price_outside_reviewed_window", regionalPackFacts: [] };
        const sourceSha256 = hash({ candidateSha256, freshnessReview: freshness, skuId: boundSku });
        // The existing source proof binds SKU/candidate/review. Frame that proof
        // with the region so independent accepted bindings compose uniquely.
        const facts: RegionalPackFact[] = regional.map(row => ({ id: "wd-rmp-price-v1:" + hash(["wd-reviewed-milk-pack-price-id-v1", sourceSha256, row.region]), skuId: boundSku, unit: "g", formDigest, region: row.region, packQuantity: { ...candidate.packageReference.conditionalGramsPerGallon }, packPriceCents: { ...row.observedCityRangeCentsPerGallon }, currency: "USD", observedOn: null, monthlyPriceBasis: { observationPeriod: candidate.observationPeriod, publishedOn: candidate.publishedOn, reviewEffectiveFrom: freshness.effectiveFrom }, usableThrough: freshness.usableThrough, sourceSha256, basis: "modeled-regional-average", flags: [...FLAGS, "freshness-review:" + freshness.id, "candidate-sha256:" + candidateSha256] }));
        return freeze({ outcome: "prepared", regionalPackFacts: facts, candidateSha256, freshnessReview: freshness, sourceAdoptionGranted: false, mealYieldEstablished: false, pantryPackageQuantityEstablished: false });
      } catch { return { outcome: "error", code: "invalid_milk_planning_query" }; }
    } });
  } catch { return { outcome: "error", code: "invalid_milk_evidence_or_review" } as const; }
}
