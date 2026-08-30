# WISEDINNER DESIGN BIBLE — v1
## Direction B "Ledger Editorial," executed perfectly imperfect

This document supersedes the earlier B directive. `.claude/skills/human-design/SKILL.md` is the summary; this file is the law.

**Sources synthesized:** design-taste-frontend (anti-slop dials, typography discipline, AI-tell bans), minimalist-ui (editorial monochrome system — closest cousin to B), high-end-visual-design (motion curves, spatial rhythm), impeccable (contrast/typography ceilings, the anti-cream ruling, motion safety). Where they conflict, Section 0 rules.

---

## 0. Precedence & conflict rulings

Order when rules collide: **keep-it-simple → wisedinner-truth → THIS FILE → locally installed design plugins → general taste.**

Explicit rulings (already decided — do not relitigate):
1. **Paper background:** impeccable correctly bans warm cream page backgrounds as the 2026 AI default. RULING: the page background is near-neutral off-white (`--bg`, chroma ≈ 0). The warm thermal-paper tone survives ONLY inside receipt artifacts (`--receipt-paper`), where it is diegetic — we are depicting paper, not defaulting to warmth. Site warmth is carried by type, imagery, and accent instead.
2. **No serif anywhere.** design-taste-frontend's serif discipline applies; B is grotesque + mono. Emphasis inside headlines = weight/italic of the same family, never a smuggled serif word.
3. **No pills, no glass, no double-bezel.** high-end-visual-design's rounded-full CTAs, glass navs, and nested-bezel cards are overruled by B's flat editorial language. Its motion curves and whitespace scale are adopted.
4. **No animation libraries.** Motion/GSAP suggestions are overruled by keep-it-simple: CSS transitions + one ~15-line IntersectionObserver utility. That's the entire motion stack.
5. **Light mode only at MVP.** design-taste-frontend's dual-mode default has an explicit exemption for print-emulating editorial — we qualify (the brand is paper and ink). Dark mode goes to the queue Ideas list, not tonight.
6. **Inter is banned** (all four skills agree). Fonts are locked in Section 2.

---

## 1. Design read & dials

Reading this as: consumer landing + product for budget-conscious 18–30 protein seekers, with a ledger-editorial language — restrained page, loud numbers, one warm artifact.
`DESIGN_VARIANCE: 6` · `MOTION_INTENSITY: 4` · `VISUAL_DENSITY: 3` — except inside receipt artifacts and spec-sheet blocks, which run local density 8 (tight mono rows, hairlines, no boxes).

## 2. Color system (OKLCH tokens; hex fallbacks in parens)

