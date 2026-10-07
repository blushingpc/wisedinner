import test from "node:test";
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { isolatedTarget, verifyIsolatedTarget, migrationInventory, runIsolated, type MigrationPin } from "./account-isolated.ts";
import { runDryPrepared } from "./account-isolated-dry.ts";
import { memoryLifecycleFixture, type DryScenario } from "./account-isolated.fixture.ts";

const target = { purpose: "wisedinner-disposable-account-acceptance", disposable: true, projectRef: "abcdefghijklmnopqrst", url: "https://abcdefghijklmnopqrst.supabase.co", nonce: "10000000-0000-4000-8000-000000000001", credentialFile: "C:/acceptance/keys.json", outputDir: "C:/acceptance/runs" };
test("current complete nine-migration attestation permits acceptance preparation", async () => {
  const files = ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0008_wd_publication.sql", "0009_wd_notifications.sql", "0010_wd_operations.sql", "0011_wd_support_sends.sql", "0012_wd_support_outbox.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql"];
  const inventory: MigrationPin[] = [];
  for (const file of files) {
    const bytes = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url));
    inventory.push({ file, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
  }
  let requests = 0;
  await verifyIsolatedTarget(target, "synthetic", (async () => { requests++; return Response.json([{ id: target.nonce, purpose: target.purpose, disposable: true, project_ref: target.projectRef, schema_revision: "0006-0014", migration_digests: inventory }]); }) as typeof fetch);
  assert.equal(requests, 1);
});
// Guard tests only. Fake HTTP responses do not establish hosted execution proof.
test("shared target refuses before network or mutation even with disposable assertion", async () => {
  let requests = 0;
  const fetcher = (async () => { requests++; throw Error("must_not_call"); }) as typeof fetch;
  await assert.rejects(verifyIsolatedTarget({ ...target, projectRef: "zpvqxtklvjitofpbddrn", url: "https://zpvqxtklvjitofpbddrn.supabase.co" }, "unused", fetcher));
  assert.equal(requests, 0);
});
test("normal guard permits only matching server marker and GET without redirects", async () => {
  const calls: RequestInit[] = [];
  const inventory = await migrationInventory();
  const fetcher = (async (_url, init) => {
    calls.push(init!);
    return Response.json([{ id: target.nonce, purpose: target.purpose, disposable: true, project_ref: target.projectRef, schema_revision: "0006-0014", migration_digests: inventory }]);
  }) as typeof fetch;
  await verifyIsolatedTarget(target, "unused", fetcher);
  assert.equal(calls.length, 1); assert.equal(calls[0].method, "GET"); assert.equal(calls[0].redirect, "error"); assert.equal(calls[0].cache, "no-store"); assert(calls[0].signal);
});

