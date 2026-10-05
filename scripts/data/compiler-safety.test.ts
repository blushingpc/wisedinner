import assert from "node:assert/strict";
import { test } from "node:test";
import { expandRecipes } from "./expand.ts";
import { RECIPES } from "./authored/recipes.ts";

test("compiler rejects unknown ingredients, bad quantities, incompatible units and missing steps", () => {
  for (const change of [
    (r: typeof RECIPES[number]) => { r.ingredients[0][0] = "invented"; },
    (r: typeof RECIPES[number]) => { r.ingredients[0][1] = -1; },
    (r: typeof RECIPES[number]) => { r.ingredients[0][1] = NaN; },
    (r: typeof RECIPES[number]) => { r.ingredients[0][2] = "ml"; },
    (r: typeof RECIPES[number]) => { r.steps = []; },
    (r: typeof RECIPES[number]) => { r.minutes = 0; },
  ]) {
    const recipe = structuredClone(RECIPES[0]); recipe.variants = []; change(recipe);
    assert.throws(() => expandRecipes([recipe]));
  }
});
