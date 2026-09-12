import type { Metadata } from "next";
import { drop } from "@/data/drop";
import { wholeUsd } from "@/lib/showcase";
import { PageView } from "@/app/ui/page-view";
import { PageShell } from "@/app/ui/page-shell";
import { ReceiptCard } from "@/app/ui/receipt-card";
import { PreorderButton } from "@/app/ui/preorder-modal";

export const metadata: Metadata = {
  title: "This week's protein plan",
  description: "One universal high-protein week at real in-store prices, refreshed every Sunday: five days of meals, one short list, an estimated total. Free, no account.",
  alternates: { canonical: "/drop" },
  openGraph: { images: ["/og?page=drop"] },
};

const DAY: Record<string, string> = { mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday", fri: "Friday" };

export default function Drop() {
  return (
    <PageShell title="This week's protein plan" sub={`One universal week: ${drop.input.protein_per_day}g of protein a day for one person, ${wholeUsd(drop.est_total)} at this week's estimated shelf prices. Refreshed every Sunday. No account, no card.`} wide>
      <PageView event="drop_view" />
      <div className="grid gap-12 lg:grid-cols-[1fr_1.3fr]">
        <div data-reveal>
          <ReceiptCard week={drop} variant="drop" title="This week's plan" />
        </div>
        <div>
          <ol className="max-w-[62ch]">
            {drop.days.map((d) => (
              <li key={d.day} className="border-t border-border py-4">
                <div className="flex items-baseline justify-between text-sm text-ink-2 tnum">
                  <span className="font-medium text-ink">{DAY[d.day] ?? d.day}</span>
                  <span>
                    {d.protein_g}g protein, {d.kcal} kcal
                  </span>
                </div>
                <ol className="mt-2 grid gap-1.5">
                  {d.items.map((i) => (
                    <li key={i.unit} className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-2">
                      <span className="text-xs font-medium text-ink-2">{i.unit}</span>
                      <span>
                        {i.name}
                        <span className="block text-xs text-ink-2 tnum">{i.portion.replace(/ · /g, ", ")}</span>
                      </span>
                      <span className="text-sm text-ink-2 tnum">{i.protein_g} g</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <div className="mt-12 border-t border-border pt-8">
            <h2 className="text-h3">Get next week&apos;s plan in the app</h2>
            <div className="mt-5">
              <PreorderButton placement="drop" className="cta cta-wide min-w-[200px]" />
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}
