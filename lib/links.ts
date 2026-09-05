// the one App Store destination. until the listing exists, every pre-order control routes to the demo
// in the same tab and relabels itself (WD-01) — a button promising the App Store must never land on a form.
// `||` not `??`: an empty NEXT_PUBLIC_APP_STORE_URL must not become href="" (a same-page reload, the original bug).
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "/start";

export const APP_STORE_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_APP_STORE_URL);

// founding member pre-sale (founder decision 2026-09-05, reversing "no payments on web"): one Stripe payment link, no checkout code.
// unset → the landing section does not render and /founders says the invite is coming by email, so nothing dead-ends.
export const STRIPE_PAYMENT_LINK = process.env.NEXT_PUBLIC_STRIPE_PAYMENT_LINK || "";
export const WHATSAPP_INVITE_LINK = process.env.NEXT_PUBLIC_WHATSAPP_INVITE_LINK || "";
