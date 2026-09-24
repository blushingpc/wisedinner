import type { Metadata } from "next";
import { snapshot } from "@/data/snapshot";
import { packCanonical, priceMapFor } from "@/lib/solver";

export const metadata: Metadata = {
  title: "Staples",
  robots: { index: false, follow: false },
};

// rendered per request so the stale check uses today's date, not build day
export const dynamic = "force-dynamic";

const STALE_AFTER_DAYS = 21;
const STORE = "kroger";

export default function Staples() {
  // eslint-disable-next-line react-hooks/purity -- server component, rendered per request
  const today = Date.now();
  const store = snapshot.stores.find((s) => s.id === STORE)!;
  const prices = priceMapFor(snapshot, store, "43215");
  const nutrition = new Map(snapshot.nutrition.map((n) => [n.sku_id, n]));
  const rows = snapshot.skus.map((s) => {
    const p = prices.get(s.id)!;
    const n = nutrition.get(s.id);
    const grams = packCanonical(s) * s.grams_per_unit;
    return { ...s, price_usd: p.price_usd, as_of: p.as_of, protein_g: n ? Math.round((n.protein_g * grams) / 100) : 0, kcal: n ? Math.round((n.kcal * grams) / 100) : 0 };
  });
  const asOf = rows.map((r) => r.as_of).sort()[0] ?? "";
  const stale = rows.some((r) => (today - Date.parse(r.as_of)) / 86_400_000 > STALE_AFTER_DAYS);

  return (
    <main id="main" className="mx-auto max-w-[1200px] px-6 py-10 lg:px-12">
      <header className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
        <span className="font-display text-lg font-extrabold tracking-[-0.02em]">WiseDinner</span>
        <span className="text-xs text-ink-2 tnum">
          Sku pool v{snapshot.version}, {rows.length} SKUs, {store.banner} prices as of {asOf}, estimated in-store with a 10% buffer
        </span>
        {stale && <span className="text-xs text-danger tnum">Stale: some prices are older than {STALE_AFTER_DAYS} days</span>}
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
            {rows.map((s) => (
              <tr key={s.id} className="border-t border-border">
                <td className="py-1.5 pr-4 whitespace-nowrap">{s.name}</td>
                <td className="py-1.5 pr-4 whitespace-nowrap text-ink-2">{s.pack_label}</td>
                <td className="py-1.5 pr-4 text-right">${s.price_usd.toFixed(2)}</td>
                <td className="py-1.5 pr-4 text-right">{s.protein_g}</td>
                <td className="py-1.5 pr-4 text-right">{s.kcal}</td>
                <td className="py-1.5 pr-4 whitespace-nowrap text-ink-2">{s.diet_flags.join(" ")}</td>
                <td className="py-1.5 pr-4 text-ink-2">{s.perishable ? "Yes" : "No"}</td>
                <td className="py-1.5 whitespace-nowrap text-ink-2">{s.as_of}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
