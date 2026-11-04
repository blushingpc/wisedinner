import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRevisedCatalogReader } from "./generated-plan-catalog.ts";
import { reviewedMethodNutritionParent } from "./generated-reviewed-method-lineage.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";

const fixture = JSON.parse(readFileSync(new URL("./fixtures/reviewed-current-method-lineage-v1.json", import.meta.url), "utf8")) as { records: { parent: Record<string, unknown>; child: Record<string, unknown> }[] };
const read = (rows: readonly unknown[]) => {
  const source = rows.map(row => JSON.stringify(row)).join("\n") + "\n";
  return createRevisedCatalogReader({ sha256: sha256Hex(source), recordCount: rows.length })(source);
};
test("three exact method children preserve historical conditional nutrition while original source still reads", () => {
  const parents = read(fixture.records.map(record => record.parent)), children = read(fixture.records.map(record => record.child));
  assert.equal(parents.outcome, "success"); assert.equal(children.outcome, "success");
  if (parents.outcome !== "success" || children.outcome !== "success") throw Error("fixture source failed");
  assert.equal(children.productAccepted, false);
  for (const [index, record] of fixture.records.entries()) {
    assert.equal(reviewedMethodNutritionParent(record.child), record.parent.recipe_sha256);
    assert.deepEqual(children.recipes[index]!.nutrition, parents.recipes[index]!.nutrition);
    assert.equal(children.recipes[index]!.plannerAdopted, false);
    assert.notEqual(record.parent.recipe_sha256, record.child.recipe_sha256);
    assert.deepEqual(record.child.nutrition, record.parent.nutrition);
  }
});
test("nutrition, provenance, review flag, ingredient and method tampering cannot inherit the closed parent evidence", () => {
  for (const record of fixture.records) for (const mutate of [
    (r: Record<string, unknown>) => { (r.nutrition as Record<string, unknown>).flags = []; },
    (r: Record<string, unknown>) => { r.sections = ["other"]; },
    (r: Record<string, unknown>) => { (r.preparation_lineage as Record<string, unknown>).kitchenAcceptance = true; },
    (r: Record<string, unknown>) => { r.id = "another-recipe"; },
    (r: Record<string, unknown>) => { ((r.recipe as Record<string, unknown>).ingredients as Record<string, unknown>[])[0]!.quantity = "999"; },
    (r: Record<string, unknown>) => { ((r.recipe as Record<string, unknown>).steps as Record<string, unknown>[])[0]!.instruction = "Cook arbitrarily"; },
  ]) {
    const changed = structuredClone(record.child); mutate(changed);
    assert.equal(reviewedMethodNutritionParent(changed), null);
    assert.equal(read([changed]).outcome, "error");
  }
});
test("removed lineage or rewritten historical whole-body hashes do not become a fresh nutrition grant", () => {
  for (const record of fixture.records) {
    const without = structuredClone(record.child); delete without.preparation_lineage;
    assert.equal(read([without]).outcome, "error");
    const relabeled = structuredClone(without), nutrition = relabeled.nutrition as Record<string, unknown>;
    nutrition.source_refresh = { ...(nutrition.source_refresh as Record<string, unknown>), exact_recipe_body_sha256: relabeled.recipe_sha256, recipe_sha256_unchanged: relabeled.recipe_sha256 };
    assert.equal(read([relabeled]).outcome, "error");
    const changed = structuredClone(record.child); (changed.nutrition as Record<string, unknown>).source_refresh = nutrition.source_refresh;
    assert.equal(read([changed]).outcome, "error");
  }
});
