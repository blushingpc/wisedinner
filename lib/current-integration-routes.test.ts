import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createCurrentIntegrationRuntime, CURRENT_GUIDE_HEADERS, CURRENT_INTEGRATION_ROUTES, type CurrentIntegrationSource, type CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { reviewedReferenceDataDigest } from "./generated-reviewed-reference-data.ts";
import { createReferenceSessionHandlerV2 } from "./generated-plan-session.ts";
import { syntheticV2, op } from "./generated-plan-v2.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import type { CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";
import type { OwnerScopeDependencies } from "./generated-owner-scope.ts";
import { hash } from "../scripts/data/price-evidence.ts";

// Mutable test-only stored wire fixtures, checked by the real producer/read/RPC
// parsers below. No actual account, source policy or provider grant is implied.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Data = Record<string, any>;
const host = "https://private.synthetic.invalid", A = op(801), B = op(802), target = "https://zpvqxtklvjitofpbddrn.supabase.co";
const key = (role: string) => "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".fixture";
const supabase = { origin: target, publicAuthKey: key("anon"), serverCredential: key("service_role") };
let utc = Date.parse("2026-10-31T12:00:00Z");
const capsule = JSON.parse(readFileSync(new URL("./generated-current-source-capsule-v4.json", import.meta.url), "utf8"));
const binder = createReviewedCurrentSourceBinder(capsule, () => utc), packet = binder.reviewedReferenceData!;
// Pending peer policy is a contract fixture only. Tests prove accepted V4
// producer transport/digest and header composition, not Backend1 guide policy.
const guidePolicy = Object.freeze({ version: "wd-synthetic-guide-contract-v1", sha256: "f".repeat(64) });
const expected: CurrentIntegrationSourceIdentity = { sourceSha256: binder.sourceSha256, sourcePolicyBasisSha256: binder.sourcePolicyBasisSha256,
  configurationSha256: packet.configurationSha256, reviewedDataSha256: packet.reviewedDataSha256, evidenceManifestSha256: packet.evidenceManifestSha256,
  window: binder.referenceWindow, guidePolicy };
const source: CurrentIntegrationSource = { ...binder, reviewedReferenceData: packet, guidePolicy };
function req(route: keyof typeof CURRENT_INTEGRATION_ROUTES, body: unknown, owner = A, headers: Record<string, string> = {}) {
  return new Request(host + CURRENT_INTEGRATION_ROUTES[route], { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + owner, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
}
function capability(payload: unknown = {}, changes: Record<string, unknown> = {}) {
  const intent = { contract: "wd-joined-session-proposal-v2", operation: "capabilities", operationId: randomUUID(), sourceSha256: binder.sourceSha256, expectedSourcePolicyBasisSha256: null, payload, ...changes };
  return { ...intent, intentSha256: referenceOperationDigest(intent) };
}
function ports() {
  let rpcCalls = 0, authCalls = 0, changed = false, switchDuringRead = false;
  const identity: OwnerScopeDependencies = {
    async verify(r) { authCalls++; const id = changed ? B : r.headers.get("authorization")?.slice(7); if (![A, B].includes(id ?? "")) throw { status: 401 }; return { id: id!, token: "synthetic", authenticatedAt: utc, providers: ["email"] }; },
    async readAccount(a) { return { userId: a.id, state: "active", revision: 1 }; },
  };
  const rpc: CurrentOwnerRpcDriver = { async call(input) {
    rpcCalls++; assert.notEqual(input.action, "commit");
    assert.equal(input.scopeKey, hash({ protocol: "joined-session-v2", namespace: "wd-current-catalog-1300-v1/" + input.ownerId }));
    if (switchDuringRead) changed = true;
    return input.action === "read_state" ? { state: null, meta: null } : { operation: null, meta: null, operationRecordSha256: null };
  } };
  return { owner: { identity, rpc }, counts: () => ({ rpcCalls, authCalls }), switchDuringRead() { switchDuringRead = true; } };
}

test("actual authenticated V4 capability factory preserves legacy/opt-in bytes and separate guide/UTC/no-store headers", async () => {
  const f = ports(); let loads = 0, billing = 0;
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: f.owner, flags: { currentSession: true }, now: () => utc,
    subscription: { environment: "SANDBOX", config: { environment: "SANDBOX", entitlement: "wisedinner_pro", products: ["com.wisedinner.app.protein.weekly", "com.wisedinner.app.protein.yearly"] }, repository: { bind: async () => { billing++; throw Error("unused"); }, begin: async () => { billing++; throw Error("unused"); }, commit: async () => { billing++; throw Error("unused"); }, enqueue: async () => { billing++; throw Error("unused"); } }, provider: { fetch: async () => { billing++; throw Error("unused"); } } },
    source: { expected, create: () => { loads++; return source; } } });
  assert.equal(runtime.inspect().source.state, "configured"); assert.deepEqual(f.counts(), { rpcCalls: 0, authCalls: 0 }); assert.equal(loads, 0);
  const legacy = await runtime.routes.currentSession(req("currentSession", capability()));
  assert.equal(legacy.status, 200); const old = await legacy.json(); assert.equal(old.result.reviewedReferenceData, undefined);
  const response = await runtime.routes.currentSession(req("currentSession", capability({ reviewedReferenceData: "wd-reviewed-reference-data-v1" })));
  assert.equal(response.status, 200); const opted = await response.json();
  assert.deepEqual(opted.result.reviewedReferenceData, packet);
  const { reviewedReferenceData, ...result } = opted.result; assert.deepEqual(result, old.result);
  const { reviewedDataSha256, ...body } = reviewedReferenceData; assert.equal(reviewedReferenceDataDigest(body), reviewedDataSha256);
  assert.equal(response.headers.get(CURRENT_GUIDE_HEADERS.version), guidePolicy.version); assert.equal(response.headers.get(CURRENT_GUIDE_HEADERS.sha256), guidePolicy.sha256);
  assert.equal(response.headers.get("x-wisedinner-source"), expected.sourceSha256); assert.equal(response.headers.get("x-wisedinner-reference-through"), "2026-11-05");
  assert.equal(response.headers.get("x-wisedinner-clock-utc"), "2026-10-31T12:00:00.000Z"); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(loads, 1); assert.equal(billing, 0); assert.equal(runtime.inspect().source.state, "verified"); assert.equal(runtime.inspect().verification.hosted, false);
});

