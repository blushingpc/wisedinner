import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { presentGroceries } from "./generated-plan-presenter.ts";
import { ownCopy } from "./owner-plan-codec.ts";
import { shoppingRowIdentity, reconcileShoppingChecks, rebindConfirmedPurchaseChecks, setShoppingCheck } from "./generated-plan-shopping.ts";
import { syntheticV2 } from "./generated-plan-v2.test-support.ts";

const labels = [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }];
function evaluated() { const f = setup(), result = f.planner.evaluateJoined(f.assignments, f.request); if (result.outcome !== "success") throw new Error("Expected synthetic evaluation"); return { ...f, result }; }

function confirmedQuotes() {
  const f = syntheticV2(), a = f.assignments[0]!;
  const intent = { assignmentId: a.assignmentId, personId: a.personId, expectedRecipeSha256: a.recipeSha256, replacementRecipeId: "a", sourceServings: { numerator: "4", denominator: "1" } };
  const p = f.binding.planner.previewReplacement(f.assignments, f.request, intent);
  if (p.outcome !== "preview") throw Error("real synthetic preview required");
  return { before: p.before.quote, after: p.after.quote };
}

test("confirmed purchase rebinding keeps allocation fingerprints strict and preserves explicit unchecks", () => {
  const { before, after } = confirmedQuotes(), identity = shoppingRowIdentity(before, before.rows[0]!);
  assert.notEqual(identity.fingerprint, shoppingRowIdentity(after, after.rows[0]!).fingerprint);
  for (const checked of [true, false]) {
    const entries = [{ ...identity, checked }], strict = reconcileShoppingChecks(after, entries), carried = rebindConfirmedPurchaseChecks(before, after, entries);
    assert.equal(strict.outcome, "reconciled"); if (strict.outcome === "reconciled") assert.equal(strict.rows[0]!.checked, false);
    assert.equal(carried.outcome, "rebound"); if (carried.outcome !== "rebound") throw Error("rebound expected");
    assert.equal(carried.rows[0]!.checked, checked);
    assert.deepEqual(setShoppingCheck(after, carried.rows, { ...identity, checked: true }), { outcome: "error", code: "stale_shopping_row" });
    const nextIdentity = shoppingRowIdentity(after, after.rows[0]!);
    const unchecked = setShoppingCheck(after, carried.rows, { ...nextIdentity, checked: false });
    assert.equal(unchecked.outcome, "updated"); if (unchecked.outcome === "updated") assert.equal(unchecked.rows[0]!.checked, false);
  }
});

test("purchase custody refuses pack/quantity/SKU/form/unit/fact/evidence/context drift and insufficient original stock", () => {
  const { before, after } = confirmedQuotes(), entries = before.rows.map(r => ({ ...shoppingRowIdentity(before, r), checked: true }));
  const variants = [
    { ...after, rows: after.rows.map(r => ({ ...r, packCount: r.packCount + 1 })) },
    { ...after, rows: after.rows.map(r => ({ ...r, purchasedQuantity: { numerator: "9999", denominator: "1" } })) },
    { ...after, rows: after.rows.map(r => ({ ...r, packQuantity: { numerator: "99", denominator: "1" } })) },
    { ...after, rows: after.rows.map(r => ({ ...r, skuId: "new-sku" })) },
    { ...after, rows: [...after.rows, { ...after.rows[0]!, skuId: "added-sku" }] },
    { ...after, rows: [] },
    { ...after, rows: after.rows.map(r => ({ ...r, formDigest: "0".repeat(64) })) },
    { ...after, rows: after.rows.map(r => ({ ...r, unit: "ml" as const })) },
    { ...after, rows: after.rows.map(r => ({ ...r, factId: "other-fact" })), factPins: after.factPins.map(f => ({ ...f, id: "other-fact" })) },
    { ...after, factPins: after.factPins.map(f => ({ ...f, factSha256: "0".repeat(64) })) },
    { ...after, rows: after.rows.map(r => ({ ...r, estimatedLineCents: { min: 1, max: 1 } })) },
    { ...after, asOfDate: "2026-10-19" },
    { ...after, region: "West" as const },
    { ...after, storeIds: ["another-store"] },
    { ...after, rows: after.rows.map(r => ({ ...r, toBuy: { numerator: "999999", denominator: "1" } })) },
  ];
  for (const changed of variants) assert.notEqual(rebindConfirmedPurchaseChecks(before, changed, entries).outcome, "rebound");
  assert.notEqual(rebindConfirmedPurchaseChecks(before, after, entries.map(e => ({ ...e, fingerprint: "0".repeat(64) }))).outcome, "rebound");
  let reads = 0;
  const getter = Object.defineProperty({ ...after }, "rows", { enumerable: true, get() { reads++; return after.rows; } });
  assert.equal(rebindConfirmedPurchaseChecks(before, getter, entries).outcome, "error"); assert.equal(reads, 0);
  assert.equal(rebindConfirmedPurchaseChecks(before, after, [{ ...entries[0], checked: true, approved: true }]).outcome, "error");
});

