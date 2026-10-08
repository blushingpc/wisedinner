# Local owner-plan receipt ordering repair

October 8, 2026. The CURRENT-only proposal successor now refuses lower cloud revisions and equal revisions carrying different canonical full state. Verification is LOCAL: injected transports, actual pinned app admission and PGlite memory SQL with synthetic claims. No runtime source, migration, private-v1 API, shared contract, flag or provider was installed or activated. A2/B2/G and launch acceptance remain open.

## Exact inputs and artifacts

Starting HEAD 0cf13c42aca4062cd9e1f3d3e81b41ce2588fc2d, codex/backend-readiness, empty index. Inherited status SHA2562658d2f9e54e8500afd240bb7dfdae21117e7ddddcdea654b4300d154f12a151 includes modified tasks/PROGRESS.md and tasks/QUEUE.md plus original untracked docs/RECIPE-PREPARATION-EQUIPMENT-LOCAL-2026-10-07.md. Exact before-note prefixes are saved; only owned dated suffixes enter this report commit. There is no product source commit in this job.

CURRENT:
C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T06-09-22-109Z-162bb066

Original producer A04:27 remains immutable: owner-plan-v2-manifest.json SHA2562dc4c7d80905e48dde697a5941d2e522ca2fdec7b5715b59e61213f3bdcf9ec1, executablebb53201e71999642084f89ce960350a598d272a77a5c9a6b206f514bfb564aa3 and all ten artifacts. Frozen independent B05:42 consumer report SHA2562e95c0653cd695e33ad3b9aee6299f03e25efaaf1406dabf07d09c50ebb89238 and canonical resultd9ab401c24f896e1c2692fdcf988d62cc072477c8148f892df525d1bed415665 remain unchanged. That verdict was REQUEST CHANGES: 54 successful controls, one diagnostic observation and two genuine failed required refusals. It was not accepted 57/57.

Successor manifest CURRENT/successor-manifest.json SHA256461efe6f029181f5350fada0b26d0e8be3e43989836a316a4612835d86a6fa68 freezes the executable, original-shaped contract, unchanged SQL/fixture/producer tests/vectors, amendment, receipt tests/vectors, config/lint and exact pin plumbing. New executable SHA2563ebd0a524d92a1adfb41f662eddcce1d22908430f35968ddac0518e8dcd8326f. All successor files are uninstalled review artifacts. The transport FORMAT and PINS remain unchanged; the separately versioned manifest and contract-amendment.md identify the repaired acceptance semantics.

CURRENT/proposal-repair.diff is the narrow executable delta. CURRENT/consumer-import-amendments.diff proves that actual complete consumer.test.mjs and receipt-boundary.test.mjs differ only in inventory import paths. Their assert.rejects, equality, ownership, storage and durable conditions are unchanged. Inventory helpers retarget only producer/output paths and verify original/successor hashes. The historical diagnostic that intentionally expects unsafe original behavior is excluded from successor acceptance by explicit --test-skip-pattern, not rewritten as a green assertion. No original writer/finalizer was replayed.

## Cause and repair

ProposalClient.read formerly checked shape, actual app state admission, session and concurrent serial, then unconditionally overwrote cloudRevision and receipt. Sequential revision3 followed by2 accepted stale state; revision3 followed by3 with changed state also accepted. Concurrent response serial checks and PUT expected+1 do not enforce sequential monotonicity.

The successor's private receipt acceptance layer runs after awaited actual admission and owner/serial revalidation. It compares against the current accepted cloudRevision/receipt. A lower revision refuses. Equal revision accepts only exact canonical full state equality, including null. Newer admitted data accepts. The guard runs before receipt/cloud counter/pending mutation. Both GET and successful PUT use it; PUT's existing expected+1 and exact command-state equality remain enforced. No server reset, permissive parser, aliased recipe, v1 hybrid or new readiness boolean was introduced.

The canonical full state remains answers, draft, week and checks. Source/catalog/solver/nutrient revisions and format, actual complete solver days/meals/list results, consumed portions, pantry quantities, exact monetary decimals/cents and check identities retain their original values. Null state is valid only at serverRevision0. Descriptor, prototype, sparse/duplicate, unknown-field, byte/number bounds and actual OwnerLocalPlannerState/admitStoredWeek admission remain unchanged. Backend-v6/current legacy app content remain incompatible; nothing maps the 83-row backend catalog into app templates or grants food/nutrition/price certification.

SQL proposal, repository, route and isolated policy bytes remain unchanged. The existing durable server snapshot/CAS/idempotency/account/billing/tombstone design is exercised as before. PGlite is explicitly memory://, synthetic A/B/anon/service_role and synthetic eligibility only. One serialized connection and overlapping promises do not prove hosted PostgREST/Auth or independent connection contention. No real customer/session credential, environment connection or service was used.

## Verification and retained failures

