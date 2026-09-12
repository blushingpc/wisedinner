import type { Metadata } from "next";
import { PageShell } from "@/app/ui/page-shell";
import { StoreBadges } from "@/app/ui/store-badges";

export const metadata: Metadata = {
  title: "How the math works",
  description: "Two numbers in, a solved week out: a fixed pool of staples, real shelf prices with a buffer, whole packs eaten by construction, and what we refuse to do.",
  alternates: { canonical: "/the-math" },
};

// the second-read page for skeptics. system words are allowed here, never on the homepage.
const SECTIONS: [string, string][] = [
  ["Two numbers in", "You give us a weekly grocery budget and a daily protein target. Nothing else is required. Optionally, tell us what you already have in the pantry and we use it for free."],
  ["A fixed pool of staples", "We plan from a fixed pool of everyday staples with known prices, canned, frozen, dry and a few fresh items, not from an open recipe database. That is what makes the week solvable."],
  ["A solver, not a guess", "The week is solved by a deterministic solver: the same numbers in always give the same week out, and it cannot get arithmetic wrong. It picks about a dozen staples that overlap across five days so that every pack gets finished. Perishables go early in the week, freezer-friendly meals by Friday."],
  ["Real shelf prices", "Prices are averages from public price data with a buffer on top, labeled as estimates and refreshed weekly. We quote shelf prices, not delivery-app prices. In the app, every receipt you log tightens the estimate for you."],
  ["Nothing wasted, by construction", "Because the plan is built from whole packs that get used up, the week ends with an empty fridge on purpose."],
  ["What we refuse", "Fake reviews. Sponsored picks in your list. Hidden delivery markups. When we show what the same list costs delivered from Kroger, it is an estimate and sits next to the shelf price with fees included."],
];

export default function TheMath() {
  return (
    <PageShell title="How the math works" sub="Two numbers in, a solved week out. Here is what happens in between.">
      <div className="mx-auto max-w-[60ch]">
        {SECTIONS.map(([h, body]) => (
          <section key={h} className="mt-10 first:mt-0">
            <h2 className="text-h3 text-balance">{h}</h2>
            <p className="mt-3 text-ink-2">{body}</p>
          </section>
        ))}
      </div>
      <div className="mt-14 flex justify-center">
        <StoreBadges placement="the-math" className="justify-center" fallback="button" buttonClassName="cta cta-wide min-w-[200px]" />
      </div>
    </PageShell>
  );
}
