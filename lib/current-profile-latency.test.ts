import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { resolveCurrentIntegrationServerConfiguration } from "./current-integration-host.server.ts";
import { CURRENT_INTEGRATION_REFERENCE_V9_IDENTITY as identity } from "./current-integration-reference-v9.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { createRevisedCatalogReader } from "./generated-plan-catalog.ts";
import { isFinalDerivedRow, isFinalCountedBreadConsistent } from "./generated-final-source-admission.ts";
import manifest from "./fixtures/current-final-source-v1.json" with { type: "json" };
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { admitVerifiedReferenceOwner } from "./generated-owner-scope.ts";
import { revokeLocalReferenceScope, type ReferenceStatePortV2 } from "./generated-plan-state.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { REFERENCE_SESSION_CONTRACT_V2 } from "./generated-plan-session.ts";
const capsule = JSON.parse(readFileSync(new URL("./generated-current-source-capsule-v9.json", import.meta.url), "utf8"));
const source = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString("utf8");
const rows = source.trimEnd().split("\n").map(s => JSON.parse(s));
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const config = { WD_CURRENT_OWNER_API_ENABLED: "true", WD_REVENUECAT_CONFIGURATION_VERIFIED: "true", WD_CURRENT_REFERENCE_PROFILE: "wd-current-reference-v9" };
const request = () => new Request("https://local.synthetic.invalid/session", { method: "POST" });
const clock = () => Date.parse("2026-11-02T12:00:00Z");
function prepare(now = clock, profile = "wd-current-reference-v9") {
  const d = resolveCurrentIntegrationServerConfiguration({ ...config, WD_CURRENT_REFERENCE_PROFILE: profile }, now, () => { throw Error("Network forbidden"); });
  assert.ok(d.source); return d.source.create();
}

test("real host source cache is per clock/profile, frozen, exact identity, and carries no owner or provider port", () => {
  const a = prepare(); assert.strictEqual(prepare(), a);
  assert.ok(Object.isFrozen(a)); assert.ok(Object.isFrozen(a.reviewedReferenceData));
  assert.equal(a.sourceSha256, identity.sourceSha256); assert.equal(a.reviewedReferenceData?.reviewedDataSha256, identity.reviewedDataSha256);
  assert.deepEqual(a.referenceWindow, identity.window);
  assert.notStrictEqual(prepare(() => clock()), a);
  const v5 = prepare(clock, "wd-current-reference-v5"); assert.notEqual(v5.sourcePolicyBasisSha256, a.sourcePolicyBasisSha256); assert.strictEqual(prepare(), a);
  assert.deepEqual(Object.keys(a).sort(), ["bind", "guidePolicy", "referenceWindow", "reviewedReferenceData", "sourcePolicyBasisSha256", "sourceSha256"]);
  const bad = resolveCurrentIntegrationServerConfiguration({ ...config, WD_CURRENT_SOURCE_IDENTITY_JSON: JSON.stringify({ ...identity, sourceSha256: "f".repeat(64) }) }, clock);
  assert.equal(bad.source, undefined);
  assert.equal(resolveCurrentIntegrationServerConfiguration({ ...config, WD_CURRENT_REFERENCE_PROFILE: "unknown" }, clock).source, undefined);
});

test("full1300 exact text cache retains all checks, immutable projection, distinct pin and mutable-byte rejection", () => {
  const pin = { sha256: identity.sourceSha256, recordCount: 1300 }, read = createRevisedCatalogReader(pin), result = read(source);
  assert.equal(result.outcome, "success"); if (result.outcome !== "success") throw Error("actual catalog required");
  assert.deepEqual(result.summary, { total: 1300, main: 1000, breakfast: 300, conditionalNutrition: 1300, heldNutrition: 0 });
  assert.strictEqual(createRevisedCatalogReader({ ...pin })(source), result);
  assert.ok(Object.isFrozen(result.recipes[0]!.recipe.ingredients));
  pin.sha256 = "f".repeat(64); assert.strictEqual(read(source), result);
  assert.equal(createRevisedCatalogReader(pin)(source).outcome, "error");
  assert.equal(createRevisedCatalogReader({ sha256: identity.sourceSha256, recordCount: 1299 })(source).outcome, "error");
  const bytes = Buffer.from(source); const fresh = read(bytes); assert.equal(fresh.outcome, "success"); assert.notStrictEqual(fresh, result);
  bytes[100] ^= 1; assert.equal(read(bytes).outcome, "error");
  assert.equal(read({ toString: () => source }).outcome, "error");
  let calls = 0; const accessor = { get sha256() { calls++; return identity.sourceSha256; }, recordCount: 1300 };
  assert.throws(() => createRevisedCatalogReader(accessor)); assert.equal(calls, 0);
  const changed = structuredClone(rows); changed[0].recipe.ingredients[0].quantity = "999";
  const text = changed.map(r => JSON.stringify(r)).join("\n") + "\n";
  assert.equal(createRevisedCatalogReader({ sha256: sha(text), recordCount: 1300 })(text).outcome, "error", "a recomputed source hash is not a row seal");
});

