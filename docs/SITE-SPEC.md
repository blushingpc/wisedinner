ONE-SHOT WEBSITE BUILD — WISEDINNER SITE-SPEC v2

STEP 0 (do this first): Save this ENTIRE message verbatim as docs/SITE-SPEC.md, commit "site spec v2". It is the build order and the reference §19/§18B/MealCard/DeviceFrame definitions you flagged as missing. Rewrite tasks/QUEUE.md's MVP section to mirror §19. Then execute §19 top to bottom in one sprint.

## 1. CONTEXT
WiseDinner is app-first: a deterministic solver turns weekly budget + protein target into a solved grocery week. The WEBSITE's only jobs: (a) convert visitors to early-access signups until the iOS app ships, (b) let them run the demo (quiz → solved-week reveal), (c) carry legal/support/press surfaces. Grammar reference: calai.app, myfitnesspal.com — consumer app funnels. Match their structure, never their fake-able proof.

## 2. CURRENT STATE (refreshed after commit cf7daed)
CONFIRMED DONE: repo + Vercel + wisedinner.com live; Supabase env vars set; /api/solve + data/staples.json; brand mark passed QA and shipped (public/logo/wisedinner-mark.svg, the "w." monoline, C2PA-stripped); icons pipeline done (app/icon.png, app/apple-icon.png, public/icons/icon-192/512, public/press/wisedinner-mark.png 2048, app/manifest.ts, scripts/gen-icons.ts, sharp devDep); app/wordmark.tsx in nav/footer/quiz; optimized imagery committed (public/img/week-containers.jpg wired into landing S2 with .img-grade; meal-chicken-bowl.jpg, meal-yogurt-parfait.jpg, meal-bean-bowl.jpg, staples-flatlay.jpg present but unwired); Higgsfield MCP connected with usage law in CLAUDE.md; quiz job-4 WIP rode into cf7daed with green build + 8/8 tests — KEEP it, fold into §19 step 4, note the entanglement once in PROGRESS.md.
UNKNOWN → placeholders, continue: legal entity `[WiseDinner LLC]`, governing state `[Florida, USA]`, effective dates `[DATE]`; support email = support@wisedinner.com. Keep placeholders bracketed/grep-able.

## 3. OBJECTIVE
One-shot the complete public website: all §5 routes, all §8 components, all §18 copy, §17 legal, §13–16 SEO/security/analytics — deployed, passing every §20 line. Done = a stranger can land, run the demo, join the waitlist, read terms/privacy, contact support, hit zero dead links, zero lorem, zero fake proof.

## 4. LAWS (survive everything)
1. TRUTH: no fake ratings/reviews/testimonials/user counts/store badges. Money numbers labeled "est. in-store". Delivered prices only WITH fees. Nutrition = estimates. Savings = "projected" vs user-stated spend.
2. Budget never hardcoded in brand copy — marketing examples say "your number".
3. Solver stays deterministic; no LLM anywhere on this site.
4. keep-it-simple holds; no new deps beyond what's named here (next/og is built in).
5. Design floors: WCAG AA contrast incl. placeholders, visible focus, 44px taps, four states on async surfaces, prefers-reduced-motion, content visible-by-default (reveals only enhance), no image-hover animation, semantic z-scale.
6. Every UI job's PROGRESS entry: "pre-flight: pass" + decisions + which §18B images used.
7. Higgsfield MCP: asset replacement only per CLAUDE.md law. Zero generations expected this sprint.

## 5. SITE MAP (route · title · meta description)
- `/` "WiseDinner — hit your protein, spend way less" · "Turn your budget and protein target into a solved grocery week. One short list, five days of meals, zero waste."
- `/start` "Solve my week — WiseDinner" · "60 seconds: your budget, your protein target, your solved week."
- `/plan` "Your week, solved — WiseDinner" · noindex.
- `/drop` "This week's protein plan — WiseDinner" · "One universal high-protein week at real in-store prices, refreshed every Sunday."
- `/pricing` "Pricing — WiseDinner" · "What WiseDinner will cost when the app ships. Simple, annual-first, 21-day trial."
- `/faq` "FAQ — WiseDinner" · `/about` "About — WiseDinner" · `/press` "Press — WiseDinner" · `/support` "Support — WiseDinner"
- `/terms` "Terms of Service — WiseDinner" · `/privacy` "Privacy Policy — WiseDinner" · `/thanks` noindex
- not-found.tsx custom 404 · error.tsx custom 500
- robots.txt (disallow /plan, /thanks) · sitemap.xml (all indexable) · manifest exists · favicons exist

