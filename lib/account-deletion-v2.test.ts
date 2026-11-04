import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createAccountDeletionV2Service, deletionRecoveryHash, deletionIntentHash, inspectDeletionV2Policy, inspectDeletionV2Receipt, createDeletionV2RpcRepository } from "./account-deletion-v2.server.ts";
import { POST } from "../app/api/v1/account/deletion-v2/route.ts";

test("retirement opt-in cannot widen original legacy status or accept an unknown lifecycle", async () => {
  let calls = 0;
  const operationId = randomUUID(), capability = randomBytes(32).toString("base64url");
  const service = createAccountDeletionV2Service({ enabled: true, verify: async () => { calls++; throw Error("no Auth"); }, repository: { account: async () => { calls++; return {}; }, worker: async () => { calls++; return { error: "prepared_original_retired" }; } }, providers: { verifyIdentity: async () => null, auth: { run: async () => { throw Error("no provider"); } } } });
  const request = (lifecycle?: string) => new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json", authorization: "Deletion-Recovery " + capability, ...(lifecycle ? { "x-wd-deletion-lifecycle": lifecycle } : {}) }, body: JSON.stringify({ contract: "wd-account-deletion-v2", operation: "status", operationId, intentSha256: "a".repeat(64) }) });
  assert.equal((await (await service(request("unreviewed"))).json()).result.code, "unsupported_lifecycle"); assert.equal(calls, 0);
  assert.equal((await (await service(request())).json()).result.code, "prepared_original_retired"); assert.equal(calls, 1);
});

test("P1 actual pinned native-safe SHA primitive and canonical array bytes agree with server original intent", async () => {
  // Test-only boundary, explicitly pinned by Main. Never a production App import
  // of Backend or a claim about the future App lifecycle/controller.
  const file = "C:/Users/borgh/Projects/wisedinner-app/src/vendor/wisedinner-shared-v13/lib/generated-runtime-bytes.ts";
  assert.equal(createHash("sha256").update(await readFile(file)).digest("hex"), "1a1b9498ae055189f3441c0f3222de5d3a3f021251cc5ff47f8d266f050af38a");
  const native = await import(pathToFileURL(file).href);
  const policy = { approved: true, version: "test-only", preparedSeconds: 60, pendingSeconds: 60, recoverySeconds: 60, receiptSeconds: 60, retainedEvidence: ["test_receipt"] };
  const policyHash = native.sha256Hex(JSON.stringify(canonicalReferenceData(policy)));
  for (let n = 1; n <= 16; n++) {
    const owner = randomUUID(), op = randomUUID(), capability = randomBytes(32).toString("base64url");
    const prehashBytes = JSON.stringify(["wd-deletion-recovery-prehash-v2", op, capability]);
    const prehash = native.sha256Hex(prehashBytes);
    assert.equal(prehash, deletionRecoveryHash(op, capability));
    const inputs = ["wd-account-deletion-v2", owner, op, n, prehash, policyHash, "DELETE MY ACCOUNT"];
    assert.equal(JSON.stringify(inputs), JSON.stringify(canonicalReferenceData(inputs)));
    assert.equal(native.sha256Hex(JSON.stringify(inputs)), deletionIntentHash(owner, op, n, prehash, policyHash));
    assert.notEqual(deletionIntentHash(owner, op, n, prehash, policyHash), deletionIntentHash(owner, op, n + 1, prehash, policyHash));
  }
  assert.throws(() => deletionIntentHash(randomUUID(), randomUUID(), 0, "a".repeat(64), policyHash));
  assert.throws(() => deletionIntentHash(randomUUID(), randomUUID(), 1.5, "a".repeat(64), policyHash));
  assert.throws(() => deletionIntentHash("not-an-owner", randomUUID(), 1, "a".repeat(64), policyHash));
  assert.throws(() => deletionIntentHash(randomUUID(), randomUUID(), 1, "bad", policyHash));
  assert.throws(() => deletionIntentHash(randomUUID(), randomUUID(), 1, "a".repeat(64), "bad"));
});

