import test from "node:test";
import assert from "node:assert/strict";
import { AccountError, type VerifiedAccount } from "./account.ts";
import { admitVerifiedReferenceOwner, isIssuedVerifiedOwnerScope, type OwnerScopeDependencies, type VerifiedOwnerScope } from "./generated-owner-scope.ts";
import { createReferenceSessionHandlerV2 } from "./generated-plan-session.ts";
import { syntheticV2 } from "./generated-plan-v2.test-support.ts";

const id = (n: number) => `10000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const verified = (n: number): VerifiedAccount => ({ id: id(n), token: "synthetic-only-not-a-session", authenticatedAt: 1, providers: ["email"] });
function adapters(n: number, revision = 1): OwnerScopeDependencies {
  return { verify: async () => verified(n), readAccount: async () => ({ userId: id(n), state: "active", revision }) };
}
function ready(value: VerifiedOwnerScope) { assert.equal(value.outcome, "ready"); if (value.outcome !== "ready") throw Error("fixture owner not ready"); return value; }
const request = () => new Request("https://fixture.invalid/current-plan", { method: "POST", headers: { "x-owner-id": id(999) }, body: JSON.stringify({ ownerId: id(999), scope: "forged" }) });

test("verified subjects, not caller owner claims, bind actual V2 kernel storage namespaces", async () => {
  const a = ready(await admitVerifiedReferenceOwner(request(), adapters(1)));
  const b = ready(await admitVerifiedReferenceOwner(request(), adapters(2)));
  assert.equal(a.ownerId, id(1)); assert.equal(b.ownerId, id(2)); assert.notEqual(a.storageKey, b.storageKey);
  assert.equal("token" in a, false); assert.equal(Object.isFrozen(a), true);
  assert.equal(isIssuedVerifiedOwnerScope(a), true);
  assert.equal(isIssuedVerifiedOwnerScope(JSON.parse(JSON.stringify(a))), false);
  const fixture = syntheticV2(), observed: string[] = [];
  const port = { transaction: <T>(body: Parameters<typeof fixture.port.transaction<T>>[0]) => fixture.port.transaction(tx => body({ ...tx, async readState(key) { observed.push(key); return tx.readState(key); } })) };
  const handles = [];
  for (const owner of [a, b]) {
    const bound = createReferenceSessionHandlerV2(fixture.bytes, fixture.configuration, { ...fixture.options, transactions: port, resolveScope: () => owner.scope });
    assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw Error("fixture kernel unavailable");
    handles.push(bound);
    const response = await bound.handle(new Request("https://fixture.invalid/current-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fixture.envelope("readCurrent", {})) }));
    assert.equal(response.status, 200);
  }
  assert.deepEqual(observed, [a.storageKey, b.storageKey]);
  const refreshed = ready(await admitVerifiedReferenceOwner(request(), adapters(1, 2)));
  assert.equal(refreshed.storageKey, a.storageKey, "revision refresh cannot orphan saved owner data");
  const staleResponse = await handles[0].handle(new Request("https://fixture.invalid/current-plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fixture.envelope("readCurrent", {}, 2)) }));
  assert.ok(["error", "held"].includes((await staleResponse.json()).result.outcome));
  assert.equal(observed.length, 2, "revoked handle cannot reach the durable-state reader");
});

test("missing verification, tombstones, mismatched owners and malformed account revisions never grant a scope", async () => {
  let reads = 0;
  const unauthorized = await admitVerifiedReferenceOwner(request(), { verify: async () => { throw new AccountError(401, "synthetic"); }, readAccount: async () => { reads++; throw Error("must not read"); } });
  assert.equal(unauthorized.outcome, "denied"); assert.equal(reads, 0);
  for (const state of ["deletion_pending", "deleted"] as const) {
    assert.deepEqual(await admitVerifiedReferenceOwner(request(), { ...adapters(10), readAccount: async () => ({ userId: id(10), state, revision: 1 }) }), { outcome: "denied", code: "owner_inactive" });
  }
  for (const state of [{ userId: id(11), state: "active" as const, revision: 1 }, { userId: id(10), state: "active" as const, revision: 0 }, { userId: id(10), state: "active" as const, revision: 1.5 }]) {
    assert.deepEqual(await admitVerifiedReferenceOwner(request(), { ...adapters(10), readAccount: async () => state }), { outcome: "held", code: "owner_state_invalid" });
  }
});

test("provider/store faults are held and redacted; old account generations cannot be reissued", async () => {
  const provider = await admitVerifiedReferenceOwner(request(), { ...adapters(20), verify: async () => { throw Error("synthetic private token must not escape"); } });
  assert.deepEqual(provider, { outcome: "held", code: "owner_verification_unavailable" });
  const store = await admitVerifiedReferenceOwner(request(), { ...adapters(20), readAccount: async () => { throw Error("synthetic private database address"); } });
  assert.deepEqual(store, { outcome: "held", code: "owner_store_unavailable" });
  ready(await admitVerifiedReferenceOwner(request(), adapters(20, 4)));
  assert.deepEqual(await admitVerifiedReferenceOwner(request(), adapters(20, 3)), { outcome: "held", code: "owner_scope_unavailable" });
});
