import {PROFILE_METHOD_POLICY,profileMethodGuide,profileMethodDescriptor} from "./generated-profile-method-guides.ts";
import {captureReferencePurchaseCorrespondences} from "./generated-plan-quote.ts";
import {readRateReferenceConfiguration} from "./generated-regional-rate-reference.ts";
import finalManifest from "./fixtures/current-final-source-v1.json" with {type:"json"};
import {FINAL_DERIVED_PIN} from "./generated-final-source-admission.ts";
import {createJoinedReferencePlannerV3} from "./generated-joined-plan.ts";
import {quoteRegionalEstimatesV3} from "./generated-regional-quote.ts";
import { createRevisedCatalogReader, type CatalogYieldControl, type RevisedRecipeProjection } from "./generated-plan-catalog.ts";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimatesV2, readReferencePriceConfigurationV2, DOCUMENTARY_VALUATION_POLICY } from "./generated-regional-quote.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { add, compare, decimal, divide, multiply, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import { reviewedMethodSourceServings } from "./generated-reviewed-method-lineage.ts";
import goldens from "./fixtures/current-original-batch-guide-bindings-v1.json" with { type: "json" };

type Data = Record<string, unknown>;
export const MEAL_COVERAGE = "wd-current-meal-evidence-v1";
export const PRACTICAL_ASSETS_SHA256 = "e4aa739a246229404fd1790e1af8f78e72d8f2adb3330d5706e587149950b57d";
export const mealCoverageHash = (value: unknown): string => sha256Hex(JSON.stringify(canonicalReferenceData(value)));
function fail(): never { throw Error("invalid_meal_coverage_input"); }
function object(value: unknown): Data { if (!value || typeof value !== "object" || Array.isArray(value)) fail(); return value as Data; }
function fields(value: unknown, required: readonly string[], optional: readonly string[] = []): Data {
  const row = object(value), keys = Object.keys(row);
  if (required.some(k => !Object.hasOwn(row, k)) || keys.some(k => ![...required, ...optional].includes(k))) fail(); return row;
}
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 2000) fail(); return value; }
function strings(value: unknown): string[] { if (!Array.isArray(value) || value.length > 200) fail(); return value.map(text); }
function date(value: unknown): string { const s = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(s) || !Number.isFinite(Date.parse(s + "T00:00:00Z")) || new Date(s + "T00:00:00Z").toISOString().slice(0, 10) !== s) fail(); return s; }
function amount(value: unknown): Rational {
  const s = text(value); if (s.length > 120) fail();
  if (!s.includes("/")) return decimal(s);
  if (!/^(0|[1-9]\d*)\/[1-9]\d*$/.test(s)) fail(); const [n, d] = s.split("/"); return rational(BigInt(n!), BigInt(d!));
}
function exact(value: unknown): Rational {
  const row = fields(value, ["numerator", "denominator"]);
  for (const k of ["numerator", "denominator"]) if (typeof row[k] !== "string" || (row[k] as string).length > 120 || !/^(0|[1-9]\d*)$/.test(row[k] as string)) fail();
  const r = rational(BigInt(row.numerator as string), BigInt(row.denominator as string)); if (r.n <= BigInt(0)) fail(); return r;
}
function frozen<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(frozen); Object.freeze(value); } return value; }
const formKey = (i: Data) => JSON.stringify([i.id, i.state, i.unit]);
const utilityKey = (i: Data) => JSON.stringify([i.id, i.name, i.state, i.unit]);

