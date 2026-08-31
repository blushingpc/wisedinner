# DESIGN v2 — standing brief + ranked deficiency list

Phase 0 audit: 2026-08-30, from design/shots/iter-1 against the founder's art-direction brief.
This file is the loop's standing self-audit rubric (docs/LOOP.md step 1).

## Art-direction brief (verbatim law)
- **COLOR — restrained → COMMITTED.** Green scale tokens: green-050 `#F2F7F3` · 100 `#EDF3EC` · 600 `#1D7A46` · 700 `#175E37` · 900 `#0F3D25`; keep ink/neutrals/receipt tokens. Green carries real surface: demo banner + final CTA are deep-green (900/700) sections with white type; section backgrounds alternate white / green-050 / white / ink; stat numerals + eyebrows green-600; hero gets a soft accent-wash radial field behind the phones. Food photography carries warmth — `.img-grade` toward `saturate(1.03)`. HARD LINES: one hue family + neutrals + photo color; no purple, no blue, no rainbow, no AI-gradient slop; receipt-red only inside receipts; WCAG AA on every new pairing (white on green-600 = large type only; body on green uses 700/900).
- **DEVICEFRAME v2** (fixes the cheap phones): three-layer bezel (outer ink rounded-[54px] → 1px inner highlight `rgba(255,255,255,.14)` → screen inset), dynamic-island pill, in-screen status bar 9:41, diagonal glare via `::after` (white ~4% opacity), layered shadow (tight contact + wide ambient), desktop-only `rotateY(-4deg)/(3deg)` perspective, mobile flat. Screens render REAL components — never images of UI.
- **ENERGY:** H1 up to `clamp(2.8rem,6.5vw,5rem)`; one key word per H2 may take green-600 or italic (same family; never both everywhere); frames overlap deeper with one MealCard peeking past the frame edge; hover lift on MealCards (translate/shadow only, never the image); CountUp on the stat trio.
- **CONVERSION HEURISTICS** (audit every iteration): 5-second test at 390px — what it is, who it's for, the CTA, all visible without scrolling; exactly one loudest element per viewport = primary CTA; a CTA or demo entry within every ~1.5 screens; demo one click from everywhere; email-only friction; /plan receipt = the most screenshot-worthy object on the site, nothing competes with it on its page.
- **STOP/PAUSE:** two consecutive clean self-audits → idle rule; the bus keeps the loop alive after that.

## Ranked deficiency list (phase 0, from iter-1 shots)
1. **COLOR is timid.** Green exists only as tiny accents; demo banner is a pale wash, final CTA is plain ink, sections barely alternate. → green scale tokens, deep-green demo banner + final CTA, white/green-050/white/ink rhythm, green stat numerals + eyebrows, hero radial field, warmer img-grade. (conversion: the page reads like a template, not a brand)
2. **DeviceFrames read cheap.** Flat 10px border, no island, no status bar, no light. → DeviceFrame v2 per brief. (conversion: hero is the first proof)
3. **Energy low.** H1 could be bigger; H2s all-ink; frames barely overlap; MealCards inert; stat trio static. → energy pass per brief. (conversion)
4. Breakfast repeats 5×/week — solver, untouchable in the loop; queued as [activation] idea on main. (polish)
5. /start pantry step: CTA below the 844px fold with 12 chips. (polish)
6. Hero H1 wraps 4 lines at 1440. (nitpick — revisit after H1 clamp change)

Items 1–3 = iteration 2. Items 4–5 stay open. Conversion heuristics re-checked every iteration.
