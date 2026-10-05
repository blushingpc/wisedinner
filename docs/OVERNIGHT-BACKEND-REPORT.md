# Overnight backend result, October 5, 2026

All six reviewed-only profiles pass seeds 0, 7 and 19 through the real restricted solver and independent arithmetic. The backend has locally tested account ownership, subscription access reconciliation, optional push infrastructure, durable support send reservations and stage-before-publish safeguards. The app is not connected and this is not launch readiness.

## Run and ownership

Started October 4 at 22:47:35 America/New_York, October 5 02:47:35 UTC. Starting branch `codex/backend-readiness`, clean HEAD `6eddd9c`. Implementation ends at `2526e53`; the final documentation commit follows it. Handoff checkpoint saved at 05:23:40 UTC after 2 h 36 min 5 s. Final terminal response records the final elapsed time and documentation commit; `overnight-session-evidence.json` saves the exact checkpoint/file list. No branch switch, reset, stash, blanket staging or push.

Current October 4 account/eligible trial/included-reroll/optional-notification decisions override historical Free/paid-reroll/no-account scope. Prices remain $8.99 monthly/$48 annual. No product ID, commercial offer, founder date, release or grocery policy was invented. Six migrations, `0006` through `0011`, are prepared and unapplied to hosted/shared databases. New activation flags are absent/disabled in the inspected local environment.

| Local commit | Verified slice |
| --- | --- |
| `2c2558c` | Verified account ownership, bounded preferences/saved pins, deletion lifecycle and actual isolated SQL |
| `42815d8` | Opaque billing binding, provider-truth access, authenticated inbox and reconciliation |
| `49c2534` | Original whole-grain pasta review and initial restricted-diet preparations |
| `c2892a5` | Exact offered-pack provenance, staged acceptance, immutable storage/CAS preparation |
| `3516370` | Optional push ownership/receipts, coarse monitoring, support validation/current facts |
| `5539096` | All eighteen reviewed weeks pass; physical partial-pantry accounting |
| `c9587a9` | Direct RPC independently enforces account-deletion intent |
| `7e9e25e` | Stage-only workflow removes write authority and unused credentials |
| `6fb3b41` | Durable support send allowance, duplicate suppression and held SMTP uncertainty |
| `2526e53` | Webhook no-store regression and compiled-route privacy proof |

Owned changes include `lib/account*`, `lib/billing*`, `lib/notifications*`, `lib/operations*`, support modules/tests, new `/api/v1/` routes, narrow status/support changes, price/staging/publication/reviewed-food scripts/tests, six additive migration files, local workflow proposal, package lock and durable evidence/docs/tasks. The sole dependency addition is test-only PGlite 0.5.8, installed with scripts/audit/funding disabled. No production service or native SDK added. Complete owned file names are in the session evidence.

App HEAD `6db5a69` and its existing dirty `PROGRESS.md`, `reports/`, `research_notes/` were preserved. Website committed HEAD `74b6f8b` was inspected using Git, never its worktree or runtime. Only this backend checkout and the relevant WiseDinner brain/log were edited.

## What is proved, and where

| Area | Implemented and tested locally | Proof still missing |
| --- | --- | --- |
| Accounts | Auth-server verification before signed claim checks; A/B ownership, limits, idempotency, revisions, immutable saved pins and tombstone denial | Real Supabase Auth/PostgREST, concurrent connections, OAuth callback/nonce/PKCE, protected native storage |
| Deletion | Recent signed AMR and intent enforced in HTTP and SQL; immediate owned-data/push cleanup and no resurrection; retryable worker seam | Bound worker, Apple token revocation, Auth invalidation, retention/vendor deletion and native flow |
| Billing | Synthetic provider/HTTP truth tests; opaque identities, private transaction ownership, durable authenticated inbox, order/retry/environment isolation | Authenticated products/entitlement/price inspection, configured offer/webhook/worker, real Apple purchase/restore/expiry |
| Food | Source/quantity/safety gates, 108 internal approvals, eighteen deterministic restricted solves and independent pack/nutrient checks | Kitchen/taste/timing validation, package cross-contact, broader allergy coverage, versioned public/app contract |
| Publication | Exact future-import pack evidence; sealed stage, immutable bytes, pointer CAS and fault injection | Source/price coverage, hosted contention/storage, coordinated separately authorized rollout |
| Push | Ownership/opt-in/project/environment/revision tests, rotation-safe receipts, uncertain-send handling | Native permission/token/receipts, chosen reminder, configured project/real transport and schedule |
| Operations/support | Attempt/success/freshness, dry alerts, redacted bounded requests, loop/provider faults, durable send cap | External clock/phone alert, eventual-delivery outbox, durable form/signup abuse defense and production mail |

