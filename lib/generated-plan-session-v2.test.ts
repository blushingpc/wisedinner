import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { syntheticV2, op, hashV2, labelsV2 } from "./generated-plan-v2.test-support.ts";
import { createReferenceSessionHandlerV2 } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
test("V2 install/read/checklist/duplicate preserve complete packets and namespace", async () => {
  const f = syntheticV2(), installed = await f.send("installCurrent", f.initial); assert.equal(installed.body.result.outcome, "acknowledged"); assert.equal(installed.body.result.saved, true);
  assert.deepEqual((await f.send("installCurrent", f.initial)).body, installed.body);
  const identity = installed.body.result.state.current; assert.equal(identity.sourcePolicyBasisSha256, f.binding.sourcePolicyBasis.basisSha256);
  const item = identity.view.groceries.groups[0].items[0];
  const checked = await f.send("shoppingCheck", { expectedRevision: 1, weekId: op(100), itemKey: item.itemKey, fingerprint: item.fingerprint, checked: true }, 2); assert.equal(checked.body.result.state.revision, 2);
  const read = await f.send("readCurrent", {}, 3, null); assert.equal(read.body.result.state.revision, 2); assert.equal(read.body.result.state.current.view.groceries.groups[0].items[0].checked, true);
  assert.equal((await f.send("saveCurrent", f.initial, 4)).body.result.code, "revision_conflict");
});
test("same-price source drift retains known commit/revision/original basis and rejects new work", async () => {
  const f = syntheticV2(); await f.send("installCurrent", f.initial);
  const configuration = { ...f.configuration, correspondences: [...f.configuration.correspondences].reverse() };
  const changed = createReferenceSessionHandlerV2(f.bytes, configuration, f.options); if (changed.outcome !== "ready") throw Error("Expected revised handler");
  const status = await f.send("operationStatus", { targetOperationId: op(1) }, 2, null, changed);
  assert.equal(status.body.result.outcome, "committed"); const receipt = status.body.result.receipt;
  assert.equal(receipt.saved, true); assert.equal(receipt.state.revision, 1); assert.equal(receipt.state.current.sourcePolicyBasisSha256, f.binding.sourcePolicyBasis.basisSha256);
  assert.deepEqual(receipt.state.current.view, { outcome: "held", code: "saved_source_policy_basis_changed" });
  const replay = await f.send("installCurrent", f.initial, 1, f.binding.sourcePolicyBasis.basisSha256, changed); assert.equal(replay.body.result.saved, true); assert.equal(replay.body.result.state.revision, 1);
  const stale = await f.send("saveCurrent", { ...f.initial, expectedRevision: 1 }, 3, f.binding.sourcePolicyBasis.basisSha256, changed); assert.equal(stale.status, 409); assert.equal(stale.body.result.code, "stale_source_policy_basis");
  const conflict = await f.send("installCurrent", { ...f.initial, expectedRevision: 1 }, 1, f.binding.sourcePolicyBasis.basisSha256, changed); assert.equal(conflict.body.result.code, "idempotency_conflict");
});

test("exact original durable intent resolves before changed pantry preparation after source drift", async () => {
  const f = syntheticV2(), original = await f.send("installCurrent", f.initial);
  const configuration = { ...f.configuration, correspondences: [...f.configuration.correspondences].reverse(), pantryIntake: { measureFacts: [], purchaseBindings: [] } };
  const changed = createReferenceSessionHandlerV2(f.bytes, configuration, f.options); if (changed.outcome !== "ready") throw Error("Expected changed handler");
  const duplicate = await f.send("installCurrent", f.initial, 1, f.binding.sourcePolicyBasis.basisSha256, changed);
  assert.equal(duplicate.body.result.outcome, "acknowledged"); assert.equal(duplicate.body.result.saved, true); assert.equal(duplicate.body.result.state.revision, original.body.result.state.revision); assert.equal(duplicate.body.result.state.current.view.code, "saved_source_policy_basis_changed");
});
test("lost acknowledgement remains unknown until status, and new-week lifecycle stays durable", async () => {
  const f = syntheticV2(); f.memory.failOnce("after-commit"); assert.equal((await f.send("installCurrent", f.initial)).body.result.outcome, "unknown");
  assert.equal((await f.send("installCurrent", f.initial)).body.result.code, "operation_status_required");
  assert.equal((await f.send("operationStatus", { targetOperationId: op(1) }, 2, null)).body.result.receipt.saved, true);
  const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "n", date: a.date.replace("2026-10-", "2026-11-") }));
  const next = await f.send("createWeekDraft", { ...f.initial, expectedRevision: 1, weekId: op(101), request, assignments, pantryReconfirmed: true }, 3); assert.equal(next.body.result.state.revision, 2);
  const committed = await f.send("confirmNewWeek", { expectedRevision: 2, weekId: op(101) }, 4); assert.equal(committed.body.result.state.current.weekId, op(101)); assert.equal(committed.body.result.state.draft, null);
});

