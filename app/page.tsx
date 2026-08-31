import Image from "next/image";
import Link from "next/link";
import { drop } from "@/data/drop";
import { meals } from "@/data/meals";
import { ABOUT, FAQ, HERO, HONESTY, SITE, STEPS } from "./copy";
import { Accordion } from "./ui/accordion";
import { CountUp } from "./ui/count-up";
import { DeviceFrame } from "./ui/device-frame";
import { MealCard } from "./ui/meal-card";
import { ReceiptCard } from "./ui/receipt-card";
import { Section } from "./ui/section";
import { StatStrip } from "./ui/stat-strip";
import { WaitlistForm } from "./ui/waitlist-form";

// delivered range = shelf total × (1.25 … 1.37): 15–25% item markup plus fees. labeled ~ and est.
const delivered = (t: number) => `~$${Math.round(t * 1.25)}–${Math.round(t * 1.37)}`;

const ORG = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "wisedinner",
  url: SITE,
  logo: `${SITE}/press/wisedinner-mark.png`,
  email: "support@wisedinner.com",
  description: ABOUT[1],
};

function PlanScreen() {
  return (
    <>
      <p className="font-mono text-micro uppercase text-ink-soft">tue · plan</p>
      {meals.slice(0, 2).map((m, i) => (
        <MealCard key={m.name} meal={m} priority={i === 0} />
      ))}
      <div className="mt-4">
        <ReceiptCard week={drop} variant="mini" title="this week" />
      </div>
    </>
  );
}

