import { Check } from "@phosphor-icons/react/dist/ssr";
import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Button, Header, Pill, Screen, TabBar } from "./chrome";
import { MealCard } from "./meal-card";
import { StatusBar } from "@/app/ui/device-frame";

const DAYS = ["mon", "tue", "wed", "thu", "fri"] as const;
const LABEL: Record<(typeof DAYS)[number], string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri" };

// S1 THIS WEEK (REDESIGN-V4 §8). also S6 when fed the regenerate fixture.
export function ThisWeek({ week, active = "tue", priority = false, imgSizes }: { week: FixtureWeek; active?: (typeof DAYS)[number]; priority?: boolean; imgSizes?: string }) {
  const day = week.days.find((d) => d.day === active) ?? week.days[0];
  return (
    <Screen>
      <StatusBar />
      <Header title="This week" right={<Pill>{usd(week.totals.est_total_usd)}, one trip</Pill>} />
      <div className="mt-[1em] flex gap-[0.4em] px-[1.25em]">
        {DAYS.map((d) => (
          <span key={d} className={`flex-1 rounded-full py-[0.45em] text-center text-[0.8125em] font-semibold ${d === active ? "bg-forest text-white" : "bg-surface text-ink-2"}`}>
            {LABEL[d]}
          </span>
        ))}
      </div>
      <div className="mt-[1em] grid grid-cols-[minmax(0,1fr)] gap-[0.5em] px-[1.25em]">
        {day.meals.map((m) => (
          <MealCard key={m.slot} meal={m} priority={priority} sizes={imgSizes} />
        ))}
      </div>
      {/* the three checks: under budget, protein hit, zero waste. emerald on its tint */}
      <div className="mx-[1.25em] mt-[1em] grid grid-cols-3 gap-[0.25em] rounded-[0.875em] bg-emerald-tint px-[0.5em] py-[0.75em] text-center">
        <CheckCell big="Under budget" small={`by ${usd(week.totals.under_budget_by_usd)}`} />
        <CheckCell big={`${week.totals.protein_per_day_g}g`} small="a day" />
        <CheckCell big={`${week.totals.waste_lb} lb`} small="wasted" />
      </div>
      <div className="mx-[1.25em] mt-[0.75em]">
        <Button tone="ghost">Regenerate</Button>
      </div>
      <TabBar active="This week" />
    </Screen>
  );
}

function CheckCell({ big, small }: { big: string; small: string }) {
  return (
    <div className="min-w-0">
      <Check size="0.9em" weight="bold" aria-hidden="true" className="mx-auto text-emerald" />
      <p className="mt-[0.2em] truncate text-[0.75em] font-semibold text-forest tnum">{big}</p>
      <p className="truncate text-[0.625em] font-medium text-forest/80">{small}</p>
    </div>
  );
}
