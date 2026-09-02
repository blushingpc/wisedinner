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
R1. [ ] Phase 1 (WD-01 dead App Store links · WD-02 z-index scale · WD-03 mobile sticky bar) — branch wd-phase-1, PR to main.
   done means: `node scripts/wd-check.ts` passes on the Vercel preview, §9 Phase 1 lines all checked, PR open for the founder.
R2. [ ] Phase 2 (WD-04 → WD-11) — branch wd-phase-2 on top of phase 1.
   done means: §9 Phase 2 lines all checked on the preview; PR open.
R3. [ ] Phase 3 (WD-12 → WD-20) — branch wd-phase-3 on top of phase 2.
   done means: §9 Phase 3 + global regression lines all checked on the preview; PR open.

## After keys/DNS (blocked until human does chrome-tasks.md)
11. BLOCKED (Stripe keys): 21-day trial checkout, annual-first pricing page per wisedinner-truth.
12. Switch canonical URL to https://www.wisedinner.com everywhere (DNS resolves to Vercel as of 2026-08-30; apex redirects to www).

## Ideas
(append here — metric tag required)
- [activation] solver: cap breakfast repeats (same breakfast ≤3×/week, same lunch ≤3×) — iter-1 plans serve one breakfast 5 days straight; the dinner cap alone reads monotonous at the reveal
- [activation] dark mode — deferred by docs/DESIGN.md §0.5, revisit after 100 users

## Done
W. Sunday drop automation (weekly-drop.yml + guard + iso-week seed) — done 2026-08-30, dispatch run green
V. Variety + truth sprint: template solver, variety floors, seeded regenerate, fixture regen, placeholders — done 2026-08-30, live
4–15. SITE-SPEC v2 sprint: full public site (see PROGRESS 2026-08-30) — done 2026-08-30, live
3. Solver: `/api/solve` deterministic greedy + repair, two-bucket week, 7 unit tests. — done 2026-08-30, live
2. Staple price data v0: `data/staples.json` — 41 SKUs, typed loader, hidden /staples debug page. — done 2026-08-30, live at https://wisedinner.vercel.app/staples
1. Scaffold: Next.js App Router + TS strict + Tailwind with the human-design tokens; deploy pipeline to Vercel working. — done 2026-08-30, live at https://wisedinner.vercel.app