test("P2 original prepare intent precondition refuses before identity/admit/account effects", async () => {
  const owner = "10000000-0000-4000-8000-000000000001", operationId = randomUUID(), capability = randomBytes(32).toString("base64url");
  const effects = { identity: 0, admit: 0, account: 0, destructive: 0 };
  const policyHash = createHash("sha256").update(JSON.stringify(canonicalReferenceData({ approved: true, version: "test-only", preparedSeconds: 60, pendingSeconds: 60, recoverySeconds: 60, receiptSeconds: 60, retainedEvidence: ["test_receipt"] }))).digest("hex");
  const prehash = deletionRecoveryHash(operationId, capability);
  const service = createAccountDeletionV2Service({ enabled: true,
    verify: async () => ({ id: owner, token: "synthetic", providers: ["email"], authenticatedAt: Math.floor(Date.now() / 1000) }),
    policy: { approved: true, version: "test-only", preparedSeconds: 60, pendingSeconds: 60, recoverySeconds: 60, receiptSeconds: 60, retainedEvidence: ["test_receipt"] },
    repository: { worker: async () => { effects.admit++; return {}; }, account: async () => { effects.account++; return {}; } },
    providers: { verifyIdentity: async () => { effects.identity++; return { userId: owner, identityHash: "a".repeat(64), evidenceHash: "b".repeat(64), apple: "none" }; }, auth: { run: async () => { effects.destructive++; throw Error(); } } },
  });
  for (const header of [undefined, "bad", "a".repeat(64), "a".repeat(64) + "," + "b".repeat(64), deletionIntentHash(randomUUID(), operationId, 1, prehash, policyHash), deletionIntentHash(owner, operationId, 2, prehash, policyHash), deletionIntentHash(owner, operationId, 1, prehash, "f".repeat(64))]) {
    const response = await service(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json", "x-wd-deletion-recovery": capability, ...(header === undefined ? {} : { "x-wd-deletion-intent-sha256": header }) }, body: JSON.stringify({ contract: "wd-account-deletion-v2", operation: "prepare", operationId, expectedAccountRevision: 1 }) }));
    assert.equal(response.status, 409); assert.deepEqual(effects, { identity: 0, admit: 0, account: 0, destructive: 0 });
  }
});

test("D1/D6 recovery capability is canonical, original-operation scoped and never a general credential", () => {
  const op = randomUUID(), credential = randomBytes(32).toString("base64url");
  assert.match(deletionRecoveryHash(op, credential), /^[a-f0-9]{64}$/);
  assert.notEqual(deletionRecoveryHash(op, credential), deletionRecoveryHash(randomUUID(), credential));
  for (const value of ["", "x".repeat(42), "x".repeat(44), "!".repeat(43)]) assert.throws(() => deletionRecoveryHash(op, value));
});

test("D8 no default retention policy, strict receipt and configuration boundaries", () => {
  for (const value of [undefined, {}, { approved: true }, { approved: false }]) assert.throws(() => inspectDeletionV2Policy(value));
  assert.throws(() => inspectDeletionV2Receipt({ subscriptionCancelled: true }));
  for (const origin of ["http://fixture.invalid", "https://fixture.invalid/path", "https://user@fixture.invalid", "https://fixture.invalid?q=1"]) assert.throws(() => createDeletionV2RpcRepository(origin, "synthetic"));
});

test("D1/D8 composed HTTP rejects malformed, duplicate, oversized and extra fields before effects", async () => {
  let effects = 0;
  const service = createAccountDeletionV2Service({ enabled: true, verify: async () => { effects++; throw Error("not authorized"); }, repository: { account: async () => { effects++; return {}; }, worker: async () => { effects++; return {}; } }, providers: { verifyIdentity: async () => null, auth: { run: async () => { effects++; throw Error(); } } } });
  const op = randomUUID();
  for (const body of ["{", '{"contract":"a","contract":"b"}', JSON.stringify({ contract: "wd-account-deletion-v2", operation: "status", operationId: op, intentSha256: "a".repeat(64), extra: true })]) {
    const response = await service(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body }));
    assert.equal(response.status, 409); assert.ok((await response.json()).result);
  }
  const large = await service(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(16385) }));
  assert.equal(large.status, 413); assert.ok((await large.json()).result);
  for (const request of [new Request("https://fixture.invalid", { method: "GET" }), new Request("https://fixture.invalid", { method: "POST", body: "{}" }), new Request("https://fixture.invalid?q=1", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })]) assert.equal((await service(request)).status, 409);
  assert.equal(effects, 0);
});

test("D1/D8 bounded RPC transport rejects oversized, duplicate-key and redirected responses", async () => {
  for (const response of [new Response("x".repeat(16385)), new Response('{"a":1,"a":2}'), new Response("{}", { status: 302, headers: { location: "https://other.invalid" } })]) {
    const repository = createDeletionV2RpcRepository("https://fixture.invalid", "synthetic", async () => response);
    await assert.rejects(repository.worker("status", {}));
  }
});

test("D8 actual route is default-off before constructing a provider or reading credentials", async () => {
  const names = ["WD_ACCOUNT_DELETION_V2_ENABLED", "WD_ACCOUNT_DELETION_V2_CONFIGURATION_VERIFIED"];
  const saved = names.map(name => process.env[name]);
  try {
    for (const name of names) delete process.env[name];
    const response = await POST(new Request("https://fixture.invalid", { method: "POST", body: "{}" }));
    assert.equal(response.status, 503); assert.equal((await response.json()).result.code, "deletion_v2_disabled");
  } finally { names.forEach((name, i) => { if (saved[i] === undefined) delete process.env[name]; else process.env[name] = saved[i]; }); }
});


test("optional original status seam is absent by default and cannot authorize prepare/provider retries",async()=>{
 let recoveries=0;const service=createAccountDeletionV2Service({enabled:true,verify:async()=>{throw Error("no fresh Auth");},repository:{account:async()=>{throw Error("no account");},worker:async()=>({error:"recovery_unavailable"})},providers:{verifyIdentity:async()=>null,auth:{run:async()=>{throw Error("no provider");}}},statusRecovery:{async recover(){recoveries++;throw Error();}}});
 const r=await service(new Request("https://synthetic.invalid",{method:"POST",headers:{"content-type":"application/json",authorization:"Deletion-Recovery "+randomBytes(32).toString("base64url")},body:JSON.stringify({contract:"wd-account-deletion-v2",operation:"status",operationId:randomUUID(),intentSha256:"a".repeat(64)})}));assert.equal(r.status,409);assert.equal(recoveries,0);
});
