import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";
import { createCurrentMealCoverage, mealCoverageHash, classifyMealTool } from "./generated-current-meal-coverage.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { createRevisedAssignmentProjector } from "./generated-person-plan.ts";
import { compare, decimal, rational } from "../packages/solver/src/generated-meal-ranges.ts";
import goldens from "./fixtures/current-original-batch-guide-bindings-v1.json" with { type: "json" };

const sha = (x: string | Uint8Array) => createHash("sha256").update(x).digest("hex");
const capsule = JSON.parse(readFileSync(new URL("./generated-current-source-capsule-v4.json", import.meta.url), "utf8"));
const source = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString();
const options = { sourcePin: capsule.configuration.sourcePin, configuration: capsule.configuration, configurationSha256: mealCoverageHash(capsule.configuration), asOfDate: "2026-10-31", region: "South", storeIds: ["reference-store-context-only"] };
const initial = createCurrentMealCoverage(source, options);
if (initial.outcome !== "ready") throw Error("Expected exact current coverage: " + JSON.stringify(initial));
const actual = initial;
const rawRows = source.trimEnd().split("\n").map(line => JSON.parse(line));
const find = (id: string) => actual.rows.find(r => r.recipeId === id)!;
const ordinaryAppliances = ["stove", "oven", "microwave", "air fryer", "slow cooker", "pressure cooker", "blender", "toaster"];
function query(id: string, sourceServings = { numerator: "2", denominator: "1" }) {
  const row = find(id);
  return { recipeId: id, recipeSha256: row.recipeSha256, sourceSha256: actual.sourceSha256, configurationSha256: actual.configurationSha256, sourceServings,
    context: { asOfDate: options.asOfDate, declaredAppliances: [...ordinaryAppliances], specialCapabilities: [] as string[], restrictions: "none-declared" } };
}

test("actual 1300 source rows retain independent42/7coverage, five nutrition holds and unchanged source", () => {
  assert.equal(sha(source), "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c");
  assert.equal(actual.rows.length, 1300); assert.equal(new Set(actual.rows.map(r => r.recipeId)).size, 1300);
  assert.equal(actual.summary.breakfast, 300); assert.equal(actual.summary.main, 1000);
  assert.equal(actual.summary.conditionalNutrition, 1295); assert.equal(actual.summary.heldNutrition, 5);
  assert.equal(actual.summary.quantityComplete, 42); assert.equal(actual.summary.priceComplete, 7);
  assert.equal(actual.productAccepted, false);
  for (const r of actual.rows) { assert.ok(r.guideDomains.length || r.guideHold); if (r.nutrition === "held") assert.equal(actual.forCandidate(query(r.recipeId)).outcome, "held"); }
  assert.equal(sha(source), options.sourcePin.sha256);
});

test("four goldens are complete unchanged original batches and not a guide whitelist", () => {
  assert.equal(goldens.guides.length, 4);
  for (const golden of goldens.guides) {
    const row = rawRows.find(r => r.id === golden.recipeId), response = actual.forCandidate(query(row.id));
    assert.equal(response.outcome, "eligible"); if (response.outcome !== "eligible") throw Error(JSON.stringify(response));
    assert.deepEqual(response.guide, golden); assert.equal(golden.consumeCompleteBatch, true);
    assert.deepEqual(golden.originalRecipe, row.recipe); assert.equal(golden.methodSha256, mealCoverageHash(row.recipe.steps));
    assert.equal(golden.ingredientsSha256, mealCoverageHash(row.recipe.ingredients));
    assert.equal(golden.allocationsSha256, mealCoverageHash(row.recipe.steps.map((s: { id: number; allocations: unknown }) => ({ id: s.id, allocations: s.allocations }))));
    assert.deepEqual(golden.sourceServings, { numerator: String(row.recipe.servings), denominator: "1" });
    assert.equal(response.kitchenTested, false); assert.equal(response.planEvaluated, false); assert.equal(response.ownerAccessGranted, false); assert.equal(response.allergyCertified, false);
    assert.equal(actual.forCandidate(query(row.id, { numerator: "1", denominator: "1" })).outcome, "held");
  }
  assert.ok(actual.summary.originalBatchGuides > 7);
  const other = actual.rows.find(r => !goldens.guides.some(g => g.recipeId === r.recipeId) && r.guideDomains.length)!;
  assert.ok(other); assert.ok(other.guideDomains.some(g => g.kind === "source-derived-original-full-batch"));
});

