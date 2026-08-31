# WISEDINNER.COM — FULL VISUAL DESIGN AUDIT & REDESIGN BRIEF

Audited live in Chrome on 31 Aug 2026 at 1,547px and 1,054px viewports. Fonts, colors, section heights, image sources and CTA targets were read from the DOM. The demo was walked end-to-end (/start → six steps → /plan). /faq, /pricing, /drop, /about, /press and /og were reviewed. Colors are approximated from computed `lab()` values. Everything marked PROPOSED is a recommendation, not a measurement.

Stack (INFERRED from class names and asset paths): Next.js + Tailwind (`bg-bg-alt`, `lg:py-24`, `/_next/image`), fonts loaded via next/font (Bricolage Grotesque, IBM Plex Mono).

---

## 0. THE VERDICT

**You built a receipt. People buy dinner.**

Your criticisms are accurate, and the cause is deeper than a missing color. The site is a faithful execution of a brand concept that is literally a receipt — mono type, line-item prices, kcal counts, `* * *` dividers. It is tidy, consistent and clearly cared for. But it documents the solver instead of selling the evening.

Today it reads as **"a website an engineer built for their app"**, not a consumer startup with a polished product. The fix is not decoration; it is changing *what the page shows first*: food and ease before proof and math.

Headline numbers:

- **54–70** numeric values on the homepage (18 dollar amounts, kcal counts in the hero, three receipts — two of them identical)
- **4** photos on the entire site — the best one is shown at 64×64px inside a phone
- **2,205px** = height of "how it works" (38% of the page) to say three sentences
- **0** social proof, video, illustration or App Store presence — and a 6%-opacity phone shadow you cannot see

---

## 1. DIAGNOSIS — THE CONCEPT IS THE PROBLEM, NOT THE POLISH

Every one of your concerns checks out, and they all trace to one decision. The visual language of wisedinner.com is "paperwork": IBM Plex Mono for every label, cream receipt cards with dotted leaders, dollar totals in brick red, calorie counts per day, a date stamp ("prices as of 2026-08-30"), even a methodology disclaimer. The press page says the mark "stays single-colour, ink on white or white on ink." Color was excluded on purpose. The site is not under-designed — it is designed to look like a ledger, and it succeeds.

That is the wrong first impression for a consumer app, because the product's promise is emotional before it is numerical: *I will know what to cook, I will eat well, and I will not feel poor doing it.* The receipt is the PROOF of that promise. Proof belongs after desire, not before it. Right now the first viewport contains two receipts and zero food larger than a thumbnail.

> The website sells the benefit. The app provides the data. Today the website provides the data.

### What is actually good (and should survive)

- **The headline.** "Hit your protein. Spend way less." is the best thing on the page: two benefits, six words, no jargon. Keep it.
- **Bricolage Grotesque.** A characterful display face with real personality. Keep it; use it bigger and bolder.
- **The photography you already own.** The chicken-thigh bowl (steam, linen, window light) is editorial-grade. It is currently 64 pixels wide inside a phone. The meal-prep containers photo is also good.
- **The receipt as a motif.** It is the one distinctive idea on the site. It should become a single dramatic moment, not the wallpaper.
- **The working demo.** An interactive "solve my week" in 60 seconds is a stronger conversion asset than most launched apps have. It is hidden behind an underlined text link.
- **The lowercase voice** and lines like "empty fridge, on purpose" and "the receipt is the proof." The copy has a point of view. It just needs to be shorter and warmer.

### Real startup or "a website for an app"?

Today: **a website someone built for an app.** Signals a visitor picks up in seconds: CSS phone frames with a shadow so faint (6% opacity) that they read as wireframes; literal placeholder text `$[your number]` in a headline and inside a phone screen; three receipts before the visitor has scrolled once; a footer that says "built by a tiny team and a solver"; no users, quotes, press, or store badge; an OG/social image that appears to render in fallback Arial, with a receipt on it. None of these is fatal alone. Together they say *side project* — which is a problem when the pricing page asks for $59/yr.

**The strategic reframe.** Your positioning is "protein on a budget." The risk of that positioning is that the brand itself looks cheap. Budget brands that win — Trader Joe's, IKEA, Wise, Monzo — sell thrift as smartness and abundance, with warmth and color. The redesign should move the story from "a receipt for $39.72" to **"the fullest fridge you've ever had for $40."** Same facts, opposite feeling.

**Caveat.** The Cal AI screenshots did not arrive as attachments, so the reference analysis uses the eighteen patterns listed in the brief plus general knowledge of that landing page. Everything about wisedinner.com was measured directly.

---

## 2. EVIDENCE — WHAT THE PAGE IS MADE OF

Measured at a 1,547px viewport. Numbers in brackets are the tablet layout at 1,054px, where the second hero phone is hidden.

| Section (top → bottom) | Height | Background | Words | Numbers | Media |
|---|---|---|---|---|---|
| Sticky header — mark, "wisedinner", how it works / faq, black "get early access" | 77px | white 96% | — | 0 | 20px SVG mark |
| Hero — eyebrow, H1, 27-word lede, 2 CTAs, micro-label, two CSS phones (one rotated −3°) showing meal rows and two receipts | 992px | white | 108 | ≈27 [16] | 3 thumbnails at 64px |
| "one list. five days. this is what $[your number] looks like." — containers photo + 3 stats + disclaimer | 675px | off-white #FBFBFA | 38 | 4 | 1 photo, 958×534 |
| "how it works" — 3 alternating rows: H3 + one line + a phone scaled to 256–288px; step 01 phone is more than half empty and shows "[your target]" | 2,205px | white | 154 | 25 | 3 CSS phones, 2 thumbnails |
| "see your week solved in 60 seconds." + black "try the demo" | 244px | pale mint ≈#E9F3EA | 10 | 1 | none |
| Price vs delivery — "$39.72" vs "~$50–54 · est. +25–37%" + 41-word paragraph about delivery-app markups | 414px | white | 56 | 7 | none |
| "questions" — 4 accordions + "all questions →" | 573px | off-white | 26 | 0 | none |
| "your protein. your budget. solved." — email field + white button | 425px | ink ≈#1A1917 | 18 | 0 | none |
| Footer — wordmark, 9 links, "built by a tiny team and a solver" | 191px | off-white | — | 0 | mark |
| **Total** | **5,796px** | 7 light / 1 tint / 1 dark | **447** | **≈70 [54]** | **4 photos, 0 video** |

### Design system as shipped

| Layer | What is there | Read |
|---|---|---|
| Display / body type | Bricolage Grotesque — H1 57px/700/−1.4px, H2 32px/700, H3 24px/500, body 17px, lede 20px | Good face, undersized headline for a consumer hero (reference pages run 64–88px). |
| Utility type | IBM Plex Mono — labels 11px uppercase +1.65px tracking; receipt lines 13px; stats ≈48px; phone inputs 36px | Mono on every label and every number is the single biggest source of the "terminal" feeling. |
| Palette | ink ≈#1A1917 · grey ≈#6B6864 · white · off-white #FBFBFA · rule #E9E7E2 · brick red ≈#B5351F (4 uses) · forest green ≈#2B7A4B (4 uses) · mint ≈#E9F3EA (1 section) | Roughly 95% monochrome. The two accents are used semantically (money = red, protein = green), which is smart — but they are too small to register as a brand. |
| Imagery | /img/meal-chicken-bowl.jpg · meal-yogurt-parfait.jpg · meal-bean-bowl.jpg (all shown at 51–64px) · week-containers.jpg (897px wide) | Three excellent food photos are used as icons. The containers photo carries a slight grade (saturate .96), which is fine. |
| Phone mockups | 4 × CSS div: 320px wide, 10px ink border, 44px radius, shadow 0 8px 30px at 6% opacity; scaled 0.8–0.9× (256–288px) in how-it-works | Effectively flat — the shadow is invisible — and no device details beyond a pill. Screens are cream receipts, not app UI. |
| Motion | 0 video · 0 animation libraries · 11 elements with hover transitions | Nothing moves. Nothing invites. |
| CTAs | "get early access" → email form (header, hero, dark section) · "try the demo" → /start (hero text link, mint band button) · "all questions →" | The primary action is a waitlist, not a download — the page must sell harder because the reward is delayed. |
| Copy conventions | everything lowercase except the H1 · eyebrow "PROTEIN, SOLVED LIKE MATH" · "$[your number]" literal placeholders · "prices as of 2026-08-30" ×2 · methodology disclaimer | The voice is distinctive; the placeholders and disclaimers read unfinished. |
| Demo (/start → /plan) | 6-step bare form (budget slider, protein, calorie band, diet, people, pantry) → receipt + day-by-day list with ingredient fractions ("old fashioned oats 1/12 · peanut butter 1/6 · 30 g") | The product works and is fast. The result page is a wall of mono text; the food never appears. |
| Social image | /og — receipt layout, appears to render in a fallback sans (Arial/Helvetica) rather than Bricolage, lowercase "hit your protein." | The first thing anyone sees in a shared link is a receipt in the wrong font. |

