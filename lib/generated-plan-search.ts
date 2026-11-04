import {PROFILE_METHOD_POLICY,profileMethodEquipment} from "./generated-profile-method-guides.ts";
import type { CatalogProjectionOutcome } from "./generated-plan-catalog.ts";
import type { ReferencePlanOutcome, ReferenceEvaluationSuccess, ReferenceRequest } from "./generated-joined-plan.ts";
import type { MealAssignment } from "./generated-person-plan.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import { compare, decimal, distance, divide, multiply, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { copyReferenceData } from "./generated-plan-data.ts";

type PreferencePolicy = "cost-first" | "preferences-first";
type UnavailablePreference = { readonly personId: string; readonly recipeId: string; readonly reasons: readonly string[] };
type SearchEvidence = { readonly complete: boolean; readonly evaluations: number; readonly visitedNodes: number; readonly maxEvaluations: number; readonly maxNodes: number; readonly heldCandidateCount: number; readonly incompleteCandidateRecipeIds: readonly string[]; readonly optimization: "best-observed-in-explicit-bounded-grid"; readonly preferencePolicy: PreferencePolicy; readonly preferredAssignmentCount: number; readonly unavailablePreferences: readonly UnavailablePreference[] };
export type ReferenceSearchOutcome =
  | ReferenceEvaluationSuccess & { readonly search: SearchEvidence }
  | { readonly outcome: "no_fit"; readonly scope: "explicit-finite-grid-only"; readonly week: null; readonly reasons: readonly { readonly code: string }[]; readonly search: SearchEvidence }
  | { readonly outcome: "held"; readonly reasons: readonly { readonly code: string; readonly personId?: string }[]; readonly search?: SearchEvidence }
  | { readonly outcome: "error"; readonly code: string };
