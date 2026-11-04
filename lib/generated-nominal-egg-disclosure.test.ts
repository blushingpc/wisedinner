// Synthetic protocol journey. No real source-food, ownership or native acceptance.
import test from "node:test";
import assert from "node:assert/strict";
import { eggGroupFixture } from "./generated-reviewed-egg-group.test-support.ts";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { prepareReferencePurchaseRequirements, preparePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { presentGroceries } from "./generated-plan-presenter.ts";

const KIND = "published-nominal-large-egg-edible-mass-reference", FLAG = "nominal-large-egg-edible50g-not-individual-mass-or-preparation-yield", WARNING = "uses-nominal-large-egg-count-reference";
function quantityFixture() {
 const f = eggGroupFixture(), r = f.bind(); assert.equal(r.outcome, "ready"); if (r.outcome !== "ready") throw Error("Expected synthetic group");
 const q = r.quantityForFamilies({ familyIds: f.manifest.families.map(x => x.id) }); assert.equal(q.outcome, "prepared"); if (q.outcome !== "prepared") throw Error("Expected synthetic quantities");
 const demands = f.forms.map((form, i) => ({ assignmentId: "member" + i, recipeId: "r" + i, recipeSha256: "a".repeat(64), ingredientId: form.id, preparedState: form.state, baseUnit: "g", amount: { numerator: "240", denominator: "1" } }));
 return { ...f, q, demands };
}
test("nominal reference survives fully owned zero-price requirements and the real joined grocery presenter", () => {
 const f = quantityFixture(), p = prepareReferencePurchaseRequirements(f.demands, f.q.correspondences); assert.equal(p.outcome, "prepared"); if (p.outcome !== "prepared") return;
 assert.ok(Object.hasOwn(f.q.correspondences[0]!, "nominalEggReference")); assert.ok(Object.hasOwn(p.requirements[0]!, "nominalEggReference"));
 const binding = f.q.pantryPurchaseBindings[0]!, stock = { skuId: binding.skuId, unit: binding.baseUnit, formDigest: binding.formDigest, quantity: { numerator: 1000, denominator: 1 } }, quote = quoteRegionalEstimates({ region: "South", storeIds: [], asOfDate: "2026-10-19", budgetCents: 0 }, p.requirements, [stock], []);
 assert.equal(quote.outcome, "quoted"); if (quote.outcome !== "quoted") return; assert.deepEqual(quote.estimatedTotalCents, { min: 0, max: 0 }); assert.ok(quote.rows[0]!.flags.includes(FLAG)); assert.ok(Object.hasOwn(quote.rows[0]!, "nominalEggReference"));
 const base = setup(), rows = f.sources.catalog.toString().trim().split("\n").map(line => JSON.parse(line)), planner = createJoinedReferencePlanner(f.sources.catalog, { sourcePin: { sha256: sha(f.sources.catalog), recordCount: 2 }, correspondences: f.q.correspondences, regionalPackFacts: [] });
 assert.equal(planner.outcome, "ready"); if (planner.outcome !== "ready") return;
 const request = { ...base.request, storeIds: [], asOfDate: "2026-10-19", pantry: [stock] }, assignments = base.assignments.map(a => { const row = rows[a.personId === "p1" ? 0 : 1]; return { ...a, recipeId: row.id, recipeSha256: row.recipe_sha256 }; }), evaluated = planner.planner.evaluateJoined(assignments, request);
 assert.equal(evaluated.outcome, "success"); if (evaluated.outcome !== "success") return;
 const view = presentGroceries(evaluated, [{ skuId: binding.skuId, displayName: "Synthetic eggs", aisle: "Eggs" }]); assert.equal(view.outcome, "groceries"); if (view.outcome !== "groceries") return;
 assert.ok(view.warnings.includes(WARNING)); assert.equal(view.uniqueBuyItemCount, 0); assert.equal(view.alreadyAtHome.length, 1); assert.equal(view.productionReady, false);
 for (const privateField of ["nominalEggReference", "edibleGPerLargeEgg", "estimatedLineCents", "packPriceCents"]) assert.equal(JSON.stringify(view).includes(privateField), false);
});
test("reference mapping refuses wrong factors/units/source and shared-SKU mismatches without granting the legacy adapter", () => {
 const f = quantityFixture(), reference = { kind: KIND, edibleGPerLargeEgg: { numerator: "50", denominator: "1" }, sourceSha256: f.q.correspondences[0]!.sourceSha256, reviewEffectiveFrom: "2026-10-19" }, correspondences = f.q.correspondences.map(c => ({ ...c, nominalEggReference: reference }));
 assert.equal(prepareReferencePurchaseRequirements(f.demands, correspondences).outcome, "prepared"); assert.equal(preparePurchaseRequirements(f.demands, correspondences).outcome, "error");
 for (const patch of [{ consumedUnit: "ml" }, { purchaseUnit: "g" }, { sourceSha256: "0".repeat(64) }, { factor: { min: { numerator: "1", denominator: "49" }, max: { numerator: "1", denominator: "49" } } }, { nominalEggReference: { ...reference, edibleGPerLargeEgg: { numerator: "49", denominator: "1" } } }, { nominalEggReference: { ...reference, kind: "physical-count-guarantee" } }]) assert.equal(prepareReferencePurchaseRequirements(f.demands, correspondences.map(c => ({ ...c, ...patch }))).outcome, "error");
 const conflict = correspondences.map((c, i) => i ? { ...c, nominalEggReference: { ...reference, reviewEffectiveFrom: "2026-10-20" } } : c); const result = prepareReferencePurchaseRequirements(f.demands, conflict); assert.equal(result.outcome, "error"); if (result.outcome === "error") assert.equal(result.code, "incompatible_purchase_correspondence");
});
test("even fully owned requirements retain quantity-review date and reject malformed reference fields/getters", () => {
 const reference = { kind: KIND, edibleGPerLargeEgg: { numerator: "50", denominator: "1" }, sourceSha256: "a".repeat(64), reviewEffectiveFrom: "2026-10-19" }, need = { skuId: "synthetic", category: "eggs", unit: "each", formDigest: "b".repeat(64), perishable: true, purchasedNeed: { numerator: 1, denominator: 1 }, nominalEggReference: reference }, stock = [{ skuId: "synthetic", unit: "each", formDigest: "b".repeat(64), quantity: { numerator: 12, denominator: 1 } }], request = { region: "South", storeIds: [], asOfDate: "2026-10-19", budgetCents: 0 };
 const good = quoteRegionalEstimates(request, [need], stock, []); assert.equal(good.outcome, "quoted"); if (good.outcome === "quoted") assert.ok(good.rows[0]!.flags.includes(FLAG));
 const early = quoteRegionalEstimates({ ...request, asOfDate: "2026-10-18" }, [need], stock, []); assert.equal(early.outcome, "held"); if (early.outcome === "held") assert.equal(early.code, "quantity_reference_not_current");
 for (const value of [undefined, null, true, {}, { ...reference, extra: true }, { ...reference, sourceSha256: "bad" }, { ...reference, reviewEffectiveFrom: "2026-02-30" }, { ...reference, edibleGPerLargeEgg: { numerator: "0", denominator: "1" } }]) assert.equal(quoteRegionalEstimates(request, [{ ...need, nominalEggReference: value }], stock, []).outcome, "error");
 let reads = 0; const hostile = { ...reference }; Object.defineProperty(hostile, "sourceSha256", { enumerable: true, get() { reads++; return "a".repeat(64); } }); assert.equal(quoteRegionalEstimates(request, [{ ...need, nominalEggReference: hostile }], stock, []).outcome, "error"); assert.equal(reads, 0);
});
