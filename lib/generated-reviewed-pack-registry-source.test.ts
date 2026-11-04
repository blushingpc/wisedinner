import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { createPantryIntake } from "./generated-plan-pantry.ts";
import { decimal, receipt } from "../packages/solver/src/generated-meal-ranges.ts";

const R = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime", F = R + "/recipe-appeal/usda-refresh-20261016-01";
const J = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/backend-readiness-20261016-01/plan-review-20261018-01";
const FILES = { catalog: F + "/export-02/recipes-with-usda-macros.jsonl", matches: F + "/ingredient-matches-02.json", records: F + "/export-02/selected-usda-records.json", staples: R + "/recipe-enrichment/shared-price-sources/bls-staples-56-20261014/snapshot.json", produce: R + "/meal-enrichment/prices-281a0723beb54fb7a67c2047593456e0/snapshot.json" };
const MANIFEST = J + "/reviewed-public-pack-manifest-20261019-01.json";
const options = { skip: ![...Object.values(FILES), MANIFEST].every(existsSync) && "Exact local source/curator packet unavailable; not current source evidence" };
const sha = (value: Uint8Array) => createHash("sha256").update(value).digest("hex"), amount = (n: number | string, d: number | string = 1) => ({ numerator: String(n), denominator: String(d) });
function actual() {
  const sources = { catalog: readFileSync(FILES.catalog), matches: readFileSync(FILES.matches), records: readFileSync(FILES.records), staples: readFileSync(FILES.staples), produce: readFileSync(FILES.produce) }, manifestBytes = readFileSync(MANIFEST);
  const config = { catalog: { sha256: "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0", recordCount: 1300 }, matches: { sha256: "43bfec0a2e3e76e8c5d313a1f9462e2bf96fbdbe8d55923e70e87bbd8f6f34b0" }, records: { sha256: "1580f7ed4ee1f6ecd059cf9ff02ce19cccd82a2dea688d957a097d35af1ff5fe" }, staples: { sha256: "fa53f0df7e8c7eb809b344443d87f19aa55fbb17e6ab587bb7999978665df662", observations: 333 }, produce: { sha256: "0f3437ae8ae880a5d79910beb5b001455ccba8966ac3c1071c4deeb2dc131579", observations: 77 }, manifestSha256: "a5d564502c5b34ea7de1a8effa40d9abbc299fe89e00b9c477540b245718082b" };
  assert.equal(sha(manifestBytes), config.manifestSha256);
  const registry = createReviewedPublicPackRegistry(sources, manifestBytes, config); assert.equal(registry.outcome, "ready"); if (registry.outcome !== "ready") throw Error("Expected actual private source binding");
  return { sources, manifestBytes, config, registry };
}

test("actual source egg rice beef manifests bind537ingredient references without adopting recipes or clinical/price truth", options, () => {
  const { registry, sources } = actual(), before = Object.values(sources).map(sha);
  const expected = { "egg-reference": { recipes: 273, price: "2.368", cents: { min: 236, max: 237 } }, "rice-reference": { recipes: 161, price: "1.218", cents: { min: 243, max: 244 } }, "beef90-reference": { recipes: 103, price: "8.143", cents: { min: 814, max: 815 } } };
  assert.equal(registry.families.length, 3);
  for (const family of registry.families) {
    const e = expected[family.id as keyof typeof expected]; assert.ok(e); assert.equal(family.recipeReferences, e.recipes);
    const current = registry.forPlanning({ familyId: family.id, region: "South", asOfDate: "2026-10-19" }); assert.equal(current.outcome, "prepared"); if (current.outcome !== "prepared") throw Error("Expected exact private day");
    assert.equal(current.exactPublicBenchmark.priceValueUsd, e.price); assert.deepEqual(current.regionalPackFacts[0]!.packPriceCents, e.cents); assert.equal(current.sourceAdoptionGranted, false); assert.equal(current.sourceTruthEstablished, false); assert.equal(current.completeRegistryEstablished, false); assert.equal(current.pantryPackageQuantityEstablished, false);
    assert.equal(current.regionalPackFacts[0]!.basis, family.id === "egg-reference" ? "observed-regional-average" : "modeled-regional-average");
    for (const region of ["Northeast", "Midwest", "West"]) assert.equal(registry.forPlanning({ familyId: family.id, region, asOfDate: "2026-10-19" }).outcome, "held");
    for (const asOfDate of ["2026-10-18", "2026-10-20"]) assert.equal(registry.forPlanning({ familyId: family.id, region: "South", asOfDate }).outcome, "held");
  }
  assert.deepEqual(Object.values(sources).map(sha), before);
});

