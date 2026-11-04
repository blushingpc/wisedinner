import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { quoteRegionalEstimates, quoteRegionalEstimatesV2, readReferencePriceConfigurationV2, type RegionalQuoteOutcomeV2 } from "./generated-regional-quote.ts";

const amount = (n: number | string, d: number | string = 1) => ({ numerator: String(n), denominator: String(d) });
const request = { region: "South", storeIds: ["synthetic-store-b", "synthetic-store-a"], budgetCents: 1000, asOfDate: "2026-10-23" };
const need = { skuId: "synthetic-food", category: "pantry", unit: "g", formDigest: "a".repeat(64), perishable: false, purchasedNeed: { numerator: 750, denominator: 1 } };
const stock = { skuId: need.skuId, unit: need.unit, formDigest: need.formDigest, quantity: { numerator: 100, denominator: 1 } };
const regional = (changes = {}) => ({ id: "synthetic-regional", skuId: need.skuId, unit: "g", formDigest: need.formDigest, region: "South", packQuantity: amount(500), packPriceCents: { min: 200, max: 300 }, currency: "USD", observedOn: "2026-10-01", usableThrough: "2026-10-31", sourceSha256: "b".repeat(64), basis: "synthetic-test-only", flags: ["synthetic-test-only"], ...changes });
const ordinary = (changes = {}) => ({ id: "synthetic-manufacturer", skuId: need.skuId, unit: "g", formDigest: need.formDigest, packQuantity: amount(500), packPriceCents: { min: 210, max: 310 }, currency: "USD", sourceSha256: "c".repeat(64), sourceUrl: "https://example.invalid/synthetic", kind: "manufacturer-reference", sourceBasis: { geography: "manufacturer-reference-not-regional", manufacturer: "Synthetic only", capturedOn: "2026-10-23", observedOn: null, publishedOn: null }, reviewEffectiveFrom: "2026-10-23", usableThrough: "2026-10-23", flags: ["synthetic-test-only"], ...changes });
function canonical(v: unknown): unknown { return Array.isArray(v) ? v.map(canonical) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, canonical((v as Record<string, unknown>)[k])])) : v; }
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(canonical(v))).digest("hex");
function retailer(changes: Record<string, unknown> = {}) {
  const body = { skuId: need.skuId, unit: "g", formDigest: need.formDigest, packQuantity: amount(100), packPriceCents: { min: 120, max: 130 }, currency: "USD", kind: "retailer-reference", sourceSha256: "d".repeat(64), sourceUrl: "https://example.invalid/retailer", sourceBasis: { geography: "retailer-reference-not-regional", retailerId: "synthetic-retailer", productId: "synthetic-product", offerContext: { channel: "online-public", geographyDescription: "Synthetic public listing only", storeId: null, fulfilment: null }, capturedOn: "2026-10-23", observedOn: null, publishedOn: null }, reviewEffectiveFrom: "2026-10-23", usableThrough: "2026-10-23", flags: ["synthetic-test-only"], ...changes };
  return { id: "rr1:" + hash(["wd-retailer-reference-fact-v1", body]), ...body };
}
const config = (facts: unknown[]) => ({ policy: "wd-price-reference-fallback-v2", facts });
function quoted(result: RegionalQuoteOutcomeV2) { assert.equal(result.outcome, "quoted"); if (result.outcome !== "quoted") throw Error("Expected quote"); return result; }

test("V2 retailer fallback uses the same whole-pack stock/cents engine and preserves provenance without regional claims", () => {
  const fact = retailer(), result = quoted(quoteRegionalEstimatesV2(request, [need], [stock], [], config([fact])));
  const row = result.rows[0]!;
  assert.deepEqual(row.ownedUsed, amount(100)); assert.deepEqual(row.toBuy, amount(650));
  assert.equal(row.packCount, 7); assert.deepEqual(row.purchasedQuantity, amount(700)); assert.deepEqual(row.purchasedLeftover, amount(50));
  assert.deepEqual(result.estimatedTotalCents, { min: 840, max: 910 }); assert.deepEqual(result.budgetRemainingCents, { min: 90, max: 160 });
  assert.equal(result.scope, "mixed-geography-reference-typical-whole-pack-ingredient-estimate");
  assert.equal(result.referenceEstimates?.policy, "wd-price-reference-fallback-v2");
  assert.equal(result.referenceEstimates?.sources[0]?.kind, "retailer-reference");
  assert.deepEqual(result.referenceEstimates?.sources[0]?.sourceBasis, fact.sourceBasis);
  assert.equal(result.factPins[0]?.factSha256, hash(fact)); assert.equal(result.factPins[0]?.basis, "retailer-reference");
  assert.deepEqual(result.storeIds, request.storeIds); assert.equal(result.liveRetailerPricing, false); assert.equal(result.adoptionGranted, false);
});

