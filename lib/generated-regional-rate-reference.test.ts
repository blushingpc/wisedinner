import test from "node:test";
import assert from "node:assert/strict";
import { quoteRegionalRateEstimates as quote, readRateReferenceConfiguration } from "./generated-regional-quote.ts";
import { RATE_FORMS, RATE_REFERENCE_POLICY, type RateQuote } from "./generated-regional-rate-reference.ts";

const form = Object.keys(RATE_FORMS)[1]!;
const a = (n: number | string, d: number | string = 1) => ({ numerator: String(n), denominator: String(d) });
const fact = (changes = {}) => ({ id: "synthetic-not-market-evidence", formId: form, skuId: `wd-meal-form-v1-${form.slice(0, 24)}`, ingredientId: "bell-pepper", purchaseState: "synthetic whole green raw", productName: "Synthetic pepper", sourceUrl: "https://example.test/pepper", sourceSha256: "b".repeat(64), country: "US", currency: "USD", scope: "retailer-listing-reference-not-regional", retailerId: "fixture", capturedOn: "2026-11-01", observedOn: null, publishedOn: null, sourceContext: "Synthetic test only; not source approval", referenceAmount: a(1), referenceUnit: "lb", priceCents: { min: 339, max: 339 }, ...changes });
const demand = (changes = {}) => ({ consumer: RATE_REFERENCE_POLICY, country: "US", currency: "USD", planningDate: "2026-11-01", formId: form, skuId: `wd-meal-form-v1-${form.slice(0, 24)}`, purchaseState: "synthetic whole green raw", quantityBasis: "Synthetic already-purchased weight, not inferred preparation yield", quantitySourceSha256: "c".repeat(64), purchasedDemand: { unit: "g", min: a(150), max: a(200) }, ...changes });
const config = (facts = [fact()]) => ({ policy: RATE_REFERENCE_POLICY, valuation: "dated-documentary", facts });
function quoted(r: RateQuote) { assert.equal(r.outcome, "quoted"); if (r.outcome !== "quoted") throw new Error("Quote required"); return r; }

test("actual maintained export encloses fractional purchased weight without a physical pack", () => {
  const r = quoted(quote(demand(), config()));
  assert.deepEqual(r.estimatedLineCents, { min: 112, max: 150 });
  assert.equal(r.kind, "variable-weight-reference");
  for (const k of ["packCount", "packQuantity", "purchasedLeftover"]) assert.equal(Object.hasOwn(r, k), false);
  assert.equal(r.source.capturedOn, "2026-11-01"); assert.equal(r.source.observedOn, null);
  assert.equal(r.liveRetailerPricing, false); assert.equal(r.checkoutChargesIncluded, false); assert.equal(r.adoptionGranted, false);
  assert.equal(r.quantitySourceSha256, demand().quantitySourceSha256);
});

test("exact pound identity, scaled rates and zero demand", () => {
  const lb = { unit: "lb", min: a(1), max: a(1) };
  const g = { unit: "g", min: a(45359237, 100000), max: a(45359237, 100000) };
  assert.deepEqual(quoted(quote(demand({ purchasedDemand: lb }), config())).estimatedLineCents, { min: 339, max: 339 });
  assert.deepEqual(quoted(quote(demand({ purchasedDemand: lb }), config())).estimatedLineCents, quoted(quote(demand({ purchasedDemand: g }), config())).estimatedLineCents);
  assert.deepEqual(quoted(quote(demand(), config([fact({ referenceAmount: a(2), priceCents: { min: 678, max: 678 } })]))).estimatedLineCents, quoted(quote(demand(), config())).estimatedLineCents);
  assert.deepEqual(quoted(quote(demand({ purchasedDemand: { unit: "g", min: a(0), max: a(0) } }), config())).estimatedLineCents, { min: 0, max: 0 });
});

test("generated numeric domain: independent enclosure inequalities, monotonicity and equivalent units", () => {
  // Direct valid domain, no filters or skipped cases. No new PBT dependency.
  // Inequalities check tight enclosure rather than reproducing division/rounding.
  let cases = 0;
  for (const cents of [1, 99, 339, 2599, 100000]) for (const denominator of [1, 3, 17]) {
    let prior = -1;
    for (const n of [0, 1, 2, 3, 10, 100, 10000, 1000000]) {
      const q = { unit: "g", min: a(n, denominator), max: a(n + 1, denominator) };
      const r = quoted(quote(demand({ purchasedDemand: q }), config([fact({ priceCents: { min: cents, max: cents } })])));
      const scale = BigInt(denominator) * BigInt(45359237);
      const low = BigInt(n) * BigInt(cents) * BigInt(100000), high = BigInt(n + 1) * BigInt(cents) * BigInt(100000);
      const floor = BigInt(r.estimatedLineCents.min), ceil = BigInt(r.estimatedLineCents.max);
      assert.ok(floor * scale <= low && (floor + BigInt(1)) * scale > low);
      assert.ok(ceil * scale >= high && (ceil - BigInt(1)) * scale < high);
      assert.ok(r.estimatedLineCents.min >= prior); prior = r.estimatedLineCents.min;
      const equivalent = { unit: "lb", min: a(BigInt(n).toString() + "00000", (BigInt(denominator) * BigInt(45359237)).toString()), max: a((BigInt(n + 1) * BigInt(100000)).toString(), (BigInt(denominator) * BigInt(45359237)).toString()) };
      assert.deepEqual(quoted(quote(demand({ purchasedDemand: equivalent }), config([fact({ priceCents: { min: cents, max: cents } })]))).estimatedLineCents, r.estimatedLineCents);
      cases++;
    }
  }
  assert.equal(cases, 120);
});

