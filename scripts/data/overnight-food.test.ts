import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {overnightBasket,overnightCandidates,overnightApproval} from "./overnight-food.ts";
import {stageReviewed,digest,type WeekApproval} from "./reviewed-week.ts";
import {candidateIdentity,compileCandidate} from "./catalog-expansion.ts";
import {eligibleSnapshot} from "./ingredient-safety.ts";
import {solveRestricted} from "./catalog-selection.ts";
import {independentArithmetic} from "./reviewed-week-acceptance.ts";
import {PROFILES} from "../../packages/solver/src/profiles.ts";
test("original dry whole-grain label preserves source precision, physical pack and conservative egg exclusion",()=>{
 const b=overnightBasket(),s=stageReviewed(overnightApproval(),b,overnightCandidates());
 assert.equal(b.quantities["ww-spaghetti"].nutrition.protein_g,8*100/56);
 assert.equal(b.quantities["ww-spaghetti"].nutrition.kcal,180*100/56);
 assert.equal(s.edible.skus.find(s=>s.id==="ww-spaghetti")!.pack_label,"1 lb box");
 assert.deepEqual(s.counts,{generated:120,unique:120,validated:120,reviewReady:96,eligible:96,quarantined:24});
 assert.equal(new Set(overnightCandidates().map(candidateIdentity)).size,120);
 const egg=eligibleSnapshot(s.purchased,"none",["eggs"],b.safety);
 assert.ok(!egg.recipe_ingredients.some(i=>i.sku_id==="ww-spaghetti"));
 assert.ok(!s.edible.store_prices.some(p=>p.sku_id==="ww-spaghetti"));
 assert.ok(b.blocked.includes("spaghetti")&&b.blocked.includes("tempeh"));
});
test("prior approval remains unchanged and new source/preparations cannot use stale approval",()=>{
 const prior:WeekApproval=JSON.parse(readFileSync("docs/ingredient-catalog/reviewed-week-approval.json","utf8"));
 assert.equal(stageReviewed(prior).counts.eligible,63);
 assert.throws(()=>stageReviewed(prior,overnightBasket(),overnightCandidates()),/stale/);
 const b=overnightBasket();b.quantities["ww-spaghetti"].nutrition.protein_g=99;
 assert.throws(()=>stageReviewed(overnightApproval(),b,overnightCandidates()),/stale/);
 const c=overnightCandidates().find(c=>c.recipe.id.includes("ww-spaghetti"))!;
 c.recipe.steps[0]="Drain and discard pasta water.";assert.throws(()=>compileCandidate(c),/directions/);
});
test("targeted reviewed catalog preserves passing profiles through the actual bounded solver",()=>{
 const s=stageReviewed(overnightApproval(),overnightBasket(),overnightCandidates());
 for(const [name,p] of PROFILES.filter(([name])=>name!=="vegan")){
   const out=solveRestricted({...p,seed:7},s.purchased,[],s.basket.safety);
   assert.equal(out.feasible,true,`${name}: ${out.why}`);
   assert.equal(independentArithmetic(out,s.edible,s.basket).feasible,true);
   assert.equal(digest(out),digest(solveRestricted({...p,seed:7},s.purchased,[],s.basket.safety)));
 }
});
