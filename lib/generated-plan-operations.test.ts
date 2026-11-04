import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { createReferenceOperationHandler, referenceOperationDigest } from "./generated-plan-operations.ts";

const ID = "b4a286ed-5b23-48e4-9ba7-6096f112fe01", amount = (numerator: string, denominator = "1") => ({ numerator, denominator });
const labels = [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }];
function fixture() {
  const f = setup(), binding = createReferenceOperationHandler(f.bytes, f.configuration, { labels, authorize: () => "allow" });
  if (binding.outcome !== "ready") throw new Error("Fixture binding failed");
  const bound = binding;
  function envelope(operation: string, payload: unknown, changes = {}) {
    const value = { contract: "wd-joined-plan-draft-v1", operation, operationId: ID, sourceSha256: bound.source.sha256, payload, ...changes };
    return { ...value, intentSha256: referenceOperationDigest(value) };
  }
  async function send(operation: string, payload: unknown, changes = {}) {
    const response = await bound.handle(new Request("http://reference.invalid/", { method: "POST", body: JSON.stringify(envelope(operation, payload, changes)), headers: { "content-type": "application/json" } }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  const target = f.assignments[0]!, intent = { assignmentId: target.assignmentId, personId: target.personId, expectedRecipeSha256: target.recipeSha256, replacementRecipeId: "b", sourceServings: amount("3") };
  return { ...f, bound, envelope, send, intent };
}

test("actual Request boundary returns two-person week DTOs without row prices or pretend saves", async () => {
  const f = fixture(), response = await f.send("evaluateJoined", { assignments: f.assignments, request: f.request });
  assert.equal(response.status, 200); assert.equal(response.body.result.outcome, "week-proposal"); assert.equal(response.body.apiAccepted, false); assert.equal(response.body.result.saved, false);
  assert.equal(response.body.result.meals.length, 14); assert.equal(response.body.result.personDays.length, 14); assert.equal(response.body.result.groceries.estimatedTotalCents.max, 5000);
  assert.equal(response.body.result.meals[0].profileRevision, 1); assert.equal(response.body.result.proteinCoverage, "selected-meals-only");
  assert.equal(response.headers.get("cache-control"), "no-store");
  const raw = JSON.stringify(response.body); for (const key of ["packPriceCents", "estimatedLineCents", "factPins"]) assert.equal(raw.includes('"' + key + '"'), false);
  assert.deepEqual(await f.send("evaluateJoined", { assignments: f.assignments, request: f.request }), response);
});

test("no-fit Unknown unsupported exclusions and source errors remain distinct", async () => {
  const f = fixture(), noFit = await f.send("evaluateJoined", { assignments: f.assignments, request: { ...f.request, budgetCents: 1 } });
  assert.equal(noFit.body.result.outcome, "no_fit"); assert.equal(noFit.body.result.week, null);
  const held = await f.send("evaluateJoined", { assignments: f.assignments, request: { ...f.request, people: [{ ...f.request.people[0], proteinGoal: { kind: "unknown" } }, f.request.people[1]] } });
  assert.equal(held.body.result.outcome, "held"); assert.ok(held.body.result.reasons.some((row: { personId: string }) => row.personId === "p1"));
  const stale = await f.send("evaluateJoined", { assignments: [{ ...f.assignments[0], profileRevision: 2 }, ...f.assignments.slice(1)], request: f.request }); assert.equal(stale.body.result.code, "stale_profile"); assert.equal(stale.status, 400);
  assert.equal((await f.send("evaluateJoined", { assignments: f.assignments, request: f.request }, { sourceSha256: "0".repeat(64) })).status, 409);
});

test("private host authorization is required and cannot come from JSON", async () => {
  const f = fixture(), body = JSON.stringify(f.envelope("capabilities", {}));
  const request = () => new Request("http://reference.invalid/", { method: "POST", body, headers: { "content-type": "application/json" } });
  for (const [authorize, expected] of [[undefined, 503], [() => "deny" as const, 403], [() => "unavailable" as const, 503], [() => { throw new Error("private diagnostic must stay private"); }, 503]] as const) {
    const bound = createReferenceOperationHandler(f.bytes, f.configuration, { labels, authorize }); if (bound.outcome !== "ready") throw new Error("Expected binding"); const response = await bound.handle(request()); assert.equal(response.status, expected); assert.equal((await response.text()).includes("private diagnostic"), false);
  }
  const response = await f.send("capabilities", {}, { authorized: true }); assert.equal(response.status, 400);
});

test("source-bound practical stock deducts once and changed mapping evidence fences confirmation", async () => {
  const f = fixture(), pantryIntake = { measureFacts: [], purchaseBindings: [{ id: "owned-a", ingredientId: "pantry-a", preparedState: "raw", baseUnit: "g", skuId: "buy-a", formDigest: "d".repeat(64), sourceSha256: "a".repeat(64) }] };
  const entries = [{ pantryId: "container-a", kind: "known", ingredientId: "pantry-a", preparedState: "raw", baseUnit: "g", unit: "g", amount: amount("400") }];
  async function call(operation: string, payload: unknown, changed = false) {
    const configured = changed ? { ...pantryIntake, purchaseBindings: [{ ...pantryIntake.purchaseBindings[0]!, sourceSha256: "b".repeat(64) }] } : pantryIntake;
    const bound = createReferenceOperationHandler(f.bytes, { ...f.configuration, pantryIntake: configured }, { labels, authorize: () => "allow" }); if (bound.outcome !== "ready") throw new Error("Expected pantry binding");
    const response = await bound.handle(new Request("http://reference.invalid/", { method: "POST", body: JSON.stringify(f.envelope(operation, payload)), headers: { "content-type": "application/json" } })); return { status: response.status, body: await response.json() };
  }
  const request = { ...f.request, selectedDays: [f.request.selectedDays[0]] }, assignments = f.assignments.filter(row => row.date === request.selectedDays[0]), base = { request, assignments, pantryEntries: entries };
  const evaluated = await call("evaluateJoined", base); assert.equal(evaluated.body.result.outcome, "week-proposal"); assert.equal(evaluated.body.result.groceries.uniqueBuyItemCount, 0); assert.deepEqual(evaluated.body.result.groceries.alreadyAtHome[0].used, amount("350")); assert.deepEqual(evaluated.body.result.groceries.alreadyAtHome[0].remainingOwned, amount("50"));
  const preview = (await call("previewReplacement", { ...base, intent: f.intent })).body.result; assert.equal(preview.outcome, "replacement-preview");
  const confirmation = { intent: f.intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256 };
  const payload = { ...base, confirmation, expectedPantryBasisSha256: preview.pantryBasisSha256 };
  assert.equal((await call("confirmReplacement", payload)).body.result.saved, false);
  const changed = await call("confirmReplacement", payload, true); assert.equal(changed.status, 409); assert.equal(changed.body.result.code, "stale_pantry_basis");
  const held = await call("evaluateJoined", { ...base, pantryEntries: [...entries, { pantryId: "custom", kind: "custom", label: "Unknown synthetic food", amountText: "half bag" }] }); assert.equal(held.body.result.outcome, "held"); assert.equal(held.body.result.pantry, null); assert.equal(held.body.result.knownOnlyStock.length, 1); assert.equal("groceries" in held.body.result, false);
});

test("custom exclusions and aborted authorization never return an evaluated week", async () => {
  const f = fixture(), held = await f.send("evaluateJoined", { assignments: f.assignments, request: { ...f.request, people: [{ ...f.request.people[0], exclusions: { kind: "unmapped", text: "custom" } }, f.request.people[1]] } }); assert.equal(held.body.result.outcome, "held");
  const controller = new AbortController(), binding = createReferenceOperationHandler(f.bytes, f.configuration, { labels, authorize: () => { controller.abort(); return "allow"; } }); if (binding.outcome !== "ready") throw new Error("Expected binding");
  const response = await binding.handle(new Request("http://reference.invalid/", { method: "POST", body: JSON.stringify(f.envelope("capabilities", {})), headers: { "content-type": "application/json" }, signal: controller.signal })); assert.equal(response.status, 499); assert.equal((await response.json()).result.code, "request_aborted");
});

test("operation envelope rejects duplicate keys wrong contract altered intent and unsupported payload fields", async () => {
  const f = fixture(), raw = f.envelope("capabilities", {});
  for (const [body, status] of [[JSON.stringify(raw).replace('"payload":{}', '"payload":{},"payload":{}'), 400], [JSON.stringify({ ...raw, intentSha256: "0".repeat(64) }), 409], [JSON.stringify(f.envelope("capabilities", {}, { contract: "ui-draft-v1" })), 409]] as const) {
    const response = await f.bound.handle(new Request("http://reference.invalid/", { method: "POST", body, headers: { "content-type": "application/json" } })); assert.equal(response.status, status);
  }
  assert.equal((await f.send("capabilities", { override: true })).status, 400);
  assert.equal((await f.send("evaluateJoined", { request: f.request, assignments: f.assignments, tolerance: 100 })).status, 400);
  assert.equal((await f.bound.handle(new Request("http://reference.invalid/"))).status, 405);
});

test("capabilities and held persistence operations never imply a durable receipt or commercial eligibility", async () => {
  const f = fixture(), capabilities = await f.send("capabilities", {});
  assert.equal(capabilities.body.result.source.recordCount, 2); assert.equal(capabilities.body.result.persistenceBound, false); assert.equal(capabilities.body.result.commercialAccessVerified, false);
  for (const operation of ["saveCurrent", "operationStatus", "confirmNewWeek", "restore", "trial", "storePrices"]) { const response = await f.send(operation, {}); assert.equal(response.status, 422); assert.equal(response.body.result.outcome, "held"); assert.equal(response.body.result.saved, false); }
  assert.equal((await f.send("somethingElse", {})).status, 400);
});

test("preview alternatives and fresh confirmation share target and pantry basis without saving", async () => {
  const f = fixture(), payload = { assignments: f.assignments, request: f.request }, preview = await f.send("previewReplacement", { ...payload, intent: f.intent });
  assert.equal(preview.body.result.outcome, "replacement-preview"); assert.equal(preview.body.result.meal.recipeId, "b"); assert.equal(preview.body.result.meal.personId, "p1");
  const p = preview.body.result, confirmation = { intent: f.intent, expectedPreviewSha256: p.previewSha256, expectedRequestSha256: p.requestSha256, expectedAssignmentsSha256: p.baseAssignmentsSha256 };
  const confirmed = await f.send("confirmReplacement", { ...payload, confirmation, expectedPantryBasisSha256: p.pantryBasisSha256 });
  assert.equal(confirmed.body.result.outcome, "week-proposal"); assert.equal(confirmed.body.result.saved, false); assert.equal(confirmed.body.result.target.personId, "p1");
  assert.deepEqual(confirmed.body.result.meals.filter((row: { personId: string }) => row.personId === "p2"), (await f.send("evaluateJoined", payload)).body.result.meals.filter((row: { personId: string }) => row.personId === "p2"));
  assert.equal((await f.send("confirmReplacement", { ...payload, confirmation, expectedPantryBasisSha256: "0".repeat(64) })).status, 409);
  const stale = await f.send("confirmReplacement", { ...payload, request: { ...f.request, budgetCents: 9000 }, confirmation, expectedPantryBasisSha256: p.pantryBasisSha256 }); assert.equal(stale.body.result.code, "stale_replacement_preview");
  const alternatives = await f.send("findReplacements", { ...payload, candidateGrid: { personId: "p1", assignmentId: f.intent.assignmentId, expectedRecipeSha256: f.intent.expectedRecipeSha256, candidates: [{ recipeId: "b", sourceServings: amount("3") }, { recipeId: "b", sourceServings: amount("10") }], maxEvaluations: 8, limit: 8 } });
  assert.equal(alternatives.body.result.outcome, "replacement-alternatives"); assert.equal(alternatives.body.result.candidates.length, 1); assert.equal(alternatives.body.result.excluded[0].result.reasons[0].code, "replacement_protein_tolerance_exceeded");
});

test("bounded planning returns the actual same-engine search and does not manufacture optimization success", async () => {
  const f = fixture(), request = { ...f.request, selectedDays: [f.request.selectedDays[0]] }, searchGrid = { recipeIds: ["a", "b"], portionsByPerson: [{ personId: "p1", profileRevision: 1, sourceServings: [amount("3")] }, { personId: "p2", profileRevision: 1, sourceServings: [amount("4")] }], maxRecipeUsesPerPerson: 1, maxEvaluations: 4, seed: "reference-test" };
  const result = await f.send("planJoined", { request, searchGrid }); assert.equal(result.body.result.outcome, "week-proposal"); assert.equal(result.body.result.search.optimization, "best-observed-in-explicit-bounded-grid"); assert.equal(result.body.result.saved, false);
});

test("unprepared numeric stock cannot bypass practical pantry evidence and held stock is never fed to a plan", async () => {
  const f = fixture();
  const numeric = await f.send("evaluateJoined", { assignments: f.assignments, request: { ...f.request, pantry: [{ skuId: "buy-a", unit: "g", formDigest: "d".repeat(64), quantity: { numerator: 99999, denominator: 1 } }] } }); assert.equal(numeric.body.result.code, "raw_pantry_entries_required");
  const held = await f.send("evaluateJoined", { assignments: f.assignments, request: f.request, pantryEntries: [] }); assert.equal(held.body.result.outcome, "held"); assert.equal(held.body.result.code, "pantry_intake_not_configured");
  assert.equal((await f.send("preparePantry", { entries: [] })).body.result.code, "pantry_intake_not_configured");
});
