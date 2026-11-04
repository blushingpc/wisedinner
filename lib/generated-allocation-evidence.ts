import { createHash } from "node:crypto";
import { createRevisedCatalogReader, CURRENT_REVISED_CATALOG_PIN, type RevisedRecipeProjection } from "./generated-plan-catalog.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { add, compare, decimal, divide, multiply, rational, receipt, zero, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";

// Read-only internal evidence bridge. These legacy ranges are ingredient-input
// allocations, NOT purchased-unit prices, representative current regional means
// or complete packs. Never feed these rates into the purchase quote as such.
export const CURRENT_ALLOCATION_EVIDENCE_PINS = Object.freeze({ current: CURRENT_REVISED_CATALOG_PIN, mainSha256: "7aaf9e316883b64b90ccb3bb0b26c0559f9f4cdd83a9bb954a8331bb566d3a2c", breakfastSha256: "cf33bdb18af828060159dd1ec90b94201a52836ec303ed04086afc8306eef7b9", breakfastRecordCount: 300 });
const REGIONS = ["Northeast", "Midwest", "South", "West"] as const;
// Legacy source receipts allow1234digits. Combined regional model denominators
// legitimately exceed the unrelated240digit macro/quantity port boundary.
const MAX_ALLOCATION_DIGITS = 1234;
type Region = typeof REGIONS[number];
type EvidencePins = { readonly current: { readonly sha256: string; readonly recordCount: number }; readonly mainSha256: string; readonly breakfastSha256: string; readonly breakfastRecordCount: number };
type Data = Record<string, unknown>;
type Range = { min: Rational; max: Rational };
type RangeReceipt = { readonly min: ExactAmount; readonly max: ExactAmount };
type Ingredient = { id: string; name: string; state: string; unit: "g" | "ml"; quantity: Rational };
type Bucket = { role: "priced" | "utility"; range: Range | null; flags: Set<string>; sourceKinds: Set<string>; rates: Set<string>; sourceFiles: Set<string> };
export type AllocationEstimate = {
  readonly outcome: "estimate"; readonly recipeId: string; readonly recipeSha256: string; readonly region: Region; readonly status: "conditional" | "held";
  readonly basis: "ingredient-input-allocation-only"; readonly wholeBatchUsd: RangeReceipt | null; readonly perSourceServingUsd: RangeReceipt | null; readonly knownSubtotalUsd: RangeReceipt | null;
  readonly missingIngredients: readonly { readonly ingredientId: string; readonly name: string; readonly preparedState: string; readonly unit: string }[];
  readonly pricedIngredientCount: number; readonly utilityExclusions: readonly { readonly ingredientId: string; readonly sourceFiles: readonly string[] }[];
  readonly flags: readonly string[]; readonly sourceKinds: readonly string[]; readonly nutritionStatus: RevisedRecipeProjection["nutrition"]["status"];
  readonly wholePackCheckoutSupported: false; readonly observedRegionalMean: false; readonly productAccepted: false;
};
type ErrorOutcome = { readonly outcome: "error"; readonly code: string };
type Audit = { readonly recipes: number; readonly ingredientOccurrences: number; readonly exactMatchedOccurrences: number; readonly completeAllocationRecipes: number; readonly heldAllocationRecipes: number; readonly completeByRegion: Readonly<Record<Region, number>>; readonly currentHeldNutritionRecipes: number; readonly missingSignatures: readonly { readonly ingredientId: string; readonly name: string; readonly preparedState: string; readonly unit: string; readonly occurrences: number; readonly missingRegions: readonly Region[] }[]; readonly sourcePins: EvidencePins; readonly wholePackCheckoutSupported: false; readonly observedRegionalMean: false; readonly productAccepted: false };
export type AllocationEvidenceBinding = { readonly outcome: "ready"; readonly reader: { estimateRecipe(recipeId: unknown, region: unknown): AllocationEstimate | ErrorOutcome; audit(): Audit } } | ErrorOutcome;
class EvidenceFault extends Error { readonly code: string; constructor(code: string) { super("Allocation evidence refused"); this.code = code; } }
function invalid(): never { throw new EvidenceFault("invalid_allocation_evidence"); }
function object(value: unknown): Data { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(); return value as Data; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 10000) invalid(); return value; }
function flags(value: unknown): string[] { if (!Array.isArray(value) || value.length > 1000) invalid(); return value.map(text); }
function digest(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) invalid(); return result; }
const sha = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const seal = (value: unknown) => sha(JSON.stringify(canonicalReferenceData(value)));
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function fraction(value: unknown): Rational {
  if (typeof value === "string") {
    if (value.length > 240) invalid();
    if (!value.includes("/")) return decimal(value);
    if (!/^(0|[1-9]\d*)\/(0|[1-9]\d*)$/.test(value)) invalid();
    const [n, d] = value.split("/"); return rational(BigInt(n!), BigInt(d!));
  }
  const fields = object(value);
  if (Object.keys(fields).sort().join("|") !== "denominator|numerator") invalid();
  for (const field of [fields.numerator, fields.denominator]) if (typeof field !== "string" || field.length > 240 || !/^(0|[1-9]\d*)$/.test(field)) invalid();
  return rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string));
}
function ingredient(value: unknown): Ingredient {
  const row = object(value), quantity = fraction(row.quantity);
  if (quantity.n === BigInt(0) || row.unit !== "g" && row.unit !== "ml") invalid();
  return { id: text(row.id), name: text(row.name), state: text(row.state), unit: row.unit, quantity };
}
function key(value: { id: string; name: string; state: string; unit: string }): string { return JSON.stringify([value.id, value.name, value.state, value.unit]); }
function priceRange(min: unknown, max: unknown): Range { const result = { min: fraction(min), max: fraction(max) }; if (compare(result.min, result.max) > 0 || result.max.n === BigInt(0)) invalid(); return result; }
function present(value: Range): RangeReceipt { return { min: receipt(value.min), max: receipt(value.max) }; }
function within(value: Range): boolean { return [value.min, value.max].every(edge => String(edge.n).length <= MAX_ALLOCATION_DIGITS && String(edge.d).length <= MAX_ALLOCATION_DIGITS); }
function decode(value: unknown, expected: string): string {
  if (typeof value !== "string" && !(value instanceof Uint8Array)) invalid();
  const bytes = typeof value === "string" ? Buffer.from(value) : Buffer.from(value);
  if (bytes.byteLength > 64 * 1024 * 1024) invalid();
  if (sha(bytes) !== expected) throw new EvidenceFault("allocation_evidence_hash_mismatch");
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
function pins(value: unknown): EvidencePins {
  if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
  const prototype = Object.getPrototypeOf(value); if (prototype !== Object.prototype && prototype !== null) invalid();
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors), required = ["current", "mainSha256", "breakfastSha256", "breakfastRecordCount"];
  if (keys.length !== required.length || keys.some(k => typeof k !== "string" || !required.includes(k) || !("value" in descriptors[k]!) || !descriptors[k]!.enumerable)) invalid();
  const count = descriptors.breakfastRecordCount!.value as unknown;
  if (!Number.isSafeInteger(count) || (count as number) < 1 || (count as number) > 1000) invalid();
  const currentValue = object(descriptors.current!.value), currentDescriptors = Object.getOwnPropertyDescriptors(currentValue), currentKeys = Reflect.ownKeys(currentDescriptors), currentPrototype = Object.getPrototypeOf(currentValue);
  if (currentPrototype !== Object.prototype && currentPrototype !== null || currentKeys.length !== 2 || currentKeys.some(key => typeof key !== "string" || !["sha256", "recordCount"].includes(key) || !("value" in currentDescriptors[key]!) || !currentDescriptors[key]!.enumerable)) invalid();
  const current = { sha256: digest(currentDescriptors.sha256!.value), recordCount: currentDescriptors.recordCount!.value as number };
  createRevisedCatalogReader(current);
  return { current, mainSha256: digest(descriptors.mainSha256!.value), breakfastSha256: digest(descriptors.breakfastSha256!.value), breakfastRecordCount: count as number };
}

