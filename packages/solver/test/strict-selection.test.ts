import assert from "node:assert/strict";
import { test } from "node:test";
import { buildPriceBook, runStores } from "../src/pricing.ts";
import { anneal, buildPool, choose, makeCtx, weekFrom, evaluateWeek } from "../src/engine.ts";
import { swapCandidates } from "../src/swaps.ts";
import { miniSnapshot } from "./helpers.ts";
import type { SolveInput } from "../src/types.ts";

const snapshot = miniSnapshot();
const input: SolveInput = { budget: 60, protein_per_day: 60, kcal_min: 800, kcal_max: 4000, diet: "none", household: 1, stores: ["a"], zip: "43215" };
const book = buildPriceBook(snapshot, input);
const prices = book.maps.get("a");
if (!prices) throw new Error("Fixture price map missing");
const ctx = makeCtx(input, buildPool(snapshot, prices, input.diet, input.budget));
const ids = Array.from({ length: 5 }, () => ["oatmeal", "onion-rice", "chicken-rice"]);

test("strict selection rejects empty and sparse result collections", () => {
  assert.throws(() => choose([], () => 0), /Malformed solver selection/);
  assert.throws(() => choose(new Array(1), () => 0), /Malformed solver selection/);
});
test("strict search refuses absent pools and empty options", () => {
  assert.throws(() => anneal({ ...ctx, pools: [] }, 0), /Malformed solver selection/);
  assert.throws(() => anneal({ ...ctx, pools: [[]] }, 0), /Malformed solver selection/);
});
test("strict store selection rejects sparse input before constructing prices", () => {
  assert.throws(() => buildPriceBook(snapshot, { ...input, stores: new Array(1) }), /one to three/);
});
test("strict store selection refuses accessor entries without getter effects", () => {
  let calls = 0;
  const stores: string[] = [];
  Object.defineProperty(stores, "0", { get() { calls++; return "a"; } });
  assert.throws(() => buildPriceBook(snapshot, { ...input, stores }), /one to three/);
  assert.equal(calls, 0);
});
test("strict run selection refuses unavailable first chosen or live store", () => {
  assert.throws(() => runStores({ ...book, stores: [], live: [], mode: "estimate" }), /Chosen stores unavailable/);
  assert.throws(() => runStores({ ...book, live: [], mode: "singleStore" }), /Observed stores unavailable/);
  assert.throws(() => runStores({ ...book, live: [], mode: "bestPerItem" }), /Chosen stores unavailable/);
});
test("strict week selection rejects absent structural slots", () => {
  const sparse = structuredClone(ids);
  const first = sparse[0];
  assert.ok(first);
  delete first[1];
  assert.throws(() => weekFrom(sparse, ctx), /15 recipe ids/);
});
test("strict week selection rejects slot accessors without getter effects", () => {
  let calls = 0;
  const supplied = structuredClone(ids), first = supplied[0];
  assert.ok(first);
  Object.defineProperty(first, "1", { get() { calls++; return "onion-rice"; } });
  assert.throws(() => weekFrom(supplied, ctx), /15 recipe ids/);
  assert.equal(calls, 0);
});
test("strict week selection refuses unknown recipes and incomplete days", () => {
  assert.throws(() => weekFrom([["unknown"]], ctx));
  assert.throws(() => weekFrom(ids.slice(0, 4), ctx));
});
test("strict replacement refuses noninteger and absent slot indices", () => {
  const week = evaluateWeek(ids, input, snapshot);
  for (const slot of [NaN, .5, -1, 15]) assert.throws(() => swapCandidates(week, slot, snapshot), /slot/);
});
