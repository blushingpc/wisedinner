import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import { createReviewedCurrentSourceBinder, createReviewedCurrentReferenceArchive } from "./generated-current-reviewed-source.ts";
import { createReferenceSessionFactoryV2, createReferenceSessionHandler } from "./generated-plan-session.ts";
import { referenceOperationDigest, createBoundReferenceOperationHandlerV2 } from "./generated-plan-operations.ts";
import { issueLocalReferenceScopeV2, issueLocalReferenceScope, type ReferenceStatePortV2 } from "./generated-plan-state.ts";
import { readReviewedReferenceDataV1, referenceAdmissionFor, referenceAdmissionDigest, reviewedReferenceDataDigest, referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { quoteRegionalEstimatesV2, readReferencePriceConfiguration } from "./generated-regional-quote.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { setup } from "./generated-joined-plan.test-support.ts";
import { memoryPort } from "./generated-plan-state.test-support.ts";
import { syntheticV2, labelsV2 } from "./generated-plan-v2.test-support.ts";
import { admitVerifiedReferenceOwner } from "./generated-owner-scope.ts";
import { readSessionResponse } from "../../wisedinner-app/src/features/halloween/v2/response.ts";

const capsule = JSON.parse(readFileSync(new URL("./generated-current-source-capsule-v4.json", import.meta.url), "utf8"));
const source = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString();
const scope = issueLocalReferenceScopeV2("reference-data-fixture", 1);
// Production owner scopes remain independently branded. This test binds a local
// session directly, not the hosted owner route or a fabricated ownership grant.
const transactions: ReferenceStatePortV2 = { transaction: async f => f({ readState: async () => null, readOperation: async () => null, commit: async () => { throw Error("capabilities must not commit"); } }) };
let utc = Date.parse("2026-10-31T12:00:00Z");
const current = createReviewedCurrentSourceBinder(capsule, () => utc);
const packet = current.reviewedReferenceData!;
assert.ok(packet);
const factory = createReferenceSessionFactoryV2(source, capsule.configuration, { reviewedReferenceData: packet });
if (factory.outcome !== "ready") throw Error("Expected current factory");
const candidateSession = factory.bind({ labels: capsule.labels, transactions, resolveScope: () => scope });
if (candidateSession.outcome !== "ready") throw Error("Expected current session");
const configured = candidateSession;
function request(payload: unknown = {}, changes: Record<string, unknown> = {}) {
  const intent = { contract: "wd-joined-session-proposal-v2", operation: "capabilities", operationId: randomUUID(), sourceSha256: packet.sourcePin.sha256, expectedSourcePolicyBasisSha256: null, payload, ...changes };
  return { intent, request: new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }) }) };
}
async function send(payload: unknown = {}, changes: Record<string, unknown> = {}) { const q = request(payload, changes); const response = await configured.handle(q.request); return { response, body: await response.json(), intent: q.intent }; }
test("current binder exposes a stable reviewed V4 packet without volatile UTC", () => {
  const binder = createReviewedCurrentSourceBinder(capsule) as unknown as { reviewedReferenceData?: { configuration: unknown; reviewedDataSha256: string } };
  assert.ok(binder.reviewedReferenceData, "Missing current reviewed reference packet");
  assert.deepEqual(binder.reviewedReferenceData.configuration, capsule.configuration);
});

test("opted packet is exact current V4, legacy result unchanged and invalid payloads cannot select configuration", async () => {
  const legacy = await send(), opted = await send({ reviewedReferenceData: "wd-reviewed-reference-data-v1" });
  assert.deepEqual(opted.body.result.reviewedReferenceData, packet);
  const { reviewedReferenceData, ...rest } = opted.body.result; void reviewedReferenceData;
  assert.deepEqual(rest, legacy.body.result); assert.equal(Object.hasOwn(legacy.body.result, "reviewedReferenceData"), false);
  assert.equal(packet.sourcePolicyBasis.basisSha256, "6416f956c50b380e4cbd11d223c9095642487cf028142e58aaff80419e5628f4");
  assert.equal((packet.configuration as { referencePrices: { facts: unknown[] } }).referencePrices.facts.length, 14);
  assert.deepEqual(packet.regions, ["Northeast", "Midwest", "South", "West"]);
  for (const payload of [{ reviewedReferenceData: "wrong" }, { reviewedReferenceData: "wd-reviewed-reference-data-v1", configuration: {} }]) assert.equal((await send(payload)).body.result.outcome, "error");
  for (const changes of [{ sourceSha256: "f".repeat(64) }, { expectedSourcePolicyBasisSha256: "f".repeat(64) }]) assert.equal((await send({ reviewedReferenceData: "wd-reviewed-reference-data-v1" }, changes)).response.status, 409);
  assert.equal(readReviewedReferenceDataV1(source, packet).outcome, "ready");
});

