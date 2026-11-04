import test from "node:test";
import assert from "node:assert/strict";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { preparePurchaseRequirements } from "./generated-plan-quote.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const fraction = (numerator: number, denominator = 1) => ({ numerator, denominator });
const request = (changes = {}) => ({ region: "South", storeIds: ["fixture-store-b", "fixture-store-a"], budgetCents: 1000, asOfDate: "2026-10-18", ...changes });
const required = (changes = {}) => ({ skuId: "fixture-food", category: "pantry", unit: "g", formDigest: "a".repeat(64), perishable: false, purchasedNeed: fraction(750), ...changes });
const pantry = (changes = {}) => ({ skuId: "fixture-food", unit: "g", formDigest: "a".repeat(64), quantity: fraction(100), ...changes });
const fact = (changes = {}) => ({ id: "fixture-typical-pack", skuId: "fixture-food", unit: "g", formDigest: "a".repeat(64), region: "South", packQuantity: amount("500"), packPriceCents: { min: 200, max: 300 }, currency: "USD", observedOn: "2026-10-01", usableThrough: "2026-10-31", sourceSha256: "b".repeat(64), basis: "synthetic-test-only", flags: ["fixture-not-market-data"], ...changes });

test("regional estimate uses whole packs once and separates owned from purchased leftovers", () => {
  const result = quoteRegionalEstimates(request(), [required()], [pantry()], [fact()]);
  assert.equal(result.outcome, "quoted"); if (result.outcome !== "quoted") return;
  const row = result.rows[0]!;
  assert.deepEqual(row.ownedUsed, amount("100")); assert.deepEqual(row.ownedRemaining, amount("0"));
  assert.deepEqual(row.toBuy, amount("650")); assert.equal(row.packCount, 2); assert.deepEqual(row.purchasedQuantity, amount("1000")); assert.deepEqual(row.purchasedLeftover, amount("350"));
  assert.deepEqual(result.estimatedTotalCents, { min: 400, max: 600 }); assert.deepEqual(result.budgetRemainingCents, { min: 400, max: 600 });
  assert.equal(result.uniqueBuyItemCount, 1); assert.equal(result.withinBudgetAtUpperEstimate, true); assert.deepEqual(result.storeIds, ["fixture-store-b", "fixture-store-a"]);
  assert.equal(result.liveRetailerPricing, false); assert.equal(result.checkoutChargesIncluded, false); assert.equal(result.adoptionGranted, false); assert.deepEqual(row.flags, ["fixture-not-market-data"]);
});

test("actual quantity bridge feeds a shared two-person requirement without double pantry deduction", () => {
  const demands = ["a1", "a2"].map(assignmentId => ({ assignmentId, recipeId: "fixture-recipe", recipeSha256: "c".repeat(64), ingredientId: "fixture-ingredient", preparedState: "raw", baseUnit: "g", amount: amount("300") }));
  const bridge = preparePurchaseRequirements(demands, [{ id: "fixture-map", ingredientId: "fixture-ingredient", preparedState: "raw", consumedUnit: "g", skuId: "fixture-food", purchaseState: "raw", purchaseUnit: "g", formDigest: "a".repeat(64), category: "pantry", perishable: false, factor: { min: amount("1"), max: amount("1") }, sourceSha256: "d".repeat(64) }]);
  assert.equal(bridge.outcome, "prepared"); if (bridge.outcome !== "prepared") return;
  const result = quoteRegionalEstimates(request(), bridge.requirements, [pantry({ quantity: fraction(200) })], [fact()]);
  assert.equal(result.outcome, "quoted"); if (result.outcome === "quoted") { assert.deepEqual(result.rows[0]!.toBuy, amount("400")); assert.equal(result.rows[0]!.packCount, 1); assert.deepEqual(result.rows[0]!.purchasedLeftover, amount("100")); }
});