---

## 3. AVERAGE-PERSON TEST (3–5 seconds, first viewport)

| Question | Answer | Why |
|---|---|---|
| What is this? | Mostly yes | "Hit your protein. Spend way less." lands. But the eyebrow says "PROTEIN, SOLVED LIKE MATH" and the phones show receipts, so the guess is "a budgeting tool for lifters," not "an app that tells me what to cook." |
| What does it do? | No | You have to read the 27-word paragraph to learn it makes a meal plan and a grocery list. The picture does not say it — there is no meal larger than a thumbnail in the hero. |
| Why should I care? | Half | "Spend way less" cares about my money. Nothing in the first viewport cares about my evening — no plate, no kitchen, no "never think about dinner again." |
| Does this look good? | Tidy, not desirable | Clean spacing and a good typeface, but flat mockups, grey text on white, and cream receipts. It looks like a well-made invoice. |
| Would I trust this? | Not yet | No people, no user numbers, no press, "app coming soon," "tiny team" in the footer, placeholder brackets in a headline. |
| Would I download this? | Can't | It is a waitlist. Which is fine pre-launch — but then the demo must be the star, and it is a text link. |
| Worth paying for? | Doesn't look it | The visible menu is canned chicken, canned tuna and $1.01 tomatoes. Frugal reads as austere. Nothing on the page looks like a $59/yr product. |
| Feels like a real company? | No | See section 1. |

Journey today: **LAND → READ → SCROLL (a lot) → READ RECEIPTS → MAYBE JOIN A WAITLIST.**
Target: **LAND → SEE DINNER → UNDERSTAND IN ONE LINE → WANT → TRY IT IN 60s → TRUST → JOIN / DOWNLOAD.**

---

## 4. WHAT THE REFERENCE TEACHES (AND HOW WE DO IT OUR WAY)

Cal AI is not a template; it is proof of eight principles. Each has a wisedinner-native translation using our motifs (the receipt, the shelf price, the empty fridge), not theirs.

| Principle | Their version | Our version |
|---|---|---|
| One idea per viewport | Headline + one phone + one badge. Nothing else. | Headline + one big phone with five dinners + email field. The second phone, the receipt, the disclaimer and the micro-label all leave the hero. |
| The product is the picture | Phones at 380–480px with real depth; the UI explains the feature. | One phone at 420px+ in the hero, one pinned phone in the walkthrough. Screens show meal cards with photos, not receipts. |
| Food supplies the color | Plates carry saturation; the UI stays neutral. | Cut-out dishes float around the phone; a full-bleed "five dinners" table shot is section two. UI stays ink-on-paper with one yolk accent. |
| Copy as captions | Small label over a large headline; a sentence at most. | Lede ≤16 words. Every section headline ≤6 words. The 41-word delivery paragraph goes. |
| The page changes shape every scroll | Split hero → full-bleed → three simple benefits → dark showcase → testimonials → CTA. | Paper hero → photo strip → pinned walkthrough → dark green receipt → inline demo → photo-led benefits → people → CTA. No two adjacent sections share a layout. |
| Light/dark cadence | A dark-mode phone section breaks the white. | The receipt gets a deep-green room with a spotlight — the one dark moment, and it is *about* proof. |
| Proof through people, not data | "Trusted by 5M+", store ratings, faces. | Pre-launch: waitlist count (if honest), three beta quotes, the founder's three promises. Never fake it. |
| The CTA is a verb, repeated at emotional peaks | "Download" after every proof point. | "get early access" in yolk after the hero, after the demo, at the end; "try the demo" as the secondary everywhere. |

Deliberately NOT borrowed: pure-white minimalism (our ground is warm paper), their green (ours is a deep kale used in one section), their scan-a-photo gimmick. Our signature interaction is the receipt printing itself.

---

## 5. NUMBERS AUDIT — EVERY INSTANCE, WITH A VERDICT

Rule for the marketing site: **at most six numbers above the FAQ**, each one a benefit a stranger can feel — a price, a protein target, "five days," "one list," "60 seconds." Never a calorie. Never a date stamp. Never a fraction.

| Where | Instance | Verdict | Do this instead |
|---|---|---|---|
| Hero eyebrow | `PROTEIN, SOLVED LIKE MATH` | REMOVE | Delete the eyebrow, or "high-protein groceries on a real budget." "Math" is the wrong first word for an appetite. |
| Hero phone 1, meal rows | `87g · $3.12` / `46g · $2.03` | SIMPLIFY | Meal name + photo + one number max (the price). Grams live in the app. |
| Hero phone 1, receipt | 4 line prices · $39.72 · 153 g · 0 · prices as of 2026-08-30 | MOVE | One receipt on the whole page, in the proof section. The hero phone shows the week as food. |
| Hero phone 2 (desktop) | `MON 157 G · 2341 KCAL` … ×5, plus the full 12-item list | REMOVE | Delete the second phone. Calories per day are precisely the "nutrition dashboard" feeling, and kcal is not in the value proposition. |
| Hero micro-label | `FREE DEMO BELOW · APP COMING SOON` | CHANGE | "iOS · 2026 · free web demo" as a quiet pill next to the CTAs. |
| Section 2 headline | `this is what $[your number] looks like.` | REMOVE | Literal brackets read as an unfinished template. Use a real number: "five dinners. one trip. $39.72." |
| Section 2 stats | `153g · $39.72 · 0 lb` | SIMPLIFY | One hero number — the price — as a yolk shelf-tag on the food photo. "150g protein a day" as a caption. "0 lb waste" becomes a sentence: "nothing rots on thursday." |
| Section 2 disclaimer | `NUMBERS FROM A REAL SOLVER RUN AT 2026 AVERAGE PRICES — METHODOLOGY IN FAQ` | REMOVE | Belongs in the FAQ only. A disclaimer under a headline is a confidence leak. |
| How it works, step 01 phone | `01 / 06 · $[your number] · [your target]` | REPLACE WITH VISUAL | Show real inputs — "$60" and "150 g" — filled in, slider mid-drag. Drop the step counter; it is demo chrome. |
| How it works, step 02 | `~12 staples · 46g · $2.03 · 53g · $1.85 · receipt (3rd copy) · date stamp` | REMOVE | Keep "a dozen staples" in the sentence. Phone shows the "solving" state: cards flipping into place, no numbers. |
| How it works, step 03 | `53g · $1.85` | REMOVE | Phone shows the list with items being checked off; the empty-fridge line stays as copy. |
| Mint band | `60 seconds` | KEEP | A time promise is a benefit. It becomes the headline of the inline demo section. |
| Price vs delivery | `$39.72 · ~$50–54 · +25–37% · 15–25%` | REMOVE | This section argues with delivery apps nobody mentioned. Keep one line in the receipt section: "shelf prices, not delivery-app prices." Full argument moves to FAQ. |
| FAQ answers | no numbers | KEEP | — |
| Demo result (/plan) | ingredient fractions "1/12 · 1/6 · 30 g", kcal per day, "printed 1:13 am" | SIMPLIFY | Default view = five meal cards with photos + total. "Show the math" toggle reveals fractions and kcal. |
| Pricing page | `$4.99/mo · $59/yr · $7.49/mo · 21-day trial` | KEEP | Fine on its own page. Add "pricing" to the header nav so the $ story is intentional, not hidden. |

After the purge, the six numbers that remain on the homepage: **$39.72** (the week), **150 g** (protein a day), **five** days, **one** list, **12** items, **60** seconds. Everything else lives inside the app.

