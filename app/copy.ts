// copy bank (REDESIGN-V4 §3 voice, §7 deck). used by /, /faq, /about, JSON-LD.
import { site } from "../content/site.ts";

const [plan, auto] = site.pricing.tiers;
const usd = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

export const SUPPORT_EMAIL = "support@wisedinner.com";
export const SITE = "https://www.wisedinner.com";

export const FAQ = [
  // §7: the eight answers keep v3's facts (app-first, no web demo, free versus paid, the receipt reveal, shelf-price
  // honesty, pre-order open now, the challenge, "the first version collects no data", the 14-day trial).
  {
    q: "What is WiseDinner?",
    a: "An iPhone app. You give it two numbers, your weekly budget and your daily protein goal, and it returns a solved week: five days of meals you would actually order, one short list, and an estimated in-store total. There is no web version and no demo on this site. The app is the product.",
  },
  {
    q: "What is free and what is paid?",
    a: `${site.pricing.intro} No account, nothing to buy. At launch, Protein Plan (${usd(plan.monthly)} a month or ${usd(plan.yearly)} a year) adds regenerate for any single meal, the receipt reveal and the weekly solve challenge. Autopilot (${usd(auto.monthly)} a month or ${usd(auto.yearly)} a year) adds a menu of substitutes so you pick your own replacement, and plans next week for you every Sunday at 5pm.`,
  },
  {
    q: "What is the receipt reveal?",
    a: "After you shop, photograph the receipt. The app puts the estimate and what you paid side by side, tells you the difference in one line, and keeps an accuracy score that climbs week over week. It is the proof that the numbers were real.",
  },
  {
    q: "How accurate are the prices?",
    a: "We quote what the shelf says: averages from public price data with a buffer on top, labeled as estimates and refreshed weekly. Beside it sits what the same list costs delivered from Kroger, an estimate, so you can see the markup. Delivery apps run 15 to 25 percent higher before fees. Every receipt you reveal tightens the estimate for you.",
    more: { label: "How the math works", href: "/the-math" },
  },
  {
    q: "When can I get it?",
    a: "Pre-order is open now on the App Store. Release follows three to four weeks after. iPhone first, Android next.",
  },
  {
    q: "How does the weekly solve challenge work?",
    a: "Solve a week, shop it, reveal the receipt. Only receipt-verified weeks count, so an estimate alone does not enter. The leaderboard is cost per gram of protein, which means a $40 week can beat a $60 one. It is a Protein Plan feature at launch.",
  },
  {
    q: "What do you collect?",
    a: "The first version collects no data. No account, no sign-in, no tracking. Your weeks and receipts stay on your phone. When you share a week, the card and its numbers are the only things that leave.",
  },
  {
    q: "Why a 14-day trial?",
    a: "Two solves and one receipt reveal are enough to prove it. If the receipt does not match, do not pay.",
  },
];

// FAQPage JSON-LD for any subset of FAQ (/faq and the homepage both emit it)
export const faqLd = (items: { q: string; a: string }[]) => ({
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: items.map(({ q, a }) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })),
});

export const ABOUT = [
  "Groceries got absurd. Protein got expensive. And every app we tried optimized macros, not money. It would hand you a perfect day of eating that cost more than your rent allowed, then shrug when half of it went bad on Thursday.",
  "WiseDinner is the other way round. You give it two numbers: what you can spend this week and how much protein you want a day. A solver returns one short list from a fixed pool of staples, five days of meals that share ingredients, and an estimated in-store total. The whole package gets eaten, by construction.",
  "We refuse three things: fake reviews, sponsored picks in your list, and hidden delivery markups. When we show what the same list costs delivered from Kroger, it is an estimate and sits next to the shelf price with fees included.",
  "The receipt is the proof. We would rather be judged by it.",
];
