# iter-2 self-audit — 2026-08-30 · local dev · rubric: docs/DESIGN-V2-PLAN.md (the founder's brief)

## fixed this iteration
- color · green now carries surface: demo banner + final CTA are green-900 with white type; S2 + faq band green-050; stat numerals + eyebrows green-600; one green key word per H2 ("five days."), italic "solved." in the final CTA; hero radial green-100 field; img-grade warmed to saturate(1.03) (desktop-home.png, mobile-drop.png)
- deviceframe v2 · three-layer bezel, island, 9:41 status bar, diagonal glare on the inner layer, tight+ambient shadows, rotateY(-4/3) desktop-only (desktop-home.png)
- energy · display clamp(2.8rem,6.5vw,5rem); frames overlap deeper (left-290); one MealCard peeks past frame 1's edge; MealCards lift on hover (transform/shadow only); stat trio counts up
- BUG found by looking: .frame-glare set position:relative later in the cascade than tailwind's .absolute → both hero frames fell into static flow and frame 2 crashed through S2. glare moved to the inner bezel layer. one journey re-run to confirm.

## conversion heuristics check (390px)
- 5-second test: eyebrow + H1 + sub + both CTAs + micro all inside the first screen ✔
- one loudest element per viewport: primary CTA ✔ (nav CTA + hero CTA share ink — acceptable, same intent)
- CTA/demo within ~1.5 screens: hero, S4 banner, final CTA + nav ✔ · demo one click from everywhere (nav → / → try the demo; /start linked from hero + banner) ✔
- /plan: receipt is the loudest object; day list is quieter ✔

## open, above nitpick
- polish · /start pantry step: CTA below the 844px fold with 12 chips (carried from iter-1)
- polish/solver · breakfast repeats 5×/week — untouchable, queued on main
- polish · white-on-green-600 pairing not used anywhere yet (banner/final are 900 — passes AA for all type); keep 600 for numerals on light only

## nitpick
- frame 2 still clips ~the right 30px of frame 1's mini-receipt prices; total remains visible
- status-bar ●●● glyph is a placeholder; fine at this size

## reverted
- none (the glare bug was a defect of a fix, repaired in the same iteration)