test("exact rational equivalent domains retain full batches; no rounding into half or quarter methods", () => {
  for (const g of goldens.guides) for (let d = 1; d <= 20; d++) {
    const q = query(g.recipeId, { numerator: String(2 * d), denominator: String(d) });
    assert.equal(actual.forCandidate(q).outcome, "eligible");
    q.sourceServings.numerator = String(2 * d - 1); assert.equal(actual.forCandidate(q).outcome, "held");
  }
  const q = query(goldens.guides[0]!.recipeId); q.sourceServings.denominator = "0";
  assert.equal(actual.forCandidate(q).outcome, "error");
});

test("ordinary preparation is informational; toaster and special capacities remain actual independent constraints", () => {
  assert.equal(classifyMealTool("digital kitchen scale")[0]!.role, "informational-prerequisite");
  assert.equal(classifyMealTool("oven mitts")[0]!.role, "informational-prerequisite");
  assert.equal(classifyMealTool("knife")[0]!.role, "informational-prerequisite");
  assert.equal(classifyMealTool("second burner")[0]!.role, "special-capability");
  assert.equal(classifyMealTool("1.5 litre blender").length, 2);
  assert.equal(classifyMealTool("unknown appliance")[0]!.role, "unclassified");
  for (const source of ["2 litre saucepan with lid", "28 cm nonstick skillet", "30 cm nonstick skillet", "lid fitting skillet", "two 600 ml lidded jars", "microwave-safe covered bowl", "microwave-safe plate"]) {
    assert.deepEqual(classifyMealTool(source), [{ source, role: "informational-prerequisite" }]);
  }
  assert.deepEqual(classifyMealTool("refrigerator"), [{ source: "refrigerator", role: "cold-storage-prerequisite" }]);
  for (const source of ["two-slot toaster", "two-slice toaster"]) {
    assert.deepEqual(classifyMealTool(source), [{ source, role: "declared-appliance", applianceId: "toaster" }, { source, role: "informational-prerequisite" }]);
  }
  for (const device of ordinaryAppliances) assert.ok(classifyMealTool(device).some(t => t.applianceId === device));
  for (const device of ["slow cooker", "pressure cooker"]) assert.ok(classifyMealTool("electric " + device).some(t => t.applianceId === device));
  for (const g of goldens.guides) {
    const q = query(g.recipeId), good = actual.forCandidate(q); assert.equal(good.outcome, "eligible");
    q.context.declaredAppliances = ["stove", "oven", "microwave", "air fryer"];
    const missing = actual.forCandidate(q); assert.equal(missing.outcome, "held");
    assert.ok("reasons" in missing && missing.reasons.includes("appliance_unavailable:toaster"));
    q.context.declaredAppliances = query(g.recipeId).context.declaredAppliances;
    assert.equal(actual.forCandidate(q).outcome, "eligible");
  }
});

