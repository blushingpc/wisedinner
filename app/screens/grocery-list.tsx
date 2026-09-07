import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Header, Screen, TabBar } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

const AISLES = ["meat", "dairy", "pantry", "frozen", "produce"] as const;

// S2 GROCERY LIST (REDESIGN-V3 §3): aisle groups, mono prices right-aligned, two checked, sticky total + Delivery Gap.
export function GroceryList({ week }: { week: FixtureWeek }) {
  const { list } = week;
  return (
    <Screen>
      <StatusBar />
      <Header title="one list" sub={`${list.items.length} items · one trip`} />
      <div className="mt-[0.75em] min-h-0 flex-1 overflow-hidden px-[1.25em]">
        {AISLES.map((aisle) => {
          const rows = list.items.filter((i) => i.aisle === aisle);
          if (!rows.length) return null;
          return (
            <div key={aisle} className="mt-[0.75em] first:mt-0">
              <p className="text-[0.6875em] font-bold tracking-[0.04em] text-kale uppercase">{aisle}</p>
              <ul className="mt-[0.3em] divide-y divide-rule">
                {rows.map((i) => (
                  <li key={i.name} className="flex items-center gap-[0.6em] py-[0.45em] text-[0.875em]">
                    <span aria-hidden="true" className={`grid size-[1.25em] shrink-0 place-items-center rounded-[0.3em] border text-[0.7em] font-bold ${i.checked ? "border-kale bg-kale text-bg" : "border-rule bg-white"}`}>
                      {i.checked ? "✓" : ""}
                    </span>
                    <span className={`min-w-0 flex-1 truncate ${i.checked ? "text-ink-3 line-through" : ""}`}>{i.name}</span>
                    <span className="font-mono text-[0.9em] text-ink-soft">{usd(i.price_usd)}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {/* sticky footer: the estimated in-store total + the Delivery Gap line (labeled estimated) */}
      <div className="border-t border-rule bg-bg px-[1.25em] pt-[0.75em] pb-[0.5em]">
        <div className="flex items-baseline justify-between">
          <span className="text-[0.875em] font-semibold">est. in-store total</span>
          <span className="font-mono text-[1.25em] font-semibold">{usd(list.est_total_usd)}</span>
        </div>
        <p className="mt-[0.25em] font-mono text-[0.75em] font-semibold text-kale">
          {list.delivery_label} {usd(list.delivery_est_usd)} · walking in saves {usd(list.delivery_saves_usd)}
        </p>
      </div>
      <TabBar active="list" />
    </Screen>
  );
}