test("unique current regional then ordinary reference outrank cheaper retailer; expired upper tiers permit retailer", () => {
  const cheap = retailer({ packPriceCents: { min: 1, max: 1 } }), refs = config([ordinary(), cheap]);
  const first = quoted(quoteRegionalEstimatesV2(request, [need], [], [regional()], refs));
  assert.equal(first.rows[0]!.factId, "synthetic-regional"); assert.equal(first.referenceEstimates, undefined);
  const second = quoted(quoteRegionalEstimatesV2(request, [need], [], [], refs)); assert.equal(second.rows[0]!.factId, "synthetic-manufacturer");
  const expired = ordinary({ sourceBasis: { ...ordinary().sourceBasis, capturedOn: "2026-10-22" }, reviewEffectiveFrom: "2026-10-22", usableThrough: "2026-10-22" });
  const third = quoted(quoteRegionalEstimatesV2(request, [need], [], [regional({ usableThrough: "2026-10-22" })], config([expired, cheap])));
  assert.equal(third.rows[0]!.factId, cheap.id);
});

test("upper-tier ambiguity holds rather than selecting a lower, cheaper or apparently current offer", () => {
  const refs = config([ordinary(), ordinary({ id: "another" }), retailer()]);
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], refs), { outcome: "held", code: "reference_pack_fact_ambiguous" });
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [regional(), regional({ id: "another", usableThrough: "2026-10-22" })], config([retailer()])), { outcome: "held", code: "regional_pack_fact_ambiguous" });
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], config([retailer(), retailer({ packPriceCents: { min: 1, max: 1 } })])), { outcome: "held", code: "reference_pack_fact_ambiguous" });
});

test("national and manufacturer are one shared upper tier, with original date precision and pin algorithm", () => {
  const national = ordinary({ id: "synthetic-national", kind: "national-reference", sourceBasis: { geography: "US-national", observationPeriod: "2026-09", observedOn: null, publishedOn: null, knownAvailableBy: "2026-10-14" } });
  const result = quoted(quoteRegionalEstimatesV2(request, [need], [], [], config([retailer(), national])));
  assert.equal(result.rows[0]!.factId, national.id); assert.equal(result.referenceEstimates?.sources[0]?.kind, "national-reference");
  assert.deepEqual(result.referenceEstimates?.sources[0]?.sourceBasis, national.sourceBasis);
  const old = quoteRegionalEstimates(request, [need], [], [], { policy: "wd-price-reference-fallback-v1", facts: [national] });
  assert.equal(old.outcome, "quoted"); if (old.outcome !== "quoted") throw Error("Expected existing national reference");
  assert.deepEqual(result.factPins, old.factPins); assert.deepEqual(result.rows, old.rows);
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], config([national, ordinary(), retailer()])), { outcome: "held", code: "reference_pack_fact_ambiguous" });
});

test("missing, expired, future, wrong unit/form retailer facts do not manufacture a total", () => {
  const expired = retailer({ sourceBasis: { ...retailer().sourceBasis, capturedOn: "2026-10-22" }, reviewEffectiveFrom: "2026-10-22", usableThrough: "2026-10-22" });
  const future = retailer({ sourceBasis: { ...retailer().sourceBasis, capturedOn: "2026-10-24" }, reviewEffectiveFrom: "2026-10-24", usableThrough: "2026-10-24" });
  for (const fact of [expired, future]) assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], config([fact])), { outcome: "held", code: "reference_pack_fact_not_current" });
  for (const facts of [[], [retailer({ unit: "ml" })], [retailer({ formDigest: "f".repeat(64) })]]) assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], config(facts)), { outcome: "held", code: "regional_pack_fact_needed" });
});

