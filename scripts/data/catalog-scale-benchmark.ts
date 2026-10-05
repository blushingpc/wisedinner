import { readFileSync, writeFileSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { generateCandidates, compileApproved } from "./catalog-expansion.ts";
import { solveBounded, POOL_LIMIT } from "./catalog-pool.ts";
import { checkHardConstraints, outputDigest } from "./catalog-benchmark.ts";
import { PROFILES, BASE } from "../../packages/solver/src/profiles.ts";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import { swapCandidates } from "../../packages/solver/src/swaps.ts";
import type { Snapshot, SolveInput } from "../../packages/solver/src/types.ts";

const legacy: Snapshot = JSON.parse(readFileSync("data/snapshot.json", "utf8"));
const approved: Snapshot = JSON.parse(readFileSync("data/pipeline/ingredient-catalog/eligible-snapshot.json", "utf8"));
const baseline = JSON.parse(readFileSync("docs/ingredient-catalog/benchmark-baseline.json", "utf8"));
const generated = generateCandidates();
const full = compileApproved(generated);
const anchors = legacy.recipes.map(r => r.id);
const rows: object[] = [];
const path = "docs/ingredient-catalog/benchmark-scaling.json";
const save = () => writeFileSync(path, JSON.stringify({ environment: baseline.environment, pool_limit: POOL_LIMIT,
  strategy: "Keep the 83 legacy IDs as anchors; deterministically fill up to 96. This is a continuity strategy, not proof of optimality or the best shortlist.",
  counts_note: "149 = legacy plus 66 reviewed additions, still not fully reviewed legacy nutrition. Larger sets include quarantined drafts solely as synthetic computational stress; exclude from eligible counts. Staging never replaces public data.", rows }, null, 2) + "\n");
for (const size of [149, 500, 1000, 4787]) {
  const additions = size === 149 ? approved : (() => {
    const chosen = new Set(full.recipes.slice(0, size - legacy.recipes.length).map(r => r.id));
    // Include family parents within the target prefix; generation has base first for each family.
    return { recipes: full.recipes.filter(r => chosen.has(r.id)), recipe_ingredients: full.ingredients.filter(i => chosen.has(i.recipe_id)), recipe_variants: full.variants.filter(v => chosen.has(v.recipe_id) && chosen.has(v.variant_recipe_id)) };
  })();
  const reviewedNutrients = new Map(approved.nutrition.map(n => [n.sku_id, n]));
  const snapshot = validateSnapshot({ ...legacy, nutrition: legacy.nutrition.map(n => reviewedNutrients.get(n.sku_id) ?? n),
    recipes: [...legacy.recipes, ...additions.recipes], recipe_ingredients: [...legacy.recipe_ingredients, ...additions.recipe_ingredients], recipe_variants: [...legacy.recipe_variants, ...additions.recipe_variants] });
  const cases: [string, SolveInput][] = PROFILES.flatMap(([name, input]) => [0, 7, 19].map(seed => [`${name}, seed ${seed}`, { ...input, seed }] as [string, SolveInput]));
  cases.push(["below budget floor", { ...BASE, budget: 44, seed: 3 }], ["difficult high protein at floor", { ...BASE, budget: 45, protein_per_day: 300, seed: 3 }], ["contradictory protein/calorie target", { ...BASE, protein_per_day: 200, kcal_max: 700, kcal_min: 500, seed: 3 }]);
  for (const [name, input] of cases) {
    const before = process.memoryUsage().rss;
    const started = performance.now(); const selected = solveBounded(input, snapshot, anchors); const ms = performance.now() - started;
    const repeated = solveBounded(input, snapshot, anchors);
    if (outputDigest(selected.out) !== outputDigest(repeated.out)) throw new Error(`${size}/${name}: nondeterministic`);
    if (input.budget >= 45 && selected.snapshot.recipes.length > POOL_LIMIT) throw new Error("Unbounded search pool");
    checkHardConstraints(selected.out, selected.snapshot);
    const swaps = input.budget < 45 ? [] : [0, 7, 14].map(slot => ({ slot, candidates: swapCandidates(selected.out, slot, selected.snapshot).length }));
    rows.push({ size: snapshot.recipes.length, label: size === 149 ? "mixed legacy plus reviewed additions" : "quarantined synthetic stress", name, input,
      selection_and_solve_ms: ms, searched_recipes: input.budget < 45 ? 0 : selected.snapshot.recipes.length, deterministic: true, hard_constraints_checked: true,
      feasible: selected.out.feasible, total: selected.out.est_total, why: selected.out.why, swaps, rss_before_mb: before / 1048576, rss_after_mb: process.memoryUsage().rss / 1048576, digest: outputDigest(selected.out) });
    save(); console.log(JSON.stringify({ size, case: name, ms: Math.round(ms), feasible: selected.out.feasible }));
  }
}
// The approved standalone subset is too small for the twelve-item floor; prove it without relaxing the floor.
const subset = solveBounded({ ...BASE, seed: 7 }, approved);
checkHardConstraints(subset.out, subset.snapshot);
rows.push({ size: approved.recipes.length, label: "approved-only subset", name: "typical seed 7", feasible: subset.out.feasible, why: subset.out.why, distinct_skus: subset.out.distinct_skus });
save(); console.log(`Saved ${rows.length} scaling cases to ${path}`);
