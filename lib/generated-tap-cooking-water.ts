import { FINAL_DERIVED_PIN, isFinalUtilityDerivation } from "./generated-final-source-admission.ts";
import { sha256Hex, utf8Encode, utf8DecodeFatal, copyRuntimeBytes } from "./generated-runtime-bytes.ts";
import { createRevisedCatalogReader, CURRENT_REVISED_CATALOG_PIN } from "./generated-plan-catalog.ts";
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { aggregateRequirements, type ConsumedDemand } from "../packages/solver/src/generated-plan-requirements.ts";

type Data = Record<string, unknown>;
type ErrorOutcome = { readonly outcome: "error"; readonly code: "invalid_tap_water_configuration" | "invalid_tap_water_demands" };
type ReviewHold = { readonly outcome: "held"; readonly code: "tap_water_source_mismatch" | "tap_water_review_required" };
export type TapWaterPartitionOutcome =
  | { readonly outcome: "partitioned"; readonly policy: "wd-tap-cooking-water-utility-v1"; readonly foodDemands: readonly ConsumedDemand[]; readonly utilityUsage: readonly ConsumedDemand[]; readonly basisSha256: string }
  | { readonly outcome: "error"; readonly code: "invalid_tap_water_demands" }
  | ReviewHold
  | { readonly outcome: "held"; readonly code: "quantity_capacity_exceeded" };
export type TapClassifierBindingV1 =
  | { readonly outcome: "ready"; readonly partition: (demands: unknown) => TapWaterPartitionOutcome }
  | ErrorOutcome
  | ReviewHold;

const POLICY = "wd-tap-cooking-water-utility-v1";
const MATCH_SHA = "43bfec0a2e3e76e8c5d313a1f9462e2bf96fbdbe8d55923e70e87bbd8f6f34b0";
const RECORD_SHA = "1580f7ed4ee1f6ecd059cf9ff02ce19cccd82a2dea688d957a097d35af1ff5fe";
const FOOD_SHA = "082e46df43c7a91bf76b5b5f4e6b431ef3510aeb56b302ed0bcfd12edadea6ee";
// Identity constraints only, not a default reviewed configuration or provenance.
const FORMS = new Map([
  ["b2721572d8f2adda684a26e76b3d5aaf03227701cd658a41c8a8691a2c609dd4", { id: "process_water", name: "water for cooking starch", unit: "ml", state: "potable" }],
  ["f073e73087c7ca395b504f68bfd54bd7ce9e545af15a657fa32cd7dea1a41d4a", { id: "water", name: "Drinking water", unit: "ml", state: "measured cooking water" }],
]);
const formIdentity = (form: Data): string => JSON.stringify([form.id, form.name, form.unit, form.state]);
const allowedIdentities = new Set([...FORMS.values()].map(formIdentity));
const hash = (value: unknown): string => sha256Hex(JSON.stringify(canonicalReferenceData(value)));
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function record(value: unknown, keys: readonly string[]): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("Invalid own-data record");
  const fields = Object.keys(value);
  if (fields.length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw Error("Invalid fields");
  return value as Data;
}
function digest(value: unknown): string {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw Error("Invalid digest");
  return value;
}
function date(value: unknown): boolean {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const time = Date.parse(value + "T00:00:00.000Z");
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === value;
}

// Trusted caller injection only. Source review, authentic dates and adoption are
// separate host prerequisites; this pure function cannot certify those facts.
export function createTapCookingWaterClassifier(source: unknown, reviewedConfiguration: unknown): TapClassifierBindingV1 {
  return createClassifier(source, reviewedConfiguration, CURRENT_REVISED_CATALOG_PIN);
}

