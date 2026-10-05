# Ingredient safety and catalog execution

Updated: 2026-10-04. Branch: `codex/backend-readiness`. Local implementation only.

## Authority and recovery

No app edits, public snapshot/fixture replacement, database access, publication, paid calls, dependency installation or push. Keep the existing compiler and deterministic solver. Do not alter the paid reroll rule. Internal review sidecars are additive; old snapshot readers remain unchanged. Recovery is to stop using the new offline artifacts, not reset published data. Any later public schema proposal requires a separate approval.

## Milestones

1. Nutrition: document all active SKU outcomes, source identity, food basis, edible yield, pack and density. Preserve import guards. Correct only evidence-backed errors; unresolved IDs cannot enter approved expansion artifacts.
2. Safety: stable-ID sidecar with explicit reviewed/unknown status and inherent allergens/diet categories. Compound packages remain unresolved without labels. Test restricted selection, including variant additions and unknown IDs. Save app compatibility gaps.
3. Compilation and expansion: strengthen the existing compiler, generate original ingredient-matched drafts separately from approval, deduplicate preparation identities, quarantine with reasons, stage outputs locally. Report generated/unique/validated/eligible counts separately.
4. Scaling: baseline first, six acceptance profiles and varied seeds, progressively larger distinct sets, bounded runtime search, deterministic results and unchanged hard constraints. Synthetic stress never counts as reviewed food.
5. Final gates: npm test; npx tsc --noEmit (nonincremental only if cache permission requires); lint; voice; build; git diff --check. Inspect staged ownership before any local commit. Update progress/queue, relevant brain section and dated log with scoped permission if needed.

## Checkpoint 0

- Required dossiers, repo instructions, readiness/API docs, current progress, brain/memory protocol and installation record read. App name-tag/exclusion adapters inspected read-only; unknown names currently return empty lists.
- Dirty files inspected: scripts/data/usda.ts, usda.test.ts (untracked), run.ts, authored/skus.ts, tasks/PROGRESS.md, QUEUE.md, docs/BACKEND-READINESS-2026-10-03.md. These are the reviewed prior nutrition checkpoint; preserve them.
- Current baseline: npm test passed 122/122. Other gates unfinished in this run. No implementation changes yet besides this plan.
- Selected Caveman investigate-first, lean-build, migration and verify-and-stop; humanize-writing for reports. Confirmed installed 3.1.0. Context7 tools absent; Serena required initialization tool absent, so unused. No browser needed.
- Evidence/artifact destination: docs/ingredient-catalog/ for durable review and reports; data/pipeline/ingredient-catalog/ for ignored isolated staging. Neither is a public pointer.
- Next exact action: read original USDA records into isolated evidence staging, compare every cached mapping and quantity basis, then save explicit SKU review outcomes before enabling any approvals.

## Checkpoint 1: nutrition outcomes saved

- Branch unchanged. Prior dirty files preserved. New files: catalog-evidence.ts, catalog-review.ts/test, catalog-report.ts, ingredient-safety.ts, catalog-selection.ts; docs/ingredient-catalog source extracts/review/decisions; this plan. data/usda-map.json now has nine source-precision corrections across seven IDs, not new substitute identities.
- Read-only USDA lookup required normal network escalation, then fetched 73 original records. No DB or production write. All 79 IDs have an explicit nutrition outcome: 10 generic-reviewed, 69 blocked. Package validation remains open. Access dates in evidence are October 5 UTC, session date October 4 local.
- Reproduced failures: rounded ground-turkey protein differed from original 18.73; missing energy was invented during import. Fixed original precision and missing-nutrient rejection. Added skin-only and incomplete-blend identity guards. 15 focused nutrition tests pass. Current full baseline remains 122/122 from before these edits; final full gates pending.
- Outputs: docs/ingredient-catalog/usda-evidence.json, nutrition-review.json/md, safety-review.json, source-decisions.md. Public snapshot/fixtures unchanged. No local commit yet.
- Next exact action: test the stable-ID safety sidecar through actual offline solve and swap entry points, preserve original repeat groups, and save app compatibility evidence. Package-dependent IDs remain unknown.

## Checkpoint 2: internal safety selection verified

- Same branch and preserved prior changes. Added ingredient-safety.test.ts and docs/ingredient-catalog/app-handoff.md. Safety sidecar covers 79/79 IDs and every current compiled row: 25 inherent identities reviewed, 54 unreviewed, all cross-contact unverified.
- Five focused tests pass, including actual solve/substitute selection, unknown IDs, compound sauce additions, all restricted diets, old unrestricted compatibility and clear empty-pool rejection. Nutrition focused tests remain 15 passing. Full final gates pending.
- Offline wrappers only: public API and app remain unconnected. Parent exclusion also excludes variants to preserve repeat-cap grouping. Missing/unknown metadata never means reviewed empty.
- Next exact action: reproduce compiler structural failures, strengthen its existing seam, generate distinct ingredient-matched offline variants with separate draft/approval gates, then stage and report exact counts.

