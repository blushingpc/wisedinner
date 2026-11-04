import test from "node:test";
import assert from "node:assert/strict";
import { createNativeIntakeAdapter, nativePersonAnswerDigest } from "./generated-native-intake.ts";
import { resolveGoalReturn } from "../packages/solver/src/generated-plan-contract.ts";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
import { HOUSEHOLD_ALLERGY_POLICY } from "./generated-household-allergies.ts";
import { allergySetup } from "./generated-plan-household-allergies.test-support.ts";

function fixture() {
  const person = (id: string, protein: string) => ({ id, name: "Fixture " + id, avatar: 0, protein, proteinUnknown: false, lastKnownProtein: "", calories: "", exclusions: { answer: "none", listed: [] as string[], custom: "" } });
  const draft = { schema: "wd-native-ui-draft-v1", nextPerson: 4, primaryPersonId: "p1", people: [person("p1", "150"), person("p3", "90")], budget: "100.01", coverage: "wd-seven-day-three-meals-v1", dietaryRule: "No set pattern", additionalRule: "", equipment: ["Stove"], equipmentReviewed: true, stores: { labels: ["Publix", "Aldi"], other: "" }, pantry: [], pantryEntry: { name: "", amount: "", form: "" }, mode: "current", startDate: "2026-10-19", weekly: {} };
  const configuration = { sourceSha256: "a".repeat(64), storeMappings: [{ kind: "listed", label: "Publix", id: "fixture-publix", sourceSha256: "b".repeat(64) }, { kind: "listed", label: "Aldi", id: "fixture-aldi", sourceSha256: "b".repeat(64) }], equipmentMappings: [{ label: "Stove", id: "fixture-pan", sourceSha256: "c".repeat(64) }] };
  const profiles = draft.people.map(p => ({ personId: p.id, profileRevision: p.id === "p1" ? 7 : 3, answerSha256: nativePersonAnswerDigest(p) }));
  const context = { sourceSha256: configuration.sourceSha256, region: "South", asOfDate: "2026-10-18", startDate: draft.startDate, profiles };
  const adapter = createNativeIntakeAdapter(configuration); if (adapter.outcome !== "ready") throw new Error("Expected synthetic adapter");
  return { draft, configuration, context, adapter };
}
test("native intake binding preserves stable people, exact cents, dates, selected stores and equipment", () => {
  const f = fixture(), original = structuredClone(f.draft), result = f.adapter.prepare(f.draft, f.context);
  assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") return;
  assert.deepEqual(result.request.people.map(p => [p.personId, p.profileRevision, p.proteinGoal]), [["p1", 7, { kind: "known", gramsPerDay: "150", coverage: "full-day" }], ["p3", 3, { kind: "known", gramsPerDay: "90", coverage: "full-day" }]]);
  assert.equal(result.request.budgetCents, 10001); assert.equal(result.request.selectedDays.length, 7); assert.equal(result.request.selectedDays[6], "2026-10-25"); assert.deepEqual(result.request.slots, ["breakfast", "lunch", "dinner"]);
  assert.deepEqual(result.request.storeIds, ["fixture-publix", "fixture-aldi"]); assert.deepEqual(result.request.equipment, ["fixture-pan"]); assert.equal(result.request.region, "South");
  assert.equal(result.acceptedByNative, false); assert.deepEqual(f.draft, original); assert.equal(Object.isFrozen(f.draft), false);
});
test("reorder/removal never assigns one person's target or revision to another", () => {
  const f = fixture(); f.draft.people.reverse(); const reordered = f.adapter.prepare(f.draft, f.context); assert.equal(reordered.outcome, "ready");
  if (reordered.outcome === "ready") assert.deepEqual(reordered.request.people.map(p => [p.personId, p.profileRevision]), [["p3", 3], ["p1", 7]]);
  f.draft.people = f.draft.people.filter(p => p.id === "p1");
  assert.equal(f.adapter.prepare(f.draft, f.context).outcome, "held");
  const removed = f.adapter.prepare(f.draft, { ...f.context, profiles: f.context.profiles.filter(p => p.personId === "p1") }); assert.equal(removed.outcome, "ready");
});
test("profile edits and missing revisions cannot be silently defaulted", () => {
  const f = fixture(); f.draft.people[0]!.protein = "151";
  const stale = f.adapter.prepare(f.draft, f.context); assert.equal(stale.outcome, "held"); if (stale.outcome === "held") assert.ok(stale.issues.some(i => i.code === "stale_profile_binding" && i.personId === "p1"));
  assert.equal(f.adapter.prepare(f.draft, { ...f.context, profiles: [] }).outcome, "held");
});
test("Unknown goal return remains bound to the correct person and revision", () => {
  const f = fixture(); f.draft.people[1]!.proteinUnknown = true; f.draft.people[1]!.protein = ""; f.context.profiles[1]!.answerSha256 = nativePersonAnswerDigest(f.draft.people[1]);
  const result = f.adapter.prepare(f.draft, f.context); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.issues.some(i => i.code === "goal_required" && i.personId === "p3" && i.profileRevision === 3));
  const people = [{ personId: "p3", profileRevision: 3, label: "Fixture", proteinGoal: { kind: "unknown" }, exclusions: { kind: "none" } }];
  assert.deepEqual(resolveGoalReturn(people, "p3", 3), { outcome: "held", code: "goal_required", returnTo: { personId: "p3", profileRevision: 3, field: "proteinGoal" } });
  assert.deepEqual(resolveGoalReturn(people, "p3", 2), { outcome: "error", code: "stale_profile" });
});
test("coverage region date blanks and unsupported precision are not replaced with defaults", () => {
  for (const patch of [{ coverage: "" }, { startDate: "" }, { budget: "100.011" }, { budget: "0" }, { budget: "9007199254740991" }]) {
    const f = fixture(); assert.notEqual(f.adapter.prepare({ ...f.draft, ...patch }, f.context).outcome, "ready");
  }
  const f = fixture(); for (const patch of [{ region: "" }, { region: "Florida" }, { asOfDate: "2026-02-30" }, { sourceSha256: "d".repeat(64) }, { startDate: "2026-10-20" }]) assert.notEqual(f.adapter.prepare(f.draft, { ...f.context, ...patch }).outcome, "ready");
});
test("allergy, diet, calories, pantry text and active weekly choices stay held rather than ignored", () => {
  const f = fixture();
  for (const draft of [{ ...f.draft, dietaryRule: "Vegetarian" }, { ...f.draft, additionalRule: "custom restriction" }, { ...f.draft, pantry: [{ id: "one", name: "Food", amount: "half cup", form: "cooked" }] }, { ...f.draft, weekly: { current: { answers: { time: ["Around 15 minutes"] }, custom: {}, foods: {} } } }, { ...f.draft, pantryEntry: { name: "unfinished", amount: "", form: "" } }]) assert.equal(f.adapter.prepare(draft, f.context).outcome, "held");
  for (const patch of [{ calories: "2100" }, { exclusions: { answer: "listed", listed: ["Milk"], custom: "" } }, { exclusions: { answer: "none", listed: [], custom: "sesame" } }, { exclusions: { answer: "unanswered", listed: [], custom: "" } }]) {
    const draft = { ...f.draft, people: [{ ...f.draft.people[0], ...patch }, f.draft.people[1]] }; const context = { ...f.context, profiles: draft.people.map((p, i) => ({ ...f.context.profiles[i], answerSha256: nativePersonAnswerDigest(p) })) }; assert.equal(f.adapter.prepare(draft, context).outcome, "held");
  }
});
test("unmapped stores/tools and custom Other do not disappear from intake", () => {
  const f = fixture(); for (const draft of [{ ...f.draft, stores: { labels: ["Unknown shop"], other: "" } }, { ...f.draft, stores: { labels: [], other: "Local shop" } }, { ...f.draft, equipment: ["Unmapped tool"] }, { ...f.draft, equipmentReviewed: false }]) assert.equal(f.adapter.prepare(draft, f.context).outcome, "held");
  const noPreference = f.adapter.prepare({ ...f.draft, stores: { labels: [], other: "" } }, f.context); assert.equal(noPreference.outcome, "ready"); if (noPreference.outcome === "ready") assert.deepEqual(noPreference.request.storeIds, []);
  const noTools = f.adapter.prepare({ ...f.draft, equipment: [] }, f.context); assert.equal(noTools.outcome, "ready"); if (noTools.outcome === "ready") assert.deepEqual(noTools.request.equipment, []);
});

