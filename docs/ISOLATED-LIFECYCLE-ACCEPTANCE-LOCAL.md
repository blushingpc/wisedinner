# Isolated lifecycle acceptance preparation, October 6, 2026

The LOCAL guarded acceptance-preparation gate is closed. The new dry orchestration executes the existing account handler, repositories, durable deletion worker and support outbox against actual 0006-0013 SQL in PGlite memory. Launch-ready remains **no**. Hosted execution, signed JWTs, multi-connection contention and real providers are unrun. All eight shared readiness migrations remain unapplied.

Starting backend `55f51e0ee3702d2b138796c564563be4e4c8d1fe`, codex/backend-readiness; app `104f95fe8fd4661e928062fc0911ff1c3f77092f`, main, unchanged/read-only. Owned source commits: `c4349e5c6f3df64d4058b204478972f443bfa543` (guard and orchestration) and `a0306fe63e70001702d8e3369a38803035c01a4c` (persisted wrong-pin and exact frozen-send checks). Documentation commit/final HEAD and complete artifact hashes are recorded in the external final checkpoint; a report cannot contain its own enclosing commit hash.

## Changed preparation and guard

The initial collected complete-marker regression failed against the old intended 0006-0011 guard, exit1, preserved in baseline-marker.log. This was a coverage/revision gap, not a hosted incident. Existing runtime libraries, migrations, dependencies, app/UI, solver, snapshots, food approvals and quote fixtures are unchanged.

`scripts/account-isolated.ts` now checks schema_revision `0006-0013` plus migration_digests: an ordered eight-element JSON array of exact `{file,sha256,bytes}` rows computed from trusted repository files. The marker must match nonce, purpose, disposable true and project ref exactly, without extra rows/fields or altered pins. An operator/server marker attests to the target; it does **not** prove installed SQL or provide cryptographic hosted attestation. Old observations/pins are preserved, not upgraded by relabeling.

The guard snapshots/freezes the target, rejects the known shared project before a request, requires its exact HTTPS Supabase origin and bounds marker JSON to16KiB and the fetch/body deadline to8seconds. Redirects, wrong URLs, stale/malformed/duplicate/missing markers, unavailable/stalled responses and wrong inventory refuse. Coarse exceptions exclude bodies/credentials. No environment/shared-key fallback exists. The future manifest entry requires an absolute external path; manifest/credential/evidence realpaths exclude backend, app and website repositories. Manifest/credential JSON is bounded and regular-file checked. Each real attempt gets an exclusive UUID directory. No manifest or credential was loaded in this job.

Future `node scripts/account-isolated.ts --manifest <absolute external manifest>` remains a separately authorized, already verified disposable HTTPS plan. It makes no schema/marker/target, does not reset or clean broadly and now also checks that an unauthenticated marker read is denied before synthetic user writes. It retains its ownership/idempotency/billing checks. It **never directly deletes Auth**: after accepted deactivation, it reports unavailable/exit1 at durable_hosted_adapters_unbound. A future operator needs separately authorized, verified durable0013 adapters and actual hosted evidence before claiming full acceptance. That path was not run here.

`scripts/account-isolated-dry.ts` exports runDryPrepared with mandatory mode dry, injected markerRequest and create ports. Missing/live/unknown options deny before construction; there is no global fetch default. `scripts/account-isolated.fixture.ts` is imported only by tests. Its DB constructor is literally memory://, never a URL/file/env connection; it rechecks the trusted inventory before construction and hashes the exact bytes it executes. Minimal historical Auth roles/helpers/users, data_snapshots and support log tables are synthetic bootstrap, not replacement readiness migrations. Every query uses a short transaction with local emulated claims/role; provider/mail calls occur outside SQL transactions. Every test closes its database, including failure paths.

## Exact SQL executed locally

All eleven dry lifecycle scenarios executed these eight current files. 0008 publication and0010 operations were loaded for complete-revision compatibility; this new matrix does not claim new publication/liveness acceptance. Earlier standalone coverage remains separate.

