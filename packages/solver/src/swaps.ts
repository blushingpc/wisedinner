import type { Snapshot, SolveOutput, SwapCandidate } from "./types.ts";
import { belowMinimum, ctxFor, evaluate, options, toOutput } from "./engine.ts";
import { existingSkus, makeable, proteinMatches, type Tolerance } from "./makeable.ts";

// Courier's menu of substitutes for one slot (founder decision 2026-09-24): every recipe not already in the week
// that (1) is makeable from the week's existing list, no new sku (makeable.ts), (2) lands on the same protein as
// the meal it replaces, per person as displayed, within the tolerance in makeable.ts, and (3) keeps the week
// feasible (or, for an infeasible week, does not make it worse). ranked by fewest extra packs, then cheapest, then
// closest protein, then most protein. deterministic, no seed. usesExisting is always true now and stays on the
// shape so the app's contract does not move. `tolerance` overrides the protein window: a number of grams, or a
// function of the replaced meal's displayed protein_g; undefined = proteinTolerance (max(5 g, 15%)).
export function swapCandidates(week: SolveOutput, slotIndex: number, s: Snapshot, n = 6, tolerance?: Tolerance): SwapCandidate[] {
  const d = Math.floor(slotIndex / 3);
  const sl = slotIndex % 3;
  if (d < 0 || d > 4 || slotIndex < 0) throw new Error("slotIndex must be 0..14");
  if (belowMinimum(week.input)) return []; // an empty week under the floor has nothing to swap
  const { ctx, book, internal } = ctxFor(week, s);
  const current = internal[d][sl];
  const currentProtein = week.days[d].items[sl]?.protein_g ?? 0;
  const base = evaluate(internal, ctx);
  const inWeek = new Set(internal.flat().map((t) => t.id));
  const existing = existingSkus(week, ctx);
  const variants = new Map(s.recipe_variants.filter((v) => v.recipe_id === current.base_id || v.variant_recipe_id === current.id).map((v) => [v.variant_recipe_id === current.id ? v.recipe_id : v.variant_recipe_id, v]));
  const basePacks = [...base.packs.values()].reduce((a, b) => a + b, 0);
  const out: SwapCandidate[] = [];
  for (const t of options(ctx, d, sl)) {
    if (inWeek.has(t.id) || !makeable(t, existing)) continue;
    const w = internal.map((day, di) => (di === d ? day.map((x, si) => (si === sl ? t : x)) : day));
    const ev = evaluate(w, ctx);
    if (base.penalty === 0 ? ev.penalty !== 0 : ev.score > base.score) continue;
    const protein_g = toOutput(w, ev, ctx, week.seed, book, s).days[d].items[sl].protein_g; // the figure the app shows
    if (!proteinMatches(protein_g, currentProtein, tolerance)) continue;
    const newItems = t.parts.map((p) => p.sku).filter((id) => !existing.has(id)); // always [] after the makeable filter
    const v = variants.get(t.id);
    out.push({
      recipe_id: t.id,
      name: t.name,
      protein_g,
      deltaCost: Math.round((ev.cost - base.cost) * 100) / 100,
      deltaProtein: Math.round(ev.days[d].protein) - Math.round(base.days[d].protein), // the day figures as displayed
      usesExisting: newItems.length === 0,
      newItems,
      extraPacks: [...ev.packs.values()].reduce((a, b) => a + b, 0) - basePacks,
      ...(v ? { variantOf: { recipe_id: current.id, kind: v.kind } } : {}),
    });
  }
  out.sort(
    (a, b) =>
      a.extraPacks - b.extraPacks ||
      a.deltaCost - b.deltaCost ||
      Math.abs(a.protein_g - currentProtein) - Math.abs(b.protein_g - currentProtein) ||
      b.protein_g - a.protein_g ||
      a.recipe_id.localeCompare(b.recipe_id),
  );
  return out.slice(0, n);
}
