import type { Diet, DietFlag, ListItem, PlanItem, Pool, PoolSku, Snapshot, SolveInput, SolveOutput, Template, Week } from "./types.ts";
import { dietOk, templatesOf } from "./snapshot.ts";
import { buildPriceBook, runStores, type PriceBook, type PriceMap } from "./pricing.ts";
import { packCanonical, round2 } from "./units.ts";

export const DAYS = ["mon", "tue", "wed", "thu", "fri"];
export const SLOTS = ["breakfast", "lunch", "dinner"] as const;
const SHELF_STABLE_FROM = 3; // thu, fri: freezer + shelf only — perishables are eaten early in the week
const MAX_STRETCH = 1.5; // a perishable pack is only bought if ≥ 2/3 of it is in the plan; the rest is spread over its servings
const MAX_SKU_KCAL_SHARE = 0.35;
const MAX_SAME_DINNER = 2;
export const BAND = 1.03; // near-optimal band: feasible weeks within 3% of the cheapest are all "right"; the seed picks one
const CANDIDATES = 32;
const STEPS = 1000;

// variety floors scale with budget: 8 skus / 2 protein sources at $30, 12 / 3 from $55 up
export const floors = (budget: number) => {
  const t = Math.min(1, Math.max(0, (budget - 30) / 25));
  return { skus: Math.round(8 + 4 * t), proteinSources: budget < 55 ? 2 : 3 };
};
export const isProteinSource = (s: PoolSku) => s.protein_g / s.kcal >= 0.06 && s.protein_g >= 20;

