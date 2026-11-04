import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readRetailerReferenceConfiguration } from "./generated-retailer-reference.ts";

const POLICY = "wd-retailer-reference-source-v1";
const FACT_DOMAIN = "wd-retailer-reference-fact-v1";
const VALID_ID = "rr1:8c4fec628f6e96866a029fec54d0f8415982b7a0160df6f333174fbd3ffe2d90";
const SECOND_ID = "rr1:1295037eb44a4baeb6d1bb8a0b58605578de852b41e3a150cd58029533850b60";
const INVALID = { outcome: "error", code: "invalid_retailer_reference_configuration" } as const;

function fact() {
  return {
    id: VALID_ID,
    skuId: "fixture-food",
    unit: "g",
    formDigest: "a2909c3c84b270ecd60cd068263d636e1f2d271ecae75deb1c17ae504f92fed4",
    packQuantity: { numerator: "100", denominator: "1" },
    packPriceCents: { min: 120, max: 130 },
    currency: "USD",
    kind: "retailer-reference",
    sourceSha256: "09c7973783a08f43f54876a96ccf66505dac0f25e1e63c8360bfc9aaaa86615f",
    sourceUrl: "https://example.invalid/contract-fixture-food",
    sourceBasis: {
      geography: "retailer-reference-not-regional",
      retailerId: "fixture-retailer",
      productId: "fixture-product",
      offerContext: {
        channel: "online-public",
        geographyDescription: "synthetic US online reference only",
        storeId: null,
        fulfilment: null,
      },
      capturedOn: "2026-10-20",
      observedOn: null,
      publishedOn: null,
    },
    reviewEffectiveFrom: "2026-10-20",
    usableThrough: "2026-10-21",
    flags: ["synthetic-test-only"],
  };
}

function configuration(): { policy: string; facts: ReturnType<typeof fact>[] };
function configuration(facts: unknown[]): { policy: string; facts: unknown[] };
function configuration(facts: unknown[] = [fact()]) {
  return { policy: POLICY, facts };
}

function clone<T>(value: T): T {
  return structuredClone(value);
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return Object.fromEntries(Object.keys(record).sort().map(key => [key, canonical(record[key])]));
  }
  return value;
}

function independentId(value: Record<string, unknown>): string {
  const withoutId = { ...value };
  delete withoutId.id;
  const bytes = JSON.stringify(canonical([FACT_DOMAIN, withoutId]));
  return `rr1:${createHash("sha256").update(bytes, "utf8").digest("hex")}`;
}

function successFacts(value: unknown) {
  const parsed = readRetailerReferenceConfiguration(value);
  assert.equal("outcome" in parsed, false);
  if ("outcome" in parsed) throw new Error("Expected a retailer reference configuration");
  return parsed;
}

test("the four complete F02 parser vectors retain their exact input and output", () => {
  const valid = configuration();
  const validExpected = {
    policy: POLICY,
    facts: [fact()],
  };
  const tamperedId = configuration([{ ...fact(), id: `rr1:${"0".repeat(64)}` }]);
  const unknownCurrency = configuration([{ ...fact(), currency: null }]);
  const captureAfterReview = configuration([{
    ...fact(),
    sourceBasis: { ...fact().sourceBasis, capturedOn: "2026-10-21" },
  }]);

  const vectors = [
    { id: "retailer-complete-config", input: valid, expected: validExpected },
    { id: "retailer-id-tampered", input: tamperedId, expected: INVALID },
    { id: "retailer-currency-unverified", input: unknownCurrency, expected: INVALID },
    { id: "retailer-capture-after-review", input: captureAfterReview, expected: INVALID },
  ];
  for (const vector of vectors) assert.deepEqual(readRetailerReferenceConfiguration(vector.input), vector.expected, vector.id);

  assert.equal(independentId(fact()), VALID_ID);
  assert.equal(Object.keys(successFacts(valid)).sort().join(","), "facts,policy");
});

test("the reader returns only the frozen configuration or its exact error", () => {
  for (const value of [null, undefined, false, 1, "json", [], { policy: POLICY, facts: {} }, { policy: "wrong", facts: [] }]) {
    assert.deepEqual(readRetailerReferenceConfiguration(value), INVALID);
  }
  const parsed = successFacts(configuration());
  assert.equal(parsed.policy, POLICY);
  assert.equal(Object.isFrozen(parsed), true);
  assert.equal(Object.isFrozen(parsed.facts), true);
  assert.equal(Object.isFrozen(parsed.facts[0]), true);
  assert.equal(Object.isFrozen(parsed.facts[0]!.sourceBasis), true);
  assert.equal(Object.isFrozen(parsed.facts[0]!.sourceBasis.offerContext), true);
  assert.equal(Object.isFrozen(parsed.facts[0]!.packQuantity), true);
  assert.equal(Object.isFrozen(parsed.facts[0]!.packPriceCents), true);
  assert.equal(Object.isFrozen(parsed.facts[0]!.flags), true);
});

