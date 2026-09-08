import type { Metadata } from "next";
import { PageView } from "@/app/ui/page-view";
import { PageShell } from "@/app/ui/page-shell";
import { WaitlistForm } from "@/app/ui/waitlist-form";
import { PricingCards } from "@/app/ui/pricing-cards";
import { SITE } from "@/app/copy";
import { site } from "@/content/site";

const TIERS = site.pricing.tiers;
const money = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

export const metadata: Metadata = {
  title: "Pricing",
  description: `What WiseDinner will cost when the app ships. The pre-order build is free. Protein Plan ${money(TIERS[0].monthly)} a month or ${money(TIERS[0].yearly)} a year, Autopilot ${money(TIERS[1].monthly)} a month or ${money(TIERS[1].yearly)} a year, 14-day free trial in the app. Nothing for sale here yet.`,
  alternates: { canonical: "/pricing" },
  openGraph: { images: ["/og?page=pricing"] },
};

// Product plus one Offer per tier and term. PreOrder availability: nothing is for sale on this page yet.
const LD = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "WiseDinner",
  description: site.hero.lede,
  brand: { "@type": "Brand", name: "WiseDinner" },
  offers: TIERS.flatMap((t) => [
    { "@type": "Offer", name: `${t.name}, yearly`, price: t.yearly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder", url: `${SITE}/pricing` },
    { "@type": "Offer", name: `${t.name}, monthly`, price: t.monthly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder", url: `${SITE}/pricing` },
  ]),
};

export default function Pricing() {
  return (
    <PageShell title={site.pricing.h2} sub="These prices apply in the app at launch. Nothing is for sale on this page yet." wide>
      <script type="application/ld+json">{JSON.stringify(LD)}</script>
      <PageView event="pricing_view" />
      <PricingCards />
      <div className="mx-auto mt-16 max-w-md border-t border-border pt-10 text-center">
        <h2 className="text-h3">Get the launch email</h2>
        <div className="mt-5">
          <WaitlistForm source="pricing" />
        </div>
      </div>
    </PageShell>
  );
}
