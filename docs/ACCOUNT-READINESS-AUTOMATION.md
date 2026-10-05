# Account readiness automation

October 5, 2026. Local account/payment inspection and isolated ownership harness preparation. Backend starting branch `codex/backend-readiness`, HEAD `97572b229f15e5dfcaf58d6a48e96947dce9d470`. This work does not establish launch readiness.

## Verified configuration

Read-only checks at 20:17 UTC returned HTTP 200. The shared Supabase project was inspected only through configuration GETs; no customer, schema or engine operation occurred.

| Setting | Verified result |
| --- | --- |
| Supabase Apple / Google | Both disabled; client IDs and provider secrets absent |
| Email | Enabled, signup enabled, confirmation required; configured OTP lifetime 3,600 seconds and length 8. These settings do not settle the email code/link product choice |
| Callbacks | Site URL `http://localhost:3000/`; redirect allowlist empty |
| Custom SMTP | Host, port, user, password and sender not configured in Supabase. Delivery was not tested |
| Apple product inventory | Complete current app/group subscription lists: one group, one monthly product `com.wisedinner.app.protein.monthly`, `ONE_MONTH`, `MISSING_METADATA` |
| Apple USA monthly price | Current configured customer price `8.99`; no purchase or localized StoreKit display tested |
| Apple annual product / trial | Annual absent in the complete app subscription inventory. Monthly introductory-offer list empty, so no configured 14-day introductory trial found |

Unavailable: RevenueCat MCP/global CLI and management credential in inspected stores. An offline existing-package probe (`npx --offline --no-install @revenuecat/cli --help`) returned `ENOTCACHED`, exit 1; no CLI installation, OAuth login or account/configuration change occurred. RevenueCat app, entitlement, products, offering, transfer/restore settings and localized SDK prices could not be inspected. No customer endpoint was called. Other Apple territories and native eligibility/restore behavior remain unverified. The initial network attempt failed; reviewed GET-only network access then succeeded. Both attempts are preserved.

Exact local names were read from the routes rather than inferred: `WD_ACCOUNT_API_ENABLED`, `WD_BILLING_API_ENABLED`, `WD_REVENUECAT_CONFIGURATION_VERIFIED`, `WD_NOTIFICATIONS_API_ENABLED`, `WD_OPERATIONS_ENABLED`, `WD_SUPPORT_DURABLE_SENDS_ENABLED`. All six were absent/disabled in the worker environment and inspected local stores. RevenueCat app/secret API key/protein entitlement/monthly/annual values were absent. This does not inspect deployed Vercel flags. The first helper's guessed notification/support variable names were corrected by `local-presence.json`; its original projection is preserved, not used as actual flag evidence.

## Existing ownership paths

Account route: `app/api/v1/account/[[...path]]/route.ts`, `lib/account.ts`, migration 0006. Default-off route verifies the Bearer token against Supabase Auth before checking subject/issuer/audience/role/expiry. SQL derives the owner from verified Auth claims, locks the account, enforces revision/idempotency and denies tombstoned accounts. Account management/deletion does not require payment access.

Billing identity/access/webhook routes use `lib/billing.ts` and 0007. Identity uses a server-generated opaque account binding. Service-only reconciliation separates SANDBOX/PRODUCTION, generations, expiry and transaction ownership. Access additionally requires the explicit RevenueCat configuration verification flag. Webhooks durably enqueue; `processBillingInbox` is an unbound worker seam. Alias/transaction conflicts hold access for review; this does not settle a restore-transfer policy.

Deletion begins with exact confirmation and recent authentication, independently checked in HTTP and SQL. `finishAccountDeletion` sequences push cleanup, Apple revocation when linked, Auth removal and completion through adapters. Durable claim/completion adapters and an actual worker are unbound. The local harness tests synthetic Auth removal and tombstone denial, not production worker completion or subscription cancellation.

Six prepared migrations remain unapplied to the shared project:

| Migration | Ownership / dependency |
| --- | --- |
| 0006 accounts | Accounts, saved weeks, private receipts, immutable catalog pins and authenticated owner RPC |
| 0007 billing | Private bindings/states/transactions/events; service-only RPC and lease attempts |
| 0008 publication | Backend `data_snapshots` pointer compare-and-set; retires direct pointer writes. Not an account migration |
| 0009 notifications | Private account/device token ownership, opt-in association, revoke/delete cleanup; no dispatch activation |
| 0010 operations | Private health/alert records and service-only RPC; no external alert transport |
| 0011 support sends | Private send reservations, rolling cap, ownership and uncertainty holds; depends on backend support log table |

