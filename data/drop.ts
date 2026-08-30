import type { SolveOutput } from "@/app/api/solve/solver";
import raw from "./drop.json" with { type: "json" };

// the committed universal week (scripts/gen-drop.ts). also the landing-page fixture — one source of example numbers.
export const drop = raw as SolveOutput & { input: { budget: number; protein_per_day: number }; generated_at: string };
