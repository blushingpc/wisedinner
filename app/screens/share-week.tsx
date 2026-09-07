import Image from "next/image";
import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Button, Header, Lockup, Screen, TabBar } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

// S3 SHARE YOUR WEEK (REDESIGN-V3 §3): the in-app share card — paper card, lockup, numbers, five dinners, one CTA.
export function ShareWeek({ week }: { week: FixtureWeek }) {
  return (
    <Screen>
      <StatusBar />
      <Header title="share your week" />
      <div className="mt-[1em] px-[1.25em]">
        <ShareCard week={week} />
      </div>
      <div className="mt-[1em] grid gap-[0.5em] px-[1.25em]">
        <Button>shop this week</Button>
        <Button tone="ghost">beat this week</Button>
      </div>
      <TabBar active="this week" />
    </Screen>
  );
}

// the card itself — also rendered full-width on /w/<id> (§5)
export function ShareCard({ week, className = "" }: { week: FixtureWeek; className?: string }) {
  const dinners = week.days.map((d) => d.meals.find((m) => m.slot === "dinner") ?? d.meals[0]);
  return (
    <div className={`rounded-[1.5em] border border-rule bg-bg-alt p-[1.25em] ${className}`}>
      <div className="flex items-center justify-between">
        <Lockup className="text-[1em]" />
        <span className="text-[0.75em] font-semibold text-ink-soft">solved week</span>
      </div>
      <p className="mt-[0.9em] font-mono text-[1.125em] font-semibold tracking-tight">
        {usd(week.totals.est_total_usd)} · {week.totals.protein_per_day_g}g/day · <span className="text-kale">✓✓✓</span>
      </p>
      <div className="mt-[0.9em] grid grid-cols-5 gap-[0.4em]">
        {dinners.map((m) => (
          <Image key={m.menu} src={m.img} alt={m.name} width={160} height={160} quality={75} sizes="64px" className="img-grade aspect-square w-full rounded-[0.625em] object-cover" />
        ))}
      </div>
      <p className="mt-[0.75em] text-[0.75em] leading-snug text-ink-soft">
        five dinners · one {week.totals.items}-item list · under budget by {usd(week.totals.under_budget_by_usd)}
      </p>
    </div>
  );
}
