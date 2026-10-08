import assert from "node:assert/strict";
import { test } from "node:test";
import { RECIPES } from "./authored/recipes.ts";
import { expandRecipes } from "./expand.ts";
import { EQUIPMENT, PREPARATION_VERSION, preparationCoverage, resolvePreparation } from "./authored/preparation.ts";

const id = "egg-white-and-veggie-scramble-with-toast";
const source = () => structuredClone(expandRecipes(RECIPES));
test("base and potato instructions consume both declared whole eggs, preserve quantities and use doneness rather than time", () => {
  const actual = source();
  for (const recipeId of [id, id + "-potatoes"]) {
    const recipe = actual.recipes.find(row => row.id === recipeId)!;
    assert.match(recipe.steps.join(" "), /whisk.*two eggs.*egg whites/i);
    assert.match(recipe.steps.join(" "), /firm.*160 F.*stricter package/i);
    assert.equal(actual.ingredients.find(row => row.recipe_id === recipeId && row.sku_id === "eggs")!.qty, 2);
  }
});
test("every existing base and variant materializes independently; coverage holds all unauthored equipment records by exact ID", () => {
  const actual = source(), coverage = preparationCoverage();
  assert.equal(actual.recipes.length, RECIPES.length + RECIPES.reduce((sum, base) => sum + base.variants.length, 0));
  assert.deepEqual(coverage.map(row => row.id), actual.recipes.map(row => row.id));
  assert.equal(coverage.filter(row => row.state === "authored-local").length, 81);
  for (const entry of coverage) {
    const result = resolvePreparation(actual, entry.id, EQUIPMENT);
    assert.equal(result.state === "authored-local", entry.state === "authored-local", entry.id);
  }
  for (const base of RECIPES) for (const variant of base.variants) {
    assert.notEqual(actual.recipes.find(row => row.id === variant.id)!.steps, base.steps, variant.id);
  }
});
test("four authored methods account for exact full ingredient rows and have variant-specific protein treatment", () => {
  const actual = source();
  for (const recipeId of [id, id + "-eggs", id + "-tofu", id + "-potatoes"]) {
    const before = JSON.stringify(actual);
    const result = resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, recipeId.endsWith("-potatoes") ? "boiled-potatoes" : "pan-toast");
    assert.equal(result.state, "authored-local");
    if (result.state !== "authored-local") throw Error("missing authoring");
    assert.deepEqual(result.ingredients, actual.ingredients.filter(row => row.recipe_id === recipeId).map(row => [row.sku_id, row.qty, row.unit]));
    assert.match(result.method.steps.join(" "), /measured oil/);
    assert.match(result.method.steps.join(" "), /peppers and onions/);
    assert.match(result.method.steps.join(" "), recipeId.endsWith("-tofu") ? /tofu/ : recipeId.endsWith("-eggs") ? /four eggs/ : /two eggs.*egg whites/);
    assert.doesNotMatch(result.method.steps.join(" "), recipeId.endsWith("-tofu") ? /egg whites|four eggs|160 F/ : /tofu/);
    assert.match(result.method.steps.join(" "), recipeId.endsWith("-potatoes") ? /potatoes.*water.*drain/ : /bread.*dry nonstick pan/);
    assert.equal(JSON.stringify(actual), before);
  }
});
test("equipment subset chooses authored pan alternative without assuming toaster, oven, microwave or air fryer", () => {
  const owned = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer"];
  const result = resolvePreparation(source(), id, owned);
  assert.equal(result.state, "authored-local");
  if (result.state !== "authored-local") throw Error("missing alternative");
  assert.equal(result.method.id, "pan-toast");
  assert.ok(result.method.equipment.every(item => owned.includes(item)));
  assert.equal(resolvePreparation(source(), id, owned.filter(item => item !== "food-thermometer")).state, "held");
  assert.equal(resolvePreparation(source(), id, owned, PREPARATION_VERSION, "authored-primary").state, "held");
});
test("potato microwave and saucepan alternatives have their own honest steps and required tools", () => {
  const result = resolvePreparation(source(), id + "-potatoes", EQUIPMENT, PREPARATION_VERSION, "boiled-potatoes");
  assert.equal(result.state, "authored-local");
  if (result.state !== "authored-local") throw Error("missing alternative");
  assert.doesNotMatch(result.method.steps.join(" "), /microwave/);
  assert.ok(result.method.equipment.includes("saucepan"));
  assert.equal(result.timing.alternativeMinutes, null);
  assert.equal(result.timing.measured, false);
  const primary = resolvePreparation(source(), id + "-potatoes", EQUIPMENT);
  assert.equal(primary.state, "authored-local");
  if (primary.state === "authored-local") assert.match(primary.method.steps.join(" "), /microwave-safe.*fork/i);
});
test("unknown, sparse, duplicate, accessor and missing equipment refuse without invoking getters", () => {
  let reads = 0;
  const accessor: string[] = [];
  Object.defineProperty(accessor, "0", { get() { reads++; return "stovetop"; } });
  for (const owned of [null, [], ["air-fryer"], ["stovetop", "stovetop"], new Array<string>(2), accessor]) {
    assert.equal(resolvePreparation(source(), id, owned).state, "held");
  }
  assert.equal(reads, 0);
  assert.equal(resolvePreparation(source(), "unknown", EQUIPMENT).state, "held");
  assert.equal(resolvePreparation(source(), id, EQUIPMENT, PREPARATION_VERSION, "oven-guessed").state, "held");
});
test("stale version and changed or late materialization refuse; successful result copies cannot alter subsequent reads", () => {
  assert.equal(resolvePreparation(source(), id, EQUIPMENT, "old-version").state, "held");
  const mutations = [
    (s: ReturnType<typeof source>) => { s.ingredients.find(row => row.recipe_id === id)!.qty++; },
    (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === id)!.steps[0] = "Add unlisted sauce."; },
    (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === id)!.minutes++; },
    (s: ReturnType<typeof source>) => { s.recipes.push(structuredClone(s.recipes.find(row => row.id === id)!)); },
  ];
  for (const mutate of mutations) { const changed = source(); mutate(changed); assert.equal(resolvePreparation(changed, id, EQUIPMENT).state, "held"); }
  const earlier = resolvePreparation(source(), id, EQUIPMENT);
  if (earlier.state !== "authored-local") throw Error("normal result missing");
  earlier.ingredients[0][1] = 999;
  earlier.method.steps[0] = "Unknown method";
  const later = resolvePreparation(source(), id, EQUIPMENT);
  if (later.state !== "authored-local") throw Error("later normal result missing");
  assert.equal(later.ingredients[0][1], 8);
  assert.notEqual(later.method.steps[0], "Unknown method");
});
test("optional seasoning omission keeps complete instructions and cannot certify extras, diet safety, price or nutrients", () => {
  const actual = source(), before = JSON.stringify(actual);
  const result = resolvePreparation(actual, id + "-tofu", EQUIPMENT);
  assert.equal(result.state, "authored-local");
  if (result.state !== "authored-local") throw Error("missing result");
  assert.equal(result.seasoning.prompt, "Seasoning of your choice");
  assert.equal(result.seasoning.recommended, "Black pepper");
  assert.equal(result.seasoning.optional, true);
  assert.equal(result.seasoning.includedInQuotedTotal, false);
  assert.equal(result.seasoning.includedInNutrients, false);
  assert.equal(result.seasoning.allergenStatus, "unknown");
  assert.equal(result.restrictionAdmission, false);
  assert.equal(result.crossLaneAccepted, false);
  assert.equal(result.safety.allergySafe, false);
  assert.equal(result.safety.kitchenVerified, false);
  assert.equal(result.safety.timeAloneProvesDoneness, false);
  assert.doesNotMatch(result.method.steps.join(" "), /\b(?:pepper|salt|sauce|seasoning)\b/);
  assert.equal(JSON.stringify(actual), before);
  assert.equal("totalCents" in result, false);
  assert.equal("protein" in result, false);
});

