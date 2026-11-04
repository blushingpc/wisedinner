import { createRevisedCatalogReader, CURRENT_REVISED_CATALOG_PIN, type CatalogProjectionOutcome, type RevisedRecipeProjection } from "./generated-plan-catalog.ts";
import { parsePeople, type PersonHold } from "../packages/solver/src/generated-plan-contract.ts";
import { add, decimal, divide, multiply, rational, receipt, zero, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import type { ConsumedDemand } from "../packages/solver/src/generated-plan-requirements.ts";
import { reviewedMethodSourceServings } from "./generated-reviewed-method-lineage.ts";

// An internal consumed-food projection, not a goal/allergy evaluator or public
// route. Trusted source pins belong to server configuration, never client input.
type MacroRanges = NonNullable<RevisedRecipeProjection["nutrition"]["perServing"]>;
type Macro = keyof MacroRanges;
type Nutrition = { readonly status: "conditional" | "held"; readonly totals: MacroRanges | null };
export type MealAssignment = {
  readonly assignmentId: string; readonly personId: string; readonly profileRevision: number;
  readonly date: string; readonly slot: "breakfast" | "lunch" | "dinner";
  readonly recipeId: string; readonly recipeSha256: string; readonly sourceServings: ExactAmount;
};
export type ConsumedAssignment = MealAssignment & {
  readonly recipe: RevisedRecipeProjection["recipe"];
  readonly sourceFlags: readonly string[]; readonly sourceHolds: readonly string[]; readonly kitchenTested: false; readonly allergenReviewed: false;
  readonly consumedIngredients: readonly { readonly ingredientId: string; readonly name: string; readonly preparedState: string; readonly baseUnit: "g" | "ml"; readonly amount: ExactAmount }[];
  readonly nutrition: Nutrition & { readonly flags: readonly string[]; readonly missingIngredients: readonly string[] };
};
export type AssignmentProjectionOutcome =
  | { readonly outcome: "projected"; readonly sourceSha256: string; readonly assignments: readonly ConsumedAssignment[]; readonly demands: readonly ConsumedDemand[]; readonly personDays: readonly { readonly personId: string; readonly date: string; readonly nutrition: Nutrition; readonly incompleteAssignmentIds: readonly string[] }[]; readonly constraintHolds: readonly PersonHold[]; readonly goalEligibility: "not-evaluated"; readonly preparationScaling: "not-reviewed"; readonly practicalMeasures: "held"; readonly productAccepted: false }
  | { readonly outcome: "error"; readonly code: "invalid_assignment_input" | "invalid_people_input" | "duplicate_assignment" | "duplicate_person_slot" | "person_missing" | "stale_profile" | "recipe_missing" | "recipe_source_mismatch" }
  | { readonly outcome: "held"; readonly code: "projection_quantity_capacity_exceeded" | "practical_recipe_portion_not_reviewed" };
export type AssignmentProjectorBinding = Exclude<CatalogProjectionOutcome, { outcome: "success" }> | { readonly outcome: "ready"; readonly catalog: Extract<CatalogProjectionOutcome, { outcome: "success" }>; readonly projectAssignments: (input: unknown) => AssignmentProjectionOutcome };
type Data = Record<string, unknown>;
const MACROS: readonly Macro[] = ["protein_g", "kcal", "carbs_g", "fat_g"];
const FIELDS = ["assignmentId", "personId", "profileRevision", "date", "slot", "recipeId", "recipeSha256", "sourceServings"];
function invalid(): never { throw new Error("Invalid assignment input"); }
function record(value: unknown, fields: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Data = {};
  if (keys.length !== fields.length || fields.some(key => !Object.hasOwn(descriptors, key))) invalid();
  for (const key of keys) {
    if (typeof key !== "string" || !fields.includes(key)) invalid();
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) invalid();
    result[key] = descriptor.value;
  }
  return result;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || !value.length || value.length > 168) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: unknown[] = [];
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) invalid();
  for (let i = 0; i < value.length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid();
    result.push(descriptor.value);
  }
  return result;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function exact(value: unknown, maximum = 240): Rational {
  const fields = record(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof fields[key] !== "string" || fields[key].length > maximum || !/^(0|[1-9]\d*)$/.test(fields[key])) invalid();
  return rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string));
}
function sourceAmount(value: string): Rational {
  if (!value.includes("/")) return decimal(value);
  const [n, d] = value.split("/"); return rational(BigInt(n!), BigInt(d!));
}
function assignment(value: unknown): MealAssignment {
  const fields = record(value, FIELDS), date = text(fields.date), slot = fields.slot, servings = exact(fields.sourceServings, 120);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00.000Z`)) || new Date(`${date}T00:00:00.000Z`).toISOString().slice(0, 10) !== date || typeof slot !== "string" || !["breakfast", "lunch", "dinner"].includes(slot)) invalid();
  if (!Number.isSafeInteger(fields.profileRevision) || (fields.profileRevision as number) < 0 || servings.n === BigInt(0)) invalid();
  const recipeSha256 = text(fields.recipeSha256); if (!/^[a-f0-9]{64}$/.test(recipeSha256)) invalid();
  return { assignmentId: text(fields.assignmentId), personId: text(fields.personId), profileRevision: fields.profileRevision as number, date, slot: slot as MealAssignment["slot"], recipeId: text(fields.recipeId), recipeSha256, sourceServings: receipt(servings) };
}
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function ranges(source: MacroRanges, scale: Rational): MacroRanges {
  return Object.fromEntries(MACROS.map(key => [key, { min: receipt(multiply(exact(source[key].min), scale)), max: receipt(multiply(exact(source[key].max), scale)) }])) as MacroRanges;
}
function sumRanges(a: MacroRanges | null, b: MacroRanges): MacroRanges {
  return Object.fromEntries(MACROS.map(key => [key, { min: receipt(add(a ? exact(a[key].min) : zero(), exact(b[key].min))), max: receipt(add(a ? exact(a[key].max) : zero(), exact(b[key].max))) }])) as MacroRanges;
}
function withinCapacity(value: ExactAmount, digits = 240): boolean { return value.numerator.length <= digits && value.denominator.length <= digits; }

export function createRevisedAssignmentProjector(source: unknown, trustedPin: unknown = CURRENT_REVISED_CATALOG_PIN): AssignmentProjectorBinding {
  const catalog = createRevisedCatalogReader(trustedPin)(source);
  if (catalog.outcome !== "success") return catalog;
  const recipes = new Map(catalog.recipes.map(recipe => [recipe.id, recipe]));
  return Object.freeze({ outcome: "ready", catalog, projectAssignments(input: unknown): AssignmentProjectionOutcome {
    let assignments: MealAssignment[], people: ReturnType<typeof parsePeople>;
    try {
      const fields = record(input, ["people", "assignments"]);
      people = parsePeople(fields.people);
      if (people.outcome === "error") return people;
      assignments = list(fields.assignments).map(assignment).sort((a, b) => order(a.assignmentId, b.assignmentId));
    } catch { return { outcome: "error", code: "invalid_assignment_input" }; }
    const persons = new Map(people.people.map(person => [person.personId, person])), ids = new Set<string>(), slots = new Set<string>();
    const projected: ConsumedAssignment[] = [], demands: ConsumedDemand[] = [];
    const days = new Map<string, { personId: string; date: string; sum: MacroRanges | null; incompleteAssignmentIds: string[] }>();
    for (const current of assignments) {
      if (ids.has(current.assignmentId)) return { outcome: "error", code: "duplicate_assignment" };
      ids.add(current.assignmentId);
      const slot = JSON.stringify([current.personId, current.date, current.slot]);
      if (slots.has(slot)) return { outcome: "error", code: "duplicate_person_slot" };
      slots.add(slot);
      const person = persons.get(current.personId), source = recipes.get(current.recipeId);
      if (!person) return { outcome: "error", code: "person_missing" };
      if (person.profileRevision !== current.profileRevision) return { outcome: "error", code: "stale_profile" };
      if (!source) return { outcome: "error", code: "recipe_missing" };
      if (source.recipeSha256 !== current.recipeSha256) return { outcome: "error", code: "recipe_source_mismatch" };
      const servings = exact(current.sourceServings), portion = divide(servings, rational(BigInt(source.recipe.servings)));
      const practical = reviewedMethodSourceServings(source.source);
      if (practical && !practical.some(value => servings.n === BigInt(value) * servings.d)) return { outcome: "held", code: "practical_recipe_portion_not_reviewed" };
      const consumedIngredients = source.recipe.ingredients.map(ingredient => ({ ingredientId: ingredient.id, name: ingredient.name, preparedState: ingredient.state, baseUnit: ingredient.unit, amount: receipt(multiply(sourceAmount(ingredient.quantity), portion)) }));
      const totals = source.nutrition.perServing ? ranges(source.nutrition.perServing, servings) : null;
      // Downstream consumed-demand receipts accept120digits. Hold at the same
      // boundary rather than returning a projection its connected port rejects.
      if (consumedIngredients.some(ingredient => !withinCapacity(ingredient.amount, 120)) || totals && MACROS.some(key => !withinCapacity(totals[key].min) || !withinCapacity(totals[key].max))) return { outcome: "held", code: "projection_quantity_capacity_exceeded" };
      projected.push({ ...current, recipe: source.recipe, sourceFlags: source.source.flags as readonly string[], sourceHolds: source.source.holds as readonly string[], kitchenTested: false, allergenReviewed: false, consumedIngredients, nutrition: { status: source.nutrition.status, totals, flags: source.nutrition.flags, missingIngredients: source.nutrition.missingIngredients } });
      for (const ingredient of consumedIngredients) demands.push({ assignmentId: current.assignmentId, recipeId: source.id, recipeSha256: source.recipeSha256, ingredientId: ingredient.ingredientId, preparedState: ingredient.preparedState, baseUnit: ingredient.baseUnit, amount: ingredient.amount });
      const key = JSON.stringify([current.personId, current.date]), day = days.get(key) ?? { personId: current.personId, date: current.date, sum: null, incompleteAssignmentIds: [] };
      if (totals) day.sum = sumRanges(day.sum, totals); else day.incompleteAssignmentIds.push(current.assignmentId);
      if (day.sum && MACROS.some(key => !withinCapacity(day.sum![key].min) || !withinCapacity(day.sum![key].max))) return { outcome: "held", code: "projection_quantity_capacity_exceeded" };
      days.set(key, day);
    }
    return freeze({ outcome: "projected", sourceSha256: catalog.sourceSha256, assignments: projected, demands, personDays: [...days].sort(([a], [b]) => order(a, b)).map(([, day]) => ({ personId: day.personId, date: day.date, nutrition: { status: day.incompleteAssignmentIds.length ? "held" as const : "conditional" as const, totals: day.incompleteAssignmentIds.length ? null : day.sum }, incompleteAssignmentIds: day.incompleteAssignmentIds })), constraintHolds: [...people.holds].sort((a, b) => order(JSON.stringify([a.personId, a.code]), JSON.stringify([b.personId, b.code]))), goalEligibility: "not-evaluated", preparationScaling: "not-reviewed", practicalMeasures: "held", productAccepted: false });
  } });
}
