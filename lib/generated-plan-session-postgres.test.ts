import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresReferenceStatePort, type ReferenceSqlDriver } from "./generated-plan-postgres.ts";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { issueLocalReferenceScope } from "./generated-plan-state.ts";
import { setup } from "./generated-joined-plan.test-support.ts";
import { op } from "./generated-plan-state.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { pantryFixture } from "./generated-plan-pantry-state.test-support.ts";

const namespace = "session-disk-synthetic-only";
function fixture(db: PGlite, generation: number, withPantry = false) {
  const f = withPantry ? pantryFixture() : { ...setup(), entries: [] }; let loseAcknowledgement = false;
  const driver: ReferenceSqlDriver = { async transaction(body) {
    const result = await db.transaction(tx => body({ async query(sql, parameters) { return tx.query<Record<string, unknown>>(sql, parameters); } }));
    if (loseAcknowledgement) { loseAcknowledgement = false; throw new Error("Synthetic response loss"); } return result;
  } };
  const scope = issueLocalReferenceScope(namespace, generation), transactions = createPostgresReferenceStatePort(driver, hash({ namespace }));
  const binding = createReferenceSessionHandler(f.bytes, f.configuration, { labels: [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }], transactions, resolveScope: () => scope, newWeekPolicy: "wd-new-week-reconfirm-v1" });
  if (binding.outcome !== "ready") throw new Error("Expected disk-backed binding");
  const bound = binding;
  async function send(operation: string, payload: unknown, id: number) {
    const value = { contract: REFERENCE_SESSION_CONTRACT, operation, payload, operationId: op(id), sourceSha256: f.configuration.sourcePin.sha256 };
    const response = await bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...value, intentSha256: referenceOperationDigest(value) }) })); return (await response.json()).result;
  }
  return { ...f, send, loseNextAcknowledgement() { loseAcknowledgement = true; } };
}
test("actual composed SQL boundary survives disk reopen and confirms a new week exactly once", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wd-session-disk-")); let db: PGlite | null = null;
  try {
    db = await PGlite.create(directory); await db.exec(await readFile(new URL("./generated-plan-postgres.fixture.sql", import.meta.url), "utf8"));
    let f = fixture(db, 1);
    const initial = { weekId: op(100), expectedRevision: 0, request: f.request, assignments: f.assignments, pantryEntries: [] };
    assert.equal((await f.send("installCurrent", initial, 1)).outcome, "acknowledged");
    const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "n", date: a.date.replace("2026-10-", "2026-11-") }));
    assert.equal((await f.send("createWeekDraft", { ...initial, weekId: op(101), expectedRevision: 1, request, assignments, pantryReconfirmed: true }, 2)).outcome, "acknowledged");
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 2);
    const read = await f.send("readCurrent", {}, 10); assert.equal(read.state.current.weekId, op(100)); assert.equal(read.state.draft.weekId, op(101));
    // The next transaction is the actual mutation, not a preliminary read.
    f.loseNextAcknowledgement(); const confirm = { weekId: op(101), expectedRevision: 2 };
    assert.equal((await f.send("confirmNewWeek", confirm, 3)).outcome, "unknown");
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 3);
    const recovered = await f.send("operationStatus", { targetOperationId: op(3) }, 11);
    assert.equal(recovered.outcome, "committed"); assert.equal(recovered.receipt.state.revision, 3);
    assert.equal(recovered.receipt.state.current.weekId, op(101)); assert.equal(recovered.receipt.state.draft, null);
    assert.deepEqual(await f.send("confirmNewWeek", confirm, 3), recovered.receipt);
    const rows = await db.query<{ count: number }>("select count(*)::int as count from wd_reference_private.operations"); assert.equal(rows.rows[0]!.count, 3);
    assert.equal(JSON.stringify(recovered).includes("packPriceCents"), false);
    assert.equal((await f.send("saveCurrent", initial, 12)).code, "revision_conflict");
  } finally { if (db) await db.close(); if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "wd-session-disk-")) throw new Error("Unsafe test cleanup target"); await rm(directory, { recursive: true, force: true }); }
});

test("original pantry observations and draft provenance survive actual SQL disk reopen and uncertain confirmation", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wd-session-pantry-")); let db: PGlite | null = null;
  try {
    db = await PGlite.create(directory); await db.exec(await readFile(new URL("./generated-plan-postgres.fixture.sql", import.meta.url), "utf8"));
    let f = fixture(db, 10, true);
    const initial = { weekId: op(200), expectedRevision: 0, request: f.request, assignments: f.assignments, pantryEntries: f.entries };
    const installed = await f.send("installCurrent", initial, 20); assert.equal(installed.outcome, "acknowledged");
    const basis = installed.state.current.pantryBasisSha256; assert.match(basis, /^[a-f0-9]{64}$/);
    const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "next", date: a.date.replace("2026-10-", "2026-11-") }));
    const draft = { ...initial, weekId: op(201), expectedRevision: 1, request, assignments, pantryReconfirmed: true };
    const created = await f.send("createWeekDraft", draft, 21); assert.equal(created.outcome, "acknowledged"); assert.equal(created.state.current.weekId, op(200));
    assert.equal(created.state.draft.pantryBasisSha256, basis);
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 11, true);
    const reopened = await f.send("readCurrent", {}, 22); assert.equal(reopened.state.current.pantryBasisSha256, basis); assert.equal(reopened.state.draft.pantryBasisSha256, basis);
    f.loseNextAcknowledgement(); const confirm = { weekId: op(201), expectedRevision: 2 };
    assert.equal((await f.send("confirmNewWeek", confirm, 23)).outcome, "unknown");
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 12, true);
    const recovered = await f.send("operationStatus", { targetOperationId: op(23) }, 24); assert.equal(recovered.outcome, "committed");
    assert.equal(recovered.receipt.state.revision, 3); assert.equal(recovered.receipt.state.current.pantryBasisSha256, basis);
    assert.equal(recovered.receipt.state.current.view.outcome, "saved-week");
    assert.deepEqual(await f.send("confirmNewWeek", confirm, 23), recovered.receipt);
    const rows = await db.query<{ count: number }>("select count(*)::int as count from wd_reference_private.operations"); assert.equal(rows.rows[0]!.count, 3);
    assert.equal(JSON.stringify(recovered).includes("packPriceCents"), false);
  } finally { if (db) await db.close(); if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "wd-session-pantry-")) throw new Error("Unsafe test cleanup target"); await rm(directory, { recursive: true, force: true }); }
});
