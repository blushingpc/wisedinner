// SITE-SPEC §18 copy bank — verbatim where the spec is verbatim. used by /, /faq, /about, /press, JSON-LD.
import { site } from "@/content/site";
import { APP_STORE_IS_LIVE, RELEASE_DATE } from "@/lib/links";

const [plan, auto] = site.pricing.tiers;
const usd = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

export const SUPPORT_EMAIL = "support@wisedinner.com";
export const SITE = "https://www.wisedinner.com";

// homepage copy — DESIGN-AUDIT §18.4 copy deck, verbatim where the deck is verbatim
export const HERO = {
  waitlist: "get early access →", // locked label (CTA intent lock) — every primary control while the listing is not live
  preorder: "pre-order on the App Store →", // every primary control once NEXT_PUBLIC_APP_STORE_URL is set
};

export const STEPS = [
  ["two numbers in", "your weekly budget and your daily protein. that's it."],
  ["a week out", "a dozen staples that overlap across five days, so every pack gets finished."],
  ["shop once, eat all week", "perishables early, freezer-friendly by friday. empty fridge, on purpose."],
] as const;

export const FAQ = [
  // REDESIGN-V3 §4 section 6 — app-first, no web demo, free vs paid, receipt reveal, shelf-price honesty,
  // pre-order in october, the challenge, "the first build collects nothing", the 14-day trial.
  {
    q: "what is wisedinner?",
    a: "an iphone app. you give it two numbers — your weekly budget and your daily protein — and it returns a solved week: five days of meals you'd actually order, one short list, and an estimated in-store total. there's no web version and no demo on this site; the app is the product.",
  },
  {
    q: "what's free and what's paid?",
    a: `the pre-order build is free and complete on its own: the six-question onboarding, the offline solver, the week view, the three checks, regenerate, the aisle list with its total, the delivery gap, share your week and beat this week. no account, nothing to buy. at launch, protein plan (${usd(plan.monthly)}/mo or ${usd(plan.yearly)}/yr) adds the receipt reveal, swap and the weekly solve challenge; autopilot (${usd(auto.monthly)}/mo or ${usd(auto.yearly)}/yr) solves next week for you every sunday at 5pm.`,
  },
  {
    q: "what is the receipt reveal?",
    a: "after you shop, photograph the receipt. the app puts the estimate and what you paid side by side, tells you the difference in one line, and keeps an accuracy score that climbs week over week. it's the proof that the numbers were real.",
  },
  {
    q: "how accurate are the prices?",
    a: "we quote what the shelf says: averages from public price data with a buffer on top, labeled as estimates, refreshed weekly. the delivery price sits beside it so you can see the markup — delivery apps run 15–25% higher before fees. every receipt you reveal tightens the estimate for you.",
    more: { label: "how the math works →", href: "/the-math" },
  },
  {
    q: "when can i get it?",
    a: APP_STORE_IS_LIVE
      ? `pre-order it now on the app store and it installs itself on launch day.${RELEASE_DATE ? ` release: ${RELEASE_DATE}.` : ""}`
      : "pre-order opens on the app store in october, with release three to four weeks after. leave your email and you'll get one message the day pre-order opens and one on launch day. iphone first; android follows.",
  },
  {
    q: "how does the weekly solve challenge work?",
    a: "solve a week, shop it, reveal the receipt. only receipt-verified weeks count — estimate alone doesn't enter. the leaderboard is cost per gram of protein, so a $40 week can beat a $60 one. it's a protein plan feature at launch.",
  },
  {
    q: "what do you collect?",
    a: "the first build collects nothing. no account, no sign-in, no tracking; your weeks and receipts stay on your phone. when you share a week, the card and its numbers are the only things that leave.",
  },
  {
    q: "why a 14-day trial?",
    a: "14 days — two solves and one receipt reveal is enough to prove it. if the receipt doesn't match, don't pay.",
  },
];

// FAQPage JSON-LD for any subset of FAQ (WD-15: /faq and the homepage preview both emit it)
export const faqLd = (items: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

export const ABOUT = [
  "groceries got absurd. protein got expensive. and every app we tried optimized macros, not money — it would hand you a perfect day of eating that cost more than your rent allowed, then shrug when half of it rotted on thursday.",
  "wisedinner is the other way round. you give it two numbers: what you can spend this week and how much protein you want a day. a deterministic solver returns one short list from a fixed pool of staples, five days of meals that share ingredients, and an estimated in-store total. the whole package gets eaten, by construction.",
  "we refuse three things: fake reviews, sponsored picks in your list, and hidden delivery markups. if we ever show a delivered price it sits next to the shelf price with fees included.",
  "the receipt is the proof. we'd rather be judged by it.",
];

export const PRESS_BOILERPLATE =
  "wisedinner is a meal-planning app that treats groceries as a math problem: give it a weekly budget and a protein target and it returns a solved week — a ~12-item list, five days of meals, and an estimated in-store total, with zero food waste by construction. it launches on iOS in 2026.";
