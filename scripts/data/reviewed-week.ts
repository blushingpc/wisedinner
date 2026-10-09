// Private reviewed-only staging. Never publish the purchase-equivalent solver projection.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { SKUS } from "./authored/skus.ts";
import { toSku } from "./expand.ts";
import { loadUsdaMap } from "./usda.ts";
import { reviewNutrition, sourceMacros } from "./catalog-review.ts";
import type { SourceFood } from "./catalog-evidence.ts";
import { SAFETY, type SafetyTable } from "./ingredient-safety.ts";
import { directions, compileCandidate, compileApproved, candidateDigest, candidateIdentity, type Candidate } from "./catalog-expansion.ts";
import type { Ing } from "./authored/types.ts";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import { packCanonical, toCanonical } from "../../packages/solver/src/units.ts";
import type { Nutrition, Snapshot } from "../../packages/solver/src/types.ts";

export const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
export const FBG = "https://foodbuyingguide.fns.usda.gov/files/Reports/USDA_FBG_Section2_VegetablesYieldTable.pdf";
export const OATS_LABEL = "https://www.kroger.com/p/kroger-old-fashioned-oats/0001111076655";
export type QuantityReview = {
  sku_id: string; source: string; identity: string; accessed: string;
  source_basis: "raw-edible" | "dry" | "frozen-edible" | "piece-edible";
  edible_per_purchased: number; yield_source: string; yield_row: string; limits: string;
  nutrition: Nutrition;
  purchase_basis?: string;
};
export type ReviewBundle = { quantities: Record<string, QuantityReview>; safety: SafetyTable; input_digest: string; source_digest: string; blocked: string[] };
const purchaseBasis = (s: Snapshot["skus"][number]) => digest([s.id, s.pack_qty, s.pack_unit, s.pack_label, s.canonical_unit, s.grams_per_unit]);
export function labelNutrition(sku_id: string, label: { serving_g: number; protein_g: number; kcal: number; fat_g: number; carbs_g: number }): Nutrition {
  if (!Number.isFinite(label.serving_g) || label.serving_g <= 0 || [label.protein_g,label.kcal,label.fat_g,label.carbs_g].some(n=>!Number.isFinite(n)||n<0) || label.kcal<=0) throw new Error("Original label serving/nutrients unavailable");
  const scale=100/label.serving_g;
  return {sku_id,per:"100g",protein_g:label.protein_g*scale,kcal:label.kcal*scale,fat_g:label.fat_g*scale,carbs_g:label.carbs_g*scale};
}

