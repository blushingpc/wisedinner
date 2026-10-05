// FoodData Central per sku (Foundation + SR Legacy): macros per 100 g and the fdc id. the match is cached in
// data/usda-map.json (committed) so a re-run only queries skus without an entry; edit the file by hand to pin a
// better fdc id (set "pinned": true and the fetcher keeps it but refreshes the numbers).
// run: node scripts/data/usda.ts  (needs USDA_FDC_API_KEY)
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { log, required } from "./env.ts";
import { SKUS } from "./authored/skus.ts";
import type { Nutrition } from "../../packages/solver/src/types.ts";

const MAP = "data/usda-map.json";
type Entry = { fdc_id: number; description: string; protein_g: number; kcal: number; fat_g: number; carbs_g: number; pinned?: boolean; manual?: boolean; matched_at: string };
export type UsdaMap = Record<string, Entry>;

const N = { protein: 1003, fat: 1004, carbs: 1005, kcal: 1008 };

export type Food = { fdcId: number; description: string; dataType: string; foodNutrients: { nutrientId: number; value: number }[] };

// These identities were confirmed wrong in the September cache. Pins and manual flags must not bypass them.
// This is a targeted safety gate, not a claim that all other historical matches have been reviewed.
const IDENTITY_RULES: Record<string, { words: RegExp[]; forbidden: RegExp; rejectedIds: number[] }> = {
  "plant-yogurt": { words: [/\balmond\b/i, /\byogurt\b/i], forbidden: /\bsoy\b/i, rejectedIds: [175227] },
  "pea-protein": { words: [/\bpea\b/i, /\bprotein\b/i], forbidden: /\b(?:soy|whey)\b/i, rejectedIds: [173181] },
  "russet-potatoes": { words: [/\bpotato(?:es)?\b/i, /\bflesh\b/i], forbidden: /\bskin only\b/i, rejectedIds: [170032] },
  "frozen-peppers-onions": { words: [/\bpeppers?\b/i, /\bonions?\b/i], forbidden: /\bsoy\b/i, rejectedIds: [170022] },
  "taco-seasoning": { words: [/\btaco\b/i, /\bseasoning\b/i], forbidden: /\bchili powder\b/i, rejectedIds: [171319] },
};

export function nutritionProblems(map: UsdaMap, skus = SKUS): string[] {
  const problems: string[] = [];
  const ids = new Set(skus.map((s) => s.id));
  for (const id of Object.keys(map)) if (!ids.has(id)) problems.push(`${id}: unknown nutrition SKU`);
  for (const s of skus) {
    const entry = map[s.id];
    if (!entry) {
      problems.push(`${s.id}: missing nutrition match`);
      continue;
    }
    if (!Number.isInteger(entry.fdc_id) || entry.fdc_id < 0 || (entry.fdc_id === 0 && !entry.manual))
      problems.push(`${s.id}: invalid source ID`);
    if (typeof entry.description !== "string" || !entry.description.trim()) problems.push(`${s.id}: missing source description`);
    for (const field of ["protein_g", "kcal", "fat_g", "carbs_g"] as const) {
      if (!Number.isFinite(entry[field]) || entry[field] < 0 || (field === "kcal" && entry[field] === 0))
        problems.push(`${s.id}: invalid ${field}`);
    }
    const rule = IDENTITY_RULES[s.id];
    if (rule && (rule.rejectedIds.includes(entry.fdc_id) || typeof entry.description !== "string" ||
      rule.words.some((word) => !word.test(entry.description)) || rule.forbidden.test(entry.description)))
      problems.push(`${s.id}: nutrition identity does not match the authored ingredient; review the source record`);
  }
  return problems;
}

function assertNutrition(map: UsdaMap, skus = SKUS): void {
  const problems = nutritionProblems(map, skus);
  if (problems.length) throw new Error(`nutrition review required:\n${problems.join("\n")}`);
}

const normalized = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

