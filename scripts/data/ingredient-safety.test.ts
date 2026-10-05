import assert from "node:assert/strict";
import { test } from "node:test";
import { SKUS } from "./authored/skus.ts";
import { SAFETY, ingredientAllowed, eligibleSnapshot, type SafetyTable } from "./ingredient-safety.ts";
import { solveRestricted, restrictedCandidates } from "./catalog-selection.ts";
import { solve } from "../../packages/solver/src/engine.ts";
import { BASE } from "../../packages/solver/src/profiles.ts";
import { miniSnapshot, loadSnapshot } from "../../packages/solver/test/helpers.ts";

test("every catalog and compiled ingredient ID has explicit safety status, never an empty default", () => {
  assert.deepEqual(Object.keys(SAFETY), SKUS.map(s => s.id));
  for (const row of loadSnapshot().recipe_ingredients) assert.ok(SAFETY[row.sku_id], row.sku_id);
  assert.deepEqual(SAFETY.lentils.allergens, []);
  assert.equal(SAFETY.salsa.allergens, null);
  for (const id of ["salsa", "taco-seasoning", "caesar-dressing", "pea-protein", "plant-yogurt", "soy-sauce"]) assert.equal(SAFETY[id].status, "unreviewed", id);
});
test("unknown metadata fails every restriction but preserves unrestricted users", () => {
  for (const diet of ["vegan", "vegetarian", "gluten-free", "dairy-free"] as const) {
    assert.equal(ingredientAllowed("missing", diet, []), false);
    assert.equal(ingredientAllowed("salsa", diet, []), false);
  }
  assert.equal(ingredientAllowed("missing", "none", ["soy"]), false);
  assert.equal(ingredientAllowed("lentils", "none", ["soy"]), true);
  assert.equal(ingredientAllowed("frozen-edamame", "none", ["soy"]), false);
  assert.equal(ingredientAllowed("missing", "none", []), true);
  assert.throws(() => ingredientAllowed("lentils", "none", ["unknown"]), /Unknown allergen/);
});

// Synthetic arithmetic fixture, not original-source approval. Unknown added ingredients must never survive.
const fixture = miniSnapshot();
const table: SafetyTable = Object.fromEntries(fixture.skus.map(k => [k.id, { ...SAFETY.lentils, sku_id: k.id }]));
const input = { ...BASE, budget: 100, protein_per_day: 50, kcal_min: 100, kcal_max: 5000, stores: ["a"], seed: 7 };

test("full compiled variant additions and compound sauces are excluded before selection", () => {
  const snapshot = structuredClone(fixture);
  const base = snapshot.recipes.find(r => r.id === "tofu-rice")!;
  snapshot.recipes.push({ ...base, id: "tofu-rice-sauce" });
  snapshot.recipe_ingredients.push(...snapshot.recipe_ingredients.filter(i => i.recipe_id === base.id).map(i => ({ ...i, recipe_id: "tofu-rice-sauce" })), { recipe_id: "tofu-rice-sauce", sku_id: "salsa", qty: 20, unit: "g" });
  snapshot.recipe_variants.push({ recipe_id: base.id, variant_recipe_id: "tofu-rice-sauce", kind: "veg_swap" });
  const selected = eligibleSnapshot(snapshot, "none", ["soy"], table);
  assert.ok(selected.recipes.some(r => r.id === base.id));
  assert.ok(!selected.recipes.some(r => r.id === "tofu-rice-sauce"));
  const unknownBase = { ...table, tofu: { ...table.tofu, status: "unreviewed" as const, allergens: null, diet: null } };
  assert.ok(!eligibleSnapshot(snapshot, "none", ["soy"], unknownBase).recipes.some(r => r.id === base.id));
});

test("actual restricted solve and swap selection cannot pick unknown ingredients", () => {
  const unknown = { ...table, tofu: { ...table.tofu, status: "unreviewed" as const, allergens: null, diet: null } };
  const out = solveRestricted(input, fixture, ["soy"], unknown);
  assert.ok(out.days.flatMap(d => d.items).every(i => i.recipe_id !== "tofu-rice"));
  for (const candidate of restrictedCandidates(out, 1, fixture, ["soy"], unknown)) assert.notEqual(candidate.recipe_id, "tofu-rice");
  const unsafeWeek = { ...out, days: out.days.map((d, n) => n ? d : { ...d, items: d.items.map((i, slot) => slot === 1 ? { ...i, recipe_id: "tofu-rice" } : i) }) };
  assert.throws(() => restrictedCandidates(unsafeWeek, 1, fixture, ["soy"], unknown), /not in the pool/);
});

test("old unrestricted solve is identical; empty restricted breakfast fails clearly", () => {
  assert.equal(eligibleSnapshot(fixture, "none", []), fixture);
  assert.deepEqual(solveRestricted(input, fixture, []), solve(input, fixture));
  assert.throws(() => solveRestricted(input, fixture, ["soy"], {}), /Not enough reviewed recipes/);
});
