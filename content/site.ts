// all marketing copy + sample values in one place. components render nothing for "", 0, [].
// proof counts show only when >= 100; nothing here may claim a number, quote or rating that is not real.
export const site = {
  hero: {
    eyebrow: "two numbers in. a solved week out.", // REDESIGN-V3 §6
    preorderNote: "pre-order opens on the app store in october", // badge fallback while the listing is not live (§2C)
    h1: "hit your protein. spend way less.",
    lede: "stop guessing in the aisle. tell us your budget and protein goal; we plan five days and one short list.",
    ledeAlt: "never ask “what’s for dinner” again. two numbers in, a week of meals and one short list out.", // A/B later; not rendered
    proofFacts: "five days · one receipt · real shelf prices",
    pill: "free to pre-order · installs itself on launch day · 21-day free trial",
    perk: "pre-order and your first month is on us.", // TODO(launch): confirm or set ""
    notOnIphone: "not on iPhone? get the launch email →",
  },
  proof: { preorders: 0, demoWeeksThisMonth: 0, avgWeekUsd: 39.72 }, // counts show only when >= 100
  launchWindow: process.env.NEXT_PUBLIC_RELEASE_DATE || "", // only when the date is firm — set with the App Store URL (lib/links.ts)
  strip: {
    // h2 + caption render computed from data/drop.json (weekly refresh) — only the enemy line is typed copy
    enemy: "no meal kit. no tracking. no 40-item list.",
  },
  receipt: {
    h2: "the receipt is the proof.",
    caption: "it can’t get the math wrong. the price you see is the price you pay.",
    promises: "no delivery markups. no sponsored picks. no fake reviews.",
    refreshed: "prices refreshed 30 aug 2026", // TODO(launch): update weekly
  },
  changes: {
    h2: "what changes",
    items: [
      { title: "never ask “what’s for dinner.”", sub: "" },
      { title: "one short list. one trip.", sub: "" },
      { title: "nothing rots on thursday.", sub: "not the half bag of spinach. not the $9 chicken you froze and forgot." },
    ],
  },
  // SECTION 2 switcher (REDESIGN-V3 §4 titles, §6 copy deck — verbatim)
  include: {
    h2: "what does wisedinner include?",
    items: [
      { title: "a solved week, not suggestions", body: "tell us your budget and protein goal. the solver returns five days of meals that share ingredients — nothing you buy goes unused." },
      { title: "one list, one total, and the delivery gap", body: "about twelve items grouped by aisle, the estimated in-store total, and what the same list costs delivered. walking in usually wins." },
      { title: "share your week. beat a friend’s.", body: "every solved week gets a card and a link. friends with the app shop it in one tap; everyone else lands on the card. send someone your numbers and see who comes out cheaper." },
      { title: "prove it with your receipt", body: "photograph your receipt after you shop. estimate vs what you paid, side by side, and an accuracy score that climbs every week." },
    ],
  },
  // SECTION 3 why (§6)
  why: {
    h2: "why wisedinner",
    items: [
      { title: "solved, not suggested", body: "a deterministic solver does the math. same inputs, same week, every time. no ai guessing your macros.", icon: "calculator" },
      { title: "shelf prices, not app prices", body: "we quote what the shelf says and show the delivery price beside it. delivery apps mark items up 15–25%; you decide if the drive is worth it.", icon: "tag" },
      { title: "zero waste by construction", body: "whole packages get used, perishables early, freezer-friendly by friday. empty fridge, on purpose.", icon: "leaf" },
    ],
  },
  // /pricing cards, Offer JSON-LD, FAQ answers, the /pricing description and the OG card all read these (WD-16).
  // pricing honesty law: change a price here and nowhere else
  pricing: {
    tiers: [
      { name: "protein plan", monthly: 8.99, yearly: 59, perMonth: 4.99, popular: true, rows: [["weeks solved", "unlimited"], ["grocery list", "export + print"], ["re-solve", "any time"], ["receipt ledger", "included"], ["pantry credit", "included"]] },
      { name: "autopilot", monthly: 12.99, yearly: 89, perMonth: 7.49, popular: false, rows: [["everything in protein plan", "yes"], ["next week, solved automatically", "sunday"], ["price alerts on your staples", "weekly"], ["household up to", "4"], ["delivery export w/ fees shown", "included"]] },
    ] as { name: string; monthly: number; yearly: number; perMonth: number; popular: boolean; rows: [string, string][] }[],
  },
  // finalCta h2 is rendered in app/page.tsx with an <em> around "solved." — edit it there
  finalCta: { under: "free to pre-order · 21-day free trial" },
};
