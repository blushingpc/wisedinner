import type { PlannerV3 } from "./generated-joined-plan.ts";
import type { ReferenceWeekV3 } from "./generated-plan-state.ts";
import { rebindConfirmedPurchaseChecks } from "./generated-plan-shopping.ts";
import { retainV3PurchaseCustody } from "./generated-regional-quote.ts";
import { sourcePolicyHashV2 as digest } from "./generated-source-policy-basis-v2.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";

type Selected = Readonly<{ assignmentId: string; personId: string; expectedRecipeSha256: string }>;
export type PairedReplacementIntent = Readonly<{
  target: Selected & { replacementRecipeId: string; sourceServings: ExactAmount };
  donor: Selected & { adjustmentId: string };
}>;
type RecipeIdentity = Readonly<{ recipeId: string; recipeSha256: string; sourceServings: ExactAmount }>;
export type PairedPreparation = Readonly<{
  weekId: string;
  revision: number;
  marks: Readonly<Record<string, Readonly<{ recipeSha256: string; state: "unprepared" | "started" }>>>;
}>;
export type PairedReplacementPolicy = Readonly<{
  sourceSha256: string;
  basisSha256: string;
  reservedReplacements?: Readonly<{
    find(week: ReferenceWeekV3, grid: unknown): ReturnType<PlannerV3["findReplacements"]>;
    confirm(week: ReferenceWeekV3, confirmation: unknown): ReturnType<PlannerV3["confirmReplacement"]>;
  }>;
  transition?: Readonly<{
    fromSourceSha256: string;
    fromBasisSha256: string;
    evaluateJoined: PlannerV3["evaluateJoined"];
  }>;
  resolveTarget(choice: PairedReplacementIntent["target"]): RecipeIdentity | null;
  resolveDonor(original: RecipeIdentity, choice: PairedReplacementIntent["donor"]):
    (RecipeIdentity & { relationSha256: string }) | null;
}>;

const fields = (value: unknown, keys: readonly string[]): value is Record<string, unknown> =>
  !!value && typeof value === "object" && !Array.isArray(value) &&
  Object.keys(value).length === keys.length && keys.every(key => Object.hasOwn(value, key));
const identifier = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 160 && /^[a-zA-Z0-9:_-]+$/.test(value);
const sha = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const servings = (value: unknown): value is ExactAmount => fields(value, ["numerator", "denominator"]) &&
  Object.values(value).every(part => typeof part === "string" && /^[1-9][0-9]{0,10}$/.test(part));
const selected = (value: Record<string, unknown>) =>
  identifier(value.assignmentId) && identifier(value.personId) && sha(value.expectedRecipeSha256);
type PreparationSubject = Readonly<{ assignmentId: string; personId: string; expectedRecipeSha256: string; state: "unprepared" | "started" }>;
const preparationState = (value: unknown) => value === "unprepared" || value === "started";

export function readPairedPreparation(value: unknown, weekId: string, assignments: unknown): PairedPreparation | null {
  if (!fields(value, ["weekId", "revision", "marks"]) || value.weekId !== weekId ||
      typeof value.revision !== "number" || !Number.isSafeInteger(value.revision) || value.revision < 1 ||
      !Array.isArray(assignments) || !value.marks || typeof value.marks !== "object" || Array.isArray(value.marks)) return null;
  const marks = Object.entries(value.marks);
  if (!marks.length || marks.length > assignments.length || marks.some(([id, mark]) =>
    !identifier(id) || !fields(mark, ["recipeSha256", "state"]) || !sha(mark.recipeSha256) ||
    !preparationState(mark.state) || !assignments.some(row => row?.assignmentId === id && row.recipeSha256 === mark.recipeSha256))) {
    return null;
  }
  return value as PairedPreparation;
}