export function reviewedBasket(): ReviewBundle {
  const map = loadUsdaMap();
  const prior: SourceFood[] = JSON.parse(readFileSync("docs/ingredient-catalog/usda-evidence.json", "utf8")).foods;
  const fresh: SourceFood[] = JSON.parse(readFileSync("docs/ingredient-catalog/reviewed-week-sources.json", "utf8")).foods;
  const labels = JSON.parse(readFileSync("docs/ingredient-catalog/reviewed-week-labels.json", "utf8"));
  const quantities: ReviewBundle["quantities"] = {};
  for (const review of reviewNutrition(map, prior).filter(r => r.status === "generic-reviewed")) {
    // The source is correct, but a variable-weight fresh pack cannot be claimed as a fixed purchasable 3 lb offer.
    if (review.sku_id === "chicken-breast") continue;
    const entry = map[review.sku_id];
    if (!entry) throw new Error(`${review.sku_id}: cached nutrient source unavailable`);
    quantities[review.sku_id] = { sku_id: review.sku_id, source: review.source!, identity: review.description,
      accessed: review.accessed!, source_basis: review.sku_id === "eggs" ? "piece-edible" : ["lentils", "white-rice", "brown-rice", "quinoa"].includes(review.sku_id) ? "dry" : review.sku_id.startsWith("frozen-") ? "frozen-edible" : "raw-edible",
      edible_per_purchased: 1, yield_source: review.source!, yield_row: review.basis, limits: "Previously reviewed plain food, unchanged raw pack basis; retain juices. Egg count buys whole eggs, 50 g edible contents each, not shell mass.",
      nutrition: { sku_id: review.sku_id, per: "100g", protein_g: entry.protein_g, kcal: entry.kcal, fat_g: entry.fat_g, carbs_g: entry.carbs_g } };
  }
  const rows: [string, number, number, string][] = [
    ["onions", 170000, .88, "Printed page 2-34: mature fresh whole, all sizes, raw chopped; 1 lb AP = 0.88 lb ready-to-serve/cook raw onion."],
    ["carrots", 170393, .83, "Printed page 2-22: fresh without tops, raw chopped; 1 lb AP = 0.83 lb trimmed peeled carrots."],
    ["tomatoes", 170457, .87, "Printed page 2-52: fresh whole all sizes, diced raw; 1 lb AP = 0.87 lb ready-to-serve diced raw tomato."],
  ];
  for (const [sku_id, fdc, yieldValue, yield_row] of rows) {
    const food = fresh.find(f => f.fdcId === fdc);
    const entry = map[sku_id];
    if (!entry || !food || food.description !== entry.description || food.dataType !== "SR Legacy") throw new Error(`${sku_id}: source identity unavailable`);
    const macros = sourceMacros(food);
    if (Object.values(macros).some(n => n === undefined || !Number.isFinite(n) || n < 0)) throw new Error(`${sku_id}: original nutrient missing`);
    quantities[sku_id] = { sku_id, source: food.url, identity: food.description, accessed: food.accessed,
      source_basis: "raw-edible", edible_per_purchased: yieldValue, yield_source: FBG, yield_row,
      limits: "Generic USDA reference and FBG planning estimate, not measured package yield. Weigh after peel/trim before cooking, retain juices. No cooked yield or water gain applied. Roma uses the generic ripe red tomato reference, not branded precision.",
      nutrition: { sku_id, per: "100g", ...macros } as Nutrition };
  }
  // Original brand-owner label matches the existing observed UPC and 42 oz pack. Source label is rounded, not laboratory precision.
  const productMap = JSON.parse(readFileSync("data/kroger-map.json", "utf8"));
  if (productMap.oats.productId !== "0001111076655" || productMap.oats.size !== "42 oz" || labels.oats.upc !== "0001111076655" || labels.oats.pack !== "42 oz" || digest(labels.oats.ingredients)!==digest(["Whole Grain Rolled Oats"])) throw new Error("Oats label review is stale");
  quantities.oats = { sku_id: "oats", source: OATS_LABEL, identity: "Kroger 100% Whole Grain Old Fashioned Oats, UPC 0001111076655, 42 oz; Whole Grain Rolled Oats.",
    accessed: "2026-10-04", source_basis: "dry", edible_per_purchased: 1, yield_source: OATS_LABEL,
    yield_row: "40 g uncooked serving: 150 kcal, 5 g protein, 2.5 g fat, 27 g carbohydrate. Each value multiplied by 100/40 = 2.5. Whole dry pack usable; water does not add nutrients.",
    limits: "Original online label, rounding retained. Actual package can differ; cross-contact unverified. NOT certified gluten-free. No newly fetched price used.",
    nutrition: labelNutrition("oats",labels.oats) };
  const safety = structuredClone(SAFETY);
  const oatsSafety = safety.oats;
  if (!oatsSafety) throw new Error("Oats safety source unavailable");
  safety.oats = { ...oatsSafety, status: "reviewed", allergens: [], diet: ["gluten"], known_allergens: [], known_diet: ["gluten"], sources: [OATS_LABEL], reviewed_at: "2026-10-04",
    basis: "Original mapped label has only rolled oats and declares oats. No nine-major-allergen ingredient; conservative gluten exclusion retained. Not package cross-contact clearance." };
  for (const [id, r] of Object.entries(quantities)) r.purchase_basis = purchaseBasis(toSku(SKUS.find(s => s.id === id)!));
  const referenceSnapshot = JSON.parse(readFileSync("data/snapshot.json", "utf8"));
  const input_digest = digest({ skus: SKUS, map, prior, fresh, productMap, labels, referenceSnapshot, price_rules: OBSERVED_OFFERS });
  const source_digest = digest({ quantities, safety, input_digest });
  return { quantities, safety, input_digest, source_digest, blocked: SKUS.filter(s => !quantities[s.id]).map(s => s.id) };
}

// Internal staging accepts only unchanged, identity/size-matched historical observations.
// Rejected rows stay in the public snapshot and report. Existing baseline × index estimation handles them;
// no product is rebound and no newly browsed price is imported. This is not a public local-price policy.
export const OBSERVED_OFFERS: Record<string, [string, string]> = {
  oats: ["0001111076655", "42 oz"], onions: ["0001111091682", "3 lb"], tomatoes: ["0000000004087", "1 lb"],
  "brown-rice": ["0001111089874", "32 oz"], "frozen-broccoli": ["0001111012883", "12 oz"],
};
export function priceEvidence(old: Snapshot, used: Set<string>) {
  const map = JSON.parse(readFileSync("data/kroger-map.json", "utf8"));
  const kept: Snapshot["store_prices"] = [], excluded: { sku_id: string; reason: string; mapped: unknown; observations: Snapshot["store_prices"] }[] = [];
  for (const id of used) {
    const expected = OBSERVED_OFFERS[id];
    const observations = old.store_prices.filter(p => p.sku_id === id);
    if (expected && map[id]?.productId === expected[0] && map[id]?.size === expected[1]) kept.push(...observations.filter(p => p.store_id === "kroger"));
    else excluded.push({ sku_id: id, mapped: map[id], observations,
      reason: "Observed pack size/form does not establish this authored purchasable pack, or original ingredient/form review unavailable. Use unchanged authored baseline reference estimate, not this observation." });
  }
  return { kept, excluded, note: "Reference pack estimates, not local purchase verification. Original public observations, identities, exact cents and dates preserved. Existing solver baseline fallback and buffer unchanged." };
}

