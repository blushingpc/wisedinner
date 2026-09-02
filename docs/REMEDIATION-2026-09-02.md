# WISEDINNER.COM — FULL REMEDIATION SPEC (founder work order, 2026-09-02)

Verbatim from the founder. Every defect below was reproduced twice on the live site — once visually, once by reading computed styles, resolved hrefs, stacking contexts, storage keys and history.length out of the live DOM. The causes stated are measured values, not guesses. Trust them, but verify each one still reproduces in the codebase before you change it.

Status ledger (kept by the loop): see the bottom of this file.

## 1. CONTEXT

Product: WiseDinner — an unreleased iPhone app. You give it a weekly grocery budget and a daily protein target; it returns five dinners, one short shopping list, and a real in-store price estimate. Positioning: not a meal kit, not a tracker, not a 40-item recipe list.

Site's job: convert visitors into App Store pre-orders. Secondary: capture launch-email signups from non-iPhone users, and let people try the solver via a 6-step demo at /start.

Business stakes: the site is pre-launch. The pre-order button is the product's only revenue action right now. Three of the defects below sit directly on that path.

Voice: all-lowercase headlines, dry and specific, numbers over adjectives ("five dinners. one trip. $39.72."). Do not rewrite copy into marketing-speak. Where this spec asks for new copy, match that register.

## 2. STACK

Inferred from build artifacts — verify before assuming: Next.js App Router, Turbopack, deployed on Vercel; React client components; Tailwind CSS v4 (z-(--z-sticky), size-2, oklab()); next/image with full srcset ladders to 3840w.

