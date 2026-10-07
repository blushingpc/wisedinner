# Status observer projection compatibility, LOCAL

Recorded October 7, 2026 UTC for the reviewed October 6 job. The existing observer now accepts a successful finish after its attempt and equivalent PostgreSQL explicit-offset timestamps. Both original healthy acceptance assertions failed before the correction and pass afterward. This closes the LOCAL temporal-projection compatibility gate only. Monitoring is default-off and unbound; launch-ready and G remain NO.

## Scope and source

Start: codex/backend-readiness at 6058f8022415c90d857e39d489ff7a6fd8f441c4, parent 5f6cb68b05983cbce0b11f001909c5fb6a7333b1, prior source parent e9186d8977fe5604c887d245584345f199dc1e67. Empty initial index. Source commit d6ea4f9abd62c3c9135fba8a50fc9869ae3c364b, parent 6058f8022415c90d857e39d489ff7a6fd8f441c4, owns only lib/operations.ts, lib/operations.test.ts, lib/status-observer.ts and lib/status-observer.test.ts.

The operations owner exports its unchanged bounded microsecond decoder for server-internal reuse. inspectStatus uses that decoder and removes the unsupported success-before-attempt invariant. The SQL begin/finish chronology permits success before, equal to or after the last attempt; independent current time, actual successful-work age, error and both expected checks still decide health. Fifteen-minute support and twenty-six-hour database thresholds remain inclusive JavaScript comparisons. The prepared SQL strict sweep equality policy is untouched. No route, storage format, adapter, DTO, policy, threshold, environment flag, scheduler or live binding changed.

| Tested source | Bytes | SHA256 |
| --- | ---: | --- |
| lib/operations.ts | 6948 | 16f3bd8effc76517ac4040e7315d85e98bc93a1c1eecd67043fbe29daff06844 |
| lib/operations.test.ts | 13974 | 74635793bb7bb4bc72bca0be5edea12f02533c051f6854147896c97f0d84d9d1 |
| lib/status-observer.ts | 15629 | d76e8173b4ad0a2f962d40d6ea73647d8f7e923e36d3bf5d82e411ae5dc3cdbd |
| lib/status-observer.test.ts | 19784 | c3f7f5ead288c63db7f1d0f7d8fc07a4632ace0f3f5e517214812fb9393d3af8 |

Original operations source SHA256 7bda362e9718e86b5b1017d9d694c69edc24d36a3f61ca84c071f4a875ab9d18; original observer source c790c865932b6510fcd881a4bd67146cf7b2955e5cff73d64aa32f9585bfdfc9. Exact originals, test originals and complete baseline records are retained in CURRENT. Strings and input objects remain unchanged, and public outcomes contain only coarse reasons. A newer attempt, HTTP200 or a supplied healthy flag cannot substitute for successful work or trusted time.

## Actual verification

CURRENT is C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-07T03-50-36-882Z-209fb6fc. Every suite, typecheck, lint, build, reopen and commit uses the unchanged node lane-driver.mjs --resource A -- executable/arguments wrapper under the actual saved A ancestry. Each closed *.command.json records the complete argument array, cwd, environment names only, UTC start/end and actual exit; its paired *.log retains full redacted output. No dependency or configuration change, fallback execution, lock clearing or process kill occurred.

| Check | Actual result | Evidence in CURRENT |
| --- | --- | --- |
| Original actual-source expected-health assertions | 0/2 pass, 2 failures, exit1 before edits | original-projection-red.command.json/.log; projection-red.test.ts; originals/ |
| Same assertions after narrow fix plus affected controls | 60/60, exit0 | focused-projection-complete.command.json/.log |
| Existing operations / observer regressions | 19 / 23 pass; original18 /17 retained | focused output; tested-source/ |
| Original health admission controls / actual unchanged status route | 4 /5 pass | prior-controls/health-red.test.ts; status-route.test.mjs; focused output |
| Finite physical-file restart controls | 7 pass across37 child commands:35 exit0 and2 deliberate interruption exit17, all reaped | file-restart.test.mjs; file-observer-child.mjs; finite-child-commands/ |
| Full current backend suite | 361/361, zero failure/skip/cancel, exit0 | full-backend.command.json/.log |
| Ordinary existing-config no-emit typecheck | exit0 | ordinary-typecheck.command.json/.log |
| Installed lint scoped to four owned files | exit0 | scoped-lint.command.json/.log |
| Voice | voice clean, exit0 | voice.command.json/.log |
| One fresh local build | exit0; existing Edge Runtime deprecation warnings retained | local-build.command.json/.log |

Controls exercise operationStatus into actual inspectStatus and full observeStatus using controlled ports. They retain equal-time UTC and success-before/equal/after cases; sixteen current producer offset/fraction spellings, UTC/-04:00/+05:30 equivalent instants and six-digit precision; exact inclusive ages, one-microsecond stale/future facts and no clock rounding. Invalid calendar/timezone/offset/fraction/range, missing/null/future/old time, impossible clock, malformed/sparse/duplicate/unknown/getter rows, forged flags and private errors cannot establish health. Five actual transpiled route controls preserve HTTP200/no-store and db/snapshot/support/status/blocked_founder plus operations fields, with local injected modules only. No live status handler or support poll ran.

