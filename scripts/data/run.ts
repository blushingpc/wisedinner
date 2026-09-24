// the pipeline, end to end (BACKEND-V1 §2). run: node scripts/data/run.ts [--local] [--cached]
//   seed → usda → kroger → walmart → instacart → index → snapshot (guard, publish)
// --local  : no database; snapshot from the authored data + the fetch caches, written to data/snapshot.json only
// --cached : reuse data/pipeline/kroger-prices.json instead of calling Kroger again
import { existsSync, readFileSync } from "node:fs";
import { LOCAL, dbConfigured, log, today } from "./env.ts";
import { upsert, select, del } from "../../app/api/db.ts";
import { STORES } from "./authored/stores.ts";
import { SKUS } from "./authored/skus.ts";
import { RECIPES } from "./authored/recipes.ts";
import { expandRecipes } from "./expand.ts";
import { fetchUsda, nutritionRows } from "./usda.ts";
import { fetchKroger, loadKrogerMap, type PriceRow } from "./kroger.ts";
import { fetchWalmart } from "./walmart.ts";
import { fetchInstacart } from "./instacart.ts";
import { indexRows, type LiveRow } from "./index.ts";
import { assemble, guard, nextVersion, previousSnapshot, publish, type ObservedRow } from "./snapshot.ts";

const CACHED = process.argv.includes("--cached");

// a full skus row. Postgres checks NOT NULL on the proposed row before ON CONFLICT resolves, so every upsert of
// skus (seed, usda id, kroger id) must send the whole row, never just the id and one column.
const skuRow = (s: (typeof SKUS)[number]) => ({ id: s.id, name: s.name, aisle: s.aisle, perishable: s.perishable, pack_qty: s.pack_qty, pack_unit: s.pack_unit, canonical_unit: s.canonical_unit, grams_per_unit: s.grams_per_unit, diet_flags: s.diet_flags, baseline_price: s.baseline_usd });

async function seed() {
  const { recipes, ingredients, variants } = expandRecipes(RECIPES);
  await upsert("stores", STORES, "id");
  await upsert("skus", SKUS.map(skuRow), "id");
  await upsert("recipes", recipes, "id");
  // ingredients are replaced per recipe so removed rows do not linger
  await del("recipe_ingredients", `recipe_id=in.(${recipes.map((r) => `"${r.id}"`).join(",")})`);
  await upsert("recipe_ingredients", ingredients, "recipe_id,sku_id");
  await upsert("recipe_variants", variants, "recipe_id,variant_recipe_id");
  log("seed", `${STORES.length} stores, ${SKUS.length} skus, ${recipes.length} recipes, ${ingredients.length} ingredient rows, ${variants.length} variants`);
}

async function main() {
  const local = LOCAL || !dbConfigured();
  if (local && !LOCAL) log("run", "database not configured: running --local");
  if (!local) await seed();

  // e. usda
  const usda = await fetchUsda();
  if (!local) {
    await upsert("nutrition", nutritionRows(usda), "sku_id");
    await upsert("skus", SKUS.filter((s) => s.id in usda).map((s) => ({ ...skuRow(s), usda_fdc_id: usda[s.id].fdc_id ? String(usda[s.id].fdc_id) : null })), "id");
  }

  // a. kroger
  let kroger: { rows: PriceRow[]; unmapped: string[]; zips: Record<string, string> };
  if (CACHED && existsSync("data/pipeline/kroger-prices.json")) {
    kroger = JSON.parse(readFileSync("data/pipeline/kroger-prices.json", "utf8"));
    log("kroger", `cached: ${kroger.rows.length} rows`);
  } else kroger = await fetchKroger();
  if (!local) {
    await upsert("prices", kroger.rows, "sku_id,store_id,region,source");
    const map = loadKrogerMap();
    await upsert("skus", SKUS.filter((s) => s.id in map).map((s) => ({ ...skuRow(s), kroger_product_id: map[s.id].productId })), "id");
  }

  // b. walmart, c. instacart (both skip cleanly without keys)
  const walmart = await fetchWalmart();
  if (!local && walmart.rows.length) await upsert("prices", walmart.rows, "sku_id,store_id,region,source");
  const instacart = await fetchInstacart();
  if (!local && instacart.quotes.length) await upsert("delivery_quotes", instacart.quotes.map((q) => ({ list_hash: q.list_hash, store_id: q.store_id, zip: q.zip, subtotal: q.subtotal, fees: q.fees, source: q.source, quoted_at: q.quoted_at })), "id");

  // d. index estimates for every (sku, store) without a live row
  const live: LiveRow[] = [...kroger.rows, ...walmart.rows];
  const stores = STORES.map((s) => ({ ...s, live: false }));
  const index = indexRows(live, stores, today());
  if (!local) await upsert("prices", index, "sku_id,store_id,region,source");
  log("index", `${index.length} index-estimate rows`);

  // h. snapshot
  const observed: ObservedRow[] = local
    ? live.map((r) => ({ ...r }))
    : await select<ObservedRow>("store_prices", "select=sku_id,store_id,region,shelf_price,unit_price,as_of,source");
  const version = await nextVersion(local);
  const snap = assemble(observed, version);
  const problems = guard(snap, previousSnapshot());
  if (problems.length) {
    console.error(`snapshot v${version} NOT published:\n  ${problems.join("\n  ")}`);
    process.exit(1);
  }
  const pub = await publish(snap, local);
  console.log(
    JSON.stringify(
      {
        version: pub.version,
        url: pub.url,
        sha256: pub.sha256,
        kroger: { mapped: SKUS.length - kroger.unmapped.length, unmapped: kroger.unmapped, zips: kroger.zips, rows: kroger.rows.length },
        walmart: walmart.skipped ? "waiting on WALMART_API_KEY" : `${walmart.rows.length} rows`,
        instacart: instacart.skipped ? "waiting on INSTACART_API_KEY" : `${instacart.quotes.length} quotes`,
        index_rows: index.length,
        recipes: snap.recipes.length,
      },
      null,
      2,
    ),
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
