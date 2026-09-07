import type { Metadata } from "next";
import { PageView } from "@/app/ui/page-view";
import { Section } from "@/app/ui/section";
import { WaitlistForm } from "@/app/ui/waitlist-form";
import { PricingCards } from "@/app/ui/pricing-cards";
import { SITE } from "@/app/copy";
import { site } from "@/content/site";

const TIERS = site.pricing.tiers;
const money = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

export const metadata: Metadata = {
  title: "Pricing — WiseDinner",
  description: `what wisedinner will cost when the app ships: the pre-order build is free; protein plan ${money(TIERS[0].monthly)}/mo or ${money(TIERS[0].yearly)}/yr, autopilot ${money(TIERS[1].monthly)}/mo or ${money(TIERS[1].yearly)}/yr, 14-day free trial in the app. nothing for sale here yet.`,
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
        <div className="mt-12">
          <PricingCards />
        </div>
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
