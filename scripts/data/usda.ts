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

type Food = { fdcId: number; description: string; dataType: string; foodNutrients: { nutrientId: number; value: number }[] };

// Foundation rows often carry energy only as Atwater (2047/2048) or not at all: fall back to 4P + 4C + 9F
function macros(f: Food) {
  const get = (id: number) => f.foodNutrients.find((n) => n.nutrientId === id)?.value ?? 0;
  const protein_g = get(N.protein);
  const fat_g = get(N.fat);
  const carbs_g = get(N.carbs);
  const kcal = get(N.kcal) || get(2047) || get(2048) || Math.round(4 * protein_g + 4 * carbs_g + 9 * fat_g);
  return { protein_g, kcal, fat_g, carbs_g };
}

async function search(key: string, query: string): Promise<Food[]> {
  const u = new URL("https://api.nal.usda.gov/fdc/v1/foods/search");
  u.searchParams.set("query", query.replace(/[()/]/g, " ").replace(/\s+/g, " ").trim());
  u.searchParams.set("dataType", "Foundation,SR Legacy");
  u.searchParams.set("pageSize", "8");
  u.searchParams.set("api_key", key);
  const res = await fetch(u);
  if (!res.ok) throw new Error(`usda ${res.status}: ${await res.text()}`);
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

export async function fetchUsda(): Promise<UsdaMap> {
  const key = required("USDA_FDC_API_KEY");
  const map = loadUsdaMap();
  let hits = 0;
  let misses = 0;
  for (const s of SKUS) {
    const cur = map[s.id];
    if (cur?.manual || (cur && !cur.pinned)) {
      hits++;
      continue;
    }
    if (cur?.pinned) {
      const f = await byId(key, cur.fdc_id);
      map[s.id] = { ...cur, description: f.description, ...macros(f), matched_at: new Date().toISOString().slice(0, 10) };
      hits++;
      continue;
    }
    const foods = await search(key, s.usda);
    // prefer an exact description match, then Foundation over SR Legacy, then the first with a kcal value
    const exact = foods.find((f) => f.description.toLowerCase() === s.usda.toLowerCase());
    const pick = exact ?? foods.find((f) => f.dataType === "Foundation" && macros(f).kcal > 0) ?? foods.find((f) => macros(f).kcal > 0);
    if (!pick) {
      misses++;
      log("usda", `no match for ${s.id} ("${s.usda}")`);
      continue;
    }
    map[s.id] = { fdc_id: pick.fdcId, description: pick.description, ...macros(pick), matched_at: new Date().toISOString().slice(0, 10) };
    hits++;
  }
  writeFileSync(MAP, JSON.stringify(map, null, 2) + "\n");
  log("usda", `${hits} skus with nutrition, ${misses} unmatched → ${MAP}`);
  return map;
}

export const nutritionRows = (map: UsdaMap): Nutrition[] =>
  Object.entries(map).map(([sku_id, e]) => ({ sku_id, protein_g: e.protein_g, kcal: e.kcal, fat_g: e.fat_g, carbs_g: e.carbs_g, per: "100g" }));

if (process.argv[1]?.replace(/\\/g, "/").endsWith("scripts/data/usda.ts")) fetchUsda().catch((e) => { console.error(e); process.exit(1); });
