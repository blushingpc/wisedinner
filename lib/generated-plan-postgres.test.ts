import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresReferenceStatePort, type ReferenceSqlDriver, type ReferenceSqlTransaction } from "./generated-plan-postgres.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { setup } from "./generated-joined-plan.test-support.ts";
import { op } from "./generated-plan-state.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";

const ddl = () => readFile(new URL("./generated-plan-postgres.fixture.sql", import.meta.url), "utf8");
function driver(db: PGlite) {
  let failure: "before-commit" | "after-commit" | "receipt-write" | null = null;
  const sql: ReferenceSqlDriver = { async transaction<T>(body: (transaction: ReferenceSqlTransaction) => Promise<T>) {
    const result = await db.transaction(async tx => {
      const value = await body({ async query(sql, parameters) { if (failure === "receipt-write" && sql.startsWith("insert into wd_reference_private.operations")) { failure = null; throw new Error("Synthetic receipt write failure"); } return tx.query<Record<string, unknown>>(sql, parameters); } });
      if (failure === "before-commit") { failure = null; throw new Error("Synthetic rollback"); } return value;
    });
    if (failure === "after-commit") { failure = null; throw new Error("Synthetic lost acknowledgement"); } return result;
  } };
  return { sql, failOnce(value: typeof failure) { failure = value; } };
}
function fixture(db: PGlite, namespace: string) {
  const f = setup(), d = driver(db), key = hash({ namespace }), port = createPostgresReferenceStatePort(d.sql, key), scope = issueLocalReferenceScope(namespace, 1), repository = createReferencePlanRepository({ planner: f.planner, transactions: port });
  const command = (changes = {}) => ({ operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, ...changes });
  return { ...f, ...d, key, port, scope, repository, command };
}

test("actual isolated PostgreSQL keeps canonical state and receipts atomic across retries and uncertainty", async t => {
  const db = await PGlite.create("memory://");
  try {
    await db.exec(await ddl()); const f = fixture(db, "sql-reference-main");
    await t.test("acknowledgement, duplicate replay and conflicting intent", async () => {
      const first = await f.repository.applyPlanCommand(f.scope, f.command()); assert.equal(first.outcome, "acknowledged");
      assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.command()), first);
      assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.command({ expectedRevision: 1 })), { outcome: "error", code: "idempotency_conflict" });
      assert.deepEqual(await f.repository.applyPlanCommand(f.scope, f.command({ operationId: op(2), kind: "save-current", expectedRevision: 0 })), { outcome: "error", code: "revision_conflict" });
      assert.equal((await db.query<{ count: number }>("select count(*)::int as count from wd_reference_private.operations")).rows[0]!.count, 1);
    });
    await t.test("lost acknowledgement is reconciled by receipt without replay", async () => {
      f.failOnce("after-commit"); const command = f.command({ operationId: op(2), kind: "save-current", expectedRevision: 1 });
      assert.equal((await f.repository.applyPlanCommand(f.scope, command)).outcome, "unknown");
      assert.deepEqual(await f.repository.applyPlanCommand(f.scope, command), { outcome: "held", code: "operation_status_required" });
      const status = await f.repository.getOperationStatus(f.scope, op(2)); assert.equal(status.outcome, "committed");
      const replay = await f.repository.applyPlanCommand(f.scope, command); assert.equal(replay.outcome, "acknowledged"); if (replay.outcome === "acknowledged") assert.equal(replay.state.revision, 2);
    });
    await t.test("rollback leaves no state advance or receipt and status permits exact retry", async () => {
      f.failOnce("before-commit"); const command = f.command({ operationId: op(3), kind: "save-current", expectedRevision: 2 });
      assert.equal((await f.repository.applyPlanCommand(f.scope, command)).outcome, "unknown");
      assert.deepEqual(await f.repository.getOperationStatus(f.scope, op(3)), { outcome: "not_found", operationId: op(3) });
      const current = await f.repository.read(f.scope); if (current.outcome !== "read") throw new Error("Expected retained state"); assert.equal(current.state.revision, 2);
      assert.equal((await f.repository.applyPlanCommand(f.scope, command)).outcome, "acknowledged");
    });
    await t.test("another trusted scope is separate and a foreign scope cannot use this port", async () => {
      const other = fixture(db, "sql-reference-other"); const empty = await other.repository.read(other.scope); if (empty.outcome !== "read") throw new Error("Expected empty other state"); assert.equal(empty.state.current, null);
      assert.equal((await other.repository.applyPlanCommand(other.scope, other.command())).outcome, "acknowledged");
      await assert.rejects(f.port.transaction(tx => tx.readState(other.key)));
      const current = await f.repository.read(f.scope); if (current.outcome === "read") assert.equal(current.state.revision, 3); else assert.fail("Foreign scope changed owner");
    });
    await t.test("receipt insertion failure rolls back the already written state", async () => {
      const separate = fixture(db, "sql-reference-partial"); assert.equal((await separate.repository.applyPlanCommand(separate.scope, separate.command())).outcome, "acknowledged");
      separate.failOnce("receipt-write"); const command = separate.command({ operationId: op(2), kind: "save-current", expectedRevision: 1 });
      assert.equal((await separate.repository.applyPlanCommand(separate.scope, command)).outcome, "unknown");
      const read = await separate.repository.read(separate.scope); if (read.outcome !== "read") throw new Error("Expected rolled back state"); assert.equal(read.state.revision, 1);
      assert.deepEqual(await separate.repository.getOperationStatus(separate.scope, op(2)), { outcome: "not_found", operationId: op(2) });
      assert.equal((await separate.repository.applyPlanCommand(separate.scope, command)).outcome, "acknowledged");
    });
    await t.test("stale competing writes have only one acknowledged revision", async () => {
      const results = await Promise.all([4, 5].map(n => f.repository.applyPlanCommand(f.scope, f.command({ operationId: op(n), kind: "save-current", expectedRevision: 3 }))));
      assert.equal(results.filter(x => x.outcome === "acknowledged").length, 1); assert.ok(results.some(x => x.outcome === "error" && x.code === "revision_conflict"));
    });
    await t.test("retained transaction handles cannot access a later transaction", async () => {
      let retained: Parameters<Parameters<typeof f.port.transaction>[0]>[0] | undefined;
      await f.port.transaction(async tx => { retained = tx; await tx.readState(f.key); }); assert.ok(retained); await assert.rejects(retained.readState(f.key));
    });
    await t.test("a second commit in one transaction rolls back both writes", async () => {
      const read = await f.repository.read(f.scope); if (read.outcome !== "read") throw new Error("Expected current state");
      const state = { ...read.state, revision: read.state.revision + 1 }, operation = { operationId: op(99), intentSha256: "a".repeat(64), receipt: { outcome: "acknowledged" as const, operationId: op(99), state } };
      await assert.rejects(f.port.transaction(async tx => { await tx.readState(f.key); await tx.readOperation(f.key, op(99)); await tx.commit(f.key, state, operation); await tx.commit(f.key, state, operation); }));
      assert.deepEqual(await f.repository.getOperationStatus(f.scope, op(99)), { outcome: "not_found", operationId: op(99) });
      assert.deepEqual(await f.repository.read(f.scope), read);
    });
    await t.test("operation column or receipt corruption cannot masquerade as a committed save", async () => {
      const separate = fixture(db, "sql-reference-receipt-corrupt"); await separate.repository.applyPlanCommand(separate.scope, separate.command());
      await db.query("update wd_reference_private.operations set intent_sha256=$2 where scope_key=$1", [separate.key, "0".repeat(64)]);
      assert.deepEqual(await separate.repository.getOperationStatus(separate.scope, op(1)), { outcome: "error", code: "operation_status_unavailable" });
      assert.equal((await separate.repository.applyPlanCommand(separate.scope, separate.command())).outcome, "unknown");
    });
    await t.test("stored state corruption fails closed instead of repairing or replaying", async () => {
      await db.query("update wd_reference_private.states set record_sha256=$2 where scope_key=$1", [f.key, "0".repeat(64)]);
      assert.deepEqual(await f.repository.read(f.scope), { outcome: "error", code: "reference_state_unavailable" });
    });
    await t.test("private fixture has default-deny privileges and RLS, not a public identity claim", async () => {
      await db.exec("create role wd_reference_probe; set role wd_reference_probe");
      await assert.rejects(db.query("select * from wd_reference_private.states"), /permission denied/);
      await db.exec("reset role; grant usage on schema wd_reference_private to wd_reference_probe; grant select on all tables in schema wd_reference_private to wd_reference_probe; set role wd_reference_probe");
      assert.equal((await db.query("select * from wd_reference_private.states")).rows.length, 0);
      assert.equal((await db.query("select * from wd_reference_private.operations")).rows.length, 0); await db.exec("reset role");
    });
  } finally { await db.close(); }
});

