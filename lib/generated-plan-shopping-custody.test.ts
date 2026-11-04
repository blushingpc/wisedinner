import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { createReferenceSessionHandlerV2, REFERENCE_SESSION_CONTRACT_V2 } from "./generated-plan-session.ts";
import { issueLocalReferenceScopeV2, type ReferenceStatePortV2 } from "./generated-plan-state.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { createCurrentMealCoverage, mealCoverageHash } from "./generated-current-meal-coverage.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";
import { syntheticV2 } from "./generated-plan-v2.test-support.ts";

const artifacts = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/website-refresh-20261027/normal-ui-study/native-integration-20261030/backend-repair-round-v3/http-source-wave-v1/shopping147";
const read = (name: string) => JSON.parse(readFileSync(artifacts + "/" + name, "utf8"));

async function checkedSynthetic(checked = true) {
  const f = syntheticV2(), installed = await f.send("installCurrent", f.initial), item = installed.body.result.state.current.view.groceries.groups[0].items[0];
  const check = await f.send("shoppingCheck", { expectedRevision: 1, weekId: op(100), itemKey: item.itemKey, fingerprint: item.fingerprint, checked }, 2); assert.equal(check.body.result.outcome, "acknowledged");
  const a = f.assignments[0]!, intent = { assignmentId: a.assignmentId, personId: a.personId, expectedRecipeSha256: a.recipeSha256, replacementRecipeId: "a", sourceServings: { numerator: "4", denominator: "1" } };
  const p = f.binding.planner.previewReplacement(f.assignments, f.request, intent); assert.equal(p.outcome, "preview"); if (p.outcome !== "preview") throw Error("preview required");
  const payload = { expectedRevision: 2, weekId: op(100), intent, expectedPreviewSha256: p.previewSha256, expectedRequestSha256: p.requestSha256, expectedAssignmentsSha256: p.baseAssignmentsSha256 };
  return { f, payload, prior: check.body.result.state };
}

test("confirmed V2 transition preserves intentional unchecked state and rejects the old shopping fingerprint", async () => {
  const { f, payload, prior } = await checkedSynthetic(false), saved = await f.send("saveReplacement", payload, 3);
  assert.equal(saved.body.result.outcome, "acknowledged");
  assert.equal(saved.body.result.state.current.view.groceries.groups[0].items[0].checked, false);
  const old = prior.current.view.groceries.groups[0].items[0];
  const stale = await f.send("shoppingCheck", { expectedRevision: 3, weekId: op(100), itemKey: old.itemKey, fingerprint: old.fingerprint, checked: true }, 4);
  assert.equal(stale.body.result.code, "stale_shopping_row");
});

for (const defect of ["foreign-person", "wrong-week", "stale-revision", "stale-preview", "stale-recipe", "changed-basis", "injected-bought", "new-SKU", "extra-pack"] as const) {
  test("confirmed custody fails closed without changing state: " + defect, async () => {
    const { f, payload, prior } = await checkedSynthetic();
    const changed = structuredClone(payload); let basis = f.binding.sourcePolicyBasis.basisSha256;
    if (defect === "foreign-person") changed.intent.personId = "foreign";
    if (defect === "wrong-week") changed.weekId = op(101);
    if (defect === "stale-revision") changed.expectedRevision = 1;
    if (defect === "stale-preview") changed.expectedPreviewSha256 = "0".repeat(64);
    if (defect === "stale-recipe") changed.intent.expectedRecipeSha256 = "0".repeat(64);
    if (defect === "changed-basis") basis = "0".repeat(64);
    if (defect === "new-SKU") changed.intent.replacementRecipeId = "b";
    if (defect === "extra-pack") changed.intent.sourceServings.numerator = "5";
    const result = await f.send("saveReplacement", defect === "injected-bought" ? { ...changed, checked: true } : changed, 3, basis);
    assert.notEqual(result.body.result.outcome, "acknowledged");
    const readback = await f.send("readCurrent", {}, 4, null); assert.deepEqual(readback.body.result.state, prior);
  });
}

test("lost confirmed-replacement ACK is status-only; exact original custody survives source drift and restart", async () => {
  const { f, payload } = await checkedSynthetic(); f.memory.failOnce("after-commit");
  assert.equal((await f.send("saveReplacement", payload, 3)).body.result.outcome, "unknown");
  assert.equal((await f.send("saveReplacement", payload, 3)).body.result.code, "operation_status_required");
  const status = await f.send("operationStatus", { targetOperationId: op(3) }, 4, null);
  assert.equal(status.body.result.outcome, "committed"); assert.equal(status.body.result.receipt.state.revision, 3);
  assert.equal(status.body.result.receipt.state.current.view.groceries.groups[0].items[0].checked, true);
  const restarted = createReferenceSessionHandlerV2(f.bytes, { ...f.configuration, correspondences: [...f.configuration.correspondences].reverse() }, f.options);
  assert.equal(restarted.outcome, "ready"); if (restarted.outcome !== "ready") throw Error("restart required");
  const old = await f.send("operationStatus", { targetOperationId: op(3) }, 5, null, restarted);
  assert.equal(old.body.result.receipt.state.revision, 3); assert.equal(old.body.result.receipt.saved, true);
  assert.equal(old.body.result.receipt.state.current.view.code, "saved_source_policy_basis_changed");
  const refused = await f.send("saveReplacement", { ...payload, expectedRevision: 3 }, 6, f.binding.sourcePolicyBasis.basisSha256, restarted);
  assert.notEqual(refused.body.result.outcome, "acknowledged");
});