test("strict packet rejects malformed/tampered source/configuration/basis/revision/window and volatile fields", () => {
  const mutations = [
    (p: Record<string, unknown>) => { p.schema = "wrong"; },
    (p: Record<string, unknown>) => { p.reviewRevision = 0; },
    (p: Record<string, unknown>) => { p.reviewRevision = 5; },
    (p: Record<string, unknown>) => { p.regions = ["South"]; },
    (p: Record<string, unknown>) => { p.configurationSha256 = "f".repeat(64); },
    (p: Record<string, unknown>) => { p.sourcePin = { sha256: packet.sourcePin.sha256, recordCount: 1299 }; },
    (p: Record<string, unknown>) => { p.sourcePolicyBasis = { ...packet.sourcePolicyBasis, basisSha256: "f".repeat(64) }; },
    (p: Record<string, unknown>) => { p.window = { ...packet.window, commitBefore: packet.window.commitBefore + 1 }; },
    (p: Record<string, unknown>) => { p.window = { ...packet.window, firstDay: "2026-02-30" }; },
    (p: Record<string, unknown>) => { p.evidenceManifestSha256 = "f".repeat(64); },
    (p: Record<string, unknown>) => { p.utc = "2026-10-31T00:00:00Z"; },
    (p: Record<string, unknown>) => { delete p.configuration; },
  ];
  for (const mutate of mutations) { const p = structuredClone(packet) as unknown as Record<string, unknown>; mutate(p); assert.equal(readReviewedReferenceDataV1(source, p).outcome, "error"); }
  for (const value of [null, [], "{}", { ...packet, configuration: { ready: true } }]) assert.equal(readReviewedReferenceDataV1(source, value).outcome, "error");
  assert.equal(readReviewedReferenceDataV1(source + " ", packet).outcome, "error");
});

test("isolated trusted synthetic review changes basis but cannot enter the production closed binder", () => {
  const configuration = structuredClone(capsule.configuration);
  const fact = configuration.referencePrices.facts.find((f: { kind: string }) => f.kind === "national-reference"); assert.ok(fact);
  fact.packPriceCents.min += 1; fact.packPriceCents.max += 1;
  const bound = createJoinedReferencePlannerV2(source, configuration); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw Error("synthetic test binding");
  const body = { ...structuredClone(packet), reviewRevision: 5, configuration, configurationSha256: referenceConfigurationDigest(configuration), sourcePolicyBasis: bound.sourcePolicyBasis };
  body.evidenceManifestSha256 = referenceAdmissionDigest(referenceAdmissionFor(body));
  const { reviewedDataSha256: ignored, ...without } = body; void ignored;
  const next = { ...without, reviewedDataSha256: reviewedReferenceDataDigest(without) };
  assert.notEqual(next.sourcePolicyBasis.basisSha256, packet.sourcePolicyBasis.basisSha256);
  assert.throws(() => createReviewedCurrentReferenceArchive(source, [next], [referenceAdmissionFor(packet)]));
  const archive = createReviewedCurrentReferenceArchive(source, [packet, next], [referenceAdmissionFor(packet), referenceAdmissionFor(next)]);
  assert.equal(archive.current().reviewRevision, 5);
  assert.deepEqual(archive.getOriginal({ sourceSha256: packet.sourcePin.sha256, sourcePolicyBasisSha256: packet.sourcePolicyBasis.basisSha256 }), { outcome: "ready", packet });
  assert.equal(archive.getOriginal({ sourceSha256: packet.sourcePin.sha256, sourcePolicyBasisSha256: "f".repeat(64) }).outcome, "held");
  const conflict = { ...next, reviewRevision: 4 }; conflict.evidenceManifestSha256 = referenceAdmissionDigest(referenceAdmissionFor(conflict));
  const { reviewedDataSha256: old, ...c } = conflict; void old;
  const sealed = { ...c, reviewedDataSha256: reviewedReferenceDataDigest(c) };
  assert.throws(() => createReviewedCurrentReferenceArchive(source, [packet, sealed], [referenceAdmissionFor(packet), referenceAdmissionFor(sealed)]));
  configuration.referencePrices.facts[0].packPriceCents.max = 999999;
  assert.notEqual((archive.current().configuration as typeof configuration).referencePrices.facts[0].packPriceCents.max, 999999);
  assert.throws(() => createReviewedCurrentSourceBinder({ ...capsule, configuration }));
  assert.equal(current.reviewedReferenceData!.reviewedDataSha256, packet.reviewedDataSha256);
});

