import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { fixtures, usd } from "@/data/fixtures";
import { ShareCard } from "@/app/screens";
import { StoreBadges } from "@/app/ui/store-badges";
import { SITE } from "@/app/copy";

// SHARE PAGE (REDESIGN-V4 §10.14): /w/<id> renders a fixture week as the S3 card at page width, then the five days and
// the aisle list, with the store badges. Static: two example ids from the committed fixtures, no database.
const AISLES = ["meat", "dairy", "pantry", "frozen", "produce"] as const;
const AISLE_LABEL: Record<(typeof AISLES)[number], string> = { meat: "Meat", dairy: "Dairy", pantry: "Pantry", frozen: "Frozen", produce: "Produce" };
const DAY: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };
const SLOT: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner" };

export function generateStaticParams() {
  return Object.keys(fixtures).map((id) => ({ id }));
}
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const w = fixtures[id];
  if (!w) return {};
  const t = w.totals;
  return {
    title: `A solved week: ${usd(t.est_total_usd)}, ${t.protein_per_day_g}g a day`,
    description: `Five dinners, one ${t.items}-item list, ${usd(t.est_total_usd)} at the shelf, ${t.protein_per_day_g}g of protein a day. Solved by WiseDinner.`,
    alternates: { canonical: `/w/${id}` },
    openGraph: { images: [`/w/${id}/og`], url: `${SITE}/w/${id}` },
    robots: { index: false, follow: true },
  };
}

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const w = fixtures[id];
  if (!w) notFound();
  return (
    <main id="main">
      <section className="bg-white py-band">
        <div className="mx-auto max-w-[720px] px-6">
          <div className="text-center">
            <p className="text-caption font-medium text-ink-2">A solved week, shared from the app</p>
            <h1 className="mt-3 text-h2 text-balance">
              {usd(w.totals.est_total_usd)} for the week, {w.totals.protein_per_day_g}g of protein a day
            </h1>
          </div>
          {/* the S3 card at page width: the screen's em sizing is re-based to the page font */}
          <div className="screen-page mt-10">
            <ShareCard week={w} imgSizes="(min-width: 720px) 120px, 18vw" />
          </div>
          <div className="mt-8 flex justify-center">
            <StoreBadges placement="share" height={48} className="justify-center" fallback="button" buttonClassName="cta cta-wide min-w-[200px]" />
          </div>

          <h2 className="mt-16 text-center text-h2 text-balance">Five days</h2>
          <ol className="mt-8 divide-y divide-border">
            {w.days.map((d) => (
              <li key={d.day} className="grid grid-cols-[minmax(0,1fr)] gap-3 py-5 sm:grid-cols-[120px_minmax(0,1fr)]">
                <div>
                  <p className="font-semibold">{DAY[d.day]}</p>
                  <p className="text-sm text-ink-2 tnum">
                    {d.protein_g}g, {usd(d.cost_usd)}
                  </p>
                </div>
                <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
                  {d.meals.map((m) => (
                    <li key={m.slot} className="flex items-center gap-3">
                      <Image src={m.img} alt="" width={168} height={168} quality={90} sizes="56px" className="size-14 shrink-0 rounded-[12px] object-cover" />
                      <div className="min-w-0">
                        <p className="line-clamp-2 text-[0.9375rem] font-medium">{m.name}</p>
                        <p className="text-sm text-ink-2 tnum">
                          {SLOT[m.slot]}, {m.protein_g}g protein, {usd(m.cost_usd)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <h2 className="mt-16 text-center text-h2 text-balance">One list, {w.list.items.length} items</h2>
          <div className="mt-8 rounded-card border border-border bg-white p-6 shadow-card">
            {AISLES.map((aisle) => {
              const rows = w.list.items.filter((i) => i.aisle === aisle);
              if (!rows.length) return null;
              return (
                <div key={aisle} className="mt-5 first:mt-0">
                  <p className="text-caption font-semibold text-ink-2">{AISLE_LABEL[aisle]}</p>
                  <ul className="mt-1 divide-y divide-border">
                    {rows.map((i) => (
                      <li key={i.name} className="flex items-baseline justify-between gap-4 py-2 text-[0.9375rem]">
                        <span>{i.name}</span>
                        <span className="text-sm text-ink-2 tnum">{usd(i.price_usd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-semibold">Estimated in-store total</span>
              <span className="text-[1.25rem] font-semibold tnum">{usd(w.list.est_total_usd)}</span>
            </div>
            <p className="mt-1 text-sm text-ink-2 tnum">
              {w.list.delivery_label} {usd(w.list.delivery_est_usd)}. <span className="font-medium text-emerald-ink">Walking in saves {usd(w.list.delivery_saves_usd)}.</span>
            </p>
          </div>
          <p className="mt-6 text-center text-caption text-ink-2">Prices are shelf estimates with a buffer, labeled as estimates. The receipt is the proof.</p>
        </div>
      </section>
    </main>
  );
}
