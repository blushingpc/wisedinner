// SITE-SPEC §18 copy bank — verbatim where the spec is verbatim. used by /, /faq, /about, /press, JSON-LD.
import { site } from "@/content/site";

const { launchWindow } = site;
const perk = site.hero.perk;

export const SUPPORT_EMAIL = "support@wisedinner.com";
export const SITE = "https://www.wisedinner.com";

// homepage copy — DESIGN-AUDIT §18.4 copy deck, verbatim where the deck is verbatim
export const HERO = {
  h1: "hit your protein. spend way less.",
  sub: "tell us your budget and protein goal. we plan five days of meals and one short grocery list.",
  pill: "free to pre-order · installs itself on launch day · 21-day free trial",
  demo: "try the free demo →",
};

export const STEPS = [
  ["two numbers in", "your weekly budget and your daily protein. that's it."],
  ["a week out", "a dozen staples that overlap across five days, so every pack gets finished."],
  ["shop once, eat all week", "perishables early, freezer-friendly by friday. empty fridge, on purpose."],
] as const;

export const FAQ = [
  {
    q: "when does the app launch?",
    // TODO(launch): the "(target: …)" tail drops itself when launchWindow is ""
    a: `pre-order it now on the App Store and it installs itself on launch day. we'll email you the date the moment it's fixed.${launchWindow ? ` (target: ${launchWindow})` : ""}`,
  },
  {
    q: "how much does it cost?",
    // TODO(launch): confirm figures against /pricing
    a: `pre-ordering is free. the app comes with a 21-day free trial, then $4.99/mo billed yearly or $8.99 month to month.${perk ? ` ${perk}` : ""}`,
  },
  {
    q: "is it on android?",
    a: "not at launch. leave your email and you'll get the android date first.",
  },
  {
    q: "what is wisedinner?",
    a: "a meal planner that treats groceries as a math problem: your weekly budget and a protein target in, a solved week out — one short list, five days of meals, an estimated in-store total. it's an app first; this site is the demo and the pre-order.",
  },
  {
    q: "how accurate are the prices?",
    a: "they're averages from public price data with a buffer on top, labeled as estimates, refreshed weekly. we quote shelf prices, not delivery-app prices — those run 15–25% higher before fees. your receipt is the truth — in the app, every receipt you log tightens the estimate for you.",
  },
  {
    q: "why not just use chatgpt?",
    a: "a chat model can't hold real prices, can't aggregate half an onion across five days, and can't guarantee the math. our solver is deterministic: same numbers in, same week out, and it can't get arithmetic wrong. then we show receipts.",
  },
  {
    q: "is this medical or diet advice?",
    a: "no. protein and calorie figures are planning estimates from a food database. talk to a professional before changing how you eat, especially with a health condition.",
  },
  {
    q: "do you sell my data?",
    a: "no. not now, not at launch, not as the business model. the business model is $59/yr.",
  },
  {
    q: "how is zero waste possible without logging?",
    a: "eating the whole package is a constraint inside the solver, and perishables are scheduled first in the week. you never have to log anything for it to hold — tracking is optional.",
  },
];

export const ABOUT = [
  "groceries got absurd. protein got expensive. and every app we tried optimized macros, not money — it would hand you a perfect day of eating that cost more than your rent allowed, then shrug when half of it rotted on thursday.",
  "wisedinner is the other way round. you give it two numbers: what you can spend this week and how much protein you want a day. a deterministic solver returns one short list from a fixed pool of staples, five days of meals that share ingredients, and an estimated in-store total. the whole package gets eaten, by construction.",
  "we refuse three things: fake reviews, sponsored picks in your list, and hidden delivery markups. if we ever show a delivered price it sits next to the shelf price with fees included.",
  "the receipt is the proof. we'd rather be judged by it.",
];

export const PRESS_BOILERPLATE =
  "wisedinner is a meal-planning app that treats groceries as a math problem: give it a weekly budget and a protein target and it returns a solved week — a ~12-item list, five days of meals, and an estimated in-store total, with zero food waste by construction. it launches on iOS in 2026.";
