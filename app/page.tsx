import Image from "next/image";
import Link from "next/link";
import { site } from "@/content/site";
import { FAQ, SITE, faqLd } from "./copy";
import { Accordion } from "./ui/accordion";
import { AppStoreBadge } from "./ui/app-store-badge";
import { HeroEmailFallback } from "./ui/hero-email-fallback";
import { PhoneStage } from "./ui/phone-stage";
import { FeatureSwitcher } from "./ui/feature-switcher";
import { MOBILE_CTA_SENTINEL, MobileCtaBar } from "./ui/mobile-cta-bar";
import { People } from "./ui/people";
import { PreorderButton } from "./ui/preorder-button";
import { Section } from "./ui/section";
import { WaitlistForm } from "./ui/waitlist-form";
import { APP_STORE_IS_LIVE } from "@/lib/links";

const ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "wisedinner",
  url: SITE,
  logo: `${SITE}/press/wisedinner-mark.png`,
  email: "support@wisedinner.com",
  // benefit-worded on purpose — system words (solver etc.) stay off every homepage surface, JSON-LD included
  description:
    "a meal planner that turns two numbers — your weekly budget and your daily protein — into a solved week: five days of meals, one short list, an estimated in-store total.",
};

// S2 band art direction: the 3:1 row of plates on ≥ sm, the tall crop on phones (same next/image ladders, one request)
const APP = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "WiseDinner",
  applicationCategory: "LifestyleApplication",
  operatingSystem: "iOS",
  url: SITE,
  description: ORG.description,
  offers: site.pricing.tiers.flatMap((t) => [
    { "@type": "Offer", name: `${t.name} — yearly`, price: t.yearly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder" },
    { "@type": "Offer", name: `${t.name} — monthly`, price: t.monthly.toFixed(2), priceCurrency: "USD", availability: "https://schema.org/PreOrder" },
  ]),
};

export default function Home() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(ORG)}</script>
      <script type="application/ld+json">{JSON.stringify(APP)}</script>
      <script type="application/ld+json">{JSON.stringify(faqLd(FAQ.slice(0, 4)))}</script>

      {/* S1 hero — one phone full of food, cut-out dishes, inline email (DESIGN-AUDIT §8) */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-6 px-6 py-7 lg:min-h-[90dvh] lg:grid-cols-[5fr_7fr] lg:gap-10 lg:px-12 lg:py-16">
          <div>
            <p className="fade-up mb-4 text-caption font-semibold text-kale">{site.hero.eyebrow}</p>
            <h1 className="rise-up text-display font-extrabold text-balance">{site.hero.h1}</h1>
            <p className="fade-up mt-5 max-w-[44ch] text-xl text-ink-soft [animation-delay:80ms]">{site.hero.lede}</p>
            {/* no entrance animation on this row — the Apple badge must never animate.
                listing not live: the waitlist form IS the primary control (funnel decision 2026-09-05); live: badge + email fallback */}
            <div className="mt-6 flex items-start gap-8 lg:mt-8">
              <div className="min-w-0 flex-1">
                {APP_STORE_IS_LIVE ? (
                  <div className="flex flex-wrap items-center gap-4">
                    <AppStoreBadge placement="hero" />
                  </div>
                ) : (
                  <>
                    <WaitlistForm source="hero" button="get early access" placement="hero" />
                    <p className="mt-1 text-caption font-semibold text-kale">{site.hero.preorderNote}</p>
                  </>
                )}
                {APP_STORE_IS_LIVE && site.hero.perk && <p className="mt-3 text-caption font-semibold text-kale lg:mt-4">{site.hero.perk}</p>}
              </div>
              {/* WD-07: the QR encodes wisedinner.com/ios, a redirect we control (next.config.ts) — never the raw store URL.
                  only while live — before that there is nothing to scan to */}
              {APP_STORE_IS_LIVE && (
                <div className="hidden shrink-0 lg:block">
                <Image src="/badges/qr-ios.svg" alt="QR code — scan to open the WiseDinner pre-order page" width={96} height={96} />
                <p className="mt-1 text-[0.75rem] text-ink-3">scan to pre-order</p>
                  <p className="font-mono text-[0.6875rem] text-ink-3">wisedinner.com/ios</p>
                </div>
              )}
            </div>
            {/* the mobile sticky bar shows once this line has scrolled off the top (WD-03) */}
            <div id={MOBILE_CTA_SENTINEL} aria-hidden="true" />
            {APP_STORE_IS_LIVE && <HeroEmailFallback className="fade-up mt-3 [animation-delay:240ms] lg:mt-4" />}
            {APP_STORE_IS_LIVE && site.hero.pill && (
              <p className="fade-up mt-3 inline-flex items-center rounded-full border border-rule px-3 py-1 text-caption font-semibold text-ink-soft [animation-delay:240ms] lg:mt-4">
                {site.hero.pill}
              </p>
            )}
          </div>

          <div className="fade-up [animation-delay:160ms]">
            <PhoneStage />
          </div>
        </div>
      </section>

      {/* SECTION 2 — what does wisedinner include? (REDESIGN-V3 §4): the switcher */}
      <FeatureSwitcher />

      {/* S6b people — proof row + quotes from content/site.ts, real values only; behind NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF, hidden in production */}
      <People />

      {/* S7 faq preview — launch question first (§9.10) */}
      <Section>
        <h2 className="text-h2 font-bold">questions</h2>
        <div className="mt-8 max-w-[60ch]">
          <Accordion items={FAQ.slice(0, 4)} />
        </div>
        <Link href="/faq" className="text-link mt-6 inline-flex min-h-11 items-center">
          all questions →
        </Link>
      </Section>

      {/* S8 final cta — the page's boldest moment, saved for last (§9.11, yolk ground) */}
      <section id="early-access" className="bg-yolk py-band pb-36 text-ink sm:pb-band">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-6 lg:grid-cols-2 lg:px-12">
          <h2 className="text-display font-bold text-balance">your protein. your budget. <em>solved.</em></h2>
          <div className="self-center">
            {APP_STORE_IS_LIVE ? (
              <>
                <div className="flex flex-wrap items-center gap-4">
                  <PreorderButton variant="ink" placement="final" />
                </div>
                <p className="mt-3 text-[0.8125rem] text-ink/80">{site.finalCta.under}</p>
                <div className="mt-8">
                  <WaitlistForm source="final" yolk label="not on iPhone? get the launch email" />
                </div>
              </>
            ) : (
              <>
                <WaitlistForm source="final" yolk button="get early access" placement="final" />
              </>
            )}
          </div>
        </div>
      </section>
      <MobileCtaBar />
    </main>
  );
}
