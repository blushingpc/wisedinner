import assert from "node:assert/strict";
import { test } from "node:test";
import { costOf, packCanonical, toCanonical, unitPrice, UnitError } from "../src/units.ts";
import { miniSnapshot } from "./helpers.ts";

const g = { id: "g", canonical_unit: "g" as const, pack_qty: 32, pack_unit: "oz" as const };
const ml = { id: "ml", canonical_unit: "ml" as const, pack_qty: 1, pack_unit: "l" as const };
const each = { id: "each", canonical_unit: "each" as const, pack_qty: 12, pack_unit: "each" as const };

test("mass units convert to grams", () => {
  assert.equal(toCanonical(1, "lb", g), 453.592);
  assert.equal(toCanonical(8, "oz", g), 226.796);
  assert.equal(toCanonical(2, "kg", g), 2000);
});

test("volume units convert to ml", () => {
  assert.equal(toCanonical(1, "cup", ml), 236.588);
  assert.equal(Math.round(toCanonical(2, "tbsp", ml) * 100) / 100, 29.57);
  assert.equal(toCanonical(1, "l", ml), 1000);
});

test("each stays each; a fraction of a piece is allowed", () => {
  assert.equal(toCanonical(0.5, "each", each), 0.5);
  assert.equal(packCanonical(each), 12);
});

test("cross-family units are a UnitError, never a guess", () => {
  assert.throws(() => toCanonical(1, "cup", g), UnitError);
  assert.throws(() => toCanonical(1, "each", g), UnitError);
  assert.throws(() => toCanonical(1, "oz", each), UnitError);
});

test("8 oz of a 32 oz $4.00 bag = $1.00", () => {
  assert.equal(Math.round(costOf(8, "oz", 4, g) * 100) / 100, 1);
  assert.equal(Math.round(unitPrice(4, g) * packCanonical(g) * 100) / 100, 4);
});

test("every snapshot price row has unit_price = shelf_price / pack (validated on load)", () => {
  const s = miniSnapshot();
  for (const p of s.store_prices) {
    const k = s.skus.find((x) => x.id === p.sku_id)!;
    assert.ok(Math.abs(p.unit_price * packCanonical(k) - p.shelf_price) < 0.011, p.sku_id);
  }
});
