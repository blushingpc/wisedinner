import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { setup } from "./generated-joined-plan.test-support.ts";
import { allergySetup } from "./generated-plan-household-allergies.test-support.ts";
import { createJoinedReferencePlanner, createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { normalizeSourcePolicyDataV2 } from "./generated-source-policy-basis-v2.ts";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";

function stable(v: unknown): unknown { return Array.isArray(v) ? v.map(stable) : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map(k => [k, stable((v as Record<string, unknown>)[k])])) : v; }
const hash = (v: unknown) => createHash("sha256").update(JSON.stringify(stable(v))).digest("hex");
function fixture() {
  const f = setup();
  const facts = ["a", "b"].map(id => {
    const body = { skuId: "buy-" + id, unit: "g", formDigest: "d".repeat(64), packQuantity: { numerator: "100", denominator: "1" }, packPriceCents: { min: 120, max: 130 }, currency: "USD", kind: "retailer-reference", sourceSha256: "a".repeat(64), sourceUrl: "https://example.invalid/retailer-" + id, sourceBasis: { geography: "retailer-reference-not-regional", retailerId: "synthetic-only", productId: id, offerContext: { channel: "online-public", geographyDescription: "Synthetic contract data", storeId: null, fulfilment: null }, capturedOn: "2026-10-18", observedOn: null, publishedOn: null }, reviewEffectiveFrom: "2026-10-18", usableThrough: "2026-10-18", flags: ["synthetic-test-only"] };
    return { id: "rr1:" + hash(["wd-retailer-reference-fact-v1", body]), ...body };
  });
  const configuration = { ...f.configuration, regionalPackFacts: [], referencePrices: { policy: "wd-price-reference-fallback-v2", facts } };
  return { ...f, configuration };
}
function ready(value: ReturnType<typeof createJoinedReferencePlannerV2>) { assert.equal(value.outcome, "ready"); if (value.outcome !== "ready") throw Error("Expected V2 binding"); return value; }

test("actual derived starter uses new catalog/complete manifest basis, old V1/fullsource controls stay distinct", async () => {
  const main = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/apple-preorder-build-20261023/", job = "C:/Users/borgh/Projects/wisedinner-app/tasks/apple-preorder-minimum-2026-10-22/";
  const contextPath = "file:///C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/backend-readiness-20261016-01/plan-review-20261018-01/nominal-egg-source-context-20261019-01.mjs", context = (await import(contextPath)).sourceContext();
  const file = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/backend-readiness-20261016-01/plan-review-20261018-01/reviewed-public-pack-manifest-20261020-25.json", manifest = readFileSync(file);
  const registry = createReviewedPublicPackRegistry(context.sources, manifest, { ...context.trusted, manifestSha256: createHash("sha256").update(manifest).digest("hex") }); assert.equal(registry.outcome, "ready"); if (registry.outcome !== "ready") return;
  const correspondences = [...new Map(registry.families.flatMap(f => { const result = registry.quantityForFamily({ familyId: f.id }); assert.equal(result.outcome, "prepared"); if (result.outcome !== "prepared") throw Error("mapping"); return result.correspondences; }).map(row => [row.id, row])).values()];
  const derivation = JSON.parse(readFileSync("C:/Users/borgh/Projects/wisedinner-app/assets/runtime/reviewed-starter-v1.manifest.json", "utf8")), pack = readFileSync("C:/Users/borgh/Projects/wisedinner-app/assets/runtime/reviewed-starter-v1.jsonl");
  const water = JSON.parse(readFileSync(main + "REVIEWED-TAP-WATER-CONFIGURATION-20261023.json", "utf8")), references = JSON.parse(readFileSync(main + "ADDITIONAL-REFERENCE-CANDIDATE-20261023.json", "utf8"));
  const configuration = { sourcePin: derivation.derivedSourcePin, correspondences, regionalPackFacts: [], referencePrices: references.combinedReferenceConfiguration, schedulePolicy: "wd-seven-day-three-meals-v1", tapCookingWater: { ...water, sourcePin: derivation.derivedSourcePin, derivation } };
  assert.equal(createJoinedReferencePlanner(pack, configuration).outcome, "error");
  const bound = ready(createJoinedReferencePlannerV2(pack, configuration)), saved = JSON.parse(readFileSync(job + "STARTER-CANDIDATE-EVALUATION.json", "utf8")).results.find((r: { id: string }) => r.id === "one-90-15000");
  const result = bound.planner.evaluateJoined(saved.assignments, saved.request); assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.sourceSha256, derivation.derivedSourcePin.sha256); assert.notEqual(result.sourceSha256, derivation.parentSourcePin.sha256);
  assert.equal(result.projection.assignments.length, 21); assert.deepEqual(result.quote.estimatedTotalCents, { min: 10953, max: 10963 });
  assert.equal(result.sourcePolicyBasis.utilityConfigurationSha256, hash(configuration.tapCookingWater));
  assert.ok(result.utilityPartition!.utilityUsage.length > 0);
  const wrong = structuredClone(configuration); wrong.tapCookingWater.derivation.parentBytes++;
  assert.notEqual(createJoinedReferencePlannerV2(pack, wrong).outcome, "ready");
});

