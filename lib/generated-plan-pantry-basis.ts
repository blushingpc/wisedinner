import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import type { PantryIntakeOutcome, ReferencePantryStock } from "./generated-plan-pantry.ts";
import { hash } from "../scripts/data/price-evidence.ts";

export const PANTRY_BASIS_VERSION = "wd-pantry-observation-basis-v1";
type Prepared = Extract<PantryIntakeOutcome, { outcome: "prepared" }>;
type Prepare = (entries: unknown) => PantryIntakeOutcome | { readonly outcome: "held"; readonly code: "pantry_intake_not_configured" };
export type ReferencePantryBasis = { readonly version: typeof PANTRY_BASIS_VERSION; readonly entries: readonly unknown[]; readonly prepared: Prepared; readonly basisSha256: string };
type Error = { readonly outcome: "error" | "held"; readonly code: string };
function digest(value: unknown): string { return hash(canonicalReferenceData(value)); }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// Retain original observations, not only the numeric stock. This digest matches
// the stateless preview basis so the durable confirmation cannot lose its input.
export function preparePantryBasis(prepare: Prepare, input: unknown): { readonly outcome: "ready"; readonly basis: ReferencePantryBasis; readonly pantry: readonly ReferencePantryStock[] } | Exclude<ReturnType<Prepare>, { outcome: "prepared" }> {
  try {
    const entries = copyReferenceData(input);
    if (!Array.isArray(entries)) return { outcome: "error", code: "invalid_pantry_input" };
    const prepared = prepare(entries);
    if (prepared.outcome !== "prepared") return prepared;
    const basis: ReferencePantryBasis = freeze({ version: PANTRY_BASIS_VERSION, entries, prepared, basisSha256: digest({ entries, prepared }) });
    return { outcome: "ready", basis, pantry: prepared.pantry };
  } catch { return { outcome: "error", code: "invalid_pantry_input" }; }
}

// Structural closure does not assert that the saved mapping is still current.
// Receipt recovery keeps the historical commit even when the display is held.
export function inspectPantryBasis(value: unknown, stock: unknown): { readonly outcome: "ready"; readonly basis: ReferencePantryBasis } | Error {
  try {
    const row = copyReferenceData(value) as Record<string, unknown>;
    if (!row || typeof row !== "object" || Array.isArray(row) || Object.keys(row).sort().join("|") !== "basisSha256|entries|prepared|version" || row.version !== PANTRY_BASIS_VERSION || !Array.isArray(row.entries) || row.entries.length > 1000) throw new TypeError();
    const prepared = row.prepared as Prepared;
    if (prepared?.outcome !== "prepared" || !Array.isArray(prepared.records) || !Array.isArray(prepared.pantry) || row.basisSha256 !== digest({ entries: row.entries, prepared }) || digest(stock) !== digest(prepared.pantry)) throw new TypeError();
    return { outcome: "ready", basis: freeze(row as ReferencePantryBasis) };
  } catch { return { outcome: "error", code: "stored_pantry_basis_invalid" }; }
}

export function revalidatePantryBasis(prepare: Prepare, value: unknown, stock: unknown): { readonly outcome: "ready"; readonly basis: ReferencePantryBasis } | Error {
  const inspected = inspectPantryBasis(value, stock);
  if (inspected.outcome !== "ready") return inspected;
  const current = preparePantryBasis(prepare, inspected.basis.entries);
  if (current.outcome !== "ready" || current.basis.basisSha256 !== inspected.basis.basisSha256) return { outcome: "held", code: "saved_pantry_basis_changed" };
  return inspected;
}