export function projectPurchased(edible: Snapshot, reviews: Record<string, QuantityReview>): Snapshot {
  for (const sku of edible.skus) {
    const r = reviews[sku.id];
    if (!r || r.sku_id !== sku.id || !r.source || !r.yield_source || !r.yield_row || !Number.isFinite(r.edible_per_purchased) || r.edible_per_purchased <= 0 || r.edible_per_purchased > 1) throw new Error(`${sku.id}: quantity review unavailable`);
    if (r.purchase_basis !== purchaseBasis(sku)) throw new Error(`${sku.id}: purchase basis changed; review stale`);
    const n = edible.nutrition.find(n => n.sku_id === sku.id);
    if (!n || digest(n) !== digest(r.nutrition) || [n.protein_g,n.kcal,n.fat_g,n.carbs_g].some(v => !Number.isFinite(v) || v < 0)) throw new Error(`${sku.id}: original source nutrients missing or stale`);
    if (sku.canonical_unit !== "g" && r.edible_per_purchased !== 1) throw new Error(`${sku.id}: piece/density yield needs separate review`);
  }
  return validateSnapshot({ ...edible,
    // Physical pack labels, quantity, density and prices are NOT changed. This nutrient projection is private purchase-equivalent accounting, NOT edible per-100-g data.
    nutrition: edible.nutrition.map(n => { const review = reviews[n.sku_id]; if (!review) throw new Error(`${n.sku_id}: quantity review unavailable`); const y = review.edible_per_purchased; return { ...n, protein_g: n.protein_g*y, kcal: n.kcal*y, fat_g: n.fat_g*y, carbs_g: n.carbs_g*y }; }),
    recipe_ingredients: edible.recipe_ingredients.map(i => { const review = reviews[i.sku_id]; if (!review) throw new Error(`${i.sku_id}: quantity review unavailable`); return { ...i, qty: i.qty / review.edible_per_purchased }; }),
  });
}

