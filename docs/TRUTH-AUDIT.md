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

| # | location | placeholder content | honest replacement plan | status |
|---|----------|--------------------|------------------------|--------|
| 1 | content/site.ts quotes[0] (people section) | "i solved a week for $41…" — sam · austin | real beta-user quote (first name + city, with consent), or `quotes: []` to hide | OPEN |
| 2 | content/site.ts quotes[1] | "two numbers in, a list out…" — priya · chicago | real beta-user quote, or empty the array | OPEN |
| 3 | content/site.ts quotes[2] | "153 g a day for forty bucks…" — marcus · denver | real beta-user quote, or empty the array | OPEN |
| 4 | content/site.ts proof.preorders (hero chip + people row) | 1,240 pre-orders | real number from App Store Connect, or 0 to hide | OPEN |
| 5 | content/site.ts proof.demoWeeksThisMonth | 3,400 demo weeks | real analytics number, or 0 to hide | OPEN |
| 6 | content/site.ts perk (hero + FAQ cost answer) | "first month is on us" offer | founder-confirmed offer, or "" to hide | OPEN |
| 7 | content/site.ts appStoreUrl + badge/QR placeholders | "#app-store", drawn badge box, dummy QR | real App Store URL + official Apple badge SVG + real QR | OPEN |
