import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createReviewedMilkPackEvidence, MILK_EVIDENCE_PINS } from "./generated-milk-pack-evidence.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";

const JOB = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/backend-readiness-20261016-01/plan-review-20261018-01";
const FILES = { prices: JOB + "/public-price-candidates-20261019-01/usda-3356-reduced-fat.http-body", milkYieldPdf: JOB + "/public-price-candidates-20261019-01/usda-fbg-milk-yield-table.pdf", geography: JOB + "/public-price-candidates-20261019-01/census-regions-geography.html", namedMeasures: JOB + "/conditional-reference-measures-20261019-01.json" };
const available = Object.values(FILES).every(existsSync), options = { skip: !available && "Exact local reviewed cohort unavailable; not source evidence" };
const amount = (n: number, d = 1) => ({ numerator: String(n), denominator: String(d) });
function sources() { return Object.fromEntries(Object.entries(FILES).map(([key, file]) => [key, readFileSync(file)])); }
function ready(configuration?: unknown) { const reader = createReviewedMilkPackEvidence(sources(), configuration); assert.equal(reader.outcome, "ready"); if (reader.outcome !== "ready") throw Error("Source cohort must bind"); return reader; }
function configuration() {
  const reader = ready();
  return { purchaseBinding: { skuId: "test-milk-purchase", ingredientId: reader.candidate.ingredientId, preparedState: reader.candidate.preparedState, formDigest: reader.candidate.formDigest, baseUnit: "g", candidateSha256: reader.candidateSha256 }, freshnessReview: { id: "synthetic-test-only-historical-window", sourceSha256: "e".repeat(64), candidateSha256: reader.candidateSha256, observationPeriod: "2026-09", effectiveFrom: "2026-09-24", usableThrough: "2026-09-30", priceBand: "observed-city-envelope" } };
}
function prepared() { const reader = ready(configuration()), result = reader.forPlanning({ asOfDate: "2026-09-30" }); assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") throw Error("Expected conditional historical test facts"); return { reader, result }; }

test("actual pinned sources derive conditional package and all30cities, without adopting freshness or pantry quantities", options, () => {
  const reader = ready(), candidate = reader.candidate;
  assert.deepEqual(candidate.packageReference.conditionalGramsPerGallon, amount(3920));
  assert.equal(candidate.regional.reduce((n, region) => n + region.sampleCities, 0), 30);
  assert.deepEqual(candidate.regional.map(row => [row.region, row.sampleCities]), [["Northeast", 6], ["Midwest", 10], ["South", 9], ["West", 5]]);
  assert.deepEqual(candidate.regional.map(row => row.meanCentsPerGallon), [amount(879, 2), amount(3953, 10), amount(1057, 3), amount(2032, 5)]);
  assert.equal(candidate.regional.flatMap(row => row.cities).some(row => row.cityState.includes("Simple Average")), false);
  const miami = candidate.regional.find(row => row.region === "South")!.cities.find(row => row.cityState === "Miami, FL")!;
  assert.equal(miami.cents, 326); // September observation, not369cents YTD.
  assert.equal(candidate.completeRegistryEstablished, false); assert.equal(candidate.priceFreshnessEstablished, false); assert.equal(candidate.mealYieldEstablished, false); assert.equal(candidate.pantryPackageQuantityEstablished, false);
  assert.deepEqual(reader.forPlanning({ asOfDate: "2026-10-19" }), { outcome: "held", code: "milk_purchase_binding_review_needed", regionalPackFacts: [] });
});

test("source cohort verifies each exact native file and rejects a missing, changed or added source", options, () => {
  const original = sources();
  for (const key of Object.keys(MILK_EVIDENCE_PINS)) {
    const changed = { ...original, [key]: Buffer.from(original[key]!) }; changed[key]![0] ^= 1;
    assert.equal(createReviewedMilkPackEvidence(changed).outcome, "error");
    const missing = { ...original }; delete missing[key]; assert.equal(createReviewedMilkPackEvidence(missing).outcome, "error");
  }
  assert.equal(createReviewedMilkPackEvidence({ ...original, paidFallback: true }).outcome, "error");
});

test("binding alone does not guess a freshness window or emit partial usable facts", options, () => {
  const config = configuration(); const reader = ready({ ...config, freshnessReview: null });
  assert.deepEqual(reader.forPlanning({ asOfDate: "2026-10-19" }), { outcome: "held", code: "milk_price_freshness_review_needed", regionalPackFacts: [] });
  const reviewedOnly = ready({ ...config, purchaseBinding: null });
  assert.equal(reviewedOnly.forPlanning({ asOfDate: "2026-09-30" }).outcome, "held");
});

test("trusted explicit historical review produces existing quote facts, not an actual freshness approval", options, () => {
  const { result } = prepared(); assert.equal(result.regionalPackFacts.length, 4);
  assert.equal(result.sourceAdoptionGranted, false); assert.equal(result.mealYieldEstablished, false); assert.equal(result.pantryPackageQuantityEstablished, false);
  for (const fact of result.regionalPackFacts) { assert.deepEqual(fact.packQuantity, amount(3920)); assert.equal(fact.basis, "modeled-regional-average"); assert.equal(fact.observedOn, null); assert.deepEqual(fact.monthlyPriceBasis, { observationPeriod: "2026-09", publishedOn: "2026-09-24", reviewEffectiveFrom: "2026-09-24" }); assert.equal(fact.usableThrough, "2026-09-30"); assert.ok(fact.flags.includes("not-known-pantry-package-quantity")); assert.ok(Object.isFrozen(fact.packQuantity)); }
  assert.deepEqual(result.regionalPackFacts.find(row => row.region === "South")!.packPriceCents, { min: 264, max: 468 });
});

test("no stale, unpublished or future date silently inherits the historical review", options, () => {
  const { reader } = prepared();
  for (const asOfDate of ["2026-09-23", "2026-10-01", "2026-10-19", "2026-10-20"]) assert.deepEqual(reader.forPlanning({ asOfDate }), { outcome: "held", code: "milk_price_outside_reviewed_window", regionalPackFacts: [] });
  for (const query of [{ asOfDate: "2026-02-30" }, { asOfDate: "2026-09-30", usableThrough: "2026-10-31" }, { asOfDate: "2026-09-30", freshnessReview: configuration().freshnessReview }]) assert.equal(reader.forPlanning(query).outcome, "error");
  const extended = configuration(); extended.freshnessReview.usableThrough = "2026-10-31";
  assert.equal(ready(extended).forPlanning({ asOfDate: "2026-10-20" }).outcome, "held");
});

test("wrong food, state, unit, candidate, band and review dates refuse instead of changing matches", options, () => {
  const changes = [
    (c: ReturnType<typeof configuration>) => { c.purchaseBinding.ingredientId = "whole-milk"; },
    (c: ReturnType<typeof configuration>) => { c.purchaseBinding.preparedState = "cooked"; },
    (c: ReturnType<typeof configuration>) => { c.purchaseBinding.baseUnit = "ml"; },
    (c: ReturnType<typeof configuration>) => { c.purchaseBinding.formDigest = "0".repeat(64); },
    (c: ReturnType<typeof configuration>) => { c.purchaseBinding.candidateSha256 = "0".repeat(64); },
    (c: ReturnType<typeof configuration>) => { c.freshnessReview.candidateSha256 = "0".repeat(64); },
    (c: ReturnType<typeof configuration>) => { c.freshnessReview.observationPeriod = "2026-10"; },
    (c: ReturnType<typeof configuration>) => { c.freshnessReview.priceBand = "invented-five-percent-band"; },
    (c: ReturnType<typeof configuration>) => { c.freshnessReview.effectiveFrom = "2026-09-23"; },
    (c: ReturnType<typeof configuration>) => { c.freshnessReview.usableThrough = "2026-09-01"; },
    (c: ReturnType<typeof configuration>) => { c.freshnessReview.sourceSha256 = "not-a-hash"; },
  ];
  for (const change of changes) { const config = configuration(); change(config); assert.equal(createReviewedMilkPackEvidence(sources(), config).outcome, "error"); }
});

test("whole-pack thresholds and exact rational demand agree with independent ceiling arithmetic", options, () => {
  const { result } = prepared(), formDigest = result.regionalPackFacts[0]!.formDigest;
  for (const n of [0, 1, 3919, 3920, 3921, 7840, 7841, 20000]) for (const d of [1, 2, 3]) {
    const quote = quoteRegionalEstimates({ region: "South", storeIds: ["unchanged-store"], budgetCents: 10000, asOfDate: "2026-09-30" }, [{ skuId: "test-milk-purchase", category: "dairy", unit: "g", formDigest, perishable: true, purchasedNeed: { numerator: n, denominator: d } }], [], result.regionalPackFacts);
    assert.equal(quote.outcome, "quoted"); if (quote.outcome !== "quoted") throw Error("Expected historical test quote");
    const packs = Math.ceil(n / (d * 3920)); assert.equal(quote.rows[0]!.packCount, packs);
    assert.deepEqual(quote.estimatedTotalCents, { min: packs * 264, max: packs * 468 });
    const leftover = quote.rows[0]!.purchasedLeftover;
    assert.equal(BigInt(leftover.numerator) * BigInt(d), BigInt(leftover.denominator) * BigInt(packs * 3920 * d - n));
  }
});

test("quote deducts actual numeric stock once, never infers owned mass from a typical gallon", options, () => {
  const { result } = prepared(), formDigest = result.regionalPackFacts[0]!.formDigest;
  const requirements = [{ skuId: "test-milk-purchase", category: "dairy", unit: "g", formDigest, perishable: true, purchasedNeed: { numerator: 6000, denominator: 1 } }];
  const pantry = [{ skuId: "test-milk-purchase", unit: "g", formDigest, quantity: { numerator: 1960, denominator: 1 } }];
  const quote = quoteRegionalEstimates({ region: "South", storeIds: ["same-store"], budgetCents: 1000, asOfDate: "2026-09-30" }, requirements, pantry, result.regionalPackFacts);
  assert.equal(quote.outcome, "quoted"); if (quote.outcome !== "quoted") return;
  assert.deepEqual(quote.rows[0]!.ownedUsed, amount(1960)); assert.deepEqual(quote.rows[0]!.toBuy, amount(4040)); assert.equal(quote.rows[0]!.packCount, 2); assert.deepEqual(quote.rows[0]!.purchasedLeftover, amount(3800)); assert.deepEqual(quote.budgetRemainingCents, { min: 64, max: 472 });
  assert.equal(quote.liveRetailerPricing, false); assert.equal(quote.adoptionGranted, false); assert.equal(quote.uniqueBuyItemCount, 1); assert.equal(requirements[0]!.purchasedNeed.numerator, 6000); assert.equal(pantry[0]!.quantity.numerator, 1960);
  const missing = [{ ...requirements[0], skuId: "unpriced-food" }];
  assert.deepEqual(quoteRegionalEstimates({ region: "South", storeIds: ["same-store"], budgetCents: 1000, asOfDate: "2026-09-30" }, missing, [], result.regionalPackFacts), { outcome: "held", code: "regional_pack_fact_needed" });
});

test("source, review and output snapshots resist caller mutation without freezing callers", options, () => {
  const raw = sources(), config = configuration(), reader = createReviewedMilkPackEvidence(raw, config); assert.equal(reader.outcome, "ready"); if (reader.outcome !== "ready") return;
  const before = reader.forPlanning({ asOfDate: "2026-09-30" }); raw.prices![0] ^= 1; config.freshnessReview.usableThrough = "2026-10-31"; config.purchaseBinding.skuId = "changed";
  assert.deepEqual(reader.forPlanning({ asOfDate: "2026-09-30" }), before); assert.equal(reader.forPlanning({ asOfDate: "2026-10-19" }).outcome, "held"); assert.equal(Object.isFrozen(config), false); assert.equal(Object.isFrozen(config.freshnessReview), false); assert.ok(Object.isFrozen(reader.candidate.regional[0]!.cities));
});

test("getters, coercion and paid/currentness extras never become trusted evidence", options, () => {
  let reads = 0; const raw = sources(); Object.defineProperty(raw, "prices", { enumerable: true, get() { reads++; throw Error("not invoked"); } }); assert.equal(createReviewedMilkPackEvidence(raw).outcome, "error");
  const config = configuration(); Object.defineProperty(config, "purchaseBinding", { enumerable: true, get() { reads++; throw Error("not invoked"); } }); assert.equal(createReviewedMilkPackEvidence(sources(), config).outcome, "error");
  const hostile = new Uint8Array(readFileSync(FILES.prices)); Object.defineProperty(hostile, "byteLength", { get() { reads++; throw Error("not invoked"); } }); assert.equal(createReviewedMilkPackEvidence({ ...sources(), prices: hostile }).outcome, "ready");
  assert.equal(createReviewedMilkPackEvidence(sources(), { ...configuration(), liveStoreApproved: true }).outcome, "error"); assert.equal(reads, 0);
});

test("all exact source files remain byte-identical after actual evidence and quote checks", options, () => {
  ready(); for (const [key, file] of Object.entries(FILES)) assert.equal(createHash("sha256").update(readFileSync(file)).digest("hex"), MILK_EVIDENCE_PINS[key as keyof typeof MILK_EVIDENCE_PINS]);
});

test("review renewal cannot create a new milk observation date or erase source publication/month", options, () => {
  const observations = [];
  for (const effectiveFrom of ["2026-09-24", "2026-10-19"]) {
    const config = configuration(); config.freshnessReview.effectiveFrom = effectiveFrom; config.freshnessReview.usableThrough = "2026-10-19";
    const reader = ready(config), result = reader.forPlanning({ asOfDate: "2026-10-19" });
    assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") throw Error("Expected explicit test review");
    observations.push(result.regionalPackFacts.map(fact => ({ observedOn: fact.observedOn, basis: fact.monthlyPriceBasis })));
    for (const row of observations.at(-1)!) {
      assert.equal(row.observedOn, null); // Actual survey day was not supplied.
      assert.deepEqual(row.basis, { observationPeriod: "2026-09", publishedOn: "2026-09-24", reviewEffectiveFrom: effectiveFrom });
    }
  }
});

test("accepted independent milk purchase bindings compose without colliding source-fact IDs", options, () => {
  const facts = ["test-milk:a:b", "test-milk:a"].map(skuId => {
    const c = configuration(); c.purchaseBinding.skuId = skuId;
    const value = ready(c).forPlanning({ asOfDate: "2026-09-30" });
    assert.equal(value.outcome, "prepared");
    if (value.outcome !== "prepared") throw Error("Expected independently valid reviewed source facts");
    return value.regionalPackFacts.find(f => f.region === "South")!;
  });
  const request = { region: "South", storeIds: ["synthetic-selected-store"], budgetCents: 1000, asOfDate: "2026-09-30" };
  const requirements = facts.map(f => ({ skuId: f.skuId, category: "dairy", unit: "g", formDigest: f.formDigest, perishable: true, purchasedNeed: { numerator: 500, denominator: 1 } }));
  for (let i = 0; i < facts.length; i++) {
    const one = quoteRegionalEstimates(request, [requirements[i]!], [], [facts[i]!]);
    assert.equal(one.outcome, "quoted");
    if (one.outcome === "quoted") assert.deepEqual(one.estimatedTotalCents, { min: 264, max: 468 });
  }
  const joined = quoteRegionalEstimates(request, requirements, [], facts);
  assert.equal(joined.outcome, "quoted");
  if (joined.outcome !== "quoted") throw Error("Distinct accepted bindings must compose");
  assert.equal(new Set(facts.map(f => f.id)).size, 2);
  assert.deepEqual(joined.estimatedTotalCents, { min: 528, max: 936 });
  assert.equal(joined.uniqueBuyItemCount, 2);
  assert.deepEqual(quoteRegionalEstimates(request, requirements, [], [facts[0]!, { ...facts[1]!, id: facts[0]!.id }]), { outcome: "error", code: "invalid_regional_quote_input" });
});

test("milk fact identity binds the complete source review and SKU across a bounded domain", options, () => {
  const ids = new Set<string>();
  for (const skuId of ["milk", "milk:a", "milk|a", "milk,a", "[milk]", "é", "牛乳", "🙂"]) {
    const c = configuration(); c.purchaseBinding.skuId = skuId;
    const reader = ready(c), result = reader.forPlanning({ asOfDate: "2026-09-30" });
    assert.equal(result.outcome, "prepared");
    if (result.outcome !== "prepared") throw Error("Expected source snapshot");
    for (const fact of result.regionalPackFacts) {
      const expected = "wd-rmp-price-v1:" + createHash("sha256").update(JSON.stringify(["wd-reviewed-milk-pack-price-id-v1", fact.sourceSha256, fact.region])).digest("hex");
      assert.equal(fact.id, expected); assert.equal(fact.id.length, 80);
      assert.equal(ids.has(fact.id), false); ids.add(fact.id);
    }
    assert.deepEqual(reader.forPlanning({ asOfDate: "2026-10-01" }), { outcome: "held", code: "milk_price_outside_reviewed_window", regionalPackFacts: [] });
    assert.deepEqual(reader.forPlanning({ asOfDate: "2026-09-30" }), result);
  }
  assert.equal(ids.size, 32);
  const first = prepared().result.regionalPackFacts;
  const c = configuration(); c.freshnessReview.id = "different:review";
  const changed = ready(c).forPlanning({ asOfDate: "2026-09-30" });
  assert.equal(changed.outcome, "prepared");
  if (changed.outcome !== "prepared") throw Error("Expected changed reviewed source");
  assert.ok(changed.regionalPackFacts.every((f, i) => f.id !== first[i]!.id && f.sourceSha256 !== first[i]!.sourceSha256));
});
