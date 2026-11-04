import test from "node:test";
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";

test("even no-op previews bind their exact person and assignment into the preview hash", () => {
  const { planner, request, assignments } = setup();
  const previews = assignments.slice(0, 2).map(row => planner.previewReplacement(assignments, request, { assignmentId: row.assignmentId, personId: row.personId, expectedRecipeSha256: row.recipeSha256, replacementRecipeId: row.recipeId, sourceServings: row.sourceServings }));
  for (const value of previews) assert.equal(value.outcome, "preview");
  if (previews[0]!.outcome !== "preview" || previews[1]!.outcome !== "preview") return;
  assert.equal(previews[0]!.before.assignmentsSha256, previews[1]!.before.assignmentsSha256);
  assert.equal(previews[0]!.after.assignmentsSha256, previews[1]!.after.assignmentsSha256);
  assert.notEqual(previews[0]!.previewSha256, previews[1]!.previewSha256);
  assert.deepEqual(previews[0]!.target, { personId: assignments[0]!.personId, assignmentId: assignments[0]!.assignmentId });
});

test("a price change only on the removed meal still invalidates the complete preview and confirmation", () => {
  const old = setup(false, 1000), current = setup(false, 2000), request = { ...old.request, people: [old.request.people[0]], selectedDays: [old.request.selectedDays[0]] };
  const assignments = old.assignments.filter(row => row.personId === "p1" && row.date === request.selectedDays[0]), row = assignments[0]!;
  const intent = { assignmentId: row.assignmentId, personId: row.personId, expectedRecipeSha256: row.recipeSha256, replacementRecipeId: "b", sourceServings: row.sourceServings };
  const before = old.planner.previewReplacement(assignments, request, intent), after = current.planner.previewReplacement(assignments, request, intent);
  if (before.outcome !== "preview" || after.outcome !== "preview") throw new Error("Expected synthetic previews");
  assert.deepEqual(before.after.quote, after.after.quote); assert.notDeepEqual(before.before.quote, after.before.quote);
  assert.notEqual(before.previewSha256, after.previewSha256);
  const result = current.planner.confirmReplacement(assignments, request, { intent, expectedPreviewSha256: before.previewSha256, expectedRequestSha256: before.requestSha256, expectedAssignmentsSha256: before.baseAssignmentsSha256 });
  assert.deepEqual(result, { outcome: "error", code: "stale_replacement_preview" });
});
