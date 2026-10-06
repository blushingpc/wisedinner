# Reviewed quote binding, local checkpoint

October 5, 2026. LOCAL trusted selection/physical pantry/fixture quote binding preparation is verified. Run `2026-10-06T00-19-42-894Z-33a64672` started backend `3f05db2074b4cedd3ba0d904b195352d1dc53455`. Source commit: `cadbf2457e5ec7184e79aeada4f673e9e9a86830`. App `8a0618be20319c0a5df133a6db5b1420b0171854` remains read-only. This is not launch readiness or live pricing.

The actual accepted soy week fails the legacy pantry bridge because its parent-filtered pool excludes a reviewed breakfast. The new private option `reviewed-family-v1` binds the already accepted trusted family projection to the existing physical pantry and quote boundaries. Omit the option to retain legacy behavior, revisions and output shape. No production flag, public route, solver core, app, snapshot, ingredient, approval or fixture definition changed.

## Compatibility and evidence

Only `evaluateReviewedPantry`, `reviewedRequirements`, `weekSelectionRevision` and `evaluatePricedWeek` accept the final optional strategy argument. The projection is regenerated from trusted source/catalog/candidate/approval/original-family pins. Caller-provided self-hashes or a modified projection cannot authorize it. Selected IDs are evaluated against both projected and original graphs with equal results, then independently checked against original consumed ingredients, source nutrients, household multiplication and raw/edible yields. Existing original repeat caps 3/99/2 and search cap 96 remain.

The new seed-stable policy revision describes implemented family/search/food/pantry/price semantics and includes full trusted provenance. A separate week evidence digest binds IDs, actual input including seed, restrictions, ownership, requirements and pantry. Existing exact requirement/pantry comparisons plus request/input digests bind the current quote. New policy pins never reinterpret historical selection/calibration evidence. $64.01 is valid; $64.011 is rejected.

Pantry is finite physical fractions of the known original unprepared pack, subtracted once before whole-pack purchase rounding. Consumed nutrients and preparation trim remain unchanged; owned and new carryover are explicit. Unknown safety, source/approval/family changes, stale pack basis, duplicate/negative/nonfinite/excessive fractions and legacy infinite-pantry flags fail closed. A cheap quote cannot repair food constraints.

New price acceptance is explicitly fixture-only. A single frozen table supplies 84 fictional offers for the 14 existing reviewed ingredients. Its prices are raw and independent of reference-price buffering or selected ingredient ordering. Single-store alternatives follow chosen store order; explicit split quotes use the existing bounded pack assignment. Exactly one existing whole-basket calibrated allowance is applied, with supported charges and eligibility. Missing offers/model cells, stale model/calibration, unavailable stock, changed store order/region/channel/charges/restrictions or bounded-search failure cannot yield a falsely usable total. A changed scope requires appropriately matched fresh evidence; there is no per-seed calibration policy.

## Verification record

