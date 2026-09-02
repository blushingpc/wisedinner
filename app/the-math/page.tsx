import type { Metadata } from "next";
import { meals } from "@/data/meals";
import { AppStoreBadge } from "@/app/ui/app-store-badge";
import { InlineDemo } from "@/app/ui/inline-demo";

export const metadata: Metadata = {
  title: "How the math works — WiseDinner",
  description: "two numbers in, a solved week out: a fixed pool of staples, real shelf prices with a buffer, whole packs eaten by construction, and a receipt to check.",
  alternates: { canonical: "/the-math" },
};

// the second-read page for skeptics — system words are allowed here, never on the homepage.
const SECTIONS: [string, string][] = [
  [
    "two numbers in.",
    "you give us a weekly grocery budget and a daily protein target. nothing else is required. optionally, tell us what you already have in the pantry — we use it for free.",
  ],
  [
    "a fixed pool of staples.",
    "we plan from a fixed pool of everyday staples with known prices — canned, frozen, dry and a few fresh items — not from an open recipe database. that is what makes the week solvable.",
  ],
  [
    "a solver, not a guess.",
    "the week is solved by a deterministic solver: the same numbers in always give the same week out, and it cannot get arithmetic wrong. it picks about a dozen staples that overlap across five days so that every pack gets finished. perishables go early in the week; freezer-friendly meals by friday.",
  ],
  [
    "real shelf prices.",
    "prices are averages from public price data with a buffer on top, labeled as estimates and refreshed weekly. we quote shelf prices, not delivery-app prices. in the app, every receipt you log tightens the estimate for you.",
  ],
  [
    "nothing wasted, by construction.",
    "because the plan is built from whole packs that get used up, the week ends with an empty fridge on purpose.",
  ],
  [
    "what we refuse.",
    "fake reviews. sponsored picks in your list. hidden delivery markups. if we ever show a delivered price it sits next to the shelf price with fees included.",
  ],
];

const demoPool = meals.map(({ name, img, alt, price_usd }) => ({ name, img, alt, price_usd }));

export default function TheMath() {
  return (
    <main id="main">
      <section className="py-14 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-6 lg:px-12">
          <h1 className="text-display font-bold">how the math works</h1>
          <div className="mt-10 max-w-[60ch]">
            {SECTIONS.map(([h, body]) => (
              <section key={h} className="mt-8 first:mt-0">
                <h2 className="text-[1.375rem] font-bold tracking-[-0.02em]">{h}</h2>
                <p className="mt-2 text-ink-soft">{body}</p>
              </section>
            ))}
          </div>
          <div className="mt-14 max-w-[520px]">
            <InlineDemo pool={demoPool} />
          </div>
          <div className="mt-10">
            <AppStoreBadge placement="the-math" />
          </div>
        </div>
      </section>
    </main>
  );
}