## Disposable harness

`scripts/account-isolated.ts` is runnable against an **already verified disposable HTTPS Supabase target** with real Auth/PostgREST and the prepared schema. It never reads `.env` or shared key stores, applies SQL, resets data or calls external purchase/mail/push providers. Local Docker/psql/Supabase tools and a verified disposable target are unavailable in this run. The harness has not executed against hosted Auth or concurrent PostgreSQL connections.

Command, for a future worker only after the existing disposable target has been verified:

```powershell
node scripts/account-isolated.ts --manifest C:/absolute/external/disposable-manifest.json
```

The external manifest has exactly `purpose` = `wisedinner-disposable-account-acceptance`, `disposable` = true, `projectRef` = the exact 20-letter disposable project ref, `url` = its exact `https://<ref>.supabase.co` origin, `nonce` = a fresh UUID, `credentialFile` = an absolute external JSON file containing only `anonKey` and `serviceRoleKey`, and `outputDir` = an existing absolute external run directory. Never put credentials in Git, a prompt or a shell argument. The known shared ref is rejected before any network request. No default target exists. Local HTTP is deliberately refused because the production verifier requires HTTPS.

Before any synthetic user/write, a read-only request must find exactly one server-only `wd_readiness_target` marker matching `id` = nonce, `purpose`, `disposable` = true, `project_ref` and `schema_revision` = `0006-0011`. A marker is an operator attestation, not cryptographic schema proof. Prepare it only after the exact disposable database has been independently checked and the six migrations plus their historical backend dependencies have been installed there. Never install it on the shared project. Auth must support admin-created confirmed synthetic `example.invalid` users and password sessions without sending mail. This harness does not provision or enable providers or settle the launch email mode.

The harness creates two synthetic users, verifies real sessions and forged-signature denial, exercises A/B RLS and denied direct writes, overlapping revision writes and same-key retries, distinct stable billing identities and overlapping synthetic transaction ownership, account switching at the backend session level, deletion intent/tombstones, synthetic Auth removal and B isolation. It preserves residual synthetic rows/users and tombstones for inspection. Disposal/recovery belongs to the verified disposable environment owner; no reset or automatic broad cleanup occurs. It saves a new exclusive attempt directory, checkpoints the last step and outputs only coarse case names, never raw exceptions/JWTs/user data.

Guard tests use fake marker responses solely to verify refusal/read-only behavior. Existing PGlite tests execute actual SQL with emulated Auth claims on one in-memory connection. Neither proves hosted Auth, RLS over real PostgREST, native account caches or multi-connection locking. Prepared harness coverage becomes evidence only after an actual successful run.

## Verification and continuation

Actual checks: 36/36 focused account/billing/SQL/guard tests (5.818 seconds); full `npm test` 241/241 (36.804 seconds); ordinary `npx --no-install tsc --noEmit`, lint with zero warnings/errors, voice, build and scoped diff checks all passed. Existing Edge runtime deprecation/static-generation warnings only. The CLI refused a missing manifest with observed exit 1. No hosted harness, SMTP delivery, Apple/Google callback, purchase, restore, expiry, worker or device acceptance ran. Voice briefly overlapped lint's still-pending PTY; it completed before the final lint result was collected. Build began after lint completion. This sequencing mistake is retained in the learning record.

Source-only local commit: `589abf457d3b6cb816dadd62c8eef5cb43702868` (`test: prepare guarded disposable account acceptance`), containing only the two harness files. Git index/commit operations required reviewed access to this worktree's Git metadata; no remote operation occurred. The pre-existing queue authorization note remains unstaged, alongside this run's owned continuation addition. Report/progress/plan documentation checkpoint is saved separately; final HEAD is in the external run checkpoint. Rollback: a separately authorized local revert of the source commit removes the harness without changing production; leave all activation flags off, retain prior and failed evidence, and preserve unrelated/concurrent changes. No database rollback is needed because no schema/data operation ran.