## 6. DESIGN DIRECTION "APP FUNNEL" — SUPERSEDED 2026-08-31 by docs/DESIGN-V2-PLAN.md (single design source of truth; this section kept for history)
Tokens: page #FFFFFF; section-alt #FBFBFA; ink #191817; soft #6B675F; rule #E9E7E2; accent #1D7A46; accent-wash #EDF3EC; receipt-paper #FAF8F3 + receipt-red #C33D2E INSIDE receipt artifacts only. Radius 14px cards/frames, 12px CTAs, receipt 0. Shadow `0 8px 30px rgba(25,24,23,0.06)` on device frames + receipt only. Type: Bricolage Grotesque 400/500/700 via next/font/google; IBM Plex Mono tabular for EVERY number/label/receipt. H1 clamp(2.6rem,6vw,4.5rem) w700 tracking -0.025em text-wrap:balance; body 1.0625rem/1.65 max 62ch. Sections py-24 desktop / py-14 mobile; container 1200px. Friendly, big, air; centered heroes allowed; phone-mockup-led. Motion: 600ms cubic-bezier(0.16,1,0.3,1) IO fade-ups + 80ms stagger; receipt total counts up once; CTAs scale(0.98) active. Receipt aesthetic lives INSIDE DeviceFrames, /plan, /drop — page stays consumer-clean. IMAGERY: §18B files via next/image, explicit dimensions, radius 14px or in-frame, `.img-grade { filter: saturate(0.96) contrast(1.02) }`, real alt text, no text baked in, imagery supports / type leads.

