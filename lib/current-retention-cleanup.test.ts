import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createCurrentRetentionCleanup, createCurrentRetentionRpcPorts, CURRENT_RETENTION, type CurrentRetentionCleanupDependencies, type RetentionResult } from "./current-retention-cleanup.server.ts";
import { appleDigest } from "./apple-token-custody.server.ts";

const deletionPolicy = { approved: true, version: "synthetic", preparedSeconds: 100, pendingSeconds: 100, recoverySeconds: 100, receiptSeconds: 100, retainedEvidence: ["deletion_receipt"] };
const custodyPolicy = { approved: true, version: "synthetic", credentialSeconds: 100, recoverySeconds: 100, evidenceSeconds: 100, retainedEvidence: ["apple_credential_recovery"] };
const deletionHash = appleDigest(deletionPolicy), custodyHash = appleDigest(custodyPolicy), schemaSha256 = "a".repeat(64), eraserSha256 = "b".repeat(64);
type Row = { ownerId: string; lineageId: string; operationId: string; intentSha256: string; policySha256: string; dueAt: number; state: string; attemptId: string | null; envelope: boolean; readback: boolean; providerState: string };
function fixture(size = 1) {
  const now = 1800000000000, rows: Row[] = Array.from({ length: size }, () => ({ ownerId: randomUUID(), lineageId: randomUUID(), operationId: randomUUID(), intentSha256: "c".repeat(64), policySha256: custodyHash, dueAt: now - 1, state: "available", attemptId: null, envelope: true, readback: false, providerState: "stored" }));
  const state = { time: now, eraseCalls: 0, commands: [] as string[], admissionCalls: 0, failErase: false, lostEraseAck: false, lostStatus: false, lostReserveAck: false, partial: false, unknown: 0, foreign: 0, mutateInventory: (r: Record<string, unknown>) => r, mutateStatus: (r: Record<string, unknown>) => r };
  const base = () => ({ contract: CURRENT_RETENTION, schemaSha256, eraserSha256, observedAt: state.time });
  const repo: CurrentRetentionCleanupDependencies["repository"] = {
    async command(action, body) {
      state.commands.push(action);
      assert.equal(body.policySha256, deletionHash); assert.equal(body.custodyPolicySha256, custodyHash);
      if (action === "inventory") {
        const due = rows.filter(r => r.dueAt <= state.time && (r.envelope || r.attemptId && !r.readback));
        const next = rows.filter(r => r.envelope && r.dueAt > state.time).map(r => r.dueAt);
        return state.mutateInventory({ ...base(), registryId: "wd-apple-custody-v1", policySha256: deletionHash, custodyPolicySha256: custodyHash, dueCount: due.length, unknownCount: state.unknown, foreignPolicyCount: state.foreign, overflow: due.length > Number(body.maxRecords), nextDueAt: next.length ? Math.min(...next) : null, rows: due.slice(0, Number(body.maxRecords) + 1).map(r => ({ ownerId: r.ownerId, lineageId: r.lineageId, operationId: r.operationId, intentSha256: r.intentSha256, policySha256: r.policySha256, dueAt: r.dueAt, state: r.state, attemptId: r.attemptId })) });
      }
      const row = rows.find(r => r.lineageId === body.lineageId && r.ownerId === body.ownerId && r.operationId === body.operationId && r.intentSha256 === body.intentSha256);
      if (!row) return { error: "original_unverified" };
      if (action === "reserve") {
        const fresh = row.attemptId === null;
        row.attemptId ??= String(body.attemptId);
        if (state.lostReserveAck) throw Error("lost_reserve_ack");
        return { ...base(), ownerId: row.ownerId, lineageId: row.lineageId, operationId: row.operationId, intentSha256: row.intentSha256, policySha256: row.policySha256, attemptId: row.attemptId, fresh };
      }
      if (state.lostStatus) throw Error("lost_status");
      assert.equal(body.attemptId, row.attemptId);
      if (row.state === "erased" && !row.envelope) row.readback = true;
      return state.mutateStatus({ ...base(), ownerId: row.ownerId, lineageId: row.lineageId, operationId: row.operationId, intentSha256: row.intentSha256, policySha256: row.policySha256, attemptId: row.attemptId, state: row.state, envelopePresent: row.envelope, providerState: row.providerState });
    }
  };
  const deps: CurrentRetentionCleanupDependencies = { deletionPolicy, custodyPolicy, schemaSha256, eraserSha256, maxRecords: 4, freshnessMs: 1000, clockSkewMs: 10, clock: () => state.time, repository: repo,
    readAdmission: async input => { state.admissionCalls++; assert.equal(input.policySha256, deletionHash); return { outcome: "admitted", registryId: "wd-apple-custody-v1", policySha256: deletionHash, custodyPolicySha256: custodyHash, schemaSha256, eraserSha256, observedAt: state.time, validUntil: state.time + 1000 }; },
    eraseExpired: async input => { state.eraseCalls++; assert.equal(input.policySha256, custodyHash); const row = rows.find(r => r.ownerId === input.ownerId && r.lineageId === input.lineageId)!; assert.ok(row.attemptId); if (state.failErase) throw Error("original_unknown"); if (!state.partial) { row.envelope = false; row.state = "erased"; } if (state.lostEraseAck) throw Error("ack_lost"); return { outcome: "erased", lineageId: input.lineageId, policySha256: custodyHash }; }
  };
  const run = (custom = deps) => createCurrentRetentionCleanup(custom).verify({ policySha256: deletionHash, now: state.time });
  return { state, rows, repo, deps, run, now };
}
function verified(r: RetentionResult) { assert.equal(r.outcome, "verified"); assert.deepEqual(Object.keys(r).sort(), ["evidenceSha256", "outcome", "policySha256", "validUntil"]); if (r.outcome === "verified") { assert.equal(r.policySha256, deletionHash); assert.match(r.evidenceSha256, /^[a-f0-9]{64}$/); assert.ok(Number.isSafeInteger(r.validUntil)); } }

