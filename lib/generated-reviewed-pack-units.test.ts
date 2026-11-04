import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./generated-joined-plan.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";

const sha = (v: string | Uint8Array) => createHash("sha256").update(v).digest("hex");
const json = (v: unknown) => Buffer.from(JSON.stringify(v));
const amount = (n: number | string, d: number | string = 1) => ({ numerator: String(n), denominator: String(d) });
const signature = "1".repeat(64);
function fixture(unit: "g" | "ml" | "each" = "ml") {
  const initial = setup(), rows = structuredClone(initial.rows), row = rows[0]!;
  row.recipe.ingredients[0]!.unit = unit;
  for (const step of row.recipe.steps) for (const a of step.allocations) if (a.id === "food-a") a.unit = unit;
  const hash = sha(JSON.stringify(canonicalReferenceData(row.recipe)));
  row.recipe_sha256 = hash; row.nutrition.source_refresh.exact_recipe_body_sha256 = hash; row.nutrition.source_refresh.recipe_sha256_unchanged = hash;
  const catalog = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  const item = row.recipe.ingredients[0]!, form = { id: item.id, name: item.name, state: item.state, unit };
  const matches = json({ matches: { [signature]: { exact_form: form, status: "conditional-reference", record_ids: [10], flags: ["synthetic-original-warning"], holds: [] } } });
  const records = json({ "10": { fdc_id: 10, description: "Fictional unit-boundary fixture, not a real food", raw_food_row_sha256: "2".repeat(64), portions: [] } });
  const point = { series_id: "APU0300701312", area_code: "0300", item_code: "701312", region: "South", currency: "USD", source_kind: "bls-average-retail-price", product: "Synthetic unit-price source", period: "2026-09", unit: unit === "g" ? "kg" : unit === "ml" ? "liter" : "count", unit_amount: "1", value: "2.500", source_ids: ["point"] };
  const snapshot = (observations: unknown[]) => json({ schema: "wisedinner-bls-average-price-v1", source_kind: "bls-average-retail-price", currency: "USD", as_of: "2026-10-14", status: "partial-observations", observations, sources: [{ id: "point", sha256: "3".repeat(64) }] });
  const sources = { catalog, matches, records, staples: snapshot([point]), produce: snapshot([]) };
  const shared = { ingredientSignature: signature, sourceUrl: "https://example.invalid/synthetic-units-only", sourceSha256: "4".repeat(64), reviewedOn: "2026-10-19", evidenceLevel: "synthetic-test-only", description: "Fictional package and price, no food or commercial adoption" };
  const manifest = { schema: "wd-reviewed-public-pack-manifest-v1", catalogSha256: sha(catalog), claims: [
    { ...shared, id: "package", kind: "package-reference", purchaseState: form.state, unit, nominalQuantity: amount(500) },
    { ...shared, id: "category", kind: "price-category-reference", product: point.product, priceScope: "conditional-category-unit-model" },
  ], families: [{ id: "family-a", ingredientSignature: signature, exactForm: form, recordIds: [10], purchase: { skuId: "synthetic-unit-pack", state: form.state, unit, category: "pantry", perishable: false }, quantityBasis: { kind: "same-state-identity" }, packageClaimId: "package", priceReviews: [{ id: "south-september", region: "South", seriesId: point.series_id, product: point.product, period: "2026-09", categoryClaimId: "category", reviewEffectiveFrom: "2026-10-19", usableThrough: "2026-10-19" }] }] };
  const config = () => ({ catalog: { sha256: sha(catalog), recordCount: rows.length }, matches: { sha256: sha(sources.matches) }, records: { sha256: sha(sources.records) }, staples: { sha256: sha(sources.staples), observations: 1 }, produce: { sha256: sha(sources.produce), observations: 0 }, manifestSha256: sha(json(manifest)) });
  return { sources, manifest, config, form, bind: () => createReviewedPublicPackRegistry(sources, json(manifest), config()) };
}
function ready(unit: "g" | "ml" | "each" = "ml") {
  const f = fixture(unit), registry = f.bind(); assert.equal(registry.outcome, "ready");
  if (registry.outcome !== "ready") throw Error("Expected synthetic unit registry");
  const result = registry.forPlanning({ familyId: "family-a", region: "South", asOfDate: "2026-10-19" });
  assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") throw Error("Expected synthetic unit facts");
  return { ...f, registry, result };
}
test("same-state ml price evidence describes volume, never mass or Large eggs", () => {
  const { result } = ready("ml"), flags = result.regionalPackFacts[0]!.flags;
  assert.ok(flags.includes("same-state-input-volume-not-cooking-yield"));
  assert.ok(!flags.includes("same-state-input-mass-not-cooking-yield"));
  assert.ok(!flags.some(x => x.startsWith("Large-egg")));
  assert.ok(flags.includes("synthetic-original-warning"));
});
test("unsupported each catalog inputs stay rejected instead of inventing count support", () => {
  assert.equal(fixture("each").bind().outcome, "error");
});
test("existing same-state mass price evidence retains its mass warning and arithmetic", () => {
  const { result } = ready("g"), fact = result.regionalPackFacts[0]!;
  assert.ok(fact.flags.includes("same-state-input-mass-not-cooking-yield"));
  assert.ok(!fact.flags.some(x => x.includes("input-volume") || x.includes("input-count")));
  assert.deepEqual(fact.packQuantity, amount(500)); assert.deepEqual(fact.packPriceCents, { min: 125, max: 125 });
});
test("same-state ml demand combines people and deducts stock once before whole packs", () => {
  const { result, form } = ready("ml"), c = result.correspondences[0]!;
  const demand = (id: string, n: number) => ({ assignmentId: id, recipeId: "a", recipeSha256: "a".repeat(64), ingredientId: form.id, preparedState: form.state, baseUnit: "ml" as const, amount: amount(n) });
  const prepared = prepareReferencePurchaseRequirements([demand("person-a", 400), demand("person-b", 300)], result.correspondences);
  assert.equal(prepared.outcome, "prepared"); if (prepared.outcome !== "prepared") throw Error("Expected volume demand");
  assert.equal(prepared.requirements.length, 1);
  const quoted = quoteRegionalEstimates({ region: "South", storeIds: ["synthetic-only"], budgetCents: 1000, asOfDate: "2026-10-19" }, prepared.requirements, [{ skuId: c.skuId, unit: "ml", formDigest: c.formDigest, quantity: { numerator: 100, denominator: 1 } }], result.regionalPackFacts);
  assert.equal(quoted.outcome, "quoted"); if (quoted.outcome !== "quoted") throw Error("Expected volume quote");
  assert.deepEqual(quoted.estimatedTotalCents, { min: 250, max: 250 });
  assert.equal(quoted.uniqueBuyItemCount, 1); assert.deepEqual(quoted.rows[0]!.ownedUsed, amount(100)); assert.deepEqual(quoted.rows[0]!.ownedRemaining, amount(0));
});
test("bounded rational ml demands use the independent whole-pack oracle without mass conversion", () => {
  const { result, form } = ready("ml"), c = result.correspondences[0]!;
  for (let numerator = 0; numerator <= 79; numerator++) for (const denominator of [1, 3, 17]) {
    const n = BigInt(numerator) * BigInt(157), d = BigInt(denominator);
    const prepared = prepareReferencePurchaseRequirements([{ assignmentId: "a", recipeId: "a", recipeSha256: "a".repeat(64), ingredientId: form.id, preparedState: form.state, baseUnit: "ml", amount: amount(String(n), String(d)) }], result.correspondences);
    assert.equal(prepared.outcome, "prepared"); if (prepared.outcome !== "prepared") throw Error("Expected rational volume");
    const quoted = quoteRegionalEstimates({ region: "South", storeIds: ["synthetic-only"], budgetCents: 1000000, asOfDate: "2026-10-19" }, prepared.requirements, [{ skuId: c.skuId, unit: "ml", formDigest: c.formDigest, quantity: { numerator: 13, denominator: 1 } }], result.regionalPackFacts);
    assert.equal(quoted.outcome, "quoted"); if (quoted.outcome !== "quoted") throw Error("Expected bounded volume");
    const shortage = n > BigInt(13) * d ? n - BigInt(13) * d : BigInt(0), packs = (shortage + BigInt(500) * d - BigInt(1)) / (BigInt(500) * d);
    assert.deepEqual(quoted.estimatedTotalCents, { min: Number(packs * BigInt(125)), max: Number(packs * BigInt(125)) });
  }
});
test("ml mapping cannot borrow g/each demand, another state or a mixed package dimension", () => {
  const { result, form } = ready("ml");
  for (const baseUnit of ["g", "each"]) assert.equal(prepareReferencePurchaseRequirements([{ assignmentId: "a", recipeId: "a", recipeSha256: "a".repeat(64), ingredientId: form.id, preparedState: form.state, baseUnit, amount: amount(50) }], result.correspondences).outcome, "held");
  assert.equal(prepareReferencePurchaseRequirements([{ assignmentId: "a", recipeId: "a", recipeSha256: "a".repeat(64), ingredientId: form.id, preparedState: "unreviewed cooked state", baseUnit: "ml", amount: amount(50) }], result.correspondences).outcome, "held");
  const f = fixture(); f.manifest.families[0]!.purchase.unit = "g"; assert.equal(f.bind().outcome, "error");
});
test("volume source holds and before-review pricing stay held without a zero-price default", () => {
  const { registry } = ready();
  assert.equal(registry.forPlanning({ familyId: "family-a", region: "South", asOfDate: "2026-10-18" }).outcome, "held");
  const f = fixture(), data = JSON.parse(f.sources.matches.toString()); data.matches[signature].holds = ["unresolved-real-source"];
  f.sources.matches = json(data); assert.equal(f.bind().outcome, "error");
  const missing = fixture(); missing.manifest.families[0]!.priceReviews = [];
  const r = missing.bind(); assert.equal(r.outcome, "ready"); if (r.outcome === "ready") assert.equal(r.forPlanning({ familyId: "family-a", region: "South", asOfDate: "2026-10-19" }).outcome, "held");
});
