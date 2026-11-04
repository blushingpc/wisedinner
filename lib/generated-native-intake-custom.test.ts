// Synthetic exact-mapping protocol tests. Not real food, account or allergy clearance.
import test from "node:test";
import assert from "node:assert/strict";
import { createNativeIntakeAdapter, nativePersonAnswerDigest } from "./generated-native-intake.ts";
import { parsePeople, type PersonInput } from "../packages/solver/src/generated-plan-contract.ts";
import { setup, sha } from "./generated-joined-plan.test-support.ts";
import { allergySetup } from "./generated-plan-household-allergies.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";

const POLICY = "wd-exact-custom-food-allergy-v1";
function fixture(withPolicy = true) {
  const data = setup();
  const person = (id: string, protein: string) => ({ id, name: "Fixture " + id, avatar: 0, protein, proteinUnknown: false, lastKnownProtein: "", calories: "", exclusions: { answer: "none", listed: [] as string[], custom: "" } });
  const draft = { schema: "wd-native-ui-draft-v1", nextPerson: 3, primaryPersonId: "p1", people: [person("p1", "90"), person("p2", "120")], budget: "500.00", coverage: "wd-seven-day-three-meals-v1", dietaryRule: "No set pattern", additionalRule: "", equipment: ["Stove"], equipmentReviewed: true, stores: { labels: [] as string[], other: "" }, pantry: [], pantryEntry: { name: "", amount: "", form: "" }, mode: "current", startDate: "2026-10-19", weekly: {} };
  const labels = [["Milk", "milk"], ["Eggs", "egg"], ["Wheat", "wheat"], ["Reviewed wheat", "wheat"]].map(([label, allergenId]) => ({ label: label!, allergenId: allergenId!, kind: "food-allergy", sourceSha256: "d".repeat(64) }));
  const configuration = { sourceSha256: data.configuration.sourcePin.sha256, storeMappings: [], equipmentMappings: [{ label: "Stove", id: "fixture-pan", sourceSha256: "c".repeat(64) }], foodAllergyMappings: { policy: "wd-household-food-allergies-v1", mappingRevision: 4, labels, ...(withPolicy ? { customPolicy: POLICY } : {}) } };
  const binding = createNativeIntakeAdapter(configuration);
  assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") throw Error("Expected synthetic intake configuration");
  const adapter = binding;
  function context(value = draft, sourceSha256 = configuration.sourceSha256) { return { sourceSha256, region: "South", asOfDate: "2026-10-18", startDate: value.startDate, profiles: value.people.map(p => ({ personId: p.id, profileRevision: p.id === "p1" ? 7 : 3, answerSha256: nativePersonAnswerDigest(p) })) }; }
  return { data, draft, configuration, adapter, context };
}

test("only an explicit trusted host policy permits an exact reviewed custom allergy", () => {
  const off = fixture(false); off.draft.people[1]!.exclusions = { answer: "listed", listed: [], custom: "Wheat" };
  assert.equal(off.adapter.prepare(off.draft, off.context()).outcome, "held");
  const f = fixture(); f.draft.people[1]!.exclusions = { answer: "listed", listed: ["Milk"], custom: "Reviewed wheat" };
  const before = structuredClone(f.draft), result = f.adapter.prepare(f.draft, f.context());
  assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") return;
  assert.deepEqual(result.request.people.map(p => [p.personId, p.profileRevision, p.exclusions]), [["p1", 7, { kind: "none" }], ["p2", 3, { kind: "mapped", ingredientIds: [], allergenIds: ["milk", "wheat"], mappingRevision: 4, scope: "household" }]]);
  assert.deepEqual(result.mappingEvidence.filter(e => e.kind === "food-allergy").map(e => [e.label, e.id, e.sourceSha256]), [["Milk", "milk", "d".repeat(64)], ["Reviewed wheat", "wheat", "d".repeat(64)]]);
  assert.deepEqual(f.draft, before); assert.equal(Object.isFrozen(f.draft), false); assert.equal(result.acceptedByNative, false); assert.equal(result.solved, false); assert.equal(result.saved, false);
  assert.equal(parsePeople(result.request.people).outcome, "validated");
});

