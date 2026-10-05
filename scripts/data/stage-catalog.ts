import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { SKUS } from "./authored/skus.ts";
import { toSku } from "./expand.ts";
import { loadUsdaMap } from "./usda.ts";
import { reviewNutrition } from "./catalog-review.ts";
import { generateCandidates, candidateDigest, assessCandidates, compileApproved, type Approval } from "./catalog-expansion.ts";
import type { SourceFood } from "./catalog-evidence.ts";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import type { Snapshot } from "../../packages/solver/src/types.ts";

const output = "data/pipeline/ingredient-catalog";
mkdirSync(output, { recursive: true });
const map = loadUsdaMap();
const foods: SourceFood[] = JSON.parse(readFileSync("docs/ingredient-catalog/usda-evidence.json", "utf8")).foods;
const reviews = reviewNutrition(map, foods);
const started = performance.now();
const candidates = generateCandidates();
const generationMs = performance.now() - started;
const approval: Approval | undefined = existsSync("docs/ingredient-catalog/approval.json") ? JSON.parse(readFileSync("docs/ingredient-catalog/approval.json", "utf8")) : undefined;
const assessed = assessCandidates(candidates, map, reviews, approval);
const compiled = compileApproved(assessed.eligible);
const old: Snapshot = JSON.parse(readFileSync("data/snapshot.json", "utf8"));
const used = new Set(compiled.ingredients.map(i => i.sku_id));
const snapshot = validateSnapshot({
  version: old.version, generated_at: old.generated_at, stores: old.stores,
  skus: SKUS.filter(s => used.has(s.id)).map(toSku),
  store_prices: old.store_prices.filter(p => used.has(p.sku_id)),
  nutrition: [...used].map(sku_id => { const n = map[sku_id]; return { sku_id, per: "100g", protein_g: n.protein_g, kcal: n.kcal, fat_g: n.fat_g, carbs_g: n.carbs_g }; }),
  recipes: compiled.recipes, recipe_ingredients: compiled.ingredients, recipe_variants: compiled.variants,
});
writeFileSync(`${output}/candidates.json`, JSON.stringify(candidates) + "\n");
writeFileSync(`${output}/quarantine.json`, JSON.stringify(assessed.quarantine, null, 2) + "\n");
writeFileSync(`${output}/eligible-snapshot.json`, JSON.stringify(snapshot, null, 2) + "\n");
writeFileSync(`${output}/eligible-authored.json`, JSON.stringify(compiled.authored, null, 2) + "\n");
const reviewIds = candidates.filter(c => c.recipe.ingredients.every(([id]) => reviews.find(r => r.sku_id === id)?.status === "generic-reviewed")).map(c => c.recipe.id);
writeFileSync(`${output}/proposed-approval.json`, JSON.stringify({ candidate_digest: candidateDigest(candidates), recipe_ids: reviewIds, reviewed_at: "not-approved" }, null, 2) + "\n");
const report = { counts: assessed.counts, generation_ms: generationMs, validation_ms: performance.now() - started - generationMs, digest: candidateDigest(candidates),
  eligible_skus: [...used], bases: compiled.authored.length, variants: compiled.variants.length,
  scope: "Offline ingredient/structure approval only; neutral photos, no kitchen taste/device/pricing proof. Whole-week feasibility not guaranteed. Standalone subset must never replace production coverage.",
  artifacts: output, approved_recipes: assessed.eligible.map(c => ({ id: c.recipe.id, name: c.recipe.name, meal_type: c.recipe.meal_type, minutes: c.recipe.minutes, ingredients: c.recipe.ingredients })) };
writeFileSync("docs/ingredient-catalog/expansion-report.json", JSON.stringify(report, null, 2) + "\n");
console.log(JSON.stringify({ ...assessed.counts, generation_ms: generationMs, bases: report.bases, variants: report.variants, digest: report.digest, output }));
