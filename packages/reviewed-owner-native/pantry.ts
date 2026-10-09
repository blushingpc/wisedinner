import {evaluateWeek} from "./core/engine.ts";
import {packCanonical} from "./core/units.ts";
import type {SolveInput,Snapshot} from "./core/types.ts";
import {eligibleSnapshot} from "./ingredient-safety.ts";
import {projectPurchased,type ReviewBundle} from "./quantity.ts";
import {independentArithmetic} from "./arithmetic.ts";
import source from "./source.ts";
export type OwnedPack={skuId:string;fraction:number;purchaseBasis:string};
type Stage={edible:Snapshot;purchased:Snapshot;basket:ReviewBundle};
export function pantryBasis(sku:Snapshot["skus"][number]){const original=source.edible.skus.find(v=>v.id===sku.id),review=Object.entries(source.reviews.quantities).find(([id])=>id===sku.id)?.[1];if(!original||!review||JSON.stringify([sku.id,sku.pack_qty,sku.pack_unit,sku.pack_label,sku.canonical_unit,sku.grams_per_unit])!==JSON.stringify([original.id,original.pack_qty,original.pack_unit,original.pack_label,original.canonical_unit,original.grams_per_unit]))throw Error("reviewed_native_basis_held");return review.purchase_basis;}
export function purchaseBalance(required:number,owned:number){
 if(!Number.isFinite(required)||required<0||!Number.isFinite(owned)||owned<0||owned>100)throw Error("Invalid physical pantry amount");
 const ownedUsed=Math.min(required,owned),buyPacks=Math.max(0,Math.ceil(required-ownedUsed-1e-6));
 return {requiredPacks:required,ownedPacks:owned,ownedUsedPacks:ownedUsed,buyPacks,ownedCarryoverPacks:owned-ownedUsed,newCarryoverPacks:Math.max(0,buyPacks-(required-ownedUsed))};
}
export function evaluateReviewedPantry(ids:string[],input:SolveInput,stage:Stage,owned:OwnedPack[],allergies:string[]=[]){
if(input.pantry?.length||owned.length>79||new Set(owned.map(x=>x.skuId)).size!==owned.length)throw Error("reviewed_native_pantry_held");
const projection=projectPurchased(stage.edible,stage.basket.quantities);if(JSON.stringify(projection)!==JSON.stringify(stage.purchased))throw Error("Stale purchase projection");
 const amounts=new Map<string,number>();
 for(const item of owned){const sku=stage.edible.skus.find(s=>s.id===item.skuId);
  if(!sku||item.purchaseBasis!==pantryBasis(sku)||!Number.isFinite(item.fraction)||item.fraction<0||item.fraction>100)throw Error("Unknown or stale pantry pack basis");
  amounts.set(item.skuId,item.fraction);
 }
 const selected=eligibleSnapshot(projection,input.diet,allergies,stage.basket.safety),out=evaluateWeek(ids,{...input,pantry:[]},selected);
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

return {feasible:violations.length===0,totalCents,days:checked.days,rows};}
