# Local store estimates, October 5, 2026

This is a tested private arithmetic path, not a live local-price feed or an app feature. It adds no budget reserve and leaves the legacy production 1.1 pricing uplift unchanged. Exact offers and adjusted baselines are mutually exclusive; the new quote adds one full-basket allowance, then explicit charges.

## Contract and implementation

`store-estimates.ts` accepts one to three ordered physical store IDs, an explicit region and channel, alternatives or explicit split intent, integer-cent household budget, charges and eligibility. A chain name or ZIP prefix is not a physical store. Unknown stores/bases and malformed inputs are rejected. Missing usable pricing/calibration yields a null total and null budget comparison, never a made-up pass.

Requirements are exact rational purchased-basis quantities keyed by reviewed SKU/form/unit. Compatible unprepared physical pantry is subtracted once. Whole offered packs are assigned to a chosen store; owned carryover, new carryover and consumed portions stay separate. The unchanged two-thirds perishable use floor applies to the actual committed quantity. Mixed pack sizes are searched for minimum whole-line cost within admitted offers. Six offers, 100 packs per offer and 20,000 search nodes are implementation bounds. Exhaustion means unknown, not a global minimum or a forced shopping trip. Single-store alternatives always remain available as distinct results; a split appears only with explicit intent and matching combined calibration.

Pinned facts include product/offer/store/channel, pack quantity and label, source/observation timestamp, form review revision, availability and membership/promotion conditions. Raw exact facts receive no cell adjustment. A raw baseline can use only its supported joint store/category/region/channel factor. No extrapolation, generic cheaper fallback, delivery discount or refreshed cache date is added.

`store-estimate-model.ts` fits each joint cell as total actual raw cents divided by total matching-pack baseline cents. It is a deliberately small model, not a universal store multiplier. Full-basket calibration uses the ordered one-sided relative error `max(0, actual - raw prediction) / raw prediction`, at rank `ceil((n + 1) * coverage)`. If the rank is beyond the observations or the declared minimum is unmet, no finite allowance is returned. The selected bound is rounded upward once on the raw whole basket. Coverage, minimum samples and freshness in the fixture runner are test parameters, not approved launch policy.

Models and calibrations are replayed from their frozen samples, source/date pins and policies. Request pins bind the exact calibration revision and implemented strategy semantics, including explicit charges and eligibility. Profile/catalog/allergy revision, selected-store order and full strategy scope are bound separately. IDs and declared physical units cannot overlap across fit/calibration/held-out phases; later phases must follow freezes. Seals and caller independence labels do not verify original facts, collection rights or actual statistical independence. Even nonfixture input is labeled `unverified-source`, not launch-supported.

`store-estimate-week.ts` reuses the current explicitly approved source/quantity/safety staging catalog and existing independent food evaluation. It checks every selected ID, variant ingredient, diet/allergy, household, protein/calorie bands, item/protein-source floors, calorie shares and repeat group. Source/approval edits invalidate the bridge. Profile edits need a new frozen selection/calibration scope. Exact quantities are built from authored units and conversion constants before multiplying; edible yield is applied once to purchases, not to source nutrients.

Budget, food and coverage failures have distinct labels. `feasible` requires all three to pass. The bridge checks proposed substitutions as complete weeks; it does not choose the unresolved reroll grocery-addition policy. A higher-budget example is regenerated and rechecked under that budget's variety floors and all other rules. It is not a mathematical minimum.

## Field use and app handoff

No public Snapshot/SolveInput, route or app adapter changed. Do not publish the private purchase-equivalent nutrition projection. For future integration:

- Read source nutrients from the true edible catalog; use the private quantity review for preparation refuse/purchased requirements.
- Use quote `lines.assignments` for actual new packs/stores/costs and `ownedCarryover`/`newCarryover` for physical leftovers. `days` are per-person consumed nutrients; requirements are household quantities.
- The bridge's inherited `consumption` rows retain legacy reference accounting fields for comparison. Their pack/cost/carryover fields are not the new store quote. Only edible consumption, physical preparation and trim describe authored consumption; new accounting is in quote lines.
- Keep exact cents and nullable unknowns. Preserve shopper store order and explicit split intent. Do not silently use the app's generic cheaper fallback or stack its legacy buffer.
- On budget/goals/diet/allergy/household/pantry edits or regeneration, revalidate the whole week and list. On candidate replacement, show no claimed grocery rule until the founder chooses it.
- Connect no price activation until permitted original feeds, physical stores/packs/availability, independent collection design, measured full-basket calibration and founder freshness/accuracy/fallback rules exist. Native/account/trial integration is a separate workstream in `OVERNIGHT-APP-HANDOFF.md`.

## Evidence and verification

Completed evidence: `data/pipeline/store-estimates/2026-10-05-cli-final/report.json`. All generated evidence is gitignored local test data, not public fixtures. Branch `codex/backend-readiness`, starting HEAD `f572d29`; local commit IDs are recorded in the workstream plan. First recorded checkpoint 14:34:50 ET; acceptance/build complete by 15:12:55 ET, about 38 minutes from that checkpoint, with handoff/commit time following.

Unchanged food counts: 132 generated/unique/structurally validated, 108 review-ready and explicitly internally approved, 24 quarantined chicken preparations, 14 combined reviewed ingredients, zero kitchen-tested. No new ingredient/recipe approval. All 65 unresolved ingredient IDs are in `review-pins.json` and `report.json`, including pea powder, almond yogurt, whole russet-potato yield and chicken pack evidence. Cross-contact remains unverified.

All six profiles pass at seeds 0, 7 and 19 under the fictional raw offers, with unchanged hard constraints. Table values are guarded integer cents, NOT supported store prices; columns list seeds 0/7/19:

| Profile | First selected store | Explicit split |
| --- | --- | --- |
| Typical | 3337 / 3337 / 3391 | 3097 / 3097 / 3151 |
| Floor budget | 2650 / 2693 / 2693 | 2475 / 2518 / 2518 |
| Household two | 4557 / 5091 / 5146 | 4295 / 4742 / 4797 |
| Vegan | 3118 / 3118 / 3118 | 2900 / 2900 / 2900 |
| Vegetarian | 3183 / 3183 / 3140 | 2965 / 2965 / 2922 |
| Dairy-free, 180 g | 3500 / 3652 / 3729 | 3260 / 3390 / 3467 |

The other two ordered store alternatives, exact IDs/weeks, lists, source nutrients, raw/allowance/charge arithmetic and carryover are in each `week-*.json`. Repeated full solve and quote outputs match. All 1,270 slot/candidate replacement cases pass full-week checking with the synthetic offers (not 1,270 distinct recipes or an approved reroll-shopping rule). Per-slot counts are saved, capped at six by the existing substitute path.

Half an owned onion pack covers 680.388 g of a 1000 g purchased requirement. One offered 1360.776 g pack still must be bought, leaving 1041.164 g unprepared new carryover; this example does NOT reduce the total. Pantry does not inflate consumption or trim. Separate tests prove pack-cost reductions where a whole-pack boundary is actually crossed. Carrots in typical seed 0 consume 1480 g edible, require `148000/83` g raw at yield 0.83, trim about 303.13253 g, and buy one fictional whole 1814.368 g offer for 200 raw cents, leaving about 31.23547 g physical carryover. Those source quantities are real reviewed reference arithmetic; the offer/price is fictional.

`profile-edit.json` preserves a price pass but rejects the same week at 300 g/day for protein. `higher-budget.json` has an explicit fictional 7000-cent unavoidable charge: the $45 profile misses budget at 9650 cents for store A, while the regenerated $150 profile passes every food rule at 10085 cents. Removing one required offer still yields null totals at $150. This is not a proposed shopper budget/charge or a minimum. `soy-exclusion.json` honestly reports zero eligible preparations and no breakfast after full soy filtering; `unknown-metadata.json` exercises actual restricted selection with zero reviewed metadata and rejects everything.

