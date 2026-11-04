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
import { referencePriceFixture } from "./generated-reference-price.test-support.ts";
import { op } from "./generated-plan-state.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";

function fixture(db: PGlite, generation: number, change?: (f: ReturnType<typeof referencePriceFixture>) => void) {
  const f = referencePriceFixture(); change?.(f); let lose = false;
  const namespace = "reference-price-isolated-disk-only", driver: ReferenceSqlDriver = { async transaction(body) {
    const result = await db.transaction(tx => body({ async query(sql, parameters) { return tx.query<Record<string, unknown>>(sql, parameters); } }));
    if (lose) { lose = false; throw Error("Synthetic committed acknowledgement loss"); } return result;
  } };
  const scope = issueLocalReferenceScope(namespace, generation), transactions = createPostgresReferenceStatePort(driver, hash({ namespace }));
  const binding = createReferenceSessionHandler(f.bytes, f.configuration, { labels: f.labels, transactions, resolveScope: () => scope, newWeekPolicy: "wd-new-week-reconfirm-v1" });
  if (binding.outcome !== "ready") throw Error("Expected synthetic reference price session");
  const bound = binding;
  async function send(operation: string, payload: unknown, id: number) {
    const value = { contract: REFERENCE_SESSION_CONTRACT, operation, payload, operationId: op(id), sourceSha256: f.configuration.sourcePin.sha256 };
    const response = await bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...value, intentSha256: referenceOperationDigest(value) }) }));
    return (await response.json()).result;
  }
  return { ...f, send, loseNextAcknowledgement() { lose = true; } };
}

test("actual SQL reopen preserves reference disclosures and exact lost-ack receipt; changed source basis holds saved views", async () => {
  const directory = await mkdtemp(join(tmpdir(), "wd-reference-price-")); let db: PGlite | null = null;
  try {
    db = await PGlite.create(directory); await db.exec(await readFile(new URL("./generated-plan-postgres.fixture.sql", import.meta.url), "utf8"));
    let f = fixture(db, 1);
    const initial = { weekId: op(950), expectedRevision: 0, request: f.request, assignments: f.assignments, pantryEntries: [] };
    f.loseNextAcknowledgement(); const lost = await f.send("installCurrent", initial, 951); assert.equal(lost.outcome, "unknown");
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 2);
    const recovered = await f.send("operationStatus", { targetOperationId: op(951) }, 952); assert.equal(recovered.outcome, "committed");
    assert.equal(recovered.receipt.state.revision, 1); const view = recovered.receipt.state.current.view; assert.equal(view.outcome, "saved-week");
    assert.equal(view.groceries.referenceEstimates.sources[0].kind, "manufacturer-reference");
    assert.ok(view.groceries.warnings.includes("includes-nonregional-reference-estimates"));
    assert.equal(JSON.stringify(recovered).includes("packPriceCents"), false); assert.equal(JSON.stringify(recovered).includes("estimatedLineCents"), false);
    assert.deepEqual(await f.send("installCurrent", initial, 951), recovered.receipt);
    const request = { ...f.request, selectedDays: f.request.selectedDays.map(d => d.replace("2026-10-", "2026-11-")) }, assignments = f.assignments.map(a => ({ ...a, assignmentId: a.assignmentId + "next", date: a.date.replace("2026-10-", "2026-11-") }));
    const draft = await f.send("createWeekDraft", { ...initial, weekId: op(960), expectedRevision: 1, request, assignments, pantryReconfirmed: true }, 954);
    assert.equal(draft.outcome, "acknowledged"); assert.equal(draft.state.current.weekId, op(950));
    assert.ok(draft.state.draft.view.groceries.warnings.includes("includes-nonregional-reference-estimates"));
    await db.close(); db = await PGlite.create(directory); f = fixture(db, 3, x => { x.fact.sourceBasis.manufacturer = "Changed source identity, same money"; });
    const changed = await f.send("readCurrent", {}, 953); assert.equal(changed.outcome, "read");
    assert.deepEqual(changed.state.current.view, { outcome: "held", code: "saved_view_basis_changed" });
    assert.deepEqual(changed.state.draft.view, { outcome: "held", code: "saved_view_basis_changed" });
    assert.equal((await f.send("confirmNewWeek", { weekId: op(960), expectedRevision: 2 }, 955)).code, "stale_week_draft");
    assert.equal((await f.send("readCurrent", {}, 956)).state.revision, 2);
    const rows = await db.query<{ count: number }>("select count(*)::int as count from wd_reference_private.operations"); assert.equal(rows.rows[0]!.count, 2);
  } finally {
    if (db) await db.close();
    if (!resolve(directory).startsWith(resolve(tmpdir()) + sep + "wd-reference-price-")) throw Error("Unsafe isolated test cleanup target");
    await rm(directory, { recursive: true, force: true });
  }
});
