# Task queue — top unblocked item is always the current job
Rules: one job in flight. Each job has a "done means" line — that is the test.
Blocked jobs get `BLOCKED:` + one line on what's needed. New ideas go under
Ideas with a metric tag [activation|conversion|price-accuracy|perf] or they get deleted.

## MVP
4. Quiz `/start`: 6 steps (budget → protein → kcal → diet → household → pantry), in-memory state, ends by calling solve.
   done means: full quiz on mobile viewport reaches the reveal with no dead ends.
5. Reveal page: plan grid, aisle-sorted list, big estimated in-store total, protein/day, projected monthly savings vs stated current spend. Receipt aesthetic. This page is the aha — it gets the most design care.
   done means: screenshot-worthy on a 390px viewport; totals match solver output exactly.
6. Waitlist: Supabase table `waitlist(email, budget, protein_target, created_at)` + insert route + capture on reveal ("email me my plan + early access").
   done means: a real email lands in the Supabase table from the live site. BLOCKED until Supabase env vars are in Vercel.
7. Weekly drop `/drop`: one universal week (fixed seed through the solver), shareable, OG image, email capture reused.
   done means: /drop live, loads under 1s, share preview renders the receipt card.
8. Events: quiz_start, quiz_complete, reveal_view, waitlist_join via Vercel Analytics custom events.
   done means: events visible in the Vercel dashboard from a live run-through.
9. Meta/SEO: title, description, OG receipt card image, favicon.
   done means: paste the URL in a chat app → card looks intentional.
10. Ledger preview: static mocked Savings Ledger section on the landing page (real math from example weeks, labeled example).
    done means: section exists, clearly labeled "example", screenshots well.

## After keys/DNS (blocked until human does chrome-tasks.md)
11. BLOCKED (Stripe keys): 21-day trial checkout, annual-first pricing page per wisedinner-truth.
12. Switch canonical URL to https://www.wisedinner.com everywhere (DNS resolves to Vercel as of 2026-08-30; apex redirects to www).

## Ideas
(append here — metric tag required)
- [activation] solver variety rule (max share of weekly protein from one SKU) — a week of lentils + pork loin + whey is optimal but not a week people cook; more accepted plans at the reveal
- [activation] dark mode — deferred by docs/DESIGN.md §0.5, revisit after 100 users

## Done
3. Solver: `/api/solve` deterministic greedy + repair, two-bucket week, 7 unit tests. — done 2026-08-30, live
2. Staple price data v0: `data/staples.json` — 41 SKUs, typed loader, hidden /staples debug page. — done 2026-08-30, live at https://wisedinner.vercel.app/staples
1. Scaffold: Next.js App Router + TS strict + Tailwind with the human-design tokens; deploy pipeline to Vercel working. — done 2026-08-30, live at https://wisedinner.vercel.app
