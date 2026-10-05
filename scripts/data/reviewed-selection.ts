// PRIVATE offline reviewed-catalog seam. Never a public Snapshot or app import.
import type { Diet, Snapshot, SolveInput, SolveOutput } from "../../packages/solver/src/types.ts";
import { templatesOf, validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { swapCandidates } from "../../packages/solver/src/swaps.ts";
import { ingredientAllowed } from "./ingredient-safety.ts";
import { digest, stageReviewed } from "./reviewed-week.ts";
import { overnightBasket } from "./overnight-food.ts";
import { plantApproval, plantCandidates } from "./overnight-plant.ts";
import { shortlistCatalog, solveBounded, POOL_LIMIT } from "./catalog-pool.ts";

type Stage = ReturnType<typeof stageReviewed>;
// Versioned internal acceptance pins. New approval/source/family graphs require a separately reviewed revision.
const INPUT_PINS = {
  source: "ff686106f0cdbf67195cb796f9eec3a96366256f76b2e65da87fccc29cb1dd3f",
  candidate: "9c42a18abf690372fe5ab06516af952b7e96dcee2817872ac6e23b1e0d0e0ba8",
  catalog: "103d22c976376de3e6cb68b634bb0c61c8060caa8800c6e60c1d7c45a070e594",
  purchase: "bfaaeaa6153b642f49a6cab2af3e074901ae6b11374bb39052cd319f9ad07484",
  family: "bc8271fd8dc38f85851df85d2f865ce6e7048ae5b8c289d716a4219e7c60cdf6",
  approval: "38f50a19f4badfcac3e7756da52bbd569eae9f046734a6cf61d8ffc7d37d5462",
};
function trustedStage(stage: Stage) {
  const approval = plantApproval();
  const current = stageReviewed(approval, overnightBasket(), plantCandidates());
  // No caller-provided family/source/approval mapping is authority, even if self-hashed.
  for (const key of ["edible", "purchased", "basket", "compiled", "candidate_digest"] as const) {
    if (digest(stage[key]) !== digest(current[key])) throw new Error("Stale or edited reviewed selection input");
  }
  const actualPins = { source: current.basket.source_digest, candidate: current.candidate_digest, catalog: digest(current.edible),
    purchase: digest(current.purchased), family: digest(current.purchased.recipe_variants), approval: digest(approval) };
  if (digest(actualPins) !== digest(INPUT_PINS)) throw new Error("Reviewed selection acceptance pins changed; new review required");
  return digest(approval);
}

function originalFamilies(snapshot: Snapshot) {
  validateSnapshot(snapshot);
  const recipes = new Map(snapshot.recipes.map(r => [r.id, r]));
  const parents = new Map<string, Snapshot["recipe_variants"][number]>();
  for (const link of snapshot.recipe_variants) {
    if (parents.has(link.variant_recipe_id) || link.recipe_id === link.variant_recipe_id) throw new Error("Ambiguous recipe family");
    parents.set(link.variant_recipe_id, link);
  }
  // The current solver counts immediate parents, not transitive roots. Require its exact star graph.
  for (const link of parents.values()) {
    if (parents.has(link.recipe_id) || recipes.get(link.recipe_id)!.meal_type !== recipes.get(link.variant_recipe_id)!.meal_type) throw new Error("Non-star or mixed-slot recipe family");
  }
  return parents;
}

export function prepareReviewedSelection(stage: Stage, diet: Diet, allergies: readonly string[]) {
  const approvalDigest = trustedStage(stage);
  ingredientAllowed("", diet, allergies, stage.basket.safety); // validates even an empty result
  const original = stage.purchased, parents = originalFamilies(original);
  const allowed = original.recipes.filter(r => {
    const rows = original.recipe_ingredients.filter(i => i.recipe_id === r.id);
    return rows.length > 0 && rows.every(i => ingredientAllowed(i.sku_id, diet, allergies, stage.basket.safety));
  });
  const ids = new Set(allowed.map(r => r.id));
  const representatives = new Map<string, string>();
  for (const recipe of allowed) {
    const family = parents.get(recipe.id)?.recipe_id ?? recipe.id;
    if (!representatives.has(family)) representatives.set(family, ids.has(family) ? family : recipe.id);
  }
  const members = allowed.map(recipe => {
    const link = parents.get(recipe.id), originalFamily = link?.recipe_id ?? recipe.id;
    return { id: recipe.id, originalFamily, originalParent: link?.recipe_id ?? null, originalKind: link?.kind ?? null,
      representative: representatives.get(originalFamily)! };
  });
  const unrestricted = diet === "none" && allergies.length === 0;
  const snapshot = unrestricted ? original : validateSnapshot({ ...original, recipes: allowed,
    recipe_ingredients: original.recipe_ingredients.filter(i => ids.has(i.recipe_id)),
    recipe_variants: members.filter(m => m.id !== m.representative).map(m => ({
      recipe_id: m.representative, variant_recipe_id: m.id, kind: m.originalKind!,
    })),
  });
  // Bijective mapping of nonempty original families onto projected families proves equality for ANY selected multiset.
  // Caps and every non-family row remain the existing solver's responsibility; there is no extra capacity.
  const actual = new Map(templatesOf(snapshot).map(t => [t.id, t.base_id]));
  for (const a of members) for (const b of members) {
    if ((a.originalFamily === b.originalFamily) !== (actual.get(a.id) === actual.get(b.id))) throw new Error("Repeat family partition changed");
  }
  for (const m of members) if (actual.get(m.id) !== m.representative) throw new Error("Family representative mismatch");
  const provenance = { schemaVersion: 1, private: true, inputPinsDigest: digest(INPUT_PINS), catalogDigest: digest(stage.edible), purchaseDigest: digest(original),
    sourceDigest: stage.basket.source_digest, candidateDigest: stage.candidate_digest, approvalDigest,
    originalFamilyDigest: digest(original.recipe_variants), diet, allergies: [...allergies].sort(),
    poolCap: POOL_LIMIT, repeatCaps: { breakfast: 3, lunch: 99, dinner: 2 }, members, snapshotDigest: digest(snapshot) };
  return { snapshot, provenance, projectionDigest: digest(provenance) };
}
export function validateReviewedSelection(stage: Stage, selection: ReturnType<typeof prepareReviewedSelection>) {
  const current = prepareReviewedSelection(stage, selection.provenance.diet, selection.provenance.allergies);
  if (digest(current) !== digest(selection)) throw new Error("Stale or edited private family projection");
}
export function solveReviewedRestricted(input: SolveInput, stage: Stage, allergies: readonly string[] = []) {
  const selection = prepareReviewedSelection(stage, input.diet, allergies);
  if (!selection.snapshot.recipes.some(r => r.meal_type === "breakfast") || !selection.snapshot.recipes.some(r => r.meal_type !== "breakfast")) throw new Error("Not enough reviewed recipes for these restrictions");
  const bounded = solveBounded(input, selection.snapshot);
  return { ...selection, searchedSnapshot: bounded.snapshot, out: bounded.out };
}
export function reviewedCandidates(week: SolveOutput, slot: number, stage: Stage, allergies: readonly string[] = []) {
  const selection = prepareReviewedSelection(stage, week.input.diet, allergies);
  const ids = week.days.flatMap(d => d.items.map(i => i.recipe_id));
  evaluateWeek(ids, week.input, selection.snapshot);
  const bounded = shortlistCatalog(selection.snapshot, week.input, ids);
  const original = new Map(stage.purchased.recipe_variants.map(v => [v.variant_recipe_id, v]));
  const current = ids[slot], originalFamily = original.get(current)?.recipe_id ?? current;
  return swapCandidates(week, slot, bounded).map(candidate => {
    // Projected representatives are NOT authored parents. Preserve only actual original variant relations.
    const { variantOf: _projectedRelation, ...plain } = candidate;
    void _projectedRelation;
    const relation = stage.purchased.recipe_variants.find(v =>
      (v.recipe_id === originalFamily && v.variant_recipe_id === candidate.recipe_id) ||
      (v.variant_recipe_id === current && v.recipe_id === candidate.recipe_id));
    return { ...plain, ...(relation ? { variantOf: { recipe_id: current, kind: relation.kind } } : {}) };
  });
}
