// MENU + FIXTURE WEEKS (REDESIGN-V4 §4) from the data snapshot. run: node scripts/gen-fixtures.ts
// the menu is the 27 base recipes with per-serving cost and protein from the snapshot (Kroger, Columbus 43215;
// estimate: true). the two fixture weeks keep their hand-authored day grids and run through the solver's
// evaluateWeek, so the list, its total and every per-meal cost come from real pack consolidation and the meals
// match the list to the cent. delivery, actual and accuracy are the marketing fixture's numbers (no Instacart key
// yet: the Delivery Gap has no live source, and nothing here models a markup).
import { existsSync, writeFileSync } from "node:fs";
import { baseRecipes, evaluateWeek, servingCost, servingNutrition, type SolveInput, type SolveOutput } from "../packages/solver/src/index.ts";
import { snapshot } from "../data/snapshot.ts";

type Aisle = "meat" | "dairy" | "pantry" | "frozen" | "produce";
const STORE = "kroger";
const ZIP = "43215";
const cents = (n: number) => Math.round(n * 100) / 100;

const menu = baseRecipes(snapshot)
  .map((r) => {
    const n = servingNutrition(r.id, snapshot);
    return {
      id: r.id,
      name: r.name,
      type: r.meal_type,
      protein_source: r.tags.find((t) => t.startsWith("protein:"))?.slice(8) ?? "",
      protein_g: n.protein_g,
      cost_usd: servingCost(r.id, snapshot, STORE, ZIP),
      estimate: true as const,
      img: `/img/menu/${r.id}.jpg`,
    };
  })
  .sort((a, b) => ["breakfast", "lunch", "dinner"].indexOf(a.type) - ["breakfast", "lunch", "dinner"].indexOf(b.type));
for (const m of menu) if (!existsSync(`public/img/menu/${m.id}.jpg`)) throw new Error(`no photo for ${m.id}`);
const byName = Object.fromEntries(snapshot.recipes.map((r) => [r.name, r.id]));

type Plan = { id: string; budget: number; goal: number; days: [string, string, string, string][]; delivery: number; actual: number; accuracy: number };

// lunches are mostly last night's dinner doubled (three of five); the other two are menu lunches
const WEEK_1: Plan = {
  id: "example",
  budget: 55,
  goal: 150,
  days: [
    ["mon", "Protein oatmeal with peanut butter and banana", "Chicken caesar wrap", "Teriyaki chicken and broccoli rice bowl"],
    ["tue", "Greek yogurt parfait with berries and granola", "Chicken burrito bowl", "Turkey chili"],
    ["wed", "Egg white and veggie scramble with toast", "Turkey chili", "Sheet pan chicken with sweet potato and broccoli"],
    ["thu", "Cottage cheese bowl with fruit and honey", "Sheet pan chicken with sweet potato and broccoli", "Pesto chicken pasta"],
    ["fri", "Protein pancakes with berries", "Pesto chicken pasta", "BBQ chicken with roasted vegetables and rice"],
  ],
  delivery: 68.9,
  actual: 48.55,
  accuracy: 96,
};

// the "regenerate" week (S6): same two numbers, different dinners
const WEEK_2: Plan = {
  id: "example-2",
  budget: 55,
  goal: 150,
  days: [
    ["mon", "Egg white and veggie scramble with toast", "Turkey taco bowl", "Chicken fajita bowl"],
    ["tue", "Cottage cheese bowl with fruit and honey", "Chicken fajita bowl", "Turkey meatballs with whole wheat spaghetti"],
    ["wed", "Protein oatmeal with peanut butter and banana", "Turkey meatballs with whole wheat spaghetti", "Chicken stir-fry with rice"],
    ["thu", "Greek yogurt parfait with berries and granola", "Mediterranean chicken bowl with tzatziki", "Buffalo chicken bowl"],
    ["fri", "Egg and avocado breakfast wrap", "Buffalo chicken bowl", "Healthier chicken parmesan"],
  ],
  delivery: 65.4,
  actual: 44.11,
  accuracy: 96,
};

