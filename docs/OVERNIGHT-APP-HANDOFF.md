# App integration handoff, October 5, 2026

October6 deletion continuation: [app accepted deletion client checkpoint](../../wisedinner-app/reports/APP-ACCOUNT-DELETION-CLIENT-LOCAL.md) adds only an internal optional hard-off intent/status seam.65 focused/139 full app and26 actual handler/memory SQL cases prove explicit intent/recent-AMR refusal, stable-key/no-refresh dispatch, coarse status and A/B/uncertainty cleanup. Accepted pending is not remote completed deletion or subscription cancellation; after local credential cleanup status is unavailable, never retained-bearer polling. No UI/native SDK/provider/worker/shared migration activated. Future native reauthentication/recovery and subscription disclosure/manage reachability need separate proof; no retention policy selected. Earlier handoff history remains unchanged.

October6 continuation: [app billing/access dry checkpoint](../../wisedinner-app/reports/APP-BILLING-ACCESS-CLIENT-LOCAL.md) prepares the optional internal server-bound identity/access seam only. Strict flat DTOs, current SDK identity, held uncertain transitions, transient expiry and account-generation fences have46 focused/120 app and22 backend handler/SQL passes. Native factory remains hard-off/unavailable, no UI/SDK/dependency/flags activated; current bundle excludes these modules. Follow the report's native/provider/hosted/time/lifecycle/offer/restore/policy prerequisites before any later wiring; old history is not authorization. Management/support/deletion remain outside future premium gating.

### Account client local continuation, October 5, 2026

Later checkpoint: [app account client report](APP-ACCOUNT-CLIENT-LOCAL.md) records internal hard-default-off session/client/cache preparation with 19 dry app regressions and actual backend-handler/0006 ephemeral SQL contract proof. Native SDK binding, session resume, provider/phone/trial acceptance and lint/doctor remain unavailable/unrun; no dependency, UI, solver, anonymous state, snapshot or privacy copy was changed. New modules are absent from the fresh local iOS product bundle. Existing handoff history below remains valid where not superseded by dated evidence. Worker stops for independent review, no new activation or app integration authority.

Backend-owned preparation only. App product code is unchanged. This document does not authorize provider activation, a database push, native builds, deployment or public food publication.

## Verified starting seam

App HEAD `6db5a69`, Expo 57.0.21/RN 0.86.3. Existing dirty root `PROGRESS.md`, `reports/` and `research_notes/` belong to the other session and were preserved. Read the actual root progress record, not the nonexistent `tasks/PROGRESS.md`. No tour PNGs were found. No Supabase Auth, RevenueCat or notifications SDK is connected. The old app-wide Free/tier and no-network assumptions are superseded by the October 4 decisions, not fixed by this backend run.

| Capability | Current app evidence | Integration required |
| --- | --- | --- |
| Onboarding/diet/household | Eight local questions; household 1–4; app's calorie bands differ from backend typical profile | Preserve explicit inputs, validate budget minimum $45 and migrate answers deliberately |
| Allergy/exclusions | Name-based `ingredient-tags.ts`/`exclusions.ts`; unknown tags become empty | Stable SKU IDs, reviewed-empty versus unknown, fail closed on every selection path |
| Kitchen quantities | `kitchen.ts` supports fractions/exact units, custom guesses, binary entries | Bind fractions to the actual pinned purchasable pack; never infer cooked/raw equivalence or free infinite stock |
| Week/regenerate | `store/week.ts`, old verbatim core/adapter, local deterministic seeds | Separate authorized core port; full source/quantity/restriction evaluation and atomic week/list install |
| Individual reroll | `meal-actions-ui.tsx` regenerate branch has no implementation; tier actions hidden | Included access policy, whole-week recomputation and unresolved grocery/budget decision |
| List | Whole/paid quantities and store repricing from legacy names; delivery estimate visible | Reviewed purchase ledger, dated estimated cents, remove delivery/savings promises from launch |
| Share | View-shot image/native share sheet implementation | Real-device share/cancel/error/haptics proof; remove obsolete accountless/Free claims in later app job |
| Settings | Local edits/start-over/legal/mail links, no server | Login/logout/restore/manage/support/delete always reachable; remove “nothing leaves your phone” after connection |
| Refresh | `src/data/snapshot.ts` inert; if enabled parses pointer as legacy snapshot | Pointer -> exact bytes -> hash/schema -> safe installation, not a flag flip |
| Trial/login/push | Stubs or absent dependencies, hardcoded `src/store/tier.ts` Free | Real native SDKs/version-matched configuration, not Expo Go mock acceptance |
| Receipt routes | `/receipts` uses fixture; guard is `!__DEV__ && !tiers` | Independent unconditional production feature guard; enabling billing tiers must not reveal fixture proof |

