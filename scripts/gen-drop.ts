// the universal week: one fixed input through the deterministic solver → data/drop.json (committed).
// run: node scripts/gen-drop.ts   — .github/workflows/weekly-drop.yml runs it every sunday.
// the seed is the ISO week number, so each sunday's drop is a different valid week within the 3% cost band.
// priced at Kroger (Columbus 43215), the pipeline's live anchor.
import { writeFileSync } from "node:fs";
import { solve, type SolveInput } from "../packages/solver/src/index.ts";
import { snapshot } from "../data/snapshot.ts";

const MIN_SKUS = 8;
const now = new Date();
const week = Math.ceil(((now.getTime() - Date.UTC(now.getUTCFullYear(), 0, 1)) / 86_400_000 + 1) / 7);
export const DROP_INPUT: SolveInput = { budget: 60, protein_per_day: 150, kcal_min: 1800, kcal_max: 2600, diet: "none", household: 1, seed: week, stores: ["kroger"], zip: "43215" };

const out = solve(DROP_INPUT, snapshot);
console.log(`feasible=${out.feasible} total=$${out.est_total} protein/day=${out.protein_per_day}g skus=${out.distinct_skus} seed=${week} store=${out.stores.map((s) => s.banner).join("+")}`);
if (!out.feasible || out.distinct_skus < MIN_SKUS) {
  console.error(`refusing to write data/drop.json: ${out.feasible ? "" : "infeasible — " + out.why.join("; ") + "; "}${out.distinct_skus} skus (min ${MIN_SKUS})`);
  process.exit(1);
}
writeFileSync("data/drop.json", JSON.stringify({ generated_at: now.toISOString().slice(0, 10), ...out }, null, 2) + "\n");