test("private-copy lineage optimisation equals independent closed canonical/Node oracle on corpus and mutation domain", () => {
  const seals = new Map(manifest.rowSeals.map(r => [r.id, r]));
  for (const row of rows) {
    const seal = seals.get(row.id)!; assert.ok(seal);
    const digest = sha(JSON.stringify(canonicalReferenceData(row)));
    assert.equal(isFinalDerivedRow(row), digest === seal.fullRowSha256 || digest === seal.practicalRowSha256);
    assert.equal(isFinalCountedBreadConsistent(row), true);
  }
  // Seeded directly valid Unicode/extra-field mutations; no filtering/discards.
  let seed = 534;
  for (let i = 0; i < 200; i++) {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    const row = structuredClone(rows[seed % rows.length]); row.recipe.title += String.fromCharCode(seed & 65535) + "😀\ud800";
    assert.equal(isFinalDerivedRow(row), false);
  }
  let calls = 0; const bad = Object.defineProperty({}, "id", { enumerable: true, get() { calls++; return rows[0].id; } });
  assert.equal(isFinalDerivedRow(bad), false); assert.equal(calls, 0);
  assert.equal(isFinalDerivedRow(Object.assign(Object.create({ foreign: true }), rows[0])), false);
});

test("warmed capsule/config inputs cannot acquire source authority or change immutable identity", () => {
  prepare(); const changed = structuredClone(capsule); changed.configuration.correspondences[0].skuId = "tamper";
  assert.throws(() => createReviewedCurrentSourceBinder(changed, clock));
  assert.throws(() => createReviewedCurrentSourceBinder({ ...capsule, approved: true }, clock));
  assert.equal(prepare().reviewedReferenceData?.reviewedDataSha256, identity.reviewedDataSha256);
});

test("actual warmedV9 kernel preserves A-B-A storage, lostACK original status after expiry, expiry denial and unbranded owner refusal", async () => {
  let time = clock(); const now = () => time, value = prepare(now), memory = memoryPort();
  const owner = async (n: number, revision = 1) => {
    const id = op(900 + n), result = await admitVerifiedReferenceOwner(request(), { verify: async () => ({ id, token: "synthetic-no-provider", authenticatedAt: time, providers: ["email"] }), readAccount: async () => ({ userId: id, state: "active", revision }) });
    assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") throw Error("owner required"); return result;
  };
  const a = await owner(1), b = await owner(2), rawPort = memory.port as unknown as ReferenceStatePortV2;
  let loseAck = false, commits = 0;
  const port: ReferenceStatePortV2 = { transaction: body => rawPort.transaction(tx => body({ ...tx, async commit(...args) { commits++; if (loseAck) { memory.failOnce("after-commit"); loseAck = false; } await tx.commit(...args); } })) };
  assert.equal(await value.bind(JSON.parse(JSON.stringify(a)), port), null);
  const ka = await value.bind(a, port), kb = await value.bind(b, port); assert.ok(ka); assert.ok(kb);
  const send = async (k: NonNullable<typeof ka>, operation: string, payload: unknown, n: number) => {
    const body = { contract: REFERENCE_SESSION_CONTRACT_V2, operation, operationId: op(n), sourceSha256: value.sourceSha256, expectedSourcePolicyBasisSha256: value.sourcePolicyBasisSha256, payload };
    const response = await k.handle(new Request("https://local.synthetic.invalid/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, intentSha256: referenceOperationDigest(body) }) }));
    return (await response.json()).result;
  };
  const observation = JSON.parse(readFileSync("C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/website-refresh-20261027/normal-ui-study/native-integration-20261030/backend-repair-round-v3/http-source-wave-v1/current-profile-latency-repair/fixtures/final/app-final-flow-observation.json", "utf8"));
  assert.equal((await send(ka, "readCurrent", {}, 801)).outcome, "read");
  assert.equal((await send(kb, "readCurrent", {}, 802)).outcome, "read");
  const input = { ...observation.request, asOfDate: "2026-11-02" };
  const payload = { expectedRevision: 0, weekId: op(850), request: input, assignments: observation.assignments, pantryEntries: [] };
  loseAck = true;
  const unknown = await send(ka, "installCurrent", payload, 851); assert.equal(unknown.outcome, "unknown", JSON.stringify(unknown));
  assert.equal(commits, 1);
  const pending = await send(ka, "installCurrent", payload, 851); assert.equal(pending.code, "operation_status_required"); assert.equal(commits, 1);
  const isolated = await send(kb, "operationStatus", { targetOperationId: op(851) }, 852); assert.equal(isolated.outcome, "not_found");
  time = identity.window.commitBefore; assert.strictEqual(prepare(now), value);
  const original = await send(ka, "operationStatus", { targetOperationId: op(851) }, 853); assert.equal(original.outcome, "committed", JSON.stringify(original));
  assert.equal(original.receipt.outcome, "acknowledged"); assert.equal(original.receipt.state.revision, 1); assert.equal(commits, 1);
  const replay = await send(ka, "installCurrent", payload, 851); assert.equal(replay.outcome, "acknowledged"); assert.equal(commits, 1);
  const expired = await send(ka, "installCurrent", { ...payload, expectedRevision: 1, weekId: op(854) }, 854); assert.equal(expired.outcome, "not_applied"); assert.equal(expired.result.code, "reference_snapshot_expired");
  assert.equal((await send(ka, "readCurrent", {}, 855)).state.revision, 1);
  revokeLocalReferenceScope(a.scope); assert.notEqual((await send(ka, "readCurrent", {}, 803)).outcome, "read");
  const a2 = await owner(1, 2); assert.equal(a.storageKey, a2.storageKey);
  const ka2 = await value.bind(a2, port); assert.ok(ka2); assert.equal((await send(ka2, "readCurrent", {}, 856)).state.revision, 1);
});
