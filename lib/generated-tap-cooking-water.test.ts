import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createTapCookingWaterClassifier, createReviewedDerivedTapCookingWaterClassifier } from "./generated-tap-cooking-water.ts";
import { aggregateRequirements, type ConsumedDemand } from "../packages/solver/src/generated-plan-requirements.ts";

const SOURCE = "C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl";
const CASES = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/backend-readiness-20261016-01/plan-review-20261018-01/parallel-coordination-20261020/parallel-packets/contracts/contract-freeze-02/source-bound-cases.json";
const sha = (value: string | Uint8Array): string => createHash("sha256").update(value).digest("hex");
const source = readFileSync(SOURCE);
assert.equal(sha(source), "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0");
const caseBytes = readFileSync(CASES);
assert.equal(sha(caseBytes), "ee9f2075120e28c03a93aacd7149629375a7cc84eb40543d16c19394ac496a0f");
const evidence = JSON.parse(caseBytes.toString("utf8"));
// Normative ENGINEERING fixture only. Its dates are not genuine source review.
const configuration = evidence.fixtureEvidence.cookingWaterConfiguration;
const rows = source.toString("utf8").trimEnd().split(/\r?\n/).map(line => JSON.parse(line));
const processRow = rows.find(row => row.id === "WD-R6-M-1e5671486b2787e4");
const waterRow = rows.find(row => row.id === "WD-R6-B-0251");
const clone = <T>(value: T): T => structuredClone(value);
function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered((value as Record<string, unknown>)[key])]));
  return value;
}
const independentHash = (value: unknown): string => sha(JSON.stringify(ordered(value)));
function ready(config: unknown = configuration, input: unknown = source) {
  const result = createTapCookingWaterClassifier(input, config);
  assert.equal(result.outcome, "ready");
  if (result.outcome !== "ready") throw Error("Expected ready synthetic engineering binding");
  return result;
}
const classifier = ready();
function demand(row: typeof processRow, id: string, assignmentId: string, numerator = "2", denominator = "4"): ConsumedDemand {
  const ingredient = row.recipe.ingredients.find((item: { id: string }) => item.id === id);
  assert.ok(ingredient);
  return { assignmentId, recipeId: row.id, recipeSha256: row.recipe_sha256, ingredientId: id, preparedState: ingredient.state, baseUnit: ingredient.unit, amount: { numerator, denominator } };
}
function partition(input: unknown) {
  const result = classifier.partition(input);
  assert.equal(result.outcome, "partitioned");
  if (result.outcome !== "partitioned") throw Error("Expected partitioned");
  return result;
}
const invalid = { outcome: "error", code: "invalid_tap_water_demands" };
const mismatch = { outcome: "held", code: "tap_water_source_mismatch" };
const review = { outcome: "held", code: "tap_water_review_required" };

test("synthetic engineering fixture retains every adoption hold", () => {
  assert.deepEqual(evidence.adoption, { catalog: false, retailerFacts: false, sourceReviews: false, consumer: false, native: false });
  assert.equal(configuration.reviewedForms.length, 2);
  assert.equal(processRow.recipe.ingredients.find((i: { id: string }) => i.id === "process_water").quantity, "300");
  assert.equal(waterRow.recipe.ingredients.find((i: { id: string }) => i.id === "water").quantity, "500");
});

test("both exact forms partition while lexical2/4,0/7,zero,order and source bytes remain unchanged", () => {
  const input = [demand(processRow, "process_water", "p", "2", "4"), demand(processRow, "lemon_juice", "p", "0", "7"), demand(waterRow, "water", "w", "0", "7"), demand(waterRow, "potato", "w", "2", "4")];
  const before = clone(input), sourceBefore = sha(source), result = partition(input);
  assert.deepEqual(result.foodDemands, [input[1], input[3]]);
  assert.deepEqual(result.utilityUsage, [input[0], input[2]]);
  assert.deepEqual(input, before);
  assert.equal(sha(source), sourceBefore);
  assert.equal(result.basisSha256, independentHash(["wd-tap-water-partition-v1", configuration.sourcePin.sha256, independentHash(configuration), input, [input[1], input[3]], [input[0], input[2]]]));
  const actual = [...result.foodDemands, ...result.utilityUsage].map(item => JSON.stringify(item)).sort();
  assert.deepEqual(actual, input.map(item => JSON.stringify(item)).sort());
  assert.equal(result.utilityUsage[0]!.amount.denominator, "4");
  assert.equal(result.utilityUsage[1]!.amount.denominator, "7");
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.utilityUsage) && Object.isFrozen(result.utilityUsage[0]!.amount));
  (input[0]! as { amount: ConsumedDemand["amount"] }).amount = { numerator: "99", denominator: "1" };
  assert.equal(result.utilityUsage[0]!.amount.numerator, "2");
});

