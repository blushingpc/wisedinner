// New isolated fixture-only evidence. No public pipeline, fixture writer or provider imports.
import {mkdirSync,writeFileSync,existsSync,readFileSync} from "node:fs";
import {resolve} from "node:path";
import {pathToFileURL} from "node:url";
import {performance} from "node:perf_hooks";
import {cpus,platform,totalmem} from "node:os";
import assert from "node:assert/strict";
import {PROFILES} from "../../packages/solver/src/profiles.ts";
import {toCanonical} from "../../packages/solver/src/units.ts";
import type {SolveInput} from "../../packages/solver/src/types.ts";
import {solveRestricted,restrictedCandidates} from "./catalog-selection.ts";
import {shortlistCatalog} from "./catalog-pool.ts";
import {eligibleSnapshot} from "./ingredient-safety.ts";
import {pantryBasis,type OwnedPack} from "./reviewed-pantry.ts";
import {hash} from "./price-evidence.ts";
import {pricingStage,reviewedRequirements,evaluatePricedWeek,weekSelectionRevision} from "./store-estimate-week.ts";
import {quoteBaskets,strategyDigest,decimalQuantity,multiply,type QuoteRequest,type BasketQuote,type PackFact} from "./store-estimates.ts";
import {scopeKey,verifyPhaseSeparation,evaluateHeldOut,sealRecord,type Calibration,type BasketObservation,type Model} from "./store-estimate-model.ts";
import {fixtureModel,fixtureStores,fixtureRequest,fixtureFacts,fixtureCalibration,fixturePolicy,fixtureStrategy,sourceFor,evidence} from "./store-estimate-fixtures.ts";