test("V2 evaluator uses actual retailer quote, original source/portion projection and complete source-policy basis", () => {
  const f = fixture(), bound = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration)), result = bound.planner.evaluateJoined(f.assignments, f.request);
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.equal(result.quote.referenceEstimates?.policy, "wd-price-reference-fallback-v2");
  assert.equal(result.quote.referenceEstimates?.sources[0]?.kind, "retailer-reference");
  assert.equal(result.sourceSha256, f.configuration.sourcePin.sha256); assert.equal(result.projection.assignments.length, 14);
  assert.deepEqual(result.projection.assignments[0]!.recipe, f.rows[0]!.recipe); assert.deepEqual(result.projection.assignments[0]!.sourceServings, f.assignments[0]!.sourceServings);
  assert.equal(result.utilityPartition, null); assert.deepEqual(result.sourcePolicyBasis, bound.sourcePolicyBasis);
  const { basisSha256, ...without } = result.sourcePolicyBasis;
  assert.equal(basisSha256, hash(["wd-source-policy-basis-v2", without]));
  assert.equal(without.purchaseCorrespondencesSha256, hash(f.configuration.correspondences));
  assert.equal(without.regionalPackFactsSha256, hash([]));
  assert.equal(without.referenceConfigurationSha256, hash(f.configuration.referencePrices));
  assert.equal(without.utilityPolicy, null); assert.equal(without.utilityConfigurationSha256, null);
  assert.equal(Object.isFrozen(result.sourcePolicyBasis), true);
});

test("same shared bounded search returns full V2 evaluation/basis rather than a relabelled V1 quote", () => {
  const f = fixture(), bound = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration));
  const result = bound.planner.planJoined(f.request, { recipeIds: ["a"], portionsByPerson: f.request.people.map((p, i) => ({ personId: p.personId, profileRevision: p.profileRevision, sourceServings: [{ numerator: String(i + 3), denominator: "1" }] })), maxRecipeUsesPerPerson: 7, maxEvaluations: 2, seed: "synthetic-v2" });
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.deepEqual(result.sourcePolicyBasis, bound.sourcePolicyBasis); assert.equal(result.utilityPartition, null);
  assert.equal(result.quote.referenceEstimates?.sources[0]?.kind, "retailer-reference"); assert.equal(result.search.evaluations, 1);
});