export function readPreparationSubjects(value: unknown): readonly PreparationSubject[] | null {
  if (!Array.isArray(value) || value.length < 1 || value.length > 2 || !value.every(row =>
    fields(row, ["assignmentId", "personId", "expectedRecipeSha256", "state"]) &&
    selected(row) && preparationState(row.state))) return null;
  return new Set(value.map(row => row.assignmentId)).size === value.length ? value : null;
}

export function updatePreparation(week: ReferenceWeekV3, subjects: readonly PreparationSubject[]): PairedPreparation | null {
  if (!Array.isArray(week.assignments)) return null;
  const assignments = week.assignments as readonly Assignment[];
  const previous = week.preparation;
  const revision = (previous?.revision ?? 0) + 1;
  if (!Number.isSafeInteger(revision)) return null;
  const marks = new Map(Object.entries(previous?.marks ?? {}));
  for (const subject of subjects) {
    const row = assignments.find(assignment => assignment.assignmentId === subject.assignmentId &&
      assignment.personId === subject.personId && assignment.recipeSha256 === subject.expectedRecipeSha256);
    if (!row || marks.get(row.assignmentId)?.state === "started" && subject.state !== "started") return null;
    marks.set(row.assignmentId, { recipeSha256: row.recipeSha256, state: subject.state });
  }
  return { weekId: week.weekId, revision, marks: Object.fromEntries(marks) };
}

export function retainPreparation(previous: { preparation?: PairedPreparation; assignments: unknown }, assignments: unknown): PairedPreparation | undefined {
  if (!previous.preparation || !Array.isArray(previous.assignments) || !Array.isArray(assignments)) return undefined;
  const original = new Map((previous.assignments as Assignment[]).map(row => [row.assignmentId, row]));
  const marks = Object.fromEntries(Object.entries(previous.preparation.marks).filter(([id, mark]) => {
    const row = original.get(id);
    return row && assignments.some(next => next?.assignmentId === id && next.recipeSha256 === mark.recipeSha256 &&
      next.personId === row.personId && next.date === row.date && next.slot === row.slot);
  }));
  return Object.keys(marks).length ? { ...previous.preparation, marks } : undefined;
}

export function readPairedReplacementIntent(value: unknown): PairedReplacementIntent | null {
  if (!fields(value, ["target", "donor"])) return null;
  const { target, donor } = value, identity = ["assignmentId", "personId", "expectedRecipeSha256"];
  if (!fields(target, [...identity, "replacementRecipeId", "sourceServings"]) ||
      !fields(donor, [...identity, "adjustmentId"]) || !selected(target) || !selected(donor) ||
      target.assignmentId === donor.assignmentId || !identifier(target.replacementRecipeId) ||
      !servings(target.sourceServings) || !identifier(donor.adjustmentId)) return null;
  return value as PairedReplacementIntent;
}

type Assignment = RecipeIdentity & { assignmentId: string; personId: string; profileRevision: number; date: string; slot: string };
const hold = (code: string) => ({ outcome: "held" as const, code });

