import type { Snapshot, SolveOutput } from "./types.ts";
import { BAND, ctxFor, evaluate, options, rng, toOutput } from "./engine.ts";

// re-solve one slot (slotIndex = day * 3 + slot, 0..14) with the other fourteen fixed. every valid recipe for the
// slot is tried; a feasible week only accepts substitutes that keep it feasible (budget, protein, calories, floors,
// repeat cap, waste rule); the seed picks inside the 3% band like a full solve. nothing fits → the week comes back
// unchanged with changed: false and a plain-words why.
export function regenerateSlot(week: SolveOutput, slotIndex: number, seed: number, s: Snapshot): SolveOutput & { changed: boolean } {
  const d = Math.floor(slotIndex / 3);
  const sl = slotIndex % 3;
  if (d < 0 || d > 4 || slotIndex < 0) throw new Error("slotIndex must be 0..14");
  const { ctx, book, internal } = ctxFor(week, s);
  const current = internal[d][sl];
  const base = evaluate(internal, ctx);
  const cands = options(ctx, d, sl).filter((t) => t.id !== current.id);
  const tried = cands.map((t) => {
    const w = internal.map((day, di) => (di === d ? day.map((x, si) => (si === sl ? t : x)) : day));
    return { week: w, ev: evaluate(w, ctx) };
  });
  const rand = rng(seed);
  let pick: (typeof tried)[number] | undefined;
  if (base.penalty === 0) {
    const valid = tried.filter((r) => r.ev.penalty === 0).sort((a, b) => a.ev.cost - b.ev.cost);
    if (valid.length) {
      const band = valid.filter((r) => r.ev.cost <= valid[0].ev.cost * BAND);
      pick = band[Math.floor(rand() * band.length)];
    }
  } else {
    const better = tried.filter((r) => r.ev.score < base.score).sort((a, b) => a.ev.score - b.ev.score);
    if (better.length) pick = better[0];
  }
  if (!pick) {
    const kind = sl === 0 ? "breakfast" : sl === 1 ? "lunch" : "dinner";
    return { ...week, seed, why: [...week.why, `no other ${kind} fits this week`], changed: false };
  }
  return { ...toOutput(pick.week, pick.ev, ctx, seed, book, s), changed: true };
}
