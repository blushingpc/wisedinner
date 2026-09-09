BACKEND + DATA v1 — one database for the site and the app; store-aware prices; AI support on Gmail. Save this message verbatim as docs/BACKEND-V1.md in the main repo and commit. Then `git worktree add ../wisedinner-backend -b backend-v1` and do ALL work inside ~/Projects/wisedinner-backend; never touch the front-end branch. Push the branch; open a draft PR "backend v1".

## 0. KEYS
Read ~/wisedinner-keys.txt (outside the repo). Write its values to .env.local (gitignored) and `gh secret set` each one for workflows; add them to Vercel production via the CLI if logged in, otherwise list the NAMES only for me at the end. Never print the values and never copy them into any file inside the repo. WALMART_API_KEY and INSTACART_API_KEY are empty for now: build those integrations behind flags that skip gracefully until the keys arrive.

## 1. SCHEMA (Supabase migrations under supabase/migrations; RLS on every table; no public policies; server routes use the service key only)
stores(id, chain, banner, region_scope text, price_index numeric, data_source text)  -- seeded: Walmart, Kroger family (all banners as rows sharing chain "Kroger"), Aldi, Target, Publix, Costco, H-E-B, Trader Joe's, Whole Foods, Safeway/Albertsons, Meijer, Other; price_index relative to a national baseline, documented with sources in docs/STORE-INDEX.md
skus(id, name, aisle, perishable bool, pack_qty numeric, pack_unit text, canonical_unit text, grams_per_unit numeric, kroger_product_id text, walmart_item_id text, usda_fdc_id text)
prices(sku_id, store_id, region text, shelf_price numeric, unit_price numeric, source text /* kroger-api | walmart-api | instacart-cart | index-estimate | receipt */, confidence numeric, as_of date)
store_prices VIEW: best available source per (sku, store) by precedence receipt > kroger-api > walmart-api > instacart-cart > index-estimate
receipts(id, user_hash, store_id, region, sku_id, price numeric, observed_at, verified bool)  -- calibration source; ingest endpoint for the app
nutrition(sku_id, protein_g, kcal, fat_g, carbs_g, per text default '100g')
recipes(id, name, meal_type, tags text[] /* healthy, would_order, protein source */, servings int, minutes int, steps text[])
recipe_ingredients(recipe_id, sku_id, qty numeric, unit text)
recipe_variants(recipe_id, variant_recipe_id, kind text /* protein_swap | carb_swap | veg_swap */)
delivery_quotes(id, list_hash, store_id, zip, subtotal numeric, fees numeric, source text default 'instacart-cart', quoted_at)
data_snapshots(version int, url text, sha256 text, created_at)
shared_weeks(id, budget, protein_target, diet, household, stores int[], week jsonb, created_at)
support_threads(id, channel text /* email | form */, from_email, subject, status text /* open | auto_replied | escalated | closed */, created_at)
support_messages_v2(thread_id, direction text /* in | out */, body text, ai bool, created_at)  -- migrate the existing support_messages rows into threads; keep waitlist as is.
Source and confidence are INTERNAL fields: never exposed in user-facing API responses or rendered on the site or in the app contract's display fields.

## 2. PIPELINE (scripts/data/*.ts; run locally now; weekly via .github/workflows/weekly-drop.yml)
a. kroger.ts — client-credentials auth, token cached for its 30-minute TTL (never one per request); for each ZIP (33063, 78701, 90012, 43215, 10001) call /v1/locations first, pick the nearest Kroger-family locationId, then query /v1/products with filter.locationId (product.compact alone has no prices); map every sku to a Kroger product once (data/kroger-map.json; flag unmapped for me); write shelf prices with source kroger-api.
b. walmart.ts — behind WALMART_API_KEY; map skus to walmart.com items; write prices with source walmart-api; skip cleanly when the key is absent.
c. instacart.ts — behind INSTACART_API_KEY; given a list, ZIP and store, create the priced shopping-list page via the Instacart Developer Platform and record the quote in delivery_quotes; skip cleanly when absent. This is the only Delivery Gap source; no modeled markups anywhere.
d. index.ts — for every (sku, store) with no live source, write an index-estimate price = national baseline × the store's price_index, low confidence.
e. usda.ts — FoodData Central per sku (Foundation/SR Legacy), store fdc_id; macros per 100g.
f. units.ts — canonical units and grams_per_unit; unit_price from pack size; cost-per-serving = Σ(qty × unit_price); tests (8 oz of a 32 oz $4.00 bag = $1.00).
g. recipes — author the 27 REDESIGN-V4 §4 dishes as real recipes (ingredients as sku + qty) with 2 or 3 variants each (protein swap, carb swap) so the pool is 60 to 80; every recipe tagged healthy + would_order; tests: every recipe buildable, every diet mode ≥ 12 options, the six solver profiles pass the variety floors.
h. snapshot.ts — publish data_snapshots vN: one JSON bundle (stores, skus, store_prices, nutrition, recipes, variants) to Supabase Storage bucket "data" (public) with sha256; the app bundles the latest at build and calls GET /api/data/latest for updates. Guard: infeasible profiles or any SKU price swing > 30% → fail the workflow, do not publish. Keep the +10% buffer in the solver, not the data.

