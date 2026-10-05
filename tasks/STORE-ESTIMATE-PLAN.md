# Store-adjusted estimates, October 5, 2026

## Current founder instruction

Do not reserve an arbitrary extra $5 or 10% of entered budget. The founder wants estimates based on chosen-store pricing behavior, location/category adjustments and a measured uncertainty safety formula, with multiple selected stores. Give a higher-budget example only after verifying a suitable week at that budget. Industry onboarding research comes before further implementation. Keep original price/source evidence internally; product source citations are not requested.

Research: `C:/Users/borgh/Projects/wisedinner-app/reports/WiseDinner onboarding and price logic.md`, with three cited notes in the matching research_notes folder. Read these before continuing. HelloFresh's US web profile was inspected through registration without signup; Cal AI's complete native questionnaire was not observed. Do not copy competitors' checkout, body/medical questions or trial durations. Current launch remains Apple/Google/email accounts, eligible required 14-day auto-renewable trial or verified active access, included rerolls, optional notifications, little waste and $8.99/$48.

## Existing system

ZIP and one-to-three chain/banner choices already exist. They are not exact physical-store identity. Existing prices use observations or raw baseline × index, then one 1.1 uplift. ZIP-prefix fallback is not geographic validation; authored indices mix benchmarks and editorial assumptions, not calibrated universal markups. App bundled per-store prices are absent. Do not claim these choices already produce accurate local prices.

Six migrations, real Auth/PostgREST/provider/native/worker proof and public food/price closure remain open. Current app eight questions already cover budget, protein, calories, diet, allergies, household, stores and pantry/kitchen. Strict allergies/diets are separate from soft tastes. Preserve per-person goals versus whole-household grocery budget, true consumption/yield and whole-pack purchases. Revalidate the week after profile/pantry changes and rerolls. Grocery-addition reroll policy, email mode, restore transfer, unsupported-area display/freshness/accuracy thresholds, legal/retention and release choices remain unresolved.

## Next safe local slice

### Authorized implementation checkpoint, October 5

The founder said "ok lets go" after the local estimator scope was described. Starting clean backend HEAD f572d29 on codex/backend-readiness. Implement private pure store quotes, joint-cell adjustment fitting, independent basket calibration/evaluation and a reviewed-week bridge. Reuse existing physical pantry/source checks. No public/app/core/schema/source collection or production changes. No new dependency. Fixture thresholds are test parameters, never launch policy.

Owned new paths: scripts/data/store-estimate-model.ts, store-estimates.ts, store-estimate-week.ts, store-estimates.test.ts, store-estimate-acceptance.ts, docs/STORE-ESTIMATES-LOCAL.md and isolated data/pipeline/store-estimates outputs. Checkpoint docs: this plan, tasks/QUEUE.md and tasks/PROGRESS.md. Run focused tests, full npm test, ordinary typecheck/lint/voice/build and scoped diff checks sequentially. Inspect the actual diff before any local commit; never push. Stop after acceptance and save exact source/calibration and remaining real-data/native gates.

Terminal handoff: the founder clarified that the large workflow must run in Codex CLI. The desktop chat stopped implementation after the one untested model file; no focused test or full gate has run for it. The complete continuation prompt and one-shot launcher are saved outside Git at C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/terminal-runs/store-estimates-2026-10-05-01/. CLI launch/status is recorded there. Only the terminal worker may continue implementation after it starts; the desktop chat may inspect status/read results, not compete as a second writer.

Create a pure fixture-only quote/estimate contract and independent evaluation harness, reusing pack/pantry/provenance/staging seams. Use an exact permitted physical-store raw offer when available, otherwise a dated baseline with jointly fitted store/category/region effects. Sum whole packs after valid physical pantry coverage, then add one independently calibrated one-sided basket error allowance. Compare that guarded estimated total with the actual budget, with no arbitrary unused-money rule.

The learned allowance and legacy 1.1 method are mutually exclusive for a quote. Preserve legacy production behavior until an approved validated rollout. No numerical coverage target, minimum sample size, freshness cutoff, model factor or universal safety percentage is measured/approved. Freeze fitted/calibration data and model before testing optimizer-selected held-out baskets. Respect store, region, channel, category and pack support. Limited/unknown evidence must not become a verified local quote.

Return per-store whole-basket estimates. Split-shopping must assign every purchased pack to an actual selected store and have supported evidence/calibration for the combined strategy. A generic cheaper unassigned fallback is not a purchasable offer. Travel, fees, availability and unsupported-area policy are unresolved; do not silently include them or force extra trips. A higher-budget example must pass all food rules and price gates again; it is not a proven global minimum or a cure for missing ingredient/allergy coverage.