export type MealToolRequirement = Readonly<{ source: string; role: "informational-prerequisite" | "cold-storage-prerequisite" | "declared-appliance" | "special-capability" | "unclassified"; applianceId?: string; capabilityId?: string }>;
// Classification describes source requirements. It never adds an ownership answer.
export function classifyMealTool(source: string): readonly MealToolRequirement[] {
  const s = source.toLowerCase().trim(), result: MealToolRequirement[] = [];
  // Device names must describe the device, not a utensil suitable for it.
  // Nominal cookware dimensions and toaster throughput remain literal notes.
  const appliance = /^(?:(?:two-slot|two-slice) )?toaster$/.test(s) ? "toaster"
    : /^(?:(?:\d+(?:\.\d+)?)[ -](?:litre|liter|l)[ -])?blender$/.test(s) ? "blender"
    : /^(?:electric )?waffle iron$/.test(s) ? "waffle iron"
    : /^oven(?: with two racks)?$/.test(s) ? "oven"
    : /^(?:electric )?slow cooker$/.test(s) ? "slow cooker"
    : /^(?:electric )?pressure cooker$/.test(s) ? "pressure cooker"
    : ["stove", "microwave", "air fryer"].includes(s) ? s : null;
  if (appliance) result.push({ source, role: "declared-appliance", applianceId: appliance });
  if (s === "refrigerator") result.push({ source, role: "cold-storage-prerequisite" });
  if (s === "second burner" || s === "oven with two racks" || (appliance === "blender" && /\d/.test(s))) result.push({ source, role: "special-capability", capabilityId: source });
  if (appliance === "toaster" && s !== "toaster") result.push({ source, role: "informational-prerequisite" });
  if (!result.length) result.push({ source, role: /scale|knife|board|mitt|spatula|thermometer|bowl|plate|tray|spoon|fork|ladle|brush|whisk|jug|grater|colander|sieve|masher|dish|cutter|saucepan|skillet|jar/.test(s) ? "informational-prerequisite" : "unclassified" });
  return frozen(result);
}

function allocationCheck(recipe: RevisedRecipeProjection["recipe"]): boolean {
  try {
    const ingredients = new Map(recipe.ingredients.map(i => [i.id, i])), sums = new Map<string, Rational>();
    for (const step of recipe.steps) for (const raw of stringsOrAllocations(step.allocations)) {
      const a = object(raw), i = ingredients.get(text(a.id)); if (!i || a.unit !== i.unit) return false;
      const n = amount(a.quantity); if (n.n < BigInt(0)) return false;
      sums.set(i.id, add(sums.get(i.id) ?? rational(BigInt(0)), n));
    }
    return recipe.ingredients.every(i => compare(sums.get(i.id) ?? rational(BigInt(0)), amount(i.quantity)) === 0);
  } catch { return false; }
}
function stringsOrAllocations(value: unknown): unknown[] { if (!Array.isArray(value) || value.length > 200) fail(); return value; }
function originalGuide(row: RevisedRecipeProjection, sourceSha256: string) {
  if (!allocationCheck(row.recipe)) return null;
  const value = {
    schema: "wd-source-original-batch-guide-v1", kind: "source-derived-original-full-batch", sourceSha256,
    recipeId: row.id, recipeSha256: row.recipeSha256, methodSha256: mealCoverageHash(row.recipe.steps),
    ingredientsSha256: mealCoverageHash(row.recipe.ingredients),
    allocationsSha256: mealCoverageHash(row.recipe.steps.map(s => ({ id: s.id, allocations: s.allocations }))),
    sourceServings: receipt(rational(BigInt(row.recipe.servings))), factor: receipt(rational(BigInt(1))),
    originalRecipe: row.recipe, consumeCompleteBatch: true, instructionsRewritten: false,
    kitchenTested: false, safetyCertified: false, nutritionRecalculated: false,
  } as const;
  return frozen({ ...value, guideSha256: mealCoverageHash(value) });
}
type OriginalGuide = NonNullable<ReturnType<typeof originalGuide>>;
type Domain = Readonly<{ sourceServings: ExactAmount; kind: "source-derived-original-full-batch" | "reviewed-serving-adaptation" | "reviewed-equipment-adaptation"; equipment?: readonly MealToolRequirement[]; guideSha256: string; guide: unknown }>;
type CoverageRow = Readonly<{
  recipeId: string; recipeSha256: string; sourceSha256: string; kind: string; sections: readonly string[];
  nutrition: "conditional" | "held"; sourceFlags: readonly string[]; nutritionFlags: readonly string[]; sourceHolds: readonly string[];
  quantity: Readonly<{ outcome: string; code: string | null; missingForms: readonly string[] }>;
  price: Readonly<{ outcome: "covered" | "held"; code: string | null; sources: readonly unknown[] }>;
  equipment: readonly MealToolRequirement[]; guideDomains: readonly Domain[]; guideHold: string | null;
}>;

