# iter-5 self-audit — 2026-08-31 · Tier 1 item 5 + Tier 2 item 1 · inputs: docs/DESIGN-AUDIT.md §§9.4, 9.7, 12, 18.5 (issue poll unavailable — gh blocked in this session)

## environment limits (blunt)
- gh, git pull/push over network, dev/start servers, and node scripts all permission-blocked again.
  `npm run build` and `npm test` DID run (clean, 12/12). NO journey screenshots, NO issue poll, NO
  blocked.json refresh. Every visual claim below is static code review. The iter-4 rule stands doubled:
  the first unsandboxed iteration runs journey FIRST and reverts anything from iter-4 OR iter-5 that
  didn't land visually.
- web-design-guidelines fetch is network-blocked; reviewed against the known ruleset instead. Two
  findings on my own diff, both fixed pre-commit: carousel scroll container not keyboard-focusable
  (added tabIndex + aria-label), and a divide-by-zero → NaN dot index when the carousel has no
  overflow (guarded).

## fixed this iteration
- conversion/CRITICAL · Tier 1 item 5 — how-it-works rebuilt as PinnedWalkthrough (app/ui/pinned-walkthrough.tsx):
  desktop pins one 380px phone (sticky top-24) while three ~400px step blocks scroll past; screens
  crossfade 300ms + 12px slide on IntersectionObserver (rootMargin ±45%), motion-reduce → instant.
  Estimated section height ~1,350px ≤ the 1,500px gate (was ~1,900px alternating rows). Mobile is a
  snap-scroll swipe carousel with dots per gate 18.5. Screens per §12: 01 two-numbers with depicted
  sliders ($60 / 150 g, yolk thumbs), 02 twelve real ingredient chips from drop.json + yolk "solved"
  check (no prices — closer to §9.4 than the old MealCards), 03 the list grouped fresh / shelf+freezer
  with checks + "fridge: empty, on purpose." No JS → step text fully readable, phone shows screen 1.
- conversion/HIGH · Tier 2 item 1 — receipt room (§9.7): new S4 on kale, A3 flat-lay behind at 30%
  opacity, "the receipt is the proof." + the three promises, ReceiptCard new "proof" variant (12 list
  lines + est. total in tomato + protein/day + food-wasted 0; NO day rows, NO kcal, NO date stamp per §5)
  at ~560px tall ≥ the 480px gate, tilted 3°, printing in top-to-bottom via clip-path 600ms riding the
  existing [data-reveal]/Reveal stack — no new JS, reduced-motion + no-JS → simply there. Homepage went
  from zero receipts to exactly one (gate 18.5).
- polish · demo band retinted kale → linen with a ghost demo button so the receipt room is the page's
  one dark moment (§9.11 two-dark-rooms warning). Section order now matches §11: paper → photo → white
  → kale → linen → faq → final.

## numbers accounting (§5 rule: ≤6 marketing numerals above the FAQ)
- unchanged at 5: $39.72 (hero tag), $39.72 + 153 g (strip), 60 (demo band), 2026 (pill).
- receipt-internal prices and in-phone $60/150 g are app-UI/motif depictions, exempt per the spec's own
  design (a 12-line receipt above the FAQ is §9.7/§11's explicit proposal and coexists with the ≤6 rule).

## open, above nitpick
- VISUAL VERIFY DEBT (two iterations deep): iter-4 hero/palette/strip AND this walkthrough + receipt
  room have never been screenshotted. Top job for the first unsandboxed cycle; revert rule armed.
- Step-2 chip screen may crop on the 240px mobile phone (12 chips at 12px in a ~180px column). Judged
  fine in estimate; screenshot will decide.
- Print-in triggers at Reveal's rootMargin (-10% bottom), not §12's "40% in view" — earlier than spec.
  Nitpick-adjacent; revisit only if the screenshot shows it firing half-off-screen.
- Tier 2 remaining: inline demo section (item 2), A4 benefits row (3), people section (4), header CTA
  focus-not-jump (5), /plan day-card default (6), final CTA on yolk (7). Tier 3: OG image, hero
  crossfade, sticky mobile CTA, solving animation.
- hero screen still 3 meals not 5 (only 3 honest meal photos exist) — carried from iter-4.

## nitpick
- walkthrough uses bg-white per §18.1 --white; body ground is paper — hairline seam between strip and
  walkthrough may want a rule. Screenshot will decide.
- Section-alt green-050 subpage tint still cool vs warm paper (carried from iter-4).

## reverted
- none new (nothing visually comparable this session; the standing revert rule covers iter-4+5 next
  unsandboxed cycle).
