import assert from "node:assert/strict";
import {test} from "node:test";
import {plantApproval,plantCandidates} from "./overnight-plant.ts";
import {overnightApproval,overnightBasket} from "./overnight-food.ts";
import {stageReviewed,digest} from "./reviewed-week.ts";
import {candidateIdentity} from "./catalog-expansion.ts";
import {solveRestricted} from "./catalog-selection.ts";
import {independentArithmetic} from "./reviewed-week-acceptance.ts";
import {PROFILES} from "../../packages/solver/src/profiles.ts";
test("twelve inspected grain preparations remain distinct, source pinned and separately approved",()=>{
 const c=plantCandidates(),s=stageReviewed(plantApproval(),overnightBasket(),c);
 assert.equal(new Set(c.map(candidateIdentity)).size,132);assert.deepEqual(s.counts,{generated:132,unique:132,validated:132,reviewReady:108,eligible:108,quarantined:24});
 assert.throws(()=>stageReviewed(overnightApproval(),overnightBasket(),c),/stale/);
 for(const next of c.slice(120)){assert.equal(next.photo,null);assert.equal(next.parts.find(p=>p.role==="grain")!.row[1],110);assert.ok(next.recipe.steps.some(s=>s.includes("dry")));assert.equal(next.recipe.minutes,next.recipe.id.includes("brown-rice")?55:45);}
});
test("all six reviewed-only profiles pass seeds 0/7/19 with full deterministic evaluation",()=>{
 const s=stageReviewed(plantApproval(),overnightBasket(),plantCandidates());
 for(const [name,p]of PROFILES)for(const seed of [0,7,19]){
  const input={...p,seed},out=solveRestricted(input,s.purchased,[],s.basket.safety);
  assert.equal(out.feasible,true,`${name}/${seed}: ${out.why}`);assert.equal(independentArithmetic(out,s.edible,s.basket).feasible,true);
  assert.equal(digest(out),digest(solveRestricted(input,s.purchased,[],s.basket.safety)));
 }
});