const families = ["greek-yogurt-parfait-with-berries-and-granola", "protein-oatmeal-with-peanut-butter-and-banana", "protein-pancakes-with-berries", "egg-and-avocado-breakfast-wrap", "cottage-cheese-bowl-with-fruit-and-honey", "chicken-caesar-wrap"];
const batchIds = RECIPES.filter(recipe => families.includes(recipe.id)).flatMap(recipe => [recipe.id, ...recipe.variants.map(variant => variant.id)]);
test("six-family batch resolves all18 exact existing row sets with independent overrides and leaves remaining families held", () => {
  const actual = source(), before = JSON.stringify(actual);
  assert.equal(batchIds.length, 18);
  for (const recipeId of batchIds) {
    const result = resolvePreparation(actual, recipeId, EQUIPMENT);
    assert.equal(result.state, "authored-local", recipeId);
    if (result.state !== "authored-local") throw Error("missing batch method");
    assert.deepEqual(result.ingredients, actual.ingredients.filter(row => row.recipe_id === recipeId).map(row => [row.sku_id, row.qty, row.unit]));
    assert.notEqual(result.method.id, "authored-primary");
    assert.notDeepEqual(result.method.steps, actual.recipes.find(row => row.id === recipeId)!.steps);
    assert.equal(result.crossLaneAccepted, false);
    assert.equal(result.restrictionAdmission, false);
    assert.equal(result.timing.measured, false);
    assert.equal(result.timing.declaredMinutesAppliesToMethod, false);
    assert.equal(result.timing.methodMinutes, null);
    assert.equal(resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, "authored-primary").state, "held");
    assert.equal(resolvePreparation(actual, recipeId, null).state, "held");
    assert.equal(resolvePreparation(actual, recipeId, []).state, "held");
    for (const tool of result.method.equipment) {
      assert.equal(resolvePreparation(actual, recipeId, result.method.equipment.filter(item => item !== tool), PREPARATION_VERSION, result.method.id).state, "held", recipeId + " needs " + tool);
    }
  }
  assert.equal(preparationCoverage().filter(row => row.state === "held-unprepared").length, 2);
  for (const row of preparationCoverage().filter(row => row.state === "held-unprepared")) assert.equal(resolvePreparation(actual, row.id, EQUIPMENT).state, "held", row.id);
  assert.equal(JSON.stringify(actual), before);
});
test("grain, protein and fruit variants account for dry quantities and edible banana without a cooked-weight shortcut", () => {
  const checks: [string, RegExp[]][] = [
    [families[0], [/15 g whey/, /8 oz Greek yogurt/, /1\.5 oz.*granola/, /3 oz frozen berries/]],
    [families[0] + "-plant", [/35 g pea/, /8 oz plant yogurt/, /1\.5 oz dry oats/, /Cook them.*package/, /3 oz frozen berries/]],
    [families[0] + "-oats", [/15 g whey/, /8 oz Greek yogurt/, /1\.5 oz dry oats/, /not a cooked-weight/]],
    [families[1], [/60 g dry oats/, /30 g whey/, /100 g edible/, /1 oz peanut butter/]],
    [families[1] + "-pea", [/60 g dry oats/, /30 g pea/, /100 g edible/, /1 oz peanut butter/]],
    [families[1] + "-quinoa", [/50 g dry quinoa/, /rinse/, /30 g whey/, /100 g edible/, /1 oz peanut butter/]],
    [families[4], [/11 oz.*cottage cheese/, /100 g edible/, /0\.5 oz honey/, /3 oz frozen berries/]],
    [families[4] + "-plant", [/30 g pea/, /8 oz plant yogurt/, /100 g edible/, /1 oz peanut butter/]],
    [families[4] + "-toast", [/2 oz bread/, /11 oz.*cottage cheese/, /0\.5 oz honey/, /3 oz frozen berries/]]
  ];
  for (const [recipeId, patterns] of checks) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    for (const pattern of patterns) assert.match(result.method.steps.join(" "), pattern, recipeId);
  }
});
test("pancake methods consume both eggs or banana replacement and do not demand unlisted oil/milk or time-only doneness", () => {
  for (const recipeId of [families[2], families[2] + "-oat", families[2] + "-vegan"]) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    const steps = result.method.steps.join(" ");
    assert.match(steps, /60 g dry/);
    assert.match(steps, /without added oil/);
    assert.match(steps, /raw batter/);
    if (recipeId.endsWith("-vegan")) {
      assert.match(steps, /100 g peeled edible banana/);
      assert.match(steps, /30 g pea/);
      assert.match(steps, /centers are fully set.*package cooking/);
      assert.equal(result.ingredients.some(row => row[0] === "eggs" || row[0] === "whey-protein"), false);
    } else {
      assert.match(steps, /both eggs/);
      assert.match(steps, /20 g whey/);
      assert.match(steps, /thermometer reads at least 160 F/);
    }
    if (recipeId !== families[2]) assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT.filter(tool => tool !== "blender")).state, "held");
  }
});
test("wraps preserve all eggs/whites or tofu, half avocado flesh, salsa and the exact tortilla choice", () => {
  for (const recipeId of [families[3], families[3] + "-tofu", families[3] + "-corn"]) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    const steps = result.method.steps.join(" ");
    assert.match(steps, /half.*(edible flesh|avocado)/);
    assert.match(steps, /1 oz salsa/);
    if (recipeId.endsWith("-tofu")) {
      assert.match(steps, /7 oz tofu.*cooked weight/);
      assert.match(steps, /tofu package/);
      assert.equal(result.ingredients.some(row => row[0] === "eggs" || row[0] === "egg-whites"), false);
    } else {
      assert.match(steps, /all three eggs with 5 oz egg whites/);
      assert.match(steps, /thermometer reads 160 F/);
    }
    assert.match(steps, recipeId.endsWith("-corn") ? /both corn tortillas/ : /one flour tortilla/);
  }
});
test("Caesar methods distinguish raw poultry, ready-to-eat deli and dry rice, preserving measured dressing and Parmesan", () => {
  for (const recipeId of [families[5], families[5] + "-turkey", families[5] + "-bowl"]) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    const steps = result.method.steps.join(" ");
    assert.match(steps, /half romaine/);
    assert.match(steps, /2 tbsp Caesar dressing and 0\.5 oz Parmesan/);
    if (recipeId.endsWith("-turkey")) {
      assert.match(steps, /6 oz packaged cooked ready-to-eat deli turkey/);
      assert.match(steps, /raw turkey is unsupported/);
      assert.equal(result.method.equipment.includes("raw-poultry-board"), false);
    } else {
      assert.match(steps, /6 oz raw chicken before cooking/);
      assert.match(steps, /Do not wash it/);
      assert.match(steps, /separate raw-poultry board/);
      assert.match(steps, /thermometer reads 165 F/);
      assert.match(steps, /clean utensils/i);
      assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT.filter(tool => tool !== "raw-poultry-board")).state, "held");
    }
    if (recipeId.endsWith("-bowl")) assert.match(steps, /60 g dry rice before cooking.*not replace it with 60 g cooked rice/);
  }
});
test("explicit berry/oat/toast alternatives work only with their actual owned tools; no unowned microwave or toaster is guessed", () => {
  const actual = source();
  const cases: [string, string][] = [[families[0], "microwave-berries"], [families[1], "microwave"], [families[1] + "-pea", "microwave"], [families[4], "microwave-berries"], [families[4] + "-plant", "microwave-berries"], [families[4] + "-toast", "toaster"]];
  for (const [recipeId, method] of cases) {
    const result = resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, method);
    if (result.state !== "authored-local") throw Error(recipeId);
    assert.equal(resolvePreparation(actual, recipeId, result.method.equipment, PREPARATION_VERSION, method).state, "authored-local");
    assert.equal(resolvePreparation(actual, recipeId, result.method.equipment.filter(tool => tool !== (method === "toaster" ? "toaster" : "microwave")), PREPARATION_VERSION, method).state, "held");
  }
  const toast = resolvePreparation(actual, families[4] + "-toast", EQUIPMENT.filter(tool => tool !== "toaster"));
  assert.equal(toast.state, "authored-local");
  if (toast.state === "authored-local") assert.equal(toast.method.id, "pan-toast");
});
test("every batch method keeps optional seasoning/package/allergy/price uncertainty and refuses changed rows or methods", () => {
  for (const recipeId of batchIds) {
    const actual = source(), before = JSON.stringify(actual), result = resolvePreparation(actual, recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    assert.equal(result.seasoning.optional, true);
    assert.equal(result.seasoning.prompt, "Seasoning of your choice");
    assert.equal(result.seasoning.recommended, recipeId.startsWith(families[3]) || recipeId.startsWith(families[5]) ? "Black pepper" : "Cinnamon");
    assert.equal(result.seasoning.allergenStatus, "unknown");
    assert.equal(result.seasoning.includedInQuotedTotal, false);
    assert.equal(result.seasoning.includedInNutrients, false);
    assert.equal(result.safety.allergySafe, false);
    assert.equal(result.safety.kitchenVerified, false);
    assert.equal(result.safety.stricterPackageDirectionsWin, true);
    assert.doesNotMatch(result.method.steps.join(" "), /\b(?:cinnamon|seasoning of your choice|black pepper)\b/i);
    assert.equal(JSON.stringify(actual), before);
    actual.ingredients.find(row => row.recipe_id === recipeId)!.qty += 1;
    assert.equal(resolvePreparation(actual, recipeId, EQUIPMENT).state, "held");
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT, PREPARATION_VERSION, "guessed-air-fryer").state, "held");
  }
});