type Data = Record<string, unknown>;
type Choice = { recipeId: string; recipeSha256: string; sourceServings: ExactAmount; contribution: Rational };
type Cell = { assignmentId: string; personId: string; profileRevision: number; date: string; slot: MealAssignment["slot"]; choices: readonly Choice[] };
function invalid(): never { throw new Error("Invalid reference search"); }
function record(value: unknown, fields: readonly string[], optional: readonly string[] = []): Data { if (!value || typeof value !== "object" || Array.isArray(value) || fields.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...fields, ...optional].includes(key))) invalid(); return value as Data; }
function list(value: unknown, maximum: number): unknown[] { if (!Array.isArray(value) || !value.length || value.length > maximum) invalid(); return value; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function integer(value: unknown, maximum: number): number { if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > maximum) invalid(); return value as number; }
function exact(value: unknown): Rational {
  const fields = record(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof fields[key] !== "string" || fields[key].length > 120 || !/^(0|[1-9]\d*)$/.test(fields[key])) invalid();
  const result = rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string)); if (result.n === BigInt(0)) invalid(); return result;
}
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// Called only by the already source-bound canonical factory. All completed
// selections go through its evaluator; this helper never relaxes constraints or
// invents a default portion/variety grid. Old reference source stays separate.
export function searchReferenceAssignments(catalog: Extract<CatalogProjectionOutcome, { outcome: "success" }>, request: ReferenceRequest, optionsValue: unknown, evaluate: (assignments: unknown, request: unknown) => ReferencePlanOutcome, schedulePolicy?: "wd-seven-day-three-meals-v1", guidePolicy?: import("./generated-joined-plan.ts").CurrentGuidePolicy, profileMethodPolicy?: typeof PROFILE_METHOD_POLICY): ReferenceSearchOutcome {
  if(profileMethodPolicy!==undefined && profileMethodPolicy!==PROFILE_METHOD_POLICY)return {outcome:"error",code:"invalid_reference_search_grid"};
  const profileMethods=profileMethodPolicy===PROFILE_METHOD_POLICY;
  let fields: Data, recipeIds: string[], portionGrid: Map<string, readonly Rational[]>, maxUses: number, maxEvaluations: number, seed: string, policy: PreferencePolicy | undefined;
  try {
    fields = record(copyReferenceData(optionsValue), ["recipeIds", "portionsByPerson", "maxRecipeUsesPerPerson", "maxEvaluations", "seed"], ["preferencePolicy"]);
    if (Object.hasOwn(fields, "preferencePolicy")) { if (fields.preferencePolicy !== "cost-first" && fields.preferencePolicy !== "preferences-first") invalid(); policy = fields.preferencePolicy; }
    recipeIds = list(fields.recipeIds, 1300).map(text).sort(order); if (new Set(recipeIds).size !== recipeIds.length) invalid();
    maxUses = integer(fields.maxRecipeUsesPerPerson, 21); maxEvaluations = integer(fields.maxEvaluations, 256); seed = text(fields.seed);
    portionGrid = new Map();
    for (const item of list(fields.portionsByPerson, 8)) {
      const row = record(item, ["personId", "profileRevision", "sourceServings"]), id = text(row.personId), person = request.people.find(value => value.personId === id);
      if (!person || row.profileRevision !== person.profileRevision || portionGrid.has(id)) invalid();
      const portions = list(row.sourceServings, 8).map(exact);
      if (new Set(portions.map(value => JSON.stringify(receipt(value)))).size !== portions.length) invalid();
      portionGrid.set(id, portions);
    }
    if (portionGrid.size !== request.people.length) invalid();
  } catch { return { outcome: "error", code: "invalid_reference_search_grid" }; }
  const source = new Map(catalog.recipes.map(recipe => [recipe.id, recipe]));
  if (recipeIds.some(id => !source.has(id))) return { outcome: "error", code: "search_recipe_missing" };
  const hasPreferences = request.people.some(person => person.preferences?.preferredRecipeIds.length);
  if (hasPreferences && !policy) return { outcome: "held", reasons: [{ code: "preference_ranking_policy_required" }] };
  // Preserve existing no-preference behavior. A product default for populated
  // preferences is deliberately not chosen by this internal reference port.
  const preferencePolicy = policy ?? "cost-first", selectedIds = new Set(recipeIds), unavailablePreferences: UnavailablePreference[] = [];
  for (const person of request.people) for (const recipeId of person.preferences?.preferredRecipeIds ?? []) {
    const recipe = source.get(recipeId); if (!recipe) return { outcome: "error", code: "preferred_recipe_missing" };
    const reasons: string[] = [];
    if (!selectedIds.has(recipeId)) reasons.push("outside_explicit_grid");
    if (!request.slots.some(slot => recipe.sections.includes(slot))) reasons.push("meal_section_unavailable");
    if ((profileMethods?profileMethodEquipment(recipe,request.equipment):recipe.recipe.equipment).some(item => !request.equipment.includes(item))) reasons.push("equipment_unavailable");
    if (!recipe.nutrition.perServing) reasons.push("incomplete_nutrition");
    if (reasons.length) unavailablePreferences.push({ personId: person.personId, recipeId, reasons: reasons.sort(order) });
  }
  const cells: Cell[] = [], cache = new Map<string, readonly Choice[]>(), incompleteIds = new Set<string>(); let choiceCount = 0;
  for (const person of request.people) {
    const fullDay = schedulePolicy === "wd-seven-day-three-meals-v1" && request.selectedDays.length === 7 && [...request.slots].sort().join("|") === "breakfast|dinner|lunch";
    if (person.proteinGoal.kind !== "known" || person.proteinGoal.coverage !== (fullDay ? "full-day" : "selected-meals")) return { outcome: "held", reasons: [{ code: "goal_coverage_policy_required", personId: person.personId }] };
    const targetForOrderOnly = divide(decimal(person.proteinGoal.gramsPerDay), rational(BigInt(request.slots.length)));
    for (const slot of request.slots) {
      const choices: Choice[] = []; let cellIncomplete = false;
      for (const id of recipeIds) {
        const recipe = source.get(id)!;
        if (!recipe.sections.includes(slot) || (profileMethods?profileMethodEquipment(recipe,request.equipment):recipe.recipe.equipment).some(item => !request.equipment.includes(item))) continue;
        if (!recipe.nutrition.perServing) { cellIncomplete = true; incompleteIds.add(id); continue; }
        const input = recipe.nutrition.perServing.protein_g.min, protein = rational(BigInt(input.numerator), BigInt(input.denominator));
        for (const portion of portionGrid.get(person.personId)!) {
          if (guidePolicy?.check({ recipeId: id, recipeSha256: recipe.recipeSha256, sourceServings: receipt(portion), request }).outcome === "held") continue;
          choices.push({ recipeId: id, recipeSha256: recipe.recipeSha256, sourceServings: receipt(portion), contribution: multiply(protein, portion) });
        }
      }
      choiceCount += choices.length;
      if (choiceCount > 200000) return { outcome: "held", reasons: [{ code: "search_grid_capacity_needed" }] };
      // Ordering heuristic only. Other allowed portions remain in the grid.
      const preferred = new Set(person.preferences?.preferredRecipeIds ?? []);
      choices.sort((a, b) => (preferencePolicy === "preferences-first" ? Number(preferred.has(b.recipeId)) - Number(preferred.has(a.recipeId)) : 0) || compare(distance(a.contribution, targetForOrderOnly), distance(b.contribution, targetForOrderOnly)) || order(hash([seed, person.personId, slot, a.recipeId, a.sourceServings]), hash([seed, person.personId, slot, b.recipeId, b.sourceServings])));
      if (!choices.length) return cellIncomplete ? { outcome: "held", reasons: [{ code: "incomplete_candidate_nutrition" }] } : { outcome: "no_fit", scope: "explicit-finite-grid-only", week: null, reasons: [{ code: "no_compatible_candidate_in_explicit_grid" }], search: { complete: true, evaluations: 0, visitedNodes: 0, maxEvaluations, maxNodes: maxEvaluations * 1000, heldCandidateCount: 0, incompleteCandidateRecipeIds: [...incompleteIds].sort(order), optimization: "best-observed-in-explicit-bounded-grid", preferencePolicy, preferredAssignmentCount: 0, unavailablePreferences } };
      cache.set(JSON.stringify([person.personId, slot]), choices);
    }
  }
  for (const date of request.selectedDays) for (const person of request.people) for (const slot of request.slots) cells.push({ assignmentId: `asgn-${hash([person.personId, date, slot])}`, personId: person.personId, profileRevision: person.profileRevision, date, slot, choices: cache.get(JSON.stringify([person.personId, slot]))! });
  const maxNodes = maxEvaluations * 1000, selected: MealAssignment[] = [], uses = new Map<string, number>();
  let evaluations = 0, visitedNodes = 0, heldCandidateCount = 0, stopped = false, best: ReferenceEvaluationSuccess | null = null, bestPreferenceCount = 0, failed: Extract<ReferencePlanOutcome, { outcome: "error" }> | null = null;
  const heldReasons = new Set<string>();
  function better(candidate: ReferenceEvaluationSuccess, preferenceCount: number): boolean {
    if (!best) return true;
    if (preferencePolicy === "preferences-first" && preferenceCount !== bestPreferenceCount) return preferenceCount > bestPreferenceCount;
    if (candidate.quote.estimatedTotalCents.max !== best.quote.estimatedTotalCents.max) return candidate.quote.estimatedTotalCents.max < best.quote.estimatedTotalCents.max;
    if (candidate.quote.estimatedTotalCents.min !== best.quote.estimatedTotalCents.min) return candidate.quote.estimatedTotalCents.min < best.quote.estimatedTotalCents.min;
    if (preferenceCount !== bestPreferenceCount) return preferenceCount > bestPreferenceCount;
    return candidate.assignmentsSha256 < best.assignmentsSha256;
  }
  function visit(index: number): void {
    if (stopped || failed) return;
    if (evaluations >= maxEvaluations || visitedNodes >= maxNodes) { stopped = true; return; }
    visitedNodes++;
    if (index === cells.length) {
      evaluations++;
      const result = evaluate(selected, request);
      if (result.outcome === "error") { failed = result; return; }
      if (result.outcome === "held") { heldCandidateCount++; result.reasons.forEach(reason => heldReasons.add(reason.code)); return; }
      if (result.outcome === "success") {
        const preferenceCount = result.projection.assignments.filter(assignment => request.people.find(person => person.personId === assignment.personId)!.preferences?.preferredRecipeIds.includes(assignment.recipeId)).length;
        if (better(result, preferenceCount)) { best = result; bestPreferenceCount = preferenceCount; }
      }
      return;
    }
    const cell = cells[index]!;
    for (const choice of cell.choices) {
      if (stopped || failed) return;
      const key = JSON.stringify([cell.personId, choice.recipeId]), count = uses.get(key) ?? 0;
      if (count >= maxUses) continue;
      uses.set(key, count + 1); selected.push({ assignmentId: cell.assignmentId, personId: cell.personId, profileRevision: cell.profileRevision, date: cell.date, slot: cell.slot, recipeId: choice.recipeId, recipeSha256: choice.recipeSha256, sourceServings: choice.sourceServings });
      visit(index + 1); selected.pop(); if (count) uses.set(key, count); else uses.delete(key);
    }
  }
  visit(0);
  const search: SearchEvidence = { complete: !stopped && !incompleteIds.size && !heldCandidateCount, evaluations, visitedNodes, maxEvaluations, maxNodes, heldCandidateCount, incompleteCandidateRecipeIds: [...incompleteIds].sort(order), optimization: "best-observed-in-explicit-bounded-grid", preferencePolicy, preferredAssignmentCount: bestPreferenceCount, unavailablePreferences };
  if (failed) return failed;
  if (best) return freeze({ ...(best as ReferenceEvaluationSuccess), search });
  if (stopped) heldReasons.add("search_limit_reached");
  if (incompleteIds.size) heldReasons.add("incomplete_candidate_nutrition");
  if (heldReasons.size) return freeze({ outcome: "held", reasons: [...heldReasons].sort(order).map(code => ({ code })), search });
  return freeze({ outcome: "no_fit", scope: "explicit-finite-grid-only", week: null, reasons: [{ code: "no_feasible_week_in_explicit_grid" }], search });
}