test("empty and ordinary-food-only input retains exact trace", () => {
  assert.deepEqual(partition([]).utilityUsage, []);
  const food = [demand(processRow, "lemon_juice", "a"), demand(waterRow, "oil", "b")];
  assert.deepEqual(partition(food).foodDemands, food);
  assert.deepEqual(partition(food).utilityUsage, []);
});

test("lexical equivalent amounts and order have independently different hashes", () => {
  const original = [demand(processRow, "process_water", "a"), demand(processRow, "lemon_juice", "a", "0", "7")];
  const reduced = clone(original); (reduced[0]! as { amount: ConsumedDemand["amount"] }).amount = { numerator: "1", denominator: "2" };
  const zeroReduced = clone(original); (zeroReduced[1]! as { amount: ConsumedDemand["amount"] }).amount = { numerator: "0", denominator: "1" };
  assert.notEqual(partition(original).basisSha256, partition(reduced).basisSha256);
  assert.notEqual(partition(original).basisSha256, partition(zeroReduced).basisSha256);
  assert.notEqual(partition(original).basisSha256, partition([...original].reverse()).basisSha256);
  assert.equal(partition(original).basisSha256, partition(clone(original)).basisSha256);
});

test("original5000-row boundary and120-digit input components are preserved", () => {
  const many = Array.from({ length: 5000 }, (_, i) => demand(processRow, "process_water", "row" + i, "0", "7"));
  assert.equal(partition(many).utilityUsage.length, 5000);
  assert.deepEqual(classifier.partition([...many, demand(processRow, "process_water", "extra")]), invalid);
  const large = "9".repeat(120);
  assert.equal(partition([demand(processRow, "process_water", "n", large, "1")]).utilityUsage[0]!.amount.numerator, large);
  assert.equal(partition([demand(processRow, "process_water", "d", "1", large)]).utilityUsage[0]!.amount.denominator, large);
  assert.deepEqual(classifier.partition([demand(processRow, "process_water", "n", "9".repeat(121))]), invalid);
  assert.deepEqual(classifier.partition([demand(processRow, "process_water", "d", "1", "9".repeat(121))]), invalid);
});

test("independent240-digit aggregate boundary succeeds and overflow preserves exact hold", () => {
  const power = BigInt(10) ** BigInt(120), numerator = BigInt(10) ** BigInt(119);
  const fractions = [{ n: numerator, d: power - BigInt(1) }, { n: numerator, d: power - BigInt(3) }, { n: numerator, d: power - BigInt(7) }];
  function gcd(a: bigint, b: bigint): bigint { while (b) [a, b] = [b, a % b]; return a; }
  let n = BigInt(0), d = BigInt(1);
  const lengths = fractions.map(f => { n = n * f.d + f.n * d; d *= f.d; const g = gcd(n, d); n /= g; d /= g; return [String(n).length, String(d).length]; });
  assert.deepEqual(lengths[1], [240, 240]);
  assert.ok(lengths[2]![0]! > 240 && lengths[2]![1]! > 240);
  const input = fractions.map((f, i) => demand(processRow, "process_water", "q" + i, String(f.n), String(f.d)));
  assert.equal(partition(input.slice(0, 2)).utilityUsage.length, 2);
  assert.deepEqual(aggregateRequirements(input), { outcome: "held", code: "quantity_capacity_exceeded" });
  assert.deepEqual(classifier.partition(input), { outcome: "held", code: "quantity_capacity_exceeded" });
});

test("duplicate and source conflicts are validated across full input before utility exclusion", () => {
  const water = demand(processRow, "process_water", "a");
  assert.deepEqual(classifier.partition([water, clone(water)]), invalid);
  assert.deepEqual(classifier.partition([water, demand(waterRow, "potato", "a")]), invalid);
  const conflict = { ...demand(processRow, "lemon_juice", "other"), recipeSha256: "a".repeat(64) };
  assert.deepEqual(classifier.partition([water, conflict]), invalid);
  assert.deepEqual(classifier.partition([water, { ...demand(waterRow, "potato", "b"), extra: true }]), invalid);
});

test("foreign recipe/hash/ingredient/state/unit cannot acquire a utility exemption", () => {
  const valid = demand(processRow, "process_water", "a");
  for (const changed of [{ recipeId: "foreign" }, { recipeSha256: "a".repeat(64) }, { ingredientId: "bottled_water" }, { preparedState: "mineral" }, { baseUnit: "g" }, { baseUnit: "each" }]) {
    assert.deepEqual(classifier.partition([{ ...valid, ...changed }]), "recipeSha256" in changed ? invalid : mismatch);
  }
  assert.deepEqual(classifier.partition([{ ...valid, policy: configuration.policy }]), invalid);
});

