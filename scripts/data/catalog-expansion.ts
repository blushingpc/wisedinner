import { createHash } from "node:crypto";
import { SKUS } from "./authored/skus.ts";
import type { AuthoredRecipe, Ing } from "./authored/types.ts";
import { expandRecipes } from "./expand.ts";
import { toCanonical } from "../../packages/solver/src/units.ts";
import { nutritionFingerprint, type NutritionReview } from "./catalog-review.ts";
import { SAFETY, type SafetyTable } from "./ingredient-safety.ts";
import type { UsdaMap } from "./usda.ts";

type Method = "bowl" | "soup";
type Role = "protein" | "grain" | "vegetable";
type Part = { row: Ing; role: Role };
export type Candidate = { recipe: AuthoredRecipe; method: Method; parts: Part[]; photo: null; quantity_basis?: "reviewed-edible" };
export type Approval = { candidate_digest: string; recipe_ids: string[]; reviewed_at: string };

const PROTEINS = ["chicken-breast", "ground-turkey", "ground-beef", "eggs", "lentils", "frozen-edamame", "tofu", "tempeh", "canned-tuna"];
const PAIRS = [["chicken-breast", "lentils"], ["ground-turkey", "lentils"], ["ground-beef", "lentils"], ["eggs", "frozen-edamame"], ["lentils", "frozen-edamame"]];
const GRAINS = ["white-rice", "brown-rice", "quinoa", "penne", "ww-spaghetti", "gf-pasta"];
const VEGETABLES = ["frozen-broccoli", "frozen-mixed-veg", "frozen-stirfry-veg", "frozen-peppers-onions", "carrots", "tomatoes", "asparagus"];
const LABELS: Record<string, string> = {
  "chicken-breast": "Chicken breast", "ground-turkey": "Ground turkey", "ground-beef": "Ground beef", eggs: "Eggs", lentils: "Lentils",
  "frozen-edamame": "Edamame", tofu: "Tofu", tempeh: "Tempeh", "canned-tuna": "Tuna",
  "white-rice": "White rice", "brown-rice": "Brown rice", quinoa: "Quinoa", penne: "Penne", "ww-spaghetti": "Whole wheat spaghetti", "gf-pasta": "Corn and rice pasta",
  "frozen-broccoli": "Broccoli", "frozen-mixed-veg": "Mixed vegetables", "frozen-stirfry-veg": "Stir fry vegetables", "frozen-peppers-onions": "Peppers and onions",
  carrots: "Carrots", tomatoes: "Tomatoes", asparagus: "Asparagus",
};
const label = (id: string) => LABELS[id] ?? id;
const lower = (id: string) => label(id).toLowerCase();
const grams = (id: string, paired: boolean): Ing => [id, id === "eggs" ? (paired ? 2 : 3) : id === "lentils" ? (paired ? 50 : 90) : paired ? 120 : 180, id === "eggs" ? "each" : "g"];

