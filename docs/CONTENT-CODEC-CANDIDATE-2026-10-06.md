# Local successor content codec candidate, October 6, 2026

The separately UNACCEPTED `wd-content-codec-candidate-2` closes five demonstrated serialization/representation boundaries in an isolated executable lab. It is ready for independent coordinator and B review of the same frozen bytes. It is not adopted by either product. Planning and entitlement admission remain false; launch-ready remains no, including after the readiness target expired.

Evidence root: `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-07T00-05-50-259Z-fb493d5a` (CURRENT). All implementation, tests, schema, fixtures and vectors are there. Backend product source/core/data/tests/flags/dependencies/config/migrations and app/website/engine/HQ/controller remain unchanged. Product additions are this report and one unstaged owned progress suffix.

## Exact frozen deliverable

| Artifact | Bytes | SHA256 |
| --- | ---: | --- |
| `successor-manifest.json` | 17460 | `cf66edc566a29075b33b6826a636c3977981a896196b661a15585fc7641ac6dd` |
| portable `codec.mjs` | 18624 | `4c8f16a410f8ea981695d7f9908d3d3bed8f0bf6dd3e2e4434c4e6d2c1c36f01` |
| `exact-byte-vectors.json` | 2827 | `8afa45b376c19feb04ca5f31fc782d46a1ef0c6ed84a5814bf7a7ff3493e450d` |

The manifest pins exact code/test/schema/vector/fixture bytes, original red evidence, supplements, checked matrix and source-only trace. `compatibility-verdict.json` is the full field-by-field verdict. This manifest does not hash itself or mutable controller state. The later closed evidence index separately pins the manifest, final report and Git checkpoint.

Original proposal manifest `c85f7ebf1f1c703448310b702327f15ccea4e093dd0a6332f47cfb5de2daef7b` and proposal bytes `7e5ac38236c1f31bb6641a088a2fb553e7d327c9aa2f71b44870fb5693c2b350` remain unchanged. All 125 original manifest entries and the producer/consumer supplement entries were checked; 196 input pin checks/copies are recorded in `input-verification.json`. Producer supplement `86f71e7b...` and consumer supplement `6d9d603d...` remain separate prior verdicts, not successor approval.

## Reproduction and verification

Unchanged original code reproduces five failures: evidence labels pass without independent authority; duplicate JSON keys disappear; authored names/steps are rejected; metadata depends on nested insertion order; equal cents at distinct physical stores return identical quote objects. Its declared valid control still passes. Copied original source and first failures are retained; neither assertion nor frozen proposal was weakened.

| Command inside exclusive A resource wrapper | Time UTC | Exit / actual result |
| --- | --- | --- |
| `node --test inputs/producer/boundary.test.mjs quote-red.test.mjs` | 2026-10-07 00:22:07.227–00:22:07.410 | 1, expected red: 1 pass / 5 fail |
| `node --test codec.test.mjs` | 2026-10-07 00:22:07.413–00:22:07.664 | 0: 30 pass / 0 fail / 0 skipped |

Both finite commands ran sequentially under the single outer `lane-driver.mjs --resource A -- node acceptance.mjs` slot. Full executable/argument arrays, start/end/exits and complete logs are in `acceptance-commands.json`, `acceptance-wrapper.command.json`, `original-red-final.log` and `successor-final.log`. Four admitted finite resource records show closed/released children. No fence was cleared or process interrupted.

Earlier no-dispatch attempts returned inventory/configuration/ownership refusal. Read-only inventories showed 545 and 720 MiB free; the generic refusal alone does not identify a specific cause. Later admitted commands finished naturally. Logs retain every refusal. First executed successor run was 23 pass/1 fail: the basket authority refused the wrong-location fixture before its asserted location error. Preserved source/output reproduce that ordering. The fixture now supplies basket approval only for that location control, retaining separate basket denial tests. A later 30/30 run and final 30/30 run are both retained. Administrative manifest-array and patch-context failures are recorded without altering frozen inputs or product files.

No product test/compiler configuration changed. Unchanged backend full suite, typecheck, lint, voice and build were deliberately not rerun for this product-read-only `.mjs` lab. No native build/export, hosted test, external source refetch or live approval ran. These are unrun checks, not passes.

## Candidate behavior and compatibility

