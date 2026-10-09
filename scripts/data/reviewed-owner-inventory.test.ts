import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createReviewedOwnerInventory } from "./reviewed-owner-inventory.ts";
import { createReviewedOwnerCatalog } from "./reviewed-owner-catalog.ts";
import { decodeInventoryPlan, inventoryBasis, physicalPantry } from "./reviewed-owner-inventory-model.ts";
import { previewRequest, decodePreview, REGISTRY } from "./reviewed-owner-model.ts";
import * as app from "../../../wisedinner-app/src/data/owner-reviewed-inventory-model.ts";
const tools = ["stovetop", "nonstick-pan", "spatula", "food-thermometer", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools"];
const base = { owner: "10000000-0000-4000-8000-000000000001", planningRevision: 1, profileRevision: 1, registry: REGISTRY, budget: 60, protein: 150, kcalMin: 1800, kcalMax: 2800, diet: "none", allergies: [], household: 1, stores: ["kroger"], zip: "43215", seed: 7, equipment: tools };
const inventory = createReviewedOwnerInventory(), catalog = createReviewedOwnerCatalog();
for (const [profile, patch] of [["typical", {}], ["floor", { budget: 45, protein: 100, kcalMin: 1600, kcalMax: 2600 }], ["household-two", { budget: 120, household: 2 }]] as const) for (const seed of [0, 7, 19]) test(`real inventory ${profile}/${seed} original parity and independent physical arithmetic`, () => {
  const request = previewRequest({ ...base, ...patch, seed }), raw = inventory.install(request, []), plan = decodeInventoryPlan(raw, request), original = decodePreview(catalog.solve(request), request);
  assert.equal(raw, inventory.install(request, [])); assert.deepEqual(plan, app.decodeInventoryPlan(raw, request)); assert.deepEqual(plan.model.days, original.days); assert.equal(plan.model.totalCents, original.totalCents);
  for (const row of plan.model.list) { const old = original.list.find(r => r.id === row.id); assert(old); assert.equal(row.paidPacks, old.packs); assert.equal(row.physical, old.physical); assert.equal(row.trim, old.trim); assert.equal(row.cents, old.cents); }
  assert.equal(plan.model.productAdmitted, false); assert.equal(plan.model.cookingAdmitted, false);
});
test("finite explicit owned pack scenarios keep consumed nutrients and canonical source basis", () => {
  const request = previewRequest(base), empty = decodeInventoryPlan(inventory.install(request, []));
  for (const fraction of [.1, .5, 1, 3]) { const pantry = [{ id: "oats", fraction, basis: inventoryBasis("oats") }], plan = decodeInventoryPlan(inventory.install(request, pantry)); assert.deepEqual(plan.model.days, empty.model.days); assert(plan.model.totalCents <= empty.model.totalCents); const oats = plan.model.list.find(r => r.id === "oats"); assert(oats); assert.equal(oats.ownedPacks, fraction); assert(Math.abs(oats.carryoverPhysical + oats.physical - (oats.paidPacks + fraction) * oats.packQuantity) < 1e-9); }
});
test("owned data rejects unknown/negative/NaN/excessive/duplicate/sparse/accessor/prototype/stale basis without effects", () => {
  const row = { id: "oats", fraction: .5, basis: inventoryBasis("oats") }; let effects = 0;
  const getter = { ...row }; Object.defineProperty(getter, "fraction", { get() { effects++; return .5; }, enumerable: true });
  for (const v of [null, new Array(1), [getter], [Object.create(row)], [row, row], [{ ...row, fraction: -1 }], [{ ...row, fraction: NaN }], [{ ...row, fraction: 101 }], [{ ...row, basis: "stale" }], [{ ...row, id: "legacy-oats" }], [{ ...row, extra: 1 }]]) assert.throws(() => physicalPantry(v)); assert.equal(effects, 0);
});
test("unknown family, corruption, extra and duplicate wire fields reject both readers and old preview refuses", () => {
  const request = previewRequest(base), raw = inventory.install(request, []);
  for (const wire of [raw + " ", raw.replace('"version":1', '"version":1,"version":1'), raw.replace('"version":1', '"version":2'), raw.replace('"source":', '"extra":true,"source":'), raw.replace('"paidPacks":1', '"paidPacks":1000'), raw.replace('"totalCents":5262', '"totalCents":5263')]) { assert.notEqual(wire, raw); assert.throws(() => decodeInventoryPlan(wire)); assert.throws(() => app.decodeInventoryPlan(wire)); }
  assert.throws(() => decodePreview(raw, request)); assert.throws(() => inventory.install({ ...base, equipment: [] }, [])); assert.throws(() => inventory.install({ ...base, allergies: ["soy"] }, [])); assert.throws(() => inventory.install({ ...base, zip: "33301" }, []));
  assert.equal(readFileSync("scripts/data/reviewed-owner-inventory-model.ts", "utf8"), readFileSync("../wisedinner-app/src/data/owner-reviewed-inventory-model.ts", "utf8"));
});
