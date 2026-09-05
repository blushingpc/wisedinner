// the one App Store destination (founder decision 2026-09-05: the site sells nothing and hosts no community — it captures
// early access now and funnels to the App Store pre-order once NEXT_PUBLIC_APP_STORE_URL is set).
// unset: every primary control is "get early access" → the waitlist form (WD-01: a control must never dead-end).
// set: every primary control is "pre-order on the App Store" → the listing, with Apple's badge and the release date.
// NEXT_PUBLIC_ prefix is required — client components (sticky bar) read these, and Next inlines only prefixed vars.
// `||` not `??`: an empty value must not become href="" (a same-page reload, the original bug).
export const APP_STORE_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_APP_STORE_URL);
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "/#early-access";

// free text, shown only while live: "expected March 2027". empty → no date anywhere.
export const RELEASE_DATE = APP_STORE_IS_LIVE ? process.env.NEXT_PUBLIC_RELEASE_DATE || "" : "";