## 7. PAGE SPECS
### `/` landing
Nav: wordmark left; how it works · faq · [CTA] right; mobile = wordmark + CTA.
S1 HERO (min-h-[88dvh], 2-col ≥1024, stacked below): left = eyebrow mono `PROTEIN, SOLVED LIKE MATH` → H1 → sub → CTA + microline. Right = two overlapping DeviceFrames rendering REAL components: frame 1 = plan view — two MealCards (photo + name + mono `42g · $2.71`) above a mini receipt footer; frame 2 = reveal receipt, live counted total. Frames tilt −3deg/+2deg desktop, 0 mobile.
S2 THE SOLVED WEEK — exists (containers image + copy); upgrade to spec: 2-col ≥1024, right = H2 `one list. five days. this is what $[your number] looks like.` + three stacked mono stats from a committed solver fixture: `152g protein / day` · `$54.87 est. weekly` · `0 lb waste by design` + caption `numbers from a real solver run at 2026 average prices — methodology in FAQ`. Image-first stack on mobile.
S3 HOW IT WORKS: 3 steps, 2-col zig-zag, small DeviceFrame per step; steps 2–3 include a MealCard with a §18B photo. Copy §18.
S4 DEMO BANNER: full-width accent-wash band: `see your week solved in 60 seconds.` + `try the demo` → /start.
S5 HONESTY STRIP: 2-col mono `est. in-store $54.87` vs `delivered w/ fees ~$68–75` + §18 copy. Plain and proud.
S6 FAQ preview: top 4 accordion + `all questions → /faq`.
S7 FINAL CTA (bg ink, text white): H2 `your protein. your budget. solved.` + inline WaitlistForm.
Footer: wordmark · nav links · legal links · mono `built by a tiny team and a solver · © 2026 [WiseDinner LLC]`.
done: 390px + desktop match spec; Lighthouse ≥90 perf ≥95 a11y; zero dead links.
### `/start` quiz (absorb existing WIP)
6 steps: budget ($30–120 slider+input) → protein g/day (80–220) → calories band → diet (none/vegetarian/vegan/dairy-free/gluten-free) → household 1–4 → pantry multi-chip (top 12 from staples.json). One question/screen, mono `02 / 06`, thin accent progress rule, Enter advances, back link, sessionStorage persistence, inline validation, final POST /api/solve → /plan. done: keyboard-completable, refresh-safe, thumb-reach controls.
### `/plan` reveal
Full ReceiptCard: day rows, dashed separators, aisle list grouped below, `EST. IN-STORE TOTAL` counted in receipt-red, `PROTEIN / DAY` accent, `printed [time]`. Below: projected monthly savings vs stated spend labeled `projected`. Sticky bottom bar: total + `get early access` → inline WaitlistForm storing quiz answers. `regenerate` (1 re-solve, then CTA only) · `see this week's free drop`. No session → friendly redirect to /start. done: totals byte-identical to solver; screenshot-worthy at 390px.
### `/drop` universal week (fixed-seed fixture via scripts/gen-drop.ts → data/drop.json committed): ReceiptCard + `refreshed every Sunday` + WaitlistForm(source=drop) + shareable OG.
### `/pricing` informational: intro `pricing that'll apply in the app — nothing for sale on this page yet.` Two tier cards: Protein Plan $8.99/mo · $59/yr shown `$4.99/mo billed yearly` (badge `most popular`); Autopilot $12.99/mo · $89/yr `$7.49/mo`. Mono spec-sheet feature rows. Foot: `21-day free trial in the app · cancel anytime · prices may change before launch`. CTA = waitlist.
### `/faq` all 8 §18 Q&As, hairline accordion. `/about` §18 copy + staples-flatlay.jpg + press link. `/press` §18 boilerplate + support email + downloadable zip (scripts/press-kit.ts zips logo SVG + 2048 PNG → public/press/wisedinner-press-kit.zip). `/support` email shown + form (name/email/message, honeypot) → /api/support → success `got it — we read everything, usually within a day.`
### `/terms` `/privacy` via LegalLayout (prose 65ch, h2 anchors, desktop toc, `effective: [DATE]`). Content §17.
### `/thanks` `you're in. #[position] on the list.` + `while you wait: try the demo · get this week's drop`.
### 404: H1 `this aisle doesn't exist.` mono `err 404 · nothing rotting here either` + home/demo links. 500: `something broke. it wasn't your fault.` + retry + support link.

## 8. COMPONENTS (≤150 lines each, colocated)
Nav · Footer · DeviceFrame (CSS phone 320×660, rounded-[44px] ink bezel, renders children = REAL components, never images of UI) · ReceiptCard (variant plan|drop|mini) · MealCard (photo 1:1 radius 10px + name Bricolage 500 + mono macro/price line; ONLY inside DeviceFrames/app-UI depictions) · WaitlistForm (email + source + optional quiz jsonb; idle/loading/success/error/duplicate states) · StatStrip · Accordion · SectionShell (rhythm + IO reveal) · LegalLayout · CountUp (mono, runs once, reduced-motion = static).

## 9. DATA MODEL (commit as supabase/migrations file AND run in SQL editor)
create table if not exists waitlist (id uuid primary key default gen_random_uuid(), email text not null unique, source text not null default 'hero', quiz jsonb, created_at timestamptz default now());
create table if not exists support_messages (id uuid primary key default gen_random_uuid(), name text, email text not null, message text not null, created_at timestamptz default now());
alter table waitlist enable row level security; alter table support_messages enable row level security; -- no public policies; server routes use service role only.

## 10. BACKEND (Node runtime route handlers)
POST /api/waitlist — validate email (regex + ≤254), lowercase, insert; unique violation → {status:"already"}; return position via count. POST /api/support — lengths (message ≤2000), honeypot reject, insert. /api/solve — add input clamps (budget 20–200, protein 60–250, household 1–4), 405 on GET. All: service key server-only; in-memory Map rate limit 10 req/min/IP (comment: fine at this scale).