---

## 6. COLOR DIRECTION — WARM PAPER, ONE YOLK, ONE KALE

The current palette is sterile because it was built to be neutral. But the seeds of a real palette already exist in the code: a brick red on totals, a forest green on protein, a pale mint band. The direction below grows those seeds into a system and derives the accent from the product's own world: **the yellow shelf-price tag.** You quote shelf prices; the shelf tag is yellow. That is a brand color with a reason.

| Token | Hex | Role |
|---|---|---|
| Paper | `#FBFAF6` | page ground (warm, not white) |
| Linen | `#F3F0E8` | alternate sections, receipt paper |
| Ink | `#1B1A18` | text, phone frames (unchanged) |
| Yolk | `#F5B800` | primary CTA, shelf-tags, highlights |
| Kale | `#173F2E` | the one dark section, small labels |
| Tomato | `#C8402B` | the receipt total only (semantic: money) |
| Ink-2 | `#4E4B45` | secondary text on paper |

### Where color goes

- **Yolk** — every primary button, the price shelf-tag on photos, the demo slider thumb, the "solved" check. Because nothing else on the page is yellow, the eye finds the action instantly.
- **Kale** — the background of the receipt/proof section (replacing near-black), small caption labels, links. It reads "food" where black reads "tech."
- **Tomato** — the total on the receipt, and nothing else. It stays semantic.
- **Photography** supplies most of the saturation: chicken gold, broccoli green, tomato red, egg yellow. The UI stays quiet so the food is loud.
- **Paper / Linen** alternate section grounds instead of white / off-white — the same rhythm, two degrees warmer.

### Where color does NOT go

- No gradients on text or buttons. No gradient blobs. No glassmorphism.
- No green-on-everything — kale is a room, not a paint job. If the section is not the proof section, it is not green.
- No colored phone frames or colored icons; no third accent. Four colors plus ink is the whole system.
- Secondary text darkens from #6B6864 to #4E4B45 so it stays comfortably above 4.5:1 on the warmer paper ground.

**Two motifs, one identity.** The *shelf-tag* (yolk, mono, slightly rotated) carries every price on the marketing site. The *receipt* (linen, mono, prints in on scroll) carries the proof, once. Between them they say "real prices, honestly shown" without a single disclaimer.

---

## 7. TYPOGRAPHY DIRECTION

Keep Bricolage Grotesque; give it the stage. Demote IBM Plex Mono to the two motifs only. Replace every 11px uppercase mono label with a 14px Bricolage semibold caption. Go lowercase everywhere, including the H1 — the current page capitalizes only the H1, and the OG image lowercases it, which reads as indecision.

