import { add, approximate, ceilScaled, compare, decimal, distance, divide, multiply, presentCost, presentRange, range, scaleRange, sumRange, zero, type ExactRange } from "./generated-meal-ranges.ts";

export const GENERATED_REGIONS = ["Northeast", "Midwest", "South", "West"] as const;
export type GeneratedRegion = typeof GENERATED_REGIONS[number];
type OriginalIngredient = { id: string; name: string; quantity: string; unit: "g" | "ml"; state: string; allergens: string[]; allocations: unknown[] };
export type OriginalGeneratedRecipe = {
  id: string; title: string; family_id: string; servings: number; ingredients: OriginalIngredient[];
  equipment: string[]; method: { number: number; instruction: string; equipment: string[] }[];
  allergen_hints: string[]; row_sha256: string; planner_eligible: false; kitchen_tested: false;
  estimated_time_minutes: { elapsed_max: number; [key: string]: unknown }; [key: string]: unknown;
};
type PriceRange = { min: string; max: string; [key: string]: unknown };
type Line = {
  ingredient: { id: string; name: string; quantity: string; unit: "g" | "ml"; state: string; signature: string };
  utility_excluded: boolean;
  purchase: null | (PriceRange & { unit: "g" | "ml"; yield: { min: string; max: string; [key: string]: unknown } });
  regions: Record<GeneratedRegion, PriceRange & { source: { kind: string; reference?: string; [key: string]: unknown }; flags?: string[]; flagsRef?: string }>;
  flags: string[];
};
type Macro = "kcal" | "protein_g" | "carbs_g" | "fat_g";
export type GeneratedMeal = {
  id: string; originalRecipe: OriginalGeneratedRecipe; originalRecipeHash: string; predecessorHash: string;
  nutritionPerServing: Record<Macro, PriceRange>; nutritionFlags: string[]; lines: Line[];
  costPerServing: Record<GeneratedRegion, PriceRange>; flags: string[];
  productAccepted: false; kitchenVerified: false; allergyVerified: false;
};
export type GeneratedCatalog = {
  schema: "wd-generated-planner-catalog-v1"; regions: string[]; meals: GeneratedMeal[];
  sourceRecipesSha256: string; sourceFactsSha256: string; budgetBasis: "fractional-ingredient-allocation";
  wholePackCheckoutSupported: false; productAccepted: false; plannerMode: "local-reference"; limitations: string[];
  priceSources?: Record<string, unknown>; priceFlags?: Record<string, string[]>;
  ingredientLines?: Record<string, Line>;
};
export type GeneratedPlanRequest = {
  region: GeneratedRegion; days: number; mealsPerDay: 1 | 2; household: number;
  // Per person, from the planned main meals only. Each person receives one source serving per slot.
  proteinTargetsG: string[]; budgetCents: number; equipment: string[];
  excludedIngredientIds?: string[]; excludedAllergenHints?: string[];
  maxElapsedMinutes?: number; seed?: number; preferredStores?: string[];
};
export type GeneratedSelection = string[][];
const MACROS: Macro[] = ["kcal", "protein_g", "carbs_g", "fat_g"];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));
const str = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 500;
const instruction = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 10000;
function strings(x: unknown): x is string[] { return Array.isArray(x) && x.length <= 100 && x.every(str) && new Set(x).size === x.length; }
function positive(value: unknown): void { if (compare(decimal(value), zero()) <= 0) throw new Error("Positive quantity required"); }
function emptyRange(): ExactRange { return { min: zero(), max: zero() }; }

