// the one App Store destination. until the listing exists, every pre-order control routes to the demo
// in the same tab and relabels itself (WD-01) — a button promising the App Store must never land on a form.
// `||` not `??`: an empty NEXT_PUBLIC_APP_STORE_URL must not become href="" (a same-page reload, the original bug).
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "/start";

export const APP_STORE_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_APP_STORE_URL);
