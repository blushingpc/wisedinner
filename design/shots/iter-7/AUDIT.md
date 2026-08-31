# iter-7 audit — Tier 2 item 3: three photo-led benefits (§9.8)

## Environment
gh, dev server (:3077), journey, git all work. web-design-guidelines fresh fetch (WebFetch)
permission-blocked again — audit ran against the skill's cached principles. (tooling)

## Shipped this iteration
1. **Tier 2 item 3 (§9.8)** — new S6 on white between the inline demo and FAQ: three 4:5
   photographs (A4-1..3, already generated) in an editorial row, 24px gutters on desktop,
   middle image offset 40px lower (lg:mt-10), one Bricolage 28px line under each per §18's
   copy block (never ask "what's for dinner." / one short list. one trip. / nothing rots on
   thursday.). No icons, no card borders, no descriptions. figure/figcaption semantics,
   sr-only h2 for the outline, real alt text, explicit dims, lazy (below fold, correct).
2. **journey.ts scroll-walk fix** — fullPage screenshots missed any `loading=lazy` image past
   Chromium's lazy margin (~4400px down): first two captures showed captions over blank space
   while curl + the optimizer both served the files fine. Root cause is capture tooling, not
   the page; shot() now walks the page (800px steps) then returns to top before capturing.
   Fixes this and every future below-fold image in shots.

## Findings
- polish · desktop pinned walkthrough captures with screen 3 ("empty, on purpose") under the
  step-1 text — the scroll-walk leaves the IO crossfade on the last screen after returning to
  top. Capture artifact only; live scroll re-syncs the screen to the step in view. No action
  (same class as iter-6's sticky notes). If it bothers future audits, shot() could dispatch a
  scroll event after the walk.
- nitpick · benefits `sizes` says 33vw but the 1200px container caps rendered width ~370px —
  minor over-fetch at wide viewports. Not worth a line of config; revisit only if LCP budget
  ever tightens.
- nitpick · quiz step 1 desktop still sparse right of the 62ch column (§9.13 photo rail,
  Tier 2 item 6 queued).

## Verification
Journey green 3× this cycle (pre-fix ×2, post-fix ×1): quiz $55/150 g → feasible /plan at
$39.92, all nav/footer links 200, waitlist mock → /thanks #42, live smoke `already`.
Build clean, 12/12 tests green. Read desktop-home + mobile-home post-fix: all three photos
render, captions sit left-aligned beneath, middle column drops on desktop, section reads
editorial (no cards). No reverts.

## Numbers above the FAQ
Unchanged at 5 (hero pill $39.72, strip $39.72 + 153 g, receipt total, "60 seconds").
Captions add zero numerals — "one" and "five" appear only as words, which §5 permits.

## Truth gate
No new placeholders, no data-truth rows needed: A4 photos are generated food/hands-only per
the A4 spec (no faces, no app UI, no people claims). 0/8 generations this iteration.
