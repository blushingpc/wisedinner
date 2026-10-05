// Explicit private runner. No pipeline/public writer, network, database or credential imports.
import assert from "node:assert/strict";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { pathToFileURL } from "node:url";
import { platform, release, totalmem } from "node:os";
import { performance } from "node:perf_hooks";
import { pricingStage } from "./store-estimate-week.ts";
import { digest } from "./reviewed-week.ts";
import { ingredientAllowed, eligibleSnapshot } from "./ingredient-safety.ts";
import { prepareReviewedSelection, solveReviewedRestricted, reviewedCandidates, validateReviewedSelection } from "./reviewed-selection.ts";
import { independentArithmetic } from "./reviewed-week-acceptance.ts";
import { solveRestricted } from "./catalog-selection.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { BASE, PROFILES } from "../../packages/solver/src/profiles.ts";
import type { SolveInput } from "../../packages/solver/src/types.ts";

export function runFoodCoverage(output: string) {
  const path = resolve(output);
  const allowedRoot = resolve("C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/runs") + "/";
  if (!path.replaceAll("\\", "/").startsWith(allowedRoot.replaceAll("\\", "/"))) throw new Error("Exclusive external run evidence required");
  mkdirSync(path); // exclusive, never overwrite an earlier run
  const save = (name: string, value: unknown) => writeFileSync(join(path, name), JSON.stringify(value, null, 2) + "\n");
  const stage = pricingStage();
  const ingredientIds = stage.purchased.recipes.filter(r => stage.purchased.recipe_ingredients.filter(i => i.recipe_id === r.id)
    .every(i => ingredientAllowed(i.sku_id, "none", ["soy"], stage.basket.safety))).map(r => r.id);
  const soy = prepareReviewedSelection(stage, "none", ["soy"]);
  const baseline = { counts: stage.counts, ingredientIds, ingredientBreakfasts: ingredientIds.filter(id => stage.purchased.recipes.find(r => r.id === id)!.meal_type === "breakfast").length,
    legacyEligible: eligibleSnapshot(stage.purchased, "none", ["soy"], stage.basket.safety).recipes.length,
    projectedEligible: soy.snapshot.recipes.length, projectedBreakfasts: soy.snapshot.recipes.filter(r => r.meal_type === "breakfast").length,
    sourceDigest: stage.basket.source_digest, candidateDigest: stage.candidate_digest, catalogDigest: digest(stage.edible),
    purchaseDigest: digest(stage.purchased), originalFamilyDigest: digest(stage.purchased.recipe_variants),
    approvalDigest: digest(JSON.parse(readFileSync("docs/ingredient-catalog/overnight-plant-approval.json", "utf8"))) };
  save("before-after.json", baseline); save("soy-projection.json", soy);
  const cases: { name: string; input: SolveInput; allergies: string[] }[] = [];
  for (const [name, profile] of PROFILES) for (const seed of [0, 7, 19]) {
    cases.push({ name: `${name}/${seed}`, input: { ...profile, seed }, allergies: [] });
    cases.push({ name: `${name}/soy/${seed}`, input: { ...profile, seed }, allergies: ["soy"] });
  }
  for (const [name, diet, allergies] of [["egg", "none", ["eggs"]], ["egg-soy", "none", ["eggs", "soy"]],
    ["gluten", "gluten-free", []], ["gluten-soy", "gluten-free", ["soy"]], ["dairy", "none", ["dairy"]],
    ["wheat", "none", ["wheat"]], ["nuts", "none", ["peanuts", "tree-nuts"]]] as const) cases.push({ name, input: { ...BASE, diet, seed: 7 }, allergies: [...allergies] });
  const rows: object[] = [];
  const report = { verification: "Local actual private graph/solver and independent reference arithmetic, not hosted/native/provider/store/kitchen proof",
    environment: { node: process.version, platform: platform(), release: release(), memoryMB: totalmem() / 1048576 }, baseline, rows,
    note: "Same targets, whole packs, consumed-only nutrients and 96 cap. Six returned substitutes is capped coverage; zero is honest. No reroll shopping policy selected." };
  const checkpoint = () => save("acceptance.json", report);
  for (const c of cases) {
    const start = performance.now(), p = prepareReviewedSelection(stage, c.input.diet, c.allergies);
    validateReviewedSelection(stage, p);
    const perServingProtein = (id: string) => {
      const recipe = stage.edible.recipes.find(r => r.id === id)!;
      return stage.edible.recipe_ingredients.filter(i => i.recipe_id === id).reduce((sum, row) => {
        const sku = stage.edible.skus.find(k => k.id === row.sku_id)!;
        // All current reviewed rows use grams or egg each; explicit unit handling rejects other bases.
        if (!["g", "each"].includes(row.unit)) throw new Error("Unsupported independent protein bound unit");
        return sum + row.qty * sku.grams_per_unit * stage.basket.quantities[sku.id].nutrition.protein_g / (100 * recipe.servings);
      }, 0);
    };
    const maxBreakfast = Math.max(0, ...p.snapshot.recipes.filter(r => r.meal_type === "breakfast").map(r => perServingProtein(r.id)));
    const maxMain = Math.max(0, ...p.snapshot.recipes.filter(r => r.meal_type !== "breakfast").map(r => perServingProtein(r.id)));
    const proteinUpperBound = maxBreakfast + 2 * maxMain;
    if (!p.snapshot.recipes.some(r => r.meal_type === "breakfast") || !p.snapshot.recipes.some(r => r.meal_type !== "breakfast")) {
      rows.push({ ...c, eligible: p.snapshot.recipes.length, breakfasts: p.snapshot.recipes.filter(r => r.meal_type === "breakfast").length,
        projectionDigest: p.projectionDigest, proteinUpperBound, blocked: "No reviewed breakfast/main coverage" }); checkpoint(); continue;
    }
    const solved = solveReviewedRestricted(c.input, stage, c.allergies), out = solved.out;
    assert.deepEqual(out, solveReviewedRestricted(c.input, stage, c.allergies).out);
    const ids = out.days.flatMap(d => d.items.map(i => i.recipe_id));
    assert.deepEqual(out, evaluateWeek(ids, c.input, p.snapshot));
    // The original graph independently retains EXACT original identities and therefore original repeat counts.
    assert.deepEqual(out, evaluateWeek(ids, c.input, stage.purchased));
    const arithmetic = independentArithmetic(out, stage.edible, stage.basket, c.allergies);
    const familyCounts = [0, 1, 2].map(slot => {
      const original: Record<string, number> = {}, projected: Record<string, number> = {};
      ids.filter((_, index) => index % 3 === slot).forEach(id => {
        const member = p.provenance.members.find(m => m.id === id)!;
        original[member.originalFamily] = (original[member.originalFamily] ?? 0) + 1;
        projected[member.representative] = (projected[member.representative] ?? 0) + 1;
      });
      assert.deepEqual(original, arithmetic.repeats[slot]);
      for (const m of p.provenance.members) assert.equal(original[m.originalFamily], projected[m.representative]);
      return { original, projected };
    });
    const slots = out.feasible ? Array.from({ length: 15 }, (_, slot) => {
      const candidates = reviewedCandidates(out, slot, stage, c.allergies);
      const substitutions = candidates.map(candidate => {
        const swapped = [...ids]; swapped[slot] = candidate.recipe_id;
        const re = evaluateWeek(swapped, c.input, p.snapshot);
        assert.equal(re.feasible, true);
        assert.deepEqual(re, evaluateWeek(swapped, c.input, stage.purchased));
        const independent = independentArithmetic(re, stage.edible, stage.basket, c.allergies);
        assert.equal(independent.feasible, true);
        return { candidate, outputDigest: digest(re), independent };
      });
      return { slot, returned: candidates.length, zeroCoverage: candidates.length === 0, cappedAtSix: candidates.length === 6, substitutions };
    }) : [];
    const legacyMatch = c.allergies.includes("soy") ? null : digest(solveRestricted(c.input, stage.purchased, c.allergies, stage.basket.safety)) === digest(out);
    if (legacyMatch !== null) assert.equal(legacyMatch, true);
    const row = { ...c, eligible: p.snapshot.recipes.length, searched: solved.searchedSnapshot.recipes.length,
      projectionDigest: p.projectionDigest, proteinUpperBound, deterministic: true, legacyMatch, out, arithmetic, familyCounts, slots, ms: performance.now() - start };
    rows.push(row); save(`case-${rows.length}.json`, row); checkpoint();
    console.log(JSON.stringify({ name: c.name, feasible: out.feasible, cents: arithmetic.total_cents, why: out.why, slots: slots.map(s => s.returned) }));
  }
  checkpoint();
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.length !== 3) throw new Error("One exclusive external evidence directory required");
  runFoodCoverage(process.argv[2]);
}