test("actual seven priced source rows accept normal appliance answers; stove-only keeps three and refuses four toaster methods", () => {
  const priced = actual.rows.filter(r => r.price.outcome === "covered");
  assert.equal(priced.length, 7);
  let stoveEligible = 0, toasterHeld = 0;
  for (const row of priced) {
    const q = query(row.recipeId); assert.deepEqual(q.context.specialCapabilities, []);
    const all = actual.forCandidate(q); assert.equal(all.outcome, "eligible", JSON.stringify(all));
    assert.ok("preparationNotes" in all && all.preparationNotes.length > 0);
    q.context.declaredAppliances = ["stove"];
    const stove = actual.forCandidate(q);
    if (goldens.guides.some(g => g.recipeId === row.recipeId)) {
      assert.equal(stove.outcome, "held");
      assert.ok("reasons" in stove); assert.deepEqual(stove.reasons, ["appliance_unavailable:toaster"]); toasterHeld++;
    } else { assert.equal(stove.outcome, "eligible", JSON.stringify(stove)); stoveEligible++; }
  }
  assert.equal(stoveEligible, 3); assert.equal(toasterHeld, 4);
});

test("source/configuration/query pins, wrong date and unverified restrictions never grant a candidate", () => {
  const id = goldens.guides[0]!.recipeId;
  for (const field of ["recipeSha256", "sourceSha256", "configurationSha256"] as const) { const q = query(id); q[field] = "f".repeat(64); assert.equal(actual.forCandidate(q).outcome, "held"); }
  const q = query(id); q.context.asOfDate = "2026-11-01"; assert.equal(actual.forCandidate(q).outcome, "held");
  q.context.asOfDate = options.asOfDate; q.context.restrictions = "unknown-custom-allergy";
  const restricted = actual.forCandidate(q); assert.equal(restricted.outcome, "held"); assert.ok("reasons" in restricted && restricted.reasons.includes("restriction_evidence_required"));
  assert.equal(actual.forCandidate({ ...query(id), extra: true }).outcome, "error");
  assert.equal(createCurrentMealCoverage(source + " ", options).outcome, "error");
  const changed = structuredClone(options); changed.configuration.correspondences[0].factor.max.numerator = "99";
  assert.equal(createCurrentMealCoverage(source, changed).outcome, "error");
});

test("ordinary prices expire while documentary disclosures remain dated and missing facts never become zero", () => {
  const configuration = structuredClone(options.configuration); delete configuration.referencePrices.valuationPolicy;
  const expired = createCurrentMealCoverage(source, { ...options, configuration, configurationSha256: mealCoverageHash(configuration), asOfDate: "2026-11-06" }); assert.equal(expired.outcome, "ready");
  if (expired.outcome !== "ready") throw Error("Expected expired evidence rows, not erased catalog");
  assert.equal(expired.rows.length, 1300); assert.equal(expired.summary.priceComplete, 0);
  assert.ok(expired.rows.some(r => r.price.code === "reference_pack_fact_not_current"));
  for (const row of actual.rows.filter(r => r.price.outcome === "covered")) {
    assert.ok(row.price.sources.length); const text = JSON.stringify(row.price);
    assert.equal(/packPrice|estimatedLine|unitPrice|priceCents/.test(text), false);
    assert.match(text, /national-reference|manufacturer-reference|retailer-reference/);
  }
  assert.equal(actual.rows.filter(r => r.quantity.outcome === "prepared" && r.price.outcome === "held").length, 35);
});