test("shopping identity and fingerprint survive canonical serialization and presenter projection", () => {
  const { result } = evaluated(), original = shoppingRowIdentity(result.quote, result.quote.rows[0]!), copied = ownCopy(result.quote) as typeof result.quote;
  assert.deepEqual(shoppingRowIdentity(copied, copied.rows[0]!), original);
  const view = presentGroceries(result, labels); if (view.outcome !== "groceries") throw new Error("Expected grocery view"); assert.equal(view.groups[0]!.items[0]!.fingerprint, original.fingerprint);
});

test("unchanged current rows retain checks; changed source and pantry-covered removal invalidate them", () => {
  const { result, planner, request, assignments } = evaluated(), identity = shoppingRowIdentity(result.quote, result.quote.rows[0]!), checked = [{ ...identity, checked: true }];
  const same = reconcileShoppingChecks(result.quote, checked); assert.equal(same.outcome, "reconciled"); if (same.outcome !== "reconciled") return; assert.equal(same.rows[0]!.checked, true);
  const changed = { ...result.quote, factPins: result.quote.factPins.map(value => ({ ...value, factSha256: "0".repeat(64) })) }, reset = reconcileShoppingChecks(changed, checked);
  assert.equal(reset.outcome, "reconciled"); if (reset.outcome === "reconciled") assert.equal(reset.rows[0]!.checked, false);
  const covered = planner.evaluateJoined(assignments, { ...request, pantry: [{ skuId: "buy-a", unit: "g", formDigest: "d".repeat(64), quantity: { numerator: 9000, denominator: 1 } }] }); if (covered.outcome !== "success") throw new Error("Expected pantry-covered reference");
  const removed = reconcileShoppingChecks(covered.quote, checked); assert.equal(removed.outcome, "reconciled"); if (removed.outcome === "reconciled") { assert.equal(removed.rows.length, 0); assert.deepEqual(removed.removedItemKeys, [identity.itemKey]); }
});

test("stale fingerprints, nonboolean checks, duplicate entries and getters refuse without mutation", () => {
  const { result } = evaluated(), identity = shoppingRowIdentity(result.quote, result.quote.rows[0]!), entries = [{ ...identity, checked: false }], before = JSON.stringify(entries); let reads = 0;
  const getter = Object.defineProperty({ ...identity }, "checked", { enumerable: true, get() { reads++; return true; } });
  for (const command of [getter, { ...identity, checked: "true" }, { ...identity, checked: true, approved: true }, { ...identity, fingerprint: "0".repeat(64), checked: true }]) assert.equal(setShoppingCheck(result.quote, entries, command).outcome, "error");
  assert.equal(reconcileShoppingChecks(result.quote, [entries[0], entries[0]]).outcome, "error"); assert.equal(reads, 0); assert.equal(JSON.stringify(entries), before);
});

test("acknowledged shopping checks replay and survive a repository restart", async () => {
  const { planner, request, assignments, result } = evaluated(), memory = memoryPort(), scope = issueLocalReferenceScope("shopping-save", 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  await repository.applyPlanCommand(scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments });
  const row = shoppingRowIdentity(result.quote, result.quote.rows[0]!), command = { operationId: op(2), kind: "set-shopping-check", expectedRevision: 1, weekId: op(100), ...row, checked: true };
  const saved = await repository.applyPlanCommand(scope, command); assert.equal(saved.outcome, "acknowledged"); if (saved.outcome !== "acknowledged") return;
  assert.equal(saved.state.current!.shoppingChecks.status, "ready"); if (saved.state.current!.shoppingChecks.status === "ready") assert.equal(saved.state.current!.shoppingChecks.rows[0]!.checked, true);
  const restarted = createReferencePlanRepository({ planner, transactions: memory.port }); assert.deepEqual(await restarted.applyPlanCommand(scope, command), saved);
  const read = await restarted.read(scope); if (read.outcome === "read") assert.deepEqual(read.state.current!.shoppingChecks, saved.state.current!.shoppingChecks);
  assert.equal((await repository.applyPlanCommand(scope, { ...command, operationId: op(3), weekId: op(101), expectedRevision: 2 })).outcome, "error");
});