export function runStoreAcceptance(runId:string){
  if(!/^[a-z0-9-]{1,80}$/.test(runId))throw Error("Safe new run ID required");
  const parent=resolve("data/pipeline/store-estimates"),output=resolve(parent,runId);
  if(existsSync(output))throw Error("Refusing to overwrite earlier evidence");
  mkdirSync(parent,{recursive:true});mkdirSync(output);
  const save=(name:string,value:unknown)=>writeFileSync(resolve(output,name),JSON.stringify(value,null,2)+"\n",{flag:"wx"});
  save("started.json",{fixtureOnly:true,startedAt:new Date().toISOString(),runId});
  const stage=pricingStage(),model=fixtureModel([...new Set(stage.edible.skus.map(s=>s.aisle))]);
  const packSizes=Object.fromEntries(stage.edible.skus.map(s=>[s.id,multiply(decimalQuantity(s.pack_qty),decimalQuantity(toCanonical(1,s.pack_unit,s)))]));
  const pins={sourceDigest:stage.basket.source_digest,catalogDigest:hash(stage.edible),candidateDigest:stage.candidate_digest,
    approvalDigest:hash(JSON.parse(readFileSync("docs/ingredient-catalog/overnight-plant-approval.json","utf8"))),modelDigest:model.digest};
  save("catalog.json",stage.edible);save("review-pins.json",{...pins,counts:stage.counts,blocked:stage.basket.blocked,quantities:stage.basket.quantities,safety:stage.basket.safety});save("model.json",model);
  const allCalRows:BasketObservation[]=[],allHeldRows:BasketObservation[]=[],results:object[]=[],calibrationManifests:object[]=[];
  let coldStart:object|null=null;
  const idsOf=(out:ReturnType<typeof solveRestricted>)=>out.days.flatMap(d=>d.items.map(i=>i.recipe_id));
  const policyFor=(input:SolveInput,charges:QuoteRequest["charges"],allergies:string[]):QuoteRequest=>{
    const request=fixtureRequest(model,"split",fixtureStores.map(s=>s.id),Math.round(input.budget*100));request.charges=charges;request.strategyPolicyDigest=strategyDigest(request);
    request.selectionRevision=weekSelectionRevision(input,stage,allergies);return request;
  };
  function prepare(input:SolveInput,namespace:string,charges:QuoteRequest["charges"]=[],allergies:string[]=[]){
    const request=policyFor(input,charges,allergies),groups=new Map<string,{scope:BasketQuote["scope"];raw:number[];traces:object[]}>();
    // Independent synthetic measurement units on real reviewed weeks, BEFORE held-out seeds 0/7/19.
    for(let seed=101;seed<=109;seed++){
      const profile={...input,seed},started=performance.now(),out=solveRestricted(profile,stage.purchased,allergies,stage.basket.safety),solveMs=performance.now()-started,ids=idsOf(out);
      if(!coldStart){const warmStart=performance.now(),again=solveRestricted(profile,stage.purchased,allergies,stage.basket.safety);assert.deepEqual(out,again);coldStart={profile,allergies,firstSolveMs:solveMs,immediateWarmMs:performance.now()-warmStart,note:"First solve in this Node process; OS/file cache not cleared. Not a device benchmark."};save("cold-start.json",coldStart);}
      const pantrySku=stage.edible.skus.find(s=>s.id==="onions")!,owned:OwnedPack[]=seed%2?[{skuId:pantrySku.id,fraction:.25,purchaseBasis:pantryBasis(pantrySku)}]:[];
      const reviewed=reviewedRequirements(ids,profile,stage,owned,allergies),facts=fixtureFacts(reviewed.requirements,packSizes),sources=sourceFor(facts,facts.map(f=>f.cell));
      const raw=quoteBaskets(request,reviewed.requirements,reviewed.pantry,fixtureStores,facts,sources,model,[]);
      for(const q of [...raw.alternatives,raw.split!]){
        if(q.rawCents===null)throw Error(`Calibration raw coverage missing: ${q.reasons.join("; ")}`);
        independentQuote(q);
        const key=scopeKey(q.scope),group=groups.get(key)??{scope:q.scope,raw:[],traces:[]};group.raw.push(q.rawCents);
        group.traces.push({seed,recipeIds:ids,requirements:reviewed.requirements,pantry:reviewed.pantry,foodViolations:reviewed.food.violations,rawQuote:q,facts,sources,inputDigest:raw.inputDigest});groups.set(key,group);
      }
    }
    const calibrations:Calibration[]=[];
    for(const [key,g] of groups){const cal=fixtureCalibration(model,g.scope,g.raw,`${namespace}-${key}`);calibrations.push(cal);allCalRows.push(...cal.rows);calibrationManifests.push({namespace,key,calibration:cal,traces:g.traces});}
    request.calibrationPins=calibrations.map(c=>({scopeDigest:scopeKey(c.scope),digest:c.digest}));
    verifyPhaseSeparation(model.samples,allCalRows,allHeldRows);
    return {request,calibrations};
  }
  function assess(ids:string[],input:SolveInput,bundle:ReturnType<typeof prepare>,owned:OwnedPack[]=[],allergies:string[]=[],dropSku?:string){
    const reviewed=reviewedRequirements(ids,input,stage,owned,allergies),facts=fixtureFacts(reviewed.requirements,packSizes).filter(f=>f.skuId!==dropSku),sources=sourceFor(facts,facts.map(f=>f.cell));
    const args:Parameters<typeof quoteBaskets>=[bundle.request,reviewed.requirements,reviewed.pantry,fixtureStores,facts,sources,model,bundle.calibrations];
    const evaluated=evaluatePricedWeek(ids,input,stage,owned,allergies,args),again=evaluatePricedWeek(ids,input,stage,owned,allergies,args);assert.deepEqual(evaluated,again);
    for(const q of [...evaluated.quotes.alternatives,...(evaluated.quotes.split?[evaluated.quotes.split]:[])])independentQuote(q,bundle.calibrations.find(c=>scopeKey(c.scope)===scopeKey(q.scope)),bundle.request,facts,model);
    return {evaluated,inputs:{requirements:reviewed.requirements,pantry:reviewed.pantry,facts,sources,request:bundle.request},deterministic:true};
  }
  const bundles=new Map<string,ReturnType<typeof prepare>>();
  for(const [name,profile] of PROFILES){bundles.set(name,prepare(profile,name));save(`calibration-${name}.json`,calibrationManifests.filter(m=>(m as {namespace:string}).namespace===name));}
  save("calibration-index.json",{fixtureOnly:true,policy:fixtureStrategy,modelDigest:model.digest,scopeCount:calibrationManifests.length,declaredIndependentUnits:allCalRows.length,calibrationDigests:[...bundles.values()].flatMap(b=>b.calibrations.map(c=>c.digest))});
  for(const [name,profile] of PROFILES)for(const seed of [0,7,19]){
    const input={...profile,seed},start=performance.now(),out=solveRestricted(input,stage.purchased,[],stage.basket.safety),firstMs=performance.now()-start;
    const t=performance.now(),warm=solveRestricted(input,stage.purchased,[],stage.basket.safety),warmMs=performance.now()-t;assert.deepEqual(out,warm);
    const ids=idsOf(out),bundle=bundles.get(name)!,check=assess(ids,input,bundle),held:object[]=[];
    for(const q of [...check.evaluated.quotes.alternatives,check.evaluated.quotes.split!]){
      if(q.rawCents===null)continue;
      const calibration=bundle.calibrations.find(c=>scopeKey(c.scope)===scopeKey(q.scope));if(!calibration)continue;
      const id=`held-${name}-${seed}-${q.scopeDigest}`;
      const measured=sealRecord({id,evidence:evidence(id,"2026-10-03T12:00:00Z"),independentUnit:`${id}-physical`,scope:q.scope,rawPredictionCents:q.rawCents,
        actualCents:q.rawCents+Math.ceil(q.rawCents*([3,10,12][[0,7,19].indexOf(seed)])/100),basketDigest:hash([id,check.inputs]),priceBasis:"raw" as const});
      allHeldRows.push(measured);verifyPhaseSeparation(model.samples,allCalRows,allHeldRows);
      held.push(evaluateHeldOut(model,calibration,[measured],sourceFor([measured],check.inputs.facts.map(f=>f.cell)),fixturePolicy));
    }
    const substitutes=Array.from({length:15},(_,slot)=>{
      const candidates=restrictedCandidates(out,slot,stage.purchased,[],stage.basket.safety);
      return {slot,candidates:candidates.map(c=>{const next=[...ids];next[slot]=c.recipe_id;const checked=assess(next,input,bundle);return {candidate:c,recipeIds:next,fullWeek:{recipeIds:next,days:checked.evaluated.days,quotes:{split:checked.evaluated.quotes.split,alternatives:checked.evaluated.quotes.alternatives}}};})};
    });
    const row={name,seed,input,firstMs,warmMs,firstSolveInProcess:false,shortlistSize:shortlistCatalog(eligibleSnapshot(stage.purchased,input.diet,[],stage.basket.safety),input).recipes.length,
      legacyReferenceFeasible:out.feasible,legacyReferenceTotalCents:Math.round(out.est_total*100),out,...check,held,substitutes};results.push(row);save(`week-${name}-${seed}.json`,row);
    process.stdout.write(`${name}/${seed}: food ${check.evaluated.quotes.alternatives[0].foodViolations.length?"miss":"pass"}; single ${check.evaluated.quotes.alternatives.map(q=>q.feasible?`${q.totalCents}c`:q.failureKinds.join("+")).join(",")}; split ${check.evaluated.quotes.split!.feasible?check.evaluated.quotes.split!.totalCents+"c":check.evaluated.quotes.split!.failureKinds.join("+")}\n`);
  }
  const typical=PROFILES.find(([name])=>name==="typical")![1],input={...typical,seed:0},week=solveRestricted(input,stage.purchased,[],stage.basket.safety),ids=idsOf(week),firstSku=stage.edible.skus.find(s=>s.id==="onions")!;
  const pantry=assess(ids,input,bundles.get("typical")!,[{skuId:firstSku.id,fraction:.5,purchaseBasis:pantryBasis(firstSku)}]);save("partial-pantry.json",pantry);
  const edited={...input,protein_per_day:300};const editedBundle=prepare(edited,"edit-protein");save("profile-edit.json",assess(ids,edited,editedBundle));
  const low=PROFILES.find(([name])=>name==="floor budget")![1],high={...low,budget:150},charges=[{id:"fictional-unavoidable-charge",cents:7000,storeId:null}];
  const lowOut=solveRestricted({...low,seed:0},stage.purchased,[],stage.basket.safety),highOut=solveRestricted({...high,seed:0},stage.purchased,[],stage.basket.safety);
  const lowCheck=assess(idsOf(lowOut),{...low,seed:0},prepare(low,"low-budget",charges)),highBundle=prepare(high,"high-budget",charges),highCheck=assess(idsOf(highOut),{...high,seed:0},highBundle);
  assert(lowCheck.evaluated.quotes.alternatives.every(q=>!q.feasible&&q.failureKinds.includes("budget")));assert(highCheck.evaluated.quotes.alternatives.some(q=>q.feasible));
  const noCoverage=assess(idsOf(highOut),{...high,seed:0},highBundle,[],[],stage.edible.recipe_ingredients.find(r=>r.recipe_id===idsOf(highOut)[0])!.sku_id);
  assert(noCoverage.evaluated.quotes.alternatives.every(q=>!q.feasible&&q.failureKinds.includes("coverage")));save("higher-budget.json",{low:lowCheck,high:highCheck,moreMoneyCannotRepairCoverage:noCoverage,note:"Bounded candidates, not a mathematical minimum. Charges/prices fictional. No new commercial policy."});
  const allergyInput={...typical,seed:0},soyPool=eligibleSnapshot(stage.purchased,allergyInput.diet,["soy"],stage.basket.safety);
  let allergyOutcome:object;
  try{const allergyOut=solveRestricted(allergyInput,stage.purchased,["soy"],stage.basket.safety);allergyOutcome=assess(idsOf(allergyOut),allergyInput,prepare(allergyInput,"soy-exclusion",[],["soy"]),[],["soy"]);}
  catch(error){if((error as Error).message!=="Not enough reviewed recipes for these restrictions")throw error;
    allergyOutcome={status:"food-coverage-missing",allergies:["soy"],reason:"No reviewed breakfast pool remains after full ingredient filtering",eligibleRecipes:soyPool.recipes.length,eligibleBreakfasts:soyPool.recipes.filter(r=>r.meal_type==="breakfast").length,excludedRecipes:stage.purchased.recipes.filter(r=>!soyPool.recipes.some(s=>s.id===r.id)).map(r=>r.id)};}
  save("soy-exclusion.json",allergyOutcome);
  const unknownPool=eligibleSnapshot(stage.purchased,"vegan",[],{});assert.equal(unknownPool.recipes.length,0);assert.throws(()=>solveRestricted({...typical,diet:"vegan"},stage.purchased,[],{}));
  save("unknown-metadata.json",{status:"food-coverage-missing",eligibleRecipes:0,note:"Actual restricted selection rejects empty/unknown safety metadata. No unknown ingredient is treated as safe."});
  save("extra-calibrations.json",calibrationManifests.filter(m=>![...bundles.keys()].includes((m as {namespace:string}).namespace)));
  const parsed=results as {name:string;seed:number;firstMs:number;warmMs:number;evaluated:ReturnType<typeof evaluatePricedWeek>;substitutes:{candidates:{fullWeek:ReturnType<typeof evaluatePricedWeek>}[]}[];held:{overrunCount:number;maximumOverrunCents:number}[]}[];
  const report={fixtureOnly:true,runId,pins,counts:stage.counts,reviewedIngredientCount:stage.edible.skus.length,blockedIds:stage.basket.blocked,environment:{node:process.version,platform:platform(),cpu:cpus()[0]?.model,totalMemoryMiB:totalmem()/1048576,rssMiB:process.memoryUsage().rss/1048576},
    coldStart,allergyOutcome,fitUnitCount:model.samples.length,calibrationUnitCount:allCalRows.length,heldOutUnitCount:allHeldRows.length,calibrationScopeCount:calibrationManifests.length,
    results:parsed.map(r=>({name:r.name,seed:r.seed,foodViolations:r.evaluated.quotes.alternatives[0].foodViolations,single:r.evaluated.quotes.alternatives.map(q=>({store:q.scope.quotedStoreId,feasible:q.feasible,totalCents:q.totalCents,failureKinds:q.failureKinds})),split:{feasible:r.evaluated.quotes.split!.feasible,totalCents:r.evaluated.quotes.split!.totalCents,failureKinds:r.evaluated.quotes.split!.failureKinds},firstMs:r.firstMs,warmMs:r.warmMs,substitutes:r.substitutes.map(s=>({count:s.candidates.length,feasible:s.candidates.filter(c=>c.fullWeek.quotes.split?.feasible).length})),heldOverruns:r.held.reduce((n,h)=>n+h.overrunCount,0),maximumHeldOverrunCents:Math.max(0,...r.held.map(h=>h.maximumOverrunCents))})),
    limits:"Real reviewed recipe/quantity arithmetic; all store identities, pack offers, prices, error measurements and independence labels fictional. Not national/local feed, approved accuracy/freshness policy, kitchen/device proof or reroll-shopping approval. Week generation retains conservative legacy reference pricing; this bridge re-evaluates new prices, not a globally optimal store-aware food search. Process was warmed by calibration before these timings."};
  save("report.json",report);return {output,report};
}
// Recalculate pennies and purchase balances without trusting quote totals.
export function independentQuote(q:BasketQuote,calibration?:Calibration,request?:QuoteRequest,facts?:ReturnType<typeof fixtureFacts>,model?:ReturnType<typeof fixtureModel>){
  const quantity=(r:{numerator:number;denominator:number})=>r.numerator/r.denominator;
  for(const l of q.lines){assert.equal(l.rawCents,l.assignments.reduce((n,a)=>n+a.packs*a.packCents,0));const bought=l.assignments.reduce((n,a)=>n+a.packs*quantity(a.packQuantity),0);
    assert(Math.abs(bought-quantity(l.purchased))<1e-8);assert(Math.abs(bought+quantity(l.ownedUsed)-quantity(l.required)-quantity(l.newCarryover))<1e-8);
    if(facts&&model)for(const a of l.assignments){const fact:PackFact=facts.find(f=>f.id===a.factId)!;assert(fact);assert.equal(a.storeId,fact.cell.storeId);assert(q.scope.storeIds.includes(a.storeId));if(q.scope.quotedStoreId)assert.equal(a.storeId,q.scope.quotedStoreId);assert(a.packs<=fact.availablePacks);assert.deepEqual(a.packQuantity,fact.packQuantity);
      const cell:Model["cells"][number]|undefined=model.cells.find(c=>c.key===JSON.stringify([fact.cell.storeId,fact.cell.region,fact.cell.category,fact.cell.channel]));
      const expected:number=fact.mode==="exact"?fact.rawCents:Number((BigInt(fact.rawCents)*BigInt(cell!.ratio.numerator)+BigInt(cell!.ratio.denominator)-BigInt(1))/BigInt(cell!.ratio.denominator));assert.equal(a.packCents,expected);}}
  if(q.rawCents!==null)assert.equal(q.rawCents,q.lines.reduce((n,l)=>n+l.rawCents,0));
  if(q.totalCents!==null){assert.equal(q.totalCents,q.rawCents!+q.allowanceCents!+q.chargeCents!);
    if(calibration&&request){const r=calibration.upperError!;const allowance=Number((BigInt(q.rawCents!)*BigInt(r.numerator)+BigInt(r.denominator)-BigInt(1))/BigInt(r.denominator));assert.equal(q.allowanceCents,allowance);
      const visited=new Set(q.lines.flatMap(l=>l.assignments.map(a=>a.storeId)));assert.equal(q.chargeCents,request.charges.filter(c=>c.storeId===null||visited.has(c.storeId)).reduce((n,c)=>n+c.cents,0));assert.equal(q.withinBudget,q.totalCents<=request.budgetCents);}}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){const result=runStoreAcceptance(process.argv[2]??new Date().toISOString().replace(/[^0-9]/g,""));process.stdout.write(`Saved fixture-only evidence: ${result.output}\n`);}
