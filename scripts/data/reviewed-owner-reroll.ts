import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createReviewedOwnerCatalog } from "./reviewed-owner-catalog.ts";
import { decodeInventoryPlan, encodeInventoryPlan, replacementPlan } from "./reviewed-owner-inventory-model.ts";
import { eligibleRecipeIds } from "./reviewed-owner-model.ts";
import { stageReviewed, reviewedBasket, type WeekApproval } from "./reviewed-week.ts";
import { restrictedCandidates } from "./catalog-selection.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { independentArithmetic } from "./reviewed-week-acceptance.ts";

function sourceReader() { const root = process.cwd(); return (p: string) => readFileSync(resolve(root, p)); }
// Data producer only. The owner screen/state supplies current verified authority.
export function createReviewedOwnerReroll(read: (p: string) => Buffer = sourceReader()) {
  const catalog = createReviewedOwnerCatalog(read), checkSources = catalog.assertSources; checkSources();
  const approval: WeekApproval = JSON.parse(read("docs/ingredient-catalog/reviewed-week-approval.json").toString()), stage = stageReviewed(approval, reviewedBasket());
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
