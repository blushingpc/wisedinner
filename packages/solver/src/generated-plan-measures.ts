import { compare, multiply, rational, receipt, type Rational } from "./generated-meal-ranges.ts";

// Local evidence-bound primitive only. A supplied hash pins a declared fact; this
// module does not certify the external source, ingredient, package or recipe.
export type ExactAmount = { numerator: string; denominator: string };
export type BaseUnit = "g" | "ml" | "each";
export type PracticalUnit = "piece" | "cup" | "tbsp" | "package-fraction";
export type MeasureBasis =
  | { kind: "food-specific"; description: string }
  | { kind: "volume"; convention: string }
  | { kind: "package"; packageId: string; packageQuantity: ExactAmount; packageUnit: BaseUnit };
export type MeasureInput = { ingredientId: string; preparedState: string; baseUnit: BaseUnit; amount: ExactAmount; unit: string; factId?: string };
export type MeasureFact = { id: string; ingredientId: string; preparedState: string; baseUnit: BaseUnit; fromUnit: PracticalUnit; factor: ExactAmount; sourceSha256: string; basis: MeasureBasis };
export type MeasureOutcome =
  | { outcome: "success"; quantity: ExactAmount; unit: BaseUnit; evidence: null | { factId: string; sourceSha256: string; basis: MeasureBasis } }
  | { outcome: "held"; code: "measure_fact_needed" | "measure_fact_ambiguous" | "measure_fact_mismatch" | "unsupported_measure_unit" }
  | { outcome: "error"; code: "invalid_measure_input" | "invalid_measure_registry" };
export type BoundMeasureConverter = { readonly outcome: "ready"; readonly convert: (value: unknown) => MeasureOutcome } | { readonly outcome: "error"; readonly code: "invalid_measure_registry" };

const BASE_UNITS: readonly string[] = ["g", "ml", "each"];
const PRACTICAL_UNITS: readonly string[] = ["piece", "cup", "tbsp", "package-fraction"];
type Data = Record<string, unknown>;

function data(value: unknown, required: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid measure data");
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error("Invalid measure data");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.some(key => typeof key !== "string" || ![...required, ...optional].includes(key)) || required.some(key => !Object.hasOwn(descriptors, key))) throw new Error("Invalid measure data");
  const result: Data = {};
  for (const key of keys as string[]) {
    const descriptor = descriptors[key]!;
    if (!("value" in descriptor) || !descriptor.enumerable) throw new Error("Invalid measure data");
    result[key] = descriptor.value;
  }
  return result;
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 500) throw new Error("Invalid measure text");
  return value;
}

function baseUnit(value: unknown): BaseUnit {
  if (typeof value !== "string" || !BASE_UNITS.includes(value)) throw new Error("Invalid measure base unit");
  return value as BaseUnit;
}

function exact(value: unknown, positive = false): Rational {
  const fields = data(value, ["numerator", "denominator"]);
  for (const field of ["numerator", "denominator"]) {
    if (typeof fields[field] !== "string" || fields[field].length > 120 || !/^(0|[1-9]\d*)$/.test(fields[field])) throw new Error("Invalid measure amount");
  }
  const result = rational(BigInt(fields.numerator as string), BigInt(fields.denominator as string));
  if (positive && result.n === BigInt(0)) throw new Error("Invalid measure factor");
  return result;
}

function parseInput(value: unknown): MeasureInput & { exactAmount: Rational } {
  const fields = data(value, ["ingredientId", "preparedState", "baseUnit", "amount", "unit"], ["factId"]);
  const normalized: MeasureInput & { exactAmount: Rational } = {
    ingredientId: text(fields.ingredientId), preparedState: text(fields.preparedState), baseUnit: baseUnit(fields.baseUnit),
    amount: receipt(exact(fields.amount)), exactAmount: exact(fields.amount), unit: text(fields.unit),
  };
  if (Object.hasOwn(fields, "factId")) normalized.factId = text(fields.factId);
  if (normalized.unit === normalized.baseUnit && normalized.factId !== undefined) throw new Error("Unused measure fact");
  return normalized;
}

