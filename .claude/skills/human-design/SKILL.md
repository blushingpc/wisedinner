---
name: human-design
description: WiseDinner's craft floors + pointers to the design source of truth. ALWAYS load before creating or editing ANY user-facing UI. This skill holds the non-negotiable floors; ALL art direction lives in docs/DESIGN-V2-PLAN.md (single source of truth). Precedence on conflict — DESIGN-V2-PLAN > these floors > ui-ux-pro-max > frontend-design > any other taste skill.
---

# Human design — craft floors (Cal-AI-premium era, 2026-08-31)

The Ledger-editorial system is retired (docs/archive/DESIGN.md — history only). Do not enforce any of it:
zero radius, single-shadow rules, phone-mockup bans, centered-layout bans, accent-use quotas, imperfection
budgets, and "one IntersectionObserver is the entire motion stack" are all GONE. Art direction — color,
type, composition, imagery, energy, motion character — comes from **docs/DESIGN-V2-PLAN.md** and the
design-system engine (`ui-ux-pro-max`) + creative direction (`frontend-design`) skills.

What remains here are the floors that survive every aesthetic. They are hard gates, not taste.

## Accessibility floors
- WCAG AA contrast on every pairing — **including placeholder text** (≥4.5:1 body, ≥3:1 large type).
- Visible focus on every interactive element (2px accent outline, offset 2px, or better).
- Tap targets ≥44px. Labels above inputs; placeholder-as-label is banned.
- Semantic HTML first: real buttons, real labels, one h1 per page, landmarks intact.
- `prefers-reduced-motion: reduce` honored by every animation — reduced means near-instant, not "smaller".
- Content visible by default: reveals/choreography only ever ENHANCE; no JS → everything readable.

## Async + state floors
- Four states on every async surface: loading (skeleton over spinner), empty (one sentence + action),
  error (what happened + what to do, no "Error:" prefix), success (the content).
- Double-submit disabled in flight. Errors ≥4.5:1 contrast, announced via role/status.

## Number + honesty floors
- Every number is mono + `tabular-nums`. Money keeps its honest label ("est. in-store", "projected").
- On design-v2, not-yet-true content is allowed ONLY with `data-truth="placeholder"` + a row in
  docs/TRUTH-AUDIT.md, and its numbers/quotes must never come from the real solver or real users.
  The merge gate in CLAUDE.md is absolute.

## CTA + copy floors
- One label per intent, locked: waitlist = `get early access` · demo = `try the demo`. Verb-first, ≤3 words.
- Lowercase-leaning voice, contractions, zero exclamation points. Errors say what happened + what to do.

## Performance floors
- Lighthouse ≥90 performance / ≥95 accessibility on every page the change touches; INP <200ms; CLS <0.05.
- Images through next/image with explicit dimensions and real alt text. Animate transform/opacity only.

## Pre-flight before any UI commit
AA pass (incl. placeholders) · focus visible · 44px taps · four states present · reduced-motion checked ·
numbers mono+labeled · placeholder content tagged + ledgered · Lighthouse gates met · one-glance test:
if it reads "generic AI website", it fails — go back to DESIGN-V2-PLAN and push further.
