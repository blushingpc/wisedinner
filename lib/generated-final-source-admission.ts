import {reviewedMethodNutritionParent} from "./generated-reviewed-method-lineage.ts";
import manifest from "./fixtures/current-final-source-v1.json" with { type: "json" };
import { canonicalReferenceData, copyReferenceData } from "./generated-plan-data.ts";
import { sha256Hex } from "./generated-runtime-bytes.ts";
export const FINAL_DERIVED_NUTRITION_STATUS = "complete-conditional-derived-USDA-and-manufacturer-input-estimate";
export const FINAL_DERIVED_PIN = Object.freeze({sha256:manifest.practical.sha256,recordCount:1300});
export const FINAL_FULL_PIN = Object.freeze({sha256:manifest.full.sha256,recordCount:1300});
const seals=new Map(manifest.rowSeals.map(r=>[r.id,Object.freeze({...r})]));
export const FINAL_UTILITY_DERIVATION=Object.freeze({version:manifest.version,parentSlimSha256:manifest.parents[0]!.sha256,parentFullSha256:manifest.parents[1]!.sha256,authoritySha256:manifest.authoritySha256,producerPatchSha256:manifest.producerPatches.map(p=>p.sha256),fullSourceSha256:manifest.full.sha256,practicalSourceSha256:manifest.practical.sha256});
export function isFinalDerivedRow(value:unknown):boolean {
 try {return sealedCopiedRow(copyReferenceData(value) as Record<string,unknown>);}catch{return false;}
}
// Only private snapshots returned by the unchanged own-data validator enter
// these helpers. Ordering is exactly canonicalReferenceData's second pass;
// it need not validate/copy the same detached row two more times.
function orderedCopied(value:unknown):unknown {
 if(Array.isArray(value))return value.map(orderedCopied);
 if(value&&typeof value==="object")return Object.fromEntries(Object.keys(value).sort().map(k=>[k,orderedCopied((value as Record<string,unknown>)[k])]));
 return value;
}
function sealedCopiedRow(r:Record<string,unknown>):boolean {
 if(typeof r.id!=="string"||!countedBreadCopied(r))return false;
 const expected=seals.get(r.id);if(!expected)return false;
 const h=sha256Hex(JSON.stringify(orderedCopied(r)));return h===expected.fullRowSha256||h===expected.practicalRowSha256;
}
export function isFinalUtilityDerivation(value:unknown):boolean {try{return JSON.stringify(canonicalReferenceData(copyReferenceData(value)))===JSON.stringify(canonicalReferenceData(FINAL_UTILITY_DERIVATION));}catch{return false;}}

// Full proof blocks are retained. Only the verification projection removes the
// already archived verbose detail to compare the exact old three practical seals.
export function finalReviewedMethodNutritionParent(value:unknown):string|null {
 let row:Record<string,unknown>;
 try {row=copyReferenceData(value) as Record<string,unknown>;if(!sealedCopiedRow(row))return null;}catch{return null;}
 const nutrition=row.nutrition as Record<string,unknown>;
 if(!Object.hasOwn(nutrition,"ingredient_details"))return null;
 const projected={...row,nutrition:{...nutrition}};delete projected.nutrition.ingredient_details;
 return reviewedMethodNutritionParent(projected);
}

export const FINAL_FULL_BYTES=manifest.fullBytes;
export const FINAL_PRACTICAL_BYTES=manifest.practicalBytes;

// Count and gram semantics are independently checked before the closed row seal.
// These32 reviewed corrections bind the selected nominal label, never arbitrary brand size.
export function isFinalCountedBreadConsistent(value:unknown):boolean {
 try {
  return countedBreadCopied(copyReferenceData(value) as Record<string,unknown>);
 }catch{return false;}
}
function countedBreadCopied(row:Record<string,unknown>):boolean {
  const binding=manifest.countedBread.find(p=>p.recipeId===row.id);
  if(!binding)return true;
  const recipe=row.recipe as {servings:number;ingredients:{id:string;quantity:string;unit:string}[];steps:{instruction:string;allocations:{id:string;quantity:string;unit:string}[]}[]};
  const ingredient=recipe.ingredients.filter(i=>i.id===binding.ingredientId);
  if(recipe.servings!==2||ingredient.length!==1||ingredient[0]!.unit!=="g"||ingredient[0]!.quantity!==String(binding.pieceCount*binding.nominalPieceMassG))return false;
  const allocation=recipe.steps.flatMap(s=>s.allocations).filter(i=>i.id===binding.ingredientId);
  if(allocation.length!==1||allocation[0]!.unit!=="g"||allocation[0]!.quantity!==ingredient[0]!.quantity)return false;
  const name=binding.ingredientId==="r3-bun"?"buns":"croissants";
  return recipe.steps.some(s=>s.instruction.includes(`The two ${name} use a nominal ${binding.nominalPieceMassG} g each (${binding.pieceCount*binding.nominalPieceMassG} g total)`));
}
