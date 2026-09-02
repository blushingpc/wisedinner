// all marketing copy + sample values in one place. components render nothing for "", 0, [].
// proof counts show only when >= 100; nothing here may claim a number, quote or rating that is not real.
export const site = {
  hero: {
    h1: "hit your protein. spend way less.",
    lede: "stop guessing in the aisle. tell us your budget and protein goal; we plan five days and one short list.",
    ledeAlt: "never ask “what’s for dinner” again. two numbers in, a week of meals and one short list out.", // A/B later; not rendered
    proofFacts: "12 items · one receipt · five days · real shelf prices",
    pill: "free to pre-order · installs itself on launch day · 21-day free trial",
    perk: "pre-order and your first month is on us.", // TODO(launch): confirm or set ""
    notOnIphone: "not on iPhone? get the launch email →",
  },
  proof: { preorders: 0, demoWeeksThisMonth: 0, avgWeekUsd: 39.72 }, // counts show only when >= 100
  launchWindow: "", // only when the date is firm
  quotes: [] as { text: string; name: string; city: string; date: string; tag?: string }[], // real only
  founderNote: { text: "", photo: "", name: "" }, // TODO(launch): real note + real kitchen photo
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
  demo: {
    h2: "see your week solved in 60 seconds.",
    previewNote: "three of your five dinners, from real shelf prices.",
    cta: "solve my week",
    under: "no account. takes a minute. your solved week will be in the app on day one.",
    bands: [
      // TODO(launch): replace with solver output
      { max: 49, dinners: ["black bean egg bowl", "yogurt oat parfait", "lentil and chicken stew"] },
      { max: 79, dinners: ["chicken thigh rice bowl", "black bean egg bowl", "yogurt oat parfait"] },
      { max: 999, dinners: ["chicken thigh rice bowl", "pork loin and sweet potato", "tuna rice bowl, edamame"] },
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
