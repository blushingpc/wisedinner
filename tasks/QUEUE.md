# Task queue — top unblocked item is always the current job
Rules: one job in flight. Each job has a "done means" line — that is the test.
Blocked jobs get `BLOCKED:` + one line on what's needed. New ideas go under
Ideas with a metric tag [activation|conversion|price-accuracy|perf] or they get deleted.

## Current scope and continuation, October 5, 2026

- Latest founder steering, October 5: store/category/region-adjusted grocery estimates with measured uncertainty and multiple chosen stores, not arbitrary extra unused budget. Local pricing slice completed in source commits `5f860e0` and `5289f64`: private whole-pack/pantry/single/split quotes, frozen full-basket allowance and reviewed-week bridge, including exact-cent profile budgets. Six profiles × seeds 0/7/19 pass using fictional prices and replay identically under final code; 237/237 tests and all package gates pass. Exact evidence, limitations and handoff: `docs/STORE-ESTIMATES-LOCAL.md`, `tasks/STORE-ESTIMATE-PLAN.md`. Synthetic adverse held-out overruns and soy food-coverage failure are recorded, not hidden. No real local price feed/accuracy guarantee or app activation. Do not resume the superseded reserve experiment or start another workstream in this run.
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

## October 7, 2026: Terminal A four-recipe successor checkpoint

- LOCAL source2d1b9b5 commits the existing four-recipe preparation/equipment/optional-seasoning slice; fresh16 focused/types/scoped lint/voice/one build pass, matching374 full tests reused. The old21:31 failed report/history and inherited note bodies remain untouched; owned suffixes only are committed. New report ../docs/RECIPE-PREPARATION-SUCCESSOR-LOCAL-2026-10-07.md;79 exact held IDs remain open, no shared adoption or kitchen/food/price acceptance.
- Unapproved next group: Greek yogurt parfait base, plant and oats variants, with individual ingredient/method/equipment evidence. Coordinator independently selects the next job; account/provider/hosted/native/food/measured-price/submission/G gates remain open. No new recipe count, activation, spending, public promise or self-dispatch.

## October 8, 2026: Terminal A six-family partial acceptance

- Source62b4830 saves18 individual existing methods,22 prepared/61 held out of83, no adoption or food/price acceptance.41 focused+2 parity checks/scoped lint/voice pass; ordinary typecheck and required build fail at read-only app config.ts __DEV__. Coordinator review must scope the ambient dependency repair and subsequent A verification; no type exclusion/shim/app write or failed-gate promotion.
- Exact prepared/held IDs and evidence are in ../docs/RECIPE-PREPARATION-BATCH-LOCAL-2026-10-08.md. Inherited note/report/history bytes preserved; owned suffix only staged. Next independent local authoring suggestion: southwest-chicken-wrap/chicken-burrito-bowl/mediterranean-chicken-bowl-with-tzatziki existing variants. A4 parent, authentic food/measured prices, hosted/native/provider/adoption/submission/G remain open; no self-approval, activation or spending.

## October 8, 2026: Terminal A wrap/bowl partial acceptance

- Sourcee9d1b483 saves9 existing Southwest/burrito/Mediterranean methods,31 prepared/52 held/83 total; exact prior22/materialization parity and40 focused/scoped lint/voice pass. Required ordinary types/build are UNRUN/held until exact naturally completed B ambient repair source; no live checkout certification or suppressed error. Prior BLOCKED results/failures stay unchanged.
- Exact83 coverage, commands/pins/rollback and new report: ../docs/RECIPE-PREPARATION-WRAPS-BOWLS-LOCAL-2026-10-08.md. Coordinator reviews completed B repair then bounded same-source A types/build. Other independently selectable local authoring: existing turkey-avocado sandwich/tuna salad wrap/turkey taco bowl families. A4/food/price/adoption/hosted/native/provider/submission/G remain open, original deadline unchanged; no self-dispatch or spending.

## October 8, 2026: Terminal A next six-family LOCAL proof

- Source8fa3669 adds18 actual existing methods;49 prepared/34 held/83 total with previous31/materialization parity.57 focused, ordinary types/scoped lint/voice/ONE local build pass against42 exact completed B transitive inputs. Original previous failed/UNRUN gates remain unchanged; this current proof only supports later independent acceptance.
- Report ../docs/RECIPE-PREPARATION-NEXT-SIX-LOCAL-2026-10-08.md enumerates83 IDs, exact rows/equipment/safety limits/evidence/rollback. Continue only after coordinator review, e.g. existing turkey-chili/pesto-chicken-pasta/chicken-stir-fry family slice or confirmed repair. A4/consumer/food/yield/measured-price/hosted/provider/native/store/G open; no activation/self-dispatch/spend and original target unchanged.