test("constructor has no IO; absent policies/dependencies and malformed consumer inputs hold before effects", async () => {
  const f = fixture(), service = createCurrentRetentionCleanup(f.deps);
  assert.equal(f.state.admissionCalls, 0); assert.deepEqual(f.state.commands, []); assert.equal(f.state.eraseCalls, 0);
  for (const dep of [undefined, { ...f.deps, custodyPolicy: undefined }, { ...f.deps, deletionPolicy: { ...deletionPolicy, approved: false } }, { ...f.deps, maxRecords: 0 }, { ...f.deps, eraseExpired: undefined }]) assert.deepEqual(await createCurrentRetentionCleanup(dep as CurrentRetentionCleanupDependencies).verify({ policySha256: deletionHash, now: f.now }), { outcome: "held" });
  for (const input of [{ policySha256: custodyHash, now: f.now }, { policySha256: deletionHash, now: NaN }, { policySha256: deletionHash, now: f.now / 1000 }, { policySha256: deletionHash, now: f.now, extra: true }]) assert.deepEqual(await service.verify(input), { outcome: "held" });
  assert.equal(f.state.admissionCalls, 0); assert.equal(f.state.eraseCalls, 0);
});
test("real in-memory erasure precedes first deletion prepare and preserves distinct hashes and original provider uncertainty", async () => {
  const f = fixture(2); f.rows[1].providerState = "unknown"; f.rows[1].state = "revoke_unknown";
  verified(await f.run()); assert.equal(f.state.eraseCalls, 2); assert.ok(f.rows.every(r => !r.envelope && r.readback)); assert.equal(f.rows[1].providerState, "unknown");
  assert.deepEqual(f.state.commands, ["inventory", "reserve", "status", "reserve", "status", "inventory"]);
});
test("large active population does not consume due capacity; zero due requires two complete fresh observations", async () => {
  const f = fixture(2000); f.rows.forEach(r => r.dueAt = f.now + 5000); f.rows[0].dueAt = f.now - 1;
  verified(await f.run()); assert.equal(f.state.eraseCalls, 1); assert.equal(f.rows.filter(r => r.envelope).length, 1999);
  f.state.commands.length = 0; verified(await f.run()); assert.deepEqual(f.state.commands, ["inventory", "inventory"]); assert.equal(f.state.eraseCalls, 1);
  const empty = fixture(0); empty.state.mutateInventory = r => ({ ...r, unknownCount: 1 }); assert.deepEqual(await empty.run(), { outcome: "held" });
});
test("overflow, foreign policy, unknown eligibility and partial coverage hold before mutation", async () => {
  for (const kind of ["overflow", "foreign", "unknown", "truncated", "duplicate", "future", "schema"] as const) {
    const f = fixture(kind === "overflow" ? 5 : 2);
    if (kind === "foreign") f.state.foreign = 1;
    if (kind === "unknown") f.state.unknown = 1;
    if (kind === "truncated") f.state.mutateInventory = r => ({ ...r, rows: [] });
    if (kind === "duplicate") f.state.mutateInventory = r => ({ ...r, rows: [(r.rows as unknown[])[0], (r.rows as unknown[])[0]] });
    if (kind === "future") f.rows[0].dueAt = f.now + 1;
    if (kind === "schema") f.state.mutateInventory = r => ({ ...r, schemaSha256: "f".repeat(64) });
    if (kind === "future") { verified(await f.run()); assert.equal(f.state.eraseCalls, 1); assert.equal(f.rows[0].envelope, true); }
    else { assert.deepEqual(await f.run(), { outcome: "held" }, kind); assert.equal(f.state.eraseCalls, 0, kind); }
  }
});
test("partial or unknown erasure is durable held after repository reload, never a blind resend", async () => {
  for (const mode of ["failErase", "partial", "lostReserveAck"] as const) {
    const f = fixture(); f.state[mode] = true;
    assert.deepEqual(await f.run(), { outcome: "held" }); const calls = f.state.eraseCalls;
    f.state[mode] = false; assert.deepEqual(await f.run(), { outcome: "held" }); assert.equal(f.state.eraseCalls, calls); assert.equal(f.rows[0].envelope, true);
  }
});
test("lost erase/status ACK reconciles exact original after reload without second erase", async () => {
  const f = fixture(); f.state.lostEraseAck = true; f.state.lostStatus = true;
  assert.deepEqual(await f.run(), { outcome: "held" }); assert.equal(f.state.eraseCalls, 1);
  f.state.lostStatus = false; verified(await f.run()); assert.equal(f.state.eraseCalls, 1); assert.ok(f.rows[0].readback);
});
test("wrong owner/lineage/policy/readback cannot create proof; freshness and final remaining rows are enforced", async () => {
  for (const field of ["ownerId", "lineageId", "policySha256", "attemptId", "envelopePresent"] as const) {
    const f = fixture(); f.state.mutateStatus = r => ({ ...r, [field]: field === "envelopePresent" ? true : field === "policySha256" ? deletionHash : randomUUID() });
    assert.deepEqual(await f.run(), { outcome: "held" }, field);
  }
  const stale = fixture(); stale.state.mutateInventory = r => ({ ...r, observedAt: stale.now - 1001 }); assert.deepEqual(await stale.run(), { outcome: "held" }); assert.equal(stale.state.eraseCalls, 0);
  const remaining = fixture(); let reads = 0; remaining.state.mutateInventory = r => { if (++reads === 2) return { ...r, dueCount: 1 }; return r; }; assert.deepEqual(await remaining.run(), { outcome: "held" });
});
test("shared-instance and separate-instance concurrency reserve once; configuration is snapshotted", async () => {
  const f = fixture(), service = createCurrentRetentionCleanup(f.deps); const a = createCurrentRetentionCleanup(f.deps);
  const results = await Promise.all([service.verify({ policySha256: deletionHash, now: f.now }), service.verify({ policySha256: deletionHash, now: f.now }), a.verify({ policySha256: deletionHash, now: f.now })]);
  assert.ok(results.some(r => r.outcome === "verified")); assert.equal(f.state.eraseCalls, 1);
});
test("admission schema/policy/freshness and proof horizon are checked before effects", async () => {
  for (const change of [{ outcome: "held" }, { registryId: "partial" }, { custodyPolicySha256: deletionHash }, { schemaSha256: "f".repeat(64) }, { observedAt: 1800000000000 - 1001 }, { observedAt: 1800000000000 + 11 }, { validUntil: 1800000000000 }]) {
    const f = fixture();
    const deps = { ...f.deps, readAdmission: async (v: Parameters<CurrentRetentionCleanupDependencies["readAdmission"]>[0]) => ({ ...await f.deps.readAdmission(v) as Record<string, unknown>, ...change }) };
    assert.deepEqual(await f.run(deps), { outcome: "held" }); assert.equal(f.state.eraseCalls, 0);
  }
  const f = fixture(0), deps = { ...f.deps }, service = createCurrentRetentionCleanup(deps);
  deps.maxRecords = 0; deps.readAdmission = async () => { throw Error("mutated_callback"); };
  verified(await service.verify({ policySha256: deletionHash, now: f.now }));
  const timed = fixture(); let reads = 0;
  timed.state.mutateInventory = r => { if (++reads === 2) timed.state.time += 1001; return r; };
  assert.deepEqual(await timed.run(), { outcome: "held" });
});
test("malformed erase ACK needs exact readback; a lost reservation ACK cannot authorize erase", async () => {
  const f = fixture();
  const deps = { ...f.deps, eraseExpired: async (v: Parameters<CurrentRetentionCleanupDependencies["eraseExpired"]>[0]) => { await f.deps.eraseExpired(v); return { outcome: "erased", lineageId: randomUUID(), policySha256: deletionHash }; } };
  verified(await f.run(deps)); assert.equal(f.state.eraseCalls, 1, "authoritative exact afterimage resolves the uncertain ACK");
  const lost = fixture(); lost.state.lostReserveAck = true; assert.deepEqual(await lost.run(), { outcome: "held" }); assert.equal(lost.state.eraseCalls, 0);
  lost.state.lostReserveAck = false; assert.deepEqual(await lost.run(), { outcome: "held" }); assert.equal(lost.state.eraseCalls, 0);
});
test("actual HTTP port uses only pinned RPCs, bounded responses and no IO construction", async () => {
  const seen: string[] = [];
  const ports = createCurrentRetentionRpcPorts("https://fixture.invalid", "synthetic", async (url, init) => { seen.push(new URL(String(url)).pathname); assert.equal(init?.redirect, "error"); assert.equal(JSON.parse(String(init?.body)).p_action, seen.length === 1 ? "inventory" : "erase_expired"); return Response.json({ outcome: "synthetic_only" }); });
  assert.equal(seen.length, 0); await ports.command("inventory", {}); await ports.eraseExpired({ ownerId: randomUUID(), lineageId: randomUUID(), policySha256: custodyHash });
  assert.deepEqual(seen, ["/rest/v1/rpc/wd_current_retention_inventory_command", "/rest/v1/rpc/wd_current_credential_expiry_command"]);
  const refused = createCurrentRetentionRpcPorts("https://fixture.invalid", "synthetic", async () => Response.json({}, { status: 503 }));
  await assert.rejects(refused.command("inventory", {}), /unknown/);
});