`src/config.ts`, `src/store/tier.ts`, `src/store/week.ts`, `src/data/ingredient-tags.ts`, `src/solver/exclusions.ts`, `src/features/meal-actions.ts` and UI, list/settings/share/receipts and root navigation were inspected. No app test, Metro, browser, Expo build or device run was performed here. The old duplicate repair can relax calorie/perishable conditions; do not transplant that behavior into the reviewed backend path. Current eighteen reviewed weeks have no same-day identical lunch/dinner IDs, but that is sampled evidence, not a newly added hard rule.

## Sequence and identity

1. In a separately authorized app job, wire supported Supabase Auth with protected native session storage and serialized refresh/account switching. Do not store refresh credentials beside general AsyncStorage weeks. Validate exact callback/state/PKCE for browser OAuth. Native Apple needs a fresh nonce and supported ID-token exchange; match actual bundle/client/provider identifiers, not guessed IDs.
2. With a verified access token, `POST /api/v1/account` `{}` using JSON plus a UUID `Idempotency-Key`. Server uses Auth `/user` verification and PostgREST ownership. Never send `user_id`, role, tier or entitlement. 401 means login/refresh; 409 means refetch revision; 410 means inactive/deleted, never bootstrap; 413 means rejected size; 503 means unavailable/default-off, not success.
3. GET `/api/v1/billing/identity` after account initialization. Configure/login RevenueCat with the returned opaque App User ID before purchase. No email identity or anonymous purchase. Suppress old CustomerInfo while switching accounts and clear account-scoped preferences/weeks/access/push association. Backend transfer/alias conflicts are held; do not resolve them by granting both accounts.
4. Present the eligibility-aware native offering. Complete Apple purchase, then reconcile `GET /api/v1/access` or POST `{}`. Client success is not an entitlement. Trial/active with verified future `expiresAt` may allow app use and included rerolls; expired/revoked/inactive/unknown deny. Canceled-but-still-active remains usable until verified expiry. Provider outage may use only already verified cache through expiry, never a new grace or timer. Native offline state and trustworthy expiry handling require device proof.
5. Login/logout, restore, manage subscription, support, deletion and terms/privacy must remain accessible without access. No separate reroll purchase. Do not put unfinished receipt/delivery screens behind the same new billing switch.

