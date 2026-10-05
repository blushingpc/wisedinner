# Reviewed-only usable week

October 4, 2026. Local `codex/backend-readiness`, starting HEAD `b1c0fd3`. The typical profile passes seeds 0, 7 and 19 through the real bounded restricted solve, repeated full-output comparison, independent evaluation and original-source arithmetic. No unresolved legacy anchor or synthetic recipe enters this dataset. This proves a local reference-estimate week, not a particular store purchase, dietary certification, app connection or launch readiness.

## Results

All eighteen full outputs, selected recipe IDs, household list rows, exact nutrient calculations, pack/trim/carryover arithmetic, source URLs, dates, substitutions, inputs and timing are in [reviewed-week-acceptance.json](reviewed-week-acceptance.json). Each full output is deterministic at its seed. No hard constraint changed.

| Profile | Seeds 0 / 7 / 19 | Whole-pack estimated totals | Exact remaining miss |
| --- | --- | --- | --- |
| Typical, $60 / 150 g | Pass / pass / pass | $52.62 / $52.62 / $52.62 | None |
| Floor budget, $45 / 100 g | Pass / pass / pass | $43.51 / $43.51 / $43.51 | None |
| Household two, $120 / 150 g each | Pass / pass / pass | $86.76 / $86.10 / $86.04 | None |
| Vegan, $50 / 100 g | Miss / miss / miss | $46.97 / $46.97 / $46.97 | Selected nine items versus eleven required; lentils 35.2991% of calories versus 35% maximum |
| Vegetarian, $55 / 130 g | Miss / miss / miss | $50.13 / $50.13 / $50.13 | Eleven items versus twelve required |
| Dairy-free, $90 / 180 g | Miss / miss / miss | $73.62 / $73.62 / $73.62 | Weakest-day protein 163.159 / 169.287 / 169.287 g, below 180 g |

Typical weeks each have twelve ingredients and four protein sources. Breakfast/dinner repeat groups, meal types, calorie share, budget, perishable carryover and every day's targets are independently checked without trusting `feasible`. Per-day source quantities are never increased to finish packs. The pool has enough ordinary portions for this target, not every target.

| Typical seed | Weakest day, exact protein | Daily calorie range | Max ingredient calorie share | Valid math substitutes at slots 0 / 7 / 14 |
| --- | --- | --- | --- | --- |
| 0 | 151.332 g | 2495.7–2583.3 | 31.8594% | 2 / 5 / 5 |
| 7 | 151.332 g | 2545.3–2581.7 | 31.8485% | 2 / 6 / 6 |
| 19 | 152.489 g | 2528.7–2602.7 | 31.8465% | 3 / 6 / 6 |

Egg exclusion and peanut/tree-nut exclusion have feasible seed-7 weeks. Soy exclusion empties the conservative family-filtered pool, including orphan meat variants whose base contains soy. Gluten-free excludes all oats breakfasts. Empty metadata and unknown oats reject restricted solving. These are honest coverage gaps, not package cross-contact clearance or an approved paid-reroll grocery rule.

## Ingredient and quantity decisions

Before: ten generic nutrition references and 69 blocked outcomes; 25 inherent safety identities and 54 unknown packages. Four targeted source reviews resolve oats, carrots, onions and tomatoes. Chicken's nutrition source remains reviewed, but its variable-weight mapping does not establish a fixed 3 lb purchase pack. This acceptance basket therefore has **13 combined nutrition/quantity-ready IDs and 66 excluded IDs**, with 26 internally reviewed safety identities and 53 unknown entries. Historical review files remain unchanged; the dated overlay is [reviewed-week-reviews.json](reviewed-week-reviews.json), including every excluded ID. It is not a claim that all other ingredients have incorrect nutrients.