export function directions(parts: Part[], method: Method, reviewedEdible = false): string[] {
  const grain = parts.find(p => p.role === "grain")!.row;
  const steps = [grain[0] === "oats"
    ? `Weigh ${grain[1]} ${grain[2]} of plain rolled oats dry. Simmer in water for about 5 minutes, stirring until soft. Keep all oats and cooking water.`
    : `Weigh ${grain[1]} ${grain[2]} of ${lower(grain[0])} dry. ${["white-rice", "brown-rice", "quinoa"].includes(grain[0]) ? `Rinse and simmer in water until tender, about ${grain[0] === "brown-rice" ? "45" : "20"} minutes. ${method === "bowl" ? "Use enough water to absorb into the grain without draining." : "Keep extra cooking water for a brothy soup."}` : "Boil in water until tender according to the package, reserving the cooking water."}`];
  for (const { row: [id, qty, unit], role } of parts.filter(p => p.role !== "grain")) {
    const portion = `${qty} ${unit} of ${lower(id)}`;
    if (id === "lentils") steps.push(`Rinse ${portion}, weighed dry. Simmer separately in water for 25 to 35 minutes until soft, keeping the cooking liquid.`);
    else if (id === "chicken-breast") steps.push(`Cut ${portion}, weighed raw, into small pieces. Simmer in a covered pan with a little water until the center reaches 165 F. Keep the cooked meat and all juices.`);
    else if (id === "ground-turkey" || id === "ground-beef") steps.push(`Break up ${portion}, weighed raw, in a nonstick pan and cook through to ${id === "ground-turkey" ? "165" : "160"} F. Do not drain the fat or cooking juices.`);
    else if (id === "eggs") steps.push(`Crack ${qty} large eggs into a nonstick pan with a splash of water. Stir and cook until firm throughout and the egg mixture reaches 160 F.`);
    else if (id === "canned-tuna") steps.push(`Measure ${portion} as drained edible solids. Warm gently in a covered pan with a little water. Purchased drained yield still requires package review.`);
    else if (id === "tofu" || id === "tempeh") steps.push(`Cut ${portion} into small cubes. Heat in a nonstick covered pan with a little water until steaming hot throughout.`);
    else if (id === "frozen-edamame") steps.push(`Measure ${portion} as frozen shelled beans. Simmer in a little water until tender and thoroughly heated, following the package minimum cooking directions. Keep the cooking liquid.`);
    else if (role === "vegetable") steps.push(reviewedEdible && ["carrots", "onions", "tomatoes"].includes(id)
      ? `Wash ${lower(id)}. ${id === "carrots" ? "Remove the tops, trim and peel, then chop." : id === "onions" ? "Remove the skin and ends, then chop." : "Remove stems and core, then dice."} Weigh ${portion} after preparation, before cooking. Simmer in water until tender and retain all edible pieces and cooking liquid.`
      : `Measure ${portion} as edible ${id.startsWith("frozen-") ? "frozen" : "washed and trimmed raw"} vegetables. Cut large pieces small and simmer until tender, following any package minimum cooking directions. Keep the cooking liquid.`);
    else throw new Error(`No preparation for ${id}`);
  }
  steps.push(method === "bowl" ? "Combine the cooked ingredients and retained juices with the grain. Reduce excess water briefly to a thick bowl and serve hot. No unlisted oil, sauce or seasoning is assumed."
    : "Combine all cooked ingredients and retained juices in a pot. Add water to make a brothy soup, bring back to a simmer and serve hot. No unlisted broth, oil, sauce or seasoning is assumed.");
  return steps;
}

function makeCandidate(proteins: string[], grain: string, vegetables: string[], method: Method): Candidate {
  const parts: Part[] = [
    ...proteins.map(id => ({ row: grams(id, proteins.length > 1), role: "protein" as const })),
    { row: [grain, 80, "g"], role: "grain" },
    ...vegetables.map(id => ({ row: [id, vegetables.length > 1 ? 80 : 140, "g"] as Ing, role: "vegetable" as const })),
  ];
  const id = `catalog-${proteins.join("-")}-${grain}-${vegetables.join("-")}-${method}`;
  const minutes = Math.max(grain === "brown-rice" ? 50 : 30, proteins.includes("lentils") ? 40 : 0);
  return {
    method, parts, photo: null,
    recipe: { id, name: `${label(proteins[0])}${proteins.slice(1).map(p => ` and ${lower(p)}`).join("")} with ${lower(grain)} and ${vegetables.map(lower).join(" and ")} ${method}`,
      meal_type: proteins[0] === "eggs" && method === "bowl" ? "breakfast" : method === "soup" ? "lunch" : "dinner",
      protein: proteins.map(lower).join(" and "), minutes, ingredients: parts.map(p => p.row), steps: directions(parts, method), variants: [] },
  };
}

export function generateCandidates(): Candidate[] {
  const sides = [...VEGETABLES.map(v => [v]), ...VEGETABLES.flatMap((v, index) => VEGETABLES.slice(index + 1).map(w => [v, w]))];
  const out: Candidate[] = [];
  for (const proteins of [...PROTEINS.map(p => [p]), ...PAIRS]) for (const grain of GRAINS) for (const vegetables of sides) for (const method of ["bowl", "soup"] as const) out.push(makeCandidate(proteins, grain, vegetables, method));
  return out;
}

export function candidateIdentity(candidate: Candidate): string {
  // Ignore cosmetic title/ID/meal slot and portion tweaks. Technique and actual ingredients define a new preparation.
  return `${candidate.method}:${candidate.recipe.ingredients.map(([id]) => id).sort().join("+")}`;
}
export function candidateDigest(candidates: Candidate[]) {
  return createHash("sha256").update(JSON.stringify(candidates)).digest("hex");
}