test("wrong owner/header/source/basis/version and altered trusted packet cannot gain session admission", async () => {
  const f = ports(); let loads = 0;
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: f.owner, flags: { currentSession: true }, source: { expected, create: () => { loads++; return source; } } });
  assert.equal((await runtime.routes.currentSession(req("currentSession", capability(), "invalid-owner"))).status, 401); assert.equal(loads, 0);
  const wrongHeaders: Record<string, string>[] = [{ "X-WiseDinner-Source": "a".repeat(64) }, { [CURRENT_GUIDE_HEADERS.version]: "wrong" }, { [CURRENT_GUIDE_HEADERS.sha256]: "a".repeat(64) }];
  for (const header of wrongHeaders) {
    assert.equal((await runtime.routes.currentSession(req("currentSession", capability(), A, header))).status, 409);
  }
  assert.equal(loads, 0);
  for (const change of [{ sourceSha256: "0".repeat(64) }, { expectedSourcePolicyBasisSha256: "0".repeat(64) }]) assert.equal((await runtime.routes.currentSession(req("currentSession", capability({}, change)))).status, 409);
  const unsupported = await runtime.routes.currentSession(req("currentSession", capability({ reviewedReferenceData: "wrong" }))); assert.equal((await unsupported.json()).result.outcome, "error");
  for (const change of [(s: Data) => { s.sourcePolicyBasisSha256 = "b".repeat(64); }, (s: Data) => { s.guidePolicy.sha256 = "a".repeat(64); }, (s: Data) => { s.reviewedReferenceData.configurationSha256 = "b".repeat(64); }]) {
    const altered: CurrentIntegrationSource = { ...source, guidePolicy: { ...guidePolicy }, reviewedReferenceData: structuredClone(packet) }; change(altered);
    const bad = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: f.owner, flags: { currentSession: true }, source: { expected, create: () => altered } });
    assert.equal((await bad.routes.currentSession(req("currentSession", capability()))).status, 503); assert.equal(bad.inspect().source.state, "unsupported");
  }
});

test("invalid/missing billing refuses paid writes while capabilities and independent owner metadata remain usable", async () => {
  const f = ports(); let access = 0;
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: f.owner, flags: { currentRead: true, currentSession: true }, source: { expected, create: () => source },
    subscription: { environment: "wrong", access: async () => { access++; throw Error("must not grant"); } } as unknown as NonNullable<NonNullable<Parameters<typeof createCurrentIntegrationRuntime>[0]>["subscription"]> });
  assert.equal(runtime.inspect().subscription.state, "unsupported");
  assert.equal((await runtime.routes.currentSession(req("currentSession", capability()))).status, 200);
  assert.equal((await runtime.routes.currentSession(req("currentSession", capability({}, { operation: "saveCurrent" })))).status, 403);
  const metadata = await runtime.routes.currentRead(req("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }));
  assert.equal((await metadata.json()).result.outcome, "metadata"); assert.equal(access, 0);
});