Actual SQL/RLS executes in explicitly ephemeral `PGlite.create("memory://")`, without URLs, credentials or network database targets. It exercises grants, authenticated/anonymous/server roles, A/B ownership, direct-write denial, revisions, tombstones, billing isolation, publication CAS, push cleanup and support reservations. Auth claims are emulated and PGlite queues one connection. This is SQL execution, not hosted Supabase or true multi-connection proof. `psql` and Docker were not callable.

Read-only coarse Auth configuration returned Apple disabled, Google disabled, email enabled and signup enabled. SMTP, OAuth identifiers/callbacks and native login were not verified. RevenueCat MCP/CLI/configuration access was unavailable. Provider tests are synthetic only. No real user was created/deleted or store purchase attempted. Restore/alias/transfer conflicts are held, not silently granted across accounts.

Cancellation stays active through verified expiry; expired/revoked/unknown and sandbox-in-production deny. Outages cannot create an entitlement or local grace. No local trial timer or new reroll charge. [Apple introductory eligibility](https://developer.apple.com/help/app-store-connect/manage-subscriptions/set-up-introductory-offers-for-auto-renewable-subscriptions) and [RevenueCat Expo Go mocks](https://www.revenuecat.com/docs/getting-started/installation/expo) require a real native offering/purchase test. The exact $48 annual Apple price point remains unverified. Account/support/restore/manage/deletion must remain available without paid access.

## Reviewed meals and remaining ingredient evidence

Before this run: 81 distinct structures, 63 approved, 18 chicken quarantine; thirteen combined nutrition/quantity-ready IDs; safety 26 reviewed/53 unknown. Now: **132 generated, 132 unique, 132 structurally valid, 108 review-ready and explicitly internally approved, 24 quarantined; zero kitchen tested**. Forty-five additional preparations above the preceding 63 were reviewed. The older 4,704 drafts remain separate historical drafts, not approved meals or this acceptance dataset.

Combined nutrition/quantity-ready coverage is **14/79**, with all **65 excluded IDs** listed in `ingredient-catalog/overnight-plant-acceptance.json` and `overnight-final-state.json`. Safety metadata covers every catalog ID explicitly: **27 reviewed, 52 unknown**. Reviewed-empty differs from unknown; all package cross-contact remains unverified. Nutrition approval alone does not certify allergy safety.

Ready IDs: ground-turkey, ground-beef, eggs, lentils, frozen-edamame, white-rice, brown-rice, quinoa, frozen-broccoli, onions, carrots, tomatoes, oats, ww-spaghetti. Generic references retain their applicability limits and are not branded package certification.

The new source is the already-mapped US Barilla whole-grain spaghetti 16 oz UPC `0007680800584`, GTIN `00076808005844`. The [original manufacturer panel/composition](https://www.connect.syncpdi.com/sync_pdi/servlet/ItemDynSpec?GTIN=00076808005844&ID=barillaretail&InstanceID=9c6e678cdec83538c880e1b567dd3ac9) and mapped package establish 56 g dry: protein 8 g, 180 kcal, fat 1.5 g, carbs 39 g. Exact conversion is each rounded source value ×100/56; label precision is retained. Physical 16 oz purchase is independently converted. Absorption directions retain water/liquid; water adds no nutrients. Ingredient is whole-grain durum wheat. Conflicting egg cross-contact statements cause conservative egg exclusion, not a safe-package claim. Access date and original links are in `overnight-labels.json`.

Plain spaghetti `0001111085004` remains blocked: original page's six servings conflicts with 1/8 of a 16 oz package, and package-image transport failed. Existing tempeh composition was found but full original nutrition panel was not retrieved. Pea powder and plain almond yogurt need actual product choices; the mapped flavored peanut blend is not pea powder. Raw whole-potato yield and the claimed fixed chicken pack remain unsupported. No brand was chosen or proxy nutrient/yield fabricated.

Neutral images and original ingredient-matched directions were used. No unlisted oil/sauce/garnish or cooking validation claimed. The twelve final edamame-led brown-rice/quinoa preparations close vegan variety without a new source or weakened rule. Prior source/approval/acceptance files remain intact. Changed source, safety, quantity or preparation digests invalidate approvals.

## All six profiles, unchanged constraints

Each cell is the whole purchasable-pack **reference estimate**. Every profile passes all three seeds, with no remaining hard-constraint miss in this exact dataset.

| Profile | Seed 0 | Seed 7 | Seed 19 |
| --- | ---: | ---: | ---: |
| Typical $60, 150 g/day, one person | $49.32 | $49.32 | $50.74 |
| Floor $45, 100 g/day | $39.73 | $39.73 | $40.06 |
| Household two $120, 150 g/day each | $82.48 | $82.35 | $83.65 |
| Vegan $50, 100 g/day | $49.96 | $49.96 | $49.96 |
| Vegetarian $55, 130 g/day | $50.47 | $50.14 | $50.47 |
| Dairy-free $90, 180 g/day | $59.66 | $58.45 | $61.08 |

Typical weakest unrounded days are 151.7566/152.4250/151.7926 g; daily calories stay within 1800–2800. Exact all-profile inputs, every day, fifteen chosen IDs, list rows, pack arithmetic, shares, repeats, floors and violations are in `overnight-plant-acceptance.json`. Repeated full outputs match, with no legacy/synthetic anchors. Household nutrition is per person and purchased quantity is multiplied before pack rounding. No same-day identical lunch/dinner ID appears in these eighteen weeks; that is sampled evidence, not a new relaxed/repaired constraint.

Vegan has four cents of price headroom. Some vegan/high-protein breakfast slots have zero or one returned substitute. All fifteen slots were exercised and every returned candidate independently re-evaluated; six is an API return cap, not an exhaustive preparation count. Egg exclusions retain 75 recipes and pass; peanut/tree-nut ingredient exclusions retain 108 and pass. Soy exclusion leaves no eligible family; gluten-free retains 72 mains but no breakfast, so those cases remain honest misses. Unknown/empty metadata and unknown variant additions fail closed. None of this establishes package certification, the unresolved reroll grocery rule or connected app behavior.

Catalog SHA-256: `103d22c976376de3e6cb68b634bb0c61c8060caa8800c6e60c1d7c45a070e594`.
Source/review digest: `ff686106f0cdbf67195cb796f9eec3a96366256f76b2e65da87fccc29cb1dd3f`.
Approval digest: `38f50a19f4badfcac3e7756da52bbd569eae9f046734a6cf61d8ffc7d37d5462`.

## Purchased, edible, trim and carryover

True source nutrients stay in the edible-source catalog. Private purchase-equivalent projection is solely an internal compatibility seam and must never be published as real per-100-g nutrients. Applicable FBG yields are raw planning estimates, not measured customer packages. No yield is applied twice.

Typical seed 0 onions: one physical 3 lb pack is 1360.776 g, $3.73 dated September 27. Authored edible consumption is 880 g; at yield 0.88 it needs 1000 g prepared purchased mass, produces 120 g trim and leaves 360.776 g unprepared carryover. Source nutrition counts only 880 g: 9.68 g protein and 352 kcal across the week. It does not count trim or all the purchased pack. Piece eggs buy whole counts, with 50 g edible contents/count, not a measured 50 g shell-inclusive purchase.

Private physical pantry entries require stable SKU ID, fraction and pinned pack-basis digest. Owned quantity is subtracted before whole-pack rounding; edible consumption/nutrients never change. Six real typical/household examples pass. Typical half-pack examples cost $44.38/$44.38/$45.80 instead of $49.32/$49.32/$50.74. New and owned carryover are separate; unused owned stock is not manufactured consumption. Full rows are in `overnight-pantry-acceptance.json`. This re-evaluates a conservative baseline solve; it is not a pantry-optimized search, cooked-leftover mapping or public/app contract.

First process solve 412.99 ms; first solves 276.89–475.98 ms, warm 269.36–470.95 ms. Pools are 51 vegan, 60 vegetarian and 96 otherwise, cap unchanged. Sampled RSS 92.57–150.29 MB. Node 24.17.0, Windows 10.0.26200, i5-14400F/16 logical CPUs, 16,094 MB shared desktop. No OS-cache flush or isolated peak-memory claim. Desktop results do not prove iPhone/Hermes performance.

## Prices and publication are deliberately blocked

Future import rejects the reproduced four-pound-offer/one-pound-authored-price conversion. Original exact identity/form/pack/unit-sold review, offer/item/location/channel/date/cents and immutable mapping fingerprint are required. Multipacks/variable weight stay quarantined. Today's map cannot certify an older observation. No price refreshed or invented and no double buffer.

Actual isolated `--stage=data/pipeline/overnight/public-candidate-20261005-0405` exits blocked: **0 of 387 September 10 cached prices** have immutable original provenance. Request ZIPs are Columbus 78, Atlanta 78, Houston 77, Los Angeles 77, Seattle 77; neighboring stores may differ from the request ZIP. Idaho, Miami/Florida and Alaska are unverified. Reference store indices are estimates, not local quotes or nationwide coverage. Six cached nutrition guards also reject assembly: chicken-thighs invalid carbs, pea-protein, plant-yogurt, russet-potatoes, frozen-peppers-onions and taco-seasoning identity. Original public rows were not repaired or deleted.

The local workflow now has read-only Git permission, no unused credentials and isolated staged acceptance only. Legacy `--local`/publish refuses public mutation. Fault tests cover source/schema/fixtures/tests/upload/pointer/immutable conflicts/interrupted retry. Storage, atomic pointer and Git mirror are separate boundaries. Pre-publication failure leaves public state untouched; pointer failure may retain an immutable orphan; mirror failure reports pending; superseded retries cannot mirror old data. Never overwrite immutable versions or delete orphaned production storage as recovery. Hosted rollout and all source coverage remain separate gates.

Fresh public pointer/blob is v6, 82 recipes/79 SKUs, 163,016 bytes, SHA-256 `a8700c74741c5f155b33dc3d7f2be1833b6165d98f38b1482390d6c208422668`. It predates this run and remains identical at final read. Local `data/snapshot.json` is byte-identical to starting HEAD; no data/public/content files changed. Hash agreement is integrity, not nutrition/price approval.

## Notifications, support and website limits

Push is private/account-owned, explicit opt-in and project/environment-pinned. Permission refusal does not block use. Logout/delete/switch cleanup and token-rotation-safe DeviceNotRegistered handling are prepared; no reminder type/time, live dispatcher, schedule or delivery was activated. Tickets are not device receipt proof. Local reminders may need no server.

Operations separate last attempt, success and coarse failure, with stale-generation protection and deduplicated dry failure/recovery alerts. No working phone alert or independent clock; a down database cannot reliably record its own failure. Support fixtures cover loop prevention, billing escalation, provider outage, daily caps and bounded requests. The default-off final send ledger bounds guarded parallel pollers and holds uncertainty. Inbound retry/deferred digest recovery still needs a complete durable outbox and a person's review of held mail. The bounded in-memory form limiter is not distributed abuse protection. Production SMTP/signup delivery is unverified; no support poll was invoked.

Public read-only website audit: `/ios` 307 to `/`, home/support/privacy/terms 200, no App Store listing link verified. Committed support form stores an open thread and does not auto-email the submitter. Old Free/accountless/privacy/offer text requires the separate website owner. No form submitted, mail read/sent or website product code edited.

New collected-data inventory and policy/Apple-label implications are drafted in `NOTIFICATIONS-OPERATIONS-V1.md`: Auth identifiers, private preferences/allergies, saved IDs/pins, billing/access and transaction hashes, optional device tokens, support and operational state. Old Data Not Collected is superseded for the connected build. Retention, vendor/backup deletion and reviewer procedures need product/legal approval; no legal duration invented.

## Verification and remaining release gates

Fresh baseline 151/151 in 24.213 s. Final changed-source gates: **220/220** tests in **30.555 s**, ordinary `npx tsc --noEmit`, `npm run lint` zero errors/warnings, `npm run lint:voice`, sequential `npm run build`, `git diff --check` all pass. No nonincremental fallback or build/network retry needed. Only existing Edge runtime deprecation/static-generation warnings remain. Ten local verified implementation commits precede final documentation. Eight actual compiled localhost private endpoints refuse access with 503/no-store while unconfigured. The initial webhook-header mismatch was reproduced in a failing test and corrected before these final gates. Own localhost processes were stopped by exact checked PID. No support poll/provider was called. A read-only aggregate diff diagnostic exceeded Node's buffer; bounded per-file retry passed, not a backend or hook failure. No fresh global Hook failed stderr appeared; the old hook issue remains undiagnosed and unchanged.

- Food/publication: actual source/package/price closure, versioned true-nutrient safety/quantity contract, immutable observation freshness/coverage policy and staged acceptance before separately authorized publication.
- Account isolation/deletion: disposable Supabase-compatible Auth/PostgREST A/B and true concurrent tests, nonce/PKCE/provider callbacks, bound deletion/revocation worker and approved retention. SQL files are not applied.
- Trial purchases: authenticated existing product/entitlement/annual price evidence, eligible two-week offering, native real trial/ineligible purchase/restart/restore/cancel/expiry/refund/grace/transfer. No offer activated.
- App connection: version-matched SDKs/protected sessions/account caches, verified access wall, stable-ID unknown rejection, reviewed quantity/core port, full-week included rerolls, atomic list install and last-good pinned download. Separate receipt/delivery guards must stay hidden when billing flags change.
- Prices: original actual purchasable packs/local dates, unsupported-area/freshness/accuracy decision; current vegan headroom is fragile.
- Privacy/website/mail: current account/purchase/push disclosures, retention/deletion/vendor policy, real App Store/support/legal destinations, production SMTP and reviewer access. No legal/public policy approved here.
- Operations: hosted send contention, support outbox/recovery, durable abuse defense, external liveness/support clock and separately activated/tested alert transport.
- Native/TestFlight/Apple review: real iPhone auth/purchases/offline/push, accessibility/sharing/haptics/Hermes timings and complete tour captures, then separately authorized native build/submission and reviewer proof. Existing tour code with zero captures is not device acceptance.

Founder choices remain email code versus link, reroll grocery-addition/budget behavior, release/founders interpretation, restore transfer, unsupported-location accuracy/freshness and privacy/retention. Recommend passwordless email code, but activation stays unset. No separate founders product/discount or commercial offer was selected. [RevenueCat date definitions](https://www.revenuecat.com/docs/customers/customer-info) distinguish app-download history from entitlement purchase history.

## Exact handoff and recovery

Read `OVERNIGHT-APP-HANDOFF.md` for actual app seams, endpoint examples, names-only configuration, rollout/rollback and device checklist. Read `tasks/OVERNIGHT-BACKEND-PLAN.md` and inspect Git status before resuming. Durable exact eighteen-run food and six-run pantry evidence is under `docs/ingredient-catalog/`; isolated working outputs are under `data/pipeline/overnight/` and must never be bundled or treated as public nutrients. Artifact runners require new paths and must not overwrite earlier evidence.

Recommended next workstream: **separately authorized, configuration-evidenced native account/trial integration**, beginning with read-only provider/product/SMTP/callback checks and an explicitly disposable Supabase-compatible Auth/PostgREST test target. Do not enable refresh, tiers/receipt routes or new backend flags by assumption. Full support outbox and broader public data/price closure remain separate documented implementation tasks. This is an early verified handoff under the prompt's stop-earlier allowance, not a claimed three-to-six-hour completion or full backend finish. Remaining release proof depends on account/configuration access, decisions, separately authorized rollout and native work. No additional product edits are needed in this run to pretend those proofs exist.

Recovery keeps new flags/workers/writers off, retains immutable artifacts/tombstones/ownership/held receipts and prior client/public data. Never drop tables, delete shared/engine data, overwrite public versions or blindly resend uncertain mail. No public snapshot, shared database/ce_ tables, app product code, remote branch, production setting, paid service or real message changed. External interactions were free read-only source/configuration/public GETs and the authorized local test dependency download.

Skills used: Caveman investigate-first, lean-build, migration, verify-and-stop and commit style; humanize-writing; Supabase SQL/RLS/schema references; Expo/RevenueCat version-matched official integration references. Context7 was not callable, Serena lacked its required initialization tool and was unused; RevenueCat account tools/CLI, psql and Docker were unavailable. No coding agents, browser/device service, Graphify, GSD, Superpowers, BMAD, Codex Security or global hook/settings changes.
