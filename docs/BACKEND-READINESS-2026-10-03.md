# Backend connection checkpoint

October 3, 2026. Terminal-first work on local branch `codex/backend-readiness`. Not launch-ready, published or
connected to the app. The founder's final product promise is little waste. Some leftovers are acceptable;
prices remain estimates. Current Build 1 is anonymous Free plus Protein Plan, not a new user-account system.

## Verified and prepared

Production `/api/status` returned HTTP 200 and `db.ok: true`. The live snapshot pointer and its downloaded blob
returned 200. The exact downloaded bytes matched SHA-256, the schema passed `validateSnapshot`, and the blob
version matched the pointer. This proves a healthy read at the time checked, not monitoring or a fresh RLS audit.

| Artifact | State |
| --- | --- |
| Production snapshot | v5, 82 recipes, 79 SKUs, 387 observations dated September 27 |
| Local readiness snapshot | Unpublished v6 draft, 83 recipes, same SKUs and observation dates |
| App bundle and solver | Untouched by this backend work; migration and device proof still required |

The local core buys whole packs but counts only authored recipe portions toward protein and calories. `eaten`
is exact planned consumption for the household, not confirmation of food eaten. `qty - eaten` is planned
leftover pack quantity, not discarded waste. The previous one-third perishable leftover allowance stays in place;
no new numeric public definition of little waste was invented.

Honest portions exposed two misses. A real frozen-chicken stir-fry adds late-week protein/calorie coverage;
bounded, deterministic recovery repairs local search misses without changing targets, prices or portions.
The six existing acceptance profiles pass. All 30 additional profile/seed combinations pass for seeds 0 through
4. Desktop times in that grid ranged roughly 0.26 to 1.72 seconds; difficult infeasible tests took several seconds.
These are not mobile timings or proof of all allergy, household, budget and geographic combinations.

`evaluateWeek` now accepts both the app's flat 15 IDs and the existing five-by-three format. Their results match;
incomplete, ragged and sparse inputs are rejected. Recovery determinism and authored nutrition have regressions.