All heavy tests/types/lint/voice used the unchanged lane-driver.mjs --resource A -- wrapper with actual lane ancestry and one slot. Eight resource receipts closed and released without signal. CURRENT/*.command.json binds exact argv, UTC, source before/after hashes and exits; paired logs retain genuine results.

| Command label | UTC start to finish | Actual result |
| --- | --- | --- |
| original-required-red | 06:13:12 to 06:13:19 | Both unchanged required refusals fail against original producer, exit1, missing expected rejection |
| successor-required-green | 06:13:59 to 06:14:05 | Same two assertions pass against successor, exit0 |
| consumer-successor-final | 06:15:23 to 06:16:08 | 67 pass, one historical diagnostic failure, exit1; intended exclusion regex did not exclude it |
| consumer-successor-accepted | 06:17:04 to 06:17:46 | Explicit diagnostic exclusion works; 65 pass, two exclusive evidence-output collisions, exit1 |
| recovered-roundtrip-and-producer | 06:18:29 to 06:18:48 | Only two affected output tests plus19 copied producer controls pass, 21/21, exit0 |
| proposal-types | 06:19:59 to 06:20:01 | CURRENT-only config extending unchanged backend config, four TS artifacts pass, exit0 |
| scoped-lint | 06:20:04 to 06:20:06 | Four actual artifacts nonignored/effective rules, zero errors/warnings, exit0 |
| voice | 06:20:45 to 06:20:47 | Existing voice gate clean, exit0 |

Acceptance is composed evidence: 65 passing acceptance controls, two output cases recovered under fresh exclusive filenames, and19 producer controls yield86 distinct successful LOCAL controls. This is 56 unchanged independent consumer assertions,11 additional ordering controls and19 copied producer controls. The original two reds and repeated green assertions are not counted again. Failed aggregate runs remain failed; they are not relabeled exit0. No broad full matrix/build/export was repeated.

The two administrative output failures were EEXIST on earlier successor-roundtrip-vectors.json and successor-current-store-roundtrip.json. Existing bytes remained intact. Only output path plumbing changed to fresh successor-recovered-* filenames, and only the two affected tests were replayed with the producer controls. A read of a guessed prior lint.mjs path was unavailable; the actual frozen lint-proposal.mjs was used. Module-type and existing solver-gap diagnostics remain in logs; no package/config/global shim or solver change suppresses them. No live job was terminated and no uncertain external action replayed.

Covered: equal same full canonical values and independent copies; lower identical/changed state; equal changed state; higher full state; null revision0/repeated null and refusal after nonzero; concurrent out-of-order; GET overlapping successful PUT; malformed/unknown receipts; exact successful expected+1 save; same-key unknown-outcome retry body/key; pending receipt mismatch refusal; owner switch/logout reset and late response refusal; actual lifecycle ownership, inactive access and local replay refusal; complete/empty/draft/current eight-answer/pantry/check round-trip; canonical nutrients/list/paid quantity/cents tamper refusals; v1 independent metadata-only behavior; memory SQL A/B/anon isolation, idempotency, CAS, rollback, eligibility/environment and deletion tombstone controls.

CURRENT/receipt-ordering-vectors.json contains actual synthetic complete admitted state, all full field values, equal/lower/changed/higher/null receipts and source pins. Repeated vector generation independently matched existing exact bytes. CURRENT/successor-recovered-roundtrip-vectors.json and successor-recovered-current-store-roundtrip.json preserve actual consumer results. Receipt acceptance does not automatically install pending UI or local owner storage. Observer-detach/native seams are not repaired or certified here.

## Preservation and proof limits

107 starting preservation pins, 42 protected B inputs and121 public graph inputs match before/after. Exact source3818a97bf958c585fce2bdb1e6c97e1d215ff74bfc9b9da970d85640b3098545 remains bound. All ten original proposal artifacts, independent consumer assertion bytes, prior deletion adapter/evidence, private-v1/runtime/migrations/catalog/candidate and inherited history remain unchanged. B's concurrent route/copy job is excluded as an acceptance input.

CURRENT/dependency-closure.json additionally records the finite44-source import closure and21 installed dependency pins against the independently frozen B checkpoint. These exact bytes freshly matched during final preflight, including the two source dependencies not separately enumerated in the starting finite fixture list. This added check was after tests; it is not fabricated as an earlier hash measurement. Final reopen rechecks them. No current route scan/adoption or dependency install occurred. Backend package/config/public graph pins continue to bind prior ordinary types/LOCAL build evidence; only proposal artifact types were freshly required. A matching pin is compatibility evidence, not provider or genuine food/price proof.

CURRENT/report-commit.json records the report-only commit, exact report/manifest hashes and owned suffix blobs. CURRENT/evidence-index.json seals finite current artifacts/source/report evidence; separate read-only reopening checks regular non-symlink report freshness, exact bytes, protected dependencies, empty index and unchanged validateResult. Controller canonical result/state/events/workflow are excluded from pre-final seals; original history is not recursively copied or resealed. No managed skill edit is adopted; CURRENT/learning-result.md records the failure and narrow recoveries.

## Remaining gates and next action

Independent B consumer review must consume this SAME frozen successor executable, contract amendment, SQL, vectors and dependency pins in a fresh job after its current work finishes naturally. This A replay of B assertions does not self-certify both-side successor acceptance or authorize installation. A2/B2/J1/G, full-state runtime installation, historical malformed v1 rows/receipts, content/equipment consumer adoption, hosted Auth/concurrency, genuine provider/restore/device/store, physical food/yield/cross-contact, measured prices and release acceptance remain open.

The deletion adapter stays unbound/default-off. Its UUID-based lineage/lease-to-DELETE race is a real activation hold, unchanged by this receipt repair. Genuine Apple revocation and Auth deletion are unverified. Cooking/iPhone checks deferred to the demo remain required and unverified. Original October9 19:39:35UTC target, settled Apple/Google/email accounts, eligible14-day trial, $8.99 monthly/$48 annual, included rerolls and flagsOFF remain unchanged. Spending$0.

Rollback is withholding this uninstalled CURRENT successor while preserving original/failure evidence. Any later runtime installation or reversal needs separate reviewed scope and a data-preserving plan. No source revert, migration, DROP/reset/delete/provider action, credential/security grant, customer message, push, deployment or publication occurred. Next safe action is independent coordinator/B review of exact successor bytes, then a freshly reviewed next minimum-tree prerequisite or confirmed repair. No self-dispatch or new instruction queue was created.
