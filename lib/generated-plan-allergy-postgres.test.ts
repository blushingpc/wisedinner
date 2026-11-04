import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { allergySetup } from "./generated-plan-household-allergies.test-support.ts";
import { createPostgresReferenceStatePort, type ReferenceSqlDriver } from "./generated-plan-postgres.ts";
import { createReferencePlanRepository, issueLocalReferenceScope } from "./generated-plan-state.ts";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { op } from "./generated-plan-state.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";

test("actual isolated SQL reopen preserves allergy evidence and committed lost-ack status", async () => {
  const folder = await mkdtemp(join(tmpdir(), "wd-allergy-sql-")), actual = await realpath(folder), f = allergySetup(false);
  assert.equal(dirname(resolve(actual)), resolve(tmpdir())); assert.ok(basename(actual).startsWith("wd-allergy-sql-"));
  let db: PGlite | null = null, failAfterCommit = true, injectedCommits = 0;
  const scope = issueLocalReferenceScope("allergy-sql-reopen", 1), namespace = hash({ namespace: "allergy-sql-reopen" });
  function driver(database: PGlite): ReferenceSqlDriver { return { async transaction<T>(body: Parameters<ReferenceSqlDriver["transaction"]>[0]): Promise<T> {
    let wroteReceipt = false;
    const value = await database.transaction(tx => body({ async query(sql, parameters) { const result = await tx.query<Record<string, unknown>>(sql, parameters); if (sql.startsWith("insert into wd_reference_private.operations") && result.rows.length === 1) wroteReceipt = true; return result; } }));
    if (failAfterCommit && wroteReceipt) { failAfterCommit = false; injectedCommits++; throw Error("Synthetic committed acknowledgement loss"); }
    return value as T;
  } }; }
  const labels = [{ skuId: "buy-a", displayName: "Synthetic A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Synthetic B", aisle: "Pantry" }];
  function client(port: ReturnType<typeof createPostgresReferenceStatePort>, configuration = f.configuration) {
    const b = createReferenceSessionHandler(f.bytes, configuration, { transactions: port, labels, resolveScope: () => scope }); assert.equal(b.outcome, "ready"); if (b.outcome !== "ready") throw Error("Synthetic SQL session");
    return async (operation: string, payload: unknown, id: number) => { const envelope = { contract: REFERENCE_SESSION_CONTRACT, operation, operationId: op(id), sourceSha256: f.configuration.sourcePin.sha256, payload }; const response = await b.handle(new Request("http://private.invalid/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...envelope, intentSha256: referenceOperationDigest(envelope) }) })); return (await response.json()).result; };
  }
  try {
    db = new PGlite(folder); await db.exec(await readFile(new URL("./generated-plan-postgres.fixture.sql", import.meta.url), "utf8"));
    // Fault only after the actual save transaction commits, not a setup/read.
    const firstDriver = driver(db), first = createPostgresReferenceStatePort(firstDriver, namespace), send = client(first);
    const result = await send("installCurrent", { expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, pantryEntries: [] }, 1);
    assert.equal(result.outcome, "unknown"); assert.equal(injectedCommits, 1);
    assert.equal((await db.query<{ count: number }>("select count(*)::int as count from wd_reference_private.operations")).rows[0]!.count, 1);
    const stored = (await db.query<{ basis: string }>("select state->'current'->>'allergyBasisSha256' as basis from wd_reference_private.states")).rows[0]!.basis; assert.match(stored, /^[a-f0-9]{64}$/);
    await db.close(); db = null;
    db = new PGlite(folder); const port = createPostgresReferenceStatePort(driver(db), namespace), reopened = client(port);
    const status = await reopened("operationStatus", { targetOperationId: op(1) }, 2); assert.equal(status.outcome, "committed", JSON.stringify(status)); assert.equal(status.receipt.saved, true); assert.equal(status.receipt.state.current.view.outcome, "saved-week");
    const repository = createReferencePlanRepository({ planner: f.planner, transactions: port }), read = await repository.read(scope), evaluated = f.planner.evaluateJoined(f.assignments, f.request);
    assert.equal(read.outcome, "read"); assert.equal(evaluated.outcome, "success"); if (read.outcome === "read" && evaluated.outcome === "success") assert.equal(read.state.current!.allergyBasisSha256, evaluated.allergyBasisSha256);
    const changed = structuredClone(f.configuration); changed.householdAllergies.ingredientFacts[0]!.sourceSha256 = "e".repeat(64);
    const after = await client(port, changed)("operationStatus", { targetOperationId: op(1) }, 3); assert.equal(after.outcome, "committed"); assert.equal(after.receipt.saved, true); assert.equal(after.receipt.state.current.view.code, "saved_view_basis_changed");
  } finally {
    await db?.close();
    const target = resolve(folder); assert.equal(dirname(target), resolve(tmpdir())); assert.ok(basename(target).startsWith("wd-allergy-sql-"));
    await rm(target, { recursive: true, force: true });
  }
});
