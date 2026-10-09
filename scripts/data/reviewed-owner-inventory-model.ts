import source from "./reviewed-owner-source.json" with { type: "json" };
import { previewRequest, previewModel, safeCopy, freeze, SOURCE_REVISION, REGISTRY, type PreviewRequest } from "./reviewed-owner-model.ts";

export const INVENTORY_FAMILY = "wd-reviewed-owner-plan-local-candidate";
export const INVENTORY_VERSION = 1;
export type PhysicalPantry = { id: string; fraction: number; basis: string }[];
function held(): never { throw Error("reviewed_inventory_held"); }
function record(v: unknown): Record<string, unknown> { if (!v || typeof v !== "object" || Array.isArray(v)) held(); return v as Record<string, unknown>; }
function fields(v: Record<string, unknown>, keys: string[]) { if (Object.keys(v).sort().join() !== [...keys].sort().join()) held(); }
const sku = (id: string) => { const v = source.edible.skus.find(s => s.id === id); if (!v) held(); return v; };
const factor: Record<string, number> = { g: 1, kg: 1000, oz: 28.3495, lb: 453.592, each: 1 };
const pack = (id: string) => { const s = sku(id), f = factor[s.pack_unit]; if (!f || !Number.isFinite(s.pack_qty) || s.pack_qty <= 0) held(); return s.pack_qty * f; };
// New LOCAL canonical tuple basis. It is deliberately not the legacy pantryBasis hash.
export function inventoryBasis(id: string): string { const s = sku(id); return JSON.stringify([INVENTORY_FAMILY, 1, SOURCE_REVISION, source.input, source.candidate, s.id, s.pack_qty, s.pack_unit, s.pack_label, s.canonical_unit, s.grams_per_unit]); }
export function physicalPantry(value: unknown): PhysicalPantry {
  const v = safeCopy(value); if (!Array.isArray(v) || v.length > 13) held();
  const rows = v.map(item => { const r = record(item); fields(r, ["id", "fraction", "basis"]); if (typeof r.id !== "string" || typeof r.fraction !== "number" || r.fraction <= 0 || r.fraction > 100 || r.basis !== inventoryBasis(r.id)) held(); return { id: r.id, fraction: r.fraction, basis: inventoryBasis(r.id) }; });
  if (new Set(rows.map(r => r.id)).size !== rows.length) held();
  return source.edible.skus.flatMap(s => rows.filter(r => r.id === s.id));
}
export function inventoryModel(selection: unknown, requestValue: unknown, pantryValue: unknown, originalSelection: unknown = selection) {
  const request = previewRequest(requestValue), pantry = physicalPantry(pantryValue), original = previewModel(originalSelection, request), current = previewModel(selection, request);
  // The old model's budget/perishable rows assumed all-new packs. Recompute those
  // two constraints using actual finite owned stock; every other original gate remains.
  const violations = [...current.violations.filter(v => v !== "budget" && v !== "perishable carryover")];
  if (original.violations.some(v => v !== "budget" && v !== "perishable carryover")) held();
  const originalInventory = source.edible.skus.flatMap(s => {
    const used = original.list.find(r => r.id === s.id), ownedPacks = pantry.find(r => r.id === s.id)?.fraction ?? 0;
    if (!used && !ownedPacks) return [];
    const quantity = used?.physical ?? 0, packQuantity = pack(s.id), ownedUsed = Math.min(quantity / packQuantity, ownedPacks), paidPacks = Math.max(0, Math.ceil(quantity / packQuantity - ownedUsed - 1e-6));
    const price = Object.entries(source.prices).find(([id]) => id === s.id)?.[1]; if (!price || !Number.isSafeInteger(price.cents) || price.cents < 0) held();
    if (quantity > 0 && s.perishable && (paidPacks + ownedUsed) * packQuantity / quantity > 1.5 + 1e-9) held();
    return [{ id: s.id, name: s.name, packLabel: s.pack_label, canonicalUnit: s.canonical_unit, basis: inventoryBasis(s.id), packQuantity, paidPacks, ownedPacks, packCents: price.cents, cents: paidPacks * price.cents, priceAsOf: price.asOf, observed: price.observed }];
  });
  const totalCents = originalInventory.reduce((n, r) => n + r.cents, 0);
  if (!Number.isSafeInteger(totalCents) || totalCents > Math.round(request.budget * 100)) held();
  for (const used of current.list) if (!originalInventory.some(r => r.id === used.id)) violations.push("original inventory unavailable");
  const rows = originalInventory.map(row => {
    const used = current.list.find(r => r.id === row.id), physical = used?.physical ?? 0, edible = used?.edible ?? 0, ownedUsedPacks = Math.min(physical / row.packQuantity, row.ownedPacks), paidUsedPhysical = Math.max(0, physical - ownedUsedPacks * row.packQuantity), availablePhysical = (row.paidPacks + row.ownedPacks) * row.packQuantity;
    if (physical > availablePhysical + 1e-6) violations.push("original inventory unavailable");
    if (physical > 0 && sku(row.id).perishable && (row.paidPacks + ownedUsedPacks) * row.packQuantity / physical > 1.5 + 1e-9) violations.push("perishable carryover");
    return { ...row, edible, physical, trim: physical - edible, ownedUsedPacks, paidUsedPhysical, carryoverPhysical: availablePhysical - physical, ownedCarryoverPacks: row.ownedPacks - ownedUsedPacks, purchasedPhysical: row.paidPacks * row.packQuantity, sourceDetails: used ?? original.list.find(r => r.id === row.id) ?? null };
  });
  return freeze({ feasible: violations.length === 0, violations: [...new Set(violations)], days: current.days, originalInventory, list: rows, totalCents, budgetCents: Math.round(request.budget * 100), reference: current, productAdmitted: false as const, cookingAdmitted: false as const });
}
export type InventoryPlan = ReturnType<typeof decodeInventoryPlan>;
export function encodeInventoryPlan(selection: unknown, requestValue: unknown, pantry: unknown, revision: number, originalSelection: unknown = selection, checksValue: unknown = {}): string {
  const request = previewRequest(requestValue); if (!Number.isSafeInteger(revision) || revision < 1) held();
  const model = inventoryModel(selection, request, pantry, originalSelection); if (!model.feasible) held();
  const checks = record(safeCopy(checksValue)); if (Object.entries(checks).some(([id, v]) => typeof v !== "boolean" || !model.list.some(r => r.id === id))) held();
  return JSON.stringify({ family: INVENTORY_FAMILY, version: 1, source: SOURCE_REVISION, input: source.input, candidate: source.candidate, registry: REGISTRY, revision, request, originalSelection: safeCopy(originalSelection), selection: safeCopy(selection), pantry: physicalPantry(pantry), checks: Object.fromEntries(Object.entries(checks).sort(([a], [b]) => a.localeCompare(b))), model });
}
export function decodeInventoryPlan(raw: string, expected?: PreviewRequest) {
  if (typeof raw !== "string" || raw.length > 240000) held();
  let parsed: unknown; try { parsed = JSON.parse(raw); } catch { return held(); }
  const v = record(safeCopy(parsed)); fields(v, ["family", "version", "source", "input", "candidate", "registry", "revision", "request", "originalSelection", "selection", "pantry", "checks", "model"]);
  if (v.family !== INVENTORY_FAMILY || v.version !== 1 || v.source !== SOURCE_REVISION || v.input !== source.input || v.candidate !== source.candidate || v.registry !== REGISTRY || typeof v.revision !== "number") held();
  const request = previewRequest(v.request); if (expected && JSON.stringify(request) !== JSON.stringify(previewRequest(expected))) held();
  if (encodeInventoryPlan(v.selection, request, v.pantry, v.revision, v.originalSelection, v.checks) !== raw) held();
  return freeze({ family: INVENTORY_FAMILY, version: 1, source: SOURCE_REVISION, revision: v.revision, request, originalSelection: safeCopy(v.originalSelection), selection: safeCopy(v.selection), pantry: physicalPantry(v.pantry), checks: record(safeCopy(v.checks)), model: inventoryModel(v.selection, request, v.pantry, v.originalSelection) });
}
export function sameInventoryRequest(a: PreviewRequest, b: PreviewRequest) { return JSON.stringify(previewRequest(a)) === JSON.stringify(previewRequest(b)); }