const wrapsBowlFamilies = ["southwest-chicken-wrap", "chicken-burrito-bowl", "mediterranean-chicken-bowl-with-tzatziki"];
const wrapsBowlIds = RECIPES.filter(recipe => wrapsBowlFamilies.includes(recipe.id)).flatMap(recipe => [recipe.id, ...recipe.variants.map(variant => variant.id)]);
test("nine wrap/bowl overrides match actual rows without changing83 materialized fields or granting held-family admission", () => {
  const actual = source(), before = JSON.stringify(actual);
  assert.equal(wrapsBowlIds.length, 9);
  for (const recipeId of wrapsBowlIds) {
    const result = resolvePreparation(actual, recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    assert.deepEqual(result.ingredients, actual.ingredients.filter(row => row.recipe_id === recipeId).map(row => [row.sku_id, row.qty, row.unit]));
    assert.equal(result.crossLaneAccepted, false);
    assert.equal(result.restrictionAdmission, false);
    assert.equal(result.timing.declaredMinutesAppliesToMethod, false);
    assert.equal(result.timing.measured, false);
    assert.equal(result.timing.methodMinutes, null);
    assert.notEqual(result.method.id, "authored-primary");
    assert.notDeepEqual(result.method.steps, actual.recipes.find(row => row.id === recipeId)!.steps);
    assert.equal(resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, "authored-primary").state, "held");
    assert.equal(resolvePreparation(actual, recipeId, result.method.equipment).state, "authored-local");
    for (const tool of result.method.equipment) assert.equal(resolvePreparation(actual, recipeId, result.method.equipment.filter(item => item !== tool)).state, "held", recipeId + " needs " + tool);
  }
  assert.equal(preparationCoverage().filter(row => row.state === "authored-local").length, 81);
  const held = preparationCoverage().filter(row => row.state === "held-unprepared");
  assert.equal(held.length, 2);
  for (const row of held) assert.equal(resolvePreparation(actual, row.id, EQUIPMENT).state, "held", row.id);
  assert.equal(JSON.stringify(actual), before);
});
test("southwest and burrito methods preserve raw chicken/tofu, all measured beans/seasoning/salsa and edible half avocado", () => {
  for (const recipeId of wrapsBowlIds.filter(id => !id.startsWith(wrapsBowlFamilies[2]))) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    const steps = result.method.steps.join(" ");
    assert.match(steps, /3 oz canned black beans including any packing liquid/);
    assert.match(steps, /whole measured portion/);
    assert.match(steps, /all 5 g declared taco seasoning/);
    assert.match(steps, /without added oil/);
    assert.match(steps, /half.*edible flesh/);
    assert.match(steps, recipeId.startsWith(wrapsBowlFamilies[0]) ? /1 oz salsa/ : /2 oz salsa/);
    if (recipeId.endsWith("-tofu")) {
      assert.match(steps, /7 oz tofu before cooking.*cooked weight/);
      assert.match(steps, /tofu package cooking requirements/);
      assert.doesNotMatch(steps, /165 F|raw chicken before cooking/);
      assert.equal(result.method.equipment.includes("raw-poultry-board"), false);
    } else {
      assert.match(steps, recipeId.startsWith(wrapsBowlFamilies[0]) ? /6 oz raw chicken before cooking/ : /8 oz raw chicken before cooking/);
      assert.match(steps, /do not wash it/i);
      assert.match(steps, /separate raw-poultry board/);
      assert.match(steps, /wash hands and clean raw-contact utensils/);
      assert.match(steps, /thermometer reads 165 F throughout/);
      assert.match(steps, /clean utensils/i);
    }
  }
});
test("grain and tortilla swaps have exact quantities and actual equipment without rice/chicken method inheritance", () => {
  for (const recipeId of wrapsBowlIds) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    const steps = result.method.steps.join(" ");
    if (recipeId === "southwest-chicken-wrap-corn") assert.match(steps, /all three corn tortillas/);
    else if (recipeId.startsWith("southwest-") || recipeId.endsWith("-wrap")) {
      assert.match(steps, /one flour tortilla/);
      assert.equal(result.method.equipment.includes("saucepan-lid"), false);
      assert.equal(resolvePreparation(source(), recipeId, result.method.equipment.filter(tool => tool !== "nonstick-pan")).state, "held");
    } else {
      assert.equal(result.method.equipment.includes("saucepan-lid"), true);
      assert.equal(resolvePreparation(source(), recipeId, result.method.equipment.filter(tool => tool !== "saucepan-lid")).state, "held");
      if (recipeId === "chicken-burrito-bowl-quinoa") assert.match(steps, /50 g dry quinoa.*rinse.*fine strainer/);
      else if (recipeId.startsWith("mediterranean-")) assert.match(steps, /60 g dry quinoa.*rinse.*fine strainer/);
      else assert.match(steps, /60 g dry rice/);
    }
    assert.match(steps, /package/);
    assert.match(steps, /cooked weight|cooked-weight|cooked chicken weight|cooked rice|cooked quinoa/);
    assert.equal(resolvePreparation(source(), recipeId, ["microwave", "microwave-safe-bowl", "microwave-safe-cover"]).state, "held");
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT, PREPARATION_VERSION, "guessed-oven").state, "held");
  }
});
test("Mediterranean tofu/hummus and chicken/tzatziki methods use all oil, produce and sauces without package or allergy certification", () => {
  for (const recipeId of wrapsBowlIds.filter(id => id.startsWith(wrapsBowlFamilies[2]))) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    const steps = result.method.steps.join(" ");
    assert.match(steps, /quarter cucumber and 2 oz tomatoes/);
    assert.match(steps, /Wash the cucumber and tomatoes under running water/);
    assert.match(steps, /measured 1 tsp olive oil/);
    assert.match(steps, /measured pan oil/);
    assert.match(steps, /2 oz packaged ready-to-eat/);
    if (recipeId.endsWith("-tofu")) {
      assert.match(steps, /7 oz tofu before cooking/);
      assert.match(steps, /all the hummus/);
      assert.match(steps, /package cooking requirements/);
      assert.equal(result.ingredients.some(row => row[0] === "tzatziki" || row[0] === "chicken-breast"), false);
      assert.doesNotMatch(steps, /165 F/);
    } else {
      assert.match(steps, /6 oz raw chicken before cooking/);
      assert.match(steps, /all the tzatziki/);
      assert.match(steps, /thermometer reads 165 F throughout/);
      assert.match(steps, /stricter package directions win/i);
      assert.match(steps, /away from raw poultry/);
    }
    assert.equal(result.safety.kitchenVerified, false);
    assert.equal(result.safety.allergySafe, false);
  }
});
test("nine methods reject malformed equipment and stale/late row, step, time or duplicate materialization without getter effects", () => {
  let reads = 0;
  const accessor: string[] = [];
  Object.defineProperty(accessor, "0", { get() { reads++; return "stovetop"; } });
  for (const recipeId of wrapsBowlIds) {
    for (const equipment of [null, [], ["unknown-appliance"], ["stovetop", "stovetop"], new Array<string>(2), accessor]) assert.equal(resolvePreparation(source(), recipeId, equipment).state, "held");
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT, "stale-version").state, "held");
    const mutations = [
      (s: ReturnType<typeof source>) => { s.ingredients.find(row => row.recipe_id === recipeId)!.qty++; },
      (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === recipeId)!.steps.push("Add unlisted sauce."); },
      (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === recipeId)!.minutes++; },
      (s: ReturnType<typeof source>) => { s.recipes.push(structuredClone(s.recipes.find(row => row.id === recipeId)!)); }
    ];
    for (const mutate of mutations) { const changed = source(); mutate(changed); assert.equal(resolvePreparation(changed, recipeId, EQUIPMENT).state, "held"); }
    const first = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (first.state !== "authored-local") throw Error(recipeId);
    first.method.steps[0] = "Unlisted oil";
    const next = resolvePreparation(source(), recipeId, EQUIPMENT);
    if (next.state !== "authored-local") throw Error(recipeId);
    assert.notEqual(next.method.steps[0], "Unlisted oil");
  }
  assert.equal(reads, 0);
});
test("declared taco seasoning and sauces remain rows, while omission of optional choice extras cannot alter quote/nutrients or grant restrictions", () => {
  for (const recipeId of wrapsBowlIds) {
    const actual = source(), before = JSON.stringify(actual), result = resolvePreparation(actual, recipeId, EQUIPMENT);
    if (result.state !== "authored-local") throw Error(recipeId);
    assert.equal(result.seasoning.prompt, "Seasoning of your choice");
    assert.equal(result.seasoning.recommended, "Black pepper");
    assert.equal(result.seasoning.optional, true);
    assert.equal(result.seasoning.status, "unpriced-unverified-extra");
    assert.equal(result.seasoning.includedInQuotedTotal, false);
    assert.equal(result.seasoning.includedInNutrients, false);
    assert.equal(result.seasoning.allergenStatus, "unknown");
    assert.doesNotMatch(result.method.steps.join(" "), /black pepper|seasoning of your choice/i);
    assert.equal(result.restrictionAdmission, false);
    assert.equal(result.crossLaneAccepted, false);
    assert.equal("totalCents" in result, false);
    assert.equal("protein" in result, false);
    assert.equal(JSON.stringify(actual), before);
    if (!recipeId.startsWith("mediterranean-")) assert.deepEqual(result.ingredients.find(row => row[0] === "taco-seasoning"), ["taco-seasoning", 5, "g"]);
  }
});