test("strict inert ingress rejects accessors without invoking them and rejects prototypes, symbols and extra keys", () => {
  let reads = 0;
  const accessor = configuration();
  Object.defineProperty(accessor.facts[0], "sourceUrl", {
    enumerable: true,
    configurable: true,
    get() { reads++; throw new Error("must not read an accessor"); },
  });
  assert.deepEqual(readRetailerReferenceConfiguration(accessor), INVALID);
  assert.equal(reads, 0);

  const toJson = configuration();
  Object.defineProperty(toJson.facts[0], "toJSON", {
    enumerable: true,
    value() { reads++; return {}; },
  });
  assert.deepEqual(readRetailerReferenceConfiguration(toJson), INVALID);
  assert.equal(reads, 0);

  const inherited = configuration();
  Object.setPrototypeOf(inherited.facts[0], { hidden: true });
  assert.deepEqual(readRetailerReferenceConfiguration(inherited), INVALID);

  const symbol = configuration();
  Object.defineProperty(symbol.facts[0], Symbol("hidden"), { value: 1, enumerable: true });
  assert.deepEqual(readRetailerReferenceConfiguration(symbol), INVALID);

  const nonEnumerable = configuration();
  Object.defineProperty(nonEnumerable.facts[0], "skuId", { value: "fixture-food", enumerable: false });
  assert.deepEqual(readRetailerReferenceConfiguration(nonEnumerable), INVALID);

  const extra = configuration();
  (extra.facts[0] as Record<string, unknown>).customerPrice = 120;
  assert.deepEqual(readRetailerReferenceConfiguration(extra), INVALID);
  assert.deepEqual(readRetailerReferenceConfiguration({ ...configuration(), debug: true }), INVALID);
});

test("array ingress rejects holes, symbols, extra properties, duplicate flags and duplicate or conflicting IDs", () => {
  const hole = configuration();
  delete hole.facts[0]!.flags[0];
  assert.deepEqual(readRetailerReferenceConfiguration(hole), INVALID);

  const arrayExtra = configuration();
  Object.defineProperty(arrayExtra.facts, "extra", { value: true, enumerable: true });
  assert.deepEqual(readRetailerReferenceConfiguration(arrayExtra), INVALID);

  const duplicateFlags = configuration([{ ...fact(), flags: ["synthetic-test-only", "synthetic-test-only"] }]);
  assert.deepEqual(readRetailerReferenceConfiguration(duplicateFlags), INVALID);

  const duplicateIds = configuration([fact(), fact()]);
  assert.deepEqual(readRetailerReferenceConfiguration(duplicateIds), INVALID);

  const conflictingId = configuration([fact(), { ...fact(), sourceUrl: "https://example.invalid/other" }]);
  assert.deepEqual(readRetailerReferenceConfiguration(conflictingId), INVALID);
});

test("all configured and inherited collection, depth and string bounds are enforced", () => {
  assert.deepEqual(readRetailerReferenceConfiguration(configuration(new Array(20001).fill(fact()))), INVALID);
  assert.deepEqual(readRetailerReferenceConfiguration(configuration([{ ...fact(), flags: Array.from({ length: 99 }, (_, i) => `flag-${i}`) }])), INVALID);
  assert.deepEqual(readRetailerReferenceConfiguration(configuration([{ ...fact(), skuId: "x".repeat(501) }])), INVALID);
  assert.deepEqual(readRetailerReferenceConfiguration(configuration([{ ...fact(), skuId: "x".repeat(10001) }])), INVALID);

  let nested: unknown = null;
  for (let i = 0; i < 18; i++) nested = { next: nested };
  assert.deepEqual(readRetailerReferenceConfiguration({ ...configuration(), extra: nested }), INVALID);
});

