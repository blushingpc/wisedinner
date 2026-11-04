// Finite local acceptance over an explicitly pinned generated-meal catalog.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { loadGeneratedMealPlanner } from "../../lib/generated-meal-planner.ts";
import { GENERATED_REGIONS, type GeneratedCatalog, type GeneratedPlanRequest } from "../../packages/solver/src/generated-meals.ts";

const args = process.argv.slice(2);
function argument(name: string) { const at = args.indexOf(name); const value = at < 0 ? undefined : args[at + 1]; if (!value || value.startsWith("--")) throw new Error(`Required ${name}`); return value; }
const file = resolve(argument("--catalog")), sha = argument("--sha256"), originalPath = resolve(argument("--original")), output = resolve(argument("--output"));
const originalSha = "08b97f7a9b5e59427420aabf1753eabae2a76ae864d440fca50896857a6588fa";
const hash = (raw: string | Buffer) => createHash("sha256").update(raw).digest("hex");
const raw = readFileSync(file), originalBytes = readFileSync(originalPath);
assert.equal(hash(raw), sha); assert.equal(hash(originalBytes), originalSha);
const catalog = JSON.parse(raw.toString("utf8")) as GeneratedCatalog;
const originals = new Map(originalBytes.toString("utf8").trim().split("\n").map(line => { const recipe = JSON.parse(line); return [recipe.id, recipe]; }));
assert.equal(originals.size, 1000); assert.equal(catalog.meals.length, 1000);
for (const meal of catalog.meals) assert.deepEqual(meal.originalRecipe, originals.get(meal.id));
const planner = loadGeneratedMealPlanner(file, sha);
const equipment = [...new Set(catalog.meals.flatMap(m => m.originalRecipe.equipment))].sort();
mkdirSync(output, { recursive: false });
const results = [], replacementChecks = [], failures = [];
let replacementCount = 0;
for (const region of GENERATED_REGIONS) for (const household of [1, 2]) for (const mealsPerDay of [1, 2] as const) for (const seed of [0, 7]) {
  const request: GeneratedPlanRequest = { region, days: 7, household, mealsPerDay, proteinTargetsG: Array.from({ length: household }, () => mealsPerDay === 1 ? "35" : "70"), budgetCents: household * (mealsPerDay === 1 ? 6000 : 12000), equipment, seed };
  const result = planner.plan(request);
  assert.equal(result.status, "planned-reference-week"); assert.ok(result.week?.referenceConstraintsSatisfied);
  const week = result.week!;
  assert.deepEqual(week, planner.evaluate(week.selection, request));
  assert.deepEqual(result, planner.plan(request));
  assert.equal(week.days.length, 7); assert.equal(week.wholePackCheckoutCost, null); assert.equal(week.productAccepted, false);
  for (const day of week.days) for (const meal of day.meals) assert.deepEqual(meal.originalRecipe, originals.get(meal.id));
  const selected = [...week.selection].map(day => [...day]);
  const candidates = planner.replacements(week, 3, mealsPerDay - 1, 3);
  assert.equal(candidates.length, 3);
  for (const candidate of candidates) {
    assert.ok(candidate.week.referenceConstraintsSatisfied);
    assert.deepEqual(candidate.week, planner.evaluate(candidate.week.selection, request));
    for (let day = 0; day < 7; day++) for (let slot = 0; slot < mealsPerDay; slot++) if (day !== 3 || slot !== mealsPerDay - 1) assert.equal(candidate.week.selection[day]![slot], selected[day]![slot]);
    assert.ok(candidate.week.flags.length); replacementCount++;
  }
  results.push({ request, result });
  replacementChecks.push({ request, originalSelection: selected, replacements: candidates.map(c => ({ id: c.id, week: c.week })) });
}
const standard: GeneratedPlanRequest = { region: "South", days: 7, household: 1, mealsPerDay: 1, proteinTargetsG: ["35"], budgetCents: 6000, equipment, seed: 0 };
for (const request of [{ ...standard, equipment: [] }, { ...standard, proteinTargetsG: ["999"] }, { ...standard, budgetCents: 1 }]) {
  const result = planner.plan(request); assert.notEqual(result.status, "planned-reference-week"); failures.push({ request, result });
}
const narrowed = planner.plan({ ...standard, equipment: equipment.filter(x => !/oven|baking|sheet|grater/i.test(x)), excludedAllergenHints: ["soy"] });
assert.equal(narrowed.status, "planned-reference-week");
assert.ok(narrowed.week!.days.flatMap(d => d.meals).every(m => !m.originalRecipe.allergen_hints.includes("soy") && !m.originalRecipe.equipment.some(e => /oven|baking|sheet|grater/i.test(e))));
results.push({ request: narrowed.week!.request, result: narrowed });
const outputs: Record<string, string> = {};
for (const [name, document] of [["weeks.json", results], ["replacements.json", replacementChecks], ["infeasible-controls.json", failures]] as const) {
  const text = JSON.stringify(document) + "\n"; writeFileSync(join(output, name), text, { flag: "wx" }); outputs[name] = hash(text);
}
assert.equal(hash(readFileSync(file)), sha); assert.equal(hash(readFileSync(originalPath)), originalSha);
const receipt = { schema: "wd-generated-planner-acceptance-v1", finishedAt: new Date().toISOString(), catalog: { path: file, sha256: sha }, originalRecipes: { path: originalPath, sha256: originalSha },
  counts: { sourceRecipes: 1000, fullWeeks: results.length, fullWeekReplacements: replacementCount, infeasibleControls: failures.length }, outputs, sourceRecipesModified: false, productPublished: false, paidRequests: 0 };
writeFileSync(join(output, "receipt.json"), JSON.stringify(receipt, null, 2) + "\n", { flag: "wx" });
console.log(JSON.stringify({ output, counts: receipt.counts, receiptSha256: hash(readFileSync(join(output, "receipt.json"))) }));