test("actual537ingredient quantities keep original source hashes and independent count/mass/pack arithmetic", options, () => {
  const { registry, sources } = actual(), rows = sources.catalog.toString("utf8").trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
  let checked = 0;
  for (const family of registry.families) {
    const prepared = registry.forPlanning({ familyId: family.id, region: "South", asOfDate: "2026-10-19" }); assert.equal(prepared.outcome, "prepared"); if (prepared.outcome !== "prepared") throw Error("Expected actual facts");
    const fact = prepared.regionalPackFacts[0]!;
    for (const row of rows) {
      const ingredient = row.recipe.ingredients.find((i: { id: string }) => i.id === family.ingredientId); if (!ingredient) continue;
      assert.equal(ingredient.state, family.preparedState); assert.equal(row.product_accepted, false); assert.equal(row.allergen_reviewed, false); assert.equal(row.kitchen_tested, false);
      const values = String(ingredient.quantity).split("/"), source = values.length === 2 ? { n: BigInt(values[0]!), d: BigInt(values[1]!) } : decimal(ingredient.quantity);
      const demands = [{ assignmentId: row.id, recipeId: row.id, recipeSha256: row.recipe_sha256, ingredientId: ingredient.id, preparedState: ingredient.state, baseUnit: ingredient.unit, amount: receipt(source) }];
      const result = prepareReferencePurchaseRequirements(demands, prepared.correspondences); assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") throw Error("Expected actual reference demand");
      const requirement = result.requirements[0]!, q = requirement.purchasedNeed, factorDenominator = family.id === "egg-reference" ? BigInt(50) : BigInt(1);
      assert.equal(BigInt(q.numerator) * source.d * factorDenominator, source.n * BigInt(q.denominator));
      const quote = quoteRegionalEstimates({ region: "South", storeIds: ["synthetic-test-household-store"], asOfDate: "2026-10-19", budgetCents: 100000 }, result.requirements, [], prepared.regionalPackFacts); assert.equal(quote.outcome, "quoted"); if (quote.outcome !== "quoted") throw Error("Expected ingredient-only quote");
      const packN = family.id === "egg-reference" ? BigInt(12) : family.id === "rice-reference" ? BigInt(907) : BigInt(45359237), packD = family.id === "beef90-reference" ? BigInt(100000) : BigInt(1);
      const numerator = source.n * packD, denominator = source.d * factorDenominator * packN, packs = Number((numerator + denominator - BigInt(1)) / denominator);
      assert.equal(quote.rows[0]!.packCount, packs); assert.deepEqual(quote.estimatedTotalCents, { min: packs * fact.packPriceCents.min, max: packs * fact.packPriceCents.max });
      assert.equal(quote.adoptionGranted, false); assert.equal(quote.liveRetailerPricing, false); checked++;
    }
  }
  assert.equal(checked, 537); assert.equal(sha(readFileSync(FILES.catalog)), "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0");
});

