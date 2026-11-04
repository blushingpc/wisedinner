import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { parsePeople, type PersonInput } from "../packages/solver/src/generated-plan-contract.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { quoteRegionalEstimates, quoteRegionalEstimatesV2 } from "./generated-regional-quote.ts";
import { HOUSEHOLD_ALLERGY_POLICY } from "./generated-household-allergies.ts";

// An unbound producer adapter proposal. No native imports, persistent profile
// store, default region, owner/access grant, live retailer data or public route.
export const NATIVE_INTAKE_BINDING = "wd-native-intake-binding-proposal-v1";
export const NATIVE_INTAKE_BINDING_V2 = "wd-native-intake-binding-proposal-v2";
export const EXACT_CUSTOM_FOOD_ALLERGY_POLICY = "wd-exact-custom-food-allergy-v1";
export const SHOPPING_PREFERENCE_POLICY_V2 = "wd-shopping-preference-reference-only-v1";
export const SHOPPING_PRICE_DISCLOSURE = "Grocery prices are estimates, not prices from your selected shops.";
const shoppingPolicy = Object.freeze({ policy: SHOPPING_PREFERENCE_POLICY_V2, revision: 1, maximumCustomCodeUnits: 200, normalization: "trim-NFC-display-only", pricing: "reference-only", disclosure: SHOPPING_PRICE_DISCLOSURE });
export const SHOPPING_PREFERENCE_POLICY_SHA256 = hash(canonicalReferenceData(shoppingPolicy));
export type ShoppingPreferenceV2 = { readonly policy: typeof SHOPPING_PREFERENCE_POLICY_V2; readonly policySha256: string; readonly choiceSha256: string; readonly kind: "none" | "listed" | "custom" | "mixed"; readonly listed: readonly string[]; readonly originalOther: string; readonly customDisplay: string; readonly storeIds: readonly string[]; readonly evidence: "user-declared-preference-not-retailer-price-evidence"; readonly disclosure: typeof SHOPPING_PRICE_DISCLOSURE };
const COVERAGE = "wd-seven-day-three-meals-v1";
type Data = Record<string, unknown>;
type Issue = { readonly code: string; readonly field: string; readonly personId?: string; readonly profileRevision?: number };
type Mapping = { readonly label: string; readonly id: string; readonly sourceSha256: string; readonly kind?: string };
type IntakeRequest = { readonly people: readonly PersonInput[]; readonly budgetCents: number; readonly selectedDays: readonly string[]; readonly slots: readonly string[]; readonly region: string; readonly storeIds: readonly string[]; readonly asOfDate: string; readonly equipment: readonly string[]; readonly pantry: readonly never[] };
type IntakeVersion = typeof NATIVE_INTAKE_BINDING | typeof NATIVE_INTAKE_BINDING_V2;
type Outcome<V extends IntakeVersion = typeof NATIVE_INTAKE_BINDING> = { readonly outcome: "ready"; readonly version: V; readonly request: IntakeRequest; readonly inputSha256: string; readonly mappingEvidence: readonly Mapping[]; readonly shoppingPreference?: ShoppingPreferenceV2; readonly inactiveWeeklyKeys: readonly string[]; readonly acceptedByNative: false; readonly solved: false; readonly saved: false } | { readonly outcome: "held"; readonly issues: readonly Issue[]; readonly request: null; readonly inputSha256: string } | { readonly outcome: "error"; readonly code: "invalid_native_intake" };
function invalid(): never { throw new TypeError("Native input refused"); }
function record(value: unknown, fields: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || fields.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => ![...fields, ...optional].includes(k))) invalid();
  return value as Data;
}
function string(value: unknown): string { if (typeof value !== "string" || value.length > 1000) invalid(); return value; }
function nonempty(value: unknown): string { const result = string(value); if (!result.trim()) invalid(); return result; }
function sha(value: unknown): string { const result = nonempty(value); if (!/^[a-f0-9]{64}$/.test(result)) invalid(); return result; }
function list(value: unknown, max = 100): unknown[] { if (!Array.isArray(value) || value.length > max) invalid(); return value; }
function strings(value: unknown): string[] { const result = list(value).map(nonempty); if (new Set(result).size !== result.length) invalid(); return result; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 0) invalid(); return value as number; }
function boolean(value: unknown): boolean { if (typeof value !== "boolean") invalid(); return value; }
function date(value: unknown): string | null { const result = string(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) return null; const parsed = new Date(result + "T00:00:00.000Z"); return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === result ? result : null; }
function digest(value: unknown): string { return hash(canonicalReferenceData(value)); }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function person(value: unknown) {
  const p = record(value, ["id", "name", "avatar", "protein", "proteinUnknown", "lastKnownProtein", "calories", "exclusions"]);
  nonempty(p.id); string(p.name); revision(p.avatar); string(p.protein); boolean(p.proteinUnknown); string(p.lastKnownProtein); string(p.calories);
  const exclusion = record(p.exclusions, ["answer", "listed", "custom"]);
  if (!["unanswered", "none", "listed"].includes(string(exclusion.answer))) invalid(); strings(exclusion.listed); string(exclusion.custom);
  return p;
}
// Only consequential profile fields bind a persisted profile revision. Avatar
// and last-known editor text are presentation history, never a new goal answer.
export function nativePersonAnswerDigest(value: unknown): string {
  const p = person(copyReferenceData(value));
  return digest({ personId: p.id, label: p.name, protein: p.protein, proteinUnknown: p.proteinUnknown, calories: p.calories, exclusions: p.exclusions });
}
function cents(value: string): number | null {
  const m = /^(0|[1-9]\d*)(?:\.(\d{1,2}))?$/.exec(value); if (!m) return null;
  const total = BigInt(m[1]!) * BigInt(100) + BigInt((m[2] ?? "").padEnd(2, "0"));
  return total > BigInt(0) && total <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(total) : null;
}
function positive(value: string): boolean { return /^\d+(?:\.\d{1,2})?$/.test(value) && Number.isFinite(Number(value)) && Number(value) > 0; }
function mappings(value: unknown, stores: boolean): Map<string, Mapping> {
  const result = new Map<string, Mapping>(), ids = new Set<string>();
  for (const raw of list(value, 1000)) {
    const row = record(raw, ["label", "id", "sourceSha256", ...(stores ? ["kind"] : [])]);
    const mapping = { label: nonempty(row.label), id: nonempty(row.id), sourceSha256: sha(row.sourceSha256), ...(stores ? { kind: string(row.kind) } : {}) };
    if (stores && mapping.kind !== "listed" && mapping.kind !== "other") invalid();
    const key = stores ? mapping.kind + ":" + mapping.label : mapping.label;
    if (result.has(key) || ids.has(mapping.id)) invalid(); result.set(key, freeze(mapping)); ids.add(mapping.id);
  }
  return result;
}
function activeWeekly(value: unknown): boolean {
  const row = record(value, ["answers", "custom", "foods"]), groups = ["equipment", "time", "styles", "cuisines", "variety", "leftovers"];
  const answers = record(row.answers, [], groups), custom = record(row.custom, [], groups), foods = record(row.foods, [], Object.keys(row.foods as Data ?? {}));
  let nonemptyAnswer = false;
  for (const values of Object.values(answers)) if (strings(values).length) nonemptyAnswer = true;
  for (const raw of Object.values(custom)) if (string(raw).trim()) nonemptyAnswer = true;
  for (const raw of Object.values(foods)) { const food = record(raw, ["include", "avoid"]); if (string(food.include).trim() || string(food.avoid).trim()) nonemptyAnswer = true; }
  return nonemptyAnswer;
}

