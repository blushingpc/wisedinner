SITE v5: Courier plan, Cal AI mobile hero, two copy removals (2026-09-24)

Read first: CLAUDE.md, docs/REDESIGN-V4.md (§3 tokens rule), docs/FRONTEND-V4.1.md, docs/AUDIT-2026-09-09.md, tasks/PROGRESS.md. Precedence unchanged: REDESIGN-V4 > DESIGN-AUDIT > ui-ux-pro-max > impeccable > web-design-guidelines.

0. Setup
- Save this whole message as docs/SITE-V5.md before anything else.
- git checkout main && git pull, then git checkout -b design-v5 and push it so the preview exists: https://wisedinner-git-design-v5-wise-dinner.vercel.app. Main stays untouched until the founder says "publish".
- touch .loop-halt.
- gh issue create --title "Site v5: Courier plan, Cal AI mobile hero" --label loop-report. One comment per numbered step, final report at the end.
- Local server for shots: npm run build && npx next start -p 3077. Stop it by PID or port only. Never taskkill /IM node.exe (CLAUDE.md rule 7).

1. Two removals
a. The hero pill "Pre-order available now on the App Store". Delete the element and whatever component or prop renders it. The hero now starts with the H1. Check /the-math and /w/* don't reuse it.
b. The line "This week's plan: 13 items, $57, 154g of protein a day". grep -rn "This week" across app/, components/, content/, data/ (straight and curly apostrophes). Remove the element and the code that derives its item count, total and grams. Don't leave an empty container or its padding behind; the section closes up.
c. No other copy changes except §3.

2. Mobile hero, Cal AI structure
The reference is calai.app on a phone: header, one big headline, one paragraph, store badges stacked, then two angled phone screenshots joined by a hand-drawn arrow. Light background, no cards, no pills. Ours keeps its header, colors, fonts and the switcher below. Changes:
- H1 on phones: the largest size where "Hit your protein." and "Spend way less." each break naturally with no single-word last line at 360, 390, 412 and 430. Start from clamp(40px, 11.5vw, 54px), line-height 1.02, letter-spacing -0.02em, Plus Jakarta Sans 800. Sub 17px/1.5 in secondary, max three lines at 390. With the pill gone the H1 starts 24px under the header.
- Under the sub, the pre-order control. With NEXT_PUBLIC_APP_STORE_URL unset (now): the forest "Pre-order now" button, full width on phones, and the microline "Free to pre-order. iPhone first, Android next." exactly as today. When the env var and public/badges/app-store-preorder.svg exist: the official badges render stacked, left-aligned, App Store above Google Play (Play only if NEXT_PUBLIC_PLAY_URL is set), in place of the button, same placement as Cal AI. The build-time check in next.config.ts stays the switch. The modal is untouched.
- Stage, all widths: replace the single upright phone plus burrito cut-out plus callout with a two-phone composition. Left phone: the two-numbers screen, budget "$60" and protein "150g" filled in, solve button visible. Right phone: the week view from public/store/ shot 1 ("This week $56.97, one trip", five days). Both in the Apple iPhone 17 Black bezel used for public/store/. Left phone rotated -7deg, lower left, about 58% of stage width. Right phone rotated +5deg, upper right, about 62% of stage width, overlapping the left by roughly 12%, in front. One hand-drawn arrow between them as inline SVG: forest stroke, 3px, round caps, one gentle curve, open arrowhead, from the left phone's solve button to the right phone's total. The token shadow under each phone. Nothing else in the stage: no cut-outs, no callouts, no numbers outside the phones.
- The left phone screen: if a two-numbers screen already exists in the store-shot pipeline, use it. If not, build it with the same components and fixture data and commit it as public/store/07-two-numbers.png (1290×2796) plus the site derivatives, same pipeline as the other six.
- Assets: AVIF and WebP at 2x of rendered size for 360, 390, 430, 768, 1024 and 1440, correct sizes attributes, priority on the right phone, fixed aspect boxes so CLS stays 0. 4K masters stay in the gitignored public/img/src/.
- Desktop (md and up): the same two-phone stage sits right of the copy where the stage is now. Text column widths unchanged.
- Fold: at 360×640, 390×844, 412×915 and 430×932 the H1, sub and button stay above 100dvh minus 90, as today. At 390×844 the top of both phones is inside the first viewport.

3. Courier plan
Autopilot is renamed Courier everywhere: grep -rni autopilot across app/, components/, content/, data/, tests/, public/ (OG images), sitemap, FAQ, /the-math, /w/*, legal pages and the switcher card. Leave historical notes in docs/ alone. Exact copy for /pricing and the home pricing section (bullets are separated by " / " here only; render them as list items):

Free build: unchanged.

Protein Plan (Most popular)
Tagline: Reroll any single meal.
Price: $8.99/month, or $48/year, $4 a month billed yearly
Lead: Don't like a meal? Reroll it. The app swaps in a different dish it can make from what's already on your list.
Bullets: Everything in the free build / Receipt reveal / The weekly solve challenge

Courier
Tagline: Pick the swap yourself, get the list delivered, and let Sunday plan the rest.
Price: $12.99/month, or $96/year, $8 a month billed yearly
Lead: Reroll opens a menu of dishes that fit your list and hit the same protein as the meal you're replacing, so you choose. Order the whole list delivered from your store. Next week is planned for you every Sunday at 5pm.
Bullets: Everything in Protein Plan / Choose your replacement from a menu, same protein as the meal it replaces / Delivery from your store, straight from the list / Next week planned for you every Sunday at 5pm

Trial line unchanged: "14-day free trial in the app. No account needed to see your first week."

Also update the FAQ answer "What is free and what is paid?" (the paid part matches the above), the switcher card that describes the paid tiers, and /the-math if it names tiers. Any delivery number that appears is labeled an estimate. Voice rules hold: sentence case, no dashes, no middots, no exclamation points, never "under $57".

4. Guardrails
Tokens only (REDESIGN-V4 §3). No new dependencies. Solver, API routes, analytics events, the modal and the switcher logic untouched. No fake proof of any kind. Badges stay hidden until the env var and the svg exist.

5. Verify
- tsc, eslint, npm run lint:voice, npm test, npm run build, built-HTML dash grep = 0.
- grep the built HTML for "Autopilot", "Pre-order available now", "This week's plan", "$59", "$89", "4.92", "7.42": all 0.
- Playwright (iOS UA, DPR 3) before and after at 360, 390, 412, 430, plus 768, 1024, 1440, for / and /pricing, into design/shots/v5/{before,after}/. Run the audit probe from the 09-09 pass: zero overflow, overlaps, small targets, small inputs, contrast failures.
- Lighthouse mobile on / at the preview, two runs: perf ≥ 90 (hard gate), a11y 100, BP 100. Report the LCP element and time. If the two phones push perf under 90, shrink the left phone first, then lazy-load it, before touching anything else.
- Read the after shots at 390 and 1440 yourself and fix anything that reads wrong before reporting.

6. Report
Comment on the issue: what shipped per step with commits, before/after paths for the hero at 390 and 1440 and for /pricing at 390, the Lighthouse table, decisions you took, anything blocked. Add a tasks/PROGRESS.md entry and a dated line to C:\Users\borgh\HQ\businesses\wisedinner\log\2026-09-24.md. Remove .loop-halt. Push design-v5. Main untouched. Last line of your reply: the preview URL and "Waiting on publish".

8. Source names out of user-facing copy, same branch design-v5.
a. The "One short list with a real total" card: last sentence becomes "You also see what the same list costs delivered, estimated."
b. grep -rni "kroger" across app/, components/, content/ and the built HTML. Any user-facing mention on any route (home, pricing, FAQ, the-math, share pages, legal) loses the retailer name; "delivered" or "public price data" replaces it, meaning unchanged. Same for Walmart and Instacart if they appear. Code, data files, docs and API routes are untouched.
c. Add to CLAUDE.md under the copy rules: "Retailer and data source names never appear in user-facing copy. Say delivered, in store, or public price data."
d. Voice lint, build, grep the built HTML for kroger, walmart, instacart: 0. Comment on the issue. Main untouched, still waiting on publish.
