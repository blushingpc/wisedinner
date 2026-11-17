import { copyReferenceData } from "./generated-plan-data.ts";
import { sourcePolicyHashV2 } from "./generated-source-policy-basis-v2.ts";

export const dietaryPatterns = ["vegan", "vegetarian", "pescatarian"] as const;
export type DietaryPattern = typeof dietaryPatterns[number];
const dietLabels = { Vegan: "vegan", Vegetarian: "vegetarian", Pescatarian: "pescatarian" } as const;

export function dietaryPatternForLabel(label: string): DietaryPattern | undefined {
  return Object.hasOwn(dietLabels, label) ? dietLabels[label as keyof typeof dietLabels] : undefined;
}

type RecipeIdentity = { recipeId: string; recipeSha256: string };
type ReviewedDietaryRecipe = RecipeIdentity & { classification: DietaryPattern | "unrestricted"; evidenceSha256: string };
export type DietaryRegistry = {
  policy: "wd-recipe-dietary-admission-v1";
  sourceSha256: string;
  purchaseCorrespondencesSha256: string;
  recipes: readonly ReviewedDietaryRecipe[];
};

const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const rank = { vegan: 0, vegetarian: 1, pescatarian: 2, unrestricted: 3 } as const;

/** Both the recipe source and purchased product mapping are part of a dietary review. */
export function createDietaryRecipeGuard(value: unknown, expected: {
  sourceSha256: string; purchaseCorrespondencesSha256: string; registrySha256: string;
}) {
  try {
    const registry = copyReferenceData(value) as DietaryRegistry;
    if (!registry || Object.keys(registry).sort().join() !== "policy,purchaseCorrespondencesSha256,recipes,sourceSha256" ||
        registry.policy !== "wd-recipe-dietary-admission-v1" || !digest(registry.sourceSha256) ||
        !digest(registry.purchaseCorrespondencesSha256) || registry.sourceSha256 !== expected.sourceSha256 ||
        registry.purchaseCorrespondencesSha256 !== expected.purchaseCorrespondencesSha256 ||
        !Array.isArray(registry.recipes) || registry.recipes.length > 20000 ||
        !digest(expected.registrySha256) || sourcePolicyHashV2(registry) !== expected.registrySha256) return null;

    const recipes = new Map<string, ReviewedDietaryRecipe>();
    for (const row of registry.recipes) {
      if (!row || Object.keys(row).sort().join() !== "classification,evidenceSha256,recipeId,recipeSha256" ||
          typeof row.recipeId !== "string" || !row.recipeId.trim() || row.recipeId.length > 200 ||
          !digest(row.recipeSha256) || !digest(row.evidenceSha256) ||
          !Object.hasOwn(rank, row.classification) || recipes.has(row.recipeId)) return null;
      recipes.set(row.recipeId, row);
    }
    return Object.freeze({
      check(pattern: DietaryPattern, identity: RecipeIdentity) {
        if (!dietaryPatterns.includes(pattern)) return "review-required" as const;
        const recipe = recipes.get(identity.recipeId);
        if (!recipe || recipe.recipeSha256 !== identity.recipeSha256) return "review-required" as const;
        return rank[recipe.classification] <= rank[pattern] ? "allowed" as const : "excluded" as const;
      },
    });
  } catch {
    return null;
  }
}
