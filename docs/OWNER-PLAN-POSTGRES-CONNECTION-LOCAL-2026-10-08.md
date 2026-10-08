# Owner-plan PostgreSQL connection prerequisite, LOCAL

2026-10-08. Source35129b7e4bfc43a8e30f359b24bf09416c1ef29a prepares the actual pg8.23.1 driver adapter and narrow staging candidate. UNBOUND, no actual database connection/login/grant/migration activation. A2/B2/G and launch gate remain open. This node advances directly to B2-durable in the same saved A writer; no routine approval wait.

## Scope and implementation

Starting backendff23bae448750bee1f45c3a1144c1eb7eeca3a65/app7ef97054addbb4256f0a2864c0a3ee3d66c92a2a. Inherited backend tasks/old reports and app PROGRESS/research/reports preserved. Exact transition archive34 entries verified. A1458 independent acceptance remains169 LOCAL prerequisite controls only; previous failed/unknown commands are not accepted or replayed.

CURRENT/nodes/A2-pg holds plan, before package/lock/server/task bytes, original commands/results and immutable checkpoint. Own only adapter/test, minimal server stage role replacement, fixture0017 application, unapplied0017 and pinned driver/types plus report/owned notes. Existing0016, codec/account/private-v1/eight answers/pins/solver core/app bytes unchanged.

Factory requires explicit enabled config/host/port/database/fixed wd_owner_plan_login/password/TLS verification/mode/finite limits. No environment fallback, import-time pool, credential reader, default connection or route/factory binding. Real pg Pool created lazily only upon transaction use. SSL rejectUnauthorized stays true; no connection-string options can override it. Pool bounds1–4, acquisition100–10000ms, statement100–10000ms, transaction<=30000ms, owned disposal<=30000ms are local safeguards, not measured sizing.

One checked-out client performs privilege preflight, BEGIN, transaction-local limits/role/claims, all fixed repository queries, then COMMIT or ROLLBACK. No pool.query, named prepared statement, callback/body retry or per-query client replacement. Nested transactions, stale handles, comment/multi-statement/control escapes refuse. Queued/unawaited query promises settle before commit/release; caught query failures still force rollback. Callback deadline fences later queries and waits for already-owned operations. BEGIN uncertainty and lost COMMIT acknowledgement discard; no confirmed outcome is invented. Idle faults hold later acquisition. Errors redact driver text/config; exact-once release and idempotent bounded disposal tested.

Indeterminate physical network/query settlement remains a safety hold: the adapter never releases a still-owned query just to meet a timeout. Disposal can report timeout while draining continues; that is not proof of network cancellation. Physical socket-loss/server timeout/pooling behavior is UNRUN and must be tested on the reviewed disposable target.

## Narrow privilege candidate and binding gates

0017 is add-only UNAPPLIED: dedicated wd_owner_plan_stage NOLOGIN/NOSUPERUSER/NOBYPASSRLS/NOINHERIT/NOCREATEDB/NOCREATEROLE/NOREPLICATION; only Auth identity function/schema use and replay INSERT. RLS requires verified context user_id, exact stage role and current transaction_id. No membership/login/secret or new grant to anon/authenticated created. Server replaces its old service_role staging step only; original authenticated RPC and account-before-billing/eligibility/environment/CAS/idempotency/tombstone semantics unchanged. Old service-role bytes retained in node before snapshot.

Every acquired connection preflights fixed login, exact recursive membership closure (login/authenticated/stage only), login/role flags, database/schema creation/TEMP, effective table/sequence access and non-system function allowlist. PUBLIC/nested permissions count. Administrator/missing/incompatible/extra privileges refuse. Strict whitelist may refuse an existing shared Auth deployment; do not relax it or change global roles to obtain a pass. Exact target role/function/policy/body compatibility remains an independent security review, not certified by dry permitted=true rows.

Later target prerequisites: owned explicitly disposable noncustomer database, exact target/consumers/current schema/function/RLS inventory, backup/reversible delta, least-privilege LOGIN with NOINHERIT and no superuser/BYPASSRLS/engine/service_role/postgres capability. Apply reviewed0006/0007/0009/0013/0014/0015/0016 before0017 in compatible preserved-history order; missing existing prerequisites are inventoried, not blindly applied. Independently review target-specific authenticated/stage membership and CONNECT-only/schema privileges; no login/grant executed here. Historical v1 incompatibilities remain held.

Prepared finite command AFTER a separate reviewed target job:

node CURRENT/nodes/A2-pg/physical-probe.mjs --execute-reviewed-disposable <reviewed-target-attestation.json> <existing-private-config-module.mjs>