// A code-reviewed preference policy, not an assertion that a shop, offer or
// price exists. Raw custom text is retained separately from display-only NFC.
// The namespaced strategy token is only a request binding; it grants no facts.
export function bindShoppingPreferenceV2(value: unknown, mappingValues: unknown): ShoppingPreferenceV2 {
  const choice = record(copyReferenceData(value), ["labels", "other"]), listed = strings(choice.labels), originalOther = string(choice.other);
  if (listed.length > 100 || originalOther.length > 200 || /[\u0000-\u001f\u007f]/u.test(originalOther)) invalid();
  const configured = mappings(copyReferenceData(mappingValues), true), customDisplay = originalOther.trim().normalize("NFC");
  const storeIds = listed.map(label => { const mapping = configured.get("listed:" + label); if (!mapping) invalid(); return mapping.id; });
  if (customDisplay) storeIds.push("wd-shopping-preference:custom:" + digest({ policy: SHOPPING_PREFERENCE_POLICY_V2, originalOther }));
  if (!storeIds.length) storeIds.push("wd-reference-estimate:no-shop-preference");
  if (new Set(storeIds).size !== storeIds.length || storeIds.length > 101) invalid();
  return freeze({ policy: SHOPPING_PREFERENCE_POLICY_V2, policySha256: SHOPPING_PREFERENCE_POLICY_SHA256, choiceSha256: digest({ policySha256: SHOPPING_PREFERENCE_POLICY_SHA256, listed, originalOther, storeIds }), kind: listed.length ? customDisplay ? "mixed" : "listed" : customDisplay ? "custom" : "none", listed, originalOther, customDisplay, storeIds, evidence: "user-declared-preference-not-retailer-price-evidence", disclosure: SHOPPING_PRICE_DISCLOSURE });
}

