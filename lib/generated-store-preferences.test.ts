// Synthetic compatibility fixtures, not real shop availability or price evidence.
import test from "node:test";
import assert from "node:assert/strict";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
import { createNativeIntakeAdapter, nativePersonAnswerDigest } from "./generated-native-intake.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { issueLocalReferenceScope } from "./generated-plan-state.ts";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";

const shops = Array.from({ length: 9 }, (_, i) => "fixture-shop-" + i);
const allShops = [...shops, "fixture-reviewed-other"];
const quotedRequest = (storeIds: unknown) => ({ region: "South", storeIds, budgetCents: 1000, asOfDate: "2026-10-18" });
const required = [{ skuId: "fixture-food", category: "pantry", unit: "g", formDigest: "a".repeat(64), perishable: false, purchasedNeed: { numerator: 750, denominator: 1 } }];
const owned = [{ skuId: "fixture-food", unit: "g", formDigest: "a".repeat(64), quantity: { numerator: 100, denominator: 1 } }];
const facts = [{ id: "fixture-pack", skuId: "fixture-food", unit: "g", formDigest: "a".repeat(64), region: "South", packQuantity: { numerator: "500", denominator: "1" }, packPriceCents: { min: 200, max: 300 }, currency: "USD", observedOn: "2026-10-01", usableThrough: "2026-10-31", sourceSha256: "b".repeat(64), basis: "synthetic-test-only", flags: ["not-market-data"] }];

function fullWeek(storeIds: string[]) {
  const f = setup(), rows = f.rows.map(r => ({ ...r, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  const configuration = { ...f.configuration, sourcePin: { sha256: sha(bytes), recordCount: rows.length }, schedulePolicy: "wd-seven-day-three-meals-v1" as const };
  const request = { ...f.request, storeIds, slots: ["breakfast", "lunch", "dinner"], people: f.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, coverage: "full-day" } })) };
  const assignments = request.selectedDays.flatMap(date => request.people.flatMap((p, i) => request.slots.map(slot => ({ assignmentId: p.personId + date + slot, personId: p.personId, profileRevision: p.profileRevision, date, slot, recipeId: "a", recipeSha256: rows[0]!.recipe_sha256, sourceServings: { numerator: i ? "4" : "1", denominator: i ? "3" : "1" } }))));
  const binding = createJoinedReferencePlanner(bytes, configuration);
  assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") throw Error("Synthetic binding");
  return { bytes, configuration, request, assignments, planner: binding.planner };
}

test("explicit no-preference and every bounded mapped store count preserve exact whole-pack calculations", () => {
  for (let count = 0; count <= 101; count++) {
    const storeIds = Array.from({ length: count }, (_, i) => "fixture-" + i), original = [...storeIds];
    const result = quoteRegionalEstimates(quotedRequest(storeIds), required, owned, facts);
    assert.equal(result.outcome, "quoted", "store count " + count); if (result.outcome !== "quoted") continue;
    assert.deepEqual(result.storeIds, original); assert.deepEqual(storeIds, original); assert.equal(Object.isFrozen(storeIds), false);
    assert.deepEqual(result.estimatedTotalCents, { min: 400, max: 600 }); assert.equal(result.uniqueBuyItemCount, 1);
    assert.deepEqual(result.rows[0]!.purchasedLeftover, { numerator: "350", denominator: "1" });
    assert.equal(result.liveRetailerPricing, false); assert.equal(result.adoptionGranted, false);
  }
});

test("store context still refuses missing, malformed, hostile, duplicate and over-cap arrays without coercion", () => {
  let reads = 0;
  const getter = Object.defineProperty(["safe"], "0", { enumerable: true, get() { reads++; return "unsafe"; } });
  const symbol = ["safe"]; Object.defineProperty(symbol, Symbol("extra"), { value: true });
  const extra = Object.assign(["safe"], { extra: true });
  const inherited = ["safe"]; Object.setPrototypeOf(inherited, Object.create(Array.prototype));
  const invalid: unknown[] = [undefined, null, "", [" "], ["same", "same"], Array.from({ length: 102 }, (_, i) => "s" + i), new Array(1), getter, symbol, extra, inherited, [{ toString() { reads++; return "shop"; } }]];
  for (const storeIds of invalid) assert.equal(quoteRegionalEstimates(quotedRequest(storeIds), required, owned, facts).outcome, "error");
  const { storeIds: omitted, ...missing } = quotedRequest([]); void omitted;
  assert.equal(quoteRegionalEstimates(missing, required, owned, facts).outcome, "error"); assert.equal(reads, 0);
});