const AISLE: Record<string, Aisle> = { meat: "meat", dairy: "dairy", pantry: "pantry", frozen: "frozen", produce: "produce", bakery: "pantry" };
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// each list line's full price spread over the servings that use it, so meals sum to the list to the cent
function mealCosts(out: SolveOutput): number[][] {
  const ing = new Map<string, { sku: string; qty: number }[]>();
  for (const i of snapshot.recipe_ingredients) {
    const arr = ing.get(i.recipe_id) ?? [];
    arr.push({ sku: i.sku_id, qty: i.qty * (i.unit === "oz" ? 28.3495 : i.unit === "lb" ? 453.592 : i.unit === "fl_oz" ? 29.5735 : i.unit === "tbsp" ? 14.7868 : i.unit === "tsp" ? 4.92892 : i.unit === "cup" ? 236.588 : 1) });
    ing.set(i.recipe_id, arr);
  }
  const useBySku = new Map<string, number>();
  const meals = out.days.flatMap((d) => d.items.map((m) => m.recipe_id));
  for (const id of meals) for (const p of ing.get(id) ?? []) useBySku.set(p.sku, (useBySku.get(p.sku) ?? 0) + p.qty);
  const costs = meals.map(() => 0);
  for (const line of out.list) {
    const total = useBySku.get(line.sku_id) ?? 0;
    if (!total) continue;
    meals.forEach((id, i) => {
      const q = (ing.get(id) ?? []).find((p) => p.sku === line.sku_id)?.qty ?? 0;
      costs[i] += (line.price_usd * q) / total;
    });
  }
  // round to cents and push the residue onto the last meal so the sum is exact
  const rounded = costs.map(cents);
  const diff = cents(out.est_total - rounded.reduce((a, b) => a + b, 0));
  rounded[rounded.length - 1] = cents(rounded[rounded.length - 1] + diff);
  return out.days.map((_, d) => rounded.slice(d * 3, d * 3 + 3));
}

function build(p: Plan) {
  const ids = p.days.map(([, b, l, d]) =>
    [b, l, d].map((name) => {
      const id = byName[name];
      if (!id) throw new Error(`not on the menu: ${name}`);
      return id;
    }),
  );
  const input: SolveInput = { budget: p.budget, protein_per_day: p.goal, kcal_min: 1800, kcal_max: 2800, diet: "none", household: 1, stores: [STORE], zip: ZIP };
  const out = evaluateWeek(ids, input, snapshot);
  const costs = mealCosts(out);
  const days = out.days.map((d, di) => {
    const meals = d.items.map((m, si) => ({ slot: (["breakfast", "lunch", "dinner"] as const)[si], menu: m.recipe_id, name: m.name, protein_g: m.protein_g, cost_usd: costs[di][si], img: `/img/menu/${snapshot.recipe_variants.find((v) => v.variant_recipe_id === m.recipe_id)?.recipe_id ?? m.recipe_id}.jpg` }));
    return { day: d.day, meals, protein_g: d.protein_g, cost_usd: cents(meals.reduce((a, m) => a + m.cost_usd, 0)) };
  });
  const est_total_usd = out.est_total;
  const listTotal = cents(days.reduce((a, d) => a + d.cost_usd, 0));
  if (listTotal !== est_total_usd) throw new Error(`${p.id}: meals ${listTotal} vs list ${est_total_usd}`);
  if (!out.feasible) console.warn(`${p.id}: not feasible as authored: ${out.why.join("; ")}`);
  const items = out.list.map((i) => ({ name: `${cap(i.name.split(",")[0])}, ${i.unit}`, aisle: AISLE[i.aisle], price_usd: i.price_usd, checked: i.aisle === "meat" }));
  return {
    id: p.id,
    budget_usd: p.budget,
    protein_goal_g: p.goal,
    generated_at: snapshot.generated_at,
    days,
    totals: { est_total_usd, protein_per_day_g: out.protein_per_day, under_budget_by_usd: cents(p.budget - est_total_usd), waste_lb: 0, items: items.length },
    list: { items, est_total_usd, delivery_est_usd: p.delivery, delivery_saves_usd: cents(p.delivery - est_total_usd), delivery_label: "Delivered from Kroger, estimated" },
    receipt: { estimated_usd: est_total_usd, actual_usd: p.actual, delta_pct: Math.round(((p.actual - est_total_usd) / est_total_usd) * 100), accuracy_pct: p.accuracy, verified: true },
  };
}

const w1 = build(WEEK_1);
const w2 = build(WEEK_2);
const write = (path: string, data: unknown) => writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
write("data/menu.json", menu);
write("data/fixture-week.json", w1);
write("data/fixture-week-2.json", w2);
for (const w of [w1, w2]) console.log(w.id, `$${w.totals.est_total_usd}`, `${w.totals.protein_per_day_g}g/day`, `under by $${w.totals.under_budget_by_usd}`, `${w.totals.items} items`);
console.log("menu", menu.length, "dishes");
