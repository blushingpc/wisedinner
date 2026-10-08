# Chicken-thigh nutrition source handoff, October 8, 2026

Verdict: **ORIGINALSOURCE-STILLHELD**. The one official source read succeeded and retains negative carbohydrate for the exact historical food identity. The CURRENT-only executable quarantine handoff is verified LOCAL. No corrected cache row, trusted nutrition projection, installed data change or product adoption was created. The launch gate remains closed; A4/A5 and parent acceptance remain open.

Starting branch `codex/backend-readiness`, HEAD `a53ce12803bac0548e3dda993844e66e9d8c4b87`, empty index. Inherited status SHA256 `2658d2f9e54e8500afd240bb7dfdae21117e7ddddcdea654b4300d154f12a151` comprises the two task notes and the untracked equipment report. Original note prefixes and inherited changes are preserved. Ownership is CURRENT artifacts plus this report and dated task-note suffixes. Product source/data/scripts/solver/migrations/private contracts/config/packages and B inputs are read-only.

## Exact official evidence

One GET to `https://api.nal.usda.gov/fdc/v1/food/2727567`, using the documented public demo credential. No private credential store was loaded. Start `2026-10-08T07:14:18.529Z`, finish `2026-10-08T07:14:19.975Z`, HTTP 200. Actual headers advertise limit 10, remaining 9. No additional record, search, retry loop or network request followed.