test("exact pack rationals normalize before hashing and retain exact cents", () => {
  const unreduced = { ...fact(), packQuantity: { numerator: "200", denominator: "2" } };
  const parsed = successFacts(configuration([unreduced]));
  assert.equal(parsed.facts[0]!.id, VALID_ID);
  assert.deepEqual(parsed.facts[0]!.packQuantity, { numerator: "100", denominator: "1" });
  assert.deepEqual(parsed.facts[0]!.packPriceCents, { min: 120, max: 130 });

  const longPositive = { ...fact(), packQuantity: { numerator: `1${"0".repeat(239)}`, denominator: "1" } };
  longPositive.id = independentId(longPositive);
  assert.equal(successFacts(configuration([longPositive])).facts[0]!.packQuantity.numerator.length, 240);

  const invalidAmounts = [
    { numerator: "0", denominator: "1" },
    { numerator: "-1", denominator: "1" },
    { numerator: "01", denominator: "1" },
    { numerator: "1e3", denominator: "1" },
    { numerator: "1", denominator: "0" },
    { numerator: "1", denominator: "01" },
    { numerator: "1", denominator: "2.0" },
    { numerator: `1${"0".repeat(240)}`, denominator: "1" },
  ];
  for (const packQuantity of invalidAmounts) {
    const bad = { ...fact(), packQuantity };
    bad.id = independentId(bad);
    assert.deepEqual(readRetailerReferenceConfiguration(configuration([bad])), INVALID);
  }

  for (const packPriceCents of [
    { min: 0, max: 1 },
    { min: 2, max: 1 },
    { min: 1.5, max: 2 },
    { min: 1, max: Number.MAX_SAFE_INTEGER + 1 },
    { min: 1, max: 2, extra: 3 },
  ]) {
    assert.deepEqual(readRetailerReferenceConfiguration(configuration([{ ...fact(), packPriceCents }])), INVALID);
  }
});

test("units, currency, fact kind, form and source identities are explicit and exact", () => {
  for (const change of [
    { unit: "lb" },
    { currency: "CAD" },
    { kind: "national-reference" },
    { formDigest: "A".repeat(64) },
    { formDigest: "f".repeat(63) },
    { sourceSha256: "g".repeat(64) },
    { sourceSha256: "0".repeat(63) },
    { skuId: "   " },
    { sourceBasis: { ...fact().sourceBasis, retailerId: " " } },
    { sourceBasis: { ...fact().sourceBasis, productId: "" } },
    { sourceBasis: { ...fact().sourceBasis, geographyDescription: "\t" } },
  ]) {
    const bad = { ...fact(), ...change };
    bad.id = independentId(bad);
    assert.deepEqual(readRetailerReferenceConfiguration(configuration([bad])), INVALID);
  }

  for (const unit of ["g", "ml", "each"]) {
    const valid = { ...fact(), unit };
    valid.id = independentId(valid);
    assert.equal(successFacts(configuration([valid])).facts[0]!.unit, unit);
  }
});

test("source URLs require HTTPS without credentials, query or fragment and are not rewritten", () => {
  const acceptedUrl = "https://example.invalid/a%20path";
  const accepted = { ...fact(), sourceUrl: acceptedUrl };
  accepted.id = independentId(accepted);
  assert.equal(successFacts(configuration([accepted])).facts[0]!.sourceUrl, acceptedUrl);

  for (const sourceUrl of [
    "http://example.invalid/item",
    "https://user@example.invalid/item",
    "https://user:secret@example.invalid/item",
    "https://example.invalid/item?",
    "https://example.invalid/item?signature=synthetic",
    "https://example.invalid/item#",
    "https://example.invalid/item#section",
    "https://example.invalid/%zz",
    "https://example.invalid/white space",
    "https://",
    "/relative/path",
  ]) {
    const bad = { ...fact(), sourceUrl };
    bad.id = independentId(bad);
    assert.deepEqual(readRetailerReferenceConfiguration(configuration([bad])), INVALID, sourceUrl);
  }
});

test("offer provenance preserves unknown fulfilment and enforces channel-store consistency", () => {
  const identifiedStore = {
    ...fact(),
    sourceBasis: {
      ...fact().sourceBasis,
      offerContext: {
        channel: "identified-store",
        geographyDescription: "synthetic named store reference",
        storeId: "fixture-store",
        fulfilment: null,
      },
    },
  };
  identifiedStore.id = independentId(identifiedStore);
  const parsedStore = successFacts(configuration([identifiedStore])).facts[0]!;
  assert.equal(parsedStore.sourceBasis.offerContext.storeId, "fixture-store");
  assert.equal(parsedStore.sourceBasis.offerContext.fulfilment, null);

  for (const offerContext of [
    { ...fact().sourceBasis.offerContext, channel: "online-public", storeId: "fixture-store" },
    { ...fact().sourceBasis.offerContext, channel: "identified-store", storeId: null },
    { ...fact().sourceBasis.offerContext, channel: "identified-store", storeId: " " },
    { ...fact().sourceBasis.offerContext, channel: "unknown", storeId: null },
    { ...fact().sourceBasis.offerContext, storeId: undefined },
  ]) {
    const bad = { ...fact(), sourceBasis: { ...fact().sourceBasis, offerContext } };
    bad.id = independentId(bad);
    assert.deepEqual(readRetailerReferenceConfiguration(configuration([bad])), INVALID);
  }
});

