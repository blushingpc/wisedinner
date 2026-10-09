// Offline/internal entry points only. Not wired into public routes or the app.
import type { Snapshot, SolveInput, SolveOutput } from "./core/types.ts";
import { evaluateWeek } from "./core/engine.ts";
import { swapCandidates } from "./core/swaps.ts";
import { eligibleSnapshot, SAFETY, type SafetyTable } from "./ingredient-safety.ts";
import { shortlistCatalog, solveBounded } from "./catalog-pool.ts";

export function solveRestricted(input: SolveInput, snapshot: Snapshot, allergies: string[], table: SafetyTable = SAFETY, preparation?: unknown) {
  if (preparation !== undefined) throw Error("reviewed_native_preparation_held");
  const selected = eligibleSnapshot(snapshot, input.diet, allergies, table);
  if (!selected.recipes.some(r => r.meal_type === "breakfast") || !selected.recipes.some(r => r.meal_type !== "breakfast")) throw new Error("Not enough reviewed recipes for these restrictions");
  return solveBounded(input, selected).out;
}

export function restrictedCandidates(week: SolveOutput, slot: number, snapshot: Snapshot, allergies: string[], table: SafetyTable = SAFETY, preparation?: unknown) {
  if (preparation !== undefined) throw Error("reviewed_native_preparation_held");
  const selected = eligibleSnapshot(snapshot, week.input.diet, allergies, table);
  // Re-evaluate IDs in the restricted pool. A legacy week containing unknown ingredients must be rejected.
  evaluateWeek(week.days.flatMap(d => d.items.map(i => i.recipe_id)), week.input, selected);
  const bounded = shortlistCatalog(selected, week.input, week.days.flatMap(d => d.items.map(i => i.recipe_id)));
  return swapCandidates(week, slot, bounded);
}
