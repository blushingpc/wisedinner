import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPriceBook, PRICE_BUFFER, priceMapFor } from "../src/pricing.ts";
import { buildPool, evaluateWeek, solve } from "../src/engine.ts";
import { miniSnapshot } from "./helpers.ts";
import type { SolveInput } from "../src/types.ts";

const s = miniSnapshot();
const input: SolveInput = { budget: 60, protein_per_day: 60, kcal_min: 800, kcal_max: 4000, diet: "none", household: 1, stores: ["a"], zip: "43215" };

test("the buffer is applied once, in pricing, on raw shelf prices", () => {
  const map = priceMapFor(s, s.stores[0], "43215");
  assert.equal(map.get("rice")!.price_usd, Math.round(4 * PRICE_BUFFER * 100) / 100);
  assert.equal(map.get("rice")!.observed, true);
  const pool = buildPool(s, map, "none", 100);
  assert.equal(pool.skus.get("rice")!.price_usd, 4.4);
});

test("index fallback: no observed row → baseline × price_index, marked not observed", () => {
  const c = s.stores.find((x) => x.id === "c")!;
  const map = priceMapFor(s, c, "43215");
  assert.equal(map.get("rice")!.price_usd, Math.round(4 * 0.9 * PRICE_BUFFER * 100) / 100);
  assert.equal(map.get("rice")!.observed, false);
  assert.equal(map.get("rice")!.as_of, s.generated_at);
});

test("gate: no live store → estimate mode, no modes available", () => {
  const b = buildPriceBook(s, { ...input, stores: ["c"] });
  assert.equal(b.mode, "estimate");
  assert.deepEqual(b.modesAvailable, []);
});

test("gate: one live store → singleStore at that store, even when listed second", () => {
  const b = buildPriceBook(s, { ...input, stores: ["c", "a"], mode: "bestPerItem" });
  assert.equal(b.mode, "singleStore");
  assert.deepEqual(b.modesAvailable, ["singleStore"]);
  assert.equal(b.live[0].id, "a");
});

test("gate: two live stores → both modes; bestPerItem never assigns on an index guess", () => {
  const b = buildPriceBook(s, { ...input, stores: ["a", "b"], mode: "bestPerItem" });
  assert.deepEqual(b.modesAvailable, ["singleStore", "bestPerItem"]);
  assert.equal(b.mode, "bestPerItem");
  const min = b.maps.get("__min__")!;
  assert.equal(min.get("rice")!.store, "b"); // $3 at b beats $4 at a
  assert.equal(min.get("chicken")!.store, "a"); // $9 at a beats $12 at b
  assert.equal(min.get("tofu")!.store, "a"); // observed nowhere → pinned to the first live store
  assert.equal(min.get("tofu")!.observed, false);
});

test("unknown store id and a bad store count throw", () => {
  assert.throws(() => buildPriceBook(s, { ...input, stores: ["zz"] }), /unknown store/);
  assert.throws(() => buildPriceBook(s, { ...input, stores: [] }), /one to three/);
  assert.throws(() => buildPriceBook(s, { ...input, stores: ["a", "b", "c", "a"] }), /one to three/);
});

test("output echoes input, store mode, per-store subtotals; alt_total only with both modes", () => {
  const ids = [["oatmeal", "onion-rice", "chicken-rice"], ["oatmeal", "onion-rice", "tofu-rice"], ["oatmeal", "onion-rice", "chicken-rice"], ["oatmeal", "onion-rice", "tofu-rice"], ["oatmeal", "onion-rice", "chicken-rice"]];
  const one = evaluateWeek(ids, input, s);
  assert.equal(one.store_mode, "singleStore");
  assert.equal(one.alt_total, undefined);
  assert.equal(one.input.stores[0], "a");
  assert.equal(Math.round(one.stores.reduce((a, x) => a + x.subtotal, 0) * 100) / 100, one.est_total);
  const two = evaluateWeek(ids, { ...input, stores: ["a", "b"], mode: "bestPerItem" }, s);
  assert.equal(two.store_mode, "bestPerItem");
  assert.ok(typeof two.alt_total === "number");
  assert.ok(two.est_total <= two.alt_total!, "the split list is never dearer than one store");
  assert.ok(two.list.every((i) => ["a", "b"].includes(i.store)));
});

test("singleStore picks the cheapest store for the whole list", () => {
  const out = solve({ ...input, stores: ["a", "b"], seed: 3 }, s);
  assert.equal(out.store_mode, "singleStore");
  assert.equal(new Set(out.list.map((i) => i.store)).size, 1);
});