Absent flags/owned disposable/noncustomer/current migration attestation or mismatched host/database/user/max2 refuse before import/connect. Two simultaneous real clients must preserve each transaction identity and be distinct; no schema/customer/provider writes in this read-only probe. UNRUN. Genuine hosted Auth/JWT, concurrent CAS/retry/restart/tombstone acceptance needs subsequent exact isolated fixtures and authority; this probe alone cannot close it. Existing admin credentials/shared engine project are not a substitute.

## Dependencies and current official references

Pinned pg8.23.1 Node>=16; integrity sha512-aL96AHANtWjPLDOLqnhx+ngp9+UK7ETEU8VJrDCGvsSSi/mGLcWYsS6Herg7lmaBJe4uwrfqsa7gTEFaSizDoQ==. @types/pg8.23.1 integrity sha512-fKVHpikPdg4GKks3JuLEhvwSyvwzF23hnabPy6DD8ljVbC7+6J5dQzdv4arV6jqq57djnMgs1HKBxX4P8aBI3A==.

Both read from official npm registry; exact resolved/integrity closure recorded in dependency-proof.json. Fourteen new lock entries, no existing locked package entry changed; scripts/unrelated manifest versions exact. Local approved install used --save-exact --ignore-scripts --no-audit --no-fund --registry=https://registry.npmjs.org; no paid service/global configuration. Pinned production driver is necessary for the existing transaction port, not a replacement mock.

Current official [transactions](https://node-postgres.com/features/transactions) require one client throughout; [Pool](https://node-postgres.com/apis/pool) documents lazy acquisition/release/discard/end/error handling. [SSL](https://node-postgres.com/features/ssl) documents TLS configuration and connection-string overwrite risk; explicit fields avoid that path. [Supabase connections](https://supabase.com/docs/guides/database/connecting-to-postgres) distinguish direct/session/transaction pool choices and prepared-statement limitations. These docs were read in this node; no project endpoint or database contacted.

## Actual checks and retained failures

All heavy metadata/install/tests/types/lint/voice commands sequential through unchanged lane-driver --resource A with actual saved ancestry. Exact args/UTC/exits/logs under node/*.command.json and *.log. Final-boundary-tests:36 Node nodes =33 distinct leaf controls (13 driver/boundary,20 actual installed admission/repository/SQL controls), zero failures/skips/cancelled. No sum across retries.

Dry driver proves one-client order/parameters/transaction identity, drain/fence, nested misuse, callback/query/acquire/BEGIN/COMMIT/ROLLBACK/idle/release/disposal failures, lost commit no retry and safe redaction. Actual pg export loaded, no connection. Memory SQL verifies stage owner/transaction/RLS/direct-client refusal and actual codec/admission/handler/repository, full64.01/physical pantry/checks, original CAS/idempotency/retry/rollback/eligibility/inactive/v1/tombstone/B isolation. Preflight executes against emulated administrator and refuses. PGlite serialization/Auth/provider fixtures are LOCAL substitutes, not physical/concurrency proof.

Final ordinary TypeScript, effective scoped lint for four changed files, voice and staged/working diff checks pass. types-1 failed TS2554 in a dry fixture's captured query signature; exact minimal test typing correction retained, later types passed. First metadata command returned pg only; separate compatible typing metadata read recorded. Sandbox app Git inspection initially refused ownership; actual-owner read succeeded without global safe.directory change. One PowerShell JSON display failed on empty lockfile key; independent Node dependency checker passed. No fabricated acceptance of these attempts.

Earlier focused runs retained; final source changes rerun proportionately. Unchanged169 accepted prerequisite history reused only where current matching bytes apply, not counted as new. Unchanged legacy solver emits duplicate-meal diagnostics; exact serialization/admission does not certify food feasibility. No full catalog/full suite/build/native/export/provider run. Public runtime graph does not import this unbound module; no fresh build claimed.

## Handoff and rollback

Immutable node checkpoint binds committed report/source snapshot and raw final logs; excludes future result/live controller streams. Exact owned source/package/security delta and original failures retained. Learning: no skill change adopted; fixes were demonstrated local fixture/lifetime issues, not permission expansion. $0 new spending/external database/provider writes0.

Next authorized node B2-durable: transferred app durable pending command and cloud/local installation recovery, with verified session/pins/eligibility and explicit retry. Production trusted canonical admission, actual least-privilege target/security review, hosted/native/providers/Apple deletion race/food/measured-price/content join/store/release remain open. Factories/flags unchanged, October9 12:06UTC/19:39:35UTC retained.

Rollback: withhold unbound connection/0017; later scoped source/dependency revert with preserved before-state and explicit target review. No drop/reset/role deletion/external reversal/push/deployment performed.
