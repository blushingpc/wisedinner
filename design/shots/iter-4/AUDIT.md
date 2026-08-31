# iter-4 self-audit — 2026-08-31 · DESIGN-AUDIT Tier 1 (items 1–4) · inputs: docs/DESIGN-AUDIT.md §§5,6,7,8,17,18 (issue poll unavailable — gh blocked in this session)

## environment limits (blunt)
- this session could NOT run npm/node/gh: no `npm run build`, no journey.ts, no screenshots, no issue poll,
  no blocked.json refresh. every claim below is from static code review only. NEXT ITERATION MUST: run
  journey.ts + build FIRST and revert anything broken before new work.

## fixed this iteration (Tier 1, ranked by first-impression impact)
- conversion/CRITICAL · hero rebuilt per §8: one phone (430px desktop, 300px mobile, rotate 6°), food-first
  "this week" screen (3 depicted meals, photo + name + one price), yolk ShelfTag "$39.72 · one trip",
  two A1 cut-out dishes drifting at the phone edges (one on mobile), inline WaitlistForm, ghost
  "try the free demo →", "iOS · 2026 · free web demo" pill. second phone, both hero receipts, kcal,
  eyebrow, micro-label all deleted.
- conversion/CRITICAL · palette installed per §6/§18.1: paper #FBFAF6 ground, linen alt, yolk primary CTAs
  (.cta), kale captions/links/dark rooms, tomato receipt-total only. type per §18.2: display 44–84px
  lh .95, h2 clamp, body 18px, mono retired to receipt/shelf-tag; new .text-caption replaces 11px
  uppercase mono labels on the homepage.
- conversion/HIGH · numbers purge per §5: stat trio + methodology disclaimer + "$[your number]" headline +
  price-vs-delivery section + "[your target]" step phone all gone. marketing numerals above the FAQ now:
  $39.72 (tag), $39.72 + 153 g (strip), 60 (demo band), 2026 (pill) = 5 ≤ 6. shelf-price principle folded
  into the FAQ price answer. step screens show real $60 / 150 g.
- conversion/HIGH · S2 replaced by the full-bleed A2 five-dinners strip (3:1 desktop, 4:5 mobile) with
  bottom scrim, "five dinners. one trip. $39.72." + protein caption.
- polish · how-it-works purged: receipts/kcal out of all three step phones, real widths (no 0.8 scale),
  step copy per §18.4. FAQ reordered launch-first, narrowed to 60ch. footer "tiny team" line cut.
  "pricing" added to desktop nav. deeper frame shadow per §12. demo-band + final CTA on kale.

## open, above nitpick
- ~~UNVERIFIED BUILD~~ — resolved in the follow-up session that committed this: `npm run build` clean (23 routes), `npm test` 12/12 green on this tree. Journey screenshots + issue poll STILL blocked (no server/node/gh perms) — visual judgment of iter-4 remains the top item for the first unsandboxed iteration.
- Tier 1 item 5 (pinned-phone walkthrough ≤1500px) not done — steps still alternating rows (~1900px est.).
- Tier 2 queue: receipt room on kale w/ A3 + print-in animation (homepage currently has ZERO receipts —
  gate 18.5 wants exactly one, ≥480px; the signature motif is missing until this lands), inline demo
  section, A4 benefits row, people section, header CTA focus-not-jump, /plan day-card default,
  final CTA on yolk.
- Tier 3: OG image still the old receipt render (§13 A6), hero crossfade, mobile sticky CTA.
- hero screen shows 3 meals not 5 (only 3 honest meal photos exist); five-day screen needs either 2 more
  depicted-meal photos (higgsfield, in budget) or the real app screen.

## nitpick
- Section-alt green-050 tint is cool against the warm paper on subpages; retint to linen when a subpage pass runs.
- WaitlistForm helper text still text-spec; fine, revisit in type pass.

## reverted
- none (nothing could be visually compared this session; next iteration's screenshots judge these changes
  and reverts anything that didn't land).
