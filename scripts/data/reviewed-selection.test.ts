import assert from "node:assert/strict";
import { test } from "node:test";
import { pricingStage } from "./store-estimate-week.ts";
import { ingredientAllowed, eligibleSnapshot } from "./ingredient-safety.ts";
import { prepareReviewedSelection, validateReviewedSelection, solveReviewedRestricted, reviewedCandidates } from "./reviewed-selection.ts";
import { templatesOf } from "../../packages/solver/src/snapshot.ts";
import { BASE } from "../../packages/solver/src/profiles.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { digest } from "./reviewed-week.ts";

test("actual approved graph retains ingredient-reviewed soy-free preparations without extra families", () => {
  const stage = pricingStage();
  const admitted = stage.purchased.recipes.filter(r => stage.purchased.recipe_ingredients.filter(i => i.recipe_id === r.id)
    .every(i => ingredientAllowed(i.sku_id, "none", ["soy"], stage.basket.safety)));
  assert.equal(admitted.length, 51);
  assert.equal(admitted.filter(r => r.meal_type === "breakfast").length, 3);
  assert.equal(eligibleSnapshot(stage.purchased, "none", ["soy"], stage.basket.safety).recipes.length, 0);
  const projection = prepareReviewedSelection(stage, "none", ["soy"]);
  const selected = projection.snapshot;
  assert.deepEqual(selected.recipes.map(r => r.id), admitted.map(r => r.id));
  const before = new Map(templatesOf(stage.purchased).map(t => [t.id, t.base_id]));
  const after = new Map(templatesOf(selected).map(t => [t.id, t.base_id]));
  for (const a of admitted) for (const b of admitted) assert.equal(before.get(a.id) === before.get(b.id), after.get(a.id) === after.get(b.id));
  assert.equal(new Set(projection.provenance.members.map(m => m.originalFamily)).size, new Set(after.values()).size);
  assert.deepEqual(projection.provenance.repeatCaps, { breakfast: 3, lunch: 99, dinner: 2 });
  for (const m of projection.provenance.members) {
    assert.equal(m.originalParent, stage.purchased.recipe_variants.find(v => v.variant_recipe_id === m.id)?.recipe_id ?? null);
    assert.ok(selected.recipes.some(r => r.id === m.representative));
    assert.ok(!selected.recipe_ingredients.some(i => i.recipe_id === m.id && i.sku_id === "frozen-edamame"));
  }
});

test("unrestricted projection is identity; related restrictions inspect every compiled addition", () => {
  const stage = pricingStage();
  assert.equal(prepareReviewedSelection(stage, "none", []).snapshot, stage.purchased);
  for (const [diet, allergies] of [["none", ["eggs"]], ["vegan", []], ["vegetarian", ["soy"]], ["gluten-free", []], ["dairy-free", ["soy"]]] as const) {
    const p = prepareReviewedSelection(stage, diet, allergies);
    for (const row of p.snapshot.recipe_ingredients) assert.ok(ingredientAllowed(row.sku_id, diet, allergies, stage.basket.safety));
    assert.ok(p.provenance.members.length <= stage.counts.eligible);
  }
  assert.throws(() => prepareReviewedSelection(stage, "none", ["unknown"]), /Unknown allergen/);
});

test("source, approval, unknown additions and malformed/cyclic/missing family inputs fail closed even self-pinned", () => {
  const initial = pricingStage();
  const mutations: ((s: typeof initial) => void)[] = [
    s => { s.basket.safety.oats.status = "unreviewed"; },
    s => { s.basket.safety.oats.allergens = null; },
    s => { s.basket.safety.oats.diet = ["unknown" as never]; },
    s => { s.basket.source_digest = "changed"; },
    s => { s.candidate_digest = "changed"; },
    s => { s.purchased.recipe_ingredients[0].sku_id = "unknown"; },
    s => { s.purchased.recipe_variants[0].recipe_id = "missing"; },
    s => { const v = s.purchased.recipe_variants[0]; s.purchased.recipe_variants.push({ ...v, recipe_id: v.variant_recipe_id, variant_recipe_id: v.recipe_id }); },
    s => { s.purchased.recipe_variants.splice(0, 1); },
    s => { s.edible.recipe_ingredients[0].qty++; },
    s => { s.compiled.variants[0].recipe_id = "tampered"; },
  ];
  for (const mutate of mutations) {
    const stage = structuredClone(initial); mutate(stage);
    assert.throws(() => prepareReviewedSelection(stage, "none", ["soy"]), /Stale or edited/);
  }
  const p = prepareReviewedSelection(initial, "none", ["soy"]);
  validateReviewedSelection(initial, p);
  p.provenance.members[0].originalFamily = "caller-family";
  p.projectionDigest = digest(p.provenance);
  assert.throws(() => validateReviewedSelection(initial, p), /Stale or edited/);
  const changedSnapshot = prepareReviewedSelection(initial, "none", ["soy"]);
  changedSnapshot.snapshot.recipe_variants.splice(0, 1);
  changedSnapshot.provenance.snapshotDigest = digest(changedSnapshot.snapshot);
  changedSnapshot.projectionDigest = digest(changedSnapshot.provenance);
  assert.throws(() => validateReviewedSelection(initial, changedSnapshot), /Stale or edited/);
});

test("original caps deny repeated surviving variants and projected parents cannot widen swap identity", () => {
  const stage = pricingStage(), selected = solveReviewedRestricted({ ...BASE, seed: 7 }, stage, ["soy"]);
  const ids = selected.out.days.flatMap(d => d.items.map(i => i.recipe_id));
  const breakfast = selected.snapshot.recipes.find(r => r.meal_type === "breakfast")!.id;
  for (let day = 0; day < 5; day++) ids[day * 3] = breakfast;
  const repeated = evaluateWeek(ids, selected.out.input, selected.snapshot);
  assert.equal(repeated.feasible, false);
  assert.ok(repeated.why?.some(w => w.includes("breakfast")));
  const family = selected.provenance.members.filter(m => m.originalParent && selected.snapshot.recipes.find(r => r.id === m.id)!.meal_type !== "breakfast");
  const first = family[0], sibling = family.find(m => m.originalFamily === first.originalFamily && m.id !== first.id)!;
  const dinnerIds = selected.out.days.flatMap(d => d.items.map(i => i.recipe_id));
  [first.id, sibling.id, first.id].forEach((id, day) => { dinnerIds[day * 3 + 2] = id; });
  const dinner = evaluateWeek(dinnerIds, selected.out.input, selected.snapshot);
  assert.ok(dinner.why?.some(w => w.includes("dinner")));
  assert.deepEqual(dinner, evaluateWeek(dinnerIds, selected.out.input, stage.purchased));
  for (const c of reviewedCandidates(selected.out, 1, stage, ["soy"])) {
    const replacement = selected.out.days.flatMap(d => d.items.map(i => i.recipe_id)); replacement[1] = c.recipe_id;
    if (selected.out.feasible) assert.equal(evaluateWeek(replacement, selected.out.input, selected.snapshot).feasible, true);
  }
});