function parseFact(value: unknown): MeasureFact & { exactFactor: Rational } {
  const fields = data(value, ["id", "ingredientId", "preparedState", "baseUnit", "fromUnit", "factor", "sourceSha256", "basis"]);
  const fromUnit = text(fields.fromUnit);
  if (!PRACTICAL_UNITS.includes(fromUnit) || typeof fields.sourceSha256 !== "string" || !/^[a-f0-9]{64}$/.test(fields.sourceSha256)) throw new Error("Invalid measure evidence");
  const unit = baseUnit(fields.baseUnit), factor = exact(fields.factor, true);
  let basis: MeasureBasis;
  if (fromUnit === "piece") {
    const value = data(fields.basis, ["kind", "description"]);
    if (value.kind !== "food-specific") throw new Error("Invalid piece evidence");
    basis = { kind: "food-specific", description: text(value.description) };
  } else if (fromUnit === "package-fraction") {
    const value = data(fields.basis, ["kind", "packageId", "packageQuantity", "packageUnit"]);
    const packageQuantity = exact(value.packageQuantity, true);
    if (value.kind !== "package" || baseUnit(value.packageUnit) !== unit || compare(packageQuantity, factor) !== 0) throw new Error("Invalid package evidence");
    basis = { kind: "package", packageId: text(value.packageId), packageQuantity: receipt(packageQuantity), packageUnit: unit };
  } else {
    const value = data(fields.basis, ["kind", "convention"]);
    if (value.kind !== "volume") throw new Error("Invalid volume evidence");
    basis = { kind: "volume", convention: text(value.convention) };
  }
  return {
    id: text(fields.id), ingredientId: text(fields.ingredientId), preparedState: text(fields.preparedState), baseUnit: unit,
    fromUnit: fromUnit as PracticalUnit, factor: receipt(factor), exactFactor: factor, sourceSha256: fields.sourceSha256, basis,
  };
}

function parseRegistry(value: unknown): (MeasureFact & { exactFactor: Rational })[] {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length > 20000) throw new Error("Invalid measure registry");
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  if (keys.length !== value.length + 1 || keys.some(key => key !== "length" && (typeof key !== "string" || !/^(0|[1-9]\d*)$/.test(key) || Number(key) >= value.length))) throw new Error("Invalid measure registry");
  const result: (MeasureFact & { exactFactor: Rational })[] = [], seen = new Set<string>();
  for (let i = 0; i < value.length; i++) {
    const descriptor = descriptors[String(i)];
    if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) throw new Error("Invalid measure registry");
    const fact = parseFact(descriptor.value);
    if (seen.has(fact.id)) throw new Error("Duplicate measure fact");
    seen.add(fact.id); result.push(fact);
  }
  return result;
}

export function toBaseQuantity(value: unknown, registry: unknown): MeasureOutcome {
  let input: ReturnType<typeof parseInput>;
  let facts: ReturnType<typeof parseRegistry>;
  try { input = parseInput(value); } catch { return { outcome: "error", code: "invalid_measure_input" }; }
  try { facts = parseRegistry(registry); } catch { return { outcome: "error", code: "invalid_measure_registry" }; }
  return convertParsed(input, facts);
}

function convertParsed(input: ReturnType<typeof parseInput>, facts: ReturnType<typeof parseRegistry>): MeasureOutcome {
  if (input.unit === input.baseUnit) return { outcome: "success", quantity: receipt(input.exactAmount), unit: input.baseUnit, evidence: null };
  if (!PRACTICAL_UNITS.includes(input.unit)) return { outcome: "held", code: "unsupported_measure_unit" };
  const matches = (fact: MeasureFact) => fact.ingredientId === input.ingredientId && fact.preparedState === input.preparedState && fact.baseUnit === input.baseUnit && fact.fromUnit === input.unit;
  const candidates = input.factId === undefined ? facts.filter(matches) : facts.filter(fact => fact.id === input.factId);
  if (!candidates.length) return { outcome: "held", code: "measure_fact_needed" };
  if (candidates.length !== 1) return { outcome: "held", code: "measure_fact_ambiguous" };
  const fact = candidates[0]!;
  if (!matches(fact)) return { outcome: "held", code: "measure_fact_mismatch" };
  return {
    outcome: "success", quantity: receipt(multiply(input.exactAmount, fact.exactFactor)), unit: input.baseUnit,
    evidence: { factId: fact.id, sourceSha256: fact.sourceSha256, basis: fact.basis },
  };
}

function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }

// Trusted registry parsed once for repeated pantry conversions. Parsing creates
// fresh fact/basis objects, so freezing them never mutates caller-owned data.
export function createMeasureConverter(registry: unknown): BoundMeasureConverter {
  let facts: ReturnType<typeof parseRegistry>;
  try { facts = freeze(parseRegistry(registry)); } catch { return { outcome: "error", code: "invalid_measure_registry" }; }
  return Object.freeze({ outcome: "ready", convert(value: unknown): MeasureOutcome {
    let input: ReturnType<typeof parseInput>;
    try { input = parseInput(value); } catch { return { outcome: "error", code: "invalid_measure_input" }; }
    return convertParsed(input, facts);
  } });
}