External evidence root: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/runs/2026-10-06T00-19-42-894Z-33a64672`.

- `pre-fix.log`: expected exit 1, real accepted soy selection rejected by the legacy pantry boundary.
- `focused-first.log`: exit 1, 28/30; a stale-policy test mutated shared fixture policy. Narrow request cloning corrected only that test helper. `focused-second.log`: exit 0, 30/30. `focused-third.log`: exit 0, 31/31, including related egg exclusion. All failed evidence preserved.
- `acceptance-first.log` and `quote-first/`: 24 weeks and 381 soy candidates checked before exit 1 from an invalid runner restriction. Gluten was incorrectly supplied as an allergen; the existing boundary correctly denied it. Runner now uses gluten-free diet with soy allergy. No food rule relaxed.
- `typecheck-first.log`: ordinary local `npx.cmd --no-install tsc --noEmit`, exit 0, before the corrected acceptance rerun.
- `acceptance-final.log`, `quote-final/acceptance.json`: exit 0, 189.976 s, 24 actual bounded weeks, 72 zero/partial/over-covered pantry cases. Selected IDs, nutrient/source/household/trim balances, original family counts and raw pack/allowance cents are independently checked. Every solve and quote is replayed deterministically. `evidence-review.mjs`/`evidence-review.json` exits 0 and recomputes all selected family occurrences, 18 exact historical selected outputs and coverage counts. Historical legacy quote outputs are also replayed exactly against their original frozen inputs, with before/after file digests unchanged.
- 30 fit units, 297 calibration units across 33 scopes, 96 held-out units; all are fictional declared units. Actual bounded weeks at calibration seeds 101–109 precede held-out seeds 0/7/19 in the experiment. Fit observed Sept 30/frozen Oct 1, calibration Oct 2/frozen Oct 2, held-out Oct 3, fixture clock Oct 5. Phase/record/unit separation is verified with the existing unchanged machinery. Adverse synthetic held-out overruns remain **64/96, maximum 137 cents**. No model/policy was changed to hide them; they are different fixture evidence from the preserved old 48/72/max141c results, not improved real accuracy.

Zero-pantry explicit split totals below are fictional cents, including the single existing allowance. Ordered single-store alternatives and all pantry variants are in each `week-*.json`; all 72 pantry cases pass full food and synthetic-price feasibility. Selection targets and reference budgets are unchanged.

| Profile | Seeds 0, 7, 19: reference cents | Seeds 0, 7, 19: fictional split cents |
| --- | --- | --- |
| Typical | 4932, 4932, 5074 | 3009, 3009, 3064 |
| Floor budget | 3973, 3973, 4006 | 2475, 2475, 2475 |
| Household of two | 8248, 8235, 8365 | 4317, 4612, 4644 |
| Vegan | 4996, 4996, 4996 | 2900, 2900, 2900 |
| Vegetarian | 5047, 5014, 5047 | 2922, 2922, 2922 |
| Dairy-free, 180 g | 5966, 5845, 6108 | 3151, 3281, 3314 |
| Soy-restricted typical | 5459, 5459, 5459 | 2529, 2529, 2529 |
| Soy-restricted household | 9021, 9021, 9087 | 4164, 4164, 4055 |

All 381 returned soy substitutions pass complete food/family/source/quantity checks and synthetic split-price feasibility with half-pack onion pantry. They span 90 slots; six slots have zero results and 59 hit the six-candidate return cap. A six-result slot is capped coverage, not an exhaustive count. Grocery pack changes are explicit in every candidate's evidence; no shopping/budget policy is selected. Counts in slot order 0–14:

| Week | Per-slot returned counts |
| --- | --- |
| Soy typical, seed 0 | 0,6,6,1,6,6,1,6,6,1,6,6,0,6,3 |
| Soy typical, seed 7 | 1,6,6,0,6,6,1,6,6,1,6,6,0,6,6 |
| Soy typical, seed 19 | 1,6,6,1,6,6,0,6,6,0,6,6,1,6,6 |
| Soy household, each seed 0/7/19 | 1,6,6,1,6,6,1,6,6,1,6,6,1,6,6 |

Fresh genuine misses: soy floor returns a bounded reference-budget miss; soy 180 g misses protein. Vegan/soy has 0 breakfasts/0 mains; vegetarian/soy 3/0; gluten-free/soy and egg/soy each 0/36. No missing-slot solve is fabricated. A reference-budget miss is separate from quote food constraints; new fictional offers do not establish an affordable real week or a global minimum. The focused 300 g case proves cheap price passes while food/access to a usable quote fails.

`quote-final/pins.json` stores full original source/catalog/candidate/purchase/approval/family/input pins and soy provenance. Soy projection remains `f03f57198efa078719ac0ecd2b8a712ac47715a1985e1776f5973efbc17ac73a`; new soy-typical policy is `509a73d0196b7506b409fe8aa2535d98aeabe42b46842ba55acbc49c47d2edb1`. All other policy and per-week/input/request digests are recorded in calibration/week files. Fixed fictional offer digest is `f712b01caaba85c1760fa5af2ea16b4a3c5401a2cd77a698d0ccef44f5bcbc8b`. `phase-evidence.json` contains actual fit/calibration/held-out rows; original observations/pins were never relabeled or overwritten.

| Final gate | Exit | Evidence |
| --- | --- | --- |
| Focused five-file regressions, 31/31 | 0 | focused-final.log, 6.148 s |
| npm.cmd test, 279/279 | 0 | full-test-final.log, 43.399 s |
| npx.cmd --no-install tsc --noEmit, ordinary unchanged project policy | 0 | typecheck-verified.log / exit JSON |
| npm.cmd run lint, no warnings | 0 | lint-final.log / exit JSON |
| npm.cmd run lint:voice | 0 | voice.log / exit JSON |
| npm.cmd run build | 0 | build.log / exit JSON; existing Edge Runtime deprecation |
| git diff --check / staged source check | 0 | diff-check.log / exit JSON and checkpoint |

Full-test.log earlier passed 279/279 (44.476 s); initial lint.log exited 0 with one unused type import warning. Removing only that erased type import led to the final focused/full/typecheck/lint sequence above. Acceptance runtime semantics were unchanged, so saved final acceptance remains applicable. Every pending gate's final exit was collected before starting the next; no runtime/dependency install, modified typecheck or parallel build. Source tracing finds these new paths only in offline scripts, never app/public routes. Snapshot blob remains `d572a3aaecd1626ba5fccf8d9adad18aabe86fba`.

Owned source/test files: reviewed-pantry.ts, store-estimate-week.ts, reviewed-quote-binding.test.ts and reviewed-quote-binding-acceptance.ts under scripts/data. Owned docs: this report, tasks/REVIEWED-QUOTE-BINDING-LOCAL.md and this job's PROGRESS section. Original queue bytes matched queue-original.md before appending only this job's continuation; QUEUE remains unstaged. App PROGRESS/reports/research_notes are preserved, no app write. Generated evidence is outside the backend Git tree and never staged; no secrets, private customer records or media added. A read-only optional backend-loop/.gitignore inspection found no such file; it was not created or used as authority. Final exact source/docs commits, clean-index status and read-only report validation are recorded in external commits.json, checkpoint-worker.md and handoff-preflight.json. No push.

## Remaining launch gates and rollback

This closes only a LOCAL private bridge preparation gate. Reference-priced selection is bounded and conservative, not a globally optimal store-price/pantry solver. Synthetic fit/calibration/held-out measurements establish no measured store accuracy, statistical independence, approved freshness/unsupported-location policy or nationwide savings. Existing fragile vegan reference headroom is no guarantee. Food/source/kitchen/package cross-contact gaps remain; 132 drafts/108 internal approvals/24 quarantine and fourteen reviewed ingredients are unchanged, with no kitchen clearance or package approval increase.

Native Auth/protected persistence, callbacks/SMTP, RevenueCat access, annual product/eligible fourteen-day trial configuration, real login/purchase/restore, hosted Auth/PostgREST/contention, eight unapplied migrations, retention/reroll/restore/price decisions and rollout authority remain open. No provider/device/hosted check ran in this job. October 6 20:50:47 UTC remains a readiness target, not release or activation authority.

Non-destructive rollback: stop passing the optional strategy and preserve the legacy default. Keep all frozen evidence unchanged. A later reviewed granular source revert can remove this opt-in bridge without data migration, resetting the database or changing published data. No skill change was supported or adopted; detailed learning review is external.

Proposed next scoped job for independent supervisor review: prepare a default-off account-scoped billing/access client boundary through the existing private session coordinator and verified backend access contract, with injected dry providers only. Test account switch/logout/delete, stale responses and access denial without granting trial/entitlement locally, loading provider credentials or choosing restore-transfer rules. Native SDK binding, actual purchases and provider configuration remain separate prerequisites. This worker stops here and does not approve or begin that job.