// A separately pinned synthetic source is NOT production food evidence. It
// exercises future IDs and source-integrity rules without changing real recipes.
function synthetic(changes?: (row: typeof rawRows[number]) => void) {
  const row = structuredClone(rawRows.find(r => r.id === goldens.guides[0]!.recipeId));
  row.id = "synthetic-future-not-in-goldens"; row.recipe.title = "Synthetic full batch only"; row.recipe.equipment = [];
  changes?.(row); row.recipe_sha256 = mealCoverageHash(row.recipe);
  row.nutrition.source_refresh.exact_recipe_body_sha256 = row.recipe_sha256;
  row.nutrition.source_refresh.recipe_sha256_unchanged = row.recipe_sha256;
  const text = JSON.stringify(row) + "\n", sourcePin = { sha256: sha(text), recordCount: 1 };
  const configuration = { ...structuredClone(options.configuration), sourcePin }; delete configuration.tapCookingWater;
  return { row, text, settings: { ...options, sourcePin, configuration, configurationSha256: mealCoverageHash(configuration) } };
}
test("composed source queries keep real appliance/capacity guards and cold-storage notes without invented ownership", () => {
  for (const equipment of [["1.5 litre blender"], ["stove", "second burner"], ["oven with two racks"], ["slow cooker"], ["pressure cooker"], ["refrigerator", "oven mitts", "microwave-safe covered bowl"]]) {
    const f = synthetic(r => { r.recipe.equipment = equipment; }), built = createCurrentMealCoverage(f.text, f.settings);
    assert.equal(built.outcome, "ready"); if (built.outcome !== "ready") throw Error(JSON.stringify(built));
    const q = { ...query(goldens.guides[0]!.recipeId), recipeId: f.row.id, recipeSha256: f.row.recipe_sha256, sourceSha256: f.settings.sourcePin.sha256, configurationSha256: f.settings.configurationSha256 };
    const requiredCapacity = equipment.find(s => /blender|second burner|two racks/.test(s));
    if (requiredCapacity) {
      const held = built.forCandidate(q); assert.equal(held.outcome, "held");
      assert.ok("reasons" in held); assert.deepEqual(held.reasons, ["capacity_unverified:" + requiredCapacity]);
      q.context.specialCapabilities = ["unrelated capacity"];
      assert.equal(built.forCandidate(q).outcome, "held");
      q.context.specialCapabilities = [requiredCapacity]; assert.equal(built.forCandidate(q).outcome, "eligible");
    } else {
      assert.equal(built.forCandidate(q).outcome, "eligible");
      q.context.declaredAppliances = [];
      const missing = built.forCandidate(q);
      if (equipment.includes("refrigerator")) {
        assert.equal(missing.outcome, "eligible"); assert.ok("preparationNotes" in missing && missing.preparationNotes.includes("refrigerator"));
        assert.ok(built.rows[0]!.equipment.every(t => !t.applianceId));
      } else { assert.equal(missing.outcome, "held"); assert.ok("reasons" in missing); assert.deepEqual(missing.reasons, ["appliance_unavailable:" + equipment[0]]); }
    }
  }
});
test("new trusted source ID joins without3/7 whitelist; actual source allocation/unit errors hold its guide", () => {
  const f = synthetic(), loaded = createCurrentMealCoverage(f.text, f.settings); assert.equal(loaded.outcome, "ready");
  if (loaded.outcome !== "ready") throw Error(JSON.stringify(loaded));
  assert.equal(loaded.summary.guideRecipes, 1); assert.equal(loaded.summary.priceComplete, 1);
  const q = { ...query(goldens.guides[0]!.recipeId), recipeId: f.row.id, recipeSha256: f.row.recipe_sha256, sourceSha256: f.settings.sourcePin.sha256, configurationSha256: f.settings.configurationSha256 };
  assert.equal(loaded.forCandidate(q).outcome, "eligible");
  for (const mutate of [(r: typeof rawRows[number]) => { r.recipe.steps[0].allocations[0].quantity = "1"; }, (r: typeof rawRows[number]) => { r.recipe.steps[0].allocations[0].unit = "ml"; }]) {
    const bad = synthetic(mutate), outcome = createCurrentMealCoverage(bad.text, bad.settings); assert.equal(outcome.outcome, "ready");
    if (outcome.outcome !== "ready") throw Error(JSON.stringify(outcome));
    assert.equal(outcome.summary.guideRecipes, 0); assert.equal(outcome.rows[0]!.guideHold, "source_allocation_totals_unverified");
  }
});