Done means: cent/pack correctness, existing one-to-three selections, stale/unsupported/unpermitted evidence, mutually exclusive guards, correlated basket error, model-version freezing, selected-store realizability, deterministic outputs, pantry/yield correctness and full-week edit/reroll/higher-budget checks. Keep private prototype versus public shape/app rollout distinct. No ce_ changes, shared SQL, public data/API, app/website code, collection, provider activation, deployment, remote push or spending.

## Material gates

### CLI baseline and implementation sequence, October 5 at 14:34 ET

Actual branch codex/backend-readiness, HEAD f572d29. Inspected starting dirty files were only the owned model prototype and two checkpoint documents. Required reads completed in bounded sections; no missing context. Baseline npm test passed 220/220 in 35,262.9089 ms. No other writer or service was started.

1. Verify the frozen raw model and independent full-basket calibration with mutation/time/scope regressions.
2. Implement private exact-cent whole-pack quotes, physical pantry and explicit single/split strategies. Bound exhaustive pack enumeration; exhaustion is unknown, never an invented minimum.
3. Reuse the reviewed staging/evaluation seam for independent food checks and isolated synthetic-price acceptance across six profiles and three seeds.
4. Run all package gates sequentially, inspect exact owned diffs, save documentation/memory and local commits. Rollback is to stop using these private modules and retain prior artifacts; no production behavior changes.

Next exact check: finish baseline npm test, then node --test scripts/data/store-estimates.test.ts. All new acceptance output must use a newly created data/pipeline/store-estimates run directory. No launch freshness/accuracy or reroll rule is selected.

### Terminal review checkpoint, October 5

Sole CLI writer confirmed branch codex/backend-readiness and f572d29 with only the three owned partial paths dirty. Required context was read, including the retailer follow-up under the app research_notes folder. Correction after full source inspection: the prototype already contained derivation replay and source/date pins. This run adds current model freshness at calibration, strict phase order and global declared-unit separation. Checksums remain integrity checks only. No production/core/app or provider work started.

### Private arithmetic checkpoint, October 5

Eleven focused tests pass (250.4314 ms): rational cents, physical packs/pantry, perishable carryover, exact versus modeled cells, ordered stores/split, source/eligibility/date rejection and frozen calibration/held-out boundaries. New owned files: store-estimates.ts, store-estimate-week.ts, store-estimate-fixtures.ts and store-estimates.test.ts alongside the reviewed model. Ordinary typecheck exposed ES2017-incompatible BigInt literals; corrected to BigInt constructors without changing tsconfig. Typecheck recheck and all final gates remain unfinished. No acceptance artifacts written yet. Next: implement isolated acceptance with independent calibration weeks and held-out profile/seed weeks, then test the bridge and rerun typecheck.

Kroger's rendered official public-API acceptable-use page restricts cross-retailer comparisons, modifying returned product values such as price and systematic collection into a database. Obtain separately permitted/licensed evidence or written authorization before this collection/model use. This is not authority to change existing production schedules: https://developer.kroger.com/documentation/public/getting-started/acceptable-use . Check all provider contracts, including any attribution condition.

Its official Postman documentation says filter.productId ignores other parameters; the collector currently combines it with filter.locationId. Verify physical-location anchoring before a separately permitted collection run. This is documentary, not a reproduced API failure: https://www.postman.com/kroger/the-kroger-co-s-public-workspace/documentation/ki6utqb/kroger-public-apis .

Read-only app inspection found a latent bestPerItem concern in src/data/snapshot.ts: a row starts at the generic base estimate and changes only for a cheaper chosen-store price, potentially retaining an unassigned row. Reproduce before separately scoped app integration work; no observed customer/device failure or app fix is claimed.

BLS broad food averages can inform a dated reference, not a chain-specific exact local pack quote; CPI city ratios are not geographic price-level ratios. Current USDA F-MAP published data covers 2012–2018 despite its recent page update. Primary citations and limitations are beside findings in the research.

### Reviewed bridge and staging checkpoint, October 5

Fifteen focused tests pass (1,499.9876 ms); ordinary typecheck passes after the BigInt syntax correction. Reviewed bridge pins the current approved catalog, source, exact profile/allergies and frozen calibration revision. Physical quantities derive from unit constants before multiplication, with no epsilon pack rounding. First isolated acceptance attempt failed on a floating-point legacy pack-size residue; second completed all eighteen primary profile cases but failed on the runner's shortened `floor` profile-name lookup. Both partial folders remain intact. Corrected runner uses `floor budget`, independent calibration seeds 101–109, physical pantry examples, current source/profile pins and honest process-cold measurement. Current full acceptance is running in `data/pipeline/store-estimates/2026-10-05-cli-verified/`; outputs are exclusive writes to that new folder. All final gates, complete acceptance extras and local commits remain unfinished. Next exact action: collect that runner result, run focused tests/typecheck again, then sequential full gates. No external state changed.

