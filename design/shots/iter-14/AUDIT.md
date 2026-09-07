# iter-14 audit — calai.app ports #13 / #14 / #15 (reference study rank 1–3)

## Environment
design-v2 fast-forwarded to main (910636c) first. dev :3077 (webpack not needed — no worktree this time).
chrome-devtools MCP: 390×844×2 + 1440×900×1 shots, Lighthouse (mobile, navigation) and a perf trace per item.
Full-page mobile capture only works at DPR 1 (DPR 2 fails at 9300px — same as the study noted).
`impeccable context` engine download refuses with "checksum mismatch" upstream (pbakaus/impeccable
engine-v0.1.0, windows-x64) — audit ran by hand against reference/audit.md's five dimensions. (tooling)
web-design-guidelines: WebFetch of command.md worked this iteration; reviewed the changed files against it.

## Shipped
1. **#13 mobile hero fold budget** (c3248d6). Measured before touching anything: the phone's top edge was
   already inside the 390 fold (y=608, 236px visible); the issue's "h1 84px / 5 lines" was the h1's box height,
   the type is 44px on two lines. The real waste: proof chip wrapping to two lines (369px string vs 342px).
   Copy → `five days · one receipt · real shelf prices` (303px) — also removes the only typed number in the
   hero (§5). Phone top y=586, 258px in the fold.
2. **#14 stacked waitlist form** (6724685). ≤420: label → field (342×54) → full-width button (342×54) →
   status; the final-CTA ghost twin goes full width too. `.cta` sets min-height in unlayered CSS, so the
   width/height live as a `.cta-wide` modifier in the existing ≤420 media block, not as utilities. Same
   component → hero, final, /plan, /pricing, /drop all stack. 320: 272px column, no overflow. Phone top 648
   at 390 (196px in fold). Desktop untouched. `spellCheck={false}` added to the email input (guidelines).
3. **#15 band padding token** (71e6f2a). `--band` 56/96 and `--band-spotlight` 96/160 → `py-band`,
   `py-band-spotlight`. Every homepage band + Section shell + /the-math on `py-band`; kale receipt room on
   the spotlight. Desktop 96 ×7 + 160 (walkthrough 1461 ≤ 1500), mobile 56 ×6 + 96; final band keeps
   pb-36 sticky-bar clearance. Page 7356 → 7543 desktop.

## Verification
Lighthouse mobile after each item: a11y 100 / best-practices 100 / SEO 100 (57 audits, 0 failed).
Trace (local, unthrottled): LCP 259 / 341 / 262 ms, CLS 0.00 ×3.
journey.ts against :3077 — quiz half green both viewports (feasible $40.24 / 152 g, math toggle, all links 200,
mocked waitlist → /thanks #42). The four header-sheet asserts fail as known-stale (pre-order funnel, 6f036a3).
Preview https://wisedinner-git-design-v2-wise-dinner.vercel.app measured at 390: chip 303×32, field/button
342×54, phone top 648, bands 0,0,56,56,96,56,56,56,56 — identical to local. preview-mobile-fold.png read.
tsc clean, eslint clean on changed files. Shots read: before/after-13 (mobile+desktop), after-14 (390 fold,
390 final, 320 fold, desktop), before/after-15 full pages + after-15-mobile-receipt.

## Findings
- truth/conversion · **P0 for the founder** · live smoke POST (seeded email) → `502 {"error":"could not save"}`
  on the preview; was `already` iters 6–12. Route reached the Supabase insert (env present) and it failed.
  Prod not probed (write). Filed as blocked-founder; the loop may not touch the API.
- polish · the study's "form + demo link on one 44px row" (#13) was dropped on purpose: with #14 stacked
  the demo link stays its own 44px row; the fold still holds 196px of phone, above the ~110px target.
- nitpick · at 320 the chip wraps to two lines (272px available). Accepted; 390 is the design width.
- nitpick · guidelines want placeholders ending in "…" and Title Case labels — DESIGN-AUDIT's lowercase
  voice wins; not applied.
- tooling · impeccable engine checksum mismatch (upstream). chrome-devtools `take_screenshot` times out
  intermittently at protocolTimeout (60s); a retry always succeeded.

## Reverts
none — every change moved its measured target.