test("assembler leaves bounded streaming/strict duplicate/UTF8 parsing to the actual session exactly once", async () => {
  const f = ports(), runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: f.owner, flags: { currentSession: true }, source: { expected, create: () => source } });
  let pulls = 0; const body = Buffer.from(JSON.stringify(capability())); let offset = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { pulls++; if (offset < body.length) { controller.enqueue(body.subarray(offset, offset + 32)); offset += 32; } else controller.close(); } });
  const streamed = new Request(host + CURRENT_INTEGRATION_ROUTES.currentSession, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + A }, body: stream, duplex: "half" } as RequestInit);
  assert.equal((await runtime.routes.currentSession(streamed)).status, 200); assert.equal(streamed.bodyUsed, true); assert.equal(pulls, Math.ceil(body.length / 32) + 1);
  const duplicate = JSON.stringify(capability()).replace('"payload":{}', '"payload":{},"payload":{}'); assert.equal((await runtime.routes.currentSession(req("currentSession", duplicate))).status, 400);
  assert.equal((await runtime.routes.currentSession(req("currentSession", "{}", A, { "content-length": String(8 * 1024 * 1024 + 1) }))).status, 413);
  assert.equal((await runtime.routes.currentSession(req("currentSession", " ".repeat(8 * 1024 * 1024 + 1)))).status, 413);
  const malformed = new Request(host + CURRENT_INTEGRATION_ROUTES.currentSession, { method: "POST", headers: { authorization: "Bearer " + A, "content-type": "application/json" }, body: new Uint8Array([255]) });
  assert.equal((await runtime.routes.currentSession(malformed)).status, 400);
});

async function savedOriginal() {
  // Real producer receipt, synthetic two-record source. It intentionally differs
  // from the current1300 source; currentRead must not require new admission.
  const f = syntheticV2(); const rows = f.rows.map(row => ({ ...row, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(row => JSON.stringify(row)).join("\n") + "\n"), sourceSha256 = createHash("sha256").update(bytes).digest("hex");
  const request = { ...f.request, slots: ["breakfast", "lunch", "dinner"] };
  const assignments = f.assignments.flatMap(row => request.slots.map(slot => ({ ...row, assignmentId: row.assignmentId + slot, slot })));
  let stored: Data | undefined;
  const transactions: typeof f.port = { transaction: cb => f.port.transaction(tx => cb({ ...tx, async commit(...args) { await tx.commit(...args); stored = canonicalReferenceData(args[2]) as Data; } })) };
  const producer = createReferenceSessionHandlerV2(bytes, { ...f.configuration, sourcePin: { sha256: sourceSha256, recordCount: 2 } }, { ...f.options, transactions });
  assert.equal(producer.outcome, "ready"); if (producer.outcome !== "ready") throw Error("synthetic producer held");
  const intent = { contract: "wd-joined-session-proposal-v2", operation: "installCurrent", operationId: randomUUID(), sourceSha256, payload: { ...f.initial, request, assignments }, expectedSourcePolicyBasisSha256: producer.sourcePolicyBasis.basisSha256 };
  const original = { ...intent, intentSha256: referenceOperationDigest(intent) };
  const response = await producer.handle(req("currentSession", original)); assert.equal((await response.json()).result.outcome, "acknowledged"); assert.ok(stored);
  return { original, stored };
}

test("real original ACK/unknown status survives absent source, guide, billing and Apple; A/B and revision changes isolate reads", async () => {
  const saved = await savedOriginal(), f = ports();
  const rpc: CurrentOwnerRpcDriver = { async call(input) {
    assert.equal(input.action, "read_operation");
    const operation = input.ownerId === A ? saved.stored : null;
    return { operation, meta: null, operationRecordSha256: operation ? hash(operation) : null };
  } };
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: { ...f.owner, rpc }, flags: { currentRead: true, currentSession: true, deletion: true } });
  const status = { contract: "wd-current-owner-read-v1", operation: "operationStatus", requestId: randomUUID(), targetOperationId: saved.original.operationId, targetIntentSha256: saved.original.intentSha256, originalEnvelope: saved.original };
  const send = async (owner = A) => (await (await runtime.routes.currentRead(req("currentRead", status, owner))).json()).result;
  const a = await send(); assert.equal(a.saved, true); assert.equal(a.disposition, "acknowledged"); assert.equal(a.sourceBinding.sourceSha256, saved.original.sourceSha256); assert.equal(a.retryAuthorized, false);
  const b = await send(B); assert.equal(b.disposition, "unresolved"); assert.equal(b.saved, undefined); assert.equal(b.retryAuthorized, false);
  assert.equal((await send()).saved, true); assert.equal(runtime.inspect().routes.currentSession.state, "unsupported");
  // A separate actual metadata port changes verified owner in-flight.
  const flipping = ports(); flipping.switchDuringRead();
  const changed = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: flipping.owner, flags: { currentRead: true } });
  const response = await changed.routes.currentRead(req("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }));
  assert.equal((await response.json()).result.code, "owner_changed_during_read");
});

