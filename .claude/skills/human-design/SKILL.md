---
name: human-design
description: The WiseDinner visual system ("Ledger Editorial") and anti-AI-slop rules. ALWAYS load this before creating or editing ANY user-facing UI — pages, components, emails, OG images, copy, empty states, error messages. This is the summary; docs/DESIGN.md is the law — read it for any UI job.
---

# Human design — ledger editorial, perfectly imperfect

Restrained page, loud numbers, one warm artifact. Precedence: keep-it-simple → wisedinner-truth → docs/DESIGN.md → anything else.

## Tokens (defined once in app/globals.css `@theme`; never inline values)
- `--bg #FBFBFA` page (near-neutral, NOT cream) · `--ink #191817` · `--ink-soft #6B675F` · `--rule #E4E2DC` hairlines
- `--accent #1D7A46` money green, ≤3 uses per page, ≤10% of any viewport · `--accent-wash #EDF3EC` badge bg (text = accent)
- `--receipt-paper #FAF8F3` and `--receipt-total #C33D2E` exist ONLY inside receipt artifacts
- One shadow in the system: `0 1px 2px rgba(25,24,23,.08)`, only on receipts. Radius: 0 on receipts, 4px on buttons/inputs, 999px only on badges (≤24px tall).
- Links are ink + underline. No second accent, no blue, no #000.
- Motion curves: `--ease-out cubic-bezier(0.16,1,0.3,1)` reveals 600ms · `--ease-press cubic-bezier(0.32,0.72,0,1)` interactions 200ms.

## Type (two families via next/font/google, never `<link>`)
- Bricolage Grotesque 400/500/700: display, headings, UI, body. Emphasis = weight/italic of the same family. Inter and any serif are banned.
- IBM Plex Mono: every number, price, date, micro-label, the whole receipt; `tabular-nums` always.
- H1 `clamp(2.5rem,6vw,5rem)` 700, tracking -0.03em (floor -0.04em), line-height 1.08, `text-wrap: balance`.
- Hero number mono 500 `clamp(3.5rem,9vw,7rem)`, cents at 50% in ink-soft. H2 2rem/700 -0.02em. H3 1.25rem/500.
- Body 1.0625rem/400, line-height 1.65, max 62ch, `text-wrap: pretty`, color ink (soft only for truly secondary lines).
- Micro-labels mono 0.6875rem uppercase tracking 0.15em ink-soft.

## Space and structure
- Container 1200px; padding 24px mobile / 48px desktop. Hero `min-h-[88dvh]`, never h-screen.
- Section rhythm cycles exactly `py-28 → py-20 → py-36 → py-24 → py-32` (mobile ×0.6). Uniform rhythm reads generated.
- Grid over flex math; asymmetric splits like `grid-cols-[1.6fr_1fr]`; all asymmetry, tilts and overhangs collapse below 768px.
- Grouping = hairline `border-top` rows + whitespace. The receipt is the only card. Nested cards, 3-equal-column feature rows, glass, pills (except badges), double bezels: banned.

## Components
- Nav: wordmark `wisedinner` (Bricolage 700 lowercase), two text links + one CTA, hairline bottom, sticky bg 96% opacity, no blur. Mobile: wordmark + CTA.
- Primary CTA: ink fill, bg text, 4px radius, 12px 20px, ≤3 words on one line. Hover darker ink; active `scale(0.98)`. Signup intent label is always `solve my week`.
- Secondary: ink text link, 2px underline, offset 5px.
- Receipt artifact: receipt-paper bg, 0 radius, the single shadow, `rotate(-0.5deg)` (second one on a page: +0.6deg), dashed rule separators, dotted leaders `ITEM····$3.49`, uppercase mono header, total in receipt-total, `* * *` footer, mono timestamp. Everything inside is mono.
- Spec-sheet rows (pricing, /staples): mono 13px, label ink-soft left, value ink right, hairline top per row, no boxes.
- Forms: label above input (placeholder-as-label banned), 1px rule border, 4px radius, focus 2px accent outline offset 2px, error text below ≥4.5:1, helper text in markup.
- Async surfaces ship all four states: skeleton (no spinners), empty (one sentence + CTA), error (what happened + what to do, no "Error:" prefix), success (the content).

## Imperfection budget — exactly 2–3 per page, from this list only, never on nav/forms/legal
1 receipt tilt · 2 one number overhanging its rule by 8–12px · 3 one full-bleed element · 4 uneven rhythm (always on, free) · 5 one hero word at weight 400 among 700 (Bricolage has no italic; never synthesize one) · 6 one 90deg mono marginalia note (desktop) · 7 footer timestamp `built by two people and a solver · last deploy 22:41` · 8 flat-lay cropped to object-position 46%.
Floors imperfection never breaks: contrast (body ≥4.5:1, large ≥3:1, placeholders ≥4.5:1), visible focus, tap targets ≥44px, alignment inside forms/tables, every money number labeled "est. in-store", delivered prices shown with fees next to in-store.

## Motion — CSS transitions + one ~15-line IntersectionObserver, nothing else
- Reveals: opacity 0→1 + translateY(12px)→0, stagger `calc(var(--i) * 80ms)`. Elements visible by default; the observer adds the from-state class only when JS runs. Never scroll listeners, never animation libraries.
- Hero number counts up once (900ms); receipt fades in with its tilt; list rows stagger; prose sections don't animate. Never animate images.
- `prefers-reduced-motion: reduce` → instant opacity. Animate transform/opacity only.

## Copy voice
Person who counted: lowercase-leaning, contractions, zero exclamation points, numbers persuade. Buttons verb-first ≤3 words. Errors = what happened + what to do.
Banned words: unlock, elevate, empower, seamless, effortless, revolutionize, journey, supercharge, next-gen, simply/just/easy, em-dash marketing triplets. No title case.
Match: `we did the math. it's $52.` · `your fridge on friday: empty, on purpose.` · `no card to see your plan.`
No hardcoded budget numbers in copy (wisedinner-truth); example totals come from the solver and are labeled.

## Banned outright
Purple/indigo/blue gradients, glass, blur, glow, mesh, grain overlays at MVP · emoji in UI · decorative icons (Phosphor at one weight only where a glyph is needed) · floating phone mockups, fake dashboards/testimonials/logos/ratings · `rounded-2xl shadow-xl` card soup · everything centered · placeholders (lorem, user@example.com, $0.00, "John D.") · AI-generated receipts, hauls, or meals · arbitrary z-index (use `--z-sticky 10 / --z-modal 50 / --z-toast 60`).

## Pre-flight before any UI job closes (full list in docs/DESIGN.md §12)
Zero banned fonts/words/patterns · accent ≤3 uses · receipt colors confined to receipts · CTAs one line, one label per intent · every number mono + tabular + honestly labeled · imperfection budget 2–3 from the list · rhythm sequence applied · four states on async surfaces · reveals visible-by-default + reduced-motion · contrast audit incl. placeholders · 390px pass (single column, no tilts, taps ≥44px) · Lighthouse run · one-glance test: "template" or "AI" → fix before commit.

## Process
Read docs/DESIGN.md §8 blueprint for the surface you're touching. Match existing pages before inventing; one new pattern per session max; build the plainest version that could work and stop.
