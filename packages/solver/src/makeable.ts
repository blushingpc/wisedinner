import type { Template, SolveOutput } from "./types.ts";
import type { Ctx } from "./engine.ts";

// "makeable from this week's list" (founder decision 2026-09-24): a dish qualifies for a reroll or a swap only when
// every ingredient is a sku the week already buys (on the list) or the user owns (pantry). the quantity may bump a
// pack count when the list is re-consolidated; what it may never do is add a new sku. Protein Plan's reroll and
// Courier's substitutes both use this, so the list screen never grows an item the user did not plan for.
export function existingSkus(week: SolveOutput, ctx: Ctx): Set<string> {
  return new Set([...week.list.map((i) => i.sku_id), ...ctx.pantry]);
}

export const makeable = (t: Template, existing: Set<string>) => t.parts.every((p) => existing.has(p.sku));

// Courier's protein match: a substitute must land on the same protein as the meal it replaces, per person, as the
// app displays it (rounded grams). tolerance = the larger of 5 g and 15% of the replaced meal's protein, so a 20 g
// breakfast accepts 15 to 25 g and a 60 g dinner accepts 51 to 69 g. documented in docs/API-CONTRACT.md §4.
export const PROTEIN_MATCH_PCT = 0.15;
export const PROTEIN_MATCH_MIN_G = 5;
export const proteinTolerance = (proteinG: number) => Math.max(PROTEIN_MATCH_MIN_G, Math.round(proteinG * PROTEIN_MATCH_PCT));

// the app may pass its own window: a number is a fixed gram window, a function computes it from the replaced
// meal's displayed protein_g; undefined is the default above, so existing callers are unchanged
export type Tolerance = number | ((currentG: number) => number);
export const toleranceFor = (currentG: number, tolerance?: Tolerance) => (tolerance === undefined ? proteinTolerance(currentG) : typeof tolerance === "number" ? tolerance : tolerance(currentG));
export const proteinMatches = (candidateG: number, currentG: number, tolerance?: Tolerance) => Math.abs(candidateG - currentG) <= toleranceFor(currentG, tolerance);
