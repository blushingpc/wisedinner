import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createPublicAveragePriceReader } from "./generated-public-price-evidence.ts";
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex"), amount = (n: number | string, d = "1") => ({ numerator: String(n), denominator: d });
const row = (changes = {}) => ({ series_id: "APU0300701312", area_code: "0300", region: "South", item_code: "701312", product: "Rice, white, long grain, uncooked", period: "2026-09", unit: "lb", unit_amount: "1", value: "1.218", currency: "USD", source_kind: "bls-average-retail-price", source_ids: ["source-0001"], ...changes });
function fixture(rows = [row()], second: unknown[] = []) {
  const snapshot = (observations: unknown[]) => Buffer.from(JSON.stringify({ schema: "wisedinner-bls-average-price-v1", source_kind: "bls-average-retail-price", currency: "USD", as_of: "2026-10-14", status: "partial-observations", observations, sources: [{ id: "source-0001", sha256: "a".repeat(64) }] }));
  const staples = snapshot(rows), produce = snapshot(second), pins = { staples: { sha256: sha(staples), observations: rows.length }, produce: { sha256: sha(produce), observations: second.length } };
  return { staples, produce, pins, bind: () => createPublicAveragePriceReader(staples, produce, pins) };
}
function ready(rows = [row()]) { const value = fixture(rows).bind(); assert.equal(value.outcome, "ready"); if (value.outcome !== "ready") throw new Error("Expected source binding"); return value; }
const query = (changes = {}) => ({ seriesId: "APU0300701312", region: "South", product: "Rice, white, long grain, uncooked", quantity: amount("45359237", "100000"), unit: "g", minimumPeriod: "2026-09", asOfDate: "2026-10-18", ...changes });

test("exact published pound benchmark remains distinct from ingredients packs and checkout", () => {
  const result = ready().benchmark(query()); assert.equal(result.outcome, "benchmark"); if (result.outcome !== "benchmark") return;
  assert.deepEqual(result.allocationUsd, amount("609", "500")); assert.equal(result.priceValueUsd, "1.218"); assert.equal(result.period, "2026-09"); assert.equal(result.wholePackCheckoutSupported, false); assert.equal(result.ingredientMatchingEstablished, false); assert.equal(result.productAccepted, false); assert.ok(Object.isFrozen(result.sourceHashes));
});

test("exact quantity domain agrees with independent cross multiplication without line rounding", () => {
  const reader = ready(); for (let n = 0; n <= 40; n++) for (let d = 1; d <= 9; d++) {
    const result = reader.benchmark(query({ quantity: amount(n, String(d)) })); if (result.outcome !== "benchmark") throw new Error("Expected exact arithmetic");
    assert.equal(BigInt(result.allocationUsd.numerator) * BigInt(d) * BigInt(45359237) * BigInt(500), BigInt(n) * BigInt(609) * BigInt(100000) * BigInt(result.allocationUsd.denominator));
  }
});

test("volume and count price units convert only within their declared physical dimension", () => {
  const milk = ready([row({ series_id: "APU0300709112", item_code: "709112", product: "Milk, fresh, whole, fortified", unit: "gallon", value: "3.599" })]).benchmark(query({ seriesId: "APU0300709112", product: "Milk, fresh, whole, fortified", unit: "ml", quantity: amount("3785411784", "1000000") }));
  assert.equal(milk.outcome, "benchmark"); if (milk.outcome === "benchmark") assert.deepEqual(milk.allocationUsd, amount("3599", "1000"));
  const eggs = ready([row({ series_id: "APU0300708111", item_code: "708111", product: "Eggs, grade A, large", unit: "dozen", value: "4.950" })]);
  const count = eggs.benchmark(query({ seriesId: "APU0300708111", product: "Eggs, grade A, large", unit: "each", quantity: amount(12) })); if (count.outcome !== "benchmark") throw new Error("Expected dozen price"); assert.deepEqual(count.allocationUsd, amount("99", "20"));
  assert.deepEqual(eggs.benchmark(query({ seriesId: "APU0300708111", product: "Eggs, grade A, large", quantity: amount(600) })), { outcome: "held", code: "food_mass_volume_or_count_evidence_required" });
});

