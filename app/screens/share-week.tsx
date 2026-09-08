import Image from "next/image";
import { Check } from "@phosphor-icons/react/dist/ssr";
import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Button, Header, Lockup, Screen, TabBar } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

// S3 SHARE YOUR WEEK (REDESIGN-V4 §8): the in-app share card on white, the lockup, the numbers, five dinners, two CTAs.
export function ShareWeek({ week, imgSizes }: { week: FixtureWeek; imgSizes?: string }) {
  return (
    <Screen>
      <StatusBar />
      <Header title="Share your week" />
      <div className="mt-[1em] px-[1.25em]">
        <ShareCard week={week} imgSizes={imgSizes} />
      </div>
      <div className="mt-[1em] grid gap-[0.5em] px-[1.25em]">
        <Button>Shop this week</Button>
        <Button tone="ghost">Beat this week</Button>
      </div>
      <TabBar active="This week" />
    </Screen>
  );
}

// the card itself, also rendered full-width on /w/<id>. `imgSizes` is the strip photo's rendered width (64px here).
export function ShareCard({ week, className = "", imgSizes = "64px" }: { week: FixtureWeek; className?: string; imgSizes?: string }) {
  const dinners = week.days.map((d) => d.meals.find((m) => m.slot === "dinner") ?? d.meals[0]);
  return (
    <div className={`rounded-[1em] border border-border bg-white p-[1.25em] shadow-card ${className}`}>
      <div className="flex items-center justify-between">
        <Lockup className="text-[1em]" />
        <span className="text-[0.75em] font-medium text-ink-2">Solved week</span>
      </div>
      <p className="mt-[0.9em] flex items-center gap-[0.5em] text-[1.125em] font-semibold tracking-tight tnum">
        <span>
          {usd(week.totals.est_total_usd)}, {week.totals.protein_per_day_g}g a day
        </span>
        <span className="inline-flex text-emerald" aria-label="under budget, protein hit, zero waste">
          <Check size="0.9em" weight="bold" />
          <Check size="0.9em" weight="bold" />
          <Check size="0.9em" weight="bold" />
        </span>
      </p>
      <div className="mt-[0.9em] grid grid-cols-5 gap-[0.4em]">
        {dinners.map((m) => (
          <Image key={m.menu} src={m.img} alt={m.name} width={192} height={192} quality={90} sizes={imgSizes} className="aspect-square w-full rounded-[0.625em] object-cover" />
        ))}
      </div>
      <p className="mt-[0.75em] text-[0.75em] leading-snug text-ink-2">
        Five dinners, one {week.totals.items}-item list, under budget by {usd(week.totals.under_budget_by_usd)}.
      </p>
    </div>
  );
}
