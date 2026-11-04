import { compare, decimal } from "./generated-meal-ranges.ts";

// Shared draft types and pure member-form primitives only. Not an accepted
// public API, verified owner, access grant, planner or allergy certification.
export const JOINED_PLAN_DRAFT_CONTRACT = "wd-joined-plan-draft-v1";
export type GoalCoverage = "selected-meals" | "full-day";
export type KnownProteinGoal = { readonly kind: "known"; readonly gramsPerDay: string; readonly coverage: GoalCoverage };
export type ProteinGoal = KnownProteinGoal | { readonly kind: "unknown" };
export type CalorieGoal = { readonly kind: "unset" } | { readonly kind: "known"; readonly kcalPerDay: string; readonly coverage: GoalCoverage };
export type PersonExclusions =
  | { readonly kind: "none" | "unknown" }
  | { readonly kind: "unmapped"; readonly text: string }
  | { readonly kind: "mapped"; readonly ingredientIds: readonly string[]; readonly allergenIds: readonly string[]; readonly mappingRevision: number; readonly scope: "person" | "household" };
export type PersonInput = {
  readonly personId: string; readonly profileRevision: number; readonly label: string; readonly proteinGoal: ProteinGoal;
  readonly calorieGoal?: CalorieGoal; readonly preferences?: { readonly preferredRecipeIds: readonly string[] }; readonly exclusions: PersonExclusions;
};
export type PersonHold = {
  readonly code: "goal_required" | "calorie_constraint_not_connected" | "goal_coverage_policy_required" | "exclusion_status_required" | "exclusion_mapping_required" | "exclusion_scope_policy_required";
  readonly personId: string; readonly field: "proteinGoal" | "calorieGoal" | "exclusions";
};
export type PeopleInputOutcome = { readonly outcome: "validated"; readonly people: readonly PersonInput[]; readonly holds: readonly PersonHold[] } | { readonly outcome: "error"; readonly code: "invalid_people_input" };
export type GoalReturnOutcome =
  | { readonly outcome: "held"; readonly code: "goal_required"; readonly returnTo: { readonly personId: string; readonly profileRevision: number; readonly field: "proteinGoal" } }
  | { readonly outcome: "ready"; readonly personId: string; readonly profileRevision: number; readonly proteinGoal: KnownProteinGoal }
  | { readonly outcome: "error"; readonly code: "invalid_people_input" | "invalid_goal_return" | "person_missing" | "stale_profile" };
type Data = Record<string, unknown>;

