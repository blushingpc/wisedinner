// Synthetic allergy-review fixtures only. No actual food/source certification.
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { HOUSEHOLD_ALLERGY_POLICY } from "./generated-household-allergies.ts";
export function allergySetup(bContains = true) {
  const f = setup();
  const householdAllergies = { policy: HOUSEHOLD_ALLERGY_POLICY, sourceSha256: f.configuration.sourcePin.sha256, knownAllergenIds: ["milk"], ingredientFacts: ["a", "b"].map(id => ({ id: "ingredient-" + id, ingredientId: "food-" + id, preparedState: "raw", baseUnit: "g", allergenId: "milk", status: id === "b" && bContains ? "contains" : "not-declared", sourceSha256: "a".repeat(64) })), purchaseFacts: ["a", "b"].map(id => ({ id: "purchase-" + id, skuId: "buy-" + id, unit: "g", formDigest: "d".repeat(64), allergenId: "milk", status: "not-declared", sourceSha256: "b".repeat(64) })) };
  const request = { ...f.request, people: f.request.people.map((p, i) => i === 0 ? { ...p, exclusions: { kind: "mapped", ingredientIds: [], allergenIds: ["milk"], mappingRevision: 1, scope: "person" } } : p) };
  const configuration = { ...f.configuration, householdAllergies };
  const bound = createJoinedReferencePlanner(f.bytes, configuration);
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw Error("Explicit synthetic allergy policy should bind");
  const target = f.assignments.find(a => a.personId === "p2")!;
  const intent = { assignmentId: target.assignmentId, personId: target.personId, expectedRecipeSha256: target.recipeSha256, replacementRecipeId: "b", sourceServings: target.sourceServings };
  return { ...f, request, configuration, planner: bound.planner, target, intent };
}
