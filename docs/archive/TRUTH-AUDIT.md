> RETIRED 2026-09-05 (founder law): the truth gate, `data-truth="placeholder"` tags and this ledger's mechanics are gone. Proof content is governed by CLAUDE.md "External rules" (Apple App Review 2.3/5.6, US FTC fake-review rule); the people section sits behind NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF, hidden in production. Kept for history only.

# TRUTH AUDIT — placeholder ledger for the design-v2 phase

wisedinner-truth is SUSPENDED on design-v2 (founder decision, 2026-08-31) so the design can reach the
Cal-AI-premium bar with realistic placeholder content. Every element whose content is not yet true:

1. carries `data-truth="placeholder"` in the markup,
2. must NOT use numbers or quotes from the real solver or real users,
3. gets one row here, listing the honest content that will replace it.

**MERGE GATE REVOKED (founder decision, 2026-09-01):** placeholder content may ship to production.
This table is now the launch-content checklist — close rows by putting real values in content/site.ts.

NOTE 2026-08-31: rows 1–3 rendered only where NEXT_PUBLIC_SHOW_PLACEHOLDER_PROOF=true (preview).

NOTE 2026-09-01 (pre-order conversion, founder-directed): the env-flag gate is GONE. All placeholder
proof now lives in `content/site.ts` and hides content-side — setting a value to 0 / "" / [] removes
its element cleanly. As checked in (sample values live), the production render CONTAINS
`data-truth="placeholder"` nodes — shipped deliberately under the 2026-09-01 gate revocation; the
founder closes rows below by zeroing sample values or replacing them with real ones.

NOTE 2026-09-01 (strategy round): fabricated proof REMOVED from the live render — quotes deleted,
counts zeroed and now gated `>= 100`, chip falls back to product facts. Rows 1–5 closed by removal;
proof now renders only when real values are entered in content/site.ts.

| # | location | placeholder content | honest replacement plan | status |
|---|----------|--------------------|------------------------|--------|
| 1 | content/site.ts quotes[0] (people section) | sample quote — sam · austin | removed 2026-09-01; add only real quotes with consent | CLOSED |
| 2 | content/site.ts quotes[1] | sample quote — priya · chicago | removed 2026-09-01 | CLOSED |
| 3 | content/site.ts quotes[2] | sample quote — marcus · denver | removed 2026-09-01 | CLOSED |
| 4 | content/site.ts proof.preorders | 1,240 pre-orders | zeroed 2026-09-01; renders only when real and >= 100 | CLOSED |
| 5 | content/site.ts proof.demoWeeksThisMonth | 3,400 demo weeks | zeroed 2026-09-01; renders only when real and >= 100 | CLOSED |
| 6 | content/site.ts hero.perk (hero + FAQ cost answer) | "first month is on us" offer | founder-confirmed offer, or "" to hide | OPEN |
| 7 | lib/links.ts APP_STORE_URL + badge/QR placeholders | every pre-order control routes to /start as "try the free demo →" until NEXT_PUBLIC_APP_STORE_URL is set (WD-01); drawn badge box; dummy QR | set NEXT_PUBLIC_APP_STORE_URL in Vercel (prod + preview) + official Apple badge SVG + real QR (WD-07) | OPEN |
| 8 | content/site.ts founderNote | empty (hidden) | real founder note + real kitchen photo, or stays hidden | OPEN |
| 9 | content/site.ts demo.bands (inline-demo cards) | static budget-band dinner picks (real meals, real computed prices, but not the live solver's pick) | drive pickDinners from real solver output | OPEN |
