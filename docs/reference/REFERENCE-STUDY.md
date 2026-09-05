# Reference study — calai.app landing page (2026-09-05)

Study only. Nothing here ships. No copy, assets or logos were copied; `calai/` holds our own
screenshots (fold PNGs + full-page JPEGs at 390×844, 834×1194, 1440×900) and `metrics-*.json`
(structure, geometry, computed styles — captured with the chrome-devtools MCP). Anything the
self-audit borrows from this file is a **layout pattern**, rebuilt with our tokens, our photos
and our voice (LOOP.md).

## 1. The structural pattern

One page, one job: get the phone out of the visitor's pocket. Nine bands on desktop, sixteen on
mobile (the six influencer cards stack), 8.8 screens tall on desktop, 14.9 on a phone.

| # | Band (desktop) | Height | Notes |
|---|---|---|---|
| 0 | Hero | 630px · 70vh | text column 35vw left, two phones 49vw right, proof pill above H1, two store badges directly under the lede |
| 1 | Six portrait "people" cards | 1163px | 2×3 grid, each 402×571, full-bleed photo with a caption strip — pure social proof, no product |
| 2 | Feature list + phone | 1167px | one phone (24vw) beside four stacked feature rows |
| 3 | Three benefit cards | 396px | the only short band; three equal cards with an icon |
| 4 | Single feature spotlight | 1124px | 256px of padding top and bottom around one phone — deliberate breathing room |
| 5 | Testimonials on dark | 857px | the page's one dark band (rgb 30 26 36), five quote cards |
| 6 | FAQ | 944px | six accordions, three text buttons |
| 7 | Ratings + badges | 626px | centered headline, star line, two store badges |
| 8 | Footer | 245px | two store badges again |

Reading order on a phone: proof pill → H1 (5 lines) → lede (4 lines) → App Store badge → Google
Play badge → top 110px of the phone mockups. **Both badges sit above the 844px fold** (y 597 and
663) — the ask arrives before the product picture.

## 2. Why it looks good

- **Proportions.** H1 52px / 65px line-height (1.25), weight 700, one family (Inter) for everything.
  On desktop the H1 is 3 lines in a 510px column; the phone block is 3.06× the text block's area.
  The picture wins; the words are a caption to it.
- **Whitespace as a token.** Spacing snaps to 4/8/12/16/24/32/48/64 inside components and jumps to
  128/160/176/256 between bands. Nothing in between. The 256px band padding around the single
  feature spotlight is what makes one phone feel expensive.
- **One radius language.** Pill (9999) for chips and buttons, 16/24 for cards, 30 for phone-ish
  panels. One shadow on the whole page: `0 1px 20px 1px rgba(228,229,233,.5)` — barely there.
- **Image treatment.** Phones are real device frames at large sizes (700px block on desktop, 100vw on
  mobile), tilted a few degrees, with UI callouts floating outside the bezel so the screen reads at
  a glance. The people band is full-bleed portrait photography with the caption inside the image —
  no cards around photos.
- **Contrast discipline.** Black text on white (21:1) everywhere; one muted secondary (rgb 74 69 82);
  one dark band; the accent blue appears six times in 4,000 nodes. Color is nearly absent, which is
  why the food photos inside the phones carry the page.

## 3. Why it converts to downloads

- **The ask is the badge, and it is everywhere.** Ten store links on the page: header (2, sticky,
  visible on desktop; inside the hamburger on mobile), hero (2), ratings band (2), footer (2), plus
  two hidden duplicates. Desktop always has a badge on screen because the header is sticky.
- **Badge placement.** Directly under the lede, before the phone, full width on mobile (350×49 —
  a real tap target, not a decorative badge). Black badge on white = 21:1; the badge is the highest-
  contrast object above the fold.
- **CTA rhythm.** Ask (hero) → proof (people ×6) → explain (features) → reassure (benefits) → show
  (spotlight) → proof again (testimonials) → objections (FAQ) → ask (ratings + badges) → ask (footer).
  Two asks at the top, two at the bottom, nothing in the middle: the middle is all proof.
- **Above the fold on mobile:** proof pill with three avatar faces, headline, lede, both badges, a
  sliver of phone. Zero navigation (hamburger only). Nothing to do except download.
- **No sticky bottom bar.** Confirmed after scrolling: the only fixed element is the 66px header.
  They rely on the badge frequency, not a persistent bar.
- **Cost of the page:** Inter only, one shadow, no video in the hero — it loads like a document.

## 4. Patterns worth porting — ranked, with the DESIGN-AUDIT ruling

