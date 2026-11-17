import { FIXED_REBUILT_PIN, fixedRebuiltConfigurationMatches } from "./fixed-rebuilt-admission.ts";
import { createFixedRebuiltDonorTapWaterClassifier, createFixedRebuiltTapCookingWaterClassifier } from "./generated-tap-cooking-water.ts";
import { deriveFixedRebuiltDonorConfiguration, FIXED_REBUILT_DONOR_BASIS_SHA256, FIXED_REBUILT_DONOR_PIN, FIXED_REBUILT_DONOR_RECIPE_ID } from "./fixed-rebuilt-donor.ts";
import * as strictArchivePolicy from "./generated-curated-strict-archive-policy.ts";
import { reviewedPreparationFits } from "./generated-curated-preparation.ts";
import { CURATED_SOUTH_ARCHIVE_BASIS, CURATED_SOUTH_ARCHIVE_CONFIGURATION } from "./generated-curated-successor-policy.ts";
import * as archiveMethod from "./generated-curated-archive-method-policy.ts";
import * as archiveDietary from "./generated-curated-archive-dietary-policy.ts";
import * as archivedV13 from "./generated-curated-archive-v13-policy.ts";
import { createDietaryRecipeGuard, dietaryPatterns, type DietaryPattern, type DietaryRegistry } from "./generated-dietary-admission.ts";
import { curatedEquipmentSatisfied } from "./generated-curated-equipment.ts";
import { CURATED_LOCAL_QA_PIN as CURATED_SUCCESSOR_PIN, CURATED_LOCAL_QA_CONFIGURATION_SHA256, curatedQaRowAllowed, curatedQaContextAllowed, curatedQaPolicyDescriptor, CURATED_HOUSEHOLD_MAX, curatedHouseholdPolicyDescriptor, successorOpenedPackageAllowed, successorTofuStoragePolicy } from "./generated-curated-successor-policy.ts";
import {PROFILE_METHOD_POLICY,profileMethodDescriptor, profileMethodEquipment} from "./generated-profile-method-guides.ts";
import {quoteRegionalEstimatesV3,retainV3PurchaseCustody,isPurchasedQuoteRow,purchasedQuoteCovers,type RegionalQuoteSuccessV3} from "./generated-regional-quote.ts";
import {readRateReferenceConfiguration,type RateConfiguration} from "./generated-regional-rate-reference.ts";
import {FINAL_DERIVED_PIN} from "./generated-final-source-admission.ts";
import {createFinalDerivedTapCookingWaterClassifier} from "./generated-tap-cooking-water.ts";
import { createRevisedAssignmentProjector, type AssignmentProjectionOutcome, type MealAssignment } from "./generated-person-plan.ts";
import { CURRENT_REVISED_CATALOG_PIN } from "./generated-plan-catalog.ts";
import { REVIEWED_CURRENT_METHOD_PIN, createReviewedCurrentMethodTapCookingWaterClassifier, REVIEWED_CURRENT_PRACTICAL_PIN, createReviewedCurrentPracticalTapCookingWaterClassifier } from "./generated-tap-cooking-water.ts";
import { JOINED_PLAN_DRAFT_CONTRACT, parsePeople, type PersonInput } from "../packages/solver/src/generated-plan-contract.ts";
import { add, compare, decimal, divide, multiply, rational, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import { prepareReferencePurchaseRequirements,captureReferencePurchaseCorrespondences } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates, readReferencePriceConfiguration, type RegionalQuoteOutcome, quoteRegionalEstimatesV2, readReferencePriceConfigurationV2, type RegionalQuoteOutcomeV2 } from "./generated-regional-quote.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { createSourcePolicyBasisV2, normalizeSourcePolicyDataV2, type SourcePolicyBasisV2 } from "./generated-source-policy-basis-v2.ts";
import { createTapCookingWaterClassifier, createReviewedDerivedTapCookingWaterClassifier, createReviewedPreparationTapCookingWaterClassifier, createReviewedCurrentNativeTapCookingWaterClassifier, REVIEWED_DERIVED_STARTER_PIN, REVIEWED_PREPARATION_STARTER_PIN, REVIEWED_CURRENT_NATIVE_PIN, type TapWaterPartitionOutcome } from "./generated-tap-cooking-water.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { searchReferenceAssignments, type ReferenceSearchOutcome } from "./generated-plan-search.ts";
import { discoverReplacementAlternatives, type ReferenceAlternativesOutcome } from "./generated-plan-alternatives.ts";
import { createReplacementStockFilter } from "./generated-replacement-stock.ts";
import { createPantryIntake, type PantryIntakeOutcome } from "./generated-plan-pantry.ts";
import { checkReplacementProteinTolerance, REPLACEMENT_PROTEIN_RULE, REPLACEMENT_RULE_V2 } from "./generated-plan-protein-tolerance.ts";
import { createHouseholdAllergyGuard, type HouseholdAllergyOutcome } from "./generated-household-allergies.ts";

// Current-source canonical reference path. The old1000source factory remains an
// explicit legacy family, not an adapter silently relabelling old source meals.
// No public route, product admission, save, provider or nutrition advice here.
type Data = Record<string, unknown>;
export type CurrentGuidePolicy = Readonly<{ check(input: { recipeId: string; recipeSha256: string; sourceServings: { numerator: string; denominator: string }; request: unknown }): { outcome: "allowed" } | { outcome: "held"; reasons: readonly string[] } }>;
type Projection = Extract<AssignmentProjectionOutcome, { outcome: "projected" }>;
type Quote = Extract<RegionalQuoteOutcome, { outcome: "quoted" }>;
export type ReferenceRequest = {
  people: readonly PersonInput[]; selectedDays: readonly string[]; slots: readonly MealAssignment["slot"][];
  region: string; storeIds: readonly string[]; budgetCents: number; asOfDate: string; equipment: readonly string[]; pantry: readonly unknown[];
  dietaryPattern?: DietaryPattern;
};
export type ReferenceEvaluationSuccess = {
  readonly outcome: "success"; readonly mode: "private-conditional-reference-only"; readonly contract: typeof JOINED_PLAN_DRAFT_CONTRACT; readonly productReady: false;
  readonly requestSha256: string; readonly assignmentsSha256: string; readonly sourceSha256: string;
  readonly projection: Projection; readonly quote: Quote;
  readonly allergyBasisSha256?: string;
  readonly fullDayCoverage?: { readonly policy: "wd-seven-day-three-meals-v1"; readonly days: 7 };
};
export type ReferencePlanOutcome = ReferenceEvaluationSuccess
  | { readonly outcome: "no_fit"; readonly scope: "evaluated-assignments-only"; readonly week: null; readonly reasons: readonly { readonly code: string; readonly personId?: string; readonly date?: string; readonly assignmentId?: string }[] }
  | { readonly outcome: "held"; readonly reasons: readonly { readonly code: string; readonly personId?: string }[] }
  | { readonly outcome: "error"; readonly code: string };
