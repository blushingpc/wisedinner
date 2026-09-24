// the store rows (BACKEND-V1 §1). price_index sources: docs/STORE-INDEX.md. the migration seeds the same rows;
// seed.ts upserts these so this file is the source of truth after the first run.
export type AuthoredStore = { id: string; chain: string; banner: string; region_scope: string; price_index: number; data_source: "kroger-api" | "walmart-api" | "index" };

export const STORES: AuthoredStore[] = [
  { id: "walmart", chain: "Walmart", banner: "Walmart", region_scope: "national", price_index: 0.9, data_source: "index" },
  { id: "kroger", chain: "Kroger", banner: "Kroger", region_scope: "midwest-south", price_index: 1.0, data_source: "kroger-api" },
  { id: "ralphs", chain: "Kroger", banner: "Ralphs", region_scope: "southern-california", price_index: 1.0, data_source: "kroger-api" },
  { id: "fred-meyer", chain: "Kroger", banner: "Fred Meyer", region_scope: "pacific-northwest", price_index: 1.0, data_source: "kroger-api" },
  { id: "qfc", chain: "Kroger", banner: "QFC", region_scope: "pacific-northwest", price_index: 1.0, data_source: "kroger-api" },
  { id: "king-soopers", chain: "Kroger", banner: "King Soopers", region_scope: "colorado", price_index: 1.0, data_source: "kroger-api" },
  { id: "frys", chain: "Kroger", banner: "Fry's", region_scope: "arizona", price_index: 1.0, data_source: "kroger-api" },
  { id: "smiths", chain: "Kroger", banner: "Smith's", region_scope: "mountain-west", price_index: 1.0, data_source: "kroger-api" },
  { id: "harris-teeter", chain: "Kroger", banner: "Harris Teeter", region_scope: "southeast", price_index: 1.05, data_source: "kroger-api" },
  { id: "dillons", chain: "Kroger", banner: "Dillons", region_scope: "kansas", price_index: 1.0, data_source: "kroger-api" },
  { id: "food-4-less", chain: "Kroger", banner: "Food 4 Less", region_scope: "california-midwest", price_index: 0.92, data_source: "kroger-api" },
  { id: "marianos", chain: "Kroger", banner: "Mariano's", region_scope: "chicago", price_index: 1.05, data_source: "kroger-api" },
  { id: "pick-n-save", chain: "Kroger", banner: "Pick 'n Save", region_scope: "wisconsin", price_index: 1.0, data_source: "kroger-api" },
  { id: "aldi", chain: "Aldi", banner: "Aldi", region_scope: "national", price_index: 0.85, data_source: "index" },
  { id: "target", chain: "Target", banner: "Target", region_scope: "national", price_index: 1.03, data_source: "index" },
  { id: "publix", chain: "Publix", banner: "Publix", region_scope: "southeast", price_index: 1.23, data_source: "index" },
  { id: "costco", chain: "Costco", banner: "Costco", region_scope: "national", price_index: 0.88, data_source: "index" },
  { id: "heb", chain: "H-E-B", banner: "H-E-B", region_scope: "texas", price_index: 0.92, data_source: "index" },
  { id: "trader-joes", chain: "Trader Joe's", banner: "Trader Joe's", region_scope: "national", price_index: 0.95, data_source: "index" },
  { id: "whole-foods", chain: "Whole Foods", banner: "Whole Foods Market", region_scope: "national", price_index: 1.28, data_source: "index" },
  { id: "safeway", chain: "Albertsons", banner: "Safeway", region_scope: "west", price_index: 1.12, data_source: "index" },
  { id: "albertsons", chain: "Albertsons", banner: "Albertsons", region_scope: "west-mountain", price_index: 1.12, data_source: "index" },
  { id: "meijer", chain: "Meijer", banner: "Meijer", region_scope: "midwest", price_index: 1.0, data_source: "index" },
  { id: "other", chain: "Other", banner: "Other store", region_scope: "national", price_index: 1.0, data_source: "index" },
];
