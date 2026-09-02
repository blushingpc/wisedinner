import type { Metadata } from "next";
import { PageView } from "@/app/ui/page-view";
import { Section } from "@/app/ui/section";
import { WaitlistForm } from "@/app/ui/waitlist-form";
import { SITE } from "@/app/copy";
import { site } from "@/content/site";

const TIERS = site.pricing.tiers;
const money = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

export const metadata: Metadata = {
  title: "Pricing — WiseDinner",
  description: `what wisedinner will cost when the app ships: ${money(TIERS[0].perMonth)} a month billed yearly or ${money(TIERS[0].monthly)} monthly, 21-day free trial, cancel anytime. nothing for sale here yet.`,
  alternates: { canonical: "/pricing" },
  openGraph: { images: ["/og?page=pricing"] },
};

// Product + one Offer per tier and term (WD-16). PreOrder availability: nothing is for sale on this page yet.
const LD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "WiseDinner",
  description: "a meal planner that turns a weekly budget and a daily protein target into five days of meals, one short list and an estimated in-store total.",
  brand: { "@type": "Brand", name: "wisedinner" },
  offers: TIERS.flatMap((t) => [
    { "@type": "Offer", name: `${t.name} — yearly`, price: t.yearly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder", url: `${SITE}/pricing` },
    { "@type": "Offer", name: `${t.name} — monthly`, price: t.monthly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder", url: `${SITE}/pricing` },
  ]),
};

export default function Pricing() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(LD)}</script>
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
                <span className="text-5xl font-medium">{money(t.perMonth)}</span>
                <span className="text-ink-soft">/mo billed yearly</span>
              </p>
              <p className="mt-1 font-mono text-spec tabular-nums text-ink-soft">
                {money(t.yearly)}/yr · or {money(t.monthly)}/mo monthly
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
