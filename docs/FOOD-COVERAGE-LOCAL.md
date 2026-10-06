# Private food coverage, October 5, 2026

Closed LOCAL preparation gate: ingredient-reviewed preparations remain reachable under restrictions without gaining repeat-family capacity. This is an explicit offline seam, not public/app activation or complete launch readiness. Honest coverage includes missing weeks and zero replacement slots.

Starting backend codex/backend-readiness `ad900b674111c955322112bce6fcc68d8ad6dae8`; source commit `47196ab2b349c1193de22a173171d90dd0ec1970`. App main `8a0618be20319c0a5df133a6db5b1420b0171854` was read-only. Exact final documentation commit/status are saved after commit in this run's `commits.json` and `checkpoint-worker.md`.

Evidence root: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/runs/2026-10-05T23-36-09-703Z-4fa3c971/`. Accepted evidence is `food-final/acceptance.json`, individual `case-*.json`, `soy-projection.json`, `before-after.json` and `acceptance-summary.json`. First acceptance and all failed/guard attempts remain separate.

## Mechanism and compatibility

The actual approved graph admits 51 soy-free preparations, including three breakfasts, through full ingredient-row review. The old generic parent filter then returns zero because their authored anchors contain soy. `pre-fix.log` records the fresh failing regression, exit 1. `pre-fix-reproducer.mjs` remains runnable and still demonstrates the unchanged generic filter.

New `scripts/data/reviewed-selection.ts` accepts only the regenerated, pinned current private approved stage. It retains original recipe IDs, original parent/kind and original family identity in separate provenance. It uses the original anchor when eligible, otherwise one eligible member as the private solver representative. All other surviving members remain linked to that same representative. No new independent recipe family, dummy anchor, unsafe preparation or portion is introduced.

Every pair of surviving IDs must be together/apart in exactly the same family before and after projection. One representative per nonempty original family makes this equivalence hold for any selected multiset, not just sampled weeks. The soy projection has 51 preparations in the same 27 original families. Existing breakfast/lunch/dinner repeat caps remain 3/99/2; regression tests reject five same-family breakfasts and three same-family dinners, including different sibling IDs. Search cap remains 96.

Original graph must be an unambiguous same-slot star: missing, cyclic, multi-parent or nested linkage cannot supply authority. Current trusted graph and every caller stage are checked against source, candidate, approval, edible, purchase and original-family acceptance pins. An altered stage fails even if a caller changes its hashes. A separately supplied projection is accepted only if complete regeneration matches its snapshot, mapping and digest. Changed trusted artifacts require a separately reviewed pin revision; the old approvals never attest to the projected graph.

The projection has its own provenance digest. It does not change authored ingredients, full compiled additions, consumed portions, source nutrients, yields, whole packs, trim/carryover, diet/allergen metadata or any hard constraint. Original parent/variant metadata is restored for returned candidates rather than attributing an authored relationship to a projected representative.

Internal entry points: `prepareReviewedSelection`, `validateReviewedSelection`, `solveReviewedRestricted`, `reviewedCandidates`. Only the new explicit CLI runner/tests import this module. Public routes, Snapshot/SolveInput contracts, solver core, fixtures, snapshot, app and website product code remain unchanged. Generic restriction/pantry/price entry points remain unchanged; a future private price bridge must bind this projection explicitly under a reviewed version, never silently reuse an old frozen selection revision. No flag, schedule, runtime service or dependency was added. Never publish the private purchase-equivalent nutrient/family projection.

## Fresh coverage

All original 18 primary weeks retain exact outputs, arithmetic and costs at seeds 0/7/19. All actual search outputs repeat identically. Prices below are historical/reference pack estimates with the existing single legacy uplift, not real local offers or guaranteed budgets.

| Profile, unchanged budget/target | Primary cents 0 / 7 / 19 | Soy cents 0 / 7 / 19 | Soy outcome |
| --- | --- | --- | --- |
| Typical $60 / 150 g | 4932 / 4932 / 5074 | 5459 / 5459 / 5459 | All pass |
| Floor $45 / 100 g | 3973 / 3973 / 4006 | 4855 / 4855 / 4855 | Budget miss in bounded search |
| Household two $120 / 150 g each | 8248 / 8235 / 8365 | 9021 / 9021 / 9087 | All pass |
| Vegan $50 / 100 g | 4996 / 4996 / 4996 | None | Zero soy-free preparations |
| Vegetarian $55 / 130 g | 5047 / 5014 / 5047 | None | Three breakfasts, no eligible mains |
| Dairy-free $90 / 180 g | 5966 / 5845 / 6108 | 6466 / 6466 / 6466 | Protein miss |

Soy-free maximum possible daily protein from existing fixed portions is 178.894142857 g: maximum eligible breakfast plus twice maximum eligible main, before applying stricter weekly constraints. Thus this catalog cannot supply 180 g without a food/preparation change; no portion was enlarged. The $48.55 floor result is a bounded-search result, not a proved global minimum or recommendation to raise the founder's budget floor.

Related seed-7 cases: egg exclusion 75 eligible, pass at 5700 cents; dairy exclusion 108, pass at 4932; wheat exclusion 84, pass at 5229; peanut/tree-nut exclusions 108, pass at 4932. Gluten-free retains 72 mains but no breakfast; egg+soy and gluten+soy each retain 36 mains but no breakfast. These are ingredient-review results, not package cross-contact clearance. Malformed/unknown metadata, unknown additions and changed source/approval/family inputs are denied in regressions, never counted as allowed food.

Total 43 cases: 28 feasible, six constraint misses and nine missing-slot cases. Counts remain 132 generated/unique/structurally valid, 108 internally approved and 24 chicken drafts quarantined. Source/quantity-ready ingredients remain fourteen; zero kitchen-tested. No new recipe or source approval.

## Whole-week and replacement proof

Every selected week is re-evaluated against both projected and ORIGINAL purchased graphs with exact output equality. Independent source arithmetic checks five days/fifteen slots, per-person nutrients, household multiplication, purchased packs, edible yield, preparation refuse, physical leftovers, integer cents, daily protein/calorie bands, item/protein-source floors, calorie shares and ORIGINAL family repeat counts. Projected occurrence counts agree under the bijection.

All fifteen slots of every feasible week were exercised: 420 slots, 1,949 returned candidate occurrences. Every candidate passes full-week evaluation in both graphs and independent source/pack arithmetic. This is not 1,949 recipes. Thirty-five slots return zero; 262 return six, which is the existing result cap, not an exhaustive count. No grocery-addition/reroll-shopping policy was selected. Infeasible/empty weeks have no accepted substitution claim.

Per-slot returned counts below are ordered Monday breakfast/lunch/dinner through Friday breakfast/lunch/dinner. Detailed IDs, output digests and independent arithmetic for each returned candidate are in each accepted case file.

| Case | Counts in slots 0–14 |
| --- | --- |
| Typical 0 | 5,6,3,5,6,6,3,6,6,5,6,6,5,6,6 |
| Typical 7 | 5,6,6,2,6,6,2,6,6,5,6,6,5,6,6 |
| Typical 19 | 3,6,6,6,6,6,6,6,6,5,6,6,5,6,6 |
| Typical soy 0 | 0,6,6,1,6,6,1,6,6,1,6,6,0,6,3 |
| Typical soy 7 | 1,6,6,0,6,6,1,6,6,1,6,6,0,6,6 |
| Typical soy 19 | 1,6,6,1,6,6,0,6,6,0,6,6,1,6,6 |
| Floor 0 | 2,6,6,2,6,6,2,6,6,6,6,6,6,6,6 |
| Floor 7 | 3,6,6,3,6,6,3,6,6,6,6,6,6,6,6 |
| Floor 19 | 5,6,6,3,6,6,5,6,6,5,6,6,3,6,6 |
| Household 0 | 6,6,6,3,6,6,6,6,6,5,6,6,3,6,6 |
| Household 7 | 6,6,6,6,6,6,6,6,6,6,6,6,6,6,6 |
| Household 19 | 6,6,6,6,6,6,6,6,6,6,6,6,3,6,5 |
| Household soy 0/7/19 | 1,6,6,1,6,6,1,6,6,1,6,6,1,6,6 |
| Vegan 0 | 0,5,6,0,6,5,0,6,1,0,5,6,0,5,5 |
| Vegan 7 | 1,3,6,0,6,6,0,6,6,1,6,6,1,6,6 |
| Vegan 19 | 0,6,1,0,6,5,0,6,5,0,5,5,0,5,6 |
| Vegetarian 0 | 3,6,6,3,6,6,5,6,6,5,6,5,3,6,6 |
| Vegetarian 7 | 6,3,5,3,6,6,3,6,6,6,6,6,6,6,6 |
| Vegetarian 19 | 2,3,6,5,6,3,5,6,6,2,6,6,5,6,6 |
| Dairy-free high protein 0 | 0,6,6,0,6,6,0,6,6,0,2,2,0,2,5 |
| Dairy-free high protein 7 | 0,5,6,1,2,2,0,6,5,0,2,4,0,5,4 |
| Dairy-free high protein 19 | 0,6,6,0,6,6,0,6,6,0,5,2,0,2,2 |
| Egg 7 | 1,5,6,0,6,6,1,6,6,0,6,6,0,6,6 |
| Dairy/nuts 7 | 5,6,6,2,6,6,2,6,6,5,6,6,5,6,6 |
| Wheat 7 | 3,4,5,6,4,6,3,6,6,6,6,6,6,6,6 |

## Pins and executed checks

```text
source    ff686106f0cdbf67195cb796f9eec3a96366256f76b2e65da87fccc29cb1dd3f
candidate 9c42a18abf690372fe5ab06516af952b7e96dcee2817872ac6e23b1e0d0e0ba8
edible    103d22c976376de3e6cb68b634bb0c61c8060caa8800c6e60c1d7c45a070e594
purchase  bfaaeaa6153b642f49a6cab2af3e074901ae6b11374bb39052cd319f9ad07484
family    bc8271fd8dc38f85851df85d2f865ce6e7048ae5b8c289d716a4219e7c60cdf6
approval  38f50a19f4badfcac3e7756da52bbd569eae9f046734a6cf61d8ffc7d37d5462
inputpins 10f601fc1194d9cc14dc9a6794ee044b1040fdc0ff76e08228c1e918e06e066c
soyproject f03f57198efa078719ac0ecd2b8a712ac47715a1985e1776f5973efbc17ac73a
```

| Command/check | Actual final exit/result | Evidence |
| --- | --- | --- |
| Pre-fix actual graph regression | 1, expected failure | pre-fix.log/reproducer |
| node --test reviewed-selection, ingredient-safety, catalog-pool, reviewed-week, overnight-food files | 0, 24/24 final; 13.046 s | focused-first.log, focused-final.log |
| node scripts/data/food-coverage-acceptance.ts with exclusive external food-first then food-final directories | 0 each; final 43 cases | acceptance-first.log, acceptance-final.log |
| Same accepted output / forbidden docs output attempts | 1 each, denied before writes | existing-output-rejection.log, unsafe-output-rejection.log |
| npm test | 0, 271/271, 47.318 s | npm-test.log |
| npx tsc --noEmit | 0, ordinary project policy | typecheck.log |
| npm run lint | 0, no warnings | lint.log |
| npm run lint:voice | 0, voice clean | voice.log |
| npm run build | 0, existing Edge Runtime deprecation warning | build.log |
| git diff --check / staged source diff check | 0 | checkpoint and command-exits.json |

Every long command's final exit was collected before the next gate. No runtime installation, modified typecheck, parallel build or dependency change. Node/Windows/memory and per-case elapsed timing are in acceptance; timing covers preparation, repeated solve and replacement verification, not isolated solver/device performance. First acceptance was preserved before stricter immutable acceptance pins; final evidence is from the strengthened final source.

Public snapshot blob remains `d572a3aaecd1626ba5fccf8d9adad18aabe86fba`, identical to starting HEAD. Public data/core/app/lib/fixtures unchanged. Owned source files are the three new scripts; owned documentation is this report, task plan and dated PROGRESS section. QUEUE's starting blob `b20f763b92c2e79e31dd375cf921b7ac8ec00986` was checked before appending this job's continuation and remains wholly preserved/unstaged. App PROGRESS/reports/research_notes remain untouched. Indices are left clean; exact post-commit status is in the worker checkpoint. Generated evidence is outside Git, with no credentials/customer data/media staged. Learning review found no supported instruction fault or skill update.

## Remaining gates, rollback and reviewed next action

This repairs reachability, not all restricted-food coverage. Affordable soy-free floor weeks, soy-free 180 g, vegan/soy, vegetarian/soy and gluten-free/egg+soy breakfasts still need genuine reviewed foods or retain their honest miss. Source/quantity coverage is fourteen of 79; unresolved package/yield/ingredients, kitchen/taste/preparation and cross-contact evidence remain. Vegan primary still has four cents of reference-price headroom. Real physical-store availability, original price provenance/calibration and founder freshness/accuracy/location policies remain open; synthetic earlier price tests do not establish accuracy.

Previous account/provider evidence remains previous: native Supabase/SecureStore binding/resume, Apple/Google callbacks/providers and SMTP setup, RevenueCat read access, annual product and eligible 14-day trial configuration, real login/purchase/restore/expiry, hosted Auth/PostgREST/concurrency and real lifecycle reconciliation are unproved. Eight migrations remain unapplied. Retention/legal, reroll shopping/budget, restore transfer, rollout/publication and native/device acceptance need their respective decisions/proof/authority. No real provider, customer message, database, paid service or production action occurred in this chunk. No new product decision or release date was chosen. October 6 20:50:47 UTC is the readiness target only.

Non-destructive rollback: stop importing/calling the new private seam and runner. Existing public/generic behavior and data need no rollback. Preserve original and failed evidence. Source commit 47196ab can be reverted locally after preserving any later work; no schema, provider or catalog reset is needed. Final documentation commit is recorded in commits.json. No rollback was executed.

Proposed next scoped job for independent review: bind this pinned family projection into the private physical-pantry/store-quote bridge with a distinct selection revision and deterministic fictional offers, preserving prior frozen quote evidence and all original food constraints. This is useful local work without a provider/policy decision; it must not activate public pricing, choose the reroll rule or reuse old calibration pins for a changed selection graph. This worker stops at the verified checkpoint and does not start or approve that job.
