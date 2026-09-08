import type { Metadata } from "next";
import { Section } from "@/app/ui/section";
import { staples } from "@/data/staples";

export const metadata: Metadata = {
  title: "Protein index — WiseDinner",
  description: "the cheapest protein per gram on the shelf, ranked from the staples wisedinner solves with. estimates; refreshed weekly at launch.",
  alternates: { canonical: "/protein-index" },
};

// PROTEIN INDEX (REDESIGN-V3 §5): static, from data/staples.json — cost per gram of protein, ranked, mono table,
// one method line. Numbers derive from the committed data; nothing is typed in.
const rows = staples
  .filter((s) => s.protein_g > 0)
  .map((s) => ({ ...s, centsPerGram: (s.price_usd / s.protein_g) * 100, perDollar: s.protein_g / s.price_usd }))
  .sort((a, b) => a.centsPerGram - b.centsPerGram);

export default function ProteinIndex() {
  return (
    <main id="main">
      <Section>
        <p className="text-caption font-semibold text-forest">protein index</p>
        <h1 className="mt-3 text-h1 font-bold text-balance">the cheapest protein on the shelf.</h1>
        <p className="mt-5 max-w-[60ch] text-xl text-ink-2">every staple the solver can buy, ranked by what a gram of protein costs at the register.</p>
        <div className="mt-10 overflow-x-auto rounded-[14px] border border-border bg-white">
          <table className="w-full tnum text-sm">
            <thead className="bg-surface text-left text-xs tracking-[0.1em] text-ink-2 uppercase">
              <tr>
                <th className="px-4 py-3">#</th>
                <th className="px-4 py-3">staple</th>
                <th className="px-4 py-3">pack</th>
                <th className="px-4 py-3 text-right">shelf price</th>
                <th className="px-4 py-3 text-right">protein / pack</th>
                <th className="px-4 py-3 text-right">¢ per gram</th>
                <th className="px-4 py-3 text-right">g per $</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((s, i) => (
                <tr key={s.name} className={i < 3 ? "bg-surface" : ""}>
                  <td className="px-4 py-2.5 text-ink-2">{i + 1}</td>
                  <td className="px-4 py-2.5 font-sans font-medium">{s.name}</td>
                  <td className="px-4 py-2.5 text-ink-2">{s.unit}</td>
                  <td className="px-4 py-2.5 text-right">${s.price_usd.toFixed(2)}</td>
                  <td className="px-4 py-2.5 text-right">{s.protein_g} g</td>
                  <td className="px-4 py-2.5 text-right font-semibold text-forest">{s.centsPerGram.toFixed(1)}¢</td>
                  <td className="px-4 py-2.5 text-right">{s.perDollar.toFixed(0)} g</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-6 text-caption text-ink-2">estimates; refreshed weekly at launch. shelf prices carry a buffer and are labeled as estimates everywhere they appear.</p>
      </Section>
    </main>
  );
}
