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
    pill: "free to pre-order · installs itself on launch day · 14-day free trial",
    perk: "", // not in the §2E inventory — set only if the founder confirms a pre-order perk
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
    // REDESIGN-V3 §2E feature inventory. FREE = the pre-order build; LAUNCH = the paid tiers. never v1.2.
    free: ["six-question onboarding", "the offline solver", "week view with photos", "the three checks", "regenerate", "aisle list + in-store total", "the delivery gap", "share your week", "beat this week"],
    trial: "14-day free trial · in the app · paywall after your first solve",
    tiers: [
      { name: "protein plan", tagline: "the receipt proves it.", monthly: 8.99, yearly: 59, perMonth: 4.92, popular: true, rows: ["everything in the free build", "receipt reveal — estimate vs what you paid, accuracy that climbs", "swap any meal, the week re-solves", "weekly solve challenge (receipt-verified)"] },
      { name: "autopilot", tagline: "sunday 5pm, next week is already solved.", monthly: 12.99, yearly: 89, perMonth: 7.42, popular: false, rows: ["everything in protein plan", "next week solved automatically, sunday 5pm", "one tap to shop it or regenerate"] },
    ] as { name: string; tagline: string; monthly: number; yearly: number; perMonth: number; popular: boolean; rows: string[] }[],
  },
  // finalCta h2 is rendered in app/page.tsx with an <em> around "solved." — edit it there
  finalCta: { under: "free to pre-order · 14-day free trial in the app" },
};