test("all bounded listed subsets/custom choices/policy states preserve exact people and never erase unknown entries", () => {
  const names = ["Milk", "Eggs", "Wheat"], ids = ["milk", "egg", "wheat"], customs = ["", "Milk", "Wheat", "  Wheat  ", "wheat", "Unknown", "Milk, Eggs"];
  let cases = 0;
  for (const policy of [false, true]) for (let mask = 0; mask < 8; mask++) for (const custom of customs) for (const index of [0, 1]) {
    const f = fixture(policy), listed = names.filter((_n, i) => mask & 1 << i), member = f.draft.people[index]!;
    member.exclusions = { answer: listed.length || custom.trim() ? "listed" : "none", listed, custom };
    const before = structuredClone(f.draft), result = f.adapter.prepare(f.draft, f.context()), trimmed = custom.trim(), knownCustom = !trimmed || policy && names.includes(trimmed);
    assert.equal(result.outcome, knownCustom ? "ready" : "held", JSON.stringify({ policy, mask, custom, index }));
    if (result.outcome === "ready") {
      assert.equal(parsePeople(result.request.people).outcome, "validated");
      const expectedIds = [...new Set([...listed.map(n => ids[names.indexOf(n)]!), ...(trimmed ? [ids[names.indexOf(trimmed)]!] : [])])].sort();
      const expected = expectedIds.length ? { kind: "mapped", ingredientIds: [], allergenIds: expectedIds, mappingRevision: 4, scope: "household" } : { kind: "none" };
      assert.deepEqual(result.request.people[index]!.exclusions, expected);
      assert.deepEqual(result.request.people[1 - index]!.exclusions, { kind: "none" });
      assert.deepEqual(result.request.people.map(p => [p.personId, p.profileRevision]), [["p1", 7], ["p2", 3]]);
    } else if (result.outcome === "held") {
      assert.equal(result.request, null); assert.ok(result.issues.some(i => i.code === "exclusion_mapping_required" && i.personId === member.id && i.profileRevision === (index ? 3 : 7)));
    }
    assert.deepEqual(f.draft, before); cases++;
  }
  assert.equal(cases, 224);
});

test("contradictions, unmapped listed values and composite custom text remain held without partial requests", () => {
  const f = fixture();
  for (const declaration of [
    { answer: "none", listed: [], custom: "Milk" },
    { answer: "unanswered", listed: [], custom: "Milk" },
    { answer: "listed", listed: [], custom: "" },
    { answer: "listed", listed: ["Unknown listed food"], custom: "Milk" },
    { answer: "listed", listed: ["Milk"], custom: "Milk and eggs" },
    { answer: "listed", listed: ["Milk"], custom: "Milk\nEggs" },
  ]) {
    const draft = structuredClone(f.draft); draft.people[0]!.exclusions = declaration;
    const result = f.adapter.prepare(draft, f.context(draft)); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.equal(result.request, null);
  }
});

test("known custom mapping cannot bypass stale profiles, source, goals, calories, diet or weekly holds", () => {
  const f = fixture(); f.draft.people[1]!.exclusions = { answer: "listed", listed: [], custom: "Milk" };
  const staleContext = f.context(); f.draft.people[1]!.exclusions.custom = "Wheat";
  const stale = f.adapter.prepare(f.draft, staleContext); assert.equal(stale.outcome, "held"); if (stale.outcome === "held") assert.ok(stale.issues.some(i => i.code === "stale_profile_binding" && i.personId === "p2" && i.profileRevision === 3));
  assert.notEqual(f.adapter.prepare(f.draft, f.context(f.draft, "0".repeat(64))).outcome, "ready");
  for (const patch of [{ proteinUnknown: true, protein: "" }, { calories: "2100" }]) {
    const draft = structuredClone(f.draft); Object.assign(draft.people[1]!, patch); assert.equal(f.adapter.prepare(draft, f.context(draft)).outcome, "held");
  }
  assert.equal(f.adapter.prepare({ ...f.draft, dietaryRule: "Vegan" }, f.context()).outcome, "held");
  assert.equal(f.adapter.prepare({ ...f.draft, additionalRule: "unreviewed diet" }, f.context()).outcome, "held");
  assert.equal(f.adapter.prepare({ ...f.draft, weekly: { current: { answers: { time: ["Around 15 minutes"] }, custom: {}, foods: {} } } }, f.context()).outcome, "held");
});

test("unrecognized host policies and client-side policy grants cannot enable custom mapping", () => {
  const f = fixture(false);
  for (const policy of [undefined, null, true, false, 1, {}, [], "different-policy"]) assert.equal(createNativeIntakeAdapter({ ...f.configuration, foodAllergyMappings: { ...f.configuration.foodAllergyMappings, customPolicy: policy } }).outcome, "error");
  assert.equal(f.adapter.prepare({ ...f.draft, customPolicy: POLICY }, f.context()).outcome, "error");
  const draft = structuredClone(f.draft); Object.assign(draft.people[0]!.exclusions, { customPolicy: POLICY });
  assert.equal(f.adapter.prepare(draft, f.context()).outcome, "error");
});

test("copied host mappings and hostile fields cannot alter the reviewed decision", () => {
  const f = fixture(); f.draft.people[0]!.exclusions = { answer: "listed", listed: [], custom: "Milk" };
  f.configuration.foodAllergyMappings.labels[0]!.allergenId = "changed-after-binding";
  const result = f.adapter.prepare(f.draft, f.context()); assert.equal(result.outcome, "ready"); if (result.outcome === "ready") assert.deepEqual(result.request.people[0]!.exclusions, { kind: "mapped", ingredientIds: [], allergenIds: ["milk"], mappingRevision: 4, scope: "household" });
  let reads = 0; const context = f.context(), hostile = structuredClone(f.draft);
  Object.defineProperty(hostile.people[0]!.exclusions, "custom", { enumerable: true, get() { reads++; return "Milk"; } });
  assert.equal(f.adapter.prepare(hostile, context).outcome, "error");
  const configuration = { ...f.configuration, foodAllergyMappings: { ...f.configuration.foodAllergyMappings } };
  Object.defineProperty(configuration.foodAllergyMappings, "customPolicy", { enumerable: true, get() { reads++; return POLICY; } });
  assert.equal(createNativeIntakeAdapter(configuration).outcome, "error"); assert.equal(reads, 0);
});

