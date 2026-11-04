import { createHash } from "node:crypto";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { createRevisedCatalogReader } from "./generated-plan-catalog.ts";
import { createPublicAveragePriceReader } from "./generated-public-price-evidence.ts";
import { decimal, multiply, rational, receipt, type Rational } from "../packages/solver/src/generated-meal-ranges.ts";
import type { BaseUnit, ExactAmount } from "../packages/solver/src/generated-plan-measures.ts";
import type { PurchaseCorrespondence } from "./generated-plan-quote.ts";
import type { RegionalPackFact } from "./generated-regional-quote.ts";
import { NOMINAL_DENSITY_KIND, NOMINAL_DENSITY_FLAG, nominalDensityFactor } from "./generated-nominal-density.ts";
import { NOMINAL_PREPARATION_YIELD_KIND, NOMINAL_PREPARATION_YIELD_FLAG, nominalPreparationYieldFactor, readNominalPreparationYieldReference } from "./generated-nominal-preparation-yield.ts";
import { NOMINAL_EGG_KIND, NOMINAL_EGG_FLAG } from "./generated-nominal-egg.ts";

// Offline trusted configuration only. A valid pin binds a curator's declared
// review; it cannot establish food truth, source adoption or client authority.
type Data = Record<string, unknown>;
type Region = RegionalPackFact["region"];
type PriceReader = Extract<ReturnType<typeof createPublicAveragePriceReader>, { outcome: "ready" }>;
type BenchmarkOutcome = ReturnType<PriceReader["benchmark"]>;
type Benchmark = Extract<BenchmarkOutcome, { outcome: "benchmark" }>;
type ClaimBase = { id: string; ingredientSignature: string; sourceUrl: string; sourceSha256: string; reviewedOn: string; evidenceLevel: "primary-source-native-projection" | "primary-source-web-extract" | "synthetic-test-only"; description: string };
type PackageClaim = ClaimBase & { kind: "package-reference"; purchaseState: string; unit: BaseUnit; nominalQuantity: ExactAmount };
type CategoryClaim = ClaimBase & { kind: "price-category-reference"; product: string; priceScope: "conditional-category-unit-model" | "source-defined-dozen-pack" };
type DensityClaim = ClaimBase & { kind: "density-reference"; recordRows: { fdcId: number; foodRowSha256: string }[]; measurementKind: "mass-density"; unit: "g/ml"; densityGPerMl: ExactAmount; sourceEdition: string; temperatureC: string | null; scope: "published-nominal-input-reference-not-measured-product" };
type RawPreparationYieldClaim = ClaimBase & { kind: "raw-preparation-yield-reference"; recordRows: { fdcId: number; foodRowSha256: string }[]; measurementKind: "raw-prepared-mass-fraction"; unit: "g/g"; preparedPerPurchased: ExactAmount; preparation: "raw-sliced" | "raw-diced" | "raw-trimmed"; purchaseState: string; sourceEdition: string; scope: "published-nominal-raw-preparation-reference-not-measured-product" };
type Claim = PackageClaim | CategoryClaim | DensityClaim | RawPreparationYieldClaim;
type Review = { id: string; region: Region; seriesId: string; product: string; period: string; category: CategoryClaim; reviewEffectiveFrom: string; usableThrough: string; point: BenchmarkOutcome };
type PantryBinding = { id: string; ingredientId: string; preparedState: string; baseUnit: BaseUnit; skuId: string; formDigest: string; sourceSha256: string };
type Family = { id: string; exactForm: { id: string; name: string; state: string; unit: BaseUnit }; ingredientSignature: string; recordIds: number[]; selectedFoods: { fdcId: number; description: string; foodRowSha256: string }[]; sourceFlags: string[]; purchase: { skuId: string; state: string; unit: BaseUnit; category: string; perishable: boolean }; quantityBasis: string; package: PackageClaim; reviews: Review[]; factor: ExactAmount; formDigest: string; quantityProof: string; proof: string; recipeReferences: number; purchaseGroupId?: string; canonicalPantryIngredientId?: string; canonicalBindingId?: string; priceFamilyId?: string; priceFlags?: string[]; groupSynthetic?: boolean; densityEvidence?: DensityClaim; yieldEvidence?: RawPreparationYieldClaim; quantityFlags?: string[]; quantitySynthetic?: boolean; quantityReviewEffectiveFrom?: string };
type PurchaseGroup = { id: string; memberFamilyIds: string[]; memberForms: { familyId: string; ingredientSignature: string; exactForm: Family["exactForm"]; recordIds: number[] }[]; anchorFamilyId: string; sourceUrl: string; sourceSha256: string; reviewedOn: string; evidenceLevel: ClaimBase["evidenceLevel"]; description: string; scope: "same-food-input-grams-no-physical-transition" | "same-food-input-grams-published-raw-preparation" | "same-food-input-grams-large-raw-egg-count-reference" };
type Summary = { readonly id: string; readonly ingredientId: string; readonly preparedState: string; readonly recipeReferences: number; readonly reviewedRegions: readonly Region[]; readonly quantityBasis: string; readonly sourceFlags: readonly string[]; readonly sourceTruthEstablished: false };
export type ReviewedPackQuantityOutcome =
  | { readonly outcome: "prepared"; readonly correspondences: readonly PurchaseCorrespondence[]; readonly pantryPurchaseBindings: readonly PantryBinding[]; readonly sourceFlags: readonly string[]; readonly regionalPricesIncluded: false; readonly sourceAdoptionGranted: false; readonly completeRegistryEstablished: false; readonly pantryPackageQuantityEstablished: false; readonly cookedYieldEstablished: false; readonly sourceTruthEstablished: false }
  | { readonly outcome: "held"; readonly code: "reviewed_pack_family_unavailable" }
  | { readonly outcome: "error"; readonly code: "invalid_reviewed_pack_query" };
