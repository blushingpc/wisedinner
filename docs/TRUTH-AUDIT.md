# TRUTH AUDIT — placeholder ledger for the design-v2 phase

wisedinner-truth is SUSPENDED on design-v2 (founder decision, 2026-08-31) so the design can reach the
Cal-AI-premium bar with realistic placeholder content. Every element whose content is not yet true:

1. carries `data-truth="placeholder"` in the markup,
2. must NOT use numbers or quotes from the real solver or real users,
3. gets one row here, listing the honest content that will replace it.

**MERGE GATE (hard):** design-v2 cannot merge to main while `grep -r 'data-truth="placeholder"' app`
returns anything or this table has open rows. The founder runs the closing audit; the loop never
clears the gate itself.

| # | location | placeholder content | honest replacement plan | status |
|---|----------|--------------------|------------------------|--------|
| 1 | app/page.tsx S6b quote 1 | "finally a meal app that starts from what i can spend…" — sam · austin | real beta-user quote (first name + city, with consent) | OPEN |
| 2 | app/page.tsx S6b quote 2 | "the list is twelve things…" — priya · chicago | real beta-user quote | OPEN |
| 3 | app/page.tsx S6b quote 3 | "my fridge is actually empty on friday…" — marcus · tampa | real beta-user quote | OPEN |