| Migration | Bytes | SHA256 |
| --- | ---: | --- |
| 0006_wd_accounts.sql | 12401 | d152b143f0487ae1d42ab7ff2d4e6f6f1d0b3360bed7439c00898e99e6cbcbb9 |
| 0007_wd_billing.sql | 10107 | 3701db17a0ea2e22f21943975b62c193c31de61c6dbfbb34654731e343bd6065 |
| 0008_wd_publication.sql | 1801 | 1e9e59d5094d4570d9432a81bfb9524a77872f65bc98f7f19e8031b6c84b4e6c |
| 0009_wd_notifications.sql | 12851 | 3f37e611ef1def77c69f64e7c29df13f138841baf57b2c7b1e2c2177196fb3df |
| 0010_wd_operations.sql | 4350 | 3bebf98c04d78b1fd6cc13f2bdb3d39a43afc3045cbc2f73aa641ac95461c182 |
| 0011_wd_support_sends.sql | 4399 | 956169b2cafe26363f16db122e9233c42d83d55a4b849a1fd9496f2f76adbe2a |
| 0012_wd_support_outbox.sql | 15335 | 2748c6fbdb523e50bbb7c7cc13417ffe5cd4d0e75a5c7f30d46bf1964693da9d |
| 0013_wd_account_deletion.sql | 9602 | 9c5015986c4e5df62d04e0201406ea675392ea5e5ea392a99dbd6ce9089f650d |

## Observed orchestration and fake effects

Each scenario initializes A/B through accountHandler and the actual repository/RPC, updates A preferences, saves distinct owner metadata with a synthetic catalog pin, checks RLS/grants and private progress RPC denial, and creates distinct opaque billing bindings. Recent-auth HTTP refusal is401; direct SQL independently refuses stale AMR with its actual coarse invalid_command result despite a current synthetic iat. Explicit confirmation and one stable intent UUID accept pending/subscriptionCancelled:false; same-key retry returns the exact result. Old read/update/bootstrap, billing and push registration cannot resurrect A. A saved-week/push/receipt/job cleanup is checked, while B account, week, push association and binding remain unchanged.

Competing/stale deletion and outbox owners cannot progress; premature completion is refused. The held-operation case rejects wrong operation and identity pins **after** the worker has persisted trusted identity and operation progress. Status exposes only state/dependencies, without worker IDs/material. Fresh worker instances reuse durable SQL across restart. The fake providers have no invented reconciliation capability: ambiguous Apple outcomes remain held. Known non-Apple, unknown linkage, unavailable Apple material and verified already-absent synthetic Auth remain distinct.

| Scenario | Deletion after restart | Support after restart | Physical fake Apple / Auth / SMTP |
| --- | --- | --- | --- |
| normal | confirmed deleted | done | 1 / 1 / 1 |
| final deletion acknowledgment lost | confirmed deleted, first observation pending | done | 1 / 1 / 1 |
| unknown Apple outcome | held pending | done | 1 / 0 / 1 |
| verified non-Apple | confirmed deleted | done | 0 / 1 / 1 |
| unknown linkage | unavailable pending | done | 0 / 0 / 1 |
| missing Apple material | unavailable pending, same operation on two settled non-effect calls | done | 0 / 0 / 1 |
| verified Auth already absent | confirmed deleted, no destructive call | done | 0 / 0 / 1 |
| persisted SMTP acceptance acknowledgment lost | confirmed deleted | restart finalizes accepted payload | 1 / 1 / 1 |
| begin acknowledgment lost | confirmed deleted | held, no send | 1 / 1 / 0 |
| send accepted but acceptance persistence unavailable | confirmed deleted | held | 1 / 1 / 1 |
| unknown SMTP outcome | confirmed deleted | held | 1 / 1 / 1 |

Each classifier ran once. Recipient/content are frozen in actual0012 SQL, identical across restart, and every physical fake send equals the exact stored payload. No uncertainty is reported as confirmed deletion/delivery. The eleven tests trap global fetch, observe zero calls, and check one injected marker GET before any memory construction. Fake effect counts are local test measurements, not real Apple/Auth/SMTP operations. One queued PGlite connection is not a multi-connection race, real PostgREST or signed-AMR test.