const nextFamilies = ["turkey-and-avocado-sandwich-on-whole-wheat", "tuna-salad-wrap", "turkey-taco-bowl", "teriyaki-chicken-and-broccoli-rice-bowl", "chicken-fajita-bowl", "sheet-pan-chicken-with-sweet-potato-and-broccoli"];
const nextIds = RECIPES.filter(recipe => nextFamilies.includes(recipe.id)).flatMap(recipe => [recipe.id, ...recipe.variants.map(variant => variant.id)]);
const nextPreparation = (recipeId: string) => {
  const result = resolvePreparation(source(), recipeId, EQUIPMENT);
  if (result.state !== "authored-local") throw Error(recipeId);
  return result;
};
test("18 exact existing methods preserve rows and admit only their required equipment;81 prepared2 held83 total", () => {
  const actual = source(), before = JSON.stringify(actual);
  assert.equal(nextIds.length, 18);
  assert.equal(actual.recipes.length, 83);
  for (const recipeId of nextIds) {
    const result = nextPreparation(recipeId);
    assert.deepEqual(result.ingredients, actual.ingredients.filter(row => row.recipe_id === recipeId).map(row => [row.sku_id, row.qty, row.unit]));
    assert.ok(result.method.steps.length >= 3 && result.method.steps.length <= 5);
    assert.notEqual(result.method.id, "authored-primary");
    assert.notDeepEqual(result.method.steps, actual.recipes.find(row => row.id === recipeId)!.steps);
    assert.equal(resolvePreparation(actual, recipeId, result.method.equipment).state, "authored-local");
    for (const tool of result.method.equipment) assert.equal(resolvePreparation(actual, recipeId, result.method.equipment.filter(item => item !== tool)).state, "held", recipeId + " requires " + tool);
    assert.equal(resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, "authored-primary").state, "held");
  }
  assert.equal(preparationCoverage().filter(row => row.state === "authored-local").length, 81);
  const held = preparationCoverage().filter(row => row.state === "held-unprepared");
  assert.equal(held.length, 2);
  for (const row of held) assert.equal(resolvePreparation(actual, row.id, EQUIPMENT).state, "held");
  assert.equal(JSON.stringify(actual), before);
});
test("deli turkey, cooked canned meat and tempeh methods are distinct and use full edible produce/hummus quantities", () => {
  for (const recipeId of nextIds.filter(id => id.startsWith(nextFamilies[0]) || id.startsWith(nextFamilies[1]))) {
    const result = nextPreparation(recipeId), steps = result.method.steps.join(" ");
    assert.match(steps, /half avocado|half.*avocado/i);
    assert.match(steps, /edible flesh/);
    assert.match(steps, /1 oz.*hummus/);
    assert.match(steps, /package/);
    assert.doesNotMatch(steps, /165 F/);
    if (recipeId.startsWith(nextFamilies[0])) {
      assert.match(steps, /2 oz tomatoes/);
      if (recipeId.endsWith("-tempeh")) {
        assert.match(steps, /6 oz tempeh before cooking/);
        assert.match(steps, /tempeh package cooking/);
        assert.match(steps, /No unlisted oil/);
        assert.match(steps, /2 oz whole-wheat bread/);
      } else assert.match(steps, /7 oz packaged ready-to-eat deli turkey/);
      if (recipeId.endsWith("-wrap")) {
        assert.match(steps, /one packaged ready-to-eat flour tortilla/);
        assert.equal(result.method.equipment.includes("stovetop"), false);
      }
    } else {
      assert.match(steps, /quarter head of romaine/);
      assert.match(steps, /Clean the can lid/);
      if (recipeId.endsWith("-chicken")) {
        assert.match(steps, /fully cooked ready-to-eat canned chicken/);
        assert.match(steps, /6 oz chicken meat after draining/);
        assert.doesNotMatch(steps, /5 oz drained/);
      } else {
        assert.match(steps, /5 oz drained ready-to-eat tuna/);
        assert.match(steps, /not.*packing liquid/);
        assert.match(steps, /5 oz can is not proof/);
      }
      if (recipeId.endsWith("-rice")) {
        assert.match(steps, /60 g dry rice/);
        assert.equal(result.method.equipment.includes("saucepan-lid"), true);
      }
    }
  }
});
test("raw ground turkey and dry lentil methods preserve all seasoning/beans/salsa without meat or cooked-weight inheritance", () => {
  for (const recipeId of nextIds.filter(id => id.startsWith(nextFamilies[2]))) {
    const result = nextPreparation(recipeId), steps = result.method.steps.join(" ");
    assert.match(steps, /4 oz canned black beans including any packing liquid/);
    assert.match(steps, /entire measured portion/);
    assert.match(steps, /7 g taco seasoning/);
    assert.match(steps, /2 oz ready-to-eat salsa/);
    if (recipeId.endsWith("-lentil")) {
      assert.match(steps, /120 g dry lentils.*sort and rinse/);
      assert.match(steps, /fully tender/);
      assert.match(steps, /all the cooked lentils/);
      assert.match(steps, /120 g cooked lentils is not a substitute/);
      assert.doesNotMatch(steps, /165 F/);
    } else {
      assert.match(steps, /6 oz raw ground turkey before cooking/);
      assert.match(steps, /without added oil/);
      assert.match(steps, /food thermometer reads 165 F throughout/);
      assert.match(steps, /clean raw-contact utensils/);
      assert.match(steps, /clean utensils/i);
    }
    if (recipeId.endsWith("-tacos")) {
      assert.match(steps, /all three corn tortillas/);
      assert.equal(result.method.equipment.includes("saucepan"), false);
    } else assert.match(steps, /60 g dry rice/);
  }
});
test("teriyaki chicken/tofu/quinoa have exact independent protein and grain treatment and all declared sauce/oil/broccoli", () => {
  for (const recipeId of nextIds.filter(id => id.startsWith(nextFamilies[3]))) {
    const result = nextPreparation(recipeId), steps = result.method.steps.join(" ");
    assert.match(steps, /4 oz frozen broccoli/);
    assert.match(steps, /1 tsp olive oil/);
    assert.match(steps, /all 2 tbsp teriyaki sauce/);
    assert.match(steps, /measured pan oil/);
    assert.match(steps, /package cooking/);
    if (recipeId.endsWith("-tofu")) {
      assert.match(steps, /9 oz tofu before cooking/);
      assert.doesNotMatch(steps, /165 F|10 oz raw chicken/);
      assert.equal(result.method.equipment.includes("raw-poultry-board"), false);
    } else {
      assert.match(steps, /10 oz raw chicken before cooking/);
      assert.match(steps, /do not wash it/i);
      assert.match(steps, /food thermometer reads 165 F throughout/);
    }
    assert.match(steps, recipeId.endsWith("-quinoa") ? /60 g dry quinoa, rinse/ : /65 g dry rice/);
    assert.equal(result.method.equipment.includes("strainer"), recipeId.endsWith("-quinoa"));
  }
});
test("shrimp fajitas never inherit chicken temperatures, and tortilla swap never inherits rice cooking", () => {
  for (const recipeId of nextIds.filter(id => id.startsWith(nextFamilies[4]))) {
    const result = nextPreparation(recipeId), steps = result.method.steps.join(" ");
    assert.match(steps, /5 oz frozen peppers and onions/);
    assert.match(steps, /7 g taco seasoning/);
    assert.match(steps, /2 oz ready-to-eat salsa/);
    assert.match(steps, /1 tsp olive oil/);
    if (recipeId.endsWith("-shrimp")) {
      assert.match(steps, /Thaw.*refrigerator/);
      assert.match(steps, /8 oz thawed raw edible shrimp before cooking/);
      assert.match(steps, /excluding ice glaze or discarded liquid/);
      assert.match(steps, /pearly or white and opaque throughout/);
      assert.match(steps, /stricter package cooking and thermometer temperature requirements/);
      assert.doesNotMatch(steps, /165 F|9 oz raw chicken/);
      assert.equal(result.method.equipment.includes("raw-seafood-board"), true);
      assert.equal(result.method.equipment.includes("raw-poultry-board"), false);
    } else assert.match(steps, /9 oz raw chicken before cooking.*do not wash/);
    if (recipeId.endsWith("-tortillas")) {
      assert.match(steps, /both flour tortillas/);
      assert.equal(result.method.equipment.includes("saucepan"), false);
    } else assert.match(steps, /60 g dry rice/);
  }
});
test("sheet pan variants require the actual oven and own potato/tofu doneness, never an invented appliance alternative or fixed-time proof", () => {
  for (const recipeId of nextIds.filter(id => id.startsWith(nextFamilies[5]))) {
    const result = nextPreparation(recipeId), steps = result.method.steps.join(" ");
    assert.match(steps, /425 F unless stricter package/);
    assert.match(steps, /8 oz raw edible potato before cooking/);
    assert.match(steps, /Keep edible skin/);
    assert.match(steps, /1 tbsp olive oil total/);
    assert.match(steps, /remaining half oil/);
    assert.match(steps, /4 oz frozen broccoli/);
    assert.match(steps, /fork-tender/);
    assert.doesNotMatch(steps, /15 minutes|30 minutes/);
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT.filter(tool => tool !== "oven")).state, "held");
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT, PREPARATION_VERSION, "guessed-stovetop").state, "held");
    if (recipeId.endsWith("-tofu")) {
      assert.match(steps, /9 oz tofu before cooking/);
      assert.doesNotMatch(steps, /165 F|10 oz raw chicken/);
      assert.equal(result.method.equipment.includes("raw-poultry-board"), false);
    } else assert.match(steps, /chicken measures 165 F throughout with a food thermometer/);
    if (recipeId.endsWith("-potatoes")) assert.match(steps, /russet potato/);
    else assert.match(steps, /sweet potato/);
  }
});
test("all18 methods refuse unknown/accessor/duplicate equipment and stale/late materializations without side effects", () => {
  let reads = 0;
  const accessor: string[] = [];
  Object.defineProperty(accessor, "0", { get() { reads++; return "oven"; } });
  for (const recipeId of nextIds) {
    for (const equipment of [null, [], ["unknown"], ["oven", "oven"], new Array<string>(2), accessor]) assert.equal(resolvePreparation(source(), recipeId, equipment).state, "held");
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT, "old-version").state, "held");
    for (const mutate of [
      (s: ReturnType<typeof source>) => { s.ingredients.find(row => row.recipe_id === recipeId)!.qty++; },
      (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === recipeId)!.steps.push("Unlisted oil"); },
      (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === recipeId)!.minutes++; },
      (s: ReturnType<typeof source>) => { s.recipes.push(structuredClone(s.recipes.find(row => row.id === recipeId)!)); }
    ]) { const changed = source(); mutate(changed); assert.equal(resolvePreparation(changed, recipeId, EQUIPMENT).state, "held"); }
    const first = nextPreparation(recipeId); first.method.steps[0] = "Unlisted oil";
    assert.notEqual(nextPreparation(recipeId).method.steps[0], "Unlisted oil");
  }
  assert.equal(reads, 0);
});
test("all18 optional recommended extras may be omitted without changing materialized nutrition/quote or certifying allergy/adoption", () => {
  for (const recipeId of nextIds) {
    const actual = source(), before = JSON.stringify(actual), result = nextPreparation(recipeId);
    assert.equal(result.seasoning.prompt, "Seasoning of your choice");
    assert.equal(result.seasoning.recommended, "Black pepper");
    assert.equal(result.seasoning.optional, true);
    assert.equal(result.seasoning.includedInQuotedTotal, false);
    assert.equal(result.seasoning.includedInNutrients, false);
    assert.equal(result.seasoning.allergenStatus, "unknown");
    assert.doesNotMatch(result.method.steps.join(" "), /black pepper|seasoning of your choice/i);
    assert.equal(result.crossLaneAccepted, false);
    assert.equal(result.restrictionAdmission, false);
    assert.equal(result.safety.allergySafe, false);
    assert.equal(result.safety.kitchenVerified, false);
    assert.equal(result.safety.timeAloneProvesDoneness, false);
    assert.equal(result.timing.measured, false);
    assert.equal(result.timing.declaredMinutesAppliesToMethod, false);
    assert.equal(result.timing.methodMinutes, null);
    assert.equal("totalCents" in result, false);
    assert.equal("protein" in result, false);
    assert.equal(JSON.stringify(actual), before);
  }
});

