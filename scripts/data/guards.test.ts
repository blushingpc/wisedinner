import assert from "node:assert/strict";
import { test } from "node:test";
import { miniSnapshot } from "../../packages/solver/test/helpers.ts";
import { guardContinuity } from "./guards.ts";
import type { Snapshot } from "../../packages/solver/src/types.ts";

const previous = miniSnapshot();
const next = (): Snapshot => structuredClone({ ...previous, version: previous.version + 1 });
const guard = (snapshot: Snapshot) => guardContinuity(snapshot, previous, 0.3);

test("snapshot continuity accepts unchanged coverage and newer observations", () => {
  const snapshot = next();
  snapshot.store_prices[0].as_of = "2026-09-10";
  assert.deepEqual(guard(snapshot), []);
  assert.deepEqual(guardContinuity(snapshot, null, 0.3), []);
});

test("snapshot continuity rejects a truncated price page even if cheaper rows survive", () => {
  const snapshot = next();
  snapshot.store_prices = snapshot.store_prices.filter((row) => row.store_id !== "b");
  const problems = guard(snapshot);
  assert.ok(problems.some((problem) => problem.includes("rice/b/national")));
  assert.ok(problems.some((problem) => problem.includes("chicken/b/national")));
});

test("snapshot continuity rejects geographic collapse, not merely row count collapse", () => {
  const regional = next();
  regional.store_prices[0].region = "43215";
  const snapshot = structuredClone({ ...regional, version: regional.version + 1 });
  snapshot.store_prices[0].region = "90012";
  assert.ok(guardContinuity(snapshot, regional, 0.3).some((problem) => problem.includes("rice/a/43215")));
});

test("snapshot continuity checks each store price, not only the cheapest observation", () => {
  const snapshot = next();
  const row = snapshot.store_prices.find((row) => row.sku_id === "chicken" && row.store_id === "b")!;
  row.shelf_price *= 1.31;
  assert.ok(guard(snapshot).some((problem) => problem.includes("chicken/b/national: observed price")));
});

test("snapshot continuity accepts the existing thirty percent price boundary", () => {
  const snapshot = next();
  snapshot.store_prices[0].shelf_price *= 1.3;
  assert.deepEqual(guard(snapshot), []);
});

test("snapshot continuity rejects observation rollback", () => {
  const snapshot = next();
  snapshot.store_prices[0].as_of = "2026-08-31";
  assert.ok(guard(snapshot).some((problem) => problem.includes("observation date moved backwards")));
});

test("snapshot continuity rejects a silently changed pack or density", () => {
  for (const field of ["pack_qty", "grams_per_unit"] as const) {
    const snapshot = next();
    snapshot.skus[0][field] *= 2;
    assert.ok(guard(snapshot).some((problem) => problem.includes("pack basis changed")));
  }
  const snapshot = next();
  snapshot.skus[0].pack_unit = "lb";
  assert.ok(guard(snapshot).some((problem) => problem.includes("pack basis changed")));
});

test("snapshot continuity rejects lost ingredient identities and version or date rollback", () => {
  const snapshot = next();
  snapshot.skus = snapshot.skus.slice(1);
  snapshot.version = previous.version;
  snapshot.generated_at = "2026-09-08";
  const problems = guard(snapshot);
  assert.ok(problems.some((problem) => problem.includes("missing previously published sku onion")));
  assert.ok(problems.includes("snapshot version did not advance"));
  assert.ok(problems.includes("snapshot generation date moved backwards"));
});

test("snapshot continuity permits added stores, regions and ingredients", () => {
  const snapshot = next();
  snapshot.store_prices.push({ ...snapshot.store_prices[0], region: "43215" });
  snapshot.skus.push({ ...snapshot.skus[0], id: "new-onion" });
  assert.deepEqual(guard(snapshot), []);
});
