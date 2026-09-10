import { Check } from "@phosphor-icons/react/dist/ssr";
import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Header, Screen, TabBar } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

const AISLES = ["meat", "dairy", "pantry", "frozen", "produce"] as const;
const AISLE_LABEL: Record<(typeof AISLES)[number], string> = { meat: "Meat", dairy: "Dairy", pantry: "Pantry", frozen: "Frozen", produce: "Produce" };

// S2 GROCERY LIST (REDESIGN-V4 §8): aisle groups, tnum prices right-aligned, two checked in emerald, the estimated
// in-store total and what the same list costs delivered from Kroger (estimated) pinned to the bottom.
export function GroceryList({ week }: { week: FixtureWeek }) {
  const { list } = week;
  return (
    <Screen>
      <StatusBar />
      <Header title="One list" sub={`${list.items.length} items, one trip`} />
      <div className="mt-[0.75em] min-h-0 flex-1 overflow-hidden px-[1.25em]">
        {AISLES.map((aisle) => {
          const rows = list.items.filter((i) => i.aisle === aisle);
          if (!rows.length) return null;
          return (
            <div key={aisle} className="mt-[0.75em] first:mt-0">
              <p className="text-[0.6875em] font-semibold text-ink-2">{AISLE_LABEL[aisle]}</p>
              <ul className="mt-[0.3em] divide-y divide-border">
                {rows.map((i) => (
                  <li key={i.name} className="flex items-center gap-[0.6em] py-[0.45em] text-[0.875em]">
                    <span aria-hidden="true" className={`grid size-[1.25em] shrink-0 place-items-center rounded-[0.35em] border ${i.checked ? "border-emerald bg-emerald text-white" : "border-border bg-white"}`}>
                      {i.checked && <Check size="0.8em" weight="bold" />}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${i.checked ? "text-ink-2 line-through" : ""}`}>{i.name}</span>
                    <span className="text-[0.9em] text-ink-2 tnum">{usd(i.price_usd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {/* pinned footer: the estimated in-store total and what the same list costs delivered */}
      <div className="border-t border-border bg-white px-[1.25em] pt-[0.75em] pb-[0.5em]">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.875em] font-semibold">Estimated in-store total</span>
          <span className="text-[1.25em] font-semibold tnum">{usd(list.est_total_usd)}</span>
        </div>
        <p className="mt-[0.25em] text-[0.75em] font-medium text-ink-2 tnum">
          {list.delivery_label} {usd(list.delivery_est_usd)}. <span className="text-emerald-ink">Walking in saves {usd(list.delivery_saves_usd)}.</span>
        </p>
      </div>
      <TabBar active="List" />
    </Screen>
  );
}
