import Image from "next/image";
import Link from "next/link";
import { drop } from "@/data/drop";
import { meals } from "@/data/meals";
import { site } from "@/content/site";
import { ABOUT, FAQ, HERO, SITE } from "./copy";
import { Accordion } from "./ui/accordion";
import { AppStoreBadge } from "./ui/app-store-badge";
import { HeroEmailFallback } from "./ui/hero-email-fallback";
import { DeviceFrame } from "./ui/device-frame";
import { MobileCtaBar } from "./ui/mobile-cta-bar";
import { InlineDemo } from "./ui/inline-demo";
import { MealCard } from "./ui/meal-card";
import { People } from "./ui/people";
import { PreorderButton } from "./ui/preorder-button";
import { ProofChip } from "./ui/proof-chip";
import { PinnedWalkthrough } from "./ui/pinned-walkthrough";
import { ReceiptCard } from "./ui/receipt-card";
import { Section } from "./ui/section";
import { ShelfTag } from "./ui/shelf-tag";
import { WaitlistForm } from "./ui/waitlist-form";

const ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "wisedinner",
  url: SITE,
  logo: `${SITE}/press/wisedinner-mark.png`,
  email: "support@wisedinner.com",
  description: ABOUT[1],
};

// "this week" screen — food first: depicted meals with computed prices (data/meals.ts), no receipt, no kcal.
function ScreenThisWeek({ priority = false }: { priority?: boolean }) {
  return (
    <>
      <p className="text-caption font-semibold text-kale">this week</p>
      {meals.slice(0, 3).map((m) => (
        <MealCard key={m.name} meal={m} priority={priority} />
      ))}
      <p className="mt-4 text-caption font-semibold text-ink-soft">five days · one list · one trip</p>
    </>
  );
}

// "the list" screen — the hero phone's second face (§12.1 crossfade). no numerals: the numbers gate holds.
function ScreenTheList() {
  const fresh = drop.list.filter((i) => i.perishable).map((i) => i.name);
  const shelf = drop.list.filter((i) => !i.perishable).map((i) => i.name);
  const row = (n: string) => (
    <li key={n} className="flex items-center gap-2 text-[0.9375rem]">
      <span aria-hidden="true" className="grid size-4 shrink-0 place-items-center rounded-[4px] bg-yolk text-[10px] font-bold text-ink">
        ✓
      </span>
      {n}
    </li>
  );
  return (
    <>
      <p className="text-caption font-semibold text-ink-soft">the list</p>
      <p className="mt-3 text-caption font-semibold text-kale">fresh aisle</p>
      <ul className="mt-2 grid gap-1.5">{fresh.slice(0, 5).map(row)}</ul>
      <p className="mt-4 text-caption font-semibold text-kale">shelf + freezer</p>
      <ul className="mt-2 grid gap-1.5">
        {shelf.slice(0, 5).map(row)}
        <li className="text-ink-soft">…</li>
      </ul>
      <p className="mt-4 text-caption font-semibold text-ink-soft">empty fridge, on purpose.</p>
    </>
  );
}

// dinner-card pool for the inline demo — precomputed server-side so staples stay out of the client bundle
const demoPool = meals.map(({ name, img, alt, price_usd }) => ({ name, img, alt, price_usd }));