test("a different trusted owner namespace cannot use or resolve the original purchased week", async () => {
  const { f, payload, prior } = await checkedSynthetic();
  const foreignScope = issueLocalReferenceScopeV2("shopping147-foreign-owner", 1);
  const foreign = createReferenceSessionHandlerV2(f.bytes, f.configuration, { ...f.options, resolveScope: () => foreignScope });
  assert.equal(foreign.outcome, "ready"); if (foreign.outcome !== "ready") throw Error("foreign handler required");
  const denied = await f.send("saveReplacement", payload, 3, f.binding.sourcePolicyBasis.basisSha256, foreign);
  assert.notEqual(denied.body.result.outcome, "acknowledged");
  const unknown = await f.send("operationStatus", { targetOperationId: op(2) }, 4, null, foreign);
  assert.notEqual(unknown.body.result.outcome, "committed");
  const original = await f.send("readCurrent", {}, 5, null); assert.deepEqual(original.body.result.state, prior);
});

test("exact frozen different-dish21meal shared session replacement retains all10acknowledged purchases", async () => {
  const slot = JSON.parse(readFileSync(process.env.WD_LOCAL_BACKEND_TEST_ADMISSION!, "utf8"));
  assert.equal(slot.taskId, "backend-shopping-custody-v147");
  assert.equal(slot.workerThreadId, "01a192eb-8b77-71f1-94a8-c96a303e937b");
  assert.equal(slot.actualExecutorThreadId, slot.workerThreadId);
  assert.ok(Date.parse(slot.validUntil) > Date.now());
  for (const pin of read("fixture-pins.json").frozen) assert.equal(createHash("sha256").update(readFileSync(pin.file)).digest("hex"), pin.sha256);
  const bytes = readFileSync(artifacts + "/source.jsonl"), reference = read("reference.json"), witness = read("witness.json"), labels = read("labels.json");
  const binding = createJoinedReferencePlannerV2(bytes, reference.configuration); assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") throw Error("frozen planner required");
  assert.equal(binding.sourcePolicyBasis.basisSha256, reference.sourcePolicyBasis.basisSha256);
  const assignments = witness.beforeAssignments;
  // The request is preserved in the sealed source investigation, not invented
  // from a replacement DTO or a changed quantity/goal/pack count.
  const input = read("request.json");
  const evaluated = binding.planner.evaluateJoined(assignments, input); assert.equal(evaluated.outcome, "success"); if (evaluated.outcome !== "success") throw Error("real week required");
  assert.deepEqual(evaluated.quote, witness.purchasedWholePackQuote);
  const selected = assignments.find((a: { assignmentId: string }) => a.assignmentId === witness.selected.assignmentId)!;
  const alternatives = binding.planner.findReplacements(assignments, input, { personId: selected.personId, assignmentId: selected.assignmentId, expectedRecipeSha256: selected.recipeSha256, candidates: [{ recipeId: witness.selected.replacementRecipeId, sourceServings: witness.selected.sourceServings }], maxEvaluations: 1, limit: 1 });
  assert.equal(alternatives.outcome, "alternatives"); if (alternatives.outcome !== "alternatives") throw Error("actual alternatives required");
  assert.equal(alternatives.candidates.length, 1); const alternative = alternatives.candidates[0]!;
  assert.notEqual(alternative.recipeId, selected.recipeId);
  const intent = { assignmentId: selected.assignmentId, personId: selected.personId, expectedRecipeSha256: selected.recipeSha256, replacementRecipeId: alternative.recipeId, sourceServings: alternative.sourceServings };
  const preview = alternative.preview, confirmation = { intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256 };
  const confirmed = binding.planner.confirmReplacement(assignments, input, confirmation); assert.equal(confirmed.outcome, "proposal"); if (confirmed.outcome !== "proposal") throw Error("confirmation required");
  const after = confirmed.evaluation;
  const coverage = createCurrentMealCoverage(bytes, { sourcePin: reference.sourcePin, configuration: reference.configuration, configurationSha256: mealCoverageHash(reference.configuration), asOfDate: input.asOfDate, region: input.region, storeIds: input.storeIds, practicalAssets: read("practical-assets.json") });
  assert.equal(coverage.outcome, "ready"); if (coverage.outcome !== "ready") throw Error("actual guides required");
  for (const evaluation of [evaluated, after]) {
    assert.ok(evaluation.quote.estimatedTotalCents.max <= 15000);
    for (const day of evaluation.projection.personDays) { const n = day.nutrition.totals!.protein_g.min; assert.ok(BigInt(n.numerator) >= BigInt(150) * BigInt(n.denominator)); }
    for (const a of evaluation.projection.assignments) {
      const guide: { readonly outcome: string; readonly guide?: unknown } = coverage.forCandidate({ recipeId: a.recipeId, recipeSha256: a.recipeSha256, sourceSha256: reference.sourcePin.sha256, configurationSha256: coverage.configurationSha256, sourceServings: a.sourceServings, context: { asOfDate: input.asOfDate, declaredAppliances: ["stove", "oven", "microwave", "air fryer"], specialCapabilities: [], restrictions: "none-declared" } });
      assert.equal(guide.outcome, "eligible"); assert.ok("guide" in guide && guide.guide);
      const actualGuide = JSON.parse(JSON.stringify(guide.guide)); assert.ok(Array.isArray(actualGuide.ingredients));
      for (const i of actualGuide.ingredients) {
        const consumed = a.consumedIngredients.find(c => c.ingredientId === i.id && c.preparedState === i.state && c.baseUnit === i.unit);
        assert.ok(consumed); assert.deepEqual(consumed.amount, i.amount);
      }
      assert.equal(actualGuide.ingredients.length, a.consumedIngredients.length);
    }
  }
  assert.deepEqual(after.projection.assignments.filter(a => a.assignmentId !== selected.assignmentId), evaluated.projection.assignments.filter(a => a.assignmentId !== selected.assignmentId));
  assert.equal(assignments.length, 21);
  const packs = (rows: typeof evaluated.quote.rows) => rows.map(r => ({ skuId: r.skuId, packCount: r.packCount, quantity: r.purchasedQuantity }));
  assert.deepEqual(packs(after.quote.rows), packs(evaluated.quote.rows));
  const memory = memoryPort(), scope = issueLocalReferenceScopeV2("shopping147-exact-frozen-owner", 1);
  const ready = createReferenceSessionHandlerV2(bytes, reference.configuration, { labels, transactions: memory.port as unknown as ReferenceStatePortV2, resolveScope: () => scope });
  assert.equal(ready.outcome, "ready"); if (ready.outcome !== "ready") throw Error("actual session required");
  const handler = ready;
  async function send(operation: string, payload: unknown, n: number) {
    const intent = { contract: REFERENCE_SESSION_CONTRACT_V2, operation, operationId: op(n), sourceSha256: reference.sourcePin.sha256, expectedSourcePolicyBasisSha256: reference.sourcePolicyBasis.basisSha256, payload };
    const response = await handler.handle(new Request("http://synthetic.invalid/shopping147", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }) }));
    return (await response.json()).result;
  }
  const installed = await send("installCurrent", { expectedRevision: 0, weekId: op(100), request: input, assignments, pantryEntries: [] }, 1); assert.equal(installed.outcome, "acknowledged");
  const items = installed.state.current.view.groceries.groups.flatMap((g: { items: { itemKey: string; fingerprint: string }[] }) => g.items);
  assert.equal(items.length, 10); let revision = 1;
  for (let n = 0; n < items.length; n++) { const checked = await send("shoppingCheck", { expectedRevision: revision, weekId: op(100), itemKey: items[n].itemKey, fingerprint: items[n].fingerprint, checked: true }, 10 + n); assert.equal(checked.outcome, "acknowledged"); revision = checked.state.revision; }
  const saved = await send("saveReplacement", { expectedRevision: revision, weekId: op(100), ...confirmation }, 80); assert.equal(saved.outcome, "acknowledged");
  const savedItems = saved.state.current.view.groceries.groups.flatMap((g: { items: { skuId: string; packCount: number; checked: boolean }[] }) => g.items);
  writeFileSync(artifacts + "/witness-observation.json", JSON.stringify({ purchasedQuote: evaluated.quote, beforeAssignments: assignments, afterProjection: after.projection, afterQuote: after.quote, actualSessionOutcome: saved.outcome, savedItems, guideChecks: 42, proteinAndBudgetPassed: true }, null, 2) + "\n");
  assert.equal(savedItems.length, 10);
  assert.equal(savedItems.filter((i: { checked: boolean }) => i.checked).length, 10, "confirmed same-purchase transition must preserve all10bought checks");
  for (const row of savedItems) assert.equal(row.packCount, evaluated.quote.rows.find(r => r.skuId === row.skuId)!.packCount);
});
