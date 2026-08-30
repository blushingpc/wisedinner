import type { Staple } from "../../../data/staples.ts";

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
};

export type PlanItem = {
  name: string;
  unit: string;
  portion: string; // the household's share of the pack that day, e.g. "1/3 of pack"
  protein_g: number; // per person
  kcal: number; // per person
};

export type ListItem = {
  name: string;
  unit: string;
  qty: number;
  price_usd: number; // qty × unit price
  perishable: boolean;
};

export type SolveOutput = {
  feasible: boolean; // every day meets protein and kcal range, and the list fits the budget
  days: { day: string; items: PlanItem[]; protein_g: number; kcal: number }[]; // per person
  list: ListItem[];
  est_total: number; // est. in-store shelf total, buffered prices
  protein_per_day: number; // achieved on the weakest day, per person
  kcal_per_day: number; // weekly average, per person
  protein_shortfall_g: number; // grams still missing across the week when infeasible
  price_as_of: string; // oldest price date in the list
};

const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const MAX_UNITS_PER_SKU = 2; // per bucket (mon–wed, thu–fri)
// a "protein source" carries at least 6 g protein per 100 kcal and 20 g per pack (beans and eggs yes; rice, oil, condiments no)
const isProteinSource = (s: Staple) => s.protein_g / s.kcal >= 0.06 && s.protein_g >= 20;

export function solve(input: SolveInput, staples: Staple[]): SolveOutput {
  const people = input.household;
  const pantry = new Set(input.pantry ?? []);
  const pool = staples
    .filter((s) => input.diet === "none" || s.diet_flags.includes(input.diet))
    .map((s) => (pantry.has(s.name) ? { ...s, price_usd: 0 } : s))
    .filter((s) => s.price_usd <= input.budget)
    .sort((a, b) => a.name.localeCompare(b.name)); // stable order → deterministic ties
  const perDollar = (value: number, s: Staple) => value / Math.max(s.price_usd, 0.01); // pantry packs are free

  const qty = new Map<string, number>();
  let cost = 0;
  let feasible = true;
  let shortfall = 0;
  const days = DAYS.map((day) => ({ day, items: [] as PlanItem[], protein_g: 0, kcal: 0 }));

  // perishables are eaten mon–wed; thu–fri get shelf-stable food only, so solve them first — they are the hard part
  const buckets = [
    { slots: days.slice(3), pool: pool.filter((s) => !s.perishable) },
    { slots: days.slice(0, 3), pool },
  ];

  for (const bucket of buckets) {
    const n = bucket.slots.length;
    const needProtein = input.protein_per_day * n * people;
    const needKcalMin = input.kcal_min * n * people;
    const needKcalMax = input.kcal_max * n * people;
    const picked = new Map<string, number>();
    let protein = 0;
    let kcal = 0;

    const add = (s: Staple) => {
      qty.set(s.name, (qty.get(s.name) ?? 0) + 1);
      picked.set(s.name, (picked.get(s.name) ?? 0) + 1);
      cost = round2(cost + s.price_usd);
      protein += s.protein_g;
      kcal += s.kcal;
    };
    const remove = (s: Staple) => {
      qty.set(s.name, (qty.get(s.name) ?? 0) - 1);
      picked.set(s.name, (picked.get(s.name) ?? 0) - 1);
      cost = round2(cost - s.price_usd);
      protein -= s.protein_g;
      kcal -= s.kcal;
    };
    const canAdd = (s: Staple) =>
      (pantry.has(s.name) ? (qty.get(s.name) ?? 0) < 1 : (picked.get(s.name) ?? 0) < MAX_UNITS_PER_SKU) &&
      round2(cost + s.price_usd) <= input.budget;

    // pass 1: protein — best protein per dollar first, until the bucket's target is met
    const proteinSources = bucket.pool
      .filter(isProteinSource)
      .sort((a, b) => perDollar(b.protein_g, b) - perDollar(a.protein_g, a));
    while (protein < needProtein) {
      const next = proteinSources.find(canAdd);
      if (!next) break;
      add(next);
    }

    // pass 2: kcal — cheapest calories first, whole packages only, never past the ceiling
    const byKcalPerDollar = [...bucket.pool].sort((a, b) => perDollar(b.kcal, b) - perDollar(a.kcal, a));
    while (kcal < needKcalMin) {
      const next = byKcalPerDollar.find((s) => canAdd(s) && kcal + s.kcal <= needKcalMax);
      if (!next) break;
      add(next);
    }

    // repair: over the ceiling → drop the least protein-dense picks while protein and the floor still hold
    const byDensity = [...bucket.pool].sort((a, b) => a.protein_g / a.kcal - b.protein_g / b.kcal);
    for (const s of byDensity) {
      while (
        kcal > needKcalMax &&
        (picked.get(s.name) ?? 0) > 0 &&
        protein - s.protein_g >= needProtein &&
        kcal - s.kcal >= needKcalMin
      ) {
        remove(s);
      }
    }

    // spread the bucket's packs evenly over its days
    for (const s of bucket.pool) {
      const units = picked.get(s.name) ?? 0;
      if (units === 0) continue;
      const share = units / n / people;
      for (const d of bucket.slots) {
        d.items.push({
          name: s.name,
          unit: s.unit,
          portion: portionLabel(units, n),
          protein_g: round(s.protein_g * share),
          kcal: round(s.kcal * share),
        });
        d.protein_g += s.protein_g * share;
        d.kcal += s.kcal * share;
      }
    }

    feasible = feasible && protein >= needProtein && kcal >= needKcalMin && kcal <= needKcalMax;
    shortfall += Math.max(0, needProtein - protein);
  }

  const worstDay = Math.min(...days.map((d) => d.protein_g));
  for (const d of days) {
    d.protein_g = round(d.protein_g);
    d.kcal = round(d.kcal);
  }

  const chosen = pool.filter((s) => (qty.get(s.name) ?? 0) > 0);
  const list: ListItem[] = chosen.map((s) => ({
    name: s.name,
    unit: s.unit,
    qty: qty.get(s.name) ?? 0,
    price_usd: round2(s.price_usd * (qty.get(s.name) ?? 0)),
    perishable: s.perishable,
  }));

  return {
    feasible: feasible && cost <= input.budget,
    days,
    list,
    est_total: cost,
    protein_per_day: Math.floor(worstDay),
    kcal_per_day: round(days.reduce((a, d) => a + d.kcal, 0) / DAYS.length),
    protein_shortfall_g: round(shortfall),
    price_as_of: chosen.map((s) => s.price_as_of).sort()[0] ?? "",
  };
}

function portionLabel(units: number, days: number): string {
  if (units % days === 0) return units === days ? "1 pack" : `${units / days} packs`;
  return `${units}/${days} of pack`;
}

function round(n: number): number {
  return Math.round(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
