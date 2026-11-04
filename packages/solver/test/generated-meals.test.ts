import test from "node:test";
import assert from "node:assert/strict";
import { createGeneratedMealPlanner, GENERATED_REGIONS, type GeneratedPlanRequest } from "../src/generated-meals.ts";
import { decimal, add, compare, multiply, divide, zero, floorScaled, ceilScaled } from "../src/generated-meal-ranges.ts";

function fixture() {
  return { schema: "wd-generated-planner-catalog-v1", regions: [...GENERATED_REGIONS], sourceRecipesSha256: "a".repeat(64), sourceFactsSha256: "b".repeat(64), budgetBasis: "fractional-ingredient-allocation", wholePackCheckoutSupported: false, productAccepted: false, plannerMode: "local-reference", limitations: ["synthetic test fixture"],
    meals: Array.from({ length: 12 }, (_, i) => {
      const ingredient = { id: `food-${i}`, name: `Food ${i}`, quantity: "200", unit: "g", state: "raw edible", allergens: i % 2 ? ["soy"] : [], allocations: [{ phase: "main", quantity: "200", unit: "g" }] };
      const prices = Object.fromEntries(GENERATED_REGIONS.map(r => [r, { min: "2", max: "4", source: { kind: "synthetic-test" }, flags: ["uncertain-test-price"] }]));
      return { id: `meal-${i}`, originalRecipeHash: `${i}`.padStart(64, "0"), predecessorHash: "c".repeat(64),
        originalRecipe: { id: `meal-${i}`, title: `Meal ${i}`, family_id: `family-${i}`, servings: 2, ingredients: [ingredient], equipment: ["pan"], method: [{ number: 1, instruction: "Original instruction remains unchanged.", equipment: ["pan"] }], allergen_hints: ingredient.allergens, row_sha256: `${i}`.padStart(64, "0"), planner_eligible: false, kitchen_tested: false, estimated_time_minutes: { elapsed_max: 20 } },
        nutritionPerServing: { protein_g: { min: "35", max: "40" }, kcal: { min: "500", max: "600" }, fat_g: { min: "10", max: "15" }, carbs_g: { min: "30", max: "40" } }, nutritionFlags: ["input-nutrition-only"],
        lines: [{ ingredient: { ...ingredient, signature: `signature-${i}` }, utility_excluded: false, purchase: { min: "250", max: "250", unit: "g", yield: { min: "0.8", max: "0.8" } }, regions: prices, flags: ["uncertain-test-price"] }],
        costPerServing: Object.fromEntries(GENERATED_REGIONS.map(r => [r, { min: "1", max: "2" }])), flags: ["uncertain-test-price"], productAccepted: false, kitchenVerified: false, allergyVerified: false };
    }) };
}
const request = (changes: Partial<GeneratedPlanRequest> = {}): GeneratedPlanRequest => ({ region: "South", days: 7, mealsPerDay: 1, household: 1, proteinTargetsG: ["35"], budgetCents: 2000, equipment: ["pan"], ...changes });

test("legacy request unknown own keys are not silently ignored", () => {
  const planner = createGeneratedMealPlanner(fixture());
  const extras: Record<string, unknown> = { pantry: [], people: [], calories: 2000, startDate: "2026-10-18", preferredStorez: [], unknownUndefined: undefined };
  for (const [key, value] of Object.entries(extras)) {
    const input = Object.assign(request(), { [key]: value });
    assert.throws(() => planner.plan(input), { message: "Invalid generated plan request" }, key);
    assert.throws(() => planner.evaluate([["meal-0"]], { ...input, days: 1 }), { message: "Invalid generated plan request" }, key);
  }
  const hidden = Object.defineProperty(request(), "pantry", { value: [], enumerable: false });
  assert.throws(() => planner.plan(hidden), { message: "Invalid generated plan request" });
  const symbolic = Object.assign(request(), { [Symbol("unsupported")]: [] });
  assert.throws(() => planner.plan(symbolic), { message: "Invalid generated plan request" });
  let reads = 0;
  const getter = Object.defineProperty(request(), "pantry", { enumerable: true, get() { reads++; throw new Error("Unsupported getter ran"); } });
  assert.throws(() => planner.plan(getter), { message: "Invalid generated plan request" });
  assert.equal(reads, 0, "unsupported own keys must be refused before cloning can read their values");
});

