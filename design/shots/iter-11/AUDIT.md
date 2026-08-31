# iter-11 self-audit — 2026-08-31 · visible loop · prod build :3088 · rubric DESIGN-AUDIT §17/§18.5

## shipped (Tier 3 items 4–6 + gate work)
- item 4 · link underlines animate in from the left (.text-link/.text-link-quiet, background-size, reduced-motion instant); yolk hover + ghost fill already existed
- item 5 (footer half) · footer regrouped product/company/legal with kale captions (§9.12); "tiny team" stays on /about. dark-mode CTA phones SKIPPED: no real dark app UI exists and generated app UI is banned — honest gap, not an omission
- item 6 · mobile sticky "get early access" bar: appears past 50% scroll, hides when the final CTA is visible, 44px, sm:hidden; verified live both ways + screenshot
- item 7 · post-launch swap N/A pre-launch
- 18.5 · A2 both crops now priority + fetchPriority=high; H1 entrance is transform-only (rise-up) so the headline paints at t=0; Bricolage 800 actually loaded (H1 was synthetic bold); footer taps 44px; lint errors from loops 6–10 fixed (2 set-state-in-effect, displaced disable)

## the incident (worth remembering)
pkill -f "next start" killed the npx shim, not the node server — an orphan on :3088 served stale HTML pointing at a deleted CSS hash. Every Lighthouse run in that window audited an UNSTYLED page: a11y 96 + target-size failures + LCP noise were phantoms. Fixed by killing by port. Lesson for the loop: verify the served CSS is non-empty before trusting any measurement.

## Lighthouse (clean prod build, local lantern 4G sim)
perf 89–92 · a11y 100 · CLS 0.000 · FCP ~1.0s · LCP 3.7s (element: hero H1)
- LCP misses the 18.5 target (≤2.5s). Diagnosed to the modeled critical chain (86KB CSS + fonts + hydration), NOT the H1 animation (transform-only now) and NOT the 800 font file (removing it left simulated LCP unchanged, 3731 vs 3780).
- localhost lantern ≠ prod CDN (brotli, h2, edge cache). Gate line stays OPEN pending a prod measure — blocked by the Vercel deploy freeze (#5).

## verification
build clean ×4, tsc clean, eslint 0 errors, journey green ×2 (dev + prod build) incl. mocked waitlist → /thanks #42 and live preview smoke "already". Looked at: mobile-sticky-bar, desktop-footer, mobile-412-bottom (incident evidence), iter-11 home/plan set.

## truth gate
no new placeholders, TRUTH-AUDIT rows unchanged (0), zero higgsfield generations, no faces, no generated app UI.

## 18.5 state
all checked except: LCP ≤2.5s (open, founder-gated by #5) · "people" section quotes remain unbuilt (waiting on real beta quotes or founder note — building placeholder quotes is allowed by the truth gate but the audit ranks real ones first; founder call).
