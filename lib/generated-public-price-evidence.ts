import { createHash } from "node:crypto";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson, REFERENCE_BODY_LIMIT } from "./generated-plan-json.ts";
import { decimal, multiply, divide, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";

export const CURRENT_PUBLIC_PRICE_PINS = Object.freeze({ staples: Object.freeze({ sha256: "fa53f0df7e8c7eb809b344443d87f19aa55fbb17e6ab587bb7999978665df662", observations: 333 }), produce: Object.freeze({ sha256: "0f3437ae8ae880a5d79910beb5b001455ccba8966ac3c1071c4deeb2dc131579", observations: 77 }) });
type Data = Record<string, unknown>;
type Observation = { seriesId: string; region: string; product: string; period: string; unit: string; unitAmount: string; value: string | null; hold: string | null; snapshotAsOf: string; snapshotSha256: string; sourceHashes: Readonly<Record<string, string>> };
const REGIONS: Readonly<Record<string, string>> = { "0000": "U.S. city average", "0100": "Northeast", "0200": "Midwest", "0300": "South", "0400": "West" };
const FACTORS: Readonly<Record<string, { dimension: string; factor: string }>> = { g: { dimension: "g", factor: "1" }, kg: { dimension: "g", factor: "1000" }, lb: { dimension: "g", factor: "453.59237" }, oz: { dimension: "g", factor: "28.349523125" }, ml: { dimension: "ml", factor: "1" }, liter: { dimension: "ml", factor: "1000" }, gallon: { dimension: "ml", factor: "3785.411784" }, count: { dimension: "each", factor: "1" }, dozen: { dimension: "each", factor: "12" } };
const typed = Object.getPrototypeOf(Uint8Array.prototype), buffer = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!, offset = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!, length = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
function invalid(): never { throw new Error("Invalid public price evidence"); }
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): Data { if (!value || typeof value !== "object" || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) invalid(); return value as Data; }
function object(value: unknown): Data { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(); return value as Data; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 1000) invalid(); return value; }
function sha(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) invalid(); return result; }
function month(value: unknown): string { const result = text(value); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(result)) invalid(); return result; }
function date(value: unknown): string { const result = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(result) || Number.isNaN(Date.parse(result + "T00:00:00Z")) || new Date(result + "T00:00:00Z").toISOString().slice(0, 10) !== result) invalid(); return result; }
function list(value: unknown, maximum: number): unknown[] { if (!Array.isArray(value) || value.length > maximum) invalid(); return value; }
function positive(value: unknown): string { const result = text(value), parsed = decimal(result); if (parsed.n === BigInt(0)) invalid(); return result; }
function exact(value: unknown): Rational { const fields = record(value, ["numerator", "denominator"]); for (const key of ["numerator", "denominator"]) if (typeof fields[key] !== "string" || !/^(0|[1-9]\d*)$/.test(fields[key]) || fields[key].length > 240) invalid(); return rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string)); }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function bytes(value: unknown): Uint8Array { const size = length.call(value) as number; if (size > REFERENCE_BODY_LIMIT) invalid(); return new Uint8Array(new Uint8Array(buffer.call(value), offset.call(value), size)); }

