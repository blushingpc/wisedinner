import type { Snapshot, SolveOutput, SwapCandidate } from "./types.ts";
import { ctxFor, evaluate, options } from "./engine.ts";

// ranked valid substitutes for one slot: every recipe not already in the week that keeps the week feasible (or,
// for an infeasible week, does not make it worse), ranked by "uses what you already buy" first, then fewest new
// items, then cheapest, then most protein. deterministic, no seed.
export function swapCandidates(week: SolveOutput, slotIndex: number, s: Snapshot, n = 6): SwapCandidate[] {
  const d = Math.floor(slotIndex / 3);
  const sl = slotIndex % 3;
  if (d < 0 || d > 4 || slotIndex < 0) throw new Error("slotIndex must be 0..14");
  const { ctx, internal } = ctxFor(week, s);
  const current = internal[d][sl];
  const base = evaluate(internal, ctx);
  const inWeek = new Set(internal.flat().map((t) => t.id));
  const existing = new Set([...week.list.map((i) => i.sku_id), ...ctx.pantry]);
  const variants = new Map(s.recipe_variants.filter((v) => v.recipe_id === current.base_id || v.variant_recipe_id === current.id).map((v) => [v.variant_recipe_id === current.id ? v.recipe_id : v.variant_recipe_id, v]));
  const out: SwapCandidate[] = [];
  for (const t of options(ctx, d, sl)) {
    if (inWeek.has(t.id)) continue;
    const w = internal.map((day, di) => (di === d ? day.map((x, si) => (si === sl ? t : x)) : day));
    const ev = evaluate(w, ctx);
    if (base.penalty === 0 ? ev.penalty !== 0 : ev.score > base.score) continue;
    const newItems = t.parts.map((p) => p.sku).filter((id) => !existing.has(id));
    const v = variants.get(t.id);
    out.push({
      recipe_id: t.id,
      name: t.name,
      deltaCost: Math.round((ev.cost - base.cost) * 100) / 100,
      deltaProtein: Math.round(ev.days[d].protein - base.days[d].protein),
      usesExisting: newItems.length === 0,
      newItems,
      ...(v ? { variantOf: { recipe_id: current.id, kind: v.kind } } : {}),
    });
  }
  out.sort(
    (a, b) =>
      Number(b.usesExisting) - Number(a.usesExisting) ||
      a.newItems.length - b.newItems.length ||
      a.deltaCost - b.deltaCost ||
      b.deltaProtein - a.deltaProtein ||
      a.recipe_id.localeCompare(b.recipe_id),
  );
  return out.slice(0, n);
}
