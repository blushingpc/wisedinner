import { copyReferenceData } from "./generated-plan-data.ts";
import { parsePeople } from "../packages/solver/src/generated-plan-contract.ts";
import { hash } from "../scripts/data/price-evidence.ts";

// Trusted reviewed declarations only, not a classifier, source certifier,
// clinical/cross-contact guarantee or client-supplied grant. No I/O or mutation.
export const HOUSEHOLD_ALLERGY_POLICY = "wd-household-food-allergies-v1";
type Data = Record<string, unknown>;
type Unit = "g" | "ml" | "each";
type Status = "contains" | "not-declared" | "unknown";
type ConsumedForm = { assignmentId: string; personId: string; ingredientId: string; preparedState: string; baseUnit: Unit };
type PurchaseForm = { skuId: string; unit: Unit; formDigest: string };
type Fact = { id: string; allergenId: string; status: Status; sourceSha256: string } & Data;
export type AllergyReviewPin = { readonly kind: "ingredient" | "purchase"; readonly id: string; readonly sourceSha256: string; readonly factSha256: string };
export type HouseholdAllergyOutcome =
  | { readonly outcome: "allowed"; readonly active: boolean; readonly householdAllergenIds: readonly string[]; readonly basisSha256: string | null; readonly evidence: readonly AllergyReviewPin[]; readonly crossContactEstablished: false; readonly sourceTruthEstablished: false }
  | { readonly outcome: "held"; readonly code: "household_allergy_declaration_unresolved" | "household_allergy_review_required" | "household_allergy_review_capacity"; readonly personId?: string }
  | { readonly outcome: "no_fit"; readonly reasons: readonly { readonly code: "household_allergen_excluded"; readonly personId?: string; readonly assignmentId?: string }[] }
  | { readonly outcome: "error"; readonly code: "invalid_household_allergy_input" };
export type HouseholdAllergyGuard = { readonly outcome: "ready"; readonly check: (people: unknown, consumedForms: unknown, purchaseForms: unknown) => HouseholdAllergyOutcome } | { readonly outcome: "error"; readonly code: "invalid_household_allergy_registry" };
class Capacity extends Error {}
function invalid(): never { throw Error("Invalid household allergy data"); }
function record(value: unknown, keys: readonly string[]): Data { if (!value || typeof value !== "object" || Array.isArray(value) || keys.some(k => !Object.hasOwn(value, k)) || Object.keys(value).some(k => !keys.includes(k))) invalid(); return value as Data; }
function text(value: unknown): string { if (typeof value !== "string" || !value.trim() || value.length > 500) invalid(); return value; }
function sha(value: unknown): string { const v = text(value); if (!/^[a-f0-9]{64}$/.test(v)) invalid(); return v; }
function unit(value: unknown): Unit { if (value !== "g" && value !== "ml" && value !== "each") invalid(); return value; }
function list(value: unknown, maximum: number): unknown[] { if (!Array.isArray(value) || value.length > maximum) invalid(); return value; }
function order(a: string, b: string): number { return a < b ? -1 : a > b ? 1 : 0; }
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
const ingredientKey = (i: { ingredientId: unknown; preparedState: unknown; baseUnit: unknown }, allergen: string) => JSON.stringify([i.ingredientId, i.preparedState, i.baseUnit, allergen]);
const purchaseKey = (i: { skuId: unknown; unit: unknown; formDigest: unknown }, allergen: string) => JSON.stringify([i.skuId, i.unit, i.formDigest, allergen]);

