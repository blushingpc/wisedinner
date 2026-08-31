# iter-9 audit — Tier 2 items 6 + 7: /plan day cards + math toggle · final CTA on yolk

## Environment
gh, dev server (:3077, reused), journey, git all work. web-design-guidelines fresh fetch
(WebFetch) permission-blocked for the fourth iteration running — audited against the skill's
cached principles. Higgsfield MCP needs OAuth in this session (non-interactive) — zero
generations possible even if wanted. (tooling)

## Shipped this iteration
1. **Tier 2 item 6 (§9.13 / §5 / §18.5)** — /plan defaults to five day cards: day, per-day
   protein, three meal rows (slot caption + name), photo thumb only when the meal name
   exactly matches photography we own (3 templates: chicken thigh rice bowl, greek yogurt
   oat parfait, black bean egg bowl — truth law, never a look-alike). "show the math"
   toggle (real button, aria-pressed, 44px) reveals the old detailed view — fractions,
   per-item grams, kcal — unchanged. Receipt beside it slimmed to list + totals for the
   plan variant (day rows + kcal/day now drop-only, where the receipt is the sole day
   listing); kcal no longer appears anywhere on /plan before the toggle.
2. **Tier 2 item 7 (§9.11 / §10 / §11)** — final CTA ground kale → yolk with ink text: the
   page's boldest moment, saved for last. Submit button = kale (cta-kale), demo link
   promoted to a real ghost button. WaitlistForm `light` variant replaced by `yolk`
   (only caller); dead `.cta-light` CSS deleted. Error text on yolk is ink, not tomato
   (tomato on yolk ≈3.2:1 — fails AA). Ground cadence now matches §10 exactly:
   paper → photo → white → kale → paper → white → paper → white → yolk.
3. **journey.ts** — 3 new checks per viewport: default view hides kcal, toggle reveals it,
   hide-the-math returns. Green both viewports.

## Findings
- conversion · photo coverage on day cards is sparse: the $55/150g seed week matched 0 of
  15 slots, so the default view is text-led cards. Honest options: more owned/depicted-meal
  photography for the highest-frequency templates (Higgsfield, in-style, needs founder to
  authorize + auth the MCP in an interactive session), or accept text-led. Cards read clean
  either way — not reverting.
- polish · math toggle sits under the list, so it shifts position when toggled; acceptable,
  revisit only if a user trips.
- polish · on yolk, label and helper text are both ink — hierarchy flattens slightly;
  AA-safe, deliberate (ink-soft on yolk is borderline 4.56:1).
- nitpick · known capture artifact persists (fixed bottom bar + walkthrough mid-scroll
  states in full-page shots); live scroll re-syncs, no action (same class as iter-6/7/8).

## Verification
Build clean ×2, tests 0 fail. Journey green full run: quiz $55/150g → feasible /plan at
$39.92, 6 new plan-math checks green, all nav/footer links 200, headerCta 4/4, waitlist
mock → /thanks #42, live smoke `already`. Read desktop-plan, desktop-plan-math, mobile-plan,
desktop-home, mobile-home. No reverts.

## Numbers above the FAQ (homepage)
Unchanged at 5 (hero shelf-tag $39.72, strip $39.72 + 153 g, receipt total, "60 seconds").
This iteration touched /plan and the final CTA only; no new homepage numerals.

## Truth gate
No new placeholders; no data-truth additions; meal photos map only to exactly-depicted
meals. 0/8 higgsfield generations.