export type ReviewedPackPlanningOutcome =
  | { readonly outcome: "prepared"; readonly correspondences: readonly PurchaseCorrespondence[]; readonly pantryPurchaseBindings: readonly PantryBinding[]; readonly sourceFlags: readonly string[]; readonly regionalPackFacts: readonly RegionalPackFact[]; readonly exactPublicBenchmark: Benchmark; readonly sourceAdoptionGranted: false; readonly completeRegistryEstablished: false; readonly pantryPackageQuantityEstablished: false; readonly cookedYieldEstablished: false; readonly sourceTruthEstablished: false }
  | { readonly outcome: "held"; readonly code: "reviewed_pack_family_unavailable" | "regional_pack_review_needed" | "regional_pack_review_not_current" | "regional_pack_review_ambiguous" | "reviewed_public_price_unavailable" | "reviewed_pack_price_capacity"; readonly regionalPackFacts: readonly [] }
  | { readonly outcome: "error"; readonly code: "invalid_reviewed_pack_query" };
type PreparedPlanning = Extract<ReviewedPackPlanningOutcome, { outcome: "prepared" }>;
export type ReviewedPackBatchPlanningOutcome = Omit<PreparedPlanning, "exactPublicBenchmark"> & { readonly exactPublicBenchmarks: readonly Benchmark[] } | Exclude<ReviewedPackPlanningOutcome, { outcome: "prepared" }>;
export type ReviewedPackRegistry = { readonly outcome: "ready"; readonly families: readonly Summary[]; readonly manifestSha256: string; readonly completeRegistryEstablished: false; readonly quantityForFamily: (query: unknown) => ReviewedPackQuantityOutcome; readonly forPlanning: (query: unknown) => ReviewedPackPlanningOutcome; readonly quantityForFamilies: (query: unknown) => ReviewedPackQuantityOutcome; readonly forFamilies: (query: unknown) => ReviewedPackBatchPlanningOutcome } | { readonly outcome: "error"; readonly code: "invalid_reviewed_pack_evidence" };
const ROLES = ["catalog", "matches", "records", "staples", "produce"] as const;
const REGIONS = ["Northeast", "Midwest", "South", "West"] as const;
const MAX = BigInt(Number.MAX_SAFE_INTEGER);
const typed = Object.getPrototypeOf(Uint8Array.prototype), buffer = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!, offset = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!, length = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
const seal = (value: unknown) => createHash("sha256").update(JSON.stringify(canonicalReferenceData(value))).digest("hex");
// Frame the complete tuple before hashing. Delimiter concatenation can alias
// accepted punctuation-containing family/review IDs across distinct foods.
const priceIdentity = (familyId: string, reviewId: string) => "wd-rpr-price-v1:" + seal(["wd-reviewed-pack-price-id-v1", familyId, reviewId]);
function invalid(): never { throw Error("Invalid reviewed pack evidence"); }
function record(value: unknown, required: readonly string[], optional: readonly string[] = []): Data {
  if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) invalid();
  const fields = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(fields);
  if (required.some(key => !Object.hasOwn(fields, key)) || keys.some(key => typeof key !== "string" || ![...required, ...optional].includes(key))) invalid();
  const result: Data = {};
  for (const key of keys as string[]) { const field = fields[key]!; if (!("value" in field) || !field.enumerable) invalid(); result[key] = field.value; }
  return result;
}
function object(value: unknown): Data { if (!value || typeof value !== "object" || Array.isArray(value)) invalid(); return value as Data; }
function text(value: unknown, max = 500): string { if (typeof value !== "string" || !value.trim() || value.length > max) invalid(); return value; }
function id(value: unknown): string { const result = text(value, 120); if (result !== result.trim()) invalid(); return result; }
function sha(value: unknown): string { const result = text(value); if (!/^[a-f0-9]{64}$/.test(result)) invalid(); return result; }
function integer(value: unknown, minimum = 0, maximum = Number.MAX_SAFE_INTEGER): number { if (!Number.isSafeInteger(value) || (value as number) < minimum || (value as number) > maximum) invalid(); return value as number; }
function list(value: unknown, maximum: number): unknown[] { if (!Array.isArray(value) || value.length > maximum) invalid(); return value; }
function unit(value: unknown): BaseUnit { if (value !== "g" && value !== "ml" && value !== "each") invalid(); return value; }
function region(value: unknown): Region { if (!REGIONS.includes(value as Region)) invalid(); return value as Region; }
function date(value: unknown): string { const d = text(value); if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d + "T00:00:00Z")) || new Date(d + "T00:00:00Z").toISOString().slice(0, 10) !== d) invalid(); return d; }
function month(value: unknown): string { const d = text(value); if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(d)) invalid(); return d; }
function exact(value: unknown, positive = true): Rational {
  const row = record(value, ["numerator", "denominator"]);
  for (const key of ["numerator", "denominator"]) if (typeof row[key] !== "string" || (row[key] as string).length > 120 || !/^(0|[1-9]\d*)$/.test(row[key] as string)) invalid();
  const result = rational(BigInt(row.numerator as string), BigInt(row.denominator as string)); if (positive && result.n === BigInt(0)) invalid(); return result;
}
function freeze<T>(value: T): T { if (value && typeof value === "object" && !Object.isFrozen(value)) { Object.values(value).forEach(freeze); Object.freeze(value); } return value; }
function sealedBytes(value: unknown, expected: string, maximum: number): Uint8Array {
  const size = length.call(value) as number; if (size > maximum) invalid();
  const copy = new Uint8Array(new Uint8Array(buffer.call(value), offset.call(value), size));
  if (createHash("sha256").update(copy).digest("hex") !== expected) invalid(); return copy;
}
function json(value: Uint8Array): Data { return object(parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(value))); }
function form(value: unknown): Family["exactForm"] { const row = record(value, ["id", "name", "state", "unit"]); return { id: id(row.id), name: text(row.name), state: text(row.state), unit: unit(row.unit) }; }
const formKey = (f: Family["exactForm"]) => JSON.stringify([f.id, f.name, f.state, f.unit]);
function claim(value: unknown): Claim {
  const d = object(value), shared = ["id", "kind", "ingredientSignature", "sourceUrl", "sourceSha256", "reviewedOn", "evidenceLevel", "description"];
  const row = record(d, [...shared, ...(d.kind === "package-reference" ? ["purchaseState", "unit", "nominalQuantity"] : d.kind === "density-reference" ? ["recordRows", "measurementKind", "unit", "densityGPerMl", "sourceEdition", "temperatureC", "scope"] : d.kind === "raw-preparation-yield-reference" ? ["recordRows", "measurementKind", "unit", "preparedPerPurchased", "preparation", "purchaseState", "sourceEdition", "scope"] : ["product", "priceScope"])]);
  const sourceUrl = text(row.sourceUrl, 1000), url = new URL(sourceUrl);
  if (url.protocol !== "https:" || url.username || url.password || url.hash || !["primary-source-native-projection", "primary-source-web-extract", "synthetic-test-only"].includes(String(row.evidenceLevel))) invalid();
  const common: ClaimBase = { id: id(row.id), ingredientSignature: sha(row.ingredientSignature), sourceUrl, sourceSha256: sha(row.sourceSha256), reviewedOn: date(row.reviewedOn), evidenceLevel: row.evidenceLevel as ClaimBase["evidenceLevel"], description: text(row.description, 2000) };
  if (row.kind === "package-reference") return { ...common, kind: "package-reference", purchaseState: text(row.purchaseState), unit: unit(row.unit), nominalQuantity: receipt(exact(row.nominalQuantity)) };
  if (row.kind === "density-reference") {
    const recordRows = list(row.recordRows, 100).map(value => { const r = record(value, ["fdcId", "foodRowSha256"]); return { fdcId: integer(r.fdcId, 1), foodRowSha256: sha(r.foodRowSha256) }; }).sort((a, b) => a.fdcId - b.fdcId);
    if (!recordRows.length || new Set(recordRows.map(r => r.fdcId)).size !== recordRows.length || row.measurementKind !== "mass-density" || row.unit !== "g/ml" || row.scope !== "published-nominal-input-reference-not-measured-product" || url.search || row.temperatureC !== null && (typeof row.temperatureC !== "string" || row.temperatureC.length > 30 || !/^-?\d+(?:\.\d+)?$/.test(row.temperatureC))) invalid();
    return { ...common, kind: "density-reference", recordRows, measurementKind: "mass-density", unit: "g/ml", densityGPerMl: receipt(exact(row.densityGPerMl)), sourceEdition: text(row.sourceEdition, 200), temperatureC: row.temperatureC as string | null, scope: "published-nominal-input-reference-not-measured-product" };
  }
  if (row.kind === "raw-preparation-yield-reference") {
    const recordRows = list(row.recordRows, 100).map(value => { const r = record(value, ["fdcId", "foodRowSha256"]); return { fdcId: integer(r.fdcId, 1), foodRowSha256: sha(r.foodRowSha256) }; }).sort((a, b) => a.fdcId - b.fdcId);
    if (!recordRows.length || new Set(recordRows.map(r => r.fdcId)).size !== recordRows.length || row.measurementKind !== "raw-prepared-mass-fraction" || row.unit !== "g/g" || !["raw-sliced", "raw-diced", "raw-trimmed"].includes(String(row.preparation)) || row.scope !== "published-nominal-raw-preparation-reference-not-measured-product" || url.search) invalid();
    const point = readNominalPreparationYieldReference({ kind: NOMINAL_PREPARATION_YIELD_KIND, preparedPerPurchased: row.preparedPerPurchased, sourceSha256: common.sourceSha256, reviewEffectiveFrom: common.reviewedOn });
    return { ...common, kind: "raw-preparation-yield-reference", recordRows, measurementKind: "raw-prepared-mass-fraction", unit: "g/g", preparedPerPurchased: point.preparedPerPurchased, preparation: row.preparation as RawPreparationYieldClaim["preparation"], purchaseState: text(row.purchaseState), sourceEdition: text(row.sourceEdition, 200), scope: "published-nominal-raw-preparation-reference-not-measured-product" };
  }
  if (row.kind !== "price-category-reference" || !["conditional-category-unit-model", "source-defined-dozen-pack"].includes(String(row.priceScope))) invalid();
  return { ...common, kind: "price-category-reference", product: text(row.product), priceScope: row.priceScope as CategoryClaim["priceScope"] };
}
function purchaseGroup(value: unknown): PurchaseGroup {
  const row = record(value, ["id", "memberFamilyIds", "memberForms", "anchorFamilyId", "sourceUrl", "sourceSha256", "reviewedOn", "evidenceLevel", "description", "scope"]), memberFamilyIds = list(row.memberFamilyIds, 16).map(id).sort(), anchorFamilyId = id(row.anchorFamilyId), sourceUrl = text(row.sourceUrl, 1000), url = new URL(sourceUrl);
  if (memberFamilyIds.length < 2 || new Set(memberFamilyIds).size !== memberFamilyIds.length || !memberFamilyIds.includes(anchorFamilyId) || url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !["same-food-input-grams-no-physical-transition", "same-food-input-grams-published-raw-preparation", "same-food-input-grams-large-raw-egg-count-reference"].includes(String(row.scope)) || !["primary-source-native-projection", "primary-source-web-extract", "synthetic-test-only"].includes(String(row.evidenceLevel))) invalid();
  const memberForms = list(row.memberForms, 16).map(value => { const m = record(value, ["familyId", "ingredientSignature", "exactForm", "recordIds"]), recordIds = list(m.recordIds, 100).map(x => integer(x, 1)).sort((a, b) => a - b); if (!recordIds.length || new Set(recordIds).size !== recordIds.length) invalid(); return { familyId: id(m.familyId), ingredientSignature: sha(m.ingredientSignature), exactForm: form(m.exactForm), recordIds }; }).sort((a, b) => a.familyId.localeCompare(b.familyId));
  if (seal(memberForms.map(m => m.familyId)) !== seal(memberFamilyIds)) invalid();
  return { id: id(row.id), memberFamilyIds, memberForms, anchorFamilyId, sourceUrl, sourceSha256: sha(row.sourceSha256), reviewedOn: date(row.reviewedOn), evidenceLevel: row.evidenceLevel as ClaimBase["evidenceLevel"], description: text(row.description, 2000), scope: row.scope as PurchaseGroup["scope"] };
}
function uniqueRows<T extends { id: string }>(values: readonly T[]): T[] {
  const rows = new Map<string, T>(); for (const value of values) { const prior = rows.get(value.id); if (prior && seal(prior) !== seal(value)) invalid(); rows.set(value.id, value); } return [...rows.values()].sort((a, b) => a.id.localeCompare(b.id));
}