test("actual disposable disk database survives engine close and reopen with exact receipt and new-week draft", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wd-reference-port-")); let db: PGlite | null = null;
  try {
    db = await PGlite.create(directory); await db.exec(await ddl()); const f = fixture(db, "sql-reference-disk"), saved = await f.repository.applyPlanCommand(f.scope, f.command()); assert.equal(saved.outcome, "acknowledged");
    const request = { ...f.request, selectedDays: f.request.selectedDays.map(x => x.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(row => ({ ...row, date: row.date.replace("2026-10-", "2026-11-"), assignmentId: row.assignmentId + "new" }));
    const draft = await f.repository.applyPlanCommand(f.scope, f.command({ operationId: op(2), kind: "create-week-draft", expectedRevision: 1, weekId: op(101), request, assignments })); assert.equal(draft.outcome, "acknowledged");
    await db.close(); db = await PGlite.create(directory); const restarted = fixture(db, "sql-reference-disk"), current = await restarted.repository.read(restarted.scope);
    if (current.outcome !== "read" || draft.outcome !== "acknowledged") throw new Error("Expected durable reference state"); assert.deepEqual(current.state, draft.state);
    assert.deepEqual(await restarted.repository.applyPlanCommand(restarted.scope, restarted.command()), saved);
    assert.equal((await restarted.repository.getOperationStatus(restarted.scope, op(2))).outcome, "committed");
    assert.deepEqual(await restarted.repository.applyPlanCommand(restarted.scope, { operationId: op(3), kind: "confirm-new-week", expectedRevision: 2, weekId: op(101) }), { outcome: "held", code: "new_week_retention_policy_required" });
    assert.deepEqual(await restarted.repository.read(restarted.scope), current);
  } finally {
    if (db) await db.close();
    const target = resolve(directory), base = resolve(tmpdir());
    if (dirname(target) !== base || !basename(target).startsWith("wd-reference-port-")) throw new Error("Refuse unvalidated test cleanup");
    await rm(target, { recursive: true, force: true });
  }
});