test("source-valid tuna in water and other liquids are ordinary food, not substring matches", () => {
  const ordinary: ConsumedDemand[] = [];
  const categories = new Set<string>();
  for (const row of rows) for (const i of row.recipe.ingredients) {
    const text = (i.id + " " + i.name + " " + i.state).toLowerCase();
    const category = /tuna/.test(text) && /water/.test(text) ? "tuna in water" : /broth|stock/.test(text) ? "broth" : /milk/.test(text) ? "milk" : /oil/.test(text) ? "oil" : /juice/.test(text) ? "juice" : null;
    if (category && !categories.has(category)) { categories.add(category); ordinary.push(demand(row, i.id, "ordinary" + ordinary.length)); }
  }
  assert.ok(categories.has("tuna in water") && categories.has("milk") && categories.has("oil") && categories.has("juice"));
  const result = partition(ordinary);
  assert.deepEqual(result.foodDemands, ordinary);
  assert.deepEqual(result.utilityUsage, []);
  for (const name of ["tuna in water", "broth", "milk", "oil", "juice", "bottled water", "mineral water", "unknown water"]) {
    const config = clone(configuration); config.reviewedForms[0].exactForm.name = name;
    assert.deepEqual(createTapCookingWaterClassifier(source, config), review);
  }
});

test("own-data guards reject getters,toJSON,sparse/prototype/symbol/extra-key input without invocation", () => {
  let calls = 0;
  const getter = clone(demand(processRow, "process_water", "a"));
  Object.defineProperty(getter, "amount", { enumerable: true, get() { calls++; throw Error("must not run"); } });
  const sparse = new Array(1);
  const arrayExtra = [demand(processRow, "process_water", "a")]; Object.defineProperty(arrayExtra, "extra", { value: 1, enumerable: true });
  const symbol = clone(demand(processRow, "process_water", "a")); Object.defineProperty(symbol, Symbol("bad"), { value: 1, enumerable: true });
  const object = clone(demand(processRow, "process_water", "a")); Object.setPrototypeOf(object, { extra: 1 });
  for (const value of [[getter], sparse, arrayExtra, [symbol], [object], [{ ...demand(processRow, "process_water", "a"), toJSON() { calls++; return {}; } }]]) assert.deepEqual(classifier.partition(value), invalid);
  for (const amount of [{ numerator: "01", denominator: "1" }, { numerator: "-1", denominator: "1" }, { numerator: "1", denominator: "0" }, { numerator: 1, denominator: "1" }]) assert.deepEqual(classifier.partition([{ ...demand(processRow, "process_water", "a"), amount }]), invalid);
  assert.equal(calls, 0);
});

test("configuration review/source proof,calendar and factory ingress fail closed", () => {
  assert.deepEqual(createTapCookingWaterClassifier(source, undefined), { outcome: "error", code: "invalid_tap_water_configuration" });
  assert.deepEqual(createTapCookingWaterClassifier(Buffer.concat([source, Buffer.from(" ")]), configuration), mismatch);
  const wrongPin = clone(configuration); wrongPin.sourcePin.sha256 = "a".repeat(64);
  assert.deepEqual(createTapCookingWaterClassifier(source, wrongPin), mismatch);
  for (const mutate of [
    (c: typeof configuration) => { c.matchDataSha256 = "a".repeat(64); },
    (c: typeof configuration) => { c.recordDataSha256 = "a".repeat(64); },
    (c: typeof configuration) => { c.reviewedForms[0].selectedRecordIds = [123]; },
    (c: typeof configuration) => { c.reviewedForms[0].foodRowSha256 = "a".repeat(64); },
    (c: typeof configuration) => { c.reviewedForms[0].reviewedOn = "2026-02-30"; },
    (c: typeof configuration) => { c.reviewedForms[1] = clone(c.reviewedForms[0]); },
    (c: typeof configuration) => { c.reviewedForms = []; },
  ]) { const changed = clone(configuration); mutate(changed); assert.deepEqual(createTapCookingWaterClassifier(source, changed), review); }
  let calls = 0; const accessor = clone(configuration);
  Object.defineProperty(accessor, "policy", { enumerable: true, get() { calls++; return configuration.policy; } });
  assert.deepEqual(createTapCookingWaterClassifier(source, accessor), { outcome: "error", code: "invalid_tap_water_configuration" });
  assert.equal(calls, 0);
});

test("configuration/source mutation is isolated and review identity changes the basis", () => {
  const config = clone(configuration), bytes = Buffer.from(source), bound = ready(config, bytes);
  const input = [demand(processRow, "process_water", "a")], before = bound.partition(input);
  config.reviewedForms[0].reviewedOn = "2026-10-21"; config.reviewedForms[0].exactForm.state = "changed"; bytes.fill(0);
  assert.deepEqual(bound.partition(input), before);
  const changed = clone(configuration); changed.reviewedForms[0].reviewedOn = "2026-10-21";
  const result = ready(changed).partition(input);
  assert.equal(result.outcome, "partitioned");
  if (result.outcome !== "partitioned" || before.outcome !== "partitioned") throw Error("Expected partitioned");
  assert.notEqual(result.basisSha256, before.basisSha256);
  assert.deepEqual(result.foodDemands, before.foodDemands);
});

