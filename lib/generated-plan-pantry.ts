import { createMeasureConverter, type BaseUnit, type ExactAmount, type MeasureOutcome } from "../packages/solver/src/generated-plan-measures.ts";
import { add, rational, zero, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { hash } from "../scripts/data/price-evidence.ts";

type Data = Record<string, unknown>;
type Binding = { id: string; ingredientId: string; preparedState: string; baseUnit: BaseUnit; skuId: string; formDigest: string; sourceSha256: string };
type MeasureEvidence = Extract<MeasureOutcome, { outcome: "success" }>["evidence"];
export type ReferencePantryStock = { readonly skuId: string; readonly unit: BaseUnit; readonly formDigest: string; readonly quantity: { readonly numerator: number; readonly denominator: number } };
export type PantryIntakeRecord = { readonly pantryId: string; readonly input: Readonly<Data>; readonly status: "converted" | "held"; readonly code?: string; readonly skuId?: string; readonly quantity?: ExactAmount; readonly unit?: BaseUnit; readonly measureEvidence?: MeasureEvidence; readonly bindingEvidence?: { readonly id: string; readonly sourceSha256: string; readonly bindingSha256: string } };
type Evidence = { readonly records: readonly PantryIntakeRecord[]; readonly sourceAdoptionGranted: false; readonly deductionPerformed: false; readonly persistencePerformed: false };
export type PantryIntakeOutcome =
  | Evidence & { readonly outcome: "prepared"; readonly pantry: readonly ReferencePantryStock[] }
  | Evidence & { readonly outcome: "held"; readonly code: "pantry_inputs_unresolved"; readonly pantry: null; readonly knownOnlyStock: readonly ReferencePantryStock[]; readonly unresolvedPantryIds: readonly string[] }
  | { readonly outcome: "error"; readonly code: "invalid_pantry_input" };
export type PantryIntakeBinding = { readonly outcome: "ready"; readonly prepare: (rows: unknown) => PantryIntakeOutcome } | { readonly outcome: "error"; readonly code: "invalid_pantry_registry" };
function invalid(): never { throw new Error("Pantry input refused"); }
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): Data { if (!value || typeof value !== "object" || Array.isArray(value) || required.some(key => !Object.hasOwn(value, key)) || Object.keys(value).some(key => ![...required, ...optional].includes(key))) invalid(); return value as Data; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function unit(value: unknown): BaseUnit { if (value !== "g" && value !== "ml" && value !== "each") invalid(); return value; }
function digest(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) invalid(); return result; }
function key(ingredientId: string, preparedState: string, baseUnit: BaseUnit): string { return JSON.stringify([ingredientId, preparedState, baseUnit]); }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function exact(value: ExactAmount): Rational { return rational(BigInt(value.numerator), BigInt(value.denominator)); }

