import type { Metadata } from "next";
import { staples } from "@/data/staples";

export const metadata: Metadata = {
  title: "Staples",
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
        <span className="font-display text-lg font-extrabold tracking-[-0.02em]">WiseDinner</span>
        <span className="text-xs text-ink-2 tnum">
          Staple pool v0, {staples.length} SKUs, prices as of {asOf}, estimated in-store with a 10% buffer
        </span>
        {stale && (
          <span className="text-xs text-danger tnum">
            Stale: some prices are older than {STALE_AFTER_DAYS} days
          </span>
        )}
      </header>

      {/* spec-sheet rows: 13px tnum, hairline per row, no boxes */}
      <div className="mt-8 overflow-x-auto">
        <table className="w-full border-collapse tnum text-sm tabular-nums">
          <thead>
            <tr className="text-left text-xs whitespace-nowrap text-ink-2">
              <th className="py-2 pr-4 font-normal">Item</th>
              <th className="py-2 pr-4 font-normal">Unit</th>
              <th className="py-2 pr-4 text-right font-normal">Price</th>
              <th className="py-2 pr-4 text-right font-normal">Protein g</th>
              <th className="py-2 pr-4 text-right font-normal">Kcal</th>
              <th className="py-2 pr-4 font-normal">Flags</th>
              <th className="py-2 pr-4 font-normal">Perishable</th>
              <th className="py-2 font-normal">As of</th>
            </tr>
          </thead>
          <tbody>
            {staples.map((s) => (
              <tr key={s.name} className="border-t border-border">
                <td className="py-1.5 pr-4 whitespace-nowrap">{s.name}</td>
                <td className="py-1.5 pr-4 whitespace-nowrap text-ink-2">{s.unit}</td>
                <td className="py-1.5 pr-4 text-right">${s.price_usd.toFixed(2)}</td>
                <td className="py-1.5 pr-4 text-right">{s.protein_g}</td>
                <td className="py-1.5 pr-4 text-right">{s.kcal}</td>
                <td className="py-1.5 pr-4 whitespace-nowrap text-ink-2">{s.diet_flags.join(" ")}</td>
                <td className="py-1.5 pr-4 text-ink-2">{s.perishable ? "Yes" : "No"}</td>
                <td className="py-1.5 whitespace-nowrap text-ink-2">{s.price_as_of}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
