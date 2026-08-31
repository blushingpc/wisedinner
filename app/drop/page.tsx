import type { Metadata } from "next";
import { drop } from "@/data/drop";
import { PageView } from "@/app/ui/page-view";
import { ReceiptCard } from "@/app/ui/receipt-card";
import { Section } from "@/app/ui/section";
import { WaitlistForm } from "@/app/ui/waitlist-form";

export const metadata: Metadata = {
  title: "This week's protein plan — WiseDinner",
  description: "One universal high-protein week at real in-store prices, refreshed every Sunday.",
  alternates: { canonical: "/drop" },
  openGraph: { images: ["/og?page=drop"] },
};

export default function Drop() {
  return (
    <main id="main">
      <PageView event="drop_view" />
      <Section className="grid gap-12 lg:grid-cols-[1fr_1.4fr]">
        <div data-reveal className="order-2 lg:order-1">
          <ReceiptCard week={drop} variant="drop" title="this week's drop" tilt />
        </div>
        <div className="order-1 lg:order-2">
          <p className="font-mono text-micro uppercase text-green-600">refreshed every sunday · generated {drop.generated_at}</p>
          <h1 className="mt-4 text-display font-bold text-balance">this week&apos;s protein plan.</h1>
          <p className="mt-6 max-w-[62ch] text-xl text-ink-soft">
            one universal week: {drop.input.protein_per_day} g protein a day for one person, solved under ${drop.input.budget} at this week&apos;s estimated shelf prices. no
            account, no card. your own numbers go through the demo.
          </p>
          <ol className="mt-8 max-w-[62ch]">
            {drop.days.map((d) => (
              <li key={d.day} className="border-t border-rule py-4">
                <div className="flex items-baseline justify-between font-mono text-micro uppercase text-ink-soft">
                  <span>{d.day}</span>
                  <span>
                    {d.protein_g} g · {d.kcal} kcal
                  </span>
                </div>
                <ol className="mt-1 grid gap-1">
                  {d.items.map((i) => (
                    <li key={i.unit} className="grid grid-cols-[5.5rem_1fr_auto] items-baseline gap-2">
                      <span className="font-mono text-micro uppercase text-ink-soft">{i.unit}</span>
                      <span>
                        {i.name}
                        <span className="block font-mono text-micro text-ink-soft">{i.portion}</span>
                      </span>
                      <span className="font-mono text-spec tabular-nums text-ink-soft">{i.protein_g} g</span>
                    </li>
                  ))}
                </ol>
              </li>
            ))}
          </ol>
          <div className="mt-12 border-t border-rule pt-8">
            <h2 className="text-2xl font-medium">get next week&apos;s drop first</h2>
            <div className="mt-6">
              <WaitlistForm source="drop" />
            </div>
          </div>
        </div>
      </Section>
    </main>
  );
}