test("normalization binds equivalent fractions equally but complete ordered unused configuration changes basis", () => {
  const f = fixture(), original = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration));
  const reduced = structuredClone(f.configuration);
  reduced.correspondences[0]!.factor.min = { numerator: "2", denominator: "2" };
  reduced.correspondences[0]!.factor.max = { numerator: "2", denominator: "2" };
  assert.deepEqual(ready(createJoinedReferencePlannerV2(f.bytes, reduced)).sourcePolicyBasis, original.sourcePolicyBasis);
  const reversed = { ...f.configuration, correspondences: [...f.configuration.correspondences].reverse() };
  assert.notEqual(ready(createJoinedReferencePlannerV2(f.bytes, reversed)).sourcePolicyBasis.basisSha256, original.sourcePolicyBasis.basisSha256);
  const unused = { ...f.configuration, regionalPackFacts: [setup().configuration.regionalPackFacts[1]!] };
  const changed = ready(createJoinedReferencePlannerV2(f.bytes, unused)); assert.notEqual(changed.sourcePolicyBasis.basisSha256, original.sourcePolicyBasis.basisSha256);
  const a = original.planner.evaluateJoined(f.assignments, f.request), b = changed.planner.evaluateJoined(f.assignments, f.request);
  assert.equal(a.outcome, "success"); assert.equal(b.outcome, "success"); if (a.outcome === "success" && b.outcome === "success") assert.deepEqual(a.quote, b.quote);
});

test("malformed utility opt-in fails closed; absent utility never silently removes food liquids", () => {
  const f = fixture();
  for (const tapCookingWater of [null, {}, { policy: "wd-tap-cooking-water-utility-v1" }]) assert.deepEqual(createJoinedReferencePlannerV2(f.bytes, { ...f.configuration, tapCookingWater }), { outcome: "error", code: "invalid_tap_water_configuration" });
  const bad = { ...f.configuration, correspondences: [] }, bound = ready(createJoinedReferencePlannerV2(f.bytes, bad));
  const result = bound.planner.evaluateJoined(f.assignments, f.request); assert.equal(result.outcome, "held");
  if (result.outcome === "held") assert.ok(result.reasons.some(r => r.code === "purchase_basis_needed"));
});

test("source/config snapshots reject getters and malformed unused arrays and cannot be altered after construction", () => {
  const f = fixture(), bound = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration)), before = bound.planner.evaluateJoined(f.assignments, f.request);
  f.configuration.referencePrices.facts[0]!.packPriceCents.max = 9999;
  f.configuration.correspondences[0]!.sourceSha256 = "b".repeat(64);
  assert.deepEqual(bound.planner.evaluateJoined(f.assignments, f.request), before);
  const fresh = fixture(); let reads = 0;
  const hostile = Object.defineProperty({ ...fresh.configuration }, "regionalPackFacts", { enumerable: true, get() { reads++; return []; } });
  assert.equal(createJoinedReferencePlannerV2(fresh.bytes, hostile).outcome, "error"); assert.equal(reads, 0);
  assert.equal(createJoinedReferencePlannerV2(fresh.bytes, { ...fresh.configuration, correspondences: [{ bad: true }] }).outcome, "error");
  assert.equal(createJoinedReferencePlannerV2(fresh.bytes, { ...fresh.configuration, regionalPackFacts: [{ bad: true }] }).outcome, "error");
});

test("profile revisions, goal, portion, equipment and budget checks remain real evaluator constraints", () => {
  const f = fixture(), bound = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration));
  assert.equal(bound.planner.evaluateJoined(f.assignments, { ...f.request, equipment: [] }).outcome, "no_fit");
  assert.equal(bound.planner.evaluateJoined(f.assignments, { ...f.request, budgetCents: 0 }).outcome, "no_fit");
  assert.equal(bound.planner.evaluateJoined(f.assignments, { ...f.request, people: f.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, gramsPerDay: "300" } })) }).outcome, "no_fit");
  assert.equal(bound.planner.evaluateJoined(f.assignments.map((a, i) => i ? a : { ...a, profileRevision: 999 }), f.request).outcome, "error");
  assert.equal(bound.planner.evaluateJoined(f.assignments.map((a, i) => i ? a : { ...a, sourceServings: { numerator: "0", denominator: "1" } }), f.request).outcome, "error");
});

