# Restore isolated acceptance preparation, October 7, 2026

LOCAL acceptance preparation now binds the exact ordered nine migration files 0006–0014, including the existing explicit restore SQL. The original inventory and target verifier omission was reproduced before correction. The corrected harness exercises the existing private restore runtime and actual SQL in PGlite memory. This closes the harness coverage gap only. A2/A3/J1, operating monitoring, launch readiness and G remain open.

This is the newly reviewed successor after the restart. The previous observer turn remains FAILED for protocol acceptance. Its source, report, failure records and evidence remain history; this job neither replays its implementation nor converts it into an accepted turn. Current account/trial/included-reroll decisions override obsolete accountless/Free/paid-reroll notes.

## Scope and exact checkpoint

- Root: `C:/Users/borgh/Projects/wisedinner-backend`; branch `codex/backend-readiness`; saved conversation `01a10daf-5f2e-7903-82b3-604d3ac40ac7`.
- Starting HEAD `a10ffbdc6d5ec69d6bf277b307d7909c928f868e`, parent `d6ea4f9abd62c3c9135fba8a50fc9869ae3c364b`, empty index. Initial dirt consisted solely of inherited `tasks/PROGRESS.md` and `tasks/QUEUE.md`.
- Granular harness/test commit `dad005fe7a5029c5531efe7dc6c93d3f1e28051a`, parent exactly the starting HEAD. Its four paths are listed below. No runtime library, HTTP route, migration, schema, DTO, access policy, flag, configuration or dependency changed.
- The separate report commit, final HEAD/parents/status/index/diffs and exact owned note suffixes are recorded in CURRENT `report-commit.json`, `final-preservation.json`, `progress-append.md` and `queue-append.md`. The report commit contains this report only. Notes remain unstaged.
- CURRENT is `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-07T16-11-20-458Z-78a1b10e`. All generated evidence and finite helper files are confined there. Shared controls, other lanes/source roots and HQ remain read-only.

## Original red and narrow correction

CURRENT `omission-red.test.ts` calls the actual existing `migrationInventory` and `verifyIsolatedTarget`. Before edits it independently expected all nine source byte digests and a matching 0006–0014 marker. Both assertions failed against the original eight-file implementation. A third assertion denied the shared target with zero marker requests. `original-omission-red.log` preserves all original assertion output; exit 1, one pass/two failures. These were genuine expected fail-closed assertions, not assertions that accept the old bug. Original source bytes/hashes are in `originals/` and `baseline.json`. The same unchanged three assertions pass within the final focused run.

`scripts/account-isolated.ts` now declares revision `0006-0014` and appends only `0014_wd_billing_restore.sql` to the ordered inventory. Existing exact marker comparison remains responsible for rejecting old 0006–0013 markers, omitted, duplicate, reordered, wrongly named, truncated or tampered 0014 pins before fixture construction/Auth/write. Guard tests use a controlled marker GET, never a hosted target. A matching fake marker is not proof that a server applied or owns the schema. No marker is auto-upgraded.

The existing dry orchestrator uses that revision constant and calls the existing `requestExplicitRestore` and `reconcileExplicitRestore` through injected fixture ports. The memory fixture executes the original nine SQL files, including the actual `wd_restore_command`; this is SQL execution, rather than a request fixture merely claiming SQL ran. Its signed-in projection, identity verification and normalized store evidence are explicitly synthetic. The fixture adapter exposes observation only, with no real purchase/restore/revoke operation. The existing production/private restore implementation is unchanged and remains unbound to authentic provider proof.

| Owned source | Bytes | SHA256 |
| --- | ---: | --- |
| `scripts/account-isolated.ts` | 16926 | `07eeb266270b3fa8c2162828cea15356e7ef7e656ca69318fa7b198de310069f` |
| `scripts/account-isolated.test.ts` | 15631 | `849c7f660e5a74226c192b447283817c0cffdf955eca94327d7033be651b10a5` |
| `scripts/account-isolated-dry.ts` | 17270 | `611304042ce218240d995487be43bc88ec6b9f497ed5b76f76766d702faeb88d` |
| `scripts/account-isolated.fixture.ts` | 12092 | `7052e62bc6b3935cedf8f38a02fac90c534ba373ba776526a64eefd21933f1cc` |

