import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { cpus, totalmem, platform, release } from "node:os";
import { performance } from "node:perf_hooks";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { solve, ctxFor, evaluate } from "../../packages/solver/src/engine.ts";
import { swapCandidates } from "../../packages/solver/src/swaps.ts";
import { PROFILES, BASE } from "../../packages/solver/src/profiles.ts";
import type { Snapshot, SolveInput, SolveOutput } from "../../packages/solver/src/types.ts";

export const outputDigest = (out: SolveOutput) => createHash("sha256").update(JSON.stringify(out)).digest("hex");
export function checkHardConstraints(out: SolveOutput, snapshot: Snapshot) {
  if (!out.days.some(d => d.items.length)) return;
  const { ctx, internal } = ctxFor(out, snapshot);
  const ev = evaluate(internal, ctx);
  if ((ev.penalty === 0) !== out.feasible) throw new Error("Feasibility disagrees with hard-constraint evaluation");
  if (out.feasible && (ev.cost > out.input.budget || ev.days.some(d => d.protein < out.input.protein_per_day || d.kcal < out.input.kcal_min || d.kcal > out.input.kcal_max))) throw new Error("Hard constraint violated");
  for (const item of out.list) if (item.eaten > item.qty + 1e-6) throw new Error("Portions exceed purchased packs");
}

export async function baselineBenchmark() {
  const snapshot: Snapshot = JSON.parse(readFileSync("data/snapshot.json", "utf8"));
  const environment = { node: process.version, platform: platform(), os_release: release(), cpu: cpus()[0]?.model, logical_cpus: cpus().length, memory_mb: Math.round(totalmem() / 1048576),
    note: "Shared Windows desktop, warm sequential process. RSS is sampled, not isolated peak memory. Legacy draft nutrition is NOT approval evidence." };
  const rows: object[] = [];
  const path = "docs/ingredient-catalog/benchmark-baseline.json";
  const save = () => writeFileSync(path, JSON.stringify({ environment, dataset: { version: snapshot.version, recipes: snapshot.recipes.length, skus: snapshot.skus.length }, rows }, null, 2) + "\n");
  const cases: [string, SolveInput][] = PROFILES.flatMap(([name, input]) => [0, 7, 19].map(seed => [`${name}, seed ${seed}`, { ...input, seed }] as [string, SolveInput]));
  cases.push(["below budget floor", { ...BASE, budget: 44, seed: 3 }], ["difficult high protein at floor", { ...BASE, budget: 45, protein_per_day: 300, seed: 3 }], ["contradictory protein/calorie target", { ...BASE, protein_per_day: 200, kcal_max: 700, kcal_min: 500, seed: 3 }]);
  for (const [name, input] of cases) {
    const before = process.memoryUsage().rss;
    const started = performance.now(); const out = solve(input, snapshot); const ms = performance.now() - started;
    const repeated = solve(input, snapshot);
    if (outputDigest(out) !== outputDigest(repeated)) throw new Error(`${name}: nondeterministic`);
    checkHardConstraints(out, snapshot);
    const swaps = input.budget < 45 ? [] : [0, 7, 14].map(slot => ({ slot, candidates: swapCandidates(out, slot, snapshot).length }));
    rows.push({ name, input, solve_ms: ms, deterministic: true, feasible: out.feasible, total: out.est_total, why: out.why, swaps, rss_before_mb: before / 1048576, rss_after_mb: process.memoryUsage().rss / 1048576, digest: outputDigest(out) });
    save(); console.log(JSON.stringify({ case: name, ms: Math.round(ms), feasible: out.feasible }));
  }
  console.log(`Saved ${rows.length} baseline cases to ${path}`);
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) baselineBenchmark().catch(e => { console.error(e.message); process.exitCode = 1; });
