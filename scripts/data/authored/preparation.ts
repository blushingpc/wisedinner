// Internal producer adjunct. UNACCEPTED across lanes; not part of a snapshot or API DTO.
// Authored guidance only: no physical kitchen, yield, package or allergy acceptance.
import { RECIPES } from "./recipes.ts";
import { expandRecipes } from "../expand.ts";
import type { Ing } from "./types.ts";

export const PREPARATION_VERSION = "wd-authored-preparation-1";
export const SAFETY_SOURCE = "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures";
export const EQUIPMENT = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer", "toaster", "microwave", "microwave-safe-bowl", "microwave-safe-cover", "knife", "cutting-board", "saucepan", "strainer", "bowl", "spoon", "measuring-tools", "blender", "tongs", "clean-serving-plate", "raw-poultry-board", "can-opener", "saucepan-lid", "oven", "sheet-pan", "oven-mitts", "fork", "raw-seafood-board", "raw-meat-board", "nonstick-oven-safe-sheet-pan"] as const;
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
const wrapsBowls: Definition[] = [
  { id: "southwest-chicken-wrap", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 6, "oz"], ["flour-tortillas", 1, "each"], ["black-beans", 3, "oz"], ["salsa", 1, "oz"], ["taco-seasoning", 5, "g"], ["avocados", 0.5, "each"]], methods: [
    { id: "stovetop-wrap", equipment: ["stovetop", "nonstick-pan", "spatula", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "can-opener", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: [
      "Wash the avocado skin before cutting. Remove the pit and skin from the declared half avocado and slice its edible flesh on the produce board. Measure 1 oz salsa and keep both away from raw poultry.",
      "Open the bean can. Measure 3 oz canned black beans including any packing liquid, and warm the whole measured portion in the nonstick pan according to its package. Keep it in the clean bowl; do not substitute 3 oz dry beans or discard part of the measured portion. Warm one flour tortilla in the dry pan according to its package and set it on the clean plate.",
      "Measure 6 oz raw chicken before cooking; do not wash it. Dice it on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook it with all 5 g declared taco seasoning in the nonstick pan, using a little water as needed without added oil, until a food thermometer reads 165 F throughout. Stricter package directions win; minutes or color alone are not proof.",
      "Using clean utensils, fill the tortilla with all the cooked chicken and seasoning, beans, salsa and avocado flesh. Roll and serve. Do not substitute a cooked chicken weight."
    ] }
  ] },
  { id: "southwest-chicken-wrap-tofu", sourceMethod: false, seasoning: "Black pepper", rows: [["tofu", 7, "oz"], ["flour-tortillas", 1, "each"], ["black-beans", 3, "oz"], ["salsa", 1, "oz"], ["taco-seasoning", 5, "g"], ["avocados", 0.5, "each"]], methods: [
    { id: "stovetop-tofu-wrap", equipment: ["stovetop", "nonstick-pan", "spatula", "knife", "cutting-board", "can-opener", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: [
      "Wash the avocado skin, remove pit and skin from the declared half and slice the edible flesh. Measure 1 oz salsa.",
      "Open the bean can. Measure 3 oz canned black beans including any packing liquid, warm the whole measured portion in the pan according to its package and keep it in the bowl. Do not substitute dry beans or discard part of the measured portion. Warm one flour tortilla in the dry pan according to its package and set it on the clean plate.",
      "Measure 7 oz tofu before cooking, pat it dry and dice it without substituting a cooked weight. Cook it with all 5 g declared taco seasoning in the nonstick pan without added oil, using a little water if needed, until hot and the tofu package cooking requirements are satisfied. No raw-chicken method, poultry temperature or chicken is used.",
      "Fill the tortilla with all the tofu and seasoning, beans, salsa and avocado flesh. Roll and serve."
    ] }
  ] },
  { id: "southwest-chicken-wrap-corn", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 6, "oz"], ["corn-tortillas", 3, "each"], ["black-beans", 3, "oz"], ["salsa", 1, "oz"], ["taco-seasoning", 5, "g"], ["avocados", 0.5, "each"]], methods: [
    { id: "stovetop-corn-tacos", equipment: ["stovetop", "nonstick-pan", "spatula", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "can-opener", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: [
      "Wash the avocado skin, remove pit and skin from the declared half and slice its edible flesh on the produce board. Measure 1 oz salsa and keep both away from raw poultry.",
      "Open the bean can. Measure 3 oz canned black beans including any packing liquid, warm the whole measured portion in the pan according to its package and keep it in the bowl. Do not substitute dry beans or discard part of the measured portion. Warm all three corn tortillas in the dry pan according to their package and set them on the clean plate.",
      "Measure 6 oz raw chicken before cooking; do not wash it. Dice it on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook with all 5 g declared taco seasoning in the pan without added oil, using a little water if needed, until a food thermometer reads 165 F throughout; stricter package directions win. Time or color alone is not proof.",
      "Use clean utensils to divide all the chicken and seasoning, beans, salsa and avocado flesh between the three corn tortillas and serve. No flour tortilla or cooked-weight substitution is used."
    ] }
  ] },
  { id: "chicken-burrito-bowl", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 8, "oz"], ["white-rice", 60, "g"], ["black-beans", 3, "oz"], ["salsa", 2, "oz"], ["taco-seasoning", 5, "g"], ["avocados", 0.5, "each"]], methods: [
    { id: "stovetop-rice-bowl", equipment: ["stovetop", "saucepan", "saucepan-lid", "nonstick-pan", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "can-opener", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: [
      "Measure 60 g dry rice before cooking. Cook in water in the saucepan, covering as its package directs, until tender; do not substitute 60 g cooked rice. Wash the avocado skin, remove pit and skin from the declared half, slice its edible flesh on the produce board and measure 2 oz salsa. Keep them away from raw poultry.",
      "Open the bean can. Measure 3 oz canned black beans including any packing liquid, warm the whole measured portion in the nonstick pan according to its package and keep it on the clean plate. Do not substitute dry beans or discard part of the measured portion.",
      "Measure 8 oz raw chicken before cooking; do not wash it. Dice it on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook with all 5 g declared taco seasoning in the nonstick pan without added oil, using a little water if needed, until a food thermometer reads 165 F throughout; stricter package directions win. Time or color alone is not proof.",
      "Using clean utensils, serve all the cooked rice, chicken and seasoning, beans, salsa and avocado flesh in the bowl. Do not substitute a cooked chicken weight."
    ] }
  ] },
  { id: "chicken-burrito-bowl-tofu", sourceMethod: false, seasoning: "Black pepper", rows: [["tofu", 7, "oz"], ["white-rice", 60, "g"], ["black-beans", 3, "oz"], ["salsa", 2, "oz"], ["taco-seasoning", 5, "g"], ["avocados", 0.5, "each"]], methods: [
    { id: "stovetop-tofu-rice-bowl", equipment: ["stovetop", "saucepan", "saucepan-lid", "nonstick-pan", "spatula", "knife", "cutting-board", "can-opener", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: [
      "Measure 60 g dry rice and cook it in water in the saucepan, covering as its package directs, until tender; do not substitute a cooked weight. Wash the avocado skin, remove pit and skin from the declared half, slice its edible flesh and measure 2 oz salsa.",
      "Open the bean can. Measure 3 oz canned black beans including any packing liquid, warm the whole measured portion in the nonstick pan according to its package and keep it on the clean plate. Do not substitute dry beans or discard part of the measured portion.",
      "Measure 7 oz tofu before cooking, pat it dry and dice it without substituting a cooked weight. Cook with all 5 g declared taco seasoning in the nonstick pan without added oil, using a little water as needed, until hot and the tofu package cooking requirements are satisfied. No chicken, raw-poultry handling or poultry temperature is used.",
      "Serve all the rice, tofu and seasoning, beans, salsa and avocado flesh in the bowl."
    ] }
  ] },
  { id: "chicken-burrito-bowl-quinoa", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 8, "oz"], ["quinoa", 50, "g"], ["black-beans", 3, "oz"], ["salsa", 2, "oz"], ["taco-seasoning", 5, "g"], ["avocados", 0.5, "each"]], methods: [
    { id: "stovetop-quinoa-burrito-bowl", equipment: ["stovetop", "saucepan", "saucepan-lid", "strainer", "nonstick-pan", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "can-opener", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: [
      "Measure 50 g dry quinoa, rinse it in a fine strainer and cook in water in the saucepan, covering as the package directs, until tender. Do not substitute 50 g cooked quinoa or rice. Wash the avocado skin, remove pit and skin from the declared half, slice its edible flesh on the produce board and measure 2 oz salsa; keep both away from raw poultry.",
      "Open the bean can. Measure 3 oz canned black beans including any packing liquid, warm the whole measured portion in the nonstick pan according to its package and keep it on the clean plate. Do not substitute dry beans or discard part of the measured portion.",
      "Measure 8 oz raw chicken before cooking; do not wash it. Dice it on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook with all 5 g declared taco seasoning in the nonstick pan without added oil, using a little water if needed, until a food thermometer reads 165 F throughout; stricter package directions win. Time or color alone is not proof.",
      "Using clean utensils, serve all the quinoa, cooked chicken and seasoning, beans, salsa and avocado flesh in the bowl. Do not substitute a cooked chicken weight."
    ] }
  ] },
  { id: "mediterranean-chicken-bowl-with-tzatziki", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 6, "oz"], ["quinoa", 60, "g"], ["tzatziki", 2, "oz"], ["cucumber", 0.25, "each"], ["tomatoes", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-quinoa-tzatziki-bowl", equipment: ["stovetop", "saucepan", "saucepan-lid", "strainer", "nonstick-pan", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "bowl", "spoon", "measuring-tools"], steps: [
      "Measure 60 g dry quinoa, rinse it in a fine strainer and cook in water in the saucepan, covering as the package directs, until tender; do not substitute a cooked weight.",
      "Wash the cucumber and tomatoes under running water. Chop the declared quarter cucumber and 2 oz tomatoes on the clean produce board and put them in the bowl. Measure all 2 oz packaged ready-to-eat tzatziki and keep it and the vegetables away from raw poultry.",
      "Measure 6 oz raw chicken before cooking; do not wash it. Dice it on the separate raw-poultry board, wash hands and clean raw-contact utensils. Heat the measured 1 tsp olive oil in the nonstick pan and cook all the chicken until a food thermometer reads 165 F throughout; stricter package directions win. Time or color alone is not proof.",
      "Using clean utensils, add all the quinoa and cooked chicken with the measured pan oil to the vegetables, top with all the tzatziki and serve. Do not substitute a cooked chicken weight or add unlisted dressing."
    ] }
  ] },
  { id: "mediterranean-chicken-bowl-with-tzatziki-tofu", sourceMethod: false, seasoning: "Black pepper", rows: [["tofu", 7, "oz"], ["quinoa", 60, "g"], ["hummus", 2, "oz"], ["cucumber", 0.25, "each"], ["tomatoes", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-quinoa-hummus-bowl", equipment: ["stovetop", "saucepan", "saucepan-lid", "strainer", "nonstick-pan", "spatula", "knife", "cutting-board", "bowl", "spoon", "measuring-tools"], steps: [
      "Measure 60 g dry quinoa, rinse it in a fine strainer and cook in water in the saucepan, covering as the package directs, until tender; do not substitute a cooked weight.",
      "Wash the cucumber and tomatoes under running water. Chop the declared quarter cucumber and 2 oz tomatoes on the clean board and put them in the bowl. Measure 2 oz packaged ready-to-eat hummus; no tzatziki is used.",
      "Measure 7 oz tofu before cooking, pat it dry and dice it without substituting a cooked weight. Heat the measured 1 tsp olive oil in the nonstick pan and cook the tofu until hot and lightly browned, satisfying its package cooking requirements. No chicken, raw-poultry method or poultry temperature is used.",
      "Add all the quinoa and tofu with the measured pan oil to the vegetables, top with all the hummus and serve. Do not add unlisted dressing."
    ] }
  ] },
  { id: "mediterranean-chicken-bowl-with-tzatziki-wrap", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 6, "oz"], ["flour-tortillas", 1, "each"], ["tzatziki", 2, "oz"], ["cucumber", 0.25, "each"], ["tomatoes", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-tzatziki-wrap", equipment: ["stovetop", "nonstick-pan", "spatula", "tongs", "food-thermometer", "knife", "cutting-board", "raw-poultry-board", "bowl", "spoon", "measuring-tools", "clean-serving-plate"], steps: [
      "Wash the cucumber and tomatoes under running water. Chop the declared quarter cucumber and 2 oz tomatoes on the produce board and put them in the bowl. Measure 2 oz packaged ready-to-eat tzatziki and keep it and the vegetables away from raw poultry.",
      "Warm one flour tortilla in the dry nonstick pan according to its package and set it on the clean plate. No quinoa is cooked or added.",
      "Measure 6 oz raw chicken before cooking; do not wash it. Dice it on the separate raw-poultry board, wash hands and clean raw-contact utensils. Heat the measured 1 tsp olive oil in the pan and cook all the chicken until a food thermometer reads 165 F throughout; stricter package directions win. Time or color alone is not proof.",
      "Using clean utensils, spread all the tzatziki on the tortilla and fill with all the cooked chicken with the measured pan oil and all the vegetables. Roll and serve. Do not substitute a cooked chicken weight or add unlisted dressing."
    ] }
  ] }
];
definitions.push(...wrapsBowls);
// Six existing families only. Each variant has an explicit method and exact rows.
// No materialized source, nutrition, pack or price facts are changed by this adjunct.
const nextSix: Definition[] = [
  { id: "turkey-and-avocado-sandwich-on-whole-wheat", sourceMethod: false, seasoning: "Black pepper", rows: [["deli-turkey", 7, "oz"], ["ww-bread", 2, "oz"], ["avocados", 0.5, "each"], ["tomatoes", 2, "oz"], ["hummus", 1, "oz"]], methods: [
    { id: "pan-toast-deli-sandwich", equipment: ["stovetop", "nonstick-pan", "spatula", "knife", "cutting-board", "clean-serving-plate", "spoon", "measuring-tools"], steps: [
      "Wash the avocado skin and tomatoes under running water. Remove pit and skin from the declared half avocado and slice its edible flesh; slice all 2 oz tomatoes on the clean board.",
      "Toast 2 oz whole-wheat bread in the dry nonstick pan, turning until lightly browned, then set it on the clean plate. No extra oil is required.",
      "Measure 7 oz packaged ready-to-eat deli turkey and 1 oz ready-to-eat hummus. Follow their package handling directions; this cold assembly requires ready-to-eat products, not raw turkey.",
      "Spread all the hummus on the bread, stack all the turkey, avocado flesh and tomatoes between the bread and serve."
    ] }
  ] },
  { id: "turkey-and-avocado-sandwich-on-whole-wheat-tempeh", sourceMethod: false, seasoning: "Black pepper", rows: [["tempeh", 6, "oz"], ["ww-bread", 2, "oz"], ["avocados", 0.5, "each"], ["tomatoes", 2, "oz"], ["hummus", 1, "oz"]], methods: [
    { id: "pan-toast-tempeh-sandwich", equipment: ["stovetop", "nonstick-pan", "spatula", "knife", "cutting-board", "clean-serving-plate", "spoon", "measuring-tools", "food-thermometer"], steps: [
      "Wash the avocado skin and tomatoes under running water. Remove pit and skin from the declared half avocado and slice its edible flesh; slice all 2 oz tomatoes. Measure 1 oz ready-to-eat hummus.",
      "Toast 2 oz whole-wheat bread in the dry nonstick pan and set it on the clean plate.",
      "Measure 6 oz tempeh before cooking and slice into thin slabs. Cook in the nonstick pan with water as needed, satisfying the tempeh package cooking and any temperature requirements, then let the water evaporate and brown lightly. No unlisted oil or raw-turkey method is used.",
      "Spread all the hummus on the bread and fill with all the cooked tempeh, avocado flesh and tomatoes. Serve without substituting a cooked tempeh weight."
    ] }
  ] },
  { id: "turkey-and-avocado-sandwich-on-whole-wheat-wrap", sourceMethod: false, seasoning: "Black pepper", rows: [["deli-turkey", 7, "oz"], ["flour-tortillas", 1, "each"], ["avocados", 0.5, "each"], ["tomatoes", 2, "oz"], ["hummus", 1, "oz"]], methods: [
    { id: "ready-deli-wrap", equipment: ["knife", "cutting-board", "clean-serving-plate", "spoon", "measuring-tools"], steps: [
      "Wash the avocado skin and tomatoes under running water. Remove pit and skin from the declared half avocado and slice its edible flesh; slice all 2 oz tomatoes on the clean board.",
      "Measure 7 oz packaged ready-to-eat deli turkey and 1 oz ready-to-eat hummus. Follow their package handling directions; no raw turkey is used.",
      "Use one packaged ready-to-eat flour tortilla whose directions permit eating without heating. Spread with all the hummus, add all the turkey, avocado flesh and tomatoes, roll and serve. No bread, oil or appliance is required."
    ] }
  ] },
  { id: "tuna-salad-wrap", sourceMethod: false, seasoning: "Black pepper", rows: [["canned-tuna", 5, "oz"], ["avocados", 0.5, "each"], ["hummus", 1, "oz"], ["flour-tortillas", 1, "each"], ["romaine", 0.25, "each"]], methods: [
    { id: "ready-tuna-wrap", equipment: ["can-opener", "strainer", "knife", "cutting-board", "bowl", "fork", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Wash the avocado skin and the declared quarter head of romaine under running water. Remove pit and skin from the half avocado; chop all the quarter romaine on the clean board.",
      "Clean the can lid, open and drain the canned tuna. Measure 5 oz drained ready-to-eat tuna, not 5 oz packing liquid or unopened can weight; one nominal 5 oz can is not proof of this drained yield. Follow package handling directions.",
      "Mash all the tuna and the half avocado edible flesh with all 1 oz ready-to-eat hummus in the bowl.",
      "Use one packaged ready-to-eat flour tortilla whose directions permit eating without heating. Fill with all the salad and chopped romaine, roll and serve. No extra dressing or oil is needed."
    ] }
  ] },
  { id: "tuna-salad-wrap-chicken", sourceMethod: false, seasoning: "Black pepper", rows: [["canned-chicken", 6, "oz"], ["avocados", 0.5, "each"], ["hummus", 1, "oz"], ["flour-tortillas", 1, "each"], ["romaine", 0.25, "each"]], methods: [
    { id: "ready-canned-chicken-wrap", equipment: ["can-opener", "strainer", "knife", "cutting-board", "bowl", "fork", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Wash the avocado skin and the declared quarter head of romaine under running water. Remove pit and skin from the half avocado; chop all the quarter romaine on the clean board.",
      "Clean the can lid, open and drain the packaged fully cooked ready-to-eat canned chicken. Measure 6 oz chicken meat after draining, not can or broth weight; follow package handling directions. This is canned chicken, not raw chicken breast or tuna.",
      "Mash all the chicken meat and half avocado edible flesh with all 1 oz ready-to-eat hummus in the bowl.",
      "Use one packaged ready-to-eat flour tortilla whose directions permit eating without heating. Fill with all the chicken salad and romaine, roll and serve without extra dressing or oil."
    ] }
  ] },
  { id: "tuna-salad-wrap-rice", sourceMethod: false, seasoning: "Black pepper", rows: [["canned-tuna", 5, "oz"], ["avocados", 0.5, "each"], ["hummus", 1, "oz"], ["white-rice", 60, "g"], ["romaine", 0.25, "each"]], methods: [
    { id: "stovetop-tuna-rice", equipment: ["stovetop", "saucepan", "saucepan-lid", "can-opener", "strainer", "knife", "cutting-board", "bowl", "fork", "spoon", "measuring-tools"], steps: [
      "Measure 60 g dry rice and cook in water in the saucepan, covering as its package directs, until tender. Do not substitute a cooked rice weight or a tortilla.",
      "Wash the avocado skin and the declared quarter head of romaine under running water. Remove pit and skin from the half avocado and chop all the quarter romaine on the clean board.",
      "Clean the can lid, open and drain the canned tuna. Measure 5 oz drained ready-to-eat tuna, not packing liquid or unopened can weight; one nominal 5 oz can is not proof of drained yield. Follow package handling directions. Mash with all the half avocado edible flesh and 1 oz ready-to-eat hummus.",
      "Serve all the cooked rice topped with all the tuna salad and chopped romaine. No extra oil or dressing is needed."
    ] }
  ] },
  { id: "turkey-taco-bowl", sourceMethod: false, seasoning: "Black pepper", rows: [["ground-turkey", 6, "oz"], ["white-rice", 60, "g"], ["black-beans", 4, "oz"], ["taco-seasoning", 7, "g"], ["salsa", 2, "oz"]], methods: [
    { id: "stovetop-ground-turkey-rice", equipment: ["stovetop", "saucepan", "saucepan-lid", "nonstick-pan", "spatula", "food-thermometer", "can-opener", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Measure 60 g dry rice and cook in water in the saucepan, covering as its package directs, until tender. Do not substitute cooked weight.",
      "Clean the bean can lid and open it. Measure 4 oz canned black beans including any packing liquid, warm the entire measured portion in the pan as its package directs and set on the clean plate. Measure 2 oz ready-to-eat salsa; do not substitute dry beans.",
      "Measure 6 oz raw ground turkey before cooking. Keep it separate from cooked rice, beans and salsa. Cook in the nonstick pan without added oil, breaking it up with all 7 g taco seasoning and a little water if needed, until a food thermometer reads 165 F throughout; stricter package directions win. Wash hands and clean raw-contact utensils; time or browning alone is not doneness.",
      "With clean utensils, serve all the rice, cooked turkey and seasoning, beans and salsa in the bowl. Do not replace the raw turkey quantity with a cooked weight."
    ] }
  ] },
  { id: "turkey-taco-bowl-lentil", sourceMethod: false, seasoning: "Black pepper", rows: [["lentils", 120, "g"], ["white-rice", 60, "g"], ["black-beans", 4, "oz"], ["taco-seasoning", 7, "g"], ["salsa", 2, "oz"]], methods: [
    { id: "stovetop-dry-lentil-rice", equipment: ["stovetop", "saucepan", "saucepan-lid", "strainer", "nonstick-pan", "spatula", "can-opener", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Measure 120 g dry lentils, sort and rinse in the strainer, then simmer in water in the saucepan as the lentil package directs until fully tender. Drain any excess water and keep all the cooked lentils in the bowl; 120 g cooked lentils is not a substitute.",
      "In the saucepan, cook the measured 60 g dry rice in water, covering as its package directs, until tender. Keep all the cooked rice on the clean plate; no cooked-weight shortcut.",
      "Clean the bean can lid and open it. Measure 4 oz canned black beans including any packing liquid and warm the entire measured portion in the nonstick pan as its package directs. Add all the cooked lentils and 7 g taco seasoning with water if needed and stir until hot. No turkey method, poultry temperature or extra oil is used.",
      "Serve all the rice, lentils and seasoning, beans and 2 oz ready-to-eat salsa in the bowl. Do not discard lentils to force a claimed portion or yield."
    ] }
  ] },
  { id: "turkey-taco-bowl-tacos", sourceMethod: false, seasoning: "Black pepper", rows: [["ground-turkey", 6, "oz"], ["corn-tortillas", 3, "each"], ["black-beans", 4, "oz"], ["taco-seasoning", 7, "g"], ["salsa", 2, "oz"]], methods: [
    { id: "stovetop-ground-turkey-tacos", equipment: ["stovetop", "nonstick-pan", "spatula", "food-thermometer", "can-opener", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Warm all three corn tortillas in the dry pan as their package directs and keep them on the clean plate. No rice is used.",
      "Clean the bean can lid and open it. Measure 4 oz canned black beans including any packing liquid and warm the entire measured portion in the pan as its package directs; keep in the bowl with 2 oz ready-to-eat salsa, away from raw turkey.",
      "Measure 6 oz raw ground turkey before cooking and keep separate from ready food. Cook in the nonstick pan without added oil, breaking it up with all 7 g taco seasoning and water if needed, until a food thermometer reads 165 F throughout; stricter package directions win. Wash hands and clean raw-contact utensils; time or color is not proof.",
      "With clean utensils, fill all three tortillas with all the cooked turkey and seasoning, beans and salsa. Do not substitute a cooked turkey weight."
    ] }
  ] },
  { id: "teriyaki-chicken-and-broccoli-rice-bowl", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 10, "oz"], ["white-rice", 65, "g"], ["frozen-broccoli", 4, "oz"], ["teriyaki-sauce", 2, "tbsp"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-teriyaki-chicken-rice", equipment: ["stovetop", "saucepan", "saucepan-lid", "nonstick-pan", "spatula", "tongs", "food-thermometer", "knife", "raw-poultry-board", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Measure 65 g dry rice and cook in water in the saucepan, covering as its package directs, until tender. Do not substitute cooked weight.",
      "Cook the measured 4 oz frozen broccoli in the nonstick pan with water as needed, satisfying its package cooking directions; keep all on the clean plate away from raw poultry.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Dice on the raw-poultry board, wash hands and clean raw-contact utensils. Heat the measured 1 tsp olive oil in the pan and cook all the chicken until a food thermometer reads 165 F throughout; stricter package directions win. Time or browning is not proof.",
      "Using clean utensils, return all the broccoli to the cooked chicken and measured pan oil, add all 2 tbsp teriyaki sauce and heat as the sauce package directs. Serve everything over all the cooked rice without adding unlisted sauce or substituting a cooked chicken weight."
    ] }
  ] },
  { id: "teriyaki-chicken-and-broccoli-rice-bowl-tofu", sourceMethod: false, seasoning: "Black pepper", rows: [["tofu", 9, "oz"], ["white-rice", 65, "g"], ["frozen-broccoli", 4, "oz"], ["teriyaki-sauce", 2, "tbsp"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-teriyaki-tofu-rice", equipment: ["stovetop", "saucepan", "saucepan-lid", "nonstick-pan", "spatula", "knife", "cutting-board", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Measure 65 g dry rice and cook in water in the saucepan, covering as its package directs, until tender. Do not substitute cooked weight.",
      "Cook the measured 4 oz frozen broccoli in the nonstick pan with water as needed, satisfying its package directions; keep all on the clean plate.",
      "Measure 9 oz tofu before cooking, pat dry and dice on the clean board. Heat the measured 1 tsp olive oil in the pan and cook all the tofu until hot and lightly browned, satisfying its package cooking requirements. No chicken or poultry temperature is used.",
      "Return all the broccoli to the tofu and measured pan oil, add all 2 tbsp teriyaki sauce and heat as the sauce package directs. Serve everything over all the rice without unlisted sauce or a cooked tofu weight substitution."
    ] }
  ] },
  { id: "teriyaki-chicken-and-broccoli-rice-bowl-quinoa", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 10, "oz"], ["quinoa", 60, "g"], ["frozen-broccoli", 4, "oz"], ["teriyaki-sauce", 2, "tbsp"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-teriyaki-chicken-quinoa", equipment: ["stovetop", "saucepan", "saucepan-lid", "strainer", "nonstick-pan", "spatula", "tongs", "food-thermometer", "knife", "raw-poultry-board", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Measure 60 g dry quinoa, rinse in the strainer and cook in water in the saucepan, covering as its package directs, until tender. Do not substitute rice or cooked weight.",
      "Cook the measured 4 oz frozen broccoli in the nonstick pan with water as needed, satisfying its package cooking directions; keep all on the clean plate away from raw poultry.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Dice on the raw-poultry board, wash hands and clean raw-contact utensils. Heat the measured 1 tsp olive oil in the pan and cook all the chicken until a food thermometer reads 165 F throughout; stricter package directions win. Time or browning is not proof.",
      "Using clean utensils, return all the broccoli to the cooked chicken and measured pan oil, add all 2 tbsp teriyaki sauce and heat as its package directs. Serve everything over all the quinoa without unlisted sauce or a cooked chicken weight substitution."
    ] }
  ] },
  { id: "chicken-fajita-bowl", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 9, "oz"], ["frozen-peppers-onions", 5, "oz"], ["white-rice", 60, "g"], ["taco-seasoning", 7, "g"], ["salsa", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-chicken-fajita-rice", equipment: ["stovetop", "saucepan", "saucepan-lid", "nonstick-pan", "spatula", "tongs", "food-thermometer", "knife", "raw-poultry-board", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Measure 60 g dry rice and cook in water in the saucepan, covering as its package directs, until tender. Do not substitute cooked weight.",
      "Cook all 5 oz frozen peppers and onions in the nonstick pan with water as needed, satisfying their package cooking directions; keep on the clean plate. Measure 2 oz ready-to-eat salsa and keep away from raw poultry.",
      "Measure 9 oz raw chicken before cooking; do not wash it. Slice on the raw-poultry board, wash hands and clean raw-contact utensils. Heat the measured 1 tsp olive oil and cook the chicken with all 7 g taco seasoning until a food thermometer reads 165 F throughout; stricter package directions win. Time or charring alone is not proof.",
      "Using clean utensils, return all the vegetables to the cooked chicken and measured pan oil and stir until hot. Serve all over all the rice with all the salsa; no cooked chicken weight substitution or extra oil."
    ] }
  ] },
  { id: "chicken-fajita-bowl-shrimp", sourceMethod: false, seasoning: "Black pepper", rows: [["frozen-shrimp", 8, "oz"], ["frozen-peppers-onions", 5, "oz"], ["white-rice", 60, "g"], ["taco-seasoning", 7, "g"], ["salsa", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-shrimp-fajita-rice", equipment: ["stovetop", "saucepan", "saucepan-lid", "nonstick-pan", "spatula", "tongs", "food-thermometer", "raw-seafood-board", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Thaw the peeled raw shrimp in the refrigerator as its package directs, then measure 8 oz thawed raw edible shrimp before cooking, excluding ice glaze or discarded liquid; do not substitute a cooked weight. Keep on the raw-seafood board away from ready food and follow package handling directions.",
      "Measure 60 g dry rice and cook in water in the saucepan, covering as its package directs, until tender. Cook all 5 oz frozen peppers and onions in the nonstick pan with water as needed, satisfying their package cooking directions; keep on the clean plate. Measure 2 oz ready-to-eat salsa.",
      "Heat the measured 1 tsp olive oil in the pan and cook all the shrimp with all 7 g taco seasoning until the flesh is pearly or white and opaque throughout, meeting any stricter package cooking and thermometer temperature requirements. Wash hands and clean raw-contact utensils. Time alone is not proof; no poultry temperature or chicken method is used.",
      "Using clean utensils, return all the vegetables to the cooked shrimp and measured pan oil and stir until hot. Serve all over all the rice with all the salsa, without extra oil."
    ] }
  ] },
  { id: "chicken-fajita-bowl-tortillas", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 9, "oz"], ["frozen-peppers-onions", 5, "oz"], ["flour-tortillas", 2, "each"], ["taco-seasoning", 7, "g"], ["salsa", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "stovetop-chicken-fajita-tortillas", equipment: ["stovetop", "nonstick-pan", "spatula", "tongs", "food-thermometer", "knife", "raw-poultry-board", "bowl", "spoon", "clean-serving-plate", "measuring-tools"], steps: [
      "Warm both flour tortillas in the dry pan as their package directs and keep on the clean plate. No rice is used.",
      "Cook all 5 oz frozen peppers and onions in the pan with water as needed, satisfying their package cooking directions; keep in the bowl. Measure 2 oz ready-to-eat salsa and keep away from raw poultry.",
      "Measure 9 oz raw chicken before cooking; do not wash it. Slice on the raw-poultry board, wash hands and clean raw-contact utensils. Heat the measured 1 tsp olive oil and cook all the chicken with all 7 g taco seasoning until a food thermometer reads 165 F throughout; stricter package directions win. Time or charring alone is not proof.",
      "Using clean utensils, return all the vegetables to the cooked chicken and measured pan oil and stir until hot. Fill both tortillas with all the chicken, vegetables and salsa; do not substitute cooked chicken weight or add extra oil."
    ] }
  ] },
  { id: "sheet-pan-chicken-with-sweet-potato-and-broccoli", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 10, "oz"], ["sweet-potatoes", 8, "oz"], ["frozen-broccoli", 4, "oz"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "oven-chicken-sweet-potato", equipment: ["oven", "sheet-pan", "oven-mitts", "knife", "cutting-board", "raw-poultry-board", "tongs", "spoon", "measuring-tools", "food-thermometer", "fork", "clean-serving-plate"], steps: [
      "Heat the oven to 425 F unless stricter package cooking directions require otherwise. Wash and scrub the sweet potato, measure 8 oz raw edible potato before cooking and cube on the clean produce board. Keep edible skin; do not substitute cooked weight.",
      "Measure 1 tbsp olive oil total. Toss all the sweet potato with half on the sheet pan and start roasting until beginning to soften; this is an intermediate texture check, not a fixed cooking time.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils. Add all the chicken and 4 oz frozen broccoli with the remaining half oil to the sheet pan, keeping raw-contact tools separate from serving tools.",
      "Continue roasting until chicken measures 165 F throughout with a food thermometer, the potato is fork-tender and the broccoli satisfies its package cooking requirements; stricter package directions win. Time alone is not proof. Use oven mitts and clean utensils to serve all the chicken, potato, broccoli and measured pan oil on the clean plate."
    ] }
  ] },
  { id: "sheet-pan-chicken-with-sweet-potato-and-broccoli-tofu", sourceMethod: false, seasoning: "Black pepper", rows: [["tofu", 9, "oz"], ["sweet-potatoes", 8, "oz"], ["frozen-broccoli", 4, "oz"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "oven-tofu-sweet-potato", equipment: ["oven", "sheet-pan", "oven-mitts", "knife", "cutting-board", "spatula", "spoon", "measuring-tools", "fork", "clean-serving-plate", "food-thermometer"], steps: [
      "Heat the oven to 425 F unless stricter package cooking directions require otherwise. Wash and scrub the sweet potato, measure 8 oz raw edible potato before cooking and cube on the clean board. Keep edible skin; do not substitute cooked weight.",
      "Measure 1 tbsp olive oil total. Toss all the potato with half on the sheet pan and start roasting until beginning to soften. Measure 9 oz tofu before cooking, pat dry and cube.",
      "Add all the tofu and 4 oz frozen broccoli with the remaining half oil to the sheet pan. Roast until the potato is fork-tender and tofu and broccoli meet their package cooking and any thermometer temperature requirements; time or browning alone is not proof. No chicken, raw-poultry board or poultry temperature is used.",
      "Use oven mitts and clean utensils to serve all the tofu, potato, broccoli and measured pan oil on the clean plate. Do not substitute cooked potato or tofu weights."
    ] }
  ] },
  { id: "sheet-pan-chicken-with-sweet-potato-and-broccoli-potatoes", sourceMethod: false, seasoning: "Black pepper", rows: [["chicken-breast", 10, "oz"], ["russet-potatoes", 8, "oz"], ["frozen-broccoli", 4, "oz"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "oven-chicken-russet-potato", equipment: ["oven", "sheet-pan", "oven-mitts", "knife", "cutting-board", "raw-poultry-board", "tongs", "spoon", "measuring-tools", "food-thermometer", "fork", "clean-serving-plate"], steps: [
      "Heat the oven to 425 F unless stricter package cooking directions require otherwise. Wash and scrub the russet potato, measure 8 oz raw edible potato before cooking and cube on the clean produce board. Keep edible skin; no sweet potato or cooked-weight substitute is used.",
      "Measure 1 tbsp olive oil total. Toss all the russet potato with half on the sheet pan and start roasting until beginning to soften; this is not a fixed cooking time.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils. Add all the chicken and 4 oz frozen broccoli with the remaining half oil to the sheet pan, keeping raw-contact tools separate from serving tools.",
      "Continue roasting until chicken measures 165 F throughout with a food thermometer, the russet potato is fork-tender and broccoli satisfies its package cooking requirements; stricter package directions win. Time alone is not proof. Use oven mitts and clean utensils to serve all the chicken, potato, broccoli and measured pan oil on the clean plate."
    ] }
  ] }
];
definitions.push(...nextSix);
// Remaining finite methods. Bone-in thigh barbecue rows stay held: their edible
// quantity basis is unresolved. No pack/bone yield is inferred by this adjunct.
const panTools: Equipment[] = ["stovetop", "nonstick-pan", "spatula", "knife", "cutting-board", "measuring-tools", "clean-serving-plate"];
const grainTools: Equipment[] = ["saucepan", "saucepan-lid", "spoon"];
const poultryTools: Equipment[] = ["raw-poultry-board", "food-thermometer"];
const seafoodTools: Equipment[] = ["raw-seafood-board", "food-thermometer"];
const roastTools: Equipment[] = ["oven", "sheet-pan", "oven-mitts", "knife", "cutting-board", "tongs", "measuring-tools", "food-thermometer", "fork", "clean-serving-plate"];
const breadingTools: Equipment[] = [...roastTools.filter(tool => tool !== "sheet-pan" && tool !== "fork"), "nonstick-oven-safe-sheet-pan"];
const remaining: Definition[] = [
  { id: "turkey-chili", sourceMethod: false, rows: [["ground-turkey", 8, "oz"], ["kidney-beans", 4, "oz"], ["canned-tomatoes", 7, "oz"], ["onions", 2, "oz"], ["bell-peppers", 0.5, "each"], ["taco-seasoning", 10, "g"]], methods: [
    { id: "turkey-chili-pan", equipment: [...panTools, "food-thermometer", "can-opener", "strainer", "spoon"], steps: [
      "Wash the half bell pepper, remove stem and seeds and dice its edible flesh. Peel and dice 2 oz edible onion. Clean can lids, open and drain the canned kidney beans, then measure 4 oz drained solids. Measure 7 oz canned tomatoes including their tomato juice; no drained-yield conversion is certified.",
      "Measure 8 oz raw ground turkey before cooking. Cook in a nonstick pan without added oil, breaking it up with the spatula until a food thermometer reads 165 F throughout. Wash hands and clean raw-contact utensils; do not use cooked weight or drain away measured meat juices.",
      "Add all the onion, pepper, tomatoes, beans and 10 g taco seasoning. Add water as needed to prevent sticking and simmer until the vegetables are tender and all package cooking requirements are met; stricter package directions win, not a fixed time.",
      "Use clean utensils to serve all the chili, including the sauce. No optional seasoning is needed to complete it."
    ] }
  ] },
  { id: "turkey-chili-lentil", sourceMethod: false, rows: [["lentils", 130, "g"], ["kidney-beans", 5, "oz"], ["canned-tomatoes", 7, "oz"], ["onions", 2, "oz"], ["bell-peppers", 0.5, "each"], ["taco-seasoning", 10, "g"]], methods: [
    { id: "lentil-chili", equipment: ["stovetop", ...grainTools, "strainer", "knife", "cutting-board", "can-opener", "measuring-tools", "bowl"], steps: [
      "Measure 130 g dry lentils, sort and rinse, then cook in water in the saucepan according to their package until fully tender. This is not 130 g cooked lentils. Reserve all cooked lentils; do not infer a cooked yield.",
      "Wash and dice the edible flesh of the half bell pepper. Peel and dice 2 oz edible onion. Clean can lids, open and drain kidney beans, then measure 5 oz drained solids. Measure 7 oz canned tomatoes including their juice; package draining yield remains unverified.",
      "Add all the vegetables, beans, tomatoes and 10 g taco seasoning to the lentils. Simmer with enough water to prevent sticking until the onion and pepper are tender and stricter package cooking directions are met. No turkey or unlisted oil is used.",
      "Spoon all the chili and sauce into the bowl and serve; the dry lentil quantity has not been replaced with a cooked weight."
    ] }
  ] },
  { id: "turkey-chili-potato", sourceMethod: false, rows: [["ground-turkey", 8, "oz"], ["russet-potatoes", 8, "oz"], ["canned-tomatoes", 7, "oz"], ["onions", 2, "oz"], ["bell-peppers", 0.5, "each"], ["taco-seasoning", 10, "g"]], methods: [
    { id: "turkey-potato-chili", equipment: [...panTools, ...grainTools, "strainer", "fork", "food-thermometer", "can-opener"], steps: [
      "Wash and scrub the russet potato, measure 8 oz raw edible potato with edible skin and dice. Simmer in water in a saucepan until fork-tender, then drain. Wash and dice the edible half bell pepper; peel and dice 2 oz edible onion. Clean the tomato can lid and measure 7 oz tomatoes including their juice.",
      "Measure 8 oz raw ground turkey before cooking. Break it up in the nonstick pan without added oil until a food thermometer reads 165 F throughout; retain the measured meat juices. Wash hands and clean raw-contact utensils.",
      "Add all the cooked potato, onion, pepper, tomatoes and 10 g taco seasoning. Add water as needed and simmer until the vegetables are tender and stricter package cooking directions are met. No kidney beans or microwave are required.",
      "Serve all the chili and sauce with clean utensils. Do not substitute 8 oz cooked potato or infer trim yield."
    ] }
  ] },
  { id: "pesto-chicken-pasta", sourceMethod: false, rows: [["chicken-breast", 6, "oz"], ["penne", 70, "g"], ["pesto", 2, "oz"], ["frozen-broccoli", 3, "oz"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "chicken-penne", equipment: [...panTools, ...grainTools, ...poultryTools, "strainer"], steps: [
      "Measure 70 g dry penne and boil in water according to its package until tender, then drain and reserve all the pasta. Cook 3 oz frozen broccoli separately in the saucepan according to its package cooking directions and reserve it; thawing alone is not cooking.",
      "Measure 6 oz raw chicken before cooking; do not wash it. Cut small pieces on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook in the nonstick pan with water as needed, without added oil, until a food thermometer reads 165 F throughout; stricter package directions win.",
      "Using clean utensils, combine all the chicken, penne and broccoli with all 2 oz pesto. Warm according to the sauce package, adding water if needed rather than unlisted oil.",
      "Serve all the pasta and sauce topped with all 0.5 oz Parmesan. The dry pasta and raw chicken quantities are not cooked weights."
    ] }
  ] },
  { id: "pesto-chicken-pasta-shrimp", sourceMethod: false, rows: [["frozen-shrimp", 7, "oz"], ["penne", 70, "g"], ["pesto", 2, "oz"], ["frozen-broccoli", 3, "oz"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "shrimp-penne", equipment: [...panTools, ...grainTools, ...seafoodTools, "strainer"], steps: [
      "Thaw shrimp in the refrigerator following its package directions, including any packaging removal. Measure 7 oz raw edible shrimp before cooking, excluding ice glaze, shells or discarded liquid; do not infer a bag's edible yield. Keep seafood and its board away from ready-to-eat food.",
      "Measure 70 g dry penne, boil in water according to the package until tender and drain. Cook all 3 oz frozen broccoli separately according to its package cooking requirements and reserve it.",
      "Cook all the shrimp in the nonstick pan with water as needed, without added oil, until flesh is pearly or white and opaque throughout and any stricter package thermometer temperature requirement is met. Clean raw-contact utensils before combining with all the pasta, broccoli and 2 oz pesto; warm as the sauce package requires.",
      "Serve all the shrimp pasta, pesto and 0.5 oz Parmesan with clean utensils. No chicken or poultry temperature is used."
    ] }
  ] },
  { id: "pesto-chicken-pasta-gf", sourceMethod: false, rows: [["chicken-breast", 6, "oz"], ["gf-pasta", 70, "g"], ["pesto", 2, "oz"], ["frozen-broccoli", 3, "oz"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "chicken-gf-pasta", equipment: [...panTools, ...grainTools, ...poultryTools, "strainer"], steps: [
      "Measure 70 g dry gluten-free pasta, boil in water using its own package directions until tender, then drain. Cook 3 oz frozen broccoli separately according to its package cooking requirements and reserve it. This ingredient name does not certify restriction safety.",
      "Measure 6 oz raw chicken before cooking; do not wash it. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook in the nonstick pan with water as needed and no added oil until a food thermometer reads 165 F throughout; stricter package directions win.",
      "Combine all the cooked chicken, pasta and broccoli with all 2 oz pesto using clean utensils. Warm according to sauce package directions, adding water if needed.",
      "Serve all the pasta and sauce topped with all 0.5 oz Parmesan; no penne or cooked-weight substitution is used."
    ] }
  ] },
  { id: "turkey-meatballs-with-whole-wheat-spaghetti", sourceMethod: false, rows: [["ground-turkey", 7, "oz"], ["ww-spaghetti", 70, "g"], ["marinara", 4, "oz"], ["breadcrumbs", 0.5, "oz"], ["eggs", 1, "each"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "turkey-meatballs", equipment: [...panTools, ...grainTools, "food-thermometer", "strainer", "mixing-bowl"], steps: [
      "Measure 70 g dry whole-wheat spaghetti and boil in water according to the package until tender, then drain and reserve all the pasta.",
      "Mix 7 oz raw ground turkey, the entire one egg, 0.5 oz breadcrumbs and half of the measured 0.5 oz Parmesan in the mixing bowl. Shape all the mixture into small meatballs; do not taste it raw. Wash hands and keep raw egg and meat utensils separate from serving utensils.",
      "Place all meatballs in the nonstick pan with all 4 oz marinara and enough water to prevent sticking. Simmer gently, turning with the spatula, until a food thermometer reads 165 F in the centers of the meatballs; stricter package cooking directions win. Retain all the sauce and cooked meat juices.",
      "Clean raw-contact utensils and serve all the meatballs and sauce over all the spaghetti, topped with the remaining half Parmesan. No added oil or discarded egg mixture is required."
    ] }
  ] },
  { id: "turkey-meatballs-with-whole-wheat-spaghetti-beef", sourceMethod: false, rows: [["ground-beef", 7, "oz"], ["ww-spaghetti", 70, "g"], ["marinara", 4, "oz"], ["breadcrumbs", 0.5, "oz"], ["eggs", 1, "each"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "beef-meatballs", equipment: [...panTools, ...grainTools, "food-thermometer", "strainer", "mixing-bowl"], steps: [
      "Measure 70 g dry whole-wheat spaghetti, boil in water according to its package until tender and drain. Reserve all the cooked pasta.",
      "Mix 7 oz raw ground beef with the entire one egg, 0.5 oz breadcrumbs and half of the measured 0.5 oz Parmesan. Shape all the mixture into small meatballs; do not taste raw egg or meat. Wash hands and separate raw-contact utensils from serving utensils.",
      "Simmer all the meatballs in a nonstick pan with all 4 oz marinara and enough water to prevent sticking, turning gently until a food thermometer reads 160 F in the centers; stricter package cooking directions win. Do not drain away the measured meat juices or sauce.",
      "Clean raw-contact utensils and serve all meatballs and sauce over all the spaghetti with the remaining half Parmesan. No turkey, added oil or discarded egg mixture is used."
    ] }
  ] },
  { id: "turkey-meatballs-with-whole-wheat-spaghetti-gf", sourceMethod: false, rows: [["ground-turkey", 7, "oz"], ["gf-pasta", 70, "g"], ["marinara", 4, "oz"], ["oats", 0.5, "oz"], ["eggs", 1, "each"], ["parmesan", 0.5, "oz"]], methods: [
    { id: "turkey-oat-meatballs", equipment: [...panTools, ...grainTools, "food-thermometer", "strainer", "mixing-bowl", "blender"], steps: [
      "Measure 70 g dry gluten-free pasta and cook in water according to its own package until tender, then drain. Pulse 0.5 oz dry oats into coarse crumbs in a blender, following appliance directions. The ingredient names do not establish allergy or cross-contact safety.",
      "Mix 7 oz raw ground turkey, the entire one egg, all oat crumbs and half of the measured 0.5 oz Parmesan. Shape all the mixture into small meatballs; do not taste it raw. Wash hands and keep raw-contact utensils separate.",
      "Simmer all meatballs in the nonstick pan with all 4 oz marinara and water as needed, turning gently until a food thermometer reads 165 F in their centers and oat and other package cooking requirements are satisfied. Stricter package directions win; retain all cooked meat juices and sauce.",
      "Clean raw-contact utensils and serve all the meatballs and sauce over all the pasta with the remaining half Parmesan. No breadcrumbs, extra oil or cooked-weight substitution is used."
    ] }
  ] },
  { id: "chicken-stir-fry-with-rice", sourceMethod: false, rows: [["chicken-breast", 10, "oz"], ["frozen-stirfry-veg", 5, "oz"], ["white-rice", 65, "g"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "chicken-rice-pan", equipment: [...panTools, ...grainTools, ...poultryTools], steps: [
      "Measure 65 g dry white rice, cook in water with the saucepan lid according to its package until tender and reserve all cooked rice. Do not substitute cooked rice weight.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils. Heat all 1 tbsp olive oil in the nonstick pan and cook all chicken until a food thermometer reads 165 F throughout.",
      "Add all 5 oz frozen stir-fry vegetables and cook according to their package, using water as needed. Add all 2 tbsp soy sauce and heat as its package requires; stricter package directions win, not minutes alone.",
      "Use clean utensils to serve all the chicken, vegetables, sauce and measured pan oil over all the rice. No unlisted seasoning is needed."
    ] }
  ] },
  { id: "chicken-stir-fry-with-rice-tofu", sourceMethod: false, rows: [["tofu", 9, "oz"], ["frozen-stirfry-veg", 5, "oz"], ["white-rice", 65, "g"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "tofu-rice-pan", equipment: [...panTools, ...grainTools, "food-thermometer"], steps: [
      "Measure 65 g dry white rice, cook in water with the saucepan lid according to its package until tender and reserve all cooked rice; this is not cooked rice weight.",
      "Measure 9 oz tofu before cooking, pat dry and cube on the clean board. Heat all 1 tbsp olive oil in the nonstick pan and cook all tofu according to its package cooking requirements.",
      "Add all 5 oz frozen stir-fry vegetables and cook according to their package, adding water as needed. Add all 2 tbsp soy sauce and heat as required; meet any package thermometer temperature requirements. Stricter package directions win.",
      "Serve all tofu, vegetables, sauce and measured pan oil over all the rice. No chicken or poultry cooking rule is used."
    ] }
  ] },
  { id: "chicken-stir-fry-with-rice-noodles", sourceMethod: false, rows: [["chicken-breast", 10, "oz"], ["frozen-stirfry-veg", 5, "oz"], ["spaghetti", 70, "g"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "chicken-spaghetti-pan", equipment: [...panTools, ...grainTools, ...poultryTools, "strainer"], steps: [
      "Measure 70 g dry spaghetti, boil in water according to its package until tender and drain. Reserve all the noodles; no rice or cooked-weight substitution is used.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils. Heat all 1 tbsp olive oil in the nonstick pan and cook the chicken until a food thermometer reads 165 F throughout.",
      "Add all 5 oz frozen stir-fry vegetables and satisfy their package cooking requirements, adding water as needed. Add all 2 tbsp soy sauce and heat as required; stricter package directions win.",
      "Using clean utensils, toss all cooked spaghetti with all the chicken, vegetables, sauce and measured pan oil, then serve."
    ] }
  ] },
  { id: "healthier-chicken-parmesan", sourceMethod: false, rows: [["chicken-breast", 6, "oz"], ["breadcrumbs", 1, "oz"], ["eggs", 1, "each"], ["marinara", 4, "oz"], ["shredded-mozzarella", 1, "oz"], ["frozen-broccoli", 4, "oz"]], methods: [
    { id: "oven-chicken-breading", equipment: [...breadingTools, "raw-poultry-board", "mixing-bowl", "whisk", "spoon", "stovetop", "saucepan", "saucepan-lid"], steps: [
      "Heat the oven to 425 F unless stricter package cooking directions require otherwise. Measure 6 oz raw chicken before cooking; do not wash it. Cut into thin pieces on the separate raw-poultry board. Wash hands and clean raw-contact utensils.",
      "Whisk the entire one egg in the bowl and mix in all 1 oz breadcrumbs to form a thick coating. Spread all the coating over all the chicken on a suitable nonstick oven-safe sheet pan; bake any loose coating beside it rather than discard measured egg or crumbs. Do not taste raw coating; no unlisted oil is required.",
      "Bake until a food thermometer reads 165 F throughout the chicken and all the coating, satisfying stricter package directions. With clean utensils add all 4 oz marinara and 1 oz shredded mozzarella, then return to the oven until sauce meets its package heating requirements and cheese melts. Minutes alone are not proof.",
      "Cook all 4 oz frozen broccoli separately in water in the saucepan according to its package. Use oven mitts and clean utensils to serve all chicken, cooked coating, sauce, cheese and broccoli. No cooked-weight substitution or nutrition improvement is claimed."
    ] }
  ] },
  { id: "healthier-chicken-parmesan-tofu", sourceMethod: false, rows: [["tofu", 8, "oz"], ["breadcrumbs", 1, "oz"], ["eggs", 1, "each"], ["marinara", 4, "oz"], ["shredded-mozzarella", 1, "oz"], ["frozen-broccoli", 4, "oz"]], methods: [
    { id: "oven-tofu-egg-breading", equipment: [...breadingTools, "mixing-bowl", "whisk", "spoon", "stovetop", "saucepan", "saucepan-lid"], steps: [
      "Heat the oven to 425 F unless stricter package cooking directions require otherwise. Measure 8 oz tofu before cooking, pat dry and slice on the clean board. No chicken is used, but the declared egg remains in this variant.",
      "Whisk the entire one egg and mix in all 1 oz breadcrumbs into a thick coating. Spread all coating over all tofu on a suitable nonstick oven-safe sheet pan, with any loose coating beside it; none of the measured egg or crumbs is discarded. Do not taste raw coating and clean raw-egg utensils before serving. No added oil is required.",
      "Bake until the egg coating is set and a food thermometer reads at least 160 F throughout the coating, satisfying any stricter tofu and other package cooking requirements. Add all 4 oz marinara and 1 oz shredded mozzarella with clean utensils, then return to the oven until sauce meets its package heating requirements and cheese melts.",
      "Cook all 4 oz frozen broccoli separately in water in the saucepan according to its package. Use oven mitts and clean utensils to serve all tofu, cooked coating, sauce, cheese and broccoli. Time alone is not proof; this is not egg-free or allergy certification."
    ] }
  ] },
  { id: "healthier-chicken-parmesan-oat", sourceMethod: false, rows: [["chicken-breast", 6, "oz"], ["oats", 1, "oz"], ["eggs", 1, "each"], ["marinara", 4, "oz"], ["shredded-mozzarella", 1, "oz"], ["frozen-broccoli", 4, "oz"]], methods: [
    { id: "oven-chicken-oat-breading", equipment: [...breadingTools, "raw-poultry-board", "mixing-bowl", "whisk", "spoon", "blender", "stovetop", "saucepan", "saucepan-lid"], steps: [
      "Heat the oven to 425 F unless stricter package cooking directions require otherwise. Pulse all 1 oz dry oats into coarse crumbs in a blender following appliance directions. Measure 6 oz raw chicken before cooking; do not wash it. Slice thinly on the separate raw-poultry board, wash hands and clean raw-contact utensils.",
      "Whisk the entire one egg, mix in all oat crumbs and spread all the thick coating over all chicken on a suitable nonstick oven-safe sheet pan. Bake any loose coating beside the chicken; no measured egg or oats is discarded. Do not taste it raw; no unlisted oil or breadcrumbs are used.",
      "Bake until a food thermometer reads 165 F throughout the chicken and coating and oat and other package cooking requirements are met. Add all 4 oz marinara and 1 oz shredded mozzarella with clean utensils, then return to the oven until sauce meets package heating requirements and cheese melts; stricter package directions win.",
      "Cook all 4 oz frozen broccoli separately in water in the saucepan according to its package. Use oven mitts and clean utensils to serve all chicken, cooked coating, sauce, cheese and broccoli. Do not substitute cooked chicken weight or use time alone as proof."
    ] }
  ] },
  { id: "turkey-burgers-with-sweet-potato-wedges", sourceMethod: false, rows: [["ground-turkey", 8, "oz"], ["ww-buns", 1, "each"], ["sweet-potatoes", 8, "oz"], ["olive-oil", 1, "tbsp"], ["romaine", 0.25, "each"]], methods: [
    { id: "turkey-burger-oven-wedges", equipment: [...roastTools, "stovetop", "nonstick-pan", "spatula"], steps: [
      "Heat the oven to 425 F unless stricter package cooking directions require otherwise. Wash and scrub the sweet potato, measure 8 oz raw edible potato with edible skin and cut wedges. Toss all wedges with all 1 tbsp olive oil on the sheet pan and roast, turning with tongs, until fork-tender. No cooked-weight or trim-yield conversion is implied.",
      "Wash the quarter head of romaine under running water and separate its edible leaves, keeping them away from raw turkey. Measure 8 oz raw ground turkey before cooking and shape all of it into two thin patties; wash hands afterward.",
      "Cook both patties in a dry nonstick pan, turning with the spatula until a food thermometer reads 165 F in their centers. Retain the cooked meat juices; stricter package directions win and time alone is not proof. Clean raw-contact utensils.",
      "Use clean utensils to put both patties and all romaine on the one packaged ready-to-eat whole-wheat bun. Use oven mitts to serve all wedges and measured pan oil beside the burger; no extra oil or bun is required."
    ] }
  ] },
  { id: "turkey-burgers-with-sweet-potato-wedges-tempeh", sourceMethod: false, rows: [["tempeh", 8, "oz"], ["ww-buns", 1, "each"], ["sweet-potatoes", 8, "oz"], ["olive-oil", 1, "tbsp"], ["romaine", 0.25, "each"]], methods: [
    { id: "tempeh-burger-oven-wedges", equipment: [...roastTools, "stovetop", "nonstick-pan", "spatula"], steps: [
      "Heat the oven to 425 F unless stricter package directions require otherwise. Wash and scrub the sweet potato, measure 8 oz raw edible potato with edible skin and cut wedges. Toss all wedges with all 1 tbsp olive oil on the sheet pan and roast until fork-tender, turning with tongs; this is not cooked potato weight.",
      "Wash the quarter head of romaine under running water and separate its edible leaves. Measure 8 oz tempeh before cooking and cut into thin slabs on the clean board.",
      "Cook all tempeh in the nonstick pan with water as needed, following its package cooking directions and any thermometer temperature requirement. No poultry temperature or unlisted oil is assumed; all declared oil is on the wedges.",
      "Put all cooked tempeh and romaine on the one packaged ready-to-eat whole-wheat bun. Use oven mitts to serve all wedges and measured pan oil beside it. No turkey or cooked-weight substitution is used."
    ] }
  ] },
  { id: "turkey-burgers-with-sweet-potato-wedges-bunless", sourceMethod: false, rows: [["ground-turkey", 8, "oz"], ["sweet-potatoes", 8, "oz"], ["olive-oil", 1, "tbsp"], ["romaine", 0.25, "each"]], methods: [
    { id: "turkey-lettuce-burger-oven-wedges", equipment: [...roastTools, "stovetop", "nonstick-pan", "spatula"], steps: [
      "Heat the oven to 425 F unless stricter package directions require otherwise. Wash and scrub the sweet potato, measure 8 oz raw edible potato with edible skin and cut wedges. Toss all wedges with all 1 tbsp olive oil on the sheet pan and roast, turning with tongs, until fork-tender.",
      "Wash the quarter head of romaine under running water and separate its edible leaves away from raw meat. Measure 8 oz raw ground turkey before cooking, shape all of it into two thin patties and wash hands afterward.",
      "Cook both patties in a dry nonstick pan, turning until a food thermometer reads 165 F in their centers; retain cooked meat juices. Stricter package directions win, not time or color alone. Clean raw-contact utensils.",
      "Use clean utensils to serve both patties over all romaine with no bun. Use oven mitts to serve all wedges and measured pan oil beside them; raw potato and meat quantities are not cooked weights."
    ] }
  ] },
  { id: "ground-turkey-lettuce-wraps", sourceMethod: false, rows: [["ground-turkey", 8, "oz"], ["romaine", 0.5, "each"], ["carrots", 2, "oz"], ["frozen-edamame", 3, "oz"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "turkey-lettuce-pan", equipment: [...panTools, ...grainTools, "food-thermometer"], steps: [
      "Wash the half head of romaine under running water and separate its edible leaves. Wash and finely slice 2 oz raw edible carrots on the clean board. Cook all 3 oz frozen shelled edamame in water in the saucepan according to its package; thawing alone is insufficient.",
      "Measure 8 oz raw ground turkey before cooking. Heat all 1 tsp olive oil in the nonstick pan and break up all the turkey, cooking until a food thermometer reads 165 F throughout. Keep raw meat away from lettuce, wash hands and clean raw-contact utensils.",
      "Add all carrots, cooked edamame and 2 tbsp soy sauce to the pan. Cook until carrots are tender and sauce and edamame meet any stricter package cooking requirements, adding water if needed.",
      "Use clean utensils to divide all filling, sauce and measured pan oil among all the lettuce leaves and serve; no rice or unlisted sauce is required."
    ] }
  ] },
  { id: "ground-turkey-lettuce-wraps-tofu", sourceMethod: false, rows: [["tofu", 9, "oz"], ["romaine", 0.5, "each"], ["carrots", 2, "oz"], ["frozen-edamame", 3, "oz"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "tofu-lettuce-pan", equipment: [...panTools, ...grainTools, "food-thermometer"], steps: [
      "Wash the half head of romaine under running water and separate edible leaves. Wash and finely slice 2 oz raw edible carrots. Cook all 3 oz frozen shelled edamame in water in the saucepan according to its package cooking requirements.",
      "Measure 9 oz tofu before cooking, pat dry and crumble. Heat all 1 tsp olive oil in the nonstick pan and cook all tofu according to its package, adding water as needed.",
      "Add all carrots, cooked edamame and 2 tbsp soy sauce. Cook until carrots are tender and tofu, edamame and sauce satisfy stricter package cooking and any thermometer temperature requirements; no turkey or poultry rule is used.",
      "Divide all filling, sauce and measured pan oil among all edible lettuce leaves and serve. No rice, cooked tofu weight or unlisted sauce is substituted."
    ] }
  ] },
  { id: "ground-turkey-lettuce-wraps-rice", sourceMethod: false, rows: [["ground-turkey", 8, "oz"], ["white-rice", 65, "g"], ["carrots", 2, "oz"], ["frozen-edamame", 3, "oz"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "turkey-carrot-rice-pan", equipment: [...panTools, ...grainTools, "food-thermometer"], steps: [
      "Measure 65 g dry white rice and cook in water with the saucepan lid according to its package until tender; reserve all cooked rice. Wash and finely slice 2 oz raw edible carrots. Cook all 3 oz frozen shelled edamame separately in water according to its package.",
      "Measure 8 oz raw ground turkey before cooking. Heat all 1 tsp olive oil in the nonstick pan and break up all turkey, cooking until a food thermometer reads 165 F throughout. Wash hands and clean raw-contact utensils.",
      "Add all carrots, cooked edamame and 2 tbsp soy sauce to the pan. Cook until carrots are tender and all stricter package requirements are met, adding water if needed.",
      "Use clean utensils to serve all filling, sauce and measured pan oil over all rice. No romaine is used, and 65 g cooked rice is not a substitute for the dry quantity."
    ] }
  ] },
  { id: "bbq-chicken-with-roasted-vegetables-and-rice-pork", sourceMethod: false, rows: [["pork-loin", 8, "oz"], ["white-rice", 70, "g"], ["frozen-mixed-veg", 5, "oz"], ["bbq-sauce", 2, "oz"], ["olive-oil", 1, "tsp"]], methods: [
    { id: "oven-pork-rice", equipment: [...roastTools, "raw-meat-board", "stovetop", ...grainTools], steps: [
      "Measure 70 g dry white rice and cook in water with the saucepan lid according to its package until tender. Heat the oven to 425 F unless stricter package directions require otherwise; do not substitute cooked rice weight.",
      "Measure 8 oz raw edible boneless lean pork loin before cooking, not bone or trim weight. Keep it on the separate raw-contact board away from ready-to-eat food, wash hands and clean raw-contact utensils. Place all pork on the sheet pan with all 5 oz frozen mixed vegetables tossed in all 1 tsp olive oil, keeping vegetables separate from the pork juices.",
      "Roast until a food thermometer reads at least 145 F throughout the whole-cut pork and vegetables satisfy their package cooking requirements; stricter package directions win. Rest pork at least 3 minutes before cutting. With clean utensils put all 2 oz barbecue sauce on the cooked pork, return to heat as the sauce package requires, then rest again at least 3 minutes before cutting.",
      "Use oven mitts and clean utensils to serve all pork, vegetables, barbecue sauce and measured pan oil over all rice. Do not reuse raw-contact utensils or claim a bone/trim yield; no chicken is used."
    ] }
  ] },
  { id: "buffalo-chicken-bowl", sourceMethod: false, rows: [["chicken-breast", 10, "oz"], ["white-rice", 60, "g"], ["buffalo-sauce", 2, "tbsp"], ["romaine", 0.25, "each"], ["carrots", 2, "oz"], ["avocados", 0.5, "each"]], methods: [
    { id: "buffalo-chicken-rice", equipment: [...panTools, ...grainTools, ...poultryTools], steps: [
      "Measure 60 g dry white rice and cook in water with the saucepan lid according to its package until tender. Wash the quarter head of romaine, 2 oz edible carrots and the half avocado skin under running water. Slice carrots and edible lettuce; remove avocado pit and skin and slice all the half's edible flesh on the clean produce board.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook all chicken in a nonstick pan with water as needed, without added oil, until a food thermometer reads 165 F throughout; stricter package directions win.",
      "Add all 2 tbsp buffalo sauce to the cooked chicken and heat as its package requires, using clean utensils. Keep raw-contact utensils away from lettuce, carrots and avocado.",
      "Serve all sauced chicken over all rice with all lettuce, carrots and avocado flesh. No hidden oil, cooked-weight substitution or optional seasoning is needed."
    ] }
  ] },
  { id: "buffalo-chicken-bowl-tempeh", sourceMethod: false, rows: [["tempeh", 8, "oz"], ["white-rice", 60, "g"], ["buffalo-sauce", 2, "tbsp"], ["romaine", 0.25, "each"], ["carrots", 2, "oz"], ["avocados", 0.5, "each"]], methods: [
    { id: "buffalo-tempeh-rice", equipment: [...panTools, ...grainTools, "food-thermometer"], steps: [
      "Measure 60 g dry white rice and cook in water with the saucepan lid according to its package until tender. Wash the quarter head of romaine, 2 oz edible carrots and the half avocado skin under running water. Slice carrots and edible lettuce, remove avocado pit and skin and slice all the half's edible flesh.",
      "Measure 8 oz tempeh before cooking and cut into thin pieces on the clean board. Cook all tempeh in the nonstick pan with water as needed according to its package cooking and any thermometer temperature requirements; no added oil is used.",
      "Add all 2 tbsp buffalo sauce and heat as its package requires; stricter package directions win, not a poultry temperature or fixed time.",
      "Serve all sauced tempeh over all rice with all lettuce, carrots and avocado flesh. No chicken or cooked-weight substitution is used."
    ] }
  ] },
  { id: "buffalo-chicken-bowl-sweet-potato", sourceMethod: false, rows: [["chicken-breast", 10, "oz"], ["sweet-potatoes", 8, "oz"], ["buffalo-sauce", 2, "tbsp"], ["romaine", 0.25, "each"], ["carrots", 2, "oz"], ["avocados", 0.5, "each"]], methods: [
    { id: "buffalo-chicken-boiled-potato", equipment: [...panTools, ...grainTools, ...poultryTools, "strainer", "fork"], steps: [
      "Wash and scrub the sweet potato, measure 8 oz raw edible potato with edible skin, cube and simmer in water in the saucepan until fork-tender, then drain. Wash the quarter head of romaine, 2 oz edible carrots and the half avocado skin under running water. Slice carrots and edible lettuce, remove avocado pit and skin and slice all the half's edible flesh.",
      "Measure 10 oz raw chicken before cooking; do not wash it. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils. Cook all chicken in the nonstick pan with water as needed and no added oil until a food thermometer reads 165 F throughout; stricter package directions win.",
      "Add all 2 tbsp buffalo sauce to the cooked chicken and heat as its package requires with clean utensils. Keep raw-contact utensils away from ready-to-eat produce.",
      "Serve all sauced chicken over all cooked sweet potato with all lettuce, carrots and avocado flesh. No rice, microwave or cooked potato weight is substituted."
    ] }
  ] },
  { id: "shrimp-and-veggie-stir-fry", sourceMethod: false, rows: [["frozen-shrimp", 8, "oz"], ["frozen-stirfry-veg", 6, "oz"], ["white-rice", 65, "g"], ["frozen-edamame", 2, "oz"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "shrimp-white-rice", equipment: [...panTools, ...grainTools, ...seafoodTools], steps: [
      "Thaw shrimp in the refrigerator following package directions, including packaging removal. Measure 8 oz raw edible shrimp before cooking, excluding ice glaze, shells or discarded liquid; no bag yield is inferred. Keep raw seafood and its board separate from ready-to-eat food.",
      "Measure 65 g dry white rice and cook in water with the saucepan lid according to its package until tender. Reserve all cooked rice. Cook all 6 oz frozen stir-fry vegetables and 2 oz frozen shelled edamame separately in water according to their package cooking requirements.",
      "Heat all 1 tbsp olive oil in the nonstick pan. Cook all shrimp until flesh is pearly or white and opaque throughout and any stricter package thermometer temperature requirement is met. Clean raw-contact utensils; add all cooked vegetables, edamame and 2 tbsp soy sauce and heat as their packages require.",
      "Serve all shrimp, vegetables, edamame, sauce and measured pan oil over all rice with clean utensils. No cooked-weight substitute or poultry temperature is used."
    ] }
  ] },
  { id: "shrimp-and-veggie-stir-fry-pork", sourceMethod: false, rows: [["pork-loin", 8, "oz"], ["frozen-stirfry-veg", 6, "oz"], ["white-rice", 65, "g"], ["frozen-edamame", 2, "oz"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "pork-white-rice", equipment: [...panTools, ...grainTools, "raw-meat-board", "food-thermometer"], steps: [
      "Measure 65 g dry white rice and cook in water with the saucepan lid according to its package until tender. Reserve all rice; cook all 6 oz frozen stir-fry vegetables and 2 oz frozen shelled edamame separately in water according to their package cooking requirements.",
      "Measure 8 oz raw edible boneless lean pork loin before cooking, not bone or trim weight. Slice thinly on the separate raw-contact board, wash hands and clean raw-contact utensils. Heat all 1 tbsp olive oil in the nonstick pan and cook all whole-cut pork slices until a food thermometer reads at least 145 F throughout; stricter package directions win. Rest at least 3 minutes before continuing.",
      "Use clean utensils to add all cooked vegetables, edamame and 2 tbsp soy sauce, heating as their packages require. Rest the pork at least 3 minutes after final heating before serving; do not substitute the ground-meat or poultry rule.",
      "Serve all pork, vegetables, edamame, sauce and measured pan oil over all rice. No shrimp, cooked-weight shortcut or bone yield is implied."
    ] }
  ] },
  { id: "shrimp-and-veggie-stir-fry-brown-rice", sourceMethod: false, rows: [["frozen-shrimp", 8, "oz"], ["frozen-stirfry-veg", 6, "oz"], ["brown-rice", 65, "g"], ["frozen-edamame", 2, "oz"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "shrimp-brown-rice", equipment: [...panTools, ...grainTools, ...seafoodTools], steps: [
      "Thaw shrimp in the refrigerator following its package directions, including packaging removal. Measure 8 oz raw edible shrimp before cooking, excluding ice glaze, shells or discarded liquid; keep raw seafood and its board separate. Package edible yield remains unverified.",
      "Measure 65 g dry brown rice and cook in water with the saucepan lid using brown rice's own package directions until tender, not a white-rice time or cooked weight. Reserve all cooked rice. Cook all 6 oz frozen stir-fry vegetables and 2 oz frozen shelled edamame separately in water according to their packages.",
      "Heat all 1 tbsp olive oil in the nonstick pan and cook all shrimp until flesh is pearly or white and opaque throughout and any stricter package thermometer temperature requirement is met. Clean raw-contact utensils and add all cooked vegetables, edamame and 2 tbsp soy sauce, heating as their packages require.",
      "Serve all shrimp, vegetables, edamame, sauce and measured pan oil over all brown rice with clean utensils. No white rice or poultry temperature is used."
    ] }
  ] },
  { id: "shrimp-and-veggie-stir-fry-chicken", sourceMethod: false, rows: [["frozen-chicken-breast", 12, "oz"], ["frozen-stirfry-veg", 6, "oz"], ["white-rice", 65, "g"], ["frozen-edamame", 2, "oz"], ["soy-sauce", 2, "tbsp"], ["olive-oil", 1, "tbsp"]], methods: [
    { id: "thawed-chicken-white-rice", equipment: [...panTools, ...grainTools, ...poultryTools], steps: [
      "Thaw frozen chicken breast in the refrigerator according to its package. Measure 12 oz thawed raw edible boneless skinless chicken before cooking, excluding ice glaze or discarded liquid; do not infer a bag yield or wash the chicken. Cut on the separate raw-poultry board, wash hands and clean raw-contact utensils.",
      "Measure 65 g dry white rice and cook in water with the saucepan lid according to its package until tender. Reserve all cooked rice. Cook all 6 oz frozen stir-fry vegetables and 2 oz frozen shelled edamame separately in water according to their package cooking requirements.",
      "Heat all 1 tbsp olive oil in the nonstick pan and cook all chicken until a food thermometer reads 165 F throughout; stricter package directions win, not time or color alone. Clean raw-contact utensils and add all cooked vegetables, edamame and 2 tbsp soy sauce, heating as their packages require.",
      "Serve all chicken, vegetables, edamame, sauce and measured pan oil over all rice with clean utensils. No shrimp or cooked chicken weight is substituted."
    ] }
  ] },
  { id: "salmon-with-rice-and-asparagus", sourceMethod: false, rows: [["frozen-salmon", 8, "oz"], ["white-rice", 65, "g"], ["asparagus", 5, "oz"], ["olive-oil", 2, "tsp"]], methods: [
    { id: "oven-salmon-rice", equipment: [...roastTools, "raw-seafood-board", "stovetop", ...grainTools], steps: [
      "Thaw salmon in the refrigerator following its package directions, including packaging removal. Check for bones and measure 8 oz raw edible salmon before cooking, excluding ice glaze, bones or discarded liquid; no package bone/skin/trim yield is certified. Keep raw fish and its board separate from ready-to-eat food.",
      "Measure 65 g dry white rice and cook in water with the saucepan lid according to its package until tender. Heat the oven to 400 F unless stricter package directions require otherwise. Wash asparagus, remove woody ends and measure 5 oz raw edible asparagus, without inferring trimming yield.",
      "Measure 2 tsp olive oil total; put all salmon and asparagus on the sheet pan and coat each with half the oil. Roast until a food thermometer reads 145 F throughout the fish and asparagus is fork-tender, satisfying stricter package cooking directions; minutes or flaking alone are not proof.",
      "Wash hands and clean raw-contact utensils. Use oven mitts and clean utensils to serve all edible salmon, asparagus and measured pan oil over all rice. No cooked-weight substitution is used."
    ] }
  ] },
  { id: "salmon-with-rice-and-asparagus-tilapia", sourceMethod: false, rows: [["frozen-tilapia", 8, "oz"], ["white-rice", 65, "g"], ["asparagus", 5, "oz"], ["olive-oil", 2, "tsp"]], methods: [
    { id: "oven-tilapia-rice", equipment: [...roastTools, "raw-seafood-board", "stovetop", ...grainTools], steps: [
      "Thaw tilapia in the refrigerator following its package directions, including packaging removal. Check for bones and measure 8 oz raw edible tilapia before cooking, excluding ice glaze, bones or discarded liquid; no package edible yield is certified. Keep raw fish and its board separate.",
      "Measure 65 g dry white rice and cook in water with the saucepan lid according to its package until tender. Heat the oven to 400 F unless stricter package directions require otherwise. Wash asparagus, remove woody ends and measure 5 oz raw edible asparagus without inferring trim yield.",
      "Measure 2 tsp olive oil total and coat all tilapia and asparagus with half each on the sheet pan. Roast until a food thermometer reads 145 F throughout the tilapia and asparagus is fork-tender, meeting stricter package cooking directions; minutes or visual flaking alone are not proof.",
      "Wash hands and clean raw-contact utensils. Use oven mitts and clean utensils to serve all edible tilapia, asparagus and measured pan oil over all rice. No salmon or cooked-weight substitution is used."
    ] }
  ] },
  { id: "salmon-with-rice-and-asparagus-sweet-potato", sourceMethod: false, rows: [["frozen-salmon", 8, "oz"], ["sweet-potatoes", 8, "oz"], ["asparagus", 5, "oz"], ["olive-oil", 2, "tsp"]], methods: [
    { id: "oven-salmon-potato", equipment: [...roastTools, "raw-seafood-board"], steps: [
      "Thaw salmon in the refrigerator following its package directions, including packaging removal. Check for bones and measure 8 oz raw edible salmon before cooking, excluding ice glaze, bones or discarded liquid; package bone/skin/trim yield remains unverified. Keep raw fish and its board separate.",
      "Heat the oven to 400 F unless stricter package directions require otherwise. Wash and scrub sweet potato, measure 8 oz raw edible potato with edible skin and cube. Measure 2 tsp olive oil total, toss all potato with half on the sheet pan and start roasting until beginning to soften. Wash and trim asparagus, then measure 5 oz raw edible asparagus without inferring trim yield.",
      "Add all salmon and asparagus with the remaining half oil. Roast until a food thermometer reads 145 F throughout salmon and potato and asparagus are fork-tender, meeting stricter package directions. Time or visual flaking alone is not proof.",
      "Wash hands and clean raw-contact utensils. Use oven mitts and clean utensils to serve all edible salmon, potato, asparagus and measured pan oil. No rice or cooked potato weight is substituted."
    ] }
  ] }
];
definitions.push(...remaining);
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
