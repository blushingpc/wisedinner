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
  assert.equal(coverage.filter(row => row.state === "authored-local").length, 31);
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
  assert.equal(preparationCoverage().filter(row => row.state === "held-unprepared").length, 52);
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
  assert.equal(preparationCoverage().filter(row => row.state === "authored-local").length, 31);
  const held = preparationCoverage().filter(row => row.state === "held-unprepared");
  assert.equal(held.length, 52);
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