test("trusted factory checks packet against its own actual configuration and does not allow missing source authority", async () => {
  const changed = structuredClone(capsule.configuration); changed.referencePrices.facts[0].packPriceCents.max += 1;
  assert.equal(createReferenceSessionFactoryV2(source, changed, { reviewedReferenceData: packet }).outcome, "error");
  const noScope = factory.bind({ labels: capsule.labels, transactions }); assert.equal(noScope.outcome, "ready");
  if (noScope.outcome !== "ready") throw Error("factory");
  const response = await noScope.handle(request({ reviewedReferenceData: "wd-reviewed-reference-data-v1" }).request);
  assert.equal((await response.json()).result.code, "scope_binding_required");
});

test("actual four-region pack quoting remains qualified and uses the same original amounts", () => {
  const rows = source.trimEnd().split("\n").map(line => JSON.parse(line));
  const row = rows.find(r => r.id === "WD-R6-M-790a5d5592f32a7b");
  const demand = row.recipe.ingredients.map((i: { id: string; state: string; unit: string; quantity: string }) => ({ assignmentId: "region-test", recipeId: row.id, recipeSha256: row.recipe_sha256, ingredientId: i.id, preparedState: i.state, baseUnit: i.unit, amount: { numerator: i.quantity, denominator: "1" } }));
  const prepared = prepareReferencePurchaseRequirements(demand, capsule.configuration.correspondences); assert.equal(prepared.outcome, "prepared"); if (prepared.outcome !== "prepared") throw Error("demands");
  for (const region of packet.regions) {
    const quote = quoteRegionalEstimatesV2({ region, storeIds: ["reference-store-context-only"], asOfDate: "2026-10-31", budgetCents: 15000 }, prepared.requirements, [], [], capsule.configuration.referencePrices);
    assert.equal(quote.outcome, "quoted"); if (quote.outcome !== "quoted") throw Error(JSON.stringify(quote));
    assert.equal(quote.region, region); assert.equal(quote.liveRetailerPricing, false); assert.equal(quote.adoptionGranted, false);
    assert.ok(quote.referenceEstimates?.sources.length); assert.ok(quote.rows.every(r => r.packCount >= 0));
  }
});

test("existing V1 and pure V2 validators stay closed to the session-only opt-in", async () => {
  const f = setup(), m = memoryPort(), local = issueLocalReferenceScope("reference-v1-compat", 1);
  const v1 = createReferenceSessionHandler(f.bytes, f.configuration, { labels: [], transactions: m.port, resolveScope: () => local }); assert.equal(v1.outcome, "ready"); if (v1.outcome !== "ready") throw Error("v1");
  for (const payload of [{}, { reviewedReferenceData: "wd-reviewed-reference-data-v1" }]) {
    const intent = { contract: "wd-joined-session-proposal-v1", operation: "capabilities", operationId: randomUUID(), sourceSha256: f.configuration.sourcePin.sha256, payload };
    const response = await v1.handle(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }) }));
    assert.equal((await response.json()).result.outcome, Object.keys(payload).length ? "error" : "capabilities");
  }
  const v2 = syntheticV2(), pure = createBoundReferenceOperationHandlerV2(v2.binding, { labels: labelsV2, authorize: () => "allow" }); assert.equal(pure.outcome, "ready"); if (pure.outcome !== "ready") throw Error("pure");
  for (const payload of [{}, { reviewedReferenceData: "wd-reviewed-reference-data-v1" }]) {
    const response = await pure.handle(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(v2.envelope("capabilities", payload, 1, null)) }));
    assert.equal((await response.json()).result.outcome, Object.keys(payload).length ? "error" : "capabilities");
  }
  assert.throws(() => readReferencePriceConfiguration(v2.configuration.referencePrices));
});

test("actual native strict response identity is not weakened to admit an unknown basis", async () => {
  const { body, intent } = await send({ reviewedReferenceData: "wd-reviewed-reference-data-v1" });
  const port = () => ({ status: 200, contentType: "application/json", cacheControl: "no-store", chunks: (async function* () { yield JSON.stringify(body); })() });
  await assert.rejects(readSessionResponse(port(), { operation: "capabilities", operationId: intent.operationId, intentSha256: body.intentSha256, sourcePolicyBasisSha256: "f".repeat(64) }, () => true), /response_identity/);
  assert.equal((await readSessionResponse(port(), { operation: "capabilities", operationId: intent.operationId, intentSha256: body.intentSha256, sourcePolicyBasisSha256: packet.sourcePolicyBasis.basisSha256 }, () => true)).outcome, "response");
});

