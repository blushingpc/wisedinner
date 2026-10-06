// Pure assembly/validation plus explicitly isolated local staging. No DB/storage/Git writer.
import {readFileSync,existsSync,mkdirSync,writeFileSync,realpathSync} from "node:fs";
import {resolve,sep} from "node:path";
import {assemble,guard,previousSnapshot} from "./snapshot.ts";
import {SKUS} from "./authored/skus.ts";
import {overnightBasket} from "./overnight-food.ts";
import {digest,type ReviewBundle} from "./reviewed-week.ts";
import {quarantinePrices,type ExactPrice,type PriceAdmissionContext} from "./price-evidence.ts";
import {stageSnapshot} from "./publication.ts";
import {solve,evaluateWeek} from "../../packages/solver/src/engine.ts";
import {PROFILES} from "../../packages/solver/src/profiles.ts";
import type {Snapshot} from "../../packages/solver/src/types.ts";
export function sourceProblems(s:Snapshot,b:ReviewBundle){
 const errors:string[]=[];
 if(b.source_digest!==digest({quantities:b.quantities,safety:b.safety,input_digest:b.input_digest}))errors.push("Source review changed");
 for(const sku of s.skus){const q=b.quantities[sku.id];if(!q||!q.source||!q.yield_source||b.safety[sku.id]?.status!=="reviewed")errors.push(`${sku.id}: original nutrition/quantity/safety unresolved`);
 else if(q.edible_per_purchased!==1)errors.push(`${sku.id}: public v1 cannot encode purchased versus edible yield; versioned transition needed`);
 else if(digest(s.nutrition.filter(n=>n.sku_id===sku.id))!==digest([q.nutrition]))errors.push(`${sku.id}: source nutrients differ or duplicate`);}
 return errors;
}
export async function stagedPipeline(output:string,priceContext?:PriceAdmissionContext){
 if(!/^data\/pipeline\/(overnight|staging)\/[a-zA-Z0-9_-]+$/.test(output))throw new Error("Explicit isolated stage path required");
 const parent=resolve(output,".."),root=realpathSync(".");mkdirSync(parent,{recursive:true});
 if(!realpathSync(parent).startsWith(root+sep))throw new Error("Stage target outside workspace");
 const dir=resolve(output);mkdirSync(dir); // New directory only: never overwrite earlier evidence.
 const manifest:Record<string,unknown>={status:"blocked",side_effects:"isolated local files only; no seed/upsert/storage/pointer/public fixture/Git write",output};
 try {
  const cache=existsSync("data/pipeline/kroger-prices.json")?JSON.parse(readFileSync("data/pipeline/kroger-prices.json","utf8")):{rows:[]};
  const prices=quarantinePrices(cache.rows as ExactPrice[],SKUS,priceContext);
  manifest.price_rows=Array.isArray(cache.rows)?cache.rows.length:0;manifest.price_accepted=prices.accepted.length;manifest.price_quarantine=prices.quarantine;manifest.price_context_valid=prices.context_valid;
  if(!prices.context_valid||prices.quarantine.length||!prices.accepted.length)throw new Error("Price admission held before assembly: explicit reviewed time/location policy and unambiguous current observations required");
  const previous=previousSnapshot(),b=overnightBasket();manifest.source_revision=b.source_digest;manifest.unresolved_ids=b.blocked;
  const snapshot=assemble(prices.accepted,(previous?.version??0)+1);
  const staged=await stageSnapshot(snapshot,previous,{sources:s=>sourceProblems(s,b),acceptance:async s=>guard(s,previous),fixtures:async s=>{
    const weeks=[];for(const [name,p] of PROFILES)for(const seed of [0,7,19]){const out=solve({...p,seed},s);if(!out.feasible)throw new Error(`Staged fixture infeasible: ${name}/${seed}`);const evaluated=evaluateWeek(out.days.flatMap(d=>d.items.map(i=>i.recipe_id)),out.input,s);if(digest(out)!==digest(evaluated))throw new Error("Staged fixture evaluation differs");weeks.push({name,out});}
    return {note:"Internal actual solver acceptance; no invented receipt/delivery/accuracy or photo claims",weeks};
  }});
  writeFileSync(resolve(dir,"snapshot.json"),staged.bytes);writeFileSync(resolve(dir,"fixtures.json"),JSON.stringify(staged.fixtures));
  Object.assign(manifest,staged.manifest,{publish:"No live publisher bound; separate authorization and migration required"});
 }catch(e){manifest.reason=(e as Error).message;}
 writeFileSync(resolve(dir,"manifest.json"),JSON.stringify(manifest,null,2)+"\n");return manifest;
}