function validateCatalog(input: unknown): GeneratedCatalog {
  if (!input || typeof input !== "object") throw new Error("Catalog required");
  const c = clone(input) as GeneratedCatalog;
  if (c.schema !== "wd-generated-planner-catalog-v1" || c.budgetBasis !== "fractional-ingredient-allocation" || c.wholePackCheckoutSupported !== false || c.productAccepted !== false || c.plannerMode !== "local-reference" || !Array.isArray(c.meals) || !c.meals.length || c.meals.length > 2000 || !/^[a-f0-9]{64}$/.test(c.sourceRecipesSha256)) throw new Error("Incompatible generated catalog");
  const seen = new Set<string>();
  for (const m of c.meals) {
    if (Array.isArray(m.lines)) m.lines = (m.lines as unknown[]).map(value => {
      const line = typeof value === "string" ? c.ingredientLines?.[value] : value;
      if (!line || typeof line !== "object") throw new Error("Ingredient line reference unavailable");
      return line as Line;
    });
    const r = m.originalRecipe;
    if (!str(m.id) || seen.has(m.id) || !r || r.id !== m.id || r.row_sha256 !== m.originalRecipeHash || r.planner_eligible !== false || r.kitchen_tested !== false || m.productAccepted !== false || m.kitchenVerified !== false || m.allergyVerified !== false || !Number.isInteger(r.servings) || r.servings <= 0 || !strings(r.equipment) || !strings(r.allergen_hints) || !Array.isArray(r.ingredients) || !r.ingredients.length || !Array.isArray(r.method) || !r.method.length || r.method.some(s => !instruction(s.instruction) || !Array.isArray(s.equipment)) || !Array.isArray(m.lines) || m.lines.length !== r.ingredients.length || !strings(m.flags) || !strings(m.nutritionFlags)) throw new Error("Invalid generated recipe");
    seen.add(m.id);
    for (const macro of MACROS) range(m.nutritionPerServing[macro]?.min, m.nutritionPerServing[macro]?.max);
    const ingredientSeen = new Set<string>();
    for (let i = 0; i < r.ingredients.length; i++) {
      const original = r.ingredients[i], line = m.lines[i];
      if (!original || !line || ingredientSeen.has(original.id) || original.id !== line.ingredient.id || original.name !== line.ingredient.name || original.state !== line.ingredient.state || original.quantity !== line.ingredient.quantity || original.unit !== line.ingredient.unit || !["g", "ml"].includes(original.unit)) throw new Error("Ingredient identity mismatch");
      ingredientSeen.add(original.id); positive(original.quantity);
      if (line.utility_excluded) {
        if (original.id !== "process_water" || line.purchase !== null) throw new Error("Invalid utility exclusion");
      } else {
        if (!line.purchase || line.purchase.unit !== original.unit) throw new Error("Purchase quantity required");
        range(line.purchase.min, line.purchase.max); positive(line.purchase.min);
        const y = range(line.purchase.yield.min, line.purchase.yield.max);
        if (compare(y.min, zero()) <= 0 || compare(y.max, decimal("1")) > 0) throw new Error("Invalid purchase yield");
        for (const region of GENERATED_REGIONS) {
          const cell = line.regions[region];
          const flags = cell?.flags ?? (cell?.flagsRef ? c.priceFlags?.[cell.flagsRef] : undefined);
          if (!cell?.source || !str(cell.source.kind) || !Array.isArray(flags) || (cell.source.reference && !c.priceSources?.[cell.source.reference])) throw new Error("Price provenance required");
          range(cell.min, cell.max);
        }
      }
    }
    for (const region of GENERATED_REGIONS) {
      const declared = range(m.costPerServing[region]?.min, m.costPerServing[region]?.max);
      let sum = emptyRange();
      for (const l of m.lines) if (!l.utility_excluded) sum = sumRange(sum, range(l.regions[region].min, l.regions[region].max));
      const servings = decimal(String(r.servings));
      // The input decimals are 80-place displays of exact source fractions. Allow only sub-microcent serialization loss.
      if (Math.abs(approximate(divide(sum.min, servings)) - approximate(declared.min)) > 1e-10 || Math.abs(approximate(divide(sum.max, servings)) - approximate(declared.max)) > 1e-10) throw new Error("Recipe price aggregate differs");
    }
  }
  return c;
}

function request(input: GeneratedPlanRequest): GeneratedPlanRequest {
  const allowedKeys = new Set<string>(["region", "days", "mealsPerDay", "household", "proteinTargetsG", "budgetCents", "equipment", "excludedIngredientIds", "excludedAllergenHints", "maxElapsedMinutes", "seed", "preferredStores"]);
  if (!input || typeof input !== "object" || Array.isArray(input) || Reflect.ownKeys(input).some(key => typeof key !== "string" || !allowedKeys.has(key))) throw new Error("Invalid generated plan request");
  const r = clone(input);
  if (!GENERATED_REGIONS.includes(r.region) || !Number.isInteger(r.days) || r.days < 1 || r.days > 7 || ![1, 2].includes(r.mealsPerDay) || !Number.isInteger(r.household) || r.household < 1 || r.household > 8 || !Array.isArray(r.proteinTargetsG) || r.proteinTargetsG.length !== r.household || !Number.isSafeInteger(r.budgetCents) || r.budgetCents < 0 || !strings(r.equipment) || !strings(r.excludedIngredientIds ?? []) || !strings(r.excludedAllergenHints ?? []) || !strings(r.preferredStores ?? []) || (r.maxElapsedMinutes !== undefined && (!Number.isInteger(r.maxElapsedMinutes) || r.maxElapsedMinutes <= 0)) || (r.seed !== undefined && !Number.isSafeInteger(r.seed))) throw new Error("Invalid generated plan request");
  r.proteinTargetsG.forEach(v => { positive(v); if (compare(decimal(v), decimal("1000")) > 0) throw new Error("Protein target out of bounds"); });
  return r;
}