const remainingFamilies = ["turkey-chili", "pesto-chicken-pasta", "turkey-meatballs-with-whole-wheat-spaghetti", "chicken-stir-fry-with-rice", "healthier-chicken-parmesan", "turkey-burgers-with-sweet-potato-wedges", "ground-turkey-lettuce-wraps", "bbq-chicken-with-roasted-vegetables-and-rice", "buffalo-chicken-bowl", "shrimp-and-veggie-stir-fry", "salmon-with-rice-and-asparagus"];
const heldThighIds = ["bbq-chicken-with-roasted-vegetables-and-rice", "bbq-chicken-with-roasted-vegetables-and-rice-potatoes"];
const remainingIds = RECIPES.filter(recipe => remainingFamilies.includes(recipe.id)).flatMap(recipe => [recipe.id, ...recipe.variants.map(variant => variant.id)]);
const newlyPreparedIds = remainingIds.filter(id => !heldThighIds.includes(id));
const remainingPreparation = (recipeId: string) => {
  const result = resolvePreparation(source(), recipeId, EQUIPMENT);
  if (result.state !== "authored-local") throw Error(recipeId);
  return result;
};
// Expectations come from the existing ingredient rows and safety sources, not a
// regenerated method string. Removing a food/quantity/cooking rule must fail.
const remainingChecks: Record<string, RegExp[]> = {
  "turkey-chili": [/8 oz raw ground turkey/, /4 oz drained solids/, /7 oz canned tomatoes/, /2 oz edible onion/, /half bell pepper/, /10 g taco seasoning/],
  "turkey-chili-lentil": [/130 g dry lentils, sort and rinse/, /fully tender/, /5 oz drained solids/, /7 oz canned tomatoes/, /2 oz edible onion/, /half bell pepper/, /10 g taco seasoning/],
  "turkey-chili-potato": [/8 oz raw ground turkey/, /8 oz raw edible potato/, /russet potato/, /fork-tender/, /7 oz tomatoes/, /2 oz edible onion/, /half bell pepper/, /10 g taco seasoning/],
  "pesto-chicken-pasta": [/6 oz raw chicken/, /70 g dry penne/, /3 oz frozen broccoli/, /all 2 oz pesto/, /all 0\.5 oz Parmesan/],
  "pesto-chicken-pasta-shrimp": [/7 oz raw edible shrimp/, /70 g dry penne/, /3 oz frozen broccoli/, /2 oz pesto/, /0\.5 oz Parmesan/],
  "pesto-chicken-pasta-gf": [/6 oz raw chicken/, /70 g dry gluten-free pasta/, /3 oz frozen broccoli/, /all 2 oz pesto/, /all 0\.5 oz Parmesan/],
  "turkey-meatballs-with-whole-wheat-spaghetti": [/7 oz raw ground turkey/, /70 g dry whole-wheat spaghetti/, /all 4 oz marinara/, /0\.5 oz breadcrumbs/, /entire one egg/, /half.*0\.5 oz Parmesan/, /remaining half Parmesan/],
  "turkey-meatballs-with-whole-wheat-spaghetti-beef": [/7 oz raw ground beef/, /70 g dry whole-wheat spaghetti/, /all 4 oz marinara/, /0\.5 oz breadcrumbs/, /entire one egg/, /half.*0\.5 oz Parmesan/, /remaining half Parmesan/],
  "turkey-meatballs-with-whole-wheat-spaghetti-gf": [/7 oz raw ground turkey/, /70 g dry gluten-free pasta/, /all 4 oz marinara/, /0\.5 oz dry oats/, /entire one egg/, /half.*0\.5 oz Parmesan/, /remaining half Parmesan/],
  "chicken-stir-fry-with-rice": [/10 oz raw chicken/, /65 g dry white rice/, /5 oz frozen stir-fry vegetables/, /all 2 tbsp soy sauce/, /all 1 tbsp olive oil/, /measured pan oil/],
  "chicken-stir-fry-with-rice-tofu": [/9 oz tofu before cooking/, /65 g dry white rice/, /5 oz frozen stir-fry vegetables/, /all 2 tbsp soy sauce/, /all 1 tbsp olive oil/, /measured pan oil/],
  "chicken-stir-fry-with-rice-noodles": [/10 oz raw chicken/, /70 g dry spaghetti/, /5 oz frozen stir-fry vegetables/, /all 2 tbsp soy sauce/, /all 1 tbsp olive oil/, /all cooked spaghetti/],
  "healthier-chicken-parmesan": [/6 oz raw chicken/, /all 1 oz breadcrumbs/, /entire one egg/, /all 4 oz marinara/, /1 oz shredded mozzarella/, /all 4 oz frozen broccoli/, /all chicken, cooked coating/],
  "healthier-chicken-parmesan-tofu": [/8 oz tofu before cooking/, /all 1 oz breadcrumbs/, /entire one egg/, /all 4 oz marinara/, /1 oz shredded mozzarella/, /all 4 oz frozen broccoli/, /all tofu, cooked coating/],
  "healthier-chicken-parmesan-oat": [/6 oz raw chicken/, /all 1 oz dry oats/, /entire one egg/, /all 4 oz marinara/, /1 oz shredded mozzarella/, /all 4 oz frozen broccoli/, /all chicken, cooked coating/],
  "turkey-burgers-with-sweet-potato-wedges": [/8 oz raw ground turkey/, /one.*whole-wheat bun/, /8 oz raw edible potato/, /sweet potato/, /all 1 tbsp olive oil/, /quarter head of romaine/],
  "turkey-burgers-with-sweet-potato-wedges-tempeh": [/8 oz tempeh before cooking/, /one.*whole-wheat bun/, /8 oz raw edible potato/, /sweet potato/, /all 1 tbsp olive oil/, /quarter head of romaine/],
  "turkey-burgers-with-sweet-potato-wedges-bunless": [/8 oz raw ground turkey/, /no bun/, /8 oz raw edible potato/, /sweet potato/, /all 1 tbsp olive oil/, /quarter head of romaine/],
  "ground-turkey-lettuce-wraps": [/8 oz raw ground turkey/, /half head of romaine/, /2 oz raw edible carrots/, /all 3 oz frozen shelled edamame/, /2 tbsp soy sauce/, /all 1 tsp olive oil/],
  "ground-turkey-lettuce-wraps-tofu": [/9 oz tofu before cooking/, /half head of romaine/, /2 oz raw edible carrots/, /all 3 oz frozen shelled edamame/, /2 tbsp soy sauce/, /all 1 tsp olive oil/],
  "ground-turkey-lettuce-wraps-rice": [/8 oz raw ground turkey/, /65 g dry white rice/, /2 oz raw edible carrots/, /all 3 oz frozen shelled edamame/, /2 tbsp soy sauce/, /all 1 tsp olive oil/, /No romaine/],
  "bbq-chicken-with-roasted-vegetables-and-rice-pork": [/8 oz raw edible boneless lean pork loin/, /70 g dry white rice/, /all 5 oz frozen mixed vegetables/, /all 2 oz barbecue sauce/, /all 1 tsp olive oil/],
  "buffalo-chicken-bowl": [/10 oz raw chicken/, /60 g dry white rice/, /all 2 tbsp buffalo sauce/, /quarter head of romaine/, /2 oz edible carrots/, /half avocado/, /half's edible flesh/],
  "buffalo-chicken-bowl-tempeh": [/8 oz tempeh before cooking/, /60 g dry white rice/, /all 2 tbsp buffalo sauce/, /quarter head of romaine/, /2 oz edible carrots/, /half avocado/, /half's edible flesh/],
  "buffalo-chicken-bowl-sweet-potato": [/10 oz raw chicken/, /8 oz raw edible potato/, /sweet potato/, /all 2 tbsp buffalo sauce/, /quarter head of romaine/, /2 oz edible carrots/, /half avocado/, /half's edible flesh/],
  "shrimp-and-veggie-stir-fry": [/8 oz raw edible shrimp/, /65 g dry white rice/, /all 6 oz frozen stir-fry vegetables/, /2 oz frozen shelled edamame/, /2 tbsp soy sauce/, /all 1 tbsp olive oil/],
  "shrimp-and-veggie-stir-fry-pork": [/8 oz raw edible boneless lean pork loin/, /65 g dry white rice/, /all 6 oz frozen stir-fry vegetables/, /2 oz frozen shelled edamame/, /2 tbsp soy sauce/, /all 1 tbsp olive oil/],
  "shrimp-and-veggie-stir-fry-brown-rice": [/8 oz raw edible shrimp/, /65 g dry brown rice/, /brown rice's own package/, /all 6 oz frozen stir-fry vegetables/, /2 oz frozen shelled edamame/, /2 tbsp soy sauce/, /all 1 tbsp olive oil/],
  "shrimp-and-veggie-stir-fry-chicken": [/12 oz thawed raw edible boneless skinless chicken/, /65 g dry white rice/, /all 6 oz frozen stir-fry vegetables/, /2 oz frozen shelled edamame/, /2 tbsp soy sauce/, /all 1 tbsp olive oil/],
  "salmon-with-rice-and-asparagus": [/8 oz raw edible salmon/, /65 g dry white rice/, /5 oz raw edible asparagus/, /2 tsp olive oil total/, /half the oil/],
  "salmon-with-rice-and-asparagus-tilapia": [/8 oz raw edible tilapia/, /65 g dry white rice/, /5 oz raw edible asparagus/, /2 tsp olive oil total/, /half each/],
  "salmon-with-rice-and-asparagus-sweet-potato": [/8 oz raw edible salmon/, /8 oz raw edible potato/, /sweet potato/, /5 oz raw edible asparagus/, /2 tsp olive oil total/, /remaining half oil/, /No rice/]
};
for (const recipeId of newlyPreparedIds) test("remaining exact ingredient quantities and required tools: " + recipeId, () => {
  const actual = source(), before = JSON.stringify(actual), result = remainingPreparation(recipeId);
  assert.deepEqual(result.ingredients, actual.ingredients.filter(row => row.recipe_id === recipeId).map(row => [row.sku_id, row.qty, row.unit]));
  assert.ok(remainingChecks[recipeId]?.length);
  for (const expected of remainingChecks[recipeId]) assert.match(result.method.steps.join(" "), expected);
  assert.ok(result.method.steps.length >= 3 && result.method.steps.length <= 5);
  assert.notDeepEqual(result.method.steps, actual.recipes.find(row => row.id === recipeId)!.steps);
  assert.notEqual(result.method.id, "authored-primary");
  assert.equal(new Set(result.method.equipment).size, result.method.equipment.length);
  assert.equal(resolvePreparation(actual, recipeId, result.method.equipment).state, "authored-local");
  for (const tool of result.method.equipment) assert.equal(resolvePreparation(actual, recipeId, result.method.equipment.filter(item => item !== tool)).state, "held", recipeId + " requires " + tool);
  assert.equal(resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, "authored-primary").state, "held");
  assert.equal(resolvePreparation(actual, recipeId, ["microwave", "microwave-safe-bowl", "microwave-safe-cover"]).state, "held");
  assert.equal(resolvePreparation(actual, recipeId, EQUIPMENT, PREPARATION_VERSION, "guessed-alternative").state, "held");
  assert.equal(JSON.stringify(actual), before);
});
test("all34 IDs accounted for; bone-in thigh rows stay held without inventing edible yield;81 prepared2 held83 total", () => {
  assert.equal(remainingIds.length, 34);
  assert.equal(newlyPreparedIds.length, 32);
  assert.deepEqual(Object.keys(remainingChecks).sort(), [...newlyPreparedIds].sort());
  assert.equal(preparationCoverage().length, 83);
  assert.equal(preparationCoverage().filter(row => row.state === "authored-local").length, 81);
  assert.deepEqual(preparationCoverage().filter(row => row.state === "held-unprepared").map(row => row.id).sort(), [...heldThighIds].sort());
  for (const recipeId of heldThighIds) {
    const result = resolvePreparation(source(), recipeId, EQUIPMENT);
    assert.equal(result.state, "held");
    if (result.state !== "held") throw Error(recipeId);
    assert.equal(result.reason, "unprepared-or-unknown-recipe");
    assert.equal(result.crossLaneAccepted, false);
    assert.equal(source().ingredients.find(row => row.recipe_id === recipeId && row.sku_id === "chicken-thighs")!.qty, 10);
  }
  assert.equal(resolvePreparation(source(), "invented-recipe", EQUIPMENT).state, "held");
});
test("poultry, ground beef, whole pork, egg coating, fish and shrimp retain distinct safety and raw quantity rules", () => {
  for (const recipeId of newlyPreparedIds) {
    const result = remainingPreparation(recipeId), steps = result.method.steps.join(" "), skus = result.ingredients.map(row => row[0]);
    assert.match(steps, /package/);
    if (skus.some(sku => ["chicken-breast", "frozen-chicken-breast", "ground-turkey"].includes(sku))) {
      assert.match(steps, /food thermometer reads 165 F/);
      assert.match(steps, /raw.*before cooking|raw ground turkey/);
      assert.match(steps, /clean raw-contact utensils/i);
    }
    if (skus.includes("ground-beef")) { assert.match(steps, /food thermometer reads 160 F/); assert.doesNotMatch(steps, /165 F|145 F/); }
    if (skus.includes("pork-loin")) {
      assert.match(steps, /food thermometer reads at least 145 F/);
      assert.match(steps, /[Rr]est.*at least 3 minutes/);
      assert.equal(result.method.equipment.includes("raw-meat-board"), true);
      assert.doesNotMatch(steps, /165 F|160 F/);
    }
    if (skus.includes("frozen-shrimp")) {
      assert.match(steps, /pearly or white and opaque throughout/);
      assert.match(steps, /stricter package thermometer temperature requirement/);
      assert.match(steps, /refrigerator/);
      assert.match(steps, /ice glaze.*discarded liquid/);
      assert.doesNotMatch(steps, /145 F|165 F/);
    }
    if (skus.includes("frozen-salmon") || skus.includes("frozen-tilapia")) {
      assert.match(steps, /food thermometer reads 145 F throughout/);
      assert.match(steps, /refrigerator/);
      assert.match(steps, /raw edible.*before cooking/);
      assert.doesNotMatch(steps, /165 F|pearly or white/);
    }
    if (skus.includes("tofu") || skus.includes("tempeh") || skus.includes("lentils")) assert.doesNotMatch(steps, /165 F/);
  }
  const eggTofu = remainingPreparation("healthier-chicken-parmesan-tofu");
  assert.match(eggTofu.method.steps.join(" "), /160 F throughout the coating/);
  assert.deepEqual(eggTofu.ingredients.find(row => row[0] === "eggs"), ["eggs", 1, "each"]);
});
test("breading consumes every measured egg/crumb/oat; plain sheet pan cannot silently substitute for no-oil nonstick method", () => {
  for (const recipeId of newlyPreparedIds.filter(id => id.startsWith("healthier-chicken-parmesan"))) {
    const result = remainingPreparation(recipeId), steps = result.method.steps.join(" ");
    assert.match(steps, /entire one egg/);
    assert.match(steps, /loose coating/);
    assert.match(steps, /discarded|rather than discard/);
    assert.match(steps, /no unlisted oil|No added oil/i);
    assert.equal(result.method.equipment.includes("nonstick-oven-safe-sheet-pan"), true);
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT.filter(tool => tool !== "nonstick-oven-safe-sheet-pan")).state, "held");
    if (recipeId.endsWith("-oat")) {
      assert.equal(result.method.equipment.includes("blender"), true);
      assert.match(steps, /1 oz dry oats/);
    }
  }
  assert.equal(remainingPreparation("turkey-meatballs-with-whole-wheat-spaghetti-gf").method.equipment.includes("blender"), true);
});
test("all32 refuse sparse/accessor/unknown/duplicate equipment without getter effects and refuse stale source/row/time/version", () => {
  let reads = 0;
  const accessor: string[] = [];
  Object.defineProperty(accessor, "0", { get() { reads++; return "oven"; } });
  for (const recipeId of newlyPreparedIds) {
    for (const equipment of [null, [], ["air-fryer"], ["oven", "oven"], new Array<string>(2), accessor]) assert.equal(resolvePreparation(source(), recipeId, equipment).state, "held");
    assert.equal(resolvePreparation(source(), recipeId, EQUIPMENT, "stale-preparation-version").state, "held");
    for (const mutate of [
      (s: ReturnType<typeof source>) => { s.ingredients.find(row => row.recipe_id === recipeId)!.qty++; },
      (s: ReturnType<typeof source>) => { s.ingredients.find(row => row.recipe_id === recipeId)!.sku_id = "unlisted-sauce"; },
      (s: ReturnType<typeof source>) => { s.ingredients = s.ingredients.filter(row => !(row.recipe_id === recipeId && row.sku_id === remainingPreparation(recipeId).ingredients[0][0])); },
      (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === recipeId)!.steps.push("Add unlisted oil."); },
      (s: ReturnType<typeof source>) => { s.recipes.find(row => row.id === recipeId)!.minutes++; },
      (s: ReturnType<typeof source>) => { s.recipes.push(structuredClone(s.recipes.find(row => row.id === recipeId)!)); }
    ]) { const changed = source(); mutate(changed); assert.equal(resolvePreparation(changed, recipeId, EQUIPMENT).state, "held"); }
    const first = remainingPreparation(recipeId); first.method.steps[0] = "Unlisted sauce"; first.ingredients[0][1]++;
    const next = remainingPreparation(recipeId);
    assert.notEqual(next.method.steps[0], "Unlisted sauce");
    assert.notDeepEqual(next.ingredients, first.ingredients);
  }
  assert.equal(reads, 0);
});
test("all32 optional seasoning omission preserves complete methods/quote/nutrients and all closed admissions", () => {
  for (const recipeId of newlyPreparedIds) {
    const actual = source(), before = JSON.stringify(actual), result = remainingPreparation(recipeId);
    assert.equal(result.seasoning.prompt, "Seasoning of your choice");
    assert.equal(result.seasoning.recommended, "Black pepper");
    assert.equal(result.seasoning.optional, true);
    assert.equal(result.seasoning.status, "unpriced-unverified-extra");
    assert.equal(result.seasoning.includedInQuotedTotal, false);
    assert.equal(result.seasoning.includedInNutrients, false);
    assert.equal(result.seasoning.allergenStatus, "unknown");
    assert.doesNotMatch(result.method.steps.join(" "), /black pepper|seasoning of your choice/i);
    assert.equal(result.crossLaneAccepted, false);
    assert.equal(result.restrictionAdmission, false);
    assert.equal(result.safety.allergySafe, false);
    assert.equal(result.safety.kitchenVerified, false);
    assert.equal(result.safety.timeAloneProvesDoneness, false);
    assert.equal(result.safety.stricterPackageDirectionsWin, true);
    assert.equal(result.timing.measured, false);
    assert.equal(result.timing.methodMinutes, null);
    assert.equal(result.timing.declaredMinutesAppliesToMethod, false);
    assert.equal("totalCents" in result, false);
    assert.equal("protein" in result, false);
    assert.equal(JSON.stringify(actual), before);
  }
});
