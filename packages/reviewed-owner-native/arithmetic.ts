import {canonicalRow,purchaseArithmetic,type ReviewBundle} from "./quantity.ts";
import {ingredientAllowed} from "./ingredient-safety.ts";
import {priceMapFor} from "./core/pricing.ts";
import {packCanonical,round2} from "./core/units.ts";
import type {Snapshot,SolveOutput} from "./core/types.ts";
export function independentArithmetic(out: SolveOutput, edible: Snapshot, basket: ReviewBundle, allergies: string[] = []) {
  const ids = out.days.flatMap(d => d.items.map(i => i.recipe_id));
  if (ids.length !== 15 || out.days.some(d=>d.items.length!==3)) throw new Error("Week must contain five complete days");
  const used = new Map<string, number>(), calories = new Map<string, number>();
  const families = new Map(edible.recipe_variants.map(v=>[v.variant_recipe_id,v.recipe_id]));
  const repeats = [new Map<string,number>(),new Map<string,number>(),new Map<string,number>()] as const;
  const violations: string[] = [];
  const days=out.days.map(d=>{
    let protein=0,kcal=0,fat=0,carbs=0;
    d.items.forEach((item,slot)=>{
      const recipe=edible.recipes.find(r=>r.id===item.recipe_id);
      if (!recipe || (slot===0 ? recipe.meal_type!=="breakfast" : recipe.meal_type==="breakfast")) throw new Error("Unknown or wrong meal-type selection");
      const family=families.get(recipe.id)??recipe.id;
      const slotRepeats = repeats[slot];
      if (!slotRepeats) throw new Error("Unknown meal slot");
      slotRepeats.set(family,(slotRepeats.get(family)??0)+1);
      let mealProtein=0,mealKcal=0;
      for(const row of edible.recipe_ingredients.filter(i=>i.recipe_id===recipe.id)) {
        const sku=edible.skus.find(k=>k.id===row.sku_id)!;
        const review=basket.quantities[sku.id];
        if(!review || basket.safety[sku.id]?.status!=="reviewed" || !ingredientAllowed(sku.id,out.input.diet,allergies,basket.safety)) throw new Error("Selected source or metadata unresolved/excluded");
        const q=canonicalRow(row,edible)/recipe.servings;
        const grams=q*sku.grams_per_unit;
        const n=review.nutrition;
        mealProtein+=grams*n.protein_g/100; mealKcal+=grams*n.kcal/100;
        fat+=grams*n.fat_g/100;carbs+=grams*n.carbs_g/100;
        used.set(sku.id,(used.get(sku.id)??0)+q);
        calories.set(sku.id,(calories.get(sku.id)??0)+grams*n.kcal/100);
      }
      // Equivalent summation orders can straddle an exact .5 tie by machine epsilon.
      if(Math.abs(mealProtein-item.protein_g)>.5+1e-9 || Math.abs(mealKcal-item.kcal)>.5+1e-9) throw new Error("Displayed meal nutrients differ from independent source arithmetic");
      protein+=mealProtein;kcal+=mealKcal;
    });
    if(Math.abs(protein-d.protein_g)>.5+1e-9 || Math.abs(kcal-d.kcal)>.5+1e-9) throw new Error("Day nutrients differ from source arithmetic");
    if(protein<out.input.protein_per_day) violations.push("protein target");
    if(kcal<out.input.kcal_min) violations.push("calories under the band");
    if(kcal>out.input.kcal_max) violations.push("calories over the band");
    return {day:d.day,protein_g:protein,kcal,fat_g:fat,carbs_g:carbs};
  });
  if(used.size!==out.list.length || out.list.some(i=>!used.has(i.sku_id))) throw new Error("Shopping list differs from selected ingredients");
  const rows=out.list.map(item=>{
    const sku=edible.skus.find(k=>k.id===item.sku_id);
    if (!sku) throw new Error("Shopping source unavailable");
    const review=basket.quantities[sku.id], consumed=used.get(sku.id), store=edible.stores.find(s=>s.id===item.store);
    if (!review || consumed === undefined || !store) throw new Error("Shopping quantity or store unavailable");
    const a=purchaseArithmetic(sku,consumed,out.input.household,review);
    const price=priceMapFor(edible,store,out.input.zip).get(sku.id);
    if (!price) throw new Error("Shopping price unavailable");
    const expected=item.pantry?0:round2(a.packs*price.price_usd);
    if(a.packs!==item.qty || Math.abs(item.eaten-a.usedPurchased/packCanonical(sku))>1e-9 || Math.abs(expected-item.price_usd)>1e-9) throw new Error("Pack arithmetic/cost differs from output");
    if(sku.perishable && a.purchased/a.usedPurchased>1.5+1e-9) violations.push(`${sku.id}: perishable carryover`);
    return {sku_id:sku.id,pack_label:sku.pack_label,source:review.source,source_basis:review.source_basis,yield:review.edible_per_purchased,...a,
      edible_grams:a.edible*sku.grams_per_unit, nutrient_protein_household:a.edible*sku.grams_per_unit*review.nutrition.protein_g/100,
      nutrient_kcal_household:a.edible*sku.grams_per_unit*review.nutrition.kcal/100,
      price_per_pack_cents:Math.round(price.price_usd*100),cost_cents:Math.round(expected*100),price_basis:price.observed?"Retained dated identity/size-matched observation":"Unchanged authored baseline × store index reference estimate",
      as_of:price.as_of,limits:review.limits};
  });
  const totalCents=rows.reduce((n,r)=>n+r.cost_cents,0);
  if(totalCents!==Math.round(out.est_total*100)) throw new Error("List cents differ from week total");
  if(totalCents>Math.round(out.input.budget*100)) violations.push("budget");
  const floorItems=Math.round(8+4*Math.min(1,Math.max(0,(out.input.budget-30)/25)));
  const floorProtein=out.input.budget<55?2:3;
  const proteinSources=rows.filter(r=>{
    const sku=edible.skus.find(k=>k.id===r.sku_id), review=basket.quantities[r.sku_id];
    if (!sku || !review) throw new Error("Protein source unavailable");
    const n=review.nutrition;
    return n.protein_g/n.kcal>=.06 && packCanonical(sku)*sku.grams_per_unit*r.yield*n.protein_g/100>=20;
  }).length;
  if(used.size<floorItems) violations.push(`fewer than ${floorItems} different items`);
  if(proteinSources<floorProtein) violations.push(`fewer than ${floorProtein} protein sources`);
  const totalCalories=[...calories.values()].reduce((a,b)=>a+b,0);
  const shares=[...calories].map(([sku_id,kcal])=>({sku_id,kcal,fraction:kcal/totalCalories}));
  if(shares.some(s=>s.fraction>.35)) violations.push("ingredient calorie share over .35");
  for(const [slot,cap] of [[0,3],[1,99],[2,2]] as const) if([...repeats[slot].values()].some(n=>n>cap)) violations.push(`repeat cap slot ${slot}`);
  const feasible=violations.length===0;
  if(feasible!==out.feasible) throw new Error("Independent hard constraints disagree with solver");
  return {feasible,violations:[...new Set(violations)],days,rows,total_cents:totalCents,distinct_skus:used.size,protein_sources:proteinSources,calorie_shares:shares,repeats:repeats.map(m=>Object.fromEntries(m)),
    leftovers_note:"Preparation refuse is removed only from portions being prepared. Unprepared carryover stays physical food; edible carryover is an estimated usable amount, not an extra consumed portion. Egg quantities are counts of edible contents, not shell grams."};
}
