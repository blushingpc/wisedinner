import Image from "next/image";
import type { FixtureMeal } from "@/data/fixtures";
import { usd } from "@/data/fixtures";

// app MealCard (REDESIGN-V4 §8): 56pt photo on a white card with a hairline, the dish named like the menu item, Inter
// tnum "46g protein, $3.60". em off the 16pt screen base. `sizes` is the photo's rendered CSS width so next/image
// serves the exact 1x/2x/3x candidate (56/112/168 in the site's phones; the store export passes its own).
export function MealCard({ meal, priority = false, compact = false, sizes = "56px" }: { meal: FixtureMeal; priority?: boolean; compact?: boolean; sizes?: string }) {
  return (
    <div className={`flex items-center gap-[0.75em] rounded-[0.875em] border border-border bg-white ${compact ? "p-[0.5em]" : "p-[0.625em]"}`}>
      <Image src={meal.img} alt="" width={168} height={168} quality={90} sizes={sizes} priority={priority} className="size-[3.5em] shrink-0 rounded-[0.625em] object-cover" />
      <div className="min-w-0">
        <p className="truncate text-[0.9375em] leading-tight font-semibold">{meal.name}</p>
        <p className="mt-[0.3em] text-[0.8125em] text-ink-2 tnum">
          {meal.protein_g}g protein, {usd(meal.cost_usd)}
        </p>
      </div>
    </div>
  );
}