// mulberry32: tiny seeded PRNG, deterministic across runtimes
export function rng(seed: number) {
  let a = (seed >>> 0) + 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// the pool for one price map: every sku priced there, every recipe whose parts pass the diet and the budget
export function buildPool(s: Snapshot, map: PriceMap, diet: Diet, budget: number, templates = templatesOf(s)): Pool {
  const nutrition = new Map(s.nutrition.map((n) => [n.sku_id, n]));
  const skus = new Map<string, PoolSku>();
  for (const k of s.skus) {
    const n = nutrition.get(k.id);
    const p = map.get(k.id);
    if (!n || !p) continue;
    const pc = packCanonical(k);
    const grams = pc * k.grams_per_unit;
    skus.set(k.id, { ...k, packCanonical: pc, packGrams: grams, protein_g: (n.protein_g * grams) / 100, kcal: (n.kcal * grams) / 100, price_usd: p.price_usd, price_as_of: p.as_of, store: p.store });
  }
  const ok = (id: string) => {
    const k = skus.get(id);
    return !!k && k.price_usd <= budget;
  };
  return { templates: templates.filter((t) => dietOk(t, diet) && t.parts.every((p) => ok(p.sku))), skus };
}

export type Ctx = {
  input: SolveInput;
  pool: Pool;
  pantry: Set<string>;
  floors: { skus: number; proteinSources: number };
  pools: Template[][]; // everything, the cheaper half per serving, the cheaper half per gram of protein
};

export function makeCtx(input: SolveInput, pool: Pool): Ctx {
  const sku = pool.skus;
  const price = (t: Template) => t.parts.reduce((a, p) => a + sku.get(p.sku)!.price_usd * p.frac, 0);
  const protein = (t: Template) => t.parts.reduce((a, p) => a + sku.get(p.sku)!.protein_g * p.frac, 0);
  // a small pool makes the search land (diet-restricted weeks always did); the full pool keeps variety.
  const half = (key: (t: Template) => number) => {
    const out: Template[] = [];
    for (const mt of ["breakfast", "lunch", "dinner"] as const) {
      const by = pool.templates.filter((t) => t.meal_type === mt).sort((a, b) => key(a) - key(b));
      out.push(...by.slice(0, Math.ceil(by.length / 2)));
    }
    return out;
  };
  return {
    input,
    pool,
    pantry: new Set(input.pantry ?? []),
    floors: floors(input.budget),
    pools: [pool.templates, half(price), half((t) => price(t) / Math.max(protein(t), 1))],
  };
}

// slot 0 takes breakfasts; slot 1 (lunch) takes lunches and dinners (a dinner at lunch is the doubled dinner);
// slot 2 takes dinners only. thu/fri prefer shelf-stable recipes.
export function options(ctx: Ctx, day: number, slot: number, p: Template[] = ctx.pool.templates): Template[] {
  const want = (t: Template) => (slot === 0 ? t.meal_type === "breakfast" : slot === 1 ? t.meal_type !== "breakfast" : t.meal_type === "dinner");
  const late = day >= SHELF_STABLE_FROM;
  const o = p.filter((t) => want(t) && (!late || t.stable));
  return o.length >= 3 ? o : p.filter(want); // fewer than three shelf-stable options in this pool → allow perishables late
}

export type Evaluation = {
  penalty: number;
  cost: number;
  days: { protein: number; kcal: number }[];
  packs: Map<string, number>;
  used: Map<string, number>; // canonical units used across the week, household included
  shortfall: number;
  proteinSources: number;
  why: string[];
  score: number;
};

// evaluate a week: buy whole packs, stretch perishable portions to finish them, then score every constraint
export function evaluate(week: Week, ctx: Ctx): Evaluation {
  const { input, pantry } = ctx;
  const sku = ctx.pool.skus;
  const people = input.household;
  const used = new Map<string, number>();
  for (const day of week) for (const t of day) for (const p of t.parts) used.set(p.sku, (used.get(p.sku) ?? 0) + p.qty * people);
  const packs = new Map<string, number>();
  let cost = 0;
  let penalty = 0;
  const why: string[] = [];
  const fail = (p: number, w: string) => {
    if (p > 0) {
      penalty += p;
      if (!why.includes(w)) why.push(w);
    }
  };
  const kcalBySku = new Map<string, number>();
  let totalKcal = 0;
  const fracOf = (id: string) => used.get(id)! / sku.get(id)!.packCanonical; // packs used, fractional
  for (const [id] of used) {
    const s = sku.get(id)!;
    const u = fracOf(id);
    const p = Math.ceil(u - 1e-6);
    packs.set(id, p);
    const paid = pantry.has(id) ? 0 : p;
    cost += paid * s.price_usd;
    const eaten = s.perishable ? p : u;
    if (s.perishable) fail(Math.max(0, p / u - MAX_STRETCH), `${label(s)}: more than a third of a pack would go to waste`);
    kcalBySku.set(id, s.kcal * eaten);
    totalKcal += s.kcal * eaten;
  }
  cost = round2(cost);
  const stretch = (id: string) => (sku.get(id)!.perishable ? packs.get(id)! / fracOf(id) : 1);
  const days = week.map((day) => {
    let protein = 0;
    let kcal = 0;
    for (const t of day) for (const p of t.parts) {
      const s = sku.get(p.sku)!;
      protein += s.protein_g * p.frac * stretch(p.sku);
      kcal += s.kcal * p.frac * stretch(p.sku);
    }
    return { protein, kcal };
  });
  let shortfall = 0;
  for (const d of days) {
    shortfall += Math.max(0, input.protein_per_day - d.protein);
    fail(Math.max(0, input.protein_per_day - d.protein) / input.protein_per_day, "protein target");
    fail(Math.max(0, input.kcal_min - d.kcal) / input.kcal_min, "calories under the band");
    fail(Math.max(0, d.kcal - input.kcal_max) / input.kcal_max, "calories over the band");
  }
  fail(cost > input.budget ? (5 * (cost - input.budget)) / input.budget + 0.5 : 0, "budget"); // heavy: overspending outranks a protein dip
  fail(Math.max(0, ctx.floors.skus - used.size) * 0.2, `fewer than ${ctx.floors.skus} different items`);
  const proteinSources = [...used.keys()].filter((id) => isProteinSource(sku.get(id)!)).length;
  fail(Math.max(0, ctx.floors.proteinSources - proteinSources) * 0.3, `fewer than ${ctx.floors.proteinSources} protein sources`);
  for (const [id, k] of kcalBySku) fail(Math.max(0, k / totalKcal - MAX_SKU_KCAL_SHARE), `${label(sku.get(id)!)} is over a third of the week's calories`);
  const dinners = new Map<string, { n: number; name: string }>();
  for (const day of week) {
    const t = day[2];
    const d = dinners.get(t.base_id) ?? { n: 0, name: t.name };
    d.n++;
    dinners.set(t.base_id, d);
  }
  for (const d of dinners.values()) fail(Math.max(0, d.n - MAX_SAME_DINNER) * 0.3, `${d.name} more than twice for dinner`);
  return { penalty, cost, days, packs, used, shortfall, proteinSources, why, score: penalty * 1000 + cost };
}

const label = (s: PoolSku) => s.name.split(",")[0];

export type Result = { week: Week; ev: Evaluation };

// seeded local search from several random starts; keep every candidate's best. `fixed` pins slots (regenerate).
export function anneal(ctx: Ctx, seed: number, fixed?: { week: Week; free: [number, number][] }): Result[] {
  const rand = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const results: Result[] = [];
  const freeSlots = fixed?.free ?? DAYS.flatMap((_, d) => SLOTS.map((_, s) => [d, s] as [number, number]));
  const isFree = (d: number, s: number) => !fixed || fixed.free.some(([fd, fs]) => fd === d && fs === s);
  for (let c = 0; c < CANDIDATES; c++) {
    const p = ctx.pools[c % ctx.pools.length];
    let week: Week = fixed
      ? fixed.week.map((day, d) => day.map((t, s) => (isFree(d, s) ? pick(options(ctx, d, s, p)) : t)))
      : DAYS.map((_, d) => SLOTS.map((_, s) => pick(options(ctx, d, s, p))));
    let ev = evaluate(week, ctx);
    let best = { week, ev };
    for (let i = 0; i < STEPS; i++) {
      const [d, s] = freeSlots[Math.floor(rand() * freeSlots.length)];
      let next: Week;
      if (rand() < 0.5) {
        next = week.map((day, di) => (di === d ? day.map((t, si) => (si === s ? pick(options(ctx, d, s, p)) : t)) : day));
      } else {
        // every free slot that uses this template → another (moves whole packs, which single swaps rarely do)
        const from = week[d][s];
        const to = pick(options(ctx, d, s, p));
        next = week.map((day, di) => day.map((t, si) => (t === from && isFree(di, si) && options(ctx, di, si, p).includes(to) ? to : t)));
      }
      const nev = evaluate(next, ctx);
      const temp = 400 * (1 - i / STEPS) ** 2 + 0.5; // annealing: accept a slightly worse week early on
      if (nev.score <= ev.score || rand() < Math.exp((ev.score - nev.score) / temp)) {
        week = next;
        ev = nev;
        if (ev.score < best.ev.score) best = { week, ev };
      }
    }
    results.push(best);
  }
  return results;
}

// among feasible results pick inside the band by the rng; otherwise the best score
export function choose(results: Result[], rand: () => number): Result {
  const feasibleOnes = results.filter((r) => r.ev.penalty === 0).sort((a, b) => a.ev.cost - b.ev.cost);
  if (feasibleOnes.length) {
    const band = feasibleOnes.filter((r) => r.ev.cost <= feasibleOnes[0].ev.cost * BAND);
    return band[Math.floor(rand() * band.length)];
  }
  return [...results].sort((a, b) => a.ev.score - b.ev.score)[0];
}

// list arithmetic for a set of packs against one price map (alt_total, store subtotals)
function listTotal(packs: Map<string, number>, pantry: Set<string>, map: PriceMap) {
  let t = 0;
  for (const [id, p] of packs) if (!pantry.has(id)) t += p * (map.get(id)?.price_usd ?? 0);
  return round2(t);
}

export function toOutput(week: Week, ev: Evaluation, ctx: Ctx, seed: number, book: PriceBook, s: Snapshot): SolveOutput {
  const sku = ctx.pool.skus;
  const pantry = ctx.pantry;
  const fracOf = (id: string) => ev.used.get(id)! / sku.get(id)!.packCanonical;
  const stretch = (id: string) => (sku.get(id)!.perishable ? ev.packs.get(id)! / fracOf(id) : 1);
  // per-serving cost share: paid packs spread over the servings that eat them
  const shareOf = (id: string) => {
    const k = sku.get(id)!;
    if (pantry.has(id)) return 0;
    const packsPaid = ev.packs.get(id)!;
    const servingsPacks = fracOf(id);
    return k.perishable ? (packsPaid * k.price_usd) / servingsPacks : k.price_usd; // per pack-fraction actually eaten
  };
  const days = week.map((day, di) => ({
    day: DAYS[di],
    items: day.map((t, si): PlanItem => {
      let protein = 0;
      let kcal = 0;
      let cost = 0;
      for (const p of t.parts) {
        const k = sku.get(p.sku)!;
        protein += k.protein_g * p.frac * stretch(p.sku);
        kcal += k.kcal * p.frac * stretch(p.sku);
        cost += shareOf(p.sku) * p.frac;
      }
      return {
        name: t.name,
        unit: SLOTS[si],
        portion: t.parts.map((p) => `${label(sku.get(p.sku)!)} ${fraction(p.frac * stretch(p.sku))}`).join(" · "),
        protein_g: Math.round(protein),
        kcal: Math.round(kcal),
        recipe_id: t.id,
        cost_usd: round2(cost),
      };
    }),
    protein_g: Math.round(ev.days[di].protein),
    kcal: Math.round(ev.days[di].kcal),
  }));
  const list: ListItem[] = [...ev.packs]
    .map(([id, p]) => {
      const k = sku.get(id)!;
      const inPantry = pantry.has(id);
      return {
        name: k.name,
        unit: k.pack_label,
        qty: p,
        price_usd: inPantry ? 0 : round2(p * k.price_usd),
        perishable: k.perishable,
        eaten: round2(k.perishable ? p : fracOf(id)),
        sku_id: id,
        aisle: k.aisle,
        store: k.store,
        pantry: inPantry,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
  const storeIds = [...new Set(list.map((i) => i.store))];
  const stores = storeIds.map((id) => ({
    id,
    banner: s.stores.find((st) => st.id === id)?.banner ?? id,
    subtotal: round2(list.filter((i) => i.store === id).reduce((a, i) => a + i.price_usd, 0)),
    items: list.filter((i) => i.store === id).length,
  }));
  let alt_total: number | undefined;
  if (book.modesAvailable.length === 2) {
    if (book.mode === "bestPerItem") alt_total = Math.min(...book.live.map((st) => listTotal(ev.packs, pantry, book.maps.get(st.id)!)));
    else alt_total = listTotal(ev.packs, pantry, book.maps.get("__min__")!);
  }
  return {
    feasible: ev.penalty === 0,
    days,
    list,
    est_total: ev.cost,
    protein_per_day: Math.floor(Math.min(...ev.days.map((d) => d.protein))),
    kcal_per_day: Math.round(ev.days.reduce((a, d) => a + d.kcal, 0) / DAYS.length),
    protein_shortfall_g: Math.round(ev.shortfall),
    price_as_of: list.map((i) => sku.get(i.sku_id)!.price_as_of).sort()[0] ?? s.generated_at,
    distinct_skus: list.length,
    protein_sources: ev.proteinSources,
    seed,
    why: ev.why,
    input: ctx.input,
    store_mode: book.mode,
    modes_available: book.modesAvailable,
    stores,
    alt_total,
  };
}

// "1/4" for quarter-packs, "1 pack" / "2 packs" for whole ones, "0.40" for odd stretched shares
export function fraction(f: number): string {
  for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 30, 32, 40]) {
    const n = f * d;
    if (Math.abs(n - Math.round(n)) < 0.02) return d === 1 ? `${Math.round(n)} pack${n > 1.5 ? "s" : ""}` : `${Math.round(n)}/${d}`;
  }
  return f.toFixed(2);
}

// one full solve: singleStore runs the search once per live store and keeps the cheapest feasible week
export function solve(input: SolveInput, s: Snapshot): SolveOutput {
  const seed = input.seed ?? 0;
  const book = buildPriceBook(s, input);
  const templates = templatesOf(s);
  let best: { out: SolveOutput; ev: Evaluation } | undefined;
  for (const run of runStores(book)) {
    const ctx = makeCtx(input, buildPool(s, book.maps.get(run.mapKey)!, input.diet, input.budget, templates));
    if (!ctx.pool.templates.length) continue;
    const results = anneal(ctx, seed);
    const { week, ev } = choose(results, rng(seed ^ 0x5bd1e995));
    const out = toOutput(week, ev, ctx, seed, book, s);
    if (!best || ev.score < best.ev.score) best = { out, ev };
  }
  if (!best) throw new Error("no recipe fits this diet at these stores");
  return best.out;
}

// a fixed week (recipe ids [day][slot]) priced and scored without search (fixtures, tests)
export function evaluateWeek(ids: string[][], input: SolveInput, s: Snapshot): SolveOutput {
  const seed = input.seed ?? 0;
  const book = buildPriceBook(s, input);
  const run = runStores(book)[0];
  const ctx = makeCtx(input, buildPool(s, book.maps.get(run.mapKey)!, input.diet, input.budget));
  const week = weekFrom(ids, ctx);
  return toOutput(week, evaluate(week, ctx), ctx, seed, book, s);
}

export function weekFrom(ids: string[][], ctx: Ctx): Week {
  const byId = new Map(ctx.pool.templates.map((t) => [t.id, t]));
  return ids.map((day) =>
    day.map((id) => {
      const t = byId.get(id);
      if (!t) throw new Error(`recipe ${id} is not in the pool for this diet, budget and store`);
      return t;
    }),
  );
}

// rebuild the internal context a solved week was produced under (same stores, same map, same pool)
export function ctxFor(week: SolveOutput, s: Snapshot): { ctx: Ctx; book: PriceBook; internal: Week } {
  const book = buildPriceBook(s, week.input);
  const mapKey = week.store_mode === "bestPerItem" ? "__min__" : week.store_mode === "singleStore" ? (week.stores[0]?.id ?? book.live[0].id) : book.stores[0].id;
  const ctx = makeCtx(week.input, buildPool(s, book.maps.get(mapKey)!, week.input.diet, week.input.budget));
  const internal = weekFrom(
    week.days.map((d) => d.items.map((i) => i.recipe_id)),
    ctx,
  );
  return { ctx, book, internal };
}

export type { DietFlag };
