import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function stable(value: unknown): unknown { if (Array.isArray(value)) return value.map(stable); if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, nested]) => [key, stable(nested)])); return value; }
function setup(held = false) {
  const rows = ["a", "b"].map(id => {
    const recipe = { title: "Synthetic " + id, servings: 2, equipment: ["fixture-pan"], ingredients: [{ id: "food-" + id, name: "Synthetic only", quantity: id === "a" ? "100" : "200", unit: "g", state: "raw" }], steps: [{ id: 1, instruction: "Original synthetic instruction.", allocations: [{ id: "food-" + id, quantity: id === "a" ? "100" : "200", unit: "g" }] }] }, recipeHash = sha(JSON.stringify(stable(recipe)));
    const values = (scale: number) => ({ protein_g: { min: String(30 * scale), max: String(32 * scale) }, kcal: { min: String(250 * scale), max: String(270 * scale) }, carbs_g: { min: String(20 * scale), max: String(22 * scale) }, fat_g: { min: String(6 * scale), max: String(7 * scale) } });
    return { id, recipe, recipe_sha256: recipeHash, kind: "main", sections: ["lunch", "dinner"], product_accepted: false, kitchen_tested: false, allergen_reviewed: false, regional_costs: null, image: null, flags: ["synthetic-only"], holds: [], nutrition: { status: held && id === "b" ? "held-incomplete" : "complete-conditional-USDA-input-estimate", flags: ["fixture-input-estimate"], missing_ingredients: held && id === "b" ? ["food-b"] : [], whole_batch: held && id === "b" ? null : values(2), per_serving: held && id === "b" ? null : values(1), partial_whole_batch: values(2), servings: "2", source_refresh: { exact_recipe_body_sha256: recipeHash, recipe_sha256_unchanged: recipeHash, source_archive_sha256: "c".repeat(64) } } };
  });
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n"), correspondences = ["a", "b"].map(id => ({ id: "map-" + id, ingredientId: "food-" + id, preparedState: "raw", consumedUnit: "g", skuId: "buy-" + id, purchaseState: "raw", purchaseUnit: "g", formDigest: "d".repeat(64), category: "pantry", perishable: false, factor: { min: amount("1"), max: amount("1") }, sourceSha256: "e".repeat(64) }));
  const prices = ["a", "b"].map(id => ({ id: "pack-" + id, skuId: "buy-" + id, unit: "g", formDigest: "d".repeat(64), region: "South", packQuantity: amount("500"), packPriceCents: id === "a" ? { min: 900, max: 1000 } : { min: 100, max: 200 }, currency: "USD", observedOn: "2026-10-01", usableThrough: "2026-10-31", sourceSha256: "f".repeat(64), basis: "synthetic-test-only", flags: ["not-market-data"] }));
  const bound = createJoinedReferencePlanner(bytes, { sourcePin: { sha256: sha(bytes), recordCount: 2 }, correspondences, regionalPackFacts: prices });
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw new Error("Expected synthetic binding");
  const people = [{ personId: "p1", label: "Fixture1", profileRevision: 1, proteinGoal: { kind: "known", gramsPerDay: "90", coverage: "selected-meals" }, exclusions: { kind: "none" } }, { personId: "p2", label: "Fixture2", profileRevision: 1, proteinGoal: { kind: "known", gramsPerDay: "120", coverage: "selected-meals" }, exclusions: { kind: "none" } }];
  const request = { people, selectedDays: Array.from({ length: 7 }, (_, i) => "2026-10-" + String(19 + i)), slots: ["dinner"], region: "South", storeIds: ["fixture-shop"], budgetCents: 10000, asOfDate: "2026-10-18", equipment: ["fixture-pan"], pantry: [] };
  const assignments = request.selectedDays.flatMap(date => people.map((person, i) => ({ assignmentId: person.personId + date, personId: person.personId, profileRevision: 1, date, slot: "dinner", recipeId: "a", recipeSha256: rows[0]!.recipe_sha256, sourceServings: amount(String(i + 3)) })));
  return { planner: bound.planner, request, assignments, rows };
}

test("standing swap tolerance cannot be bypassed by keeping the day above its lower goal", () => {
  const { planner, request, assignments } = setup();
  const result = planner.previewReplacement(assignments, request, { assignmentId: assignments[0]!.assignmentId, personId: "p1", expectedRecipeSha256: assignments[0]!.recipeSha256, replacementRecipeId: "b", sourceServings: amount("10") });
  assert.equal(result.outcome, "no_fit");
  if (result.outcome === "no_fit") assert.ok(result.reasons.some(reason => reason.code === "replacement_protein_tolerance_exceeded"));
});

test("one reference evaluator connects unequal person goals, full week, source portions and household packs", () => {
  const { planner, request, assignments } = setup(), result = planner.evaluateJoined(assignments, request);
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.mode, "private-conditional-reference-only"); assert.equal(result.contract, "wd-joined-plan-draft-v1"); assert.equal(result.productReady, false);
  assert.equal(result.projection.personDays.length, 14); assert.equal(result.quote.rows[0]!.packCount, 5); assert.deepEqual(result.quote.estimatedTotalCents, { min: 4500, max: 5000 });
  assert.deepEqual(result.projection.personDays[0]!.nutrition.totals!.protein_g.min, amount("90"));
});

test("constraint failures are no-fit only for evaluated assignments and never install a rejected week", () => {
  const { planner, request, assignments } = setup();
  for (const [modified, code] of [[{ ...request, budgetCents: 1 }, "budget_upper_estimate_exceeded"], [{ ...request, equipment: [] }, "equipment_unavailable"], [{ ...request, people: request.people.map(person => ({ ...person, proteinGoal: { ...person.proteinGoal, gramsPerDay: "150" } })) }, "protein_goal_not_met"]] as const) {
    const result = planner.evaluateJoined(assignments, modified); assert.equal(result.outcome, "no_fit"); if (result.outcome === "no_fit") { assert.ok(result.reasons.some(reason => reason.code === code)); assert.equal(result.scope, "evaluated-assignments-only"); assert.equal(result.week, null); }
  }
});

