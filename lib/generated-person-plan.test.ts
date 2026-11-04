import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { createRevisedAssignmentProjector, type AssignmentProjectionOutcome } from "./generated-person-plan.ts";
import { CURRENT_REVISED_CATALOG_PIN } from "./generated-plan-catalog.ts";
import { aggregateRequirements } from "../packages/solver/src/generated-plan-requirements.ts";

const amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, nested]) => [key, stable(nested)]));
  return value;
}
function row(id = "fixture-recipe", held = false) {
  const recipe = { title: "Synthetic only", servings: 2, equipment: ["fixture-pan"], ingredients: [{ id: "fixture-food", name: "Synthetic food", quantity: "100", unit: "g", state: "edible raw" }, { id: "fixture-salt", name: "Synthetic salt", quantity: "4/5", unit: "g", state: "dry" }], steps: [{ id: 1, instruction: "Original fixture batch instruction for two portions.", allocations: [{ id: "fixture-food", quantity: "100", unit: "g" }, { id: "fixture-salt", quantity: "4/5", unit: "g" }] }] };
  const recipeHash = sha(JSON.stringify(stable(recipe)));
  const macros = (scale: number) => ({ protein_g: { min: String(30 * scale), max: String(32 * scale) }, kcal: { min: String(250 * scale), max: String(260 * scale) }, carbs_g: { min: String(20 * scale), max: String(22 * scale) }, fat_g: { min: String(6 * scale), max: String(7 * scale) } });
  return { id, kind: "main", sections: ["lunch", "dinner"], recipe, recipe_sha256: recipeHash, product_accepted: false, kitchen_tested: false, allergen_reviewed: false, regional_costs: null, image: null, flags: ["synthetic-not-food-data"], holds: [], nutrition: { status: held ? "held-incomplete" : "complete-conditional-USDA-input-estimate", servings: "2", flags: ["fixture-input-estimate"], missing_ingredients: held ? ["fixture-food"] : [], whole_batch: held ? null : macros(2), per_serving: held ? null : macros(1), partial_whole_batch: macros(2), source_refresh: { exact_recipe_body_sha256: recipeHash, recipe_sha256_unchanged: recipeHash, source_archive_sha256: "b".repeat(64) } } };
}
function setup(rows = [row()]) {
  const bytes = Buffer.from(rows.map(value => JSON.stringify(value)).join("\n") + "\n");
  const bound = createRevisedAssignmentProjector(bytes, { sha256: sha(bytes), recordCount: rows.length });
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw new Error("Expected fixture binding");
  return { bytes, project: bound.projectAssignments, rows };
}
const person = (personId = "p1", changes = {}) => ({ personId, profileRevision: 3, label: "Fixture person", proteinGoal: { kind: "known", gramsPerDay: "90", coverage: "selected-meals" }, exclusions: { kind: "none" }, ...changes });
const assignment = (changes = {}) => ({ assignmentId: "a1", personId: "p1", profileRevision: 3, date: "2026-10-19", slot: "dinner", recipeId: "fixture-recipe", recipeSha256: row().recipe_sha256, sourceServings: amount("1"), ...changes });

