# Account foundation, October 4, 2026

Implemented locally, default-off. Migration `0006_wd_accounts.sql` is unapplied to shared/hosted databases. Eleven focused endpoint/adapter tests pass. A separate test executes actual migration SQL, grants, RLS, A/B isolation, direct-write denial, revisions, idempotency, catalog pins and deletion tombstones in ephemeral PostgreSQL WASM memory. Minimal test-only dependency `@electric-sql/pglite` 0.5.8 replaces no production service and opens no socket/connection string. This is real isolated SQL execution, with emulated verified PostgREST claims; not hosted Supabase authentication, multi-connection contention or native login proof. Neither psql nor Docker is callable. No provider was configured and no real account was created, changed or deleted.

## Current contract

New accounts/trial/included-reroll scope supersedes the old ongoing Free tier. Account management, login/logout, restore, subscription management, support and deletion must remain reachable without paid access. The anonymous snapshot/solver contracts are unchanged. Server routes use `SUPABASE_URL`/existing `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY`/existing `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `WD_ACCOUNT_API_ENABLED`; saved-week activation additionally requires `WD_ACCOUNT_CATALOG_REVISION` and a separately reviewed immutable server catalog pin. No service key belongs in the app.

Read-only public Auth settings returned HTTP 200 on October 5 UTC: Apple false, Google false, email true, signup enabled. This verifies only those coarse settings, not OAuth identifiers, callback allowlists, SMTP, native flow or real account isolation. No management-level SMTP configuration was available. RevenueCat MCP/CLI is unavailable; no product or entitlement IDs have been authenticated in this run.

The server makes the same Auth-server `/user` check as [Supabase getUser(jwt)](https://supabase.com/docs/reference/javascript/auth-getuser). Only after successful server verification does it inspect signed issuer, audience, expiry, role, subject and AMR. A decoded JWT, client user ID, user metadata role, tier or getSession user never authorizes a request. Anonymous Auth sessions are rejected. Auth outage fails closed. Requests are Bearer-authenticated, never cookie-authenticated by these routes.

All responses are private/no-store. Errors are coarse codes, never provider payloads. Request bodies are JSON and at most 16,384 bytes, including streamed bodies without Content-Length. Unknown keys fail. Writes need a UUID `Idempotency-Key`. RPC derives ownership from auth.uid(), never a body user ID. It locks the account row and atomically commits mutation plus receipt. Reusing a key with different data conflicts. Preferences/weeks have optimistic revisions; clients refetch on 409, not overwrite. Durable write throttle is thirty successful commands per account/minute. Read and signup abuse protection still needs deployment-level infrastructure and Supabase rate/CAPTCHA configuration; this is not a comprehensive abuse gate.

| Endpoint | Shape and behavior |
| --- | --- |
| POST `/api/v1/account` | `{}` initializes once; tombstones cannot initialize again. |
| GET `/api/v1/account` | Own revision and preferences only. |
| PATCH `/api/v1/account` | `{revision:1,preferences:{diet:"none",allergens:[],excludedSkuIds:[],household:1,notifications:false}}`; full bounded preferences, no entitlement/price/tier. |
| GET `/api/v1/account/weeks?limit=20&before=<UUID>` | Own weeks only, stable descending UUID cursor, max fifty/page. |
| POST `/api/v1/account/weeks` | `{id:<UUID>,revision:0,week:{snapshotVersion:5,snapshotSha256:<64 hex>,solverRevision:<server revision>,catalogRevision:<server revision>,recipeIds:<15 known IDs>,seed:7}}`; max fifty-two saved weeks. These example revisions/IDs are placeholders, not approved production configuration. |
| DELETE `/api/v1/account/weeks/<UUID>` | `{revision:1}`; never deletes another account's row. |
| DELETE `/api/v1/account` | `{confirmation:"DELETE MY ACCOUNT"}` plus signed supported AMR authentication within five minutes. JWT refresh iat is not reauthentication. Returns `deletion_pending`, not completed deletion. |
| GET `/api/v1/account/deletion` | Own pending/deleted state and dependencies. Available after deactivation. |

Catalog pins are immutable, service-written rows with true snapshot version/hash and solver/catalog revisions plus known recipe IDs. Missing pins reject saving. The route loads a configured pin; SQL independently requires a matching pin, so calling RPC directly cannot forge provenance. Saved client recipe choices are **not verified nutrition, feasibility, restrictions or purchase proof**. Re-evaluate against pinned data before presenting verified results.

## Authentication integration, not activated

Use supported Supabase Auth client flows. No homegrown token/password system. [Apple](https://supabase.com/docs/guides/auth/social-login/auth-apple) native ID-token exchange requires a fresh cryptographic nonce and matching nonce handling; confirm bundle/provider capability and native token-revocation design. [Google](https://supabase.com/docs/guides/auth/social-login/auth-google) needs matching native/web OAuth client identifiers. Browser OAuth uses PKCE, an exact allowed native callback, state validation and code exchange. Do not put tokens in analytics/logs or accept arbitrary redirect targets. Confirm actual provider configuration read-only before activation.

Recommend [passwordless email code](https://supabase.com/docs/guides/auth/auth-email-passwordless) for a simpler same-device completion path; it needs code entry and production mail reliability. A magic link reduces typing but requires tested deep links and cross-device handling. The founder has not selected a mode, so activation remains unset. [Default Supabase SMTP](https://supabase.com/docs/guides/auth/auth-smtp) is limited testing infrastructure, not public signup delivery proof. No email was sent.

Store refresh/session credentials in native protected storage, not the existing general AsyncStorage week store. Serialize auth/account switching and billing identity transitions; clear another account's cached weeks/preferences/access/push association before rendering. Login/logout remain independent of entitlement state. Refresh and restart/device behavior need real iPhone tests.

## Deletion and recovery

Account RPC immediately removes owned weeks/previous receipts/preferences, marks a durable inactive tombstone and denies old JWTs and bootstrap. The retryable worker seam requires a durable ownership claim, private push cleanup, Apple revocation when linked, Auth deletion/session invalidation, then completion. No live worker is bound. A failed dependency leaves `deletion_pending` and an explicit coarse dependency; it never claims completion. Each external adapter must be idempotent, including already-deleted Auth users. Outstanding access JWTs may outlive refresh-session invalidation; tombstone checks are required on all private routes.

[Apple requires in-app account deletion and Sign in with Apple token revocation](https://developer.apple.com/support/offering-account-deletion-in-your-app/). Revocation credentials/tokens and provider deletion/retention policy remain dependencies. Auth deletion alone is not Apple revocation. Account deletion does not cancel Apple subscriptions; offer Manage subscriptions and disclose continuing billing without forcing cancellation as the only deletion route. Do not invent legal retention periods. Tombstone/receipt/billing retention and third-party data deletion need approved policy before rollout.

Forward rollout: isolated SQL/RLS tests with anon/A/B/service identities, provider/native auth proof, privacy/retention approval, reviewed server catalog pin, then separately authorized migration and flags. Keep old clients working. Recovery: disable new flags/routes/workers, retain new data and tombstones, keep anonymous contracts unchanged. Never drop these tables or alter engine grants as rollback. Public-schema privileges apply only to the named wd_ tables/functions; no schema-wide grant/revoke is used.

Isolated test target: `PGlite.create("memory://")`, explicitly checked in source, no environment/credentials/file databases read. [Vendor constructor/transaction documentation](https://pglite.dev/docs/api) establishes the ephemeral target. The unrelated sentinel grant survives the migration. A later checked Supabase-compatible disposable database must still exercise real PostgREST/Auth behavior and concurrent connections before shared rollout.
