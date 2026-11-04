import test from "node:test";
import assert from "node:assert/strict";
import { createHouseholdAllergyGuard, HOUSEHOLD_ALLERGY_POLICY } from "./generated-household-allergies.ts";

const SOURCE = "a".repeat(64), REVIEW = "b".repeat(64), FORM = "c".repeat(64);
const member = (personId = "p1", exclusions: unknown = { kind: "mapped", ingredientIds: [], allergenIds: ["milk"], mappingRevision: 1, scope: "person" }) => ({ personId, profileRevision: 1, label: personId, proteinGoal: { kind: "known", gramsPerDay: "20", coverage: "selected-meals" }, exclusions });
const consumed = (changes = {}) => ({ assignmentId: "a1", personId: "p2", ingredientId: "synthetic-food", preparedState: "synthetic-ready", baseUnit: "g", ...changes });
const purchase = (changes = {}) => ({ skuId: "synthetic-purchase", unit: "g", formDigest: FORM, ...changes });
const ingredientFact = (changes = {}) => ({ id: "ingredient-milk-review", ingredientId: "synthetic-food", preparedState: "synthetic-ready", baseUnit: "g", allergenId: "milk", status: "not-declared", sourceSha256: REVIEW, ...changes });
const purchaseFact = (changes = {}) => ({ id: "purchase-milk-review", skuId: "synthetic-purchase", unit: "g", formDigest: FORM, allergenId: "milk", status: "not-declared", sourceSha256: REVIEW, ...changes });
function config(changes = {}) { return { policy: HOUSEHOLD_ALLERGY_POLICY, sourceSha256: SOURCE, knownAllergenIds: ["milk", "sesame"], ingredientFacts: [ingredientFact()], purchaseFacts: [purchaseFact()], ...changes }; }
function ready(configuration = config()) { const bound = createHouseholdAllergyGuard(configuration, SOURCE); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw Error("Expected synthetic reviewed guard"); return bound; }
const people = () => [member(), member("p2", { kind: "none" })];

test("one person's declared allergy is household-hard even with legacy person scope", () => {
  const guard = ready(), result = guard.check(people(), [consumed()], [purchase()]);
  assert.equal(result.outcome, "allowed"); if (result.outcome !== "allowed") return;
  assert.equal(result.active, true); assert.deepEqual(result.householdAllergenIds, ["milk"]); assert.equal(result.evidence.length, 2); assert.match(result.basisSha256!, /^[a-f0-9]{64}$/); assert.equal(result.crossContactEstablished, false); assert.equal(result.sourceTruthEstablished, false);
  const excluded = ready(config({ ingredientFacts: [ingredientFact({ status: "contains" })] })).check(people(), [consumed()], [purchase()]);
  assert.equal(excluded.outcome, "no_fit"); if (excluded.outcome === "no_fit") { assert.equal(excluded.reasons[0]!.personId, "p2"); assert.equal(excluded.reasons[0]!.assignmentId, "a1"); assert.equal(excluded.reasons[0]!.code, "household_allergen_excluded"); }
});

test("purchase-form allergen cannot pass through pantry-covered or otherwise compatible food", () => {
  const guard = ready(config({ purchaseFacts: [purchaseFact({ status: "contains" })] }));
  assert.equal(guard.check(people(), [consumed()], [purchase()]).outcome, "no_fit");
  // Input is the complete purchase requirement, not only rows still to buy.
  assert.equal(guard.check(people(), [consumed()], [purchase(), purchase()]).outcome, "no_fit");
});

test("missing, unknown and wrong-form review never become inferred allergen absence", () => {
  for (const configuration of [config({ ingredientFacts: [] }), config({ purchaseFacts: [] }), config({ ingredientFacts: [ingredientFact({ status: "unknown" })] }), config({ purchaseFacts: [purchaseFact({ formDigest: "d".repeat(64) })] })]) {
    const result = ready(configuration).check(people(), [consumed()], [purchase()]); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.equal(result.code, "household_allergy_review_required");
  }
  assert.equal(ready().check(people(), [consumed({ preparedState: "cooked" })], [purchase()]).outcome, "held");
});