test("pantry-covered demand needs no invented zero price and retains unused unrelated stock", () => {
  const result = quoteRegionalEstimates(request(), [required({ purchasedNeed: fraction(50) })], [pantry(), pantry({ skuId: "other" })], []);
  assert.equal(result.outcome, "quoted"); if (result.outcome !== "quoted") return;
  assert.equal(result.rows[0]!.factId, null); assert.equal(result.uniqueBuyItemCount, 0); assert.deepEqual(result.estimatedTotalCents, { min: 0, max: 0 });
  assert.deepEqual(result.ownedRemaining.find(row => row.skuId === "fixture-food")!.quantity, amount("50")); assert.deepEqual(result.ownedRemaining.find(row => row.skuId === "other")!.quantity, amount("100"));
});

test("missing, ambiguous, wrong-region, future and expired evidence stays held", () => {
  for (const [facts, code] of [[[], "regional_pack_fact_needed"], [[fact(), fact({ id: "second" })], "regional_pack_fact_ambiguous"], [[fact({ region: "West" })], "regional_pack_fact_needed"], [[fact({ observedOn: "2026-10-19" })], "regional_pack_fact_not_current"], [[fact({ usableThrough: "2026-10-17" })], "regional_pack_fact_not_current"]] as const) {
    const result = quoteRegionalEstimates(request(), [required()], [], facts); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.equal(result.code, code);
  }
});

test("incompatible pantry and duplicate requirements refuse rather than guessing or deducting twice", () => {
  for (const stock of [[pantry({ unit: "ml" })], [pantry({ formDigest: "f".repeat(64) })], [pantry(), pantry()]]) assert.equal(quoteRegionalEstimates(request(), [required()], stock, [fact()]).outcome, "error");
  assert.equal(quoteRegionalEstimates(request(), [required(), required()], [], [fact()]).outcome, "error");
});

test("budget failure remains an estimate with negative headroom, never manufactured savings", () => {
  const result = quoteRegionalEstimates(request({ budgetCents: 100 }), [required()], [], [fact()]);
  assert.equal(result.outcome, "quoted"); if (result.outcome === "quoted") { assert.equal(result.withinBudgetAtUpperEstimate, false); assert.deepEqual(result.estimatedTotalCents, { min: 400, max: 600 }); assert.deepEqual(result.budgetRemainingCents, { min: -500, max: -300 }); }
});

test("malformed facts and hostile inputs refuse without getters or price-zero fallback", () => {
  let reads = 0; const getter = Object.defineProperty(fact(), "packQuantity", { enumerable: true, get() { reads++; throw new Error("Do not read"); } });
  const coercion = (name: string) => ({ toString() { reads++; return name; } });
  for (const value of [getter, fact({ basis: coercion("synthetic-test-only") }), fact({ packPriceCents: { min: 0, max: 10 } }), fact({ packQuantity: amount("0") }), fact({ packPriceCents: { min: 2, max: 1 } }), fact({ currency: "CAD" }), fact({ usableThrough: "2026-02-30" }), fact({ credit: true })]) assert.equal(quoteRegionalEstimates(request(), [required()], [], [value]).outcome, "error");
  for (const value of [request({ region: coercion("South") }), request({ storeIds: ["same", "same"] }), request({ budgetCents: NaN }), request({ live: true })]) assert.equal(quoteRegionalEstimates(value, [required()], [], [fact()]).outcome, "error");
  assert.equal(quoteRegionalEstimates(request(), new Array(1), [], [fact()]).outcome, "error"); assert.equal(reads, 0);
});

test("quote overflow is held instead of rounding large totals or pack counts", () => {
  assert.deepEqual(quoteRegionalEstimates(request(), [required({ purchasedNeed: fraction(Number.MAX_SAFE_INTEGER) })], [], [fact({ packQuantity: amount("1", "2") })]), { outcome: "held", code: "regional_quote_capacity_exceeded" });
  assert.deepEqual(quoteRegionalEstimates(request(), [required()], [], [fact({ packPriceCents: { min: Number.MAX_SAFE_INTEGER, max: Number.MAX_SAFE_INTEGER } })]), { outcome: "held", code: "regional_quote_capacity_exceeded" });
});