test("ready native intake never emits store selections refused by the existing regional validator", () => {
  const f = fixture(), mappings = Array.from({ length: 4 }, (_, i) => ({ kind: "listed", label: "Synthetic shop " + i, id: "fixture-shop-" + i, sourceSha256: "b".repeat(64) }));
  const bound = createNativeIntakeAdapter({ ...f.configuration, storeMappings: mappings }); if (bound.outcome !== "ready") throw new Error("Expected mapping configuration");
  for (const n of [0, 1, 2, 3, 4]) { const result = bound.prepare({ ...f.draft, stores: { labels: mappings.slice(0, n).map(m => m.label), other: "" } }, f.context); assert.equal(result.outcome, "ready"); if (result.outcome === "ready") assert.deepEqual(result.request.storeIds, mappings.slice(0, n).map(m => m.id)); }
});
test("getters, unknown fields and duplicate identities cannot gain trusted binding", () => {
  const f = fixture(); let reads = 0; const hostile = Object.defineProperty({ ...f.draft }, "budget", { enumerable: true, get() { reads++; return "1"; } });
  assert.equal(f.adapter.prepare(hostile, f.context).outcome, "error"); assert.equal(reads, 0);
  assert.equal(f.adapter.prepare({ ...f.draft, owner: "body-grant" }, f.context).outcome, "error");
  assert.equal(f.adapter.prepare({ ...f.draft, people: [f.draft.people[0], f.draft.people[0]] }, f.context).outcome, "error");
});