Raw response: 63,588 bytes, SHA256 `a140e86bd3238d6663f3d4b5b5817e986926b199e5f8a2a7f409d6be6aac9d0a`. Saved key-free receipt includes status, headers, UTC, one attempt and `privateCredentialLoaded:false`. The endpoint in evidence has no credential query string. The public API guide describes demo allowances of 30/hour and 50/day; these are distinct from the actual returned headers. [USDA API guide](https://fdc.nal.usda.gov/api-guide/)

Exact source: FDC 2727567, Foundation, `Chicken, thigh, meat and skin, raw`, publication `4/24/2025`, food class FinalFood. Foundation documentation expresses nutrients per 100 g edible portion, excluding refuse such as bone. This does not prove the authored bone-in purchased weight is an edible quantity. [Foundation Foods documentation](https://fdc.nal.usda.gov/Foundation_Foods_Documentation/)

| Source nutrient ID | Source unit | Exact reported amount |
| --- | --- | --- |
| 1003, protein | g | 17.10625 |
| 1004, total lipid | g | 13.35 |
| 1005, carbohydrate by difference | g | -0.17255 |
| 2047, energy, general Atwater factors | kcal | 187.8848 |
| 2048, energy, specific Atwater factors | kcal | 192.792919 |

1008 is absent. The unchanged helper uses source energy in priority 1008, 2047, 2048, therefore 187.8848 here. Protein, carbohydrate and energy carry source derivation 49/NC/Calculated and source 2/4/Calculated or imputed. Fat carries 1/A/Analytical and source 1/1/Analytical or derived from analytical. Complete derivation, nutrient identifiers, sample metadata and all other raw facts remain in the frozen response and selected source projection. No local energy formula, negative clamp, missing-as-zero or FDC replacement occurred.

## Historical path and affected structures

The local Git record already contains this same negative fact by September 12: commit `536d88a3e3761a250eeea89e1678f9b41204049c`, cache and snapshot v4. It persists in September 27 cache/v5 at `7f4c19aa432dea0f3350c531c3cb38842031f1ac`, then October 3 v6 at `50e72e626f9a3a7036b19cb4a80f50b2828bfbde`. Exact historical cache/snapshot hashes and full rows are in `source-entry-trace.json`; this is a finite local history trace, not proof of the live remote snapshot pointer.

Current cache row is pinned, matched `2026-09-27`, with exactly those protein/fat/carbohydrate/general-energy values. Existing `nutritionProblems`, `nutritionRows`, `pickUsdaFood` and targeted `resolveUsdaMap` refuse it. The current negative gate entered at `adb4de78c62a25f597f93af290d2538afc971769`. The existing solver snapshot structural validator checks finite protein/energy but does not reject negative fat/carbohydrate. It was not changed. New assembly uses the rejecting source gate; no assembler ran.

The frozen A03:58 candidate changed only three egg-family step arrays and inherited every nutrition row unchanged from local v6. Its bad row is therefore historical inherited source data, not a new method-authoring fact.

| Exact affected recipe ID | Source relationship | Preserved hold |
| --- | --- | --- |
| bbq-chicken-with-roasted-vegetables-and-rice | direct chicken-thighs, 10 oz | unprepared-or-unknown-recipe |
| bbq-chicken-with-roasted-vegetables-and-rice-pork | variant parent closure | missing-compatible-parent |
| bbq-chicken-with-roasted-vegetables-and-rice-potatoes | direct chicken-thighs, 10 oz | unprepared-or-unknown-recipe |

The authored SKU remains bone-in chicken thighs, 5 lb pack, canonical g, grams-per-unit 1, baseline $7.45. These are preserved authored inputs, not newly verified package/price/yield evidence. Both 10 oz thigh weight holds and the pork parent closure remain. All 83 recipe IDs/order, amounts/units, original ingredient rows, steps, optional unpriced seasoning and honest preparation metadata survive exactly. The original equipment pool is still 80 eligible structures and three held structures. Equipment eligibility does not grant nutrient, restriction or solver admission.

Five other existing whole-cache identity problems remain: plant-yogurt, pea-protein, russet-potatoes, frozen-peppers-onions and taco-seasoning. They are explicitly reported and unaccepted. One inactive bad SKU does not imply every recipe is unsafe, and its exclusion does not prove the remaining catalog is trustworthy.

## Frozen executable handoff

CURRENT is `C:/Users/borgh/.codex/.chatgpt-projects/g-p-6abe316af67c8191ad1f0305474b416f/backend-loop/lanes/A/runs/2026-10-08T07-09-26-532Z-b9613f20`.

`chicken-thigh-source-handoff-final.json`: 422,788 bytes, SHA256 `491e3db2496f2514eba40a9981ec9f5cbe56f99249864b683341a4fae43ab453`. Format `wd-chicken-thigh-source-quarantine-local-1`. It binds original cache/candidate/preparation/registry/public input hashes, full historical source values, exact official evidence, direct affected IDs and parent closure, all 83 unchanged recipe/ingredient/preparation projections, exact 80/3 pool and untouched catalog problems. `trustedNutrition:null`, `correctionCandidate:null`; physical/yield/kitchen/restriction/price/cross-lane/app/publication acceptance are false.

`producer-manifest.json`: 122,163 bytes, SHA256 `a6cc16fcba2670c99371d470576e9d0830fbd0146ede8abe6a761666465b6e95`. It freezes executable/tests/raw/receipt/projection and 152 prerequisite pins, exact before/after deltas, command UTC/exits/log hashes and 13 closed resource records at manifest freeze. Later report/voice/commit/reopen evidence is sealed separately, avoiding circular report/result hashes.

`chicken-source.ts` uses actual unchanged installed source gates, preparation admission and exact original inputs. Before dynamic USDA helper import it switches to credential-free CURRENT because the installed env helper automatically loads a cwd-relative file. CURRENT has no `.env.local`; no repository credential was loaded. The narrow gate input carries only validated source-reported required macros and available energies. Full raw evidence preserves unrelated nutrients without amounts; unknown amounts are not silently zeroed.

The original negative admission assertion is retained as red. A synthetic nonnegative fixture proves the normal existing gate path only; exact source-byte comparison refuses its adoption as fetched evidence. Descriptor-safe cloning refuses getters/cycles and changed identity/basis/raw facts. No method/string is evaluated as code. No installed module was copied, exported, patched or imported by runtime.

The previous method registry remains SHA256 `917a703327aef561278fd1cd6d12580d2789ec7c01893395b9e538ad67562678`, manifest `6169ab05ac5b70ed93bee7c24893df9d3d9a17eb043ef9197e3fe6bb012f6f17`. The original candidate snapshot/preparation/manifest and published local v6 hashes remain byte-exact. B42 and public121 pins are rechecked; matching prior build evidence is reused, not rerun. B's historical LOCAL80 recipe consumer requested changes. No changing B result was treated as approval.

## Actual verification and preserved failures

Every targeted test/type/lint command uses unchanged `lane-driver.mjs --resource A --` with explicit executable arguments and real writer ancestry. Exclusive command receipts record UTC, exit, source-before/after and logs. No full suite, full build, PGlite, native/device, export or catalog matrix was run.

| CURRENT command label | Exit | Genuine result |
| --- | --- | --- |
| official-single-get | 1 | Relative script unavailable before attempt marker/network; preserved |
| official-single-get-absolute | 0 | Only actual source GET, HTTP 200 |
| original-negative-red | 1 | Required source-admission assertion refuses negative fact; still red |
| produce-quarantine | 0 | Initial diagnostic draft, preserved |
| source-focused | 1 | 27 passed, one serialization assertion failed |
| produce-quarantine-final | 1 | Sandboxed process inventory unavailable; no dispatch |
| produce-quarantine-final-admitted | 1 | Invalid Windows ESM loader path; child failed before producer ran |
| produce-quarantine-final-native | 0 | Final held producer, actual established Node 24 command |
| source-focused-final | 0 | 28 distinct focused controls passed; no repeated-control inflation |
| source-types | 0 | CURRENT-only config extends unchanged ordinary backend config |
| source-lint | 1 | One unused test import warning; preserved |
| source-lint-final | 0 | Five artifacts effectively linted, no errors/warnings |
| source-independent-reparse | 0 | Separate process regenerated and reparsed exact final bytes |
| backend-types | 0 | Ordinary unchanged backend types, incremental output disabled |

The serialization repair retained failed draft/source/test bytes and outputs. It removed undefined-valued unrelated nutrients from the narrow helper projection, preserving the complete raw response. The round-trip assertion is unchanged apart from its successor artifact path; its deep equality and refusal requirements were not weakened. Lint recovery only removed the unused import. Exact minimal deltas are frozen in CURRENT. The missing-inventory command was retried through the same controller with approved process-inventory access; no lock or ancestry gate was bypassed.

Voice and report-path/regular-file freshness gates are recorded in the final separate evidence index/reopen summary. Existing product voice coverage and scoped report voice coverage are distinguished. No secret-bearing provider trace or customer data is present. The learning checkpoint records the demonstrated serialization failure and behavioral evidence; no managed or user skill was changed.

## Remaining gates and next safe action

The exact source remains quarantined. A strict whole-snapshot B decoder still refuses the inactive negative row. The next specific dependency is independent review of this frozen source handoff and explicit held-record handling in the B consumer. Any handling must retain complete original source facts and distinguish structure/equipment eligibility from trusted nutrition; silent filtering or a whole-catalog nutrient grant is not accepted. If a new same-identity source correction is later evidenced, it needs its own exact producer/review. No further fetch is authorized by this checkpoint.

Both thigh quantity holds, pork parent closure, other source-identity problems, actual physical food/kitchen/restriction and measured prices remain open. Receipt successor same-byte acceptance/runtime integration, unbound deletion adapter's non-atomic identity/lease race, genuine Apple revocation, unapplied0015/history inventory, hosted Auth/concurrency, provider/native/store/device and release acceptance remain open. No A4/A5/A2/B2/G completion claim.

Spending $0, external writes zero. Accounts, eligible 14-day trial, $8.99 monthly/$48 annual, included rerolls and optional notifications remain unchanged. Factories remain off; no live Auth/provider/database/ce_/engine/website/media/customer/deletion/migration/publication/deployment action. Original October 9, 2026 at 19:39:35 UTC target unchanged.

Rollback is withholding this uninstalled CURRENT quarantine handoff. Preserve original/final artifacts and failures. No runtime/data revert, DROP/delete/reset, provider reversal or destructive Git action was performed. Commit only this report and owned dated task-note suffixes; inherited dirt stays unstaged. Final commit/prefix/preservation/seal details are in CURRENT `final-preservation.json`, `report-commit.json` and `reopen-summary.json`. This checkpoint waits for independent review and does not submit or approve another job.
