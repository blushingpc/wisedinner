import Image from "next/image";
import Link from "next/link";
import { drop } from "@/data/drop";
import { meals } from "@/data/meals";
import { ABOUT, FAQ, HERO, SITE } from "./copy";
import { Accordion } from "./ui/accordion";
import { DeviceFrame } from "./ui/device-frame";
import { InlineDemo } from "./ui/inline-demo";
import { MealCard } from "./ui/meal-card";
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
      {meals.map((m, i) => (
        <MealCard key={m.name} meal={m} priority={priority && i === 0} />
      ))}
      <p className="mt-4 text-caption font-semibold text-ink-soft">five days · one list · one trip</p>
    </>
  );
}

export default function Home() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(ORG)}</script>

      {/* S1 hero — one phone full of food, cut-out dishes, inline email (DESIGN-AUDIT §8) */}
      <section className="overflow-hidden">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 py-12 lg:min-h-[90dvh] lg:grid-cols-[5fr_7fr] lg:px-12 lg:py-16">
          <div>
            <h1 className="text-display font-extrabold text-balance">{HERO.h1}</h1>
            <p className="mt-6 max-w-[44ch] text-xl text-ink-soft">{HERO.sub}</p>
            <div className="mt-8 max-w-md">
              <WaitlistForm source="hero" />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-5">
              <Link href="/start" className="cta cta-ghost">
                {HERO.demo}
              </Link>
              <p className="text-caption font-semibold text-ink-soft">{HERO.pill}</p>
            </div>
          </div>

          <div className="hero-field relative mx-auto h-[660px] w-full max-w-[600px] lg:h-[780px]">
            <DeviceFrame
              label="phone showing this week's plan: three meals with photos and prices"
              tilt="left"
              widthClass="w-[300px] lg:w-[430px]"
              className="absolute left-1/2 top-0 -translate-x-1/2 rotate-3 lg:rotate-6"
            >
              <ScreenThisWeek priority />
            </DeviceFrame>
            <ShelfTag label={`$${drop.est_total.toFixed(2)}`} sub="one trip" className="absolute right-2 top-10 z-10 lg:right-6" />
            <Image
              src="/img/A1-1.png"
              alt="ceramic bowl of sliced roasted chicken thigh over rice with charred broccoli"
              width={1600}
              height={1600}
              quality={75}
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
          alt="five different home-cooked high-protein dinners plated in a row on a linen tablecloth in warm evening light"
          width={2560}
          height={853}
          quality={80}
          sizes="100vw"
          className="img-grade hidden w-full sm:block"
        />
        <Image
          src="/img/A2-mobile.jpg"
          alt="five different home-cooked high-protein dinners plated in a row on a linen tablecloth in warm evening light"
          width={1600}
          height={2000}
          quality={75}
          sizes="100vw"
          className="img-grade w-full sm:hidden"
        />
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-bg via-bg/80 to-transparent pt-28">
          <div className="mx-auto max-w-[1200px] px-6 pb-8 lg:px-12">
            <h2 className="text-h2 font-bold text-balance">
              five dinners. one trip. ${drop.est_total.toFixed(2)}.
            </h2>
            <p className="mt-3 text-caption font-semibold text-kale">about {drop.protein_per_day} g of protein a day, nothing left to rot on thursday.</p>
          </div>
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
            <h2 className="text-h2 font-bold text-balance">the receipt is the proof.</h2>
            <p className="mt-4 max-w-[44ch] text-bg/80">
              shelf prices, refreshed weekly. no delivery markups, no sponsored picks, no fake reviews.
            </p>
          </div>
          <div data-reveal className="receipt-print rotate-[3deg] justify-self-center lg:justify-self-start">
            <ReceiptCard week={drop} variant="proof" title="this week, solved" />
          </div>
        </div>
      </section>

      {/* S5 inline demo — step one of /start embedded, values carry into the quiz (§9.5, Tier 2 item 2) */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto grid max-w-[1200px] items-center gap-10 px-6 lg:grid-cols-[5fr_7fr] lg:px-12">
          <h2 className="text-h2 font-bold text-balance">see your week solved in 60 seconds.</h2>
          <div className="w-full max-w-[520px] lg:justify-self-center">
            <InlineDemo />
          </div>
        </div>
      </section>

      {/* S6 three benefits — photo-led, no cards (§9.8, Tier 2 item 3) */}
      <section className="bg-white py-16 lg:py-24">
        <h2 className="sr-only">what changes</h2>
        <div className="mx-auto grid max-w-[1200px] gap-10 px-6 sm:grid-cols-3 sm:gap-6 lg:px-12">
          {(
            [
              {
                src: "/img/A4-1.jpg",
                alt: "hands plating sliced roasted chicken over rice in a warm kitchen, evening light",
                line: "never ask “what’s for dinner.”",
              },
              {
                src: "/img/A4-2.jpg",
                alt: "a single wire grocery basket on a wooden counter holding twelve everyday staples",
                line: "one short list. one trip.",
              },
              {
                src: "/img/A4-3.jpg",
                alt: "an open, tidy refrigerator with five glass meal-prep containers on one shelf",
                line: "nothing rots on thursday.",
              },
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
              <figcaption className="mt-4 text-[1.75rem] leading-tight font-bold text-balance">{b.line}</figcaption>
            </figure>
          ))}
        </div>
      </section>

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

      {/* S8 final cta */}
      <section id="early-access" className="bg-kale py-14 text-bg lg:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-6 lg:grid-cols-2 lg:px-12">
          <h2 className="text-display font-bold text-balance">your protein. your budget. <em>solved.</em></h2>
          <div className="self-center">
            <WaitlistForm source="final" light />
            <Link href="/start" className="text-link mt-4 inline-flex min-h-11 items-center text-bg">
              {HERO.demo}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
