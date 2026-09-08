import type { Metadata } from "next";
import { PageShell } from "@/app/ui/page-shell";
import { staples } from "@/data/staples";

export const metadata: Metadata = {
  title: "Protein index",
  description: "The cheapest protein per gram on the shelf, ranked from the staples WiseDinner plans with. Estimates, refreshed weekly at launch.",
  alternates: { canonical: "/protein-index" },
};

// PROTEIN INDEX (REDESIGN-V4 §10.14): static, from data/staples.json. Cost per gram of protein, ranked, an Inter tnum
// table with the top three on the emerald tint, one method line. Numbers derive from the committed data.
const rows = staples
  .filter((s) => s.protein_g > 0)
  .map((s) => ({ ...s, centsPerGram: (s.price_usd / s.protein_g) * 100, perDollar: s.protein_g / s.price_usd }))
  .sort((a, b) => a.centsPerGram - b.centsPerGram);

export default function ProteinIndex() {
  return (
    <PageShell title="The cheapest protein on the shelf" sub="Every staple the app can buy, ranked by what a gram of protein costs at the register." wide>
      <div className="overflow-x-auto rounded-card border border-border bg-white shadow-card">
        <table className="w-full text-sm tnum">
          <thead className="bg-surface text-left text-xs font-medium text-ink-2">
            <tr>
              <th className="px-4 py-3 font-medium">Rank</th>
              <th className="px-4 py-3 font-medium">Staple</th>
              <th className="px-4 py-3 font-medium">Pack</th>
              <th className="px-4 py-3 text-right font-medium">Shelf price</th>
              <th className="px-4 py-3 text-right font-medium">Protein per pack</th>
              <th className="px-4 py-3 text-right font-medium">Cents per gram</th>
              <th className="px-4 py-3 text-right font-medium">Grams per dollar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((s, i) => (
              <tr key={s.name} className={i < 3 ? "bg-emerald-tint" : ""}>
                <td className="px-4 py-2.5 text-ink-2">{i + 1}</td>
                <td className="px-4 py-2.5 font-medium">{s.name}</td>
                <td className="px-4 py-2.5 text-ink-2">{s.unit}</td>
                <td className="px-4 py-2.5 text-right">${s.price_usd.toFixed(2)}</td>
                <td className="px-4 py-2.5 text-right">{s.protein_g} g</td>
                <td className="px-4 py-2.5 text-right font-semibold text-forest">{s.centsPerGram.toFixed(1)}</td>
                <td className="px-4 py-2.5 text-right">{s.perDollar.toFixed(0)} g</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-6 text-center text-caption text-ink-2">Estimates, refreshed weekly at launch. Shelf prices carry a buffer and are labeled as estimates everywhere they appear.</p>
    </PageShell>
  );
}
