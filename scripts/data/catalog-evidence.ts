// Read-only original-source lookup. Never imports the pipeline runner or database client.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import "./env.ts";
import { SKUS } from "./authored/skus.ts";
import type { UsdaMap } from "./usda.ts";

export type SourceFood = {
  fdcId: number; description: string; dataType: string; accessed: string; url: string;
  nutrients: { id: number; name: string; unit: string; amount: number }[];
  portions: { amount: number; modifier: string; grams: number; unit: string }[];
};

export async function collectEvidence() {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key || /placeholder|your_|replace/i.test(key)) throw new Error("USDA credential unavailable; no lookup made");
  const map: UsdaMap = JSON.parse(readFileSync("data/usda-map.json", "utf8"));
  const ids = [...new Set(SKUS.map(s => map[s.id]?.fdc_id).filter((id): id is number => typeof id === "number" && id > 0))];
  const foods: SourceFood[] = [];
  // USDA's documented default is 1,000 requests/hour. This bounded run needs fewer than 80.
  for (const id of ids) {
    let response: Response;
    try {
      response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${id}`, {
        headers: { "X-Api-Key": key }, signal: AbortSignal.timeout(20000),
      });
    } catch { throw new Error(`USDA transport failure for record ${id}; no credential logged`); }
    if (!response.ok) throw new Error(`USDA record ${id}: HTTP ${response.status}`);
    const food = await response.json();
    if (food.fdcId !== id) throw new Error(`USDA returned a different record for ${id}`);
    foods.push({
      fdcId: id, description: food.description, dataType: food.dataType,
      accessed: new Date().toISOString().slice(0, 10),
      url: `https://fdc.nal.usda.gov/food-details/${id}/nutrients`,
      nutrients: food.foodNutrients.filter((n: { nutrient: { id: number } }) => [1003, 1004, 1005, 1008, 2047, 2048].includes(n.nutrient.id))
        .map((n: { nutrient: { id: number; name: string; unitName: string }; amount: number }) => ({ id: n.nutrient.id, name: n.nutrient.name, unit: n.nutrient.unitName, amount: n.amount })),
      portions: (food.foodPortions ?? []).map((p: { amount: number; modifier: string; gramWeight: number; measureUnit: { name: string } }) => ({ amount: p.amount, modifier: p.modifier ?? "", grams: p.gramWeight, unit: p.measureUnit?.name ?? "" })),
    });
  }
  const dir = "docs/ingredient-catalog";
  mkdirSync(dir, { recursive: true });
  writeFileSync(`${dir}/usda-evidence.json`, JSON.stringify({ accessed: new Date().toISOString(), basis: "USDA Foundation/SR Legacy nutrients per 100 g edible food; portions are not purchased-pack yields", foods }, null, 2) + "\n");
  console.log(JSON.stringify({ records: foods.length, output: `${dir}/usda-evidence.json` }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  collectEvidence().catch(error => { console.error(error.message); process.exitCode = 1; });
}
