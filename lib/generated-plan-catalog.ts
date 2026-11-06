import {isFinalDerivedRow,FINAL_DERIVED_NUTRITION_STATUS,finalReviewedMethodNutritionParent} from "./generated-final-source-admission.ts";
import { isReviewedMixedNutrition, MIXED_NUTRITION_STATUS } from "./generated-reviewed-nutrition-transition.ts";
import { createRuntimeSha256, sha256Hex, utf8Encode, copyRuntimeBytes, utf8DecodeFatal } from "./generated-runtime-bytes.ts";
import { compare, decimal, multiply, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import { isReviewedMethodBodySha, reviewedMethodNutritionParent } from "./generated-reviewed-method-lineage.ts";

// The pin is supplied by trusted server/code configuration, never request-body
// authority. The default is the founder's current immutable source, not v1/1000.
export const CURRENT_REVISED_CATALOG_PIN = Object.freeze({ sha256: "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0", recordCount: 1300 });
type Data = Record<string, unknown>;
type Macro = "protein_g" | "kcal" | "carbs_g" | "fat_g";
type MacroRanges = Readonly<Record<Macro, { readonly min: ExactAmount; readonly max: ExactAmount }>>;
type Recipe = {
  readonly title: string; readonly servings: number; readonly equipment: readonly string[];
  readonly ingredients: readonly { readonly id: string; readonly name: string; readonly quantity: string; readonly unit: "g" | "ml"; readonly state: string; readonly [key: string]: unknown }[];
  readonly steps: readonly { readonly id: number; readonly instruction: string; readonly [key: string]: unknown }[];
  readonly [key: string]: unknown;
};
export type RevisedRecipeProjection = {
  readonly id: string; readonly kind: "main" | "breakfast"; readonly sections: readonly string[];
  readonly recipeSha256: string; readonly recipe: Recipe; readonly source: Readonly<Data>;
  readonly nutrition: { readonly status: "conditional" | "held"; readonly perServing: MacroRanges | null; readonly flags: readonly string[]; readonly missingIngredients: readonly string[] };
  readonly capabilities: { readonly regionalPrice: "held"; readonly wholePackCheckout: "held"; readonly imageBinding: "held" };
  readonly plannerAdopted: false;
};
type CatalogCode = "source_hash_mismatch" | "invalid_catalog_source" | "invalid_recipe_identity" | "invalid_nutrition_evidence";
export type CatalogProjectionOutcome =
  | { readonly outcome: "success"; readonly sourceSha256: string; readonly recipes: readonly RevisedRecipeProjection[]; readonly summary: { readonly total: number; readonly main: number; readonly breakfast: number; readonly conditionalNutrition: number; readonly heldNutrition: number }; readonly productAccepted: false }
  | { readonly outcome: "error"; readonly code: CatalogCode };
const MACROS: readonly Macro[] = ["protein_g", "kcal", "carbs_g", "fat_g"];
// Bounded immutable math/source cache only. Exact text plus independently
// captured pin/count must match. Mutable byte inputs always take the full path.
// No owner, request, clock, admission, access or operation is stored here.
const validatedTexts: { text: string; sha256: string; count: number; result: Extract<CatalogProjectionOutcome, { outcome: "success" }> }[] = [];
const sha = (value: string | Uint8Array) => sha256Hex(value);
class CatalogFault extends Error {
  code: CatalogCode;
  constructor(code: CatalogCode) { super("Invalid revised catalog evidence"); this.code = code; }
}
function fail(code: CatalogCode = "invalid_catalog_source"): never { throw new CatalogFault(code); }
function object(value: unknown): Data { if (!value || typeof value !== "object" || Array.isArray(value)) fail(); return value as Data; }
function text(value: unknown, max = 500): string { if (typeof value !== "string" || !value.trim() || value.length > max) fail(); return value; }
function strings(value: unknown): string[] { if (!Array.isArray(value) || value.length > 200 || value.some(item => typeof item !== "string" || !item || item.length > 2000)) fail(); return value as string[]; }
function hashValue(value: unknown): string { if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) fail("invalid_recipe_identity"); return value; }
function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0).map(([key, nested]) => [key, stable(nested)]));
  return value;
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(deepFreeze); Object.freeze(value);
  }
  return value;
}
function sourceFraction(value: unknown): Rational {
  if (typeof value !== "string" || value.length > 240 || !/^(0|[1-9]\d*)(\/(0|[1-9]\d*))?$/.test(value)) fail("invalid_nutrition_evidence");
  const [numerator, denominator = "1"] = value.split("/");
  try { return rational(BigInt(numerator!), BigInt(denominator)); } catch { return fail("invalid_nutrition_evidence"); }
}
function macros(value: unknown): Record<Macro, { min: Rational; max: Rational }> {
  const record = object(value);
  return Object.fromEntries(MACROS.map(key => {
    const range = object(record[key]), min = sourceFraction(range.min), max = sourceFraction(range.max);
    if (compare(min, max) > 0) fail("invalid_nutrition_evidence");
    return [key, { min, max }];
  })) as Record<Macro, { min: Rational; max: Rational }>;
}
function nutrition(row: Data, recipe: Recipe): RevisedRecipeProjection["nutrition"] {
  try {
    const value = object(row.nutrition), flags = strings(value.flags), missingIngredients = strings(value.missing_ingredients);
    const refresh = object(value.source_refresh);
    const reviewedParent = reviewedMethodNutritionParent(row)??finalReviewedMethodNutritionParent(row);
    if ((Object.hasOwn(row, "preparation_lineage") || isReviewedMethodBodySha(row.recipe_sha256)) && reviewedParent === null) fail("invalid_recipe_identity");
    const nutritionBody = reviewedParent ?? row.recipe_sha256;
    if (refresh.exact_recipe_body_sha256 !== nutritionBody || refresh.recipe_sha256_unchanged !== nutritionBody) fail("invalid_recipe_identity");
    hashValue(refresh.source_archive_sha256);
    if (value.servings !== String(recipe.servings)) fail("invalid_nutrition_evidence");
    if (value.status === "held-incomplete") {
      if (value.per_serving !== null || value.whole_batch !== null || !missingIngredients.length) fail("invalid_nutrition_evidence");
      return { status: "held", perServing: null, flags, missingIngredients };
    }
    if (value.status === FINAL_DERIVED_NUTRITION_STATUS || Object.hasOwn(row,"derived_lineage")) {
      if(value.status!==FINAL_DERIVED_NUTRITION_STATUS||!isFinalDerivedRow(row)) fail("invalid_nutrition_evidence");
    } else if (value.status === MIXED_NUTRITION_STATUS || Object.hasOwn(value, "nutrition_overlay")) {
      if (value.status !== MIXED_NUTRITION_STATUS || !isReviewedMixedNutrition(row)) fail("invalid_nutrition_evidence");
    } else if (value.status !== "complete-conditional-USDA-input-estimate") fail("invalid_nutrition_evidence");
    if (missingIngredients.length) fail("invalid_nutrition_evidence");
    const perServing = macros(value.per_serving), wholeBatch = macros(value.whole_batch), servings = rational(BigInt(recipe.servings));
    for (const key of MACROS) for (const edge of ["min", "max"] as const) {
      if (compare(multiply(perServing[key][edge], servings), wholeBatch[key][edge]) !== 0) fail("invalid_nutrition_evidence");
    }
    return { status: "conditional", perServing: Object.fromEntries(MACROS.map(key => [key, { min: receipt(perServing[key].min), max: receipt(perServing[key].max) }])) as MacroRanges, flags, missingIngredients };
  } catch (error) {
    if (error instanceof CatalogFault && error.code === "invalid_recipe_identity") throw error;
    return fail("invalid_nutrition_evidence");
  }
}
function project(value: unknown): RevisedRecipeProjection {
  const row = object(value), id = text(row.id), body = object(row.recipe), recipeSha256 = hashValue(row.recipe_sha256);
  if (sha(JSON.stringify(stable(body))) !== recipeSha256) fail("invalid_recipe_identity");
  if (row.product_accepted !== false || row.kitchen_tested !== false || row.allergen_reviewed !== false || !["main", "breakfast"].includes(String(row.kind))) fail();
  const sections = strings(row.sections); strings(row.flags); strings(row.holds);
  if (!Number.isSafeInteger(body.servings) || (body.servings as number) <= 0) fail();
  text(body.title); strings(body.equipment);
  if (!Array.isArray(body.ingredients) || !body.ingredients.length || body.ingredients.length > 100 || !Array.isArray(body.steps) || !body.steps.length || body.steps.length > 100) fail();
  if (body.ingredient_count !== undefined && body.ingredient_count !== body.ingredients.length) fail();
  const ingredientIds = new Set<string>(), stepIds = new Set<number>();
  for (const value of body.ingredients) {
    const ingredient = object(value), ingredientId = text(ingredient.id);
    if (ingredientIds.has(ingredientId) || !["g", "ml"].includes(String(ingredient.unit))) fail();
    ingredientIds.add(ingredientId); text(ingredient.name); text(ingredient.state);
    // Revised sources also preserve exact fractions such as salt "4/5".
    // Validate without changing their spelling or widening the legacy parser.
    try {
      const quantity = typeof ingredient.quantity === "string" && ingredient.quantity.includes("/") ? sourceFraction(ingredient.quantity) : decimal(ingredient.quantity);
      if (quantity.n === BigInt(0)) fail();
    } catch { fail(); }
  }
  for (const value of body.steps) {
    const step = object(value);
    if (!Number.isSafeInteger(step.id) || (step.id as number) <= 0 || stepIds.has(step.id as number)) fail();
    stepIds.add(step.id as number); text(step.instruction, 10000);
    if (!Array.isArray(step.allocations) || step.allocations.some(value => !ingredientIds.has(text(object(value).id)))) fail();
  }
  const recipe = body as Recipe;
  return { id, kind: row.kind as "main" | "breakfast", sections, recipeSha256, recipe, source: row, nutrition: nutrition(row, recipe), capabilities: { regionalPrice: "held", wholePackCheckout: "held", imageBinding: "held" }, plannerAdopted: false };
}

