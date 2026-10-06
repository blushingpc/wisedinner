// Private accounting seam only. No public SolveInput, Snapshot or app solver change.
import {evaluateWeek} from "../../packages/solver/src/engine.ts";
import {packCanonical} from "../../packages/solver/src/units.ts";
import type {SolveInput} from "../../packages/solver/src/types.ts";
import {eligibleSnapshot} from "./ingredient-safety.ts";
import {digest,projectPurchased,type stageReviewed} from "./reviewed-week.ts";
import {independentArithmetic} from "./reviewed-week-acceptance.ts";
import {prepareReviewedSelection} from "./reviewed-selection.ts";
export const REVIEWED_FAMILY_STRATEGY="reviewed-family-v1" as const;
export type PrivateSelectionStrategy=typeof REVIEWED_FAMILY_STRATEGY;
export type OwnedPack={skuId:string;fraction:number;purchaseBasis:string};
type Stage=ReturnType<typeof stageReviewed>;
export function pantryBasis(sku:Stage["edible"]["skus"][number]){return digest([sku.id,sku.pack_qty,sku.pack_unit,sku.pack_label,sku.canonical_unit,sku.grams_per_unit]);}
export function purchaseBalance(required:number,owned:number){
 if(!Number.isFinite(required)||required<0||!Number.isFinite(owned)||owned<0||owned>100)throw Error("Invalid physical pantry amount");
 const ownedUsed=Math.min(required,owned),buyPacks=Math.max(0,Math.ceil(required-ownedUsed-1e-6));
 return {requiredPacks:required,ownedPacks:owned,ownedUsedPacks:ownedUsed,buyPacks,ownedCarryoverPacks:owned-ownedUsed,newCarryoverPacks:Math.max(0,buyPacks-(required-ownedUsed))};
}
// Re-evaluate the actual selected IDs under every existing hard constraint, then replace only purchase accounting.
// This does not search for a better pantry-assisted week or decide the individual-reroll grocery policy.
export function evaluateReviewedPantry(ids:string[],input:SolveInput,stage:Stage,owned:OwnedPack[],allergies:string[]=[],strategy?:PrivateSelectionStrategy){
 if(strategy!==undefined&&strategy!==REVIEWED_FAMILY_STRATEGY)throw Error("Unknown private selection strategy");
 if(input.pantry?.length)throw Error("Legacy infinite-pantry flags cannot enter physical accounting");
 if(owned.length>79||new Set(owned.map(x=>x.skuId)).size!==owned.length)throw Error("Duplicate or excessive pantry entries");
 if(stage.basket.source_digest!==digest({quantities:stage.basket.quantities,safety:stage.basket.safety,input_digest:stage.basket.input_digest}))throw Error("Stale source/quantity review");
 const projection=projectPurchased(stage.edible,stage.basket.quantities);
 if(digest(projection)!==digest(stage.purchased))throw Error("Stale purchase projection");
 const amounts=new Map<string,number>();
 for(const item of owned){const sku=stage.edible.skus.find(s=>s.id===item.skuId);
  if(!sku||item.purchaseBasis!==pantryBasis(sku)||!Number.isFinite(item.fraction)||item.fraction<0||item.fraction>100)throw Error("Unknown or stale pantry pack basis");
  amounts.set(item.skuId,item.fraction);
 }
 const family=strategy?prepareReviewedSelection(stage,input.diet,allergies):undefined;
 const selected=family?.snapshot??eligibleSnapshot(projection,input.diet,allergies,stage.basket.safety),out=evaluateWeek(ids,{...input,pantry:[]},selected);
 if(family&&digest(evaluateWeek(ids,{...input,pantry:[]},projection))!==digest(out))throw Error("Original family evaluation differs from private projection");
 const checked=independentArithmetic(out,stage.edible,stage.basket,allergies);
 const violations=checked.violations.filter(v=>v!=="budget"&&!v.endsWith(": perishable carryover"));
 const rows=checked.rows.map(row=>{
  const sku=stage.edible.skus.find(s=>s.id===row.sku_id)!,pack=packCanonical(sku),balance=purchaseBalance(row.usedPurchased/pack,amounts.get(sku.id)??0);
  const committedAvailable=balance.buyPacks+balance.ownedUsedPacks;
  if(sku.perishable&&committedAvailable/balance.requiredPacks>1.5+1e-9)violations.push(`${sku.id}: perishable carryover`);
  return {skuId:sku.id,canonicalUnit:sku.canonical_unit,packLabel:sku.pack_label,purchaseBasis:pantryBasis(sku),...balance,
   edibleConsumed:row.edible,physicalPrepared:row.usedPurchased,trim:row.preparationRefuse,
   newPhysicalCarryover:balance.newCarryoverPacks*pack,ownedPhysicalCarryover:balance.ownedCarryoverPacks*pack,
   costCents:balance.buyPacks*row.price_per_pack_cents,pricePerPackCents:row.price_per_pack_cents,asOf:row.as_of,priceBasis:row.price_basis};
 });
 const totalCents=rows.reduce((n,r)=>n+r.costCents,0);if(totalCents>Math.round(input.budget*100))violations.push("budget");
 const unusedOwned=owned.filter(x=>!rows.some(r=>r.skuId===x.skuId));
 return {schemaVersion:2,private:true,sourceDigest:stage.basket.source_digest,catalogDigest:digest(stage.edible),recipeIds:ids,input:{...input,pantry:[]},allergies,
  ...(family?{selection:{strategy:REVIEWED_FAMILY_STRATEGY,projectionDigest:family.projectionDigest,provenance:family.provenance}}:{}),
  feasible:violations.length===0,violations:[...new Set(violations)],totalCents,days:checked.days,rows,unusedOwned,
  note:"Pantry amounts are physical fractions of the pinned pack, assumed unprepared in the reviewed purchase basis. Cooked leftovers need a separate basis; no automatic raw/cooked mapping. Original nutrients and authored consumption are unchanged. Owned unused stock is reported separately, never made into extra consumption. Conservative baseline solve is not a pantry-optimized search or reroll policy."};
}