test("fresh current-basis save and reviewed new week can recover older held state without replay or deletion", async () => {
  const f = syntheticV2(); await f.send("installCurrent", f.initial);
  const configuration = { ...f.configuration, correspondences: [...f.configuration.correspondences].reverse() };
  const changed = createReferenceSessionHandlerV2(f.bytes, configuration, f.options); if (changed.outcome !== "ready") throw Error("Expected revised handler");
  const basis = changed.sourcePolicyBasis!.basisSha256;
  const before = await f.send("readCurrent", {}, 2, null, changed); assert.equal(before.body.result.state.current.view.code, "saved_source_policy_basis_changed");
  const recovered = await f.send("saveCurrent", { ...f.initial, expectedRevision: 1 }, 3, basis, changed); assert.equal(recovered.body.result.outcome, "acknowledged"); assert.equal(recovered.body.result.state.revision, 2); assert.equal(recovered.body.result.state.current.view.outcome, "saved-week");
  assert.equal(recovered.body.result.state.current.sourcePolicyBasisSha256, basis);
  // Further drift: reviewed draft creation retains the original current week
  // until explicit confirmation; cancellation of an old-basis draft is safe.
  const nextConfiguration = { ...configuration, correspondences: f.configuration.correspondences };
  const newer = createReferenceSessionHandlerV2(f.bytes, nextConfiguration, f.options); if (newer.outcome !== "ready") throw Error("Expected binding");
  const currentBasis = newer.sourcePolicyBasis!.basisSha256;
  const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "n", date: a.date.replace("2026-10-", "2026-11-") }));
  const payload = { ...f.initial, expectedRevision: 2, weekId: op(101), request, assignments, pantryReconfirmed: true };
  const draft = await f.send("createWeekDraft", payload, 4, currentBasis, newer); assert.equal(draft.body.result.state.current.weekId, op(100)); assert.equal(draft.body.result.state.current.view.code, "saved_source_policy_basis_changed"); assert.equal(draft.body.result.state.draft.view.outcome, "saved-week");
  const cancel = await f.send("cancelWeekDraft", { expectedRevision: 3, weekId: op(101) }, 5, basis, changed); assert.equal(cancel.body.result.outcome, "acknowledged"); assert.equal(cancel.body.result.state.draft, null); assert.equal(cancel.body.result.state.current.weekId, op(100));
  const draftAgain = await f.send("createWeekDraft", { ...payload, expectedRevision: 4 }, 6, currentBasis, newer); assert.equal(draftAgain.body.result.state.revision, 5);
  const confirm = await f.send("confirmNewWeek", { expectedRevision: 5, weekId: op(101) }, 7, currentBasis, newer); assert.equal(confirm.body.result.outcome, "acknowledged"); assert.equal(confirm.body.result.state.current.weekId, op(101));
  const original = await f.send("operationStatus", { targetOperationId: op(1) }, 8, null, newer); assert.equal(original.body.result.receipt.state.revision, 1); assert.equal(original.body.result.receipt.saved, true);
});

test("V2 preview and saved replacement use exact versioned proof and stale revision guards", async () => {
  const f = syntheticV2(); await f.send("installCurrent", f.initial);
  // This fixture owns only buy-a. A larger valid portion consumes the already
  // reserved final pack; a new buy-b would now correctly require groceries.
  const a = f.assignments[0]!, intent = { assignmentId: a.assignmentId, personId: a.personId, expectedRecipeSha256: a.recipeSha256, replacementRecipeId: "a", sourceServings: { numerator: "4", denominator: "1" } };
  const preview = await f.send("previewReplacement", { request: f.request, assignments: f.assignments, intent }, 2); assert.equal(preview.body.result.outcome, "replacement-preview");
  const p = preview.body.result, payload = { expectedRevision: 1, weekId: op(100), intent, expectedPreviewSha256: p.previewSha256, expectedRequestSha256: p.requestSha256, expectedAssignmentsSha256: p.baseAssignmentsSha256 };
  const save = await f.send("saveReplacement", payload, 3); assert.equal(save.body.result.outcome, "acknowledged"); assert.equal(save.body.result.state.current.view.meals[0].recipeId, "a");
  assert.equal((await f.send("saveReplacement", payload, 4)).body.result.code, "revision_conflict");
});