export type ReferenceReplacementOutcome = Exclude<ReferencePlanOutcome, { outcome: "success" }> | {
  readonly outcome: "preview"; readonly before: ReferenceEvaluationSuccess; readonly after: ReferenceEvaluationSuccess;
  readonly target: { readonly personId: string; readonly assignmentId: string };
  readonly addedBuyIds: readonly string[]; readonly removedBuyIds: readonly string[]; readonly itemCountDelta: number;
  readonly baseAssignmentsSha256: string; readonly requestSha256: string; readonly previewSha256: string;
  readonly confirmationRequired: true; readonly saved: false;
};
export type ReferenceConfirmationOutcome = Exclude<ReferencePlanOutcome, { outcome: "success" }> | {
  readonly outcome: "proposal"; readonly evaluation: ReferenceEvaluationSuccess; readonly assignmentId: string; readonly personId: string;
  readonly previewSha256: string; readonly sourceSha256: string; readonly requestSha256: string; readonly baseAssignmentsSha256: string; readonly saved: false;
};
type Planner = { evaluateJoined: (assignments: unknown, request: unknown) => ReferencePlanOutcome; previewReplacement: (assignments: unknown, request: unknown, intent: unknown) => ReferenceReplacementOutcome; planJoined: (request: unknown, searchGrid: unknown) => ReferenceSearchOutcome; confirmReplacement: (assignments: unknown, request: unknown, confirmation: unknown) => ReferenceConfirmationOutcome; findReplacements: (assignments: unknown, request: unknown, candidateGrid: unknown) => ReferenceAlternativesOutcome; preparePantry: (rows: unknown) => PantryIntakeOutcome | { readonly outcome: "held"; readonly code: "pantry_intake_not_configured" } };
export type JoinedReferenceBinding = { readonly outcome: "ready"; readonly source: { readonly sha256: string; readonly recordCount: number }; readonly planner: Planner } | { readonly outcome: "error"; readonly code: string };

type QuoteV2 = Extract<RegionalQuoteOutcomeV2, { outcome: "quoted" }>;
type Partition = Extract<TapWaterPartitionOutcome, { outcome: "partitioned" }>;
type Rejection = Exclude<ReferencePlanOutcome, { outcome: "success" }>;
export type ReferenceEvaluationSuccessV2 = Omit<ReferenceEvaluationSuccess, "quote"> & {
  readonly quote: QuoteV2; readonly sourcePolicyBasis: SourcePolicyBasisV2; readonly utilityPartition: Partition | null;
};
export type ReferencePlanOutcomeV2 = Rejection | ReferenceEvaluationSuccessV2;
export type NonShoppingUsageV2 = null | {
  readonly policy: "wd-tap-cooking-water-utility-v1";
  readonly items: readonly { readonly assignmentId: string; readonly personId: string; readonly recipeId: string; readonly ingredientId: string; readonly displayName: "Cooking water"; readonly unit: "ml"; readonly quantity: { readonly numerator: string; readonly denominator: string } }[];
  readonly warnings: readonly "tap-cooking-water-excluded-from-food-groceries"[];
};
export type ReferenceReplacementOutcomeV2 = Rejection | Omit<Extract<ReferenceReplacementOutcome, { outcome: "preview" }>, "before" | "after"> & {
  readonly before: ReferenceEvaluationSuccessV2; readonly after: ReferenceEvaluationSuccessV2;
  readonly sourcePolicyBasisSha256: string; readonly nonShoppingUsageBefore: NonShoppingUsageV2; readonly nonShoppingUsageAfter: NonShoppingUsageV2;
};
export type ReferenceConfirmationOutcomeV2 = Rejection | Omit<Extract<ReferenceConfirmationOutcome, { outcome: "proposal" }>, "evaluation"> & { readonly evaluation: ReferenceEvaluationSuccessV2 };
export type ReferenceSearchOutcomeV2 = Exclude<ReferenceSearchOutcome, { outcome: "success" }> | ReferenceEvaluationSuccessV2 & Pick<Extract<ReferenceSearchOutcome, { outcome: "success" }>, "search">;
export type ReferenceAlternativesOutcomeV2 = Rejection | Omit<Extract<ReferenceAlternativesOutcome, { outcome: "alternatives" }>, "candidates"> & {
  readonly candidates: readonly { readonly recipeId: string; readonly sourceServings: import("../packages/solver/src/generated-plan-measures.ts").ExactAmount; readonly preview: Extract<ReferenceReplacementOutcomeV2, { outcome: "preview" }> }[];
};
export type PlannerV2 = Omit<Planner, "evaluateJoined" | "previewReplacement" | "confirmReplacement" | "planJoined" | "findReplacements"> & {
  evaluateJoined: (assignments: unknown, request: unknown) => ReferencePlanOutcomeV2;
  previewReplacement: (assignments: unknown, request: unknown, intent: unknown) => ReferenceReplacementOutcomeV2;
  confirmReplacement: (assignments: unknown, request: unknown, confirmation: unknown) => ReferenceConfirmationOutcomeV2;
  planJoined: (request: unknown, grid: unknown) => ReferenceSearchOutcomeV2;
  findReplacements: (assignments: unknown, request: unknown, grid: unknown) => ReferenceAlternativesOutcomeV2;
};
export type JoinedReferenceBindingV2 = { readonly outcome: "ready"; readonly source: { readonly sha256: string; readonly recordCount: number }; readonly sourcePolicyBasis: SourcePolicyBasisV2; readonly planner: PlannerV2 } | { readonly outcome: "error"; readonly code: string } | { readonly outcome: "held"; readonly code: string };
export type ReferenceEvaluationSuccessV3=Omit<ReferenceEvaluationSuccessV2,"quote"> & {readonly quote:RegionalQuoteSuccessV3};
export type ReferencePlanOutcomeV3=Rejection|ReferenceEvaluationSuccessV3;
export type ReferenceReplacementOutcomeV3=Rejection|(Omit<Extract<ReferenceReplacementOutcomeV2,{outcome:"preview"}>,"before"|"after">&{readonly before:ReferenceEvaluationSuccessV3;readonly after:ReferenceEvaluationSuccessV3});
export type ReferenceConfirmationOutcomeV3=Rejection|(Omit<Extract<ReferenceConfirmationOutcomeV2,{outcome:"proposal"}>,"evaluation">&{readonly evaluation:ReferenceEvaluationSuccessV3});
export type PlannerV3=Omit<PlannerV2,"evaluateJoined"|"previewReplacement"|"confirmReplacement"|"planJoined"|"findReplacements"> & {evaluateJoined:(assignments:unknown,request:unknown)=>ReferencePlanOutcomeV3;previewReplacement:(assignments:unknown,request:unknown,intent:unknown)=>ReferenceReplacementOutcomeV3;confirmReplacement:(assignments:unknown,request:unknown,confirmation:unknown)=>ReferenceConfirmationOutcomeV3;planJoined:(request:unknown,grid:unknown)=>Exclude<ReferenceSearchOutcomeV2,{outcome:"success"}>|ReferenceEvaluationSuccessV3&Pick<Extract<ReferenceSearchOutcome,{outcome:"success"}>,"search">;findReplacements:(assignments:unknown,request:unknown,grid:unknown)=>Rejection|(Omit<Extract<ReferenceAlternativesOutcomeV2,{outcome:"alternatives"}>,"candidates">&{readonly candidates:readonly {readonly recipeId:string;readonly sourceServings:import("../packages/solver/src/generated-plan-measures.ts").ExactAmount;readonly preview:Extract<ReferenceReplacementOutcomeV3,{outcome:"preview"}>}[]})};
export type JoinedReferenceBindingV3={readonly outcome:"ready";readonly source:{readonly sha256:string;readonly recordCount:number};readonly sourcePolicyBasis:SourcePolicyBasisV2;readonly planner:PlannerV3}|{readonly outcome:"error"|"held";readonly code:string};
// Private common engine. Version is selected only by the public factory, never
// supplied through JSON. Existing search/alternatives only inspect common fields
// and retain actual evaluation objects, including V2 quote/basis/utility fields.
type InternalSuccess = Omit<ReferenceEvaluationSuccess, "quote"> & { readonly quote: Quote | QuoteV2 | RegionalQuoteSuccessV3; readonly sourcePolicyBasis?: SourcePolicyBasisV2; readonly utilityPartition?: Partition | null };
type InternalPlan = Rejection | InternalSuccess;
type InternalPreview = Rejection | Omit<Extract<ReferenceReplacementOutcome, { outcome: "preview" }>, "before" | "after"> & { readonly before: InternalSuccess; readonly after: InternalSuccess };
type InternalConfirmation = Rejection | Omit<Extract<ReferenceConfirmationOutcome, { outcome: "proposal" }>, "evaluation"> & { readonly evaluation: InternalSuccess };
function usageView(evaluation: InternalSuccess): NonShoppingUsageV2 {
  const partition = evaluation.utilityPartition;
  if (!partition) return null;
  const items = partition.utilityUsage.map(row => {
    const assignment = evaluation.projection.assignments.find(a => a.assignmentId === row.assignmentId);
    if (!assignment || row.baseUnit !== "ml") invalid();
    return { assignmentId: row.assignmentId, personId: assignment.personId, recipeId: row.recipeId, ingredientId: row.ingredientId, displayName: "Cooking water" as const, unit: "ml" as const, quantity: row.amount };
  });
  return freeze({ policy: partition.policy, items, warnings: items.length ? ["tap-cooking-water-excluded-from-food-groceries" as const] : [] });
}

