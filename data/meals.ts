import { staples } from "./staples";

export type Meal = { name: string; img: string; alt: string; protein_g: number; price_usd: number };

// a depicted meal = fractions of real packs. protein and price are computed from staples.json, never typed in.
const MEALS: { name: string; img: string; alt: string; parts: [string, number][] }[] = [
  {
    name: "chicken thigh rice bowl",
    img: "/img/meal-chicken-bowl.jpg",
    alt: "ceramic bowl of sliced roasted chicken thigh over white rice with charred broccoli",
    parts: [
      ["chicken thighs, bone-in", 1 / 4],
      ["white rice, long grain", 1 / 10],
      ["frozen broccoli florets", 1 / 2],
    ],
  },
  {
    name: "yogurt oat parfait",
    img: "/img/meal-yogurt-parfait.jpg",
    alt: "glass of plain greek yogurt layered with oats and banana slices",
    parts: [
      ["greek yogurt, plain nonfat", 1 / 3],
      ["old fashioned oats", 1 / 12],
      ["bananas", 1 / 6],
    ],
  },
  {
    name: "black bean egg bowl",
    img: "/img/meal-bean-bowl.jpg",
    alt: "bowl of black beans and rice topped with halved boiled eggs",
    parts: [
      ["black beans, canned", 1],
      ["white rice, long grain", 1 / 10],
      ["eggs, large", 1 / 6],
    ],
  },
  // demo-band dinners — parts mirror data/templates.ts so the card price matches the solver's meal
  {
    name: "lentil and chicken stew",
    img: "/img/meal-lentil-stew.jpg",
    alt: "rustic ceramic bowl of lentil stew with shredded chicken, carrots and tomato",
    parts: [
      ["lentils, dry", 1 / 4],
      ["canned chicken breast", 1 / 2],
      ["canned diced tomatoes", 1 / 2],
      ["carrots", 1 / 4],
    ],
  },
  {
    name: "pork loin and sweet potato",
    img: "/img/meal-pork-sweet-potato.jpg",
    alt: "plate of sliced roasted pork loin with cubed sweet potato and carrots",
    parts: [
      ["pork loin", 1 / 6],
      ["sweet potatoes", 1 / 4],
      ["carrots", 1 / 4],
    ],
  },
  {
    name: "tuna rice bowl, edamame",
    img: "/img/meal-tuna-bowl.jpg",
    alt: "bowl of white rice topped with flaked tuna and shelled edamame",
    parts: [
      ["canned tuna in water", 2],
      ["white rice, long grain", 1 / 16],
      ["frozen edamame, shelled", 1 / 3],
    ],
  },
];

export const meals: Meal[] = MEALS.map(({ parts, ...m }) => {
  let protein_g = 0;
  let price_usd = 0;
  for (const [sku, frac] of parts) {
    const s = staples.find((x) => x.name === sku);
    if (!s) throw new Error(`meal part missing from staples: ${sku}`);
    protein_g += s.protein_g * frac;
    price_usd += s.price_usd * frac;
  }
  return { ...m, protein_g: Math.round(protein_g), price_usd: Math.round(price_usd * 100) / 100 };
});