Evidence directory: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/runs/2026-10-05T20-09-19-064Z-5f11c119/`. Files: `checkpoint.md`; `configuration-evidence.json` (failed network attempt), `configuration-evidence-network.json` (first successful inspection), `configuration-evidence-complete.json` (complete Apple inventory), `local-presence.json` (actual route names), `npm-test.log`, `typecheck.log`, `lint.log`, `voice.log`, `build.log`, `manifest-refusal.log`, `revenuecat-cli-probe.log`, `learning-result.md`. Config scripts save only allowlisted projections, never raw credentials/responses. Evidence and runtime logs are outside repository Git; `.env.local`, `.next` and `node_modules` exclusions verified. Harness files passed LF and credential-pattern review.

The unchanged learning skill structurally validated using the requested bundled Python and child-only `PYTHONPATH`. Initial sandbox access to existing PyYAML files failed; the same reviewed validator retry returned exit 0. No tested recurring skill fault supports an update, so no skill change was adopted. No product dependencies, global settings, hooks or managed caches changed.

### Deletion continuation verified, October 5, 2026

Later account-client checkpoint: [local app preparation](APP-ACCOUNT-CLIENT-LOCAL.md) links hard-default-off injected session/client/cache boundary, actual handler/0006 ephemeral SQL and dry app tests. Native SDK binding remains unavailable; no login/trial/provider/shared schema or device acceptance is supplied. Existing configuration/deletion evidence is preserved, eight migrations unapplied. Exact app gates/failures/commits and next independent review are in that linked report.

Latest launch-critical checkpoint: [local durable account-deletion report](ACCOUNT-DELETION-LOCAL.md). Actual 0006/0007/0009/0013 SQL and fake-provider restart/failure tests prove the default-off private progress binding: 29 focused/267 full tests, ordinary typecheck/lint/voice/build pass. Known identity/Apple linkage, fenced dependency progress and completion prerequisites are local proof; real providers/hosted/native/retention/rollout remain open, eight migrations unapplied. Existing configuration/offer/ownership evidence here is preserved. Target October 6 at 4:50 PM EDT remains readiness only; this worker stops for independent review, proposing one disabled session/cache app integration slice without provider activation or policy invention.

### Support continuation verified, October 5, 2026

The following historical next-job paragraphs are now superseded by the completed local dry support slice. [Fresh support outbox report](SUPPORT-OUTBOX-LOCAL.md) records default-off durable progress, frozen approved replies/digests, safe pre-send recovery and held uncertain sends. Final focused SQL/route/legacy tests pass 34/34, full suite 255/255; ordinary typecheck/lint/voice/build pass. Additive 0012 remains unapplied, alongside the preceding six migrations. Configuration and blocked ownership evidence above remains unchanged. This worker stops for independent supervisor review; proposed next slice is default-off account-deletion durable adapters with dry providers. No account activation, policy choice, real delivery, shared SQL or native proof is supplied by the support tests.

Next authorized local job: close the support inbound/outbound outbox reservation gap with dry transports and failure injection using existing seams. Begin by reproducing accepted-send/log-write failure and interrupted inbound replay in `lib/support/handler.ts` and send-ledger tests. No real mail or schedules, shared SQL, provider activation or policy decision. Do not replay this configuration inspection as activation authorization.

Remaining account blockers: configure providers/callbacks/SMTP only under future activation authority; missing annual product, monthly metadata and 14-day introductory offer require provider setup authority; RevenueCat read access; an already available verified disposable runtime with real Auth/PostgREST; native/device purchase/restore/expiry/callback proof; durable lifecycle worker adapters and retention policy. Email code/link, reroll shopping, restore-transfer, release/founders, price freshness/accuracy/location and retention decisions remain unset. Continue the independent local outbox job while these paths are blocked.

Official references checked: [Supabase Auth configuration GET](https://supabase.com/docs/reference/api/v1-get-auth-service-config), [local Supabase runtime](https://supabase.com/docs/guides/local-development/cli/getting-started), [Auth admin synthetic user creation](https://supabase.com/docs/reference/javascript/auth-admin-createuser), [Supabase JWTs](https://supabase.com/docs/guides/auth/jwts), [Apple app subscription groups](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-apps-_id_-subscriptiongroups), [Apple group subscriptions](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptiongroups-_id_-subscriptions), [Apple introductory offers](https://developer.apple.com/documentation/appstoreconnectapi/get-v1-subscriptions-_id_-introductoryoffers), [Apple price configuration and verification](https://developer.apple.com/documentation/appstoreconnectapi/configuring-subscription-prices-across-territories), [RevenueCat identity](https://www.revenuecat.com/docs/customers/identifying-customers). No Context7 tool was callable.