test("fully-owned food needs no selected price and unrelated pantry stock remains conserved", () => {
  const owned = { ...stock, quantity: { numerator: 800, denominator: 1 } }, other = { ...stock, skuId: "other" };
  const result = quoted(quoteRegionalEstimatesV2(request, [need], [owned, other], [], config([])));
  assert.deepEqual(result.estimatedTotalCents, { min: 0, max: 0 }); assert.equal(result.rows[0]!.factId, null); assert.equal(result.referenceEstimates, undefined);
  assert.deepEqual(result.rows[0]!.ownedRemaining, amount(50)); assert.deepEqual(result.ownedRemaining.find(s => s.skuId === "other")!.quantity, amount(100));
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [{ ...owned, unit: "ml" }], [], config([])), { outcome: "error", code: "incompatible_regional_pantry" });
});

test("V2 parser snapshots ordered facts; no caller mutation, getters, invalid policy or cross-tier duplicate identity", () => {
  const input = config([ordinary(), retailer()]), parsed = readReferencePriceConfigurationV2(input);
  assert.equal(parsed.policy, "wd-price-reference-fallback-v2"); assert.equal(Object.isFrozen(parsed.facts), true);
  assert.deepEqual(parsed.facts.map(f => f.id), input.facts.map(f => (f as { id: string }).id));
  (input.facts[0] as { packPriceCents: { max: number } }).packPriceCents.max = 999;
  assert.equal(parsed.facts[0]!.packPriceCents.max, 310);
  let reads = 0; const hostile = Object.defineProperty(retailer(), "sourceUrl", { enumerable: true, get() { reads++; return "https://example.invalid/x"; } });
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], config([hostile])), { outcome: "error", code: "invalid_regional_quote_input" }); assert.equal(reads, 0);
  const r = retailer();
  for (const bad of [config([r, r]), config([ordinary({ id: r.id }), r]), { policy: "wd-price-reference-fallback-v1", facts: [r] }]) assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], bad), { outcome: "error", code: "invalid_regional_quote_input" });
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [regional({ id: r.id })], config([r])), { outcome: "error", code: "invalid_regional_quote_input" });
});

test("fact body pack/money/date changes need a new rr1 pin; overflow remains held, never rounded", () => {
  const r = retailer();
  for (const bad of [{ ...r, packQuantity: amount(101) }, { ...r, packPriceCents: { min: 0, max: 1 } }, { ...r, sourceSha256: "f".repeat(64) }]) assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], config([bad])), { outcome: "error", code: "invalid_regional_quote_input" });
  assert.deepEqual(quoteRegionalEstimatesV2(request, [need], [], [], config([retailer({ packPriceCents: { min: Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } })])), { outcome: "held", code: "regional_quote_capacity_exceeded" });
});

test("V1 still rejects V2 policy and retailer kind; absent references retain exact regional-only output bytes", () => {
  const args = [request, [need], [stock], [regional()]] as const;
  assert.equal(JSON.stringify(quoteRegionalEstimatesV2(...args)), JSON.stringify(quoteRegionalEstimates(...args)));
  for (const policy of ["wd-price-reference-fallback-v1", "wd-price-reference-fallback-v2"]) assert.deepEqual(quoteRegionalEstimates(request, [need], [], [], { policy, facts: [retailer()] }), { outcome: "error", code: "invalid_regional_quote_input" });
});

test("one exact arithmetic path conserves thirds across a bounded retailer domain", () => {
  for (let n = 1; n <= 31; n++) for (let owned = 0; owned <= 11; owned++) {
    const result = quoted(quoteRegionalEstimatesV2(request, [{ ...need, purchasedNeed: { numerator: n, denominator: 3 } }], [{ ...stock, quantity: { numerator: owned, denominator: 3 } }], [], config([retailer({ packQuantity: amount(7, 3) })])));
    const row = result.rows[0]!, remaining = Math.max(0, n - owned), count = Math.ceil(remaining / 7);
    assert.equal(row.packCount, count); assert.deepEqual(row.estimatedLineCents, { min: count * 120, max: count * 130 });
    const scaled = (v: { numerator: string; denominator: string }) => {
      const numerator = BigInt(v.numerator) * BigInt(3), denominator = BigInt(v.denominator);
      assert.equal(numerator % denominator, BigInt(0), "Third-unit conservation must be exact, never truncated");
      return numerator / denominator;
    };
    assert.equal(scaled(row.ownedUsed) + scaled(row.toBuy), BigInt(n));
    assert.equal(scaled(row.purchasedQuantity) - scaled(row.purchasedLeftover), scaled(row.toBuy));
  }
});