function invalid(): never { throw new Error("Invalid joined reference input"); }
function record(value: unknown, fields: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: Data = {};
  if (fields.some(key => !Object.hasOwn(descriptors, key))) invalid();
  for (const key of keys) {
    if (typeof key !== "string" || ![...fields, ...optional].includes(key)) invalid();
    const descriptor = descriptors[key]!; if (!("value" in descriptor) || !descriptor.enumerable) invalid(); result[key] = descriptor.value;
  }
  return result;
}
function list(value: unknown, maximum: number): unknown[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > maximum) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), result: unknown[] = [];
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) invalid();
  for (let i = 0; i < value.length; i++) { const descriptor = descriptors[String(i)]; if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid(); result.push(descriptor.value); }
  return result;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function strings(value: unknown, maximum: number): string[] { const result = list(value, maximum).map(text); if (new Set(result).size !== result.length) invalid(); return result; }
function date(value: string): string { if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) invalid(); return value; }
function request(value: unknown,equipmentLimit=50, dietaryEnabled = false): ReferenceRequest {
  const fields = record(value, ["people", "selectedDays", "slots", "region", "storeIds", "budgetCents", "asOfDate", "equipment", "pantry"], dietaryEnabled ? ["dietaryPattern"] : []), people = parsePeople(fields.people);
  const dietaryPattern = fields.dietaryPattern as DietaryPattern | undefined;
  if (Object.hasOwn(fields, "dietaryPattern") && (!dietaryPattern || !dietaryPatterns.includes(dietaryPattern))) invalid();
  if (people.outcome !== "validated") invalid();
  const selectedDays = strings(fields.selectedDays, 7).map(date).sort(order), slots = strings(fields.slots, 3).sort(order), equipment = strings(fields.equipment, equipmentLimit).sort(order);
  if (!selectedDays.length || !slots.length || slots.some(value => !["breakfast", "lunch", "dinner"].includes(value))) invalid();
  if (Date.parse(selectedDays[selectedDays.length - 1]!) - Date.parse(selectedDays[0]!) > 6 * 86400000) invalid();
  // Validate/snapshot regional request and stock even when a later goal is held.
  // This empty-demand validation result is never presented as the plan's quote.
  const checked = quoteRegionalEstimates({ region: fields.region, storeIds: fields.storeIds, budgetCents: fields.budgetCents, asOfDate: fields.asOfDate }, [], fields.pantry, []);
  if (checked.outcome !== "quoted") invalid();
  const pantry = checked.ownedRemaining.map(row => ({ skuId: row.skuId, unit: row.unit, formDigest: row.formDigest, quantity: { numerator: Number(row.quantity.numerator), denominator: Number(row.quantity.denominator) } }));
  const normalizedPeople = people.people.map(person => person.preferences ? { ...person, preferences: { preferredRecipeIds: [...person.preferences.preferredRecipeIds].sort(order) } } : person);
  return { people: normalizedPeople.sort((a, b) => order(a.personId, b.personId)), selectedDays, slots: slots as MealAssignment["slot"][], region: checked.region, storeIds: checked.storeIds, budgetCents: fields.budgetCents as number, asOfDate: checked.asOfDate, equipment, pantry, ...(dietaryPattern ? { dietaryPattern } : {}) };
}
function bareAssignments(projected: Projection): MealAssignment[] {
  return projected.assignments.map(({ assignmentId, personId, profileRevision, date, slot, recipeId, recipeSha256, sourceServings }) => ({ assignmentId, personId, profileRevision, date, slot, recipeId, recipeSha256, sourceServings }));
}
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

export function createJoinedReferencePlanner(source: unknown, configuration: unknown): JoinedReferenceBinding {
  return createPlanner(source, configuration, 1) as JoinedReferenceBinding;
}
export function createJoinedReferencePlannerV2(source: unknown, configuration: unknown, trusted?: { readonly currentGuidePolicy?: CurrentGuidePolicy }): JoinedReferenceBindingV2 {
  return createPlanner(source, configuration, 2, trusted?.currentGuidePolicy) as JoinedReferenceBindingV2;
}
export function createJoinedReferencePlannerV3(source:unknown,configuration:unknown,trusted?:{readonly currentGuidePolicy?:CurrentGuidePolicy}):JoinedReferenceBindingV3{return createPlanner(source,configuration,3,trusted?.currentGuidePolicy) as JoinedReferenceBindingV3;}
export function createJoinedReferencePlannerV4(source:unknown,configuration:unknown,trusted?:{readonly currentGuidePolicy?:CurrentGuidePolicy}):JoinedReferenceBindingV3{return createPlanner(source,configuration,4,trusted?.currentGuidePolicy) as JoinedReferenceBindingV3;}

type ReservedReplacementWeek = Pick<import("./generated-plan-state.ts").ReferenceWeekV3,
  "assignments" | "request" | "quote" | "assignmentsSha256" | "requestSha256" | "sourceSha256">;
type ReservedReplacements = {
  find(week: ReservedReplacementWeek, grid: unknown): ReturnType<PlannerV3["findReplacements"]>;
  confirm(week: ReservedReplacementWeek, confirmation: unknown): ReturnType<PlannerV3["confirmReplacement"]>;
};

// Only a saved adjusted week can use these methods. Candidates still come
// from the original catalog.
export function createFixedRebuiltDonorEvaluator(source: unknown, parentConfiguration: unknown, guidePolicy: CurrentGuidePolicy) {
  let configuration: ReturnType<typeof deriveFixedRebuiltDonorConfiguration>;
  try { configuration = deriveFixedRebuiltDonorConfiguration(parentConfiguration); }
  catch { return { outcome: "held", code: "fixed_donor_parent_configuration_mismatch" } as const; }
  const binding = createPlanner(source, configuration, "fixed-donor-v4", guidePolicy) as JoinedReferenceBindingV3 & { reservedReplacements: ReservedReplacements };
  if (binding.outcome !== "ready") return binding;
  if (binding.sourcePolicyBasis.basisSha256 !== FIXED_REBUILT_DONOR_BASIS_SHA256) {
    return { outcome: "held", code: "fixed_donor_basis_mismatch" } as const;
  }
  return Object.freeze({
    outcome: "ready" as const,
    source: binding.source,
    sourcePolicyBasis: binding.sourcePolicyBasis,
    evaluateJoined: binding.planner.evaluateJoined,
    reservedReplacements: binding.reservedReplacements,
  });
}
export function createCuratedSuccessorReferencePlanner(source:unknown,configuration:unknown, household = false, dietaryReview?: TrustedDietaryReview):JoinedReferenceBindingV3 {
  return createCuratedBinding(source, configuration, household, dietaryReview);
}