export function targetedCandidates(): Candidate[] {
  const out: Candidate[] = [];
  const add = (proteins: Ing[], grain: string, vegetables: Ing[], method: Candidate["method"], breakfast = false) => {
    const parts: Candidate["parts"] = [...proteins.map(row => ({ row, role: "protein" as const })), { row: [grain, 80, "g"], role: "grain" }, ...vegetables.map(row => ({ row, role: "vegetable" as const }))];
    const id = `reviewed-${proteins.map(r => r[0]).join("-")}-${grain}-${vegetables.map(r => r[0]).join("-")}-${method}`;
    const name = `${proteins.map(r => r[0].replace("frozen-", "").replaceAll("-", " ")).join(" and ")} with ${grain.replaceAll("-", " ")} and ${vegetables.map(r => r[0].replace("frozen-", "")).join(" and ")} ${method}`;
    const first = name[0];
    if (!first) throw new Error("Candidate name unavailable");
    const c: Candidate = { method, parts, photo: null, quantity_basis: "reviewed-edible", recipe: { id, name: first.toUpperCase()+name.slice(1), meal_type: breakfast ? "breakfast" : method === "soup" ? "lunch" : "dinner", protein: proteins.map(r => r[0]).join(" and "), minutes: grain === "brown-rice" ? 55 : 45, ingredients: parts.map(p => p.row), steps: directions(parts, method, true), variants: [] } };
    compileCandidate(c); out.push(c);
  };
  const vegetables: Ing[][] = [[["carrots",120,"g"],["onions",80,"g"]], [["tomatoes",160,"g"],["onions",80,"g"]], [["frozen-broccoli",150,"g"],["carrots",100,"g"]]];
  const breakfast: Ing[][] = [[["lentils",80,"g"],["frozen-edamame",150,"g"]], [["eggs",3,"each"],["lentils",60,"g"]], [["eggs",3,"each"],["frozen-edamame",150,"g"]]];
  for (const veg of vegetables) for (const protein of breakfast) add(protein, "oats", veg, "bowl", true);
  const mains: Ing[][] = [[["lentils",90,"g"],["frozen-edamame",180,"g"]], [["chicken-breast",180,"g"],["lentils",60,"g"]], [["ground-turkey",180,"g"],["lentils",60,"g"]], [["ground-beef",160,"g"],["lentils",60,"g"]]];
  for (const grain of ["white-rice", "brown-rice", "quinoa"]) for (const veg of vegetables) for (const protein of mains) for (const method of ["bowl", "soup"] as const) add(protein, grain, veg, method);
  return out;
}
export type WeekApproval = { candidate_digest: string; source_digest: string; recipe_ids: string[]; reviewed_at: string; basis: string };
export function stageReviewed(approval?: WeekApproval, basket = reviewedBasket(), candidates = targetedCandidates()) {
  const cd = candidateDigest(candidates);
  if (basket.source_digest !== digest({ quantities: basket.quantities, safety: basket.safety, input_digest: basket.input_digest })) throw new Error("Review bundle stale: quantity or metadata changed");
  if (approval && (approval.source_digest !== basket.source_digest || approval.candidate_digest !== cd)) throw new Error("Reviewed-week approval stale: source, quantity, safety or preparation changed");
  if (approval && (new Set(approval.recipe_ids).size !== approval.recipe_ids.length || approval.recipe_ids.some(id => !candidates.some(c => c.recipe.id === id)))) throw new Error("Approval IDs must be unique and present");
  const seen = new Set<string>();
  let validated = 0, reviewReady = 0;
  const eligible: Candidate[] = [], quarantine: { id: string; reasons: string[] }[] = [];
  for (const c of candidates) {
    const reasons: string[] = [];
    const identity = candidateIdentity(c);
    if (seen.has(identity)) reasons.push("Duplicate preparation");
    else { seen.add(identity); try { compileCandidate(c); validated++; } catch (e) { reasons.push((e as Error).message); } }
    for (const [id] of c.recipe.ingredients) {
      if (!basket.quantities[id]) reasons.push(`${id}: nutrition/quantity unresolved`);
      const safety = basket.safety[id];
      if (!safety || safety.status !== "reviewed" || !safety.allergens || !safety.diet) reasons.push(`${id}: safety unresolved`);
    }
    if (!reasons.length) reviewReady++;
    if (!approval?.recipe_ids.includes(c.recipe.id)) reasons.push("Explicit approval absent");
    if (reasons.length) quarantine.push({ id: c.recipe.id, reasons }); else eligible.push(c);
  }
  const compiled = compileApproved(eligible);
  const old: Snapshot = JSON.parse(readFileSync("data/snapshot.json", "utf8"));
  const used = new Set(compiled.ingredients.map(i => i.sku_id));
  const priceReview = priceEvidence(old, used);
  const edible = validateSnapshot({ version: old.version, generated_at: old.generated_at, stores: old.stores,
    skus: SKUS.filter(s => used.has(s.id)).map(toSku).map(s => s.id === "oats" ? { ...s, diet_flags: s.diet_flags.filter(d => d !== "gluten-free") } : s),
    store_prices: priceReview.kept, nutrition: [...used].map(id => { const review = basket.quantities[id]; if (!review) throw new Error(`${id}: quantity review unavailable`); return review.nutrition; }),
    recipes: compiled.recipes, recipe_ingredients: compiled.ingredients, recipe_variants: compiled.variants });
  return { counts: { generated: candidates.length, unique: seen.size, validated, reviewReady, eligible: eligible.length, quarantined: quarantine.length }, quarantine, edible, purchased: projectPurchased(edible, basket.quantities), compiled, basket, priceReview, candidate_digest: cd };
}

export function purchaseArithmetic(sku: Snapshot["skus"][number], edibleCanonical: number, household: number, review: QuantityReview) {
  if (!Number.isFinite(edibleCanonical) || edibleCanonical <= 0 || !Number.isInteger(household) || household <= 0) throw new Error("Invalid serving/household");
  const y = review.edible_per_purchased;
  if (!Number.isFinite(y) || y <= 0 || y > 1) throw new Error("Unavailable edible yield");
  const edible = edibleCanonical * household, usedPurchased = edible/y, pack = packCanonical(sku);
  const packs = Math.ceil(usedPurchased/pack-1e-6), purchased = packs*pack;
  return { canonical_unit: sku.canonical_unit, packs, purchased, usedPurchased, edible, usableEdibleCapacity: purchased*y,
    preparationRefuse: y === 1 ? 0 : usedPurchased-edible, unpreparedCarryover: purchased-usedPurchased, edibleCarryoverEstimate: purchased*y-edible };
}

export function canonicalRow(row: Snapshot["recipe_ingredients"][number], snapshot: Snapshot) {
  return toCanonical(row.qty, row.unit, snapshot.skus.find(s => s.id === row.sku_id)!);
}
