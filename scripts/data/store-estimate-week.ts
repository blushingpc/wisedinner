// Reviewed food validation and new private pack pricing are separate decisions.
import type {SolveInput} from "../../packages/solver/src/types.ts";
import {toCanonical} from "../../packages/solver/src/units.ts";
import {evaluateReviewedPantry,pantryBasis,REVIEWED_FAMILY_STRATEGY,type PrivateSelectionStrategy,type OwnedPack} from "./reviewed-pantry.ts";
import {prepareReviewedSelection} from "./reviewed-selection.ts";
import {stageReviewed,digest} from "./reviewed-week.ts";
import {overnightBasket} from "./overnight-food.ts";
import {plantApproval,plantCandidates} from "./overnight-plant.ts";
import {decimalQuantity,divide,multiply,sum,ratio,formKey,type Requirement,type PantryAmount,quoteBaskets} from "./store-estimates.ts";

export function pricingStage(){return stageReviewed(plantApproval(),overnightBasket(),plantCandidates());}
type Stage=ReturnType<typeof pricingStage>;
export function weekSelectionRevision(input:SolveInput,stage:Stage,allergies:string[]=[],strategy?:PrivateSelectionStrategy){
  const profile={...input};delete profile.seed;
  if(strategy!==undefined){
    if(strategy!==REVIEWED_FAMILY_STRATEGY)throw Error("Unknown private selection strategy");
    const selection=prepareReviewedSelection(stage,input.diet,allergies);
    // Policy freeze spans ordinary seeds; actual selected IDs/quantities are bound separately below.
    return digest({strategy,profile,allergies:[...allergies].sort(),projectionDigest:selection.projectionDigest,provenance:selection.provenance,
      implementation:{family:"trusted original-star partition with eligible representatives and identical caps",search:"existing deterministic bounded 96",
        food:"full projected and original graph evaluation plus independent original source/yield arithmetic",pantry:"known unprepared physical pack fractions, subtract once before rounding",
        price:"raw offered packs; one calibrated full-basket allowance; legacy reference total is comparison only",reroll:"candidate full-week validation, shopping policy unset"}});
  }
  return digest({profile,allergies:[...allergies].sort(),sourceDigest:stage.basket.source_digest,catalogDigest:digest(stage.edible),candidateDigest:stage.candidate_digest,approvalDigest:digest(plantApproval()),cap:96,
    pantry:"physical fractions, not optimized",restrictions:"all recipe ingredients",regeneration:"existing deterministic solver",reroll:"candidate-only full revalidation; shopping policy unset"});
}
export function reviewedRequirements(ids:string[],input:SolveInput,stage:Stage,owned:OwnedPack[]=[],allergies:string[]=[],strategy?:PrivateSelectionStrategy){
  const current=pricingStage();
  if(digest(stage.edible)!==digest(current.edible)||digest(stage.purchased)!==digest(current.purchased)||stage.basket.source_digest!==current.basket.source_digest||stage.candidate_digest!==current.candidate_digest)throw Error("Stale or edited reviewed catalog/approval");
  // Validates ownership/basis/source pins, recipe IDs, metadata and all existing food constraints.
  const checked=evaluateReviewedPantry(ids,input,stage,owned,allergies,strategy);
  const quantities=new Map<string,ReturnType<typeof ratio>>();
  for(const id of ids){
    const recipe=stage.edible.recipes.find(r=>r.id===id)!;
    for(const row of stage.edible.recipe_ingredients.filter(r=>r.recipe_id===id)){
      const sku=stage.edible.skus.find(s=>s.id===row.sku_id)!;
      // Convert the table's exact decimal constants, not a floating-point accumulated quantity.
      const q=multiply(decimalQuantity(row.qty),decimalQuantity(toCanonical(1,row.unit,sku)));
      const perHousehold=multiply(divide(q,decimalQuantity(recipe.servings)),decimalQuantity(input.household));
      quantities.set(sku.id,sum(quantities.get(sku.id)??ratio(0),perHousehold));
    }
  }
  const requirements:Requirement[]=[],pantry:PantryAmount[]=[];
  for(const [id,edible] of quantities){
    const sku=stage.edible.skus.find(s=>s.id===id)!,review=stage.basket.quantities[id];
    const formDigest=formKey({skuId:id,unit:sku.canonical_unit,identity:review.identity,sourceBasis:review.source_basis,source:review.source,yield:review.edible_per_purchased,sourceDigest:stage.basket.source_digest});
    requirements.push({skuId:id,category:sku.aisle,unit:sku.canonical_unit,formDigest,purchasedNeed:divide(edible,decimalQuantity(review.edible_per_purchased)),perishable:sku.perishable});
    const item=owned.find(o=>o.skuId===id);
    if(item){
      if(item.purchaseBasis!==pantryBasis(sku))throw Error("Stale pantry physical pack");
      const pack=multiply(decimalQuantity(sku.pack_qty),decimalQuantity(toCanonical(1,sku.pack_unit,sku)));
      pantry.push({skuId:id,unit:sku.canonical_unit,formDigest,quantity:multiply(pack,decimalQuantity(item.fraction))});
    }
  }
  const selection=checked.selection?{...checked.selection,policyRevision:weekSelectionRevision(input,stage,allergies,strategy)}:undefined;
  return {requirements,pantry,...(selection?{selection,weekEvidenceDigest:digest({recipeIds:ids,input,allergies,owned,requirements,pantry,selection})}:{}),food:{...checked,violations:checked.violations.filter(v=>v!=="budget"&&!v.endsWith(": perishable carryover")),
    legacyReferenceTotalCents:checked.totalCents},sourceDigest:stage.basket.source_digest,catalogDigest:digest(stage.edible)};
}
export function evaluatePricedWeek(ids:string[],input:SolveInput,stage:Stage,owned:OwnedPack[],allergies:string[],quoteArgs:Parameters<typeof quoteBaskets>,strategy?:PrivateSelectionStrategy){
  const centsBudget=multiply(decimalQuantity(input.budget),ratio(100));
  if(centsBudget.denominator!==1||quoteArgs[0].budgetCents!==centsBudget.numerator)throw Error("Food profile and household quote budget differ");
  if(quoteArgs[0].selectionRevision!==weekSelectionRevision(input,stage,allergies,strategy))throw Error("Frozen selection does not match profile/restrictions/catalog");
  if(strategy&&(!quoteArgs[6].fixture||quoteArgs[6].samples.some(r=>r.evidence.kind!=="fixture")||quoteArgs[4].some(r=>r.evidence.kind!=="fixture")||quoteArgs[7].some(c=>c.rows.some(r=>r.evidence.kind!=="fixture"))))throw Error("Family quote binding is fixture-only");
  const reviewed=reviewedRequirements(ids,input,stage,owned,allergies,strategy);
  if(digest(reviewed.requirements)!==digest(quoteArgs[1])||digest(reviewed.pantry)!==digest(quoteArgs[2]))throw Error("Quote requirements/pantry differ from selected reviewed week");
  const quotes=quoteBaskets(...quoteArgs);
  const foodViolations=reviewed.food.violations;
  const assess=(q:typeof quotes.alternatives[number])=>({...q,foodViolations,
    feasible:foodViolations.length===0&&q.totalCents!==null&&q.withinBudget===true,
    failureKinds:[...(foodViolations.length?["food"]:[]),...(q.totalCents===null?["coverage"]:[]),...(q.withinBudget===false?["budget"]:[])]});
  return {private:true,fixtureOnly:true,recipeIds:ids,input,allergies,sourceDigest:reviewed.sourceDigest,catalogDigest:reviewed.catalogDigest,
    ...(reviewed.selection?{selection:reviewed.selection,weekEvidenceDigest:reviewed.weekEvidenceDigest}:{}),
    days:reviewed.food.days,consumption:reviewed.food.rows,unusedOwned:reviewed.food.unusedOwned,
    quotes:{...quotes,alternatives:quotes.alternatives.map(assess),split:quotes.split?assess(quotes.split):null},
    note:"New physical carryover is in quote lines; consumption/trim/nutrients are unchanged. Legacy reference costs are not the new quote. Candidate substitution is full-week validation, not approval of a reroll shopping policy or a global minimum."};
}
