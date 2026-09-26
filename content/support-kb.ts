// the support knowledge base beyond the FAQ (app/copy.ts) and pricing (content/site.ts): a plain-text digest of
// the terms and privacy pages and the tone guide. read by lib/support/kb.ts to build the assistant's system prompt.
// the effective dates and the Purchases and Subscriptions sections come verbatim from content/legal.ts, the same
// constants the pages render. the rest of each digest is a summary kept by hand; DIGEST_REVIEWED pins the page
// sources it was written against, and lib/support/test/kb.test.ts fails when a page changes until it is re-read.
import { PRIVACY_EFFECTIVE, PURCHASES, SUBSCRIPTIONS, TERMS_EFFECTIVE } from "./legal.ts";

// sha256 of app/privacy/page.tsx and app/terms/page.tsx (line endings normalized) when the digests below were
// last checked against them. change a page, re-read the digest, then update the hash the failing test prints.
export const DIGEST_REVIEWED = { privacy: "4310c58c9fb8f1598de206779132b13a5a3a1fa9aecef5bc6e010b205cba0e92", terms: "37195a7afdccac32d1386012998e66208c46b34e7b663ed36c02118ae2d1763b" };

export const TERMS_DIGEST = `Terms of service (effective ${TERMS_EFFECTIVE}), in short:
- The site is WiseDinner.com plus its shared-week pages and the pre-order links to the App Store. The app is pre-order only on the App Store; Android pre-registration follows on Google Play. The pre-order, any payment and the app itself are handled by the store and the app's own terms. Nothing on the site sells anything.
- Every price is an estimate built from public price data with a buffer on top. Real prices differ by region, chain, week and sales. No total is guaranteed.
- Protein and calorie figures are planning estimates from a food database, not measurements. WiseDinner is not medical, dietary or nutritional advice. Anyone changing how they eat should talk to a doctor or a registered dietitian.
- Users must be 16 or older; under 18 with a parent or guardian.
- No scraping, reselling of plans or price data, automated traffic, security probing, or abusive content through the support form.
- Subscriptions, verbatim: ${SUBSCRIPTIONS}
- Pre-orders and pre-registrations, including cancellation and refunds, are handled by the App Store or Google Play under their rules, not by WiseDinner. A pre-order does not guarantee a launch date, a feature, a price or a free trial. Pricing page prices are the current plan and can change before launch.
- The retired early-access waitlist is closed; entries can be deleted on request by email.
- Liability is capped at the greater of $50 or fees paid in the last twelve months. Florida law applies; email support first and there is a 30 day informal resolution window.`;

export const PRIVACY_DIGEST = `Privacy policy (effective ${PRIVACY_EFFECTIVE}), in short:
- The site collects very little: support messages (name if given, email, the message) and cookieless Vercel Web Analytics (hashed rotating visitor id, country, device type, referrer). No cookies, no ad trackers, no marketing email, no selling or sharing of data for advertising.
- Nothing is collected for a pre-order; the store handles it. Shared weeks publish only the week's meals, list and totals, never anything about the person.
- Support messages live in a Supabase (Postgres) database in the United States; the site runs on Vercel. Support messages are kept up to 12 months. Retired waitlist entries stay until launch or until deletion is requested.
- Anyone can ask to see, correct, delete or export their data by emailing support@wisedinner.com from the address in question; confirmation within 7 days, completion within 30. Data deletion requests are handled by a person, not automatically.
- Purchases, verbatim: ${PURCHASES}
- The site is not for people under 16.`;

export const PRODUCT_FACTS = `Product facts:
- WiseDinner is an iPhone app (Android next). You give it two numbers, a weekly grocery budget and a daily protein goal, and it returns a solved five day week of meals, one short grocery list and an estimated in-store total. There is no web version and no web demo.
- Prices are shelf-price estimates from public price data with a buffer, refreshed weekly; the app can also show what the same list costs delivered, as an estimate. Receipts revealed in the app tighten the estimate for that user.
- Pre-order is open on the App Store. Release follows a few weeks after pre-order opens; there is no fixed date to promise.
- The pre-order build is free and complete and needs no account. The paid tiers, their prices and what each adds are in the pricing facts below; the Courier tier arrives in an update after release, so it cannot be bought yet.
- The weekly solve challenge counts only receipt-verified weeks; the leaderboard is cost per gram of protein.
- The free build collects nothing: no account, no sign-in, no tracking; weeks and receipts stay on the phone. Subscribing involves the purchase data described under Purchases in the privacy policy.`;

export const TONE_GUIDE = `How to write:
- Plain, friendly, short. Sentence case. Normal punctuation. No dashes, no exclamation marks, no emoji, no bullet lists unless the question has several parts.
- Answer the question first, in one or two sentences, then add one useful detail at most.
- Never promise a date, a feature, a price change or a refund. Say "a few weeks after pre-order opens" for timing, never a month or a day.
- Apple handles every payment and refund. When a reply mentions a refund, say Apple handles it and include reportaproblem.apple.com. A reply that mentions a refund without that address is not sent.
- Never say Courier is available now, can be bought now or is in the app today. When a reply names Courier, include this sentence word for word: "Courier arrives in an update after release." A reply that names Courier without it is not sent.
- Never invent facts. If the answer is not in the facts you were given, do not guess; escalate.
- Do not ask for personal or health information.
- Sign off as "WiseDinner support".`;