## Checkpoint 3: offline expansion staged

- New compiler regression failed on an unknown ingredient before structural guards; passes afterward. Existing 83-recipe authored output still matches the unchanged draft snapshot exactly. No public data regeneration.
- Generated 4,704, unique 4,704, structurally validated 4,704. Nutrition/safety eligible and explicitly approved: 66; quarantined: 4,638. Approval manifest pins the reviewed revision and names each ID. Nine authored bases plus 57 explicit variants, 10 reviewed generic SKUs. Photos null. Kitchen taste/timing and package cross-contact remain unverified.
- Six expansion/compiler focused tests pass, including stale nutrition/approval, contradictory directions, duplicate identities and existing variant compilation. Nonincremental typecheck passes at this checkpoint. Final full tests/lint/voice/build pending.
- Artifacts: data/pipeline/ingredient-catalog/{candidates,quarantine,eligible-snapshot,eligible-authored,proposed-approval}.json (isolated ignored staging); durable docs/ingredient-catalog/{approval,expansion-report}.json and expansion-review.md. Staged subset is not publishable: only 10 IDs versus the typical 12-item floor.
- Next exact action: benchmark the unchanged 83-recipe draft on six profiles and varied seeds before adding bounded offline pool selection; save progressive-size stress separately from the 66 reviewed preparations.

## Checkpoint 4: mathematical scaling verified

- Baseline: 21 cases on unchanged 83-recipe draft, 18/18 profile/seed cases feasible. New offline shortlist caps runtime search at 96 and retains family links; shared core unchanged. Seven pool/safety focused tests pass. Default incremental `npx tsc --noEmit` passes in this run.
- Scaling: 85 cases at 149, 500, 1,000 and 4,787 entries plus approved-only probe. All 72 ordinary profile/seed cases feasible and deterministic; all hard constraints re-evaluated. Large sets are quarantined synthetic stress, not approval counts. Median times 660/692/654/745 ms; sampled RSS max 375 MB. Legacy-anchor strategy only, not global optimality/device proof. Standalone approved subset is honestly infeasible.
- New files: catalog-pool.ts/test, catalog-benchmark.ts, catalog-scale-benchmark.ts; benchmark JSONs and benchmark-report.md. Internal safety wrappers use the cap. Small catalogs preserve original outputs. Compiler/source/density approvals fail on stale evidence. Public snapshot and app unchanged.
- Checks complete: baseline 122 tests, focused nutrition 15, safety/pool 7, expansion/compiler 6 before final saved-approval assertion; typecheck default and nonincremental; ESLint zero errors, existing support warning; diff check. Full final suite/voice/build still pending.
- Next exact action: run final npm test, voice, typecheck, lint and single production build, inspect all run-owned changes, save final report/queue, then request scoped HQ brain/log update approval. Do not publish or push.

## Final checkpoint

- Branch codex/backend-readiness unchanged. All changes are run-owned or the explicitly reviewed prior seven-file checkpoint. No unrelated dirty files discovered. Local verified commits: adb4de7 nutrition, 7a9739b safety/bounded selection, d214377 recipe expansion. This plan belongs to the final scaling/report checkpoint commit; no push authorized.
- Final gates: 141/141 tests; default incremental typecheck passes; lint zero errors/one existing support warning; voice clean; production build passes after approved font-download retry; existing Edge warnings; diff check passes. No build still running.
- Snapshot bytes unchanged, Git blob d572a3aaecd1626ba5fccf8d9adad18aabe86fba. Fixtures/public pointer/app untouched. Cache still intentionally fails full assembly for five wrong identities and invalid thigh macros.
- Source/metadata/catalog/benchmark evidence and exact unresolved IDs are in docs/ingredient-catalog/final-report.md. Persistent staging remains in data/pipeline/ingredient-catalog/. HQ relevant entry/log appended with scoped approval; history preserved. No external business mutation or paid operation.
- Stopping boundary reached: independent internal implementation verified; no invented source/package evidence. Next exact safe action after a new continuation request: establish actual pea-protein and almond-yogurt packages, obtain original labels/serving basis, record match or explicit nonmatch, then review whole-potato/blend/seasoning and edible yields. Do not publish the subset or wire the app in this run.
