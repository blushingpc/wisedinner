# iter-12 self-audit — 2026-08-31 · visible loop · prod build

## shipped
- §9.9 people section between benefits and FAQ: three staggered large-type quotes, first name · city,
  kale caption, linen band, no star ratings, no waitlist count (the honest number is small), founder-photo
  slot intentionally absent until a real one exists.
- TRUTH GATE: all three quotes are invented placeholder content, permitted and pre-authorized by the
  founder's truth-merge-gate directive; each carries data-truth="placeholder" (verified live: 3 tagged
  nodes) and a docs/TRUTH-AUDIT.md row (rows 1–3, OPEN). main stays unmergeable until real quotes land.

## verification
tsc clean, eslint clean, build clean, journey green on the prod build (quiz → /plan feasible, links 200,
mocked waitlist → /thanks #42, live smoke "already"). Looked at people-section.png.

## remaining on #8 — all founder-gated
1. LCP ≤2.5s: needs a prod-CDN measure — deploys frozen (#5).
2. Swap the three placeholder quotes for real beta words (clears TRUTH-AUDIT rows 1–3 and the merge gate).
3. Optional §9.9 upgrades when real: waitlist count if it reaches the hundreds, founder kitchen photo.
