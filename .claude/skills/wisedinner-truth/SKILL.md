---
name: wisedinner-truth
description: The WiseDinner product bible — what we are building, for whom, the pricing-honesty hard rules, metrics, and the banned-scope list. ALWAYS load this before any product decision, any pricing or money-related code, any copy that makes a claim, and whenever choosing between two implementations that imply different product behavior.
---

# WiseDinner truth

**One-liner:** WiseDinner turns a weekly budget and a protein target into a solved week — one small grocery list, five days of meals, zero waste, receipt as proof. We sell a verified financial outcome, not recipes.

**User:** 18–30, budget-constrained, wants 140–160g protein/day, shops in person at Aldi/Walmart, lives on TikTok. Secondary later: GLP-1 users. NOT targets: families, macro athletes, recipe hobbyists.

## Product laws
1. **The solver is deterministic.** Budget/macro math comes from the constraint solver over `data/staples.json` — never from an LLM. Same input → same output. If an LLM is ever added it writes copy, not math.
2. **Zero waste is by construction, not tracking.** Full-package consumption is a solver constraint; perishables front-load Mon–Wed; Thu–Fri lean frozen/shelf-stable. The product must work for a user who never logs anything.
3. **The budget number is the user's input, never the brand.** No hardcoded "$50" in copy, components, or marketing strings. Challenge framing is always "$[your number]".
4. **Pricing honesty (hard constraints):**
   - The headline number is always the **estimated in-store shelf total**, labeled "est. in-store".
   - Prices carry `price_as_of` dates and a conservative buffer; when stale (>21 days), say so in the UI.
   - Any delivered/Instacart price is shown **next to** the in-store number **including fees** — never as the primary, never hidden. Instacart marks up 15–25%+; we disclose, we never launder it.
   - Savings claims only ever compare the user's own stated current spend to our estimate, labeled "projected". Verified savings exist only after real receipts.
5. **The receipt is the loop.** Ledger = receipts vs stated baseline, decoupled from meal logging. Activation events (instrument these, optimize for these): grocery **list export/print within 72h** of signup, **receipt logged in week 1**.

## Money (when Stripe lands)
Two tiers: Protein Plan $8.99/mo or $59/yr (present as "$4.99/mo billed yearly", default-selected) · Autopilot $12.99/mo or $89/yr. 21-day free trial, card required, hard paywall AFTER the reveal — the solved week is always shown free; acting on it (export, re-solve, ledger, next week) is paid. Old $6.99 tier exists only as a cancel-flow downsell later.

## Metrics that matter (in priority order)
quiz_complete rate → reveal→waitlist/trial conversion → list-export-72h → receipt-week-1 → estimate-vs-receipt gap (target ≤10%). An "improvement" that doesn't move one of these is not an improvement; don't build it.

## Banned scope (do not build unless it becomes a literal queue item)
Native apps · Medusa or any commerce backend · CMS · admin panel · i18n · dark mode toggle · component libraries · auth beyond Supabase magic link · recipe database expansion beyond the staple pool · social features · AI chat · notification systems · anything requiring a cron before we have 100 users.
