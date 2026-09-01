import type { Metadata } from "next";
import { PageView } from "@/app/ui/page-view";
import { Section } from "@/app/ui/section";
import { WaitlistForm } from "@/app/ui/waitlist-form";

export const metadata: Metadata = {
  title: "Pricing — WiseDinner",
  description: "What WiseDinner will cost when the app ships. Simple, annual-first, 21-day trial.",
  alternates: { canonical: "/pricing" },
  openGraph: { images: ["/og?page=pricing"] },
};

const TIERS = [
  {
    name: "protein plan",
    monthly: "$8.99",
    yearly: "$59",
    perMonth: "$4.99",
    popular: true,
    rows: [
      ["weeks solved", "unlimited"],
      ["grocery list", "export + print"],
      ["re-solve", "any time"],
      ["receipt ledger", "included"],
      ["pantry credit", "included"],
    ],
  },
  {
    name: "autopilot",
    monthly: "$12.99",
    yearly: "$89",
    perMonth: "$7.49",
    popular: false,
    rows: [
      ["everything in protein plan", "yes"],
      ["next week, solved automatically", "sunday"],
      ["price alerts on your staples", "weekly"],
      ["household up to", "4"],
      ["delivery export w/ fees shown", "included"],
    ],
  },
];

export default function Pricing() {
  return (
    <main id="main">
      <PageView event="pricing_view" />
      <Section>
        <p className="font-mono text-micro uppercase text-green-600">pricing</p>
        <h1 className="mt-4 text-display font-bold text-balance">pricing that&apos;ll apply in the app — nothing for sale on this page yet.</h1>
        <div className="mt-12 grid gap-8 lg:grid-cols-2">
          {TIERS.map((t, i) => (
            <div key={t.name} data-reveal style={{ "--i": i } as React.CSSProperties} className="rounded-[14px] border border-rule p-6 sm:p-8">
              <div className="flex items-baseline justify-between gap-4">
                <h2 className="text-2xl font-medium">{t.name}</h2>
                {t.popular && <span className="rounded-full bg-accent-wash px-3 py-1 font-mono text-micro uppercase text-accent">most popular</span>}
              </div>
              <p className="mt-6 font-mono tabular-nums">
                <span className="text-5xl font-medium">{t.perMonth}</span>
                <span className="text-ink-soft">/mo billed yearly</span>
              </p>
              <p className="mt-1 font-mono text-spec tabular-nums text-ink-soft">
                {t.yearly}/yr · or {t.monthly}/mo monthly
              </p>
              <dl className="mt-8 font-mono text-spec">
                {t.rows.map(([k, v]) => (
                  <div key={k} className="flex items-baseline justify-between gap-4 border-t border-rule py-2">
                    <dt className="text-ink-soft">{k}</dt>
                    <dd className="tabular-nums">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
        <p className="mt-8 font-mono text-micro uppercase text-ink-soft">21-day free trial in the app · cancel anytime · prices may change before launch</p>
        <div className="mt-14 border-t border-rule pt-8">
          <h2 className="text-2xl font-medium">not on iPhone? get the launch email</h2>
          <div className="mt-6">
            <WaitlistForm source="pricing" />
          </div>
        </div>
      </Section>
    </main>
  );
}
