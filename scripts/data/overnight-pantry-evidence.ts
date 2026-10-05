// Isolated additive artifact, refuses earlier evidence/output overwrite. No external writers.
import {existsSync,mkdirSync,readFileSync,writeFileSync} from "node:fs";
import {plantApproval,plantCandidates} from "./overnight-plant.ts";
import {overnightBasket} from "./overnight-food.ts";
import {stageReviewed} from "./reviewed-week.ts";
import {evaluateReviewedPantry,pantryBasis} from "./reviewed-pantry.ts";
const stage=stageReviewed(plantApproval(),overnightBasket(),plantCandidates());
const prior=JSON.parse(readFileSync("docs/ingredient-catalog/overnight-plant-acceptance.json","utf8"));
const path="docs/ingredient-catalog/overnight-pantry-acceptance.json",dir="data/pipeline/overnight/physical-pantry";
if(existsSync(path)||existsSync(dir))throw Error("New isolated output required; earlier evidence retained");
const selected=stage.edible.skus.filter(s=>["oats","carrots","eggs"].includes(s.id));
const rows:{name:string;seed:number|undefined;without:ReturnType<typeof evaluateReviewedPantry>;partial:ReturnType<typeof evaluateReviewedPantry>}[]=prior.rows.filter((r:{name:string})=>["typical","household of two"].includes(r.name)).map((r:{name:string;input:Parameters<typeof evaluateReviewedPantry>[1];out:{days:{items:{recipe_id:string}[]}[]}})=>{
 const ids=r.out.days.flatMap(d=>d.items.map(i=>i.recipe_id)),owned=selected.map(s=>({skuId:s.id,fraction:.5,purchaseBasis:pantryBasis(s)}));
 return {name:r.name,seed:r.input.seed,without:evaluateReviewedPantry(ids,r.input,stage,[]),partial:evaluateReviewedPantry(ids,r.input,stage,owned)};
});
mkdirSync(dir,{recursive:true});const bytes=JSON.stringify({private:true,rows,note:"Actual real solver IDs re-evaluated; no optimized pantry search/public contract/device proof."},null,2)+"\n";
writeFileSync(`${dir}/acceptance.json`,bytes);writeFileSync(path,bytes);console.log(JSON.stringify(rows.map(r=>({name:r.name,seed:r.seed,pass:r.partial.feasible,before:r.without.totalCents,after:r.partial.totalCents}))));