test("national or wrong-food series cannot stand in for a missing regional observation", () => {
  const reader = ready([row({ series_id: "APU0000701312", area_code: "0000", region: "U.S. city average" })]);
  assert.deepEqual(reader.benchmark(query()), { outcome: "held", code: "published_series_observation_missing" });
  assert.deepEqual(reader.benchmark(query({ seriesId: "APU0000701312" })), { outcome: "error", code: "published_series_identity_mismatch" });
  assert.deepEqual(ready().benchmark(query({ product: "brown rice" })), { outcome: "error", code: "published_series_identity_mismatch" });
});

test("latest held observation is not silently replaced with an older usable point", () => {
  const reader = ready([row({ period: "2026-08" }), row({ value: null, hold: "publication missing" })]);
  assert.deepEqual(reader.benchmark(query({ minimumPeriod: "2026-08" })), { outcome: "held", code: "published_observation_unusable" });
  assert.equal(reader.benchmark(query({ minimumPeriod: "2026-08", period: "2026-08" })).outcome, "benchmark");
});

test("explicit historical selection stale windows and future observations remain honest", () => {
  assert.deepEqual(ready().benchmark(query({ minimumPeriod: "2026-10" })), { outcome: "held", code: "published_observation_outside_date_window" });
  assert.deepEqual(ready().benchmark(query({ minimumPeriod: "2026-08", asOfDate: "2026-08-31" })), { outcome: "held", code: "published_observation_outside_date_window" });
  assert.equal(ready().benchmark(query({ asOfDate: "2026-02-30" })).outcome, "error");
  assert.equal(ready().benchmark(query({ minimumPeriod: "2026-13" })).outcome, "error");
});

test("tampered bytes wrong region metadata missing source hashes and duplicate observations refuse", () => {
  const f = fixture(); const tampered = Buffer.from(f.staples); tampered[1] ^= 1; assert.equal(createPublicAveragePriceReader(tampered, f.produce, f.pins).outcome, "error");
  for (const rows of [[row({ region: "West" })], [row({ source_ids: ["missing"] })], [row(), row()], [row({ unit_amount: "0" })], [row({ value: "-1" })]]) assert.equal(fixture(rows).bind().outcome, "error");
});

test("caller-owned pins queries and typed-array getters are not invoked or frozen", () => {
  let reads = 0; const f = fixture(), hostilePin = Object.defineProperty({ ...f.pins }, "staples", { enumerable: true, get() { reads++; return f.pins.staples; } });
  assert.equal(createPublicAveragePriceReader(f.staples, f.produce, hostilePin).outcome, "error");
  const hostileBytes = new Uint8Array(f.staples); Object.defineProperty(hostileBytes, "byteLength", { get() { reads++; throw new Error("Not read"); } });
  assert.equal(createPublicAveragePriceReader(hostileBytes, f.produce, f.pins).outcome, "ready"); assert.equal(Object.isFrozen(f.pins.staples), false);
  const hostileQuery = Object.defineProperty(query(), "quantity", { enumerable: true, get() { reads++; throw new Error("Not read"); } }); assert.equal(ready().benchmark(hostileQuery).outcome, "error"); assert.equal(reads, 0);
});

test("unsupported recipe volume conventions unknown fields and invalid quantities cannot become price evidence", () => {
  const reader = ready(); for (const value of [query({ unit: "cup" }), query({ quantity: amount("-1") }), query({ quantity: amount(1, "0") }), query({ packageSize: 500 }), query({ quantity: { numerator: 1, denominator: 1 } })]) assert.equal(reader.benchmark(value).outcome, "error");
});

const root = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake", staples = root + "/runtime/recipe-enrichment/shared-price-sources/bls-staples-56-20261014/snapshot.json", produce = root + "/runtime/meal-enrichment/prices-281a0723beb54fb7a67c2047593456e0/snapshot.json";
test("actual pinned public snapshots preserve410observations and September2026Southrice without source writes", { skip: ![staples, produce].every(existsSync) && "Pinned public source unavailable, not actual evidence" }, () => {
  const a = readFileSync(staples), b = readFileSync(produce), before = [sha(a), sha(b)], reader = createPublicAveragePriceReader(a, b);
  assert.equal(reader.outcome, "ready"); if (reader.outcome !== "ready") return;
  assert.equal(reader.summary.observations, 410); const result = reader.benchmark(query()); assert.equal(result.outcome, "benchmark"); if (result.outcome === "benchmark") { assert.equal(result.priceValueUsd, "1.218"); assert.deepEqual(result.allocationUsd, amount("609", "500")); assert.equal(result.sourceCapturedAsOf, "2026-10-14"); }
  assert.deepEqual([sha(readFileSync(staples)), sha(readFileSync(produce))], before);
});
