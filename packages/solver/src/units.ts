import type { Sku, Unit } from "./types.ts";

// fixed conversion tables; no density guessing. a volume unit on a gram sku (or "each" on anything but an "each"
// sku) is a data error, caught by validateSnapshot, never a runtime fallback.
const MASS: Partial<Record<Unit, number>> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592 };
const VOLUME: Partial<Record<Unit, number>> = { ml: 1, l: 1000, fl_oz: 29.5735, cup: 236.588, tbsp: 14.7868, tsp: 4.92892 };

export class UnitError extends Error {}

// qty in `unit` → the sku's canonical unit (g | ml | each)
export function toCanonical(qty: number, unit: Unit, sku: Pick<Sku, "id" | "canonical_unit">): number {
  if (sku.canonical_unit === "each") {
    if (unit !== "each") throw new UnitError(`${sku.id}: ${unit} on an each-sku`);
    return qty;
  }
  const table = sku.canonical_unit === "g" ? MASS : VOLUME;
  const k = table[unit];
  if (k === undefined) throw new UnitError(`${sku.id}: ${unit} is not a ${sku.canonical_unit} unit`);
  return qty * k;
}

export const packCanonical = (sku: Pick<Sku, "id" | "canonical_unit" | "pack_qty" | "pack_unit">) => toCanonical(sku.pack_qty, sku.pack_unit, sku);

// price per canonical unit from a pack price
export const unitPrice = (shelf: number, sku: Pick<Sku, "id" | "canonical_unit" | "pack_qty" | "pack_unit">) => shelf / packCanonical(sku);

// cost of a quantity from a pack: Σ(qty × unit_price). 8 oz of a 32 oz $4.00 bag = $1.00
export const costOf = (qty: number, unit: Unit, shelf: number, sku: Pick<Sku, "id" | "canonical_unit" | "pack_qty" | "pack_unit">) =>
  toCanonical(qty, unit, sku) * unitPrice(shelf, sku);

export const round2 = (n: number) => Math.round(n * 100) / 100;