test("native optional shops, all nine choices and reviewed Other survive without invented retailer mappings", () => {
  const people = [{ id: "p1", name: "Fixture", avatar: 0, protein: "90", proteinUnknown: false, lastKnownProtein: "", calories: "", exclusions: { answer: "none", listed: [], custom: "" } }];
  const mappings = shops.map((id, i) => ({ kind: "listed", label: "Synthetic shop " + i, id, sourceSha256: "b".repeat(64) }));
  const configuration = { sourceSha256: "a".repeat(64), storeMappings: [...mappings, { kind: "other", label: "Reviewed local shop", id: allShops[9]!, sourceSha256: "c".repeat(64) }], equipmentMappings: [] };
  const bound = createNativeIntakeAdapter(configuration); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const draft = { schema: "wd-native-ui-draft-v1", nextPerson: 2, primaryPersonId: "p1", people, budget: "100.01", coverage: "wd-seven-day-three-meals-v1", dietaryRule: "No set pattern", additionalRule: "", equipment: [], equipmentReviewed: true, stores: { labels: [] as string[], other: "" }, pantry: [], pantryEntry: { name: "", amount: "", form: "" }, mode: "current", startDate: "2026-10-19", weekly: {} };
  const context = { sourceSha256: configuration.sourceSha256, region: "South", asOfDate: "2026-10-18", startDate: draft.startDate, profiles: [{ personId: "p1", profileRevision: 7, answerSha256: nativePersonAnswerDigest(people[0]) }] };
  for (const n of [0, 1, 3, 4, 9]) for (const other of ["", "Reviewed local shop"]) {
    const result = bound.prepare({ ...draft, stores: { labels: mappings.slice(0, n).map(m => m.label), other } }, context);
    assert.equal(result.outcome, "ready", n + "/" + other); if (result.outcome !== "ready") continue;
    assert.deepEqual(result.request.storeIds, [...shops.slice(0, n), ...(other ? [allShops[9]!] : [])]); assert.equal(result.request.people[0]!.profileRevision, 7);
    assert.equal(result.request.budgetCents, 10001); assert.equal(result.acceptedByNative, false);
  }
  const unknown = bound.prepare({ ...draft, stores: { labels: [], other: "Unmapped shop" } }, context);
  assert.equal(unknown.outcome, "held"); if (unknown.outcome === "held") { assert.equal(unknown.request, null); assert.ok(unknown.issues.some(i => i.code === "store_mapping_required")); }
});

test("full42 two-person plans accept no preference and all mapped shops without changing nutrition or budget constraints", () => {
  const none = fullWeek([]), many = fullWeek(allShops);
  const a = none.planner.evaluateJoined(none.assignments, none.request), b = many.planner.evaluateJoined(many.assignments, many.request);
  assert.equal(a.outcome, "success"); assert.equal(b.outcome, "success"); if (a.outcome !== "success" || b.outcome !== "success") return;
  assert.equal(a.projection.assignments.length, 42); assert.deepEqual(a.projection, b.projection);
  assert.deepEqual(a.quote.estimatedTotalCents, b.quote.estimatedTotalCents); assert.deepEqual(a.quote.storeIds, []); assert.deepEqual(b.quote.storeIds, allShops);
  assert.equal(none.planner.evaluateJoined(none.assignments, { ...none.request, budgetCents: 1 }).outcome, "no_fit");
  assert.equal(many.planner.evaluateJoined(many.assignments, { ...many.request, people: [{ ...many.request.people[0], proteinGoal: { kind: "unknown" } }, many.request.people[1]] }).outcome, "held");
});

test("composed42 meal proposals and person-only replacements bind ordered store preferences into preview confirmation", async () => {
  const f = fullWeek(allShops), memory = memoryPort(), scope = issueLocalReferenceScope("store-preference-memory-synthetic", 1);
  const binding = createReferenceSessionHandler(f.bytes, f.configuration, { labels: [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }], transactions: memory.port, resolveScope: () => scope });
  assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") return;
  const bound = binding;
  let serial = 1;
  async function send(operation: string, payload: unknown) {
    const body = { contract: REFERENCE_SESSION_CONTRACT, operation, payload, operationId: op(serial++), sourceSha256: f.configuration.sourcePin.sha256 };
    const response = await bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, intentSha256: referenceOperationDigest(body) }) }));
    return (await response.json()).result;
  }
  const base = { request: f.request, assignments: f.assignments }, before = await send("evaluateJoined", base);
  assert.equal(before.outcome, "week-proposal"); assert.equal(before.meals.length, 42);
  const target = f.assignments[0]!, intent = { assignmentId: target.assignmentId, personId: target.personId, expectedRecipeSha256: target.recipeSha256, replacementRecipeId: "b", sourceServings: target.sourceServings };
  const preview = await send("previewReplacement", { ...base, intent }); assert.equal(preview.outcome, "replacement-preview");
  const confirmation = { intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256 };
  const payload = { ...base, confirmation, expectedPantryBasisSha256: preview.pantryBasisSha256 };
  const changed = await send("confirmReplacement", { ...payload, request: { ...f.request, storeIds: [...allShops].reverse() } });
  assert.equal(changed.code, "stale_replacement_preview");
  const good = await send("confirmReplacement", payload); assert.equal(good.outcome, "week-proposal"); assert.equal(good.saved, false);
  assert.deepEqual(good.meals.filter((m: { personId: string }) => m.personId === "p2"), before.meals.filter((m: { personId: string }) => m.personId === "p2"));
  assert.equal((await send("readCurrent", {})).state.current, null);
});
