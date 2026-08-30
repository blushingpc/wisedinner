# Task queue — top unblocked item is always the current job
Rules: one job in flight. Each job has a "done means" line — that is the test.
Blocked jobs get `BLOCKED:` + one line on what's needed. New ideas go under
Ideas with a metric tag [activation|conversion|price-accuracy|perf] or they get deleted.

## MVP — SITE-SPEC v2 §19 (docs/SITE-SPEC.md). one sprint, push after each step.
1. [x] foundation: SectionShell + token audit
2. [ ] DeviceFrame + ReceiptCard + MealCard + CountUp
3. [ ] landing all sections (S2 upgrade included)
4. [ ] quiz v2 (absorb WIP) + /plan + infeasible state
5. [ ] waitlist API + migration + /thanks
6. [ ] /drop + gen-drop
7. [ ] /pricing /faq /about
8. [ ] /support + API + table
9. [ ] /terms /privacy + LegalLayout
10. [ ] /press + press-kit zip
11. [ ] 404/500
12. [ ] SEO: OG route, robots, sitemap, JSON-LD
13. [ ] analytics events
14. [ ] full pre-flight sweep + Lighthouse every page
15. [ ] PROGRESS sprint summary
   done means: every §20 acceptance line checked.

## After keys/DNS (blocked until human does chrome-tasks.md)
11. BLOCKED (Stripe keys): 21-day trial checkout, annual-first pricing page per wisedinner-truth.
12. Switch canonical URL to https://www.wisedinner.com everywhere (DNS resolves to Vercel as of 2026-08-30; apex redirects to www).

## Ideas
(append here — metric tag required)
- [activation] solver variety rule (max share of weekly protein from one SKU) — a week of lentils + pork loin + whey is optimal but not a week people cook; more accepted plans at the reveal
- [activation] Sunday GitHub Action to regenerate data/drop.json (SITE-SPEC §11)
- [activation] dark mode — deferred by docs/DESIGN.md §0.5, revisit after 100 users

## Done
3. Solver: `/api/solve` deterministic greedy + repair, two-bucket week, 7 unit tests. — done 2026-08-30, live
2. Staple price data v0: `data/staples.json` — 41 SKUs, typed loader, hidden /staples debug page. — done 2026-08-30, live at https://wisedinner.vercel.app/staples
1. Scaffold: Next.js App Router + TS strict + Tailwind with the human-design tokens; deploy pipeline to Vercel working. — done 2026-08-30, live at https://wisedinner.vercel.app