// Trusted host/code configuration only, not an HTTP DTO or account grant. Exact
// pins bind evidence; they do not prove real prices, allergies or physical cooking.
function* currentMealCoverageSteps(source: unknown, options: {
  sourcePin: { sha256: string; recordCount: number }; configuration: unknown; configurationSha256: string;
  asOfDate: string; region: string; storeIds: readonly string[]; practicalAssets?: unknown; profileMethodPolicy?: typeof PROFILE_METHOD_POLICY;
}) {
  try {
    const settings = fields(copyReferenceData(options), ["sourcePin", "configuration", "configurationSha256", "asOfDate", "region", "storeIds"], ["practicalAssets", "profileMethodPolicy"]), asOfDate = date(settings.asOfDate);
    const configuration = object(settings.configuration);
    if (mealCoverageHash(configuration) !== settings.configurationSha256 || mealCoverageHash(configuration.sourcePin) !== mealCoverageHash(settings.sourcePin)) fail();
    const catalog = createRevisedCatalogReader(settings.sourcePin)(source); if (catalog.outcome !== "success") return catalog;
    const sourceSha256 = catalog.sourceSha256;
    const isFinal=catalog.sourceSha256===FINAL_DERIVED_PIN.sha256;
    const profileMethods=settings.profileMethodPolicy!==undefined;
    if(profileMethods&&(!isFinal||settings.profileMethodPolicy!==PROFILE_METHOD_POLICY))fail();
    const validation = (isFinal?createJoinedReferencePlannerV3:createJoinedReferencePlannerV2)(source, configuration);
    if (validation.outcome !== "ready") return frozen({ outcome: "held" as const, code: "coverage_configuration_not_ready" });
    yield;
    const prices = configuration.referencePrices === undefined ? undefined : readReferencePriceConfigurationV2(configuration.referencePrices);
    const correspondences = stringsOrAllocations(configuration.correspondences).map(object);
    const quantitySnapshot=captureReferencePurchaseCorrespondences(configuration.correspondences),rateSnapshot=isFinal?readRateReferenceConfiguration(configuration.rateReferences):undefined;
    const water = configuration.tapCookingWater === undefined ? [] : stringsOrAllocations(object(configuration.tapCookingWater).reviewedForms).map(x => object(object(x).exactForm));
    const utilities = new Set(water.map(utilityKey)), byId = new Map(catalog.recipes.map(r => [r.id, r]));
    const assets = settings.practicalAssets === undefined ? null : object(settings.practicalAssets);
    if (assets && (mealCoverageHash(assets) !== (isFinal?finalManifest.practicalAssetsSha256:PRACTICAL_ASSETS_SHA256) || object(assets.sourcePin).sha256 !== catalog.sourceSha256)) fail();
    const adaptations = new Map<string, Domain[]>();
    if (assets) for (const raw of stringsOrAllocations(assets.records)) {
      const r = object(raw), row = byId.get(text(r.id)); if (!row || r.childRecipeSha256 !== row.recipeSha256 || !reviewedMethodSourceServings(row.source)) fail();
      adaptations.set(row.id, stringsOrAllocations(r.guides).map(rawGuide => {
        const guide = object(rawGuide), n = exact(guide.sourceServings);
        if (guide.childRecipeSha256 !== row.recipeSha256 || !reviewedMethodSourceServings(row.source)!.some(s => compare(decimal(s), n) === 0)) fail();
        const factor = divide(n, rational(BigInt(row.recipe.servings))), ingredients = stringsOrAllocations(guide.ingredients).map(object);
        if (ingredients.length !== row.recipe.ingredients.length || row.recipe.ingredients.some(i => { const g = ingredients.find(g => g.id === i.id); return !g || g.name !== i.name || g.state !== i.state || g.unit !== i.unit || compare(exact(g.amount), multiply(amount(i.quantity), factor)) !== 0; })) fail();
        return frozen({ sourceServings: receipt(n), kind: "reviewed-serving-adaptation" as const, guideSha256: mealCoverageHash(guide), guide });
      }));
    }
    const originals = new Map<string, OriginalGuide>(); let originalIndex = 0;
    for (const row of catalog.recipes) { const g = originalGuide(row, catalog.sourceSha256); if (g) originals.set(row.id, g); if (++originalIndex % 8 === 0) yield; }
    // Required regression goldens, not a source/guide whitelist. Every other
    // intact source row uses the exact same allocation and full-batch rules.
    if (goldens.sourceSha256 === catalog.sourceSha256) for (const golden of goldens.guides) {
      const actual = originals.get(golden.recipeId); if (!actual || mealCoverageHash(actual) !== mealCoverageHash(golden)) fail();
    }
    const rows: CoverageRow[] = []; let rowIndex = 0;
    for (const row of catalog.recipes) {
      const demands = row.recipe.ingredients.filter(i => !utilities.has(utilityKey(i))).map(i => ({ assignmentId: "coverage:" + row.id, recipeId: row.id, recipeSha256: row.recipeSha256, ingredientId: i.id, preparedState: i.state, baseUnit: i.unit, amount: receipt(amount(i.quantity)) }));
      const missingForms = row.recipe.ingredients.filter(i => !utilities.has(utilityKey(i)) && !correspondences.some(c => formKey(i) === formKey({ id: c.ingredientId, state: c.preparedState, unit: c.consumedUnit }))).map(formKey);
      const prepared = prepareReferencePurchaseRequirements(demands, quantitySnapshot);
      let price: CoverageRow["price"] = { outcome: "held", code: prepared.outcome === "prepared" ? "price_evidence_required" : "purchase_evidence_required", sources: [] };
      if (prepared.outcome === "prepared") {
        const quoteRequest={ region: settings.region, storeIds: settings.storeIds, asOfDate, budgetCents: Number.MAX_SAFE_INTEGER };
        const quote = isFinal?quoteRegionalEstimatesV3(quoteRequest,prepared.requirements,[],configuration.regionalPackFacts,prices,rateSnapshot):quoteRegionalEstimatesV2(quoteRequest,prepared.requirements,[],configuration.regionalPackFacts,prices);
        if (quote.outcome === "quoted") {
          const sources = quote.referenceEstimates?.sources ?? [];
          // Use the quote engine's validated mode, never a raw configuration flag.
          // Documentary estimates retain their original dates and are not live offers.
          const documentary = quote.referenceEstimates?.valuationPolicy === DOCUMENTARY_VALUATION_POLICY;
          price = sources.some(s => asOfDate < s.reviewEffectiveFrom || (!documentary && asOfDate > s.usableThrough))
            ? { outcome: "held", code: "reference_pack_fact_not_current", sources }
            : { outcome: "covered", code: null, sources };
        } else price = { outcome: "held", code: quote.code, sources: [] };
      }
      const original = originals.get(row.id), domains: Domain[] = original ? [{ sourceServings: original.sourceServings, kind: original.kind, guideSha256: original.guideSha256, guide: original }] : [];
      for (const domain of adaptations.get(row.id) ?? []) {
        const index = domains.findIndex(d => compare(exact(d.sourceServings), exact(domain.sourceServings)) === 0);
        if (index < 0) domains.push(domain); else domains[index] = domain;
      }
      if(profileMethods&&original){const method=profileMethodGuide(row.id,row.recipeSha256,row.recipe);if(method)domains.push(frozen({sourceServings:original.sourceServings,kind:"reviewed-equipment-adaptation" as const,equipment:method.equipment.flatMap(classifyMealTool),guideSha256:mealCoverageHash({method,policy:profileMethodDescriptor()}),guide:method}));}
      rows.push(frozen({ recipeId: row.id, recipeSha256: row.recipeSha256, sourceSha256: catalog.sourceSha256, kind: row.kind, sections: row.sections, nutrition: row.nutrition.status, sourceFlags: row.source.flags as string[], nutritionFlags: row.nutrition.flags, sourceHolds: row.source.holds as string[],
        quantity: { outcome: prepared.outcome, code: prepared.outcome === "prepared" ? null : prepared.code, missingForms }, price,
        equipment: row.recipe.equipment.flatMap(classifyMealTool), guideDomains: domains, guideHold: domains.length ? null : "source_allocation_totals_unverified" }));
      if (++rowIndex % 8 === 0) yield;
    }
    const indexed = new Map(rows.map(r => [r.recipeId, r]));
    function forCandidate(untrusted: unknown) {
      try {
        const q = fields(copyReferenceData(untrusted), ["recipeId", "recipeSha256", "sourceSha256", "configurationSha256", "sourceServings", "context"]);
        const context = fields(q.context, ["asOfDate", "declaredAppliances", "specialCapabilities", "restrictions"]), row = indexed.get(text(q.recipeId));
        if (!row || row.recipeSha256 !== q.recipeSha256 || q.sourceSha256 !== sourceSha256 || q.configurationSha256 !== settings.configurationSha256) return frozen({ outcome: "held" as const, reasons: ["source_or_recipe_basis_changed"] });
        if (date(context.asOfDate) !== asOfDate) return frozen({ outcome: "held" as const, reasons: ["coverage_date_changed"] });
        const n = exact(q.sourceServings), appliances = new Set(strings(context.declaredAppliances)), capabilities = new Set(strings(context.specialCapabilities)), reasons: string[] = [...row.sourceHolds];
        const matching=row.guideDomains.filter(d=>compare(exact(d.sourceServings),n)===0);
        const equipmentHolds=(d:Domain)=> (d.equipment??row.equipment).some(t=>t.role==="declared-appliance"&&!appliances.has(t.applianceId!)||t.role==="special-capability"&&!capabilities.has(t.capabilityId!)||t.role==="unclassified");
        const domain=matching.find(d=>!equipmentHolds(d))??matching[0];
        if (row.nutrition !== "conditional") reasons.push("nutrition_incomplete");
        if (row.quantity.outcome !== "prepared") reasons.push(row.quantity.code ?? "purchase_evidence_required");
        if (row.price.outcome !== "covered") reasons.push(row.price.code ?? "price_evidence_required");
        if (!domain) reasons.push("source_serving_guide_required");
        if (context.restrictions !== "none-declared") reasons.push("restriction_evidence_required");
        for (const tool of domain?.equipment??row.equipment) {
          if (tool.role === "declared-appliance" && !appliances.has(tool.applianceId!)) reasons.push("appliance_unavailable:" + tool.applianceId);
          if (tool.role === "special-capability" && !capabilities.has(tool.capabilityId!)) reasons.push("capacity_unverified:" + tool.capabilityId);
          if (tool.role === "unclassified") reasons.push("tool_requirement_unclassified:" + tool.source);
        }
        const unique = [...new Set(reasons)].sort();
        return frozen({ outcome: unique.length ? "held" as const : "eligible" as const, recipeId: row.recipeId, recipeSha256: row.recipeSha256, sourceSha256, configurationSha256: settings.configurationSha256, asOfDate, sourceServings: receipt(n), reasons: unique, guide: domain?.guide ?? null, guideSha256: domain?.guideSha256 ?? null, preparationNotes: (domain?.equipment??row.equipment).filter(t => t.role === "informational-prerequisite" || t.role === "cold-storage-prerequisite").map(t => t.source), conditionalFlags: [...row.sourceFlags, ...row.nutritionFlags], planEvaluated: false as const, ownerAccessGranted: false as const, allergyCertified: false as const, kitchenTested: false as const });
      } catch { return frozen({ outcome: "error" as const, code: "invalid_meal_candidate_query" }); }
    }
    return frozen({ outcome: "ready" as const, contract: MEAL_COVERAGE, ...(profileMethods?{profileMethodPolicy:profileMethodDescriptor()}:{}), sourceSha256: catalog.sourceSha256, configurationSha256: settings.configurationSha256, sourcePolicyBasis: validation.sourcePolicyBasis, asOfDate, rows, summary: { ...catalog.summary, quantityComplete: rows.filter(r => r.quantity.outcome === "prepared").length, priceComplete: rows.filter(r => r.price.outcome === "covered").length, originalBatchGuides: originals.size, reviewedAdaptationRecipes: adaptations.size, guideRecipes: rows.filter(r => r.guideDomains.length).length }, forCandidate, productAccepted: false as const });
  } catch { return frozen({ outcome: "error" as const, code: "invalid_meal_coverage_input" }); }
}

export function createCurrentMealCoverage(...args: Parameters<typeof currentMealCoverageSteps>) {
  const steps = currentMealCoverageSteps(...args); let next = steps.next(); while (!next.done) next = steps.next(); return next.value;
}
export async function createCurrentMealCoverageAsync(source: unknown, options: Parameters<typeof currentMealCoverageSteps>[1], yieldControl: CatalogYieldControl) {
  if (typeof yieldControl !== "function") throw Error("coverage_scheduler_required");
  const steps = currentMealCoverageSteps(source, options); let next = steps.next(); while (!next.done) { await yieldControl(); next = steps.next(); } return next.value;
}
