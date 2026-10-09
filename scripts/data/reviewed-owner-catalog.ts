import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { stageReviewed, reviewedBasket, digest, type WeekApproval } from "./reviewed-week.ts";
import { solveRestricted } from "./catalog-selection.ts";
import { independentArithmetic } from "./reviewed-week-acceptance.ts";
import { priceMapFor } from "../../packages/solver/src/pricing.ts";
import { previewRequest, eligibleRecipeIds, encodePreview, decodePreview } from "./reviewed-owner-model.ts";
import frozen from "./reviewed-owner-source.json" with { type: "json" };

const rawPins: Record<string, string> = {
  "data/pipeline/reviewed-week/edible-catalog.json": "e8f09f8bd2bc3ee7230e4d746ba32a4e37e56daf09922422f26de7527ceea7ba",
  "docs/ingredient-catalog/reviewed-week-reviews.json": "e5588046ae8692febb1b598b227c46ada95bf38b0f0ce204a22a81bee53bb9ac",
  "docs/ingredient-catalog/reviewed-week-approval.json": "165d3908ff2b4f584371d6b69c89f9e4076b907ff17534e5772254b53bfb3f08",
  "docs/ingredient-catalog/reviewed-week-sources.json": "454cc634b03de3f00f91888dacb297e8e41f4a573e9bedbecbacfd8784e0d438",
  "docs/ingredient-catalog/reviewed-week-labels.json": "444224979dd505445915078de5a100042e7a78b081e5983dc06c3cfe6945269c",
  "docs/ingredient-catalog/usda-evidence.json": "a838e76169ffb393c18acba48a4be0658059654a7d65197f24e3be0261aa690c",
};
// LOCAL callable factory only. No route, target, environment or import-time I/O.
// Request identity fields are correspondence data; only the app's issued capture
// supplies authority. This function never authenticates a plain owner string.
function sourceReader() { const root = process.cwd(); return (path: string) => readFileSync(resolve(root, path)); }
export function createReviewedOwnerCatalog(read: (path: string) => Buffer = sourceReader()) {
  const assertSources = () => { for (const [path, expected] of Object.entries({ ...frozen.dependencies, ...rawPins })) if (createHash("sha256").update(read(path)).digest("hex") !== expected) throw Error("reviewed_source_held"); };
  assertSources();
  const approval: WeekApproval = JSON.parse(read("docs/ingredient-catalog/reviewed-week-approval.json").toString());
  const s = stageReviewed(approval, reviewedBasket());
  if (s.basket.source_digest !== frozen.source || s.basket.input_digest !== frozen.input || s.candidate_digest !== frozen.candidate || digest(s.edible) !== digest(frozen.edible) || digest(s.basket) !== digest(frozen.reviews) || s.counts.eligible !== 63 || s.edible.skus.length !== 13) throw Error("reviewed_source_held");
  const store = s.edible.stores.find(x => x.id === frozen.store); if (!store) throw Error("reviewed_source_held");
  const prices = Object.fromEntries([...priceMapFor(s.edible, store, frozen.zip)].map(([id, p]) => [id, { cents: Math.round(p.price_usd * 100), observed: p.observed, asOf: p.as_of }]));
  if (digest(prices) !== digest(frozen.prices)) throw Error("reviewed_price_held");
  return Object.freeze({
    assertSources,
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
  });
}