## October 8, 2026: Terminal A remaining preparation checkpoint

- Source bd3527e adds32 existing methods;81 prepared/2 held/83 total. Bone-in thigh barbecue base/potato raw edible-weight ambiguity stays held.76 focused, ordinary types/scoped lint/voice and ONE local build pass; previous49 outputs/all83 materialized fields unchanged, admissionsfalse. Original34 missing-method assertions remain unchanged with32passes/two unresolved failures.
- Report ../docs/RECIPE-PREPARATION-REMAINING-LOCAL-2026-10-08.md enumerates83 IDs and exact34 investigated rows. Extra read-only binding wrapper exit1 left uncertain fence; owner/child absent, coordinator must diagnose before further heavy work. Only lightweight checkpoint/report/seal continues. Next separately reviewed local work: equipment/questionnaire/reroll filtering integration with two thigh IDs held, or confirmed repair. A4/adoption/authentic food/price/hosted/provider/native/store/G open; no activation/self-dispatch/spend, original deadline unchanged.

## October 8, 2026: Terminal A internal equipment filtering LOCAL proof

- Source9779f345 adds the optional exact preparation/equipment gate to the existing internal catalog path, preserving no-context callers and all81 methods/83 rows. Committed76 fit/7 excluded, authored80 fit/3 excluded, reviewed generated0 fit/63 excluded; two bone-in thighs and valid parent closure stay held. Unknown/missing/malformed/getter equipment never assumes ownership; all admissionsfalse.
- Final38 focused, ordinary types/scoped lint/voice pass;42 completed B inputs stable, sealed prior LOCAL build reused with121 matching public/config files/230 edges. Fresh report ../docs/RECIPE-EQUIPMENT-SELECTION-LOCAL-2026-10-08.md and CURRENT exact source/evidence/rollback/preflight. Next separately reviewed job: bounded questionnaire/consumer compatibility or confirmed repair; A4/food/yield/prices/hosted/provider/native/store/release open. Original deadline and$0 spending unchanged; no self-dispatch or activation.

## October 8, 2026: Terminal A exact LOCAL candidate producer handoff

- Source858c9c12 produces isolated CURRENT candidate bytes from exact existing83-row snapshot with only3 reviewed step corrections. Candidate80fit/3held, original76/7; source/ingredients/price/date/pack/method facts and public bytes unchanged, all admissionsfalse.27 focused/ordinary types/scoped lint/voice pass; busy typehold/two fixture failures/red logs preserved.42 B/121 public pins bind reused LOCAL build; no new full suite/build/publication.
- Exact report ../docs/RECIPE-PREPARATION-STAGED-DATA-LOCAL-2026-10-08.md and CURRENT manifest77ca149ac542f5db2f64ed24a691fbb9755a5c8aa1e9881553dcd81eef89fc3d give frozen candidate hashes/commits/diffs/rollback. Next separately reviewed B4 decoder/source compatibility and questionnaire/consumer handoff must use same bytes, not legacy-app acceptance by assumption. A4/A5/two thigh holds/food/price/hosted/native/provider/store/release open; original deadline/$0 unchanged, no self-dispatch/activation.

## October 8, 2026: Terminal A full-state cloud proposal review handoff

- Frozen CURRENT-only contract/vectors/executable/SQL manifest2dc4c7d80905e48dde697a5941d2e522ca2fdec7b5715b59e61213f3bdcf9ec1 supports LOCAL full-state round-trip through actual pinned owner-local admission and memory SQL; no installed runtime/contract/migration or cloud grant.52 focused plus1 direct-v1 finding/ordinary and proposal types/effective lint/voice pass, original reds/failure/busy UNRUN preserved.42 B/121 public pins remain exact.
- Next independently review producer SQL/server replay trust and the reproduced v1 nested-extra SQL/app-DTO incompatibility, then B2 must consume SAME frozen bytes against source3818a97b. Separate confirmed repair and subsequent server/client/deletion integration require fresh scope. Backend-v6 adoption/hosted/provider/native/food/price/store/release remain open; original target/$0/no self-dispatch unchanged. Exact report ../docs/OWNER-FULL-PLAN-SYNC-PROPOSAL-LOCAL-2026-10-08.md.