## 3. SOLVER UPGRADES (packages/solver; consumed by the site's fixtures and ported by the app)
Load from the snapshot instead of hand tables. Input gains stores: string[] (the user's one to three chosen stores) and zip. Price each item from store_prices for the chosen stores. Optimizer modes: singleStore (cheapest one store for the whole list) and bestPerItem (split the list), enabled only when ≥ 2 chosen stores have non-index data; otherwise single-store estimate. Add regenerateSlot(week, slotIndex, seed) — re-solve one slot with all others fixed, budget and protein preserved; swapCandidates(week, slotIndex, n=6) — ranked valid substitutes with delta cost, delta protein, and usesExisting (ingredients already on the list or in the pantry), excluding recipes already in the week; pantry subtraction (pantry SKUs excluded from the total); consolidation tests (half an onion Monday, half Wednesday = one onion). Tier gating (whole-week regenerate free, single-slot regenerate on Protein Plan, swap menu on Autopilot) lives in the app, not the solver.

## 4. API ROUTES (Next.js, server-only keys, in-memory rate limits)
GET /api/data/latest → {version, url, sha256}; GET /api/data/[version]; POST /api/weeks (share a week → id) and /w/[id] reads shared_weeks; POST /api/receipts (app ingest: sku, store, price, region; user_hash only, no PII); POST /api/support (existing form → thread); GET /api/status extended with snapshot version and support queue depth.

## 5. AI SUPPORT ON GMAIL
A Vercel cron every 5 minutes (app/api/support/poll) connects via IMAP to SUPPORT_GMAIL_ADDRESS, reads unread mail, creates/appends threads, runs the handler: Anthropic API with a system prompt built from the FAQ, pricing, terms, privacy, and a tone guide (plain, friendly, sentence case, no promises about dates). Informational intents (how it works, pricing, when, what is free) → reply via SMTP from the same Gmail, mark read, status auto_replied. Refunds, legal, account or data deletion, press, or anything the FAQ does not cover → leave unread, status escalated, email a digest to SUPPORT_ESCALATION_TO. Every message logged both directions. Footer: "Reply to this email to reach a person." Tests with fixture emails for both paths. Respect Gmail's ~500 recipients a day limit.

## 6. CONTRACT FOR THE APP CHAT
Write docs/API-CONTRACT.md: snapshot JSON schema with a sample; /api/data, /api/weeks, /api/receipts; the store picker (list of stores, one to three); tier expectations (which solver functions each tier calls); caching and refresh rules. No source or confidence fields in user-facing shapes.

## 7. VERIFY + REPORT
Run the pipeline end to end; publish snapshot v1; run all tests; workflow_dispatch the weekly job and confirm the guard passes; send a test email to the support Gmail and confirm both the auto-reply path and the escalation path. Report: SKU match rate (mapped vs unmapped for Kroger), price deltas vs the old table, recipe and variant counts per diet, a swapCandidates example, which integrations are waiting on keys (Walmart, Instacart), and anything BLOCKED. Commit per step, push, final report on the PR.

## 8. QUEUE NOTES (record, don't act)
Add to the release epic: "switch support email to a transactional provider before volume", "add Anthropic billing before launch" (balance is $5, enough for testing).

---
Addendum 2026-09-09 (founder, at plan approval): the five Kroger ZIPs in §2a are replaced by Kroger-territory ZIPs so every region returns live prices: 43215 (Columbus, Kroger), 90012 (Los Angeles, Ralphs), 77002 (Houston, Kroger), 30303 (Atlanta, Kroger), 98101 (Seattle, QFC/Fred Meyer). The "no Kroger-family store near ZIP" logging stays for future user ZIPs. Escalation digests go to the founder's account email (SUPPORT_ESCALATION_TO).