export type CatalogYieldControl = () => Promise<void>;
// Each sync and async caller drives the same validation steps. Only a fully
// admitted immutable result enters the original exact-text cache.
function* catalogSteps(source: unknown, expectedSha256: string, expectedCount: number): Generator<void, CatalogProjectionOutcome> {
  try {
    if (typeof source !== "string" && !(source instanceof Uint8Array)) fail();
    if (typeof source === "string") {
      const cached = validatedTexts.find(row => row.sha256 === expectedSha256 && row.count === expectedCount && row.text === source);
      if (cached) return cached.result;
    }
    const chunks: Uint8Array[] = []; let total = 0;
    if (typeof source === "string") {
      for (let at = 0; at < source.length;) {
        let end = Math.min(at + 65536, source.length);
        // Do not split a surrogate pair; utf8Encode retains its existing lone-surrogate behavior.
        if (end < source.length && source.charCodeAt(end - 1) >= 0xd800 && source.charCodeAt(end - 1) <= 0xdbff) end--;
        const chunk = utf8Encode(source.slice(at, end)); total += chunk.length;
        if (total > 64 * 1024 * 1024) fail(); chunks.push(chunk); at = end; yield;
      }
    } else {
      if (source.byteLength > 64 * 1024 * 1024) fail();
      const bytes = copyRuntimeBytes(source); if (bytes.length > 64 * 1024 * 1024) fail();
      for (let at = 0; at < bytes.length; at += 65536) { const chunk = bytes.subarray(at, at + 65536); chunks.push(chunk); total += chunk.length; yield; }
    }
    const bytes = new Uint8Array(total); let offset = 0; const hash = createRuntimeSha256();
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; hash.update(chunk); yield; }
    if (hash.digestHex() !== expectedSha256) return { outcome: "error", code: "source_hash_mismatch" };
    const decoded: string[] = [];
    for (let at = 0; at < bytes.length;) {
      let end = Math.min(at + 65536, bytes.length);
      while (end < bytes.length && end > at && (bytes[end]! & 0xc0) === 0x80) end--;
      if (end === at) fail();
      decoded.push(utf8DecodeFatal(bytes.subarray(at, end), at !== 0)); at = end; yield;
    }
    const lines = decoded.join("").replace(/\r?\n$/, "").split(/\r?\n/);
    if (lines.length !== expectedCount || lines.some(line => !line.trim())) fail();
    const recipes: RevisedRecipeProjection[] = [];
    // Freeze each complete projection inside the bounded validation batch. A
    // final recursive walk of all1300mutable rows would block after the last
    // cooperative yield. No row or partial catalog is published here.
    for (let i = 0; i < lines.length; i++) { recipes.push(deepFreeze(project(JSON.parse(lines[i]!)))); if ((i + 1) % 8 === 0) yield; }
    const ids = new Set(recipes.map(row => row.id)); if (ids.size !== recipes.length) fail("invalid_recipe_identity");
    const conditionalNutrition = recipes.filter(row => row.nutrition.status === "conditional").length;
    const result = deepFreeze({ outcome: "success" as const, sourceSha256: expectedSha256, recipes, summary: { total: recipes.length, main: recipes.filter(row => row.kind === "main").length, breakfast: recipes.filter(row => row.kind === "breakfast").length, conditionalNutrition, heldNutrition: recipes.length - conditionalNutrition }, productAccepted: false as const });
    if (typeof source === "string") { if (validatedTexts.length >= 2) validatedTexts.shift(); validatedTexts.push({ text: source, sha256: expectedSha256, count: expectedCount, result }); }
    return result;
  } catch (error) { return { outcome: "error", code: error instanceof CatalogFault ? error.code : "invalid_catalog_source" }; }
}
export function createRevisedCatalogReader(pin: unknown): (source: unknown) => CatalogProjectionOutcome {
  if (!pin || typeof pin !== "object" || Array.isArray(pin)) throw new Error("Invalid revised catalog pin");
  const descriptors = Object.getOwnPropertyDescriptors(pin), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || keys.some(key => typeof key !== "string" || !["sha256", "recordCount"].includes(key) || !("value" in descriptors[key]!) || !descriptors[key]!.enumerable)) throw new Error("Invalid revised catalog pin");
  const expectedSha256: unknown = descriptors.sha256?.value, expectedCount: unknown = descriptors.recordCount?.value;
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256) || !Number.isSafeInteger(expectedCount) || (expectedCount as number) < 1 || (expectedCount as number) > 2000) throw new Error("Invalid revised catalog pin");
  return source => { const steps = catalogSteps(source, expectedSha256 as string, expectedCount as number); let next = steps.next(); while (!next.done) next = steps.next(); return next.value; };
}
export function createRevisedCatalogReaderAsync(pin: unknown, yieldControl: CatalogYieldControl): (source: unknown) => Promise<CatalogProjectionOutcome> {
  if (!pin || typeof pin !== "object" || Array.isArray(pin)) throw new Error("Invalid revised catalog pin");
  const descriptors = Object.getOwnPropertyDescriptors(pin), keys = Reflect.ownKeys(descriptors);
  if (keys.length !== 2 || keys.some(key => typeof key !== "string" || !["sha256", "recordCount"].includes(key) || !("value" in descriptors[key]!) || !descriptors[key]!.enumerable)) throw new Error("Invalid revised catalog pin");
  const expectedSha256: unknown = descriptors.sha256?.value, expectedCount: unknown = descriptors.recordCount?.value;
  if (typeof expectedSha256 !== "string" || !/^[a-f0-9]{64}$/.test(expectedSha256) || !Number.isSafeInteger(expectedCount) || (expectedCount as number) < 1 || (expectedCount as number) > 2000) throw new Error("Invalid revised catalog pin");
  if (typeof yieldControl !== "function") throw Error("catalog_scheduler_required");
  return async source => { const steps = catalogSteps(source, expectedSha256 as string, expectedCount as number); let next = steps.next(); while (!next.done) { await yieldControl(); next = steps.next(); } return next.value; };
}

export const loadRevisedCatalog = createRevisedCatalogReader(CURRENT_REVISED_CATALOG_PIN);