test("exact pack ceiling and conservation agree across a bounded domain", () => {
  for (let need = 1; need <= 31; need++) for (let owned = 0; owned <= 11; owned++) {
    const result = quoteRegionalEstimates(request(), [required({ purchasedNeed: fraction(need, 3) })], [pantry({ quantity: fraction(owned, 3) })], [fact({ packQuantity: amount("7", "3") })]);
    if (result.outcome !== "quoted") throw new Error("Expected fixture quote");
    const row = result.rows[0]!, shortfall = Math.max(need - owned, 0), packs = Math.ceil(shortfall / 7);
    assert.equal(row.packCount, packs); assert.equal(BigInt(row.toBuy.numerator) * BigInt(3), BigInt(shortfall) * BigInt(row.toBuy.denominator));
    assert.equal(BigInt(row.purchasedLeftover.numerator) * BigInt(3), BigInt(packs * 7 - shortfall) * BigInt(row.purchasedLeftover.denominator));
  }
});

test("permuted registries and ingredient rows produce the same immutable quote", () => {
  const requirements = [required(), required({ skuId: "other" })], facts = [fact(), fact({ id: "other-pack", skuId: "other" })], stock = [pantry()], input = { requirements, facts, stock }, before = JSON.stringify(input);
  const result = quoteRegionalEstimates(request(), requirements, stock, facts);
  assert.deepEqual(quoteRegionalEstimates(request(), [...requirements].reverse(), stock, [...facts].reverse()), result);
  assert.equal(JSON.stringify(input), before); assert.ok(Object.isFrozen(result));
});

test("monthly source period and publication stay separate from reviewed quote dates", () => {
  const monthly = (from: string) => fact({ observedOn: null, usableThrough: "2026-10-19", monthlyPriceBasis: { observationPeriod: "2026-09", publishedOn: "2026-09-24", reviewEffectiveFrom: from } });
  const quote = (asOfDate: string, from: string) => quoteRegionalEstimates(request({ asOfDate }), [required()], [], [monthly(from)]);
  assert.equal(quote("2026-10-19", "2026-10-19").outcome, "quoted");
  assert.equal(quote("2026-10-18", "2026-09-24").outcome, "quoted");
  assert.deepEqual(quote("2026-10-18", "2026-10-19"), { outcome: "held", code: "regional_pack_fact_not_current" });
  assert.deepEqual(quote("2026-10-20", "2026-10-19"), { outcome: "held", code: "regional_pack_fact_not_current" });
  assert.equal(monthly("2026-09-24").observedOn, null); assert.equal(monthly("2026-10-19").observedOn, null);
});

test("monthly dates reject invented observation days, future periods and invalid review windows", () => {
  const basis = { observationPeriod: "2026-09", publishedOn: "2026-09-24", reviewEffectiveFrom: "2026-10-19" };
  const monthly = fact({ observedOn: null, monthlyPriceBasis: basis });
  const bad = [fact({ observedOn: null }), { ...monthly, observedOn: "2026-10-19" }, { ...monthly, monthlyPriceBasis: { ...basis, observationPeriod: "2026-10" } }, { ...monthly, monthlyPriceBasis: { ...basis, observationPeriod: "2026-13" } }, { ...monthly, monthlyPriceBasis: { ...basis, reviewEffectiveFrom: "2026-09-23" } }, { ...monthly, usableThrough: "2026-10-18" }, { ...monthly, monthlyPriceBasis: { ...basis, publishedOn: "2026-02-30" } }, { ...monthly, monthlyPriceBasis: { ...basis, fabricatedSurveyDay: "2026-09-01" } }];
  for (const value of bad) assert.deepEqual(quoteRegionalEstimates(request({ asOfDate: "2026-10-19" }), [required()], [], [value]), { outcome: "error", code: "invalid_regional_quote_input" });
});

