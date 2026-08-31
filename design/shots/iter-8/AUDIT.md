# iter-8 audit — Tier 2 item 5: header CTA behaviour (§9.1)

## Environment
gh, dev server (:3077, reused the already-running instance — my spawn lost the port race),
journey, git all work. web-design-guidelines fresh fetch (WebFetch) permission-blocked for the
third iteration running — audit ran against the skill's cached principles. (tooling)

## Shipped this iteration
1. **Tier 2 item 5 (§9.1 / §18.5)** — header "get early access" never jumps the page anymore:
   new `HeaderCta` client component. Hero email field fully on screen → click focuses it;
   otherwise a slide-down sheet under the sticky header ("early access, one email away." +
   `WaitlistForm source="header"`, server maps unknown sources to hero — API untouched).
   `href="/#early-access"` kept as the no-JS fallback. aria-expanded/controls, input
   auto-focused on open, Escape closes and returns focus to the trigger, sheet animates
   translateY/opacity only, reduced-motion → no animation. "pricing" was already in the nav
   (both desktop links and hamburger) — verified, no change needed.
2. **Hero pill** — "iOS · 2026 · free web demo" restyled from plain caption to a quiet
   outlined pill (rounded-full, rule border) per §8/§17 Tier 2 item 5. Same copy, no new
   numerals.
3. **Mobile header fix (found in the sheet shots)** — at 390px the CTA crowded the wordmark
   ("wisedinne…" clipped behind the button; pre-existing, visible in earlier iters' mobile
   shots too). Scoped media query ≤420px tightens only `header .cta` (padding 0.75rem,
   14px text); min-height 44px stands. Wordmark now fully legible.
4. **journey.ts headerCta check** — durable assertion for the §18.5 line "header CTA never
   scrolls the page": top-of-page click must focus #email-hero; mid-page click must open
   #header-sheet with scrollY unmoved (<5px); sheet must focus #email-header; Escape must
   close. 4 new green checks, desktop pass.

## Findings
- polish · first sheet cut had its headline duplicating the form helper line ("one email when
  the app is ready" twice) and items-end baselined the headline on the helper text — fixed
  in-iteration (new line + items-center), re-shot, reads clean.
- nitpick · sheet has no outside-click dismiss — Escape + toggle only. Same idiom as the
  `details` hamburger beside it; add a mousedown-outside listener only if a real user trips.
- nitpick · trigger stays an `<a>` acting as a disclosure button (href is the no-JS fallback).
  Screen readers announce a link that expands; acceptable trade, noted.
- polish · known capture artifact persists (walkthrough screen 3 under step-1 text after the
  scroll-walk); live scroll re-syncs, no action (same class as iter-6/7 notes).

## Verification
Journey green 3× this cycle (2 full + 1 pre-copy-fix), incl. the 4 new headerCta checks:
quiz $55/150 g → feasible /plan at $39.92, all nav/footer links 200, waitlist mock →
/thanks #42, live smoke `already`. Build clean, tests 0 fail. Read desktop-home,
mobile-home, desktop-header-sheet, mobile-header-sheet post-fix: pill reads quiet,
sheet aligned, wordmark whole. No reverts.

## Numbers above the FAQ
Unchanged at 5 (hero shelf-tag $39.72, strip $39.72 + 153 g, receipt total, "60 seconds").
The pill's "2026" predates this iteration and is a date, not a marketing claim (§5 reading
unchanged from iter-4).

## Truth gate
No new placeholders: the sheet reuses the real waitlist form; pill copy unchanged.
0/8 higgsfield generations this iteration.
