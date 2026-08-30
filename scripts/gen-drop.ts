// the universal week: one fixed input through the deterministic solver → data/drop.json (committed).
// run: node scripts/gen-drop.ts   (re-run when staples.json prices change; a sunday action can do this later)
import { writeFileSync } from "node:fs";
import { solve } from "../app/api/solve/solver.ts";
import { staples } from "../data/staples.ts";

// ponytail: "seed" = a fixed input; the solver has no randomness to seed
export const DROP_INPUT = { budget: 60, protein_per_day: 150, kcal_min: 1800, kcal_max: 2600, diet: "none", household: 1 } as const;

const week = solve(DROP_INPUT, staples);
writeFileSync("data/drop.json", JSON.stringify({ input: DROP_INPUT, generated_at: new Date().toISOString().slice(0, 10), ...week }, null, 2) + "\n");
console.log(`feasible=${week.feasible} total=$${week.est_total} protein/day=${week.protein_per_day}g items=${week.list.length}`);
