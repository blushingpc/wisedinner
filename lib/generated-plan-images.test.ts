import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, realpathSync } from "node:fs";
import { resolve, relative, isAbsolute } from "node:path";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { createReviewedImageIndex } from "./generated-plan-images.ts";
import { presentRecipe } from "./generated-plan-presenter.ts";

const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=", "base64");
function fixture() {
  const source = setup(), bytes = Buffer.from(source.rows.map(row => JSON.stringify(row)).join("\n") + "\n"), catalogSha256 = sha(bytes);
  const mapping = { schema: "wd-reviewed-local-image-bindings-v1", catalogSha256, approvalEvidenceSha256: "a".repeat(64), contactSheetEvidenceSha256: "b".repeat(64), appearanceApprovalCount: 1, publicationAuthorized: false, sourceFidelityLimit: "Synthetic prior differences retained, not a new pixel review", bindings: [{ recipeId: "a", recipeSha256: source.rows[0]!.recipe_sha256, sourcePacketSha256: "c".repeat(64), sourcePacketCatalogSha256: catalogSha256, assetSha256: sha(png), assetFile: "synthetic/original.png", byteLength: png.length, format: "png", width: 1, height: 1, founderAppearanceApproved: true, priorReviewStatus: "Hold: synthetic prior source difference" }], limits: ["Synthetic binding only, no product/image-quality proof"] };
  function bind() { const mappingBytes = Buffer.from(JSON.stringify(mapping)); return createReviewedImageIndex(bytes, mappingBytes, { catalog: { sha256: catalogSha256, recordCount: 2 }, mappingSha256: sha(mappingBytes), approvedCount: mapping.bindings.length }); }
  return { source, bytes, mapping, bind };
}
function ready(f = fixture()) { const result = f.bind(); assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") throw new Error("Expected private synthetic image index"); return { ...f, index: result.index }; }

test("source-bound lookup preserves appearance approval and prior fidelity holds without a public image URL", () => {
  const f = ready(), result = f.index.lookup("a", f.source.rows[0]!.recipe_sha256);
  assert.equal(result.outcome, "binding"); if (result.outcome !== "binding") return;
  assert.equal(result.appearance.status, "founder-approved"); assert.equal(result.fidelity.priorReviewStatus, f.mapping.bindings[0]!.priorReviewStatus); assert.equal(result.assetBytesVerified, false); assert.equal(result.delivery.url, null); assert.equal(result.newPixelReviewPerformed, false);
});

test("resolution verifies actual bytes and PNG header dimensions without pretending to decode or review pixels", () => {
  const f = ready(), result = f.index.resolve("a", f.source.rows[0]!.recipe_sha256, png);
  assert.equal(result.outcome, "verified-local-illustration"); if (result.outcome !== "verified-local-illustration") return;
  assert.equal(result.assetBytesVerified, true); assert.equal(result.headerValidation, "png-signature-and-IHDR-only"); assert.equal(result.width, 1); assert.equal(result.delivery.url, null); assert.ok(Object.isFrozen(result));
  assert.equal(f.index.resolve("a", f.source.rows[0]!.recipe_sha256, Buffer.from("wrong bytes")).outcome, "error");
});

test("known missing images stay held, unknown or stale recipe identity never borrows a photo", () => {
  const f = ready(); assert.deepEqual(f.index.lookup("b", f.source.rows[1]!.recipe_sha256), { outcome: "held", code: "reviewed_image_binding_needed" });
  assert.equal(f.index.lookup("a", f.source.rows[1]!.recipe_sha256).outcome, "error"); assert.equal(f.index.lookup("missing", f.source.rows[0]!.recipe_sha256).outcome, "error");
  assert.equal(f.index.summary.catalogRecipes, 2); assert.equal(f.index.summary.approvedAppearanceBindings, 1); assert.equal(f.index.summary.missingImageRecipes, 1);
});

test("mapping bytes are hashed before parsing and foreign source or public grants refuse", () => {
  const f = fixture(), good = Buffer.from(JSON.stringify(f.mapping)), pins = { catalog: { sha256: sha(f.bytes), recordCount: 2 }, mappingSha256: sha(good), approvedCount: 1 };
  assert.equal(createReviewedImageIndex(f.bytes, Buffer.from("not-json"), pins).outcome, "error");
  for (const change of [{ catalogSha256: "0".repeat(64) }, { publicationAuthorized: true }, { appearanceApprovalCount: 2 }]) { const original = f.mapping, changed = { ...original, ...change }, value = Buffer.from(JSON.stringify(changed)); assert.equal(createReviewedImageIndex(f.bytes, value, { ...pins, mappingSha256: sha(value) }).outcome, "error"); }
});

test("source body mismatches duplicate photos and unsafe file references cannot become valid mappings", () => {
  for (const mutate of [(f: ReturnType<typeof fixture>) => { f.mapping.bindings[0]!.recipeSha256 = f.source.rows[1]!.recipe_sha256; }, (f: ReturnType<typeof fixture>) => { f.mapping.bindings[0]!.assetFile = "../outside.png"; }, (f: ReturnType<typeof fixture>) => { f.mapping.bindings.push({ ...f.mapping.bindings[0]!, recipeId: "b", recipeSha256: f.source.rows[1]!.recipe_sha256 }); f.mapping.appearanceApprovalCount = 2; }]) { const f = fixture(); mutate(f); assert.equal(f.bind().outcome, "error"); }
});

test("constructor pins and image byte wrappers refuse getters without calling them", () => {
  const f = fixture(), value = Buffer.from(JSON.stringify(f.mapping)); let reads = 0;
  const pins = Object.defineProperty({ catalog: { sha256: sha(f.bytes), recordCount: 2 }, mappingSha256: sha(value), approvedCount: 1 }, "mappingSha256", { enumerable: true, get() { reads++; throw new Error("Not read"); } });
  assert.equal(createReviewedImageIndex(f.bytes, value, pins).outcome, "error"); const bound = ready(); const hostile = Object.defineProperty({}, "byteLength", { get() { reads++; throw new Error("Not read"); } });
  assert.equal(bound.index.resolve("a", bound.source.rows[0]!.recipe_sha256, hostile).outcome, "error"); assert.equal(reads, 0);
});

test("immutable index metadata does not freeze or follow caller pin objects", () => {
  const f = fixture(), value = Buffer.from(JSON.stringify(f.mapping)), pins = { catalog: { sha256: sha(f.bytes), recordCount: 2 }, mappingSha256: sha(value), approvedCount: 1 }, result = createReviewedImageIndex(f.bytes, value, pins);
  if (result.outcome !== "ready") throw new Error("Expected private binding"); pins.catalog.sha256 = "0".repeat(64); assert.equal(Object.isFrozen(pins.catalog), false); assert.equal(result.index.sourceSha256, sha(f.bytes));
});

test("recipe presentation can name its approved local binding but never creates a delivery URL", () => {
  const f = ready(), evaluation = f.source.planner.evaluateJoined(f.source.assignments, f.source.request); if (evaluation.outcome !== "success") throw new Error("Expected synthetic evaluation");
  const assignment = f.source.assignments[0]!, result = presentRecipe(evaluation, assignment.personId, assignment.assignmentId, f.index);
  assert.equal(result.outcome, "recipe"); if (result.outcome !== "recipe") return;
  assert.equal(result.image.code, "image-publication-needed"); if (result.image.code === "image-publication-needed") { assert.equal(result.image.approvedLocalBinding.delivery.url, null); assert.equal(result.image.approvedLocalBinding.newPixelReviewPerformed, false); }
  assert.deepEqual(result.originalBatchRecipe, f.source.rows[0]!.recipe); assert.equal(result.productionReady, false);
});

test("an image index from another source remains an image hold without breaking the meal recipe", () => {
  const f = ready(), evaluation = f.source.planner.evaluateJoined(f.source.assignments, f.source.request); if (evaluation.outcome !== "success") throw new Error("Expected synthetic evaluation");
  const assignment = f.source.assignments[0]!, result = presentRecipe(evaluation, assignment.personId, assignment.assignmentId, { ...f.index, sourceSha256: "0".repeat(64) });
  if (result.outcome !== "recipe") throw new Error("Valid recipe remains available"); assert.deepEqual(result.image, { status: "held", code: "image-source-mismatch" });
});

const intake = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake", current = intake + "/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl", mappingPath = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/backend-readiness-20261016-01/plan-review-20261018-01/approved-image-bindings-20261018-01.json";
test("actual six approved originals match current source bodies and their exact unchanged asset bytes", { skip: ![current, mappingPath].every(existsSync) && "Pinned external source absent; not actual asset acceptance" }, () => {
  const before = [readFileSync(current), readFileSync(mappingPath)], result = createReviewedImageIndex(before[0], before[1]); assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") return;
  assert.equal(result.index.summary.catalogRecipes, 1300); assert.equal(result.index.summary.approvedAppearanceBindings, 6); assert.equal(result.index.summary.missingImageRecipes, 1294);
  const mapping = JSON.parse(before[1]!.toString()), imageRoot = realpathSync(intake + "/runtime/meal-images");
  for (const row of mapping.bindings) { const path = realpathSync(resolve(imageRoot, row.assetFile)), rel = relative(imageRoot, path); assert.ok(!isAbsolute(rel) && rel !== ".." && !rel.startsWith("..\\") && !rel.startsWith("../")); const bytes = readFileSync(path), image = result.index.resolve(row.recipeId, row.recipeSha256, bytes); assert.equal(image.outcome, "verified-local-illustration"); if (image.outcome === "verified-local-illustration") { assert.equal(image.width, 1024); assert.equal(image.height, 1024); assert.equal(image.assetSha256, row.assetSha256); assert.equal(image.newPixelReviewPerformed, false); } assert.equal(sha(readFileSync(path)), sha(bytes)); }
  assert.deepEqual([sha(readFileSync(current)), sha(readFileSync(mappingPath))], before.map(sha));
});
