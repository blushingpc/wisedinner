import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createReviewedOwnerInventory } from "./reviewed-owner-inventory.ts";
import { createReviewedOwnerReroll } from "./reviewed-owner-reroll.ts";
import { decodeInventoryPlan, encodeInventoryPlan, inventoryBasis, replacementPlan } from "./reviewed-owner-inventory-model.ts";
import * as app from "../../../wisedinner-app/src/data/owner-reviewed-inventory-model.ts";
import { REGISTRY } from "./reviewed-owner-model.ts";
const tools = ["stovetop", "nonstick-pan", "spatula", "food-thermometer", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools"];
const base = { owner: "10000000-0000-4000-8000-000000000001", planningRevision: 1, profileRevision: 1, registry: REGISTRY, budget: 60, protein: 150, kcalMin: 1800, kcalMax: 2800, diet: "none", allergies: [], household: 1, stores: ["kroger"], zip: "43215", seed: 7, equipment: tools };
const inventory = createReviewedOwnerInventory(), reroll = createReviewedOwnerReroll();
for (const [profile, patch] of [["typical", {}], ["floor", { budget: 45, protein: 100, kcalMin: 1600, kcalMax: 2600 }], ["household-two", { budget: 120, household: 2 }]] as const) for (const seed of [0, 7, 19]) test(`original ${profile}/${seed}: deterministic bounded single-slot replacements or honest misses`, () => {
  const beforeRaw = inventory.install({ ...base, ...patch, seed }, []), before = decodeInventoryPlan(beforeRaw); let successes = 0, misses = 0;
  if (process.env.WD_REVIEWED_OUTPUT) writeFileSync(`${process.env.WD_REVIEWED_OUTPUT}/${profile}-${seed}-original.json`, beforeRaw, { flag: "wx" });
  for (let slot = 0; slot < 15; slot++) { const raw = reroll.replace(beforeRaw, slot); if (process.env.WD_REVIEWED_OUTPUT) writeFileSync(`${process.env.WD_REVIEWED_OUTPUT}/${profile}-${seed}-slot-${slot}.json`, raw ?? "null", { flag: "wx" }); if (raw === null) { misses++; continue; } successes++;
    assert.equal(raw, reroll.replace(beforeRaw, slot)); const after = replacementPlan(beforeRaw, raw, slot); assert.deepEqual(after, app.replacementPlan(beforeRaw, raw, slot)); assert.equal(after.model.totalCents, before.model.totalCents); assert.deepEqual(after.model.originalInventory, before.model.originalInventory); assert.deepEqual(after.pantry, before.pantry);
    assert(after.model.list.every(r => r.carryoverPhysical >= -1e-6)); assert(after.model.feasible); assert.equal(after.revision, 2);
  }
  assert.equal(successes + misses, 15); console.log(JSON.stringify({ profile, seed, successes, misses, originalCents: before.model.totalCents }));
});
test("finite owned stock, repeated replacement, corruption and unchanged source checks remain exact", () => {
  const beforeRaw = inventory.install(base, [{ id: "oats", fraction: 1, basis: inventoryBasis("oats") }]), before = decodeInventoryPlan(beforeRaw); let changed: string | null = null;
  for (let slot = 0; slot < 15 && changed === null; slot++) changed = reroll.replace(beforeRaw, slot);
  assert(changed, "actual source must supply a replacement"); const after = decodeInventoryPlan(changed); assert.deepEqual(after.model.originalInventory, before.model.originalInventory); assert.equal(after.model.totalCents, before.model.totalCents);
  let repeated: string | null = null; for (let slot = 0; slot < 15 && repeated === null; slot++) repeated = reroll.replace(changed, slot);
  assert(repeated, "actual finite stock must support the tested second replacement"); const twice = decodeInventoryPlan(repeated); assert.equal(twice.revision, 3); assert.deepEqual(twice.model.originalInventory, before.model.originalInventory); assert.equal(twice.model.totalCents, before.model.totalCents); assert.deepEqual(twice.pantry, before.pantry);
  for (const slot of [-1, 15, .5, NaN, null, {}, "0"]) assert.throws(() => reroll.replace(beforeRaw, slot));
  let effects = 0; const getter = {}; Object.defineProperty(getter, "slot", { get() { effects++; return 0; } }); assert.throws(() => reroll.replace(beforeRaw, getter)); assert.equal(effects, 0);
  assert.throws(() => replacementPlan(beforeRaw, beforeRaw, 0)); assert.throws(() => decodeInventoryPlan(changed.replace('"source":', '"extra":true,"source":')));
  const grown = encodeInventoryPlan(after.selection, after.request, [{ id: "oats", fraction: 2, basis: inventoryBasis("oats") }], 2, after.originalSelection, after.checks); assert.throws(() => replacementPlan(beforeRaw, grown, 0));
  let stale = false; const bound = createReviewedOwnerReroll(p => { const raw = readFileSync(p); return stale && p === "docs/ingredient-catalog/reviewed-week-sources.json" ? Buffer.concat([raw, Buffer.from(" ")]) : raw; }); stale = true; assert.throws(() => bound.replace(beforeRaw, 0));
  assert.equal(readFileSync("scripts/data/reviewed-owner-inventory-model.ts", "utf8"), readFileSync("../wisedinner-app/src/data/owner-reviewed-inventory-model.ts", "utf8"));
});