// Exactly one independently reviewed derivative, never a general any-pin grant.
// Its manifest seal includes parent source/count/bytes and all12row/recipe seals.
export const REVIEWED_DERIVED_STARTER_PIN = Object.freeze({ sha256: "5c52bffe8ddf12ea90e5a84a09aad1abb41768e34cac7784849c00c67c4df740", recordCount: 12 });
const DERIVATION_SHA = "deb3de8b5e0b5cc1b26dee2a8912a2a0121412a40651a794ed5c7495436977c1";
export function createReviewedDerivedTapCookingWaterClassifier(source: unknown, reviewedConfiguration: unknown): TapClassifierBindingV1 {
  try {
    const full = record(copyReferenceData(reviewedConfiguration), ["policy", "sourcePin", "matchDataSha256", "recordDataSha256", "reviewedForms", "derivation"]);
    if (hash(full.derivation) !== DERIVATION_SHA) return { outcome: "held", code: "tap_water_review_required" };
    const bytes = typeof source === "string" ? utf8Encode(source) : copyRuntimeBytes(source as Uint8Array);
    if (bytes.length !== 177824 || sha256Hex(bytes) !== REVIEWED_DERIVED_STARTER_PIN.sha256) return { outcome: "held", code: "tap_water_source_mismatch" };
    const manifest = full.derivation as { rows: { recipeId: string; recipeSha256: string; originalRowSha256: string }[] }, lines = utf8DecodeFatal(bytes).split("\n");
    if (lines.length !== 13 || lines[12] !== "") return { outcome: "held", code: "tap_water_source_mismatch" };
    for (let i = 0; i < 12; i++) { const line = lines[i]!, row = JSON.parse(line) as Data, seal = manifest.rows[i]!; if (row.id !== seal.recipeId || row.recipe_sha256 !== seal.recipeSha256 || sha256Hex(line) !== seal.originalRowSha256) return { outcome: "held", code: "tap_water_source_mismatch" }; }
    const configuration = { policy: full.policy, sourcePin: full.sourcePin, matchDataSha256: full.matchDataSha256, recordDataSha256: full.recordDataSha256, reviewedForms: full.reviewedForms };
    return createClassifier(source, configuration, REVIEWED_DERIVED_STARTER_PIN, full);
  } catch { return { outcome: "error", code: "invalid_tap_water_configuration" }; }
}


// Exact preparation-only child pack; parent recipes/facts remain immutable.
export const REVIEWED_PREPARATION_STARTER_PIN = Object.freeze({ sha256: "770018026dc078f3eaac9c533021293c6f1a8cd2e94740aa5ba1730978b2f659", recordCount: 14 });
const PREPARATION_DERIVATION_SHA = "bf36913cfa7b7061caf47532f3bb486f274acfddeb8d710870764c1ad9780c4b";
export function createReviewedPreparationTapCookingWaterClassifier(source: unknown, reviewedConfiguration: unknown): TapClassifierBindingV1 {
  try {
    const full = record(copyReferenceData(reviewedConfiguration), ["policy", "sourcePin", "matchDataSha256", "recordDataSha256", "reviewedForms", "derivation"]);
    if (hash(full.derivation) !== PREPARATION_DERIVATION_SHA) return { outcome: "held", code: "tap_water_review_required" };
    const bytes = typeof source === "string" ? utf8Encode(source) : copyRuntimeBytes(source as Uint8Array);
    if (bytes.length !== 211941 || sha256Hex(bytes) !== REVIEWED_PREPARATION_STARTER_PIN.sha256 || sha256Hex(bytes.slice(0, 177824)) !== REVIEWED_DERIVED_STARTER_PIN.sha256) return { outcome: "held", code: "tap_water_source_mismatch" };
    const configuration = { policy: full.policy, sourcePin: full.sourcePin, matchDataSha256: full.matchDataSha256, recordDataSha256: full.recordDataSha256, reviewedForms: full.reviewedForms };
    return createClassifier(source, configuration, REVIEWED_PREPARATION_STARTER_PIN, full);
  } catch { return { outcome: "error", code: "invalid_tap_water_configuration" }; }
}

// Independently compared against all 1,300 current sealed source records on
// 2026-10-30. Only nutrition.ingredient_details is omitted from this derivative;
// the original archive and both exact USDA tap-water forms remain unchanged.
// This is one reviewed source identity, never permission to bind arbitrary pins.
export const REVIEWED_CURRENT_NATIVE_PIN = Object.freeze({ sha256: "8af0f7c3cb48540df1661c760290d44f0f78a7bf80d64e10030aae46130d7643", recordCount: 1300 });
const CURRENT_NATIVE_DERIVATION_SHA = "c46ada7445baea1070276dc8eb00e517ff509ee3e68235031305458147e685db";
export function createReviewedCurrentNativeTapCookingWaterClassifier(source: unknown, reviewedConfiguration: unknown): TapClassifierBindingV1 {
  try {
    const full = record(copyReferenceData(reviewedConfiguration), ["policy", "sourcePin", "matchDataSha256", "recordDataSha256", "reviewedForms", "derivation"]);
    if (hash(full.derivation) !== CURRENT_NATIVE_DERIVATION_SHA) return { outcome: "held", code: "tap_water_review_required" };
    const bytes = typeof source === "string" ? utf8Encode(source) : copyRuntimeBytes(source as Uint8Array);
    if (bytes.length !== 11349561 || sha256Hex(bytes) !== REVIEWED_CURRENT_NATIVE_PIN.sha256) return { outcome: "held", code: "tap_water_source_mismatch" };
    const configuration = { policy: full.policy, sourcePin: full.sourcePin, matchDataSha256: full.matchDataSha256, recordDataSha256: full.recordDataSha256, reviewedForms: full.reviewedForms };
    return createClassifier(source, configuration, REVIEWED_CURRENT_NATIVE_PIN, full);
  } catch { return { outcome: "error", code: "invalid_tap_water_configuration" }; }
}

