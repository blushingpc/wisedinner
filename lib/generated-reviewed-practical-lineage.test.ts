import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRevisedCatalogReader } from "./generated-plan-catalog.ts";
import { createRevisedAssignmentProjector } from "./generated-person-plan.ts";
import { reviewedMethodNutritionParent, reviewedMethodSourceServings } from "./generated-reviewed-method-lineage.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/reviewed-current-practical-lineage-v2.json", import.meta.url), "utf8")) as { records: { parent: Record<string, unknown>; child: Record<string, unknown> }[] };
const bind = (rows: readonly unknown[]) => {
  const source = rows.map(row => JSON.stringify(row)).join("\n") + "\n", pin = { sha256: sha256Hex(source), recordCount: rows.length };
  return { source, pin, catalog: createRevisedCatalogReader(pin)(source), projector: createRevisedAssignmentProjector(source, pin) };
};
const people = [{ personId: "p1", profileRevision: 1, label: "Synthetic source review", proteinGoal: { kind: "known", gramsPerDay: "150", coverage: "full-day" }, exclusions: { kind: "none" } }];
function assignment(row: Record<string, unknown>, numerator: string, denominator = "1") {
  return { assignmentId: "practical", personId: "p1", profileRevision: 1, date: "2026-10-30", slot: row.kind === "breakfast" ? "breakfast" : "lunch", recipeId: row.id, recipeSha256: row.recipe_sha256, sourceServings: { numerator, denominator } };
}
test("closed practical bodies inherit only their exact unchanged conditional parent evidence", () => {
  const result = bind(fixture.records.map(record => record.child)); assert.equal(result.catalog.outcome, "success");
  for (const record of fixture.records) {
    assert.equal(reviewedMethodNutritionParent(record.child), record.parent.recipe_sha256);
    assert.deepEqual(reviewedMethodSourceServings(record.child), ["1", "2"]);
    assert.equal(reviewedMethodSourceServings(record.parent), null);
    assert.deepEqual(record.child.nutrition, record.parent.nutrition);
  }
});
test("actual assignment projector enforces practical portions without rounding or globally narrowing originals", () => {
  for (const record of fixture.records) {
    const current = bind([record.child]).projector, original = bind([record.parent]).projector;
    assert.equal(current.outcome, "ready"); assert.equal(original.outcome, "ready");
    if (current.outcome !== "ready" || original.outcome !== "ready") throw Error("source missing");
    for (const [n, d] of [["1", "1"], ["2", "1"], ["2", "2"], ["4", "2"]]) assert.equal(current.projectAssignments({ people, assignments: [assignment(record.child, n!, d!)] }).outcome, "projected");
    for (const [n, d] of [["1", "4"], ["1", "2"], ["3", "2"], ["3", "1"], ["8", "1"]]) assert.deepEqual(current.projectAssignments({ people, assignments: [assignment(record.child, n!, d!)] }), { outcome: "held", code: "practical_recipe_portion_not_reviewed" });
    assert.equal(original.projectAssignments({ people, assignments: [assignment(record.parent, "1", "4")] }).outcome, "projected");
  }
});
test("lineage, serving-domain, ingredient and historical nutrition edits cannot acquire practical admission", () => {
  for (const record of fixture.records) for (const change of [
    (row: Record<string, unknown>) => { delete row.preparation_lineage; },
    (row: Record<string, unknown>) => { (row.preparation_lineage as Record<string, unknown>).allowedOriginalSourceServings = [{ numerator: "3", denominator: "1" }]; },
    (row: Record<string, unknown>) => { (row.preparation_lineage as Record<string, unknown>).familyPortionPolicySha256 = "a".repeat(64); },
    (row: Record<string, unknown>) => { (row.nutrition as Record<string, unknown>).flags = []; },
    (row: Record<string, unknown>) => { ((row.recipe as Record<string, unknown>).ingredients as Record<string, unknown>[])[0]!.quantity = "999"; },
  ]) {
    const row = structuredClone(record.child); change(row);
    assert.equal(reviewedMethodNutritionParent(row), null); assert.equal(reviewedMethodSourceServings(row), null);
    assert.equal(bind([row]).catalog.outcome, "error");
  }
});
