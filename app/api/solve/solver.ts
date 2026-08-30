import type { Staple } from "../../../data/staples.ts";
import { TEMPLATES, type Template } from "../../../data/templates.ts";

export const DIETS = ["none", "vegetarian", "vegan", "gluten-free", "dairy-free"] as const;
export type Diet = (typeof DIETS)[number];

export type SolveInput = {
  budget: number; // weekly, USD
  protein_per_day: number; // grams, per person
  kcal_min: number; // per person per day
  kcal_max: number;
  diet: Diet;
  household: number; // people eating
  pantry?: string[]; // staple names already owned: one free pack each
  seed?: number; // picks among near-optimal weeks; same seed → same week
};

export type PlanItem = {
  name: string; // meal name
  unit: string; // slot: breakfast | lunch | dinner
  portion: string; // ingredients as pack fractions per person, e.g. "oats 1/12 · whey 1/30"
  protein_g: number; // per person
  kcal: number; // per person
};

export type ListItem = { name: string; unit: string; qty: number; price_usd: number; perishable: boolean; eaten: number }; // eaten: packs consumed this week (shelf-stable leftovers carry over)

export type SolveOutput = {
  feasible: boolean; // every day in range, every variety floor met, list under budget
  days: { day: string; items: PlanItem[]; protein_g: number; kcal: number }[]; // per person
  list: ListItem[];
  est_total: number; // est. in-store shelf total, buffered prices, whole packs
  protein_per_day: number; // achieved on the weakest day, per person
  kcal_per_day: number; // weekly average, per person
  protein_shortfall_g: number; // grams still missing across the week when infeasible
  price_as_of: string; // oldest price date in the list
  distinct_skus: number;
  protein_sources: number;
  seed: number;
  why: string[]; // constraints still violated when infeasible (plain words)
};

const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const SLOTS = ["breakfast", "lunch", "dinner"] as const;
const SHELF_STABLE_FROM = 3; // thu, fri: freezer + shelf only — perishables are eaten early in the week
const MAX_STRETCH = 1.5; // a PERISHABLE pack is only bought if ≥ 2/3 of it is in the plan; the rest is spread over its servings so the fridge is empty by friday. shelf-stable packs carry over to next week — bought whole, counted in the total, only the used share eaten.
const MAX_SKU_KCAL_SHARE = 0.35;
const MAX_SAME_DINNER = 2;
const BAND = 1.03; // near-optimal band: feasible weeks within 3% of the cheapest are all "right"; the seed picks one
const CANDIDATES = 32;
const STEPS = 1000;

// variety floors scale with budget: 8 skus / 2 protein sources at $30, 12 / 3 from $55 up
export const floors = (budget: number) => {
  const t = Math.min(1, Math.max(0, (budget - 30) / 25));
  return { skus: Math.round(8 + 4 * t), proteinSources: budget < 55 ? 2 : 3 };
};
const isProteinSource = (s: Staple) => s.protein_g / s.kcal >= 0.06 && s.protein_g >= 20;