export default function Home() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(ORG)}</script>

      {/* S1 hero — one phone full of food, cut-out dishes, inline email (DESIGN-AUDIT §8) */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-6 px-6 py-7 lg:min-h-[90dvh] lg:grid-cols-[5fr_7fr] lg:gap-10 lg:px-12 lg:py-16">
          <div>
            <ProofChip className="fade-up mb-4" />
            <h1 className="rise-up text-display font-extrabold text-balance">{site.hero.h1}</h1>
            <p className="fade-up mt-5 max-w-[44ch] text-xl text-ink-soft [animation-delay:80ms]">{site.hero.lede}</p>
            {/* no entrance animation on this row — the Apple badge must never animate */}
            <div className="mt-6 flex items-start gap-8 lg:mt-8">
              <div>
                <div className="flex flex-wrap items-center gap-4">
                  <AppStoreBadge placement="hero" />
                  <Link href="/start" className="cta cta-ghost">
                    {HERO.demo}
                  </Link>
                </div>
                {site.hero.perk && <p className="mt-3 text-caption font-semibold text-kale lg:mt-4">{site.hero.perk}</p>}
              </div>
              {/* TODO(launch): swap for a QR that encodes the App Store URL */}
              <div className="hidden shrink-0 lg:block">
                <Image src="/badges/qr-placeholder.svg" alt="" width={96} height={96} />
                <p className="mt-1 text-[0.75rem] text-ink-3">scan to pre-order</p>
              </div>
            </div>
            <HeroEmailFallback className="fade-up mt-3 [animation-delay:240ms] lg:mt-4" />
            <p className="fade-up mt-3 inline-flex items-center rounded-full border border-rule px-3 py-1 text-caption font-semibold text-ink-soft [animation-delay:240ms] lg:mt-4">
              {site.hero.pill}
            </p>
          </div>

          <div className="hero-field fade-up relative mx-auto h-[660px] w-full max-w-[600px] [animation-delay:160ms] lg:h-[780px]">
            <DeviceFrame
              label="phone alternating between this week's meals with prices and the one grocery list"
              tilt="left"
              widthClass="w-[300px] lg:w-[430px]"
              className="absolute left-1/2 top-0 -translate-x-1/2 rotate-3 lg:rotate-6"
            >
              <div className="relative h-full">
                <div className="absolute inset-0">
                  <ScreenThisWeek priority />
                </div>
                <div aria-hidden="true" className="hero-xfade-b absolute inset-0">
                  <ScreenTheList />
                </div>
              </div>
            </DeviceFrame>
            <ShelfTag label={`$${drop.est_total.toFixed(2)}`} sub="one trip" className="absolute right-2 top-10 z-10 lg:right-6" />
            <Image
              src="/img/A1-1.png"
              alt="ceramic bowl of sliced roasted chicken thigh over rice with charred broccoli"
              width={1600}
              height={1600}
              quality={75}
              priority
              sizes="(min-width: 1024px) 260px, 170px"
              className="dish-drift img-grade absolute -left-2 bottom-4 z-10 w-[170px] [filter:drop-shadow(0_24px_28px_rgba(27,26,24,0.28))] lg:-left-6 lg:bottom-10 lg:w-[260px]"
            />
            <Image
              src="/img/A1-3.png"
              alt="glass of greek yogurt layered with oats and banana slices"
              width={1600}
              height={1600}
              quality={75}
              sizes="180px"
              style={{ animationDelay: "-3s" }}
              className="dish-drift img-grade absolute -right-4 bottom-32 z-10 hidden w-[180px] [filter:drop-shadow(0_24px_28px_rgba(27,26,24,0.28))] lg:block"
            />
          </div>
        </div>
      </section>

      {/* S2 five dinners — full-bleed food strip (DESIGN-AUDIT §9.3), the page's color moment */}
      <section id="week" className="relative">
        <Image
          src="/img/A2.jpg"
          priority
          fetchPriority="high"
          alt="five different home-cooked high-protein dinners plated in a row on a linen tablecloth in warm evening light"
          width={2560}
          height={853}
          quality={80}
          sizes="100vw"
          className="img-grade hidden w-full object-cover sm:block lg:min-h-[60vh]"
        />
        <Image
          src="/img/A2-mobile.jpg"
          priority
          fetchPriority="high"
          alt="five different home-cooked high-protein dinners plated in a row on a linen tablecloth in warm evening light"
          width={1600}
          height={2000}
          quality={75}
          sizes="100vw"
          className="img-grade w-full sm:hidden"
        />
        {/* paper scrim block, bottom-left on desktop, beneath the image on mobile — the plates are never covered by text */}
        <div className="bg-bg lg:absolute lg:bottom-0 lg:left-0 lg:max-w-[640px] lg:rounded-tr-[14px]">
          <div className="px-6 py-8 lg:px-12 lg:py-10">
            <h2 className="text-h2 font-bold text-balance">{site.strip.h2}</h2>
            <p className="mt-3 text-caption font-semibold text-kale">{site.strip.caption}</p>
            <p className="mt-2 text-[0.9375rem] font-semibold text-kale">{site.strip.enemy}</p>
          </div>
        </div>
      </section>

      {/* S2b what happens when you pre-order — three lines on paper, hairline rules, no cards, no icons */}
      <section className="py-14 lg:py-20">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
          <div className="max-w-[46ch] divide-y divide-rule">
            <p className="py-5 text-[clamp(22px,2.2vw,28px)] leading-tight font-bold">tap pre-order. it&apos;s free.</p>
            <p className="py-5 text-[clamp(22px,2.2vw,28px)] leading-tight font-bold">launch day, it installs itself. we&apos;ll tell you the date.</p>
            <p className="py-5 text-[clamp(22px,2.2vw,28px)] leading-tight font-bold">your solved week is already inside.</p>
          </div>
          <p className="mt-2 max-w-[46ch] text-[1rem] font-normal text-ink-soft">
            solve a week in the demo and save it — it&apos;s waiting in the app on day one.
          </p>
        </div>
      </section>

      {/* S3 how it works — pinned phone, three screens swap on scroll; mobile swipe carousel (§9.4, Tier 1 item 5) */}
      <PinnedWalkthrough
        fresh={drop.list.filter((i) => i.perishable).map((i) => i.name)}
        shelf={drop.list.filter((i) => !i.perishable).map((i) => i.name)}
      />

      {/* S4 receipt room — the one receipt on the homepage, printing in on kale (§9.7, Tier 2 item 1) */}
      <section className="relative overflow-hidden bg-kale py-16 text-bg lg:py-24">
        <Image
          src="/img/A3.jpg"
          alt=""
          fill
          quality={70}
          sizes="100vw"
          className="img-grade object-cover opacity-30"
        />
        <div className="relative mx-auto grid max-w-[1200px] items-center gap-12 px-6 lg:grid-cols-[5fr_7fr] lg:px-12">
          <div>
            <h2 className="text-h2 font-bold text-balance">{site.receipt.h2}</h2>
            <p className="mt-4 max-w-[44ch] text-[1.125rem] leading-relaxed text-bg/85">{site.receipt.caption}</p>
            <p className="mt-2 max-w-[44ch] text-[1.125rem] leading-relaxed text-bg/85">{site.receipt.promises}</p>
            <Link href="/the-math" className="text-link mt-5 inline-flex min-h-11 items-center text-bg">
              how the math works →
            </Link>
          </div>
          <div data-reveal className="receipt-print rotate-[3deg] justify-self-center lg:justify-self-start">
            <ReceiptCard week={drop} variant="proof" title="this week, solved" />
          </div>
        </div>
      </section>

      {/* S5 inline demo — step one of /start embedded, values carry into the quiz (§9.5, Tier 2 item 2) */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 lg:grid-cols-[5fr_7fr] lg:px-12">
          <h2 className="text-h2 font-bold text-balance">{site.demo.h2}</h2>
          <div className="w-full max-w-[520px] lg:justify-self-center">
            <InlineDemo pool={demoPool} />
          </div>
        </div>
      </section>

      {/* S6 three benefits — photo-led, no cards (§9.8, Tier 2 item 3) */}
      <section className="bg-white py-16 lg:py-24">
        <h2 className="sr-only">{site.changes.h2}</h2>
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 sm:grid-cols-3 sm:gap-6 lg:px-12">
          {(
            [
              { src: "/img/A4-1.jpg", alt: "hands plating sliced roasted chicken over rice in a warm kitchen, evening light" },
              { src: "/img/A4-2.jpg", alt: "a single wire grocery basket on a wooden counter holding twelve everyday staples" },
              { src: "/img/A4-3.jpg", alt: "an open, tidy refrigerator with five glass meal-prep containers on one shelf" },
            ] as const
          ).map((b, i) => (
            <figure key={b.src} className={i === 1 ? "lg:mt-10" : undefined}>
              <Image
                src={b.src}
                alt={b.alt}
                width={1400}
                height={1738}
                quality={75}
                sizes="(min-width: 640px) 33vw, 100vw"
                className="img-grade w-full rounded-[14px] object-cover"
              />
              <figcaption className="mt-4 text-[1.75rem] leading-tight font-bold text-balance">{site.changes.items[i].title}</figcaption>
              {site.changes.items[i].sub && <p className="mt-2 text-[0.9375rem] text-ink-soft">{site.changes.items[i].sub}</p>}
            </figure>
          ))}
        </div>
      </section>

      {/* S6b people — proof row + quotes from content/site.ts; zeroed values hide themselves (TRUTH-AUDIT rows stay open) */}
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
      <section id="early-access" className="bg-yolk py-14 pb-36 text-ink sm:pb-14 lg:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-6 lg:grid-cols-2 lg:px-12">
          <h2 className="text-display font-bold text-balance">your protein. your budget. <em>solved.</em></h2>
          <div className="self-center">
            <div className="flex flex-wrap items-center gap-4">
              <PreorderButton variant="ink" placement="final" />
              <Link href="/start" className="cta cta-ghost">
                {HERO.demo}
              </Link>
            </div>
            <p className="mt-3 text-[0.8125rem] text-ink/80">{site.finalCta.under}</p>
            <div className="mt-8">
              <WaitlistForm source="final" yolk label="not on iPhone? get the launch email" />
            </div>
          </div>
        </div>
      </section>
      <MobileCtaBar />
    </main>
  );
}