test("V2 8MiB request/16MiB response boundaries preserve known commit and lost acknowledgement", async () => {
  const f = syntheticV2(), rows = structuredClone(f.rows), row = rows[0]!;
  row.recipe.steps = Array.from({ length: 82 }, (_, i) => ({ id: i + 1, instruction: "Synthetic capacity-only instruction. " + ".".repeat(4950), allocations: i === 0 ? row.recipe.steps[0]!.allocations : [] }));
  row.recipe_sha256 = hashV2(row.recipe); row.nutrition.source_refresh.exact_recipe_body_sha256 = row.recipe_sha256; row.nutrition.source_refresh.recipe_sha256_unchanged = row.recipe_sha256;
  for (const r of rows) r.sections = ["breakfast", "lunch", "dinner"];
  const bytes = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n"), configuration = { ...f.configuration, sourcePin: { sha256: createHash("sha256").update(bytes).digest("hex"), recordCount: 2 }, schedulePolicy: "wd-seven-day-three-meals-v1" };
  const request = { ...f.request, budgetCents: 1000000, slots: ["breakfast", "lunch", "dinner"], people: f.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, coverage: "full-day" } })) };
  const assignments = request.selectedDays.flatMap(date => request.people.flatMap((p, i) => request.slots.map(slot => ({ assignmentId: p.personId + date + slot, personId: p.personId, profileRevision: p.profileRevision, date, slot, recipeId: "a", recipeSha256: row.recipe_sha256, sourceServings: { numerator: String(i + 3), denominator: "1" } }))));
  const candidate = createReferenceSessionHandlerV2(bytes, configuration, { ...f.options, labels: labelsV2 }); if (candidate.outcome !== "ready") throw Error("Expected capacity handler"); const handler = candidate;
  async function send(operation: string, payload: unknown, id: number, oversized = false, activeHandler = handler) {
    const intent = { contract: "wd-joined-session-proposal-v2", operation, operationId: op(id), sourceSha256: configuration.sourcePin.sha256, expectedSourcePolicyBasisSha256: ["operationStatus", "readCurrent"].includes(operation) ? null : activeHandler.sourcePolicyBasis!.basisSha256, payload };
    const response = await activeHandler.handle(new Request("http://private.invalid/capacity-v2", { method: "POST", headers: { "content-type": "application/json" }, body: (oversized ? " ".repeat(8 * 1024 * 1024) : "") + JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }) }));
    const text = await response.text(); assert.ok(Buffer.byteLength(text) < 16 * 1024 * 1024); return { status: response.status, body: JSON.parse(text) };
  }
  const rejected = await send("readCurrent", {}, 1, true); assert.equal(rejected.status, 413); assert.equal(rejected.body.result.code, "body_capacity_exceeded");
  const pure = await send("evaluateJoined", { request, assignments }, 2); assert.equal(pure.status, 422); assert.equal(pure.body.result.saved, false); assert.equal(pure.body.result.writeOutcome, "not-requested");
  f.memory.failOnce("after-commit"); const payload = { expectedRevision: 0, weekId: op(100), request, assignments, pantryEntries: [] };
  const lost = await send("installCurrent", payload, 3); assert.equal(lost.status, 202); assert.equal(lost.body.result.outcome, "unknown"); assert.equal(Object.hasOwn(lost.body.result, "saved"), false);
  assert.equal((await send("installCurrent", payload, 3)).body.result.code, "operation_status_required");
  const status = await send("operationStatus", { targetOperationId: op(3) }, 4); assert.equal(status.status, 422); assert.equal(status.body.result.saved, true); assert.equal(status.body.result.writeOutcome, "committed"); assert.equal(status.body.result.revision, 1); assert.equal(status.body.result.reconcileOperationStatus, false); assert.equal(status.body.result.committedSourcePolicyBasisSha256, handler.sourcePolicyBasis!.basisSha256);
  const duplicate = await send("installCurrent", payload, 3); assert.equal(duplicate.body.result.saved, true); assert.equal(duplicate.body.result.revision, 1); assert.equal(duplicate.body.result.reconcileOperationStatus, true);
  // Main's actual counterexample: old-basis current plus new-basis draft.
  const changed = createReferenceSessionHandlerV2(bytes, { ...configuration, correspondences: [...configuration.correspondences].reverse() }, { ...f.options, labels: labelsV2 }); if (changed.outcome !== "ready") throw Error("Expected changed capacity handler");
  const nextRequest = { ...request, selectedDays: request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, nextAssignments = assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "n", date: a.date.replace("2026-10-", "2026-11-") }));
  const drafted = await send("createWeekDraft", { expectedRevision: 1, weekId: op(101), request: nextRequest, assignments: nextAssignments, pantryEntries: [], pantryReconfirmed: true }, 7, false, changed);
  assert.equal(drafted.status, 422); assert.equal(drafted.body.result.saved, true); assert.equal(drafted.body.result.revision, 2); assert.equal(drafted.body.result.committedSourcePolicyBasisSha256, changed.sourcePolicyBasis!.basisSha256);
  // Recreate repository/handler and drift back. Current view is now the large
  // old week, draft is held, but operation7 committed under the NEW basis.
  const reopened = createReferenceSessionHandlerV2(bytes, configuration, { ...f.options, labels: labelsV2 }); if (reopened.outcome !== "ready") throw Error("Expected reopened handler");
  const laterStatus = await send("operationStatus", { targetOperationId: op(7) }, 8, false, reopened);
  assert.equal(laterStatus.status, 422); assert.equal(laterStatus.body.result.saved, true); assert.equal(laterStatus.body.result.revision, 2); assert.equal(laterStatus.body.result.targetOperationId, op(7)); assert.equal(laterStatus.body.result.reconcileOperationStatus, false); assert.equal(laterStatus.body.result.committedSourcePolicyBasisSha256, changed.sourcePolicyBasis!.basisSha256);
});