test("legacy optional request fields remain supported", () => {
  const planner = createGeneratedMealPlanner(fixture());
  const input = request({ days: 1, excludedIngredientIds: ["food-11"], excludedAllergenHints: ["soy"], maxElapsedMinutes: 20, seed: 3, preferredStores: ["synthetic-store-preference"] });
  const result = planner.plan(input);
  assert.equal(result.status, "planned-reference-week");
  assert.deepEqual(result.week!.request, input);
  assert.equal(planner.plan(request({ days: 1 })).status, "planned-reference-week");
});

test("legacy request validation preserves request and catalog inputs", () => {
  const source = fixture(), input = request({ days: 1, seed: 1 });
  const beforeSource = JSON.stringify(source), beforeInput = JSON.stringify(input);
  Object.freeze(input.equipment); Object.freeze(input.proteinTargetsG); Object.freeze(input);
  const planner = createGeneratedMealPlanner(source), first = planner.plan(input);
  assert.deepEqual(planner.plan(input), first);
  assert.equal(JSON.stringify(input), beforeInput);
  assert.equal(JSON.stringify(source), beforeSource);
});

test("generated catalog plans a deterministic seven-day main-meal week", () => {
  const source = fixture(), planner = createGeneratedMealPlanner(source), before = JSON.stringify(source);
  const a = planner.plan(request()), b = planner.plan(request());
  assert.deepEqual(a, b); assert.equal(a.status, "planned-reference-week"); assert.equal(a.week?.days.length, 7);
  assert.equal(a.week?.ingredientAllocationCost.maxCents, 1400); assert.equal(a.week?.wholePackBudgetVerified, false);
  assert.equal(a.week?.wholePackCheckoutCost, null); assert.equal(a.week?.productAccepted, false);
  assert.equal(JSON.stringify(source), before);
  assert.ok(a.week?.flags.includes("uncertain-test-price"));
});

test("household scaling changes grocery purchase and costs without changing per-person nutrition", () => {
  const planner = createGeneratedMealPlanner(fixture());
  const a = planner.plan(request({ days: 1 })).week!;
  const b = planner.plan(request({ days: 1, household: 2, proteinTargetsG: ["30", "35"] })).week!;
  assert.equal(a.days[0]!.nutritionPerPerson.protein_g.min, b.days[0]!.nutritionPerPerson.protein_g.min);
  assert.equal(a.list[0]!.purchaseQuantity.min, "125"); assert.equal(b.list[0]!.purchaseQuantity.min, "250");
  assert.equal(a.days[0]!.meals[0]!.ingredientsForHousehold[0]!.quantity.min, "100");
  assert.equal(b.days[0]!.meals[0]!.ingredientsForHousehold[0]!.quantity.min, "200");
  assert.equal(a.days[0]!.meals[0]!.methodScalingRequired, true);
  assert.equal(b.days[0]!.meals[0]!.methodScalingRequired, false);
  assert.equal(b.ingredientAllocationCost.maxCents, a.ingredientAllocationCost.maxCents * 2);
});

test("equipment, exclusions, protein and budget failures remain explicit", () => {
  const planner = createGeneratedMealPlanner(fixture());
  assert.equal(planner.plan(request({ equipment: [] })).status, "no-compatible-meals");
  assert.equal(planner.plan(request({ proteinTargetsG: ["90"] })).status, "constraints-unmet");
  const lowBudget = planner.plan(request({ budgetCents: 1 }));
  assert.equal(lowBudget.week?.referenceConstraintsSatisfied, false); assert.ok(lowBudget.week?.violations.includes("ingredient-allocation-budget"));
  const noSoy = planner.plan(request({ days: 5, excludedAllergenHints: ["soy"] })).week!;
  assert.ok(noSoy.days.flatMap(d => d.meals).every(m => !m.originalRecipe.allergen_hints.includes("soy")));
});

test("replacement recalculates full week and keeps all other slots and originals", () => {
  const planner = createGeneratedMealPlanner(fixture()), week = planner.plan(request()).week!, saved = JSON.stringify(week);
  const results = planner.replacements(week, 2, 0, 3);
  assert.equal(results.length, 3);
  for (const result of results) {
    assert.equal(result.week.referenceConstraintsSatisfied, true);
    assert.deepEqual(result.week, planner.evaluate(result.week.selection, week.request));
    for (let day = 0; day < 7; day++) if (day !== 2) assert.deepEqual(result.week.selection[day], week.selection[day]);
    assert.equal(result.week.days[2]!.meals[0]!.originalRecipe.method[0]!.instruction, "Original instruction remains unchanged.");
  }
  assert.equal(JSON.stringify(week), saved);
});

