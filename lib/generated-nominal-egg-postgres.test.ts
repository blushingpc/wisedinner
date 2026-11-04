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
import { eggGroupPlanFixture } from "./generated-reviewed-egg-group.test-support.ts";
import { op } from "./generated-plan-state.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";

function fixture(db: PGlite, generation: number, changedSource = false) {
 const f = eggGroupPlanFixture(changedSource), namespace = "nominal-egg-isolated-disk-only"; let lose = false;
 const driver: ReferenceSqlDriver = { async transaction(body) { const result = await db.transaction(tx => body({ async query(sql, parameters) { return tx.query<Record<string, unknown>>(sql, parameters); } })); if (lose) { lose = false; throw Error("Synthetic committed acknowledgement loss"); } return result; } };
 const scope = issueLocalReferenceScope(namespace, generation), transactions = createPostgresReferenceStatePort(driver, hash({ namespace })), binding = createReferenceSessionHandler(f.bytes, f.configuration, { labels: f.labels, transactions, resolveScope: () => scope, newWeekPolicy: "wd-new-week-reconfirm-v1" });
 if (binding.outcome !== "ready") throw Error("Expected synthetic nominal egg session"); const bound = binding;
 async function send(operation: string, payload: unknown, id: number) { const value = { contract: REFERENCE_SESSION_CONTRACT, operation, payload, operationId: op(id), sourceSha256: f.configuration.sourcePin.sha256 }, response = await bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...value, intentSha256: referenceOperationDigest(value) }) })); return (await response.json()).result; }
 return { ...f, send, loseNextAcknowledgement() { lose = true; } };
}

test("actual42-meal SQL reopen retains zero-purchase egg warning and known commit while changed group basis holds views", async () => {
 const directory = await mkdtemp(join(tmpdir(), "wd-nominal-egg-")); let db: PGlite | null = null;
 try {
  db = await PGlite.create(directory); await db.exec(await readFile(new URL("./generated-plan-postgres.fixture.sql", import.meta.url), "utf8")); let f = fixture(db, 1);
  assert.equal(f.assignments.length, 42);
  const initial = { weekId: op(1190), expectedRevision: 0, request: f.request, assignments: f.assignments, pantryEntries: f.entries };
  f.loseNextAcknowledgement(); assert.equal((await f.send("installCurrent", initial, 1191)).outcome, "unknown");
  await db.close(); db = await PGlite.create(directory); f = fixture(db, 2);
  const recovered = await f.send("operationStatus", { targetOperationId: op(1191) }, 1192);
  assert.equal(recovered.outcome, "committed"); assert.equal(recovered.receipt.saved, true); assert.equal(recovered.receipt.state.revision, 1);
  const view = recovered.receipt.state.current.view; assert.equal(view.outcome, "saved-week"); assert.equal(view.meals.length, 42); assert.deepEqual(view.groceries.estimatedTotalCents, { min: 0, max: 0 });
  assert.ok(view.groceries.warnings.includes("uses-nominal-large-egg-count-reference")); assert.equal(view.groceries.uniqueBuyItemCount, 0); assert.equal(view.groceries.alreadyAtHome.length, 1);
  for (const key of ["nominalEggReference", "edibleGPerLargeEgg", "estimatedLineCents", "packPriceCents"]) assert.equal(JSON.stringify(recovered).includes(key), false);
  assert.deepEqual(await f.send("installCurrent", initial, 1191), recovered.receipt);
  const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "next", date: a.date.replace("2026-10-", "2026-11-") }));
  const draft = await f.send("createWeekDraft", { ...initial, weekId: op(1195), expectedRevision: 1, request, assignments, pantryReconfirmed: true }, 1193);
  assert.equal(draft.outcome, "acknowledged"); assert.equal(draft.state.current.weekId, op(1190)); assert.ok(draft.state.draft.view.groceries.warnings.includes("uses-nominal-large-egg-count-reference"));
  await db.close(); db = await PGlite.create(directory); f = fixture(db, 3, true);
  const changed = await f.send("readCurrent", {}, 1194); assert.equal(changed.outcome, "read"); assert.equal(changed.state.revision, 2); assert.equal(changed.state.current.view.outcome, "held"); assert.equal(changed.state.draft.view.outcome, "held");
  assert.equal((await f.send("confirmNewWeek", { weekId: op(1195), expectedRevision: 2 }, 1196)).code, "saved_pantry_basis_changed");
  const known = await f.send("operationStatus", { targetOperationId: op(1191) }, 1197); assert.equal(known.outcome, "committed"); assert.equal(known.receipt.saved, true); assert.equal(known.receipt.state.current.view.outcome, "held");
  const rows = await db.query<{ count: number }>("select count(*)::int as count from wd_reference_private.operations"); assert.equal(rows.rows[0]!.count, 2);
 } finally {
  if (db) await db.close();
  if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "wd-nominal-egg-")) throw Error("Unsafe isolated cleanup target");
  await rm(directory, { recursive: true, force: true });
 }
});
