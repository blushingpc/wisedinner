# Local explicit restore prerequisite, October 6, 2026

The internal restore-intent and atomic ownership reconciliation prerequisite is verified locally. It does **not** perform or activate a real restore. No authentic provider/store proof adapter or live repository binding is configured. Existing routes, strict original-identity reconciliation, transfer/alias holds and activation flags are unchanged. Launch-ready remains **NO**.

Terminal A worked only in the backend, from `0c5457ad359db202b6979b8c1253cf3cfea47cc9` on `codex/backend-readiness`. Accepted source/test/unapplied-migration commit: `329c22b7ac14ff4748f4ebe515473c0a658499d4`. The report-only commit and exact final HEAD/index are recorded outside this self-referential document in `final-checkpoint.json` in the current evidence run. No push, merge, provider operation, shared/hosted database action, message, app/HQ/controller edit or paid action occurred.

## Original boundary and official semantics

Untouched `lib/billing.ts:35` denies original-identity mismatch. Original `0007_wd_billing.sql` durably holds transfer/alias hints and transaction-owner conflicts. Neither exposes a durable explicit restore bridge or stable original-lineage ownership index. The original actual-module/SQL run preserved these controls: **22 passed; one missing-restore-routine regression failed** before implementation. Original source/migration bytes, the original regression file and full output are retained.

