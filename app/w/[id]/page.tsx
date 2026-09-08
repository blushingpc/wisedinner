import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Image from "next/image";
import { fixtures, usd } from "@/data/fixtures";
import { ShareCard } from "@/app/screens";
import { StoreBadges } from "@/app/ui/store-badges";
import { SITE } from "@/app/copy";

// SHARE PAGE (REDESIGN-V3 §5): /w/<id> renders a fixture week as the S3 card full-width + the five days + the aisle
// list, one CTA (badge when set, else early access). Static: two example ids from the committed fixtures, no database.
const AISLES = ["meat", "dairy", "pantry", "frozen", "produce"] as const;
const DAY: Record<string, string> = { mon: "monday", tue: "tuesday", wed: "wednesday", thu: "thursday", fri: "friday" };

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
    title: `a solved week: ${usd(t.est_total_usd)} · ${t.protein_per_day_g}g/day — WiseDinner`,
    description: `five dinners, one ${t.items}-item list, ${usd(t.est_total_usd)} at the shelf, ${t.protein_per_day_g}g of protein a day. solved by wisedinner.`,
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
      <section className="py-band">
        <div className="mx-auto max-w-[720px] px-6">
          <p className="text-caption font-semibold text-forest">a solved week · shared from the app</p>
          {/* the S3 card at page width: the screen's em sizing is re-based to the page font */}
          <div className="screen-page mt-4">
            <ShareCard week={w} />
          </div>
          <div className="mt-6">
            <StoreBadges placement="share" height={52} />
          </div>

          <h2 className="mt-14 text-h2 font-bold">five days</h2>
          <ol className="mt-6 divide-y divide-border">
            {w.days.map((d) => (
              <li key={d.day} className="grid grid-cols-[minmax(0,1fr)] gap-3 py-5 sm:grid-cols-[110px_minmax(0,1fr)]">
                <div>
                  <p className="font-semibold">{DAY[d.day]}</p>
                  <p className="tnum text-sm text-ink-2">
                    {d.protein_g}g · {usd(d.cost_usd)}
                  </p>
                </div>
                <ul className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-2">
                  {d.meals.map((m) => (
                    <li key={m.slot} className="flex items-center gap-3">
                      <Image src={m.img} alt="" width={112} height={112} quality={75} sizes="56px" className="img-grade size-12 shrink-0 rounded-[10px] object-cover" />
                      <div className="min-w-0">
                        <p className="truncate text-[0.9375rem] font-medium">{m.name}</p>
                        <p className="tnum text-sm text-ink-2">
                          {m.slot} · {m.protein_g}g · {usd(m.cost_usd)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </li>
            ))}
          </ol>

          <h2 className="mt-14 text-h2 font-bold">one list · {w.list.items.length} items</h2>
          <div className="mt-6 rounded-[14px] border border-border bg-white p-6">
            {AISLES.map((aisle) => {
              const rows = w.list.items.filter((i) => i.aisle === aisle);
              if (!rows.length) return null;
              return (
                <div key={aisle} className="mt-5 first:mt-0">
                  <p className="text-caption font-bold tracking-[0.04em] text-forest uppercase">{aisle}</p>
                  <ul className="mt-1 divide-y divide-border">
                    {rows.map((i) => (
                      <li key={i.name} className="flex items-baseline justify-between gap-4 py-2 text-[0.9375rem]">
                        <span>{i.name}</span>
                        <span className="tnum text-sm text-ink-2">{usd(i.price_usd)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
            <div className="mt-5 flex items-baseline justify-between border-t border-border pt-4">
              <span className="font-semibold">est. in-store total</span>
              <span className="tnum text-[1.25rem] font-semibold">{usd(w.list.est_total_usd)}</span>
            </div>
            <p className="mt-1 tnum text-sm font-semibold text-forest">
              {w.list.delivery_label} {usd(w.list.delivery_est_usd)} · walking in saves {usd(w.list.delivery_saves_usd)}
            </p>
          </div>
          <p className="mt-6 text-caption text-ink-2">prices are shelf estimates with a buffer, labeled as estimates. the receipt is the proof.</p>
        </div>
      </section>
    </main>
  );
}
