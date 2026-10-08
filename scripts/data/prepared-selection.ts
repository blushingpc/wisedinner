// LOCAL producer adjunct, not a public DTO or food/adoption approval.
import type { Diet, Snapshot, SolveInput, SolveOutput } from "../../packages/solver/src/types.ts";
import { RECIPES } from "./authored/recipes.ts";
import { SKUS } from "./authored/skus.ts";
import { EQUIPMENT, PREPARATION_VERSION, resolvePreparation } from "./authored/preparation.ts";
import { expandRecipes, toSku } from "./expand.ts";
import { eligibleSnapshot, SAFETY, type SafetyTable } from "./ingredient-safety.ts";
import { solveRestricted, restrictedCandidates } from "./catalog-selection.ts";

export type PreparationContext = {
  source: ReturnType<typeof expandRecipes>;
  version: string;
  ownedEquipment: readonly string[];
  methodId?: string;
};
type UsablePreparation = Extract<ReturnType<typeof resolvePreparation>, { state: "authored-local" }>;
const canonical = expandRecipes(RECIPES);
const canonicalSkus = new Map(SKUS.map(sku => [sku.id, toSku(sku)]));

// Reject accessors/sparse lists before any restriction/selection code can read
// them. This accepts plain data only; it never invokes a getter to copy it.
export function preparationData<T>(value: T, ancestors = new Set<object>()): T {
  if (value === undefined || value === null || typeof value === "string" || typeof value === "boolean" || (typeof value === "number" && Number.isFinite(value))) return value;
  if (typeof value !== "object" || ancestors.has(value)) throw Error("Malformed preparation data");
  const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== "string" || !("value" in descriptors[key]))) throw Error("Malformed preparation data");
  const next = new Set(ancestors).add(value);
  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) throw Error("Malformed preparation list");
    const length = descriptors.length.value as number;
    if (keys.length !== length + 1 || Array.from({ length }, (_, i) => i).some(i => !descriptors[i])) throw Error("Malformed preparation list");
    return Array.from({ length }, (_, i) => preparationData(descriptors[i].value, next)) as T;
  }
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("Malformed preparation data");
  return Object.fromEntries(keys.map(key => [key, preparationData(descriptors[key as string].value, next)])) as T;
}

export function preparationContext(context: PreparationContext): PreparationContext {
  const copy = preparationData(context);
  if (!copy || Object.keys(copy).some(key => !["source", "version", "ownedEquipment", "methodId"].includes(key)) || copy.version !== PREPARATION_VERSION) throw Error("Unsupported preparation context/version");
  if (!Array.isArray(copy.ownedEquipment) || copy.ownedEquipment.length > EQUIPMENT.length || new Set(copy.ownedEquipment).size !== copy.ownedEquipment.length || copy.ownedEquipment.some(tool => !(EQUIPMENT as readonly string[]).includes(tool))) throw Error("Unknown preparation equipment");
  if (copy.methodId !== undefined && (typeof copy.methodId !== "string" || !copy.methodId)) throw Error("Unknown preparation method");
  if (!copy.source || !Array.isArray(copy.source.recipes) || !Array.isArray(copy.source.ingredients) || !Array.isArray(copy.source.variants)) throw Error("Malformed preparation source");
  return copy;
}

// Object field order does not confer compatibility; ordered arrays/rows do.
function normalized(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(normalized);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => [key, normalized(value)]));
  return value;
}
const equal = (a: unknown, b: unknown) => JSON.stringify(normalized(a)) === JSON.stringify(normalized(b));
function form(sku: Snapshot["skus"][number]) {
  // Baseline/observed prices are still evaluated by the existing price book.
  return Object.fromEntries(Object.entries(sku).filter(([key]) => key !== "baseline_usd"));
}