Twenty-four inherited variant direction sets were replaced with explicit ingredient-matched authored directions.
The compiler now rejects a variant without its own directions. This fixes concrete contradictions such as whey
in a plant parfait and chicken instructions in a tofu dish. Food temperature checks follow [FDA guidance](https://www.fda.gov/food/buy-store-serve-safe-food/safe-food-handling)
and [FoodSafety.gov](https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures). These are
authored directions, not cooking-test, package-label or complete culinary QA evidence.

Snapshot continuity guards reject missing old SKUs, changed pack/density basis, lost store/region observation
cells, backward dates or versions, and a price swing above the existing 30% boundary at each cell, not just the
cheapest price. They allow reviewed additions. They do not establish freshness, lawful source use or accuracy.

Verification: 112/112 full tests passed. The final input-guard adjustment also passed 14 focused tests. Typecheck,
voice check and production build passed; ESLint has zero errors and one pre-existing unused-variable warning
in support polling. Build retained its existing Edge Runtime warnings. No new dependency was installed.

## Connection gates still open

1. Allergy safety. Twenty-eight SKU names are absent from the app tag table, and unknown names currently receive
   empty tags. Require stable SKU-ID coverage and reject or exclude unknown metadata, including sauces and
   additions, before wiring the catalog. The core currently has no allergy input. Generic tags do not prove a
   package's cross-contact safety. Missing IDs are listed below.
2. Nutrition basis. `pea-protein` currently uses FDC 173181, soy powder; `plant-yogurt` uses FDC 175227, soy yogurt.
   Review all matches against the actual ingredient, raw/cooked/drained basis and pack. Do not manufacture new
   nutrient values or claim a complete audit from passing arithmetic tests.
3. Paid replacement contract. Grocery additions and a weekly cap remain undecided. `swaps.ts` is unchanged and
   does not enforce the fixed agreed tolerance yet. Automatic safety review rejected the attempted fixed-formula
   patch as the forbidden PR #21 override. Obtain direction before retrying that blocked portion. Never copy the
   app override or merge PR #21. A paid change must not silently introduce unbounded groceries.
4. Nationwide pricing. Current observations cover specific regions, not every physical store. A banner/ZIP-prefix
   fallback and a 10% buffer are not nationwide validation. Use an actual store/channel and matched pack where
   approved local data exists. The founder must choose reference estimates versus unsupported locations and
   approve the accuracy standard. Walmart local-feed access/terms and Instacart capabilities remain unverified.
5. Purchases. RevenueCat showed a login page; Apple showed no verifiable account configuration. Reuse verified
   product IDs, map monthly/annual products to one Protein Plan entitlement, use the separate Apple IAP key,
   and prove purchase, restart, restore, expiry/refund and cancellation on native Apple sandbox. Verify the $48
   annual price point. Update Purchase History privacy disclosures. No new trial, release date or offer is assumed.
6. Operations. Database liveness alerts and support-poll freshness have not been implemented or tested here.
   Current migrations specify RLS, but current live policy/grant state needs a separately authenticated audit.
   The weekly pipeline still advances the public snapshot before fixture generation/tests. Stage all acceptance
   artifacts before publishing so a later fixture failure cannot leave an already-advanced pointer.
7. App and website truth. Preserve allergy, pantry, duplicate-meal and leftovers-confirmation behavior during the
   port. Use representative images or a neutral fallback. The new chicken dish must not use a shrimp photo.
   Existing website fixtures were not regenerated: their old waste and receipt-verification fields require review,
   not another fabricated zero-waste or accuracy claim. Keep catalog, fixtures and copy consistent in a reviewed rollout.

The two asynchronous founder choices already requested are the grocery-addition rule and unsupported-area
price behavior. No answer has been received. The separate replacement patch needs explicit direction after its
safety rejection. Login/2FA, legal/tax/banking decisions, spending, partner outreach, paid builds and publication
remain outside autonomous continuation.

## Catalog expansion path

Use the existing authored expander, original directions and priced ingredient overlap. First close the nutrition,
allergy and image gaps, then add a reviewed 50 to 100 meaningful same-basket variants and measure valid
substitutes per slot. Expand compatible family/protein/starch/vegetable choices offline after that evidence.
The 110 baseline theoretical combinations are not thousands of approved meals. Cosmetic aliases do not count.
Thousands need a bounded deterministic working pool and real-device timing before an app promise.

Missing app-tag SKU IDs:
`frozen-shrimp`, `frozen-salmon`, `egg-whites`, `shredded-mozzarella`, `parmesan`, `plant-yogurt`, `pea-protein`,
`tempeh`, `ww-spaghetti`, `gf-pasta`, `ww-buns`, `pancake-mix`, `frozen-berries`, `avocados`, `romaine`,
`tomatoes`, `cucumber`, `asparagus`, `frozen-stirfry-veg`, `frozen-peppers-onions`, `marinara`, `pesto`,
`teriyaki-sauce`, `bbq-sauce`, `buffalo-sauce`, `caesar-dressing`, `tzatziki`, `breadcrumbs`.

## Next work and rollback

Next technical work is SKU-ID allergy coverage and pinned nutrition review, coordinated with the app's existing
adapter. Separately settle the founder choices and authenticated Apple/RevenueCat audit. Then finish monitoring,
stage-before-publish failure tests, native integration and purchases. Use `docs/API-CONTRACT.md` as the handoff,
not older offline/free-only or Autopilot paragraphs.

No main push, deployment, production pipeline, database mutation, paid vendor call, customer message or PR #21
merge ran. Shared `ce_` tables and engine media were untouched. Production v5 and the current app bundle are the
rollback baseline. The local v6 number is provisional; choose the next live version again at authorized publication.
Do not bundle it privately and expect the production pointer to identify those same bytes.
