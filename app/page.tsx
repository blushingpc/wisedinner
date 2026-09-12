import { site } from "@/content/site";
import { FAQ, SITE, faqLd } from "./copy";
import { Accordion } from "./ui/accordion";
import { PhoneStage } from "./ui/phone-stage";
import { GroceryList, ReceiptReveal, ShareWeek, ThisWeek } from "./screens";
import { fixtureWeek, usd } from "@/data/fixtures";
import { budgetPhrase } from "@/lib/showcase";
import { FeatureSwitcher } from "./ui/feature-switcher";
import { Why } from "./ui/why";
import { MOBILE_CTA_SENTINEL, MobileCtaBar } from "./ui/mobile-cta-bar";
import { Testers } from "./ui/testers";
import { PricingCards } from "./ui/pricing-cards";
import { PreorderBand } from "./ui/preorder-band";
import { Section, SectionHeading } from "./ui/section";
import { PreorderButton } from "./ui/preorder-modal";

const ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "WiseDinner",
  url: SITE,
  logo: `${SITE}/press/wisedinner-mark.png`,
  email: "support@wisedinner.com",
  description: site.hero.lede,
};

const APP = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "WiseDinner",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "iOS",
  url: SITE,
  description: site.hero.lede,
  offers: site.pricing.tiers.flatMap((t) => [
    { "@type": "Offer", name: `${t.name}, yearly`, price: t.yearly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder" },
    { "@type": "Offer", name: `${t.name}, monthly`, price: t.monthly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder" },
  ]),
};

// hero fixture reads (REDESIGN-V4 §6): the callout sits on the burrito-bowl cut-out, so it names Tuesday's chicken
// burrito bowl whichever slot the fixture put it in, and falls back to Tuesday's lunch when a regenerated week drops it
const TUE = fixtureWeek.days.find((d) => d.day === "tue") ?? fixtureWeek.days[0];
const LUNCH = TUE.meals.find((m) => m.menu === "chicken-burrito-bowl") ?? TUE.meals.find((m) => m.slot === "lunch") ?? TUE.meals[0];
// "Under a $57 budget": the budget is a whole-dollar input; the under-budget amount is cents at the showcase target
const BUDGET_LINE = budgetPhrase(fixtureWeek).replace(/^./, (c) => c.toUpperCase());

export default function Home() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(ORG)}</script>
      <script type="application/ld+json">{JSON.stringify(APP)}</script>
      <script type="application/ld+json">{JSON.stringify(faqLd(FAQ))}</script>

      {/* HERO (REDESIGN-V4 §6): two columns from 1024px, stacked below. left: pill, H1, sub, the pre-order button, the
          microline. right: the phone stage. nothing else above the fold. every entrance here is transform-only
          (rise-up): an opacity fade keeps the LCP candidate unpainted until it ends, which measured as 2.3s of
          element render delay on the sub paragraph. */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 pt-10 pb-12 lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:px-12 lg:py-12">
          <div>
            <p className="rise-up inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-1.5 text-sm font-medium text-ink">
              <span aria-hidden="true" className="size-2 rounded-full bg-emerald" />
              {site.hero.pill}
            </p>
            <h1 className="rise-up mt-5 text-h1 text-balance">{site.hero.h1}</h1>
            <p className="rise-up mt-5 max-w-[52ch] text-lg text-ink-2 [animation-delay:120ms]">{site.hero.lede}</p>
            <div className="rise-up mt-8 [animation-delay:160ms]">
              <PreorderButton placement="hero" className="cta cta-wide min-w-[200px]" />
              <p className="mt-3 text-sm text-ink-2">{site.hero.micro}</p>
            </div>
            {/* the mobile sticky bar shows once this line has scrolled off the top */}
            <div id={MOBILE_CTA_SENTINEL} aria-hidden="true" />
          </div>

          {/* no entrance fade here: the S1 bezel is the LCP element and must paint the moment it decodes */}
          <div>
            <PhoneStage
              s1={<ThisWeek week={fixtureWeek} active="tue" />}
              s4={<ReceiptReveal week={fixtureWeek} />}
              s1Label={`Phone showing this week: ${TUE.meals.map((m) => m.name).join(", ")}; ${budgetPhrase(fixtureWeek)}`}
              s4Label={`Phone showing the receipt reveal: estimated ${usd(fixtureWeek.receipt.estimated_usd)}, actual ${usd(fixtureWeek.receipt.actual_usd)}, receipt verified`}
              calloutMeal={`${LUNCH.name}, ${LUNCH.protein_g}g protein, ${usd(LUNCH.cost_usd)}`}
              calloutBudget={BUDGET_LINE}
            />
          </div>
        </div>
      </section>

      {/* SECTION 2: the switcher */}
      <FeatureSwitcher
        h2={site.include.h2}
        items={site.include.items}
        screens={[
          <ThisWeek key="s1" week={fixtureWeek} active="tue" />,
          <GroceryList key="s2" week={fixtureWeek} />,
          <ShareWeek key="s3" week={fixtureWeek} />,
          <ReceiptReveal key="s4" week={fixtureWeek} />,
        ]}
      />

      {/* SECTION 3: why */}
      <Why />

      {/* SECTION 4: testers (placeholder entries behind NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF, hidden in production) */}
      <Testers />

      {/* SECTION 5: pricing */}
      <Section id="pricing" alt lazy>
        <SectionHeading>{site.pricing.h2}</SectionHeading>
        <div className="mt-10 lg:mt-14">
          <PricingCards compact />
        </div>
      </Section>

      {/* SECTION 6: the eight questions */}
      <Section lazy>
        <SectionHeading>{site.faq.h2}</SectionHeading>
        <div className="mx-auto mt-10 max-w-[64ch] lg:mt-14">
          <Accordion items={FAQ} />
        </div>
      </Section>

      {/* SECTION 7: the pre-order band */}
      <PreorderBand />

      <MobileCtaBar />
    </main>
  );
}