export function createReviewedPublicPackRegistry(sourceValue: unknown, manifestValue: unknown, trustedValue: unknown): ReviewedPackRegistry {
  const families = new Map<string, Family>(); let manifestSha256: string;
  try {
    const trusted = record(copyReferenceData(trustedValue), [...ROLES, "manifestSha256"]), sources = record(sourceValue, ROLES);
    const pinRows = Object.fromEntries(ROLES.map(role => [role, record(trusted[role], ["sha256", ...(role === "catalog" ? ["recordCount"] : role === "staples" || role === "produce" ? ["observations"] : [])]) ]));
    const bytes = Object.fromEntries(ROLES.map(role => [role, sealedBytes(sources[role], sha(pinRows[role]!.sha256), role === "catalog" ? 64 * 1024 * 1024 : 8 * 1024 * 1024)]));
    manifestSha256 = sha(trusted.manifestSha256);
    const rawManifest = json(sealedBytes(manifestValue, manifestSha256, 1024 * 1024)), v5 = rawManifest.schema === "wd-reviewed-public-pack-manifest-v5", v4 = v5 || rawManifest.schema === "wd-reviewed-public-pack-manifest-v4", v3 = v4 || rawManifest.schema === "wd-reviewed-public-pack-manifest-v3", grouped = v3 || rawManifest.schema === "wd-reviewed-public-pack-manifest-v2";
    const manifest = record(rawManifest, ["schema", "catalogSha256", "claims", "families", ...(grouped ? ["purchaseGroups"] : [])]);
    const sourceCatalogSha256 = sha(pinRows.catalog!.sha256);
    if ((!grouped && manifest.schema !== "wd-reviewed-public-pack-manifest-v1") || manifest.catalogSha256 !== sourceCatalogSha256) invalid();
    const catalog = createRevisedCatalogReader({ sha256: sourceCatalogSha256, recordCount: integer(pinRows.catalog!.recordCount, 1, 2000) })(bytes.catalog);
    if (catalog.outcome !== "success") invalid();
    const countByForm = new Map<string, number>();
    for (const recipe of catalog.recipes) for (const i of recipe.recipe.ingredients) { const key = formKey({ id: i.id, name: i.name, state: i.state, unit: i.unit }); countByForm.set(key, (countByForm.get(key) ?? 0) + 1); }
    const matchData = object(json(bytes.matches!).matches), foodRecords = json(bytes.records!);
    const prices = createPublicAveragePriceReader(bytes.staples, bytes.produce, { staples: { sha256: sha(pinRows.staples!.sha256), observations: integer(pinRows.staples!.observations, 0, 10000) }, produce: { sha256: sha(pinRows.produce!.sha256), observations: integer(pinRows.produce!.observations, 0, 10000) } }); if (prices.outcome !== "ready") invalid();
    const claims = new Map<string, Claim>(); for (const value of list(manifest.claims, 2000)) { const c = freeze(claim(value)); if (claims.has(c.id) || c.kind === "density-reference" && !v3 || c.kind === "raw-preparation-yield-reference" && !v4) invalid(); claims.set(c.id, c); }
    const groups = new Map<string, PurchaseGroup>(), membership = new Map<string, string>();
    if (grouped) for (const value of list(manifest.purchaseGroups, 256)) { const group = purchaseGroup(value); if (groups.has(group.id) || group.scope === "same-food-input-grams-large-raw-egg-count-reference" && !v5 || group.scope === "same-food-input-grams-published-raw-preparation" && !v4) invalid(); groups.set(group.id, group); for (const familyId of group.memberFamilyIds) { if (membership.has(familyId)) invalid(); membership.set(familyId, group.id); } }
    const usedSkus = new Map<string, string | null>();
    for (const value of list(manifest.families, 512)) {
      const row = record(value, ["id", "ingredientSignature", "exactForm", "recordIds", "purchase", "quantityBasis", "packageClaimId", "priceReviews"]), familyId = id(row.id), ingredientSignature = sha(row.ingredientSignature), exactForm = form(row.exactForm), matched = object(matchData[ingredientSignature]);
      const ids = list(row.recordIds, 100).map(x => integer(x, 1)).sort((a, b) => a - b), selected = list(matched.record_ids, 100).map(x => integer(x, 1)).sort((a, b) => a - b);
      const sourceFlags = list(matched.flags, 50).map(x => text(x, 500)), sourceHolds = list(matched.holds, 50).map(x => text(x, 500));
      // A curator's package/category claim cannot erase an upstream hold.
      // Retain every accepted warning verbatim, including on quantity-only use.
      if (sourceHolds.length) invalid();
      if (!ids.length || new Set(ids).size !== ids.length || seal(ids) !== seal(selected) || matched.status !== "conditional-reference" || formKey(form(matched.exact_form)) !== formKey(exactForm) || !countByForm.has(formKey(exactForm))) invalid();
      const selectedFoods = ids.map(fdcId => { const r = object(foodRecords[String(fdcId)]); if (r.fdc_id !== fdcId) invalid(); return { fdcId, description: text(r.description), foodRowSha256: sha(r.raw_food_row_sha256) }; });
      const p = record(row.purchase, ["skuId", "state", "unit", "category", "perishable"]); if (typeof p.perishable !== "boolean") invalid();
      const purchase = { skuId: id(p.skuId), state: text(p.state), unit: unit(p.unit), category: id(p.category), perishable: p.perishable };
      const groupId = membership.get(familyId);
      if (families.has(familyId) || usedSkus.has(purchase.skuId) && (!groupId || usedSkus.get(purchase.skuId) !== groupId)) invalid(); usedSkus.set(purchase.skuId, groupId ?? null);
      const packageClaim = claims.get(id(row.packageClaimId));
      if (!packageClaim || packageClaim.kind !== "package-reference" || packageClaim.ingredientSignature !== ingredientSignature || packageClaim.unit !== purchase.unit || packageClaim.purchaseState !== purchase.state) invalid();
      const rawBasis = object(row.quantityBasis), eggCountBasis = rawBasis.kind === "reviewed-input-state-equivalence-large-raw-egg", groupBasis = ["reviewed-input-state-equivalence", "reviewed-input-state-equivalence-density", "reviewed-input-state-equivalence-raw-yield", "reviewed-input-state-equivalence-large-raw-egg"].includes(String(rawBasis.kind)), densityBasis = ["reviewed-mass-volume-reference", "reviewed-input-state-equivalence-density"].includes(String(rawBasis.kind)), yieldBasis = ["reviewed-raw-preparation-yield-reference", "reviewed-input-state-equivalence-raw-yield"].includes(String(rawBasis.kind)), basis = record(rawBasis, ["kind", ...(groupBasis ? ["groupId"] : []), ...(densityBasis ? ["densityClaimId"] : []), ...(yieldBasis ? ["yieldClaimId"] : [])]); let factor: ExactAmount; let densityEvidence: DensityClaim | undefined; let yieldEvidence: RawPreparationYieldClaim | undefined;
      if (groupId && (!groupBasis || basis.groupId !== groupId)) invalid();
      if (basis.kind === "same-state-identity") { if (purchase.state !== exactForm.state || purchase.unit !== exactForm.unit) invalid(); factor = receipt(rational(BigInt(1))); }
      else if (basis.kind === "reviewed-input-state-equivalence") { if (!grouped || !groupId || basis.groupId !== groupId || exactForm.unit !== "g" || purchase.unit !== "g") invalid(); factor = receipt(rational(BigInt(1))); }
      else if (densityBasis) {
        if (!v3 || exactForm.unit !== "g" || purchase.unit !== "ml" || (groupBasis ? !groupId || basis.groupId !== groupId : groupId !== undefined || purchase.state !== exactForm.state)) invalid();
        const density = claims.get(id(basis.densityClaimId));
        if (!density || density.kind !== "density-reference" || density.ingredientSignature !== ingredientSignature || seal(density.recordRows) !== seal(selectedFoods.map(({ fdcId, foodRowSha256 }) => ({ fdcId, foodRowSha256 })))) invalid();
        densityEvidence = density; factor = receipt(nominalDensityFactor({ kind: NOMINAL_DENSITY_KIND, densityGPerMl: density.densityGPerMl, sourceSha256: density.sourceSha256, reviewEffectiveFrom: density.reviewedOn }));
      }
      else if (yieldBasis) {
        if (!v4 || exactForm.unit !== "g" || purchase.unit !== "g" || (groupBasis ? !groupId || basis.groupId !== groupId : groupId !== undefined)) invalid();
        const point = claims.get(id(basis.yieldClaimId));
        if (!point || point.kind !== "raw-preparation-yield-reference" || point.ingredientSignature !== ingredientSignature || point.purchaseState !== purchase.state || seal(point.recordRows) !== seal(selectedFoods.map(({ fdcId, foodRowSha256 }) => ({ fdcId, foodRowSha256 })))) invalid();
        yieldEvidence = point; factor = receipt(nominalPreparationYieldFactor({ kind: NOMINAL_PREPARATION_YIELD_KIND, preparedPerPurchased: point.preparedPerPurchased, sourceSha256: point.sourceSha256, reviewEffectiveFrom: point.reviewedOn }));
      }
      else if (basis.kind === "large-raw-egg-reference" || eggCountBasis) {
        // Deliberately narrow, previously inspected count bridge. Other portion,
        // size, shell/cooked/drained/density transitions require a new review.
        const originalWholeEgg = exactForm.id === "eggs" && exactForm.name === "Whole eggs" && exactForm.state === "raw, shell removed; 100 g is approximately two large eggs";
        const reviewedBeatenEgg = eggCountBasis && exactForm.id === "protein_eggs" && exactForm.name === "whole egg" && exactForm.state === "raw, shell removed, beaten";
        if (eggCountBasis && (!v5 || !groupId || basis.groupId !== groupId)) invalid();
        if ((!originalWholeEgg && !reviewedBeatenEgg) || exactForm.unit !== "g" || seal(ids) !== seal([171287]) || purchase.unit !== "each" || purchase.state !== "raw, whole Grade A Large shell eggs; counted intact eggs") invalid();
        const food = object(foodRecords["171287"]), portions = list(food.portions, 1000), portion = portions.map(object).find(x => x.id === "88374");
        if (food.description !== "Egg, whole, raw, fresh" || food.data_type !== "sr_legacy_food" || food.raw_food_row_sha256 !== "d47a20a91ce1a8acd50fa8f31bdc8bd1c074b45dfd29fe37e59a80517ad44fc8" || !portion || portion.fdc_id !== "171287" || portion.modifier !== "large" || portion.raw_row_sha256 !== "bc4d7044701e76506052b531c4886c21b2109449461f8f0bd712f5254b0346db" || seal(receipt(decimal(portion.amount))) !== seal(receipt(rational(BigInt(1)))) || seal(receipt(decimal(portion.gram_weight))) !== seal(receipt(rational(BigInt(50))))) invalid();
        factor = receipt(rational(BigInt(1), BigInt(50)));
      } else invalid();
      const reviews: Review[] = [], reviewIds = new Set<string>(), referencedClaims = new Map<string, Claim>([[packageClaim.id, packageClaim]]);
      if (densityEvidence) referencedClaims.set(densityEvidence.id, densityEvidence);
      if (yieldEvidence) referencedClaims.set(yieldEvidence.id, yieldEvidence);
      for (const priceValue of list(row.priceReviews, 20)) {
        const r = record(priceValue, ["id", "region", "seriesId", "product", "period", "categoryClaimId", "reviewEffectiveFrom", "usableThrough"]), reviewId = id(r.id), selectedRegion = region(r.region), product = text(r.product), period = month(r.period), from = date(r.reviewEffectiveFrom), through = date(r.usableThrough), category = claims.get(id(r.categoryClaimId));
        if (reviewIds.has(reviewId) || from > through || period > from.slice(0, 7) || from < packageClaim.reviewedOn || densityEvidence && from < densityEvidence.reviewedOn || yieldEvidence && from < yieldEvidence.reviewedOn || !category || category.kind !== "price-category-reference" || category.ingredientSignature !== ingredientSignature || category.product !== product || from < category.reviewedOn) invalid(); reviewIds.add(reviewId); referencedClaims.set(category.id, category);
        const seriesId = id(r.seriesId), point = prices.benchmark({ seriesId, region: selectedRegion, product, period, minimumPeriod: period, asOfDate: from, quantity: packageClaim.nominalQuantity, unit: purchase.unit });
        if (point.outcome === "error") invalid();
        if (point.outcome === "benchmark") {
          if (from < point.sourceCapturedAsOf) invalid();
          if (category.priceScope === "source-defined-dozen-pack" && (!/^APU(?:0100|0200|0300|0400)708111$/.test(seriesId) || product !== "Eggs, grade A, large" || point.priceUnit !== "dozen" || purchase.unit !== "each" || seal(packageClaim.nominalQuantity) !== seal(receipt(rational(BigInt(12)))) || seal(receipt(decimal(point.priceUnitAmount))) !== seal(receipt(rational(BigInt(1)))))) invalid();
        }
        reviews.push({ id: reviewId, region: selectedRegion, seriesId, product, period, category, reviewEffectiveFrom: from, usableThrough: through, point });
      }
      const quantityFlags = densityEvidence ? [NOMINAL_DENSITY_FLAG, "nominal-density-point-not-physical-error-bound"] : yieldEvidence ? [NOMINAL_PREPARATION_YIELD_FLAG, "nominal-preparation-yield-point-not-physical-error-bound"] : eggCountBasis ? [NOMINAL_EGG_FLAG] : [];
      if (new Set([...sourceFlags, ...quantityFlags]).size > 50) invalid();
      const formDigest = seal({ ingredientId: exactForm.id, preparedState: purchase.state, baseUnit: purchase.unit }), normalizedFamily = { id: familyId, exactForm, ingredientSignature, recordIds: ids, sourceFlags, purchase, quantityBasis: basis.kind as string, package: packageClaim, factor, selectedFoods, ...(eggCountBasis ? { quantityFlags } : {}), ...(densityEvidence ? { densityEvidence, quantityFlags, quantityReviewEffectiveFrom: [densityEvidence.reviewedOn, packageClaim.reviewedOn].sort().at(-1)!, quantitySynthetic: densityEvidence.evidenceLevel === "synthetic-test-only" } : {}), ...(yieldEvidence ? { yieldEvidence, quantityFlags, quantityReviewEffectiveFrom: [yieldEvidence.reviewedOn, packageClaim.reviewedOn].sort().at(-1)!, quantitySynthetic: yieldEvidence.evidenceLevel === "synthetic-test-only" } : {}) };
      const quantityProof = seal({ sourceCatalogSha256, matchBytesSha256: pinRows.matches!.sha256, recordsBytesSha256: pinRows.records!.sha256, family: normalizedFamily });
      const proof = seal({ quantityProof, claims: [...referencedClaims.values()].sort((a, b) => a.id.localeCompare(b.id)) });
      families.set(familyId, freeze({ ...normalizedFamily, reviews, formDigest, quantityProof, proof, recipeReferences: countByForm.get(formKey(exactForm))!, ...(groupId ? { purchaseGroupId: groupId } : {}) }));
    }
    for (const group of groups.values()) {
      if (families.has(group.id)) invalid();
      const members = group.memberFamilyIds.map(familyId => { const f = families.get(familyId); if (!f || f.purchaseGroupId !== group.id) invalid(); const declared = group.memberForms.find(m => m.familyId === familyId)!; if (declared.ingredientSignature !== f.ingredientSignature || formKey(declared.exactForm) !== formKey(f.exactForm) || seal(declared.recordIds) !== seal(f.recordIds)) invalid(); return f; });
      const anchor = members.find(f => f.id === group.anchorFamilyId)!;
      if (anchor.reviews.some(r => r.reviewEffectiveFrom < group.reviewedOn)) invalid();
      const packageBasis = (p: PackageClaim) => ({ sourceUrl: p.sourceUrl, sourceSha256: p.sourceSha256, evidenceLevel: p.evidenceLevel, purchaseState: p.purchaseState, unit: p.unit, nominalQuantity: p.nominalQuantity });
      const densityBasis = (d: DensityClaim | undefined) => { if (!d) return null; const { id, ingredientSignature, description, ...point } = d; void id; void ingredientSignature; void description; return point; };
      const yieldBasis = (d: RawPreparationYieldClaim | undefined) => { if (!d) return null; const { id, ingredientSignature, description, ...point } = d; void id; void ingredientSignature; void description; return point; };
      const massVolume = anchor.purchase.unit === "ml";
      const rawPreparation = !!anchor.yieldEvidence;
      const eggCount = anchor.quantityBasis === "reviewed-input-state-equivalence-large-raw-egg";
      if (massVolume && (!v3 || !anchor.densityEvidence)) invalid();
      if (eggCount ? !v5 || group.scope !== "same-food-input-grams-large-raw-egg-count-reference" || members.length !== 2 || new Set(members.map(f => f.exactForm.id)).size !== 2 : rawPreparation ? !v4 || group.scope !== "same-food-input-grams-published-raw-preparation" : group.scope !== "same-food-input-grams-no-physical-transition") invalid();
      for (const f of members) {
        if (seal(f.purchase) !== seal(anchor.purchase) || seal(f.recordIds) !== seal(anchor.recordIds) || seal(f.selectedFoods) !== seal(anchor.selectedFoods) || seal(packageBasis(f.package)) !== seal(packageBasis(anchor.package)) || group.reviewedOn < f.package.reviewedOn || f.id !== anchor.id && f.reviews.length || f.exactForm.unit !== "g") invalid();
        if (eggCount) {
          if (f.quantityBasis !== "reviewed-input-state-equivalence-large-raw-egg" || f.purchase.unit !== "each" || !!f.densityEvidence || !!f.yieldEvidence || seal(f.factor) !== seal(receipt(rational(BigInt(1), BigInt(50))))) invalid();
        } else if (massVolume) {
          if (f.quantityBasis !== "reviewed-input-state-equivalence-density" || !f.densityEvidence || !!f.yieldEvidence || group.reviewedOn < f.densityEvidence.reviewedOn || seal(densityBasis(f.densityEvidence)) !== seal(densityBasis(anchor.densityEvidence)) || seal(f.factor) !== seal(anchor.factor)) invalid();
        } else if (rawPreparation) {
          if (f.quantityBasis !== "reviewed-input-state-equivalence-raw-yield" || !f.yieldEvidence || !!f.densityEvidence || f.purchase.unit !== "g" || group.reviewedOn < f.yieldEvidence.reviewedOn || seal(yieldBasis(f.yieldEvidence)) !== seal(yieldBasis(anchor.yieldEvidence)) || seal(f.factor) !== seal(anchor.factor)) invalid();
        } else if (f.purchase.unit !== "g" || !!f.densityEvidence || !!f.yieldEvidence) invalid();
      }
      const priceFlags = [...new Set(members.flatMap(f => [...f.sourceFlags, ...(f.quantityFlags ?? [])]))].sort(); if (priceFlags.length > 50) invalid();
      const quantities = members.map(f => { const { reviews, quantityProof, proof, formDigest, ...quantity } = f; void reviews; void quantityProof; void proof; void formDigest; return quantity; });
      const quantityProof = seal({ sourceCatalogSha256, matchBytesSha256: pinRows.matches!.sha256, recordsBytesSha256: pinRows.records!.sha256, group, members: quantities }), proof = seal({ quantityProof, anchorPriceProof: anchor.proof });
      for (const f of members) families.set(f.id, freeze({ ...f, quantityProof, proof, reviews: anchor.reviews, package: anchor.package, formDigest: anchor.formDigest, canonicalPantryIngredientId: anchor.exactForm.id, canonicalBindingId: group.id, priceFamilyId: group.id, priceFlags, groupSynthetic: group.evidenceLevel === "synthetic-test-only", ...(f.densityEvidence || f.yieldEvidence || eggCount ? { quantityReviewEffectiveFrom: [f.quantityReviewEffectiveFrom ?? f.package.reviewedOn, group.reviewedOn].sort().at(-1)! } : {}) }));
    }
  } catch { return { outcome: "error", code: "invalid_reviewed_pack_evidence" }; }
  const summaries: Summary[] = [...families.values()].sort((a, b) => a.id.localeCompare(b.id)).map(f => ({ id: f.id, ingredientId: f.exactForm.id, preparedState: f.exactForm.state, recipeReferences: f.recipeReferences, reviewedRegions: [...new Set(f.reviews.map(r => r.region))].sort(), quantityBasis: f.quantityBasis, sourceFlags: f.sourceFlags, sourceTruthEstablished: false }));
  function quantityData(family: Family) {
    const p = family.purchase, sourceSha256 = family.quantityProof;
    const correspondenceId = family.purchaseGroupId ? family.purchaseGroupId + ":quantity:" + seal([family.exactForm.id, family.exactForm.state, family.exactForm.unit]) : family.id + ":quantity";
    const correspondence: PurchaseCorrespondence = { id: correspondenceId, ingredientId: family.exactForm.id, preparedState: family.exactForm.state, consumedUnit: family.exactForm.unit, skuId: p.skuId, purchaseState: p.state, purchaseUnit: p.unit, formDigest: family.formDigest, category: p.category, perishable: p.perishable, factor: { min: family.factor, max: family.factor }, sourceSha256, ...(family.densityEvidence ? { nominalDensityReference: { kind: NOMINAL_DENSITY_KIND, densityGPerMl: family.densityEvidence.densityGPerMl, sourceSha256, reviewEffectiveFrom: family.quantityReviewEffectiveFrom! } } : {}), ...(family.yieldEvidence ? { nominalPreparationYieldReference: { kind: NOMINAL_PREPARATION_YIELD_KIND, preparedPerPurchased: family.yieldEvidence.preparedPerPurchased, sourceSha256, reviewEffectiveFrom: family.quantityReviewEffectiveFrom! } } : {}), ...(family.quantityBasis === "reviewed-input-state-equivalence-large-raw-egg" ? { nominalEggReference: { kind: NOMINAL_EGG_KIND, edibleGPerLargeEgg: receipt(rational(BigInt(50))), sourceSha256, reviewEffectiveFrom: family.quantityReviewEffectiveFrom! } } : {}) };
    const binding: PantryBinding = { id: (family.canonicalBindingId ?? family.id) + ":owned", ingredientId: family.canonicalPantryIngredientId ?? family.exactForm.id, preparedState: p.state, baseUnit: p.unit, skuId: p.skuId, formDigest: family.formDigest, sourceSha256 };
    return { correspondences: [correspondence], pantryPurchaseBindings: [binding], sourceFlags: family.quantityFlags ? [...family.sourceFlags, ...family.quantityFlags] : family.sourceFlags };
  }
  function quantityForFamily(queryValue: unknown): ReviewedPackQuantityOutcome {
    try {
      const q = record(copyReferenceData(queryValue), ["familyId"]), family = families.get(id(q.familyId));
      if (!family) return { outcome: "held", code: "reviewed_pack_family_unavailable" };
      // Known owned base amounts can cover demand without a price. Never infer
      // a half-bag quantity or fabricate a price to access this binding.
      return freeze({ outcome: "prepared", ...quantityData(family), regionalPricesIncluded: false, sourceAdoptionGranted: false, completeRegistryEstablished: false, pantryPackageQuantityEstablished: false, cookedYieldEstablished: false, sourceTruthEstablished: false });
    } catch { return { outcome: "error", code: "invalid_reviewed_pack_query" }; }
  }
  function forPlanning(queryValue: unknown): ReviewedPackPlanningOutcome {
    try {
      const q = record(copyReferenceData(queryValue), ["familyId", "region", "asOfDate"]), familyId = id(q.familyId), selectedRegion = region(q.region), asOfDate = date(q.asOfDate), family = families.get(familyId);
      const held = (code: Extract<ReviewedPackPlanningOutcome, { outcome: "held" }>["code"]): ReviewedPackPlanningOutcome => ({ outcome: "held", code, regionalPackFacts: [] });
      if (!family) return held("reviewed_pack_family_unavailable");
      const regional = family.reviews.filter(r => r.region === selectedRegion); if (!regional.length) return held("regional_pack_review_needed");
      const active = regional.filter(r => r.reviewEffectiveFrom <= asOfDate && r.usableThrough >= asOfDate); if (!active.length) return held("regional_pack_review_not_current"); if (active.length !== 1) return held("regional_pack_review_ambiguous");
      const review = active[0]!, point = review.point; if (point.outcome !== "benchmark") return held("reviewed_public_price_unavailable");
      const cents = multiply(exact(point.allocationUsd), rational(BigInt(100))), low = cents.n / cents.d, high = (cents.n + cents.d - BigInt(1)) / cents.d;
      if (low < BigInt(1) || high > MAX) return held("reviewed_pack_price_capacity");
      const sourceSha256 = seal({ familyProof: family.proof, review, point }), p = family.purchase, factId = priceIdentity(family.priceFamilyId ?? family.id, review.id);
      const flags = ["private-source-reference-not-product-adopted", "nominal-package-not-measured-or-owned-quantity", "integer-cent-enclosure-not-market-error-bound", "monthly-source-not-a-new-survey-or-release-date", "not-live-retailer-price-availability-or-checkout", "generic-source-reference-not-actual-brand-nutrition", review.category.priceScope === "conditional-category-unit-model" ? "reviewed-category-unit-model-not-exact-form-price" : "source-defined-dozen-pack-not-store-SKU-price", ...(family.densityEvidence ? [NOMINAL_DENSITY_FLAG, "nominal-density-point-not-physical-error-bound"] : family.yieldEvidence ? [NOMINAL_PREPARATION_YIELD_FLAG, "nominal-preparation-yield-point-not-physical-error-bound"] : family.quantityBasis === "same-state-identity" || family.quantityBasis === "reviewed-input-state-equivalence" ? [p.unit === "ml" ? "same-state-input-volume-not-cooking-yield" : "same-state-input-mass-not-cooking-yield"] : ["Large-egg-edible50g-reference-not-actual-shell-or-individual-mass"]), ...(family.purchaseGroupId ? ["reviewed-reference-wording-equivalence-not-actual-product-validation"] : []), ...(family.priceFlags ?? family.sourceFlags)];
      const synthetic = family.groupSynthetic === true || family.quantitySynthetic === true || family.package.evidenceLevel === "synthetic-test-only" || review.category.evidenceLevel === "synthetic-test-only";
      const fact: RegionalPackFact = { id: factId, skuId: p.skuId, unit: p.unit, formDigest: family.formDigest, region: selectedRegion, packQuantity: family.package.nominalQuantity, packPriceCents: { min: Number(low), max: Number(high) }, currency: "USD", observedOn: null, monthlyPriceBasis: { observationPeriod: review.period, publishedOn: null, knownAvailableBy: point.sourceCapturedAsOf, reviewEffectiveFrom: review.reviewEffectiveFrom }, usableThrough: review.usableThrough, sourceSha256, basis: synthetic ? "synthetic-test-only" : review.category.priceScope === "source-defined-dozen-pack" ? "observed-regional-average" : "modeled-regional-average", flags };
      return freeze({ outcome: "prepared", ...quantityData(family), regionalPackFacts: [fact], exactPublicBenchmark: point, sourceAdoptionGranted: false, completeRegistryEstablished: false, pantryPackageQuantityEstablished: false, cookedYieldEstablished: false, sourceTruthEstablished: false });
    } catch { return { outcome: "error", code: "invalid_reviewed_pack_query" }; }
  }
  function requestedFamilies(value: unknown): string[] { const ids = list(value, 512).map(id).sort(); if (!ids.length || new Set(ids).size !== ids.length) invalid(); return ids; }
  function quantityForFamilies(value: unknown): ReviewedPackQuantityOutcome {
    try {
      const q = record(copyReferenceData(value), ["familyIds"]), prepared: Extract<ReviewedPackQuantityOutcome, { outcome: "prepared" }>[] = [];
      for (const familyId of requestedFamilies(q.familyIds)) { const result = quantityForFamily({ familyId }); if (result.outcome !== "prepared") return result; prepared.push(result); }
      return freeze({ ...prepared[0]!, correspondences: uniqueRows(prepared.flatMap(p => p.correspondences)), pantryPurchaseBindings: uniqueRows(prepared.flatMap(p => p.pantryPurchaseBindings)), sourceFlags: [...new Set(prepared.flatMap(p => p.sourceFlags))].sort() });
    } catch { return { outcome: "error", code: "invalid_reviewed_pack_query" }; }
  }
  function forFamilies(value: unknown): ReviewedPackBatchPlanningOutcome {
    try {
      const q = record(copyReferenceData(value), ["familyIds", "region", "asOfDate"]), ids = requestedFamilies(q.familyIds), selectedRegion = region(q.region), asOfDate = date(q.asOfDate), prepared: PreparedPlanning[] = [];
      for (const familyId of ids) { const result = forPlanning({ familyId, region: selectedRegion, asOfDate }); if (result.outcome !== "prepared") return result; prepared.push(result); }
      const { exactPublicBenchmark, ...base } = prepared[0]!; void exactPublicBenchmark;
      const points = new Map(prepared.map(p => [seal(p.exactPublicBenchmark), p.exactPublicBenchmark]));
      return freeze({ ...base, correspondences: uniqueRows(prepared.flatMap(p => p.correspondences)), pantryPurchaseBindings: uniqueRows(prepared.flatMap(p => p.pantryPurchaseBindings)), regionalPackFacts: uniqueRows(prepared.flatMap(p => p.regionalPackFacts)), sourceFlags: [...new Set(prepared.flatMap(p => p.sourceFlags))].sort(), exactPublicBenchmarks: [...points].sort(([a], [b]) => a.localeCompare(b)).map(([, p]) => p) });
    } catch { return { outcome: "error", code: "invalid_reviewed_pack_query" }; }
  }
  return Object.freeze({ outcome: "ready", families: freeze(summaries), manifestSha256, completeRegistryEstablished: false, quantityForFamily, forPlanning, quantityForFamilies, forFamilies });
}