// Only the shipped South basis is accepted by this historical presenter.
export const CURATED_STRICT_ARCHIVE_BASIS = "120f5944476f34e1438728942ecf6a51f697a70a02a37d7751b7e5798a056211";

export function createCuratedStrictArchivePlanner(source: unknown, configuration: unknown, dietaryReview?: TrustedDietaryReview, household = true) {
  return createCuratedBinding(source, configuration, household, dietaryReview, false, true);
}

export function createCuratedSouthArchivePlanner(source: unknown, configuration: unknown, dietaryReview: TrustedDietaryReview) {
  const binding = createCuratedBinding(source, configuration, true, dietaryReview, true);
  return binding.outcome === "ready" && binding.sourcePolicyBasis.basisSha256 === CURATED_SOUTH_ARCHIVE_BASIS
    ? binding : { outcome: "held" as const, code: "curated_configuration_identity_required" as const };
}

function createCuratedBinding(source: unknown, configuration: unknown, household: boolean, dietaryReview?: TrustedDietaryReview, southArchive = false, strictArchive = false): JoinedReferenceBindingV3 {
  let snapshot: unknown;
  let useArchiveV13: boolean;
  let useArchiveDietary: boolean;
  let useArchiveMethod: boolean;
  try {
    snapshot = copyReferenceData(configuration);
    const configurationDigest = hash(snapshot);
    useArchiveV13 = configurationDigest === archivedV13.CURATED_LOCAL_QA_CONFIGURATION_SHA256;
    useArchiveMethod = configurationDigest === archiveMethod.CURATED_LOCAL_QA_CONFIGURATION_SHA256;
    useArchiveDietary = configurationDigest === archiveDietary.CURATED_LOCAL_QA_CONFIGURATION_SHA256;
    if (southArchive ? !useArchiveDietary || configurationDigest !== CURATED_SOUTH_ARCHIVE_CONFIGURATION : strictArchive ? configurationDigest !== strictArchivePolicy.CURATED_LOCAL_QA_CONFIGURATION_SHA256 : !useArchiveV13 && !useArchiveDietary && !useArchiveMethod && configurationDigest !== CURATED_LOCAL_QA_CONFIGURATION_SHA256) {
      return { outcome: "held", code: "curated_configuration_identity_required" };
    }
  } catch { return {outcome:"error",code:"invalid_planner_configuration"}; }
  return createPlanner(source,snapshot,5,{check:({recipeId,recipeSha256,sourceServings,request:raw})=>{
    const r=raw as ReferenceRequest;
    if(!(useArchiveMethod ? archiveMethod.curatedQaRowAllowed : useArchiveDietary ? archiveDietary.curatedQaRowAllowed : useArchiveV13 ? archivedV13.curatedQaRowAllowed : curatedQaRowAllowed)(recipeId, recipeSha256))return {outcome:"held",reasons:["curated_recipe_review_required"]};
    if(!(southArchive ? archiveDietary.curatedSouthArchiveContextAllowed : useArchiveMethod ? archiveMethod.curatedQaContextAllowed : useArchiveDietary ? archiveDietary.curatedQaContextAllowed : useArchiveV13 ? archivedV13.curatedQaContextAllowed : strictArchive ? strictArchivePolicy.curatedQaContextAllowed : curatedQaContextAllowed)(r))return {outcome:"held",reasons:["curated_reference_context_required"]};
    return sourceServings.numerator===sourceServings.denominator && r.people.length <= (household ? CURATED_HOUSEHOLD_MAX : 1)
      ? {outcome:"allowed"} : {outcome:"held",reasons:["curated_one_person_one_serving_required"]};
  }}, household, dietaryReview, useArchiveV13, southArchive, useArchiveDietary, useArchiveMethod, strictArchive) as JoinedReferenceBindingV3;
}
const registeredDietaryGuards = new WeakMap<object, NonNullable<ReturnType<typeof createDietaryRecipeGuard>>>();
export function joinedPlannerDietaryGuard(planner: object) {
  return registeredDietaryGuards.get(planner);
}