test("existing canonical people caps still reject unsupported values without inventing ready requests", () => {
  const f = fixture(false);
  for (const n of [500, 501, 1000]) {
    const draft = structuredClone(f.draft); draft.people[0]!.name = "n".repeat(n);
    const result = f.adapter.prepare(draft, f.context(draft)); assert.equal(result.outcome, n <= 500 ? "ready" : "error");
  }
});

test("custom addition respects the unchanged100 canonical-allergen limit without truncating aliases", () => {
  const f = fixture(), labels = Array.from({ length: 101 }, (_, i) => ({ label: "Fixture allergy " + i, allergenId: "fixture-allergen-" + i, kind: "food-allergy", sourceSha256: "d".repeat(64) }));
  const configuration = { ...f.configuration, foodAllergyMappings: { ...f.configuration.foodAllergyMappings, labels } };
  const binding = createNativeIntakeAdapter(configuration); assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") return;
  for (const count of [99, 100]) {
    const draft = structuredClone(f.draft); draft.people[0]!.exclusions = { answer: "listed", listed: labels.slice(0, count).map(x => x.label), custom: labels[count]!.label };
    const result = binding.prepare(draft, f.context(draft)); assert.equal(result.outcome, count === 99 ? "ready" : "error");
    if (result.outcome === "ready") { const exclusion: PersonInput["exclusions"] = result.request.people[0]!.exclusions; assert.equal(exclusion.kind, "mapped"); if (exclusion.kind === "mapped") assert.equal(exclusion.allergenIds.length, 100); }
  }
  const draft = structuredClone(f.draft); draft.people[0]!.exclusions = { answer: "listed", listed: labels.slice(0, 100).map(x => x.label), custom: labels[0]!.label };
  const duplicate = binding.prepare(draft, f.context(draft)); assert.equal(duplicate.outcome, "ready"); if (duplicate.outcome === "ready") { const exclusion: PersonInput["exclusions"] = duplicate.request.people[0]!.exclusions; if (exclusion.kind === "mapped") assert.equal(exclusion.allergenIds.length, 100); assert.equal(duplicate.mappingEvidence.filter(x => x.kind === "food-allergy").length, 101); }
});

test("reviewed custom allergy reaches the same full42 household-hard evaluator including another person's meal", () => {
  const f = fixture(), data = allergySetup(), rows = data.rows.map(r => ({ ...r, sections: ["breakfast", "lunch", "dinner"] })), bytes = Buffer.from(rows.map(r => JSON.stringify(r)).join("\n") + "\n"), sourcePin = { sha256: sha(bytes), recordCount: rows.length };
  f.draft.people[1]!.exclusions = { answer: "listed", listed: [], custom: "Milk" };
  const intake = createNativeIntakeAdapter({ ...f.configuration, sourceSha256: sourcePin.sha256 }); assert.equal(intake.outcome, "ready"); if (intake.outcome !== "ready") return;
  const prepared = intake.prepare(f.draft, f.context(f.draft, sourcePin.sha256)); assert.equal(prepared.outcome, "ready"); if (prepared.outcome !== "ready") return;
  const configuration = { ...data.configuration, sourcePin, schedulePolicy: "wd-seven-day-three-meals-v1" as const, householdAllergies: { ...data.configuration.householdAllergies, sourceSha256: sourcePin.sha256 } };
  const binding = createJoinedReferencePlanner(bytes, configuration); assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") return;
  const assignments = prepared.request.selectedDays.flatMap(date => prepared.request.people.flatMap((p, i) => prepared.request.slots.map(slot => ({ assignmentId: p.personId + date + slot, personId: p.personId, profileRevision: p.profileRevision, date, slot, recipeId: "a", recipeSha256: rows[0]!.recipe_sha256, sourceServings: { numerator: i ? "4" : "1", denominator: i ? "3" : "1" } }))));
  assert.equal(assignments.length, 42);
  assert.equal(binding.planner.evaluateJoined(assignments, prepared.request).outcome, "success");
  assignments[0] = { ...assignments[0]!, recipeId: "b", recipeSha256: rows[1]!.recipe_sha256 };
  const result = binding.planner.evaluateJoined(assignments, prepared.request); assert.equal(result.outcome, "no_fit");
  if (result.outcome === "no_fit") assert.ok(result.reasons.some(r => r.code === "household_allergen_excluded"));
  assert.deepEqual(prepared.request.people[0]!.exclusions, { kind: "none" });
  assert.equal(prepared.request.people[1]!.personId, "p2"); assert.equal(prepared.request.people[1]!.profileRevision, 3);
});
