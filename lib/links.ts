// the store destinations (REDESIGN-V4 §6). the App Store and Google Play badges are always visible in the header, the
// pre-order band and the footer; they link to "#" until NEXT_PUBLIC_APP_STORE_URL / NEXT_PUBLIC_PLAY_URL are set.
// every primary CTA is the "Pre-order now" button (app/ui/preorder-modal.tsx), whose modal links to both.
// NEXT_PUBLIC_ prefix is required: client components read these and Next inlines only prefixed vars.
// `||` not `??`: an empty value must never become href="" (a same-page reload).
export const APP_STORE_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_APP_STORE_URL);
export const APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL || "#";

export const PLAY_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_PLAY_URL);
export const PLAY_URL = process.env.NEXT_PUBLIC_PLAY_URL || "#";

// free text, shown only while live: "March 2027". empty means no date anywhere.
export const RELEASE_DATE = APP_STORE_IS_LIVE ? process.env.NEXT_PUBLIC_RELEASE_DATE || "" : "";
