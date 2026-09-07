import type { FixtureWeek } from "@/data/fixtures";
import { usd } from "@/data/fixtures";
import { Header, Screen, TabBar } from "./chrome";
import { StatusBar } from "@/app/ui/device-frame";

// S4 RECEIPT REVEAL (REDESIGN-V3 §3): a CSS thermal receipt with three highlighted lines beside the estimate-vs-actual
// comparison, the kale "receipt verified" badge and the climbing accuracy score. LAUNCH tier (§2E).
export function ReceiptReveal({ week }: { week: FixtureWeek }) {
  const r = week.receipt;
  const rows = week.list.items.slice(0, 7);
  const highlight = new Set([1, 3, 5]);
  const under = r.actual_usd <= r.estimated_usd;
  return (
    <Screen>
      <StatusBar />
      <Header title="receipt reveal" sub="this week · scanned" />
      <div className="mt-[0.9em] flex items-start gap-[0.75em] px-[1.25em]">
        {/* thermal receipt */}
        <div className="thermal w-[45%] shrink-0 rotate-[-1.5deg] px-[0.6em] pt-[0.7em] pb-[0.8em] font-mono text-[0.5625em] leading-[1.5] text-ink shadow-receipt">
          <p className="text-center font-semibold tracking-[0.12em] uppercase">market</p>
          <p className="text-center text-ink-3">* * *</p>
          {rows.map((i, n) => (
            <div key={i.name} className={`flex justify-between gap-[0.4em] ${highlight.has(n) ? "-mx-[0.3em] rounded-[0.2em] bg-yolk/70 px-[0.3em]" : ""}`}>
              <span className="truncate uppercase">{i.name.split(",")[0]}</span>
              <span>{i.price_usd.toFixed(2)}</span>
            </div>
          ))}
          <p className="text-center text-ink-3">…</p>
          <div className="mt-[0.3em] flex justify-between border-t border-dashed border-ink/40 pt-[0.3em] font-semibold">
            <span>TOTAL</span>
            <span>{r.actual_usd.toFixed(2)}</span>
          </div>
        </div>
        {/* comparison */}
        <div className="min-w-0 flex-1">
          <p className="text-[0.6875em] font-semibold text-ink-soft">estimated</p>
          <p className="font-mono text-[1.25em] leading-none font-semibold">{usd(r.estimated_usd)}</p>
          <p className="mt-[0.7em] text-[0.6875em] font-semibold text-ink-soft">actual</p>
          <p className="font-mono text-[1.25em] leading-none font-semibold">{usd(r.actual_usd)}</p>
          <p className={`mt-[0.6em] font-mono text-[0.8125em] font-semibold ${under ? "text-kale" : "text-tomato"}`}>
            {Math.abs(r.delta_pct)}% {under ? "under" : "over"}
          </p>
          <span className="mt-[0.9em] inline-flex items-center gap-[0.35em] rounded-full bg-kale px-[0.7em] py-[0.35em] text-[0.6875em] font-bold text-bg">✓ receipt verified</span>
          <p className="mt-[0.9em] text-[0.6875em] font-semibold text-ink-soft">accuracy</p>
          <p className="font-mono text-[1.125em] font-semibold text-kale">{r.accuracy_pct}% ↑</p>
        </div>
      </div>
      <TabBar active="receipts" />
    </Screen>
  );
}