test("shared household allergy checks reject another person's meal and fully-owned purchase violations", () => {
  const f = allergySetup(), bound = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration));
  assert.equal(bound.planner.evaluateJoined(f.assignments, f.request).outcome, "success");
  const changed = f.assignments.map(a => a.assignmentId === f.target.assignmentId ? { ...a, recipeId: "b", recipeSha256: f.rows[1]!.recipe_sha256 } : a);
  assert.equal(bound.planner.evaluateJoined(changed, f.request).outcome, "no_fit");
  f.configuration.householdAllergies.purchaseFacts[0]!.status = "contains";
  const strict = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration));
  assert.equal(strict.planner.evaluateJoined(f.assignments, { ...f.request, pantry: [{ skuId: "buy-a", unit: "g", formDigest: "d".repeat(64), quantity: { numerator: 100000, denominator: 1 } }] }).outcome, "no_fit");
});

test("V2 preview hash includes complete source-policy basis even when cents and recipe portions match", () => {
  const f = fixture(), a = ready(createJoinedReferencePlannerV2(f.bytes, f.configuration)), b = ready(createJoinedReferencePlannerV2(f.bytes, { ...f.configuration, regionalPackFacts: [setup().configuration.regionalPackFacts[1]!] }));
  const target = f.assignments[0]!, intent = { assignmentId: target.assignmentId, personId: target.personId, expectedRecipeSha256: target.recipeSha256, replacementRecipeId: "a", sourceServings: { numerator: "4", denominator: "1" } };
  const p = a.planner.previewReplacement(f.assignments, f.request, intent), q = b.planner.previewReplacement(f.assignments, f.request, intent);
  assert.equal(p.outcome, "preview"); assert.equal(q.outcome, "preview"); if (p.outcome !== "preview" || q.outcome !== "preview") return;
  assert.notEqual(p.previewSha256, q.previewSha256); assert.equal(p.sourcePolicyBasisSha256, a.sourcePolicyBasis.basisSha256);
  assert.deepEqual(p.before.quote, q.before.quote); assert.equal(p.nonShoppingUsageBefore, null); assert.equal(p.nonShoppingUsageAfter, null);
  assert.deepEqual(b.planner.confirmReplacement(f.assignments, f.request, { intent, expectedPreviewSha256: p.previewSha256, expectedRequestSha256: p.requestSha256, expectedAssignmentsSha256: p.baseAssignmentsSha256 }), { outcome: "error", code: "stale_replacement_preview" });
});

test("V1 stays closed to V2 configuration and exposes no source-policy basis fields", () => {
  const f = fixture(); assert.equal(createJoinedReferencePlanner(f.bytes, f.configuration).outcome, "error");
  const old = setup(), value = old.planner.evaluateJoined(old.assignments, old.request);
  assert.equal(value.outcome, "success"); assert.equal(Object.hasOwn(value, "sourcePolicyBasis"), false); assert.equal(Object.hasOwn(value, "utilityPartition"), false);
});

test("bounded exact normalization is idempotent and scale-invariant while array order is significant", () => {
  // Deterministic bounded property cases, not a random/shrinking PBT framework.
  for (let n = 0; n < 40; n++) for (let d = 1; d <= 7; d++) {
    const original = { proof: [{ numerator: String(n), denominator: String(d) }, { tag: "preserve-" + n }] };
    const scaled = { proof: [{ numerator: String(n * 13), denominator: String(d * 13) }, { tag: "preserve-" + n }] };
    const normalized = normalizeSourcePolicyDataV2(original);
    assert.deepEqual(normalizeSourcePolicyDataV2(normalized), normalized);
    assert.deepEqual(normalizeSourcePolicyDataV2(scaled), normalized);
    assert.notEqual(hash(normalized), hash({ proof: [...original.proof].reverse() }));
  }
});