export function compileCandidate(candidate: Candidate) {
  const { recipe, parts, method } = candidate;
  if (!["bowl", "soup"].includes(method)) throw new Error("Unknown preparation");
  if (new Set(recipe.ingredients.map(r => r[0])).size !== recipe.ingredients.length) throw new Error(`${recipe.id}: duplicate ingredient identity`);
  if (JSON.stringify(recipe.ingredients) !== JSON.stringify(parts.map(p => p.row))) throw new Error(`${recipe.id}: ingredient quantities contradict directions`);
  if (parts.filter(p => p.role === "grain").length !== 1 || !parts.some(p => p.role === "protein") || !parts.some(p => p.role === "vegetable")) throw new Error(`${recipe.id}: incomplete meal structure`);
  for (const part of parts) {
    const [id, qty, unit] = part.row;
    const allowed = part.role === "grain" ? [...GRAINS, "oats"] : part.role === "protein" ? PROTEINS : [...VEGETABLES, "onions"];
    if (!allowed.includes(id)) throw new Error(`${recipe.id}: ingredient contradicts preparation role`);
    const sku = SKUS.find(s => s.id === id);
    if (!sku || toCanonical(qty, unit, sku) <= 0) throw new Error(`${recipe.id}: invalid ingredient quantity`);
  }
  if (JSON.stringify(recipe.steps) !== JSON.stringify(directions(parts, method, candidate.quantity_basis === "reviewed-edible"))) throw new Error(`${recipe.id}: missing or contradictory ingredient directions`);
  if (recipe.minutes < (parts.some(p => p.row[0] === "brown-rice") ? 50 : parts.some(p => p.row[0] === "lentils") ? 40 : 30)) throw new Error(`${recipe.id}: cooking time contradicts ingredient preparation`);
  return expandRecipes([recipe]);
}

export function assessCandidates(candidates: Candidate[], map: UsdaMap, reviews: NutritionReview[], approval?: Approval, safety: SafetyTable = SAFETY) {
  if (approval && approval.candidate_digest !== candidateDigest(candidates)) throw new Error("Approval manifest is stale; review regenerated candidates before approval");
  const approvals = new Set(approval?.recipe_ids ?? []);
  if (approvals.size !== (approval?.recipe_ids.length ?? 0) || [...approvals].some(id => !candidates.some(c => c.recipe.id === id))) throw new Error("Approval IDs must be unique and present");
  const identities = new Set<string>();
  const ids = new Set<string>();
  let unique = 0, validated = 0, reviewReady = 0;
  const eligible: Candidate[] = [];
  const quarantine: { id: string; reasons: string[] }[] = [];
  for (const candidate of candidates) {
    const reasons: string[] = [];
    const identity = candidateIdentity(candidate);
    if (identities.has(identity) || ids.has(candidate.recipe.id)) reasons.push("Duplicate preparation identity or recipe ID");
    else { identities.add(identity); ids.add(candidate.recipe.id); unique++; }
    if (!reasons.length) {
      try { compileCandidate(candidate); validated++; } catch (e) { reasons.push((e as Error).message); }
    }
    for (const [id] of candidate.recipe.ingredients) {
      const sku = SKUS.find(s => s.id === id);
      const review = reviews.find(r => r.sku_id === id);
      if (!sku || !map[id] || !review || review.status !== "generic-reviewed" || review.fingerprint !== nutritionFingerprint(sku, map[id])) reasons.push(`${id}: nutrition unresolved or stale`);
      if (!safety[id] || safety[id].sku_id !== id || safety[id].status !== "reviewed" || !safety[id].allergens || !safety[id].diet) reasons.push(`${id}: safety metadata unreviewed`);
    }
    if (!reasons.length) reviewReady++;
    if (!approvals.has(candidate.recipe.id)) reasons.push("Draft: explicit approval absent");
    if (reasons.length) quarantine.push({ id: candidate.recipe.id, reasons: [...new Set(reasons)] });
    else eligible.push(candidate);
  }
  return { counts: { generated: candidates.length, unique, validated, reviewReady, eligible: eligible.length, quarantined: quarantine.length }, eligible, quarantine };
}

export function compileApproved(candidates: Candidate[]) {
  const families = new Map<string, Candidate[]>();
  for (const c of candidates) {
    compileCandidate(c);
    const key = `${c.method}:${c.recipe.meal_type}:${JSON.stringify(c.parts.filter(p => p.role !== "protein"))}`;
    const group = families.get(key) ?? []; group.push(c); families.set(key, group);
  }
  const authored = [...families.values()].map(group => {
    const base = structuredClone(group[0].recipe);
    const baseProteins = group[0].parts.filter(p => p.role === "protein").map(p => p.row[0]);
    base.variants = group.slice(1).map(c => {
      const proteins = c.parts.filter(p => p.role === "protein").map(p => p.row);
      return {
        id: c.recipe.id, name: c.recipe.name, kind: "protein_swap" as const,
        protein: c.recipe.protein, minutes: c.recipe.minutes, steps: c.recipe.steps,
        swap: Object.fromEntries(baseProteins.map((id, index) => [id, proteins[index] ?? null])),
        add: proteins.slice(baseProteins.length),
      };
    });
    return base;
  });
  return { authored, ...expandRecipes(authored) };
}