// Configuration and context are supplied by a trusted host, not accepted from
// the request body as provenance or authorization. The app must acknowledge
// this version and supply actual profile/region/date/mapping evidence to bind it.
type IntakeAdapter<V extends IntakeVersion> = { readonly outcome: "ready"; readonly prepare: (draft: unknown, trustedContext: unknown) => Outcome<V> } | { readonly outcome: "error"; readonly code: "invalid_native_intake_configuration" };
export function createNativeIntakeAdapter(configuration: unknown): IntakeAdapter<typeof NATIVE_INTAKE_BINDING> { return createIntakeAdapter(configuration, NATIVE_INTAKE_BINDING); }
export function createNativeIntakeAdapterV2(configuration: unknown): IntakeAdapter<typeof NATIVE_INTAKE_BINDING_V2> { return createIntakeAdapter(configuration, NATIVE_INTAKE_BINDING_V2); }
function createIntakeAdapter<V extends IntakeVersion>(configuration: unknown, version: V): IntakeAdapter<V> {
  let sourceSha256: string, stores: Map<string, Mapping>, tools: Map<string, Mapping>, allergyMappingRevision = 0;
  let foodAllergies: Map<string, Mapping> | null = null, exactCustomAllergies = false;
  let shoppingMappings: unknown = null;
  try {
    const config = record(copyReferenceData(configuration), ["sourceSha256", "storeMappings", "equipmentMappings"], ["foodAllergyMappings", ...(version === NATIVE_INTAKE_BINDING_V2 ? ["shoppingPreferencePolicy"] : [])]); sourceSha256 = sha(config.sourceSha256); stores = mappings(config.storeMappings, true); tools = mappings(config.equipmentMappings, false);
    if (version === NATIVE_INTAKE_BINDING_V2) {
      if (config.shoppingPreferencePolicy !== SHOPPING_PREFERENCE_POLICY_V2) invalid();
      shoppingMappings = config.storeMappings;
    }
    if (Object.hasOwn(config, "foodAllergyMappings")) {
      const review = record(config.foodAllergyMappings, ["policy", "mappingRevision", "labels"], ["customPolicy"]); if (review.policy !== HOUSEHOLD_ALLERGY_POLICY) invalid();
      if (Object.hasOwn(review, "customPolicy") && review.customPolicy !== EXACT_CUSTOM_FOOD_ALLERGY_POLICY) invalid();
      exactCustomAllergies = review.customPolicy === EXACT_CUSTOM_FOOD_ALLERGY_POLICY;
      allergyMappingRevision = revision(review.mappingRevision); foodAllergies = new Map();
      for (const value of list(review.labels, 1000)) {
        const row = record(value, ["label", "allergenId", "kind", "sourceSha256"]), label = nonempty(row.label);
        if (row.kind !== "food-allergy" || foodAllergies.has(label)) invalid();
        foodAllergies.set(label, freeze({ label, id: nonempty(row.allergenId), kind: "food-allergy", sourceSha256: sha(row.sourceSha256) }));
      }
    }
  }
  catch { return { outcome: "error", code: "invalid_native_intake_configuration" }; }
  function prepare(draftValue: unknown, contextValue: unknown): Outcome<V> {
    try {
      const draft = record(copyReferenceData(draftValue), ["schema", "nextPerson", "primaryPersonId", "people", "budget", "coverage", "dietaryRule", "additionalRule", "equipment", "equipmentReviewed", "stores", "pantry", "pantryEntry", "mode", "startDate", "weekly"]);
      if (draft.schema !== "wd-native-ui-draft-v1" || draft.mode !== "current" && draft.mode !== "new") invalid(); revision(draft.nextPerson);
      const people = list(draft.people, 8).map(person), personIds = people.map(p => nonempty(p.id));
      if (!people.length || new Set(personIds).size !== personIds.length || !personIds.includes(nonempty(draft.primaryPersonId))) invalid();
      const context = record(copyReferenceData(contextValue), ["sourceSha256", "region", "asOfDate", "startDate", "profiles"]), issues: Issue[] = [];
      const add = (code: string, field: string, extra: Partial<Issue> = {}) => issues.push({ code, field, ...extra });
      const inputSha256 = digest(version === NATIVE_INTAKE_BINDING_V2 ? { draft, context, shoppingPreferencePolicySha256: SHOPPING_PREFERENCE_POLICY_SHA256 } : { draft, context }), evidence: Mapping[] = [];
      if (sha(context.sourceSha256) !== sourceSha256) add("source_binding_mismatch", "sourceSha256");
      const region = string(context.region); if (!["Northeast", "Midwest", "South", "West"].includes(region)) add("supported_region_required", "region");
      const asOfDate = date(context.asOfDate), startDate = date(context.startDate), draftDate = date(draft.startDate);
      if (!asOfDate) add("estimate_date_required", "asOfDate");
      if (!startDate || draftDate !== startDate) add("week_date_binding_required", "startDate");
      const selectedDays = startDate ? Array.from({ length: 7 }, (_, i) => new Date(Date.parse(startDate + "T00:00:00.000Z") + i * 86400000).toISOString().slice(0, 10)) : [];
      if (selectedDays.some(day => date(day) === null)) add("week_date_binding_required", "startDate");
      if (string(draft.coverage) !== COVERAGE) add("coverage_confirmation_required", "coverage");
      const budgetCents = cents(string(draft.budget)); if (budgetCents === null) add("invalid_household_budget", "budget");
      if (string(draft.dietaryRule) !== "No set pattern") add("eating_pattern_mapping_required", "dietaryRule");
      if (string(draft.additionalRule).trim()) add("custom_restriction_mapping_required", "additionalRule");
      const profiles = list(context.profiles, 8).map(raw => { const p = record(raw, ["personId", "profileRevision", "answerSha256"]); return { personId: nonempty(p.personId), profileRevision: revision(p.profileRevision), answerSha256: sha(p.answerSha256) }; });
      if (new Set(profiles.map(p => p.personId)).size !== profiles.length) invalid();
      if (profiles.length !== personIds.length || profiles.some(p => !personIds.includes(p.personId))) add("household_profile_binding_mismatch", "people");
      const members: PersonInput[] = [];
      for (const p of people) {
        const personId = p.id as string, bound = profiles.find(row => row.personId === personId), subject = { personId, ...(bound ? { profileRevision: bound.profileRevision } : {}) };
        if (!bound) { add("profile_binding_required", "people", subject); continue; }
        if (bound.answerSha256 !== nativePersonAnswerDigest(p)) add("stale_profile_binding", "people", subject);
        const unknown = p.proteinUnknown as boolean, protein = p.protein as string, calories = p.calories as string, exclusions = p.exclusions as Data;
        if (!string(p.name).trim()) add("person_label_required", "name", subject);
        if (unknown) add("goal_required", "proteinGoal", subject);
        else if (!positive(protein) || Number(protein) > 1000) add("invalid_protein_goal", "proteinGoal", subject);
        if (calories !== "") add(positive(calories) ? "calorie_constraint_not_connected" : "invalid_calorie_goal", "calorieGoal", subject);
        let mappedExclusions: PersonInput["exclusions"] = { kind: "none" };
        const listed = exclusions.listed as string[], custom = string(exclusions.custom).trim();
        if (exclusions.answer !== "none" || listed.length || custom) {
          if (exclusions.answer === "listed" && (listed.length || custom) && (!custom || exactCustomAllergies) && foodAllergies) {
            // The complete custom entry must be an exact reviewed host label.
            // Never split, case-fold, guess or discard part of a declaration.
            const labels = [...listed, ...(custom ? [custom] : [])];
            const mapped = labels.map(label => foodAllergies!.get(label));
            if (mapped.some(value => !value)) add("exclusion_mapping_required", "exclusions", subject);
            else {
              const reviewed = mapped as Mapping[]; evidence.push(...reviewed);
              mappedExclusions = { kind: "mapped", ingredientIds: [], allergenIds: [...new Set(reviewed.map(value => value.id))].sort(), mappingRevision: allergyMappingRevision, scope: "household" };
            }
          } else add(exclusions.answer === "unanswered" ? "exclusion_status_required" : "exclusion_mapping_required", "exclusions", subject);
        }
        members.push({ personId, profileRevision: bound.profileRevision, label: string(p.name), proteinGoal: unknown ? { kind: "unknown" } : { kind: "known", gramsPerDay: protein, coverage: "full-day" }, calorieGoal: { kind: "unset" }, exclusions: mappedExclusions });
      }
      const choice = record(draft.stores, ["labels", "other"]), storeIds: string[] = [];
      const choices = strings(choice.labels).map(label => ({ kind: "listed", label })); if (string(choice.other).trim()) choices.push({ kind: "other", label: string(choice.other).trim() });
      let shoppingPreference: ShoppingPreferenceV2 | undefined;
      if (version === NATIVE_INTAKE_BINDING_V2) {
        try {
          shoppingPreference = bindShoppingPreferenceV2(choice, shoppingMappings); storeIds.push(...shoppingPreference.storeIds);
          for (const chosen of choices.filter(c => c.kind === "listed")) evidence.push(stores.get("listed:" + chosen.label)!);
        } catch { add("shopping_preference_needs_review", "stores"); }
      } else for (const chosen of choices) { const mapping = stores.get(chosen.kind + ":" + chosen.label); if (!mapping) add("store_mapping_required", "stores"); else { storeIds.push(mapping.id); evidence.push(mapping); } }
      if (!boolean(draft.equipmentReviewed)) add("equipment_confirmation_required", "equipment");
      const equipment: string[] = []; for (const label of strings(draft.equipment)) { const mapping = tools.get(label); if (!mapping) add("equipment_mapping_required", "equipment"); else { equipment.push(mapping.id); evidence.push(mapping); } }
      const pantry = list(draft.pantry, 1000); const pantryIds = new Set<string>();
      for (const raw of pantry) { const p = record(raw, ["id", "name", "amount", "form"]), id = nonempty(p.id); if (pantryIds.has(id)) invalid(); pantryIds.add(id); nonempty(p.name); string(p.amount); string(p.form); }
      if (pantry.length) add("pantry_observation_mapping_required", "pantry");
      const entry = record(draft.pantryEntry, ["name", "amount", "form"]); if (Object.values(entry).some(v => string(v).trim())) add("pantry_entry_unfinished", "pantryEntry");
      const weekly = record(draft.weekly, [], Object.keys(draft.weekly as Data ?? {})), activeKey = draft.mode === "current" ? "current" : "new:" + string(draft.startDate);
      for (const [key, value] of Object.entries(weekly)) { if (key !== "current" && (!key.startsWith("new:") || date(key.slice(4)) === null)) invalid(); const active = activeWeekly(value); if (key === activeKey && active) add("weekly_preferences_mapping_required", "weekly"); }
      if (!issues.length) {
        // Reuse the shared quote validator. An explicit empty array preserves
        // no preference; mapped selections retain their order. Never invent a
        // retailer or erase an unmapped Other answer to make a request ready.
        const regional = (version === NATIVE_INTAKE_BINDING_V2 ? quoteRegionalEstimatesV2 : quoteRegionalEstimates)({ region, storeIds, budgetCents, asOfDate }, [], [], []);
        if (regional.outcome !== "quoted") add(storeIds.length ? "store_selection_not_supported" : "no_store_preference_binding_required", "stores");
      }
      if (issues.length) return freeze({ outcome: "held", issues, request: null, inputSha256 });
      const checked = parsePeople(members); if (checked.outcome !== "validated") invalid();
      return freeze({ outcome: "ready", version, request: { people: checked.people, budgetCents: budgetCents!, selectedDays, slots: ["breakfast", "lunch", "dinner"], region, storeIds, asOfDate: asOfDate!, equipment, pantry: [] }, inputSha256, mappingEvidence: evidence, ...(shoppingPreference ? { shoppingPreference } : {}), inactiveWeeklyKeys: Object.keys(weekly).filter(key => key !== activeKey).sort(), acceptedByNative: false, solved: false, saved: false });
    } catch { return { outcome: "error", code: "invalid_native_intake" }; }
  }
  return Object.freeze({ outcome: "ready", prepare });
}