test("calendar dates are real and ordered without replacing observation evidence", () => {
  const leapDay = {
    ...fact(),
    sourceBasis: { ...fact().sourceBasis, capturedOn: "2024-02-29", observedOn: "2024-02-29" },
    reviewEffectiveFrom: "2024-02-29",
    usableThrough: "2024-03-01",
  };
  leapDay.id = independentId(leapDay);
  assert.equal(successFacts(configuration([leapDay])).facts[0]!.sourceBasis.observedOn, "2024-02-29");

  const olderObservation = {
    ...fact(),
    sourceBasis: { ...fact().sourceBasis, observedOn: "2026-10-19" },
  };
  olderObservation.id = independentId(olderObservation);
  const parsedOlderObservation = successFacts(configuration([olderObservation])).facts[0]!;
  assert.equal(parsedOlderObservation.sourceBasis.observedOn, "2026-10-19");

  const movedReview = {
    ...olderObservation,
    reviewEffectiveFrom: "2026-10-21",
    usableThrough: "2026-10-22",
  };
  movedReview.id = independentId(movedReview);
  assert.equal(successFacts(configuration([movedReview])).facts[0]!.sourceBasis.observedOn, "2026-10-19");

  const invalidDates = [
    { sourceBasis: { ...fact().sourceBasis, capturedOn: "2025-02-29" } },
    { sourceBasis: { ...fact().sourceBasis, capturedOn: "2026-10-21" } },
    { sourceBasis: { ...fact().sourceBasis, observedOn: "2026-10-21" } },
    { sourceBasis: { ...fact().sourceBasis, publishedOn: "2026-10-21" } },
    { reviewEffectiveFrom: "2026-10-22" },
    { usableThrough: "2026-10-19" },
    { reviewEffectiveFrom: "2026-2-1" },
  ];
  for (const change of invalidDates) {
    const bad = {
      ...fact(),
      ...change,
      sourceBasis: { ...fact().sourceBasis, ...(change as Record<string, unknown>).sourceBasis as object },
    };
    bad.id = independentId(bad);
    assert.deepEqual(readRetailerReferenceConfiguration(configuration([bad])), INVALID);
  }
});

test("expired but coherent facts remain parseable; the parser applies no clock or availability decision", () => {
  const expiredForQuote = fact();
  const parsed = successFacts(configuration([expiredForQuote]));
  assert.equal(parsed.facts[0]!.reviewEffectiveFrom, "2026-10-20");
  assert.equal(parsed.facts[0]!.usableThrough, "2026-10-21");
  assert.equal("outcome" in parsed, false);

  const unsupportedAvailability = { ...fact(), availability: "unavailable" };
  assert.deepEqual(readRetailerReferenceConfiguration(configuration([unsupportedAvailability])), INVALID);
});

test("canonical identity covers the normalized fact while preserving input row order", () => {
  const original = fact();
  const reordered = Object.fromEntries(Object.entries(original).reverse()) as typeof original;
  assert.equal(independentId(reordered), VALID_ID);
  assert.equal(successFacts(configuration([reordered])).facts[0]!.id, VALID_ID);

  const changedBasis = { ...fact(), sourceBasis: { ...fact().sourceBasis, retailerId: "other-retailer" } };
  assert.deepEqual(readRetailerReferenceConfiguration(configuration([changedBasis])), INVALID);

  const first = fact();
  const second = {
    ...fact(),
    id: SECOND_ID,
    sourceSha256: "280254636c368583c1c8445f8630ed8e689011cfdeaf942f7dfee8625ca28325",
    sourceUrl: "https://example.invalid/contract-fixture-food-2",
  };
  assert.equal(independentId(second), SECOND_ID);
  const parsed = successFacts(configuration([second, first]));
  assert.deepEqual(parsed.facts.map(row => row.id), [SECOND_ID, VALID_ID]);
  assert.deepEqual(parsed.facts.map(row => row.skuId), ["fixture-food", "fixture-food"]);
  assert.equal(parsed.facts.length, 2);
});

test("normalization returns an independent snapshot and never mutates the caller", () => {
  const input = configuration();
  const before = clone(input);
  const parsed = successFacts(input);
  assert.deepEqual(input, before);
  assert.notEqual(parsed, input);
  assert.notEqual(parsed.facts, input.facts);
  assert.notEqual(parsed.facts[0], input.facts[0]);
  assert.notEqual(parsed.facts[0]!.sourceBasis, input.facts[0]!.sourceBasis);

  (input.facts[0]!.flags as string[]).push("later-caller-mutation");
  (input.facts[0]!.packPriceCents as { min: number; max: number }).max = 999;
  assert.deepEqual(parsed.facts[0]!.flags, ["synthetic-test-only"]);
  assert.deepEqual(parsed.facts[0]!.packPriceCents, { min: 120, max: 130 });
});