test("monthly known availability does not invent an exact source publication or survey day", () => {
  const basis = { observationPeriod: "2026-09", publishedOn: null, knownAvailableBy: "2026-10-14", reviewEffectiveFrom: "2026-10-19" };
  const input = fact({ observedOn: null, usableThrough: "2026-10-19", monthlyPriceBasis: basis }), before = JSON.stringify(input);
  const quote = (asOfDate: string) => quoteRegionalEstimates(request({ asOfDate }), [required()], [], [input]);
  const current = quote("2026-10-19"); assert.equal(current.outcome, "quoted");
  assert.deepEqual(quote("2026-10-18"), { outcome: "held", code: "regional_pack_fact_not_current" });
  assert.deepEqual(quote("2026-10-20"), { outcome: "held", code: "regional_pack_fact_not_current" });
  assert.equal(input.observedOn, null); assert.equal(basis.publishedOn, null); assert.equal(JSON.stringify(input), before);
  const changed = quoteRegionalEstimates(request({ asOfDate: "2026-10-19" }), [required()], [], [fact({ ...input, monthlyPriceBasis: { ...basis, knownAvailableBy: "2026-10-15" } })]);
  assert.equal(changed.outcome, "quoted"); if (changed.outcome !== "quoted" || current.outcome !== "quoted") return;
  assert.deepEqual(changed.estimatedTotalCents, current.estimatedTotalCents); assert.notEqual(changed.factPins[0]!.factSha256, current.factPins[0]!.factSha256);
});

test("unknown publication variant refuses missing, contradictory and fabricated date fields", () => {
  const basis = { observationPeriod: "2026-09", publishedOn: null, knownAvailableBy: "2026-10-14", reviewEffectiveFrom: "2026-10-19" };
  const invalid = [
    { observationPeriod: basis.observationPeriod, publishedOn: null, reviewEffectiveFrom: basis.reviewEffectiveFrom },
    { ...basis, knownAvailableBy: null }, { ...basis, knownAvailableBy: "2026-02-30" },
    { ...basis, publishedOn: "2026-10-14" }, { ...basis, observationPeriod: "2026-11" },
    { ...basis, reviewEffectiveFrom: "2026-10-13" }, { ...basis, knownAvailableBy: "2026-10-20" },
    { ...basis, observedOn: "2026-09-01" }, { ...basis, publicationWasGuessed: true },
  ];
  for (const monthlyPriceBasis of invalid) assert.deepEqual(quoteRegionalEstimates(request({ asOfDate: "2026-10-19" }), [required()], [], [fact({ observedOn: null, monthlyPriceBasis })]), { outcome: "error", code: "invalid_regional_quote_input" });
});

test("both monthly date precisions follow the same explicit reviewed interval across a bounded domain", () => {
  for (let start = 14; start <= 19; start++) for (let day = 13; day <= 21; day++) {
    const reviewEffectiveFrom = `2026-10-${start}`, asOfDate = `2026-10-${day}`;
    const bases = [{ observationPeriod: "2026-09", publishedOn: "2026-10-14", reviewEffectiveFrom }, { observationPeriod: "2026-09", publishedOn: null, knownAvailableBy: "2026-10-14", reviewEffectiveFrom }];
    for (const monthlyPriceBasis of bases) {
      const result = quoteRegionalEstimates(request({ asOfDate }), [required()], [], [fact({ observedOn: null, usableThrough: "2026-10-20", monthlyPriceBasis })]);
      assert.equal(result.outcome, day >= start && day <= 20 ? "quoted" : "held");
      if (result.outcome === "quoted") assert.deepEqual(result.estimatedTotalCents, { min: 400, max: 600 });
    }
  }
});
