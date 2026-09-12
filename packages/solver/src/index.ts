// public surface of the solver package. the site imports from here (lib/solver.ts re-exports); the app copies
// packages/solver/src into its tree and imports the same file.
export * from "./types.ts";
export { validateSnapshot, baseRecipes, templatesOf, toPublicSnapshot } from "./snapshot.ts";
export { toCanonical, packCanonical, unitPrice, costOf, UnitError } from "./units.ts";
export { PRICE_BUFFER, buildPriceBook, priceMapFor } from "./pricing.ts";
export { solve, evaluateWeek, floors, isProteinSource, DAYS, SLOTS, buildPool, makeCtx, evaluate, options, fraction, MIN_BUDGET, MIN_BUDGET_WHY, belowMinimum } from "./engine.ts";
export { regenerateSlot } from "./regenerate.ts";
export { swapCandidates } from "./swaps.ts";
export { servingCost, servingNutrition } from "./serving.ts";
