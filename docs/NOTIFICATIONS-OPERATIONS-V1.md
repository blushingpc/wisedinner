# Optional notifications and operations, October 5, 2026

Implemented and tested locally, not activated. Migrations `0009` and `0010` execute only in isolated in-memory PostgreSQL tests. Hosted Supabase, native permission/token and real delivery remain unverified.

## Registration and cleanup

`POST /api/v1/notifications`, verified Supabase Bearer session and UUID `Idempotency-Key`, at most 4,096 bytes:

```json
{"deviceId":"11111111-1111-4111-8111-111111111111","revision":0,"projectId":"CONFIGURED_EXPO_PROJECT_UUID","environment":"development","permission":"granted","token":"SYNTHETIC_TOKEN_PLACEHOLDER"}
```

The example token deliberately cannot register. Actual Expo tokens are private and never belong in reports. Exact project/environment must match backend configuration and a server-only enabled project registry. Preferences must explicitly opt in; permission alone is not consent. A denied/undetermined permission submits no token and revokes that account's device successfully. This endpoint does not require a paid entitlement. `DELETE` with `{"deviceId":"..."}` or `{"all":true}` revokes owned registrations; call before logout/account switching where possible. Account deletion state changes remove tokens, registration receipts and queued jobs. Offline logout must erase local session/token linkage and arrange authenticated cleanup on next connection; the server cannot observe an offline logout automatically.

Default-off names: `WD_NOTIFICATIONS_API_ENABLED`, `WD_EXPO_PROJECT_ID`, `WD_PUSH_ENVIRONMENT`; Supabase URL/anon/service-role names are documented in the account handoff. Never expose the service-role key to the app. Private SQL limits ten active devices/account and thirty writes/minute, with exact ownership, revisions, request fingerprints and atomic idempotency. No client table grants or automatic project activation.

## Delivery seam

No live Expo transport or schedule is bound. The service-only job adapter prevents duplicate claims and verifies active account, opt-in, current token and project/environment immediately before sending. Attempts are bounded. A ticket is accepted by Expo, not proof of device delivery. `DeviceNotRegistered` disables the matching token, `MessageRateExceeded` retries with backoff, other errors are held. Receipt updates must match the recorded ticket. A network-uncertain send or interrupted claim is held rather than blindly resent. Vendor receipt fetching/authentication still needs a separately connected worker; this run tests synthetic ticket/receipt adapters and SQL, not Expo delivery.

The founder has not chosen reminder types/times. Prefer optional on-device reminders if their only inputs are local week data. Add a server dispatcher only for a specified cross-device need. Permission refusal leaves app use intact. The official [Expo push guide](https://docs.expo.dev/push-notifications/sending-notifications/) requires receipts and stopping sends to unregistered devices. No reminder, trial campaign or Sunday delivery schedule was invented.

## Operations and support

`WD_OPERATIONS_ENABLED` defaults off. Private checks separate last attempt, last success and coarse error, with attempt IDs preventing old completions from overwriting a newer attempt. Support polling becomes stale after fifteen minutes; database liveness after twenty-six hours. Future timestamps cannot establish health. Public status never exposes raw database/provider errors, message IDs or customer data. Dry alert events deduplicate failure/recovery and acknowledge only after a supplied test transport succeeds. There is no activated alert transport or external clock. A down database may prevent its own failure recording, so independent external monitoring remains necessary.

Never invoke support polling as a diagnostic: it can read mail, call a paid classifier and send replies. Tests use fixtures. Automatic messages skip classification to prevent loops; classifier outage leaves inbound dedupe untouched for retry. The daily 450-send cap now includes escalation digests. However, the existing count/send/log sequence is not atomic across parallel serverless pollers; send-accepted/log-failed outcomes and deferred escalations need a durable outbox/lease before operational activation. The bounded 10,000-entry in-memory form limiter is only a per-instance fallback, not distributed abuse protection. Production SMTP, proxy identity, durable signup/form throttling and monitoring transport remain rollout gates. No live message was sent.

## Website audit and collected data

Read committed website files only, plus public GETs on October 5. `/ios` returns 307 to `/`; `/`, `/support`, `/privacy`, `/terms` return 200. No App Store URL appeared in those responses. No support form POST or support poll GET was invoked. Committed support form targets `/api/support`, stores an open thread for a person and does not automatically email the submitter. Delivery/SMTP configuration was not verified. Website copy/legal still contains old accountless/Free assumptions; changes belong to the separate website owner. Do not promise a live listing or public email delivery from this audit.

New private inventory: Auth account identifiers/provider credentials handled by Supabase; account preferences and exclusions; version-pinned saved recipe IDs; opaque billing binding/verified entitlement state/transaction ownership hashes/minimal webhook events; private device tokens and delivery state; support contact/messages; coarse operational history. Diet/allergy preferences may be sensitive and require deliberate minimization/disclosure. No social graph, phone requirement, receipt upload or delivery address added. Draft privacy labels/policy must address account-linked identifiers, purchase history, preferences, support and optional push, including vendor sharing and retention/deletion. The old Data Not Collected assumption is not valid for the connected account build. Legal retention, backup/vendor deletion and Apple revocation policy remain approval dependencies, not invented durations. Subscription cancellation is separate from account deletion.

Recovery: keep route/operations flags off, do not activate project registry or dispatcher, retain prior client/public contracts. Do not drop tables, tokens or engine data as rollback. SQL stays unapplied pending a separately authorized rollout.