test("foreign source weeks, invalid ranges and malformed quantities refuse", () => {
  const source = fixture(); source.meals[0]!.lines[0]!.purchase.min = "0";
  assert.throws(() => createGeneratedMealPlanner(source));
  const planner = createGeneratedMealPlanner(fixture()), week = planner.plan(request()).week!;
  assert.throws(() => planner.replace({ ...week, sourceRecipesSha256: "d".repeat(64) }, 0, 0, "meal-1"));
  assert.throws(() => planner.plan(request({ household: 2 })));
  assert.throws(() => planner.plan(request({ proteinTargetsG: ["NaN"] })));
  assert.throws(() => planner.plan(request({ excludedAllergenHints: ["unrecognized-allergen"] })), /explicit mapping/);
});

test("original long cooking instructions survive without truncation", () => {
  const source = fixture(), text = "Original measured cooking instruction. ".repeat(30);
  source.meals[0]!.originalRecipe.method[0]!.instruction = text;
  const planner = createGeneratedMealPlanner(source);
  const week = planner.evaluate([["meal-0"]], request({ days: 1 }));
  assert.equal(week.days[0]!.meals[0]!.originalRecipe.method[0]!.instruction, text);
});

test("seed cannot spend beyond a feasible cheapest reference week", () => {
  const source = fixture();
  source.meals.forEach((m, i) => {
    const cost = i === 0 ? "1" : "1.02";
    m.costPerServing = Object.fromEntries(GENERATED_REGIONS.map(r => [r, { min: cost, max: cost }]));
    m.lines[0]!.regions = Object.fromEntries(GENERATED_REGIONS.map(r => [r, { min: String(Number(cost) * 2), max: String(Number(cost) * 2), source: { kind: "synthetic-test" }, flags: ["uncertain-test-price"] }]));
  });
  const result = createGeneratedMealPlanner(source).plan(request({ days: 1, budgetCents: 100, seed: 1 }));
  assert.equal(result.status, "planned-reference-week"); assert.equal(result.week!.ingredientAllocationCost.maxCents, 100);
  assert.equal(result.week!.request.seed, 1);
});

test("replacement retains unique recipes and standing protein tolerance", () => {
  const source = fixture(); source.meals[11]!.nutritionPerServing.protein_g = { min: "80", max: "85" };
  const planner = createGeneratedMealPlanner(source), week = planner.plan(request()).week!;
  const duplicate = planner.replace(week, 1, 0, week.selection[0]![0]!);
  assert.equal(duplicate.referenceConstraintsSatisfied, false); assert.ok(duplicate.violations.includes("duplicate-recipe"));
  const largeChange = planner.replace(week, 1, 0, "meal-11");
  assert.equal(largeChange.referenceConstraintsSatisfied, false); assert.ok(largeChange.violations.includes("replacement-protein-tolerance"));
});

test("compact line references preserve values and isolate later input mutation", () => {
  const source = fixture();
  const registry = Object.fromEntries(source.meals.map(m => [m.id, m.lines[0]!]));
  const compact = { ...source, ingredientLines: registry, meals: source.meals.map(m => ({ ...m, lines: [m.id] })) };
  const planner = createGeneratedMealPlanner(compact), expected = createGeneratedMealPlanner(source).plan(request());
  registry["meal-0"]!.purchase.min = "0";
  assert.deepEqual(planner.plan(request()), expected);
  assert.throws(() => createGeneratedMealPlanner({ ...compact, ingredientLines: {} }), /reference unavailable/);
});

test("exact arithmetic domain preserves scaling, addition order and cent bounds", () => {
  for (let a = 1; a <= 80; a++) for (let b = 1; b <= 30; b++) {
    const x = divide(decimal(String(a)), decimal("100")), y = divide(decimal(String(b)), decimal("7"));
    assert.equal(compare(add(x, y), add(y, x)), 0);
    assert.equal(compare(divide(multiply(x, y), y), x), 0);
    assert.equal(compare(add(x, zero()), x), 0);
    assert.ok(floorScaled(y, 100) <= ceilScaled(y, 100));
  }
  assert.equal(floorScaled(decimal("0.005"), 100), 0); assert.equal(ceilScaled(decimal("0.005"), 100), 1);
});
