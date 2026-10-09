import {stageNative,assertSources} from "./stage.ts";
import {solveRestricted} from "./catalog-selection.ts";
import {independentArithmetic} from "./arithmetic.ts";
import {previewRequest,eligibleRecipeIds,encodePreview,decodePreview} from "./model.ts";
export function createNativeCatalog(){const s=stageNative();return Object.freeze({assertSources,
    solve(value: unknown): string {
      assertSources();
      const request = previewRequest(value), allowed = new Set(eligibleRecipeIds(request));
      const snapshot = { ...s.purchased, recipes: s.purchased.recipes.filter(r => allowed.has(r.id)), recipe_ingredients: s.purchased.recipe_ingredients.filter(r => allowed.has(r.recipe_id)), recipe_variants: s.purchased.recipe_variants.filter(r => allowed.has(r.recipe_id) && allowed.has(r.variant_recipe_id)) };
      if (!snapshot.recipes.some(r => r.meal_type === "breakfast") || !snapshot.recipes.some(r => r.meal_type !== "breakfast")) throw Error("reviewed_coverage_held");
      const out = solveRestricted({ budget: request.budget, protein_per_day: request.protein, kcal_min: request.kcalMin, kcal_max: request.kcalMax, household: request.household, diet: request.diet, pantry: [], stores: request.stores, zip: request.zip, seed: request.seed }, snapshot, request.allergies, s.basket.safety);
      const arithmetic = independentArithmetic(out, s.edible, s.basket, request.allergies);
      const raw = encodePreview(out.days.map(d => d.items.map(i => i.recipe_id)), request), model = decodePreview(raw, request);
      if (model.feasible !== arithmetic.feasible || model.totalCents !== arithmetic.total_cents) throw Error("reviewed_arithmetic_held");
      model.days.forEach((d, i) => { const a = arithmetic.days[i]; if (!a || Math.abs(d.protein - a.protein_g) > 1e-9 || Math.abs(d.kcal - a.kcal) > 1e-9) throw Error("reviewed_arithmetic_held"); });
      for (const row of model.list) { const a = arithmetic.rows.find(r => r.sku_id === row.id); if (!a || row.packs !== a.packs || row.cents !== a.cost_cents || Math.abs(row.physical - a.usedPurchased) > 1e-9 || Math.abs(row.edible - a.edible) > 1e-9) throw Error("reviewed_arithmetic_held"); }
      assertSources(); return raw;
    },
  });}
