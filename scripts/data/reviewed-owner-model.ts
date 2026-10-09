import source from "./reviewed-owner-source.json" with { type: "json" };

// Identical portable candidate bytes on both sides. No access grant, solver or storage.
export const REVIEWED_FAMILY = "wd-reviewed-owner-preview-local-candidate";
export const REVIEWED_VERSION = 1;
export const SOURCE_REVISION = source.source;
export const TOOLS = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer", "toaster", "microwave", "microwave-safe-bowl", "microwave-safe-cover", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools", "blender", "tongs", "clean-serving-plate", "raw-poultry-board", "can-opener", "saucepan-lid", "oven", "sheet-pan", "oven-mitts", "fork", "raw-seafood-board", "raw-meat-board", "nonstick-oven-safe-sheet-pan"] as const;
export const REGISTRY = "917a703327aef561278fd1cd6d12580d2789ec7c01893395b9e538ad67562678";
const allergens = ["peanuts", "tree-nuts", "dairy", "eggs", "wheat", "soy", "fish", "shellfish", "sesame"];
const excluded: Record<string, string[]> = { none: [], vegetarian: ["meat", "poultry", "fish", "shellfish"], vegan: ["meat", "poultry", "fish", "shellfish", "dairy", "eggs", "honey"], "dairy-free": ["dairy"], "gluten-free": ["gluten"] };
type PreviewDiet = "none" | "vegetarian" | "vegan" | "dairy-free" | "gluten-free";
export type PreviewRequest = { owner: string; planningRevision: number; profileRevision: number; registry: string; budget: number; protein: number; kcalMin: number; kcalMax: number; diet: PreviewDiet; allergies: string[]; household: number; stores: string[]; zip: string; seed: number; equipment: string[] };
function refuse(): never { throw Error("reviewed_preview_held"); }
export function freeze<T>(value: T): T { if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
freeze(source);
function diet(value: unknown): PreviewDiet { if (value === "none" || value === "vegetarian" || value === "vegan" || value === "dairy-free" || value === "gluten-free") return value; return refuse(); }
// Own data only, bounded and without reading getters, including nested arrays.
export function safeCopy(value: unknown): unknown {
  let budget = 12000; const seen = new Set<object>();
  const walk = (v: unknown, depth: number): unknown => {
    if (--budget < 0 || depth > 12) refuse();
    if (v === null || typeof v === "boolean" || typeof v === "string" && v.length <= 4096 || typeof v === "number" && Number.isFinite(v)) return v;
    if (!v || typeof v !== "object" || seen.has(v)) refuse();
    const array = Array.isArray(v), proto = Object.getPrototypeOf(v);
    if (array ? proto !== Array.prototype : proto !== Object.prototype && proto !== null) refuse();
    seen.add(v); const d = Object.getOwnPropertyDescriptors(v);
    let out: unknown;
    if (array) {
      const length: unknown = d.length?.value;
      if (typeof length !== "number" || !Number.isInteger(length) || length > 1000 || Reflect.ownKeys(d).length !== length + 1) refuse();
      const a: unknown[] = []; for (let i = 0; i < length; i++) { const f = d[String(i)]; if (!f || !("value" in f) || !f.enumerable) refuse(); a.push(walk(f.value, depth + 1)); } out = a;
    } else {
      const record: Record<string, unknown> = Object.create(null);
      for (const k of Reflect.ownKeys(d)) { if (typeof k !== "string" || ["__proto__", "constructor", "prototype"].includes(k)) refuse(); const f = d[k]; if (!f || !("value" in f) || !f.enumerable) refuse(); record[k] = walk(f.value, depth + 1); } out = record;
    }
    seen.delete(v); return out;
  };
  return walk(value, 0);
}
function record(v: unknown): Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) refuse(); return v as Record<string, unknown>; }
function strings(v: unknown): string[] { if (!Array.isArray(v) || v.some(x => typeof x !== "string") || new Set(v).size !== v.length) refuse(); return v as string[]; }
export function previewRequest(value: unknown): PreviewRequest {
  const v = record(safeCopy(value));
  const keys = ["owner", "planningRevision", "profileRevision", "registry", "budget", "protein", "kcalMin", "kcalMax", "diet", "allergies", "household", "stores", "zip", "seed", "equipment"];
  if (Object.keys(v).length !== keys.length || keys.some(k => !Object.hasOwn(v, k))) refuse();
  if (typeof v.owner !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.owner) || v.registry !== REGISTRY || v.zip !== source.zip || typeof v.diet !== "string" || !Object.hasOwn(excluded, v.diet)) refuse();
  for (const [key, min, max] of [["planningRevision", 0, Number.MAX_SAFE_INTEGER], ["profileRevision", 1, Number.MAX_SAFE_INTEGER], ["household", 1, 4], ["seed", 0, 4294967295]] as const) { const n = v[key]; if (typeof n !== "number" || !Number.isSafeInteger(n) || n < min || n > max) refuse(); }
  if (typeof v.budget !== "number" || v.budget < 45 || v.budget > 999 || !/^\d+(?:\.\d{1,2})?$/.test(String(v.budget)) || typeof v.protein !== "number" || v.protein < 20 || v.protein > 400 || typeof v.kcalMin !== "number" || typeof v.kcalMax !== "number" || v.kcalMin < 1300 || v.kcalMax > 3600 || v.kcalMin >= v.kcalMax) refuse();
  const allergies = strings(v.allergies), equipment = strings(v.equipment), stores = strings(v.stores);
  if (allergies.some(a => !allergens.includes(a)) || equipment.some(id => !(TOOLS as readonly string[]).includes(id)) || stores.length !== 1 || stores[0] !== source.store) refuse();
  return freeze({ owner: v.owner, planningRevision: v.planningRevision as number, profileRevision: v.profileRevision as number, registry: REGISTRY, budget: v.budget, protein: v.protein, kcalMin: v.kcalMin, kcalMax: v.kcalMax, diet: diet(v.diet), allergies, household: v.household as number, stores, zip: source.zip, seed: v.seed as number, equipment: TOOLS.filter(id => equipment.includes(id)) });
}
const skuOf = (id: string) => { const k = source.edible.skus.find(x => x.id === id); if (!k) refuse(); return k; };
const reviewOf = (id: string) => { const q = Object.entries(source.reviews.quantities).find(([key]) => key === id)?.[1]; if (!q || q.edible_per_purchased <= 0 || q.edible_per_purchased > 1) refuse(); return q; };
const rowsOf = (id: string) => source.edible.recipe_ingredients.filter(x => x.recipe_id === id);
export function methodRequirements(id: string) {
  const recipe = source.edible.recipes.find(x => x.id === id); if (!recipe) refuse();
  // Reviewable direction derivation: weighing/rinsing/simmering; washed chopped
  // vegetables; combining/serving. No alternate technique or extra ingredient.
  const tools: string[] = ["stovetop", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools"];
  if (rowsOf(id).some(r => ["eggs", "ground-beef", "ground-turkey"].includes(r.sku_id))) tools.push("nonstick-pan", "spatula", "food-thermometer");
  return { required: TOOLS.filter(t => tools.includes(t)), packageDirectionsRequired: rowsOf(id).some(r => ["frozen-edamame", "frozen-broccoli"].includes(r.sku_id)), cookingVerified: false as const };
}
export function eligibleRecipeIds(request: PreviewRequest): string[] {
  const allow = new Set(source.edible.recipes.filter(r => {
    if (!methodRequirements(r.id).required.every(t => request.equipment.includes(t))) return false;
    return rowsOf(r.id).every(row => {
      const safety = Object.entries(source.reviews.safety).find(([id]) => id === row.sku_id)?.[1];
      const allergyRows: readonly string[] | null = safety?.allergens ?? null, dietRows: readonly string[] | null = safety?.diet ?? null;
      return safety?.status === "reviewed" && allergyRows !== null && dietRows !== null && !request.allergies.some(a => allergyRows.includes(a)) && !(excluded[request.diet] ?? []).some(d => dietRows.includes(d));
    });
  }).map(r => r.id));
  for (const v of source.edible.recipe_variants) if (!allow.has(v.recipe_id)) allow.delete(v.variant_recipe_id);
  return source.edible.recipes.filter(r => allow.has(r.id)).map(r => r.id);
}
const factors: Record<string, number> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, each: 1 };
const canonical = (qty: number, unit: string) => { const f = factors[unit]; if (!f || !Number.isFinite(qty) || qty <= 0) refuse(); return qty * f; };
export function previewModel(selectionValue: unknown, requestValue: unknown) {
  const request = previewRequest(requestValue), selection = safeCopy(selectionValue);
  if (!Array.isArray(selection) || selection.length !== 5 || selection.some(d => !Array.isArray(d) || d.length !== 3 || d.some(id => typeof id !== "string"))) refuse();
  const allowed = new Set(eligibleRecipeIds(request)), used = new Map<string, number>(), shares = new Map<string, number>(), repeats = [new Map<string, number>(), new Map<string, number>(), new Map<string, number>()];
  const violations: string[] = [];
  const days = selection.map((day: unknown, index: number) => {
    if (!Array.isArray(day)) refuse();
    const meals = day.map((id: unknown, slot: number) => {
      if (typeof id !== "string" || !allowed.has(id)) refuse();
      const r = source.edible.recipes.find(x => x.id === id); if (!r || (slot === 0 ? r.meal_type !== "breakfast" : r.meal_type === "breakfast")) refuse();
      const parent = source.edible.recipe_variants.find(v => v.variant_recipe_id === id)?.recipe_id ?? id;
      const repeat = repeats[slot]; if (!repeat) refuse(); repeat.set(parent, (repeat.get(parent) ?? 0) + 1);
      let protein = 0, kcal = 0, fat = 0, carbs = 0;
      const ingredients = rowsOf(id).map(row => {
        const k = skuOf(row.sku_id), q = canonical(row.qty, row.unit) / r.servings, n = reviewOf(k.id).nutrition, grams = q * k.grams_per_unit;
        if ([n.protein_g, n.kcal, n.fat_g, n.carbs_g].some(v => typeof v !== "number" || !Number.isFinite(v) || v < 0) || n.kcal <= 0) refuse();
        protein += grams * n.protein_g / 100; kcal += grams * n.kcal / 100; fat += grams * n.fat_g / 100; carbs += grams * n.carbs_g / 100;
        used.set(k.id, (used.get(k.id) ?? 0) + q); shares.set(k.id, (shares.get(k.id) ?? 0) + grams * n.kcal / 100);
        return { id: k.id, name: k.name, sourceQty: row.qty, unit: row.unit, sourceServings: r.servings, perPerson: row.qty / r.servings, household: row.qty / r.servings * request.household, edibleCanonical: q, sourceBasis: reviewOf(k.id).source_basis };
      });
      return { id, family: parent, name: r.name, originalSteps: r.steps, authoredMinutes: r.minutes, timeMeasured: false as const, sourceServings: r.servings, ingredients, protein, kcal, fat, carbs, method: methodRequirements(id), seasoning: "No unlisted oil, sauce or seasoning is assumed." };
    });
    const sums = meals.reduce((a, m) => ({ protein: a.protein + m.protein, kcal: a.kcal + m.kcal, fat: a.fat + m.fat, carbs: a.carbs + m.carbs }), { protein: 0, kcal: 0, fat: 0, carbs: 0 });
    if (sums.protein < request.protein) violations.push("protein target"); if (sums.kcal < request.kcalMin || sums.kcal > request.kcalMax) violations.push("calorie band");
    return { day: index + 1, meals, ...sums };
  });
  const list = [...used].map(([id, q]) => {
    const k = skuOf(id), review = reviewOf(id), edible = q * request.household, physical = edible / review.edible_per_purchased, pack = canonical(k.pack_qty, k.pack_unit), packs = Math.ceil(physical / pack - 1e-6);
    const price = Object.entries(source.prices).find(([key]) => key === id)?.[1]; if (!price) refuse();
    if (k.perishable && packs * pack / physical > 1.5 + 1e-9) violations.push("perishable carryover");
    return { id, name: k.name, packLabel: k.pack_label, canonicalUnit: k.canonical_unit, edible, physical, packs, purchased: packs * pack, trim: physical - edible, carryoverPhysical: packs * pack - physical, carryoverEdibleEstimate: packs * pack * review.edible_per_purchased - edible, owned: 0, cents: packs * price.cents, packCents: price.cents, priceAsOf: price.asOf, observed: price.observed, source: review.source, sourceAccessed: review.accessed, sourceBasis: review.source_basis, yield: review.edible_per_purchased, yieldSource: review.yield_source, limits: review.limits };
  });
  const totalCents = list.reduce((n, r) => n + r.cents, 0), itemFloor = Math.round(8 + 4 * Math.min(1, Math.max(0, (request.budget - 30) / 25))), proteinFloor = request.budget < 55 ? 2 : 3;
  const proteinSources = list.filter(r => { const k = skuOf(r.id), n = reviewOf(r.id).nutrition; return n.protein_g / n.kcal >= .06 && canonical(k.pack_qty, k.pack_unit) * k.grams_per_unit * r.yield * n.protein_g / 100 >= 20; }).length;
  if (totalCents > Math.round(request.budget * 100)) violations.push("budget"); if (list.length < itemFloor) violations.push("item variety"); if (proteinSources < proteinFloor) violations.push("protein variety");
  const totalKcal = [...shares.values()].reduce((a, b) => a + b, 0), calorieShares = [...shares].map(([id, kcal]) => ({ id, fraction: kcal / totalKcal }));
  if (calorieShares.some(r => r.fraction > .35)) violations.push("ingredient calorie share");
  repeats.forEach((r, slot) => { const cap = slot === 0 ? 3 : slot === 2 ? 2 : 99; if ([...r.values()].some(n => n > cap)) violations.push("family repeat cap"); });
  return { feasible: violations.length === 0, violations: [...new Set(violations)], days, list, totalCents, itemFloor, proteinFloor, proteinSources, calorieShares, repeats: repeats.map(r => Object.fromEntries(r)), priceLabel: "Local reference estimate. Dated sources and one existing price buffer; current store availability and prices are unverified.", limits: "User-stated tools. Generic nutrients, planning yields, package directions and cross-contact limitations remain. Cooking and native device checks are unrun. Original instructions describe source servings; household amounts are shown separately and batch timing is unmeasured.", productAdmitted: false as const, cookingAdmitted: false as const };
}
export function encodePreview(selection: unknown, request: unknown): string {
  const r = previewRequest(request), model = previewModel(selection, r);
  return JSON.stringify({ family: REVIEWED_FAMILY, version: REVIEWED_VERSION, source: SOURCE_REVISION, request: r, selection: safeCopy(selection), model });
}
export function decodePreview(raw: string, expected: PreviewRequest) {
  if (typeof raw !== "string" || raw.length > 180000) refuse();
  let value: unknown; try { value = JSON.parse(raw); } catch { return refuse(); }
  const v = record(safeCopy(value));
  if (Object.keys(v).length !== 6 || v.family !== REVIEWED_FAMILY || v.version !== REVIEWED_VERSION || v.source !== SOURCE_REVISION || JSON.stringify(previewRequest(v.request)) !== JSON.stringify(previewRequest(expected))) refuse();
  if (encodePreview(v.selection, v.request) !== raw) refuse();
  return previewModel(v.selection, expected);
}
