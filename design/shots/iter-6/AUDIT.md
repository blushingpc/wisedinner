# iter-6 audit — first unsandboxed cycle: verify debt paid, inline demo shipped

## Environment
gh, dev server (:3077 was already serving this tree), journey, git network all WORK this cycle.
web-design-guidelines guideline fetch (WebFetch) was permission-blocked — audit ran against the
known ruleset from the skill's cached principles, not a fresh pull. (tooling)

## Verification of iters 4–5 (the standing debt)
Journey green 3× (pre-change, mid-change, final): quiz $55/150 g → feasible /plan at $39.92,
all nav/footer links 200, waitlist mock → /thanks #42, live smoke returns `already`.
Read every shot. Verdict: **no reverts.** Hero (§8), A2 strip, palette, pinned walkthrough,
receipt room all landed as specced.

## Findings
- polish · desktop pinned walkthrough reads sparse in full-page capture (sticky phone shows one
  screen, step texts float in whitespace). Live scroll behavior is correct — capture artifact,
  no action. Watch it on the Vercel preview once deploys flow.
- nitpick · /plan full-page shot shows the sticky summary bar mid-page ghosting over Wed rows —
  sticky positioning under full-page screenshot, not a live defect.
- nitpick · quiz step 1 desktop is sparse right of the 62ch column (§9.13 photo rail queued, Tier 2 item 6).
- fixed in-cycle · inline demo protein value "150 g" wrapped inside its 64px span → w-20 + nowrap.
- fixed in-cycle · double aria-live (protein span + preview line) → preview line made inert.

## Shipped this iteration
1. **#6/#9 deploy authorship** — loop commits already author as `blushingpc
   <293302513+blushingpc@users.noreply.github.com>` (verified via git log + gh api user);
   weekly-drop.yml commit identity switched from weekly-drop[bot] to the founder identity.
   Full deploy-Ready proof waits for the next drop commit (Sunday) or this push's Vercel build.
2. **Tier 2 item 2 (§9.5)** — linen demo band replaced by the inline demo: paper ground, 5/7 split,
   card carries the section's only shadow; budget slider 30–120, protein stepper 80–220 (44px
   targets, labeled, aria-labels, disabled at bounds), live preview line ($X → 5 dinners · N g ·
   ~M items where M mirrors solver floors() — honest, not solver output), kale `solve my week`
   (new .cta-kale) → /start?budget=&protein=; URL values clamp server-side and beat sessionStorage.
   "no account. takes a minute." microline kept.

## Numbers above the FAQ
Static marketing numerals unchanged at 5 (hero pill $39.72, strip $39.72 + 153 g, receipt total,
"60 seconds"). The inline demo's numerals are interactive product UI (user-set values + floor-derived
item count), not marketing copy — §9.5 mandates them.

## Truth gate
No new placeholders. No generations (0/8). data-truth grep unchanged.