// Search relevance is not ingredient identity. A non-exact result needs an explicitly reviewed cache entry.
export function pickUsdaFood(query: string, foods: Food[]): Food | undefined {
  const exact = foods.filter((f) => {
    const values = macros(f);
    return normalized(f.description) === normalized(query) && values.kcal > 0 && Object.values(values).every(v => Number.isFinite(v) && v >= 0);
  });
  return exact.find((f) => f.dataType === "Foundation") ?? exact[0];
}

// Source-reported Atwater fields are valid energy. Missing nutrients are unknown, never fabricated zeros or 4P+4C+9F.
function macros(f: Food) {
  const get = (id: number) => f.foodNutrients.find((n) => n.nutrientId === id)?.value;
  const protein_g = get(N.protein) ?? NaN;
  const fat_g = get(N.fat) ?? NaN;
  const carbs_g = get(N.carbs) ?? NaN;
  const kcal = get(N.kcal) ?? get(2047) ?? get(2048) ?? NaN;
  return { protein_g, kcal, fat_g, carbs_g };
}

async function search(key: string, query: string): Promise<Food[]> {
  const u = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  u.searchParams.set("query", query.replace(/[()/]/g, " ").replace(/\s+/g, " ").trim());
  u.searchParams.set("dataType", "Foundation,SR Legacy");
  u.searchParams.set("pageSize", "8");
  u.searchParams.set("api_key", key);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`usda search ${res.status}`);
  return ((await res.json()) as { foods: Food[] }).foods ?? [];
}

async function byId(key: string, id: number): Promise<Food> {
  const res = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${id}?api_key=${key}`);
  if (!res.ok) throw new Error(`usda ${id} ${res.status}`);
  const j = (await res.json()) as { fdcId: number; description: string; dataType: string; foodNutrients: { nutrient: { id: number }; amount: number }[] };
  return { fdcId: j.fdcId, description: j.description, dataType: j.dataType, foodNutrients: j.foodNutrients.map((n) => ({ nutrientId: n.nutrient.id, value: n.amount })) };
}

export function loadUsdaMap(): UsdaMap {
  return existsSync(MAP) ? (JSON.parse(readFileSync(MAP, "utf8")) as UsdaMap) : {};
}

type Fetchers = { byId: (id: number) => Promise<Food>; search: (query: string) => Promise<Food[]> };

// Work on a copy and validate the whole result before the caller persists anything.
export async function resolveUsdaMap(cached: UsdaMap, fetchers: Fetchers, matchedAt: string, skus = SKUS): Promise<UsdaMap> {
  const map = structuredClone(cached);
  for (const s of skus) {
    const cur = map[s.id];
    if (cur?.manual || (cur && !cur.pinned)) {
      continue;
    }
    if (cur?.pinned) {
      const f = await fetchers.byId(cur.fdc_id);
      if (f.fdcId !== cur.fdc_id) throw new Error(`nutrition review required: ${s.id}: requested source ID was not returned`);
      map[s.id] = { ...cur, description: f.description, ...macros(f), matched_at: matchedAt };
      continue;
    }
    const pick = pickUsdaFood(s.usda, await fetchers.search(s.usda));
    if (!pick) throw new Error(`nutrition review required: ${s.id}: no exact source match; review and pin a matching record`);
    map[s.id] = { fdc_id: pick.fdcId, description: pick.description, ...macros(pick), matched_at: matchedAt };
  }
  assertNutrition(map, skus);
  return map;
}

export async function fetchUsda(): Promise<UsdaMap> {
  const key = required("USDA_FDC_API_KEY");
  const map = await resolveUsdaMap(loadUsdaMap(), { byId: (id) => byId(key, id), search: (query) => search(key, query) }, new Date().toISOString().slice(0, 10));
  writeFileSync(MAP, JSON.stringify(map, null, 2) + "\n");
  log("usda", `${SKUS.length} skus with nutrition → ${MAP}`);
  return map;
}

export const nutritionRows = (map: UsdaMap): Nutrition[] => {
  assertNutrition(map);
  return Object.entries(map).map(([sku_id, e]) => ({ sku_id, protein_g: e.protein_g, kcal: e.kcal, fat_g: e.fat_g, carbs_g: e.carbs_g, per: "100g" }));
};

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/data/usda.ts")) fetchUsda().catch((e) => { console.error(e); process.exit(1); });