Existing design tokens — reuse these, do not invent parallel ones: bg (cream page ground ~#FBFAF6) · bg-alt (footer / alternate band) · ink (near-black text) · ink-soft (muted body text) · yolk (yellow CTA) · kale (dark green section #173F2E) · rule (hairline borders) · --z-sticky (was 10 — defect WD-02).

Utility classes in play: .dish-drift, .hero-field, .img-grade (saturate(1.03) contrast(1.02)), .fade-up, .frame-glare, .snap-x.

Routes: /, /start, /plan, /pricing, /faq, /the-math, /drop, /about, /press, /support, /terms, /privacy, plus /thanks and /staples (both Disallowed in robots.txt).

## 3. HARD CONSTRAINTS — DO NOT BREAK THESE

The audit found 21 things already done correctly. Preserve every one:

- robots.txt disallows /plan, /thanks, /staples, /api/ — keep exactly as is.
- sitemap.xml lists all 11 indexable routes — add nothing that shouldn't be indexed.
- 404 returns a real 404 status with noindex. Keep both.
- /faq ships valid FAQPage JSON-LD. Homepage ships Organization. Don't remove either.
- The email form's honeypot (input[name="website"], display:none, aria-hidden="true", tabindex="-1") is correct anti-spam. Leave it.
- The form has a real React onSubmit. Do not "fix" it into a native GET.
- /start inputs are properly labelled with inputmode="numeric" / "decimal" and min="30" max="120" on budget. Keep all of it.
- There is an aria-live="polite" region announcing demo step changes. Keep it.
- The carousel has tabindex="0" and aria-label="the three steps, swipe or scroll sideways". Keep both.
- FAQ uses native <details>/<summary>. Do not replace with a JS accordion.
- Protein steppers are 44×44px with aria-label="less protein" / "more protein" and they work correctly. Do not touch them.
- prefers-reduced-motion is respected — dish-drift and fade-up disable properly. Any new animation must be gated the same way.
- srcset ladders to 3840w and select correctly. Do not downgrade the image pipeline.
- data-placement attributes on CTAs feed analytics. Preserve them through every CTA edit.
- /plan survives a page refresh via sessionStorage. Keep that; extend it (WD-06).
- Zero console errors across all routes. Keep it at zero.
- No horizontal overflow at any width. Keep it that way.
- No positive tabindex anywhere. Don't introduce one.
- Body text contrast is AA. Don't lighten ink-soft.
- The demo solver's arithmetic is correct ($40.24 under a $60 budget, 152g/day vs a 150g target, 12 items). Do not touch solver logic. This spec is presentation and plumbing only.
- All 12 public routes return 200.

Also: do not redesign the site. The visual direction is good and deliberate. Every change below is a defect fix, not a restyle. If you find yourself rewriting a section's layout for taste, stop.

## 4. PHASE 1 — CRITICAL (ship these first, alone, in one PR)

### WD-01 · Every App Store button on the site is dead (~46 instances)

Measured: all 11 public routes carry 4 instances each (6 on /the-math) of href="#app-store" with target="_blank" rel="noopener noreferrer". No element with id="app-store" exists. The fragment resolves against the current URL, so every click opens a new tab that reloads the page the user is already on.

Do: create a single source of truth `lib/links.ts` exporting `APP_STORE_URL = process.env.NEXT_PUBLIC_APP_STORE_URL ?? '/start'` and `APP_STORE_IS_LIVE = Boolean(process.env.NEXT_PUBLIC_APP_STORE_URL)`. Create one `<AppStoreLink>` component every placement uses. It must: use APP_STORE_URL; apply target="_blank" rel="noopener noreferrer" only when APP_STORE_IS_LIVE (a new tab to your own /start is hostile); accept and forward data-placement unchanged; change its own label when the store isn't live: "pre-order on the App Store →" becomes "try the free demo →", because a button promising the App Store that lands on a form is a second bug. Replace all instances. Grep #app-store and drive the count to zero. If the listing is live, set NEXT_PUBLIC_APP_STORE_URL in Vercel for production and preview.

Acceptance: grep -r '#app-store' . returns nothing. Clicking any pre-order control either reaches the App Store or reaches /start in the same tab. Every data-placement value that existed before still exists after.

### WD-02 · Hero food images paint over the sticky header

Measured: header is z-(--z-sticky) and --z-sticky resolves to 10. Both .dish-drift images are also z-10. Equal z-index means paint order falls back to DOM order, and the images come later. Parent .hero-field is overflow: visible. Between scrollY 600–900 at ≥1440px, the chicken bowl covers "how it works" and "pricing" and the parfait glass covers the right end of the yellow CTA. The links are unclickable.

Do: define a real scale in the global stylesheet and document it: --z-base 0 (normal content) · --z-decoration 1 (dish-drift, floating garnish, glare) · --z-raised 10 (cards lifting off the page) · --z-sticky 50 (header, mobile CTA bar, /plan total bar) · --z-modal 100 (reserved). Change .dish-drift (both) from z-10 to z-(--z-decoration). Audit every other z-10 (a -rotate-2 yolk badge <p> at z-10 exists). Assign each to a tier. No two tiers may share a value.

Acceptance: scroll the homepage at 1440px and 1746px from 0 to 1200px in 100px steps. The header's nav links and CTA are fully visible and hit-testable at every step — document.elementFromPoint() over the CTA must return the anchor, not an <img>.

### WD-03 · The mobile sticky pre-order bar never appears

Measured: div.fixed.inset-x-0.bottom-0 holds translate-y-full permanently — still applied at scrollY 8537 of a 9298px document. The trigger that should remove the class never runs. Note: the equivalent bar on /plan does appear.

Do: drive it declaratively with an IntersectionObserver on a sentinel placed immediately after the hero CTA block; bar className = showBar ? 'translate-y-0' : 'translate-y-full'. The final yolk section already carries pb-36 sm:pb-14, which is the clearance for this bar — verify it's still enough once the bar actually renders, and that the bar never covers the last CTA.

Acceptance: at 390px, the bar is off-screen at scrollY 0, slides in after the hero CTA leaves the viewport, and remains reachable at the page bottom without covering the footer's final CTA.

## 5. PHASE 2 — MAJOR

### WD-04 · /start has zero headings, on all six steps

Measured: h1/h2/h3 counts are all 0 at every step. The step counter is <p>01 / 06</p> with no aria-label and no role="progressbar".

Do: `<h1 className="sr-only">Solve my week</h1>`; the counter becomes `<p role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={6} aria-label={`Step ${step} of 6`} className="font-mono text-micro uppercase text-ink-soft">{String(step).padStart(2,'0')} / 06</p>`; then `<h2>{STEP_TITLES[step]}</h2>`. Step titles: 1 weekly grocery budget · 2 protein per day · 3 calories per day · 4 diet · 5 people eating · 6 already in your pantry. Existing <label>s stay exactly as they are. Move focus to the h2 on each step change.

Acceptance: every step has exactly one h1 (visually hidden) and one visible h2. Axe reports no heading-order violations. The progressbar announces "Step 3 of 6".

### WD-05 · Browser back exits the demo and destroys six steps of answers

Measured: history.length never increased across the walkthrough; URL stays /start. Browser back (and iOS edge-swipe) leave the demo and discard every answer. Refresh does the same.

Do: put the step in the URL — `router.push(`/start?step=${next}`, { scroll: false })`. Read the step from useSearchParams() as the single source of truth. In-page "back" becomes router.back(). Answers persist to sessionStorage under wd.answers on every change so a reload at ?step=4 restores prior answers. Guard forward-jumping: landing on ?step=5 without answers for 1–4 redirects to the first incomplete step.

Acceptance: complete steps 1→4, press browser back three times — land on step 1 with all answers intact, still inside the demo. iOS edge-swipe does the same. Reloading at ?step=3 restores answers and stays on step 3.

### WD-06 · A solved plan can't be shared, and the link dumps people into a blank form

Measured: the plan lives only in sessionStorage (wd.answers, wd.plan). Clearing it and reloading /plan silently redirects to /start step 1. Per-tab storage means the same happens on share / new tab / return later.

Do — tier 1 (required, no backend): encode the answers in the URL and re-solve on load: `/plan?p=<base64url(JSON.stringify(answers))>`. On solve, router.replace() to that URL. On load, prefer ?p=; fall back to sessionStorage; only then show the empty state. Keep sessionStorage as the fast path.

Do — tier 1 (required): a real empty state, never a silent redirect: "that plan's gone. plans live in your browser, not our servers. solving a new one takes about 60 seconds. [ solve my week → ]"

Do — tier 2 (recommended, if a backend exists): persist under a short id (/plan/7fk2qd) and render a dynamic OG image of the receipt card. Keep Disallow: /plan in robots.txt either way.

Acceptance: solving produces a URL that, pasted into a private window, renders the same plan. A cold visit to bare /plan shows the empty state, never a silent redirect.

### WD-07 · Placeholder QR code in production

Measured: the hero renders /badges/qr-placeholder.svg under "scan to pre-order", with alt="". It scans to nothing.

Do: generate a real QR encoding a short link you control (e.g. wisedinner.com/ios) that 302s to the App Store. Export as SVG at the same footprint (96×96). Error correction M, quiet zone included, pure black on transparent. alt="QR code — scan to open the WiseDinner pre-order page". Print the short URL as text beneath it in the mono caption style. Delete qr-placeholder.svg. If the App Store listing isn't live: point the short link at /start and change the caption to "scan to try the demo". Do not ship a QR that goes nowhere.

### WD-08 · No mobile navigation, and no menu button either

Measured: below sm, "how it works", "pricing" and "faq" compute to 0px wide; no hamburger. Reaching /pricing, /faq, /the-math or /drop requires scrolling 9,298px to the footer.

Do — preferred: don't hide them, shrink them. "how it works" → "how"; keep "pricing" and "faq"; row in text-sm with tighter gaps; the CTA already collapses to "pre-order →" at this width. Verify at 320px too — if tight, drop to "how · pricing · faq" in mono micro-type. Alternative: a <details>-based disclosure, full-width panel, focus trapped while open, closes on route change and Escape.

Acceptance: at 320px and 390px, all primary nav destinations are reachable from the header without scrolling.

### WD-09 · Page content ghosts through the translucent chrome

Measured: header and /plan bottom bar are 96% opaque with backdrop-filter: none; the homepage mobile bar declares backdrop-blur. Three pieces of chrome, three treatments.

Do: one shared `.chrome` token set, applied to all three. A — frosted: `background: color-mix(in oklab, var(--color-bg) 72%, transparent); backdrop-filter: blur(12px) saturate(1.4);` with `@supports not (backdrop-filter: blur(1px)) { background: var(--color-bg) }`. B — solid: `background: var(--color-bg)`. Recommendation: B for the header, A for the /plan total bar; or B for all three.

Acceptance: at every scroll position on / and /plan, no page text is legible through any chrome surface.

### WD-10 · The "how it works" section is duplicated in the DOM

Measured: homepage only. Every step heading exists twice, one set at zero width. Desktop and mobile are two separate copies. A 1067×1334 image downloads and renders at 0×0.

Do: collapse to one tree — switch layout, not content: `<ul className="-mx-6 flex snap-x snap-mandatory gap-4 overflow-x-auto px-6 sm:mx-0 sm:grid sm:grid-cols-3 sm:gap-8 sm:overflow-visible sm:px-0">`; each <li> keeps w-[88%] shrink-0 snap-center on mobile and clears them at sm:. Keep tabindex="0" and aria-label on the scroller — but apply them only while it actually scrolls. Fallback if the branches cannot merge: aria-hidden="true" on the hidden one and stop its images loading.

Acceptance: each of the three step headings appears exactly once in the DOM. No image renders at 0×0.

### WD-11 · The 404 page wears the homepage's title

Do: in app/not-found.tsx export metadata { title: 'Page not found — WiseDinner', robots: { index: false, follow: true } }. Change only the title.

## 6. PHASE 3 — MINOR

### WD-12 · The full-width food bands crop badly
Not a resolution problem — mis-framing. five-dinners source 1746×582 (3.00) rendered at 2.61 (~13% discarded); second band 1746×974 (1.79) rendered at 1.99. object-fit: cover, object-position 50% 50%.
Do — pick one per band: best, container aspect-ratio matches the source (3/1, 16/9); or re-export at the displayed ratio; or steer the crop (object-position: 50% 40%). Responsive art direction recommended: <picture> with a 2:1 or 4:3 mobile crop keeping 2–3 bowls in frame, the 3:1 wide shot at md:.

### WD-13 · The focus ring is nearly invisible
Controls set outline-style: none and rely on a 1.5px inset box-shadow. Do: `:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; border-radius: inherit; }`.

### WD-14 · Carousel dots are decorative, not controls
Do: `<button type="button" aria-label={`Go to step ${i+1}`} aria-current={i===active?'true':undefined} onClick={() => scrollToSlide(i)} className="grid size-11 place-items-center"><span className={`size-2 rounded-full ${i===active?'bg-ink':'bg-rule'}`} /></button>` — 44px target wraps the 8px dot.

### WD-15 · Homepage FAQ has no FAQPage schema
Reuse the existing JSON-LD builder with the homepage's four-question subset.

### WD-16 · No SoftwareApplication structured data
Add SoftwareApplication (applicationCategory "LifestyleApplication", operatingSystem "iOS", offers reflecting the real /pricing tiers — verify values against the page). Add Product/Offer markup to /pricing for the same two tiers. Do not add aggregateRating.

### WD-17 · Four meta descriptions are too thin
Lengths: /press 47 · /terms 53 · /start 63 · /privacy 63. Rewrite to 120–155 chars in the site's voice. Example for /start: "solve a week in 60 seconds. tell us your budget and protein target — get five dinners, one short list, and a real in-store total. no account, no card."

### WD-18 · Alt text inconsistent on content-bearing images
alt="" only for the .dish-drift garnish images. Everything else gets a description (second full-width band, QR).

### WD-19 · Payload heavier than the page needs
118KB HTML on /, ~180KB compressed JS across eight bundles, 60KB fonts. After Phases 1 and 2; measure before and after.

### WD-20 · No theme-color
`<meta name="theme-color" content="#FBFAF6">` — the exact cream from the bg token.

## 7. IMAGE WORK
Match the existing photography direction exactly: soft natural daylight, linen or pale-wood surfaces, matte ceramic bowls, top-down or slight-angle, muted warm palette, no harsh shadows, no props, no text baked in; shoot/generate slightly flat (.img-grade applies on top).
1. Real QR code (required) — WD-07. Vector SVG.
2. Mobile crops of the two full-width bands (recommended, WD-12): Band A 2:1 crop holding 2–3 bowls with forks, rims visible, 1200×600 and 1600×800; Band B 4:3 crop of the same scene family. Wire as <picture>.
3. Open Graph image (verify before creating): /og must render a real 1200×630 — if thin, build it as a dynamic OG route showing the receipt card motif: cream ground, mono type, the week's total, "five dinners. one trip." Not the wordmark alone on a gradient.
Constraints: no visible text, no hands holding phones, no branded packaging, no restaurant plating.

## 8. TESTING PROTOCOL
Automated: `npm run build && npm run lint`; `npx @axe-core/cli` on /, /start, /plan, /pricing; `npx lighthouse` desktop + mobile on /; `grep -rn '#app-store' .` must return nothing. Loop probe: `node scripts/wd-check.ts`.
Manual desktop 1440: scroll 0→1200 in 100px steps, header nav + CTA clickable (WD-02); elementFromPoint over the CTA returns the anchor; tab through — every stop has a visible ring (WD-13).
Manual mobile 390 + 320: all nav destinations reachable from the header (WD-08); sticky bar appears after the hero and never covers the final CTA (WD-03); no horizontal scroll; nothing legible through the header while scrolling (WD-09).
Manual demo (real iPhone if possible): each step has an h2 and announces "Step N of 6" (WD-04); browser back and edge-swipe step backwards with answers intact (WD-05); reload mid-flow — answers survive; solve, copy URL, open in a private window — same plan (WD-06); bare /plan cold — empty state (WD-06).
Regression vs §3: solver still $40.24 / 152 g / 12 items for budget 60, protein 150, 1 person, no diet, default pantry; console clean on all 12 routes; /faq JSON-LD validates.

## 9. ACCEPTANCE CRITERIA
Phase 1: zero '#app-store'; every CTA reaches a real destination · all data-placement preserved · header clickable at every scroll position at 1440 + 1746 · documented z scale, no two tiers share a value · mobile sticky bar appears and never occludes the final CTA.
Phase 2: every /start step has one sr-only h1 + one visible h2; progressbar announces · back / swipe-back step backwards with answers intact · /plan URLs shareable; cold /plan shows a written empty state · real QR with visible fallback URL; qr-placeholder.svg deleted · all nav destinations reachable from the header at 320px · no page text legible through any chrome surface · each how-it-works heading appears once · 404 titled "Page not found — WiseDinner", still noindex, still 404.
Phase 3: neither band discards >2% of its source · visible focus ring on every interactive element on every background · carousel dots are buttons with 44px targets + aria-current · homepage emits FAQPage + SoftwareApplication; /pricing emits Offer · all meta descriptions 120–155 chars · alt="" only on .dish-drift · theme-color present.
Global regression: all 21 §3 items hold · Lighthouse a11y ≥95 mobile + desktop · zero console errors on 12 routes · no horizontal overflow at 320 / 390 / 768 / 1440 / 1746.

## 10. WORKING RULES
Three PRs, in order: Phase 1 alone first. Smallest reliable change; no restyle; every change traces to a numbered defect. Verify before fixing; report discrepancies rather than fixing symptoms. If a fix reveals a deeper problem, stop and report. Ask before: changing solver logic, pricing figures, adding a backend/database, adding a third-party script, changing anything in §3. Report at the end of each phase: what changed per defect ID; what you verified and how; anything found that isn't in this document.

Audit basis: live-site sweep of wisedinner.com, 2 September 2026 — 12 routes, viewports 390 / 422 / 1440 / 1746px, full six-step demo walkthrough.

---

## Status ledger (loop-maintained)

| id | phase | status | branch / commit | notes |
|----|-------|--------|-----------------|-------|
| WD-01 | 1 | fixed | wd-phase-1 | single source was content/site.ts `appStoreUrl: "#app-store"` rendered by 4 components (29 anchors across 12 routes locally, not 46). |
| WD-02 | 1 | fixed | wd-phase-1 | reproduces only under prefers-reduced-motion: with motion on, `.hero-field`'s fade-up leaves `transform: matrix(1,0,0,1,0,0)` which is an accidental stacking context that kept the dishes under the header. |
| WD-03 | 1 | fixed | wd-phase-1 | discrepancy: on main the bar did appear between ~half-page and the footer (scroll listener); it never appeared right after the hero, which is what the acceptance line asks for. IO root extends 100000px below so an instant jump can't skip a state (reviewer-found, 320×454). Footer gets 9rem bottom clearance only on the page that renders the sentinel (`main:has(#hero-cta-end) + footer`). |

| WD-04 | 2 | fixed | wd-phase-2 | sr-only h1 "Solve my week", role=progressbar counter ("Step N of 6"), one visible h2 per step (the spec's titles equal the existing labels/legends, so steps read title + label — spec-literal). Focus moves to the h2 on step change; first paint still focuses the field so Enter submits. scripts/journey.ts now clicks next/solve instead of pressing Enter. |
| WD-05 | 2 | fixed | wd-phase-2 | `?step=1…6` owns the step; back = router.back(); furthest-visited step is saved with the answers, forward jumps past it redirect to it. A persist-before-hydrate race (StrictMode double mount clobbered the saved step) was found by the probe and fixed with a hydrated gate. |
| WD-06 | 2 | tier 1 fixed | wd-phase-2 | `/plan?p=<base64url(answers + seed)>`; the quiz lands there directly, regenerate rewrites it; a fresh context re-solves via /api/solve (deterministic). Written empty + error states, no redirect. Tier 2 (short ids + dynamic OG) not built — needs a backend; founder decision. The App Store badge now renders only with a plan (placement `plan` survives). |
| WD-07 | 2 | fixed | wd-phase-2 | public/badges/qr-ios.svg (v3, EC M, 4-module quiet zone, transparent, decode-verified with jsQR) encodes https://www.wisedinner.com/ios; next.config.ts redirects /ios → NEXT_PUBLIC_APP_STORE_URL or /start (307). Caption "scan to try the demo" + `wisedinner.com/ios` until live. Placeholder deleted. |
| WD-08 | 2 | fixed (deviates) | wd-phase-2 | measured at 320px: wordmark 115px + header CTA 161px leave 12px, so the links cannot share the row at any type size. Instead: the CTA loses "free" below md ("try the demo →") and the three links sit on a second row (44px taps). Header 71px → 107px on phones. |
| WD-09 | 2 | fixed | wd-phase-2 | option B everywhere: `.chrome { background: var(--color-bg) }` on header, homepage mobile bar, /plan total bar. |
| WD-10 | 2 | fixed | wd-phase-2 | one step list serves both layouts (headings once); per-slide phones `lg:hidden`, pinned phone `hidden lg:block`; tabindex/aria-label only while the list scrolls (matchMedia). The 0×0 image was the S2 band's other crop (both were `priority`): now one `<picture>` via getImageProps with media-scoped preloads — phones fetch only A2-mobile, everything else only A2. |
| WD-11 | 2 | fixed | wd-phase-2 | metadata title only; Next 16.3.3 already emits noindex + 404 for not-found (verified in resolve-metadata.js: not-found metadata merges last over the layout). |

| WD-12 | 3 | fixed / partial | wd-phase-3 | band A (S2): the `lg:min-h-[60vh]` that forced object-cover is gone, so the 3:1 source renders whole at every width ≥ sm (0.0% discarded at 1440); the phone crop (A2-mobile, 4:5) already rendered whole (0.1%). band B is A3 behind the kale receipt room: a `fill` background at 30% under text — cropping is inherent to a background layer, so it is steered (`object-position: 50% 40%`) rather than fitted; making it discard ≤2% would mean giving that section a fixed aspect ratio, which is a redesign. Founder call. |
| WD-13 | 3 | fixed (deviates) | wd-phase-3 | the spec's `currentColor` measured 1.00:1 on the inverted controls (yolk-on-ink final CTA over the yolk section, paper-on-kale demo button over paper, the skip link) because the ring paints outside the control on the surrounding ground. Shipped: `outline: 2px solid var(--color-ink); outline-offset: 2px`, and `.bg-kale :focus-visible { outline-color: var(--color-bg) }` for the one dark ground. `border-radius: inherit` dropped — it would override each control's own radius. The sr-only radios/checkboxes on /start steps 5–6 had no indicator at all; their tiles now ring via `has-[:focus-visible]`. The step h2's `focus:outline-none` was inert (layered) and is gone: keyboard users see the ring land on the title, mouse users don't. |
| WD-14 | 3 | fixed | wd-phase-3 | dots are `<button>`s, 44×44 targets around the 8px dot, `aria-label="go to step N: title"`, `aria-current` on the active one, tap scrolls the carousel to that slide (smooth; instant under reduced motion). |
| WD-15 | 3 | fixed | wd-phase-3 | `faqLd()` in app/copy.ts; /faq and the homepage (first four questions) both emit FAQPage. |
| WD-16 | 3 | fixed | wd-phase-3 | pricing tiers moved to content/site.ts (`site.pricing.tiers`); the /pricing cards, both JSON-LD blocks, the FAQ answers (q2, q8), the /pricing description and the OG card all read them — change a price there and nowhere else. Homepage: SoftwareApplication (LifestyleApplication, iOS) with four Offers; /pricing: Product with the same four Offers (protein plan / autopilot × yearly / monthly), `availability: PreOrder` because nothing is for sale yet. No aggregateRating. validator.schema.org: 0 errors on /, /pricing, /faq; Google's Rich Results Test: Software App + Product snippet valid (Merchant listing wants `image` — n/a, nothing for sale). Review caught a `$` dropped by the first formatter — fixed, and the probe now asserts the symbol. Note: Google stopped showing FAQ rich results for sites like this in 2023, so WD-15 is correctness, not a rich result. |
| WD-17 | 3 | fixed (wider) | wd-phase-3 | the §9 acceptance line is global ("all meta descriptions 120–155"), so all eleven indexable routes were rewritten, not just the four thin ones. Each claim is on the page it describes, with one founder-owned exception: /start carries the spec's example verbatim ("60 seconds", "no account, no card", "a real in-store total"), none of which /start itself says — keep or align, your call. |
| WD-18 | 3 | fixed | wd-phase-3 | A3 got a real description; the two `.dish-drift` garnish images are `alt=""` per the spec's rule (the phone screen beside them names the dishes). The wordmark's 20px mark keeps `alt=""` + `aria-hidden` — it sits inside the link whose text is the name. |
| WD-19 | 3 | open — measured, not attempted | wd-phase-3 | founder decision. Baseline on the phase-2 preview (390 + 1440): HTML 118 KB · 12 scripts 512 KB decoded (the 224 KB and 152 KB chunks are the framework runtime + the app bundle) · CSS 53 KB · fonts 60 KB · images 54 KB / 181 KB. The interactive surfaces (hero email disclosure, walkthrough carousel, inline demo, sticky bar, reveal observer) are already isolated client leaves, so the cheap server-component win the spec imagined is not there; the next lever is the 118 KB HTML (RSC payload, srcset ladders, JSON-LD), which is a measured refactor, not a fix. |
| WD-20 | 3 | fixed | wd-phase-3 | `viewport.themeColor = "#fbfaf6"` in app/layout.tsx. |
| §7.3 | 3 | verified | — | /og returns a real composed 1200×630 PNG (A2 crop + headline + shelf tag) — not a placeholder. It weighs ~800 KB; a jpeg/quality pass would help share previews but is outside this spec. |

Phase 2 review round (2026-09-02, after the adversarial review): `html { scroll-padding-top }` so `/#how`, `#early-access` and the legal anchors land below the taller phone header (WD-08 side effect — the h2 was 100% covered at 320/390); S2 preloads emitted with react-dom `preload()` (React 19 only hoists a `<link>` with an href; `preload()` carries `media`, so each viewport gets exactly one head preload); `reveal_view` fires once per visit again (the component's own `router.replace` was re-running the load effect — regenerate and cached bare `/plan` had double-counted); a present-but-broken `?p=` is a dead link (empty state) instead of silently showing the tab's cached week; `decodeAnswers` range-checks so an out-of-range link is "gone", a 429 from the solver's rate limiter says "busy, wait a minute" instead of "reload", 5xx/network keep the error copy; the storage write in `show()` is guarded; first-paint focus keyed on the step (StrictMode-safe); in-page back only pops history the quiz pushed, else steps to N−1.

Phase 1 side decisions (report to founder): not-live mode hides the ghost "try the free demo →" twin next to the relabelled badge (hero + final CTA), hides hardcoded pre-order captions that sat directly under a relabelled control (/plan line, mobile-bar sub-line → "no account · takes a minute", hero perk), and leaves all content/site.ts copy untouched. /plan and /the-math show "try the free demo →" while not live because their `data-placement` values must survive. `NEXT_PUBLIC_APP_STORE_URL` is not set anywhere yet — set it in Vercel (production + preview) the moment the listing exists and every control flips to the App Store without a code change. The literal dead fragment still appears in this document (the spec text); it is gone from app/, lib/, content/, public/, scripts/.
