import type { MenuItem } from "./menu";
import week1 from "./fixture-week.json" with { type: "json" };
import week2 from "./fixture-week-2.json" with { type: "json" };

// hand-authored solved weeks (REDESIGN-V4 §4, written by scripts/gen-fixtures.ts). every number on the site's app
// screens, the share pages and the pre-order band reads from here; the site never runs the solver for a visitor.
export type FixtureMeal = { slot: "breakfast" | "lunch" | "dinner"; menu: MenuItem["id"]; name: string; protein_g: number; cost_usd: number; img: string };
export type FixtureDay = { day: "mon" | "tue" | "wed" | "thu" | "fri"; meals: FixtureMeal[]; protein_g: number; cost_usd: number };
export type FixtureWeek = {
  id: string;
  budget_usd: number;
  protein_goal_g: number;
  generated_at: string;
  days: FixtureDay[];
  totals: { est_total_usd: number; protein_per_day_g: number; under_budget_by_usd: number; waste_lb: number; items: number };
  list: {
    items: { name: string; aisle: "meat" | "dairy" | "pantry" | "frozen" | "produce"; price_usd: number; checked: boolean }[];
    est_total_usd: number;
    delivery_est_usd: number;
    delivery_saves_usd: number;
    delivery_label: string;
  };
  receipt: { estimated_usd: number; actual_usd: number; delta_pct: number; accuracy_pct: number; verified: boolean };
};

export const fixtureWeek = week1 as FixtureWeek;
export const fixtureWeek2 = week2 as FixtureWeek; // the "regenerate" state (S6) — different dinners, same budget
export const fixtures: Record<string, FixtureWeek> = { [fixtureWeek.id]: fixtureWeek, [fixtureWeek2.id]: fixtureWeek2 };

export const usd = (n: number) => `$${n.toFixed(2)}`;