Original USDA records and precision are in [reviewed-week-sources.json](reviewed-week-sources.json). Original labels, preparation rows, package examples, exact conversions and limitations are in [reviewed-week-labels.json](reviewed-week-labels.json). Carrots use raw peeled/chopped .83, onions raw peeled/chopped .88, tomatoes raw diced .87, from the matching [USDA Food Buying Guide](https://foodbuyingguide.fns.usda.gov/files/Reports/USDA_FBG_Section2_VegetablesYieldTable.pdf). Oats uses the mapped [original 42 oz label](https://www.kroger.com/p/kroger-old-fashioned-oats/0001111076655), not convenient generic macros: dry 40 g serving multiplied by 100/40. Oats is conservatively gluten-excluded. All cross-contact remains unverified.

Pea powder is mapped to 32 oz peanut powder, not authored 1 lb pea isolate. Plain almond yogurt is mapped to vanilla almond yogurt; the cached soy records remain rejected. Original-source NOW/Naked pea and Silk/Simple Truth plain almond comparisons are saved, not selected. The founder must deliberately establish a product and compatible purchase/price identity before either enters a reviewed catalog. Whole russet raw identity is now documented as FDC 170027 rather than skin-only 170032, but a matching unrestricted raw skin-on purchase yield is still unavailable. Cooked or size-specific rows cannot repair it by assumption. All remain blocked; no underlying cache or published coverage was silently altered.

For example, seed 0 buys two 2 lb whole-carrot bags: 1814.368 g purchased. The authored 1480 g peeled raw carrot needs 1480/.83 = 1783.132530 g physical carrot. Planned preparation refuse is 303.132530 g; unprepared physical carryover is 31.235470 g. Only 1480 × .93/100 = 13.764 g protein and 1480 × 41/100 = 606.8 kcal count. The two whole packs cost 372 estimated cents. At seeds 7/19, carrot portions are 1500 g, estimated refuse 307.228916 g and carryover 7.139084 g, still two packs. No cooking water adds nutrients or gets priced as food.

All typical weeks buy twelve eggs, five 12 oz shelled-edamame bags, three 1 lb dry-lentil bags, one 1 lb plain-turkey reference pack, two 12 oz broccoli bags, two carrot bags, one each of 42 oz oats, 2 lb brown rice, 5 lb white rice, 1 lb quinoa, 3 lb onions and 1 lb tomatoes. Exact portions vary by seed and are preserved in the acceptance file. Shelf-stable carryover is substantial and explicit: for example 790.679 g dry oats and 1867.96–2027.96 g dry white rice remain. Frozen carryover is also retained. Preparation refuse is not mislabeled as edible leftovers, and these weeks are not zero-waste.

Recalculation uses the unchanged shared unit constants: 1 lb = 453.592 g and 1 oz = 28.3495 g. These are the kernel's rounded conversion constants, not newly measured pack weights or a claim of that many digits of food precision. The full decimals preserve arithmetic; nutrient evidence remains generic USDA precision or rounded original label precision. Eggs use 50 g edible contents per large egg, not purchased shell mass.

Price trace found that the old fetcher normalized different package sizes and even some different food forms into authored packs. Staging retains five identity/size-matched historical observations and records excluded original rows. Other foods use unchanged authored baseline × store-index reference estimates with the existing one-time buffer. This introduces no new price, date or public fallback policy and does not establish store availability. Source-reviewed ordinary foods remain explicitly generic, not bindings to arbitrary branded labels. Fixed chicken packs and unsupported observations cannot enter this acceptance proof as verified offers.

## Catalog, compatibility and verification

Targeted batch: **81 drafts, 81 unique, 81 structurally valid, 63 review-ready, 63 explicitly approved, 18 quarantined**. Twenty-one families and 42 variants use the existing authored compiler. Nine savory-oat breakfasts and 54 grain/lentil mains use substantial portions, complete ingredient-matched original directions and neutral photos. Eighteen chicken drafts remain quarantined. Prior 4,704 drafts/66 approvals are retained as earlier evidence, not added to these counts or used as anchors. Approval is digest-pinned and does not happen during generation.

The additive internal bridge projects edible quantity `q` to purchased-equivalent `q/y` and nutrients `N` to `N*y`. Product pack labels/density stay physical; nutrients cancel to `N*q`. Source values, edible recipes and all independently recalculated reports stay unmodified. The projected artifact is explicitly private and must never be served as edible per-100-g data. [App handoff](app-handoff.md) describes the separately authorized public transition and recovery. Public Snapshot/SolveInput, solver core, app, public fixtures and snapshot bytes are unchanged.

Fresh final gates: **151/151 tests** (25.52 s), ordinary `npx tsc --noEmit`, lint, voice, build and diff check pass. No nonincremental fallback or failed-build retry required. Lint keeps one old unused `_digest` warning; build keeps Edge Runtime deprecation/static-generation warnings. Intentional mocked failure logs in tests are not live database failures. A deliberately reintroduced naive quantity path failed the carrot regression before reciprocal conversion was restored. Final inspection also reproduced an oat mass-unit/direction inconsistency before fixing its renderer; the tenth new regression passes. Standard g-based catalog/output digests remain unchanged. Old 66-approval output compatibility remains tested.

Standalone desktop run: Node v24.17.0, Windows 10.0.26200, i5-14400F, 16 logical CPUs, about 16 GB RAM. Compilation 19.95 ms; first typical solve in a fresh process 333.68 ms, warm repeat 289.24 ms. Eighteen-case median first/repeat 960.87/955.69 ms; maximum first solve 1899.95 ms. Maximum sampled RSS 153.86 MB, not isolated peak. There are 63 searchable recipes, below the unchanged 96 cap; restricted pools are smaller. File/OS caches were not cleared. These measurements were rerun without concurrent test/build commands and do not prove iPhone performance.

Digests (SHA-256):

- Edible catalog: `a971155991e05dfd4f82946998f6ac473b5dff47f35671f62152da38a7052b0d`
- Source/review: `62a3e341e143cb4dce2a2b76f6b29a576bdcdd2ee8546301e513db57e311c529`
- Approval: `dfdaace17e25c8495ad43b1f866370b083cd087f482c7a449dc3bd495f7794e4`
- Candidates: `d63392fdbb5af49035ec230718e9bb348e8a0faf5055c36d00433ae750da0020`

Implementation files: scripts/data/reviewed-week.ts, reviewed-week-sources.ts, reviewed-week-acceptance.ts, reviewed-week.test.ts and narrow catalog-expansion.ts preparation support. Checkpoints: tasks/REVIEWED-WEEK-PLAN.md and PROGRESS.md. Staging: data/pipeline/reviewed-week/. Caveman investigate-first located nutrition/pack mechanisms; lean-build reused the compiler; migration kept the quantity transition private/additive; verify-and-stop bounded acceptance. Humanize-writing shaped the notes; PDF skill helped read USDA tables. Terminal rg/Node/tests and free original-source web/API reads helped. Context7 was absent; Serena lacked its required initialization tool and was unused. Browser, Expo, database, RevenueCat and other workflows were unused. The unrelated terminal hook was not changed; no new hook error surfaced in tool results.

No deployment, push, PR, production storage/database, app/website edit, paid call, account configuration or message occurred. Only authorized local backend artifacts, Git checkpoints and WiseDinner memory notes change. Implementation commit: `992835c`. The inspected durable handoff is saved separately as `docs(data): save reviewed-week acceptance`; its final SHA and clean-tree verification are reported in the terminal handoff. The execution plan records the checkpoint and exact continuation.

Next safe workstream: reviewed-only restricted-diet coverage. First obtain the full original panel/composition for the existing dry-pasta SKU and a matching dry purchasable pack, then review a meaningful plant-based preparation to address the vegan/vegetarian item gap without token additions. Rebalance from supported ingredients rather than relaxing lentil share or 180 g targets. Package choices, kitchen testing, public quantity/allergy adapters and iPhone checks remain separate, unconnected work.
