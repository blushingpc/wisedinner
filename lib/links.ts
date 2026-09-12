// the store destinations (REDESIGN-V4 §6, MOBILE FIX PASS v2 §A). every primary CTA is the "Pre-order now" button
// (app/ui/preorder-modal.tsx), whose modal links to both stores ("#" until NEXT_PUBLIC_APP_STORE_URL /
// NEXT_PUBLIC_PLAY_URL are set). the store badge artwork (header, footer, modal, share page, the-math) renders only
// while BADGES_LIVE: the App Store URL is set and Apple's official Pre-order badge exists (next.config.ts). until
// then every badge slot shows the forest button or a text link, so nothing on the page claims a download.
// NEXT_PUBLIC_ prefix is required: client components read these and Next inlines only prefixed vars.
// `||` not `??`: an empty value must never become href="" (a same-page reload).
export const APP_STORE_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_APP_STORE_URL);
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "#";

export const PLAY_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_PLAY_URL);
export const PLAY_URL = process.env.NEXT_PUBLIC_PLAY_URL || "#";

// badge artwork: the listing exists and the official Pre-order badge svg is in public/badges (checked at build)
export const BADGES_LIVE = APP_STORE_IS_LIVE && Boolean(process.env.NEXT_PUBLIC_PREORDER_BADGE);

// free text, shown only while live: "March 2027". empty means no date anywhere.
export const RELEASE_DATE = APP_STORE_IS_LIVE ? process.env.NEXT_PUBLIC_RELEASE_DATE || "" : "";