## Checks, failures and evidence

Final sequential exits: focused22/22; affected existing account/billing/notification/deletion/outbox/send-ledger65/65; full backend299/299, repeated after the final proof refinement; ordinary npx --no-install tsc --noEmit; lint; voice; build; diff/source/exclusions checks all exit0. Final full suite45.550seconds. A first build failed fetching existing Google Fonts under restricted network access; the preserved scoped retry and final build passed. Existing Edge/static-generation warnings remain. No compiler policy, dependency or runtime install was used.

Preserved failed attempts: initial complete-marker red, acknowledgment fault incorrectly consumed by a rejected probe (17/19), duplicate synthetic push hash fixture (9/20), and an untyped test array typecheck exit2. Those were corrected in harness/tests only. Filename/glob lookup errors are recorded as operator mistakes. No demonstrated instruction fault supports a skill update; learning-result.md records no change.

Evidence root: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/runs/2026-10-06T04-51-41-536Z-3930f918/`. Final acceptance traces are in acceptance-sealed/; acceptance-verified.json records outcomes/effects/inventory. source-and-bundle-verified.json records exact source hashes, fresh build control and absent dry markers. Final commands/exits, original byte preservation, final Git heads/commits, report preflight and sealed index are adjacent. Earlier attempt directories and logs remain unchanged; they are not the final source proof. The index excludes itself and mutable supervisor/controller state and is produced after logs/report/HQ writers finish.

Fresh backend build scans have a positive account runtime control and zero new dry/test markers. Product app/lib/packages import no new harness module. Raw original backend QUEUE/app PROGRESS bytes are preserved; the queue receives only an unstaged append. App source/dependencies/HEAD and untracked reports/research remain untouched. Prior app83 focused/157 full/46 affected handler SQL and offline export at104f95f are matching saved evidence, not fresh/native passes. App lint/doctor/native SDK availability remains the earlier unavailable gate; no repeated setup probe/build was attempted.

Rollback: separately reviewed local reverts of the two owned source commits and documentation checkpoint, preserving user dirt and original/failed evidence. No shared schema/data/provider rollback is needed. No shared Supabase/ce_ operation, external user creation, real mail/provider/paid call, schedule activation, publication, app/website write or remote Git action occurred.

## Remaining requirements and next review

Native Auth/protected storage/resume/recent reauthentication/RevenueCat/device, real account/trial/purchase/restore/deletion, callbacks/SMTP/annual product/eligible trial setup, hosted Auth/PostgREST/contention and all eight unapplied migrations remain launch gates. The executable app remains anonymous. Food/pack/source/kitchen/cross-contact and restricted coverage, measured real-store calibration, website compatibility, email/reroll/restore-transfer/retention/price/release choices and rollout authority remain open. The target20:50:47UTC is readiness only.

Proposed next **independent** scoped local job: production receipt-fixture exclusion at app app/receipts.tsx and its import/reachability boundary. Current source imports receipt.fixture.json and permits production rendering when tiers is true (`if (!__DEV__ && !tiers)`), confirmed in the accepted audit. Preserve design/dev/user files, solver/data/account flags and current disabled billing flow; no provider activation or subscription UI. Acceptance: production deep-link/render probes with tiers false and true both deny receipt/verified-accuracy exposure, source graph and an exclusive local export prove receipt fixture/claims absent from the product artifact, and existing app tests/typecheck/greps remain green. No email/reroll choice is needed. This report does not authorize or begin that job.

Current reference checks: [Supabase RLS and grants](https://supabase.com/docs/guides/database/postgres/row-level-security) treats grants and policies as separate checks and keeps privileged service access server-side. [PGlite setup](https://pglite.dev/docs/) documents the embedded runtime; it does not establish hosted behavior. Original Supabase privilege/locking skills and investigation/verification/learning instructions were read; managed caches and loop authority are unchanged.
