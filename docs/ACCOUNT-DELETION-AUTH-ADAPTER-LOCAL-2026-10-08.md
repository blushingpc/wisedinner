# Local Auth deletion adapter checkpoint

October 8, 2026. Verification level: LOCAL dry HTTP transport and PGlite memory only. The trusted adapter prerequisite is implemented and tested. A2, hosted deletion, Apple revocation and launch acceptance remain open. No binding, real Auth read/delete, provider action, migration, scheduler, route activation or spending occurred.

## Exact scope and source

Starting HEAD 843d4528cd89c478d6e8f54d05dc12a568012504 on codex/backend-readiness, empty index. Inherited status SHA256 2658d2f9e54e8500afd240bb7dfdae21117e7ddddcdea654b4300d154f12a151: modified tasks/PROGRESS.md and tasks/QUEUE.md plus original untracked docs/RECIPE-PREPARATION-EQUIPMENT-LOCAL-2026-10-07.md. Exact before-note bytes were saved; only this job's suffixes enter its report commit. Original failed and incompatible-history evidence remains unchanged.

Source commit e8b02a2662bc5801ca6edc904525f0668220097f owns only lib/account-deletion-auth.ts and lib/account-deletion-auth.test.ts. Adapter source SHA256 7281359ff10a9e4a9050805584d40cead919edd99768c8c004b37bdd37bbc8c9; test SHA256 039b76819aa1dfb939bd2f4010e7f159d6e2d77ad246ad3ab9d08fdb9f6bb9ce.

CURRENT evidence directory:
C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T05-43-50-121Z-042491fb

CURRENT/adapter-manifest.json SHA256 6d3087d4df18029fac17c9fa21f6a8a3c43237ebceb4e71c9e1ec8eaa55416f4 binds exact source, commands and protected dependencies. CURRENT/source-commit.json and report-commit.json record granular commits, staged diffs and report hashes. The report hash and final report commit are computed after writing, recorded separately without a circular self-hash. CURRENT/evidence-index.json seals finite current evidence and source/report copies; a separate read-only reopen checks those bytes and unchanged validateResult. Mutable controller result/state/events are excluded, and no previous history is copied recursively or resealed.

## Actual behavior

supabaseDeletionAuth is explicitly constructed with one canonical HTTPS server origin, private server credential and injectable request. Nothing loads environment secrets or installs it into the configured-off factory/routes. It rejects URL substitution, userinfo, ports, query/hash/path aliases, invalid targets and accessor targets before requests. Requests have fixed encoded UUID paths, redirect:error, no-store, API version, bounded total timeout and bounded JSON body. Credentials and raw personal/provider bodies are never returned or logged. The new source is referenced only by its owned test; public imports remain unchanged.

Admin identity reads require the exact user and supported nonanonymous lineage. The fingerprint hashes its domain/version, exact origin, UUID, creation time and sorted identity_id/provider/provider-subject/user_id/created_at tuples. Editable metadata, explicit email/phone, identity_data, tokens and mutable dates are excluded. Missing identities do not prove no Apple. Missing, duplicate, unsupported or inconsistent lineage returns no verification. Actual Apple identity means linked; actual supported complete non-Apple identities mean none. Observed creation/relink/subject changes refuse the stored hash. Only the context-bound hash leaves the adapter, not the raw provider subject.

Before a destructive call the adapter reads existing wd_accounts and wd_deletion_work through exact bounded PostgREST projections. It requires deletion_pending, current live lease, matching durable identity/operation, auth started, complete false and either no-Apple/not_required or linked-Apple/done. It rechecks that same claim before and after the request. These are read-only checks of existing service SELECT privileges, not new grants or SQL changes. The unchanged durable worker still owns begin, started/held, proof acceptance, reconciliation and tombstone completion.

run verifies current identity and makes at most one DELETE /auth/v1/admin/users/{UUID} with should_soft_delete:false. Current official Auth server returns an empty JSON object on successful hard deletion; SDK types alone are insufficient. A confirmed proof also requires an authoritative subsequent GET 404 with user_not_found and unchanged durable provenance. A mismatched user/body, uncertain response, timeout, denial, storage-owned error, outage or transient absence yields unknown, held by the existing worker. Neither successful status alone nor caller metadata certifies completion.

reconcile only performs reads. Exact authoritative absence under the same durable started/held identity/operation can yield already_absent. Still-present, generic/wrong-code 404, authentication denial, malformed response, outage and uncertainty remain unknown. It never emits not_started or sends DELETE. A lost acknowledgement followed by worker restart uses the same operation and absence proof; it does not retry the destructive request. Repeated invocation outside the unchanged worker sequence is not an activation-safe dispatcher and is not authorized by this local constructor.

Apple-linked worker tests deliberately hold the separate Apple provider. No fake successful revoke is installed. Auth deletion does not cancel a subscription, clean storage, settle retention or invalidate unexpired JWTs. Existing tombstones remain necessary.

## Official evidence

Read-only references inspected October 8 are captured in CURRENT/protocol-evidence.md:

