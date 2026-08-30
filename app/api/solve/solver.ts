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
};

export type PlanItem = {
  name: string;
  unit: string;
  portion: string; // "1/3 of pack"
  protein_g: number;
  kcal: number;
};

export type ListItem = {
  name: string;
  unit: string;
  qty: number;
  price_usd: number; // qty × unit price
  perishable: boolean;
};

export type SolveOutput = {
  feasible: boolean;
  days: { day: string; items: PlanItem[]; protein_g: number; kcal: number }[];
  list: ListItem[];
  est_total: number; // est. in-store shelf total, buffered prices
  protein_per_day: number; // achieved, per person
  kcal_per_day: number; // achieved, per person
  protein_shortfall_g: number; // weekly grams still missing when infeasible
  price_as_of: string; // oldest price date in the list
};

const DAYS = ["mon", "tue", "wed", "thu", "fri"];
const MAX_UNITS_PER_SKU = 2;
// a "protein source" carries at least 6 g protein per 100 kcal (eggs, beans, milk qualify; rice, pasta, oils don't)
const PROTEIN_DENSITY_MIN = 0.06;

export function solve(input: SolveInput, staples: Staple[]): SolveOutput {
  const people = input.household;
  const needProtein = input.protein_per_day * DAYS.length * people;
  const needKcalMin = input.kcal_min * DAYS.length * people;
  const needKcalMax = input.kcal_max * DAYS.length * people;

  const pool = staples
    .filter((s) => input.diet === "none" || s.diet_flags.includes(input.diet))
    .filter((s) => s.price_usd <= input.budget)
    .sort((a, b) => a.name.localeCompare(b.name)); // stable order → deterministic ties

  const qty = new Map<string, number>();
  let cost = 0;
  let protein = 0;
  let kcal = 0;

  const add = (s: Staple) => {
    qty.set(s.name, (qty.get(s.name) ?? 0) + 1);
    cost += s.price_usd;
    protein += s.protein_g;
    kcal += s.kcal;
  };
  const remove = (s: Staple) => {
    qty.set(s.name, (qty.get(s.name) ?? 0) - 1);
    cost -= s.price_usd;
    protein -= s.protein_g;
    kcal -= s.kcal;
  };
  const canAdd = (s: Staple) =>
    (qty.get(s.name) ?? 0) < MAX_UNITS_PER_SKU && cost + s.price_usd <= input.budget;

  // pass 1: protein — best protein per dollar first, until the weekly target is met
  const proteinSources = pool
    .filter((s) => s.protein_g / s.kcal >= PROTEIN_DENSITY_MIN)
    .sort((a, b) => b.protein_g / b.price_usd - a.protein_g / a.price_usd);
  while (protein < needProtein) {
    const next = proteinSources.find(canAdd);
    if (!next) break;
    add(next);
  }

  // pass 2: kcal — cheapest calories first, whole packages only, never past the weekly ceiling
  const byKcalPerDollar = [...pool].sort((a, b) => b.kcal / b.price_usd - a.kcal / a.price_usd);
  while (kcal < needKcalMin) {
    const next = byKcalPerDollar.find((s) => canAdd(s) && kcal + s.kcal <= needKcalMax);
    if (!next) break;
    add(next);
  }

  // repair: over the kcal ceiling → drop the least protein-dense items while protein and the kcal floor still hold
  const byDensity = [...pool].sort((a, b) => a.protein_g / a.kcal - b.protein_g / b.kcal);
  for (const s of byDensity) {
    while (
      kcal > needKcalMax &&
      (qty.get(s.name) ?? 0) > 0 &&
      protein - s.protein_g >= needProtein &&
      kcal - s.kcal >= needKcalMin
    ) {
      remove(s);
    }
  }

  const chosen = pool.filter((s) => (qty.get(s.name) ?? 0) > 0);

  // 5-day split: perishables are eaten mon–wed, everything else spreads across the week
  const days = DAYS.map((day) => ({ day, items: [] as PlanItem[], protein_g: 0, kcal: 0 }));
  for (const s of chosen) {
    const n = qty.get(s.name) ?? 0;
    const slots = s.perishable ? days.slice(0, 3) : days;
    const share = n / slots.length;
    for (const d of slots) {
      const item: PlanItem = {
        name: s.name,
        unit: s.unit,
        portion: portionLabel(n, slots.length),
        protein_g: round(s.protein_g * share),
        kcal: round(s.kcal * share),
      };
      d.items.push(item);
      d.protein_g += item.protein_g;
      d.kcal += item.kcal;
    }
  }

  const list: ListItem[] = chosen.map((s) => ({
    name: s.name,
    unit: s.unit,
    qty: qty.get(s.name) ?? 0,
    price_usd: round2(s.price_usd * (qty.get(s.name) ?? 0)),
    perishable: s.perishable,
  }));

  return {
    feasible: protein >= needProtein && cost <= input.budget,
    days,
    list,
    est_total: round2(cost),
    protein_per_day: round(protein / DAYS.length / people),
    kcal_per_day: round(kcal / DAYS.length / people),
    protein_shortfall_g: Math.max(0, round(needProtein - protein)),
    price_as_of: chosen.map((s) => s.price_as_of).sort()[0] ?? "",
  };
}

function portionLabel(units: number, slots: number): string {
  if (units % slots === 0) return `${units / slots} of pack`;
  return `${units}/${slots} of pack`;
}

function round(n: number): number {
  return Math.round(n);
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