Exact ordered migration lengths/digests are saved in `source-verification.json.inventory` and each named fixture result. Original 0014 remains 17659 bytes, SHA256 `a931ab9de6540c3344a37044e839987676ae0157d20e53b6d1950dbc678f9841`. All nine migration bytes remain unchanged and unapplied to the shared project.

## What actually ran

Every command below ran sequentially through the unchanged Node `lane-driver.mjs --resource A --` wrapper under this lane's ancestry. Complete executable/argument arrays, cwd, externally supplied environment names, UTC times, actual exits and raw redacted output are in corresponding `*.command.json`/`*.log` files. The focused finite child sets only its own `WD_DRY_ACCEPTANCE_EVIDENCE_DIR` to CURRENT; it does not alter persistent environment configuration.

| Command evidence label | UTC start/end on October 7 | Actual result |
| --- | --- | --- |
| `original-omission-red` | 16:15:14.729 / 16:15:17.208 | 1/3 pass, two original failures, exit 1 |
| `focused-first` | 16:19:11.157 / 16:20:06.803 | 42/42, exit 0 |
| `ordinary-typecheck` | 16:20:46.809 / 16:20:55.115 | Existing-config `tsc --noEmit`, exit 0 |
| `scoped-lint` | 16:21:02.953 / 16:21:44.079 | Installed ESLint, the four changed files, exit 0 |
| `full-backend` | 16:22:16.058 / 16:23:30.224 | Fresh `npm test`, 366/366, exit 0 |
| `voice` | 16:24:26.029 / 16:24:28.717 | `npm run lint:voice`, exit 0 |
| `local-build` | 16:24:38.420 / 16:25:05.039 | One fresh `npm run build`, exit 0 |

The focused 42 include 27 actual isolated-harness tests, five existing restore runtime tests, seven existing restore SQL tests and the same three original omission/denial controls. Full-suite totals have no skipped/cancelled/failing tests. Empty successful type/lint logs retain their actual exit records. Existing build Edge Runtime warnings remain in the log; no configuration was changed to suppress them. There were no capacity holds or denied command approvals in this run. The original expected red is the failed check; it is preserved separately and never counted as a pass.

CURRENT `focused-fixtures/` contains 15 closed, exclusively saved named lifecycle traces: the original eleven deletion/outbox cases plus four restore branches. Every named trace records zero global network requests and actual nine-file memory execution/close. The normal branch seeds an existing synthetic source subscription through the actual billing repository/SQL, creates an explicit verified-target intent through the existing runtime, rejects reuse of the operation for another target, reconciles once and reopens through a second call. It proves exactly one active/trial account in memory, source state revoked before new access in the actual SQL commit, target-owned lineage and the unchanged fictional original purchase date `946684800000`.

The additional runner branches prove:

- Missing adapter holds `proof_unavailable` without observation or commit. Unknown source outcome holds `outcome_unknown`; an unrevoked source holds `proof_invalid`. Reconciliation does not silently grant the target.
- Wrong app/product/entitlement/environment/target binding, stale observation and expired entitlement proofs hold before prepare/commit. These seven mutations execute the actual existing runtime/SQL seam; their assertions are in the affected test source and focused log.
- Simulated acknowledgement loss occurs after the real memory SQL commit. The existing reconciler reads back the durable completed result, preserves one owner and does not repeat commit or adapter observation on retry. This is local memory durability during that fixture, not a hosted/process-restart persistence claim.
- Existing restore SQL controls retain interrupted preparation/reconciliation, stale lease, generation conflict, original purchase lineage, revocation prerequisite, other-owner protection, scope/time refusal and idempotency. Existing ownership/deletion/outbox controls and anon/authenticated direct restore-table/RPC denials remain green with emulated claims.

`runIsolated` was never invoked against a hosted target. Its unchanged runner safety tests use invalid relative/repository output paths and refuse before credentials/network. No users were created remotely, credentials loaded, migrations applied remotely, mail sent or real RevenueCat/Apple operation attempted. PGlite roles/claims and fixture app/product/entitlement/transaction IDs and dates do not establish real identity, store ownership, source revocation or native restore.

## Preservation and evidence closure

`baseline.json` records all 1081 original file hashes, initial Git/index/binary diff and exact note originals. `source-verification.json` verifies 1075 whole unchanged files, two exact inherited note prefixes and only four owned source changes. The initial progress prefix is 168821 bytes, SHA256 `6a9f9ecbf25d3769954adcf1ba4e80fdf9ead91724ef35f57a6990449b1e0918`; the queue prefix is 33664 bytes, SHA256 `13442c542ca81044ceb2e255a331fa903b2cc81a031cdbfaab6f9824614a4d5e`. Final checks compare each entire original prefix plus its separately saved owned suffix; inherited history is never staged.