export function createHouseholdAllergyGuard(configuration: unknown, trustedSourceSha256: string): HouseholdAllergyGuard {
  let sourceSha256: string;
  const known = new Set<string>(), ingredients = new Map<string, Fact>(), purchases = new Map<string, Fact>();
  try {
    const c = record(copyReferenceData(configuration), ["policy", "sourceSha256", "knownAllergenIds", "ingredientFacts", "purchaseFacts"]);
    sourceSha256 = sha(c.sourceSha256); if (sourceSha256 !== sha(trustedSourceSha256) || c.policy !== HOUSEHOLD_ALLERGY_POLICY) invalid();
    for (const value of list(c.knownAllergenIds, 100)) { const id = text(value); if (known.has(id)) invalid(); known.add(id); }
    const ids = new Set<string>();
    for (const kind of ["ingredient", "purchase"] as const) for (const value of list(kind === "ingredient" ? c.ingredientFacts : c.purchaseFacts, 20000)) {
      const shape = kind === "ingredient" ? ["ingredientId", "preparedState", "baseUnit"] : ["skuId", "unit", "formDigest"];
      const row = record(value, ["id", ...shape, "allergenId", "status", "sourceSha256"]), id = text(row.id), allergenId = text(row.allergenId);
      if (ids.has(id) || !known.has(allergenId) || !["contains", "not-declared", "unknown"].includes(String(row.status))) invalid(); ids.add(id);
      let key: string;
      if (kind === "ingredient") { text(row.ingredientId); text(row.preparedState); unit(row.baseUnit); key = ingredientKey(row as { ingredientId: unknown; preparedState: unknown; baseUnit: unknown }, allergenId); }
      else { text(row.skuId); unit(row.unit); sha(row.formDigest); key = purchaseKey(row as { skuId: unknown; unit: unknown; formDigest: unknown }, allergenId); }
      const index = kind === "ingredient" ? ingredients : purchases; if (index.has(key)) invalid();
      index.set(key, freeze({ ...row, id, allergenId, status: row.status as Status, sourceSha256: sha(row.sourceSha256) }));
    }
  } catch { return { outcome: "error", code: "invalid_household_allergy_registry" }; }
  function check(peopleValue: unknown, ingredientValue: unknown, purchaseValue: unknown): HouseholdAllergyOutcome {
    try {
      if (Array.isArray(ingredientValue) && ingredientValue.length > 10000 || Array.isArray(purchaseValue) && purchaseValue.length > 10000) throw new Capacity();
      const people = parsePeople(copyReferenceData(peopleValue)); if (people.outcome !== "validated") invalid();
      const personIds = new Set(people.people.map(p => p.personId)), declared: { personId: string; profileRevision: number; mappingRevision: number; allergens: string[] }[] = [], union = new Set<string>();
      for (const person of [...people.people].sort((a, b) => order(a.personId, b.personId))) {
        const e = person.exclusions; if (e.kind === "none") continue;
        if (e.kind !== "mapped" || e.ingredientIds.length || !e.allergenIds.length || e.allergenIds.some(id => !known.has(id))) return { outcome: "held", code: "household_allergy_declaration_unresolved", personId: person.personId };
        const allergens = [...e.allergenIds].sort(order); allergens.forEach(id => union.add(id));
        declared.push({ personId: person.personId, profileRevision: person.profileRevision, mappingRevision: e.mappingRevision, allergens });
      }
      const assignments = new Map<string, string>();
      const consumed: ConsumedForm[] = list(copyReferenceData(ingredientValue), 10000).map(value => {
        const f = record(value, ["assignmentId", "personId", "ingredientId", "preparedState", "baseUnit"]), personId = text(f.personId), assignmentId = text(f.assignmentId);
        if (!personIds.has(personId) || assignments.has(assignmentId) && assignments.get(assignmentId) !== personId) invalid(); assignments.set(assignmentId, personId);
        return { assignmentId, personId, ingredientId: text(f.ingredientId), preparedState: text(f.preparedState), baseUnit: unit(f.baseUnit) };
      }).sort((a, b) => order(JSON.stringify(a), JSON.stringify(b)));
      const bought: PurchaseForm[] = list(copyReferenceData(purchaseValue), 10000).map(value => { const f = record(value, ["skuId", "unit", "formDigest"]); return { skuId: text(f.skuId), unit: unit(f.unit), formDigest: sha(f.formDigest) }; }).sort((a, b) => order(JSON.stringify(a), JSON.stringify(b)));
      const householdAllergenIds = [...union].sort(order), evidence = new Map<string, AllergyReviewPin>(), reasons = new Map<string, { code: "household_allergen_excluded"; personId?: string; assignmentId?: string }>();
      let unresolved = false, pairs = 0;
      function inspect(fact: Fact | undefined, kind: "ingredient" | "purchase", subject: { personId?: string; assignmentId?: string }) {
        if (++pairs > 20000) throw new Capacity();
        if (!fact || fact.status === "unknown") { unresolved = true; return; }
        if (fact.status === "contains") { const reason = { code: "household_allergen_excluded" as const, ...subject }; reasons.set(JSON.stringify(reason), reason); }
        evidence.set(fact.id, { kind, id: fact.id, sourceSha256: fact.sourceSha256, factSha256: hash(fact) });
      }
      for (const allergenId of householdAllergenIds) {
        for (const food of consumed) inspect(ingredients.get(ingredientKey(food, allergenId)), "ingredient", { personId: food.personId, assignmentId: food.assignmentId });
        for (const food of bought) inspect(purchases.get(purchaseKey(food, allergenId)), "purchase", {});
      }
      if (reasons.size) return freeze({ outcome: "no_fit", reasons: [...reasons].sort(([a], [b]) => order(a, b)).map(([, reason]) => reason) });
      if (unresolved) return { outcome: "held", code: "household_allergy_review_required" };
      const pins = [...evidence.values()].sort((a, b) => order(a.id, b.id)), active = householdAllergenIds.length > 0;
      return freeze({ outcome: "allowed", active, householdAllergenIds, basisSha256: active ? hash({ policy: HOUSEHOLD_ALLERGY_POLICY, sourceSha256, declared, evidence: pins }) : null, evidence: pins, crossContactEstablished: false, sourceTruthEstablished: false });
    } catch (error) { return error instanceof Capacity ? { outcome: "held", code: "household_allergy_review_capacity" } : { outcome: "error", code: "invalid_household_allergy_input" }; }
  }
  return Object.freeze({ outcome: "ready", check });
}
