// MENU v3 + FIXTURE WEEKS (REDESIGN-V4 §4). run: node scripts/gen-fixtures.ts
// the menu and both weeks are hand-authored here; the script only does the arithmetic so every total matches its
// meals and its list to the cent, then writes data/menu.json, data/fixture-week.json and data/fixture-week-2.json.
// protein and cost are per-serving estimates (estimate: true). solver templates for these dishes are the data
// sprint's job, not this one.
import { writeFileSync } from "node:fs";

type Type = "breakfast" | "lunch" | "dinner";
type Aisle = "meat" | "dairy" | "pantry" | "frozen" | "produce";

// name, type, headline protein, protein g, cost per serving
const MENU: [string, Type, string, number, number][] = [
  ["Greek yogurt parfait with berries and granola", "breakfast", "Greek yogurt", 38, 2.2],
  ["Protein oatmeal with peanut butter and banana", "breakfast", "whey and peanut butter", 40, 1.8],
  ["Egg white and veggie scramble with toast", "breakfast", "egg whites", 38, 2.1],
  ["Protein pancakes with berries", "breakfast", "whey and eggs", 40, 2.2],
  ["Egg and avocado breakfast wrap", "breakfast", "eggs", 36, 2.2],
  ["Cottage cheese bowl with fruit and honey", "breakfast", "cottage cheese", 40, 2.0],
  ["Chicken caesar wrap", "lunch", "chicken breast", 52, 3.6],
  ["Southwest chicken wrap", "lunch", "chicken breast", 50, 3.3],
  ["Chicken burrito bowl", "lunch", "chicken breast", 46, 3.6],
  ["Turkey and avocado sandwich on whole wheat", "lunch", "turkey breast", 44, 3.0],
  ["Tuna salad wrap", "lunch", "tuna", 42, 2.5],
  ["Mediterranean chicken bowl with tzatziki", "lunch", "chicken breast", 54, 3.6],
  ["Turkey taco bowl", "lunch", "ground turkey", 50, 3.2],
  ["Teriyaki chicken and broccoli rice bowl", "dinner", "chicken breast", 60, 3.8],
  ["Chicken fajita bowl", "dinner", "chicken breast", 56, 3.7],
  ["Sheet pan chicken with sweet potato and broccoli", "dinner", "chicken breast", 60, 4.2],
  ["Turkey chili", "dinner", "ground turkey", 58, 3.6],
  ["Pesto chicken pasta", "dinner", "chicken breast", 56, 4.1],
  ["Turkey meatballs with whole wheat spaghetti", "dinner", "ground turkey", 54, 3.6],
  ["Chicken stir-fry with rice", "dinner", "chicken breast", 56, 3.4],
  ["Healthier chicken parmesan", "dinner", "chicken breast", 62, 4.2],
  ["Turkey burgers with sweet potato wedges", "dinner", "ground turkey", 52, 3.7],
  ["Ground turkey lettuce wraps", "dinner", "ground turkey", 48, 3.2],
  ["BBQ chicken with roasted vegetables and rice", "dinner", "chicken thighs", 58, 4.1],
  ["Buffalo chicken bowl", "dinner", "chicken breast", 56, 3.6],
  ["Shrimp and veggie stir-fry", "dinner", "shrimp", 46, 4.5],
  ["Salmon with rice and asparagus", "dinner", "salmon", 48, 5.3],
];

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const menu = MENU.map(([name, type, protein_source, protein_g, cost_usd]) => ({ id: slug(name), name, type, protein_source, protein_g, cost_usd, estimate: true as const, img: `/img/menu/${slug(name)}.jpg` }));
const byName = Object.fromEntries(menu.map((m) => [m.name, m]));
const cents = (n: number) => Math.round(n * 100) / 100;

type Plan = { id: string; budget: number; goal: number; days: [string, string, string, string][]; list: [string, Aisle, number, boolean][]; delivery: number; actual: number; accuracy: number };

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
  list: [
    ["Chicken breast, 3 lb family pack", "meat", 9.97, true],
    ["Ground turkey 93/7, 2 lb", "meat", 8.98, true],
    ["Greek yogurt, 32 oz", "dairy", 4.49, false],
    ["Eggs, 18 ct", "dairy", 4.29, false],
    ["Cottage cheese, 24 oz", "dairy", 3.29, false],
    ["Jasmine rice, 5 lb", "pantry", 4.98, false],
    ["Whole wheat pasta, 16 oz", "pantry", 1.48, false],
    ["Rolled oats, 18 oz", "pantry", 2.98, false],
    ["Kidney beans, 2 cans", "pantry", 1.96, false],
    ["Frozen broccoli, 32 oz", "frozen", 1.98, false],
    ["Frozen mixed berries, 16 oz", "frozen", 2.32, false],
    ["Sweet potatoes, 3 lb", "produce", 2.48, false],
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
  list: [
    ["Chicken breast, 3 lb family pack", "meat", 9.47, true],
    ["Ground turkey 93/7, 2 lb", "meat", 7.98, true],
    ["Eggs, 18 ct", "dairy", 4.29, false],
    ["Greek yogurt, 32 oz", "dairy", 4.49, false],
    ["Cottage cheese, 24 oz", "dairy", 3.29, false],
    ["Jasmine rice, 3 lb", "pantry", 3.48, false],
    ["Whole wheat spaghetti, 16 oz", "pantry", 1.48, false],
    ["Marinara, 24 oz", "pantry", 1.98, false],
    ["Rolled oats, 18 oz", "pantry", 2.98, false],
    ["Bell peppers, 3 pack", "produce", 2.98, false],
    ["Romaine hearts, 3 pack", "produce", 2.48, false],
    ["Bananas, bunch", "produce", 1.6, false],
  ],
  delivery: 65.4,
  actual: 44.11,
  accuracy: 96,
};

function build(p: Plan) {
  const days = p.days.map(([day, b, l, d]) => {
    const meals = ([b, l, d] as const).map((name, i) => {
      const m = byName[name];
      if (!m) throw new Error(`not on the menu: ${name}`);
      return { slot: (["breakfast", "lunch", "dinner"] as const)[i], menu: m.id, name: m.name, protein_g: m.protein_g, cost_usd: m.cost_usd, img: m.img };
    });
    return { day, meals, protein_g: meals.reduce((a, m) => a + m.protein_g, 0), cost_usd: cents(meals.reduce((a, m) => a + m.cost_usd, 0)) };
  });
  const est_total_usd = cents(days.reduce((a, d) => a + d.cost_usd, 0));
  const list_total = cents(p.list.reduce((a, i) => a + i[2], 0));
  if (est_total_usd !== list_total) throw new Error(`${p.id}: meals ${est_total_usd} vs list ${list_total}`);
  if (p.list.length !== 12) throw new Error(`${p.id}: ${p.list.length} items`);
  const protein_per_day_g = Math.round(days.reduce((a, d) => a + d.protein_g, 0) / days.length);
  return {
    id: p.id,
    budget_usd: p.budget,
    protein_goal_g: p.goal,
    generated_at: "2026-09-08",
    days,
    totals: { est_total_usd, protein_per_day_g, under_budget_by_usd: cents(p.budget - est_total_usd), waste_lb: 0, items: p.list.length },
    list: {
      items: p.list.map(([name, aisle, price_usd, checked]) => ({ name, aisle, price_usd, checked })),
      est_total_usd,
      delivery_est_usd: p.delivery,
      delivery_saves_usd: cents(p.delivery - est_total_usd),
      delivery_label: "Delivered from Kroger, estimated",
    },
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