// Trusted purchase-state food/form bindings, NOT consumed-to-purchase yield
// factors. Never turn cooked leftovers into raw stock or infer a package mass.
// This is unbound private preparation only; actual evidence adoption is separate.
export function createPantryIntake(configuration: unknown): PantryIntakeBinding {
  let converter: Extract<ReturnType<typeof createMeasureConverter>, { outcome: "ready" }>;
  const byFood = new Map<string, Binding[]>(), byId = new Map<string, Binding>();
  try {
    const configured = record(copyReferenceData(configuration), ["measureFacts", "purchaseBindings"]), bound = createMeasureConverter(configured.measureFacts);
    if (bound.outcome !== "ready" || !Array.isArray(configured.purchaseBindings) || configured.purchaseBindings.length > 20000) invalid(); converter = bound;
    const shapes = new Map<string, string>();
    for (const value of configured.purchaseBindings) {
      const row = record(value, ["id", "ingredientId", "preparedState", "baseUnit", "skuId", "formDigest", "sourceSha256"]);
      const binding: Binding = { id: text(row.id), ingredientId: text(row.ingredientId), preparedState: text(row.preparedState), baseUnit: unit(row.baseUnit), skuId: text(row.skuId), formDigest: digest(row.formDigest), sourceSha256: digest(row.sourceSha256) };
      if (byId.has(binding.id)) invalid(); const shape = JSON.stringify([binding.baseUnit, binding.formDigest, binding.preparedState]);
      if (shapes.has(binding.skuId) && shapes.get(binding.skuId) !== shape) invalid(); shapes.set(binding.skuId, shape);
      freeze(binding); byId.set(binding.id, binding); const foodKey = key(binding.ingredientId, binding.preparedState, binding.baseUnit); byFood.set(foodKey, [...(byFood.get(foodKey) ?? []), binding]);
    }
  } catch { return { outcome: "error", code: "invalid_pantry_registry" }; }
  function prepare(rowsValue: unknown): PantryIntakeOutcome {
    try {
      const rows = copyReferenceData(rowsValue); if (!Array.isArray(rows) || rows.length > 1000) invalid();
      const records: PantryIntakeRecord[] = [], ids = new Set<string>(), groups = new Map<string, { binding: Binding; quantity: Rational; capacityExceeded: boolean }>();
      for (const value of rows) {
        if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
        const pantryId = text((value as Data).pantryId); if (ids.has(pantryId)) invalid(); ids.add(pantryId);
        if ((value as Data).kind === "custom") {
          const input = record(value, ["pantryId", "kind", "label", "amountText"]); text(input.label); text(input.amountText);
          records.push({ pantryId, input, status: "held", code: "custom_pantry_mapping_required" }); continue;
        }
        const input = record(value, ["pantryId", "kind", "ingredientId", "preparedState", "baseUnit", "amount", "unit"], ["measureFactId", "purchaseBindingId"]);
        if (input.kind !== "known") invalid(); const ingredientId = text(input.ingredientId), state = text(input.preparedState), baseUnit = unit(input.baseUnit);
        const chosenId = Object.hasOwn(input, "purchaseBindingId") ? text(input.purchaseBindingId) : null;
        const measured = converter.convert({ ingredientId, preparedState: state, baseUnit, amount: input.amount, unit: text(input.unit), ...(Object.hasOwn(input, "measureFactId") ? { factId: text(input.measureFactId) } : {}) });
        if (measured.outcome === "error") invalid();
        if (measured.outcome === "held") { records.push({ pantryId, input, status: "held", code: measured.code }); continue; }
        const foodKey = key(ingredientId, state, baseUnit);
        const candidates = chosenId === null ? byFood.get(foodKey) ?? [] : byId.has(chosenId) ? [byId.get(chosenId)!] : [];
        if (candidates.length !== 1) { records.push({ pantryId, input, status: "held", code: candidates.length ? "pantry_binding_ambiguous" : "pantry_binding_needed" }); continue; }
        const binding = candidates[0]!;
        if (key(binding.ingredientId, binding.preparedState, binding.baseUnit) !== foodKey) { records.push({ pantryId, input, status: "held", code: "pantry_binding_mismatch" }); continue; }
        const previous = groups.get(binding.skuId), quantity = previous?.capacityExceeded ? previous.quantity : add(previous?.quantity ?? zero(), exact(measured.quantity));
        const capacityExceeded = previous?.capacityExceeded || String(quantity.n).length > 240 || String(quantity.d).length > 240;
        groups.set(binding.skuId, { binding, quantity, capacityExceeded: Boolean(capacityExceeded) });
        records.push({ pantryId, input, status: "converted", skuId: binding.skuId, quantity: measured.quantity, unit: measured.unit, measureEvidence: measured.evidence, bindingEvidence: { id: binding.id, sourceSha256: binding.sourceSha256, bindingSha256: hash(binding) } });
      }
      const pantry: ReferencePantryStock[] = [], rejectedSkus = new Set<string>(), maximum = BigInt(Number.MAX_SAFE_INTEGER);
      for (const [skuId, group] of [...groups].sort(([a], [b]) => order(a, b))) {
        if (group.capacityExceeded || group.quantity.n > maximum || group.quantity.d > maximum) { rejectedSkus.add(skuId); continue; }
        pantry.push({ skuId, unit: group.binding.baseUnit, formDigest: group.binding.formDigest, quantity: { numerator: Number(group.quantity.n), denominator: Number(group.quantity.d) } });
      }
      const finalRecords = records.map(row => row.skuId && rejectedSkus.has(row.skuId) ? { ...row, status: "held" as const, code: "pantry_quantity_capacity_exceeded" } : row).sort((a, b) => order(a.pantryId, b.pantryId));
      const unresolvedPantryIds = finalRecords.filter(row => row.status === "held").map(row => row.pantryId), evidence = { records: finalRecords, sourceAdoptionGranted: false as const, deductionPerformed: false as const, persistencePerformed: false as const };
      return unresolvedPantryIds.length ? freeze({ outcome: "held", code: "pantry_inputs_unresolved", pantry: null, knownOnlyStock: pantry, unresolvedPantryIds, ...evidence }) : freeze({ outcome: "prepared", pantry, ...evidence });
    } catch { return { outcome: "error", code: "invalid_pantry_input" }; }
  }
  return Object.freeze({ outcome: "ready", prepare });
}