test("real owner-bound capabilities preserve UTC transport metadata outside immutable packet across expiry", async () => {
  const id = "10000000-0000-4000-8000-000000000701";
  const owner = await admitVerifiedReferenceOwner(new Request("https://fixture.invalid"), { verify: async () => ({ id, token: "synthetic", authenticatedAt: 1, providers: ["email"] }), readAccount: async () => ({ userId: id, state: "active", revision: 1 }) });
  assert.equal(owner.outcome, "ready"); if (owner.outcome !== "ready") throw Error("owner");
  const kernel = await current.bind(owner, transactions); assert.ok(kernel);
  for (const instant of ["2026-10-31T12:00:00Z", "2026-10-31T12:01:00Z", "2026-11-07T00:00:00Z"]) {
    utc = Date.parse(instant); const response = await kernel.handle(request({ reviewedReferenceData: "wd-reviewed-reference-data-v1" }).request);
    assert.equal(response.headers.get("x-wisedinner-clock-utc"), new Date(utc).toISOString());
    assert.equal(response.headers.get("x-wisedinner-source"), packet.sourcePin.sha256); assert.equal(response.headers.get("x-wisedinner-reference-through"), "2026-11-05");
    assert.deepEqual((await response.json()).result.reviewedReferenceData, packet);
    assert.equal(kernel.newWeekCommitBefore, packet.window.commitBefore);
  }
  assert.equal(JSON.stringify(packet).includes("clockUtc"), false); utc = Date.parse("2026-10-31T12:00:00Z");
});

test("composed opt-in rejects duplicate/malformed/oversized bodies with defined results before data delivery", async () => {
  const q = request({ reviewedReferenceData: "wd-reviewed-reference-data-v1" });
  const body = await q.request.text();
  for (const raw of [body.replace('{', '{"payload":{},'), new Uint8Array([0xff]), new Uint8Array(8 * 1024 * 1024 + 1)]) {
    const response = await configured.handle(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: raw }));
    const decoded = await response.json(); assert.ok(decoded.result); assert.equal(decoded.result.outcome, "error");
    assert.equal(Object.hasOwn(decoded.result, "reviewedReferenceData"), false);
    if (typeof raw !== "string" && raw.length > 8 * 1024 * 1024) assert.equal(response.status, 413);
  }
});

test("portable reviewed-data helper graph uses existing native primitives, not Node or implicit environment", () => {
  const visited = new Set<string>();
  function walk(file: string) {
    if (visited.has(file) || file.endsWith(".json")) return; visited.add(file);
    const text = readFileSync(file, "utf8").replace(/\/\/[^\n]*/g, "");
    assert.doesNotMatch(text, /(?:from\s*["']node:|\bBuffer\b|process\.env)/, file);
    for (const m of text.matchAll(/(?:import|export)\s+(?!type\b)[^;]*?from\s*["']([^"']+)["']/g)) if (m[1]!.startsWith(".")) walk(resolve(dirname(file), m[1]!));
  }
  walk(new URL("./generated-reviewed-reference-data.ts", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"));
  assert.ok(visited.size > 5);
});
test("V2 session opts in explicitly; legacy capabilities and missing binding stay distinct", async () => {
  const binder = createReviewedCurrentSourceBinder(capsule) as unknown as { reviewedReferenceData: unknown };
  const factory = createReferenceSessionFactoryV2(source, capsule.configuration);
  assert.equal(factory.outcome, "ready"); if (factory.outcome !== "ready") throw Error("factory");
  const candidate = factory.bind({ labels: capsule.labels, transactions, resolveScope: () => scope });
  assert.equal(candidate.outcome, "ready"); if (candidate.outcome !== "ready") throw Error("session");
  const session = candidate;
  async function call(payload: unknown) {
    const intent = { contract: "wd-joined-session-proposal-v2", operation: "capabilities", operationId: randomUUID(), sourceSha256: capsule.configuration.sourcePin.sha256, expectedSourcePolicyBasisSha256: null, payload };
    return (await session.handle(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }) }))).json();
  }
  assert.equal((await call({})).result.outcome, "capabilities");
  const missing = await call({ reviewedReferenceData: "wd-reviewed-reference-data-v1" });
  assert.equal(missing.result.code, "reviewed_reference_data_unavailable");
  assert.ok(binder.reviewedReferenceData);
});
