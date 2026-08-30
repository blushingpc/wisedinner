# iter-1 self-audit — 2026-08-30 · local dev · rubric: docs/DESIGN.md §12 + SITE-SPEC §4/§20

## fixed this iteration (all visible in the after-shots here)
- conversion · /drop mobile buried the headline under a ~1000px receipt → text column first below lg (mobile-drop.png)
- conversion · /plan + /drop day rows drowned the meal name in pack fractions → slot | meal + secondary mono portion | grams (desktop-plan.png)
- conversion · hero frame 2 covered frame 1's price column → frame 2 at left-320 in a 640 stage; $ total + protein line now readable (desktop-home.png)
- tooling · journey shots emulate reduced-motion so reveals and the count-up are static; total read from the receipt, not the first $ on the page

## open, above nitpick
- polish/solver · breakfast repeats 5× ("peanut butter tortilla roll-ups" every day; drop: "oats with peanut butter" every day). the repeat cap covers dinners only. solver is untouchable in the loop → queued as an idea, not fixed here.
- polish · /start step 06: 12 pantry chips push "solve my week" below the 844px fold. shortening chips or a sticky CTA would fix; deferred (not a blocker: Enter submits).

## nitpick
- hero H1 wraps to 4 lines at 1440 in the 1.1fr column; reads heavy but on-brand.
- pricing page: fine. quiz steps: fine. links: 9/9 → 200.

## not verifiable locally
- waitlist submit → 500 on this machine (no supabase env in .env.local); passes on the preview/prod deploy. test row deletion needs NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local (gitignored) — founder action.

## reverted
- none.
