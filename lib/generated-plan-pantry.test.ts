import test from "node:test";
import assert from "node:assert/strict";
import * as measures from "../packages/solver/src/generated-plan-measures.ts";
import { createPantryIntake } from "./generated-plan-pantry.ts";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
function config() {
  return { measureFacts: [
    { id: "piece-a", ingredientId: "pantry-food-a", preparedState: "raw", baseUnit: "g", fromUnit: "piece", factor: amount("100"), sourceSha256: "a".repeat(64), basis: { kind: "food-specific", description: "Synthetic100g piece only" } },
    { id: "cup-a", ingredientId: "pantry-food-a", preparedState: "raw", baseUnit: "g", fromUnit: "cup", factor: amount("120"), sourceSha256: "a".repeat(64), basis: { kind: "volume", convention: "Synthetic cup convention" } },
    { id: "tbsp-a", ingredientId: "pantry-food-a", preparedState: "raw", baseUnit: "g", fromUnit: "tbsp", factor: amount("15"), sourceSha256: "a".repeat(64), basis: { kind: "volume", convention: "Synthetic tablespoon convention" } },
    { id: "package-a", ingredientId: "pantry-food-a", preparedState: "raw", baseUnit: "g", fromUnit: "package-fraction", factor: amount("500"), sourceSha256: "a".repeat(64), basis: { kind: "package", packageId: "synthetic500gpack", packageQuantity: amount("500"), packageUnit: "g" } },
  ], purchaseBindings: [{ id: "owned-a", ingredientId: "pantry-food-a", preparedState: "raw", baseUnit: "g", skuId: "buy-a", formDigest: "d".repeat(64), sourceSha256: "b".repeat(64) }] };
}
const entry = (changes: Record<string, unknown> = {}) => ({ pantryId: "container-a", kind: "known", ingredientId: "pantry-food-a", preparedState: "raw", baseUnit: "g", amount: amount("1"), unit: "piece", ...changes });
function ready(configuration = config()) { const result = createPantryIntake(configuration); assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") throw new Error("Expected synthetic pantry registry"); return result; }

test("bound measure conversion snapshots facts without freezing caller data or sharing mutable evidence", () => {
  const facts = config().measureFacts, bound = measures.createMeasureConverter(facts); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  facts[0]!.factor.numerator = "999"; assert.equal(Object.isFrozen(facts[0]), false);
  const result = bound.convert({ ingredientId: "pantry-food-a", preparedState: "raw", baseUnit: "g", unit: "piece", amount: amount("2") });
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.deepEqual(result.quantity, amount("200")); assert.ok(Object.isFrozen(result.evidence!.basis));
});

test("cups tablespoons pieces and package fractions feed exact owned purchase quantities", () => {
  for (const [unit, numerator, denominator, expected] of [["piece", "2", "1", "200"], ["cup", "1", "2", "60"], ["tbsp", "3", "1", "45"], ["package-fraction", "1", "4", "125"]]) {
    const result = ready().prepare([entry({ unit, amount: amount(numerator!, denominator!) })]);
    assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") continue;
    assert.deepEqual(result.pantry[0]!.quantity, { numerator: Number(expected), denominator: 1 }); assert.equal(result.deductionPerformed, false); assert.equal(result.sourceAdoptionGranted, false);
  }
});

test("compatible separate containers aggregate once but duplicate observation IDs refuse", () => {
  const intake = ready(), rows = [entry({ pantryId: "first", amount: amount("1", "3"), unit: "g" }), entry({ pantryId: "second", amount: amount("2", "3"), unit: "g" })];
  const result = intake.prepare(rows); if (result.outcome !== "prepared") throw new Error("Expected exact combined stock");
  assert.equal(result.pantry.length, 1); assert.deepEqual(result.pantry[0]!.quantity, { numerator: 1, denominator: 1 }); assert.equal(result.records.length, 2);
  assert.deepEqual(intake.prepare([...rows].reverse()), result); assert.equal(intake.prepare([rows[0], rows[0]]).outcome, "error");
});

test("custom and missing measures stay recorded with null complete stock, never guessed as zero", () => {
  const result = ready().prepare([entry(), { pantryId: "custom", kind: "custom", label: "Unknown synthetic food", amountText: "half a bag" }]);
  assert.equal(result.outcome, "held"); if (result.outcome !== "held") return;
  assert.equal(result.pantry, null); assert.equal(result.knownOnlyStock.length, 1); assert.ok(result.unresolvedPantryIds.includes("custom")); assert.equal(result.records.find(row => row.pantryId === "custom")!.code, "custom_pantry_mapping_required");
  const missing = ready().prepare([entry({ unit: "handful" })]); assert.equal(missing.outcome, "held"); if (missing.outcome === "held") assert.equal(missing.knownOnlyStock.length, 0);
});

test("raw cooked base-unit and stale fact identities cannot borrow a convenient binding", () => {
  for (const change of [{ preparedState: "cooked" }, { baseUnit: "ml" }, { ingredientId: "different-food" }, { measureFactId: "missing" }, { purchaseBindingId: "missing" }]) assert.equal(ready().prepare([entry(change)]).outcome, "held");
});

test("ambiguous facts require explicit matching IDs and contradictory SKU forms refuse registry binding", () => {
  const c = config(); c.purchaseBindings.push({ ...c.purchaseBindings[0]!, id: "second" });
  const intake = ready(c); assert.equal(intake.prepare([entry()]).outcome, "held"); assert.equal(intake.prepare([entry({ purchaseBindingId: "second" })]).outcome, "prepared");
  const bad = config(); bad.purchaseBindings.push({ ...bad.purchaseBindings[0]!, id: "wrong-form", formDigest: "c".repeat(64) }); assert.equal(createPantryIntake(bad).outcome, "error");
  const cooked = config(); cooked.purchaseBindings.push({ ...cooked.purchaseBindings[0]!, id: "cooked", preparedState: "cooked" }); assert.equal(createPantryIntake(cooked).outcome, "error");
});

test("registry mutation after binding cannot change later stock or freeze caller configuration", () => {
  const c = config(), intake = ready(c), first = intake.prepare([entry()]); c.measureFacts[0]!.factor.numerator = "900"; c.purchaseBindings[0]!.skuId = "other";
  assert.deepEqual(intake.prepare([entry()]), first); assert.equal(Object.isFrozen(c.purchaseBindings[0]), false); assert.ok(Object.isFrozen(first));
});

test("unsafe numeric stock stays held with exact input preserved instead of rounded", () => {
  const result = ready().prepare([entry({ unit: "g", amount: amount("9007199254740992") })]); assert.equal(result.outcome, "held");
  if (result.outcome === "held") { assert.equal(result.pantry, null); assert.equal(result.knownOnlyStock.length, 0); assert.equal(result.records[0]!.code, "pantry_quantity_capacity_exceeded"); }
});

test("unknown protein fields getters negative amounts and sparse input refuse without execution", () => {
  const intake = ready(); let reads = 0;
  const getter = Object.defineProperty(entry(), "amount", { enumerable: true, get() { reads++; throw new Error("Not read"); } });
  for (const value of [[getter], [entry({ proteinGrams: 150 })], [entry({ amount: amount("-1") })], [entry({ amount: amount("1", "0") })], [entry({ unit: "handful", purchaseBindingId: 2 })], new Array(1)]) assert.equal(intake.prepare(value).outcome, "error");
  assert.equal(reads, 0); assert.equal(createPantryIntake(Object.defineProperty(config(), "measureFacts", { enumerable: true, get() { reads++; throw new Error("Not read"); } })).outcome, "error"); assert.equal(reads, 0);
});

test("exact practical stock connects to the same two-person evaluator and deducts once without protein conversion", () => {
  const f = setup(), bytes = Buffer.from(f.rows.map(row => JSON.stringify(row)).join("\n") + "\n"), c = config();
  const correspondences = [{ id: "map-a", ingredientId: "food-a", preparedState: "raw", consumedUnit: "g", skuId: "buy-a", purchaseState: "raw", purchaseUnit: "g", formDigest: "d".repeat(64), category: "pantry", perishable: false, factor: { min: amount("1"), max: amount("1") }, sourceSha256: "e".repeat(64) }];
  const bound = createJoinedReferencePlanner(bytes, { sourcePin: { sha256: sha(bytes), recordCount: 2 }, correspondences, regionalPackFacts: [], pantryIntake: c });
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const pantry = bound.planner.preparePantry([entry({ amount: amount("4") })]); assert.equal(pantry.outcome, "prepared"); if (pantry.outcome !== "prepared") return;
  const request = { ...f.request, selectedDays: [f.request.selectedDays[0]], pantry: pantry.pantry }, assignments = f.assignments.filter(row => row.date === request.selectedDays[0]), result = bound.planner.evaluateJoined(assignments, request);
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.deepEqual(result.quote.rows[0]!.ownedUsed, amount("350")); assert.deepEqual(result.quote.ownedRemaining[0]!.quantity, amount("50")); assert.equal(result.quote.uniqueBuyItemCount, 0);
  assert.deepEqual(result.projection.personDays.map(row => row.nutrition.totals!.protein_g.min), [amount("90"), amount("120")]); assert.equal(result.productReady, false);
});

test("unconfigured pantry support is held rather than an empty prepared inventory", () => {
  assert.deepEqual(setup().planner.preparePantry([entry()]), { outcome: "held", code: "pantry_intake_not_configured" });
});

test("ambiguous food-specific measures stay held until an explicit compatible fact is selected", () => {
  const c = config(); c.measureFacts.push({ ...c.measureFacts[0]!, id: "second-piece", factor: amount("200") });
  const intake = ready(c); assert.equal(intake.prepare([entry()]).outcome, "held");
  const selected = intake.prepare([entry({ measureFactId: "second-piece" })]); if (selected.outcome !== "prepared") throw new Error("Expected explicit compatible synthetic fact"); assert.equal(selected.pantry[0]!.quantity.numerator, 200);
});

test("fractions aggregate exactly before the numeric quote-port limit is checked", () => {
  const denominator = "9007199254740992", result = ready().prepare([entry({ pantryId: "one", unit: "g", amount: amount("1", denominator) }), entry({ pantryId: "two", unit: "g", amount: amount("9007199254740991", denominator) })]);
  if (result.outcome !== "prepared") throw new Error("Exact combined one gram is representable"); assert.deepEqual(result.pantry[0]!.quantity, { numerator: 1, denominator: 1 });
});

test("one thousand finite container observations remain exact and the limit never silently truncates", () => {
  const intake = ready(), rows = Array.from({ length: 1000 }, (_, i) => entry({ pantryId: "container-" + i, unit: "g", amount: amount("1", "1000") })), result = intake.prepare(rows);
  if (result.outcome !== "prepared") throw new Error("Expected bounded exact observations"); assert.equal(result.records.length, 1000); assert.deepEqual(result.pantry[0]!.quantity, { numerator: 1, denominator: 1 });
  assert.equal(intake.prepare([...rows, entry({ pantryId: "extra" })]).outcome, "error");
});
