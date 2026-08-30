import raw from "./staples.json";

export type Staple = {
  name: string;
  unit: string; // the package as sold, e.g. "dozen", "5 lb bag"
  price_usd: number; // est. in-store shelf price per unit, +10% buffer already applied
  protein_g: number; // grams in the whole package
  kcal: number; // kcal in the whole package
  diet_flags: string[]; // subset of vegetarian | vegan | gluten-free | dairy-free
  perishable: boolean; // must be eaten within ~7 days of purchase
  price_as_of: string; // YYYY-MM-DD
};

export const staples: Staple[] = raw;
