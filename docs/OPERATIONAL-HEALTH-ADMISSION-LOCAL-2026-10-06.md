# Operational health admission, local checkpoint

The existing operations read path now refuses invalid clocks and incomplete or malformed probe responses instead of reporting healthy. This closes the selected LOCAL correctness gate. It does not establish operating monitoring, production readiness or G completion.

Scope: Terminal A, saved conversation 01a10daf-5f2e-7903-82b3-604d3ac40ac7. Starting branch codex/backend-readiness, HEAD e9186d8977fe5604c887d245584345f199dc1e67, parent feee79747790e84daa27c8d492c569fa42a27948, empty index. Original tasks/PROGRESS.md and tasks/QUEUE.md dirt was preserved before implementation.

Evidence root: C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-07T02-55-29-302Z-adee4d8b. All commands, originals, failures, source copies and subsequent final commit/preservation records are there. No older run was changed.

## Change and contract compatibility

Only lib/operations.ts and lib/operations.test.ts were changed in source commit 5f6cb68b05983cbce0b11f001909c5fb6a7333b1, parent e9186d8977fe5604c887d245584345f199dc1e67.

| Field or seam | Current behavior and verification |
| --- | --- |
| read response | Exactly one own checks field, a dense bounded pair, exactly one database and one support-poll. Each Probe has exactly the prepared SQL five own data fields. Missing/extra/duplicate/unknown/sparse/accessor/wrong-shape inputs return unavailable with empty checks. Rejected getter fixtures invoke zero getters. |
| generation and error | Nonnegative safe integer generation and existing none/configuration/unavailable/interrupted errors. Unknown/private error values refuse coarsely. No generation or private error is exposed in the public projection. |
| clock and age | Safe integer milliseconds within the Date range; invalid clock or age policy cannot certify health. Invalid clock causes no repository read. Support fifteen minutes and database twenty-six hours keep their existing inclusive JavaScript threshold. |
| timestamps | Bounded explicit UTC/offset PostgreSQL text/JSON, including six fractional digits, original strings retained. Microsecond comparison refuses future or too-old success and future attempt. Null/unattempted generation0 rows remain honestly unhealthy. |
| chronology | Successful finish can occur after the attempt, as unchanged 0010 SQL establishes. Last attempt never substitutes for last success. No success-before-attempt rule was added. |
| freshness helper | The unchanged observer's own-data public projection is recomputed from facts; its three derived flags cannot certify freshness. Its synthetic generation0 does not alter temporal computation. Those extra projection fields remain forbidden at the private RPC boundary. |
| public status route | Actual unchanged transpiled route, exclusively injected local modules: HTTP200/no-store and db/snapshot/support/status/blocked_founder/operations fields remain intact under DB failure and malformed/unavailable operations. No live handler or support poll was executed. |
| other operations behavior | Original return/error identity, best-effort begin/finish, default-off configuration convention, URL/key selection, repository timeout/redirect/no-store and dry transport/ack behavior preserved. No activation or transport binding. |

Prepared SQL was inspected, not executed or applied. The SQL alert sweep's existing strict threshold differs at exact equality from the existing inclusive JavaScript read; this job changes neither threshold nor SQL. There is no hosted PostgreSQL acceptance claim.

## Actual verification

Every dispatched suite/typecheck/lint/build/reopen/commit used the unchanged node lane-driver.mjs --resource A -- executable/argument wrapper under this real lane ancestry. Exact arrays, UTC start/end, exits and full redacted logs are in corresponding .command.json/.log files; checked-fixture-command-matrix.json binds the completed results and tested source.

| Check | Result and evidence |
| --- | --- |
| Original unmodified source, expected fail-closed assertions | Four assertions failed as expected: NaN clock, missing support, duplicate database and unknown check. original-health-red.log and originals/ preserve exact code/inputs. These were genuine failing assertions, not passing assertions of old bugs. |
| First drafted focused patch | 37/43 passed; six unchanged observer tests failed from overly strict helper projection/generation validation. Source/tests preserved in first-failure/. Narrow compatibility correction retained strict RPC validation and left observer bytes unchanged. |
| First ordinary typecheck | Failed on one newly authored fixture's excess-property type error. Original failed fixture retained; variable declaration corrected without changing assertions. |
| Final focused source and local integration | 47/47 pass: 18 operations, 17 unchanged observer, four original assertions now green, five actual transpiled route controls, three explicit unchanged observer compatibility controls. focused-health-final.log. |
| Fresh full current backend suite | 354/354 pass, zero skipped/cancelled. full-backend-tests.log. No earlier 339-test result was counted as fresh proof. |
| Ordinary current typecheck | Passed unchanged compiler config. ordinary-typecheck-capacity-retry.log. |
| Changed-file lint and voice | Passed scoped-lint.log and voice-lint.log. |
| One current local build | Passed local-build.log. Existing Edge Runtime warnings retained. This is a desktop build, not deployment/native/hosted proof. |
| Preservation | 1,077 unaffected files out of 1,079 initial files preserved; five private contract records and 258 frozen content entries rehashed. Initial queue is byte-exact; entire inherited progress prefix remains unchanged. preservation-after-gates.json and final preservation records. |

