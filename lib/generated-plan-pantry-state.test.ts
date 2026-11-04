import test from "node:test";
import assert from "node:assert/strict";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { issueLocalReferenceScope } from "./generated-plan-state.ts";
import { pantryFixture } from "./generated-plan-pantry-state.test-support.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { hash } from "../scripts/data/price-evidence.ts";

let serial = 0;
function fixture() {
  const f = pantryFixture(), memory = memoryPort(), scope = issueLocalReferenceScope("pantry-state-" + serial++, 1);
  function bind(configuration = f.configuration) {
    const bound = createReferenceSessionHandler(f.bytes, configuration, { labels: [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }], transactions: memory.port, resolveScope: () => scope, newWeekPolicy: "wd-new-week-reconfirm-v1" });
    if (bound.outcome !== "ready") throw new Error("Expected synthetic binding");
    return async (operation: string, payload: unknown, id = 1) => {
      const value = { contract: REFERENCE_SESSION_CONTRACT, operation, payload, operationId: op(id), sourceSha256: f.configuration.sourcePin.sha256 };
      const response = await bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...value, intentSha256: referenceOperationDigest(value) }) })); return (await response.json()).result;
    };
  }
  return { ...f, memory, bind, send: bind(), initial: { weekId: op(100), expectedRevision: 0, request: f.request, assignments: f.assignments, pantryEntries: f.entries } };
}
test("original practical pantry evidence survives a save and status replay without leaking line prices", async () => {
  const f = fixture(), installed = await f.send("installCurrent", f.initial);
  assert.equal(installed.outcome, "acknowledged");
  const current = installed.state.current;
  assert.equal(current.view.outcome, "saved-week");
  assert.match(current.pantryBasisSha256, /^[a-f0-9]{64}$/);
  let inspected = false;
  f.memory.tamperState(state => {
    const basis = (state.current as unknown as { pantryBasis: { entries: unknown; prepared: { records: unknown[] }; basisSha256: string } }).pantryBasis;
    assert.deepEqual(basis.entries, f.entries); assert.equal(basis.prepared.records.length, 1);
    assert.equal(basis.basisSha256, current.pantryBasisSha256); inspected = true; return state;
  });
  assert.equal(inspected, true);
  assert.deepEqual(await f.send("installCurrent", f.initial), installed);
  assert.deepEqual((await f.send("operationStatus", { targetOperationId: op(1) }, 2)).receipt, installed);
  assert.equal(JSON.stringify(installed).includes("packPriceCents"), false);
});
test("equal stock with changed measure or purchase evidence holds saved views and mutations", async () => {
  const f = fixture(); assert.equal((await f.send("installCurrent", f.initial)).outcome, "acknowledged");
  for (const kind of ["measure", "binding"] as const) {
    const configuration = structuredClone(f.configuration);
    if (kind === "measure") configuration.pantryIntake.measureFacts[0]!.sourceSha256 = "c".repeat(64);
    else configuration.pantryIntake.purchaseBindings[0]!.sourceSha256 = "c".repeat(64);
    const changed = f.bind(configuration), read = await changed("readCurrent", {}, 2);
    assert.equal(read.outcome, "read"); assert.equal(read.state.current.view.code, "saved_pantry_basis_changed");
    const status = await changed("operationStatus", { targetOperationId: op(1) }, 3);
    assert.equal(status.receipt.saved, true); assert.equal(status.receipt.state.current.view.code, "saved_pantry_basis_changed");
    assert.equal((await changed("shoppingCheck", { expectedRevision: 1, weekId: op(100), itemKey: "unused", fingerprint: "unused", checked: true }, 4)).code, "saved_pantry_basis_changed");
  }
});
test("different original observation requires a fresh replacement preview even for identical stock", async () => {
  const f = fixture(); assert.equal((await f.send("installCurrent", f.initial)).outcome, "acknowledged");
  const intent = { personId: "p1", assignmentId: f.assignments[0]!.assignmentId, replacementRecipeId: "b", expectedRecipeSha256: f.assignments[0]!.recipeSha256, sourceServings: { numerator: "3", denominator: "1" } };
  const preview = await f.send("previewReplacement", { request: f.request, assignments: f.assignments, intent, pantryEntries: f.entries }, 2);
  assert.equal(preview.outcome, "replacement-preview");
  const payload = { expectedRevision: 1, weekId: op(100), intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256, expectedPantryBasisSha256: preview.pantryBasisSha256 };
  const altered = [{ ...f.entries[0]!, pantryId: "different-observation" }];
  assert.equal((await f.send("saveCurrent", { ...f.initial, expectedRevision: 1, pantryEntries: altered }, 3)).outcome, "acknowledged");
  assert.equal((await f.send("saveReplacement", { ...payload, expectedRevision: 2 }, 4)).code, "stale_pantry_basis");
});
test("unmapped custom input is held as incomplete stock and cannot partially save", async () => {
  const f = fixture(), custom = { pantryId: "custom", kind: "custom", label: "Unmapped food", amountText: "half a bag" };
  const result = await f.send("installCurrent", { ...f.initial, pantryEntries: [...f.entries, custom] });
  assert.equal(result.outcome, "held"); assert.equal(result.pantry, null);
  assert.equal((await f.send("readCurrent", {}, 2)).state.current, null);
});
test("numeric-only legacy nonempty stock cannot acquire invented provenance", async () => {
  const f = fixture(); assert.equal((await f.send("installCurrent", f.initial)).outcome, "acknowledged");
  f.memory.tamperState(state => {
    const body = structuredClone(state.current) as unknown as Record<string, unknown>; delete body.pantryBasis; delete body.contentSha256;
    return { ...state, current: { ...body, contentSha256: hash(canonicalReferenceData(body)) } as typeof state.current };
  });
  assert.equal((await f.send("readCurrent", {}, 2)).code, "pantry_provenance_migration_required");
});
test("bounded fractions preserve observations and exact stock through the durable boundary", async () => {
  for (const denominator of [1, 2, 3, 7, 13]) {
    const f = fixture(), entries = [{ ...f.entries[0]!, amount: { numerator: "1", denominator: String(denominator) } }];
    const result = await f.send("installCurrent", { ...f.initial, pantryEntries: entries }); assert.equal(result.outcome, "acknowledged");
    f.memory.tamperState(state => { const current = state.current as unknown as { pantryBasis: { entries: unknown }; request: { pantry: { quantity: { numerator: number; denominator: number } }[] } }; assert.deepEqual(current.pantryBasis.entries, entries); const q = current.request.pantry[0]!.quantity; assert.equal(q.numerator * denominator, 120 * q.denominator); return state; });
  }
});