// Pinned, offline, source-series benchmark reader. Not an ingredient matcher,
// pack registry or price provider. No HTTP, files, source changes or fallback.
export function createPublicAveragePriceReader(staples: unknown, produce: unknown, trustedPins: unknown = CURRENT_PUBLIC_PRICE_PINS) {
  const index = new Map<string, Observation[]>(), snapshotPins: { role: string; sha256: string; observations: number }[] = [];
  try {
    const pins = record(copyReferenceData(trustedPins), ["staples", "produce"]);
    for (const [role, source] of [["staples", staples], ["produce", produce]] as const) {
      const pin = record(pins[role], ["sha256", "observations"]), expected = sha(pin.sha256), raw = bytes(source);
      if (!Number.isSafeInteger(pin.observations) || (pin.observations as number) < 0 || (pin.observations as number) > 10000 || createHash("sha256").update(raw).digest("hex") !== expected) invalid();
      const data = object(parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(raw)));
      if (data.schema !== "wisedinner-bls-average-price-v1" || data.source_kind !== "bls-average-retail-price" || data.currency !== "USD" || !["partial-observations", "held-no-observations"].includes(String(data.status))) invalid();
      const snapshotAsOf = date(data.as_of), rows = list(data.observations, 10000), sources = new Map<string, string>(); if (rows.length !== pin.observations) invalid();
      for (const value of list(data.sources, 20000)) { const row = object(value), id = text(row.id); if (sources.has(id)) invalid(); sources.set(id, sha(row.sha256)); }
      const localKeys = new Set<string>();
      for (const value of rows) {
        const row = object(value), seriesId = text(row.series_id), match = /^APU(0000|0100|0200|0300|0400)([A-Z0-9]{6})$/.exec(seriesId);
        if (!match || row.area_code !== match[1] || row.region !== REGIONS[match[1]!] || row.item_code !== match[2] || row.currency !== "USD" || row.source_kind !== "bls-average-retail-price") invalid();
        const period = month(row.period), key = seriesId + ":" + period, unit = text(row.unit), unitAmount = positive(row.unit_amount);
        if (localKeys.has(key) || !Object.hasOwn(FACTORS, unit)) invalid(); localKeys.add(key);
        const price = row.value === null ? null : positive(row.value), hold = Object.hasOwn(row, "hold") ? text(row.hold) : null, sourceHashes: Record<string, string> = {};
        for (const sourceId of list(row.source_ids, 100).map(text)) { const sealed = sources.get(sourceId); if (!sealed || Object.hasOwn(sourceHashes, sourceId)) invalid(); sourceHashes[sourceId] = sealed; }
        if (!Object.keys(sourceHashes).length) invalid();
        const observation: Observation = { seriesId, region: row.region as string, product: text(row.product), period, unit, unitAmount, value: price, hold, snapshotAsOf, snapshotSha256: expected, sourceHashes };
        const existing = index.get(seriesId) ?? [];
        if (existing.some(other => other.period === period && JSON.stringify([other.region, other.product, other.unit, other.unitAmount, other.value, other.hold]) !== JSON.stringify([observation.region, observation.product, observation.unit, observation.unitAmount, observation.value, observation.hold]))) invalid();
        existing.push(observation); index.set(seriesId, existing);
      }
      snapshotPins.push({ role, sha256: expected, observations: rows.length });
    }
    for (const values of index.values()) values.sort((a, b) => b.period.localeCompare(a.period) || a.snapshotSha256.localeCompare(b.snapshotSha256));
  } catch { return { outcome: "error", code: "invalid_public_price_evidence" } as const; }
  const summary = freeze({ snapshotPins, observedSeries: index.size, observations: snapshotPins.reduce((n, pin) => n + pin.observations, 0), ingredientMatchingEstablished: false, wholePackCheckoutSupported: false, regionalCompletenessEstablished: false });
  return Object.freeze({ outcome: "ready", summary, benchmark(input: unknown) {
    try {
      const query = record(copyReferenceData(input), ["seriesId", "region", "product", "quantity", "unit", "minimumPeriod", "asOfDate"], ["period"]), id = text(query.seriesId), region = text(query.region), product = text(query.product), quantity = exact(query.quantity), unit = text(query.unit), minimum = month(query.minimumPeriod), asOf = date(query.asOfDate);
      if (!/^APU(0000|0100|0200|0300|0400)[A-Z0-9]{6}$/.test(id) || !Object.values(REGIONS).includes(region) || !["g", "ml", "each"].includes(unit) || minimum > asOf.slice(0, 7)) invalid();
      const period = Object.hasOwn(query, "period") ? month(query.period) : null, all = index.get(id), records = period ? all?.filter(row => row.period === period) : all;
      if (!records?.length) return { outcome: "held", code: "published_series_observation_missing" } as const;
      const row = records[0]!;
      if (row.region !== region || row.product !== product) return { outcome: "error", code: "published_series_identity_mismatch" } as const;
      // Latest missing/held/future observation is not replaced by an older one.
      if (row.value === null || row.hold) return { outcome: "held", code: "published_observation_unusable" } as const;
      if (row.period < minimum || row.period > asOf.slice(0, 7) || row.period > row.snapshotAsOf.slice(0, 7)) return { outcome: "held", code: "published_observation_outside_date_window" } as const;
      const basis = FACTORS[row.unit]!;
      if (basis.dimension !== unit) return { outcome: "held", code: "food_mass_volume_or_count_evidence_required" } as const;
      const cost = divide(multiply(quantity, decimal(row.value)), multiply(decimal(basis.factor), decimal(row.unitAmount)));
      if (String(cost.n).length > 480 || String(cost.d).length > 480) return { outcome: "held", code: "public_price_quantity_capacity" } as const;
      return freeze({ outcome: "benchmark" as const, seriesId: id, region, product, period: row.period, quantity: receipt(quantity), quantityUnit: unit, priceValueUsd: row.value, priceUnit: row.unit, priceUnitAmount: row.unitAmount, allocationUsd: receipt(cost), snapshotSha256: row.snapshotSha256, sourceHashes: row.sourceHashes, sourceCapturedAsOf: row.snapshotAsOf, wholePackCheckoutSupported: false as const, ingredientMatchingEstablished: false as const, productAccepted: false as const, historicalAvailabilityAtRequestDateVerified: false as const, flags: ["public-series-average-not-a-store-quote", "food-form-match-and-purchase-pack-not-established", "no-new-statistical-or-model-error-bound", "sales-tax-and-checkout-charges-not-included"] });
    } catch { return { outcome: "error", code: "invalid_public_price_query" } as const; }
  } });
}