Thirty declared fit units, 324 calibration units in 36 scopes, and 72 held-out baskets are disjoint by declared ID/unit and virtual fixture phase. Twenty-four scopes belong to the six primary profiles; twelve additional scopes cover profile/charge edits. Nine calibration weeks per scope use seeds 101–109 before held-out seeds 0/7/19, with partial pantry measurements included. Full raw predictions are replayed from actual complete synthetic quotes, not an average per item. Deliberately adverse held-out errors overrun the allowance in 48/72 baskets, maximum 141 cents. This demonstrates honest error reporting, NOT 90% measured accuracy or approval of the fixture coverage parameter. Real independence and source truth are not established.

Pins:

```text
source   ff686106f0cdbf67195cb796f9eec3a96366256f76b2e65da87fccc29cb1dd3f
catalog  103d22c976376de3e6cb68b634bb0c61c8060caa8800c6e60c1d7c45a070e594
approval 38f50a19f4badfcac3e7756da52bbd569eae9f046734a6cf61d8ffc7d37d5462
model    e97e4524e7ed91adb8b111b170b74ae86e57d1dfa16b144ac063407d2baed82c
```

Each request/input/calibration digest and original fixture source/date pin is saved in the corresponding JSON. `calibration-index.json` contains primary digests; `extra-calibrations.json` contains edit/charge scopes. Pack offers use the reviewed pack quantity and twice that quantity as fictional whole offered packages, never prorated purchasable fractions. They are not evidence those packages are stocked locally.

Desktop: Node 24.17.0, Windows, i5-14400F, about 16 GB RAM. First process solve 581.4628 ms, immediate warm 516.51 ms; primary repeated timings are roughly 348–669 ms, 96 cap unchanged. Final RSS about 402 MiB is a shared-process sample, not a peak or iPhone proof. Some checks overlapped with acceptance and affected timings; OS caches were not cleared.

Verification: 17/17 focused tests (1814.6541 ms); latest full `npm test` 237/237 (43235.4873 ms), no failures/skips; ordinary `npx tsc --noEmit`, `npm run lint` (zero warnings), `npm run lint:voice`, `npm run build` and `git diff --check` pass. Build retains the existing Edge Runtime deprecation/static-generation warnings; expected mocked `app_config` failure diagnostics appear in tests. No incremental fallback, dependency installation or hook-setting change.

Final boundary review reproduced a false rejection of $64.01 from floating dollar-to-cent comparison. Local fix `5289f64` after implementation `5f860e0` now converts the legacy profile's decimal dollars through exact rational arithmetic, while rejecting fractional cents. All eighteen frozen acceptance weeks were replayed through the final code and match full stored outputs exactly. Their source/model/calibration pins and evidence bytes remain unchanged. The focused regression failed before this fix and passes afterward; all package gates were rerun. Final report/docs save follows, about 52 minutes from the first recorded checkpoint.

Earlier partial folders `2026-10-05-cli-first`, `-second` and `-verified` remain intact: floating-point pack residue, shortened floor-profile lookup, and the initially unhandled no-soy-breakfast outcome respectively. Only `-final` is accepted. Existing/unsafe output rejection was separately exercised. No public snapshot/fixtures, solver core/prices, app/website, shared database/engine, remote branch, provider, spending or real message changed. Lean-build, humanize-writing and verify-and-stop were used; optional tools were not needed.

Reproduce with a NEW run ID:

```powershell
node --test scripts/data/store-estimates.test.ts scripts/data/store-estimate-week.test.ts
node scripts/data/store-estimate-acceptance.ts a-new-unique-run-id
```

The runner refuses existing/unsafe paths before writes and writes only `data/pipeline/store-estimates/<run-id>/`. It imports no public snapshot/fixture writer, provider, database or credential loader. Original reviewed evidence remains intact.

Rollback: stop using these private modules. No production behavior or public data needs rollback. Keep previous evidence folders; failed runs are partial, not accepted. Real source-use terms, cross-contact, food gaps, kitchen/device proof and app activation remain separate gates.