test("explicit utility integration retains actual source nutrition and lexical traces, never a zero-price food row", () => {
  const bytes = readFileSync("C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl");
  assert.equal(createHash("sha256").update(bytes).digest("hex"), "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0");
  const rows = bytes.toString("utf8").trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
  const row = rows.find(r => r.id === "WD-R6-B-0251"); assert.ok(row);
  const tapCookingWater = JSON.parse(readFileSync("C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/apple-preorder-build-20261023/REVIEWED-TAP-WATER-CONFIGURATION-20261023.json", "utf8"));
  // Synthetic food prices/correspondences ONLY to isolate utility integration.
  // Real source/recipe/nutrition and Main-reviewed water config stay unmodified.
  const f = setup(), ingredients = row.recipe.ingredients.filter((i: { id: string }) => i.id !== "water");
  const correspondences = ingredients.map((i: { id: string; state: string; unit: string }) => ({ ...f.configuration.correspondences[0]!, id: "synthetic-map-" + i.id, ingredientId: i.id, preparedState: i.state, consumedUnit: i.unit, skuId: "synthetic-buy-" + i.id, purchaseState: i.state }));
  const regionalPackFacts = correspondences.map((c: { skuId: string }, i: number) => ({ ...f.configuration.regionalPackFacts[0]!, id: "synthetic-price-" + i, skuId: c.skuId }));
  const configuration = { correspondences, regionalPackFacts };
  const request = { ...f.request, selectedDays: ["2026-10-23"], slots: ["breakfast"], people: [{ ...f.request.people[0]!, proteinGoal: { kind: "known", gramsPerDay: "20", coverage: "selected-meals" } }], equipment: row.recipe.equipment, budgetCents: 100000 };
  const assignments = [{ assignmentId: "synthetic-price-water-integration", personId: "p1", profileRevision: 1, date: "2026-10-23", slot: "breakfast", recipeId: row.id, recipeSha256: row.recipe_sha256, sourceServings: { numerator: "1", denominator: "1" } }];
  const without = ready(createJoinedReferencePlannerV2(bytes, configuration));
  assert.equal(without.planner.evaluateJoined(assignments, request).outcome, "held");
  const bound = ready(createJoinedReferencePlannerV2(bytes, { ...configuration, tapCookingWater }));
  const result = bound.planner.evaluateJoined(assignments, request); assert.equal(result.outcome, "success"); if (result.outcome !== "success") return;
  assert.deepEqual(result.projection.assignments[0]!.recipe, row.recipe);
  assert.deepEqual(result.projection.assignments[0]!.nutrition.totals!.protein_g, { min: { numerator: "7641", denominator: "320" }, max: { numerator: "78993", denominator: "3200" } });
  assert.equal(result.utilityPartition!.utilityUsage.length, 1);
  assert.deepEqual(result.utilityPartition!.utilityUsage[0]!.amount, { numerator: "250", denominator: "1" });
  assert.equal(result.utilityPartition!.foodDemands.length, ingredients.length);
  assert.equal(result.projection.demands.length, ingredients.length + 1);
  assert.equal(result.quote.rows.length, ingredients.length);
  assert.ok(result.quote.rows.every(r => !r.skuId.includes("water")));
  assert.equal(result.sourcePolicyBasis.utilityPolicy, "wd-tap-cooking-water-utility-v1");
  const changed = structuredClone(tapCookingWater); changed.reviewedForms[0].reviewedOn = "2026-10-22";
  assert.notEqual(ready(createJoinedReferencePlannerV2(bytes, { ...configuration, tapCookingWater: changed })).sourcePolicyBasis.basisSha256, bound.sourcePolicyBasis.basisSha256);
  const intent = { assignmentId: assignments[0]!.assignmentId, personId: "p1", expectedRecipeSha256: row.recipe_sha256, replacementRecipeId: row.id, sourceServings: { numerator: "1", denominator: "1" } };
  const preview = bound.planner.previewReplacement(assignments, request, intent); assert.equal(preview.outcome, "preview"); if (preview.outcome !== "preview") return;
  assert.equal(preview.nonShoppingUsageBefore!.items.length, 1); assert.equal(preview.nonShoppingUsageBefore!.items[0]!.displayName, "Cooking water");
  assert.deepEqual(preview.nonShoppingUsageBefore, preview.nonShoppingUsageAfter);
  assert.deepEqual(preview.nonShoppingUsageBefore!.warnings, ["tap-cooking-water-excluded-from-food-groceries"]);
});
