// Free, bounded, original-source lookup. Only writes this run's separate evidence file.
import "./env.ts";
import { writeFileSync } from "node:fs";
import type { SourceFood } from "./catalog-evidence.ts";

const foods: SourceFood[] = [];
for (const id of [170000, 170393, 170457, 173904, 170027, 170030]) {
  const key = process.env.USDA_FDC_API_KEY;
  if (!key || /placeholder|your_|replace/i.test(key)) throw new Error("USDA credential unavailable");
  let response: Response;
  try {
    response = await fetch(`https://api.nal.usda.gov/fdc/v1/food/${id}`, { headers: { "X-Api-Key": key }, signal: AbortSignal.timeout(20000) });
  } catch { throw new Error(`USDA transport failure for ${id}; credential not logged`); }
  if (!response.ok) throw new Error(`USDA ${id}: HTTP ${response.status}`);
  const food = await response.json();
  if (food.fdcId !== id) throw new Error("Source identity mismatch");
  foods.push({ fdcId: id, description: food.description, dataType: food.dataType,
    accessed: new Date().toISOString().slice(0, 10), url: `https://fdc.nal.usda.gov/food-details/${id}/nutrients`,
    nutrients: food.foodNutrients.filter((n: { nutrient: { id: number } }) => [1003,1004,1005,1008,2047,2048].includes(n.nutrient.id))
      .map((n: { nutrient: { id: number; name: string; unitName: string }; amount: number }) => ({ id: n.nutrient.id, name: n.nutrient.name, unit: n.nutrient.unitName, amount: n.amount })),
    portions: (food.foodPortions ?? []).map((p: { amount: number; modifier: string; gramWeight: number; measureUnit: { name: string } }) => ({ amount: p.amount, modifier: p.modifier ?? "", grams: p.gramWeight, unit: p.measureUnit?.name ?? "" })),
  });
}
const output = "docs/ingredient-catalog/reviewed-week-sources.json";
writeFileSync(output, JSON.stringify({ accessed: new Date().toISOString(), basis: "Original USDA per 100 g edible food. Portions are not AP yields.", foods }, null, 2) + "\n");
console.log(JSON.stringify({ output, records: foods.length }));
