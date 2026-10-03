import type { Snapshot, StorePrice } from "../../packages/solver/src/types.ts";

const keyOf = (row: StorePrice) => JSON.stringify([row.sku_id, row.store_id, row.region]);
const labelOf = (row: StorePrice) => `${row.sku_id}/${row.store_id}/${row.region}`;

// A successful but incomplete database page must not become the app's newest snapshot.
// Deliberate coverage or pack changes need a reviewed migration, not a silent weekly drop.
export function guardContinuity(next: Snapshot, previous: Snapshot | null, maxSwing: number): string[] {
  if (!previous) return [];
  const problems: string[] = [];
  if (next.version <= previous.version) problems.push("snapshot version did not advance");
  if (next.generated_at < previous.generated_at) problems.push("snapshot generation date moved backwards");
  const skus = new Map(next.skus.map((row) => [row.id, row]));
  for (const old of previous.skus) {
    const row = skus.get(old.id);
    if (!row) {
      problems.push(`missing previously published sku ${old.id}`);
      continue;
    }
    if (row.pack_qty !== old.pack_qty || row.pack_unit !== old.pack_unit || row.canonical_unit !== old.canonical_unit || row.grams_per_unit !== old.grams_per_unit) {
      problems.push(`${old.id}: pack basis changed; price and nutrition matches need review`);
    }
  }
  const rows = new Map(next.store_prices.map((row) => [keyOf(row), row]));
  for (const old of previous.store_prices) {
    const row = rows.get(keyOf(old));
    if (!row) {
      problems.push(`missing previously observed price ${labelOf(old)}`);
      continue;
    }
    if (row.as_of < old.as_of) problems.push(`${labelOf(row)}: observation date moved backwards`);
    if (old.shelf_price > 0 && Math.abs(row.shelf_price - old.shelf_price) / old.shelf_price > maxSwing + 1e-12) {
      problems.push(`${labelOf(row)}: observed price moved more than ${Math.round(maxSwing * 100)}%`);
    }
  }
  return problems;
}