Rule: the audit wins unless the pattern is clearly stronger, and "stronger" has to be argued in
our situation (pre-launch, the ask is an email today and a pre-order badge later). Everything
below is rebuilt with paper/yolk/kale/ink, our Higgsfield photography and our lowercase voice.

| Rank | Pattern | DESIGN-AUDIT today | Ruling |
|---|---|---|---|
| 1 | **Ask before the picture on mobile.** Badges (their ask) sit under the lede, above the phone; both in the fold. | §8: mobile stacked, hero 90vh; today the phone sits under the form and the fold shows form + phone top — same shape, but our hero is taller (h1 84px, 5 lines at 390) and the demo link pushes the phone down. | **Port (audit-compatible).** Keep §8's order (chip → h1 → lede → form → demo link → phone) but tighten the mobile stack so the phone's top edge is inside the fold like theirs (≈110px visible): h1 clamp floor 56px on ≤390, lede ≤3 lines, form + demo link on one 44px row. Audit's hero survives; only the vertical budget changes. |
| 2 | **Full-width single-column CTA on mobile** (350×49 badge, 90vw). | §9.1/§14: yolk button + inline field; on 390 the field and button share a row and the field is squeezed to ~150px. | **Port.** Stack field over button on ≤420, button full width 52px. Stronger because a 90vw tap target is the one thing every download page does and our row-form is the one thing on our fold that looks improvised. Post-launch the same slot holds the badge at 90vw. |
| 3 | **Band padding as a token: 128/160/176/256 between bands, 4–64 inside.** | §10 rhythm sets section heights (70vh/80vh…) but not a padding scale; today py-14/py-16/py-24 vary per section. | **Port.** Adopt two band paddings (96 desktop / 56 mobile, 160 for the one "spotlight" band) and stop per-section values. Audit wins on section *order* and heights; this only regularizes the gaps. |
| 4 | Sticky header keeps a store badge on screen (desktop). | §9.1 already: header CTA → yolk button now, App Store badge post-launch. | **Audit wins (already planned).** Nothing to port; confirm the post-launch header badge is the official black one at 135×41, matching their size. |
| 5 | Proof pill with three avatar faces above the H1. | §8 chip = product facts until real counts ≥100 (External rules: no fake proof). | **Audit wins.** Faces need real, consented users. Keep the fact chip; revisit when the first hundred exist. |
| 6 | Six full-bleed portrait people cards right after the hero. | §11 puts people at slot 7 (before FAQ), real quotes only; §9.8 uses three photo-led benefits. | **Audit wins.** We have no people yet, and a wall of bodies is their category (fitness), not ours (dinner on a budget). Our slot-2 color moment is the five-dinners strip — stronger for us. |
| 7 | One feature spotlight with 256px breathing room. | §9.7 receipt room is our spotlight (kale, 80vh). | **Audit wins**, but borrow the *padding* (rank 3): the receipt room gets the 160 band padding. |
| 8 | Badges repeated at the bottom (ratings band + footer). | §14: email ×4, demo ×3; footer has the store link as text. | **Audit wins** pre-launch (an email ask ×4 is the equivalent). Post-launch, the footer link becomes a badge — already the plan. |
| 9 | Dark testimonial band mid-page. | §9.7 kale room is our one dark moment, and it holds proof (the receipt), not quotes. | **Audit wins.** Same device, better content. |
| 10 | Single family (Inter), 400/500/600/700. | §7 Bricolage display + body pairing. | **Audit wins.** Their page is generic-sans by choice; ours has a voice. |

Not porting, ever: the hero copy shape, the influencer wall, the phone UI callouts (that is their
product), the blue accent, any badge artwork other than Apple's own official files.

## 5. Filed as audit issues (top 3)

1. mobile hero vertical budget — phone top edge inside the 390×844 fold (rank 1)
2. mobile waitlist form stacked, full-width 52px button (rank 2)
3. band padding scale — two values + one spotlight value, no per-section paddings (rank 3)

## 6. Method notes

- chrome-devtools MCP over stdio: `new_page` → `emulate 390x844x2,mobile,touch` (then 834×1194×2,
  1440×900×1) → scroll-walk for lazy content → `take_screenshot` fold + fullPage →
  `evaluate_script` (band outline by greedy non-overlapping tall blocks ≥220px, hero metrics,
  store-link positions, fixed elements re-checked after scrolling 1.5 screens, computed-token
  histograms). Full-page mobile capture at DPR 2 doubled the page; the stored JPEGs were retaken at DPR 1.
- The contrast numbers are WCAG luminance ratios from computed colors; the H1 and badges measure
  21:1 on white.