test("source-bound portions keep people, consumed food and protein distinct", () => {
  const { project, bytes, rows } = setup(), before = sha(bytes);
  const result = project({ people: [person(), person("p2", { proteinGoal: { kind: "known", gramsPerDay: "150", coverage: "selected-meals" } })], assignments: [assignment(), assignment({ assignmentId: "a2", personId: "p2", sourceServings: amount("3", "2") })] });
  assert.equal(result.outcome, "projected"); if (result.outcome !== "projected") return;
  assert.deepEqual(result.assignments[0]!.consumedIngredients[0]!.amount, amount("50"));
  assert.deepEqual(result.assignments[0]!.consumedIngredients[1]!.amount, amount("2", "5"));
  assert.deepEqual(result.assignments[0]!.nutrition.totals!.protein_g.min, amount("30"));
  assert.deepEqual(result.assignments[1]!.consumedIngredients[0]!.amount, amount("75"));
  assert.deepEqual(result.assignments[1]!.nutrition.totals!.protein_g.max, amount("48"));
  assert.deepEqual(result.assignments[0]!.recipe, rows[0]!.recipe);
  assert.deepEqual(result.assignments[0]!.sourceFlags, ["synthetic-not-food-data"]); assert.equal(result.assignments[0]!.kitchenTested, false); assert.equal(result.assignments[0]!.allergenReviewed, false);
  assert.equal(result.preparationScaling, "not-reviewed"); assert.equal(result.goalEligibility, "not-evaluated"); assert.equal(result.practicalMeasures, "held");
  assert.equal(result.productAccepted, false); assert.equal(sha(bytes), before); assert.ok(Object.isFrozen(result.assignments[0]!.recipe));
  const aggregated = aggregateRequirements(result.demands); assert.equal(aggregated.outcome, "success");
  if (aggregated.outcome === "success") assert.deepEqual(aggregated.requirements.find(value => value.ingredientId === "fixture-food")!.quantity, amount("125"));
});

test("assignment changes leave another person's projection unchanged and input order is irrelevant", () => {
  const { project } = setup(), people = [person(), person("p2")], assignments = [assignment(), assignment({ assignmentId: "a2", personId: "p2" })];
  const input = { people, assignments }, before = JSON.stringify(input), result = project(input);
  assert.deepEqual(project({ people: [...people].reverse(), assignments: [...assignments].reverse() }), result);
  const changed = project({ people, assignments: [assignments[0], { ...assignments[1], sourceServings: amount("2") }] });
  if (result.outcome !== "projected" || changed.outcome !== "projected") throw new Error("Expected projections");
  assert.deepEqual(changed.assignments[0], result.assignments[0]); assert.deepEqual(changed.personDays[0], result.personDays[0]); assert.equal(JSON.stringify(input), before);
});

test("assignment identity, person revision and exact recipe pin are enforced", () => {
  const { project } = setup();
  for (const [changes, code] of [
    [{ personId: "removed" }, "person_missing"], [{ profileRevision: 2 }, "stale_profile"], [{ recipeId: "obsolete" }, "recipe_missing"], [{ recipeSha256: "a".repeat(64) }, "recipe_source_mismatch"],
  ] as const) assert.deepEqual(project({ people: [person()], assignments: [assignment(changes)] }), { outcome: "error", code });
  assert.deepEqual(project({ people: [person()], assignments: [assignment(), assignment()] }), { outcome: "error", code: "duplicate_assignment" });
  assert.deepEqual(project({ people: [person()], assignments: [assignment(), assignment({ assignmentId: "a2" })] }), { outcome: "error", code: "duplicate_person_slot" });
});

test("incomplete consumed totals stay null rather than promoting partial or other meal totals", () => {
  const { project } = setup([row(), row("held-recipe", true)]);
  const result = project({ people: [person()], assignments: [assignment(), assignment({ assignmentId: "a2", slot: "lunch", recipeId: "held-recipe" })] });
  assert.equal(result.outcome, "projected"); if (result.outcome !== "projected") return;
  assert.equal(result.assignments[1]!.nutrition.totals, null);
  assert.equal(result.personDays[0]!.nutrition.totals, null);
  assert.deepEqual(result.personDays[0]!.incompleteAssignmentIds, ["a2"]);
  assert.equal(result.assignments[0]!.nutrition.status, "conditional");
});

test("Unknown goals and exclusions remain person-bound constraints, not silent eligibility", () => {
  const { project } = setup(), result = project({ people: [person("p1", { proteinGoal: { kind: "unknown" }, exclusions: { kind: "unmapped", text: "Fixture custom exclusion" } })], assignments: [assignment()] });
  assert.equal(result.outcome, "projected"); if (result.outcome === "projected") {
    assert.deepEqual(result.constraintHolds.map(value => [value.personId, value.code]), [["p1", "exclusion_mapping_required"], ["p1", "goal_required"]]);
    assert.equal(result.goalEligibility, "not-evaluated");
  }
});

