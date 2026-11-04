import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { allergySetup as fixture } from "./generated-plan-household-allergies.test-support.ts";
import { existsSync, readFileSync } from "node:fs";
import { CURRENT_REVISED_CATALOG_PIN } from "./generated-plan-catalog.ts";
import { HOUSEHOLD_ALLERGY_POLICY } from "./generated-household-allergies.ts";

test("explicit household-allergy policy evaluates a full two-person week with source review proof", () => {
  const f = fixture(), result = f.planner.evaluateJoined(f.assignments, f.request);
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.match((result as unknown as { allergyBasisSha256: string }).allergyBasisSha256, /^[a-f0-9]{64}$/);
  assert.equal(result.projection.assignments.length, 14); assert.ok(result.projection.assignments.every(a => a.allergenReviewed === false));
  const old = setup().planner.evaluateJoined(f.assignments, f.request); assert.equal(old.outcome, "held");
  const none = { ...f.request, people: f.request.people.map(p => ({ ...p, exclusions: { kind: "none" } })) };
  const defaultResult = setup().planner.evaluateJoined(f.assignments, none);
  assert.deepEqual(f.planner.evaluateJoined(f.assignments, none), defaultResult);
});

test("another person's meal containing the declared allergen is rejected household-wide", () => {
  const f = fixture(), assignments = f.assignments.map(a => a.assignmentId === f.target.assignmentId ? { ...a, recipeId: "b", recipeSha256: f.rows[1]!.recipe_sha256 } : a);
  const result = f.planner.evaluateJoined(assignments, f.request); assert.equal(result.outcome, "no_fit");
  if (result.outcome === "no_fit") assert.ok(result.reasons.some(r => r.code === "household_allergen_excluded" && r.personId === "p2" && r.assignmentId === f.target.assignmentId));
});

test("allergen purchase form rejects even when real numeric pantry covers every gram", () => {
  const f = fixture(); f.configuration.householdAllergies.purchaseFacts[0]!.status = "contains";
  const bound = createJoinedReferencePlanner(f.bytes, f.configuration); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const request = { ...f.request, pantry: [{ skuId: "buy-a", unit: "g", formDigest: "d".repeat(64), quantity: { numerator: 100000, denominator: 1 } }] };
  const result = bound.planner.evaluateJoined(f.assignments, request); assert.equal(result.outcome, "no_fit");
  if (result.outcome === "no_fit") assert.ok(result.reasons.some(r => r.code === "household_allergen_excluded"));
});

test("unreviewed ingredient/purchase facts and unsupported declarations never produce partial plans", () => {
  const f = fixture();
  for (const field of ["ingredientFacts", "purchaseFacts"] as const) {
    const configuration = structuredClone(f.configuration); configuration.householdAllergies[field] = [];
    const bound = createJoinedReferencePlanner(f.bytes, configuration); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") continue;
    const result = bound.planner.evaluateJoined(f.assignments, f.request); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.reasons.some(r => r.code === "household_allergy_review_required"));
  }
  for (const exclusions of [{ kind: "unmapped", text: "custom allergy" }, { kind: "unknown" }, { kind: "mapped", ingredientIds: ["onion"], allergenIds: [], mappingRevision: 1, scope: "person" }]) {
    const request = { ...f.request, people: [{ ...f.request.people[0], exclusions }, f.request.people[1]] };
    assert.equal(f.planner.evaluateJoined(f.assignments, request).outcome, "held");
  }
});

test("person-only replacement alternatives and preview reject household allergy violations", () => {
  const f = fixture(), before = structuredClone(f.assignments);
  assert.equal(f.planner.previewReplacement(f.assignments, f.request, f.intent).outcome, "no_fit");
  const result = f.planner.findReplacements(f.assignments, f.request, { personId: "p2", assignmentId: f.target.assignmentId, expectedRecipeSha256: f.target.recipeSha256, candidates: [{ recipeId: "b", sourceServings: f.target.sourceServings }], maxEvaluations: 8, limit: 8 });
  assert.equal(result.outcome, "alternatives"); if (result.outcome === "alternatives") { assert.equal(result.candidates.length, 0); assert.equal(result.excluded[0]!.result.outcome, "no_fit"); }
  assert.deepEqual(f.assignments, before);
});

