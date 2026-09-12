# Task queue — top unblocked item is always the current job
Rules: one job in flight. Each job has a "done means" line — that is the test.
Blocked jobs get `BLOCKED:` + one line on what's needed. New ideas go under
Ideas with a metric tag [activation|conversion|price-accuracy|perf] or they get deleted.

## MVP — SITE-SPEC v2 §19 (docs/SITE-SPEC.md). one sprint, push after each step.
1. [x] foundation: SectionShell + token audit
2. [x] DeviceFrame + ReceiptCard + MealCard + CountUp
3. [x] landing all sections (S2 upgrade included)
4. [x] quiz v2 (absorb WIP) + /plan + infeasible state
5. [x] waitlist API + migration + /thanks
6. [x] /drop + gen-drop
7. [x] /pricing /faq /about
8. [x] /support + API + table
9. [x] /terms /privacy + LegalLayout
10. [x] /press + press-kit zip
11. [x] 404/500
12. [x] SEO: OG route, robots, sitemap, JSON-LD
13. [x] analytics events
14. [x] full pre-flight sweep + Lighthouse every page
15. [x] PROGRESS sprint summary
   done means: every §20 acceptance line checked.

## Remediation — docs/REMEDIATION-2026-09-02.md (founder work order). three PRs, in order; each phase is one job.
R1. [x] Phase 1 (WD-01 dead App Store links · WD-02 z-index scale · WD-03 mobile sticky bar) — MERGED to main + LIVE 2026-09-02 (641bbbb), prod probe green.
R2. [x] Phase 2 (WD-04 → WD-11) — MERGED to main + LIVE 2026-09-02, prod probe green.
R3. [x] Phase 3 (WD-12 → WD-20) — MERGED to main + LIVE 2026-09-02, prod probe green. open founder calls: NEXT_PUBLIC_APP_STORE_URL in Vercel · WD-06 tier 2 (backend) · WD-12 band B (A3 fill background) · WD-19 payload refactor · /start description wording (see ledger).

## Release epic — App Store pre-order → launch (founder decision 2026-09-05: site captures early access, then funnels to the listing)
E1. [x] funnel simplification: pre-sale removed end to end, /founders 301 → /thanks, NEXT_PUBLIC_APP_STORE_URL + NEXT_PUBLIC_RELEASE_DATE flip every primary control between "get early access" and "pre-order on the App Store" — shipped 2026-09-05 with the flag unset.
E2. BLOCKED (founder): App Store Connect listing exists → set NEXT_PUBLIC_APP_STORE_URL (+ NEXT_PUBLIC_RELEASE_DATE, e.g. "March 2027") in Vercel production + preview, drop Apple's official "Pre-order" badge over public/badges/app-store-black.svg, redeploy. done means: both badges link to the listings, every text CTA reads "Pre-order on the App Store", /ios 307s to the listing, the Release line shows.
E2b. [x] REDESIGN v3 (docs/REDESIGN-V3.md) — PUBLISHED 2026-09-07 (main 0437bb6), prod probe green, prod Lighthouse 95/100/100/100.
E2d. [x] REDESIGN v4 (docs/REDESIGN-V4.md) — PUBLISHED 2026-09-08 (main 8a3aa48), prod probe green, prod Lighthouse 93/100/100/100, issue #18.
E2e. [x] MOBILE FIX PASS v2 (founder iPhone screenshots) — PUBLISHED 2026-09-12 (main at the LCP follow-up 0195c2c), preview + prod probes green, Lighthouse mobile 90 to 91 (= the pre-pass baseline measured the same hour). Founder accepted the four calls (mark 15px, 56/56 rhythm, "$5.80 under", 14px sub under 375). Still open: the official Pre-order badge svg + NEXT_PUBLIC_APP_STORE_URL (badges return by themselves).
E2c. BLOCKED (founder): Vercel Preview env for design review — NEXT_PUBLIC_APP_STORE_URL="#", NEXT_PUBLIC_PLAY_URL="#", NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF=true, NEXT_PUBLIC_RELEASE_DATE; official pre-order badge svg once the listing exists.
E3. post-launch — WhatsApp outreach to new accounts, first 100 as S-tier testers. done means: outreach list + invite flow defined by the founder; nothing on the site.

## After keys/DNS (blocked until human does chrome-tasks.md)
11. BLOCKED (Stripe keys): 21-day trial checkout, annual-first pricing page per wisedinner-truth.

## Ideas
(append here — metric tag required)
- [activation] solver: cap breakfast repeats (same breakfast ≤3×/week, same lunch ≤3×) — iter-1 plans serve one breakfast 5 days straight; the dinner cap alone reads monotonous at the reveal
- [activation] dark mode — deferred by docs/DESIGN.md §0.5, revisit after 100 users

## Done
12. Canonical URL → https://www.wisedinner.com everywhere (app/copy.ts SITE, metadataBase, sitemap, robots, OG; zero stale hosts in app/lib/content) — verified done 2026-09-05
W. Sunday drop automation (weekly-drop.yml + guard + iso-week seed) — done 2026-08-30, dispatch run green
V. Variety + truth sprint: template solver, variety floors, seeded regenerate, fixture regen, placeholders — done 2026-08-30, live
4–15. SITE-SPEC v2 sprint: full public site (see PROGRESS 2026-08-30) — done 2026-08-30, live
3. Solver: `/api/solve` deterministic greedy + repair, two-bucket week, 7 unit tests. — done 2026-08-30, live
2. Staple price data v0: `data/staples.json` — 41 SKUs, typed loader, hidden /staples debug page. — done 2026-08-30, live at https://wisedinner.vercel.app/staples
1. Scaffold: Next.js App Router + TS strict + Tailwind with the human-design tokens; deploy pipeline to Vercel working. — done 2026-08-30, live at https://wisedinner.vercel.app