test("invalid dates, portions, extra fields and hostile shapes refuse without reading getters", () => {
  const { project } = setup(); let reads = 0;
  const getter = Object.defineProperty(assignment(), "sourceServings", { enumerable: true, get() { reads++; throw new Error("Not evaluated"); } });
  const coercion = { toString() { reads++; return "dinner"; } };
  for (const value of [assignment({ date: "2026-02-29" }), assignment({ slot: "snack" }), assignment({ slot: coercion }), assignment({ sourceServings: amount("0") }), assignment({ sourceServings: amount("1", "0") }), assignment({ unexpected: true }), getter]) assert.equal(project({ people: [person()], assignments: [value] }).outcome, "error");
  for (const assignments of [new Array(1), Object.assign([assignment()], { extra: true }), [Object.assign(assignment(), { [Symbol("extra")]: true })]]) assert.equal(project({ people: [person()], assignments }).outcome, "error");
  assert.equal(project({ people: [person()], assignments: [assignment()], trial: true }).outcome, "error");
  assert.equal(reads, 0);
  assert.equal(project({ people: [person()], assignments: [assignment({ date: "2028-02-29" })] }).outcome, "projected");
});

test("untrusted source bytes never bind even if assignment fields look plausible", () => {
  assert.deepEqual(createRevisedAssignmentProjector(Buffer.from("not-the-current-source")), { outcome: "error", code: "source_hash_mismatch" });
});

test("output quantity capacity matches the connected consumed-demand port", () => {
  const { project } = setup();
  assert.deepEqual(project({ people: [person()], assignments: [assignment({ sourceServings: amount("1" + "0".repeat(119)) })] }), { outcome: "held", code: "projection_quantity_capacity_exceeded" });
});

test("portion arithmetic agrees with independently expected food and macro ranges", () => {
  const { project } = setup();
  for (let numerator = 1; numerator <= 24; numerator++) for (let denominator = 1; denominator <= 9; denominator++) {
    const result = project({ people: [person()], assignments: [assignment({ sourceServings: amount(String(numerator), String(denominator)) })] });
    if (result.outcome !== "projected") throw new Error("Expected bounded projection");
    const food = result.assignments[0]!.consumedIngredients[0]!.amount, protein = result.assignments[0]!.nutrition.totals!.protein_g;
    assert.equal(BigInt(food.numerator) * BigInt(denominator), BigInt(food.denominator) * BigInt(numerator) * BigInt(50));
    assert.equal(BigInt(protein.min.numerator) * BigInt(denominator), BigInt(protein.min.denominator) * BigInt(numerator) * BigInt(30));
    assert.equal(BigInt(protein.max.numerator) * BigInt(denominator), BigInt(protein.max.denominator) * BigInt(numerator) * BigInt(32));
  }
});

const sourcePath = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl";
test("all1300current original sources project without rewriting and preserve five incomplete macro holds", { skip: !existsSync(sourcePath) && "External pinned source unavailable; not current-catalog acceptance" }, () => {
  const bytes = readFileSync(sourcePath), before = sha(bytes), bound = createRevisedAssignmentProjector(bytes);
  assert.equal(before, CURRENT_REVISED_CATALOG_PIN.sha256); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const rows = bytes.toString("utf8").trim().split(/\r?\n/).map(line => JSON.parse(line)); let held = 0;
  for (const source of rows) {
    const result: AssignmentProjectionOutcome = bound.projectAssignments({ people: [person()], assignments: [assignment({ recipeId: source.id, recipeSha256: source.recipe_sha256 })] });
    assert.equal(result.outcome, "projected"); if (result.outcome !== "projected") continue;
    assert.deepEqual(result.assignments[0]!.recipe, source.recipe); assert.equal(result.demands.length, source.recipe.ingredients.length);
    assert.equal(aggregateRequirements(result.demands).outcome, "success");
    if (result.personDays[0]!.nutrition.totals === null) held++;
  }
  assert.equal(rows.length, 1300); assert.equal(held, 5); assert.equal(sha(bytes), before);
});