// mulberry32: tiny seeded PRNG, deterministic across runtimes
function rng(seed: number) {
  let a = (seed >>> 0) + 0x9e3779b9;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Week = Template[][]; // [day][slot]

export function solve(input: SolveInput, staples: Staple[]): SolveOutput {
  const people = input.household;
  const seed = input.seed ?? 0;
  const pantry = new Set(input.pantry ?? []);
  const sku = new Map(staples.map((s) => [s.name, s]));
  const ok = (s: Staple) => (input.diet === "none" || s.diet_flags.includes(input.diet)) && s.price_usd <= input.budget;
  const pool = TEMPLATES.filter((t) => t.parts.every(([n]) => sku.has(n) && ok(sku.get(n)!)));
  const stable = (t: Template) => t.parts.every(([n]) => !sku.get(n)!.perishable);
  const price = (t: Template) => t.parts.reduce((a, [n, f]) => a + sku.get(n)!.price_usd * f, 0);
  const protein = (t: Template) => t.parts.reduce((a, [n, f]) => a + sku.get(n)!.protein_g * f, 0);
  // three pools: everything, the cheaper half per serving, the cheaper half per gram of protein.
  // a small pool makes the search land (diet-restricted weeks always did); the full pool keeps variety.
  const half = (key: (t: Template) => number) => {
    const by = (slot: Template["slot"]) => [...pool].filter((t) => t.slot === slot).sort((a, b) => key(a) - key(b));
    return [...by("breakfast").slice(0, Math.ceil(by("breakfast").length / 2)), ...by("main").slice(0, Math.ceil(by("main").length / 2))];
  };
  const pools = [pool, half(price), half((t) => price(t) / Math.max(protein(t), 1))];
  const options = (day: number, slot: number, p = pool) => {
    const want = slot === 0 ? "breakfast" : "main";
    const late = day >= SHELF_STABLE_FROM;
    const o = p.filter((t) => t.slot === want && (!late || stable(t)));
    return o.length ? o : p.filter((t) => t.slot === want); // no shelf-stable option in this pool → allow perishables late
  };
  const { skus: minSkus, proteinSources: minProtein } = floors(input.budget);

  // evaluate a week: buy whole packs, stretch portions to finish them, then score every constraint
  const evaluate = (week: Week) => {
    const used = new Map<string, number>();
    for (const day of week) for (const t of day) for (const [n, f] of t.parts) used.set(n, (used.get(n) ?? 0) + f * people);
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
    for (const [n, u] of used) {
      const s = sku.get(n)!;
      const p = Math.ceil(u - 1e-9);
      packs.set(n, p);
      const paid = pantry.has(n) ? Math.max(0, p - 1) : p;
      cost += paid * s.price_usd;
      const eaten = s.perishable ? p : u;
      if (s.perishable) fail(Math.max(0, p / u - MAX_STRETCH), `${n.split(",")[0]}: more than a third of a pack would go to waste`);
      kcalBySku.set(n, s.kcal * eaten);
      totalKcal += s.kcal * eaten;
    }
    cost = round2(cost);
    const stretch = (n: string) => (sku.get(n)!.perishable ? packs.get(n)! / used.get(n)! : 1);
    const days = week.map((day) => {
      let protein = 0;
      let kcal = 0;
      for (const t of day) for (const [n, f] of t.parts) {
        const s = sku.get(n)!;
        protein += s.protein_g * f * stretch(n);
        kcal += s.kcal * f * stretch(n);
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
    fail(cost > input.budget ? (5 * (cost - input.budget)) / input.budget + 0.5 : 0, "budget"); // heavy: overspending outranks a protein dip on the way to a cheaper week
    fail(Math.max(0, minSkus - used.size) * 0.2, `fewer than ${minSkus} different items`);
    const proteinSources = [...used.keys()].filter((n) => isProteinSource(sku.get(n)!)).length;
    fail(Math.max(0, minProtein - proteinSources) * 0.3, `fewer than ${minProtein} protein sources`);
    for (const [n, k] of kcalBySku) fail(Math.max(0, k / totalKcal - MAX_SKU_KCAL_SHARE), `${n.split(",")[0]} is over a third of the week's calories`);
    const dinners = new Map<string, number>();
    for (const day of week) dinners.set(day[2].name, (dinners.get(day[2].name) ?? 0) + 1);
    for (const [n, c] of dinners) fail(Math.max(0, c - MAX_SAME_DINNER) * 0.3, `${n} more than twice for dinner`);
    return { penalty, cost, days, packs, used, shortfall, proteinSources, why, score: penalty * 1000 + cost };
  };

  // seeded local search from several random starts; keep every feasible result
  const rand = rng(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rand() * arr.length)];
  const results: { week: Week; ev: ReturnType<typeof evaluate> }[] = [];
  for (let c = 0; c < CANDIDATES; c++) {
    const p = pools[c % pools.length];
    let week: Week = DAYS.map((_, d) => SLOTS.map((_, s) => pick(options(d, s, p))));
    let ev = evaluate(week);
    let best = { week, ev };
    for (let i = 0; i < STEPS; i++) {
      const d = Math.floor(rand() * DAYS.length);
      const s = Math.floor(rand() * SLOTS.length);
      let next: Week;
      if (rand() < 0.5) {
        // one slot
        next = week.map((day, di) => (di === d ? day.map((t, si) => (si === s ? pick(options(d, s, p)) : t)) : day));
      } else {
        // every slot that uses this template → another (moves whole packs, which single swaps rarely do)
        const from = week[d][s];
        const to = pick(options(d, s, p));
        next = week.map((day, di) => day.map((t, si) => (t === from && options(di, si, p).includes(to) ? to : t)));
      }
      const nev = evaluate(next);
      // annealing: early on, accept a slightly worse week sometimes so the search can leave a local minimum
      const temp = 400 * (1 - i / STEPS) ** 2 + 0.5;
      if (nev.score <= ev.score || rand() < Math.exp((ev.score - nev.score) / temp)) {
        week = next;
        ev = nev;
        if (ev.score < best.ev.score) best = { week, ev };
      }
    }
    results.push(best);
  }
  const feasibleOnes = results.filter((r) => r.ev.penalty === 0).sort((a, b) => a.ev.cost - b.ev.cost);
  let chosen: (typeof results)[number];
  if (feasibleOnes.length) {
    const band = feasibleOnes.filter((r) => r.ev.cost <= feasibleOnes[0].ev.cost * BAND);
    chosen = band[Math.floor(rand() * band.length)];
  } else {
    chosen = results.sort((a, b) => a.ev.score - b.ev.score)[0];
  }
  const { week, ev } = chosen;
  const stretch = (n: string) => (sku.get(n)!.perishable ? ev.packs.get(n)! / ev.used.get(n)! : 1);

  const days = week.map((day, di) => ({
    day: DAYS[di],
    items: day.map((t, si) => {
      let protein = 0;
      let kcal = 0;
      for (const [n, f] of t.parts) {
        protein += sku.get(n)!.protein_g * f * stretch(n);
        kcal += sku.get(n)!.kcal * f * stretch(n);
      }
      return {
        name: t.name,
        unit: SLOTS[si],
        portion: t.parts.map(([n, f]) => `${n.split(",")[0]} ${fraction(f * stretch(n))}`).join(" · "),
        protein_g: round(protein),
        kcal: round(kcal),
      };
    }),
    protein_g: round(ev.days[di].protein),
    kcal: round(ev.days[di].kcal),
  }));

  const list: ListItem[] = [...ev.packs]
    .map(([n, p]) => {
      const s = sku.get(n)!;
      const paid = pantry.has(n) ? Math.max(0, p - 1) : p;
      return { name: n, unit: s.unit, qty: p, price_usd: round2(paid * s.price_usd), perishable: s.perishable, eaten: round2(s.perishable ? p : ev.used.get(n)!) };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    feasible: ev.penalty === 0,
    days,
    list,
    est_total: ev.cost,
    protein_per_day: Math.floor(Math.min(...ev.days.map((d) => d.protein))),
    kcal_per_day: round(ev.days.reduce((a, d) => a + d.kcal, 0) / DAYS.length),
    protein_shortfall_g: round(ev.shortfall),
    price_as_of: list.map((i) => sku.get(i.name)!.price_as_of).sort()[0] ?? "",
    distinct_skus: list.length,
    protein_sources: ev.proteinSources,
    seed,
    why: ev.why,
  };
}

// "1/4" for quarter-packs, "1 pack" / "2 packs" for whole ones, "0.4" for odd stretched shares
function fraction(f: number): string {
  for (const d of [1, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 20, 24, 30, 32, 40]) {
    const n = f * d;
    if (Math.abs(n - Math.round(n)) < 0.02) return d === 1 ? `${Math.round(n)} pack${n > 1.5 ? "s" : ""}` : `${Math.round(n)}/${d}`;
  }
  return f.toFixed(2);
}
const round = (n: number) => Math.round(n);
const round2 = (n: number) => Math.round(n * 100) / 100;