## 11. AUTOMATION
scripts/gen-drop.ts (fixed seed + staples.json → data/drop.json). scripts/press-kit.ts. sitemap via Next sitemap.ts convention. No cron tonight (queue Idea: Sunday GitHub Action, [activation]).

## 12. EDGE CASES (all designed)
Infeasible solve → `/plan` honest state: `at $[x]/week, [y]g/day isn't solvable at today's prices. closest solvable: [relaxed answer].` + one-tap `use closest`. Duplicate email → friendly already-state. /plan no session → redirect. JS off → prose/legal readable, quiz shows `the demo needs javascript`. Slow 3G → skeletons, font swap. 320px → nothing clips. Long inputs → truncate + title. Double-submit → disabled in flight. Analytics blocked → site unaffected.

## 13. SECURITY
Service key server-only (grep-verify). Inputs trimmed + capped. No dangerouslySetInnerHTML. Honeypot + rate limit both forms. next.config headers: X-Content-Type-Options nosniff, Referrer-Policy strict-origin-when-cross-origin, X-Frame-Options DENY. No cookies from us (sessionStorage only); Vercel Analytics cookieless → no consent banner, privacy policy says so.

## 14. SEO / META
§5 titles/descriptions via metadata exports; canonical wisedinner.com. OG: /og route via next/og rendering mini ReceiptCard (1200×630; params for /, /drop, /pricing) + static fallback. JSON-LD: Organization on /, FAQPage on /faq. robots + sitemap per §5. (Favicons/manifest: done.)

## 15. PERFORMANCE
LCP <2.0s (text hero; 2 fonts via next/font), CLS <0.05 (fixed frame/receipt dims), INP <200ms, `/` JS <130kb gz. Images next/image quality 75, lazy below fold. Lighthouse per page before closing; scores in PROGRESS.

## 16. ANALYTICS EVENTS (Vercel, fire-and-forget)
demo_start · demo_complete · reveal_view · waitlist_join{source} · waitlist_duplicate · drop_view · support_submit · pricing_view.

## 17. LEGAL CONTENT (plain human language, ~800–1200 words each, short sentences, second person; end `questions: support@wisedinner.com`; top comment `<!-- draft for attorney review before paid launch -->`)
TERMS: 1 who we are + acceptance · 2 the service (pre-launch demo + waitlist; describes solver) · 3 BIG DISCLAIMERS in highlighted box: (a) prices are estimates from public data + buffers, actual store prices vary, no guaranteed totals; (b) nutrition figures are database estimates; not medical/dietary/professional advice — consult a professional before diet changes, especially with health conditions; (c) projected savings compare our estimate to what YOU told us you spend · 4 eligibility 16+ (under-18 with guardian) · 5 acceptable use (no scraping/reselling plans/abuse) · 6 IP: our code/brand/plans ours; your quiz inputs yours, licensed to us to operate · 7 waitlist ≠ guaranteed access or pricing · 8 termination · 9 liability capped at greater of $50 or fees paid (currently $0) · 10 governing law [Florida, USA], informal resolution first · 11 changes with notice · effective [DATE].
PRIVACY: what we collect (email + source; quiz answers if saved; support messages; cookieless analytics) · what we DON'T (no cookies from us, no ad trackers, no selling/sharing for advertising — ever, plainly) · where (Supabase US, Vercel) · why (waitlist, launch email, support) · retention (until launch cycle ends or you ask) · rights (email to see/delete everything, 7-day confirmation) · under-16 · changes · effective [DATE].

