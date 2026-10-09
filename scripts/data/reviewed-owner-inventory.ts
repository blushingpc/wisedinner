import { createReviewedOwnerCatalog } from "./reviewed-owner-catalog.ts";
import { previewRequest, decodePreview } from "./reviewed-owner-model.ts";
import { encodeInventoryPlan, decodeInventoryPlan, physicalPantry } from "./reviewed-owner-inventory-model.ts";
import { stageReviewed, reviewedBasket, type WeekApproval } from "./reviewed-week.ts";
import { evaluateReviewedPantry, pantryBasis } from "./reviewed-pantry.ts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Explicit LOCAL factory; old catalog factory verifies all frozen source/pin bytes.
function sourceReader() { const root = process.cwd(); return (p: string) => readFileSync(resolve(root, p)); }
export function createReviewedOwnerInventory(read: (path: string) => Buffer = sourceReader()) {
  const catalog = createReviewedOwnerCatalog(read), approval: WeekApproval = JSON.parse(read("docs/ingredient-catalog/reviewed-week-approval.json").toString()), stage = stageReviewed(approval, reviewedBasket());
  return Object.freeze({
    install(value: unknown, pantryValue: unknown, revision = 1): string {
      const request = previewRequest(value), pantry = physicalPantry(pantryValue), original = decodePreview(catalog.solve(request), request), selection = original.days.map(d => d.meals.map(m => m.id));
      const raw = encodeInventoryPlan(selection, request, pantry, revision), plan = decodeInventoryPlan(raw, request);
      const owned = pantry.map(r => { const s = stage.edible.skus.find(s => s.id === r.id); if (!s) throw Error("reviewed_inventory_held"); return { skuId: r.id, fraction: r.fraction, purchaseBasis: pantryBasis(s) }; });
      const arithmetic = evaluateReviewedPantry(selection.flat(), { budget: request.budget, protein_per_day: request.protein, kcal_min: request.kcalMin, kcal_max: request.kcalMax, household: request.household, diet: request.diet, pantry: [], stores: request.stores, zip: request.zip, seed: request.seed }, stage, owned, request.allergies);
      if (!arithmetic.feasible || arithmetic.totalCents !== plan.model.totalCents) throw Error("reviewed_inventory_arithmetic_held");
      for (const row of arithmetic.rows) { const actual = plan.model.list.find(r => r.id === row.skuId); if (!actual || actual.paidPacks !== row.buyPacks || actual.cents !== row.costCents || Math.abs(actual.physical - row.physicalPrepared) > 1e-9 || Math.abs(actual.edible - row.edibleConsumed) > 1e-9 || Math.abs(actual.trim - row.trim) > 1e-9) throw Error("reviewed_inventory_arithmetic_held"); }
      plan.model.days.forEach((d, i) => { const a = arithmetic.days[i]; if (!a || Math.abs(d.protein - a.protein_g) > 1e-9 || Math.abs(d.kcal - a.kcal) > 1e-9) throw Error("reviewed_inventory_arithmetic_held"); });
      return raw;
    },
  });
}