test("none, unknown, custom, mapped-empty and non-allergy ingredient exclusions are distinct", () => {
  const guard = ready();
  const empty = guard.check([member("p1", { kind: "none" })], [consumed({ personId: "p1" })], [purchase()]);
  assert.equal(empty.outcome, "allowed"); if (empty.outcome === "allowed") { assert.equal(empty.active, false); assert.equal(empty.basisSha256, null); assert.deepEqual(empty.evidence, []); }
  for (const exclusions of [{ kind: "unknown" }, { kind: "unmapped", text: "custom allergy" }, { kind: "mapped", ingredientIds: [], allergenIds: [], mappingRevision: 1, scope: "person" }, { kind: "mapped", ingredientIds: ["onion"], allergenIds: [], mappingRevision: 1, scope: "person" }, { kind: "mapped", ingredientIds: [], allergenIds: ["unrecognized"], mappingRevision: 1, scope: "person" }]) assert.equal(guard.check([member("p1", exclusions)], [], []).outcome, "held");
});

test("whole-household union needs review of every declared allergen, not just first person's", () => {
  const both = [member(), member("p2", { kind: "mapped", ingredientIds: [], allergenIds: ["sesame", "milk"], mappingRevision: 2, scope: "household" })];
  assert.equal(ready().check(both, [consumed()], [purchase()]).outcome, "held");
  const cfg = config({ ingredientFacts: [ingredientFact(), ingredientFact({ id: "ingredient-sesame", allergenId: "sesame" })], purchaseFacts: [purchaseFact(), purchaseFact({ id: "purchase-sesame", allergenId: "sesame" })] });
  const result = ready(cfg).check(both, [consumed()], [purchase()]); assert.equal(result.outcome, "allowed"); if (result.outcome === "allowed") assert.deepEqual(result.householdAllergenIds, ["milk", "sesame"]);
});

test("review/profile/mapping changes bind a new basis without confusing reorder with new people", () => {
  const guard = ready(), original = guard.check(people(), [consumed()], [purchase()]); assert.equal(original.outcome, "allowed");
  assert.deepEqual(guard.check(people().reverse(), [consumed(), consumed()], [purchase(), purchase()]), original);
  const changedPeople = people(); changedPeople[0]!.profileRevision = 2;
  const revised = guard.check(changedPeople, [consumed()], [purchase()]); assert.equal(revised.outcome, "allowed"); if (original.outcome === "allowed" && revised.outcome === "allowed") assert.notEqual(revised.basisSha256, original.basisSha256);
  const changedReview = ready(config({ ingredientFacts: [ingredientFact({ sourceSha256: "e".repeat(64) })] })).check(people(), [consumed()], [purchase()]); if (original.outcome === "allowed" && changedReview.outcome === "allowed") assert.notEqual(changedReview.basisSha256, original.basisSha256);
});

test("wrong source, duplicate or ambiguous facts and unsupported review status refuse at binding", () => {
  assert.equal(createHouseholdAllergyGuard(config(), "f".repeat(64)).outcome, "error");
  for (const c of [config({ policy: "person-allergies" }), config({ knownAllergenIds: ["milk", "milk"] }), config({ ingredientFacts: [ingredientFact(), ingredientFact()] }), config({ ingredientFacts: [ingredientFact(), ingredientFact({ id: "same-food-second-review" })] }), config({ purchaseFacts: [purchaseFact({ status: "certified-safe" })] }), config({ ingredientFacts: [ingredientFact({ allergenId: "not-known" })] }), config({ autoMapCustom: true })]) assert.equal(createHouseholdAllergyGuard(c, SOURCE).outcome, "error");
});

test("caller mutations/getters cannot change a bound review or freeze caller data", () => {
  const c = config(), guard = ready(c), before = guard.check(people(), [consumed()], [purchase()]);
  c.ingredientFacts[0]!.status = "contains"; c.knownAllergenIds.push("new"); assert.deepEqual(guard.check(people(), [consumed()], [purchase()]), before); assert.equal(Object.isFrozen(c.ingredientFacts[0]), false);
  let reads = 0; const bad = Object.defineProperty(config(), "ingredientFacts", { enumerable: true, get() { reads++; throw Error("not invoked"); } }); assert.equal(createHouseholdAllergyGuard(bad, SOURCE).outcome, "error");
  const input = Object.defineProperty(consumed(), "ingredientId", { enumerable: true, get() { reads++; throw Error("not invoked"); } }); assert.equal(guard.check(people(), [input], [purchase()]).outcome, "error"); assert.equal(reads, 0);
});

test("permutations and bounded evidence capacity do not create partial allowed outcomes", () => {
  const guard = ready(), second = consumed({ assignmentId: "a2", personId: "p1" });
  assert.deepEqual(guard.check(people(), [consumed(), second], [purchase()]), guard.check(people().reverse(), [second, consumed()], [purchase()]));
  const result = guard.check(people(), Array.from({ length: 10001 }, (_, i) => consumed({ assignmentId: "a" + i })), []); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.equal(result.code, "household_allergy_review_capacity");
});