## 18. COPY BANK (verbatim)
Hero H1 `Hit your protein. Spend way less.` Sub `wisedinner turns your budget and a protein target into a solved week — one short grocery list, five days of meals, and a receipt that proves it.` CTA sitewide `get early access`. Micro `free demo below · app coming soon`. Demo CTA `try the demo`.
Steps: `01 — tell us two numbers`/`your weekly budget and your daily protein.` · `02 — we solve the week`/`a deterministic solver picks ~15 staples that overlap across five days. no ai guessing your macros.` · `03 — shop it. cook it. keep the receipt.`/`perishables early in the week, freezer-friendly by friday. empty fridge, on purpose.`
Honesty: `we quote shelf prices, not app prices. delivery apps mark items up 15–25% and stack fees on top — if you ever export a list for delivery, we show you both numbers first. the cheap way is walking in with the list.`
FAQ 8: 1 what is wisedinner? (one-liner + app-first note) 2 how accurate are the prices? (public-data averages + buffer, labeled estimates, refreshed weekly; your receipt is truth, the app learns from it) 3 why not just use chatgpt? (can't hold prices, aggregate half-onions, or guarantee math; our solver can't get arithmetic wrong — and we show receipts) 4 when does the app launch? (building now; early access to waitlist in order) 5 is this medical or diet advice? (no — planning estimates; consult a professional, especially with a condition) 6 what will it cost? (pricing-page numbers + 21-day trial + `nothing is for sale yet.`) 7 do you sell my data? (`no. not now, not at launch, not as the business model. the business model is $59/yr.`) 8 how is zero waste possible without logging? (full-package consumption is a solver constraint + perishables-first scheduling; tracking optional).
About: 120–180 words, first-person plural: groceries got absurd, protein got expensive, apps optimize macros not money; what it is; what we refuse (fake reviews, sponsored picks, hidden delivery markups); `— the wisedinner team`.
Press boilerplate: `wisedinner is a meal-planning app that treats groceries as a math problem: give it a weekly budget and a protein target and it returns a solved week — a ~15-item list, five days of meals, and an estimated in-store total, with zero food waste by construction. it launches on iOS in 2026.`
Forms: placeholder `you@email.com` · success `you're in — #[n] on the list.` · duplicate `you're already on the list — good instincts.` · error `that didn't go through. try once more?`

## 18B. IMAGERY LAYER (files already in public/img/, optimized)
week-containers.jpg → S2 (done). meal-chicken-bowl.jpg / meal-yogurt-parfait.jpg / meal-bean-bowl.jpg → MealCards in hero frame 1 + how-it-works steps 2–3. staples-flatlay.jpg → /about. TRUTH: illustrative food styling fine anywhere; NEVER generated receipts, hauls, people, store interiors, or "results"; on-image numbers come from the solver fixture as live text. Missing asset → CSS fallback + BLOCKED note, never stock.

## 19. EXECUTION ORDER (push after each; resume at first unchecked)
[x]1 foundation: fonts/tokens partially live — finish SectionShell + token audit · [ ]2 DeviceFrame + ReceiptCard + MealCard + CountUp · [ ]3 landing all sections (S2 upgrade included) · [ ]4 quiz v2 (absorb WIP) + /plan + infeasible state · [ ]5 waitlist API + migration + /thanks · [ ]6 /drop + gen-drop · [ ]7 /pricing /faq /about · [ ]8 /support + API + table · [ ]9 /terms /privacy + LegalLayout · [ ]10 /press + press-kit zip · [ ]11 404/500 · [ ]12 SEO: OG route, robots, sitemap, JSON-LD · [ ]13 analytics events · [ ]14 full pre-flight sweep + Lighthouse every page · [ ]15 PROGRESS sprint summary.

## 20. ACCEPTANCE GATE
[ ] every §5 route live, zero dead links (crawl) · [ ] zero lorem/fake proof (grep: lorem, john doe, example.com, ★) · [ ] copy = §18 · [ ] legal complete w/ disclaimer box + review comment + bracketed placeholders · [ ] waitlist rows land w/ correct source from all 5 entries · [ ] support lands; honeypot blocks · [ ] quiz keyboard + refresh safe; infeasible humane · [ ] /plan totals = solver exactly · [ ] §18B wired w/ alt + dims + grade; MealCards only in app-UI; zero generated receipts/hauls/people · [ ] OG renders for /, /drop, /pricing · [ ] robots/sitemap correct w/ noindex on /plan /thanks · [ ] 320/390/1440 clean · [ ] Lighthouse ≥90/≥95 on /, /start, /plan · [ ] reduced-motion everywhere · [ ] no service key client-side (grep) · [ ] events visible in Vercel · [ ] PROGRESS complete.