- [Admin getUserById](https://supabase.com/docs/reference/javascript/auth-admin-getuserbyid), [admin deleteUser](https://supabase.com/docs/reference/javascript/auth-admin-deleteuser) and [official request construction](https://raw.githubusercontent.com/supabase/auth-js/master/src/GoTrueAdminApi.ts) support server-only GET/DELETE protocol.
- [Current Auth server admin implementation](https://raw.githubusercontent.com/supabase/auth/master/internal/api/admin.go), [error codes](https://raw.githubusercontent.com/supabase/auth/master/internal/api/apierrors/errorcode.go) and [SDK response/error conversion](https://raw.githubusercontent.com/supabase/auth-js/master/src/lib/fetch.ts) support empty deletion response and exact absence handling.
- [Identity model](https://raw.githubusercontent.com/supabase/auth/master/internal/models/identity.go), [SDK types](https://raw.githubusercontent.com/supabase/auth-js/master/src/lib/types.ts), [identities](https://supabase.com/docs/guides/auth/identities) and [users](https://supabase.com/docs/guides/auth/users) support the authoritative lineage fields.
- [Managing user data](https://supabase.com/docs/guides/auth/managing-user-data) supports the storage-owned-object and unexpired-JWT limitations.

Guessed source filenames that were unavailable are recorded as unavailable, not implementation evidence. No actual project user/configuration or credential store was accessed.

## Verification actually run

Every heavy command used the existing lane-driver.mjs --resource A -- wrapper with actual writer ancestry. CURRENT/*.command.json records exact command, UTC, exit and source hashes; paired *.log retains output. All eight resource receipts closed and released without signal. No resource bypass or process termination occurred.

| Evidence | UTC start to finish | Result |
| --- | --- | --- |
| adapter-red | 05:47:50 to 05:47:52 | Original unchanged missing-export assertion failed, exit 1 |
| focused-adapter | 05:52:07 to 05:52:12 | Initial 16 checks passed, exit 0, applies only its tested bytes |
| ordinary-types | 05:53:29 to 05:53:34 | Earlier source types passed, exit 0 |
| focused-final | 05:56:59 to 05:57:43 | Final 61 checks passed, exit 0 |
| adapter-green | 05:58:30 to 05:58:32 | Same original assertion passed, exit 0 |
| ordinary-types-final | 05:58:33 to 05:58:38 | Unchanged existing backend config, final source passed, exit 0 |
| scoped-lint | 05:58:56 to 05:59:00 | Both owned TS files nonignored, effective rules, zero errors/warnings, exit 0 |
| voice | 05:59:15 to 05:59:16 | Existing voice gate passed, exit 0 |

Final test command: Node --test --test-concurrency=1 lib/account-deletion-auth.test.ts lib/account-deletion.test.ts lib/app-account-deletion-contract.test.ts lib/account.test.ts lib/billing.test.ts lib/app-billing-contract.test.ts. It includes 17 adapter cases and 44 unchanged regressions; no assertions were weakened. Original red remains unchanged. Repeated types/focused acceptance followed actual additional timeout/lineage/bounds source changes, not a loop over unchanged completed work.

Dry transport uses only fixture.invalid and a synthetic credential. Memory SQL explicitly uses PGlite.create(memory://), bootstrap synthetic roles/claims/users, unchanged 0006/0007/0009/0013 and accepted unapplied 0015 copied into memory only. No file database, socket, environment connection, shared target or service was created. The actual repository executes existing wd_deletion_command; it is not a substitute worker. Single-connection transactions and serialized promises do not prove hosted Auth/PostgREST or independent connection contention.

Covered: no-Apple exact one-call deletion and original tombstone completion; acknowledgement loss and restarted read-only reconciliation; duplicate job no repeated DELETE; Apple and unknown-lineage hold; wrong UUID/user/hash/operation; absent/malformed identity; stable ordering and mutable metadata exclusion; deferred claim changes; lineage changes; timeout/connection loss; storage/server denial; wrong-code/ambiguous 404; wrong response user; malformed/oversized/redirect response; proof redaction; owner B synthetic Auth row preserved; unchanged recent-auth/deletion/account/billing isolation regressions.

No fresh full suite or Next build was needed. Exact 121 unchanged public-graph inputs bind previous LOCAL build evidence; 42 finite reviewed B dependencies match before/after. The new adapter has no runtime importer. Eighty-six baseline preservation pins include existing worker, contracts, migrations, history, public/candidate inputs and frozen full-state proposal artifacts. The ten frozen v2 artifacts remain unchanged under manifest 2dc4c7d80905e48dde697a5941d2e522ca2fdec7b5715b59e61213f3bdcf9ec1. Matching pins certify compatibility of saved bytes, not changing B completion or hosted readiness.

## Remaining gates and rollback

The UUID-based HTTP deletion protocol has no documented conditional lineage revision. The last identity/lease read and DELETE cannot be atomic. Observed changes are held, but an unobserved relink or claim change in that window remains a real activation risk. Independent security/coordinator review of this exact adapter and the durable lease/identity sequence, plus genuine hosted acceptance, is required before binding it. No real provider ownership, Auth deletion, Apple token revocation or customer cleanup proof is claimed.

Historical malformed v1 rows/receipts remain intact and need target inventory/data-preserving review before SQL installation or activation. Full-state sync remains uninstalled under separate same-byte consumer review. Backend-v6 and app legacy content remain incompatible. Native/provider/device/store, real-food/kitchen/yield/cross-contact, measured prices, full consumer integration and final release acceptance remain unverified. The founder deferred cooking/iPhone checks to the demo; that is not acceptance. The original October 9 19:39:35 UTC target is unchanged. Settled accounts, eligible 14-day trial, $8.99/$48, included rerolls and all activation flags are unchanged.

Rollback: withhold these two unbound files from a future installation. If a source revert is later needed, independently review a narrow revert of e8b02a2662bc5801ca6edc904525f0668220097f while preserving evidence and intervening work. No rollback was executed; no real deletion can be reversed by this artifact. No DROP, reset, migration rewrite, provider mutation, Git rewrite, push or deployment occurred.

Next action: independent coordinator/security review of this local adapter, then a fresh scoped instruction for the next unblocked minimum-tree prerequisite or confirmed repair. Apple revocation and hosted activation are separate reviewed work. This result does not self-authorize another job. CURRENT/learning-result.md records the SDK/server discrepancy and tested boundaries; no managed skill update is adopted. HQ/controller/shared-note writes remain with the coordinator.
