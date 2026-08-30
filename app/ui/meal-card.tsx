import Image from "next/image";
import type { Meal } from "@/data/meals";

// ONLY inside DeviceFrames / app-UI depictions. numbers are live text computed from staple data (data/meals.ts).
export function MealCard({ meal, priority = false }: { meal: Meal; priority?: boolean }) {
  return (
    <figure className="flex items-center gap-3 border-t border-rule py-3 first:border-t-0">
      <Image src={meal.img} alt={meal.alt} width={64} height={64} quality={75} priority={priority} className="img-grade size-16 rounded-[10px] object-cover" />
      <figcaption>
        <p className="font-medium leading-tight">{meal.name}</p>
        <p className="mt-1 font-mono text-spec tabular-nums text-ink-soft">
          {meal.protein_g}g · ${meal.price_usd.toFixed(2)}
        </p>
      </figcaption>
    </figure>
  );
}
