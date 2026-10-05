// Internal, additive review sidecar. This does not bless a branded package or change public snapshots.
import { createHash } from "node:crypto";
import { SKUS } from "./authored/skus.ts";
import type { UsdaMap } from "./usda.ts";
import type { SourceFood } from "./catalog-evidence.ts";
import { packCanonical } from "../../packages/solver/src/units.ts";

export const REVIEW_DATE = "2026-10-04";
export type NutritionReview = {
  sku_id: string; status: "generic-reviewed" | "blocked"; reasons: string[];
  fdc_id: number; source: string | null; description: string; accessed: string | null;
  basis: string; conversion: string; fingerprint: string; manual: boolean;
};
export function nutritionFingerprint(sku: (typeof SKUS)[number], entry: UsdaMap[string]) {
  return createHash("sha256").update(JSON.stringify({ sku, entry })).digest("hex");
}

// Only explicitly inspected identities and edible quantity bases may pass. New IDs default to blocked.
const GENERIC_BASES: Record<string, string> = {
  "chicken-breast": "Raw boneless skinless breast; weigh edible raw meat and retain cooking juices. USDA-reported Atwater general energy (2047) is used, not invented energy. Whole boneless pack usable.",
  "ground-turkey": "Raw 93/7 ground turkey; weigh raw boneless meat, retain cooking juices. Pack is edible raw mass.",
  "ground-beef": "Raw 80/20 ground beef; weigh raw boneless meat, retain fat and cooking juices. No drained cooked basis.",
  eggs: "Raw whole edible egg; count large eggs, 50 g edible contents each, shells excluded from nutrition and count-based purchase.",
  lentils: "Dry raw lentils; weigh dry before adding water. Whole dry pack usable; cooking water has no authored nutrients.",
  "white-rice": "Dry raw unenriched long-grain rice; weigh dry before cooking. Whole dry pack usable.",
  "brown-rice": "Dry raw long-grain brown rice; weigh dry before cooking. Whole dry pack usable.",
  quinoa: "Dry uncooked quinoa; weigh dry, rinse and cook with water. Whole dry pack usable.",
  "frozen-edamame": "Shelled frozen edamame, unprepared; weigh frozen edible beans, not pods or cooked yield. Plain single ingredient only.",
  "frozen-broccoli": "Frozen plain broccoli, unprepared; weigh frozen florets and stems. Chopped USDA reference is generic, not a verified branded bag.",
};

const REVIEWED_SOURCES: Record<string, number> = {
  "chicken-breast": 2646170, "ground-turkey": 172850, "ground-beef": 174036, eggs: 171287,
  lentils: 172420, "white-rice": 169756, "brown-rice": 169703, quinoa: 168874,
  "frozen-edamame": 168410, "frozen-broccoli": 169968,
};
const REVIEWED_PACKS: Record<string, [number, string, string, number]> = {
  "chicken-breast": [3, "lb", "g", 1], "ground-turkey": [1, "lb", "g", 1], "ground-beef": [1, "lb", "g", 1],
  eggs: [12, "each", "each", 50], lentils: [1, "lb", "g", 1], "white-rice": [5, "lb", "g", 1],
  "brown-rice": [2, "lb", "g", 1], quinoa: [1, "lb", "g", 1], "frozen-edamame": [12, "oz", "g", 1], "frozen-broccoli": [12, "oz", "g", 1],
};