test("source bind lease mismatch holds before kernel execution and preserves independent reads", async () => {
  const f = ports(); let handled = 0;
  const badSource: CurrentIntegrationSource = { ...source, bind: async () => ({ newWeekCommitBefore: expected.window.commitBefore + 1, async handle() { handled++; return Response.json({ result: { outcome: "acknowledged" } }); } }) };
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: f.owner, flags: { currentSession: true, currentRead: true }, source: { expected, create: () => badSource } });
  assert.equal((await runtime.routes.currentSession(req("currentSession", capability()))).status, 503);
  assert.equal(handled, 0);
  const read = await runtime.routes.currentRead(req("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }));
  assert.equal((await read.json()).result.outcome, "metadata");
});

test("default real Supabase Auth/account/RPC adapters use distinct credentials, no init or billing probe", async () => {
  let calls = 0, auth = 0, rpc = 0, reads = 0;
  const token = "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ sub: A, iss: target + "/auth/v1", aud: "authenticated", role: "authenticated", exp: Math.floor(utc / 1000) + 60 })).toString("base64url") + ".synthetic";
  const transport: typeof fetch = async (url, init) => {
    calls++; const headers = new Headers(init?.headers); assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error");
    if (String(url).endsWith("/auth/v1/user")) {
      auth++; assert.equal(headers.get("apikey"), supabase.publicAuthKey); assert.equal(headers.get("authorization"), "Bearer " + token);
      return Response.json({ id: A, is_anonymous: false, email_confirmed_at: "2026-10-30T12:00:00Z", identities: [{ provider: "email" }] });
    }
    if (String(url).endsWith("/rest/v1/rpc/wd_account_command")) {
      reads++; assert.equal(headers.get("apikey"), supabase.publicAuthKey); assert.equal(headers.get("authorization"), "Bearer " + token);
      assert.deepEqual(JSON.parse(String(init?.body)), { p_action: "read", p_body: {}, p_key: null }); return Response.json({ preferences: {}, revision: 1 });
    }
    assert.equal(String(url), target + "/rest/v1/rpc/wd_current_plan_rpc"); rpc++;
    assert.equal(headers.get("apikey"), supabase.serverCredential); assert.equal(headers.get("authorization"), "Bearer " + supabase.serverCredential);
    assert.equal(JSON.parse(String(init?.body)).p_action, "read_state"); return Response.json({ state: null, meta: null });
  };
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, flags: { currentRead: true }, request: transport, now: () => utc });
  runtime.inspect(); assert.equal(calls, 0);
  const response = await runtime.routes.currentRead(req("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }, token));
  assert.equal(response.status, 200); assert.equal((await response.json()).result.outcome, "metadata");
  assert.deepEqual({ auth, reads, rpc, calls }, { auth: 2, reads: 2, rpc: 1, calls: 5 });
});

test("actual V4 clock holds new planning after window expiry without renewing source or blocking original metadata", async () => {
  const initial = utc, f = ports();
  try {
    utc = Date.parse("2026-11-06T00:00:00Z");
    const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: f.owner, now: () => utc, flags: { currentSession: true, currentRead: true }, source: { expected, create: () => source } });
    // Clock policy refuses before planning this deliberately incomplete input.
    // This is a negative clock vector, not a lower-goal successful week.
    const operation = capability({ request: { pantry: [], asOfDate: "2026-11-06" }, searchGrid: {} }, { operation: "planJoined", expectedSourcePolicyBasisSha256: packet.sourcePolicyBasis.basisSha256 });
    const response = await runtime.routes.currentSession(req("currentSession", operation));
    assert.equal((await response.json()).result.code, "reference_snapshot_expired");
    assert.equal(response.headers.get("x-wisedinner-reference-through"), "2026-11-05");
    const read = await runtime.routes.currentRead(req("currentRead", { contract: "wd-current-owner-read-v1", operation: "metadata", requestId: randomUUID(), target: "current" }));
    assert.equal((await read.json()).result.outcome, "metadata");
  } finally { utc = initial; }
});
