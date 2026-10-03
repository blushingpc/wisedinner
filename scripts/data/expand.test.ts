import assert from "node:assert/strict";
import { test } from "node:test";
import { expandRecipes } from "./expand.ts";
import { RECIPES } from "./authored/recipes.ts";
import { VARIANT_DIRECTIONS } from "./authored/variant-steps.ts";
import { loadSnapshot } from "../../packages/solver/test/helpers.ts";

test("every authored variant has its own directions rather than inheriting the base", () => {
  const result = expandRecipes(RECIPES);
  for (const base of RECIPES) for (const variant of base.variants) {
    assert.ok((variant.steps ?? VARIANT_DIRECTIONS[variant.id]?.steps)?.length, variant.id);
    assert.notEqual(result.recipes.find((recipe) => recipe.id === variant.id)!.steps, base.steps);
  }
});

test("new variants without explicit directions fail compilation", () => {
  const base = structuredClone(RECIPES[0]);
  base.variants = [{ ...base.variants[0], id: "unreviewed-parfait", steps: undefined }];
  assert.throws(() => expandRecipes([base]), /explicit variant directions/);
});

test("plant parfait uses its actual protein and cereal and the lentils are cooked, not browned raw", () => {
  const { recipes } = expandRecipes(RECIPES);
  const parfait = recipes.find((recipe) => recipe.id === "greek-yogurt-parfait-with-berries-and-granola-plant")!;
  assert.match(parfait.steps.join(" "), /pea protein/);
  assert.match(parfait.steps.join(" "), /oats/);
  assert.doesNotMatch(parfait.steps.join(" "), /whey|granola/);
  const lentil = recipes.find((recipe) => recipe.id === "turkey-taco-bowl-lentil")!;
  assert.match(lentil.steps.join(" "), /cook the lentils/i);
  assert.equal(lentil.minutes, 35);
});

test("compiled instruction map contains no orphan IDs and explicit overrides win", () => {
  const variants = new Set(RECIPES.flatMap((recipe) => recipe.variants.map((variant) => variant.id)));
  for (const id of Object.keys(VARIANT_DIRECTIONS)) assert.ok(variants.has(id), id);
  const base = structuredClone(RECIPES[0]);
  base.variants[0].steps = ["Use the supplied reviewed instructions."];
  assert.deepEqual(expandRecipes([base]).recipes.find((recipe) => recipe.id === base.variants[0].id)!.steps, base.variants[0].steps);
});

test("committed draft recipes and directions match the authored compiler output", () => {
  const snapshot = loadSnapshot();
  const compiled = expandRecipes(RECIPES);
  assert.deepEqual(snapshot.recipes, compiled.recipes);
  assert.deepEqual(snapshot.recipe_ingredients, compiled.ingredients);
  assert.deepEqual(snapshot.recipe_variants, compiled.variants);
});