export function createGeneratedMealPlanner(input: unknown) {
  const catalog = validateCatalog(input);
  const meals = new Map(catalog.meals.map(m => [m.id, m]));
  const ingredientIds = new Set(catalog.meals.flatMap(m => m.originalRecipe.ingredients.map(i => i.id)));
  const allergenHints = new Set(catalog.meals.flatMap(m => m.originalRecipe.allergen_hints));
  function checkedRequest(input: GeneratedPlanRequest) {
    const r = request(input);
    if ((r.excludedIngredientIds ?? []).some(id => !ingredientIds.has(id)) || (r.excludedAllergenHints ?? []).some(id => !allergenHints.has(id))) throw new Error("Unknown ingredient or allergen exclusion requires an explicit mapping");
    return r;
  }
  function compatible(m: GeneratedMeal, r: GeneratedPlanRequest): boolean {
    const recipe = m.originalRecipe;
    return recipe.equipment.every(x => r.equipment.includes(x)) && !(r.excludedIngredientIds ?? []).some(x => recipe.ingredients.some(i => i.id === x)) && !(r.excludedAllergenHints ?? []).some(x => recipe.allergen_hints.includes(x)) && (r.maxElapsedMinutes === undefined || recipe.estimated_time_minutes.elapsed_max <= r.maxElapsedMinutes);
  }
  function evaluate(selectionInput: GeneratedSelection, requestInput: GeneratedPlanRequest) {
    const r = checkedRequest(requestInput), selection = clone(selectionInput);
    if (!Array.isArray(selection) || selection.length !== r.days || selection.some(d => !Array.isArray(d) || d.length !== r.mealsPerDay || d.some(id => !str(id) || !meals.has(id)))) throw new Error("Invalid generated week selection");
    const violations = new Set<string>(), families = new Map<string, number>(), flags = new Set<string>(catalog.limitations);
    flags.add("replacement-tolerance-uses-lower-input-protein-reference");
    if (new Set(selection.flat()).size !== selection.flat().length) violations.add("duplicate-recipe");
    const grocery = new Map<string, { id: string; name: string; state: string; unit: string; edible: ReturnType<typeof decimal>; purchased: ExactRange; cost: ExactRange; flags: Set<string>; signatures: Set<string> }>();
    let totalCost = emptyRange();
    const days = selection.map((ids, day) => {
      const nutrition = Object.fromEntries(MACROS.map(k => [k, emptyRange()])) as Record<Macro, ExactRange>;
      const items = ids.map(id => {
        const m = meals.get(id)!;
        if (!compatible(m, r)) violations.add("equipment-or-exclusion");
        families.set(m.originalRecipe.family_id, (families.get(m.originalRecipe.family_id) ?? 0) + 1);
        for (const macro of MACROS) nutrition[macro] = sumRange(nutrition[macro], range(m.nutritionPerServing[macro].min, m.nutritionPerServing[macro].max));
        for (const flag of [...m.flags, ...m.nutritionFlags]) flags.add(flag);
        const householdShare = divide(decimal(String(r.household)), decimal(String(m.originalRecipe.servings)));
        for (const l of m.lines) {
          if (l.utility_excluded) continue;
          const i = l.ingredient, p = l.purchase!;
          // Preserve distinct prepared states/units. Never combine beans drained with undrained mass.
          const key = `${i.id}|${i.state}|${i.unit}`;
          const previous = grocery.get(key) ?? { id: i.id, name: i.name, state: i.state, unit: i.unit, edible: zero(), purchased: emptyRange(), cost: emptyRange(), flags: new Set<string>(), signatures: new Set<string>() };
          previous.edible = add(previous.edible, multiply(decimal(i.quantity), householdShare));
          previous.purchased = sumRange(previous.purchased, scaleRange(range(p.min, p.max), householdShare));
          previous.cost = sumRange(previous.cost, scaleRange(range(l.regions[r.region].min, l.regions[r.region].max), householdShare));
          previous.signatures.add(i.signature); l.flags.forEach(f => previous.flags.add(f)); grocery.set(key, previous);
        }
        totalCost = sumRange(totalCost, scaleRange(range(m.costPerServing[r.region].min, m.costPerServing[r.region].max), decimal(String(r.household))));
        const ingredientScale = divide(decimal(String(r.household)), decimal(String(m.originalRecipe.servings)));
        return { id, title: m.originalRecipe.title, originalRecipeHash: m.originalRecipeHash, originalRecipe: clone(m.originalRecipe), servingsPerPerson: 1, householdServings: r.household,
          originalMethodServings: m.originalRecipe.servings, batchTimingVerified: false,
          ingredientsForHousehold: m.originalRecipe.ingredients.map(i => ({ id: i.id, name: i.name, unit: i.unit, state: i.state, originalQuantity: i.quantity, quantity: presentRange(scaleRange({ min: decimal(i.quantity), max: decimal(i.quantity) }, ingredientScale)) })),
          methodScalingRequired: r.household !== m.originalRecipe.servings,
          methodQuantityNote: "Original instructions retain their source batch quantities. The separate household ingredient card gives the scaled amounts; batch cooking time is unverified.",
          costPerServing: presentCost(range(m.costPerServing[r.region].min, m.costPerServing[r.region].max)), flags: [...m.flags, ...m.nutritionFlags, ...(r.household !== m.originalRecipe.servings ? ["original-method-numbers-require-household-ingredient-card"] : [])] };
      });
      r.proteinTargetsG.forEach(target => { if (compare(nutrition.protein_g.min, decimal(target)) < 0) violations.add(`protein-day-${day + 1}`); });
      return { day: day + 1, meals: items, nutritionPerPerson: Object.fromEntries(MACROS.map(k => [k, presentRange(nutrition[k])])) };
    });
    if ([...families.values()].some(n => n > 2)) violations.add("family-repeat-cap");
    if (compare(totalCost.max, divide(decimal(String(r.budgetCents)), decimal("100"))) > 0) violations.add("ingredient-allocation-budget");
    if ((r.preferredStores ?? []).length) flags.add("preferred-stores-retained-regional-model-has-no-store-specific-price");
    const list = [...grocery.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => ({ id: v.id, name: v.name, preparedState: v.state, unit: v.unit,
      recipeInputQuantity: presentRange({ min: v.edible, max: v.edible }), purchaseQuantity: presentRange(v.purchased), ingredientAllocationCost: presentCost(v.cost),
      suggestedLargeEggCount: v.id === "protein_eggs" ? ceilScaled(divide(v.purchased.max, decimal("50")), 1) : null,
      packageCount: null, packageCheckoutCost: null, flags: [...v.flags].sort(), sourceSignatures: [...v.signatures].sort() }));
    return { schema: "wd-generated-reference-week-v1" as const, request: r, selection, referenceConstraintsSatisfied: violations.size === 0, violations: [...violations].sort(), days, list,
      ingredientAllocationCost: presentCost(totalCost), budgetBasis: catalog.budgetBasis, wholePackCheckoutCost: null, wholePackBudgetVerified: false,
      nutritionScope: "Per-person ingredient-input ranges from the planned main meals only.", allergyScope: "Known ingredient-family hints only; product labels and cross-contact remain unverified.",
      flags: [...flags].sort(), sourceRecipesSha256: catalog.sourceRecipesSha256, productAccepted: false, kitchenVerified: false, plannerMode: "local-reference" as const };
  }
  function plan(requestInput: GeneratedPlanRequest): { status: "no-compatible-meals" | "constraints-unmet" | "planned-reference-week"; eligibleMeals: number; week: ReturnType<typeof evaluate> | null; unmet: string[]; plannedDaysBeforeFailure?: number } {
    const r = checkedRequest(requestInput), target = Math.max(...r.proteinTargetsG.map(x => Number(x)));
    const eligible = catalog.meals.filter(m => compatible(m, r));
    const ranked = eligible.map(m => ({ m, price: Number(m.costPerServing[r.region].max), protein: Number(m.nutritionPerServing.protein_g.min) }))
      .sort((a, b) => a.price - b.price || a.m.id.localeCompare(b.m.id));
    if (!ranked.length) return { status: "no-compatible-meals" as const, eligibleMeals: 0, week: null, unmet: ["equipment-or-exclusion"] };
    const counts = new Map<string, number>(), used = new Set<string>(), selection: string[][] = [];
    for (let day = 0; day < r.days; day++) {
      const allowed = ranked.filter(x => !used.has(x.m.id) && (counts.get(x.m.originalRecipe.family_id) ?? 0) < 2);
      const groups: { ids: string[]; price: number }[] = [];
      for (const first of allowed) {
        if (r.mealsPerDay === 1) { if (first.protein >= target) groups.push({ ids: [first.m.id], price: first.price }); }
        else {
          const second = allowed.find(x => x.m.id !== first.m.id && first.protein + x.protein >= target && (x.m.originalRecipe.family_id !== first.m.originalRecipe.family_id || (counts.get(x.m.originalRecipe.family_id) ?? 0) === 0));
          if (second) groups.push({ ids: [first.m.id, second.m.id], price: first.price + second.price });
        }
      }
      if (!groups.length) return { status: "constraints-unmet" as const, eligibleMeals: eligible.length, week: null, unmet: ["protein-or-variety"], plannedDaysBeforeFailure: selection.length };
      groups.sort((a, b) => a.price - b.price || a.ids.join("|").localeCompare(b.ids.join("|")));
      // Seed varies only among valid options within a 3% price band. It never loosens constraints.
      const best = groups[0]!, near = groups.filter(g => g.price <= best.price * 1.03);
      const chosen = r.seed ? near[Math.abs(r.seed + day) % near.length]! : best;
      chosen.ids.forEach(id => { used.add(id); const family = meals.get(id)!.originalRecipe.family_id; counts.set(family, (counts.get(family) ?? 0) + 1); });
      selection.push(chosen.ids);
    }
    const week = evaluate(selection, r);
    if (r.seed && week.violations.includes("ingredient-allocation-budget")) {
      const cheapest = plan({ ...r, seed: 0 });
      if (cheapest.week?.referenceConstraintsSatisfied) {
        const fallbackWeek = evaluate(cheapest.week.selection, r);
        return { status: "planned-reference-week" as const, eligibleMeals: eligible.length, week: fallbackWeek, unmet: fallbackWeek.violations };
      }
    }
    return { status: week.referenceConstraintsSatisfied ? "planned-reference-week" as const : "constraints-unmet" as const, eligibleMeals: eligible.length, week, unmet: week.violations };
  }
  function replace(week: ReturnType<typeof evaluate>, day: number, slot: number, recipeId: string) {
    if (week.sourceRecipesSha256 !== catalog.sourceRecipesSha256 || !Number.isInteger(day) || !Number.isInteger(slot) || day < 0 || day >= week.selection.length || slot < 0 || slot >= week.request.mealsPerDay || !meals.has(recipeId)) throw new Error("Invalid replacement");
    const selection = clone(week.selection); selection[day]![slot] = recipeId;
    const next = evaluate(selection, week.request);
    const currentId = week.selection[day]?.[slot], current = currentId ? meals.get(currentId) : undefined;
    if (!current) throw new Error("Original replacement meal unavailable");
    const before = decimal(current.nutritionPerServing.protein_g.min), after = decimal(meals.get(recipeId)!.nutritionPerServing.protein_g.min);
    const tolerance = decimal(String(Math.max(5, Math.round(approximate(before) * 0.15))));
    if (compare(distance(before, after), tolerance) > 0) {
      next.violations = [...new Set([...next.violations, "replacement-protein-tolerance"])].sort();
      next.referenceConstraintsSatisfied = false;
    }
    return next;
  }
  function replacements(week: ReturnType<typeof evaluate>, day: number, slot: number, limit = 6) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 20) throw new Error("Invalid replacement limit");
    const current = week.selection[day]?.[slot]; if (!current) throw new Error("Invalid replacement slot");
    const result = [];
    const used = new Set(week.selection.flat());
    const candidates = catalog.meals.filter(m => !used.has(m.id) && compatible(m, week.request)).sort((a, b) => Number(a.costPerServing[week.request.region].max) - Number(b.costPerServing[week.request.region].max) || a.id.localeCompare(b.id));
    for (const candidate of candidates) {
      const next = replace(week, day, slot, candidate.id);
      if (next.referenceConstraintsSatisfied) result.push({ id: candidate.id, title: candidate.originalRecipe.title, week: next });
      if (result.length >= limit) break;
    }
    return result;
  }
  return { plan, evaluate, replace, replacements, catalogInfo: { meals: catalog.meals.length, sourceRecipesSha256: catalog.sourceRecipesSha256, mode: catalog.plannerMode } };
}