test("deterministic search cannot select cheap allergenic food over a reviewed household-compatible meal", () => {
  const f = fixture(), request = { ...f.request, selectedDays: [f.request.selectedDays[0]!] };
  const grid = { recipeIds: ["a", "b"], portionsByPerson: [{ personId: "p1", profileRevision: 1, sourceServings: [{ numerator: "3", denominator: "1" }] }, { personId: "p2", profileRevision: 1, sourceServings: [{ numerator: "4", denominator: "1" }] }], maxRecipeUsesPerPerson: 1, maxEvaluations: 8, seed: "household-allergy-grid" };
  const result = f.planner.planJoined(request, grid); assert.equal(result.outcome, "success"); if (result.outcome === "success") assert.ok(result.projection.assignments.every(a => a.recipeId === "a"));
  assert.deepEqual(f.planner.planJoined(request, grid), result);
});

test("changed allergen review proof invalidates a previously valid replacement confirmation", () => {
  const f = fixture(false), preview = f.planner.previewReplacement(f.assignments, f.request, f.intent); assert.equal(preview.outcome, "preview"); if (preview.outcome !== "preview") return;
  const confirmation = { intent: f.intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256 };
  assert.equal(f.planner.confirmReplacement(f.assignments, f.request, confirmation).outcome, "proposal");
  const configuration = structuredClone(f.configuration); configuration.householdAllergies.ingredientFacts[1]!.sourceSha256 = "e".repeat(64);
  const revised = createJoinedReferencePlanner(f.bytes, configuration); assert.equal(revised.outcome, "ready"); if (revised.outcome !== "ready") return;
  assert.deepEqual(revised.planner.confirmReplacement(f.assignments, f.request, confirmation), { outcome: "error", code: "stale_replacement_preview" });
});

test("trusted review snapshots, source mismatch and person revision fences remain effective", () => {
  const f = fixture(), before = f.planner.evaluateJoined(f.assignments, f.request);
  f.configuration.householdAllergies.ingredientFacts[0]!.status = "contains";
  assert.deepEqual(f.planner.evaluateJoined(f.assignments, f.request), before);
  const changed = structuredClone(f.configuration); changed.householdAllergies.sourceSha256 = "0".repeat(64); assert.equal(createJoinedReferencePlanner(f.bytes, changed).outcome, "error");
  const people = structuredClone(f.request.people); people[0]!.profileRevision = 2;
  assert.deepEqual(f.planner.evaluateJoined(f.assignments, { ...f.request, people }), { outcome: "error", code: "stale_profile" });
});

const currentCatalog = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl";
test("actual1300source hints never supply missing approved allergen facts", { skip: !existsSync(currentCatalog) && "Exact current source unavailable, not actual evidence" }, () => {
  const source = readFileSync(currentCatalog), first = JSON.parse(source.toString("utf8").split("\n")[0]!);
  const bound = createJoinedReferencePlanner(source, { correspondences: [], regionalPackFacts: [], householdAllergies: { policy: HOUSEHOLD_ALLERGY_POLICY, sourceSha256: CURRENT_REVISED_CATALOG_PIN.sha256, knownAllergenIds: ["milk"], ingredientFacts: [], purchaseFacts: [] } });
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const request = { people: [{ personId: "actual-source-private-probe", profileRevision: 1, label: "Synthetic person", proteinGoal: { kind: "known", gramsPerDay: "1", coverage: "selected-meals" }, exclusions: { kind: "mapped", ingredientIds: [], allergenIds: ["milk"], mappingRevision: 1, scope: "household" } }], selectedDays: ["2026-10-19"], slots: [first.sections[0]], region: "South", storeIds: ["unchanged-store"], budgetCents: 10000, asOfDate: "2026-10-19", equipment: first.recipe.equipment, pantry: [] };
  const result = bound.planner.evaluateJoined([{ assignmentId: "actual-probe", personId: request.people[0]!.personId, profileRevision: 1, date: request.selectedDays[0], slot: first.sections[0], recipeId: first.id, recipeSha256: first.recipe_sha256, sourceServings: { numerator: "1", denominator: "1" } }], request);
  assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.reasons.some(r => r.code === "household_allergy_review_required"));
});
