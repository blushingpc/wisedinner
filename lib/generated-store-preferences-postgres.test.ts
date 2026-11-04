// Local synthetic SQL only. No hosted schema, real store inventory or native acceptance.
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
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { op } from "./generated-plan-state.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";

const namespace = "store-preferences-disk-synthetic";
const allShops = Array.from({ length: 10 }, (_, i) => "fixture-reviewed-shop-" + i);
function fixture(db: PGlite, generation: number) {
  const data = setup(), rows = data.rows.map(r => ({ ...r, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n");
  const configuration = { ...data.configuration, sourcePin: { sha256: sha(bytes), recordCount: rows.length }, schedulePolicy: "wd-seven-day-three-meals-v1" as const };
  const request = { ...data.request, storeIds: [] as string[], slots: ["breakfast", "lunch", "dinner"], people: data.request.people.map(p => ({ ...p, proteinGoal: { ...p.proteinGoal, coverage: "full-day" } })) };
  const assignments = request.selectedDays.flatMap(date => request.people.flatMap((p, i) => request.slots.map(slot => ({ assignmentId: p.personId + date + slot, personId: p.personId, profileRevision: p.profileRevision, date, slot, recipeId: "a", recipeSha256: rows[0]!.recipe_sha256, sourceServings: { numerator: i ? "4" : "1", denominator: i ? "3" : "1" } }))));
  let loseAcknowledgement = false;
  const driver: ReferenceSqlDriver = { async transaction(body) {
    const result = await db.transaction(tx => body({ async query(sql, parameters) { return tx.query<Record<string, unknown>>(sql, parameters); } }));
    if (loseAcknowledgement) { loseAcknowledgement = false; throw Error("Synthetic lost commit acknowledgement"); } return result;
  } };
  const scope = issueLocalReferenceScope(namespace, generation), transactions = createPostgresReferenceStatePort(driver, hash({ namespace }));
  const binding = createReferenceSessionHandler(bytes, configuration, { labels: [{ skuId: "buy-a", displayName: "Fixture A", aisle: "Pantry" }, { skuId: "buy-b", displayName: "Fixture B", aisle: "Pantry" }], transactions, resolveScope: () => scope, newWeekPolicy: "wd-new-week-reconfirm-v1" });
  assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") throw Error("Synthetic disk binding");
  const bound = binding;
  async function send(operation: string, payload: unknown, id: number) {
    const body = { contract: REFERENCE_SESSION_CONTRACT, operation, payload, operationId: op(id), sourceSha256: configuration.sourcePin.sha256 };
    const response = await bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...body, intentSha256: referenceOperationDigest(body) }) }));
    return (await response.json()).result;
  }
  async function storedShops() {
    const state = await transactions.transaction(tx => tx.readState(hash({ namespace })));
    assert.ok(state?.current); return (state.current.request as { storeIds: string[] }).storeIds;
  }
  return { request, assignments, send, storedShops, loseNextAcknowledgement() { loseAcknowledgement = true; } };
}

test("no-preference and all mapped shops survive full42 SQL reopen, lost acknowledgement, duplicates and stale next-week settings", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wd-store-preferences-")); let db: PGlite | null = null, passed = false;
  try {
    db = await PGlite.create(directory); await db.exec(await readFile(new URL("./generated-plan-postgres.fixture.sql", import.meta.url), "utf8"));
    let f = fixture(db, 1);
    const initial = { weekId: op(100), expectedRevision: 0, request: f.request, assignments: f.assignments, pantryEntries: [] };
    const first = await f.send("installCurrent", initial, 1);
    assert.equal(first.outcome, "acknowledged"); assert.equal(first.state.current.view.meals.length, 42); assert.deepEqual(await f.storedShops(), []);
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 2);
    assert.equal((await f.send("readCurrent", {}, 10)).state.revision, 1); assert.deepEqual(await f.storedShops(), []);
    const many = { ...initial, expectedRevision: 1, request: { ...f.request, storeIds: allShops } };
    f.loseNextAcknowledgement(); assert.equal((await f.send("saveCurrent", many, 2)).outcome, "unknown");
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 3);
    const status = await f.send("operationStatus", { targetOperationId: op(2) }, 11);
    assert.equal(status.outcome, "committed"); assert.equal(status.receipt.saved, true); assert.equal(status.receipt.state.revision, 2);
    assert.deepEqual(await f.storedShops(), allShops);
    assert.deepEqual(await f.send("saveCurrent", many, 2), status.receipt);
    assert.equal((await f.send("saveCurrent", initial, 12)).code, "revision_conflict");
    const request = { ...many.request, selectedDays: many.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) };
    const assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "next", date: a.date.replace("2026-10-", "2026-11-") }));
    const draft = await f.send("createWeekDraft", { ...many, expectedRevision: 2, weekId: op(101), request, assignments, pantryReconfirmed: true }, 3);
    assert.equal(draft.outcome, "acknowledged"); assert.equal(draft.state.current.weekId, op(100)); assert.equal(draft.state.revision, 3);
    const changed = await f.send("saveCurrent", { ...many, expectedRevision: 3, request: { ...many.request, storeIds: [...allShops].reverse() } }, 4);
    assert.equal(changed.outcome, "acknowledged"); assert.equal(changed.state.revision, 4);
    const stale = await f.send("confirmNewWeek", { weekId: op(101), expectedRevision: 4 }, 5);
    assert.equal(stale.outcome, "held"); assert.equal(stale.code, "new_week_current_settings_changed");
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 4);
    const current = await f.send("readCurrent", {}, 13);
    assert.equal(current.state.revision, 4); assert.equal(current.state.current.weekId, op(100)); assert.equal(current.state.draft.weekId, op(101));
    assert.deepEqual(await f.storedShops(), [...allShops].reverse());
    const operations = await db.query<{ count: number }>("select count(*)::int as count from wd_reference_private.operations"); assert.equal(operations.rows[0]!.count, 4);
    assert.equal(JSON.stringify(current).includes("packPriceCents"), false); passed = true;
  } finally {
    if (db) await db.close();
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "wd-store-preferences-")) throw Error("Unsafe cleanup path");
    // Preserve a failed fixture for inspection rather than silently deleting evidence.
    if (passed) await rm(directory, { recursive: true, force: true });
  }
});