test("prepared native inputs reach the same full-day evaluator for all42 synthetic assignments", () => {
  const f = fixture(), data = setup(), rows = data.rows.map(r => ({ ...r, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n"), sourcePin = { sha256: sha(bytes), recordCount: rows.length };
  const adapter = createNativeIntakeAdapter({ ...f.configuration, sourceSha256: sourcePin.sha256 }); if (adapter.outcome !== "ready") throw new Error("Expected source binding");
  const prepared = adapter.prepare({ ...f.draft, budget: "500.01" }, { ...f.context, sourceSha256: sourcePin.sha256 }); if (prepared.outcome !== "ready") throw new Error("Expected prepared inputs");
  const planner = createJoinedReferencePlanner(bytes, { ...data.configuration, sourcePin, schedulePolicy: "wd-seven-day-three-meals-v1" }); if (planner.outcome !== "ready") throw new Error("Expected canonical planner");
  const assignments = prepared.request.selectedDays.flatMap(date => prepared.request.people.flatMap(p => prepared.request.slots.map(slot => ({ assignmentId: p.personId + date + slot, personId: p.personId, profileRevision: p.profileRevision, date, slot, recipeId: "a", recipeSha256: rows[0]!.recipe_sha256, sourceServings: { numerator: "3", denominator: "1" } }))));
  const result = planner.planner.evaluateJoined(assignments, prepared.request); assert.equal(result.outcome, "success");
  if (result.outcome === "success") { assert.equal(result.projection.assignments.length, 42); assert.equal(result.fullDayCoverage?.policy, "wd-seven-day-three-meals-v1"); }
  const noFit = planner.planner.evaluateJoined(assignments, { ...prepared.request, budgetCents: 1 }); assert.equal(noFit.outcome, "no_fit");
});

function allergyFixture() {
  const f = fixture(); f.draft.people[0]!.exclusions = { answer: "listed", listed: ["Milk"], custom: "" };
  const context = { ...f.context, profiles: f.draft.people.map(p => ({ ...f.context.profiles.find(v => v.personId === p.id)!, answerSha256: nativePersonAnswerDigest(p) })) };
  const foodAllergyMappings = { policy: HOUSEHOLD_ALLERGY_POLICY, mappingRevision: 4, labels: [{ label: "Milk", allergenId: "milk", kind: "food-allergy", sourceSha256: "d".repeat(64) }] };
  const configuration = { ...f.configuration, foodAllergyMappings }, bound = createNativeIntakeAdapter(configuration);
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw Error("Trusted synthetic allergy labels");
  return { ...f, context, configuration, adapter: bound };
}

test("explicit native food-allergy mapping reaches its person and household-hard canonical scope", () => {
  const f = allergyFixture(), before = structuredClone(f.draft), result = f.adapter.prepare(f.draft, f.context);
  assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") return;
  assert.deepEqual(result.request.people[0]!.exclusions, { kind: "mapped", ingredientIds: [], allergenIds: ["milk"], mappingRevision: 4, scope: "household" });
  assert.deepEqual(result.request.people[1]!.exclusions, { kind: "none" }); assert.equal(result.request.people[0]!.personId, "p1");
  assert.ok(result.mappingEvidence.some(e => e.kind === "food-allergy" && e.id === "milk")); assert.deepEqual(f.draft, before);
  assert.equal(fixture().adapter.prepare(f.draft, f.context).outcome, "held");
});

test("custom, unknown, none contradictions and unmatched allergy labels never become None", () => {
  const f = allergyFixture();
  for (const exclusions of [{ answer: "listed", listed: ["Milk"], custom: "sesame" }, { answer: "listed", listed: ["milk"], custom: "" }, { answer: "listed", listed: [], custom: "" }, { answer: "none", listed: ["Milk"], custom: "" }, { answer: "unanswered", listed: ["Milk"], custom: "" }]) {
    const draft = { ...f.draft, people: [{ ...f.draft.people[0], exclusions }, f.draft.people[1]] };
    const context = { ...f.context, profiles: draft.people.map(p => ({ ...f.context.profiles.find(v => v.personId === p!.id)!, answerSha256: nativePersonAnswerDigest(p) })) };
    const result = f.adapter.prepare(draft, context); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.equal(result.request, null);
  }
  assert.equal(f.adapter.prepare({ ...f.draft, dietaryRule: "Vegetarian" }, f.context).outcome, "held");
});

test("mapped allergy review preserves person revisions after reorder and refuses stale answer bindings", () => {
  const f = allergyFixture(); f.draft.people.reverse();
  const reordered = f.adapter.prepare(f.draft, f.context); assert.equal(reordered.outcome, "ready"); if (reordered.outcome === "ready") { assert.equal(reordered.request.people[1]!.personId, "p1"); assert.equal(reordered.request.people[1]!.profileRevision, 7); assert.equal(reordered.request.people[1]!.exclusions.kind, "mapped"); }
  f.draft.people.find(p => p.id === "p1")!.exclusions.listed = [];
  const stale = f.adapter.prepare(f.draft, f.context); assert.equal(stale.outcome, "held"); if (stale.outcome === "held") assert.ok(stale.issues.some(i => i.code === "stale_profile_binding" && i.personId === "p1"));
});

test("native review maps cannot widen diets, execute getters or change after binding", () => {
  const f = allergyFixture(); f.configuration.foodAllergyMappings.labels[0]!.allergenId = "sesame";
  const result = f.adapter.prepare(f.draft, f.context); assert.equal(result.outcome, "ready"); if (result.outcome === "ready" && result.request.people[0]!.exclusions.kind === "mapped") assert.deepEqual(result.request.people[0]!.exclusions.allergenIds, ["milk"]);
  for (const mappings of [{ ...f.configuration.foodAllergyMappings, policy: "personal-preferences" }, { ...f.configuration.foodAllergyMappings, mappingRevision: -1 }, { ...f.configuration.foodAllergyMappings, labels: [{ label: "Vegetarian", allergenId: "milk", kind: "diet", sourceSha256: "d".repeat(64) }] }, { ...f.configuration.foodAllergyMappings, labels: [f.configuration.foodAllergyMappings.labels[0], f.configuration.foodAllergyMappings.labels[0]] }]) assert.equal(createNativeIntakeAdapter({ ...f.configuration, foodAllergyMappings: mappings }).outcome, "error");
  let reads = 0; const hostile = Object.defineProperty({ ...f.configuration }, "foodAllergyMappings", { enumerable: true, get() { reads++; throw Error("not invoked"); } }); assert.equal(createNativeIntakeAdapter(hostile).outcome, "error"); assert.equal(reads, 0);
});

test("prepared allergy answers feed the actual42assignment consumer with household-wide exclusions", () => {
  const f = allergyFixture(), data = allergySetup(true), rows = data.rows.map(r => ({ ...r, sections: ["breakfast", "lunch", "dinner"] }));
  const bytes = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n"), sourcePin = { sha256: sha(bytes), recordCount: 2 };
  const adapter = createNativeIntakeAdapter({ ...f.configuration, sourceSha256: sourcePin.sha256 }); assert.equal(adapter.outcome, "ready"); if (adapter.outcome !== "ready") return;
  const prepared = adapter.prepare({ ...f.draft, budget: "500.01" }, { ...f.context, sourceSha256: sourcePin.sha256 }); assert.equal(prepared.outcome, "ready"); if (prepared.outcome !== "ready") return;
  const bound = createJoinedReferencePlanner(bytes, { ...data.configuration, sourcePin, schedulePolicy: "wd-seven-day-three-meals-v1", householdAllergies: { ...data.configuration.householdAllergies, sourceSha256: sourcePin.sha256 } }); assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") return;
  const assignments = prepared.request.selectedDays.flatMap(date => prepared.request.people.flatMap(p => prepared.request.slots.map(slot => ({ assignmentId: p.personId + date + slot, personId: p.personId, profileRevision: p.profileRevision, date, slot, recipeId: "a", recipeSha256: rows[0]!.recipe_sha256, sourceServings: { numerator: p.personId === "p1" ? "2" : "1", denominator: "1" } }))));
  const compatible = bound.planner.evaluateJoined(assignments, prepared.request); assert.equal(compatible.outcome, "success"); if (compatible.outcome === "success") assert.equal(compatible.projection.assignments.length, 42);
  const target = assignments.find(a => a.personId === "p3")!;
  const incompatible = assignments.map(a => a.assignmentId === target.assignmentId ? { ...a, recipeId: "b", recipeSha256: rows[1]!.recipe_sha256 } : a);
  const rejected = bound.planner.evaluateJoined(incompatible, prepared.request); assert.equal(rejected.outcome, "no_fit"); if (rejected.outcome === "no_fit") assert.ok(rejected.reasons.some(r => r.code === "household_allergen_excluded" && r.personId === "p3"));
});
