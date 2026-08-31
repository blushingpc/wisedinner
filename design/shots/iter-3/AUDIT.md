# iter-3 self-audit — 2026-08-31 · local dev + live preview smoke · inputs: issue #4 (chrome audit) + founder priority guidance

## fixed this iteration (7 items — founder guidance treated #4's B1/M1/M2 + guidance items as the ranked top)
- truth/api · /api/waitlist + /api/support return 503 {error:"not configured"} when supabase env is missing instead of throwing 500 (B1 half; the env scoping itself is the founder's fix)
- blind spot · journey now fires a LIVE smoke POST at the preview /api/waitlist: loop-test@wisedinner.com seeded once, anything but "already" (or first-seed "ok") fails loudly, zero cleanup. current result: FAIL 500 — correct and loud until the preview env lands (mobile mock pass still green)
- conversion/M1 · hamburger nav <640px: native details/summary, 44px target, all 5 content links (mobile-home.png)
- conversion/M2 · /plan scorecard above the fold; every checkmark computed (budget ✓ iff est_total ≤ budget with the numbers shown, protein ✓ iff target met, waste 0 lb by design). miss state shows "over by $x" / "n of m g" — no decorative checks (mobile-plan.png)
- M3 · step-03 phone anchored with friday meal + "week complete" mini receipt (desktop-home.png)
- M4 · "$[your number]" explained in-place: "$[your number] is the budget you type in — we never pick it for you" (copy-bank line untouched)
- N1/N2 · sliders removed (numeric input, spinners hidden, Enter flow unchanged); hero no longer forces 88dvh on mobile; step gaps tightened — the mobile whitespace walls are gone

## open, above nitpick
- preview smoke FAIL until founder's Preview env vars land (then: first run seeds, rest must return "already")
- placeholders «ENTITY»/«STATE»/«DATE» (B2/B3): values arrive in the founder's next message — do not invent
- breakfast repeats 5×/week — solver, queued on main

## nitpick
- N3 (visible "last updated") is satisfied by the effective line once «DATE» is filled
- hamburger panel doesn't trap focus (native details); revisit only if a11y audit flags it

## reverted
- none
