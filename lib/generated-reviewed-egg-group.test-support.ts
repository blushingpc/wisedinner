// Synthetic protocol fixture only. Not source-food, market, owner or allergy acceptance.
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";
const SCOPE = "same-food-input-grams-large-raw-egg-count-reference";
const BASIS = "reviewed-input-state-equivalence-large-raw-egg";
const amount = (n: number | string, d: number | string = 1) => ({ numerator: String(n), denominator: String(d) });
const json = (v: unknown) => Buffer.from(JSON.stringify(v));
export function eggGroupFixture() {
  const forms = [{ id: "eggs", name: "Whole eggs", state: "raw, shell removed; 100 g is approximately two large eggs", unit: "g" }, { id: "protein_eggs", name: "whole egg", state: "raw, shell removed, beaten", unit: "g" }];
  const signatures = ["1".repeat(64), "2".repeat(64)], ids = ["whole-reference", "beaten-reference"];
  const rows = setup().rows.map((r, i) => {
    const recipe = { ...r.recipe, ingredients: [{ ...forms[i]!, quantity: "240" }], steps: [{ id: 1, instruction: "Synthetic raw-input protocol only.", allocations: [{ id: forms[i]!.id, quantity: "240", unit: "g" }] }] }, digest = sha(JSON.stringify(canonicalReferenceData(recipe)));
    return { ...r, recipe, recipe_sha256: digest, nutrition: { ...r.nutrition, source_refresh: { ...r.nutrition.source_refresh, exact_recipe_body_sha256: digest, recipe_sha256_unchanged: digest } } };
  });
  const matches = json({ matches: Object.fromEntries(forms.map((exact_form, i) => [signatures[i], { exact_form, status: "conditional-reference", record_ids: [171287], flags: ["synthetic-only"], holds: [] }])) });
  const records = json({ "171287": { fdc_id: 171287, description: "Egg, whole, raw, fresh", data_type: "sr_legacy_food", raw_food_row_sha256: "d47a20a91ce1a8acd50fa8f31bdc8bd1c074b45dfd29fe37e59a80517ad44fc8", portions: [{ id: "88374", fdc_id: "171287", modifier: "large", amount: "1.0", gram_weight: "50.0", raw_row_sha256: "bc4d7044701e76506052b531c4886c21b2109449461f8f0bd712f5254b0346db" }] } });
  const point = { series_id: "APU0300708111", area_code: "0300", item_code: "708111", region: "South", currency: "USD", source_kind: "bls-average-retail-price", product: "Eggs, grade A, large", period: "2026-09", unit: "dozen", unit_amount: "1", value: "2.368", source_ids: ["fictional-fixture"] };
  const snapshot = (observations: unknown[]) => json({ schema: "wisedinner-bls-average-price-v1", source_kind: "bls-average-retail-price", currency: "USD", as_of: "2026-10-14", status: "partial-observations", observations, sources: [{ id: "fictional-fixture", sha256: "3".repeat(64) }] });
  const sources = { catalog: Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n"), matches, records, staples: snapshot([point]), produce: snapshot([]) };
  const purchase = { skuId: "one-synthetic-carton", state: "raw, whole Grade A Large shell eggs; counted intact eggs", unit: "each", category: "eggs", perishable: true };
  const claims = forms.flatMap((_form, i) => {
    const common = { ingredientSignature: signatures[i]!, sourceUrl: "https://example.invalid/synthetic-egg", sourceSha256: "4".repeat(64), reviewedOn: "2026-10-19", evidenceLevel: "synthetic-test-only", description: "Synthetic protocol fixture, not market or food truth." };
    return [{ ...common, id: ids[i] + "-package", kind: "package-reference", purchaseState: purchase.state, unit: "each", nominalQuantity: amount(12) }, { ...common, id: ids[i] + "-category", kind: "price-category-reference", product: point.product, priceScope: "source-defined-dozen-pack" }];
  });
  const families = forms.map((exactForm, i) => ({ id: ids[i]!, ingredientSignature: signatures[i]!, exactForm, recordIds: [171287], purchase: { ...purchase }, quantityBasis: { kind: BASIS, groupId: "egg-group" }, packageClaimId: ids[i] + "-package", priceReviews: i ? [] : [{ id: "dated", region: "South", seriesId: point.series_id, product: point.product, period: point.period, categoryClaimId: ids[i] + "-category", reviewEffectiveFrom: "2026-10-19", usableThrough: "2026-10-19" }] }));
  const manifest = { schema: "wd-reviewed-public-pack-manifest-v5", catalogSha256: sha(sources.catalog), claims, families, purchaseGroups: [{ id: "egg-group", memberFamilyIds: ids, memberForms: families.map(f => ({ familyId: f.id, ingredientSignature: f.ingredientSignature, exactForm: f.exactForm, recordIds: f.recordIds })), anchorFamilyId: ids[0]!, sourceUrl: "https://example.invalid/synthetic-egg", sourceSha256: "5".repeat(64), reviewedOn: "2026-10-19", evidenceLevel: "synthetic-test-only", description: "Synthetic nominal50g edible/raw reference, never actual individual mass or preparation yield.", scope: SCOPE }] };
  function config(value: unknown = manifest) { return { catalog: { sha256: sha(sources.catalog), recordCount: 2 }, matches: { sha256: sha(sources.matches) }, records: { sha256: sha(sources.records) }, staples: { sha256: sha(sources.staples), observations: 1 }, produce: { sha256: sha(sources.produce), observations: 0 }, manifestSha256: sha(json(value)) }; }
  return { forms, sources, manifest, config, bind: () => createReviewedPublicPackRegistry(sources, json(manifest), config()) };
}

// Joined full-day synthetic fixture with explicitly known raw GradeALarge counts.
export function eggGroupPlanFixture(changedReview = false) {
 const f = eggGroupFixture(), base = setup(), rows = f.sources.catalog.toString().trim().split("\n").map(line => JSON.parse(line));
 for (const row of rows) { row.sections = ["breakfast", "lunch", "dinner"]; row.recipe_sha256 = sha(JSON.stringify(canonicalReferenceData(row.recipe))); row.nutrition.source_refresh.exact_recipe_body_sha256 = row.recipe_sha256; row.nutrition.source_refresh.recipe_sha256_unchanged = row.recipe_sha256; }
 f.sources.catalog = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n"); f.manifest.catalogSha256 = sha(f.sources.catalog);
 if (changedReview) f.manifest.purchaseGroups[0]!.sourceSha256 = "e".repeat(64);
 const registry = f.bind(); if (registry.outcome !== "ready") throw Error("Expected synthetic egg group");
 const quantity = registry.quantityForFamilies({ familyIds: f.manifest.families.map(x => x.id) }); if (quantity.outcome !== "prepared") throw Error("Expected synthetic egg quantities");
 const configuration = { sourcePin: { sha256: sha(f.sources.catalog), recordCount: 2 }, correspondences: quantity.correspondences, regionalPackFacts: [], pantryIntake: { measureFacts: [], purchaseBindings: quantity.pantryPurchaseBindings }, schedulePolicy: "wd-seven-day-three-meals-v1" };
 const request = { ...base.request, asOfDate: "2026-10-19", storeIds: [], slots: ["breakfast", "lunch", "dinner"], people: base.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, coverage: "full-day" } })) };
 const assignments = base.assignments.flatMap(a => request.slots.map(slot => { const row = rows[a.personId === "p1" ? 0 : 1]; return { ...a, assignmentId: a.assignmentId + slot, slot, recipeId: row.id, recipeSha256: row.recipe_sha256, sourceServings: { numerator: a.sourceServings.numerator, denominator: String(BigInt(a.sourceServings.denominator) * BigInt(3)) } }; }));
 const binding = quantity.pantryPurchaseBindings[0]!, entries = [{ pantryId: "synthetic-known-large-egg-counts", kind: "known", ingredientId: binding.ingredientId, preparedState: binding.preparedState, baseUnit: "each", amount: { numerator: "1000", denominator: "1" }, unit: "each", purchaseBindingId: binding.id }];
 return { ...f, configuration, request, assignments, entries, labels: [{ skuId: binding.skuId, displayName: "Synthetic large eggs", aisle: "Eggs" }], bytes: f.sources.catalog };
}
