import { site } from "@/content/site";
import { FAQ, SITE, faqLd } from "./copy";
import { Accordion } from "./ui/accordion";
import { PhoneStage } from "./ui/phone-stage";
import { GroceryList, ReceiptReveal, ShareWeek, ThisWeek, TwoNumbers } from "./screens";
import { fixtureWeek, usd } from "@/data/fixtures";
import { BADGES_LIVE, PLAY_IS_LIVE } from "@/lib/links";
import { StoreBadges } from "./ui/store-badges";
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

// hero phones (SITE-V5 §2): the left phone's two numbers are the brief's ($60, 150g); the right phone is S1 on the
// showcase fixture, the same screen as store shot 02
const TUE = fixtureWeek.days.find((d) => d.day === "tue") ?? fixtureWeek.days[0];
const TWO = { budget: "$60", protein: "150g" };

export default function Home() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(ORG)}</script>
      <script type="application/ld+json">{JSON.stringify(APP)}</script>
      <script type="application/ld+json">{JSON.stringify(faqLd(FAQ))}</script>

      {/* HERO (REDESIGN-V4 §6, SITE-V5 §2, Cal AI structure): two columns from 1024px, stacked below. left: H1, sub,
          the pre-order button and its microline (or the stacked store badges once BADGES_LIVE). right: the two-phone
          stage. on phones the H1 starts 24px under the header (the grid padding), the copy stays above the sticky
          bar (100dvh minus 90) and the stage rises into the first viewport. every entrance here is transform-only
          (rise-up): an opacity fade keeps the LCP candidate unpainted until it ends. */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 pt-6 pb-10 sm:pt-10 sm:pb-12 lg:grid-cols-[1.2fr_1fr] lg:gap-10 lg:px-12 lg:py-12">
          <div>
            <h1 className="rise-up text-h1 sm:text-balance">
              {site.hero.h1.split(/(?<=\.) /).map((line) => (
                <span key={line} data-line className="block text-balance">
                  {line}
                </span>
              ))}
            </h1>
            <p className="rise-up mt-4 max-w-[52ch] text-[1.0625rem] leading-[1.5] text-ink-2 [animation-delay:120ms] sm:mt-5 sm:text-lg">{site.hero.lede}</p>
            <div className="rise-up mt-6 sm:mt-8 [animation-delay:160ms]">
              {/* the badges replace the button only while BADGES_LIVE (lib/links.ts): stacked, left-aligned, App Store
                  above Google Play, Play only once its URL exists */}
              {BADGES_LIVE ? (
                <StoreBadges placement="hero" height={48} play={PLAY_IS_LIVE} release={false} className="flex-col items-start" />
              ) : (
                <>
                  <PreorderButton placement="hero" className="cta cta-wide min-w-[200px]" />
                  <p className="mt-3 text-sm text-ink-2">{site.hero.micro}</p>
                </>
              )}
            </div>
            {/* the mobile sticky bar shows once this line has scrolled off the top */}
            <div id={MOBILE_CTA_SENTINEL} aria-hidden="true" />
          </div>

          {/* no entrance fade here: the right phone's bezel may be the LCP element and must paint the moment it decodes */}
          <div>
            <PhoneStage
              left={<TwoNumbers budget={TWO.budget} protein={TWO.protein} />}
              right={<ThisWeek week={fixtureWeek} active="tue" />}
              leftLabel={`Phone showing the two numbers: a ${TWO.budget} weekly budget and ${TWO.protein} of protein a day, and the solve button`}
              rightLabel={`Phone showing the solved week: ${usd(fixtureWeek.totals.est_total_usd)}, one trip; Tuesday is ${TUE.meals.map((m) => m.name).join(", ")}`}
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