export function preparedCatalog(snapshot: Snapshot, supplied: PreparationContext) {
  const context = preparationContext(supplied), copy = preparationData(snapshot);
  const preparations = new Map<string, UsablePreparation>(), reasons = new Map<string, string>();
  for (const recipe of copy.recipes) {
    const expected = canonical.recipes.find(row => row.id === recipe.id), sourceRows = context.source.recipes.filter(row => row.id === recipe.id);
    const fail = (reason: string) => reasons.set(recipe.id, reason);
    if (!expected || sourceRows.length !== 1 || copy.recipes.filter(row => row.id === recipe.id).length !== 1 || !equal(recipe, expected) || !equal(sourceRows[0], expected)) { fail("uncovered-or-mismatched-recipe-source"); continue; }
    const rows = copy.recipe_ingredients.filter(row => row.recipe_id === recipe.id), expectedRows = canonical.ingredients.filter(row => row.recipe_id === recipe.id);
    if (!equal(rows, expectedRows) || rows.some(row => {
      const skus = copy.skus.filter(sku => sku.id === row.sku_id), authored = canonicalSkus.get(row.sku_id);
      return skus.length !== 1 || !authored || !equal(form(skus[0]), form(authored));
    })) { fail("mismatched-ingredient-quantity-form"); continue; }
    const links = copy.recipe_variants.filter(row => row.variant_recipe_id === recipe.id), sourceLinks = context.source.variants.filter(row => row.variant_recipe_id === recipe.id), expectedLinks = canonical.variants.filter(row => row.variant_recipe_id === recipe.id);
    if (!equal(links, expectedLinks) || !equal(sourceLinks, expectedLinks)) { fail("mismatched-variant-parent"); continue; }
    const result = resolvePreparation(context.source, recipe.id, context.ownedEquipment, context.version, context.methodId);
    if (result.state !== "authored-local") { fail(result.reason); continue; }
    preparations.set(recipe.id, result);
  }
  // Fixed point retains real repeat-family closure, including an excluded
  // parent of an otherwise usable variant. Never turn a child into a base.
  let removed = true;
  while (removed) {
    removed = false;
    for (const link of copy.recipe_variants) if (preparations.has(link.variant_recipe_id) && !preparations.has(link.recipe_id)) {
      preparations.delete(link.variant_recipe_id); reasons.set(link.variant_recipe_id, "missing-compatible-parent"); removed = true;
    }
  }
  return {
    snapshot: { ...copy, recipes: copy.recipes.filter(row => preparations.has(row.id)), recipe_ingredients: copy.recipe_ingredients.filter(row => preparations.has(row.recipe_id)), recipe_variants: copy.recipe_variants.filter(row => preparations.has(row.recipe_id) && preparations.has(row.variant_recipe_id)) },
    preparations: [...preparations.values()].map(row => structuredClone(row)),
    excluded: copy.recipes.filter(row => !preparations.has(row.id)).map(row => ({ id: row.id, reason: reasons.get(row.id)! })),
    crossLaneAccepted: false as const, restrictionAdmission: false as const,
  };
}

export function restrictedPreparedCatalog(snapshot: Snapshot, diet: Diet, allergies: string[], context: PreparationContext, table: SafetyTable = SAFETY) {
  const checked = preparationContext(context), copy = preparationData(snapshot);
  return preparedCatalog(eligibleSnapshot(copy, preparationData(diet), preparationData(allergies), preparationData(table)), checked);
}
function bindings(pool: ReturnType<typeof preparedCatalog>, ids: string[]) {
  return [...new Set(ids)].map(id => {
    const method = pool.preparations.find(row => row.id === id);
    if (!method) throw Error("Selected recipe has no compatible preparation");
    return structuredClone(method);
  });
}
// Thin INTERNAL result adjunct; the existing SolveOutput/candidate DTO stays
// unchanged. No new solver, cost/nutrition field or public wiring.
export function solvePreparedRestricted(input: SolveInput, snapshot: Snapshot, allergies: string[], context: PreparationContext, table: SafetyTable = SAFETY) {
  input = preparationData(input);
  const pool = restrictedPreparedCatalog(snapshot, input.diet, allergies, context, table);
  const out = solveRestricted(input, snapshot, allergies, table, context);
  return { out, preparations: bindings(pool, out.days.flatMap(day => day.items.map(item => item.recipe_id))), crossLaneAccepted: false as const, restrictionAdmission: false as const };
}
export function preparedRestrictedCandidates(week: SolveOutput, slot: number, snapshot: Snapshot, allergies: string[], context: PreparationContext, table: SafetyTable = SAFETY) {
  week = preparationData(week);
  const pool = restrictedPreparedCatalog(snapshot, week.input.diet, allergies, context, table);
  const candidates = restrictedCandidates(week, slot, snapshot, allergies, table, context);
  return { candidates, preparations: bindings(pool, candidates.map(row => row.recipe_id)), crossLaneAccepted: false as const, restrictionAdmission: false as const };
}
