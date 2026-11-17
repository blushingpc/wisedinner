import { canonicalReferenceData } from "./generated-plan-data.ts";

type Amount = readonly [bigint, bigint];
type Allocation = { id: string; unit: string; quantity: string };
type Ingredient = Allocation & { name: string; state: string };
const macros = ["protein_g", "kcal", "fat_g", "carbs_g"] as const;
type MacroRanges = Record<typeof macros[number], { min: string; max: string }>;
type Nutrition = {
  status: string; servings: string; missing_ingredients: unknown[];
  per_serving: MacroRanges; whole_batch: MacroRanges;
  source_refresh: { exact_recipe_body_sha256: string; recipe_sha256_unchanged: string };
};
type RecipeRow = Record<string, unknown> & {
  id: string;
  recipe_sha256: string;
  recipe: { servings: number; ingredients: Ingredient[]; steps: { allocations: Allocation[] }[] };
  nutrition: Nutrition;
  half_batch_lineage?: {
    source: string; line: string; parentRecipe: string; parentNutrition: string; childRecipe: string; factor: string;
  };
};
type Seal = Readonly<{
  id: string; source: string; line: string; parentRecipe: string; parentNutrition: string;
  childRecipe: string; childNutrition: string; lineage: string;
}>;
const canonical = (value: unknown) => JSON.stringify(canonicalReferenceData(value));
const same = (a: unknown, b: unknown) => canonical(a) === canonical(b);

function amount(value: string): Amount {
  if (!/^\d+(?:\.\d+|\/\d+)?$/.test(value)) throw Error("amount");
  const [numerator = "", denominator] = value.split("/");
  if (denominator !== undefined) {
    if (BigInt(denominator) === BigInt(0)) throw Error("zero denominator");
    return [BigInt(numerator), BigInt(denominator)];
  }
  const [whole = "", decimal = ""] = numerator.split(".");
  return [BigInt(whole + decimal), BigInt(10) ** BigInt(decimal.length)];
}
const equalAmount = (a: Amount, b: Amount) => a[0] * b[1] === b[0] * a[1];
const addAmount = (a: Amount, b: Amount): Amount => [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
const double = (value: Amount): Amount => [value[0] * BigInt(2), value[1]];

export function makeHalfBatchValidator({
  parentLine, parent, seal, sha256, authenticateDerivedParent, authenticatePreparationParent,
}: {
  parentLine: string;
  parent: RecipeRow;
  seal: Seal;
  sha256: (value: string) => string;
  authenticateDerivedParent: (row: RecipeRow) => boolean;
  authenticatePreparationParent: (row: RecipeRow) => string | null;
}) {
  // The supplied line comes from the authenticated parent index. Check its
  // identity once here, then compare the exact child and its ingredient math.
  if (sha256(parentLine) !== seal.line || !same(JSON.parse(parentLine), parent) ||
      sha256(canonical(parent.recipe)) !== seal.parentRecipe ||
      sha256(canonical(parent.nutrition)) !== seal.parentNutrition || parent.id !== seal.id) {
    throw Error("untrusted_parent");
  }
  const isPlain = parent.nutrition.status === "complete-conditional-USDA-input-estimate" &&
    !Object.hasOwn(parent, "derived_lineage");
  const isDerived = parent.nutrition.status === "complete-conditional-derived-USDA-and-manufacturer-input-estimate" &&
    Object.hasOwn(parent, "derived_lineage") && authenticateDerivedParent(parent);
  if (!isPlain && !isDerived) throw Error("untrusted_nutrition_ancestry");
  const nutritionBody = Object.hasOwn(parent, "preparation_lineage")
    ? isPlain ? authenticatePreparationParent(parent) : null
    : seal.parentRecipe;
  if (!nutritionBody || !/^[0-9a-f]{64}$/.test(nutritionBody)) throw Error("untrusted_preparation_ancestry");

  return (input: Record<string, unknown>): string | null => {
    try {
      const row = input as RecipeRow;
      const lineage = row.half_batch_lineage;
      if (!lineage || row.id !== seal.id || row.recipe_sha256 !== seal.childRecipe ||
          sha256(canonical(row.recipe)) !== seal.childRecipe ||
          sha256(canonical(row.nutrition)) !== seal.childNutrition ||
          sha256(canonical(lineage)) !== seal.lineage) return null;
      if (lineage.source !== seal.source || lineage.line !== seal.line || lineage.parentRecipe !== seal.parentRecipe ||
          lineage.parentNutrition !== seal.parentNutrition || lineage.childRecipe !== seal.childRecipe ||
          lineage.factor !== "1/2") return null;

      const { recipe: before, recipe_sha256: _oldSha, nutrition: original, ...otherBefore } = parent;
      const { recipe: after, recipe_sha256: _newSha, nutrition: revised, half_batch_lineage: _lineage, ...otherAfter } = row;
      if (!same(otherBefore, otherAfter) || before.servings !== 2 || after.servings !== 1 ||
          before.ingredients.length !== after.ingredients.length) return null;

      const parentIngredients = new Map(before.ingredients.map(ingredient => [ingredient.id, ingredient]));
      const childIngredients = new Map(after.ingredients.map(ingredient => [ingredient.id, ingredient]));
      if (parentIngredients.size !== before.ingredients.length || childIngredients.size !== after.ingredients.length) return null;

      const used = new Map<string, Amount>();
      for (const step of after.steps) for (const allocation of step.allocations) {
        const ingredient = childIngredients.get(allocation.id);
        if (!ingredient || allocation.unit !== ingredient.unit) return null;
        const prior = used.get(allocation.id) ?? [BigInt(0), BigInt(1)];
        used.set(allocation.id, addAmount(prior, amount(allocation.quantity)));
      }
      for (const ingredient of after.ingredients) {
        const prior = parentIngredients.get(ingredient.id);
        const allocated = used.get(ingredient.id) ?? [BigInt(0), BigInt(1)];
        if (!prior || ingredient.name !== prior.name || ingredient.state !== prior.state ||
            ingredient.unit !== prior.unit) return null;
        const quantity = amount(ingredient.quantity);
        if (!equalAmount(double(quantity), amount(prior.quantity)) || !equalAmount(quantity, allocated)) return null;
      }
      if (original.servings !== "2" || original.missing_ingredients.length ||
          original.source_refresh.exact_recipe_body_sha256 !== nutritionBody ||
          original.source_refresh.recipe_sha256_unchanged !== nutritionBody) return null;
      for (const macro of macros) for (const bound of ["min", "max"] as const) {
        if (!equalAmount(double(amount(original.per_serving[macro][bound])), amount(original.whole_batch[macro][bound]))) return null;
      }
      const expected = {
        ...original,
        servings: "1",
        whole_batch: original.per_serving,
        partial_whole_batch: original.per_serving,
      };
      return same(revised, expected) ? nutritionBody : null;
    } catch {
      return null;
    }
  };
}