test("successful person-only replacement retains the exact pantry basis and other assignments", async () => {
  const f = fixture(), installed = await f.send("installCurrent", f.initial);
  const intent = { personId: "p1", assignmentId: f.assignments[0]!.assignmentId, replacementRecipeId: "b", expectedRecipeSha256: f.assignments[0]!.recipeSha256, sourceServings: { numerator: "3", denominator: "1" } };
  const preview = await f.send("previewReplacement", { request: f.request, assignments: f.assignments, intent, pantryEntries: f.entries }, 2);
  const payload = { expectedRevision: 1, weekId: op(100), intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256, expectedPantryBasisSha256: preview.pantryBasisSha256 };
  const result = await f.send("saveReplacement", payload, 3); assert.equal(result.outcome, "acknowledged");
  assert.equal(result.state.current.pantryBasisSha256, installed.state.current.pantryBasisSha256);
  assert.deepEqual(result.state.current.view.meals.filter((m: { personId: string }) => m.personId === "p2"), installed.state.current.view.meals.filter((m: { personId: string }) => m.personId === "p2"));
  assert.deepEqual(await f.send("saveReplacement", payload, 3), result);
});
test("new-week reconfirmation binds original observations rather than only equal numeric stock", async () => {
  const f = fixture(); await f.send("installCurrent", f.initial);
  const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "next", date: a.date.replace("2026-10-", "2026-11-") }));
  const payload = { ...f.initial, expectedRevision: 1, weekId: op(101), request, assignments, pantryReconfirmed: true };
  const draft = await f.send("createWeekDraft", payload, 2); assert.equal(draft.outcome, "acknowledged");
  const changedConfig = structuredClone(f.configuration); changedConfig.pantryIntake.measureFacts[0]!.sourceSha256 = "c".repeat(64);
  const changed = f.bind(changedConfig); assert.equal((await changed("confirmNewWeek", { expectedRevision: 2, weekId: op(101) }, 3)).code, "saved_pantry_basis_changed");
  const read = await f.send("readCurrent", {}, 4); assert.equal(read.state.current.weekId, op(100)); assert.equal(read.state.draft.weekId, op(101)); assert.equal(read.state.revision, 2);
});
test("forged saved pantry quantities and unknown fields fail closure even with a refreshed outer hash", async () => {
  for (const mode of ["stock", "field"] as const) {
    const f = fixture(); await f.send("installCurrent", f.initial);
    f.memory.tamperState(state => {
      const body = structuredClone(state.current) as unknown as Record<string, unknown>; delete body.contentSha256;
      if (mode === "stock") (body.request as { pantry: { quantity: { numerator: number } }[] }).pantry[0]!.quantity.numerator++;
      else (body.pantryBasis as Record<string, unknown>).trusted = true;
      return { ...state, current: { ...body, contentSha256: hash(canonicalReferenceData(body)) } as typeof state.current };
    });
    assert.equal((await f.send("readCurrent", {}, 2)).code, "stored_pantry_basis_invalid");
  }
});
