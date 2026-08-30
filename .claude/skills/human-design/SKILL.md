---
name: human-design
description: The WiseDinner visual system and anti-AI-slop rules. ALWAYS load this before creating or editing ANY user-facing UI — pages, components, emails, OG images, copy, empty states, error messages. It defines the receipt aesthetic tokens and the banned patterns that make sites look machine-generated.
---

# Human design — the receipt is the brand

WiseDinner's look is a grocery receipt that got a design degree: paper, ink, tabular numbers, dotted leaders, one accent. Warm, cheap-in-a-proud-way, obsessively legible. It should feel like a person with taste made it on a deadline — not like a template, and not like AI.

## Tokens (define once in Tailwind config / globals, never inline random values)
- `--paper: #FAF8F3` (page background — warm, never pure white)
- `--ink: #191817` (text — never pure black)
- `--ink-soft: #6B675F` (secondary text)
- `--accent: #1D7A46` (savings green — money saved, protein hit; use sparingly)
- `--stamp: #C33D2E` (total-due red — big numbers, the "paid" moments)
- `--rule: #D9D4C8` (hairlines, dotted leaders)
- Radius: 2px on almost everything (receipts aren't rounded); 8px max on buttons.
- Shadows: one only — `0 1px 2px rgba(25,24,23,.08)` — and only on the receipt card itself.
- Type: two fonts total. Headings/UI: a grotesque with character (Space Grotesk or system stack). ALL numbers, prices, totals, the grocery list: monospace with `font-variant-numeric: tabular-nums` (IBM Plex Mono or ui-monospace).
- Receipt furniture is encouraged: dotted leader rows (`ITEM.......$3.49`), `* * *` separators, uppercase letter-spaced micro-labels (`EST. TOTAL`), a perforated edge on the plan card.

## Banned — these are the tells that scream "AI made this"
- Purple/indigo/blue gradients, glassmorphism, blur, glow, mesh backgrounds.
- Emoji anywhere in the UI. Icon sets used decoratively. Three-column icon feature grids.
- Floating phone mockups, fake dashboards, fake testimonials, fake logos, star ratings we didn't earn.
- `rounded-2xl shadow-xl` card soup; every section centered; every section the same 96px rhythm.
- Copy words: unlock, elevate, empower, seamless, effortless, supercharge, revolutionize, "your journey". Marketing em-dash triplets. Exclamation points.
- Placeholder anything: lorem, `user@example.com`, $0.00, "John D.". Every screen shows real solver output with real prices, or it doesn't ship.

## Human imperfection (seasoning, not theme — 2-3 touches per page max)
- Left-align by default; let ONE element per page break the grid (the receipt card sits at a 0.4deg tilt, a total overhangs its column).
- Vary section spacing on purpose: tight where things belong together, generous once for drama. Uniform rhythm reads as generated.
- Microcopy sounds like a person who counted: "we did the math. it's $52.", "your fridge on friday: empty, on purpose.", sentence case, occasional lowercase, no title case anywhere.
- Numbers are the decoration. When in doubt, delete the illustration and make the number bigger.

## Floors (imperfection never breaks these)
Contrast ≥ 4.5:1 for text · visible focus states · 16px minimum body on mobile · tap targets ≥ 44px · the estimated total is always labeled "est. in-store" — never implied as guaranteed · delivered (Instacart) prices always shown WITH fees next to the in-store number, never hidden.

## Process rule
Match existing pages before inventing: read the reveal page's patterns before styling anything new. One new pattern per session max. If a page needs a component the system doesn't have, build the plainest version that could work and stop.