const marker = async () => [{ id: target.nonce, purpose: target.purpose, disposable: true, project_ref: target.projectRef, schema_revision: "0006-0014", migration_digests: await migrationInventory() }];
test("stale/missing/duplicate/tampered inventory and wrong attestation refuse before dry construction", async () => {
  const row = (await marker())[0];
  const mutations = [[], [row, row], [{ ...row, schema_revision: "0006-0011" }], [{ ...row, disposable: false }], [{ ...row, nonce: target.nonce }], [{ ...row, id: "wrong" }], [{ ...row, purpose: "production" }], [{ ...row, project_ref: "zpvqxtklvjitofpbddrn" }], [{ ...row, migration_digests: row.migration_digests.slice(1) }], [{ ...row, migration_digests: [...row.migration_digests, row.migration_digests[0]] }], [{ ...row, migration_digests: row.migration_digests.map((p, i) => i ? p : { ...p, sha256: "0".repeat(64) }) }]];
  // Never auto-upgrade an old marker or infer 0014 from an otherwise valid prefix.
  mutations.push([{ ...row, schema_revision: "0006-0013", migration_digests: row.migration_digests.slice(0, 8) }], [{ ...row, migration_digests: row.migration_digests.slice(0, 8) }], [{ ...row, migration_digests: [...row.migration_digests, row.migration_digests[8]] }], [{ ...row, migration_digests: [...row.migration_digests].reverse() }]);
  for (const delta of [{ file: "0014_wrong.sql" }, { bytes: row.migration_digests[8].bytes - 1 }, { sha256: "0".repeat(64) }]) mutations.push([{ ...row, migration_digests: row.migration_digests.map((pin, i) => i === 8 ? { ...pin, ...delta } : pin) }]);
  for (const value of mutations) {
    let constructed = 0, requests = 0;
    await assert.rejects(runDryPrepared(target, { mode: "dry", markerRequest: async (_url, init) => { requests++; assert.equal(init!.method, "GET"); return Response.json(value); }, create: async () => { constructed++; throw Error("must_not_construct"); } }), /^Error: target_marker_refused$/);
    assert.equal(requests, 1); assert.equal(constructed, 0);
  }
});
test("bounded malformed/unavailable/redirect/stalled marker refuses with coarse errors", async () => {
  const responders: typeof fetch[] = [async () => new Response("synthetic-private-body", { status: 503 }), async () => Response.json({ private: "synthetic-private-body" }), async () => new Response("not-json", { headers: { "content-type": "application/json" } }), async () => new Response("x".repeat(17000), { headers: { "content-type": "application/json" } }), async () => { const r = Response.json(await marker()); Object.defineProperty(r, "redirected", { value: true }); return r; }, async () => new Promise<Response>(() => {}), async () => new Response(new ReadableStream({ start() {} }), { headers: { "content-type": "application/json" } })];
  for (const request of responders) await assert.rejects(verifyIsolatedTarget(target, "synthetic", request, 30), /^Error: target_marker_refused$/);
});
test("missing dry ports and invalid/shared targets have zero construction/network effects", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; throw Error("global_network_forbidden"); };
  try {
    await assert.rejects(runDryPrepared(target), /explicit_dry_ports_required/);
    await assert.rejects(runDryPrepared(target, { mode: "live" } as never), /explicit_dry_ports_required/);
    await assert.rejects(runDryPrepared({ ...target, projectRef: "zpvqxtklvjitofpbddrn" }, { mode: "dry", markerRequest: globalThis.fetch, create: async () => { calls++; throw Error(); } }));
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
test("real manifest entry refuses repo/relative paths before credential or network effects", async () => {
  let calls = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { calls++; throw Error("global_network_forbidden"); };
  try {
    await assert.rejects(runIsolated(".env.local"), /external_manifest_required/);
    await assert.rejects(runIsolated(new URL("../AGENTS.md", import.meta.url).pathname.replace(/^\//, "")), /file_must_be_outside_repo/);
    assert.equal(calls, 0);
  } finally { globalThis.fetch = original; }
});
test("caller target mutation cannot retarget the captured guarded preparation", async () => {
  const input = { ...target };
  let constructed = 0;
  await assert.rejects(runDryPrepared(input, { mode: "dry", markerRequest: async url => {
    input.projectRef = "zpvqxtklvjitofpbddrn"; input.url = "https://zpvqxtklvjitofpbddrn.supabase.co";
    assert(String(url).startsWith(target.url));
    return Response.json([{ ...(await marker())[0], project_ref: input.projectRef }]);
  }, create: async () => { constructed++; throw Error("must_not_construct"); } }), /target_marker_refused/);
  assert.equal(constructed, 0);
  assert(Object.isFrozen(isolatedTarget(target)));
});
test("test SQL factory refuses altered inventory before database construction", async () => {
  await assert.rejects(memoryLifecycleFixture((await migrationInventory()).slice(0, 7)), /trusted_migration_inventory_required/);
});

for (const scenario of ["normal", "completion_ack", "unknown_apple", "none", "unknown_linkage", "missing_material", "absent_auth", "outbox_accept_ack", "outbox_begin_ack", "outbox_accept_before", "smtp_unknown"] as DryScenario[]) test(`new guarded memory SQL orchestration: ${scenario}`, async () => {
  let f: Awaited<ReturnType<typeof memoryLifecycleFixture>> | undefined;
  let globalNetwork = 0, markerReads = 0;
  const original = globalThis.fetch;
  globalThis.fetch = async () => { globalNetwork++; throw Error("global_network_forbidden"); };
  try {
    const observed = await runDryPrepared(target, { mode: "dry", markerRequest: async () => { markerReads++; return Response.json(await marker()); }, create: async pins => { assert.equal(markerReads, 1); f = await memoryLifecycleFixture(pins, scenario); return f.ports; } });
    assert(f); assert(f.closed); assert.equal(globalNetwork, 0); assert.equal(markerReads, 1);
    assert.equal(f.executed.length, 9); assert.equal(observed.schemaRevision, "0006-0014"); assert.deepEqual(observed.executedMigrations, f.executed);
    assert.equal(observed.restoreFirst.status, "completed"); assert.equal(observed.restoreRestart.status, "completed"); assert.equal(f.trace.filter(s => s.startsWith("fake_restore_observe:")).length, 1);
    const heldDeletion = ["unknown_apple", "unknown_linkage", "missing_material"].includes(scenario);
    assert.equal(observed.deletionRestart.state, heldDeletion ? "deletion_pending" : "deleted");
    assert.equal(observed.deletionRestart.subscriptionCancelled, false);
    if (scenario === "completion_ack") assert.equal(observed.deletionFirst.state, "deletion_pending");
    assert.equal(f.effects.apple, ["none", "unknown_linkage", "missing_material", "absent_auth"].includes(scenario) ? 0 : 1);
    assert.equal(f.effects.auth, heldDeletion || scenario === "absent_auth" ? 0 : 1);
    if (scenario === "unknown_apple") { assert.equal(f.trace.filter(s => s === "fake_apple_run").length, 1); assert(observed.cases.includes("held worker operation/identity mismatch refused without progress")); }
    if (scenario === "missing_material") { assert.equal(f.targets.length, 2); assert.equal(new Set(f.targets.map(t => t.operationId)).size, 1); }
    if (scenario === "unknown_linkage") assert.equal(f.targets.length, 0);
    if (scenario === "absent_auth") assert(f.trace.includes("fake_auth_verified_absent"));
    const heldOutbox = ["outbox_begin_ack", "outbox_accept_before", "smtp_unknown"].includes(scenario);
    assert.equal(observed.supportState, heldOutbox ? "held" : "done");
    assert.equal(observed.outcomes.deletion, scenario === "unknown_apple" ? "held" : ["unknown_linkage", "missing_material"].includes(scenario) ? "unavailable" : "confirmed");
    assert.equal(observed.outcomes.support, heldOutbox ? "held" : "confirmed");
    assert.equal(f.effects.smtp, scenario === "outbox_begin_ack" ? 0 : 1);
    assert.equal(f.effects.classified, 1); assert.equal(f.sends.length, f.effects.smtp);
    assert.equal(observed.supportRestart.replied, scenario === "outbox_accept_ack" ? 1 : 0);
    if (f.sends.length) { assert.equal(f.sends[0].to, "synthetic@example.invalid"); assert(f.sends[0].text.startsWith("Prices are estimates.")); }
    if (process.env.WD_DRY_ACCEPTANCE_EVIDENCE_DIR) await writeFile(`${process.env.WD_DRY_ACCEPTANCE_EVIDENCE_DIR}/${scenario}.json`, `${JSON.stringify({ observed, trace: f.trace, effects: f.effects, targets: f.targets, globalNetwork, markerReads, closed: f.closed }, null, 2)}\n`, { flag: "wx" });
  } finally { globalThis.fetch = original; await f?.ports.close(); }
});
test("edge marker mismatch and ambiguous URL refuse without a write", async () => {
  const methods: string[] = [];
  const fetcher = (async (_url, init) => { methods.push(init!.method!); return Response.json([{ id: target.nonce, disposable: false }]); }) as typeof fetch;
  await assert.rejects(verifyIsolatedTarget(target, "unused", fetcher));
  assert.deepEqual(methods, ["GET"]);
  for (const url of [`${target.url}/`, `${target.url}?ref=zpvqxtklvjitofpbddrn`, "http://localhost:54321", "https://other.supabase.co", "https://user:password@abcdefghijklmnopqrst.supabase.co"]) assert.throws(() => isolatedTarget({ ...target, url }));
});
for (const scenario of ["restore_unbound", "restore_unknown", "restore_unrevoked", "restore_commit_ack"] as DryScenario[]) test(`nine-migration runner uses actual held/reconciled restore seams: ${scenario}`, async () => {
  let f: Awaited<ReturnType<typeof memoryLifecycleFixture>> | undefined, globalNetwork = 0;
  const original = globalThis.fetch; globalThis.fetch = async () => { globalNetwork++; throw Error("global_network_forbidden"); };
  try {
    const observed = await runDryPrepared(target, { mode: "dry", markerRequest: async () => Response.json(await marker()), create: async pins => { f = await memoryLifecycleFixture(pins, scenario); return f.ports; } });
    assert(f?.closed); assert.equal(globalNetwork, 0); assert.equal(f.executed.length, 9);
    const complete = scenario === "restore_commit_ack";
    assert.equal(observed.restoreFirst.status, complete ? "completed" : "held"); assert.equal(observed.restoreRestart.status, complete ? "completed" : "held");
    assert.equal(observed.restoreFirst.reason, complete ? undefined : scenario === "restore_unbound" ? "proof_unavailable" : scenario === "restore_unknown" ? "outcome_unknown" : "proof_invalid");
    assert.deepEqual(f.trace.filter(s => s.startsWith("fake_restore_observe:")), scenario === "restore_unbound" ? [] : complete ? ["fake_restore_observe:inspect"] : ["fake_restore_observe:inspect", "fake_restore_observe:reconcile"]);
    assert.equal(f.trace.filter(s => s === "wd_restore_command:commit").length, complete ? 1 : 0);
    if (complete) assert(f.trace.includes("synthetic_restore_commit_ack_loss"));
    if (process.env.WD_DRY_ACCEPTANCE_EVIDENCE_DIR) await writeFile(`${process.env.WD_DRY_ACCEPTANCE_EVIDENCE_DIR}/${scenario}.json`, `${JSON.stringify({ observed, trace: f.trace, globalNetwork, closed: f.closed }, null, 2)}\n`, { flag: "wx" });
  } finally { globalThis.fetch = original; await f?.ports.close(); }
});
test("new runner cannot grant from wrong committed restore scope/owner/time proof", async () => {
  for (const delta of [{ app: "other" }, { product: "other" }, { entitlement: "other" }, { environment: "PRODUCTION" }, { targetBinding: "wd_10000000-0000-4000-8000-000000000001" }, { observedAt: 1 }, { expiresAt: 1 }]) {
    let f: Awaited<ReturnType<typeof memoryLifecycleFixture>> | undefined;
    try {
      const observed = await runDryPrepared(target, { mode: "dry", markerRequest: async () => Response.json(await marker()), create: async pins => {
        f = await memoryLifecycleFixture(pins); const adapter = f.ports.restoreProof!;
        f.ports.restoreProof = { observe: async (i, mode, signal) => ({ ...(await adapter.observe(i, mode, signal) as Record<string, unknown>), ...delta }) }; return f.ports;
      } });
      assert(f?.closed); assert.equal(observed.restoreFirst.reason, "proof_invalid"); assert.equal(observed.restoreRestart.status, "held");
      assert.equal(f.trace.filter(s => ["wd_restore_command:prepare", "wd_restore_command:commit"].includes(s)).length, 0);
    } finally { await f?.ports.close(); }
  }
});
test("non-trigger missing manifest, false authority and embedded secrets refuse", async () => {
  for (const value of [undefined, {}, { ...target, disposable: false }, { ...target, purpose: "production" }, { ...target, serviceRoleKey: "must_not_accept" }, { ...target, credentialFile: ".env.local" }]) assert.throws(() => isolatedTarget(value));
});
