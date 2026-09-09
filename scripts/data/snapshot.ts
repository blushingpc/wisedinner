// the snapshot: one JSON bundle (stores, skus, store_prices, nutrition, recipes, ingredients, variants) built from
// the database (or, with --local, from the authored data and the fetch caches), guarded, then published to the
// Supabase Storage bucket "data" as snapshots/v<N>.json with its sha256 recorded in data_snapshots. the public
// shape is also written to data/snapshot.json (committed: the site builds from it, the app bundles it).
// guards (BACKEND-V1 §2h): every solver profile feasible, no sku's best price moved more than 30% vs the previous
// snapshot. on a guard failure nothing is written and the process exits 1 so the workflow goes red.
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { log, today } from "./env.ts";
import { ensureBucket, insert, select, storagePut } from "../../app/api/db.ts";
import { STORES } from "./authored/stores.ts";
import { SKUS } from "./authored/skus.ts";
import { RECIPES } from "./authored/recipes.ts";
import { expandRecipes, toSku } from "./expand.ts";
import { loadUsdaMap, nutritionRows } from "./usda.ts";
import { validateSnapshot } from "../../packages/solver/src/snapshot.ts";
import { solve } from "../../packages/solver/src/engine.ts";
import { PROFILES } from "../../packages/solver/src/profiles.ts";
import type { Snapshot, StorePrice } from "../../packages/solver/src/types.ts";

export const SNAPSHOT_FILE = "data/snapshot.json";
export const MAX_SWING = 0.3;

export type ObservedRow = { sku_id: string; store_id: string; region: string; shelf_price: number; unit_price: number; as_of: string; source: string };

// assemble from rows (the database view or the local caches)
export function assemble(observed: ObservedRow[], version: number): Snapshot {
  const live = new Set(observed.filter((r) => r.source !== "index-estimate").map((r) => r.store_id));
  const store_prices: StorePrice[] = observed
    .filter((r) => r.source !== "index-estimate")
    .map((r) => ({ sku_id: r.sku_id, store_id: r.store_id, region: r.region, shelf_price: Number(r.shelf_price), unit_price: Number(r.unit_price), as_of: String(r.as_of).slice(0, 10) }));
  const { recipes, ingredients, variants } = expandRecipes(RECIPES);
  const snap: Snapshot = {
    version,
    generated_at: today(),
    stores: STORES.map((s) => ({ id: s.id, chain: s.chain, banner: s.banner, region_scope: s.region_scope, price_index: s.price_index, live: live.has(s.id) })),
    skus: SKUS.map(toSku),
    store_prices,
    nutrition: nutritionRows(loadUsdaMap()),
    recipes,
    recipe_ingredients: ingredients,
    recipe_variants: variants,
  };
  return validateSnapshot(snap);
}

export function previousSnapshot(): Snapshot | null {
  return existsSync(SNAPSHOT_FILE) ? (JSON.parse(readFileSync(SNAPSHOT_FILE, "utf8")) as Snapshot) : null;
}

// best observed price per sku (min across stores); index estimates are not compared
const bestPrices = (s: Snapshot) => {
  const m = new Map<string, number>();
  for (const p of s.store_prices) m.set(p.sku_id, Math.min(m.get(p.sku_id) ?? Infinity, p.shelf_price));
  return m;
};

export function guard(next: Snapshot, prev: Snapshot | null): string[] {
  const problems: string[] = [];
  for (const [name, input] of PROFILES) {
    const out = solve(input, next);
    if (!out.feasible) problems.push(`profile "${name}" infeasible: ${out.why.join("; ")}`);
  }
  if (prev) {
    const a = bestPrices(prev);
    const b = bestPrices(next);
    for (const [sku, price] of b) {
      const old = a.get(sku);
      if (old === undefined) continue;
      const swing = Math.abs(price - old) / old;
      if (swing > MAX_SWING) problems.push(`${sku}: best price moved ${Math.round(swing * 100)}% ($${old} → $${price})`);
    }
  }
  return problems;
}

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function publish(snap: Snapshot, local: boolean): Promise<{ version: number; url: string; sha256: string }> {
  const body = JSON.stringify(snap);
  const hash = sha256(body);
  let url = `local://${SNAPSHOT_FILE}`;
  if (!local) {
    await ensureBucket("data", true);
    url = await storagePut("data", `snapshots/v${snap.version}.json`, body);
    const res = await insert("data_snapshots", { version: snap.version, url, sha256: hash });
    if (!res.ok) throw new Error(`data_snapshots insert: ${res.status} ${res.body}`);
  }
  writeFileSync(SNAPSHOT_FILE, JSON.stringify(snap, null, 1) + "\n");
  log("snapshot", `v${snap.version} ${local ? "written locally" : "published"} → ${url} (${(body.length / 1024).toFixed(0)} KB, sha256 ${hash.slice(0, 12)}…)`);
  return { version: snap.version, url, sha256: hash };
}

export async function nextVersion(local: boolean): Promise<number> {
  if (local) return (previousSnapshot()?.version ?? 0) + 1;
  const rows = await select<{ version: number }>("data_snapshots", "select=version&order=version.desc&limit=1");
  return (rows[0]?.version ?? 0) + 1;
}