| Role | Now | Proposed |
|---|---|---|
| H1 | Bricolage 700 · 57px · −1.4px | Bricolage 800 · 72–84px desktop / 44px mobile · −0.035em · line-height 0.95 |
| H2 | Bricolage 700 · 32px | Bricolage 700 · 44–52px · −0.025em |
| H3 / step titles | Bricolage 500 · 24px | Bricolage 700 · 28px |
| Lede | Bricolage 400 · 20px · grey | Bricolage 400 · 20–22px · ink-2 (#4E4B45) · ≤16 words |
| Body | Bricolage 400 · 17px | Bricolage 400 · 18px · line-height 1.55 |
| Captions / labels | IBM Plex Mono 400 · 11px · UPPERCASE · +1.65px | Bricolage 600 · 14px · lowercase · +0.02em · kale |
| Receipt & shelf-tag | IBM Plex Mono everywhere | IBM Plex Mono 400/500 · only inside the two motifs |
| Stats | IBM Plex Mono ≈48px | Gone as a pattern — the one price becomes a shelf-tag; other numbers become sentences |

Buttons: Bricolage 700 · 16px · 13px/20px padding · 12px radius. Primary = yolk with ink text. Ghost = 1.5px ink outline. Dark = kale with paper text.

---

## 8. HERO — REBUILD IT

Verdict: **CRITICAL — REBUILD.** The current hero has the right headline and the wrong picture. It shows two receipts, ~27 numbers, a 27-word paragraph, a text-link demo, a micro-label, and phones with no visible depth. It fails "what does it do?" and "does this look good?".

### Concept — "the whole week, on the table"

One phone, tilted six degrees, showing *this week* as five meal cards with real photos and a yolk shelf-tag reading `$39.72`. Around the phone, two or three cut-out plated dishes at 160–260px (chicken-thigh bowl, black-bean egg bowl, yogurt parfait) float with soft shadows, as if the food were spilling out of the screen. The ground is warm paper with one large, very soft radial highlight behind the phone — no gradient blob, just light. Left column: headline, one-line lede, an inline email field + yolk button, and a ghost "try the free demo" button. That is the entire first viewport.

### Hero spec (first viewport · 90vh · desktop split 5/7 · mobile stacked)

- **Headline:** `hit your protein. spend way less.` (keep; lowercase; 72–84px). Alternates to A/B later: "five dinners. one list. forty bucks." / "eat like an athlete. shop like a student."
- **Lede:** `tell us your budget and protein goal. we plan five days of meals and one short grocery list.` (16 words, replaces the 27-word paragraph)
- **CTAs:** Primary = email field + yolk button `get early access` (inline — pre-launch waitlists convert better in the hero than after a scroll-jump). Secondary = ghost button `try the free demo →`. Pill beneath: `iOS · 2026 · free web demo`.
- **Product:** One phone, 420–460px wide on desktop (currently 320px), in a real device frame (iPhone with Dynamic Island as SVG), shadow `0 40px 80px -20px rgba(27,26,24,.35)`, rotated 6°. Screen: "this week" — five stacked meal cards (photo 96px, name, one price), a yolk shelf-tag "$39.72 · one trip" pinned to the corner. The screen crossfades to the grocery list every 4 seconds.
- **Food:** Two to three cut-out dishes (Higgsfield asset A1) floating at the phone's edges, slow 6-second drift; hidden on mobile except one.
- **Remove:** second phone · both receipts · kcal · eyebrow · micro-label · "prices as of" stamp · the underlined text link.
- **Media:** Phone mockup + generated cut-out photography. No video in the hero (one optional ambient steam loop behind the phone is a Tier-3 experiment).
- **Composition:** Text block left-aligned at the grid's left edge; phone overlaps the right edge of the container slightly so it feels bigger than the grid. Dishes break the phone's silhouette. Nothing centered.
- **Why it works:** In one glance: food (what), a phone (an app), a price tag (why), a headline (the promise), an email field (the ask). Zero reading required to understand the category.

---

## 9. SECTION-BY-SECTION AUDIT

Top to bottom as the page ships today. Priority reflects impact on first impression and conversion, not effort.

### 9.1 Header / navigation — sticky · 77px · white 96% — PRIORITY: MEDIUM

- **CURRENT PROBLEM:** Fine bones, but the primary button is black (invisible as a brand signal) and it jumps the visitor to the bottom of the page. "pricing" — which exists and is good — is hidden in the footer. The mark is a 20px single-colour glyph that never appears anywhere else.
- **KEEP:** Minimal nav (two links), lowercase wordmark, sticky behaviour.
- **REMOVE:** Nothing.
- **CHANGE:** Button → yolk. Clicking it focuses the hero email field when the hero is on screen, otherwise opens a slide-down sheet with the field — never a 5,000px jump. Add "pricing" to the nav (how it works · pricing · faq).
- **ADD:** Post-launch: replace the button with an App Store badge on desktop + "download" on mobile.
- **NEW VISUAL DIRECTION:** Paper background at 92% with a 12px backdrop blur; hairline rule in linen.
- **MEDIA:** None.
- **COMPOSITION:** Unchanged — wordmark left, links + button right.

### 9.2 Hero — 992px · white · two CSS phones — PRIORITY: CRITICAL

- **VERDICT:** REBUILD. Full spec in section 8. Summary: one big phone showing food, cut-out dishes, 16-word lede, inline email + yolk button, ghost demo button. Delete the second phone, both receipts, the kcal, the eyebrow and the micro-label.
- **MEDIA:** Device mockup + generated cut-out photography (A1).

### 9.3 "one list. five days. this is what $[your number] looks like." — 675px · off-white · photo + 3 stats — PRIORITY: HIGH

- **CURRENT PROBLEM:** The best photo on the page is boxed into a 900px rounded rectangle beside a column of mono numbers, under a headline with literal square brackets and a disclaimer in 11px caps. The composition says "figure 1," not "dinner." "0 lb waste by design" is confusing out of context.
- **KEEP:** The containers photo (as one of several). The idea that a week of food is the proof. "$39.72" as the single number.
- **REMOVE:** The bracketed headline · "153g" and "0 lb" stat blocks · the methodology disclaimer.
- **CHANGE:** Turn the section into a **full-bleed food strip**: an editorial overhead of five different plated dinners in a row on a linen table, edge to edge, 70vh. Day labels mon–fri set in small kale captions on each plate. One yolk shelf-tag on the image: "$39.72 · one trip". Headline overlaid or directly beneath: "five dinners. one trip. thirty-nine dollars."
- **ADD:** One caption line: "about 150 g of protein a day, nothing left to rot on thursday."
- **NEW VISUAL DIRECTION:** This is the page's color moment — the only section with no UI at all. It answers "what does it do?" with a picture.
- **MEDIA:** Generated photograph (A2), static; optional 6–8s slow-dolly loop, muted, for Tier 3.
- **COMPOSITION:** Full width, no container, image bleeds past the grid on both sides; text sits in a 5-column block bottom-left over a soft paper-to-transparent scrim.

### 9.4 "how it works" — three steps — 2,205px · white · alternating text + scaled phone — PRIORITY: CRITICAL

- **CURRENT PROBLEM:** 38% of the page for three one-line steps. Each row is ~700px with the phone scaled down to 256–288px and the text vertically centered in a sea of white, so the visitor scrolls through emptiness. The step-01 phone is more than half blank and shows "[your target]". Step 02 repeats the receipt a third time. Step 03's "FRIDGE — empty, on purpose" is the best idea in the section and gets one line at the bottom of a phone.
- **KEEP:** Three steps (it is a real sequence, so numbering is honest). The alternating idea. The copy "empty fridge, on purpose."
- **REMOVE:** All three receipts and every number except "$60" and "150 g" in step one. The 0.8× scaling. The 700px rows.
- **CHANGE:** **Rebuild as one pinned phone.** Desktop: the phone (380px, real frame, shadow) sticks in the right column while three short steps scroll past on the left; as each step enters, the screen crossfades to its state. Total height ≈ 100vh + 2 × 60vh. Mobile: a horizontal swipe carousel with three dots.
- **ADD:** Real screen content — **01 "two numbers in"**: the budget slider mid-drag at $60, protein at 150 g. **02 "a week out"**: a 1.5s "solving" animation — twelve ingredient chips fly into five day columns. **03 "shop once, eat all week"**: the list with items being ticked off and the fridge line as the final screen.
- **NEW VISUAL DIRECTION:** White ground (contrast against the paper hero and the photo strip). Step titles at 28px, one sentence each, ≤14 words. Progress shown by the screen, not by "01 / 06".
- **MEDIA:** Device mockup with animated UI states (CSS/JS, or three short screen recordings from the real app once it exists).
- **COMPOSITION:** 7/5 split, phone right and pinned; steps left, generous but bounded spacing (each step block 60vh tall).

### 9.5 Mint band — "see your week solved in 60 seconds." — 244px · pale mint — PRIORITY: HIGH

- **CURRENT PROBLEM:** The only colored section on the page is a thin strip that could be a cookie banner. The promise ("60 seconds") is the most compelling line on the page and it gets a button.
- **KEEP:** The headline, word for word.
- **REMOVE:** The band as a format.
- **CHANGE:** **Promote it to a real section: the inline demo.** Embed step one of /start directly in the page — budget slider, protein stepper — with a live preview that updates as the slider moves ("$60 → 5 dinners · 150 g · 12 items"). Button: "solve my week" (kale), which continues into /start with the values carried over. This is the highest-converting thing you can build pre-launch: a taste of the product without leaving the page.
- **ADD:** A tiny line under the button: "no account. takes a minute."
- **NEW VISUAL DIRECTION:** Paper ground; headline left, interactive card right (stacked on mobile); 70vh.
- **MEDIA:** Live UI (the real component), no mockup.
- **COMPOSITION:** 5/7 split; the interactive card has the only drop shadow in the section.

### 9.6 Price vs delivery — "$39.72 vs ~$50–54" — 414px · white — PRIORITY: HIGH

- **CURRENT PROBLEM:** A defensive argument against delivery apps that the visitor was not thinking about, with four percentages and the longest paragraph on the page (41 words). It makes the brand sound worried.
- **KEEP:** The principle ("we quote shelf prices") — as one sentence.
- **REMOVE:** **Delete the section.**
- **CHANGE:** Fold the principle into the receipt section's caption: "shelf prices, refreshed weekly. no delivery markups, no sponsored picks." The full comparison lives in the FAQ ("how accurate are the prices?").
- **MEDIA / COMPOSITION:** n/a (deleted).

### 9.7 NEW — the receipt (proof section) — proposed · 80vh · kale ground — PRIORITY: HIGH

- **WHY IT EXISTS:** The receipt is your signature and your honesty story. Today it appears three times at small size and means nothing. Once, large, on a dark green ground with a spotlight, it becomes the moment the visitor believes the price.
- **DIRECTION:** Headline: "the receipt is the proof." Caption: "shelf prices, refreshed weekly. no delivery markups, no sponsored picks, no fake reviews." (the three promises from the about page, finally on the homepage). The receipt — linen paper, mono type, 12 lines, total in tomato — is 520px tall, tilted 3°, and **prints itself** line by line as it scrolls into view (600ms, respects reduced-motion). Behind it, a flat-lay of the twelve actual staples on a dark surface (A3), very low contrast so the receipt reads.
- **MEDIA:** Rendered receipt (HTML) + generated flat-lay photograph (A3), static.
- **COMPOSITION:** Receipt right of center, text block left; the flat-lay fills the section behind both at ~30% opacity. Full-bleed dark room.

### 9.8 NEW — three benefits (not cards) — proposed · 60vh · white — PRIORITY: MEDIUM

- **WHY IT EXISTS:** The current page never states the everyday relief in human terms. The reference uses three simple benefits; ours are photo-led, not icon-led.
- **DIRECTION:** Three tall photographs in an editorial row (4:5), each with one line beneath in Bricolage 28px: **"never ask 'what's for dinner.'"** (hands plating a bowl in a warm kitchen) · **"one short list. one trip."** (a single basket with twelve items) · **"nothing rots on thursday."** (an open, tidy fridge with five containers). No icons, no card borders, no descriptions.
- **MEDIA:** Three generated photographs (A4), static.
- **COMPOSITION:** Three equal columns with 24px gutters; captions left-aligned under each image; the middle image offset 40px lower on desktop for rhythm.

### 9.9 NEW — people (social proof) — proposed · 40vh · paper — PRIORITY: HIGH

- **WHY IT EXISTS:** There is currently zero evidence that anyone else uses this. Pre-launch you still have options — as long as they are true.
- **DIRECTION:** In order of strength: (1) a live waitlist count if it is in the hundreds or more ("2,140 people waiting"); (2) three short quotes from demo or beta users with first names and cities, set large in Bricolage, no star ratings; (3) a two-sentence founder note in the about-page voice with a photo of a real kitchen. Do not invent reviews — the about page refuses fake reviews, and it should.
- **MEDIA:** Photograph of the founder or their kitchen (real, not generated).
- **COMPOSITION:** Quotes as three staggered columns of large type; or a single centered founder note with a 4:5 photo left.

### 9.10 FAQ — "questions" — 573px · off-white · 4 accordions — PRIORITY: LOW

- **CURRENT PROBLEM:** Nothing wrong structurally. Visually it is the third "headline + rows on off-white" block on the page.
- **KEEP:** Four questions, the "why not just use chatgpt?" question (a real objection with a good answer), the link to the full FAQ.
- **CHANGE:** Move the delivery-price argument here. Put "when does the app launch?" first — it is the question a waitlist visitor has. White ground, narrower column (60ch), 18px questions.
- **MEDIA:** None.

### 9.11 "your protein. your budget. solved." — early access — 425px · ink · email form — PRIORITY: MEDIUM

- **CURRENT PROBLEM:** A black box with a white button. Functional, but it is the same "headline + form" as the header link target, and black next to the kale receipt section would make two dark rooms in a row.
- **KEEP:** The headline (it is good), the email form, "no spam. one email when the app is ready."
- **CHANGE:** Ground → yolk with ink text (the page's boldest moment, saved for last), or kale if the receipt section is moved. Add the ghost "try the free demo" beside the button. Optional: two small phones in the bottom corners, cropped by the section edge, screens in dark mode.
- **MEDIA:** Optional device mockups.

### 9.12 Footer — 191px · off-white · 9 links — PRIORITY: LOW

- **CHANGE:** Cut "built by a tiny team and a solver" from the footer (keep it on the about page, where it is charming). Group links: product (how it works · pricing · this week's drop · faq) · company (about · press · support) · legal (terms · privacy).

### 9.13 Addendum — the demo (/start → /plan) — PRIORITY: HIGH

- **CURRENT PROBLEM:** The site's strongest asset is presented as a bare form (a slider, a text field, a black "next"), and the result is a receipt plus a wall of ingredient fractions. A visitor who came from a food photo lands in a spreadsheet.
- **KEEP:** Six quick steps, the pantry step (clever), the receipt on the result page, the "regenerate / change my numbers" actions, saving the plan by email.
- **CHANGE:** Steps: same fields, but each step gets a photo rail on the right that reacts (protein up → more chicken and eggs appear). Result page: default view is **five day cards with meal photos and one price each**, the receipt to the right; a "show the math" toggle reveals fractions and kcal. The email capture stays but reads "save this week to your app on day one."
- **WHY IT MATTERS:** This is where the promise gets proven. It should feel like the app, not like the solver's log output.

---

## 10. VISUAL RHYTHM — BEFORE AND AFTER

Widths are proportional to section height. Today, seven of nine sections are white or off-white and every one is "text beside a phone" or "text beside numbers."

**NOW (5,796px):**

| Section | Share | Ground | Layout |
|---|---|---|---|
| hero · 2 phones | 17% | white | split text + phones |
| photo + stats | 12% | off-white | split photo + numbers |
| how it works · 3 phones | 38% | white | 3 × split text + phone |
| mint band | 4% | mint | centered headline + button |
| price vs delivery | 7% | white | numbers + paragraph |
| faq | 10% | off-white | headline + rows |
| email block | 7% | ink | headline + form |
| footer | 5% | off-white | links |

**PROPOSED (≈5,200px):**

| Section | Share | Ground | Layout |
|---|---|---|---|
| hero · 1 phone + dishes | 17% | paper | split, phone breaks the grid |
| five dinners | 13% | photograph | full-bleed image |
| pinned walkthrough | 20% | white | pinned phone + scrolling steps |
| the receipt | 14% | kale (dark) | spotlight, one object |
| inline demo | 12% | paper | interactive card |
| three benefits | 9% | white | three-up editorial photos |
| people | 6% | paper | large quotes |
| faq | 5% | white | narrow column |
| final cta | 4% | yolk | bold block |

Layout types in the proposal, in order: split → full-bleed image → pinned scroll → dark spotlight → interactive card → three-up editorial → quotes → narrow column → bold block. Nine sections, nine different compositions. Ground cadence: paper → photo → white → dark → paper → white → paper → white → yolk.

---

## 11. RECOMMENDED SECTION ORDER (AND WHY)

1. **Hero — "hit your protein. spend way less." (paper, 90vh).** Promise + product + ask in one glance. First because it is the only section that must work alone.
2. **Five dinners — full-bleed food strip (photo, 70vh).** Immediately answers "what does it do?" with a picture and supplies the page's color before any explanation. Before the walkthrough because desire must precede mechanics.
3. **How it works — pinned phone, three steps (white).** Now that they want it, show how little it asks: two numbers. A product-heavy section after a food-heavy one keeps the rhythm alternating.
4. **The receipt — proof (kale, 80vh).** Skepticism peaks right after "how it works" ("is $39 real?"). Answer with the receipt and the three promises. The dark room is a deliberate tonal break mid-page.
5. **Try it — inline demo (paper, 70vh).** The visitor now believes; let them touch it. Conversion asset at the point of maximum belief. Yolk "get early access" appears again right after.
6. **Three benefits — photo-led (white, 60vh).** Emotional consolidation for people who scrolled past the demo: dinner solved, one trip, nothing wasted.
7. **People — proof through humans (paper, 40vh).** Last objection: "does anyone use this?" Sits just before the FAQ and the final ask.
8. **FAQ — four questions (white).** Handles the rational leftovers (launch date, price accuracy, "why not chatgpt").
9. **Final CTA — "your protein. your budget. solved." (yolk, 50vh).** The boldest color on the page, saved for the ask. Email + demo button.

Removed from the flow entirely: the stat trio, the mint band, the price-vs-delivery argument, the second hero phone, two of the three receipts.

---

## 12. SCREENSHOTS, PHONES AND MOTION

### App screenshot strategy

Today every screen inside a phone is a receipt or a form. Screens should look like the app someone will open on a Tuesday night: food first, numbers second. Four screens carry the whole site.

| Screen | Shows | Used in |
|---|---|---|
| **This week** | Five day cards, each with a meal photo (96px), meal name, one price. A yolk shelf-tag with the weekly total. | Hero (main), final CTA (small) |
| **Two numbers** | Budget slider at $60, protein at 150 g, yolk thumb. Real values, no brackets. | Walkthrough step 1, inline demo |
| **Solving** | A 1.5-second animation: twelve ingredient chips settle into five columns; a check appears. | Walkthrough step 2 |
| **The list** | Twelve items grouped fresh / shelf + freezer, checkboxes, total shelf-tag; final frame "fridge: empty, on purpose." | Walkthrough step 3, hero crossfade |

**Honesty constraint.** Whatever the site shows must be what the app does. If the app's home screen today is a receipt, this is also a product decision: make the plan screen photo-led in the app, and keep the receipt as the "ledger" tab. The website and the app should tell the same story.

### Phone / mockup strategy

- **Real frames.** Replace the CSS border boxes with an SVG iPhone frame (Dynamic Island, side buttons, 1px inner highlight). Frame color stays ink.
- **Depth.** Today: `0 8px 30px rgba(25,24,23,.06)` — invisible. Proposed: `0 40px 80px -20px rgba(27,26,24,.35)` plus a 1px `rgba(255,255,255,.4)` inner edge. Flat mockups are the single cheapest fix on the page.
- **Size.** Hero 420–460px wide; walkthrough 380px; final CTA 260px cropped by the section edge. Never scaled with `transform: scale(0.8)` — set the width.
- **Count.** One phone per section. Two only in the final CTA, and only if they are cropped. The current hero's two overlapping phones divide attention and double the numbers.
- **Angle.** Hero 6° rotation with a slight 3D perspective (`rotateY(-8deg)`); walkthrough straight-on; CTA phones tilted ±10°.
- **Surroundings.** Food cut-outs overlap the hero phone; nothing overlaps the walkthrough phone (it is the explainer).
- **Dark mode.** If the app has a dark theme, use it only in the final CTA phones — never in the hero, where the food needs a light screen.

### Animation strategy — four moments, nothing else

1. **Hero:** phone screen crossfades between "this week" and "the list" every 4 s; cut-out dishes drift 6 px over 6 s. Load: headline and phone fade-up 300 ms, staggered 80 ms.
2. **Walkthrough:** pinned phone; each step swaps the screen with a 250 ms crossfade and a 12 px vertical slide. Step 2 plays the "solving" animation once.
3. **Receipt:** prints line by line over 600 ms when 40% in view; the total stamps last with a 100 ms scale from 1.15 → 1.
4. **Inline demo:** the preview numbers tween as the slider moves (no debounce lag).

No parallax backgrounds, no scroll-jacking beyond the one pin, no hover tilt on cards, no gradient shimmer on buttons. Every motion above is disabled under `prefers-reduced-motion`.

---

## 13. HIGGSFIELD-GENERATED ASSETS

Six assets, each with a reason to exist. Style anchor for all of them: **the existing chicken-thigh bowl photo** (/img/meal-chicken-bowl.jpg) — warm north-window daylight from the left, natural linen, stoneware, a little steam, 35mm editorial, muted-but-true color, no HDR gloss, no props. Use that image as a style reference on every generation so the set matches. Generate at 2K, upscale hero-scale assets to 4K.

### A1 · Hero cut-out dishes (three images)

- WHERE: Hero, floating at the phone's edges
- WHY: Puts real food in the first viewport without a full-bleed photo; makes the phone look like it contains dinner
- FORMAT: Static · PNG with background removed · prominent
- STYLE: Top-down, centered, single dish, soft contact shadow, matches existing bowl photo

```
Overhead editorial food photograph of a ceramic bowl of sliced roasted chicken thigh over white rice with charred broccoli, isolated on a plain seamless off-white background, soft north-window daylight from the left, faint steam, natural muted colors, 35mm lens, shallow depth of field, no props, no text, high detail, photorealistic.
```
Repeat for: (2) black bean and rice bowl with halved boiled eggs and avocado; (3) glass of Greek yogurt layered with oats and banana slices. Then run remove_background on each.

### A2 · "Five dinners" full-bleed table shot

- WHERE: Section 2, edge to edge
- WHY: Answers "what does it do?" with abundance; supplies the page's color; replaces the stat trio
- FORMAT: Static 3:1 hero crop (also generate a 4:5 crop for mobile) · optional 6–8 s slow-dolly loop for Tier 3 · prominent
- STYLE: Wide overhead, linen tablecloth, evening window light, five distinct plated dinners in a row, each with visible protein

```
Wide overhead editorial photograph of five different home-cooked high-protein dinners plated in a row on a natural linen tablecloth: chicken thigh rice bowl with broccoli, lentil and chicken stew in a bowl, tuna rice bowl with edamame, pork loin with roasted sweet potato, black bean egg bowl with avocado. Warm early-evening window light from the left, stoneware plates, a fork beside each plate, soft shadows, natural muted colors, 35mm, photorealistic, no text, no hands, negative space along the bottom third for a headline. Aspect 3:1.
```

### A3 · Twelve staples flat-lay (receipt section background)

- WHERE: Behind the receipt, at ~30% opacity on the kale ground
- WHY: Makes the receipt tangible — these are the actual items on it — without adding a second focal point
- FORMAT: Static · subtle
- STYLE: Dark surface, low-key light, grocery items with labels turned away

```
Overhead flat-lay of twelve grocery staples arranged neatly on a dark green-black slate surface: a pork loin in butcher paper, canned chicken, canned tuna, canned diced tomatoes, dry lentils in a jar, rolled oats, peanut butter jar, frozen broccoli bag, frozen edamame bag, sweet potatoes, a bag of long-grain rice, carrots. Low-key moody window light, deep shadows, muted colors, labels turned away, no text, photorealistic, 35mm, high detail. Aspect 16:9.
```

### A4 · Three benefit photographs (4:5)

- WHERE: "Three benefits" editorial row
- WHY: Replaces icon cards with lived moments: cooking, one basket, a tidy fridge
- FORMAT: Static · medium prominence
- STYLE: Same kitchen, same light, hands only (no faces), consistent across the three

```
1) Close photograph of hands plating sliced roasted chicken over rice in a warm modern kitchen, evening window light, linen towel, stoneware bowl, steam, 35mm, shallow depth, photorealistic, no faces, no text. Aspect 4:5.

2) A single wire grocery basket on a wooden counter holding exactly twelve everyday staples (rice, oats, canned tuna, lentils, peanut butter, sweet potatoes, carrots, frozen broccoli, eggs, chicken), warm window light, minimal, photorealistic, no text. Aspect 4:5.

3) An open, tidy refrigerator with five glass meal-prep containers on one shelf and almost nothing else, clean and bright, natural light from the kitchen, photorealistic, calm, no text. Aspect 4:5.
```

### A5 · Ambient steam loop (optional, Tier 3)

- WHERE: Behind the hero phone, blurred, 20% opacity
- WHY: A hint of life in the hero without a video hero's weight; test only if LCP stays under 2.5 s
- FORMAT: Video · 5 s seamless loop · muted · subtle
- STYLE: Extreme close-up, steam rising off a bowl, warm light, very slow

```
Slow cinematic close-up of steam rising from a bowl of rice and roasted chicken, warm evening window light, shallow depth of field, soft bokeh, seamless 5-second loop, no camera movement, photorealistic, 24fps.
```

### A6 · Social / OG image

- WHERE: /og — link previews on iMessage, X, LinkedIn, Slack
- WHY: The current one is a receipt, apparently in fallback Arial; this is the first impression for every shared link
- FORMAT: Static 1200×630 · composed in HTML over A2 or A1 with the real Bricolage font
- HOW: Compose (no generation needed): A2 crop on the left two-thirds, headline "hit your protein. spend way less." in Bricolage 800 on paper, yolk shelf-tag "$39.72 / week", small wordmark. Render with the site's fonts loaded — the current OG route appears to fall back to Arial.

**Not recommended:** generated people's faces (trust risk and uncanny), generated app UI (must be the real thing), illustrations (a third visual language), generated "before/after" fridges (feels like an ad for a cleaning product).

---

## 14. CONVERSION AND CTA AUDIT

The honest situation: the app is not out, so the conversion is an email. That is fine — but it changes the job. A download costs the visitor five seconds; a waitlist costs them trust. The page must therefore prove more, and the demo has to do the work a store listing would do.

| Dimension | Today | Change |
|---|---|---|
| CTA visibility | Black on white; blends with the ink type system | Yolk primary — the only yellow on the page. Instantly findable. |
| CTA frequency | Email ask ×3 (header, hero, footer block); demo ×2 (one is a text link) | Email ask ×4 at peaks (header, hero inline, after demo, final); demo ×3 as a ghost button (hero, after receipt, final). |
| CTA placement | Header button jumps 5,000px to the bottom form | Header focuses the hero field or opens a sheet. Hero field is inline. Never a jump. |
| CTA copy | "get early access" / "try the demo" | "get early access" (keep) / "try the free demo →" ("free" matters) / "solve my week" inside the demo. |
| Headline clarity | Strong | Keep; lowercase for consistency. |
| Value proposition | Money only in the first glance | Money + dinner + ease, via the food strip and the three benefits. |
| Product demonstration | Static receipts; demo behind a link | Animated screens in the walkthrough; live inline demo on the page. |
| Trust | None on the page; "tiny team" in the footer | The receipt room with the three promises; the people section; "iOS · 2026" pill; pricing in the nav (a company that shows prices is a company). |
| Friction | Email is the only path; demo needs six steps before any food appears | Inline first step on the page; food appears from step one. |
| Emotional appeal | Absent — no plate larger than 64px | Three photo sections, cut-out dishes in the hero, warm palette. |
| Perceived quality | Indie tool | Real frames, depth, photography, consistent voice, no placeholders. |
| Post-launch | — | Primary becomes an App Store badge (+ QR on desktop); email stays as the secondary for Android / "notify me." |

---

## 15. REDESIGN ROADMAP

### The 10 biggest problems, ranked

1. **The page sells proof before desire.** Receipts and numbers occupy the first viewport; food is a 64px icon. Wrong story order.
2. **Number density.** ≈70 numeric values, calorie counts in the hero, three receipts (two identical), two date stamps, a methodology disclaimer.
3. **No color system.** Monochrome by design; one mint strip and one black block are the only relief. Nothing is memorable.
4. **Photography is wasted.** The best photo on the site is used as a thumbnail; one 900px image on the whole page; zero video.
5. **"How it works" is 2,205px of mostly air.** Three sentences, three shrunken phones, one of them more than half empty with "[your target]" in it.
6. **Phone mockups look like wireframes.** CSS boxes, a 6%-opacity shadow, no frame details, cream text screens.
7. **Unfinished details.** "$[your number]" in an H2; H1 capitalized while everything else is lowercase; OG image apparently in fallback Arial.
8. **Zero social proof or trust signals.** No users, quotes, press, or store presence; the footer announces "tiny team."
9. **The demo is buried.** The most persuasive thing you own is an underlined text link, and its result page is a wall of mono fractions.
10. **No visual rhythm.** Seven of nine sections are white/off-white "text beside a phone or numbers." No full-bleed, no dark product moment, no editorial layout.

### The 10 biggest visual improvements

1. **One big phone full of food in the hero, with cut-out dishes around it.** Changes the category read from "budget tool" to "dinner app" in one glance.
2. **A full-bleed "five dinners" photograph as section two.** Color, appetite and the value proposition without a word.
3. **Yolk as the only accent, kale as the only dark.** A brand you can recognize from a thumbnail.
4. **The receipt, once, large, printing itself on a dark green ground.** Your signature becomes a moment instead of wallpaper.
5. **Pinned-phone walkthrough.** 2,205px → ~1,400px, and the product explains itself with motion.
6. **Real device frames with depth.** The cheapest change with the biggest "real product" effect.
7. **Inline demo on the homepage.** The visitor touches the product before deciding to trust you with an email.
8. **Headline at 72–84px, lede at 16 words, mono labels retired.** Consumer scale, consumer tone.
9. **Photo-led three benefits instead of cards.** Human relief, not feature bullets.
10. **Social/OG image with food and the real font.** Every shared link becomes an ad instead of an invoice.

### Everything to REMOVE

- The second hero phone, and the kcal-per-day lines everywhere on the homepage
- Two of the three receipts (one stays, large); both "prices as of 2026-08-30" stamps
- The eyebrow "PROTEIN, SOLVED LIKE MATH" and the micro-label "FREE DEMO BELOW · APP COMING SOON"
- The stat trio (153g / $39.72 / 0 lb) and its methodology disclaimer
- Every "[your number]" / "[your target]" placeholder
- The price-vs-delivery section (41 words, four percentages)
- The mint band as a format
- The 0.8× phone scaling and the 700px step rows
- "built by a tiny team and a solver" from the footer

### Everything to SIMPLIFY

- Hero lede: 27 words → 16
- Meal rows: two numbers → one price (or none)
- Numbers on the page: ≈70 → 6
- Labels: 11px mono uppercase → 14px Bricolage lowercase
- Palette: incidental accents → four named colors with rules
- Phones: four → three across the page, one per section
- Demo result: fractions and kcal behind a "show the math" toggle
- Copy case: lowercase everywhere, including the H1 and the OG image

### Everything to ADD

- Inline email field in the hero; yolk primary button system
- Food: A1 cut-outs, A2 table strip, A3 flat-lay, A4 benefit trio
- Device frames, shadows, 6° tilt
- Four app screens: this week · two numbers · solving · the list
- The receipt room with the three promises (no fake reviews, no sponsored picks, no hidden markups)
- Inline demo section with live preview
- Three benefits with photographs; a people / social-proof section
- "pricing" in the nav; "iOS · 2026" pill; post-launch App Store badge + QR
- Four motion moments; reduced-motion fallbacks
- A composed OG image with food and the real font

### Brand personality (five words)

**Smart, warm, honest, unfussy, abundant.** The voice stays lowercase and dry ("empty fridge, on purpose"); the visuals stop being dry. Think of a friend who is very good with money and cooks you dinner — not an accountant who sends you the bill. The receipt is the wink, not the personality.

---

## 16. BEFORE → AFTER

**BEFORE:** A tidy, monochrome, receipt-themed page that documents a grocery-math solver: two phones full of prices and calorie counts, a stat trio with a methodology disclaimer, a 2,200px how-it-works with half-empty phones, an argument about delivery fees, an FAQ, and a black email box. IBM Plex Mono on every label. One photo, used small. Nothing moves. Reads as an engineer's side project for budget lifters — competent, cold, and easy to forget.

**AFTER:** A warm, appetizing consumer-app page on paper-colored ground: one big phone with this week's dinners spilling out as photographed dishes, the same six-word headline at twice the size, an email field right there. A full-bleed table of five dinners with a yolk price tag. A pinned phone that solves a week in three short beats. One receipt, printing itself in a deep green room, with three promises. A demo you can touch without leaving the page. Three photographs that say "dinner's handled." Real people. A yellow block that asks once, clearly. Six numbers on the whole page. Reads as a company you would pay $59 a year.

---

## 17. IMPLEMENTATION TIERS

### TIER 1 — DO THIS FIRST (dramatic; changes the first impression and the category read)

1. **Rebuild the hero** (section 8): one phone at 420px+ in a real frame with shadow, "this week" screen with meal photos, A1 cut-out dishes, 16-word lede, inline email + yolk button, ghost demo button. Delete phone two, receipts, kcal, eyebrow, micro-label.
2. **Purge the numbers** (section 5): down to six on the homepage; remove placeholders, stamps, disclaimer, stat trio, price-vs-delivery section.
3. **Install the palette** (section 6): paper ground, yolk primaries, kale for one section, tomato only on the receipt total. Retire mono labels for Bricolage captions.
4. **Add the full-bleed "five dinners" section** with A2 and one shelf-tag.
5. **Rebuild how-it-works as a pinned phone** with three real screens (static crossfades are enough for Tier 1; the solving animation can wait).

### TIER 2 — HIGH IMPACT (turns belief into action)

1. The receipt room on kale with the print-in animation and the three promises (A3 behind it).
2. Inline demo section with live preview; carry values into /start.
3. Three photo-led benefits (A4). No cards.
4. People section — waitlist count and/or three real quotes, or a founder note with a real kitchen photo.
5. Header CTA behaviour (focus/sheet, never a jump); "pricing" in the nav; "iOS · 2026" pill.
6. Demo result page: day cards with photos by default, "show the math" toggle, receipt beside.
7. Final CTA on yolk with the ghost demo button.

### TIER 3 — PREMIUM FINISH (details that separate "good" from "holy shit this looks good")

1. Composed OG image with food and the real font (A6); consistent lowercase H1.
2. The "solving" chip animation in walkthrough step 2; the optional A5 steam loop behind the hero phone (ship only if LCP stays under 2.5 s).
3. Hero crossfade between "this week" and "the list"; dish drift; staggered load.
4. Hover states: yolk buttons darken 6%, ghost buttons fill ink; link underlines animate from the left.
5. Dark-mode phones cropped into the final CTA; footer regrouped; "tiny team" line moved to /about.
6. Mobile pass: hero phone at 300px with one dish, food strip at 4:5, walkthrough as a swipe carousel with dots, sticky bottom "get early access" bar after 50% scroll.
7. Post-launch swap: App Store badge + desktop QR; email demoted to secondary.

---

## 18. IMPLEMENTATION APPENDIX (for handing to Claude Code / a developer)

Everything in this appendix is PROPOSED. Token names seen in the current build (`bg-bg`, `bg-bg-alt`, `text-ink`, `border-rule`, `bg-accent-wash`, `shadow-receipt`, `img-grade`) are CONFIRMED from class names in the DOM and are used below as the mapping targets.

### 18.1 Design tokens

```css
:root {
  /* grounds */
  --paper:   #FBFAF6;   /* replaces bg-bg (#FFFFFF) */
  --linen:   #F3F0E8;   /* replaces bg-bg-alt (#FBFBFA); also receipt paper */
  --white:   #FFFFFF;   /* walkthrough, benefits, faq */
  /* text */
  --ink:     #1B1A18;   /* keep text-ink */
  --ink-2:   #4E4B45;   /* secondary text (was ≈#6B6864) */
  --ink-3:   #7A766E;   /* captions on white only */
  --rule:    #E6E0D3;   /* replaces border-rule (#E9E7E2) */
  /* brand */
  --yolk:    #F5B800;   /* primary CTA, shelf-tag, slider thumb, checks */
  --yolk-2:  #E6AD00;   /* yolk hover (−6% lightness) */
  --kale:    #173F2E;   /* receipt section ground, captions, links */
  --kale-2:  #0F2C20;   /* kale hover / receipt section vignette */
  --tomato:  #C8402B;   /* receipt total only */
  /* depth */
  --shadow-phone: 0 40px 80px -20px rgba(27,26,24,.35), inset 0 0 0 1px rgba(255,255,255,.4);
  --shadow-card:  0 1px 0 rgba(27,26,24,.04), 0 16px 40px -24px rgba(27,26,24,.3);
  --shadow-tag:   0 6px 14px -8px rgba(0,0,0,.45);
  /* radius */
  --r-btn: 12px; --r-card: 16px; --r-phone: 48px; --r-tag: 4px;
}
```

Tailwind mapping: `bg-bg → bg-paper`, `bg-bg-alt → bg-linen`, `bg-accent-wash → delete` (the mint band goes), `bg-ink` on sections → `bg-kale` (receipt) or `bg-yolk` (final CTA), `shadow-receipt` → `shadow-phone` on devices and `shadow-card` on the demo card, `img-grade → delete`.

### 18.2 Type scale

```css
--font-display: "Bricolage Grotesque", system-ui, sans-serif;
--font-mono:    "IBM Plex Mono", ui-monospace, monospace;   /* receipt + shelf-tag only */

h1  { font: 800 clamp(44px, 6.2vw, 84px)/0.95 var(--font-display); letter-spacing: -.035em; }
h2  { font: 700 clamp(32px, 3.6vw, 52px)/1.02 var(--font-display); letter-spacing: -.025em; }
h3  { font: 700 28px/1.15 var(--font-display); letter-spacing: -.015em; }
.lede    { font: 400 clamp(18px, 1.5vw, 22px)/1.45 var(--font-display); color: var(--ink-2); max-width: 44ch; }
body     { font: 400 18px/1.55 var(--font-display); color: var(--ink); }
.caption { font: 600 14px/1.3 var(--font-display); letter-spacing: .02em; color: var(--kale); }
.receipt, .shelf-tag { font-family: var(--font-mono); }
.btn { font: 700 16px/1 var(--font-display); padding: 14px 20px; border-radius: var(--r-btn); }
.btn-primary { background: var(--yolk); color: var(--ink); }
.btn-ghost   { border: 1.5px solid var(--ink); color: var(--ink); background: transparent; }
.btn-dark    { background: var(--kale); color: var(--paper); }
```

All copy lowercase, including h1 (`text-transform: none`; write the strings lowercase).

### 18.3 Components to build

| Component | Notes |
|---|---|
| `DeviceFrame` | SVG iPhone frame with Dynamic Island; props: `width`, `tilt`, `screen` (slot); shadow `--shadow-phone`. Replaces the four `rounded-[44px] border-[10px]` divs. |
| `ScreenThisWeek` | Five meal cards (photo 96px, name, one price) + `ShelfTag` total. |
| `ScreenTwoNumbers` | Budget slider ($60) + protein stepper (150 g), yolk thumb. |
| `ScreenSolving` | 12 chips → 5 columns, 1.5 s, plays once on enter. |
| `ScreenList` | 12 items grouped fresh / shelf + freezer, checkboxes tick on scroll; final frame "fridge: empty, on purpose." |
| `ShelfTag` | Yolk, mono, `rotate(-2deg)`, `--shadow-tag`; props: `label`, `sub`. |
| `Receipt` | Linen paper, mono, dotted leaders, total in tomato; `print` animation (line-by-line 600 ms, IntersectionObserver at 40%). |
| `FloatingDish` | Cut-out PNG, contact shadow, 6 s drift; hidden `< md` except the first. |
| `PinnedWalkthrough` | `position: sticky` phone in a 7/5 grid; three 60vh step blocks; screen swaps on step intersection; `< md` becomes a snap-scroll carousel with dots. |
| `InlineDemo` | Step-one form embedded on the homepage with live preview; submits to /start with values in the query string. |
| `EmailCapture` | Inline field + yolk button; used in hero and final CTA; header CTA focuses it or opens a sheet. |
| `FullBleedPhoto` | Edge-to-edge image with bottom-left text block over a paper-to-transparent scrim; 3:1 desktop / 4:5 mobile sources. |

### 18.4 Final copy deck (homepage)

```
NAV:        wisedinner · how it works · pricing · faq · [get early access]
HERO H1:    hit your protein. spend way less.
HERO LEDE:  tell us your budget and protein goal. we plan five days of meals and one short grocery list.
HERO CTA:   [email] [get early access]   [try the free demo →]   pill: iOS · 2026 · free web demo
STRIP H2:   five dinners. one trip. $39.72.
STRIP CAP:  about 150 g of protein a day, nothing left to rot on thursday.
HOW H2:     how it works
STEP 01:    two numbers in — your weekly budget and your daily protein. that's it.
STEP 02:    a week out — a dozen staples that overlap across five days, so every pack gets finished.
STEP 03:    shop once, eat all week — perishables early, freezer-friendly by friday. empty fridge, on purpose.
RECEIPT H2: the receipt is the proof.
RECEIPT CAP: shelf prices, refreshed weekly. no delivery markups, no sponsored picks, no fake reviews.
DEMO H2:    see your week solved in 60 seconds.
DEMO CTA:   [solve my week]   no account. takes a minute.
BENEFIT 1:  never ask "what's for dinner."
BENEFIT 2:  one short list. one trip.
BENEFIT 3:  nothing rots on thursday.
PEOPLE H2:  people on the list   (or: what early users say)
FAQ H2:     questions   (order: when does the app launch? · what is wisedinner? · how accurate are the prices? · why not just use chatgpt?)
FINAL H2:   your protein. your budget. solved.
FINAL CTA:  [email] [get early access]   [try the free demo →]   no spam. one email when the app is ready.
FOOTER:     product · company · legal groups; drop "built by a tiny team and a solver"
```

### 18.5 Acceptance criteria

- [ ] First viewport (1440×900) contains: h1, lede, email field + yolk button, ghost demo button, one phone ≥ 420px wide with meal photos, at least two food cut-outs. No receipt, no kcal, no bracketed placeholder text anywhere on the site.
- [ ] Total numeric values on the homepage above the FAQ ≤ 6.
- [ ] Only one receipt on the homepage; it is ≥ 480px tall and animates in (disabled under `prefers-reduced-motion`).
- [ ] "how it works" total height ≤ 1,500px on desktop; phone is pinned; three screens swap on scroll; mobile uses a swipe carousel.
- [ ] Exactly one full-bleed photograph section (A2) and one three-photo section (A4); no icon cards anywhere.
- [ ] Yolk appears only on primary buttons, shelf-tags, the slider thumb and the final CTA ground. Kale appears only in the receipt section, captions and links. Tomato appears only on the receipt total.
- [ ] No IBM Plex Mono outside `Receipt` and `ShelfTag`. No 11px uppercase labels.
- [ ] All headings lowercase, including h1; OG image renders Bricolage and shows food.
- [ ] Header "get early access" never scrolls the page; it focuses the hero field or opens a sheet.
- [ ] Inline demo on the homepage updates its preview within one frame of slider input and carries values to /start.
- [ ] /plan result page defaults to five day cards with photos; fractions and kcal are behind a "show the math" toggle.
- [ ] AMENDED 2026-08-31 (founder decision): lab (Lighthouse mobile): FCP ≤ 1.2s, CLS ≤ 0.05, perf ≥ 85; field: LCP p75 ≤ 2.5s via Vercel Speed Insights once data exists. (A2 stays AVIF/WebP with fetchpriority=high; reserve space for the phone and dishes.)
- [ ] No horizontal scroll at 360px; hero phone 300px wide on mobile with one dish.

### 18.6 Suggested Claude Code kickoff prompt

```
Read wisedinner-design-audit.md in full. Treat sections 5, 6, 7, 8, 11, 12 and 18 as the spec.
Start with Tier 1 (section 17) in this order: tokens (18.1–18.2) → DeviceFrame + ScreenThisWeek + ShelfTag → hero rebuild (section 8) → numbers purge (section 5) → FullBleedPhoto section (9.3) → PinnedWalkthrough (9.4).
Do not create new sections beyond section 11's list. Do not add cards, gradients, or a third accent color.
Use placeholder <img> slots named A1-1, A1-2, A1-3, A2, A3, A4-1..3 for generated assets; I will drop the files in.
After each step, list what you removed and what remains numeric on the page, and check the acceptance criteria in 18.5.
```

---

*End of audit. Everything measured is from the live site on 31 Aug 2026; everything proposed is a recommendation to be validated against the real app's screens and against real user quotes before it ships.*