export default function Home() {
  return (
    <main id="main">
      <script type="application/ld+json">{JSON.stringify(ORG)}</script>

      {/* S1 hero */}
      <section className="mx-auto grid min-h-[88dvh] max-w-[1200px] items-center gap-12 px-6 py-14 lg:grid-cols-[1.1fr_1fr] lg:px-12 lg:py-24">
        <div className="max-w-[62ch]">
          <p className="font-mono text-micro uppercase text-green-600">{HERO.eyebrow}</p>
          <h1 className="mt-6 text-display font-bold text-balance">{HERO.h1}</h1>
          <p className="mt-6 text-xl text-ink-soft">{HERO.sub}</p>
          <div className="mt-8 flex flex-wrap items-center gap-6">
            <a href="#early-access" className="cta">
              {HERO.cta}
            </a>
            <Link href="/start" className="text-link inline-flex min-h-11 items-center">
              {HERO.demo}
            </Link>
          </div>
          <p className="mt-4 font-mono text-micro uppercase text-ink-soft">{HERO.micro}</p>
        </div>

        <div className="hero-field relative mx-auto h-[720px] w-[320px] lg:w-[620px]">
          <DeviceFrame label="phone showing the plan view: two meals with protein and price, and a mini receipt" tilt="left" className="absolute top-0 left-0 lg:-rotate-3">
            <PlanScreen />
          </DeviceFrame>
          <DeviceFrame label="phone showing the solved-week receipt with the estimated in-store total" tilt="right" className="absolute top-12 left-0 hidden lg:left-[290px] lg:block lg:rotate-2">
            <ReceiptCard week={drop} variant="plan" />
          </DeviceFrame>
          <div className="absolute top-[500px] -left-10 z-10 hidden w-64 rounded-[14px] bg-bg px-3 shadow-receipt lg:block">
            <MealCard meal={meals[2]} />
          </div>
        </div>
      </section>

      {/* S2 the solved week */}
      <Section alt id="week" className="grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
        <Image
          src="/img/week-containers.jpg"
          alt="five glass meal-prep containers in a row on linen: chicken and rice, black beans and eggs, yogurt with banana and oats, shredded chicken with roasted vegetables, quinoa with beans and greens"
          width={1600}
          height={893}
          quality={75}
          sizes="(min-width: 1024px) 640px, 100vw"
          className="img-grade h-auto w-full rounded-[14px]"
        />
        <div>
          <h2 className="text-h2 font-bold text-balance">one list. <span className="text-green-600">five days.</span> this is what $[your number] looks like.</h2>
          <div className="mt-8">
            <StatStrip stacked stats={[[<CountUp key="p" value={drop.protein_per_day} decimals={0} suffix="g" />, "protein / day"], [<CountUp key="t" value={drop.est_total} prefix="$" />, "est. in-store, weekly"], [<CountUp key="w" value={0} decimals={0} suffix=" lb" />, "waste by design"]]} />
          </div>
          <p className="mt-4 font-mono text-micro uppercase text-ink-soft">numbers from a real solver run at 2026 average prices — methodology in faq</p>
        </div>
      </Section>

      {/* S3 how it works */}
      <Section id="how">
        <h2 className="text-h2 font-bold">how it works</h2>
        <ol className="mt-12 grid gap-16">
          {STEPS.map(([title, body], i) => (
            <li key={title} className={`grid items-center gap-8 lg:grid-cols-2 ${i % 2 ? "lg:[&>div:first-child]:order-2" : ""}`}>
              <div className="max-w-[62ch]">
                <h3 className="text-2xl font-medium">{title}</h3>
                <p className="mt-3 text-ink-soft">{body}</p>
              </div>
              <div className="mx-auto origin-top scale-[0.8] lg:scale-90" style={{ height: 600 }}>
                <DeviceFrame label={`phone showing step ${i + 1}`}>
                  {i === 0 && (
                    <div className="font-mono text-spec">
                      <p className="text-micro uppercase text-ink-soft">01 / 06</p>
                      <p className="mt-6 text-micro uppercase text-ink-soft">weekly grocery budget, usd</p>
                      <p className="mt-2 border-b border-rule pb-2 text-4xl tabular-nums">$[your number]</p>
                      <p className="mt-6 text-micro uppercase text-ink-soft">protein per day, grams</p>
                      <p className="mt-2 border-b border-rule pb-2 text-4xl tabular-nums">[your target]</p>
                    </div>
                  )}
                  {i === 1 && (
                    <>
                      <p className="font-mono text-micro uppercase text-ink-soft">solving · {drop.list.length} staples</p>
                      <MealCard meal={meals[1]} />
                      <MealCard meal={meals[2]} />
                      <div className="mt-4">
                        <ReceiptCard week={drop} variant="mini" title="one week, solved" />
                      </div>
                    </>
                  )}
                  {i === 2 && (
                    <>
                      <p className="font-mono text-micro uppercase text-ink-soft">fri · last meal</p>
                      <MealCard meal={meals[2]} />
                      <p className="mt-4 font-mono text-micro uppercase text-ink-soft">fridge</p>
                      <p className="mt-2 text-3xl font-bold">empty, on purpose.</p>
                      <p className="mt-2 font-mono text-spec text-ink-soft">every pack finished. receipt kept.</p>
                    </>
                  )}
                </DeviceFrame>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      {/* S4 demo banner */}
      <section className="bg-green-900 py-14 text-bg lg:py-24">
        <div className="mx-auto flex max-w-[1200px] flex-wrap items-center justify-between gap-6 px-6 lg:px-12">
          <h2 className="text-h2 font-bold text-balance">see your week solved in 60 seconds.</h2>
          <Link href="/start" className="cta cta-light">
            {HERO.demo}
          </Link>
        </div>
      </section>

      {/* S5 honesty strip */}
      <Section className="grid gap-10 lg:grid-cols-2">
        <dl className="grid gap-4 font-mono tabular-nums">
          <div className="border-t border-rule py-4">
            <dd className="text-4xl font-medium sm:text-5xl">${drop.est_total.toFixed(2)}</dd>
            <dt className="mt-1 text-micro uppercase text-ink-soft">est. in-store · the week above</dt>
          </div>
          <div className="border-t border-rule py-4">
            <dd className="text-4xl font-medium text-ink-soft sm:text-5xl">{delivered(drop.est_total)}</dd>
            <dt className="mt-1 text-micro uppercase text-ink-soft">delivered w/ fees · est. +25–37%</dt>
          </div>
        </dl>
        <p className="max-w-[62ch] self-center text-xl">{HONESTY}</p>
      </Section>

      {/* S6 faq preview */}
      <Section alt>
        <h2 className="text-h2 font-bold">questions</h2>
        <div className="mt-8 max-w-[70ch]">
          <Accordion items={FAQ.slice(0, 4)} />
        </div>
        <Link href="/faq" className="text-link mt-6 inline-flex min-h-11 items-center">
          all questions →
        </Link>
      </Section>

      {/* S7 final cta */}
      <section id="early-access" className="bg-green-900 py-14 text-bg lg:py-24">
        <div className="mx-auto grid max-w-[1200px] gap-8 px-6 lg:grid-cols-2 lg:px-12">
          <h2 className="text-display font-bold text-balance">your protein. your budget. <em>solved.</em></h2>
          <div className="self-center">
            <WaitlistForm source="hero" light />
          </div>
        </div>
      </section>
    </main>
  );
}
