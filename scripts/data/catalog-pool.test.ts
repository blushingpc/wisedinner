import assert from "node:assert/strict";
import { test } from "node:test";
import { loadSnapshot } from "../../packages/solver/test/helpers.ts";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import { PROFILES } from "../../packages/solver/src/profiles.ts";
import { solve } from "../../packages/solver/src/engine.ts";
import { POOL_LIMIT, shortlistCatalog, solveBounded } from "./catalog-pool.ts";
import { checkHardConstraints, outputDigest } from "./catalog-benchmark.ts";

const snapshot = loadSnapshot();
// Stress copies are synthetic and never enter recipe counts or approval manifests.
function stressSnapshot() {
  const copy = structuredClone(snapshot);
  for (let n = 0; n < 10; n++) for (const recipe of snapshot.recipes) {
    const id = `stress-${n}-${recipe.id}`;
    copy.recipes.push({ ...recipe, id });
    copy.recipe_ingredients.push(...snapshot.recipe_ingredients.filter(i => i.recipe_id === recipe.id).map(i => ({ ...i, recipe_id: id })));
    // Keep the ORIGINAL repeat group, not hundreds of synthetic independent bases.
    const parent = snapshot.recipe_variants.find(v => v.variant_recipe_id === recipe.id)?.recipe_id ?? recipe.id;
    copy.recipe_variants.push({ recipe_id: parent, variant_recipe_id: id, kind: "protein_swap" });
  }
  return validateSnapshot(copy);
}
test("small catalogs preserve the exact old path, anchors preserve family links and bounded size", () => {
  const input = PROFILES[0][1];
  assert.equal(shortlistCatalog(snapshot, input), snapshot);
  const large = stressSnapshot();
  const anchors = snapshot.recipes.map(r => r.id);
  const selected = shortlistCatalog(large, input, anchors);
  validateSnapshot(selected);
  assert.equal(selected.recipes.length, POOL_LIMIT);
  for (const id of anchors) assert.ok(selected.recipes.some(r => r.id === id));
  for (const v of selected.recipe_variants) assert.ok(selected.recipes.some(r => r.id === v.recipe_id));
  assert.deepEqual(shortlistCatalog(large, input, anchors), selected);
  assert.throws(() => shortlistCatalog(large, input, anchors, 20), /capacity/);
});
test("six profiles retain old outputs on small catalog and constraints on large bounded pools", () => {
  const large = stressSnapshot();
  for (const [, profile] of PROFILES) {
    const input = { ...profile, seed: 7 };
    assert.equal(outputDigest(solveBounded(input, snapshot).out), outputDigest(solve(input, snapshot)));
    const bounded = solveBounded(input, large, snapshot.recipes.map(r => r.id));
    assert.ok(bounded.snapshot.recipes.length <= POOL_LIMIT);
    checkHardConstraints(bounded.out, bounded.snapshot);
    assert.equal(outputDigest(bounded.out), outputDigest(solveBounded(input, large, snapshot.recipes.map(r => r.id)).out));
  }
});
