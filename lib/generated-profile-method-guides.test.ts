import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync,writeFileSync} from "node:fs";
import {gunzipSync} from "node:zlib";
import {createCurrentMealCoverage,mealCoverageHash,classifyMealTool} from "./generated-current-meal-coverage.ts";
import {profileMethodGuide,PROFILE_METHOD_POLICY,profileMethodDescriptor} from "./generated-profile-method-guides.ts";
import manifest from "./fixtures/current-profile-method-guides-v1.json" with {type:"json"};
import {createRevisedCatalogReader} from "./generated-plan-catalog.ts";
import {createJoinedReferencePlannerV3,createJoinedReferencePlannerV4} from "./generated-joined-plan.ts";
import assets from "./fixtures/current-final-practical-guides-v1.json" with {type:"json"};
const cap=JSON.parse(readFileSync(new URL("./generated-current-source-capsule-v9.json",import.meta.url),"utf8"));
const source=gunzipSync(Buffer.from(cap.sourceGzipBase64,"base64")).toString("utf8");
const parsed=createRevisedCatalogReader(cap.configuration.sourcePin)(source);if(parsed.outcome!=="success")throw Error("catalog required");const catalog=parsed;
const opts={sourcePin:cap.configuration.sourcePin,configuration:cap.configuration,configurationSha256:mealCoverageHash(cap.configuration),asOfDate:"2026-11-02",region:"South",storeIds:["wd-reference-estimate:no-shop-preference"],practicalAssets:assets};
const current=(()=>{const value=createCurrentMealCoverage(source,{...opts,profileMethodPolicy:PROFILE_METHOD_POLICY});if(value.outcome!=="ready")throw Error(JSON.stringify(value));return value;})();
const strict=createCurrentMealCoverage(source,opts);if(strict.outcome!=="ready")throw Error("strict coverage required");
const profiles={baseline:["stove","oven","microwave","air fryer"],allRepresentable:["stove","oven","microwave","air fryer","slow cooker","pressure cooker","blender","toaster","waffle iron"],stoveOnly:["stove"],ovenOnly:["oven"],blenderOnly:["blender"],none:[]};
const reasons=(x:ReturnType<typeof current.forCandidate>)=>"reasons" in x?x.reasons:[];
function query(r:typeof current.rows[number],appliances:string[],extra={}){return {recipeId:r.recipeId,recipeSha256:r.recipeSha256,sourceSha256:current.sourceSha256,configurationSha256:current.configurationSha256,sourceServings:r.guideDomains[0]!.sourceServings,context:{asOfDate:opts.asOfDate,declaredAppliances:appliances,specialCapabilities:[],restrictions:"none-declared",...extra}};}
test("exact full1300 recipe map uses only representable appliance profiles; genuine unsupported rows remain held",()=>{
 assert.equal(current.rows.length,1300);assert.equal(current.summary.breakfast,300);assert.equal(current.summary.main,1000);
 const rows=current.rows.map(r=>({recipeId:r.recipeId,recipeSha256:r.recipeSha256,results:Object.fromEntries(Object.entries(profiles).map(([name,a])=>[name,current.forCandidate(query(r,a))]))}));
 const reachable=rows.filter(r=>Object.values(r.results).some(x=>x.outcome==="eligible"));
 assert.equal(reachable.length,1300);assert.equal(new Set(rows.map(r=>r.recipeId)).size,1300);
 assert.equal(rows.filter(r=>reasons(r.results.allRepresentable).some(x=>x==="capacity_unverified:second burner")).length,0);
 for(const row of rows.filter(r=>!Object.values(r.results).some(x=>x.outcome==="eligible")))assert.ok(reasons(row.results.allRepresentable).some(x=>x.includes("blender")||x.includes("waffle iron")),JSON.stringify(row));
 writeFileSync("C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/website-refresh-20261027/normal-ui-study/native-integration-20261030/backend-repair-round-v3/http-source-wave-v1/recipe-canonical-adoption-v632/backend-profile-observations.json",JSON.stringify({sourceSha256:current.sourceSha256,policy:profileMethodDescriptor(),profiles,rows,reachable:reachable.length,held:1300-reachable.length,counts:Object.fromEntries(Object.entries(profiles).map(([k])=>[k,rows.filter(r=>r.results[k]!.outcome==="eligible").length]))},null,2)+"\n");
});
test("every exact method preserves allocations, ingredients/nutrition body identity and safety endpoints; untriggered rows unchanged",()=>{
 assert.equal(manifest.records.length,486);
 for(const row of catalog.recipes){const method=profileMethodGuide(row.id,row.recipeSha256,row.recipe),bound=manifest.records.find(r=>r.recipeId===row.id);assert.equal(!!method,!!bound);
  if(method){assert.deepEqual(method.originalSteps,row.recipe.steps);assert.deepEqual(method.steps.map(s=>s.allocations),row.recipe.steps.map(s=>s.allocations));assert.ok(method.timingNotes.length>1);assert.equal(method.physicalCookingTested,false);for(const step of row.recipe.steps){for(const endpoint of step.instruction.match(/\d+ F \(\d+ C\)/g)??[])assert.ok(method.steps.some(s=>s.instruction.includes(endpoint)),endpoint);}assert.ok(!method.equipment.includes("second burner"));}
 }
 assert.equal(classifyMealTool("sieve")[0]!.role,"informational-prerequisite");assert.equal(classifyMealTool("unknown custom tool")[0]!.role,"unclassified");
});
test("method admission rejects tampered source/body/accessors and preserves old strict capabilities",()=>{
 const m=manifest.records[0]!,r=catalog.recipes.find(r=>r.id===m.recipeId)!;
 assert.equal(profileMethodGuide(r.id,"f".repeat(64),r.recipe),null);const changed={...r.recipe,steps:r.recipe.steps.map((s,i)=>({...s,instruction:s.instruction+(i===0?" tamper":"")}))};assert.equal(profileMethodGuide(r.id,r.recipeSha256,changed),null);
 let calls=0;const bad=Object.defineProperty({},"steps",{enumerable:true,get(){calls++;return r.recipe.steps;}});assert.equal(profileMethodGuide(r.id,r.recipeSha256,bad),null);assert.equal(calls,0);
 const q=current.rows.find(x=>x.recipeId===r.id)!;assert.ok(reasons(strict.forCandidate(query(q,profiles.baseline))).includes("capacity_unverified:second burner"));
 assert.equal(current.forCandidate(query(q,[],{specialCapabilities:["second burner"]})).outcome,"held");
 assert.equal(current.forCandidate({...query(q,profiles.baseline),recipeSha256:"f".repeat(64)}).outcome,"held");assert.equal(current.forCandidate(query(q,profiles.baseline,{asOfDate:"2026-11-03"})).outcome,"held");assert.equal(current.forCandidate(query(q,profiles.baseline,{restrictions:"unreviewed"})).outcome,"held");
 assert.equal(createCurrentMealCoverage(source,{...opts,profileMethodPolicy:"forged" as typeof PROFILE_METHOD_POLICY}).outcome,"error");
});
test("V4 method basis is distinct, old V3 remains strict, wrong/unknown equipment cannot acquire a substitute",()=>{
 const a=createJoinedReferencePlannerV3(source,cap.configuration),b=createJoinedReferencePlannerV4(source,cap.configuration);assert.equal(a.outcome,"ready");assert.equal(b.outcome,"ready");if(a.outcome!=="ready"||b.outcome!=="ready")throw Error("planner required");assert.notEqual(a.sourcePolicyBasis.basisSha256,b.sourcePolicyBasis.basisSha256);
 const row=current.rows.find(r=>r.equipment.some(t=>t.capabilityId==="second burner"))!;assert.equal(current.forCandidate(query(row,["unknown custom stove"])).outcome,"held");assert.equal(current.forCandidate({...query(row,profiles.baseline),sourceServings:{numerator:"999",denominator:"1"}}).outcome,"held");
});