// Resolve the two recipe identities within the current source. Only the
// transaction owner can supply preparation state and commit this result.
export function evaluatePairedReplacement(
  scopeKey: string, week: ReferenceWeekV3, revision: number, preparation: PairedPreparation | null,
  intent: PairedReplacementIntent, policy: PairedReplacementPolicy, planner: PlannerV3,
  discovery = false,
) {
  const transition = policy.transition;
  const sourceMatches = week.sourceSha256 === policy.sourceSha256 && week.sourcePolicyBasis.basisSha256 === policy.basisSha256;
  const transitionMatches = transition && week.sourceSha256 === transition.fromSourceSha256 &&
    week.sourcePolicyBasis.basisSha256 === transition.fromBasisSha256;
  if (!sourceMatches && !transitionMatches) return hold("saved_source_policy_basis_changed");
  if (week.shoppingChecks.status !== "ready") return hold("current_checklist_policy_required");
  if (!preparation && discovery) preparation = { weekId: week.weekId, revision: 0, marks: {} };
  if (!preparation || preparation.weekId !== week.weekId || !Number.isSafeInteger(preparation.revision) ||
      preparation.revision < 0 || preparation.revision >= Number.MAX_SAFE_INTEGER ||
      !preparation.marks || typeof preparation.marks !== "object" || Array.isArray(preparation.marks)) {
    return hold("paired_preparation_required");
  }
  const original = week.assignments as readonly Assignment[];
  const lookup = (choice: Selected) => original.find(assignment => assignment.assignmentId === choice.assignmentId &&
    assignment.personId === choice.personId && assignment.recipeSha256 === choice.expectedRecipeSha256);
  const target = lookup(intent.target), donor = lookup(intent.donor);
  if (!target || !donor) return hold("paired_assignment_changed");
  const unprepared = (assignment: Assignment) => {
    const mark = Object.hasOwn(preparation.marks, assignment.assignmentId) ? preparation.marks[assignment.assignmentId] : undefined;
    return !mark ? discovery : mark.state === "unprepared" && mark.recipeSha256 === assignment.recipeSha256;
  };
  if (!unprepared(target) || !unprepared(donor)) return hold("paired_preparation_required");

  const nextTarget = policy.resolveTarget(intent.target), nextDonor = policy.resolveDonor(donor, intent.donor);
  if (!nextTarget || nextTarget.recipeId !== intent.target.replacementRecipeId ||
      digest(nextTarget.sourceServings) !== digest(intent.target.sourceServings) ||
      !nextDonor || !sha(nextDonor.relationSha256) ||
      nextTarget.recipeSha256 === target.recipeSha256 || nextDonor.recipeSha256 === donor.recipeSha256) {
    return hold("paired_recipe_unavailable");
  }
  const replace = (assignment: Assignment, recipe: RecipeIdentity) => ({
    ...assignment, recipeId: recipe.recipeId, recipeSha256: recipe.recipeSha256, sourceServings: recipe.sourceServings,
  });
  const assignments = original.map(assignment =>
    assignment === target ? replace(assignment, nextTarget) : assignment === donor ? replace(assignment, nextDonor) : assignment);
  const evaluate = transition?.evaluateJoined ?? planner.evaluateJoined;
  const result = evaluate(assignments, week.request);
  if (result.outcome !== "success") return hold("paired_plan_unavailable");
  if (result.sourceSha256 !== policy.sourceSha256 || result.requestSha256 !== week.requestSha256 ||
      result.sourcePolicyBasis.basisSha256 !== policy.basisSha256 ||
      result.allergyBasisSha256 !== week.allergyBasisSha256) return hold("paired_plan_basis_changed");
  let quote: ReferenceWeekV3["quote"];
  try { quote = retainV3PurchaseCustody(week.quote, result.quote); }
  catch { return hold("replacement_purchase_custody_changed"); }
  const checks = rebindConfirmedPurchaseChecks(week.quote, quote, week.shoppingChecks.rows);
  if (checks.outcome !== "rebound") return hold("replacement_purchase_custody_changed");
  const previewSha256 = digest(["wd-paired-replacement-preview-v1", scopeKey, week.contentSha256, revision,
    preparation.revision, intent, nextDonor.relationSha256,
    ...(transition ? [result.sourceSha256, result.sourcePolicyBasis.basisSha256] : []),
    result.assignmentsSha256, quote, result.utilityPartition]);
  const preparationAfter = {
    ...preparation,
    revision: preparation.revision + 1,
    marks: {
      ...preparation.marks,
      [target.assignmentId]: { recipeSha256: nextTarget.recipeSha256, state: "unprepared" as const },
      [donor.assignmentId]: { recipeSha256: nextDonor.recipeSha256, state: "unprepared" as const },
    },
  };
  return {
    outcome: "preview" as const, previewSha256, revision, preparationRevision: preparation.revision,
    requestSha256: result.requestSha256, assignmentsSha256: result.assignmentsSha256,
    target: replace(target, nextTarget), donor: replace(donor, nextDonor),
    evaluation: { ...result, quote }, checks: checks.rows, preparationAfter,
  };
}