Five private contract records, 258 frozen entries and their four manifest digests remain unchanged: codec `cf66edc566a29075b33b6826a636c3977981a896196b661a15585fc7641ac6dd`, week `853aafe18b369e41bab80d505148c0c18849b0248544e987cad4f45d3f327535`, consumer `8678281284d397f9583f50feb7648070964c7b7188572da9d7c056ab2ff8907c`, context `2c0f71e71ac1a19c0c75654508adb0cf8cc0adfc7b4ae6e858b900a97080f7c0`. They remain UNACCEPTED for shared adoption; v6 and legacy app content are not joined. `prior-history-pins.json` retains the five failed protocol files plus all 131 prior immutable seals, checked read-only. No old run helper was executed as a writer.

Observer/operations/runtime source remains byte-exact. Historical observer source proof is history of the rejected turn, not a newly accepted observer implementation. The fresh mandated full backend suite includes its unchanged regressions; this job made no observer correction or binding change. Snapshot/solver/food/price/account/access/restore runtime, flags, dependencies and migrations remain unchanged.

`source-verification.json` also records clean scoped diff/secret checks, no product-source imports of the dry harness, and no dry restore markers across 193 fresh build server JS files, with the existing account flag as a positive detection control. Generated build files are ignored and absent from the staged changes; no secrets/media/evidence/dependencies are committed.

CURRENT `final-preservation.json` contains exact final Git/source/report diffs, all preservation counts and note suffix evidence. `evidence-index.json` seals closed immutable CURRENT originals/code/fixtures/commands/output/checkpoints only, by exact length/SHA256; it excludes itself and mutable controller/resource/state/result/events/metrics/prompts/reviews/ongoing streams. `reopen.log` and `reopen-verification.json` record a separate finite read-only reopen of those bytes and dependency/source pins. Resource lifecycle evidence is separately recorded in `resource-lifecycle-summary.json`; resource/controller files are not immutable seals. Wrapped children exited naturally with recorded closed/released receipts. The short original red process has unavailable child creation identity, accurately retained rather than fabricated.

The exact fresh regular non-symlink reportPath is preflighted through the unchanged exported `validateResult`; `report-preflight.json` records validator/report bytes and metadata, and the final result uses this exact path. Final report commit/index/reopen evidence lives outside the report to avoid self-hashes, amendments or report-hash chasing.

Learning result: no skill change. This is a demonstrated harness coverage gap, with no demonstrated recurring original-skill defect. `learning-result.json` records that decision, no managed-cache modification and no applicable skill validator run. The earlier protocol failure remains failed with its original unknown cause; it is not repaired through product or authority changes.

## Remaining gates and reviewed rollback

LOCAL harness acceptance preparation is closed. Hosted Auth/PostgREST/JWT/RLS/multiconnection contention and applied-migration target proof are UNRUN; nine shared migrations remain unapplied. Genuine provider/store old/new transaction reconciliation and revocation, original purchase lineage, signed-in native purchase/restore/trial/expiry/account-switch/device recovery remain UNRUN. No authentic proof adapter or public restore route was installed. Native secure storage/byte/hash, food/package/yield/kitchen/cross-contact/photo/restricted coverage, measured store prices/trusted clock/freshness/location policy, content adoption/committed owner/inventory/full-week reroll, operational independent clock/atomic store/target/alert destination, legal/publication/rollout/final release acceptance remain open. Same-database outage blindness and legacy send/ack uncertainty are not fixed by this job. No production or public launch claim is justified.

Rollback requires independent review of a granular revert of source commit `dad005fe7a5029c5531efe7dc6c93d3f1e28051a` and, if needed, the exact report commit recorded in CURRENT. Restore only owned files from exact CURRENT originals when specifically reviewed, preserving all inherited notes/history. No reset/stash/amend/shared deletion, no automatic rollback and no external rollback action is included.

Next suggestion for coordinator selection only: inventory the exact available disposable hosted runtime/target, shared-Auth impacts, reversible before-state and authentic restore-proof binding prerequisites for a separately reviewed A2/A3 acceptance job. This report does not authorize that job, schema installation, provider action, activation or a follow-up dispatch. This worker stops after the verified handoff for independent review.
