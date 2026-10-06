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