type TrustedDietaryReview = Readonly<{ registry: DietaryRegistry; registrySha256: string }>;
function createPlanner(source: unknown, configuration: unknown, mode: 1 | 2 | 3 | 4 | 5 | "fixed-donor-v4", guidePolicy?: CurrentGuidePolicy, curatedHousehold = false, dietaryReview?: TrustedDietaryReview, useArchiveV13 = false, southArchive = false, useArchiveDietary = false, useArchiveMethod = false, strictArchive = false): JoinedReferenceBinding | JoinedReferenceBindingV2 | JoinedReferenceBindingV3 {
  const version = mode === "fixed-donor-v4" ? 4 : mode;
  let configured: Data;
  try { configured = record(configuration, ["correspondences", "regionalPackFacts"], ["sourcePin", "pantryIntake", "schedulePolicy", "householdAllergies", "referencePrices", ...(version >= 2 ? ["tapCookingWater"] : []),...(version>=3?["rateReferences"]:[])]); } catch { return { outcome: "error", code: "invalid_planner_configuration" }; }
  if (Object.hasOwn(configured, "schedulePolicy") && configured.schedulePolicy !== "wd-seven-day-three-meals-v1") return { outcome: "error", code: "invalid_planner_configuration" };
  const fullDayPolicy = configured.schedulePolicy === "wd-seven-day-three-meals-v1";
  function fullSchedule(selected: ReferenceRequest): boolean { return selected.selectedDays.length === 7 && selected.slots.join("|") === "breakfast|dinner|lunch" && selected.people.every(p => p.proteinGoal.kind === "unknown" || p.proteinGoal.coverage === "full-day"); }
  function activeHolds(holds: readonly import("../packages/solver/src/generated-plan-contract.ts").PersonHold[], allergies?: HouseholdAllergyOutcome) {
    return holds.filter(h => !(fullDayPolicy && h.code === "goal_coverage_policy_required" && h.field === "proteinGoal") && !(h.code === "exclusion_scope_policy_required" && allergies?.outcome === "allowed" && allergies.active));
  }
  function allergyRejection(result: Exclude<HouseholdAllergyOutcome, { outcome: "allowed" }>): Exclude<ReferencePlanOutcome, { outcome: "success" }> {
    if (result.outcome === "error") return result;
    if (result.outcome === "no_fit") return freeze({ outcome: "no_fit", scope: "evaluated-assignments-only", week: null, reasons: result.reasons });
    return { outcome: "held", reasons: [{ code: result.code, ...(result.personId ? { personId: result.personId } : {}) }] };
  }
  let bound: ReturnType<typeof createRevisedAssignmentProjector>;
  try { bound = createRevisedAssignmentProjector(source, Object.hasOwn(configured, "sourcePin") ? configured.sourcePin : CURRENT_REVISED_CATALOG_PIN); } catch { return { outcome: "error", code: "invalid_planner_configuration" }; }
  if (bound.outcome !== "ready") return bound;
  const exactDonor = bound.catalog.sourceSha256 === FIXED_REBUILT_DONOR_PIN.sha256;
  if (exactDonor !== (mode === "fixed-donor-v4")) return { outcome: "held", code: "fixed_donor_evaluation_required" };
  const curatedPin = useArchiveMethod ? archiveMethod.CURATED_LOCAL_QA_PIN : useArchiveDietary ? archiveDietary.CURATED_LOCAL_QA_PIN : useArchiveV13 ? archivedV13.CURATED_LOCAL_QA_PIN : CURATED_SUCCESSOR_PIN;
  if (version === 5 && (bound.catalog.sourceSha256 !== curatedPin.sha256 ||
      bound.catalog.recipes.length !== curatedPin.recordCount)) {
    return { outcome: "held", code: "curated_source_family_required" };
  }
  const exactRebuilt = bound.catalog.sourceSha256 === FIXED_REBUILT_PIN.sha256;
  if (exactRebuilt && (version !== 4 || !fixedRebuiltConfigurationMatches(configuration))) {
    return { outcome: "held", code: "rebuilt_configuration_identity_required" };
  }
  if (version >= 3 && version !== 5 && !exactRebuilt && !exactDonor && bound.catalog.sourceSha256 !== FINAL_DERIVED_PIN.sha256) {
    return { outcome: "held", code: "v3_source_family_required" };
  }
  const projector = bound, recipes = new Map(projector.catalog.recipes.map(recipe => [recipe.id, recipe]));
  let allergyGuard: Extract<ReturnType<typeof createHouseholdAllergyGuard>, { outcome: "ready" }> | null = null;
  if (Object.hasOwn(configured, "householdAllergies")) {
    const guard = createHouseholdAllergyGuard(configured.householdAllergies, projector.catalog.sourceSha256);
    if (guard.outcome !== "ready") return { outcome: "error", code: "invalid_planner_configuration" }; allergyGuard = guard;
  }
  // Snapshot configured registries before exposing methods. Neither JSON
  // serialization nor structuredClone is safe here: either can invoke supplied
  // code/getters. Do not freeze caller objects as that changes their state.
  let correspondences: unknown, prices: unknown, referencePrices: unknown;
  let rates:RateConfiguration|undefined;
  let utilityConfiguration: unknown | null = null, utility: Extract<ReturnType<typeof createTapCookingWaterClassifier>, { outcome: "ready" }> | null = null;
  let sourcePolicyBasis: SourcePolicyBasisV2 | undefined;
  let dietaryGuard: ReturnType<typeof createDietaryRecipeGuard> = null;
  try {
    if(version>=3)rates=readRateReferenceConfiguration(configured.rateReferences);
    correspondences = version === 5
      ? captureReferencePurchaseCorrespondences(configured.correspondences)
      : freeze(copyReferenceData(configured.correspondences));
    prices = freeze(copyReferenceData(configured.regionalPackFacts));
    if (Object.hasOwn(configured, "referencePrices")) referencePrices = (version >= 2 ? readReferencePriceConfigurationV2 : readReferencePriceConfiguration)(copyReferenceData(configured.referencePrices));
    if (version >= 2) {
      // Validate ALL configuration rows, including unused ones, using the actual
      // existing registries. This empty-demand quote is validation, not a plan.
      if (version !== 5 && prepareReferencePurchaseRequirements([], correspondences).outcome !== "prepared") invalid();
      if (quoteRegionalEstimatesV2({ region: "South", storeIds: ["configuration-validation-only"], budgetCents: 0, asOfDate: "2026-10-23" }, [], [], prices, referencePrices).outcome !== "quoted") invalid();
      if (version !== 5) correspondences = captureReferencePurchaseCorrespondences(normalizeSourcePolicyDataV2(correspondences));
      prices = freeze(normalizeSourcePolicyDataV2(prices));
      if (Object.hasOwn(configured, "tapCookingWater")) {
        utilityConfiguration = freeze(copyReferenceData(configured.tapCookingWater));
        const derived = utilityConfiguration !== null && typeof utilityConfiguration === "object" && Object.hasOwn(utilityConfiguration, "derivation");
        if (derived && !exactRebuilt && !exactDonor && projector.catalog.sourceSha256 !== REVIEWED_DERIVED_STARTER_PIN.sha256 && projector.catalog.sourceSha256 !== REVIEWED_PREPARATION_STARTER_PIN.sha256 && projector.catalog.sourceSha256 !== REVIEWED_CURRENT_NATIVE_PIN.sha256 && projector.catalog.sourceSha256 !== REVIEWED_CURRENT_METHOD_PIN.sha256 && projector.catalog.sourceSha256 !== REVIEWED_CURRENT_PRACTICAL_PIN.sha256 && projector.catalog.sourceSha256 !== FINAL_DERIVED_PIN.sha256) return { outcome: "held", code: "tap_water_source_mismatch" };
        const classifier = exactDonor ? createFixedRebuiltDonorTapWaterClassifier : exactRebuilt ? createFixedRebuiltTapCookingWaterClassifier : !derived ? createTapCookingWaterClassifier
          : projector.catalog.sourceSha256 === FINAL_DERIVED_PIN.sha256 ? createFinalDerivedTapCookingWaterClassifier
          : projector.catalog.sourceSha256 === REVIEWED_CURRENT_PRACTICAL_PIN.sha256 ? createReviewedCurrentPracticalTapCookingWaterClassifier
            : projector.catalog.sourceSha256 === REVIEWED_CURRENT_METHOD_PIN.sha256 ? createReviewedCurrentMethodTapCookingWaterClassifier
            : projector.catalog.sourceSha256 === REVIEWED_CURRENT_NATIVE_PIN.sha256 ? createReviewedCurrentNativeTapCookingWaterClassifier
            : projector.catalog.sourceSha256 === REVIEWED_PREPARATION_STARTER_PIN.sha256 ? createReviewedPreparationTapCookingWaterClassifier
              : createReviewedDerivedTapCookingWaterClassifier;
        const checked = classifier(source, utilityConfiguration);
        if (checked.outcome !== "ready") return checked;
        utility = checked;
      }
      sourcePolicyBasis = createSourcePolicyBasisV2(projector.catalog.sourceSha256, correspondences, prices, rates?{...(referencePrices as Record<string,unknown>??{}),rateReferences:rates,...(version===4?{profileMethodPolicy:profileMethodDescriptor()}: {}),...(version===5?{curatedPolicy:curatedHousehold ? (southArchive ? archiveDietary.curatedSouthArchivePolicyDescriptor() : useArchiveMethod ? archiveMethod.curatedHouseholdPolicyDescriptor() : useArchiveDietary ? archiveDietary.curatedHouseholdPolicyDescriptor() : useArchiveV13 ? archivedV13.curatedHouseholdPolicyDescriptor() : strictArchive ? strictArchivePolicy.curatedHouseholdPolicyDescriptor() : curatedHouseholdPolicyDescriptor()) : (useArchiveMethod ? archiveMethod.curatedQaPolicyDescriptor() : useArchiveDietary ? archiveDietary.curatedQaPolicyDescriptor() : useArchiveV13 ? archivedV13.curatedQaPolicyDescriptor() : strictArchive ? strictArchivePolicy.curatedQaPolicyDescriptor() : curatedQaPolicyDescriptor())}: {}), ...(dietaryReview ? { dietaryRegistrySha256: dietaryReview.registrySha256 } : {})}:referencePrices ?? null, utilityConfiguration);
    }
  } catch { return { outcome: "error", code: "invalid_planner_configuration" }; }
  if (dietaryReview) {
    if (version !== 5 || !sourcePolicyBasis) return { outcome: "error", code: "invalid_planner_configuration" };
    dietaryGuard = createDietaryRecipeGuard(dietaryReview.registry, {
      sourceSha256: sourcePolicyBasis.catalogSha256,
      purchaseCorrespondencesSha256: sourcePolicyBasis.purchaseCorrespondencesSha256,
      registrySha256: dietaryReview.registrySha256,
    });
    if (!dietaryGuard) return { outcome: "error", code: "invalid_planner_configuration" };
  }
  let pantryIntake: Extract<ReturnType<typeof createPantryIntake>, { outcome: "ready" }> | null = null;
  if (Object.hasOwn(configured, "pantryIntake")) {
    const intake = createPantryIntake(configured.pantryIntake); if (intake.outcome !== "ready") return { outcome: "error", code: "invalid_planner_configuration" }; pantryIntake = intake;
  }
  function evaluateJoined(assignmentsValue: unknown, requestValue: unknown): InternalPlan {
    let selected: ReferenceRequest;
    try { selected = request(requestValue,version>=3?100:50,!!dietaryGuard); } catch { return { outcome: "error", code: "invalid_joined_request" }; }
    if (fullDayPolicy && !fullSchedule(selected)) return { outcome: "held", reasons: [{ code: "full_week_schedule_required" }] };
    if (selected.people.some(person => person.preferences?.preferredRecipeIds.some(id =>
      !recipes.has(id) || (exactDonor && id === FIXED_REBUILT_DONOR_RECIPE_ID)))) return { outcome: "error", code: "preferred_recipe_missing" };
    try {
      const rawProjection = projector.projectAssignments({ people: selected.people, assignments: assignmentsValue });
      if (rawProjection.outcome === "error") return rawProjection;
      if (rawProjection.outcome === "held") return { outcome: "held", reasons: [{ code: rawProjection.code }] };
      if (guidePolicy) for (const a of rawProjection.assignments) {
        const checked = guidePolicy.check({ recipeId: a.recipeId, recipeSha256: a.recipeSha256, sourceServings: a.sourceServings, request: selected });
        if (checked.outcome !== "allowed") return { outcome: "held", reasons: checked.reasons.map(code => ({ code, assignmentId: a.assignmentId })) };
      }
      if (version === 5) for (const assignment of rawProjection.assignments) {
        if (!reviewedPreparationFits(assignment.recipeId, assignment.recipeSha256, assignment.date, selected.asOfDate))
          return { outcome: "held", reasons: [{ code: "advance_preparation_window_elapsed", personId: assignment.personId }] };
      }
      if (selected.dietaryPattern && dietaryGuard) for (const assignment of rawProjection.assignments) {
        const result = dietaryGuard.check(selected.dietaryPattern, assignment);
        if (result !== "allowed") return { outcome: "held", reasons: [{
          code: result === "excluded" ? "recipe_outside_dietary_pattern" : "recipe_dietary_review_required",
          personId: assignment.personId,
        }] };
      }
      const allergyDeclaration = allergyGuard?.check(selected.people, [], []);
      const projected = { ...rawProjection, constraintHolds: activeHolds(rawProjection.constraintHolds, allergyDeclaration) };
      if (version === 5 && !(useArchiveMethod ? archiveMethod.successorOpenedPackageAllowed : useArchiveDietary ? archiveDietary.successorOpenedPackageAllowed : useArchiveV13 ? archivedV13.successorOpenedPackageAllowed : successorOpenedPackageAllowed)(projected.sourceSha256, bareAssignments(projected))) {
        return { outcome: "held", reasons: [{ code: "opened_package_window_exceeded" }] };
      }
      if (projected.assignments.some(value => !selected.selectedDays.includes(value.date) || !selected.slots.includes(value.slot))) return { outcome: "error", code: "assignment_outside_selected_schedule" };
      if (projected.assignments.length !== selected.people.length * selected.selectedDays.length * selected.slots.length) return { outcome: "error", code: "incomplete_selected_schedule" };
      if (projected.constraintHolds.length) return { outcome: "held", reasons: projected.constraintHolds.map(({ code, personId }) => ({ code, personId })) };
      if (allergyDeclaration && allergyDeclaration.outcome !== "allowed") return allergyRejection(allergyDeclaration);
      const activeAllergies = allergyGuard && allergyDeclaration?.outcome === "allowed" && allergyDeclaration.active ? allergyGuard : null;
      const consumedForms = activeAllergies ? projected.assignments.flatMap(a => a.consumedIngredients.map(i => ({ assignmentId: a.assignmentId, personId: a.personId, ingredientId: i.ingredientId, preparedState: i.preparedState, baseUnit: i.baseUnit }))) : [];
      if (activeAllergies) { const checked = activeAllergies.check(selected.people, consumedForms, []); if (checked.outcome !== "allowed") return allergyRejection(checked); }
      if (projected.personDays.some(day => day.nutrition.totals === null)) return { outcome: "held", reasons: [{ code: "incomplete_nutrition" }] };
      const reasons: { code: string; personId?: string; date?: string; assignmentId?: string }[] = [];
      for (const assignment of projected.assignments) {
        const recipe = recipes.get(assignment.recipeId)!;
        if (!recipe.sections.includes(assignment.slot)) reasons.push({ code: "meal_section_unavailable", assignmentId: assignment.assignmentId });
        if (version === 5 ? !curatedEquipmentSatisfied(recipe.recipe.equipment, selected.equipment) : (version===4?profileMethodEquipment(recipe, selected.equipment):recipe.recipe.equipment).some(item => !selected.equipment.includes(item))) reasons.push({ code: "equipment_unavailable", assignmentId: assignment.assignmentId });
      }
      for (const day of projected.personDays) {
        const person = selected.people.find(value => value.personId === day.personId)!;
        if (person.proteinGoal.kind !== "known") return { outcome: "held", reasons: [{ code: "goal_required", personId: person.personId }] };
        const lower = day.nutrition.totals!.protein_g.min;
        if (compare(rational(BigInt(lower.numerator), BigInt(lower.denominator)), decimal(person.proteinGoal.gramsPerDay)) < 0) reasons.push({ code: "protein_goal_not_met", personId: day.personId, date: day.date });
      }
      if (reasons.length) return freeze({ outcome: "no_fit", scope: "evaluated-assignments-only", week: null, reasons });
      // All source/profile/consumed-nutrition/allergy checks above see the FULL
      // original projection. Only purchasing receives the validated food half.
      let utilityPartition: Partition | null = null;
      if (utility) {
        const split = utility.partition(projected.demands);
        if (split.outcome === "error") return split;
        if (split.outcome === "held") return { outcome: "held", reasons: [{ code: split.code }] };
        utilityPartition = split;
      }
      const purchased = prepareReferencePurchaseRequirements(utilityPartition ? utilityPartition.foodDemands : projected.demands, correspondences);
      if (purchased.outcome === "error") return purchased;
      if (purchased.outcome !== "prepared") return { outcome: "held", reasons: [{ code: purchased.code }] };
      let allergyBasisSha256: string | undefined;
      if (activeAllergies) {
        // Check every prepared purchase requirement, including stock-covered
        // food, not only quote rows with positive packs left to buy.
        const reviewed = activeAllergies.check(selected.people, consumedForms, purchased.requirements.map(r => ({ skuId: r.skuId, unit: r.unit, formDigest: r.formDigest })));
        if (reviewed.outcome !== "allowed") return allergyRejection(reviewed);
        if (!reviewed.active || !reviewed.basisSha256) return { outcome: "error", code: "internal_evaluation_error" }; allergyBasisSha256 = reviewed.basisSha256;
      }
      const quoteRequest={ region: selected.region, storeIds: selected.storeIds, budgetCents: selected.budgetCents, asOfDate: selected.asOfDate };
      const quote = version>=3?quoteRegionalEstimatesV3(quoteRequest,purchased.requirements,selected.pantry,prices,referencePrices,rates):(version >= 2 ? quoteRegionalEstimatesV2 : quoteRegionalEstimates)(quoteRequest, purchased.requirements, selected.pantry, prices, referencePrices);
      if (quote.outcome === "error") return quote;
      if (quote.outcome === "held") return { outcome: "held", reasons: [{ code: quote.code }] };
      if (!tofuStorageFits(projected, quote)) {
        return { outcome: "held", reasons: [{ code: "opened_package_window_exceeded" }] };
      }
      if (!quote.withinBudgetAtUpperEstimate) return { outcome: "no_fit", scope: "evaluated-assignments-only", week: null, reasons: [{ code: "budget_upper_estimate_exceeded" }] };
      return freeze({ outcome: "success", mode: "private-conditional-reference-only", contract: JOINED_PLAN_DRAFT_CONTRACT, productReady: false, requestSha256: hash(selected), assignmentsSha256: hash(bareAssignments(projected)), sourceSha256: projected.sourceSha256, projection: projected, quote, ...(version >= 2 ? { sourcePolicyBasis: sourcePolicyBasis!, utilityPartition } : {}), ...(allergyBasisSha256 ? { allergyBasisSha256 } : {}), ...(fullDayPolicy ? { fullDayCoverage: { policy: "wd-seven-day-three-meals-v1" as const, days: 7 as const } } : {}) });
    } catch { return { outcome: "error", code: "internal_evaluation_error" }; }
  }
  function tofuStorageFits(projected: InternalSuccess["projection"], quote: InternalSuccess["quote"]) {
    const policy = useArchiveMethod ? archiveMethod.successorTofuStoragePolicy : useArchiveDietary ? archiveDietary.successorTofuStoragePolicy : successorTofuStoragePolicy;
    if (projected.sourceSha256 !== policy.sourceSha256) return true;
    const zero = rational(BigInt(0));
    const byDay = new Map<number, Rational>();
    for (const assignment of projected.assignments) for (const ingredient of assignment.consumedIngredients) {
      if (ingredient.ingredientId !== policy.ingredientId) continue;
      if (ingredient.preparedState !== policy.preparedState || ingredient.baseUnit !== "g") return false;
      const day = Date.parse(assignment.date) / 86_400_000;
      const amount = rational(BigInt(ingredient.amount.numerator), BigInt(ingredient.amount.denominator));
      byDay.set(day, add(byDay.get(day) ?? zero, amount));
    }
    if (!byDay.size) return true;
    const row = quote.rows.find(item => item.skuId === policy.skuId && item.formDigest === policy.formDigest);
    if (!row || row.kind === "weight" || !row.packQuantity || row.unit !== "g") return false;
    const pack = rational(BigInt(row.packQuantity.numerator), BigInt(row.packQuantity.denominator));
    let balance = zero, expirationDay = -Infinity, packsOpened = BigInt(0);
    for (const [day, amount] of [...byDay].sort(([a], [b]) => a - b)) {
      if (day > expirationDay) balance = zero;
      const subtract = (left: Rational, right: Rational) =>
        rational(left.n * right.d - right.n * left.d, left.d * right.d);
      if (compare(balance, amount) < 0) {
        const shortfall = divide(subtract(amount, balance), pack);
        const newPacks = (shortfall.n + shortfall.d - BigInt(1)) / shortfall.d;
        packsOpened += newPacks;
        if (packsOpened > BigInt(row.packCount)) return false;
        balance = add(balance, multiply(pack, rational(newPacks)));
        expirationDay = day + policy.maximumCalendarSpanDays - 1;
      }
      balance = subtract(balance, amount);
    }
    return true;
  }
  function previewReplacement(assignments: unknown, request: unknown, intentValue: unknown): InternalPreview {
    const before = evaluateJoined(assignments, request); if (before.outcome !== "success") return before;
    return previewFromEvaluated(before, request, intentValue);
  }
  function previewFromEvaluated(before: InternalSuccess, request: unknown, intentValue: unknown): InternalPreview {
    let intent: Data;
    try { intent = record(intentValue, ["assignmentId", "personId", "expectedRecipeSha256", "replacementRecipeId", "sourceServings"]); for (const key of ["assignmentId", "personId", "expectedRecipeSha256", "replacementRecipeId"]) text(intent[key]); } catch { return { outcome: "error", code: "invalid_replacement_intent" }; }
    const current = before.projection.assignments.find(value => value.assignmentId === intent.assignmentId);
    if (!current) return { outcome: "error", code: "replacement_assignment_missing" };
    if (current.personId !== intent.personId) return { outcome: "error", code: "replacement_subject_mismatch" };
    if (current.recipeSha256 !== intent.expectedRecipeSha256) return { outcome: "error", code: "stale_replacement_source" };
    if (mode === "fixed-donor-v4" && intent.replacementRecipeId === FIXED_REBUILT_DONOR_RECIPE_ID) {
      return { outcome: "error", code: "recipe_missing" };
    }
    const recipe = recipes.get(intent.replacementRecipeId as string); if (!recipe) return { outcome: "error", code: "recipe_missing" };
    const next = bareAssignments(before.projection).map(value => value.assignmentId === current.assignmentId ? { ...value, recipeId: recipe.id, recipeSha256: recipe.recipeSha256, sourceServings: intent.sourceServings } : value);
    const evaluatedAfter = evaluateJoined(next, request); if (evaluatedAfter.outcome !== "success") return evaluatedAfter;let after:InternalSuccess=evaluatedAfter;
    const replacement = after.projection.assignments.find(value => value.assignmentId === current.assignmentId)!;
    if (version === 1) {
      const protein = checkReplacementProteinTolerance(current.nutrition.totals!.protein_g, replacement.nutrition.totals!.protein_g);
      if (protein.outcome === "error") return protein;
      if (protein.outcome === "held") return { outcome: "held", reasons: [{ code: protein.code, personId: current.personId }] };
      if (protein.outcome === "no_fit") return { outcome: "no_fit", scope: "evaluated-assignments-only", week: null, reasons: [{ code: protein.code, personId: current.personId, assignmentId: current.assignmentId }] };
    } else {
      // evaluateJoined above already proves all person/day goals, constraints
      // and portions. Menu replacement additionally cannot add a SKU or pack
      // beyond the saved week's stock. Rebuilding unbought groceries is a
      // distinct reviewed save/draft flow, not a replacement override.
      const available = new Map(before.quote.rows.map(row => [row.skuId, row]));
      if (after.quote.rows.some(row => version>=3 ? isPurchasedQuoteRow(row)&&(!available.has(row.skuId)||!purchasedQuoteCovers(available.get(row.skuId)!,row)) : row.kind!=="weight"&&row.packCount>((available.get(row.skuId)?.packCount)??0))) return { outcome: "no_fit", scope: "evaluated-assignments-only", week: null, reasons: [{ code: "replacement_requires_more_groceries", personId: current.personId, assignmentId: current.assignmentId }] };
    }
    if(version>=3){
      if(!("purchasePolicy"in before.quote)||!("purchasePolicy"in after.quote)||before.quote.purchasePolicy!=="wd-mixed-purchases-v3"||after.quote.purchasePolicy!=="wd-mixed-purchases-v3")invalid();
      after={...after,quote:retainV3PurchaseCustody(before.quote,after.quote)};
    }
    const beforeIds = before.quote.rows.filter(isPurchasedQuoteRow).map(value => value.skuId), afterIds = after.quote.rows.filter(isPurchasedQuoteRow).map(value => value.skuId);
    const target = { personId: current.personId, assignmentId: current.assignmentId };
    const v2Preview = version >= 2 ? { sourcePolicyBasisSha256: sourcePolicyBasis!.basisSha256, nonShoppingUsageBefore: usageView(before), nonShoppingUsageAfter: usageView(after) } : {};
    return freeze({ outcome: "preview", before, after, target, addedBuyIds: afterIds.filter(value => !beforeIds.includes(value)), removedBuyIds: beforeIds.filter(value => !afterIds.includes(value)), itemCountDelta: afterIds.length - beforeIds.length, baseAssignmentsSha256: before.assignmentsSha256, requestSha256: before.requestSha256, previewSha256: hash({ sourceSha256: before.sourceSha256, requestSha256: before.requestSha256, base: before.assignmentsSha256, after: after.assignmentsSha256, beforeQuote: before.quote, quote: after.quote, target, replacementProteinRule: version >= 2 ? REPLACEMENT_RULE_V2 : REPLACEMENT_PROTEIN_RULE, ...v2Preview, ...(version >= 2 ? { beforeUtilityPartition: before.utilityPartition, afterUtilityPartition: after.utilityPartition } : {}), ...(before.allergyBasisSha256 || after.allergyBasisSha256 ? { beforeAllergyBasisSha256: before.allergyBasisSha256 ?? null, afterAllergyBasisSha256: after.allergyBasisSha256 ?? null } : {}) }), ...v2Preview, confirmationRequired: true, saved: false });
  }
  function confirmReplacement(assignments: unknown, request: unknown, value: unknown, saved?: ReservedReplacementWeek): InternalConfirmation {
    let confirmation: Data;
    try {
      confirmation = record(value, ["intent", "expectedPreviewSha256", "expectedRequestSha256", "expectedAssignmentsSha256"]);
      for (const key of ["expectedPreviewSha256", "expectedRequestSha256", "expectedAssignmentsSha256"]) if (!/^[a-f0-9]{64}$/.test(text(confirmation[key]))) invalid();
    } catch { return { outcome: "error", code: "invalid_replacement_confirmation" }; }
    const before = saved ? evaluateReservedWeek(saved) : null;
    const preview = before ? before.outcome === "success" ? previewFromEvaluated(before, request, confirmation.intent) : before
      : previewReplacement(assignments, request, confirmation.intent);
    if (preview.outcome !== "preview") return preview;
    if (preview.previewSha256 !== confirmation.expectedPreviewSha256 || preview.requestSha256 !== confirmation.expectedRequestSha256 || preview.baseAssignmentsSha256 !== confirmation.expectedAssignmentsSha256) return { outcome: "error", code: "stale_replacement_preview" };
    const intent = record(confirmation.intent, ["assignmentId", "personId", "expectedRecipeSha256", "replacementRecipeId", "sourceServings"]);
    return freeze({ outcome: "proposal", evaluation: preview.after, assignmentId: intent.assignmentId as string, personId: intent.personId as string, previewSha256: preview.previewSha256, sourceSha256: preview.after.sourceSha256, requestSha256: preview.requestSha256, baseAssignmentsSha256: preview.baseAssignmentsSha256, saved: false });
  }
  function searchGuidePolicy(pattern: DietaryPattern | undefined): CurrentGuidePolicy | undefined {
    if (!pattern || !dietaryGuard) return guidePolicy;
    const guard = dietaryGuard;
    return { check(input) {
      const result = guard.check(pattern, input);
      if (result !== "allowed") return { outcome: "held", reasons: [
        result === "excluded" ? "recipe_outside_dietary_pattern" : "recipe_dietary_review_required",
      ] };
      return guidePolicy?.check(input) ?? { outcome: "allowed" };
    } };
  }

  function planJoined(requestValue: unknown, searchGrid: unknown): ReferenceSearchOutcome {
    let selected: ReferenceRequest;
    try { selected = request(requestValue,version>=3?100:50,!!dietaryGuard); } catch { return { outcome: "error", code: "invalid_joined_request" }; }
    if (fullDayPolicy && !fullSchedule(selected)) return { outcome: "held", reasons: [{ code: "full_week_schedule_required" }] };
    if (selected.people.some(person => person.preferences?.preferredRecipeIds.some(id => !recipes.has(id)))) return { outcome: "error", code: "preferred_recipe_missing" };
    const people = parsePeople(selected.people);
    if (people.outcome === "error") return people;
    const declaration = allergyGuard?.check(selected.people, [], []), holds = activeHolds(people.holds, declaration);
    if (holds.length) return { outcome: "held", reasons: holds.map(({ code, personId }) => ({ code, personId })) };
    if (declaration?.outcome === "error") return declaration;
    if (declaration?.outcome === "held") return { outcome: "held", reasons: [{ code: declaration.code, ...(declaration.personId ? { personId: declaration.personId } : {}) }] };
    // Empty food lists can validate declarations, never establish a grid no-fit.
    if (declaration?.outcome === "no_fit") return { outcome: "error", code: "internal_allergy_declaration_error" };
    return searchReferenceAssignments(projector.catalog, selected, searchGrid, evaluateJoined as unknown as (assignments: unknown, request: unknown) => ReferencePlanOutcome, fullDayPolicy ? "wd-seven-day-three-meals-v1" : undefined, searchGuidePolicy(selected.dietaryPattern),version===4?PROFILE_METHOD_POLICY:undefined);
  }
  const readReplacementPattern = (value: unknown) => request(value, 100, true).dietaryPattern;
  function findReplacements(assignments: unknown, request: unknown, candidateGrid: unknown, saved?: ReservedReplacementWeek): ReferenceAlternativesOutcome {
    let pattern: DietaryPattern | undefined;
    if (dietaryGuard) {
      try { pattern = readReplacementPattern(request); }
      catch { return { outcome: "error", code: "invalid_joined_request" }; }
    }
    const evaluate = saved ? () => evaluateReservedWeek(saved) : evaluateJoined;
    const stockFilter = exactRebuilt || exactDonor ? (before: ReferenceEvaluationSuccess) =>
      createReplacementStockFilter(correspondences, utilityConfiguration, (before as unknown as ReferenceEvaluationSuccessV3).quote) : undefined;
    return discoverReplacementAlternatives(projector.catalog, assignments, request, candidateGrid, evaluate as unknown as (assignments: unknown, request: unknown) => ReferencePlanOutcome, previewFromEvaluated as unknown as (before: ReferenceEvaluationSuccess, request: unknown, intent: unknown) => ReferenceReplacementOutcome, searchGuidePolicy(pattern), stockFilter);
  }
  function evaluateReservedWeek(saved: ReservedReplacementWeek): InternalPlan {
    const evaluated = evaluateJoined(saved.assignments, saved.request);
    if (evaluated.outcome !== "success") return evaluated;
    if (evaluated.sourceSha256 !== saved.sourceSha256 || evaluated.requestSha256 !== saved.requestSha256 ||
        evaluated.assignmentsSha256 !== saved.assignmentsSha256 ||
        !("purchasePolicy" in evaluated.quote) || evaluated.quote.purchasePolicy !== "wd-mixed-purchases-v3") {
      return { outcome: "error", code: "saved_replacement_basis_changed" };
    }
    try {
      return { ...evaluated, quote: retainV3PurchaseCustody(saved.quote, evaluated.quote) };
    } catch {
      return { outcome: "error", code: "replacement_purchase_custody_changed" };
    }
  }
  function preparePantry(rows: unknown): ReturnType<Planner["preparePantry"]> {
    return pantryIntake ? pantryIntake.prepare(rows) : { outcome: "held", code: "pantry_intake_not_configured" };
  }
  const planner = Object.freeze({ evaluateJoined, previewReplacement, planJoined, confirmReplacement, findReplacements, preparePantry });
  const reservedReplacements = mode === "fixed-donor-v4" ? Object.freeze({
    find: (week: ReservedReplacementWeek, grid: unknown) => findReplacements(week.assignments, week.request, grid, week),
    confirm: (week: ReservedReplacementWeek, confirmation: unknown) => confirmReplacement(week.assignments, week.request, confirmation, week),
  }) : undefined;
  if (dietaryGuard) registeredDietaryGuards.set(planner, dietaryGuard);
  return Object.freeze({ outcome: "ready", source: Object.freeze({ sha256: projector.catalog.sourceSha256, recordCount: projector.catalog.recipes.length }), ...(version >= 2 ? { sourcePolicyBasis: sourcePolicyBasis! } : {}), planner, ...(reservedReplacements ? { reservedReplacements } : {}) }) as unknown as JoinedReferenceBinding | JoinedReferenceBindingV2;
}

