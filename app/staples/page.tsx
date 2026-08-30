import type { Metadata } from "next";
import { staples } from "@/data/staples";

export const metadata: Metadata = {
  title: "staples · wisedinner",
  robots: { index: false, follow: false },
};

// rendered per request so the stale check uses today's date, not build day
export const dynamic = "force-dynamic";

const STALE_AFTER_DAYS = 21;

export default function Staples() {
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const today = Date.now();
  const asOf = staples.map((s) => s.price_as_of).sort()[0] ?? "";
  const stale = staples.some(
    (s) => (today - Date.parse(s.price_as_of)) / 86_400_000 > STALE_AFTER_DAYS,
  );

  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-10 lg:px-12">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="text-lg font-bold tracking-tight">wisedinner</span>
        <span className="font-mono text-micro uppercase text-ink-soft">
          staple pool v0 · {staples.length} skus · prices as of {asOf} · est. in-store, +10% buffer
        </span>
        {stale && (
          <span className="font-mono text-micro uppercase">
            stale: some prices are older than {STALE_AFTER_DAYS} days
          </span>
        )}
      </header>

      {/* spec-sheet rows: mono 13px, hairline per row, no boxes */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse font-mono text-spec tabular-nums">
          <thead>
            <tr className="text-left text-micro whitespace-nowrap text-ink-soft">
              <th className="py-2 pr-4 font-normal">item</th>
              <th className="py-2 pr-4 font-normal">unit</th>
              <th className="py-2 pr-4 text-right font-normal">price</th>
              <th className="py-2 pr-4 text-right font-normal">protein g</th>
              <th className="py-2 pr-4 text-right font-normal">kcal</th>
              <th className="py-2 pr-4 font-normal">flags</th>
              <th className="py-2 pr-4 font-normal">perishable</th>
              <th className="py-2 font-normal">as of</th>
            </tr>
          </thead>
          <tbody>
            {staples.map((s) => (
              <tr key={s.name} className="border-t border-rule">
                <td className="py-1.5 pr-4 whitespace-nowrap">{s.name}</td>
                <td className="py-1.5 pr-4 whitespace-nowrap text-ink-soft">{s.unit}</td>
                <td className="py-1.5 pr-4 text-right">${s.price_usd.toFixed(2)}</td>
                <td className="py-1.5 pr-4 text-right">{s.protein_g}</td>
                <td className="py-1.5 pr-4 text-right">{s.kcal}</td>
                <td className="py-1.5 pr-4 whitespace-nowrap text-ink-soft">{s.diet_flags.join(" ")}</td>
                <td className="py-1.5 pr-4 text-ink-soft">{s.perishable ? "yes" : "no"}</td>
                <td className="py-1.5 whitespace-nowrap text-ink-soft">{s.price_as_of}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
