import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { reviewedBasket, stageReviewed, projectPurchased, purchaseArithmetic, targetedCandidates, digest, labelNutrition, type WeekApproval } from "./reviewed-week.ts";
import { independentArithmetic } from "./reviewed-week-acceptance.ts";
import { compileCandidate, directions } from "./catalog-expansion.ts";
import { solveRestricted, restrictedCandidates } from "./catalog-selection.ts";
import { eligibleSnapshot } from "./ingredient-safety.ts";
import { evaluateWeek } from "../../packages/solver/src/engine.ts";
import { BASE } from "../../packages/solver/src/profiles.ts";
const approval: WeekApproval = JSON.parse(readFileSync("docs/ingredient-catalog/reviewed-week-approval.json", "utf8"));

test("quantity bridge prices purchased carrots but counts only edible raw portions", () => {
  const s = stageReviewed(approval);
  const row = s.edible.recipe_ingredients.find(i => i.sku_id === "carrots")!;
  const projected = s.purchased.recipe_ingredients.find(i => i.recipe_id === row.recipe_id && i.sku_id === row.sku_id)!;
  assert.equal(projected.qty, row.qty/.83);
  const n = s.purchased.nutrition.find(n => n.sku_id === "carrots")!;
  assert.ok(Math.abs(projected.qty*n.protein_g/100-row.qty*.93/100)<1e-12);
  assert.ok(Math.abs(projected.qty*n.kcal/100-row.qty*41/100)<1e-12);
  assert.deepEqual(s.edible.skus, s.purchased.skus);
  assert.deepEqual(s.edible.store_prices, s.purchased.store_prices);
  const carrot = s.edible.skus.find(k => k.id === "carrots")!;
  const a = purchaseArithmetic(carrot, 800, 1, s.basket.quantities.carrots);
  assert.equal(a.packs,2); // naive edible/purchased accounting incorrectly buys only one 2 lb bag
  assert.equal(purchaseArithmetic(carrot,400,2,s.basket.quantities.carrots).purchased,a.purchased);
  assert.ok(a.preparationRefuse>0 && a.unpreparedCarryover>0);
});
test("dry water gain, piece contents and households do not inflate nutrients", () => {
  const s = stageReviewed(approval);
  const eggs = s.edible.skus.find(k => k.id === "eggs")!;
  const a = purchaseArithmetic(eggs,3,2,s.basket.quantities.eggs);
  assert.equal(a.edible,6); assert.equal(a.packs,1); assert.equal(a.preparationRefuse,0);
  const oats = s.edible.skus.find(k => k.id === "oats")!;
  assert.equal(purchaseArithmetic(oats,400,2,s.basket.quantities.oats).edible,800);
  for(const id of ["oats","eggs","lentils","brown-rice"]) {
    assert.deepEqual(s.edible.nutrition.find(n=>n.sku_id===id),s.purchased.nutrition.find(n=>n.sku_id===id));
  }
  assert.equal(s.basket.quantities.oats.nutrition.protein_g,5*100/40);
});
test("manual label conversion requires source grams and every nutrient, without invented zero",()=>{
  const label={serving_g:40,protein_g:5,kcal:150,fat_g:2.5,carbs_g:27};
  assert.equal(labelNutrition("oats",label).protein_g,12.5);
  assert.throws(()=>labelNutrition("oats",{...label,carbs_g:undefined as unknown as number}));
  assert.throws(()=>labelNutrition("oats",{...label,serving_g:0}));
});
test("missing yield, source nutrients and changed packs fail closed", () => {
  const s=stageReviewed(approval);
  for(const mutate of [
    (s: ReturnType<typeof stageReviewed>) => { delete s.basket.quantities.carrots; },
    (s: ReturnType<typeof stageReviewed>) => { s.basket.quantities.carrots.edible_per_purchased=NaN; },
    (s: ReturnType<typeof stageReviewed>) => { s.edible.nutrition.find(n=>n.sku_id==="carrots")!.carbs_g=NaN; },
    (s: ReturnType<typeof stageReviewed>) => { s.edible.skus.find(k=>k.id==="carrots")!.pack_qty=5; },
    (s: ReturnType<typeof stageReviewed>) => { s.basket.quantities.eggs.edible_per_purchased=.8; },
  ]) { const copy=structuredClone(s); mutate(copy); assert.throws(()=>projectPurchased(copy.edible,copy.basket.quantities)); }
  assert.throws(()=>purchaseArithmetic(s.edible.skus[0],1,1,{...s.basket.quantities.lentils,edible_per_purchased:0}));
});
test("drafts cannot approve themselves; quantity, source, metadata and directions invalidate approval", () => {
  assert.deepEqual(stageReviewed().counts,{generated:81,unique:81,validated:81,reviewReady:63,eligible:0,quarantined:81});
  for(const mutate of [
    (b: ReturnType<typeof reviewedBasket>) => { b.quantities.carrots.edible_per_purchased=1; },
    (b: ReturnType<typeof reviewedBasket>) => { b.quantities.oats.nutrition.protein_g=99; },
    (b: ReturnType<typeof reviewedBasket>) => { b.safety.oats.status="unreviewed"; },
  ]) { const b=reviewedBasket(); mutate(b); assert.throws(()=>stageReviewed(approval,b),/stale/); }
  assert.throws(()=>stageReviewed({...approval,source_digest:"old"}),/stale/);
  const c=targetedCandidates(); c[0].recipe.ingredients[0][1]++; assert.throws(()=>stageReviewed(approval,reviewedBasket(),c),/stale/);
});
test("edible directions reject unlisted, missing and contradictory additions", () => {
  for(const mutate of [
    (c: ReturnType<typeof targetedCandidates>[number]) => { c.recipe.steps[3]="Add unlisted soy sauce."; },
    (c: ReturnType<typeof targetedCandidates>[number]) => { c.recipe.ingredients.push(["onions",1,"g"]); },
    (c: ReturnType<typeof targetedCandidates>[number]) => { c.recipe.steps=directions(c.parts,c.method); },
  ]) { const c=targetedCandidates()[0]; mutate(c); assert.throws(()=>compileCandidate(c)); }
});
test("oat directions cannot silently describe a different mass unit",()=>{
  const c=targetedCandidates()[0];
  c.parts.find(p=>p.role==="grain")!.row[2]="oz";
  // The shared row changes both parts and ingredients, but the authored steps still say 80 g.
  assert.throws(()=>compileCandidate(c),/directions/);
});
test("historical scaled/wrong-form price rows do not prove a purchasable pack", () => {
  const s=stageReviewed(approval);
  for(const id of ["lentils","carrots","eggs","frozen-edamame","white-rice","ground-beef"]) {
    assert.ok(!s.edible.store_prices.some(p=>p.sku_id===id)); assert.ok(s.priceReview.excluded.some(p=>p.sku_id===id));
  }
  assert.ok(!s.edible.skus.some(s=>s.id==="chicken-breast"));
  assert.equal(s.counts.eligible,63); assert.equal(s.counts.quarantined,18);
});
test("real restricted staging solves deterministic typical seeds, with independent re-evaluation", () => {
  const s=stageReviewed(approval);
  for(const seed of [0,7,19]) {
    const input={...BASE,seed}; const out=solveRestricted(input,s.purchased,[],s.basket.safety);
    assert.equal(out.feasible,true,out.why.join(", "));
    assert.equal(digest(out),digest(solveRestricted(input,s.purchased,[],s.basket.safety)));
    const re=evaluateWeek(out.days.flatMap(d=>d.items.map(i=>i.recipe_id)),input,s.purchased);
    assert.equal(re.feasible,true); assert.equal(re.est_total,out.est_total);
    assert.equal(independentArithmetic(out,s.edible,s.basket).feasible,true);
    const spoiled=structuredClone(out);spoiled.list[0].price_usd+=.01;
    assert.throws(()=>independentArithmetic(spoiled,s.edible,s.basket),/cost/);
    for(const slot of [0,7,14]) for(const swap of restrictedCandidates(out,slot,s.purchased,[],s.basket.safety)) {
      const ids=out.days.flatMap(d=>d.items.map(i=>i.recipe_id));ids[slot]=swap.recipe_id;
      assert.equal(evaluateWeek(ids,input,s.purchased).feasible,true);
    }
  }
});
test("unknown metadata and variant additions are filtered by the actual restricted path", () => {
  const s=stageReviewed(approval);
  assert.throws(()=>solveRestricted({...BASE,diet:"dairy-free"},s.purchased,[],{}),/Not enough reviewed/);
  const none=eligibleSnapshot(s.purchased,"dairy-free",[],{});assert.equal(none.recipes.length,0);
  const filtered=eligibleSnapshot(s.purchased,"none",["eggs"],s.basket.safety);
  assert.ok(!filtered.recipe_ingredients.some(i=>i.sku_id==="eggs"));
  const gluten=eligibleSnapshot(s.purchased,"gluten-free",[],s.basket.safety);
  assert.equal(gluten.recipes.filter(r=>r.meal_type==="breakfast").length,0);
  const variant=s.purchased.recipe_variants.find(v=>s.purchased.recipe_ingredients.some(i=>i.recipe_id===v.variant_recipe_id&&i.sku_id==="eggs"))!;
  assert.ok(variant); assert.ok(!filtered.recipes.some(r=>r.id===variant.variant_recipe_id));
  const unknown=structuredClone(s.basket.safety);unknown["frozen-edamame"].allergens=null;unknown["frozen-edamame"].status="unreviewed";
  assert.throws(()=>solveRestricted({...BASE,diet:"dairy-free"},s.purchased,[],unknown),/Not enough reviewed/);
  // Conservative family closure excludes orphan variants too; unknown cannot supply safe protein/variety.
});