const NOTES: Record<string, string> = {
  "pea-protein": "Confirmed wrong identity: FDC 173181 is soy, not pea. Generic pea powder has no fixed isolate concentration or verified package label.",
  "plant-yogurt": "Confirmed wrong identity: FDC 175227 is soy yogurt, not almond. Manufacturer candidate is saved separately, not verified against purchased SKU.",
  "chicken-thighs": "Bone-in purchased mass is not edible meat and skin mass; no usable yield is documented. Cache also has negative carbohydrate.",
  "frozen-chicken-breast": "Foundation energy and frozen product additions/retained water require review; no package ingredient label.",
  "pork-loin": "Separable lean-only reference is not a verified whole loin with fat/trim; edible pack yield unknown.",
  "frozen-tilapia": "Plain raw species plausible; frozen glaze, retained water and package label unresolved.",
  "frozen-shrimp": "Peeled edible state plausible; drained/thawed glaze yield and treatment label unresolved.",
  "frozen-salmon": "Farmed Atlantic reference is not a verified species/production method or glaze yield for generic frozen salmon.",
  "canned-tuna": "Drained-solids nutrition versus net can weight; drained purchased yield missing.",
  "canned-chicken": "With-broth nutrition and recipe draining/edible yield need reconciliation and label.",
  "chickpeas": "Drained-solids nutrition versus net can weight; drained yield missing.",
  "kidney-beans": "Drained-solids nutrition versus net can weight; drained yield missing.",
  "black-beans": "Low-sodium reference and recipe draining versus whole can need label and edible yield.",
  tofu: "Firm calcium-sulfate reference does not verify extra-firm package concentration, coagulant or drained weight.",
  tempeh: "Fermented compound product can include grains; package ingredients not reviewed.",
  "ww-spaghetti": "Manual SR values lack original record/value derivation; current record must be compared before approval.",
  "gf-pasta": "Corn reference is not verified for authored corn/rice blend; package label required.",
  granola: "Homemade reference is not verified for packaged granola composition.",
  "pancake-mix": "Manual Kodiak label assertion lacks product URL, serving grams and dated original panel; do not accept typical values.",
  tzatziki: "Manual typical label values have no original manufacturer, serving or conversion evidence.",
  "russet-potatoes": "Confirmed wrong food basis: FDC 170032 is skin only, not whole russet flesh and skin. Replacement and yield not approved.",
  "sweet-potatoes": "Skinless reference versus purchased whole roots; peel/trim yield absent.",
  bananas: "Edible peeled reference versus purchased unpeeled pounds; peel yield absent.",
  apples: "Core/refuse yield for purchased pounds not documented.",
  "frozen-berries": "Blueberry-only reference does not match mixed berry composition.",
  avocados: "Assumed 136 g edible per piece; peel/pit and size distribution not verified.",
  onions: "Peel/trim yield versus purchased pounds not documented.",
  carrots: "Raw reference plausible; specify skin and trimming basis and purchased usable yield before approval.",
  "bell-peppers": "Red pepper reference versus generic multipack; assumed 150 g edible each and seeds/refuse unknown.",
  romaine: "Assumed 200 g edible per heart, trimming and pack size unverified.",
  tomatoes: "Stem/core usable yield versus purchased weight not reviewed.",
  cucumber: "Assumed 300 g per piece and edible peel basis not verified.",
  asparagus: "Woody stem trimming yield versus purchased weight missing.",
  "frozen-mixed-veg": "Blend proportions and ingredients unknown; generic mixed reference not a verified package.",
  "frozen-stirfry-veg": "Generic mixed vegetable record is not the verified stir-fry blend.",
  "frozen-peppers-onions": "Confirmed incomplete identity: pepper-only record does not cover onions or blend proportions.",
  "taco-seasoning": "Confirmed wrong composition: chili powder is not a verified taco seasoning blend.",
  "buffalo-sauce": "Generic pepper/hot sauce is not a verified buffalo sauce formulation; label and density unresolved.",
  honey: "Generic honey reference plausible; original source arithmetic/package identity not approved in this batch.",
};

export function sourceMacros(food: SourceFood) {
  const get = (id: number) => food.nutrients.find(n => n.id === id)?.amount;
  // Preserve the existing import's documented energy precedence. Both Foundation Atwater fields are source values.
  return { protein_g: get(1003), fat_g: get(1004), carbs_g: get(1005), kcal: get(1008) ?? get(2047) ?? get(2048) };
}

export function reviewNutrition(map: UsdaMap, foods: SourceFood[]): NutritionReview[] {
  return SKUS.map(sku => {
    const entry = map[sku.id];
    const food = foods.find(f => f.fdcId === entry?.fdc_id);
    const reasons: string[] = [];
    if (!GENERIC_BASES[sku.id]) reasons.push(NOTES[sku.id] ?? "Compound/processed package formulation not reviewed against an original label; generic reference is not branded verification.");
    if (!food) reasons.push("Original USDA record unavailable; manual entries require an original manufacturer panel.");
    if (food && GENERIC_BASES[sku.id]) {
      if (entry.fdc_id !== REVIEWED_SOURCES[sku.id]) reasons.push("Source identity changed since this review; raw/edible basis must be reviewed again.");
      if (JSON.stringify([sku.pack_qty, sku.pack_unit, sku.canonical_unit, sku.grams_per_unit]) !== JSON.stringify(REVIEWED_PACKS[sku.id])) reasons.push("Pack, density or piece weight changed; conversion review is stale.");
      if (sku.id === "eggs" && !food.portions.some(p => p.grams === 50 && /large/i.test(p.modifier))) reasons.push("Original large egg edible weight not confirmed.");
    }
    if (food) {
      if (!["Foundation", "SR Legacy"].includes(food.dataType)) reasons.push("Source nutrient serving basis has not been reviewed for this data type.");
      if (food.description !== entry.description) reasons.push("Cached description differs from original source.");
      const values = sourceMacros(food);
      for (const field of ["protein_g", "fat_g", "carbs_g", "kcal"] as const) {
        if (values[field] === undefined || !Number.isFinite(values[field]) || values[field]! < 0) reasons.push(`Original ${field} missing or invalid; no invented zero or derived energy.`);
        else if (Math.abs(values[field]! - entry[field]) > 0.01) reasons.push(`Cached ${field} differs from original source; reconcile explicitly.`);
      }
    }
    if (entry && [entry.protein_g, entry.kcal, entry.fat_g, entry.carbs_g].some(n => !Number.isFinite(n) || n < 0)) reasons.push("Cached macros invalid; do not clamp a negative or absent value.");
    return {
      sku_id: sku.id, status: reasons.length ? "blocked" : "generic-reviewed", reasons,
      fdc_id: entry?.fdc_id ?? 0, description: food?.description ?? entry?.description ?? "Missing",
      source: food?.url ?? null, accessed: food?.accessed ?? null, manual: !!entry?.manual,
      basis: GENERIC_BASES[sku.id] ?? NOTES[sku.id] ?? "Generic edible 100 g reference; package formulation unresolved.",
      conversion: `Purchased ${sku.pack_qty} ${sku.pack_unit} = ${packCanonical(sku)} ${sku.canonical_unit}; ${sku.grams_per_unit} g per canonical unit. No unverified edible yield is applied.`,
      fingerprint: nutritionFingerprint(sku, entry),
    };
  });
}
