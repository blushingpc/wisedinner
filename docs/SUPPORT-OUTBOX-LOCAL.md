# Local support outbox checkpoint, October 5, 2026

One supervisor-reviewed dry support recovery job from branch `codex/backend-readiness`, HEAD `83e6d290b61a28d5d0546db3eac6fe6740969c91`. The four independently observed legacy recovery failures are reproduced before the fix and pass through the new prepared seam with actual ephemeral SQL and synthetic mail/classifier adapters. This is local preparation, not automatic live support delivery or backend launch readiness.

## Completed behavior

New private `wd_support_work` progress separates immutable inbound recording from processing completion. Approved triage, reply content, digest recipient/membership/content and send identity are frozen before the transport boundary. Server-only RPC claims fence owner, attempt and lease. Accepted recorded sends finish missing outbound logs, thread status and mark-seen without another transport call or changed-content classification. Lost inbound acknowledgements, safe pre-send interruptions, cap deferrals and ledger outages retain recoverable work. Ledger permission is required before any send.

An uncertain SMTP outcome, lost begin acknowledgement or unrecorded acceptance remains held. Timeout can hold expired sending work, never release or resend it. A recorded acceptance with a lost acknowledgement remains accepted and can finish. Existing logged inbound without new progress is conservatively held rather than guessed/backfilled. No historical approved payload or held outcome is reconstructed automatically.

Deferred escalation membership survives capacity return and worker restart. Each digest freezes its recipient, payload, member IDs and send identity atomically. Completion cannot drop/reassign those members. Batches admit only the prefix fitting the actual serialized 32-KiB payload limit; remaining members stay queued. Existing escalation messages remain unread for a person. No operator review/release policy or retention duration was invented.

The rolling 450-send allowance is shared with the existing 0011 ledger across replies/digests, counting recorded acceptances and corresponding old logs once. Existing auto-submitted skip, voice/policy refusal and classifier-outage retry behavior remain. Polls request at most ten inbound messages, claim at most four works, exclude already-attempted works, sweep at most ten stale sends and select at most ten digest members. SQL validates input/approval/payload sizes and identities. The mailbox adapter's optional limit leaves legacy calls unchanged. Native IMAP fetch-byte limits/UIDVALIDITY and hosted runtime duration remain unverified.

## Default-off integration and privacy

Additive **unapplied** `0012_wd_support_outbox.sql` creates only backend support progress and its RPC. Existing applied migrations, 0011, legacy handler and controller authority are unchanged. Seven readiness migrations (0006 through 0012) are now prepared and unapplied. No shared schema, ce_ or disposable hosted schema operation occurred. PGlite used an explicit ephemeral `memory://` target only.

The actual prepared poll route selects the new path only with `WD_SUPPORT_OUTBOX_ENABLED=true` and existing `WD_SUPPORT_DURABLE_SENDS_ENABLED=true`; missing prerequisites fail before constructing the mailbox. No flag or schedule was activated. With the new flag absent, the existing handler/guard path remains. Relative imports make the actual route callable in Node tests; no product dependencies were added.

The new table has RLS, no public/anonymous/authenticated privileges and no direct service-role writes; only the service-role-checked security-definer RPC can mutate it, with an empty search path and qualified objects. This necessarily stores private recipient/body/message identifiers server-side for recovery. No public route projection or console error includes them. Actual GET tests assert authorization, no-store and coarse errors with zero network calls; adapter errors discard raw responses. Existing success counts strip the legacy digest field. Synthetic environment values are restored by tests. No support credentials were inspected and no live poll, classifier, SMTP/push or purchase ran. Ordinary build behavior may load the repository's ignored environment automatically.

