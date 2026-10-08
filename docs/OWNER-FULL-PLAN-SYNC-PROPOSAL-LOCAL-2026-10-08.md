# Full owner planning state proposal, local only

Completed a frozen executable proposal for independently reviewing the missing full-state cloud seam. Nothing is installed. Existing private-v1, routes, migrations, app source, published snapshot, recipe candidates and activation flags remain unchanged. A2/B2/J1/G and launch acceptance remain open. Verification level is LOCAL: current source code, synthetic Auth/storage/provider ports and isolated PGlite PostgreSQL WASM. No hosted Auth/PostgREST, real multi-connection contention, genuine billing/provider/native/device/food/price proof.

Current evidence: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T04-27-24-558Z-3409bc78`. All executable proposal, SQL, contract, vectors and tests are confined there. This report and dated task-note suffixes are the only repository edits.

## Existing capability and incompatibilities

Actual v1 `accountHandler`, `savedWeek`, `wd_account_command` and app `PrivateCache`/`parseWeeks` save/read snapshot/catalog/solver pins, 15 recipe IDs and a seed. They do not provide a supported answers/draft/certified result/checks round trip. The original capability assertion remains red: with an explicit synthetic metadata pin, full state gets HTTP 400 `unknown_field` and zero repository writes. The first incomplete-pin attempt instead returned 503 `catalog_pin_unavailable`; its original assertion and log remain preserved separately.

Additional independently reproduced issue: unchanged migration 0006's direct authenticated `save_week` RPC accepts extra fields within a valid metadata week. The unchanged exact app DTO refuses those extra fields. The memory-only `v1-direct-shape.test.ts` preserves this observation, without repairing v1 or treating unvalidated SQL storage as full-state capability. A separate security/compatibility review and repair is necessary before integration.

The proposal supports only the exact completed legacy app source `3818a97bf958c585fce2bdb1e6c97e1d215ff74bfc9b9da970d85640b3098545`. Backend v6's 83 recipes and the app legacy catalog are incompatible. No aliases, content translation or adoption are performed. Legacy `zeroWaste`/`delivery` result fields remain data, not approved product promises or Courier behavior.

## Frozen artifacts and behavior

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| owner-plan-v2-contract.json | 3816 | 56582fce4636e4baa144dd07931dc9d1aa41c6e5b12bfbbd5dbf3a3a55c66ed1 |
| owner-plan-v2-vectors.json | 22069 | 83a2436f437e7bb0e7e92debe2a20be3c22913b4cd9583b1c95e506a32095533 |
| owner-plan-v2-proposal.ts | 13221 | bb53201e71999642084f89ce960350a598d272a77a5c9a6b206f514bfb564aa3 |
| owner-plan-v2.sql | 14265 | 3a812fea6d0e0051315363d0e45d7d9344b448a1b8c820d65c00b83e4479092f |
| owner-plan-v2.test.ts | 18978 | 6d05fbe8dc9f069220cb64d5f18850928b62595b1f458ed5f63667953c2a36eb |

`owner-plan-v2-manifest.json` SHA256 is `2dc4c7d80905e48dde697a5941d2e522ca2fdec7b5715b59e61213f3bdcf9ec1`. It enumerates all ten frozen artifacts, prerequisite/source hashes, actual command receipts, compatibility verdicts, unsupported states, review stages and rollback. Report bytes/hash and the report-only commit are recorded externally in `report-commit.json` and the immutable seal, avoiding a self-referential report hash. No runtime source commit is created in this proposal job.

The separately named envelope contains `format`, explicit source/catalog/solver/nutrient and answer/week revisions, `expectedRevision`, and full `state:{answers,draft,week,checks}`. Durable read/write acknowledgement contains the full stored snapshot and `serverRevision`. Null state is allowed only at revision zero. Payloads cannot contain an owner identity, credentials, local storage keys, a whole catalog literal, tier/role/readiness grants or activation flags. UTF-8 size is bounded to 131072 bytes, nodes to 10000, depth to 12, arrays to 256 and strings to 4096. Descriptor copying refuses accessors without executing them, hidden properties, cycles, exotic prototypes, sparse arrays, unsafe numbers, unknown keys and incompatible pins.

Actual unchanged `OwnerLocalPlannerState.save` is used to reach its private parser through verified `SessionBoundary` fixtures. It invokes the actual canonical answer/pantry/check admission and `admitStoredWeek`, which replays the pinned legacy solver and consumed-nutrient adapter. Returned state must exactly match the canonical input, with no repair or dropped fields. Tests restore the durable SQL acknowledgement through that same real local parser, retaining $64.01, half-pack pantry quantities, exact result/portion strings and list check identities. This demonstrates preservation of existing calculations, not authentic nutrition, measured prices or remotely certified feasibility. Vectors can honestly retain an infeasible legacy result.

Cloud CAS revision is independent of app-local ticket revision. Same key and canonical command returns the original durable full receipt, even after a later document revision. Changed-body reuse conflicts; stale CAS refuses. Unknown transport outcome holds the original command/key and allows only explicit same-key retry. Overlapping preparations fence the older edit before transport; owner/session changes discard late acknowledgements and clear visible state. No unsaved pending UI is acknowledged as saved.

## Isolated SQL trust boundary

Only `PGlite.create('memory://')` runs. No file database, network, socket, external runtime, credential/environment store or shared Supabase target is read or written. Unchanged 0006/0007/0009/0013/0014 SQL is loaded into that disposable memory target. Other current migrations are preserved. Auth functions emulate claims and roles; provider/billing states and transaction hashes are synthetic fixtures entered through the existing server-only billing design.

The additive proposal has one document per account plus receipts, a singleton server policy and transaction-local replay staging. Authenticated RPC derives `auth.uid()` and role, locks the account then billing rows, checks active tombstone, exact shape/pins/bounds, configured environment, transaction ownership, holds and unexpired active/trial state, then CAS/idempotency. No client table-write grant exists. Anon and cross-owner reads/writes are refused. Ordinary reads never render an inactive account. Existing account management/deletion remains independent of planner entitlement.

SQL cannot replay TypeScript. Therefore every new write additionally requires the exact canonical command deposited by the trusted server replay validator in the same SQL transaction, keyed to the independently verified owner and operation. Authenticated callers cannot manufacture that staging row. The repository revalidates with the actual pinned parser rather than accepting a caller's validated flag. SQL independently checks the proposal shape and compares every nested value against the replay row; malformed/tampered direct RPC cannot bypass admission. This service-only validator and transaction-coupling are explicit dependencies for independent review, not food/identity readiness grants. No arbitrary JSON is accepted under a size check alone.

An isolated additive account-state trigger removes proposed documents, receipts and replay staging on deletion_pending/deleted transition while retaining the original account tombstone. Actual existing deletion initiation cleans proposal data and old JWT reads/writes cannot revive it; other owner and unrelated sentinel remain intact. This is a proposed integration, not an applied migration or external deletion.

RLS and security-definer privilege handling were checked against [Supabase RLS documentation](https://supabase.com/docs/guides/database/postgres/row-level-security) and [function security documentation](https://supabase.com/docs/guides/database/functions). Memory target and transaction API were checked against [PGlite API documentation](https://pglite.dev/docs/api). No vendor configuration was changed.

## Verification and preserved failures

Every test, typecheck, lint, voice and freeze command ran through the unchanged resource A wrapper. Exact executable arguments, UTC start/finish, exits and logs are in the named `.command.json`/`.log` pairs. Resource receipts prove natural child close and release. No fence bypass or process termination.

| Command label | Result |
| --- | --- |
| v1-capability-red | Expected failing assertion, HTTP 503 because initial probe omitted pin; zero writes. Preserved. |
| v1-capability-bound-red | Expected capability red, HTTP 400 unknown_field with explicit pin; zero writes. Preserved unchanged. |
| proposal-focused-1 | 18 checks passed on earlier proposal revision. Not substituted for final proof. |
| proposal-types-1 | Failed local TS narrowing/array annotations, original log preserved. |
| proposal-types-2 | UNRUN, resource busy exit75. Retried only at a safe checkpoint. |
| proposal-types-3 | Passed before final receipt/overlap amendments. Final source uses later proof below. |
| focused-final | 52 checks passed: 19 current proposal checks and 33 unchanged account/account-SQL/app-billing/billing checks. |
| proposal-types-final | CURRENT config extends unchanged backend config, final proposal/fixture/main test and original red probes passed. |
| ordinary-types | Ordinary unchanged backend `tsc --noEmit` passed against exact B42 inputs. |
| lint-effective | Three owned proposal TS files actually linted, no errors/warnings; explicit isPathIgnored/config/result coverage. Earlier CLI lint exit0 is not the effective coverage proof. |
| v1-direct-shape | One additional memory reproduction passed; records the unfixed v1 extra-field boundary. |
| voice | Existing user-facing source voice gate passed. It does not lint SQL or report prose. |
| freeze | Actual complete/empty/draft vectors admitted again; frozen artifacts/manifest saved. |

Malformed/getter/duplicate/source/nutrient/oversize tests preserve old input/documents. Failure after SQL write rolls back document, receipt and replay; retry returns the original receipt. Expired, unknown, revoked, held, wrong-environment and wrong-transaction-owner states deny mutation including old-key retries. Promise overlaps run against serialized memory connections; they are not real multi-connection contention. The v1 direct-probe TS file is an additional executed Node test, not covered by the earlier proposal type configuration.

Fresh full suite and Next build are UNRUN by this exact scope. Existing build proof is independently bound to unchanged 121 public/config inputs and 230 import edges; the proposal is not imported by runtime. Reviewed B source commit `304458e42f807c7f1aa3aaf5409bd02b268e0c77` / completed HEAD `c677ed6f4ff3df55278ef2ef6dd7a00daab23597` has 42 exact before/after matching inputs. No moving app HEAD or new UI files are adopted.

## Preservation, rollback and next safe action

Starting HEAD `077bbde7806db34e42945aa126583ff9525f7167`, branch codex/backend-readiness, empty index, inherited status SHA256 `2658d2f9e54e8500afd240bb7dfdae21117e7ddddcdea654b4300d154f12a151`. Note prefixes and original untracked equipment report remain byte-exact; only owned suffixes are staged against their committed prefixes. No reset/stash/broad staging. Public snapshot remains 208918 bytes, SHA256 `ec91a506d37c4a340fede59e7568319c9fddbec462452cc254481be4e78c1f20`. The previous three-step candidate, preparations and manifest remain frozen in their original run. Private-v1/public/core/config/package/history pins remain unchanged.

Rollback for this stage is to discard/uninstall the unactivated proposal while preserving evidence and old contracts; the report/note-only commit may be reverted separately after review. No runtime or database rollback was executed. If later installed, reversal is a separate reviewed expand/migrate/verify operation, never dropping data or tombstones. Managed skills remain read-only; learning.md records actual failures and no skill adoption.

Next is independent producer/security review, then B2 review of these same frozen contract, vectors and executable bytes against its exact legacy source. The discovered v1 direct-RPC shape issue needs a separately reviewed repair before integration. Only after both sides agree may a fresh job scope actual server/client/deletion installation, disposable hosted Auth/PostgREST/RLS/concurrency acceptance and subsequent native/provider tests. Do not self-dispatch or activate cloud sync.

Equipment/recipe consumer adoption and two thigh quantity holds, authentic food and measured price evidence, hosted ownership/concurrency, genuine account/trial/purchase/restore transactions, native/device/store/submission and release acceptance remain open. Founder-deferred food/iPhone checks are unverified. Original October9 19:39:35UTC target remains unchanged, with $0 new spending and no Apple/public completion promise.