test("all six exact forms can be priced only with matching explicitly supplied synthetic source state", () => {
  for (const [formId, ingredientId] of Object.entries(RATE_FORMS)) {
    const skuId = `wd-meal-form-v1-${formId.slice(0, 24)}`;
    quoted(quote(demand({ formId, skuId }), config([fact({ formId, skuId, ingredientId })])));
    assert.deepEqual(quote(demand({ formId, skuId, purchaseState: "different preparation" }), config([fact({ formId, skuId, ingredientId })])), { outcome: "held", code: "rate_source_needed" });
  }
});

test("increasing rate and widening demand never decreases the upper estimate", () => {
  let prior = -1;
  for (const cents of [1, 2, 50, 339, 999, 2599]) {
    const exact = quoted(quote(demand(), config([fact({ priceCents: { min: cents, max: cents } })])));
    const wider = quoted(quote(demand({ purchasedDemand: { unit: "g", min: a(100), max: a(300) } }), config([fact({ priceCents: { min: cents, max: cents } })])));
    assert.ok(exact.estimatedLineCents.max >= prior); prior = exact.estimatedLineCents.max;
    assert.ok(wider.estimatedLineCents.min <= exact.estimatedLineCents.min);
    assert.ok(wider.estimatedLineCents.max >= exact.estimatedLineCents.max);
  }
});

test("missing, ambiguous, future, unsupported consumer and live valuation remain closed", () => {
  assert.deepEqual(quote(demand(), config([])), { outcome: "held", code: "rate_source_needed" });
  assert.deepEqual(quote(demand(), config([fact(), fact({ id: "second" })])), { outcome: "held", code: "rate_source_ambiguous" });
  assert.deepEqual(quote(demand({ planningDate: "2026-10-31" }), config()), { outcome: "held", code: "rate_source_future" });
  assert.deepEqual(quote(demand({ consumer: "physical-pack-v1" }), config()), { outcome: "held", code: "unsupported_rate_consumer" });
  assert.equal(quote(demand(), { ...config(), valuation: "live" }).outcome, "error");
  const dated = quoted(quote(demand({ planningDate: "2027-01-01" }), config()));
  assert.equal(dated.source.capturedOn, "2026-11-01"); assert.equal(dated.valuation, "dated-documentary");
});

test("malformed unit/currency/geography/quantity/state/source/date and unknown fields reject", () => {
  for (const changes of [{ country: "CA" }, { currency: "CAD" }, { formId: "a".repeat(64) }, { skuId: "other" }, { planningDate: "2026-02-30" }, { quantitySourceSha256: "no" }, { purchaseState: "" }, { extra: true }, { purchasedDemand: { unit: "each", min: a(1), max: a(2) } }, { purchasedDemand: { unit: "g", min: a(3), max: a(2) } }, { purchasedDemand: { unit: "g", min: a(-1), max: a(2) } }, { purchasedDemand: { unit: "g", min: a(1, 0), max: a(2) } }]) assert.equal(quote(demand(changes), config()).outcome, "error");
  for (const changes of [{ currency: "CAD" }, { country: "CA" }, { referenceUnit: "oz" }, { referenceAmount: a(0) }, { sourceUrl: "https://user:secret@example.test/" }, { sourceUrl: "https://example.test/?token=secret" }, { sourceUrl: "https://example.test/#secret" }, { capturedOn: "2026-02-30" }, { observedOn: "2026-11-01" }, { ingredientId: "red-bell-pepper" }, { sourceSha256: "no" }, { packCount: 1 }, { priceCents: { min: 4, max: 3 } }]) assert.equal(quote(demand(), config([fact(changes)])).outcome, "error");
});

test("accessors, inherited data, sparse registries and mutable inputs cannot change a quote", () => {
  let invoked = 0; const bad = { ...fact() }; Object.defineProperty(bad, "priceCents", { enumerable: true, get() { invoked++; throw new Error("getter"); } });
  assert.throws(() => readRateReferenceConfiguration(config([bad]))); assert.equal(invoked, 0);
  assert.equal(quote(Object.create(demand()), config()).outcome, "error");
  assert.throws(() => readRateReferenceConfiguration(config(new Array(1))));
  const f = fact(), c = config([f]), d = demand(), parsed = readRateReferenceConfiguration(c), r = quoted(quote(d, parsed));
  f.priceCents.min = 999; d.purchasedDemand.min.numerator = "999";
  assert.equal(r.source.priceCents.min, 339); assert.equal(r.purchasedWeight.min.numerator, "150");
  assert.ok(Object.isFrozen(r.source.priceCents)); assert.ok(Object.isFrozen(parsed.facts));
});

test("unsafe cent totals and excessively long rationals reject rather than round or overflow", () => {
  assert.equal(quote(demand({ purchasedDemand: { unit: "lb", min: a(Number.MAX_SAFE_INTEGER), max: a(Number.MAX_SAFE_INTEGER) } }), config()).outcome, "error");
  assert.equal(quote(demand({ purchasedDemand: { unit: "g", min: a("1".repeat(81)), max: a("1".repeat(81)) } }), config()).outcome, "error");
});
