// all marketing copy and sample values in one place (REDESIGN-V4 §7, verbatim). components render nothing for "", 0, [].
// proof counts show only when >= 100; nothing here may claim a number, quote or rating that is not real.
export const site = {
  hero: {
    pill: "Pre-order available now on the App Store",
    h1: "Hit your protein. Spend way less.",
    lede: "Tell WiseDinner your weekly grocery budget and your daily protein goal. It plans five days of meals, builds one short grocery list, and shows you the total before you shop.",
    cta: "Pre-order now",
    micro: "Free to pre-order. iPhone first, Android next.",
  },
  proof: { preorders: 0, demoWeeksThisMonth: 0, avgWeekUsd: 49.2 }, // counts show only when >= 100
  launchWindow: process.env.NEXT_PUBLIC_RELEASE_DATE || "", // only when the date is firm; set with the App Store URL (lib/links.ts)
  // SECTION 2 switcher (§6 titles, §7 copy)
  include: {
    h2: "What does WiseDinner include?",
    items: [
      { title: "A solved week, not suggestions", body: "Give it two numbers. It returns five days of meals that share ingredients, so nothing you buy goes to waste." },
      { title: "One short list with a real total", body: "About twelve items, grouped by aisle, with an estimated in-store total. You also see what the same list costs delivered." },
      { title: "Share your week and beat a friend's", body: "Every solved week gets a card and a link. Send a friend your numbers and see who comes out cheaper." },
      { title: "Prove it with your receipt", body: "Photograph your receipt after you shop. You see the estimate next to what you actually paid, and the app gets more accurate every week." },
    ],
  },
  // SECTION 3 why (§6, §7)
  why: {
    h2: "Why choose WiseDinner?",
    sub: "The simplest way to eat well on a real budget.",
    items: [
      { title: "It does the math", body: "A solver plans the week. Same inputs, same result, every time. No guessing your macros.", icon: "calculator" },
      { title: "Shelf prices, not app prices", body: "We quote what the shelf says and show the delivery price next to it. Delivery apps mark items up 15 to 25 percent before fees.", icon: "tag" },
      { title: "Nothing goes to waste", body: "Whole packages get used. Perishables early in the week, freezer friendly by Friday.", icon: "leaf" },
    ],
  },
  // SECTION 4 testers (§6, §7)
  testers: { h2: "What our testers are saying", sub: "People using the early build" },
  // /pricing cards, Offer JSON-LD, FAQ answers, the /pricing description and the OG route all read these.
  // pricing honesty law: change a price here and nowhere else
  pricing: {
    h2: "Simple pricing",
    // the pre-order build is free; Protein Plan and Autopilot are the launch tiers. marketing shows FREE and LAUNCH only.
    free: ["six-question onboarding", "the offline solver", "the week view with photos", "the three checks", "regenerate", "the aisle list with its total", "the delivery comparison", "share your week", "beat this week"],
    trial: "14-day free trial in the app. No account needed to see your first week.",
    tiers: [
      { name: "Protein Plan", tagline: "The receipt proves it.", monthly: 8.99, yearly: 59, perMonth: 4.92, popular: true, rows: ["Everything in the free build", "Receipt reveal: the estimate next to what you paid, with an accuracy score that climbs", "Swap any meal and the week re-solves", "The weekly solve challenge, receipt-verified"] },
      { name: "Autopilot", tagline: "Sunday at 5pm, next week is already planned.", monthly: 12.99, yearly: 89, perMonth: 7.42, popular: false, rows: ["Everything in Protein Plan", "Next week planned for you every Sunday at 5pm", "One tap to shop it or regenerate"] },
    ] as { name: string; tagline: string; monthly: number; yearly: number; perMonth: number; popular: boolean; rows: string[] }[],
  },
  faq: { h2: "Frequently asked questions" },
  // SECTION 7 pre-order band (§6)
  preorder: { h2: "Pre-order now on the App Store" },
};