test("generated mixed inputs preserve full lexical multiset and independent deterministic hashes", () => {
  for (let seed = 0; seed < 80; seed++) {
    const input = Array.from({ length: 1 + seed % 19 }, (_, i) => {
      const isWater = (seed + i) % 2 === 0;
      return demand(isWater ? processRow : waterRow, isWater ? "process_water" : "potato", "s" + seed + "a" + i, String(i % 3), String(2 + seed % 7));
    });
    const result = partition(input), foods = input.filter(item => item.ingredientId === "potato"), utilities = input.filter(item => item.ingredientId === "process_water");
    assert.deepEqual(result.foodDemands, foods); assert.deepEqual(result.utilityUsage, utilities);
    assert.equal(result.basisSha256, independentHash(["wd-tap-water-partition-v1", configuration.sourcePin.sha256, independentHash(configuration), input, foods, utilities]));
  }
});

// Execute unchanged canonical positional vectors, not the argument array as demands.
for (const vector of evidence.cases.filter((c: { api: string }) => c.api === "partition")) {
  test("canonical water vector: " + vector.id, () => {
    const binding = createTapCookingWaterClassifier(source, vector.binding.configuration);
    const actual = binding.outcome === "ready" ? binding.partition(...vector.input as [unknown]) : binding;
    assert.deepEqual(actual, vector.expected);
  });
}

test("explicit reviewed12pack retains parent/raw-row seals and exact water semantics without opening original factory", () => {
  const base = "C:/Users/borgh/Projects/wisedinner-app/assets/runtime/", pack = readFileSync(base + "reviewed-starter-v1.jsonl"), derivation = JSON.parse(readFileSync(base + "reviewed-starter-v1.manifest.json", "utf8"));
  const original = JSON.parse(readFileSync("C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/apple-preorder-build-20261023/REVIEWED-TAP-WATER-CONFIGURATION-20261023.json", "utf8"));
  const config = { ...original, sourcePin: derivation.derivedSourcePin, derivation };
  assert.deepEqual(createTapCookingWaterClassifier(pack, { ...original, sourcePin: derivation.derivedSourcePin }), { outcome: "held", code: "tap_water_source_mismatch" });
  const binding = createReviewedDerivedTapCookingWaterClassifier(pack, config); assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") return;
  const derivedRows = pack.toString("utf8").trimEnd().split("\n").map(line => JSON.parse(line)), row = derivedRows.find(row => row.recipe.ingredients.some((i: { id: string }) => i.id === "process_water")); assert.ok(row);
  const water = row.recipe.ingredients.find((i: { id: string }) => i.id === "process_water"), food = row.recipe.ingredients.find((i: { id: string }) => i.id !== "process_water");
  const demand = (i: typeof water): ConsumedDemand => ({ assignmentId: "derived-actual", recipeId: row.id, recipeSha256: row.recipe_sha256, ingredientId: i.id, preparedState: i.state, baseUnit: i.unit, amount: { numerator: "2", denominator: "4" } });
  const input = [demand(water), demand(food)], result = binding.partition(input); assert.equal(result.outcome, "partitioned"); if (result.outcome !== "partitioned") return;
  assert.deepEqual(result.utilityUsage, [input[0]]); assert.deepEqual(result.foodDemands, [input[1]]); assert.equal(result.utilityUsage[0]!.amount.numerator, "2");
  assert.equal(result.basisSha256, independentHash(["wd-tap-water-partition-v1", derivation.derivedSourcePin.sha256, independentHash(config), input, [input[1]], [input[0]]]));
  assert.deepEqual(binding.partition([{ ...input[0]!, recipeSha256: "a".repeat(64) }]), { outcome: "error", code: "invalid_tap_water_demands" });
  assert.deepEqual(binding.partition([{ ...input[1]!, ingredientId: "water" }]), { outcome: "held", code: "tap_water_source_mismatch" });
  for (const mutate of [(v: typeof config) => { v.derivation.parentSourcePin.sha256 = "a".repeat(64); }, (v: typeof config) => { v.derivation.rows[0].originalRowSha256 = "a".repeat(64); }, (v: typeof config) => { v.derivation.rows[0].recipeSha256 = "a".repeat(64); }]) { const changed = clone(config); mutate(changed); assert.notEqual(createReviewedDerivedTapCookingWaterClassifier(pack, changed).outcome, "ready"); }
  assert.notEqual(createReviewedDerivedTapCookingWaterClassifier(Buffer.concat([pack, Buffer.from(" ")]), config).outcome, "ready");
});