const assetPath = "C:/Users/borgh/Projects/wisedinner-app/src/current-catalog/practical-assets-v2.json";
test("separately sealed reviewed1/2serving guides remain unchanged; arbitrary adaptation DTO cannot confer evidence", { skip: !existsSync(assetPath) && "Exact current independently sealed adaptation packet unavailable" }, () => {
  const assets = JSON.parse(readFileSync(assetPath, "utf8")), before = mealCoverageHash(assets), loaded = createCurrentMealCoverage(source, { ...options, practicalAssets: assets });
  assert.equal(loaded.outcome, "ready"); if (loaded.outcome !== "ready") throw Error(JSON.stringify(loaded));
  assert.equal(loaded.summary.reviewedAdaptationRecipes, 3);
  for (const r of assets.records) for (const g of r.guides) {
    const outcome = loaded.forCandidate(query(r.id, g.sourceServings)); assert.equal(outcome.outcome, "eligible");
    if (outcome.outcome !== "eligible") throw Error(JSON.stringify(outcome)); assert.deepEqual(outcome.guide, g);
  }
  assert.equal(mealCoverageHash(assets), before); assets.records[0].guides[0].ingredients[0].amount.numerator = "999";
  assert.equal(createCurrentMealCoverage(source, { ...options, practicalAssets: assets }).outcome, "error");
});

test("configuration snapshot and canonical key order are stable; unsupported guide rows do not disappear", () => {
  const changed = structuredClone(options), built = createCurrentMealCoverage(source, changed); assert.equal(built.outcome, "ready");
  changed.configuration.referencePrices.facts[0].packPriceCents.max = 999999;
  if (built.outcome !== "ready") throw Error("Expected snapshot"); assert.deepEqual(built.summary, actual.summary);
  assert.deepEqual(built.forCandidate(query(goldens.guides[0]!.recipeId)), actual.forCandidate(query(goldens.guides[0]!.recipeId)));
  assert.equal(mealCoverageHash({ a: 1, b: 2 }), mealCoverageHash({ b: 2, a: 1 }));
  assert.ok(actual.rows.some(r => r.quantity.missingForms.length));
});

