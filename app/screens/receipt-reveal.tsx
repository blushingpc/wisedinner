import { Check } from "@phosphor-icons/react/dist/ssr";
import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Header, Screen, TabBar } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

// S4 RECEIPT REVEAL (REDESIGN-V4 §8): a clean white receipt card with light gray rule lines (no thermal texture)
// beside the estimate-versus-actual comparison, the emerald "Receipt verified" state and the climbing accuracy score.
export function ReceiptReveal({ week }: { week: FixtureWeek }) {
  const r = week.receipt;
  const rows = week.list.items.slice(0, 7);
  const highlight = new Set([1, 3, 5]);
  const under = r.actual_usd <= r.estimated_usd;
  return (
    <Screen>
      <StatusBar />
      <Header title="Receipt reveal" sub="This week, scanned" />
      <div className="mt-[0.9em] flex items-start gap-[0.75em] px-[1.25em]">
        {/* the receipt card */}
        <div className="w-[46%] shrink-0 rounded-[0.75em] border border-border bg-white px-[0.6em] pt-[0.6em] pb-[0.7em] text-[0.5625em] leading-[1.5] text-ink shadow-card tnum">
          <p className="text-center font-semibold">Market</p>
          <p className="text-center text-ink-2">Receipt</p>
          <div className="mt-[0.4em] divide-y divide-border">
            {rows.map((i, n) => (
              <div key={i.name} className={`flex justify-between gap-[0.4em] py-[0.25em] ${highlight.has(n) ? "-mx-[0.3em] rounded-[0.25em] bg-emerald-tint px-[0.3em] text-forest" : ""}`}>
                <span className="truncate">{i.name.split(",")[0]}</span>
                <span>{i.price_usd.toFixed(2)}</span>
              </div>
            ))}
          </div>
          <div className="mt-[0.4em] flex justify-between border-t border-border pt-[0.4em] font-semibold">
            <span>Total</span>
            <span>{r.actual_usd.toFixed(2)}</span>
          </div>
        </div>
        {/* the comparison */}
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875em] font-medium text-ink-2">Estimated</p>
          <p className="text-[1.25em] leading-none font-semibold tnum">{usd(r.estimated_usd)}</p>
          <p className="mt-[0.7em] text-[0.6875em] font-medium text-ink-2">Actual</p>
          <p className="text-[1.25em] leading-none font-semibold tnum">{usd(r.actual_usd)}</p>
          <p className={`mt-[0.6em] text-[0.8125em] font-semibold tnum ${under ? "text-emerald" : "text-danger"}`}>
            {Math.abs(r.delta_pct)}% {under ? "under" : "over"}
          </p>
          <span className="mt-[0.9em] inline-flex items-center gap-[0.35em] rounded-full bg-emerald-tint px-[0.7em] py-[0.4em] text-[0.6875em] font-semibold text-forest">
            <Check size="1em" weight="bold" className="text-emerald" aria-hidden="true" />
            Receipt verified
          </span>
          <p className="mt-[0.9em] text-[0.6875em] font-medium text-ink-2">Accuracy</p>
          <p className="text-[1.125em] font-semibold text-emerald tnum">{r.accuracy_pct}% and climbing</p>
        </div>
      </div>
      <TabBar active="Receipts" />
    </Screen>
  );
}