export function createAllocationEvidenceReader(currentValue: unknown, mainValue: unknown, breakfastValue: unknown, trustedPins: unknown = CURRENT_ALLOCATION_EVIDENCE_PINS): AllocationEvidenceBinding {
  try {
    const bound = pins(trustedPins), current = createRevisedCatalogReader(bound.current)(currentValue);
    if (current.outcome !== "success") return current;
    const mainText = decode(mainValue, bound.mainSha256), breakfastText = decode(breakfastValue, bound.breakfastSha256), main = object(JSON.parse(mainText));
    if (main.schema !== "wd-generated-planner-catalog-v1" || main.budgetBasis !== "fractional-ingredient-allocation" || main.wholePackCheckoutSupported !== false || main.productAccepted !== false) invalid();
    const index = new Map<string, Map<Region, Bucket>>();
    function put(food: Ingredient, region: Region, range: Range | null, values: readonly string[], sourceKind: string, sourceFile: string): void {
      const identity = key(food), regions = index.get(identity) ?? new Map<Region, Bucket>(), previous = regions.get(region), role = range ? "priced" : "utility";
      if (previous && previous.role !== role) invalid();
      const value: Bucket = previous ?? { role, range, flags: new Set(), sourceKinds: new Set(), rates: new Set(), sourceFiles: new Set() };
      values.forEach(flag => value.flags.add(flag)); value.sourceKinds.add(sourceKind); value.sourceFiles.add(sourceFile);
      if (range) {
        const rate = { min: divide(range.min, food.quantity), max: divide(range.max, food.quantity) };
        if (!within(rate)) invalid();
        if (previous?.range) value.range = { min: compare(previous.range.min, rate.min) <= 0 ? previous.range.min : rate.min, max: compare(previous.range.max, rate.max) >= 0 ? previous.range.max : rate.max }; else value.range = rate;
        value.rates.add(JSON.stringify(present(rate))); if (value.rates.size > 1) value.flags.add("multiple-source-model-envelope");
      }
      regions.set(region, value); index.set(identity, regions);
    }
    const mainFlags = object(main.priceFlags), sources = object(main.priceSources), lines = object(main.ingredientLines);
    if (Object.keys(lines).length > 20000 || Object.keys(sources).length > 20000 || Object.keys(mainFlags).length > 20000) invalid();
    for (const [id, value] of Object.entries(mainFlags)) if (digest(id) !== seal(flags(value))) invalid();
    for (const [id, value] of Object.entries(sources)) if (digest(id) !== seal(object(value))) invalid();
    for (const [id, value] of Object.entries(lines)) {
      const row = object(value); if (digest(id) !== seal(row)) invalid(); const food = ingredient(row.ingredient), common = flags(row.flags);
      if (row.utility_excluded === true) {
        if (food.id !== "process_water" || row.purchase !== null || Object.keys(object(row.regions)).length || !common.includes("grocery-utility-exclusion")) invalid();
        for (const region of REGIONS) put(food, region, null, common, "source-defined-grocery-utility", bound.mainSha256);
        continue;
      }
      if (row.utility_excluded !== false) invalid();
      const purchase = object(row.purchase), yieldRule = object(purchase.yield), limits = [...common, ...flags(yieldRule.holds)];
      for (const region of REGIONS) {
        const cellValue = object(row.regions)[region]; if (cellValue === undefined || cellValue === null) continue;
        const cell = object(cellValue), reference = object(cell.source), sourceRef = digest(reference.reference), flagRef = digest(cell.flagsRef), source = object(sources[sourceRef]);
        if (cell.observed_checkout !== false || text(source.kind) !== reference.kind) invalid();
        put(food, region, priceRange(cell.exact_min, cell.exact_max), [...limits, ...flags(mainFlags[flagRef])], text(source.kind), bound.mainSha256);
      }
    }
    const breakfastLines = breakfastText.replace(/\r?\n$/, "").split(/\r?\n/);
    if (breakfastLines.length !== bound.breakfastRecordCount || breakfastLines.some(line => !line.trim())) invalid();
    for (const line of breakfastLines) {
      const row = object(JSON.parse(line)), acceptance = object(row.acceptance);
      if (acceptance.planner_eligible !== false || acceptance.app_imported !== false || acceptance.kitchen_tested !== false || acceptance.allergen_reviewed !== false || !Array.isArray(row.ingredients) || row.ingredients.length > 100) invalid();
      const common = flags(row.flags);
      for (const value of row.ingredients) {
        const item = object(value), food = ingredient(item.ingredient); if (digest(item.ingredient_sha256) !== seal(item.ingredient)) invalid();
        const limits = [...common, ...flags(item.nutrition_flags), ...flags(item.nutrition_holds)];
        for (const region of REGIONS) {
          const cellValue = object(item.regions)[region]; if (cellValue === undefined || cellValue === null) continue;
          const cell = object(cellValue), cellFlags = [...limits, ...flags(cell.flags), ...flags(cell.holds)];
          if (cell.status === "excluded-grocery-utility") {
            if (food.id !== "water" || food.name !== "Drinking water" || food.state !== "measured cooking water" || food.unit !== "ml" || cell.cost_usd !== null || !cellFlags.includes("preparation-water-excluded-not-free-food")) invalid();
            put(food, region, null, cellFlags, "source-defined-grocery-utility", bound.breakfastSha256); continue;
          }
          if (cell.status !== "calculated-conditional-estimate" || cell.cost_usd === null) continue;
          const cost = object(cell.cost_usd), source = object(cell.source);
          put(food, region, priceRange(cost.exact_min, cost.exact_max), cellFlags, text(source.kind), bound.breakfastSha256);
        }
      }
    }
    const recipes = new Map(current.recipes.map(recipe => [recipe.id, recipe]));
    function estimateRecipe(id: unknown, area: unknown): AllocationEstimate | ErrorOutcome {
      if (typeof id !== "string" || !recipes.has(id) || typeof area !== "string" || !REGIONS.includes(area as Region)) return { outcome: "error", code: "invalid_allocation_request" };
      const recipe = recipes.get(id)!, region = area as Region, missingIngredients: AllocationEstimate["missingIngredients"][number][] = [], utilityExclusions: AllocationEstimate["utilityExclusions"][number][] = [];
      const resultFlags = new Set(["legacy-source-modeled-input-allocation", "not-current-observed-regional-mean", "not-whole-pack-checkout", "source-product-adoption-not-established"]), kinds = new Set<string>();
      let total: Range = { min: zero(), max: zero() }, pricedIngredientCount = 0, capacityExceeded = false;
      for (const value of recipe.recipe.ingredients) {
        const food = ingredient(value), bucket = index.get(key(food))?.get(region);
        if (!bucket) { missingIngredients.push({ ingredientId: food.id, name: food.name, preparedState: food.state, unit: food.unit }); continue; }
        bucket.flags.forEach(flag => resultFlags.add(flag)); bucket.sourceKinds.forEach(kind => kinds.add(kind));
        if (bucket.role === "utility") { utilityExclusions.push({ ingredientId: food.id, sourceFiles: [...bucket.sourceFiles].sort(order) }); continue; }
        if (!capacityExceeded) { total = { min: add(total.min, multiply(bucket.range!.min, food.quantity)), max: add(total.max, multiply(bucket.range!.max, food.quantity)) }; capacityExceeded = !within(total); }
        pricedIngredientCount++;
      }
      const servings = rational(BigInt(recipe.recipe.servings)), perServing = { min: divide(total.min, servings), max: divide(total.max, servings) };
      if (capacityExceeded || !within(total) || !within(perServing)) { resultFlags.add("allocation-quantity-capacity-exceeded"); return freeze({ outcome: "estimate", recipeId: id, recipeSha256: recipe.recipeSha256, region, status: "held", basis: "ingredient-input-allocation-only", wholeBatchUsd: null, perSourceServingUsd: null, knownSubtotalUsd: null, missingIngredients, pricedIngredientCount, utilityExclusions, flags: [...resultFlags].sort(order), sourceKinds: [...kinds].sort(order), nutritionStatus: recipe.nutrition.status, wholePackCheckoutSupported: false, observedRegionalMean: false, productAccepted: false }); }
      const complete = !missingIngredients.length && pricedIngredientCount > 0;
      if (!pricedIngredientCount) resultFlags.add("no-priced-food-evidence");
      return freeze({ outcome: "estimate", recipeId: id, recipeSha256: recipe.recipeSha256, region, status: complete ? "conditional" : "held", basis: "ingredient-input-allocation-only", wholeBatchUsd: complete ? present(total) : null, perSourceServingUsd: complete ? present(perServing) : null, knownSubtotalUsd: pricedIngredientCount ? present(total) : null, missingIngredients, pricedIngredientCount, utilityExclusions, flags: [...resultFlags].sort(order), sourceKinds: [...kinds].sort(order), nutritionStatus: recipe.nutrition.status, wholePackCheckoutSupported: false, observedRegionalMean: false, productAccepted: false });
    }
    function audit(): Audit {
      let ingredientOccurrences = 0, exactMatchedOccurrences = 0, completeAllocationRecipes = 0;
      const completeByRegion = Object.fromEntries(REGIONS.map(region => [region, 0])) as Record<Region, number>, missing = new Map<string, Audit["missingSignatures"][number]>();
      for (const recipe of current.outcome === "success" ? current.recipes : []) {
        for (const value of recipe.recipe.ingredients) {
          ingredientOccurrences++; const identity = key(value), absent = REGIONS.filter(region => !index.get(identity)?.has(region));
          if (!absent.length) exactMatchedOccurrences++; else { const previous = missing.get(identity); missing.set(identity, { ingredientId: value.id, name: value.name, preparedState: value.state, unit: value.unit, occurrences: (previous?.occurrences ?? 0) + 1, missingRegions: absent }); }
        }
        let all = true;
        for (const region of REGIONS) { const result = estimateRecipe(recipe.id, region); if (result.outcome === "estimate" && result.status === "conditional") completeByRegion[region]++; else all = false; }
        if (all) completeAllocationRecipes++;
      }
      return freeze({ recipes: recipes.size, ingredientOccurrences, exactMatchedOccurrences, completeAllocationRecipes, heldAllocationRecipes: recipes.size - completeAllocationRecipes, completeByRegion, currentHeldNutritionRecipes: current.outcome === "success" ? current.summary.heldNutrition : 0, missingSignatures: [...missing].sort(([a], [b]) => order(a, b)).map(([, value]) => value), sourcePins: bound, wholePackCheckoutSupported: false, observedRegionalMean: false, productAccepted: false });
    }
    return Object.freeze({ outcome: "ready", reader: Object.freeze({ estimateRecipe, audit }) });
  } catch (error) { return { outcome: "error", code: error instanceof EvidenceFault ? error.code : "invalid_allocation_evidence" }; }
}
