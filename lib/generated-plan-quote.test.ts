import test from "node:test";
import assert from "node:assert/strict";
import { preparePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteBaskets, ratio } from "../scripts/data/store-estimates.ts";
import { fixtureModel, fixtureRequest, fixtureFacts, fixtureScope, fixtureCalibration, fixtureStores, sourceFor } from "../scripts/data/store-estimate-fixtures.ts";
import { scopeKey } from "../scripts/data/store-estimate-model.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const demand = (assignmentId = "a1", changes: Record<string, unknown> = {}) => ({ assignmentId, recipeId: "fixture-recipe", recipeSha256: "a".repeat(64), ingredientId: "fixture-food", preparedState: "edible raw", baseUnit: "g", amount: amount("300"), ...changes });
const fact = (changes: Record<string, unknown> = {}) => ({ id: "fixture-conversion", ingredientId: "fixture-food", preparedState: "edible raw", consumedUnit: "g", skuId: "fixture-purchase-food", purchaseState: "unprepared physical stock", purchaseUnit: "g", formDigest: "b".repeat(64), category: "pantry", perishable: false, factor: { min: amount("1"), max: amount("1") }, sourceSha256: "c".repeat(64), ...changes });

test("purchase basis uses the explicit upper factor without changing consumed demand", () => {
  const inputs = [demand()], facts = [fact({ factor: { min: amount("1"), max: amount("5", "4") } })], before = JSON.stringify({ inputs, facts });
  const result = preparePurchaseRequirements(inputs, facts); assert.equal(result.outcome, "prepared");
  if (result.outcome === "prepared") {
    assert.deepEqual(result.requirements[0]!.purchasedNeed, ratio(375));
    assert.equal(result.requirements[0]!.formDigest, "b".repeat(64));
    assert.equal(result.correspondencePins[0]!.sourceSha256, "c".repeat(64));
  }
  assert.equal(JSON.stringify({ inputs, facts }), before);
});

test("compatible aliases combine into one purchase requirement before pantry is used", () => {
  const inputs = [demand("a1"), demand("a2", { ingredientId: "second-alias", amount: amount("150") })];
  const result = preparePurchaseRequirements(inputs, [fact(), fact({ id: "second", ingredientId: "second-alias" })]);
  assert.equal(result.outcome, "prepared"); if (result.outcome === "prepared") { assert.equal(result.requirements.length, 1); assert.deepEqual(result.requirements[0]!.purchasedNeed, ratio(450)); }
});

test("missing, wrong-form and ambiguous correspondence never falls back to 100 percent", () => {
  assert.deepEqual(preparePurchaseRequirements([demand()], []), { outcome: "held", code: "purchase_basis_needed" });
  assert.deepEqual(preparePurchaseRequirements([demand()], [fact({ preparedState: "cooked" })]), { outcome: "held", code: "purchase_basis_needed" });
  assert.deepEqual(preparePurchaseRequirements([demand()], [fact(), fact({ id: "other", skuId: "other-purchase" })]), { outcome: "held", code: "purchase_basis_ambiguous" });
});

test("incompatible purchase identities refuse rather than splitting and deducting pantry twice", () => {
  const inputs = [demand("a1"), demand("a2", { ingredientId: "other" })];
  for (const patch of [{ formDigest: "d".repeat(64) }, { purchaseUnit: "ml" }, { perishable: true }, { category: "produce" }, { purchaseState: "already cooked" }]) {
    assert.deepEqual(preparePurchaseRequirements(inputs, [fact(), fact({ id: "other", ingredientId: "other", ...patch })]), { outcome: "error", code: "incompatible_purchase_correspondence" });
  }
});

test("invalid and duplicate evidence refuses without reading getters", () => {
  let reads = 0;
  const getter = Object.defineProperty(fact(), "factor", { enumerable: true, get() { reads++; throw new Error("Must not read getter"); } });
  for (const facts of [[getter], [fact(), fact()], [fact({ factor: { min: amount("0"), max: amount("1") } })], [fact({ factor: { min: amount("2"), max: amount("1") } })], [{ ...fact(), surplus: undefined }]]) {
    assert.deepEqual(preparePurchaseRequirements([demand()], facts), { outcome: "error", code: "invalid_purchase_correspondence" });
  }
  assert.equal(reads, 0);
});

test("safe-number quote overflow is held, never rounded into another pack count", () => {
  assert.deepEqual(preparePurchaseRequirements([demand("a1", { amount: amount("9007199254740993") })], [fact()]), { outcome: "held", code: "quote_quantity_capacity_exceeded" });
});

test("zero consumed quantities need no purchase fact and make no total claim", () => {
  const result = preparePurchaseRequirements([demand("a1", { amount: amount("0") })], []);
  assert.equal(result.outcome, "prepared"); if (result.outcome === "prepared") assert.deepEqual(result.requirements, []);
});

test("actual existing whole-pack quote deducts shared pantry once and keeps leftovers separate", () => {
  const result = preparePurchaseRequirements([demand("a1", { amount: amount("600") }), demand("a2")], [fact()]);
  assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") throw new Error("Expected fixture requirements");
  const requirements = result.requirements.map(row => ({ ...row, purchasedNeed: { ...row.purchasedNeed } }));
  const model = fixtureModel(["pantry"]), request = fixtureRequest(model), facts = fixtureFacts(requirements);
  const calibration = fixtureCalibration(model, fixtureScope(request, requirements, request.storeIds[0]!), Array(9).fill(300), "joined-bridge");
  request.calibrationPins = [{ scopeDigest: scopeKey(calibration.scope), digest: calibration.digest }];
  const pantry = [{ skuId: requirements[0]!.skuId, unit: "g" as const, formDigest: requirements[0]!.formDigest, quantity: ratio(600) }];
  const quote = quoteBaskets(request, requirements, pantry, fixtureStores, facts, sourceFor(facts, facts.map(row => row.cell)), model, [calibration]).alternatives[0]!;
  assert.equal(quote.status, "fixture-only"); assert.equal(quote.totalCents, 164); assert.equal(quote.rawCents, 150);
  assert.deepEqual(quote.lines[0]!.ownedUsed, ratio(600)); assert.deepEqual(quote.lines[0]!.newCarryover, ratio(200));
  assert.deepEqual(quote.lines[0]!.required, ratio(900)); assert.equal(quote.lines[0]!.assignments[0]!.packs, 1);
  const impossible = quoteBaskets({ ...request, budgetCents: 1 }, requirements, pantry, fixtureStores, facts, sourceFor(facts, facts.map(row => row.cell)), model, [calibration]).alternatives[0]!;
  assert.equal(impossible.withinBudget, false); assert.equal(impossible.totalCents, quote.totalCents);
});