test("missing schedule, foreign sources and unsupported input fail before quoting", () => {
  const { planner, request, assignments } = setup();
  assert.deepEqual(planner.evaluateJoined(assignments.slice(1), request), { outcome: "error", code: "incomplete_selected_schedule" });
  assert.equal(planner.evaluateJoined([{ ...assignments[0], recipeSha256: "0".repeat(64) }, ...assignments.slice(1)], request).outcome, "error");
  for (const changes of [{ expectedSavings: 0.08 }, { selectedDays: ["2026-02-30"] }, { selectedDays: ["2026-10-19", "2026-11-19"] }, { slots: ["snack"] }, { selectedDays: new Array(1) }]) assert.equal(planner.evaluateJoined(assignments, { ...request, ...changes }).outcome, "error");
});

test("Unknown/full-day/calorie/custom exclusion constraints stay held rather than guessed", () => {
  const { planner, request, assignments } = setup();
  for (const changes of [{ proteinGoal: { kind: "unknown" } }, { proteinGoal: { kind: "known", gramsPerDay: "90", coverage: "full-day" } }, { calorieGoal: { kind: "known", kcalPerDay: "2000", coverage: "selected-meals" } }, { exclusions: { kind: "unmapped", text: "custom" } }]) {
    const result = planner.evaluateJoined(assignments, { ...request, people: [{ ...request.people[0], ...changes }, request.people[1]] }); assert.equal(result.outcome, "held");
  }
});

test("incomplete source macros cannot become a successfully evaluated plan", () => {
  const { planner, request, assignments, rows } = setup(true), result = planner.evaluateJoined([{ ...assignments[0], recipeId: "b", recipeSha256: rows[1]!.recipe_sha256 }, ...assignments.slice(1)], request);
  assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.reasons.some(reason => reason.code === "incomplete_nutrition"));
});

test("person-only replacement previews actual added groceries and all other assignments remain byte-equivalent", () => {
  const { planner, request, assignments } = setup(), before = JSON.stringify({ request, assignments });
  const preview = planner.previewReplacement(assignments, request, { assignmentId: assignments[0]!.assignmentId, personId: "p1", expectedRecipeSha256: assignments[0]!.recipeSha256, replacementRecipeId: "b", sourceServings: amount("3") });
  assert.equal(preview.outcome, "preview"); if (preview.outcome !== "preview") return;
  assert.deepEqual(preview.addedBuyIds, ["buy-b"]); assert.deepEqual(preview.removedBuyIds, []); assert.equal(preview.itemCountDelta, 1); assert.equal(preview.confirmationRequired, true); assert.equal(preview.saved, false);
  assert.equal(preview.after.quote.estimatedTotalCents.max, 5200); assert.equal(preview.before.quote.estimatedTotalCents.max, 5000);
  for (const original of preview.before.projection.assignments.slice(1)) assert.deepEqual(preview.after.projection.assignments.find(value => value.assignmentId === original.assignmentId), original);
  assert.equal(JSON.stringify({ request, assignments }), before);
});

test("replacement may reduce total or item count, but cannot target another person or stale source", () => {
  const { planner, request, assignments } = setup(), input = { ...request, people: [request.people[0]], selectedDays: [request.selectedDays[0]] }, selected = [assignments[0]];
  const intent = { assignmentId: assignments[0]!.assignmentId, personId: "p1", expectedRecipeSha256: assignments[0]!.recipeSha256, replacementRecipeId: "b", sourceServings: amount("3") };
  const result = planner.previewReplacement(selected, input, intent); assert.equal(result.outcome, "preview");
  if (result.outcome === "preview") { assert.deepEqual(result.removedBuyIds, ["buy-a"]); assert.ok(result.after.quote.estimatedTotalCents.max < result.before.quote.estimatedTotalCents.max); }
  assert.deepEqual(planner.previewReplacement(selected, input, { ...intent, personId: "p2" }), { outcome: "error", code: "replacement_subject_mismatch" });
  assert.deepEqual(planner.previewReplacement(selected, input, { ...intent, expectedRecipeSha256: "0".repeat(64) }), { outcome: "error", code: "stale_replacement_source" });
});

test("request and assignment reorder preserve deterministic evaluation and hashes", () => {
  const { planner, request, assignments } = setup(), result = planner.evaluateJoined(assignments, request);
  assert.deepEqual(planner.evaluateJoined([...assignments].reverse(), { ...request, people: [...request.people].reverse(), selectedDays: [...request.selectedDays].reverse() }), result);
});

test("registry snapshots refuse getters and executable data without invoking it", () => {
  let reads = 0;
  const configured = Object.defineProperty({}, "price", { enumerable: true, get() { reads++; return 100; } });
  const source = Buffer.from("not-a-source");
  // A valid source is needed to reach registry snapshotting; reuse fixture bytes
  // reconstructed from the unchanged source rows, not a fake readiness flag.
  const { rows } = setup(), bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n");
  const result = createJoinedReferencePlanner(bytes, { sourcePin: { sha256: sha(bytes), recordCount: 2 }, correspondences: [configured], regionalPackFacts: [] });
  assert.deepEqual(result, { outcome: "error", code: "invalid_planner_configuration" }); assert.equal(reads, 0);
  assert.equal(createJoinedReferencePlanner(source, { correspondences: [], regionalPackFacts: [] }).outcome, "error");
});