// Exact static method-only derivative. Nutrition lineage is independently
// checked by the catalog reader; this utility admission does not grant cooking
// capacity, a practical portion, an appliance or a production plan.
export const REVIEWED_CURRENT_METHOD_PIN = Object.freeze({ sha256: "f8b115114bc2a2067b4104cbb6f60bb199b9d5afa1c7adc7b2e59ab9562ebbe8", recordCount: 1300 });
const CURRENT_METHOD_DERIVATION_SHA = "5078f5d4fb0425b92b8d7096e1b346962f9043eccbcc39384e185f86ded895c3";
export function createReviewedCurrentMethodTapCookingWaterClassifier(source: unknown, reviewedConfiguration: unknown): TapClassifierBindingV1 {
  try {
    const full = record(copyReferenceData(reviewedConfiguration), ["policy", "sourcePin", "matchDataSha256", "recordDataSha256", "reviewedForms", "derivation"]);
    if (hash(full.derivation) !== CURRENT_METHOD_DERIVATION_SHA) return { outcome: "held", code: "tap_water_review_required" };
    const bytes = typeof source === "string" ? utf8Encode(source) : copyRuntimeBytes(source as Uint8Array);
    if (bytes.length !== 11354943 || sha256Hex(bytes) !== REVIEWED_CURRENT_METHOD_PIN.sha256) return { outcome: "held", code: "tap_water_source_mismatch" };
    const configuration = { policy: full.policy, sourcePin: full.sourcePin, matchDataSha256: full.matchDataSha256, recordDataSha256: full.recordDataSha256, reviewedForms: full.reviewedForms };
    return createClassifier(source, configuration, REVIEWED_CURRENT_METHOD_PIN, full);
  } catch { return { outcome: "error", code: "invalid_tap_water_configuration" }; }
}

export const REVIEWED_CURRENT_PRACTICAL_PIN = Object.freeze({ sha256: "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c", recordCount: 1300 });
const CURRENT_PRACTICAL_DERIVATION_SHA = "4a225145b81978e5405981186f77882557df59e004d442f13936346a46d41ada";
export function createReviewedCurrentPracticalTapCookingWaterClassifier(source: unknown, reviewedConfiguration: unknown): TapClassifierBindingV1 {
  try {
    const full = record(copyReferenceData(reviewedConfiguration), ["policy", "sourcePin", "matchDataSha256", "recordDataSha256", "reviewedForms", "derivation"]);
    if (hash(full.derivation) !== CURRENT_PRACTICAL_DERIVATION_SHA) return { outcome: "held", code: "tap_water_review_required" };
    const bytes = typeof source === "string" ? utf8Encode(source) : copyRuntimeBytes(source as Uint8Array);
    if (bytes.length !== 11357533 || sha256Hex(bytes) !== REVIEWED_CURRENT_PRACTICAL_PIN.sha256) return { outcome: "held", code: "tap_water_source_mismatch" };
    const configuration = { policy: full.policy, sourcePin: full.sourcePin, matchDataSha256: full.matchDataSha256, recordDataSha256: full.recordDataSha256, reviewedForms: full.reviewedForms };
    return createClassifier(source, configuration, REVIEWED_CURRENT_PRACTICAL_PIN, full);
  } catch { return { outcome: "error", code: "invalid_tap_water_configuration" }; }
}