function invalid(): never { throw new Error("Invalid member data"); }
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Data = {};
  if (required.some(key => !Object.hasOwn(descriptors, key))) invalid();
  for (const key of keys) {
    if (typeof key !== "string" || ![...required, ...optional].includes(key)) invalid();
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) invalid();
    result[key] = descriptor.value;
  }
  return result;
}
function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) invalid();
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
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(); return value as number; }
function coverage(value: unknown): GoalCoverage { if (value !== "selected-meals" && value !== "full-day") invalid(); return value; }
function positive(value: unknown, protein = false): string {
  const result = decimal(value);
  if (result.n === BigInt(0) || protein && compare(result, decimal("1000")) > 0) invalid();
  return value as string;
}
function proteinGoal(value: unknown): ProteinGoal {
  const goal = record(value, ["kind"], ["gramsPerDay", "coverage"]);
  if (goal.kind === "unknown" && Object.keys(goal).length === 1) return { kind: "unknown" };
  if (goal.kind !== "known") invalid();
  return { kind: "known", gramsPerDay: positive(goal.gramsPerDay, true), coverage: coverage(goal.coverage) };
}
function calorieGoal(value: unknown): CalorieGoal {
  const goal = record(value, ["kind"], ["kcalPerDay", "coverage"]);
  if (goal.kind === "unset" && Object.keys(goal).length === 1) return { kind: "unset" };
  if (goal.kind !== "known") invalid();
  return { kind: "known", kcalPerDay: positive(goal.kcalPerDay), coverage: coverage(goal.coverage) };
}
function ids(value: unknown): string[] {
  const values = list(value, 100).map(text);
  if (new Set(values).size !== values.length) invalid();
  return values;
}
function exclusions(value: unknown): PersonExclusions {
  const fields = record(value, ["kind"], ["text", "ingredientIds", "allergenIds", "mappingRevision", "scope"]);
  const keys = Object.keys(fields);
  if ((fields.kind === "none" || fields.kind === "unknown") && keys.length === 1) return { kind: fields.kind };
  if (fields.kind === "unmapped" && keys.length === 2 && Object.hasOwn(fields, "text")) return { kind: "unmapped", text: text(fields.text) };
  if (fields.kind !== "mapped" || keys.length !== 5 || Object.hasOwn(fields, "text") || fields.scope !== "person" && fields.scope !== "household") invalid();
  return { kind: "mapped", ingredientIds: ids(fields.ingredientIds), allergenIds: ids(fields.allergenIds), mappingRevision: revision(fields.mappingRevision), scope: fields.scope };
}
function person(value: unknown): PersonInput {
  const fields = record(value, ["personId", "profileRevision", "label", "proteinGoal", "exclusions"], ["calorieGoal", "preferences"]);
  let preferences: PersonInput["preferences"];
  if (Object.hasOwn(fields, "preferences")) {
    const values = record(fields.preferences, ["preferredRecipeIds"]);
    preferences = { preferredRecipeIds: ids(values.preferredRecipeIds) };
  }
  return {
    personId: text(fields.personId), profileRevision: revision(fields.profileRevision), label: text(fields.label), proteinGoal: proteinGoal(fields.proteinGoal), exclusions: exclusions(fields.exclusions),
    ...(Object.hasOwn(fields, "calorieGoal") ? { calorieGoal: calorieGoal(fields.calorieGoal) } : {}),
    ...(preferences ? { preferences } : {}),
  };
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}

export function parsePeople(value: unknown): PeopleInputOutcome {
  try {
    const people = list(value, 8).map(person);
    if (!people.length || new Set(people.map(person => person.personId)).size !== people.length) invalid();
    const holds: PersonHold[] = [];
    for (const member of people) {
      const personId = member.personId;
      if (member.proteinGoal.kind === "unknown") holds.push({ code: "goal_required", personId, field: "proteinGoal" });
      else if (member.proteinGoal.coverage === "full-day") holds.push({ code: "goal_coverage_policy_required", personId, field: "proteinGoal" });
      if (member.calorieGoal?.kind === "known") {
        holds.push({ code: "calorie_constraint_not_connected", personId, field: "calorieGoal" });
        if (member.calorieGoal.coverage === "full-day") holds.push({ code: "goal_coverage_policy_required", personId, field: "calorieGoal" });
      }
      if (member.exclusions.kind === "unknown") holds.push({ code: "exclusion_status_required", personId, field: "exclusions" });
      if (member.exclusions.kind === "unmapped") holds.push({ code: "exclusion_mapping_required", personId, field: "exclusions" });
      if (member.exclusions.kind === "mapped") holds.push({ code: "exclusion_scope_policy_required", personId, field: "exclusions" });
    }
    return deepFreeze({ outcome: "validated", people, holds });
  } catch { return { outcome: "error", code: "invalid_people_input" }; }
}

// "ready" means the form already has a goal. It never means a plan was solved,
// saved or authorized. Persistent ID retirement/owner fences belong to state.
export function resolveGoalReturn(peopleValue: unknown, personIdValue: unknown, expectedProfileRevision: unknown): GoalReturnOutcome {
  const parsed = parsePeople(peopleValue);
  if (parsed.outcome === "error") return parsed;
  let personId: string, expected: number;
  try { personId = text(personIdValue); expected = revision(expectedProfileRevision); } catch { return { outcome: "error", code: "invalid_goal_return" }; }
  const member = parsed.people.find(person => person.personId === personId);
  if (!member) return { outcome: "error", code: "person_missing" };
  if (member.profileRevision !== expected) return { outcome: "error", code: "stale_profile" };
  if (member.proteinGoal.kind === "unknown") return { outcome: "held", code: "goal_required", returnTo: { personId, profileRevision: expected, field: "proteinGoal" } };
  return { outcome: "ready", personId, profileRevision: expected, proteinGoal: member.proteinGoal };
}