Five predispatch capacity/ownership holds are retained and counted as unrun commands, not passes. Read-only diagnostics verified this run's owner/ancestry, enabled lane and no occupied slot; sampled free memory of 639/842 MiB was below the unchanged 1024 MiB reserve. No gate was lowered, uncertain lease cleared, process killed or operation replayed. Completed resource identity/release witnesses and exact command outputs remain in CURRENT; mutable controller/resource streams are excluded from the immutable evidence index.

Final tested source hashes:

- lib/operations.ts, 6,824 bytes: 7bda362e9718e86b5b1017d9d694c69edc24d36a3f61ca84c071f4a875ab9d18.
- lib/operations.test.ts, 13,306 bytes: 218f293c39a74880ab4d2931eaf9d4f76c1b114e91f7e1270037ef0337a528ef.
- Unchanged status route: e638b9778bab5541045c7e2ee90a8853bff97421e6b3c44132febe558f06263d.
- Unchanged observer: c790c865932b6510fcd881a4bd67146cf7b2955e5cff73d64aa32f9585bfdfc9; unchanged observer tests: fc21a86cb8fd33e294489d1e16e397845f6b1af7b6a1d8ed1edc07450a7b4ab6.
- Unchanged prepared 0010: 3bebf98c04d78b1fd6cc13f2bdb3d39a43afc3045cbc2f73aa641ac95461c182.

Final HEAD/parent, scoped committed diff/file lists, empty index and note preservation are saved after the report-only commit in report-commit.json, preservation-final.json and final-git.json. This report does not chase its own commit/hash. evidence-index.json seals immutable completed evidence without hashing itself; its separate finite read-only verification result is retained. Report path/schema freshness preflight uses unchanged validateResult.

## Remaining gates and safe continuation

The independent observer is unchanged, default-off and unbound. Explicit actual-source controls show it still holds normal finish-after-attempt chronology and non-UTC offset spellings accepted by operations. Its existing equal-time UTC projection control passes. Those limitations require a separately reviewed correction before binding; passing its existing seventeen tests does not resolve them.

The monitored database still cannot record or alert on its own outage through that same RPC. Legacy send/ack uncertainty is unchanged. An authenticated independent hosted clock, atomic durable storage/contention, exact live target and approved real alert destination/transport remain unbound and unverified. No real alert, schedule, mail/push, provider or shared database action occurred.

Frozen codec/week/context/consumer candidates remain UNACCEPTED; manifest 2c0f71e71ac1a19c0c75654508adb0cf8cc0adfc7b4ae6e858b900a97080f7c0 still needs coordinator/B same-byte review and authentic committed-state/atomic server binding. Food/package/source/yield/kitchen/cross-contact/photo, measured store prices/trusted policy/clock, full-week constraints and owner/inventory/reroll provenance remain held. Native account/trial/purchase/restore/device, hosted Auth/RLS/PostgREST/contention, nine unapplied migrations, legal/publication/rollout and final release acceptance remain open or UNRUN. The October6 target has elapsed; launch-ready and G remain NO.

One unapproved next suggestion: reproduce and narrowly correct the unchanged observer's success/attempt chronology and PostgreSQL offset compatibility against its actual operations projection, retaining independent clock, future/stale/error checks, default-off and all live bindings held. The coordinator independently selects the next job. This worker stops naturally and never self-dispatches.

## Rollback and learning

Rollback requires a reviewed granular revert of source commit 5f6cb68b05983cbce0b11f001909c5fb6a7333b1 and, if wanted, the report-only checkpoint commit named in CURRENT/report-commit.json. Do not reset, stash or rewrite history. The owned progress append is recorded separately in CURRENT/progress-append.md and remains unstaged; remove only that exact suffix under a reviewed rollback while preserving its full original prefix. Retain all lab evidence/originals/failures.

No demonstrated original-skill decision defect supports a skill update. learning-result.md records the compatibility/type-fixture corrections, real regression evidence and unchanged skill/authority boundaries; no managed caches changed or validation pass manufactured. Shared notes/HQ remain coordinator-owned. New spending $0; no push, deployment, activation, provider/native build, customer message or publication.