The original17 observer controls remain, covering finite request/body timeout, exact target/redirect, byte/depth/array/UTF8/lexical duplicate bounds, coarse privacy, event capacity/overflow, disabled/unconfigured/unbound zero port effects, CAS/fencing, read/save errors and explicit dry delivery. Additional physical-file tests reopen in separate finite processes before/after reservation and observation, deduplicate failure/recovery, reject late older completions and reversed clocks, and preserve uncertainty after transport timeout/ambiguous outcome or failed durable acknowledgement. Explicit repeat dispatch never resends an uncertain event; recovery does not discard it. Observation durability, reservation, acknowledgement and unbound real destination remain distinct.

All endpoint/time/body/storage/transport fixtures are fictional LOCAL controls. CURRENT file-port.mjs uses owned sequential file CAS with fsync/rename for restart evidence. This does not prove hosted contention, cross-process atomic CAS, authenticated independent clock, provider delivery or a production operating monitor. The deliberate exit17 children are injected interruption controls, not failed repository gates or terminated workers. The original red child finished before its creation identity could be captured; its PID, natural close/exit1 and verified release/absence remain honest evidence. Other closed resource receipts retain observed child creation identity. No new capacity hold or denied command occurred this run; historical five holds and first failures remain preserved in the prior run.

## Preservation, evidence and rollback

The1080 initial source-file records reconcile to four scoped changes and1076 unchanged original records. Entire inherited PROGRESS167464-byte prefix SHA2568548176b01e3b01af19f008979d58f87c21d8a5c7e857381d720c24cb508cb72 is preserved before the owned append; QUEUE33664 bytes SHA25613442c542ca81044ceb2e255a331fa903b2cc81a031cdbfaab6f9824614a4d5e stays exact. Notes remain unstaged. Five private contract records,258 frozen entries,104 prior immutable seals and the independently pinned prior result/report/review/prompt remain unchanged. The four content dependencies cf66edc5 /853aafe1 /86782812 /2c0f71e7 remain SAME-byte UNACCEPTED for shared adoption. v6 and legacy app remain unjoined.

focused-proof.json contains exact preservation records and command/fixture evidence. originals/ and prior-controls/ preserve raw originals and expected-red history; prior-controls files are exact CURRENT aliases of the prior read-only run, not revised historical acceptance. The old three observer limitation controls/log are preserved as history, not relabelled green acceptance. The prior0/4 health red, first37/43 draft, type-fixture failure, five holds and prior47/354 final evidence are preserved; those totals are reused history only, not this job's fresh passes.

After the granular report commit, source-commit.json/report-commit.json and final-preservation.json record full HEAD/parent/diffs/file lists/status/index. The report's own commit identity is stored there without amending this report to chase its hash. evidence-index.json seals closed immutable inputs/code/tests/source copies/outputs/closed fictional snapshots/report/checkpoint records, excluding itself and mutable controller/resource/results/events/state/metrics/prompts/reviews/ongoing streams. A separate finite read-only process reopens exact lengths/SHA256 and source/private/frozen/prior preservation. Mutable fixture-state stays outside that index; closed-fixture-proof contains explicitly labelled immutable snapshots. Final report-path preflight uses unchanged validateResult and verifies a fresh regular non-symlink file under backend/docs. Exact release receipts remain administrative evidence outside the immutable index.

Rollback requires independently reviewed granular revert of source d6ea4f9abd62c3c9135fba8a50fc9869ae3c364b and, if appropriate, the report-only commit recorded in report-commit.json. Owned originals are available in CURRENT; restoration must preserve all inherited dirt and newer history. CURRENT helpers are unbound test-only additions and may be retired under reviewed ownership, never by shared deletion/reset. No rollback was executed. Learning verdict: no demonstrated recurring original-skill workflow defect, so no skill/cache/authority edit and no fabricated validator pass.

## Remaining gates and next dependency

Same-database outage blindness and legacy dryRunAlerts send/ack uncertainty remain unresolved. Authenticated independent hosted clock, durable atomic store/contention, exact configured live target, founder alert destination and real transport remain unbound/unrun. No schedule, alert, customer message, provider action or flag was activated.

Authentic food/source/package/preparation/yield/kitchen/cross-contact/photo proof, measured store prices and reviewed freshness/location evidence, committed owner/inventory/solver/reroll/access authority, native account/trial/purchase/restore/device, hosted Auth/RLS/PostgREST/contention, nine unapplied migrations, shared content acceptance, legal/publication/rollout and final release acceptance remain open. The founder's elapsed readiness target is not launch evidence. No spending, external replay, SQL, ce_, engine, app, website, HQ, shared-control or managed-skill change occurred.

One evidence-backed next proposal for coordinator selection: read-only inventory of this exact observer's independent hosted clock/storage/target and founder alert destination prerequisites, including existing access, costs, precise authority and rollback needs. No binding, activation, transport test, paid action or follow-up job is authorized by this checkpoint. Stop for independent review.
