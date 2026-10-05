// Targeted extension to reduce the reviewed vegan variety miss. No new ingredient or source approval.
import {readFileSync} from "node:fs";
import {overnightCandidates} from "./overnight-food.ts";
import {directions,compileCandidate,type Candidate} from "./catalog-expansion.ts";
import type {WeekApproval} from "./reviewed-week.ts";
export function plantCandidates():Candidate[]{
 const prior=overnightCandidates(),added:Candidate[]=[];
 for(const c of prior.filter(c=>c.recipe.protein==="frozen-edamame"&&c.parts.find(p=>p.role==="grain")!.row[0]==="white-rice"))for(const grain of ["brown-rice","quinoa"]){
  const next=structuredClone(c);next.parts.find(p=>p.role==="grain")!.row[0]=grain;
  next.recipe.id=next.recipe.id.replace("white-rice",grain);next.recipe.name=next.recipe.name.replace("white rice",grain.replaceAll("-"," "));
  next.recipe.minutes=grain==="brown-rice"?55:45;next.recipe.ingredients=next.parts.map(p=>p.row);next.recipe.steps=directions(next.parts,next.method,true);
  compileCandidate(next);added.push(next);
 }
 return [...prior,...added];
}
export function plantApproval():WeekApproval{return JSON.parse(readFileSync("docs/ingredient-catalog/overnight-plant-approval.json","utf8"));}
