import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Header, Pill, Screen, TabBar } from "./chrome";
import { MealCard } from "./meal-card";
import { StatusBar } from "@/app/ui/device-frame";

const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
const LABEL: Record<(typeof DAYS)[number], string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" };

// S1 THIS WEEK (REDESIGN-V3 §3). also S6 when fed the regenerate fixture.
export function ThisWeek({ week, active = "tue", priority = false }: { week: FixtureWeek; active?: (typeof DAYS)[number]; priority?: boolean }) {
  const day = week.days.find((d) => d.day === active) ?? week.days[0];
  return (
    <Screen>
      <StatusBar />
      <Header title="this week" right={<Pill>{usd(week.totals.est_total_usd)} · one trip</Pill>} />
      <div className="mt-[1em] flex gap-[0.5em] px-[1.25em]">
        {DAYS.map((d) => (
          <span key={d} className={`flex-1 rounded-full py-[0.45em] text-center text-[0.8125em] font-semibold ${d === active ? "bg-ink text-bg" : "bg-bg-alt text-ink-soft"}`}>
            {LABEL[d]}
          </span>
        ))}
      </div>
      <div className="mt-[1em] grid gap-[0.625em] px-[1.25em]">
        {day.meals.map((m) => (
          <MealCard key={m.slot} meal={m} priority={priority} />
        ))}
      </div>
      {/* the Three Checks — under budget ✓ · protein hit ✓ · zero waste ✓, in kale */}
      <div className="mx-[1.25em] mt-[1em] grid grid-cols-3 gap-[0.25em] rounded-[0.875em] bg-green-050 px-[0.5em] py-[0.75em] text-center text-kale">
        <Check big="under budget" small={`by ${usd(week.totals.under_budget_by_usd)}`} />
        <Check big={`${week.totals.protein_per_day_g}g`} small="/ day" />
        <Check big={`${week.totals.waste_lb} lb`} small="wasted" />
      </div>
      <TabBar active="this week" />
    </Screen>
  );
}

function Check({ big, small }: { big: string; small: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[0.7em] font-bold">✓</p>
      <p className="truncate font-mono text-[0.75em] font-semibold">{big}</p>
      <p className="truncate text-[0.625em] font-medium opacity-80">{small}</p>
    </div>
  );
}
