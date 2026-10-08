// Offline/internal entry points only. Not wired into public routes or the app.
import type { Snapshot, SolveInput, SolveOutput } from "../../packages/solver/src/types.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { swapCandidates } from "../../packages/solver/src/swaps.ts";
import { eligibleSnapshot, SAFETY, type SafetyTable } from "./ingredient-safety.ts";
import { shortlistCatalog, solveBounded } from "./catalog-pool.ts";
import { preparationData, restrictedPreparedCatalog, type PreparationContext } from "./prepared-selection.ts";

export function solveRestricted(input: SolveInput, snapshot: Snapshot, allergies: string[], table: SafetyTable = SAFETY, preparation?: PreparationContext) {
  if (preparation !== undefined) { input = preparationData(input); allergies = preparationData(allergies); table = preparationData(table); }
  const selected = preparation === undefined ? eligibleSnapshot(snapshot, input.diet, allergies, table) : restrictedPreparedCatalog(snapshot, input.diet, allergies, preparation, table).snapshot;
  if (!selected.recipes.some(r => r.meal_type === "breakfast") || !selected.recipes.some(r => r.meal_type !== "breakfast")) throw new Error("Not enough reviewed recipes for these restrictions");
  return solveBounded(input, selected).out;
}

export function restrictedCandidates(week: SolveOutput, slot: number, snapshot: Snapshot, allergies: string[], table: SafetyTable = SAFETY, preparation?: PreparationContext) {
  if (preparation !== undefined) { week = preparationData(week); allergies = preparationData(allergies); table = preparationData(table); }
  const selected = preparation === undefined ? eligibleSnapshot(snapshot, week.input.diet, allergies, table) : restrictedPreparedCatalog(snapshot, week.input.diet, allergies, preparation, table).snapshot;
  // Re-evaluate IDs in the restricted pool. A legacy week containing unknown ingredients must be rejected.
  evaluateWeek(week.days.flatMap(d => d.items.map(i => i.recipe_id)), week.input, selected);
  const bounded = shortlistCatalog(selected, week.input, week.days.flatMap(d => d.items.map(i => i.recipe_id)));
  return swapCandidates(week, slot, bounded);
}
