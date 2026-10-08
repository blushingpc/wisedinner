// Internal producer adjunct. UNACCEPTED across lanes; not part of a snapshot or API DTO.
// Authored guidance only: no physical kitchen, yield, package or allergy acceptance.
import { RECIPES } from "./recipes.ts";
import { expandRecipes } from "../expand.ts";
import type { Ing } from "./types.ts";

export const PREPARATION_VERSION = "wd-authored-preparation-1";
export const SAFETY_SOURCE = "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures";
export const EQUIPMENT = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer", "toaster", "microwave", "microwave-safe-bowl", "microwave-safe-cover", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools", "blender", "tongs", "clean-serving-plate", "raw-poultry-board"] as const;
type Equipment = typeof EQUIPMENT[number];
type Method = { id: string; equipment: Equipment[]; steps: string[] };
const baseId = "egg-white-and-veggie-scramble-with-toast";
const compiled = expandRecipes(RECIPES);
const standard: Equipment[] = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer"];
type Definition = { id: string; rows: Ing[]; methods: Method[]; sourceMethod?: false; seasoning?: string };
const definitions: Definition[] = [
  { id: baseId, rows: [["egg-whites", 8, "oz"], ["eggs", 2, "each"], ["frozen-peppers-onions", 3, "oz"], ["ww-bread", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "pan-toast", equipment: [...standard], steps: [
      "Toast the measured bread in a dry nonstick pan, turning it until lightly browned, then set it aside.",
      "Heat the measured oil in the pan and cook the peppers and onions according to their package directions.",
      "Whisk the two eggs with the egg whites, pour them into the pan and stir until firm and a food thermometer reads 160 F. Follow stricter package directions.",
      "Serve all the scramble with the toast."
    ] }
  ] },
  { id: baseId + "-eggs", rows: [["eggs", 4, "each"], ["frozen-peppers-onions", 3, "oz"], ["ww-bread", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "pan-toast", equipment: [...standard], steps: [
      "Toast the measured bread in a dry nonstick pan, turning it until lightly browned, then set it aside.",
      "Heat the measured oil in the pan and cook the peppers and onions according to their package directions.",
      "Whisk all four eggs, add them to the pan and stir until firm and a food thermometer reads 160 F. Follow stricter package directions.",
      "Serve all the scramble with the toast."
    ] }
  ] },
  { id: baseId + "-tofu", rows: [["tofu", 7, "oz"], ["frozen-peppers-onions", 3, "oz"], ["ww-bread", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "pan-toast", equipment: ["stovetop", "nonstick-pan", "spatula"], steps: [
      "Toast the measured bread in a dry nonstick pan, turning it until lightly browned, then set it aside.",
      "Drain and pat dry the measured tofu. Heat the measured oil and cook the peppers and onions according to their package directions.",
      "Crumble in the tofu and cook according to its package directions until hot and lightly browned.",
      "Serve all the tofu and vegetables with the toast."
    ] }
  ] },
  { id: baseId + "-potatoes", rows: [["egg-whites", 8, "oz"], ["eggs", 2, "each"], ["frozen-peppers-onions", 3, "oz"], ["russet-potatoes", 6, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "boiled-potatoes", equipment: [...standard, "knife", "cutting-board", "saucepan", "strainer"], steps: [
      "Wash and dice the measured potatoes. Simmer them in water in a saucepan until a fork enters easily, then drain.",
      "Heat the measured oil in the nonstick pan and brown the potatoes with the peppers and onions, following the vegetables' package directions.",
      "Whisk the two eggs with the egg whites, add them to the pan and stir until firm and a food thermometer reads 160 F. Follow stricter package directions.",
      "Serve all the scramble and potatoes."
    ] }
  ] }
];
// Independent batch methods. Existing materialized source steps remain pinned but are
// not offered as methods for these IDs; no variant inherits a base's instructions.
const fruitTools: Equipment[] = ["stovetop", "saucepan", "bowl", "spoon", "measuring-tools", "food-thermometer"];
const berryStep = "Heat the measured 3 oz frozen berries in a saucepan according to their package cooking directions, checking any required temperature, then let them cool before combining with dairy or yogurt. Do not treat thawing alone as ready to eat.";
const microwaveBerryStep = "Cook the measured 3 oz frozen berries in a covered microwave-safe bowl according to their package directions, stirring and allowing any standing time before the required temperature check. Let them cool before combining with dairy or yogurt.";
const berryMicrowaveTools: Equipment[] = ["microwave", "microwave-safe-bowl", "microwave-safe-cover", "bowl", "spoon", "measuring-tools", "food-thermometer"];
const batch: Definition[] = [
  { id: "greek-yogurt-parfait-with-berries-and-granola", sourceMethod: false, seasoning: "Cinnamon", rows: [["greek-yogurt", 8, "oz"], ["whey-protein", 15, "g"], ["granola", 1.5, "oz"], ["frozen-berries", 3, "oz"]], methods: [
    { id: "stovetop-berries", equipment: fruitTools, steps: [berryStep, "Stir the measured 15 g whey protein into 8 oz Greek yogurt until smooth, using powder whose package permits mixing without further cooking.", "Layer all the yogurt and cooled berries in the bowl. Top with 1.5 oz packaged ready-to-eat granola and serve."] },
    { id: "microwave-berries", equipment: berryMicrowaveTools, steps: [microwaveBerryStep, "Stir 15 g whey protein into 8 oz Greek yogurt until smooth; the powder must permit mixing without further cooking.", "Layer all the yogurt and cooled berries, top with 1.5 oz ready-to-eat granola and serve."] }
  ] },
  { id: "greek-yogurt-parfait-with-berries-and-granola-plant", sourceMethod: false, seasoning: "Cinnamon", rows: [["plant-yogurt", 8, "oz"], ["pea-protein", 35, "g"], ["oats", 1.5, "oz"], ["frozen-berries", 3, "oz"]], methods: [
    { id: "cooked-oat-parfait", equipment: fruitTools, steps: ["Measure 1.5 oz dry oats before cooking. Cook them in water in a saucepan according to the package, then let them cool; do not substitute 1.5 oz cooked oats.", berryStep, "Stir 35 g pea protein into 8 oz plant yogurt until smooth, using powder whose package permits mixing without further cooking.", "Layer all the cooled oats, protein yogurt and berries in the bowl and serve. No granola or whey is used."] }
  ] },
  { id: "greek-yogurt-parfait-with-berries-and-granola-oats", sourceMethod: false, seasoning: "Cinnamon", rows: [["greek-yogurt", 8, "oz"], ["whey-protein", 15, "g"], ["oats", 1.5, "oz"], ["frozen-berries", 3, "oz"]], methods: [
    { id: "cooked-oat-parfait", equipment: fruitTools, steps: ["Measure 1.5 oz dry oats before cooking. Cook them in water in a saucepan according to the package and let them cool; this is not a cooked-weight substitution.", berryStep, "Stir 15 g whey protein into 8 oz Greek yogurt until smooth; the powder must permit mixing without further cooking.", "Layer all the cooled oats, yogurt and berries in the bowl and serve. No granola is added."] }
  ] },
  { id: "protein-oatmeal-with-peanut-butter-and-banana", sourceMethod: false, seasoning: "Cinnamon", rows: [["oats", 60, "g"], ["whey-protein", 30, "g"], ["peanut-butter", 1, "oz"], ["bananas", 100, "g"]], methods: [
    { id: "stovetop", equipment: ["stovetop", "saucepan", "bowl", "spoon", "measuring-tools", "knife", "cutting-board"], steps: ["Measure 60 g dry oats before cooking. Cook them in water according to their package directions until tender and thick.", "Let the oats cool slightly, then stir in all 30 g whey protein until smooth; use powder whose package permits this mixing method.", "Peel the banana and measure 100 g edible flesh, then slice it. Put all the oatmeal in the bowl and top with the banana and 1 oz peanut butter. Serve."] },
    { id: "microwave", equipment: ["microwave", "microwave-safe-bowl", "microwave-safe-cover", "spoon", "measuring-tools", "knife", "cutting-board"], steps: ["Measure 60 g dry oats and the package-specified water into a microwave-safe bowl. Cook according to the package, stirring and allowing standing time until tender.", "Cool slightly and stir in 30 g whey protein whose package permits this mixing method.", "Peel and slice 100 g edible banana flesh and add it with 1 oz peanut butter. Serve all the oatmeal."] }
  ] },
  { id: "protein-oatmeal-with-peanut-butter-and-banana-pea", sourceMethod: false, seasoning: "Cinnamon", rows: [["oats", 60, "g"], ["pea-protein", 30, "g"], ["peanut-butter", 1, "oz"], ["bananas", 100, "g"]], methods: [
    { id: "stovetop", equipment: ["stovetop", "saucepan", "bowl", "spoon", "measuring-tools", "knife", "cutting-board"], steps: ["Measure 60 g dry oats and cook them in water according to the package until tender and thick.", "Cool slightly and stir in all 30 g pea protein until smooth; the powder must permit this mixing method. Do not use whey.", "Peel and slice 100 g edible banana flesh. Top all the oatmeal with the banana and 1 oz peanut butter and serve."] },
    { id: "microwave", equipment: ["microwave", "microwave-safe-bowl", "microwave-safe-cover", "spoon", "measuring-tools", "knife", "cutting-board"], steps: ["Measure 60 g dry oats and package-specified water into a microwave-safe bowl. Cook according to the package, stirring and allowing standing time until tender.", "Cool slightly and stir in all 30 g pea protein whose package permits this mixing method; no whey is used.", "Peel and slice 100 g edible banana flesh, add it and 1 oz peanut butter and serve all the oatmeal."] }
  ] },
  { id: "protein-oatmeal-with-peanut-butter-and-banana-quinoa", sourceMethod: false, seasoning: "Cinnamon", rows: [["quinoa", 50, "g"], ["whey-protein", 30, "g"], ["peanut-butter", 1, "oz"], ["bananas", 100, "g"]], methods: [
    { id: "stovetop-quinoa", equipment: ["stovetop", "saucepan", "strainer", "bowl", "spoon", "measuring-tools", "knife", "cutting-board"], steps: ["Measure 50 g dry quinoa, rinse it in a fine strainer and cook in water according to its package until tender. Do not substitute 50 g cooked quinoa or oats.", "Cool slightly and stir in all 30 g whey protein whose package permits this mixing method.", "Peel and slice 100 g edible banana flesh. Serve all the porridge topped with the banana and 1 oz peanut butter."] }
  ] },
  { id: "protein-pancakes-with-berries", sourceMethod: false, seasoning: "Cinnamon", rows: [["pancake-mix", 60, "g"], ["eggs", 2, "each"], ["whey-protein", 20, "g"], ["frozen-berries", 3, "oz"]], methods: [
    { id: "nonstick-pan", equipment: [...fruitTools, "nonstick-pan", "spatula", "mixing-bowl", "whisk"], steps: [berryStep, "Whisk 60 g dry pancake mix, both eggs and all 20 g whey with water into a thick batter. Use package directions compatible with these declared ingredients; if extra milk or oil is required, this method is unsupported. Do not taste raw batter.", "Cook small pancakes in a nonstick pan without added oil, turning when the surface begins to set. Cook until the centers are set and a food thermometer reads at least 160 F, or a higher temperature required by the mix package; time alone is not proof.", "Serve all the pancakes with all the prepared berries."] }
  ] },
  { id: "protein-pancakes-with-berries-vegan", sourceMethod: false, seasoning: "Cinnamon", rows: [["oats", 60, "g"], ["bananas", 100, "g"], ["pea-protein", 30, "g"], ["frozen-berries", 3, "oz"]], methods: [
    { id: "blender-nonstick-pan", equipment: [...fruitTools, "nonstick-pan", "spatula", "blender"], steps: [berryStep, "Measure 60 g dry oats, 100 g peeled edible banana flesh and 30 g pea protein into a blender. Blend with enough water for a thick batter, following the blender and ingredient package directions; no eggs or whey are used.", "Cook small pancakes in a nonstick pan without added oil, turning after the edges set. Cook both sides until the centers are fully set and the oat and powder package cooking instructions are satisfied; do not taste raw batter or rely on minutes alone.", "Serve all the pancakes and all the prepared berries."] }
  ] },
  { id: "protein-pancakes-with-berries-oat", sourceMethod: false, seasoning: "Cinnamon", rows: [["oats", 60, "g"], ["eggs", 2, "each"], ["whey-protein", 20, "g"], ["frozen-berries", 3, "oz"]], methods: [
    { id: "blender-nonstick-pan", equipment: [...fruitTools, "nonstick-pan", "spatula", "blender"], steps: [berryStep, "Blend 60 g dry oats, both eggs and 20 g whey with enough water for a thick batter. Follow ingredient and blender instructions; no pancake mix is added. Do not taste raw batter.", "Cook small pancakes in a nonstick pan without added oil, turning after the edges set. Cook until centers are set and a food thermometer reads at least 160 F; stricter package cooking directions win.", "Serve all the pancakes with all the prepared berries."] }
  ] },
  { id: "egg-and-avocado-breakfast-wrap", sourceMethod: false, seasoning: "Black pepper", rows: [["eggs", 3, "each"], ["egg-whites", 5, "oz"], ["flour-tortillas", 1, "each"], ["avocados", 0.5, "each"], ["salsa", 1, "oz"]], methods: [
    { id: "nonstick-pan", equipment: ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer", "knife", "cutting-board", "measuring-tools", "clean-serving-plate"], steps: ["Wash the avocado skin before cutting. Remove the pit and skin from the declared half avocado and slice its edible flesh on a clean board. Keep it and 1 oz salsa away from raw egg utensils.", "Warm the one flour tortilla in a dry nonstick pan according to its package instructions and set it on a clean plate.", "Whisk all three eggs with 5 oz egg whites. Scramble in the nonstick pan without added oil until firm and a food thermometer reads 160 F; stricter package directions win. Clean raw egg utensils before serving.", "Fill the tortilla with all the cooked eggs, the half avocado's flesh and all the salsa. Roll and serve."] }
  ] },
  { id: "egg-and-avocado-breakfast-wrap-tofu", sourceMethod: false, seasoning: "Black pepper", rows: [["tofu", 7, "oz"], ["flour-tortillas", 1, "each"], ["avocados", 0.5, "each"], ["salsa", 1, "oz"]], methods: [
    { id: "nonstick-pan", equipment: ["stovetop", "nonstick-pan", "spatula", "knife", "cutting-board", "measuring-tools", "clean-serving-plate"], steps: ["Wash the avocado skin, remove the pit and skin from the declared half and slice its edible flesh. Measure 1 oz salsa.", "Warm one flour tortilla in a dry nonstick pan according to its package directions and set it on a clean plate.", "Drain and pat dry the measured 7 oz tofu without substituting a cooked weight. Crumble it into the nonstick pan and cook without added oil according to the tofu package until hot and lightly browned; no eggs or egg whites are used.", "Fill the tortilla with all the tofu, avocado flesh and salsa. Roll and serve."] }
  ] },
  { id: "egg-and-avocado-breakfast-wrap-corn", sourceMethod: false, seasoning: "Black pepper", rows: [["eggs", 3, "each"], ["egg-whites", 5, "oz"], ["corn-tortillas", 2, "each"], ["avocados", 0.5, "each"], ["salsa", 1, "oz"]], methods: [
    { id: "nonstick-pan-tacos", equipment: ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer", "knife", "cutting-board", "measuring-tools", "clean-serving-plate"], steps: ["Wash the avocado skin, remove pit and skin from the declared half and slice the edible flesh on a clean board. Measure 1 oz salsa and keep both away from raw egg utensils.", "Warm both corn tortillas in a dry nonstick pan according to their package directions and set them on a clean plate.", "Whisk all three eggs with 5 oz egg whites and scramble without added oil until firm and a food thermometer reads 160 F; stricter package directions win. Clean raw egg utensils before serving.", "Divide all the cooked eggs, avocado flesh and salsa between the two corn tortillas and serve; no flour tortilla is added."] }
  ] },
  { id: "cottage-cheese-bowl-with-fruit-and-honey", sourceMethod: false, seasoning: "Cinnamon", rows: [["cottage-cheese", 11, "oz"], ["frozen-berries", 3, "oz"], ["bananas", 100, "g"], ["honey", 0.5, "oz"]], methods: [
    { id: "stovetop-berries", equipment: [...fruitTools, "knife", "cutting-board"], steps: [berryStep, "Spoon 11 oz packaged ready-to-eat cottage cheese into a bowl. Peel and slice 100 g edible banana flesh.", "Top with all the cooled berries and banana, drizzle 0.5 oz honey over the top and serve."] },
    { id: "microwave-berries", equipment: [...berryMicrowaveTools, "knife", "cutting-board"], steps: [microwaveBerryStep, "Spoon 11 oz packaged ready-to-eat cottage cheese into a bowl and top with 100 g peeled edible banana flesh, sliced.", "Add all the cooled berries and 0.5 oz honey, then serve."] }
  ] },
  { id: "cottage-cheese-bowl-with-fruit-and-honey-plant", sourceMethod: false, seasoning: "Cinnamon", rows: [["plant-yogurt", 8, "oz"], ["frozen-berries", 3, "oz"], ["bananas", 100, "g"], ["peanut-butter", 1, "oz"], ["pea-protein", 30, "g"]], methods: [
    { id: "stovetop-berries", equipment: [...fruitTools, "knife", "cutting-board"], steps: [berryStep, "Stir all 30 g pea protein into 8 oz plant yogurt until smooth, using powder whose package permits mixing without further cooking.", "Peel and slice 100 g edible banana flesh. Top the yogurt with all the cooled berries and banana, add 1 oz peanut butter and serve. No cottage cheese or honey is used."] },
    { id: "microwave-berries", equipment: [...berryMicrowaveTools, "knife", "cutting-board"], steps: [microwaveBerryStep, "Stir 30 g pea protein into 8 oz plant yogurt; the powder must permit mixing without further cooking.", "Add 100 g peeled edible banana flesh, sliced, all the cooled berries and 1 oz peanut butter. Serve without cottage cheese or honey."] }
  ] },
  { id: "cottage-cheese-bowl-with-fruit-and-honey-toast", sourceMethod: false, seasoning: "Cinnamon", rows: [["cottage-cheese", 11, "oz"], ["frozen-berries", 3, "oz"], ["ww-bread", 2, "oz"], ["honey", 0.5, "oz"]], methods: [
    { id: "pan-toast", equipment: [...fruitTools, "nonstick-pan", "spatula"], steps: [berryStep, "Toast all the measured 2 oz bread in a dry nonstick pan, turning until lightly browned; no added oil is required.", "Spread all 11 oz ready-to-eat cottage cheese over the toast and top with all the cooled berries. Drizzle with 0.5 oz honey and serve; no banana is added."] },
    { id: "toaster", equipment: [...fruitTools, "toaster"], steps: [berryStep, "Toast the measured 2 oz bread in the toaster according to its directions.", "Spread all 11 oz ready-to-eat cottage cheese over the toast, add all the cooled berries and 0.5 oz honey and serve without banana."] }
  ] },
  { id: "chicken-caesar-wrap", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 6, "oz"], ["flour-tortillas", 1, "each"], ["romaine", 0.5, "each"], ["caesar-dressing", 2, "tbsp"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "nonstick-pan", equipment: ["stovetop", "nonstick-pan", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: ["Wash the declared half romaine under running water, drain and chop it on the produce board. Toss it with 2 tbsp Caesar dressing and 0.5 oz Parmesan. Keep this salad away from raw poultry and utensils.", "Warm one flour tortilla in a dry nonstick pan according to its package and set it on a clean serving plate.", "Measure 6 oz raw chicken before cooking. Do not wash it. Slice it on the separate raw-poultry board, wash hands and clean raw-contact utensils, then cook in the nonstick pan without added oil, using a little water if needed, until a thermometer reads 165 F throughout. Stricter package directions win; color alone is not proof.", "Using clean utensils, fill the tortilla with all the cooked chicken and salad. Roll and serve; do not substitute 6 oz cooked chicken."] }
  ] },
  { id: "chicken-caesar-wrap-turkey", sourceMethod: false, seasoning: "Black pepper", rows: [["deli-turkey", 6, "oz"], ["flour-tortillas", 1, "each"], ["romaine", 0.5, "each"], ["caesar-dressing", 2, "tbsp"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "nonstick-pan", equipment: ["stovetop", "nonstick-pan", "spatula", "knife", "cutting-board", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: ["Use 6 oz packaged cooked ready-to-eat deli turkey, following its handling directions; raw turkey is unsupported by this method.", "Wash, drain and chop the declared half romaine on a clean board. Toss it with 2 tbsp Caesar dressing and 0.5 oz Parmesan.", "Warm one flour tortilla in a dry nonstick pan according to its package directions and place it on a clean plate.", "Layer all the deli turkey and salad onto the tortilla, roll and serve. No raw chicken cooking method or extra oil is assumed."] }
  ] },
  { id: "chicken-caesar-wrap-bowl", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 6, "oz"], ["white-rice", 60, "g"], ["romaine", 0.5, "each"], ["caesar-dressing", 2, "tbsp"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "stovetop-rice-and-chicken", equipment: ["stovetop", "saucepan", "nonstick-pan", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: ["Measure 60 g dry rice before cooking and cook it in water according to its package until tender; do not replace it with 60 g cooked rice.", "Wash, drain and chop the declared half romaine on the produce board and toss it with 2 tbsp Caesar dressing and 0.5 oz Parmesan. Keep salad and cooked rice away from raw poultry.", "Measure 6 oz raw chicken before cooking. Do not wash it. Slice it on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook in the nonstick pan without added oil, using a little water if needed, until a food thermometer reads 165 F throughout; stricter package directions win.", "Use clean utensils to serve all the cooked chicken and salad over all the rice in the bowl. No tortilla or cooked-weight substitution is used."] }
  ] }
];
definitions.push(...batch);
const records = definitions.map(definition => {
  const recipe = compiled.recipes.find(recipe => recipe.id === definition.id)!;
  const primaryEquipment: Equipment[] = definition.id.endsWith("-potatoes")
    ? [...standard, "microwave", "microwave-safe-bowl", "microwave-safe-cover", "knife", "cutting-board"]
    : definition.id.endsWith("-tofu") ? ["stovetop", "nonstick-pan", "spatula", "toaster"] : [...standard, "toaster"];
  return { ...definition, sourceSteps: [...recipe.steps], sourceMinutes: recipe.minutes, methods: [
    ...(definition.sourceMethod === false ? [] : [{ id: "authored-primary", equipment: primaryEquipment, steps: [...recipe.steps] }]),
    ...definition.methods
  ] };
});
export function preparationCoverage() {
  return compiled.recipes.map(recipe => ({ id: recipe.id, state: records.some(record => record.id === recipe.id) ? "authored-local" : "held-unprepared" }));
}

// Input is the existing materializer's result, not a new transport or accepted content contract.
export function resolvePreparation(
  source: ReturnType<typeof expandRecipes>, id: string, ownedEquipment: readonly string[] | null,
  version = PREPARATION_VERSION, methodId?: string
) {
  const held = (reason: string) => ({ state: "held" as const, reason, crossLaneAccepted: false as const });
  if (version !== PREPARATION_VERSION) return held("stale-preparation-version");
  const record = records.find(record => record.id === id);
  if (!record) return held("unprepared-or-unknown-recipe");
  if (!Array.isArray(ownedEquipment) || ownedEquipment.length > EQUIPMENT.length) return held("unknown-equipment");
  const descriptors = Object.getOwnPropertyDescriptors(ownedEquipment);
  const equipment: string[] = [];
  for (let index = 0; index < ownedEquipment.length; index++) {
    const descriptor = descriptors[index];
    if (!descriptor || !("value" in descriptor) || typeof descriptor.value !== "string" || !(EQUIPMENT as readonly string[]).includes(descriptor.value) || equipment.includes(descriptor.value)) return held("unknown-equipment");
    equipment.push(descriptor.value);
  }
  const recipe = source.recipes.find(recipe => recipe.id === id);
  const rows = source.ingredients.filter(row => row.recipe_id === id).map(row => [row.sku_id, row.qty, row.unit]);
  if (source.recipes.filter(recipe => recipe.id === id).length !== 1 || !recipe ||
    JSON.stringify(rows) !== JSON.stringify(record.rows) ||
    JSON.stringify(recipe.steps) !== JSON.stringify(record.sourceSteps) ||
    recipe.minutes !== record.sourceMinutes) return held("stale-or-mismatched-materialization");
  const method = record.methods.find(method => (!methodId || method.id === methodId) && method.equipment.every(item => equipment.includes(item)));
  if (!method) return held(methodId && !record.methods.some(method => method.id === methodId) ? "unknown-method" : "missing-equipment");
  return {
    state: "authored-local" as const, crossLaneAccepted: false as const, restrictionAdmission: false as const, version: PREPARATION_VERSION,
    id, method: structuredClone(method), ingredients: structuredClone(record.rows),
    quantityBasis: "unchanged-authored-rows-unverified" as const,
    timing: { declaredMinutes: recipe.minutes, measured: false as const, alternativeMinutes: null,
      ...(record.sourceMethod === false ? { declaredMinutesAppliesToMethod: false as const, methodMinutes: null } : {}) },
    seasoning: { optional: true as const, prompt: "Seasoning of your choice", recommended: record.seasoning ?? "Black pepper",
      status: "unpriced-unverified-extra" as const, includedInQuotedTotal: false as const,
      includedInNutrients: false as const, allergenStatus: "unknown" as const },
    safety: { source: SAFETY_SOURCE, stricterPackageDirectionsWin: true as const,
      timeAloneProvesDoneness: false as const, kitchenVerified: false as const, allergySafe: false as const }
  };
}