Row locking and restricted function privileges follow [PostgreSQL explicit locking](https://www.postgresql.org/docs/current/explicit-locking.html) and [Supabase database functions](https://supabase.com/docs/guides/database/functions). Local tests do not establish hosted authorization or contention.

## Verification and preserved failures

All evidence below is outside Git in `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/runs/2026-10-05T20-46-51-308Z-ac850cc2/`.

| Check | Actual result/evidence |
| --- | --- |
| Before fix, actual legacy handler + guarded mailbox | 0/4 expected recovery assertions pass, exit 1; `pre-fix-regressions.log`, redacted `pre-fix-regression.test.ts.txt` |
| Final focused new/legacy/actual-route/SQL tests | 34/34, exit 0, 47.081 seconds; `post-fix-focused-final.log` |
| Final full npm test including header fixture correction | 255/255, exit 0, 54.234 seconds; `npm-test-verified.log` |
| Ordinary `npx --no-install tsc --noEmit` | Retry exit 0; `typecheck-retry.log` |
| Lint and voice | Both exit 0, no lint warnings/errors, voice clean; `lint-final.log`, `voice-final.log` |
| `npm run build` | Exit 0, compile/static generation complete; `build-final.log`; existing Edge Runtime deprecation warning |
| Scoped diff/exclusion review | Exit 0, LF and private-key/token pattern scan passed; `diff-final.log`; .env.local/.next/node_modules/data pipeline excluded, no generated evidence staged |

Twenty safe before/after failure injections cover classification, record/inbound acknowledgement, claim/payload persistence, reserve/begin, acceptance acknowledgement, outbound log, status, seen and finish. Separate cases hold SMTP/begin/unrecorded-acceptance uncertainty and verify zero sends without ledger permission. Digest persistence/log/completion failures, restart with changed UID/configured recipient, capacity recovery and exact member dedupe are exercised. SQL tests deny anonymous/client/direct writes, competing/stale claims, changed content and malformed payloads, while preserving unrelated grants. One last rolling slot covers reply/digest accounting and accepted/log dedupe. Bounded serialized-byte cohorts remain recoverable across three batches.

Failed candidate attempts remain: SQL alias ambiguity (`post-fix-focused-1.log`); real digest-byte failure (`digest-byte-budget-before.log`); incorrect two-batch test assumption (`digest-byte-budget-after.log`); typecheck header fixture error (`typecheck-final.log`). Narrow fixes preserved byte caps/member counts/authority boundaries. Corrected actual route tests passed 2/2 (`route-fixture-final.log`). Earlier full 254 and 255 passes are retained, not substituted for the final-source result. Gates ran sequentially and each terminal exit was collected before starting the next gate.

PGlite executes the actual 0011/0012 SQL, but queues one in-memory connection and emulates verified Auth roles. It proves neither real hosted Auth/PostgREST/RLS nor multi-connection concurrency. Hosted contention, actual SMTP/IMAP, native/device/provider acceptance remain **UNRUN**. No live delivery or launch-ready claim follows these passes.

## Commit, rollback and review handoff

Local source commit `83527959852e314f0af23592ec81b375d586eb19` (`fix: prepare durable support progress recovery`) contains exactly seven reviewed support source/test/migration files, 480 additions/14 removals. All source gates passed before staging. Worktree Git metadata required reviewed scoped access; no remote action. This report, linked context and tasks are a separate documentation checkpoint; its final commit/HEAD and exact remaining dirtiness are recorded in external `checkpoint-worker.md`/`acceptance.json` after commit. Both pre-existing queue additions are preserved unstaged alongside the new continuation; app's pre-existing progress/reports/research notes and website product code are untouched. Exact owned paths/checkpoints and learning review are in `tasks/SUPPORT-OUTBOX-PLAN.md`, `tasks/PROGRESS.md` and external `learning-result.md`. No unsupported skill change was adopted; managed skills/global hooks/models/permissions/controller files remain unchanged.

Rollback for this local preparation is a separately authorized local revert of the source commit, preserving unrelated files/evidence and leaving both new paths off. No database rollback is needed because SQL was not applied. A future rollout must independently verify target/privileges, stop/drain legacy senders and prevent mixed guarded/unguarded/new workers. Retain accepted/held rows; never drop/reset them or resend unknown outcomes as rollback. No retention/deletion period is settled here.

Proposed next scoped job for independent supervisor review: prepare the existing account-deletion lifecycle's default-off durable claim/completion adapters with dry provider stubs and ephemeral SQL failure injection, leaving actual Auth removal, Apple revocation, shared schema and retention policy blocked. This worker stops after its support checkpoint and does not start that job. Account/provider access, disposable hosted runtime, native/device, price/food and founder-policy gates remain open. See [account readiness evidence](ACCOUNT-READINESS-AUTOMATION.md) and [notifications/operations context](NOTIFICATIONS-OPERATIONS-V1.md).