```css
:root {
  --bg:            oklch(0.985 0.002 90);   /* #FBFBFA near-neutral page */
  --ink:           oklch(0.215 0.004 80);   /* #191817 — never #000 */
  --ink-soft:      oklch(0.53 0.008 80);    /* #6B675F secondary */
  --rule:          oklch(0.90 0.005 90);    /* #E4E2DC hairlines */
  --accent:        oklch(0.52 0.11 155);    /* #1D7A46 money green */
  --accent-wash:   oklch(0.96 0.02 155);    /* #EDF3EC badge bg (text = accent) */
  --receipt-paper: oklch(0.975 0.008 85);   /* #FAF8F3 — INSIDE receipts only */
  --receipt-total: oklch(0.52 0.16 30);     /* #C33D2E — INSIDE receipts only */
}
```
Rules: **Restrained strategy** — neutrals + one accent covering ≤10% of any viewport, accent used ≤3 times per page, locked sitewide (no second accent ever, no blue links — links are ink, underlined). `--receipt-total` red and `--receipt-paper` never appear outside a receipt artifact. Shadows: exactly one exists in the system — `0 1px 2px oklch(0.215 0.004 80 / 0.08)` — and only on receipt artifacts. Text on `--accent-wash` uses `--accent`; gray-on-color is banned. Contrast floors: body ≥4.5:1, large text ≥3:1, placeholders ≥4.5:1 (audit — muted-gray placeholders are the #1 readability failure).

## 3. Typography

**Families (exactly two, loaded via next/font/google — never a `<link>` tag):**
- **Bricolage Grotesque** — display, headings, UI, body. Variable, characterful, humanist-quirky: the "perfectly imperfect" choice at the font level. Weights 400/500/700.
- **IBM Plex Mono** — every number, price, date, micro-label, the entire receipt, `font-variant-numeric: tabular-nums` always.

Scale (desktop → mobile):
- Display H1: `clamp(2.5rem, 6vw, 5rem)` (hero ceiling 6rem absolute), weight 700, tracking `-0.03em` (floor is `-0.04em` — never tighter, letters must not touch), `line-height 1.08`, `text-wrap: balance`.
- Hero number (the focal): mono 500, `clamp(3.5rem, 9vw, 7rem)`, cents rendered at 50% size in `--ink-soft`.
- H2: 2rem/700, tracking -0.02em. H3: 1.25rem/500.
- Body: 1.0625rem/400, `line-height 1.65`, `max-width: 62ch`, `text-wrap: pretty`, color `--ink` (NOT soft — soft is for genuinely secondary lines only).
- Micro-labels: mono 0.6875rem, uppercase, tracking `0.15em`, `--ink-soft`.
- Italic in display: only with `line-height ≥ 1.1` + bottom padding reserve (descender clipping audit on y/g/j/p/q).

## 4. Space, grid, structure

- Container `max-width: 1200px`, side padding 24px mobile / 48px desktop. Breakpoints: 640/768/1024/1280.
- **Section rhythm is deliberately uneven** — cycle this exact sequence top to bottom: `py-28 → py-20 → py-36 → py-24 → py-32` (repeat). Uniform rhythm reads generated; this sequence reads composed. Mobile: multiply by 0.6.
- Hero uses `min-h-[88dvh]`, never `h-screen`.
- Grid over flex-math; asymmetric splits are `grid-cols-[1.6fr_1fr]` style, never calc-percent flex. All asymmetry collapses to single column below 768px, tilts and overhangs removed.
- Grouping: hairline `border-top: 1px solid var(--rule)` rows and whitespace. **Cards only where elevation means something — which here is only the receipt.** Nested cards are always wrong. No 3-equal-column feature rows anywhere; use numbered hairline rows or a 2-col zig-zag.

## 5. Component specs

**Nav:** text wordmark `wisedinner` (Bricolage 700, lowercase) left; two text links + one CTA right; `border-bottom: 1px solid var(--rule)`; sticky with `background: var(--bg)` at 96% opacity, no blur. Mobile: wordmark + CTA only.
**Primary CTA:** ink fill, `--bg` text, 4px radius, `padding: 12px 20px`, one line always (≤3 words; wrapping = pre-flight fail). Hover: background to `oklch(0.28 0.004 80)`; active: `scale(0.98)`. **Intent lock:** the signup intent is labeled `solve my week` — that exact label everywhere it appears (nav, hero, pricing, footer). One label per intent, page-wide.
**Secondary action:** plain ink text link, 2px underline offset 5px. Never an outlined ghost pill.
**Receipt artifact (the only card):** `background: var(--receipt-paper)`; 0 radius; the system's single shadow; `transform: rotate(-0.5deg)` (alternate `+0.6deg` if two appear on one page); dashed `--rule` separators; dotted leaders (`ITEM····$3.49`); uppercase mono micro-label header; total row in `--receipt-total`; `* * *` footer line; a mono timestamp (`printed 8:42 pm`). Everything inside is mono.
**Spec-sheet rows (pricing + /staples only):** mono 13px, label left in `--ink-soft`, value right in `--ink`, `border-top: 1px solid var(--rule)` per row, no boxes.
**Badges:** `--accent-wash` bg, `--accent` text, mono 11px uppercase, 999px radius (the one sanctioned pill, ≤24px tall).
**Accordion (FAQ):** no containers; `border-bottom` rows; sharp `+`/`−` toggles.
**Forms/quiz inputs:** label ABOVE input always (placeholder-as-label banned), 1px `--rule` border, 4px radius, focus = 2px `--accent` outline offset 2px, error text below in a red passing 4.5:1, helper text present in markup.
**States (every async surface ships all four):** loading = skeleton blocks matching final layout (no spinners); empty = one sentence + one CTA; error = what happened + what to do, no "Error:" prefix; success = the content itself.

## 6. The Perfectly Imperfect system

Imperfection is a budget, not a theme: **exactly 2–3 moves per page, chosen from this sanctioned list, never improvised, never on nav/forms/legal:**
1. Receipt tilt (−0.5deg / +0.6deg) — the signature; counts as one move.
2. One number overhanging its section rule by 8–12px (breaks the line like ink past a margin).
3. One full-bleed element per page while everything else stays contained.
4. The uneven section rhythm (Section 4) — always on; doesn't count against budget.
5. One hero word at weight 400 while the rest sits 700 (same family; Bricolage has no italic on Google Fonts, so weight is the emphasis axis).
6. A mono marginalia note rotated 90deg on desktop ("est. in-store, verified weekly") — max one per page.
7. Footer timestamp: `built by two people and a solver · last deploy 22:41`.
8. Flat-lay image cropped slightly off-center in its frame (object-position 46%).
Floors that imperfection never breaks: contrast ratios, focus visibility, tap targets ≥44px, alignment inside forms and tables, honest labels on all money numbers ("est. in-store").

## 7. Motion (CSS + one observer, nothing else)

- Curve tokens: `--ease-out: cubic-bezier(0.16, 1, 0.3, 1)` (reveals), `--ease-press: cubic-bezier(0.32, 0.72, 0, 1)` (interactions). Durations 200ms hover / 600ms reveals. No linear, no ease-in-out, no bounce.
- Entry reveals: `opacity 0 → 1` + `translateY(12px) → 0`, staggered `calc(var(--i) * 80ms)` within lists, driven by one IntersectionObserver utility (~15 lines). **Reveal safety:** elements are visible by default; the observer ADDS the from-state class only when JS runs — content must never ship hidden awaiting a transition. Never `window.addEventListener('scroll')`.
- Not every section animates identically — hero number counts up once (mono, 900ms, then never again); receipt fades in with its tilt; list rows stagger; plain prose sections don't animate at all.
- Hover: never animate images. Cards/rows respond via background/border only. Buttons: press scale.
- `@media (prefers-reduced-motion: reduce)`: everything becomes instant opacity. Non-negotiable.
- Animate only transform/opacity; `will-change` only while animating; no grain overlays at MVP.

## 8. Page blueprints

**Landing** (in order, rhythm per §4):
1. *Hero* — left-aligned. Eyebrow mono label `GROCERIES, SOLVED LIKE MATH` → H1 `150g of protein a day.` → the giant mono price (user-median example, cents small) → one soft line `your week, estimated in-store. before you shop.` → CTA + text link `free to see your plan`. Ledger receipt artifact offset right, overlapping the hero's bottom rule by ~24px (imperfection move #2). No image.
2. *The math strip* — three stats as an asymmetric `1.6fr 1fr 1fr` row of hairline cells (NOT cards): `protein / dollar`, `items / week`, `waste friday`. Mono values huge, labels micro.
3. *How it works* — 2-col zig-zag: three numbered hairline rows left (`01 tell us your numbers / 02 we solve the week / 03 shop it, cook it, keep the receipt`), the Higgsfield flat-lay right with copy in its negative space, cropped per move #8.
4. *The receipt moment* — centered full receipt artifact (the reveal preview with real solver output), one caption line: `this is the actual product. we just showed it to you.`
5. *The honesty strip* — dual-price explainer: in-store estimate vs delivered-with-fees side by side in mono, two sentences on why we show both. This section is a trust asset; design it plain and proud.
6. *Pricing* — spec-sheet rows per §5, two tiers side by side ≥768px, annual pre-selected with monthly-equivalent framing, `21-day free trial · card required · cancel in two taps` in micro mono. No comparison-checkmark tables.
7. *FAQ* — 5 questions, hairline accordion, answers ≤3 sentences each.
8. *Footer* — wordmark, three links, the timestamp (move #7).

**Quiz (/start):** one question per screen, mono step counter `02 / 06`, giant input, sub-200ms transitions, progress = a thin `--accent` rule growing along the top. Zero decoration.
**Reveal:** the receipt artifact IS the page — full plan receipt center, aisle list below as hairline rows grouped by aisle, sticky bottom bar with `est. in-store total` + CTA. This page gets the most polish minutes of the site.
**/drop:** the universal week as one shareable receipt + email capture, nothing else.

## 9. Copy voice

Person-who-counted: lowercase-leaning, contractions, zero exclamation points, numbers do the persuading. Banned: unlock, elevate, empower, seamless, effortless, revolutionize, journey, supercharge, next-gen, "simply/just/easy", em-dash marketing triplets. Buttons verb-first ≤3 words. Errors: what happened + what to do. Examples to match: `we did the math. it's $52.` · `your fridge on friday: empty, on purpose.` · `no card to see your plan.` · `prices checked against real receipts, weekly.` · `beef's expensive right now, so the solver benched it.`

## 10. Imagery

One photographic asset at MVP: the Higgsfield flat-lay (desaturate slightly toward the palette, warm grain overlay ≤0.03 opacity if needed to blend). Never AI-generate receipts, hauls, or finished meals — those are proof artifacts and must be real. No stock, no illustrations, no icons used decoratively; where a glyph is needed use Phosphor at one locked stroke weight. Interim placeholder if ever needed: `picsum.photos/seed/wisedinner-{context}/…`, replaced before any job closes.

## 11. Performance, a11y, hygiene

LCP <2.5s (hero is text — should be trivial; preload both fonts, `font-display: swap` handled by next/font) · CLS <0.1 (reserve image + receipt dimensions) · INP <200ms. Semantic z-scale only: `--z-sticky:10, --z-modal:50, --z-toast:60`; arbitrary z-values banned. Focus visible on everything interactive; skip-link present; the quiz fully keyboard-operable. Lighthouse before any UI job closes.

## 12. Pre-flight checklist (run before every UI job closes)

[ ] Zero banned fonts/words/patterns from §0/§3/§9 · [ ] accent ≤3 uses and ≤10% coverage · [ ] receipt-paper/red confined to receipts · [ ] every CTA one line, one label per intent · [ ] every number mono + tabular + honestly labeled · [ ] imperfection budget spent (2–3, from the list, none on forms) · [ ] section rhythm sequence applied · [ ] all four states exist on async surfaces · [ ] reveals visible-by-default + reduced-motion path · [ ] contrast audit incl. placeholders · [ ] mobile 390px pass: single column, no tilts, taps ≥44px · [ ] Lighthouse run · [ ] the one-glance test: would a stranger say "template" or "AI"? If either, fix before commit.

## 13. Execution order

1. Ingest this file → rewrite human-design skill → commit.
2. Implement tokens + fonts + observer utility as the layout foundation (one commit).
3. Restyle whatever's already built to spec (one commit, not per-page).
4. Continue queue jobs in order; the reveal page (job 5) gets the deepest pass.
5. Locally installed design plugins: consult for component-level polish ideas only; anything conflicting with §0 precedence loses silently.
