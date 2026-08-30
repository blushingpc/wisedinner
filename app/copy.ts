// SITE-SPEC §18 copy bank — verbatim where the spec is verbatim. used by /, /faq, /about, /press, JSON-LD.
export const SUPPORT_EMAIL = "support@wisedinner.com";
export const SITE = "https://www.wisedinner.com";

export const HERO = {
  eyebrow: "PROTEIN, SOLVED LIKE MATH",
  h1: "Hit your protein. Spend way less.",
  sub: "wisedinner turns your budget and a protein target into a solved week — one short grocery list, five days of meals, and a receipt that proves it.",
  cta: "get early access",
  micro: "free demo below · app coming soon",
  demo: "try the demo",
};

export const STEPS = [
  ["01 — tell us two numbers", "your weekly budget and your daily protein."],
  ["02 — we solve the week", "a deterministic solver picks ~15 staples that overlap across five days. no ai guessing your macros."],
  ["03 — shop it. cook it. keep the receipt.", "perishables early in the week, freezer-friendly by friday. empty fridge, on purpose."],
] as const;

export const HONESTY =
  "we quote shelf prices, not app prices. delivery apps mark items up 15–25% and stack fees on top — if you ever export a list for delivery, we show you both numbers first. the cheap way is walking in with the list.";

export const FAQ = [
  {
    q: "what is wisedinner?",
    a: "a meal planner that treats groceries as a math problem: your weekly budget and a protein target in, a solved week out — one short list, five days of meals, an estimated in-store total. it's an app first; this site is the demo and the waitlist.",
  },
  {
    q: "how accurate are the prices?",
    a: "they're averages from public price data with a buffer on top, labeled as estimates, refreshed weekly. your receipt is the truth — in the app, every receipt you log tightens the estimate for you.",
  },
  {
    q: "why not just use chatgpt?",
    a: "a chat model can't hold real prices, can't aggregate half an onion across five days, and can't guarantee the math. our solver is deterministic: same numbers in, same week out, and it can't get arithmetic wrong. then we show receipts.",
  },
  {
    q: "when does the app launch?",
    a: "we're building it now. early access goes to the waitlist, in order, before the public ios launch in 2026.",
  },
  {
    q: "is this medical or diet advice?",
    a: "no. protein and calorie figures are planning estimates from a food database. talk to a professional before changing how you eat, especially with a health condition.",
  },
  {
    q: "what will it cost?",
    a: "protein plan at $59/yr ($4.99/mo billed yearly) or $8.99 monthly; autopilot at $89/yr or $12.99 monthly. 21-day free trial in the app. nothing is for sale yet.",
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
  "wisedinner is a meal-planning app that treats groceries as a math problem: give it a weekly budget and a protein target and it returns a solved week — a ~15-item list, five days of meals, and an estimated in-store total, with zero food waste by construction. it launches on iOS in 2026.";