| Boundary | Candidate behavior | Remaining acceptance |
| --- | --- | --- |
| Authored recipes | Bounded original ID/name, ordered steps, minutes, authored batch servings, family/preparation/edible quantity bindings | Actual independent per-fact source/serving/family authority absent |
| Physical versus edible | Pack quantities and paid counts remain physical; authored batch edible grams and source nutrient basis are separate exact reduced rationals | No yield projection into public nutrients, portion optimization or solver port |
| Safety/photos | Unknown/null/duplicate safety values hold; explicit representative recipe list or null fallback, never photo by filename | Food/package/preparation/kitchen/cross-contact/photo approval and full dietary constraints unproved |
| Canonical metadata | Recursive UTF-16 code-unit key order, ordered arrays, strict UTF-8 scalar text preserved without normalization | Same-byte consumer and native adapter review required |
| JSON and own data | Duplicate names, including nested escaped-equivalent names, refuse before object construction; accessors/sparse arrays/private fields refused | Limits: 1 MiB, depth24, arrays512, field strings4096, nodes20000 |
| Numeric representation | Safe decimal integers; no -0/floats/exponents/residue. Rational fields require gcd1; explicit reduction accepts only exact integers | No rounding to fit nutrients or binary residue rationalization |
| Downloaded bytes | Original received-byte length/SHA checked before lexical parsing; pretty and canonical bytes keep different original hashes | Desktop adapters do not prove Hermes transport/storage |
| Metadata/catalog/solver pins | Metadata excludes prices but binds ordered food/display facts; revisions are distinct | Quote catalog SHA binds exact canonical producer bytes. A downloaded noncanonical blob retains its different original pointer; no client may substitute reserialized SHA or treat this lab read as plan admission |
| Price precision | Original day-only observations stay labelled reference and cannot produce a current-use quote | No invented midnight, current time, default duration or location fallback |
| Quote identity | Complete independently admitted ordered paid rows, exact pack/offer/store/location/ZIP/channel/time, pins, raw cents, one allowance and total | Equal cents at two locations have different identities; split-store quotes explicitly held pending review |
| Approval | Private fact/observation/basket ports bind exact facts and context; reviewed strings/evidence IDs/hashes alone cannot approve | No authentic port is configured. Synthetic namespaces refuse real IDs even under synthetic wrappers |
| Planning/access | Always false; default-disabled legacy read calls hash zero times | Trusted owner/committed answers/inventory, full-week constraints and accepted reroll history remain unmet |
| Input compatibility | Backend floor45 versus app10..999; app household1..4 versus private preferences1..8 preserved | No product limits changed or implicit old-week conversion; exact old accepted pins must be retained by a future reviewed installer |

Nine independent desktop byte vectors freeze nested reordered keys, ordered-array changes, escaped/control/non-ASCII text, safe integer boundaries and distinct Unicode scalar sequences. `rational-policy-vectors.json` records reduced/unreduced equivalence policy and residue refusal. Portable code imports no Node/Buffer/crypto or encoding shim. The injected desktop encoder/hash are explicitly CURRENT-only; native support is unrun.

The actual original recipe “Greek yogurt parfait with berries and granola” preserves its three original steps, five minutes and one authored serving in `actual-recipe-trace.json`, together with original ingredient/family rows. This is source-only representation, not recipe approval. Current snapshot v6 remains exactly 208918 bytes, SHA `ec91a506d37c4a340fede59e7568319c9fddbec462452cc254481be4e78c1f20`. All 83 recipes, 79 SKUs and 387 day-dated price rows remain unadmitted. Original price rows and precision are preserved in `actual-price-precision-trace.json`; no synthetic evidence fills their missing basis.

The positive catalog, complete two-row basket, observations, clock, sixty-second boundary and seventeen-cent allowance are fully declared fictional controls. They prove codec/refusal/arithmetic behavior only, not production policy, measured store accuracy or authentic approval. The complete basket is 1008 raw cents plus exactly17 cents, total1025; consumption is never enlarged to finish purchased packs.

## Preservation, commit and rollback

Initial HEAD `0bd8a1c6d08535f25bf7f3430b2f0eb2c28876b0` on `codex/backend-readiness`; empty index. All 1073 initial backend files were hash-equal before report/progress writes. Four private API pins and `contracts-v1.json` match. Restore source and nine unapplied migration files are preserved; no SQL executed. Prior/sibling evidence is read-only and rechecked against original hashes.

One report-only local commit is recorded after this file is finalized. Exact commit/parent/scoped diff and report hash are in CURRENT `final-git.json` and `preflight.json`, avoiding amendment to chase this report's own commit hash. Only this report is staged; pre-existing progress/queue dirt remains unstaged. The owned suffix is saved separately in `owned-progress-suffix.md`, and the original progress prefix/queue are byte-equal. No push/merge/reset/stash, HQ or other-lane write occurred.

Precise rollback is pinned in CURRENT `rollback.json`: revert only the finalized report-only commit, retain all lab/failure evidence, and remove only the exact appended owned progress suffix if separately authorized. This leaves product behavior untouched and every authentic admission held. No shared migration or provider rollback is needed because neither was activated. No supported skill defect or skill change was established.

Next safe action: independent coordinator and B review of successor manifest `cf66edc5...` over these same bytes, including canonical producer versus original-download pin semantics. This result grants no next job, shared contract adoption or activation. Authentic food/price authority, full-week solver/reroll/owner admission, native durable storage/accounts/eligible trial/purchase/restore, hosted Auth/PostgREST/contention, nine unapplied migrations, legal/device/publication/rollout and final release acceptance remain open. The worker stops naturally for review.
