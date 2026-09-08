import Image from "next/image";
import type { FixtureMeal } from "@/data/fixtures";
import { usd } from "@/data/fixtures";

// app MealCard (REDESIGN-V3 §3 S1): 56pt photo, name like the menu item, mono "44g · $3.40". em off the 16pt screen base.
export function MealCard({ meal, priority = false, compact = false }: { meal: FixtureMeal; priority?: boolean; compact?: boolean }) {
  return (
    <div className={`flex items-center gap-[0.75em] rounded-[0.875em] bg-white ${compact ? "p-[0.5em]" : "p-[0.625em]"} shadow-[0_1px_0_rgba(27,26,24,0.04),0_10px_24px_-18px_rgba(27,26,24,0.35)]`}>
      <Image src={meal.img} alt="" width={224} height={224} quality={75} sizes="112px" priority={priority} className="img-grade size-[3.5em] shrink-0 rounded-[0.625em] object-cover" />
      <div className="min-w-0">
        <p className="truncate text-[0.9375em] leading-tight font-semibold">{meal.name}</p>
        <p className="mt-[0.3em] tnum text-[0.8125em] text-ink-2">
          {meal.protein_g}g · {usd(meal.cost_usd)}
        </p>
      </div>
    </div>
  );
}
