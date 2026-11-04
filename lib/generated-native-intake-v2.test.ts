import test from "node:test";
import assert from "node:assert/strict";
import { createNativeIntakeAdapter, createNativeIntakeAdapterV2, nativePersonAnswerDigest, SHOPPING_PREFERENCE_POLICY_V2, SHOPPING_PREFERENCE_POLICY_SHA256, SHOPPING_PRICE_DISCLOSURE } from "./generated-native-intake.ts";

function fixture() {
  const person = { id: "p1", name: "Test person", avatar: 0, protein: "90", proteinUnknown: false, lastKnownProtein: "", calories: "", exclusions: { answer: "none", listed: [], custom: "" } };
  const draft = { schema: "wd-native-ui-draft-v1", nextPerson: 2, primaryPersonId: "p1", people: [person], budget: "150.01", coverage: "wd-seven-day-three-meals-v1", dietaryRule: "No set pattern", additionalRule: "", equipment: ["Stove"], equipmentReviewed: true, stores: { labels: [] as string[], other: "" }, pantry: [], pantryEntry: { name: "", amount: "", form: "" }, mode: "current", startDate: "2026-10-23", weekly: {} };
  const configuration = { sourceSha256: "a".repeat(64), shoppingPreferencePolicy: SHOPPING_PREFERENCE_POLICY_V2, storeMappings: ["Publix", "Aldi"].map(label => ({ kind: "listed", label, id: "preference:" + label, sourceSha256: "b".repeat(64) })), equipmentMappings: [{ label: "Stove", id: "stove", sourceSha256: "c".repeat(64) }] };
  const context = { sourceSha256: configuration.sourceSha256, region: "South", asOfDate: "2026-10-23", startDate: draft.startDate, profiles: [{ personId: "p1", profileRevision: 4, answerSha256: nativePersonAnswerDigest(person) }] };
  const adapter = createNativeIntakeAdapterV2(configuration); assert.equal(adapter.outcome, "ready"); if (adapter.outcome !== "ready") throw Error("fixture");
  return { draft, configuration, context, adapter };
}
test("V2 explicitly opts into preference policy; V1 refuses new config and keeps its no-preference bytes", () => {
  const f = fixture(); assert.equal(createNativeIntakeAdapter(f.configuration).outcome, "error");
  assert.equal(createNativeIntakeAdapterV2({ ...f.configuration, shoppingPreferencePolicy: "unreviewed" }).outcome, "error");
  const { shoppingPreferencePolicy: _, ...legacy } = f.configuration; void _;
  const v1 = createNativeIntakeAdapter(legacy); if (v1.outcome !== "ready") throw Error("legacy");
  const old = v1.prepare(f.draft, f.context); assert.equal(old.outcome, "ready"); if (old.outcome === "ready") { assert.deepEqual(old.request.storeIds, []); assert.equal(Object.hasOwn(old, "shoppingPreference"), false); }
});
test("none/custom/mixed preserve raw choice/order and reference-only evidence, never guess a retailer", () => {
  const f = fixture(); const digests = new Set<string>();
  for (const stores of [{ labels: [], other: "" }, { labels: [], other: "   " }, { labels: [], other: "  Café e\u0301 🥬  " }, { labels: ["Publix", "Aldi"], other: "my unknown shop" }]) {
    const draft = { ...f.draft, stores }, before = structuredClone(draft), result = f.adapter.prepare(draft, f.context);
    assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") continue;
    const p = result.shoppingPreference!; assert.ok(p); assert.equal(p.policySha256, SHOPPING_PREFERENCE_POLICY_SHA256);
    assert.equal(p.originalOther, stores.other); assert.deepEqual(p.listed, stores.labels); assert.equal(p.customDisplay, stores.other.trim().normalize("NFC"));
    assert.equal(p.disclosure, SHOPPING_PRICE_DISCLOSURE); assert.equal(p.evidence, "user-declared-preference-not-retailer-price-evidence");
    assert.deepEqual(result.request.storeIds, p.storeIds); assert.ok(!JSON.stringify(p).includes("stock")); assert.deepEqual(draft, before); digests.add(result.inputSha256);
    if (!stores.labels.length && !stores.other.trim()) assert.deepEqual(p.storeIds, ["wd-reference-estimate:no-shop-preference"]);
    if (stores.labels.length) assert.deepEqual(p.storeIds.slice(0, 2), ["preference:Publix", "preference:Aldi"]);
    if (stores.other.trim()) assert.match(p.storeIds.at(-1)!, /^wd-shopping-preference:custom:[a-f0-9]{64}$/);
  }
  assert.equal(digests.size, 4);
});
test("overlong/control/unmapped selections hold retaining input; unsupported consequential answers never vanish", () => {
  const f = fixture();
  for (const stores of [{ labels: [], other: "x".repeat(201) }, { labels: [], other: "bad\u0000text" }, { labels: ["Unknown listed shop"], other: "" }]) {
    const result = f.adapter.prepare({ ...f.draft, stores }, f.context); assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.issues.some(i => i.code === "shopping_preference_needs_review"));
  }
  for (const patch of [{ pantry: [{ id: "food1", name: "rice", amount: "half bag", form: "dry" }] }, { dietaryRule: "Vegan" }, { additionalRule: "custom" }, { weekly: { current: { answers: { time: ["Quick"] }, custom: {}, foods: {} } } }]) assert.equal(f.adapter.prepare({ ...f.draft, ...patch }, f.context).outcome, "held");
  const changed = { ...f.draft, people: [{ ...f.draft.people[0]!, calories: "2100" }] };
  const result = f.adapter.prepare(changed, { ...f.context, profiles: [{ ...f.context.profiles[0]!, answerSha256: nativePersonAnswerDigest(changed.people[0]) }] });
  assert.equal(result.outcome, "held"); if (result.outcome === "held") assert.ok(result.issues.some(i => i.code === "calorie_constraint_not_connected"));
});
test("copied getter config/input cannot execute or become preference provenance", () => {
  const f = fixture(); let reads = 0;
  const hostile = Object.defineProperty({ ...f.draft }, "stores", { enumerable: true, get() { reads++; return f.draft.stores; } });
  assert.equal(f.adapter.prepare(hostile, f.context).outcome, "error"); assert.equal(reads, 0);
});