test("portable production import graph has no Node builtins, Buffer or implicit environment access", () => {
  const visited = new Set<string>();
  function walk(file: string) {
    if (visited.has(file) || file.endsWith(".json")) return; visited.add(file); const text = readFileSync(file, "utf8");
    assert.doesNotMatch(text.replace(/\/\/[^\n]*/g, ""), /(?:from\s*["']node:|\bBuffer\b|process\.env)/, file);
    const imports = [...text.matchAll(/(?:import|export)\s+(?!type\b)[^;]*?from\s*["']([^"']+)["']/g)].map(m => m[1]!);
    for (const path of imports) if (path.startsWith(".")) { const resolved = resolve(dirname(file), path); if (existsSync(resolved)) walk(resolved); }
  }
  walk(new URL("./generated-current-meal-coverage.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  assert.ok(visited.size > 5);
});

test("150g/day and150USD/seven days stay with actual evaluator; replacements retain reserved pack bounds", t => {
  const bound = createJoinedReferencePlannerV2(source, options.configuration); assert.equal(bound.outcome, "ready");
  if (bound.outcome !== "ready") throw Error("Expected actual planner");
  const days = Array.from({ length: 7 }, (_, n) => `2026-11-${String(n + 1).padStart(2, "0")}`);
  const ids = ["WD-R6-B-0104", "WD-R6-M-229a763292298d2a", "WD-R6-M-431627cc2c407495"];
  const selectedTools = [...new Set(rawRows.filter(r => [...ids, ...goldens.guides.map(g => g.recipeId)].includes(r.id)).flatMap(r => r.recipe.equipment))];
  const request = { people: [{ personId: "synthetic-person", profileRevision: 1, label: "Synthetic", proteinGoal: { kind: "known", gramsPerDay: "150", coverage: "full-day" }, exclusions: { kind: "none" } }], selectedDays: days, slots: ["breakfast", "lunch", "dinner"], region: "South", storeIds: options.storeIds, budgetCents: 15000, asOfDate: options.asOfDate, equipment: selectedTools, pantry: [] };
  const assignments = days.flatMap(date => ids.map((recipeId, i) => ({ assignmentId: `${date}:${i}`, personId: "synthetic-person", profileRevision: 1, date, slot: request.slots[i], recipeId, recipeSha256: find(recipeId).recipeSha256, sourceServings: { numerator: "2", denominator: "1" } })));
  const reduced = bound.planner.evaluateJoined(assignments.map(a => a.slot === "dinner" ? { ...a, sourceServings: { numerator: "1", denominator: "1" } } : a), request);
  assert.equal(reduced.outcome, "no_fit"); if (reduced.outcome === "no_fit") assert.ok(reduced.reasons.some(r => r.code === "protein_goal_not_met"));
  const evaluated = bound.planner.evaluateJoined(assignments, request); assert.equal(evaluated.outcome, "success", JSON.stringify(evaluated));
  if (evaluated.outcome !== "success") throw Error(JSON.stringify(evaluated));
  assert.ok(evaluated.quote.estimatedTotalCents.max <= 15000);
  for (const day of evaluated.projection.personDays) { const min = day.nutrition.totals!.protein_g.min; assert.ok(compare(rational(BigInt(min.numerator), BigInt(min.denominator)), decimal("150")) >= 0); }
  const under = bound.planner.evaluateJoined(assignments, { ...request, budgetCents: 1 }); assert.equal(under.outcome, "no_fit");
  const target = assignments.find(a => a.slot === "lunch")!, preview = bound.planner.previewReplacement(assignments, request, { assignmentId: target.assignmentId, personId: target.personId, expectedRecipeSha256: target.recipeSha256, replacementRecipeId: goldens.guides[0]!.recipeId, sourceServings: { numerator: "2", denominator: "1" } });
  t.diagnostic(JSON.stringify({ householdBudgetCents: request.budgetCents, proteinGoal: "150", evaluatedTotalCents: evaluated.quote.estimatedTotalCents, replacementOutcome: preview.outcome, replacementReasons: preview.outcome === "no_fit" || preview.outcome === "held" ? preview.reasons : [] }));
  assert.equal(preview.outcome, "preview");
  if (preview.outcome === "preview") {
    const before = new Map(preview.before.quote.rows.map(r => [r.skuId, r.packCount]));
    assert.ok(preview.after.quote.rows.every(r => r.packCount <= (before.get(r.skuId) ?? 0)));
    assert.deepEqual(preview.after.projection.assignments.filter(a => a.assignmentId !== target.assignmentId), preview.before.projection.assignments.filter(a => a.assignmentId !== target.assignmentId));
  }
  const dinner = assignments.find(a => a.slot === "dinner")!;
  // Breakfast already reserves420g cheddar for seven days: two8oz packs.
  // The complete cheesy beef toastie adds60g, so it needs a third pack.
  const extra = bound.planner.previewReplacement(assignments, request, { assignmentId: dinner.assignmentId, personId: dinner.personId, expectedRecipeSha256: dinner.recipeSha256, replacementRecipeId: goldens.guides[2]!.recipeId, sourceServings: { numerator: "2", denominator: "1" } });
  assert.equal(extra.outcome, "no_fit");
  if (extra.outcome === "no_fit") assert.ok(extra.reasons.some(r => r.code === "replacement_requires_more_groceries"), JSON.stringify(extra.reasons));
  const projector = createRevisedAssignmentProjector(source, options.sourcePin); assert.equal(projector.outcome, "ready");
  assert.equal(request.budgetCents, 15000); assert.equal(request.people[0]!.proteinGoal.gramsPerDay, "150");
});


test("actual1300 documentary capsule stays dated after November5; ordinary references still expire", () => {
  const before = sha(JSON.stringify(capsule)), sourceBefore = sha(source);
  assert.equal(options.configuration.referencePrices.valuationPolicy, "wd-dated-documentary-reference-v1");
  const ordinary = structuredClone(options.configuration); delete ordinary.referencePrices.valuationPolicy;
  for (const asOfDate of ["2026-11-01", "2026-11-05", "2026-11-06", "2027-01-01"]) {
    const documented = createCurrentMealCoverage(source, { ...options, asOfDate });
    const strict = createCurrentMealCoverage(source, { ...options, configuration: ordinary, configurationSha256: mealCoverageHash(ordinary), asOfDate });
    assert.equal(documented.outcome, "ready"); assert.equal(strict.outcome, "ready");
    if (documented.outcome !== "ready" || strict.outcome !== "ready") throw Error("Expected actual source coverage");
    assert.equal(documented.summary.priceComplete, 7, asOfDate); assert.equal(strict.summary.priceComplete, asOfDate <= "2026-11-05" ? 7 : 0, asOfDate);
    assert.equal(documented.rows.length, 1300); assert.equal(documented.summary.conditionalNutrition, 1295); assert.equal(documented.summary.heldNutrition, 5); assert.equal(documented.summary.quantityComplete, 42);
    assert.equal(documented.sourceSha256, actual.sourceSha256); assert.equal(documented.configurationSha256, actual.configurationSha256); assert.deepEqual(documented.sourcePolicyBasis, actual.sourcePolicyBasis);
    for (const row of documented.rows) {
      const prior = find(row.recipeId); assert.equal(row.recipeSha256, prior.recipeSha256); assert.deepEqual(row.guideDomains, prior.guideDomains); assert.equal(row.nutrition, prior.nutrition); assert.deepEqual(row.sourceFlags, prior.sourceFlags);
      if (row.price.outcome === "covered") {
        assert.deepEqual(row.price.sources, prior.price.sources); assert.ok(row.price.sources.length);
        for (const raw of row.price.sources) { const d = raw as { reviewEffectiveFrom: string; usableThrough: string }; assert.equal(d.reviewEffectiveFrom, "2026-10-30"); assert.equal(d.usableThrough, "2026-11-05"); }
        const q = query(row.recipeId); q.context.asOfDate = asOfDate; assert.equal(documented.forCandidate(q).outcome, "eligible");
        q.context.restrictions = "unknown-allergy"; const restricted = documented.forCandidate(q); assert.equal(restricted.outcome, "held"); assert.ok("reasons" in restricted && restricted.reasons.includes("restriction_evidence_required"));
        q.context.restrictions = "none-declared"; q.sourceServings = { numerator: "1", denominator: "1" }; assert.equal(documented.forCandidate(q).outcome, "held");
      }
    }
    assert.equal(documented.productAccepted, false);
  }
  assert.equal(sha(JSON.stringify(capsule)), before); assert.equal(sha(source), sourceBefore);
});

test("documentary mode never makes a future review available or admits unknown/malformed/foreign evidence", () => {
  const early = createCurrentMealCoverage(source, { ...options, asOfDate: "2026-10-29" }); assert.equal(early.outcome, "ready");
  if (early.outcome !== "ready") throw Error("Expected intact catalogue before review date");
  assert.equal(early.rows.length, 1300); assert.equal(early.summary.priceComplete, 0); assert.ok(early.rows.some(r => r.price.code === "reference_pack_fact_not_current"));
  for (const mode of ["unknown", "malformed", "foreign"]) {
    const configuration = structuredClone(options.configuration);
    if (mode === "unknown") configuration.referencePrices.valuationPolicy = "unknown-documentary-policy";
    if (mode === "malformed") configuration.referencePrices.facts[0].usableThrough = "2026-02-30";
    if (mode === "foreign") configuration.sourcePin.sha256 = "f".repeat(64);
    assert.notEqual(createCurrentMealCoverage(source, { ...options, configuration, configurationSha256: mealCoverageHash(configuration), asOfDate: "2027-01-01" }).outcome, "ready", mode);
  }
});
