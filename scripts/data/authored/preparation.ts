// Internal producer adjunct. UNACCEPTED across lanes; not part of a snapshot or API DTO.
// Authored guidance only: no physical kitchen, yield, package or allergy acceptance.
import { RECIPES } from "./recipes.ts";
import { expandRecipes } from "../expand.ts";
import type { Ing } from "./types.ts";

export const PREPARATION_VERSION = "wd-authored-preparation-1";
export const SAFETY_SOURCE = "https://www.foodsafety.gov/food-safety-charts/safe-minimum-internal-temperatures";
export const EQUIPMENT = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer", "toaster", "microwave", "microwave-safe-bowl", "microwave-safe-cover", "knife", "cutting-board", "saucepan", "strainer"] as const;
type Equipment = typeof EQUIPMENT[number];
type Method = { id: string; equipment: Equipment[]; steps: string[] };
const baseId = "egg-white-and-veggie-scramble-with-toast";
const compiled = expandRecipes(RECIPES);
const standard: Equipment[] = ["stovetop", "nonstick-pan", "spatula", "mixing-bowl", "whisk", "food-thermometer"];
const definitions: { id: string; rows: Ing[]; methods: Method[] }[] = [
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
const records = definitions.map(definition => {
  const recipe = compiled.recipes.find(recipe => recipe.id === definition.id)!;
  const primaryEquipment: Equipment[] = definition.id.endsWith("-potatoes")
    ? [...standard, "microwave", "microwave-safe-bowl", "microwave-safe-cover", "knife", "cutting-board"]
    : definition.id.endsWith("-tofu") ? ["stovetop", "nonstick-pan", "spatula", "toaster"] : [...standard, "toaster"];
  return { ...definition, sourceSteps: [...recipe.steps], sourceMinutes: recipe.minutes, methods: [
    { id: "authored-primary", equipment: primaryEquipment, steps: [...recipe.steps] },
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
    timing: { declaredMinutes: recipe.minutes, measured: false as const, alternativeMinutes: null },
    seasoning: { optional: true as const, prompt: "Seasoning of your choice", recommended: "Black pepper",
      status: "unpriced-unverified-extra" as const, includedInQuotedTotal: false as const,
      includedInNutrients: false as const, allergenStatus: "unknown" as const },
    safety: { source: SAFETY_SOURCE, stricterPackageDirectionsWin: true as const,
      timeAloneProvesDoneness: false as const, kitchenVerified: false as const, allergySafe: false as const }
  };
}