### Verified completion checkpoint, October 5 at 15:16 ET

Branch codex/backend-readiness; source commit `5f860e0` after `f572d29`, seven inspected run-owned source/test files, 600 added lines. No concurrent files found. Complete evidence `data/pipeline/store-estimates/2026-10-05-cli-final/`, report SHA-256 `011a5a9c78a542610722b4c3e6c0336fd813824af053e1d7c4d8066b6ac57ecf`. Earlier three partial folders are preserved; none is accepted or overwrites previous evidence.

All six profiles at seeds 0/7/19 pass food, raw-pack/allowance/charge budgets and repeat full-output determinism under fictional prices. 1,270 full-week substitute cases pass; not a recipe count or reroll-rule approval. Existing catalog remains 132 distinct structures, 108 explicitly internal approvals, 24 quarantine, fourteen reviewed food IDs and zero kitchen proof. Source/catalog/approval digests unchanged. Thirty declared fit units, 324 calibration units/36 scopes and 72 held-out units; adverse synthetic held-out errors overrun the allowance in 48/72 cases, maximum 141 cents. This is not approval of accuracy, independence or fixture policy thresholds.

Actual soy restriction filters all 108 preparations and cannot produce a reviewed breakfast; recorded as food coverage, not repaired with old data. Unknown safety likewise yields an empty restricted pool. Profile protein edit fails food despite a price pass. Higher-budget candidate is regenerated/rechecked; missing offers still fail coverage at that higher budget. Pantry example preserves consumed nutrients/trim and reports actual physical carryover without claiming savings when pack count is unchanged.

Checks complete: focused 16/16 (1565.113 ms), final full npm test 236/236 (41806.6746 ms), ordinary tsc --noEmit, zero-warning lint, voice, production build and unstaged/staged diff checks all pass. Existing Edge Runtime warnings only; expected mocked app_config diagnostics remain. No incremental fallback, dependency/tool setup, hook changes or new SQL. Existing full-suite disposable database tests ran as usual; shared database untouched. Cold-process solve 581.4628 ms, warm 516.51 ms, primary timings roughly 348–669 ms, 96 cap unchanged; not iPhone proof.

Relevant HQ memory/log updated in place with history preserved. Code and acceptance complete; report/queue/plan/progress are included in the final documentation commit. No code gate or acceptance check remains unrun. Rollback: stop using private modules, retain previous outputs; no public/core/app/website/production data changed. Exact final checks after that commit: `git status --short`, `git diff --check` and `git log -2 --oneline`, then stop. Next workstream is separate app account/trial/configuration handoff from the queue; real pricing activation additionally needs permitted feeds and independent measured calibration plus founder freshness/accuracy/fallback decisions. Do not begin it in this run.

### Exact-cent final checkpoint, October 5

Current source HEAD `5289f64`, after `5f860e0` and starting `f572d29`. Final review reproduced the legacy profile bridge incorrectly rejecting $64.01 because floating multiplication produces 6401.000000000001. Exact rational conversion replaces that comparison without accepting fractional cents. Regression fails before and passes after the fix. Latest focused 17/17 (1814.6541 ms), full 237/237 (43235.4873 ms), ordinary tsc, zero-warning lint, voice/build/diff pass. Eighteen stored primary acceptance weeks replay identically through final code; all prior evidence bytes/digests and 1,270 integer-budget candidate results remain applicable. Only four inspected documentation paths are staged for the final local handoff commit; HQ relevant state/history/log saved. Next exact action: that docs commit, `git status --short`, `git diff --check`, `git log -3 --oneline`, then stop. No other workstream or external mutation.

## Ingredient coverage and saved checkpoint

Expand verified food forms, real packs, yields and useful preparations, especially affordable plant proteins/breakfasts and restricted-diet gaps. Current fourteen source/quantity-ready IDs are unchanged. Vegan can use eleven reviewed ingredients and two qualifying protein sources. Existing canned-legume/tofu candidates need original matching panel, identity, purchase basis/yield review; no automatic brand choice, source approval or inflated count occurred.

The misunderstood reserve prototype passed 230 tests and one complete private 36-case experiment, then its owned source/test/runner changes were removed after the correction. Solver matches starting HEAD 22578f4 exactly. Fresh restored-source tests pass 220/220 in 35.963 seconds with no failures/skips. Private first evidence remains in data/pipeline/budget-reserve/2026-10-05-first; interrupted final evidence is partial. Historical tasks/BUDGET-RESERVE-PLAN.md must not resume. No account, trial, order, customer message, paid action or remote change happened. Large implementation work remains terminal-first; no new prompt submitted.
