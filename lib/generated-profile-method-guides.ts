import manifest from "./fixtures/current-profile-method-guides-v1.json" with {type:"json"};
import {copyReferenceData, canonicalReferenceData} from "./generated-plan-data.ts";
import {sha256Hex} from "./generated-runtime-bytes.ts";
import type {RevisedRecipeProjection} from "./generated-plan-catalog.ts";
export const PROFILE_METHOD_POLICY = "wd-profile-method-guides-v1";
export type ProfileMethodGuide = typeof manifest.records[number];
function freeze<T>(value:T):T {if(value&&typeof value==="object"&&!Object.isFrozen(value)){Object.values(value).forEach(freeze);Object.freeze(value);}return value;}
const records = new Map(manifest.records.map(row=>[row.recipeId,freeze(row)]));
let descriptor: Readonly<{version:string;sourceSha256:string;manifestSha256:string}> | undefined;
export function profileMethodDescriptor(){return descriptor??=Object.freeze({version:PROFILE_METHOD_POLICY,sourceSha256:manifest.sourceSha256,manifestSha256:sha256Hex(JSON.stringify(canonicalReferenceData(manifest)))});}
// Candidate source data only, never owner/expiry/admission. Exact recipe identity
// and original method/equipment are checked before any substitute can be used.
export function profileMethodGuide(id:string,sha:string,recipe:unknown):ProfileMethodGuide|null {
 try {const row=records.get(id);if(!row||sha!==row.recipeSha256)return null;
 const data=copyReferenceData(recipe) as Record<string,unknown>;
 if(sha256Hex(JSON.stringify(canonicalReferenceData(data)))!==sha)return null;
 if(JSON.stringify(data.steps)!==JSON.stringify(row.originalSteps)||JSON.stringify(data.equipment)!==JSON.stringify(row.originalEquipment))return null;
 return row;}catch{return null;}
}
export function profileMethodEquipment(row:RevisedRecipeProjection,declared:readonly string[]):readonly string[]{
 if(row.recipe.equipment.every(t=>declared.includes(t)))return row.recipe.equipment;
 const guide=profileMethodGuide(row.id,row.recipeSha256,row.recipe);
 return guide&&guide.equipment.every(t=>declared.includes(t))?guide.equipment:row.recipe.equipment;
}