test("meal changes invalidate the affected row check without silently retaining a stale purchase", async () => {
  const { planner, request, assignments, result } = evaluated(), memory = memoryPort(), scope = issueLocalReferenceScope("shopping-change", 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  await repository.applyPlanCommand(scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments });
  const identity = shoppingRowIdentity(result.quote, result.quote.rows[0]!); await repository.applyPlanCommand(scope, { operationId: op(2), kind: "set-shopping-check", expectedRevision: 1, weekId: op(100), ...identity, checked: true });
  const changed = assignments.map((value, i) => i === 0 ? { ...value, sourceServings: { numerator: "5", denominator: "1" } } : value), saved = await repository.applyPlanCommand(scope, { operationId: op(3), kind: "save-current", expectedRevision: 2, weekId: op(100), request, assignments: changed });
  assert.equal(saved.outcome, "acknowledged"); if (saved.outcome === "acknowledged" && saved.state.current!.shoppingChecks.status === "ready") assert.equal(saved.state.current!.shoppingChecks.rows[0]!.checked, false);
});

test("a distinct new-week draft leaves its checklist policy held, not copied or reset", async () => {
  const { planner, request, assignments } = evaluated(), memory = memoryPort(), scope = issueLocalReferenceScope("shopping-new-week", 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  const first = await repository.applyPlanCommand(scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments });
  const nextRequest = { ...request, selectedDays: request.selectedDays.map(value => value.replace("2026-10-", "2026-11-")) }, nextAssignments = assignments.map(value => ({ ...value, assignmentId: value.assignmentId + "new", date: value.date.replace("2026-10-", "2026-11-") }));
  const draft = await repository.applyPlanCommand(scope, { operationId: op(2), kind: "create-week-draft", expectedRevision: 1, weekId: op(101), request: nextRequest, assignments: nextAssignments });
  assert.equal(draft.outcome, "acknowledged"); if (draft.outcome === "acknowledged" && first.outcome === "acknowledged") { assert.deepEqual(draft.state.current, first.state.current); assert.equal(draft.state.draft!.shoppingChecks.status, "held"); }
});

test("lost checkbox acknowledgement reconciles the same operation before replay", async () => {
  const { planner, request, assignments, result } = evaluated(), memory = memoryPort(), scope = issueLocalReferenceScope("shopping-ack", 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  await repository.applyPlanCommand(scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments });
  const identity = shoppingRowIdentity(result.quote, result.quote.rows[0]!), command = { operationId: op(2), kind: "set-shopping-check", expectedRevision: 1, weekId: op(100), ...identity, checked: true }; memory.failOnce("after-commit");
  assert.equal((await repository.applyPlanCommand(scope, command)).outcome, "unknown"); assert.equal((await repository.applyPlanCommand(scope, command)).outcome, "held");
  assert.equal((await repository.getOperationStatus(scope, op(2))).outcome, "committed"); assert.equal((await repository.applyPlanCommand(scope, command)).outcome, "acknowledged");
});

test("changed current quantity resets only its affected purchase check", () => {
  const { planner, request, assignments, rows } = evaluated();
  const mixed = assignments.map((value, i) => i === 0 ? { ...value, recipeId: "b", recipeSha256: rows[1]!.recipe_sha256 } : value), before = planner.evaluateJoined(mixed, request);
  const changed = planner.evaluateJoined(mixed.map((value, i) => i === 2 ? { ...value, sourceServings: { numerator: "5", denominator: "1" } } : value), request);
  if (before.outcome !== "success" || changed.outcome !== "success") throw new Error("Expected mixed reference weeks");
  const checked = before.quote.rows.map(row => ({ ...shoppingRowIdentity(before.quote, row), checked: true })), reconciled = reconcileShoppingChecks(changed.quote, checked);
  if (reconciled.outcome !== "reconciled") throw new Error("Expected current reconciliation");
  const a = shoppingRowIdentity(changed.quote, changed.quote.rows.find(row => row.skuId === "buy-a")!).itemKey, b = shoppingRowIdentity(changed.quote, changed.quote.rows.find(row => row.skuId === "buy-b")!).itemKey;
  assert.equal(reconciled.rows.find(row => row.itemKey === a)!.checked, false); assert.equal(reconciled.rows.find(row => row.itemKey === b)!.checked, true);
  const view = presentGroceries(changed, labels, reconciled.rows); if (view.outcome !== "groceries") throw new Error("Expected grocery DTO");
  assert.equal(view.groups.flatMap(group => group.items).find(row => row.skuId === "buy-b")!.checked, true);
});

test("an older draft payload is held for explicit checklist migration rather than silently reset", async () => {
  const { planner, request, assignments } = evaluated(), memory = memoryPort(), scope = issueLocalReferenceScope("shopping-migration", 1), repository = createReferencePlanRepository({ planner, transactions: memory.port });
  await repository.applyPlanCommand(scope, { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request, assignments });
  memory.tamperState(state => { const current = { ...state.current! }; delete (current as { shoppingChecks?: unknown }).shoppingChecks; return { ...state, current }; });
  assert.deepEqual(await repository.read(scope), { outcome: "held", code: "reference_checklist_migration_required" });
});