Apple and Google are disabled in the read-only public Auth settings inspected here; email is enabled but SMTP, OAuth identifiers and callback configuration are unverified. Recommend passwordless email code for straightforward same-device completion, with explicit code entry and production-delivery dependency. Magic links reduce typing but add deep-link/cross-device failure cases. The founder has not selected email mode. Do not change templates/provider configuration or send mail during preparation. [Default Supabase SMTP is for limited testing](https://supabase.com/docs/guides/auth/auth-smtp), not signup delivery proof.

## Endpoint examples and saved weeks

All examples are placeholders, not production IDs or verified week inputs. Every private response is no-store. Common account request headers: `Authorization: Bearer <verified Supabase access token>`, `Content-Type: application/json`, UUID `Idempotency-Key` on writes. No service-role key in the app. Detailed actual shapes/errors are in [ACCOUNT-API-V1.md](ACCOUNT-API-V1.md) and [BILLING-ACCESS-V1.md](BILLING-ACCESS-V1.md).

```json
{"revision":1,"preferences":{"diet":"vegan","allergens":[],"excludedSkuIds":[],"household":1,"notifications":false}}
```

PATCH `/api/v1/account` uses a complete preference object and optimistic revision. GET `/api/v1/account/weeks?limit=20&before=<UUID>` returns owned saved rows, max fifty/page. POST `/api/v1/account/weeks`:

```json
{"id":"11111111-1111-4111-8111-111111111111","revision":0,"week":{"snapshotVersion":6,"snapshotSha256":"<server-pinned exact-byte hash>","solverRevision":"<server revision>","catalogRevision":"<server revision>","recipeIds":["<fifteen actual pinned IDs>"],"seed":7}}
```

The displayed one-item array deliberately cannot pass validation. Server-only immutable pins establish version/hash/revisions and known IDs. Client saved choices are not feasibility/nutritional proof. Current minimal saved shape does not contain budget/calorie/ZIP/store inputs: preserve those locally with the pinned week and request a separately reviewed versioned saved-input extension before claiming complete cross-device week reconstruction. Never solve old recipe IDs against today's catalog silently.

DELETE account body `{"confirmation":"DELETE MY ACCOUNT"}` requires supported signed AMR authentication within five minutes, not a refreshed JWT timestamp. Both HTTP and independently callable SQL require the confirmation. Immediate pending state removes owned preferences/weeks/push and denies old JWT/bootstrap. GET `/api/v1/account/deletion` remains reachable for pending dependencies while Auth still exists; after Auth deletion the app cannot poll with an old session. The unbound worker still needs durable claim, verified current provider identities, Apple token revocation, Auth deletion/session invalidation and retry-safe completion. Never derive Apple linkage from client fields. No real deletion was performed. [Apple requires in-app deletion and Apple token revocation](https://developer.apple.com/support/offering-account-deletion-in-your-app/). Deletion does not cancel an Apple subscription; show Manage subscriptions without making cancellation a prerequisite to deletion. Tombstone/billing/vendor/backup retention needs policy approval.

## Offering and purchase proof

Use the existing Protein Plan entitlement/monthly/annual products only after authenticated inspection. They were not verified in this session. Prices remain $8.99/month and $48/year; Apple's exact annual price point is a configuration gate, not permission to substitute another amount. Draft an eligible two-week trial in the existing subscription group, never activate it here. Show actual localized post-trial total and period, auto-renewal/cancellation, restore, terms and privacy. Ineligible customers receive the actual purchase/restore state without a promised second trial or invented discount. [Apple limits introductory eligibility by subscription group](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions).

RevenueCat CustomerInfo originalPurchaseDate is the app's original purchase/download date; EntitlementInfo originalPurchaseDate refers to first purchase of the entitlement. [Vendor definitions](https://www.revenuecat.com/docs/customers/customer-info) do not resolve the founder's intended founders interpretation or release/window. Keep badge/invite unset. Apple IAP credentials are distinct from the App Store submission key. [Expo Go RevenueCat preview uses mocks](https://www.revenuecat.com/docs/getting-started/installation/expo); native development/TestFlight store purchase proof remains mandatory.

## Food download and proposed quantity contract

Current public GET `/api/data/latest` returns `{version,url,sha256,created_at,config}`, not the app's legacy composed snapshot. GET `/api/data/<version>` pins an older pointer. October 5 read-only baseline was v6, 82 recipes/79 SKUs, 163,016 bytes, exact hash in `overnight-baseline.json`. This run did not publish it and its source/price gaps remain. Never install private purchase-equivalent staging as true per-100-g nutrients.

Later refresh implementation: validate a bounded pointer, permitted HTTPS storage origin/path/version and SHA-256; download bounded exact bytes without accepting arbitrary redirects; hash bytes before decoding/JSON parsing; validate schema and pointer/blob version agreement; verify source/safety/quantity/catalog provenance under the separately approved versioned contract. Write a new temporary artifact, install data/revision atomically only after every check, retain last-good and pinned saved-week bytes. Truncation/hash/schema failure, outage and interruption leave last-good intact. Prevent different bytes reusing one immutable version. Never infer food safety from a matching hash or preserve a stale recipe approval across changed evidence. Add native corrupted-download, restart and saved-version tests before enabling refresh.

Proposed **v2 reviewed catalog envelope, not a public route/schema change**:

```ts
type ReviewedCatalogV2 = {
  schemaVersion: 2;
  catalogRevision: string; solverRevision: string;
  exactBytesSha256: string; sourceDigest: string; approvalDigest: string;
  snapshot: Snapshot; // TRUE edible-source per-100-g nutrients, never private yield projection
  ingredients: Record<string, {
    status: "reviewed" | "unknown";
    allergens: string[] | null; dietCategories: string[] | null;
    packageCrossContact: "unverified";
    quantity: {
      purchaseBasisDigest: string;
      sourceBasis: "dry" | "raw-edible" | "frozen-edible" | "piece-edible";
      ediblePerPurchased: number; sourceUrl: string; recordId?: number;
      yieldSourceUrl: string; reviewRevision: string; limits: string;
    } | null;
  }>;
  approvedRecipeIds: string[];
};
```

Exact stored-byte hash belongs to the pointer/manifest, not a circular hash inside its own bytes; the type above describes the installed envelope plus external manifest. All fields need formal compatibility/validation review before publication. Unknown metadata/yields or stale source approvals reject restricted selection, variant additions, full ingredient filtering and substitute selection. Reviewed-empty lists are not null and do not certify package cross-contact. Piece eggs buy counts with 50 g edible contents, not 50 g measured whole-shell mass. Raw onion yield 0.88 means 80 g edible needs 90.909... g physical preparation; nutrients use 80 g, trim 10.909... g. Cooking water adds no nutrients. Weigh raw edible portions, not cooked water-expanded portions; do not apply yield twice.

Owned kitchen entries proposed as `{skuId,fraction,purchaseBasis}`. The implemented private `reviewed-pantry.ts` proves whole-pack subtraction/evaluation, but the on-device search is not connected or pantry-optimized. Custom unmatched names, binary availability, a different package or cooked leftovers cannot become an arbitrary free reviewed SKU. Report consumed edible quantities, preparation trim and new/owned carryover separately; confirmation never stretches portions to make protein or waste claims. Original cents/dates and one buffer only. Reference estimates are not local coverage; Idaho, Miami/Florida and Alaska remain unverified.

## Rerolls and notifications

Rerolls are included when access is allowed. Existing restricted candidates test full-week constraints and return at most six; some vegan/high-protein breakfasts have none. Before applying a choice, recompute all fifteen IDs, nutrient bands, repeats/floors/share, household whole-pack purchases, physical pantry, restrictions and list costs; commit week/list together. Check same-day duplicate IDs/families deterministically without copying the old app's relaxed-band repair. The founder must settle strict same-list versus bounded addition/pantry policy and budget behavior. No unlimited additions, stale paid total or PR #21 tolerance override. Current mathematical candidates are not that product decision.

Notifications: ask optional permission only in a chosen flow; refusal never blocks access. Persist explicit account opt-in, then use the account-owned registration/revocation endpoint with exact configured Expo project/environment and device UUID. Private tokens never enter share cards/logs. Revoke before logout/switch/delete; handle offline cleanup. Independent local reminders may need no server. No reminder type/time chosen, no campaign/schedule/live dispatcher. [NOTIFICATIONS-OPERATIONS-V1.md](NOTIFICATIONS-OPERATIONS-V1.md) contains shapes, disabled transport, receipt/token-rotation protections and monitoring limits.

## Configuration and rollout order

Names only: `SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_ANON_KEY` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` for supported Auth/public client configuration. `SUPABASE_SERVICE_ROLE_KEY`, `REVENUECAT_SECRET_API_KEY` and `REVENUECAT_WEBHOOK_AUTHORIZATION` stay server-only. Backend activation names: `WD_ACCOUNT_API_ENABLED`, `WD_ACCOUNT_CATALOG_REVISION`, `WD_BILLING_API_ENABLED`, `WD_REVENUECAT_CONFIGURATION_VERIFIED`, `REVENUECAT_APP_ID`, `REVENUECAT_PROTEIN_ENTITLEMENT_ID`, `REVENUECAT_MONTHLY_PRODUCT_ID`, `REVENUECAT_ANNUAL_PRODUCT_ID`, `WD_NOTIFICATIONS_API_ENABLED`, `WD_EXPO_PROJECT_ID`, `WD_PUSH_ENVIRONMENT`, `WD_OPERATIONS_ENABLED`, `WD_SUPPORT_DURABLE_SENDS_ENABLED`. Never infer setup from an installed plugin or historical account ID.

First: resolve provider/email/transfer/deletion-retention/offer configuration with read-only evidence. Then test all six unapplied migrations in an explicitly disposable Supabase-compatible database, real Auth/PostgREST A/B isolation and concurrent connections. Obtain separate migration/rollout approval, reviewed immutable catalog pin/versioned safety contract, native SDK integration, sandbox/device acceptance, privacy/website updates. Only then separately authorize deployment/provider activation/publication. Current staged publication is deliberately blocked by source/price evidence, not ready to bypass. Storage upload, pointer CAS and Git mirror are separate failure boundaries; retain immutable orphans for retry, never remove them automatically. The prepared support send guard requires all senders to use its reservations; a complete durable support outbox and distributed form/signup abuse protection remain separate operational gaps.

Recovery: keep new backend flags off; retain tombstones, transaction ownership and pending jobs; restore prior verified client artifact and do not drop tables/engine data or reset databases. Billing outage cannot create access; changed source/hash cannot inherit approval. Old anonymous data contracts stay compatible, but publicly downloaded data/on-device solving cannot become secret after login. This is not DRM or a complete native access wall.

## Native acceptance before release

Real iPhone native development/TestFlight evidence: Apple/Google/email nonce/PKCE/callback and cancel/error; session refresh/relaunch/logout/switch with A/B private cache isolation; recent-auth deletion including retry/Apple revocation and subscription disclosure; eligible real trial, ineligible purchase state, pending/canceled purchase, localized disclosures, renewal/cancel/expiry/refund/grace, restart/restore and transfer conflict; offline before/after verified expiry; corrupt/pinned data fallback; all eighteen reviewed profiles, restrictions/unknowns, partial pantry and reroll atomic list math; notification refusal/opt-in/rotation/logout/delete/receipt behavior; VoiceOver/Dynamic Type/reduced motion/44-point targets, sharing/cancel, haptics, cold/warm Hermes timings and complete tour captures. No existing code or desktop test substitutes for these captures.

Website owner must separately update old Free/accountless/offer/privacy/support text and configured App Store destination, keep delivery/receipt/chatbot/checkout/waitlist hidden, verify email delivery and reviewer support/terms/privacy links. Current `/ios` redirects home. Reviewer account/access procedures must use real configured store eligibility and stable test data, not a universal trial or bypass promise. New collected-data/privacy labels and retention are drafts awaiting legal/product approval.

## October 6, 2026: source-backed launch-gap audit

[Current audit](LAUNCH-READINESS-AUDIT-2026-10-06.md) supersedes readiness inference from local test counts. Fresh281 backend/139 app tests and ordinary typechecks/backend lint/voice/app greps pass; previous unchanged export is rehashed, not new native acceptance. Account/billing/deletion remain hard-off and absent from product. Provider/configuration inspection is saved October5 evidence, not fresh deployed proof.

Actual dry coordinator probe identifies an unblocked narrow preparation defect: server-verified TOKEN_REFRESHED closes cache readiness without rebind. Proposed next independent job repairs that transition with strict cleanup/owner/generation fences, no native SDK/UI/flag activation. Actual legacy app still stretches portions, permits synthetic unknown safety and exposes receipt fixtures if only tiers flips. These need separately reviewed compatibility/production exclusions; private reviewed food/quotes do not fix app paths. Exact website owner files, eight unapplied migrations, hosted/native/provider/food/real-price/policy/rollout gates and readiness target are in the audit. No follow-up self-authorized.

## October 6, 2026: verified refresh recovery checkpoint

[Accepted app report](../../wisedinner-app/reports/APP-VERIFIED-REFRESH-LOCAL.md) records LOCAL same-owner coordinator recovery after fresh getUser and acknowledged namespace cleanup. Source949fbd2;18 new/83 focused/157 full app,46 affected actual handler/memory SQL cases, ordinary typecheck/source greps and exclusive offline export/privacy checks pass. Default-off/native unavailable/product unreachable, no billing grant or mutation replay, unexpected owners/restart/logout/delete/failures remain closed. Backend runtime/schema unchanged; earlier281 broad evidence remains previous. Native/provider/hosted/eight migrations/food/store/policy/rollout remain open. Proposed guarded isolated acceptance0012/0013 extension needs independent review; no new job or activation is authorized here.

## October 6, 2026: guarded isolated lifecycle acceptance checkpoint

[New report](ISOLATED-LIFECYCLE-ACCEPTANCE-LOCAL.md): LOCAL only, source c4349e5/a0306fe. Trusted0006-0013 inventory, stale/shared-target refusal before effects, actual handler/SQL/durable worker/outbox orchestration, selected acknowledgment-loss recovery and held unknown outcomes.22 focused/65 affected/299 full backend tests and ordinary typecheck/lint/voice/build/diff pass; all eight shared migrations remain unapplied, real hosted/providers/native unrun. No runtime/app/schema/core/dependency/flag/public-data change. App104f95f saved refresh evidence remains earlier proof. Proposed separate next job is production receipt-fixture exclusion at app/receipts.tsx: tiers-enabled production currently admits fixture claims, and the audit reproduces it. No subscription UI or activation is authorized by this handoff.

## October 6, 2026: receipt fixture release exclusion

LOCAL only, app source0639858: release /receipts redirects home independent of tiers and cannot load fixture/preview/config hook; developer preview moved intact into src/dev and smoke/tour retain the path.9 focused/166 full app, ordinary typecheck/greps/offline export pass; actual HBC controls plus absent receipt/private markers and map graph verified. Report: ../../wisedinner-app/reports/APP-RECEIPT-FIXTURE-EXCLUSION-LOCAL.md. Lint unexpectedly auto-bootstrapped, stopped only verified owned tooling PIDs; exact package edits recovered, unavailable result preserved. No flags/provider/native/core/backend activation or device claim. Next proposed independent local slice is unknown ingredient metadata admission at app tagsOf/exclusions, with known-food controls and no core port. Launch-ready NO; all prior native/provider/hosted/migration/food/price/policy/website/rollout requirements remain.

## October 6, 2026: ingredient admission checkpoint

LOCAL app source996f472: actual lookup/filter and direct diet/allergen helpers distinguish unvalidated null from authored empty arrays, refuse inherited/malformed names/records before the unchanged core.33 focused/173 full app, ordinary typecheck/source/default greps and exclusive offline production export pass;41 staples/113 authored tags and27 exact legacy outputs preserved. Report ../../wisedinner-app/reports/APP-INGREDIENT-ADMISSION-LOCAL.md. Backend runtime/schema/harness unchanged atbeb0dc1; prior299/65/22 proof reused, not rerun. Lint/config/doctor unavailable, native/device/food/package/kitchen/cross-contact and consumed-only quantity proof remain separate gates. Proposed independent next local seam: optional hard-off notification registration/revocation client through src/account coordinator/transport against existing POST/DELETE /api/v1/notifications, dry ports only. Existing client lacks this route and persistent push remains null; refusal must stay nongating, exact account/opt-in/project/revision ownership and stale cleanup need actual-handler regressions. No reminder type/time, native SDK, dispatch or activation decision follows.

## October 6, 2026: legacy snapshot decoder checkpoint

LOCAL app source0fbbc4b closes only malformed legacy-v1 admission: own data/dense/plain shapes, declared version, supported identifiers/flags, calendar dates, finite nonnegative and representable numeric operations.47 focused/184 full app, ordinary tsc -b/source/default greps/exclusive offline production export pass;106 product pins/41 staples/113 authored tags/27 complete legacy outputs preserved. Refresh false, backend pointer/blob incompatible, no price/quantity/core/native/API activation. Report ../../wisedinner-app/reports/APP-SNAPSHOT-DECODER-LOCAL.md; lint/doctor unavailable and all prior native/provider/hosted/eight migrations/food/price/policy/website/rollout gates remain. Backend productbeb0dc1 unchanged, prior299 proof reused. Actual read-only next-seam probe shows src/store/answers-pure.ts isComplete accepts NaN budget/Infinity household as complete before answers.ts commit; normal/missing-diet controls recorded. Propose separately reviewed finite/structural answers commit admission preserving valid canonical inputs, honest below-minimum states/custom pantry and unchanged solver; no fix or persistence-policy decision in this turn.

## October 6, 2026: answers admission checkpoint

LOCAL app source271de3a validates/copies own dense answers before commit/startDraft/setPantry/setDraft state changes, preserving original work on refusal and allowing valid draft corrections.77 affected/191 full app, ordinary typecheck/greps/offline production export pass;105 unowned pins/26 user files and27 complete canonical/week outputs unchanged. Report ../../wisedinner-app/reports/APP-ANSWERS-ADMISSION-LOCAL.md; no storage key/version/migration, core/data/flags/lifecycle/provider/backend change. Current-version hydrated answers remain an independent gap: actual migrateAnswers plus compiled useWeek solve/regenerate invokes synthetic core ports despite negative budget/unsupported diet/null pantry. This job only records it; propose a separately reviewed planning-dispatch guard with0effects on refusal, valid deterministic controls and no new recovery policy. All previous native/provider/hosted/eight unapplied migrations/consumed-food/kitchen/cross-contact/store/policy/website/rollout requirements remain, launch-ready NO.
