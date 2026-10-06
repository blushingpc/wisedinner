# Verified continuation: price time and requested-location admission

October 6, 2026. LOCAL acceptance passed. Source/test commit `066b41dcfa249351b7dd7b8bae1d48d936b1e9fb` closes the current-use price admission gap and default-off local staging bypass. Launch-ready remains NO. This does not configure a production freshness duration, authenticate a clock, establish real physical-store coverage or prove measured prices.

Current evidence: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-06T22-18-35-693Z-e794db71/price-admission-evidence`. The initial HEAD was report-only `3b45397b3dd9827c08607cee08250bd77a162a86`, branch `codex/backend-readiness`, empty index. The coordinator's independently tested resource lifecycle recovery was read, not modified. The current source/test bytes equal the prepared prior patch; no verification-driven product edit was needed. Original first-run failures and all 34 prior sealed artifacts remain hash-equal and read-only.

## Current behavior and exact local proof

Historical `observationValid` is byte-identical to its original implementation. It still verifies immutable observation/mapping/pack integrity independently of current freshness. The new admission context requires canonical UTC time supplied by a trusted caller, an explicit nonblank policy revision, nonnegative safe-integer maximum age and exact supported store/physical-location/ZIP/instore registry. Observations must be no later than that clock and no older than the supplied age. Exact age equality and zero-age same-instant controls admit; one millisecond beyond either bound holds. Missing/invalid policy or clock, unsupported/mismatched identity, malformed mapping/pack/cents, unknown SKU and duplicate observations hold. No date or identity is rewritten, no cents are rounded, and no alternate location is selected.

The single requested physical-location seam rejects all ambiguous duplicate SKU observations, including mixed-location records. Original accepted inputs and supplied context remain unchanged. Policy revision and support entries are declarations requiring outside review and authentic source evidence; they are not proof of either. A valid caller-supplied future clock cannot be independently authenticated by this pure layer. The clock trust binding remains a production requirement.

The actual compiled `stagedPipeline` calls this gate before assembly. Missing context, future/stale/other-location rows and duplicates produce assembly0/staging0/core0 in explicit synthetic ports and only the blocked local manifest write1. The valid control produces assembly1/staging1/file-write3; it intentionally uses mocked assembly/publication and is NOT actual solver/publication acceptance. Unexpected imports and core execution are trapped. The existing CLI supplies no context and remains held. The snapshot DTO, legacy assembler, public/private shared API contracts and all activation flags are unchanged. Mixed-location cache grouping, reviewed policy and trusted clock/location binding are not activated by this job.

All fixture prices, source references and one-day policy values are synthetic test inputs. These checks do not certify retailer/source accuracy, legal price freshness promises, real kitchen/food data or compatible backend-v6/app content.

## Fresh commands and results

Every test/compiler/lint/suite command used `C:/Program Files/nodejs/node.exe backend-loop/lane-driver.mjs --resource A --` with the exact child executable and arguments recorded in the named JSON. No wrapper bypass, lock/control edit, install, configuration bootstrap, process stop or extra service occurred.

| Check | Start / finish UTC | Result | Exact log / command record |
| --- | --- | --- | --- |
| `node --test scripts/data/price-admission.test.ts scripts/data/price-evidence.test.ts packages/solver/test/snapshot.test.ts` | 22:19:43.169 / 22:19:46.164 | 23/23, exit0 | `focused-1.log`, `focused-1.json` |
| Installed `node node_modules/typescript/bin/tsc --noEmit`, unchanged project configuration | 22:20:03.308 / 22:20:13.585 | exit0 | `typecheck-1.log`, `typecheck-1.json` |
| Installed ESLint, only the three owned source/test files | 22:20:25.699 / 22:21:09.175 | exit0, no diagnostics | `lint-1.log`, `lint-1.json` |
| Existing ordinary `npm test` through bundled pwsh | 22:21:33.804 / 22:22:51.564 | 310/310, exit0 | `suite-1.log`, `suite-1.json` |
| Scoped diff/index and exact-byte preservation review | Before commits and final handoff | exit0; index empty | `preservation.json`, final checkpoint and scoped diffs |

The 23 focused tests include 11 new admission tests, 3 existing price-integrity tests and 9 snapshot tests. The original six red-test assertions are retained, not weakened. No new product/test failure or resource hold occurred during this continuation. The original five failures and prior inventory/exit75 attempts below remain historical evidence. The full suite's SQL/provider orchestration tests use local isolated/synthetic infrastructure and do not prove real hosted Auth/PostgREST/contention, native behavior or provider activation. Build/voice/native/device/export/hosted/provider checks were not rerun; no broad build was required for this narrow source gate. Compiler and scoped lint were available, not bootstrapped.

## Preservation, commits and recovery

Verified 1,062 unowned backend file pins, including core, authored data, dependencies, snapshots, contracts and migration bytes; four supplied cross-lane API pins match. Existing queue bytes remain exact and unstaged. The entire prepared progress prefix remains exact; this continuation appends only its owned checkpoint. Source/test bytes remained exact throughout verification. Original report and prepared source/test/progress bytes are frozen in current-run evidence; original red source/tests/logs are separate. Final file hashes, command exits, exact branch/HEAD/index/diff and closed evidence index are recorded outside Git after writers finish. No app, website, engine, shared notes/HQ, managed skill or controller file was written. No push/merge/external action occurred.

Owned runtime/test files are `scripts/data/price-evidence.ts`, `scripts/data/staged-pipeline.ts` and `scripts/data/price-admission.test.ts`. The current report commit and exact final HEAD are recorded in `checkpoint-final.json` outside the self-referential report commit. Original report-only checkpoint commit `3b45397` remains history. Existing progress/queue dirt is kept unstaged; source/test and report commits contain no evidence/media/secrets/user-file additions.

Rollback: independently review a scoped revert of `066b41dcfa249351b7dd7b8bae1d48d936b1e9fb` affecting only its three files, plus a separate reviewed report-only revert if needed. This restores the reproduced unsafe historic-only admission behavior; keep publication unbound. Revert only the owned progress addition using the saved prefix, never reset/stash/rewrite history or include user queue changes. No migration, provider or external operation requires replay/rollback because none ran.

Learning: no supported original-skill decision defect. The coordinator repaired its proven operational lifecycle issue separately; this worker neither changed controls nor adopted a skill/cache supplement. Normal, boundary, refusal and no-context authority cases pass locally. See current run `learning-result.md`.

## Remaining gates and proposed handoff

Production admission still needs a reviewed duration and authentic location/source registry with a trusted clock binding. Synthetic hash integrity is not measured accuracy; fictional pricing/calibration evidence and authentic real-store price coverage stay separate. Native accounts/secure persistence/RevenueCat/recent-auth and real login/purchase/restore/deletion, provider callbacks/SMTP/products/eligible trial, hosted Auth/PostgREST/contention and eight unapplied migrations, food/package/yield/kitchen/cross-contact/restricted coverage, content compatibility, legal/listing/device and rollout acceptance remain open. Newer email/reroll/restore decisions are settled delegation, not repeated generic choice requests. No current deadline, suite count or local gate is a release certification.

Stop for independent supervisor review. One specific unblocked proposal is a read-only official-source freshness/location policy and trust-binding brief for this existing seam, reconciling `docs/PRICE-PUBLICATION-SAFETY.md`, `scripts/data/price-evidence.ts` and the default-off staging caller. Separate evidence-supported policy choices from unavailable measured coverage; do not activate providers/publication, bind a production clock or choose unsupported accuracy promises. That proposed job has not started and needs its own review.

## Original blocked checkpoint, preserved as history

# Price time and requested-location admission, October 6, 2026

Status: BLOCKED checkpoint. The original bug is reproduced; the narrow implementation and expanded tests are pending verification. No launch gate is closed by this checkpoint. Verification level is local original-code tests only, with synthetic prices and policy. Launch-ready remains NO.

Backend started at `a57d63f19b1c5e4864fdfe911faa1c79f5d5f487` on `codex/backend-readiness`. Sole lane A thread: `01a10daf-5f2e-7903-82b3-604d3ac40ac7`. Evidence is exclusively in `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-06T21-30-27-818Z-ba39486c/price-admission-evidence`. The controller, app, website, engine, shared notes and managed skills were not edited.

## Original reproduction

Actual untouched `quarantinePrices` and `observationValid` were exercised before runtime edits. The six collected tests produced one pass and five failures. Historical integrity remained true for the future, expired and other-location controls; all were admitted. Missing policy admitted one row, and duplicate observations admitted both. A fresh exact location and the exact synthetic age boundary passed as positive controls. Original source, original collected tests and complete failing assertions are saved separately in `originals/` and `red-approved.log`.

The fixture uses a synthetic 249-cent lentil offer, synthetic physical location, example.invalid review reference and a one-day TEST policy. None is measured store evidence or an adopted production duration. No credentials, provider calls or customer data were used.

## Proposed narrow change, UNVERIFIED

`scripts/data/price-evidence.ts` retains `observationValid` unchanged as historical integrity. A separate current-use layer requires a supplied trusted UTC clock, nonblank policy revision, safe-integer nonnegative maximum age, explicit supported-location registry and exact requested store/physical location/ZIP/instore channel. There is no ambient clock, age default, new date, fallback store/ZIP, remapping or price rounding. Supported store IDs are limited to the existing Kroger-source authored store IDs; that list alone does not establish physical coverage.

Admission requires original mapping/pack integrity and positive safe-integer cents. Future observations and ages greater than the supplied maximum hold; equality is intended to admit. Duplicate SKU observations for this single requested location hold all ambiguous records, including mixed-location duplicates. Unknown/malformed records hold. No measured accuracy, source authenticity or policy approval can be inferred merely from a caller-supplied revision or registry. The clock is a caller trust requirement; this seam cannot authenticate whether an otherwise valid supplied clock reflects real current time.

`scripts/data/staged-pipeline.ts` accepts an optional explicit context and holds before snapshot assembly when context is invalid/missing, any row is quarantined, or none is accepted. Existing CLI staging supplies no context and therefore remains held. This is an isolated local staging consumer, with no publication activation or shared DTO change. A reviewed production duration, authentic physical-location registry, trusted clock binding and appropriate single-location cache selection remain consumer prerequisites. `scripts/data/snapshot.ts` itself is unchanged: its legacy row DTO lacks physical-location/channel/provenance evidence and is not independently certified by this seam. Mixed-location caches are not silently selected or repaired.

The new test file expands future/expired/exact-boundary, zero-age, malformed clock/policy, ZIP/store/location/channel, immutable mapping/pack/cents, duplicate/unsupported record, unchanged-input and actual compiled staging controls. Staging is transpiled with installed TypeScript and explicit synthetic filesystem/assembly/core/publication ports; it is designed to trap unexpected imports/effects and distinguish admission dispatch from real solver/provider proof. These expanded tests have NOT RUN.

## Actual command outcomes and resource blocker

All test attempts used the required `node lane-driver.mjs --resource A -- node --test ...` wrapper. No direct test, compiler, lint, suite, build or heavy-command bypass occurred.

| Attempt | Actual result | Evidence |
| --- | --- | --- |
| First sandbox original-regression attempt | Exit 1, inventory/configuration unavailable; tests not started | `red.log` |
| Approved same-scope original-regression retry | Six actual original tests: 1 pass, 5 fail; wrapper exit 1 and additional inventory/ownership failure | `red-approved.log` |
| Focused current price/adjacent snapshot attempt | Exit 75, resource slot busy or uncertain; tests not started | `focused-1.log` |
| Retry after light source/diff review | Exit 75, same fence; tests not started | `focused-retry-2.log` |
| Read-only lane status and exact process inventory | Exit 0; matching current A owner/thread, enabled workflow; fence owner absent | `checkpoint-resource-hold.md`, final checkpoint evidence |
| Scoped Git diff/whitespace review | Exit 0 | final checkpoint evidence |

The original wrapper left `resource.lock` recording PID25724, created at `2026-10-06T21:36:39.2112990Z`, lane A/current run, child null. Independent read-only inventory at `2026-10-06T21:39:01.2131031Z` found that PID absent and no immediate descendants. A fast-child identity capture race is consistent with the wrapper source, but its hidden exception has not been proven. This worker did not remove the fence, alter the wrapper, kill any process or infer authorization to bypass uncertainty. Coordinator-owned diagnosis/reconciliation is required before more heavy checks.

Focused green, adjacent snapshot, ordinary typecheck, scoped lint and complete backend suite are UNRUN, not failed product checks or passes. Backend compiler/lint prerequisites are inspected read-only; no dependency installation or configuration change is authorized. Voice/build/export/native/hosted/provider checks are unrun. Prior backend/app suite results are historical and are not fresh acceptance of this patch. No broad build is needed to diagnose the fence.

## Preservation, commits and rollback

Initial backend file pins, original bytes, command records, final frozen owned files, scoped diff, preservation comparison and sealed evidence index are saved under the evidence directory. The four supplied account/billing contract pins matched before work. Existing `tasks/QUEUE.md` dirt is preserved byte-for-byte and unstaged. Core, authored data, snapshots, dependencies, flags, shared contracts, eight migration files and all unowned backend files must match the before pins at handoff. App/website/shared-note files were read-only; this lane does not certify their concurrent state.

No runtime/test commit is made because required verification is held. Any documentation-only report commit and exact final HEAD are recorded in the outside-Git final checkpoint, avoiding a self-referential commit hash. All source changes remain explicitly owned, pending and unstaged. No push or merge occurred.

Rollback is a separately reviewed removal of the exact owned price-evidence/staged-pipeline patch and new price-admission test, using saved originals and final diff. Do not reset/stash the worktree, remove user files, rewrite history or touch controller state. If the checkpoint report is committed, a scoped reviewed revert of that documentation commit is separate from the pending source rollback. Reverting the pending gate would restore the reproduced stale/future/wrong-location admission risk; publication must remain held.

Learning: no supported original-skill fault. The product gate omission and controller inventory failure do not establish a learning-skill decision defect. No skill/cache/authority control changed. See run `learning-result.md`.

## Exact continuation and remaining gates

Coordinator first verifies the fenced owner/child state and reconciles the administrative resource failure under its own authority. Independently review continuation of this SAME A4 job, preserving current pending source and original failures. Resume only through the exclusive wrapper: focused price-admission/price-evidence/snapshot tests, diagnose actual failures, ordinary no-emit typecheck, scoped installed lint, complete backend suite, byte/diff/index checks, then scoped source/test/report commits if accepted. Do not start another job or activate publication.

Freshness/location production policy and authentic measured price coverage remain unproven. Food/package/yield/kitchen/cross-contact/restricted coverage, native accounts/secure persistence/RevenueCat/recent-auth and real login/purchase/restore/deletion, provider callbacks/SMTP/products/eligible trial, hosted Auth/PostgREST/contention and eight unapplied migrations, truthful shared content compatibility, legal/listing/device and rollout acceptance remain open. Newer email/reroll/restore decisions are resolved delegation, not repeated generic founder-choice gates. No paid, provider, shared database, ce_, migration, public release, customer-message or publication action occurred.