function createClassifier(source: unknown, reviewedConfiguration: unknown, allowedPin: Readonly<{ sha256: string; recordCount: number }>, derivationConfiguration?: unknown): TapClassifierBindingV1 {
  let configuration: Data;
  try {
    configuration = record(copyReferenceData(reviewedConfiguration), ["policy", "sourcePin", "matchDataSha256", "recordDataSha256", "reviewedForms"]);
    const pin = record(configuration.sourcePin, ["sha256", "recordCount"]);
    digest(pin.sha256); digest(configuration.matchDataSha256); digest(configuration.recordDataSha256);
    if (configuration.policy !== POLICY || !Number.isSafeInteger(pin.recordCount) || (pin.recordCount as number) < 1 || (pin.recordCount as number) > 2000 || !Array.isArray(configuration.reviewedForms)) throw Error("Invalid configuration");
    if (pin.sha256 !== allowedPin.sha256 || pin.recordCount !== allowedPin.recordCount) return { outcome: "held", code: "tap_water_source_mismatch" };
    if (configuration.matchDataSha256 !== MATCH_SHA || configuration.recordDataSha256 !== RECORD_SHA || configuration.reviewedForms.length !== 2) return { outcome: "held", code: "tap_water_review_required" };
    const signatures = new Set<string>();
    for (const value of configuration.reviewedForms) {
      const form = record(value, ["ingredientSignature", "exactForm", "selectedRecordIds", "foodRowSha256", "reviewedOn"]);
      const signature = digest(form.ingredientSignature), exactForm = record(form.exactForm, ["id", "name", "unit", "state"]);
      digest(form.foodRowSha256);
      if (!FORMS.has(signature) || formIdentity(exactForm) !== formIdentity(FORMS.get(signature)!) || signatures.has(signature) || !Array.isArray(form.selectedRecordIds) || form.selectedRecordIds.length !== 1 || form.selectedRecordIds[0] !== 173647 || form.foodRowSha256 !== FOOD_SHA || !date(form.reviewedOn)) return { outcome: "held", code: "tap_water_review_required" };
      signatures.add(signature);
    }
    freeze(configuration);
  } catch { return { outcome: "error", code: "invalid_tap_water_configuration" }; }

  const catalog = createRevisedCatalogReader(allowedPin)(source);
  if (catalog.outcome !== "success") return { outcome: "held", code: "tap_water_source_mismatch" };
  const recipes = new Map(catalog.recipes.map(row => [row.id, {
    recipeSha256: row.recipeSha256,
    ingredients: new Map(row.recipe.ingredients.map(ingredient => [ingredient.id, {
      id: ingredient.id, name: ingredient.name, unit: ingredient.unit, state: ingredient.state,
    }])),
  }]));
  const configurationSha256 = hash(derivationConfiguration ?? configuration), sourceCatalogSha256 = catalog.sourceSha256;
  const partition = (value: unknown): TapWaterPartitionOutcome => {
    try {
      // Keep the own-data lexical copy. The validator's normalized aggregation
      // is private validation, never a replacement for these original rows.
      const original = copyReferenceData(value);
      const validation = aggregateRequirements(original);
      if (validation.outcome === "held") return validation;
      if (validation.outcome === "error") return { outcome: "error", code: "invalid_tap_water_demands" };
      const validatedOriginalDemands = original as ConsumedDemand[];
      const foodDemands: ConsumedDemand[] = [], utilityUsage: ConsumedDemand[] = [];
      // Validate every source binding before returning any partition.
      for (const demand of validatedOriginalDemands) {
        const recipe = recipes.get(demand.recipeId), ingredient = recipe?.ingredients.get(demand.ingredientId);
        if (recipe && recipe.recipeSha256 !== demand.recipeSha256) return { outcome: "error", code: "invalid_tap_water_demands" };
        if (!recipe || !ingredient || ingredient.state !== demand.preparedState || ingredient.unit !== demand.baseUnit) return { outcome: "held", code: "tap_water_source_mismatch" };
        (allowedIdentities.has(formIdentity(ingredient)) ? utilityUsage : foodDemands).push(demand);
      }
      const basisSha256 = hash(["wd-tap-water-partition-v1", sourceCatalogSha256, configurationSha256, validatedOriginalDemands, foodDemands, utilityUsage]);
      return freeze({ outcome: "partitioned", policy: POLICY, foodDemands, utilityUsage, basisSha256 });
    } catch { return { outcome: "error", code: "invalid_tap_water_demands" }; }
  };
  return Object.freeze({ outcome: "ready", partition });
}


// Separate closed dual-parent derived family. Original classifiers remain byte-logically unchanged.
export function createFinalDerivedTapCookingWaterClassifier(source:unknown,reviewedConfiguration:unknown):TapClassifierBindingV1 {
 try {const full=record(copyReferenceData(reviewedConfiguration),["policy","sourcePin","matchDataSha256","recordDataSha256","reviewedForms","derivation"]);
 if(!isFinalUtilityDerivation(full.derivation))return {outcome:"held",code:"tap_water_review_required"};
 const configuration={policy:full.policy,sourcePin:full.sourcePin,matchDataSha256:full.matchDataSha256,recordDataSha256:full.recordDataSha256,reviewedForms:full.reviewedForms};
 return createClassifier(source,configuration,FINAL_DERIVED_PIN,full);
 }catch{return {outcome:"error",code:"invalid_tap_water_configuration"};}
}
