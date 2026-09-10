// units for the pipeline: the solver package owns the conversion tables; this module fills unit_price on price
// rows from the pack size and exposes the serving-cost arithmetic the tests pin (8 oz of a 32 oz $4.00 bag = $1.00).
export { toCanonical, packCanonical, unitPrice, costOf, UnitError } from "../../packages/solver/src/units.ts";
import { packCanonical } from "../../packages/solver/src/units.ts";
import { SKUS } from "./authored/skus.ts";

const byId = new Map(SKUS.map((s) => [s.id, s]));

export function withUnitPrice<T extends { sku_id: string; shelf_price: number; unit_price?: number }>(rows: T[]): (T & { unit_price: number })[] {
  return rows.map((r) => {
    const s = byId.get(r.sku_id);
    if (!s) throw new Error(`unknown sku ${r.sku_id}`);
    return { ...r, unit_price: r.shelf_price / packCanonical(s) };
  });
}