RevenueCat restore policy applies project-wide and also affects new purchases involving existing receipts. Changing the policy alone cannot provide our ownership reconciliation. No policy was inspected or changed live. [Official restore behavior](https://www.revenuecat.com/docs/projects/restore-behavior).

TRANSFER supplies source/target ID arrays and may include store/environment. Its event shape is distinct from subscription lifecycle events carrying original transaction identity. A transfer hint supplies neither explicit customer intent nor sufficient original-lineage/revocation proof. Our normalized proof seam is an internal design inference, not a claim that RevenueCat provides its fields in one response. [Official webhook fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).

## Owned implementation

Only four runtime/test files were added:

| File | SHA256 of accepted bytes |
| --- | --- |
| `lib/billing-restore.ts` | `ff57c5563cb2c5a5c13b64f4db70ea16d8907c9ed6282963ed8891c286545271` |
| `lib/billing-restore.test.ts` | `72b9ee133923fac13066cbacd5a6715da9185d58d5c69d075ec049da93da2a0b` |
| `lib/billing-restore-sql.test.ts` | `c0af37529a49ccbcf79cc6a0157dc2dcc4c268b00b96d6f619e558fc1ed1d848` |
| `supabase/migrations/0014_wd_billing_restore.sql` | `a931ab9de6540c3344a37044e839987676ae0157d20e53b6d1950dbc678f9841` |

`requestExplicitRestore` at line 42 accepts only the explicit intent, projects the target from the existing trusted verified-session port, and delegates active-account/binding checks to SQL. It accepts no client source owner, entitlement, transaction hash or verification assertion. It is an internal callable seam, not a new route or public DTO.

`reconcileExplicitRestore` at line 54 claims an already persisted intent, observes only read-only proof and prepares before committing. Absent, invalid, unavailable or timed-out proof records a hold. An uncertain local commit is read back without automatic replay. A completed retry does not call the adapter again. No port here issues a vendor purchase, transfer or restore.

The exact normalized proof must bind operation, both existing opaque bindings, environment, app, App Store, product, entitlement, equal original-lineage hashes, separate verified renewal hashes, unchanged original purchase time, fresh observation, paid/trial expiry, purchased ownership, no refund and old-owner revocation when owners differ. Raw provider payloads, receipts, raw transaction IDs, credentials and customer attributes are neither accepted nor stored. Own scalar projection rejects getters and extra fields without executing them. Hashes are opaque references, not evidence of authenticity by themselves.

Operational bounds: 256-byte explicit body, 8,192-byte internal SQL command, five-minute intent, five claims, 60-second lease and eight-second read timeout. The five-minute observation bound follows existing billing freshness; it is not trial eligibility or a retention/price policy. SQL also requires observation after intent creation, monotonic prepared/lineage/state times and an unexpired subscription. Its clock is refreshed after advisory/account lock waits. NULL actions and irrelevant action payload fields deny.

`0014` is **UNAPPLIED**, additive to `0006/0007`; existing deletion active-state fencing remains required. Its intent, lineage, alias and participant-fence tables deny direct public/anon/authenticated/service-role DML. Only the internal service-role RPC can mutate them. Internal restores serialize, lock both accounts in sorted order, check source/target/lineage generations and atomically revoke the old state, move only proven transaction aliases, update the single lineage owner and install the new normalized state. Existing held flags are retained, so internal completion does not bypass public identity review. Unknown renewal aliases for participating accounts deny. Other transactions, environments, preferences, saved weeks and checks are preserved.

## Actual verification

Every test, compiler, lint and full-suite command used this exclusive prefix:

```text
C:/Program Files/nodejs/node.exe C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lane-driver.mjs --resource A --
```

Current run: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-06T22-41-22-979Z-7eff1ce8`. Each named command has a complete `.log` and `.json` with exact executable/arguments, UTC start/end, exit and log SHA256. Source/report commits also used the wrapper, covering possible hooks.

| Record | Actual outcome |
| --- | --- |
| `original-boundary` | Exit 1: 22 pass, one expected missing-routine red. No new runtime/migration existed. |
| `focused-01` | Exit 1: six new SQL checks failed loading migration under the fixture's runtime role; existing checks passed. |
| `focused-02` | Exit 1: two fixture failures from multiple commands in prepared statements. Roles/statements corrected, assertions preserved. |
| `focused-03`, `focused-final`, `focused-timeout` | Earlier exit-0 passes of 31, 32 and 33 tests. Kept as history. |
| `typecheck` | Exit 2: new test result rows lacked generic types. Only test typing corrected. |
| `typecheck-fixed`, `scoped-lint` | Earlier exit-0 passes. |
| `full-suite` | Exit 1: 308 pass/one file failure, 309 enumerated. Windows UNKNOWN read during unchanged support module loading, before its assertions. |
| `support-diagnostic` | Exit 0, all 14 unchanged dry support tests passed; no message sent. |
| `full-suite-retry` | Earlier exit 0, 322/322. |
| `post-review-focused` | Final-source exit 0, 33/33: 12 new tests plus 21 existing billing/account controls. |
| `post-review-typecheck` | Final-source exit 0: installed `node_modules/typescript/bin/tsc --noEmit`, unchanged config. |
| `post-review-lint` | Final-source exit 0: installed ESLint on the three owned TypeScript files. |
| `post-review-suite` | Final-source exit 0, **322/322** ordinary `npm test`, completed 2026-10-06T23:07:33.030Z. |
| `privilege-proof` | Exit 1 before SQL execution: outside-Git probe used a Windows path instead of an ESM file URL. Failed output retained. |
| `privilege-proof-fixed` | Exit 0: 53 actual SQL permission-denial controls, including SELECT/INSERT/UPDATE/DELETE on all four new tables for anon/authenticated/service-role and private helper/RPC denials. |

Focused command: installed Node `--test lib/billing-restore.test.ts lib/billing-restore-sql.test.ts lib/billing.test.ts lib/account-sql.test.ts`. Lint tail: installed Node `node_modules/eslint/bin/eslint.js lib/billing-restore.ts lib/billing-restore.test.ts lib/billing-restore-sql.test.ts`. Full-suite tail: bundled `C:/Users/borgh/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe -NoProfile -Command "npm test"`. Privilege probe tail: installed Node plus the current run's `restore-privilege-proof.mjs`, executing current SQL in memory. No build/service/export was needed or run for this unbound internal library. No tooling was installed or reconfigured.

Actual private-module controls cover explicit verified target projection, no-intent/login/access/webhook/SDK/cache hints, anonymous/forged identities, mismatched scope/root/renewal hashes, family/test-store/refund/expiry, missing/nonfinite/fractional/bounded facts, future/stale/exact freshness boundary, getter effects zero, immutable input, real timeout, unknown commit read-back and zero-effect completed retries.

Actual new SQL in credential-free `PGlite.create("memory://")` covers same-owner and old-to-new success, sequential renewal/reverse ownership under one unchanged root/date, idempotent completion, changed scope/payload conflicts, direct client table/RPC denial, source/target/lease/generation fences, expiry, durably held malformed proofs, deletion-state injection during reconciliation and an injected exception between ownership/state writes. Complete row comparisons prove rollback, other-environment/hold preservation and unchanged planning/preferences/sentinel/other transactions. Existing actual account SQL additionally exercises intentional deletion with emulated Auth claims. These are sequential SQL transactions, **not** hosted Auth/PostgREST or multi-connection contention. Proof values and test identities are synthetic, not customer/store observations.

## Preservation, limits and recovery

All 1,067 initially pinned backend files are preserved, except the separately appended owned progress suffix; its full original prefix is preserved. Queue remains byte-exact and unstaged. The four shared contract pins, original eight `0006–0013` migration files, verbatim core/authored data/dependencies/snapshots/flags and 42 preceding sealed artifacts remain hash-equal. Owned additions are LF regular files. Final index is empty; only pre-existing queue/progress dirt plus the owned unstaged progress suffix remain. Exact diffs, pins, commit records and final hashes are frozen in the current evidence run. Shared notes/HQ updates are coordinator-owned under this lane restriction and were not written here.

The closed gate is the **local internal reconciliation prerequisite**, not a real purchase/restore or account-to-trial planner integration. A private proof adapter still must authenticate original subscription lineage, both store/provider owners, revocation, expiry/refund and original purchase time without using a renewal ID as a root. A live server repository binding is also absent. Current legacy DTOs do not carry original lineage for an unseen renewal belonging to an unrelated/unregistered account. This prototype therefore proves one-owner behavior for admitted roots/aliases and denies unknown aliases for participants; it does not establish a global live guarantee across every legacy purchase/renewal/webhook/cache path. Keep that activation path held until all grant paths have authentic lineage binding and independently accepted hosted/native recovery.

Native store restore, receipt authenticity, hosted JWT/RLS/PostgREST/multiple connections, provider configuration/eligible 14-day trial, nine unapplied migrations including this addition, food/package/yield/kitchen/cross-contact coverage, content compatibility, measured real-store prices, device/legal/publication and release acceptance remain unproved by this job. Consult current coordinator/app-lane evidence rather than treating historical setup observations as fresh failures. No transfer dropdown, provider policy or activation flag changed.

Scoped rollback reviewed locally: independently review a revert of `329c22b7ac14ff4748f4ebe515473c0a658499d4` affecting only its four added files, then separately revert the report-only commit if needed. Preserve progress/queue/user dirt and original evidence. Since `0014` is unapplied, no external SQL rollback is required now. If ever applied later, do **not** simply remove lineage/fence tables or triggers: disable the binding, retain ownership holds/history, back up exact state and independently review a tested fail-closed hosted rollback. No rollback was executed. Learning outcome: no supported original-skill decision defect; no skill/cache/controller change adopted.

Next safe action: independent supervisor review of this checkpoint, with live restore still held. One already-authorized unblocked A proposal remains a bounded official-source freshness/location policy and trusted-clock binding brief for the accepted price seam. This worker does not execute it, activate anything or dispatch another job.
