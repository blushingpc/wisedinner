import type { CatalogProjectionOutcome } from "./generated-plan-catalog.ts";
import type { ReferenceEvaluationSuccess, ReferencePlanOutcome, ReferenceReplacementOutcome } from "./generated-joined-plan.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { rational, receipt } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";

type Preview = Extract<ReferenceReplacementOutcome, { outcome: "preview" }>;
type Rejection = Exclude<ReferencePlanOutcome, { outcome: "success" }>;
type Candidate = { readonly recipeId: string; readonly sourceServings: ExactAmount };
export type ReferenceAlternativesOutcome = Rejection | {
  readonly outcome: "alternatives"; readonly mode: "private-conditional-reference-only"; readonly productReady: false;
  readonly target: { readonly personId: string; readonly assignmentId: string };
  readonly sourceSha256: string; readonly requestSha256: string; readonly baseAssignmentsSha256: string;
  readonly order: "canonical-recipe-id-and-exact-serving-not-a-recommendation-rank";
  readonly candidates: readonly (Candidate & { readonly preview: Preview })[];
  readonly excluded: readonly (Candidate & { readonly result: Rejection | { readonly outcome: "unchanged" } })[];
  readonly search: { readonly scope: "explicit-candidate-grid-only"; readonly requestedCandidateCount: number; readonly evaluatedCandidateCount: number; readonly unchangedCandidateCount: number; readonly notEvaluatedCount: number; readonly eligibleCandidateCount: number; readonly heldCandidateCount: number; readonly returnedCandidateCount: number; readonly unreturnedEligibleCount: number; readonly maxEvaluations: number; readonly limit: number; readonly complete: boolean };
  readonly saved: false;
};
type Data = Record<string, unknown>;
function invalid(): never { throw new Error("Invalid replacement grid"); }
function record(value: unknown, keys: readonly string[]): Data { if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).sort().join("|") !== [...keys].sort().join("|")) invalid(); return value as Data; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function integer(value: unknown, max: number): number { if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > max) invalid(); return value as number; }
function portion(value: unknown): ExactAmount {
  const fields = record(value, ["numerator", "denominator"]);
  for (const field of [fields.numerator, fields.denominator]) if (typeof field !== "string" || field.length > 120 || !/^(0|[1-9]\d*)$/.test(field)) invalid();
  const result = rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string)); if (!result.n) invalid(); return receipt(result);
}
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function key(value: Candidate): string { return JSON.stringify([value.recipeId, value.sourceServings]); }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// Factory-owned helper only. The canonical evaluator checks the base once and
// its shared preview implementation checks every changed candidate. No solve,
// quote, score/default policy, save or public transport is duplicated here.
export function discoverReplacementAlternatives(
  catalog: Extract<CatalogProjectionOutcome, { outcome: "success" }>, assignmentsValue: unknown, requestValue: unknown, gridValue: unknown,
  evaluate: (assignments: unknown, request: unknown) => ReferencePlanOutcome,
  preview: (before: ReferenceEvaluationSuccess, request: unknown, intent: unknown) => ReferenceReplacementOutcome,
  guidePolicy?: import("./generated-joined-plan.ts").CurrentGuidePolicy,
): ReferenceAlternativesOutcome {
  let grid: Data, candidates: Candidate[], maxEvaluations: number, limit: number, personId: string, assignmentId: string, expectedRecipeSha256: string, assignments: unknown, request: unknown;
  try {
    grid = record(copyReferenceData(gridValue), ["personId", "assignmentId", "expectedRecipeSha256", "candidates", "maxEvaluations", "limit"]);
    personId = text(grid.personId); assignmentId = text(grid.assignmentId); expectedRecipeSha256 = text(grid.expectedRecipeSha256);
    if (!/^[a-f0-9]{64}$/.test(expectedRecipeSha256)) invalid();
    maxEvaluations = integer(grid.maxEvaluations, 256); limit = integer(grid.limit, 32);
    if (!Array.isArray(grid.candidates) || !grid.candidates.length || grid.candidates.length > 1300) invalid();
    candidates = grid.candidates.map(value => { const row = record(value, ["recipeId", "sourceServings"]); return { recipeId: text(row.recipeId), sourceServings: portion(row.sourceServings) }; }).sort((a, b) => order(key(a), key(b)));
    if (new Set(candidates.map(key)).size !== candidates.length) invalid();
    assignments = copyReferenceData(assignmentsValue); request = copyReferenceData(requestValue);
  } catch { return { outcome: "error", code: "invalid_replacement_grid" }; }
  const ids = new Set(catalog.recipes.map(recipe => recipe.id));
  if (candidates.some(value => !ids.has(value.recipeId))) return { outcome: "error", code: "replacement_recipe_missing" };
  const before = evaluate(assignments, request); if (before.outcome !== "success") return before;
  const target = before.projection.assignments.find(value => value.assignmentId === assignmentId);
  if (!target) return { outcome: "error", code: "replacement_assignment_missing" };
  if (target.personId !== personId) return { outcome: "error", code: "replacement_subject_mismatch" };
  if (target.recipeSha256 !== expectedRecipeSha256) return { outcome: "error", code: "stale_replacement_source" };
  const eligible: (Candidate & { preview: Preview })[] = [], excluded: (Candidate & { result: Rejection | { outcome: "unchanged" } })[] = [];
  let evaluatedCandidateCount = 0, unchangedCandidateCount = 0, examined = 0, eligibleCandidateCount = 0, heldCandidateCount = 0;
  for (const candidate of candidates) {
    const recipe = catalog.recipes.find(r => r.id === candidate.recipeId)!;
    const checked = guidePolicy?.check({ ...candidate, recipeSha256: recipe.recipeSha256, request });
    if (checked?.outcome === "held") { examined++; heldCandidateCount++; excluded.push({ ...candidate, result: { outcome: "held", reasons: checked.reasons.map(code => ({ code })) } }); continue; }
    if (key(candidate) === key(target)) { unchangedCandidateCount++; examined++; excluded.push({ ...candidate, result: { outcome: "unchanged" } }); continue; }
    if (evaluatedCandidateCount >= maxEvaluations) break;
    const result = preview(before, request, { assignmentId, personId, expectedRecipeSha256, replacementRecipeId: candidate.recipeId, sourceServings: candidate.sourceServings });
    evaluatedCandidateCount++; examined++;
    if (result.outcome === "error") return result;
    if (result.outcome === "preview") { eligibleCandidateCount++; if (eligible.length < limit) eligible.push({ ...candidate, preview: result }); }
    else { if (result.outcome === "held") heldCandidateCount++; excluded.push({ ...candidate, result }); }
  }
  const notEvaluatedCount = candidates.length - examined;
  return freeze({ outcome: "alternatives", mode: "private-conditional-reference-only", productReady: false, target: { personId, assignmentId }, sourceSha256: before.sourceSha256, requestSha256: before.requestSha256, baseAssignmentsSha256: before.assignmentsSha256, order: "canonical-recipe-id-and-exact-serving-not-a-recommendation-rank", candidates: eligible, excluded, search: { scope: "explicit-candidate-grid-only", requestedCandidateCount: candidates.length, evaluatedCandidateCount, unchangedCandidateCount, notEvaluatedCount, eligibleCandidateCount, heldCandidateCount, returnedCandidateCount: eligible.length, unreturnedEligibleCount: eligibleCandidateCount - eligible.length, maxEvaluations, limit, complete: !notEvaluatedCount && !heldCandidateCount }, saved: false });
}
