# Price and publication safety, October 5, 2026

Implemented locally, not activated remotely. Future Kroger imports no longer normalize an offered four-pound bag into a one-pound price. Reproduction before the fix accepted that unsupported package. Matching now requires explicit original-source form/pack review, exact normalized description/product/item IDs, physical canonical pack, unit-sold offer and in-store availability. Multipacks, ranges and variable-weight offers are quarantined pending a separate purchase representation. Regular prices retain cents; no promotions, locationless prices or double buffer. No live collection ran.

`docs/ingredient-catalog/kroger-pack-reviews.json` is intentionally empty. Existing search mappings cannot approve themselves. New private observations copy and hash the reviewed mapping at collection, bind offer/physical pack/location/channel/timestamp/cents, and validate independently of today's map. Old rows without this evidence are quarantined; changing the map cannot certify them retroactively. Source date is never refreshed from cache. The collector writes only an explicitly isolated directory, never the committed product map.

## Actual coverage evidence

Cached collection contains 387 observations dated September 10, 2026, with zero immutable private provenance records. All 387 fail the new staged gate. Columbus request ZIP 43215 has 78 rows; Atlanta 30303 78; Houston 77002 77; Los Angeles/Ralphs 90012 77; Seattle/QFC 98101 77. Selected stores can be in neighboring ZIPs, so the request ZIP is not proof of an exact local customer store. Old public snapshot observations are distinct history and remain unrepaired. The source-reviewed staging uses reference estimates, not newly verified prices.

| Area | Proven current matched-pack local coverage |
| --- | --- |
| Five historical request ZIPs above | None under immutable-evidence gate; old dated collection exists |
| Idaho | Unverified, no collection in this cache |
| Miami / Florida | Unverified, no collection in this cache |
| Alaska | Unverified, no collection in this cache |
| Other indexed stores/regions | Authored baseline × historical store index reference estimates, not local quotes |

Recommend labeled regional reference estimates unless original local offer/pack/freshness evidence is present. Unsupported-area behavior, acceptable freshness and accuracy standard require the founder's choice. No nationwide accuracy or unsupported Walmart-local claim.

## Stage before any public mutation

`node scripts/data/run.ts --stage=data/pipeline/staging/<unique-id>` is cached, isolated and has no seed/upsert/storage/pointer/public fixture/Git writer. The target must be a new validated workspace staging directory. Old `--local` and legacy `publish()` now refuse rather than silently write `data/snapshot.json`. The local workflow proposal runs tests/typecheck then stage and preserves artifacts; it no longer advances a public pointer before fixture/tests. No workflow dispatch/push occurred. This intentional forward safety change needs a coordinated rollout, not blind use of old commands.

Actual inspected staging command: `node scripts/data/run.ts --stage=data/pipeline/overnight/public-candidate-20261005-0405`. It exits blocked without external writes: 0/387 prices approved, plus six active cached nutrition guard failures (chicken-thighs carbs; plant-yogurt, pea-protein, russet-potatoes, frozen-peppers-onions and taco-seasoning identity). The complete rejected manifest is `docs/ingredient-catalog/overnight-public-stage.json`. No continuity guard was loosened to hide lost historical coverage. Public v1 also cannot represent edible/purchase yields; `sourceProblems` refuses that transition.

The pure stage freezes the candidate, validates schema/continuity/source/acceptance, derives fixtures from its exact data, seals bytes/fixture hashes, and exposes no writer until all pass. Rehydrated or mutated acceptance objects cannot publish. Honest staged fixtures have no synthetic verified receipt, delivery saving or accuracy claims. Existing showcase fixtures were not regenerated.

## Prepared writer and recovery

`publication-adapter.ts` is explicitly disabled unless constructed with approved configuration; no CLI or live binding. It uploads with `x-upsert:false`, downloads bounded exact bytes and checks SHA-256 before the pointer. Duplicate uploads reuse only identical stored bytes. No bucket creation/settings change or orphan cleanup.

Unapplied `0008_wd_publication.sql` narrowly retires direct service inserts/updates/deletes on backend `data_snapshots` and exposes one role-checked, advisory-locked compare-and-set RPC. Old reads remain unchanged. Expected previous version, next sequential version, immutable URL/hash and retries are tested in actual ephemeral PostgreSQL. Hosted Supabase, network storage and true multi-connection contention remain untested. No engine grants or tables are changed.

Storage upload, atomic database pointer, and local/Git mirror are separate boundaries. Upload/source/fixture/test failure leaves pointer untouched. Pointer failure may leave an immutable orphan, retained for same-stage retry. Mirror failure reports `published-mirror-pending`, not rollback or success of Git. A superseded historical retry must not mirror old bytes. Stop old publishers before separately authorized migration/activation; mixed direct-insert publishers are not safe. Recovery disables new writer/route configuration and retains the last good pointer and artifacts; never delete production rows or overwrite old storage versions.

Nine focused tests cover before-fix pack behavior, source/schema/fixture/test/upload/pointer faults, immutable conflicts, stale retry, exact stored bytes, stage tampering, prepared HTTP adapter and real SQL privileges/CAS. Official storage overwrite/concurrency basis: [Supabase standard uploads](https://supabase.com/docs/guides/storage/uploads/standard-uploads), accessed October 5, 2026. Product API reference shell was unavailable; vendor-owned collection reference was readable but no authenticated live offer schema/availability was certified.
