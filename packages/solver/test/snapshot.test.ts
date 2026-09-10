import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { DIETS } from "../src/types.ts";
import { baseRecipes, templatesOf, toPublicSnapshot, validateSnapshot } from "../src/snapshot.ts";
import { buildPool } from "../src/engine.ts";
import { priceMapFor } from "../src/pricing.ts";
import { loadSnapshot } from "./helpers.ts";

const snap = loadSnapshot();
const templates = templatesOf(snap);
const kroger = snap.stores.find((s) => s.id === "kroger")!;

test("validateSnapshot accepts data/snapshot.json and rejects garbage", () => {
  assert.ok(snap.version >= 1);
  assert.throws(() => validateSnapshot({ version: 1 }), /missing/);
  assert.throws(() => validateSnapshot({ ...snap, skus: [{ ...snap.skus[0], diet_flags: ["vegan"] }] }), /vegan implies/);
});

test("27 base recipes: 6 breakfast, 7 lunch, 14 dinner; ids are the photo slugs", () => {
  const bases = baseRecipes(snap);
  assert.equal(bases.length, 27);
  const count = (t: string) => bases.filter((r) => r.meal_type === t).length;
  assert.equal(count("breakfast"), 6);
  assert.equal(count("lunch"), 7);
  assert.equal(count("dinner"), 14);
  for (const r of bases) assert.ok(existsSync(`public/img/menu/${r.id}.jpg`), `no photo for ${r.id}`);
});

test("every base has at least two variants (one protein swap, one carb swap); pool is 60 to 90", () => {
  for (const b of baseRecipes(snap)) {
    const kinds = snap.recipe_variants.filter((v) => v.recipe_id === b.id).map((v) => v.kind);
    assert.ok(kinds.includes("protein_swap"), `${b.id}: no protein swap`);
    assert.ok(kinds.includes("carb_swap"), `${b.id}: no carb swap`);
  }
  assert.ok(snap.recipes.length >= 60 && snap.recipes.length <= 90, `${snap.recipes.length} recipes`);
});

test("every recipe is buildable: every ingredient has nutrition and a price at Kroger", () => {
  const pool = buildPool(snap, priceMapFor(snap, kroger, "43215"), "none", 10_000, templates);
  assert.equal(pool.templates.length, snap.recipes.length);
  for (const t of templates) assert.ok(t.parts.length >= 2, `${t.id} has ${t.parts.length} parts`);
});

test("every diet mode has at least 12 options, with at least 3 breakfasts and 5 dinners", () => {
  const map = priceMapFor(snap, kroger, "43215");
  for (const diet of DIETS) {
    const pool = buildPool(snap, map, diet, 10_000, templates);
    const n = (mt: string) => pool.templates.filter((t) => t.meal_type === mt).length;
    assert.ok(pool.templates.length >= 12, `${diet}: ${pool.templates.length} options`);
    assert.ok(n("breakfast") >= 3, `${diet}: ${n("breakfast")} breakfasts`);
    assert.ok(n("dinner") >= 5, `${diet}: ${n("dinner")} dinners`);
  }
});

test("vegan implies vegetarian and dairy-free on every sku", () => {
  for (const k of snap.skus) if (k.diet_flags.includes("vegan")) assert.ok(k.diet_flags.includes("vegetarian") && k.diet_flags.includes("dairy-free"), k.id);
});

test("recipe names are sentence case with no dashes, middots or ellipses", () => {
  for (const r of snap.recipes) {
    assert.match(r.name, /^[A-Z]/, r.name);
    assert.ok(!/[–—·…!]/.test(r.name), r.name);
    assert.ok(r.name.split(" ").slice(1).every((w) => w === w.toLowerCase() || /^(BBQ|H-E-B)$/.test(w)), r.name);
  }
});

test("the public snapshot carries no source or confidence fields", () => {
  const text = JSON.stringify(toPublicSnapshot(snap));
  assert.ok(!/"source"|"confidence"/.test(text));
});
