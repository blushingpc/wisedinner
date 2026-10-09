import {createNativeCatalog} from "./catalog.ts";
import {decodeInventoryPlan,encodeInventoryPlan,replacementPlan} from "./inventory-model.ts";
import {eligibleRecipeIds} from "./model.ts";
import {stageNative} from "./stage.ts";
import {restrictedCandidates} from "./catalog-selection.ts";
import {evaluateWeek} from "./core/engine.ts";
import {independentArithmetic} from "./arithmetic.ts";
export function createNativeReroll(){const catalog=createNativeCatalog(),checkSources=catalog.assertSources,stage=stageNative();
  return Object.freeze({
    replace(beforeRaw: string, slot: unknown): string | null {
      checkSources(); if (typeof slot !== "number" || !Number.isInteger(slot) || slot < 0 || slot > 14) throw Error("reviewed_replacement_held");
      const before = decodeInventoryPlan(beforeRaw), r = before.request, allowed = new Set(eligibleRecipeIds(r));
      const snapshot = { ...stage.purchased, recipes: stage.purchased.recipes.filter(v => allowed.has(v.id)), recipe_ingredients: stage.purchased.recipe_ingredients.filter(v => allowed.has(v.recipe_id)), recipe_variants: stage.purchased.recipe_variants.filter(v => allowed.has(v.recipe_id) && allowed.has(v.variant_recipe_id)) };
      const ids = before.model.days.flatMap(d => d.meals.map(m => m.id)), input = { budget: r.budget, protein_per_day: r.protein, kcal_min: r.kcalMin, kcal_max: r.kcalMax, household: r.household, diet: r.diet, pantry: [], stores: r.stores, zip: r.zip, seed: r.seed };
      const week = evaluateWeek(ids, input, snapshot), candidates = restrictedCandidates(week, slot, snapshot, r.allergies, stage.basket.safety);
      for (const candidate of candidates) {
        const selected = ids.map((id, i) => i === slot ? candidate.recipe_id : id), selection = Array.from({ length: 5 }, (_, d) => selected.slice(d * 3, d * 3 + 3));
        let raw: string; try { raw = encodeInventoryPlan(selection, r, before.pantry, before.revision + 1, before.originalSelection, before.checks); } catch { continue; }
        const after = replacementPlan(beforeRaw, raw, slot), arithmetic = independentArithmetic(evaluateWeek(selected, input, snapshot), stage.edible, stage.basket, r.allergies);
        after.model.days.forEach((d, i) => { const actual = arithmetic.days[i]; if (!actual || Math.abs(d.protein - actual.protein_g) > 1e-9 || Math.abs(d.kcal - actual.kcal) > 1e-9 || Math.abs(d.fat - actual.fat_g) > 1e-9 || Math.abs(d.carbs - actual.carbs_g) > 1e-9) throw Error("reviewed_replacement_arithmetic_held"); });
        for (const row of arithmetic.rows) { const actual = after.model.list.find(v => v.id === row.sku_id); if (!actual || Math.abs(actual.physical - row.usedPurchased) > 1e-9 || Math.abs(actual.edible - row.edible) > 1e-9 || Math.abs(actual.trim - row.preparationRefuse) > 1e-9) throw Error("reviewed_replacement_arithmetic_held"); }
        checkSources(); return raw;
      }
      checkSources(); return null;
    },
  });
}
