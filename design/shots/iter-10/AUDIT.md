# iter-10 audit — Tier 3 items 1–3: hero motion · solving chips · composed OG

## Environment
gh, dev server (:3077, reused), journey, git all work. web-design-guidelines fresh fetch
(WebFetch) permission-blocked for the fifth iteration running — audited against cached
principles. Higgsfield MCP still needs OAuth (non-interactive session); zero generations
needed or made this iteration. (tooling)

## Shipped this iteration
1. **Tier 3 item 3 (§12.1)** — hero motion, pure CSS, zero new JS: phone screen crossfades
   between "this week" (meal photos) and "the list" (fresh aisle / shelf + freezer, yolk
   checks, "empty fridge, on purpose.") on an 8s cycle — 4s per face; headline, lede, form,
   demo row and phone fade-up 300ms staggered 80ms on load. List face carries NO numerals —
   the numbers gate holds at 5. fade-up lives on the untransformed containers (the phone's
   -translate-x centering survives; keyframe `to` would have clobbered it).
2. **Tier 3 item 2 (§12.2)** — walkthrough step 2 "solving" animation: 11 staple chips pop
   in staggered 90ms (~1.4s total), the "solved — five days, one list" line lands at 1.15s.
   Plays once — first time step 2 becomes active (desktop IO step or mobile slide), then
   stays settled. No JS → chips render static, fully readable.
3. **Tier 3 item 1 (§13 A6 / 18.5)** — /og rebuilt as the composed card: A2 crop (three
   bowls, forks) fills the left two-thirds, real Bricolage 800 lowercase headline on paper
   right, yolk mono shelf-tag ($39.72 / one trip) over the photo, cropped-viewBox wordmark,
   kale wisedinner.com. Fonts (Bricolage 800 + Plex Mono 600 TTF instances) and the 800×630
   crop are committed edge-bundle assets — fetched via inline `new URL(..., import.meta.url)`
   (a `load(path)` helper defeated Next's static bundling; 500 until inlined). Pricing
   variant drops the grocery shelf-tag (wrong claim next to "$4.99/mo"). Old receipt-in-Arial
   OG deleted. H1s checked: all 12 already lowercase.

## Findings
- polish · hero list face shows one lonely "fresh aisle" row (the current drop fixture has a
  single perishable) — honest data, reads slightly bare; fixed the worse version where it had
  no group caption at all. Revisit only if the fixture gains perishables.
- perf · fade-up delays first paint of the hero image by ≤460ms (160ms delay + 300ms anim);
  LCP had ~1s headroom, accepted per §12.1. Watch the Lighthouse gate next full pass.
- accepted deviation · the 8s crossfade is an infinite animation (guidelines discourage);
  spec-mandated by §12.1, subtle, and killed under prefers-reduced-motion (list face never
  shows — screen A stays).
- nitpick · known capture artifact persists (walkthrough mid-scroll states in full-page
  shots); live scroll re-syncs, no action (same class as iters 6–9).

## Verification
Build clean, tests 12/12. Journey green full run ×2 (before + after the list-caption fix):
quiz $55/150g → feasible /plan $39.92, plan-math checks, all nav/footer 200s, headerCta 4/4,
waitlist mock → /thanks #42, live smoke `already`. Crossfade proven live: layer-B computed
opacity = 1 at t≈5.2s, desktop-hero-list-face.png shows the list face rendered in-frame.
Read desktop-home, mobile-home, desktop-hero-list-face, og-home, og-pricing. No reverts.

## Numbers above the FAQ (homepage)
Unchanged at 5 (hero shelf-tag $39.72, strip $39.72 + 153 g, receipt total, "60 seconds").
The list face was written numeral-free on purpose.

## Truth gate
No new placeholders; no data-truth additions. OG numbers come from the committed drop
fixture (est. in-store), same as the live site. 0/8 higgsfield generations.

## 18.5 checklist movement
- [x] headings lowercase incl. h1; OG renders Bricolage and shows food  ← this iteration
- remaining open: Lighthouse re-measure (LCP/CLS), plus Tier 3 items 4–7 (link underline
  animation, final-CTA dark phones / footer regroup, sticky mobile CTA bar verify, post-launch swap).
