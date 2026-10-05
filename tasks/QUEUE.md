# Task queue — top unblocked item is always the current job
Rules: one job in flight. Each job has a "done means" line — that is the test.
Blocked jobs get `BLOCKED:` + one line on what's needed. New ideas go under
Ideas with a metric tag [activation|conversion|price-accuracy|perf] or they get deleted.

## Current scope and continuation, October 5, 2026

- Latest founder steering, October 5: store/category/region-adjusted grocery estimates with measured uncertainty and multiple chosen stores, not arbitrary extra unused budget. Industry onboarding was researched first. Next local slice: fixture-only quote/estimate contract and evidence/rights/calibration harness in `tasks/STORE-ESTIMATE-PLAN.md`. Do not resume the superseded reserve experiment. No collection, app port, public field or production/provider activation is authorized here.
- Material source gate: Kroger's rendered official public-API rules restrict systematic database gathering, cross-retailer comparisons and modified values. Collection/model rights must be resolved. Documentary location-filter and latent app split-shopping concerns need reproductions, not assumed fixes. Research: app repo `reports/WiseDinner onboarding and price logic.md`.

The submitted overnight run supersedes older launch scope: accounts Apple/Google/email, verified eligible 14-day auto-renewable trial/existing access, included rerolls, optional notifications; unchanged $8.99/$48. No ongoing Free or separate reroll product. Older queue entries are history, not permission to activate delivery, checkout, waitlist, phone/SMS or publish.

- Local backend slices verified: account/session/ownership/deletion, billing/access/inbox, reviewed restricted diets/physical pantry, exact pack/provenance and stage-before-publish, private push/operations/support with prepared durable send reservations. Six migrations remain unapplied; provider/native activation unverified. Full result/precise continuation: `docs/OVERNIGHT-BACKEND-REPORT.md` and `tasks/OVERNIGHT-BACKEND-PLAN.md`.
- Reviewed acceptance now passes all six profiles at seeds 0/7/19: 108 approved of 132 distinct structures, 24 quarantine, 14 combined reviewed ingredients. Vegan four-cent price headroom and weak breakfast substitutions remain practical limits. Do not claim public coverage or kitchen testing.
- Following the current store-estimate workstream: separately authorized app account/trial integration, preceded by read-only provider/product/SMTP/callback evidence and isolated Supabase-compatible Auth/PostgREST/RLS proof. Use `docs/OVERNIGHT-APP-HANDOFF.md`; no automatic core port, snapshot refresh, receipt exposure, provider activation or database push.
- Founder blocked: email code versus link, reroll grocery/budget behavior, restore transfer policy, founders date interpretation/release date, unsupported-location price/accuracy policy, retention/privacy/legal and rollout authorization. Production email delivery, native purchases, App Store URL, monitoring and public food/price source coverage remain release gates. B2 has tested local dry infrastructure, not a working phone alert.

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
E4. switch support email to a transactional provider before volume (the Gmail IMAP/SMTP loop in app/api/support/poll is capped at 450 sends a day; BACKEND-V1 §8).
E5. add Anthropic billing before launch (the support assistant runs on a $5 balance, enough for testing; BACKEND-V1 §8).
E6. [ ] founders_invite_url: set the app_config row once the WhatsApp founders group exists (Table Editor → app_config → value, or one SQL update); /api/data/latest serves it live. done means: GET /api/data/latest shows the link.

## Backend v1 — docs/BACKEND-V1.md (founder spec 2026-09-09), branch backend-v1, PR #20
Current authorized readiness work, October 3: local `codex/backend-readiness` contains verified portion, search,
catalog-direction, input-compatibility and snapshot-continuity preparation. It is not published or app-ready.
Read docs/BACKEND-READINESS-2026-10-03.md before continuation. Next independent technical slice is pinned
nutrition and complete SKU-ID allergy coverage coordinated with the app; paid grocery rules and local-price
fallback remain founder choices. B2 below, staged publication and native subscription proof are still open.
October 4: nutrition identity/import guards are verified locally (122 tests, type/lint/voice/build). Current soy
proxies now block new assembly; reviewed replacement source values and SKU-ID allergy coverage are still open.
October 4 terminal continuation: local ingredient/catalog work and all backend gates pass (141 tests).
All 79 nutrition outcomes and safety IDs are saved; 10 generic nutrition references pass, 69 remain blocked;
25 inherent safety identities are reviewed, 54 package-dependent entries remain unknown. Offline expansion
has 4,704 structured drafts, 66 explicitly approved internal preparations and 4,638 quarantined. Runtime
selection is bounded at 96; public API/app unconnected. Do not replace published coverage with the staging subset.
Next within this workstream: matching package labels/identities and edible yields, starting with pea/almond,
whole potato basis, pepper/onion blend, taco seasoning and bone-in/drained packs. Exact continuation and
artifacts: tasks/INGREDIENT-CATALOG-PLAN.md and docs/ingredient-catalog/final-report.md. App port/device
checks and other launch work need their separate workstream; no reroll choice, publication or database change.

October 4 reviewed-week continuation: minimum local outcome verified. Typical seeds 0/7/19 pass at $52.62
reference whole-pack estimates using only the 63 newly approved preparations and thirteen combined reviewed
IDs. Floor and household profiles pass; vegan/vegetarian variety and high-protein dairy-free remain misses.
No legacy anchors, public snapshot refresh, price update, app port or contract change. Fresh 151 tests and all
package gates pass with existing warnings. Source/quantity, quarantines and price-map limitations are in
docs/ingredient-catalog/reviewed-week-report.md; persistent plan: tasks/REVIEWED-WEEK-PLAN.md.
Next data workstream: obtain the full original existing dry-pasta panel and compatible dry-pack evidence,
review a substantial plant-based preparation, then rerun the restricted profiles without changing floors,
calorie-share or protein targets. Pea/almond product choices remain blocked; no automatic brand binding.

B1. [x] backend v1: schema + pipeline + snapshot v1 + solver over the snapshot + API routes + AI support on Gmail + API contract — MERGED to main 1801670 and live 2026-09-24 (PR #20, prod verified: /api/data/latest v4, /api/status db ok, support cron registered).
B2. [ ] database liveness alert (founder ask 2026-09-24, not built yet). Today nothing alerts: the daily keepalive and the 5-minute support cron are the only scheduled database activity, the poll reads Gmail before the database (a revoked app password or a rotated CRON_SECRET makes every poll 502/401 with zero db activity), and db.ok on /api/status is read by nobody but the keepalive. A week of silent failures pauses the free-tier project and the first symptom is a 502 on waitlist / data/latest. Do: `if: failure()` step on the keepalive and data jobs posting to the Telegram bot (TELEGRAM_BOT_TOKEN in the keys file) or the support address; the support cron writes a last-poll timestamp that /api/status surfaces; one external probe of /api/status asserting db.ok and a fresh poll timestamp; restore runbook (https://supabase.com/dashboard/project/zpvqxtklvjitofpbddrn). done means: a forced keepalive failure reaches the founder's phone within an hour, and /api/status shows the last poll time.

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