test("actual source forms compose one three-item household ingredient basket with pantry once and no meal/week claim", options, () => {
  const { registry } = actual();
  const bundles = registry.families.map(f => { const r = registry.forPlanning({ familyId: f.id, region: "South", asOfDate: "2026-10-19" }); assert.equal(r.outcome, "prepared"); if (r.outcome !== "prepared") throw Error("Expected bundle"); return r; });
  const correspondences = bundles.flatMap(b => b.correspondences), bindings = bundles.flatMap(b => b.pantryPurchaseBindings), facts = bundles.flatMap(b => b.regionalPackFacts);
  const demands = correspondences.flatMap((c, i) => [100, 200].map((n, person) => ({ assignmentId: `synthetic-person-${person}-source-${i}`, recipeId: "synthetic-source-basket-only", recipeSha256: "e".repeat(64), ingredientId: c.ingredientId, preparedState: c.preparedState, baseUnit: c.consumedUnit, amount: amount(c.ingredientId === "eggs" ? n / 2 : n) })));
  const requirements = prepareReferencePurchaseRequirements(demands, correspondences); assert.equal(requirements.outcome, "prepared"); if (requirements.outcome !== "prepared") throw Error("Expected combined demand"); assert.equal(requirements.requirements.length, 3);
  const intake = createPantryIntake({ measureFacts: [], purchaseBindings: bindings }); assert.equal(intake.outcome, "ready"); if (intake.outcome !== "ready") throw Error("Expected exact base input bindings");
  const pantry = intake.prepare(bindings.map((b, i) => ({ pantryId: "synthetic-owned-" + i, kind: "known", ingredientId: b.ingredientId, preparedState: b.preparedState, baseUnit: b.baseUnit, amount: amount(b.baseUnit === "each" ? 1 : 100), unit: b.baseUnit, purchaseBindingId: b.id }))); assert.equal(pantry.outcome, "prepared"); if (pantry.outcome !== "prepared") throw Error("Expected explicitly supplied test amounts");
  const q = quoteRegionalEstimates({ region: "South", storeIds: ["synthetic-test-household-store"], asOfDate: "2026-10-19", budgetCents: 2000 }, requirements.requirements, pantry.pantry, facts); assert.equal(q.outcome, "quoted"); if (q.outcome !== "quoted") throw Error("Expected ingredient-only basket");
  assert.equal(q.uniqueBuyItemCount, 3); assert.deepEqual(q.estimatedTotalCents, { min: 1293, max: 1296 }); assert.deepEqual(q.budgetRemainingCents, { min: 704, max: 707 });
  const egg = q.rows.find(row => row.unit === "each")!; assert.deepEqual(egg.needed, amount(3)); assert.deepEqual(egg.ownedUsed, amount(1)); assert.deepEqual(egg.toBuy, amount(2)); assert.deepEqual(egg.purchasedLeftover, amount(10));
  assert.deepEqual(q.rows.find(row => row.skuId.includes("rice"))!.purchasedLeftover, amount(707));
});

test("known egg reference refuses rehashed different portion/food or non-dozen source-defined pack", options, () => {
  const f = actual();
  for (const change of [(r: Record<string, Record<string, unknown>>) => { r["171287"]!.description = "Egg, cooked"; }, (r: Record<string, Record<string, unknown>>) => { const portions = r["171287"]!.portions as { id: string; gram_weight: string }[]; portions.find(p => p.id === "88374")!.gram_weight = "75.0"; }]) {
    const records = JSON.parse(f.sources.records.toString()); change(records); const bytes = Buffer.from(JSON.stringify(records));
    assert.equal(createReviewedPublicPackRegistry({ ...f.sources, records: bytes }, f.manifestBytes, { ...f.config, records: { sha256: sha(bytes) } }).outcome, "error");
  }
  const manifest = JSON.parse(f.manifestBytes.toString()); manifest.claims.find((c: { id: string }) => c.id === "egg-reference-package").nominalQuantity = amount(6); const bytes = Buffer.from(JSON.stringify(manifest));
  assert.equal(createReviewedPublicPackRegistry(f.sources, bytes, { ...f.config, manifestSha256: sha(bytes) }).outcome, "error");
});
