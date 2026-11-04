import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { setup } from "./generated-joined-plan.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";
import { prepareReferencePurchaseRequirements } from "./generated-plan-quote.ts";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";

const sha=(v:string|Uint8Array)=>createHash("sha256").update(v).digest("hex"), json=(v:unknown)=>Buffer.from(JSON.stringify(v)), amount=(n:number,d=1)=>({numerator:String(n),denominator:String(d)});
function fixture(){
 const f=setup(),rows=structuredClone(f.rows);
 rows.forEach((r,i)=>{r.recipe.ingredients[0]!.state=i?"dry":"ready-to-use";const h=sha(JSON.stringify(canonicalReferenceData(r.recipe)));r.recipe_sha256=h;r.nutrition.source_refresh.exact_recipe_body_sha256=h;r.nutrition.source_refresh.recipe_sha256_unchanged=h;});
 const catalog=Buffer.from(rows.map(r=>JSON.stringify(r)).join("\n")+"\n"),signatures=["a".repeat(64),"b".repeat(64)],forms=rows.map(r=>{const i=r.recipe.ingredients[0]!;return{id:i.id,name:i.name,state:i.state,unit:i.unit};});
 const matches=json({matches:Object.fromEntries(signatures.map((s,i)=>[s,{exact_form:forms[i],status:"conditional-reference",record_ids:[10],flags:["synthetic-warning-"+i],holds:[]}]))});
 const records=json({"10":{fdc_id:10,description:"Synthetic only reference food",raw_food_row_sha256:"2".repeat(64),portions:[]}});
 const point={series_id:"APU0300701312",area_code:"0300",item_code:"701312",region:"South",currency:"USD",source_kind:"bls-average-retail-price",product:"Synthetic only price",period:"2026-09",unit:"lb",unit_amount:"1",value:"2.500",source_ids:["point"]};
 const snapshot=(observations:unknown[])=>json({schema:"wisedinner-bls-average-price-v1",source_kind:"bls-average-retail-price",currency:"USD",as_of:"2026-10-14",status:"partial-observations",observations,sources:[{id:"point",sha256:"3".repeat(64)}]});
 const sources={catalog,matches,records,staples:snapshot([point]),produce:snapshot([])},shared={sourceUrl:"https://example.invalid/synthetic-only",sourceSha256:"4".repeat(64),reviewedOn:"2026-10-19",evidenceLevel:"synthetic-test-only",description:"Synthetic only, not actual food or package evidence"};
 const claims=[...signatures.map((s,i)=>({...shared,id:"package-"+i,ingredientSignature:s,kind:"package-reference",purchaseState:"ready-to-use",unit:"g",nominalQuantity:amount(500)})),{...shared,id:"category",ingredientSignature:signatures[0]!,kind:"price-category-reference",product:point.product,priceScope:"conditional-category-unit-model"}];
 const review={id:"south-september",region:"South",seriesId:point.series_id,product:point.product,period:"2026-09",categoryClaimId:"category",reviewEffectiveFrom:"2026-10-19",usableThrough:"2026-10-19"};
 const families=forms.map((exactForm,i)=>({id:"family-"+i,ingredientSignature:signatures[i]!,exactForm,recordIds:[10],purchase:{skuId:"one-physical-food",state:"ready-to-use",unit:"g",category:"pantry",perishable:false},quantityBasis:{kind:"reviewed-input-state-equivalence",groupId:"input-wording-group"},packageClaimId:"package-"+i,priceReviews:i?[]:[review]}));
 const group={...shared,sourceSha256:"6".repeat(64),id:"input-wording-group",memberFamilyIds:families.map(f=>f.id),memberForms:families.map(f=>({familyId:f.id,ingredientSignature:f.ingredientSignature,exactForm:f.exactForm,recordIds:f.recordIds})),anchorFamilyId:"family-0",scope:"same-food-input-grams-no-physical-transition"};
 const manifest={schema:"wd-reviewed-public-pack-manifest-v2",catalogSha256:sha(catalog),claims,families,purchaseGroups:[group]};
 function config(m:unknown=manifest){return{catalog:{sha256:sha(sources.catalog),recordCount:2},matches:{sha256:sha(sources.matches)},records:{sha256:sha(sources.records)},staples:{sha256:sha(sources.staples),observations:1},produce:{sha256:sha(sources.produce),observations:0},manifestSha256:sha(json(m))};}
 return{sources,manifest,config,bind:()=>createReviewedPublicPackRegistry(sources,json(manifest),config())};
}
function ready(){const f=fixture(),r=f.bind();assert.equal(r.outcome,"ready");if(r.outcome!=="ready")throw Error("Expected explicit reviewed synthetic group");return{...f,registry:r};}

test("reviewed v2 input wordings share one purchase identity while v1 remains literal and refuses duplicate SKU",()=>{
 const {registry}=ready(),a=registry.quantityForFamily({familyId:"family-0"}),b=registry.quantityForFamily({familyId:"family-1"});
 assert.equal(a.outcome,"prepared");assert.equal(b.outcome,"prepared");if(a.outcome!=="prepared"||b.outcome!=="prepared")throw Error("Expected quantity mappings");
 assert.deepEqual(a.pantryPurchaseBindings,b.pantryPurchaseBindings);assert.equal(a.correspondences[0]!.formDigest,b.correspondences[0]!.formDigest);assert.equal(a.correspondences[0]!.sourceSha256,b.correspondences[0]!.sourceSha256);
 assert.notEqual(a.correspondences[0]!.ingredientId,b.correspondences[0]!.ingredientId);assert.notEqual(a.correspondences[0]!.preparedState,b.correspondences[0]!.preparedState);assert.deepEqual(a.sourceFlags,["synthetic-warning-0"]);assert.deepEqual(b.sourceFlags,["synthetic-warning-1"]);
 const f=fixture(),{purchaseGroups,...old}=f.manifest;void purchaseGroups;old.schema="wd-reviewed-public-pack-manifest-v1";old.families.forEach(x=>{x.quantityBasis={kind:"same-state-identity",groupId:"input-wording-group"};});
 assert.equal(createReviewedPublicPackRegistry(f.sources,json(old),f.config(old)).outcome,"error");
});

test("shared price fact and multi-family bundle never duplicate the physical item or pantry deduction",()=>{
 const {registry}=ready(),query={region:"South",asOfDate:"2026-10-19"},a=registry.forPlanning({...query,familyId:"family-0"}),b=registry.forPlanning({...query,familyId:"family-1"});
 assert.equal(a.outcome,"prepared");assert.equal(b.outcome,"prepared");if(a.outcome!=="prepared"||b.outcome!=="prepared")throw Error("Expected group price");assert.deepEqual(a.regionalPackFacts,b.regionalPackFacts);
 const bundle=registry.forFamilies({familyIds:["family-1","family-0"],...query});assert.equal(bundle.outcome,"prepared");if(bundle.outcome!=="prepared")throw Error("Expected full bundle");
 assert.equal(bundle.correspondences.length,2);assert.equal(bundle.pantryPurchaseBindings.length,1);assert.equal(bundle.regionalPackFacts.length,1);assert.ok(bundle.regionalPackFacts[0]!.flags.includes("synthetic-warning-0"));assert.ok(bundle.regionalPackFacts[0]!.flags.includes("synthetic-warning-1"));
 const demands=[{assignmentId:"p1",recipeId:"a",recipeSha256:"e".repeat(64),ingredientId:"food-a",preparedState:"ready-to-use",baseUnit:"g",amount:amount(100)},{assignmentId:"p2",recipeId:"b",recipeSha256:"e".repeat(64),ingredientId:"food-b",preparedState:"dry",baseUnit:"g",amount:amount(200)}];
 const prepared=prepareReferencePurchaseRequirements(demands,bundle.correspondences);assert.equal(prepared.outcome,"prepared");if(prepared.outcome!=="prepared")throw Error("Expected aggregate");assert.equal(prepared.requirements.length,1);
 const fact=bundle.regionalPackFacts[0]!,q=quoteRegionalEstimates({region:"South",storeIds:["synthetic-store"],budgetCents:1000,asOfDate:"2026-10-19"},prepared.requirements,[{skuId:fact.skuId,unit:"g",formDigest:fact.formDigest,quantity:{numerator:100,denominator:1}}],bundle.regionalPackFacts);
 assert.equal(q.outcome,"quoted");if(q.outcome==="quoted"){assert.equal(q.uniqueBuyItemCount,1);assert.equal(q.rows[0]!.packCount,1);assert.deepEqual(q.rows[0]!.ownedUsed,amount(100));assert.deepEqual(q.rows[0]!.toBuy,amount(200));assert.deepEqual(q.rows[0]!.purchasedLeftover,amount(300));}
});

test("unknown repeated or unavailable family bundles return no partial facts",()=>{
 const {registry}=ready();for(const familyIds of [["family-0","family-0"],[]])assert.equal(registry.quantityForFamilies({familyIds}).outcome,"error");
 const missing=registry.forFamilies({familyIds:["family-0","missing"],region:"South",asOfDate:"2026-10-19"});assert.equal(missing.outcome,"held");if(missing.outcome==="held")assert.deepEqual(missing.regionalPackFacts,[]);
});

test("mismatched package membership source form record or hidden yield cannot be declared equivalent",()=>{
 const changes=[(m:ReturnType<typeof fixture>["manifest"])=>{m.purchaseGroups[0]!.anchorFamilyId="missing";},(m:ReturnType<typeof fixture>["manifest"])=>{m.purchaseGroups[0]!.memberFamilyIds=["family-0"];},(m:ReturnType<typeof fixture>["manifest"])=>{m.families[1]!.purchase.unit="ml";},(m:ReturnType<typeof fixture>["manifest"])=>{m.families[1]!.recordIds=[11];},(m:ReturnType<typeof fixture>["manifest"])=>{m.purchaseGroups[0]!.memberForms[1]!.exactForm={...m.purchaseGroups[0]!.memberForms[1]!.exactForm,state:"cooked"};},(m:ReturnType<typeof fixture>["manifest"])=>{m.purchaseGroups[0]!.scope="cooked-yield";},(m:ReturnType<typeof fixture>["manifest"])=>{m.families[1]!.priceReviews=[...m.families[0]!.priceReviews];}];
 for(const change of changes){const f=fixture(),m=structuredClone(f.manifest);change(m);assert.equal(createReviewedPublicPackRegistry(f.sources,json(m),f.config(m)).outcome,"error");}
});

test("synthetic equivalence evidence cannot promote real-looking package claims to a real price basis",()=>{
 const f=fixture();f.manifest.claims.forEach(c=>{c.evidenceLevel="primary-source-web-extract";});
 const registry=f.bind();assert.equal(registry.outcome,"ready");if(registry.outcome!=="ready")throw Error("Expected synthetic review kept synthetic");
 const result=registry.forPlanning({familyId:"family-1",region:"South",asOfDate:"2026-10-19"});assert.equal(result.outcome,"prepared");if(result.outcome==="prepared")assert.equal(result.regionalPackFacts[0]!.basis,"synthetic-test-only");
});

test("a group review cannot grant price availability before that equivalence was reviewed",()=>{
 const f=fixture();f.manifest.purchaseGroups[0]!.reviewedOn="2026-10-20";
 assert.deepEqual(f.bind(),{outcome:"error",code:"invalid_reviewed_pack_evidence"});
});

test("group/member/claim ordering and later price-only reviews cannot relabel owned-food quantity proof",()=>{
 const f=fixture(),before=f.bind();assert.equal(before.outcome,"ready");if(before.outcome!=="ready")throw Error("Expected group");
 const m=structuredClone(f.manifest);m.families.reverse();m.claims.reverse();m.purchaseGroups[0]!.memberFamilyIds.reverse();m.purchaseGroups[0]!.memberForms.reverse();
 const reordered=createReviewedPublicPackRegistry(f.sources,json(m),f.config(m));assert.equal(reordered.outcome,"ready");if(reordered.outcome!=="ready")throw Error("Expected reordered group");
 const query={familyIds:["family-1","family-0"],region:"South",asOfDate:"2026-10-19"};assert.deepEqual(reordered.forFamilies(query),before.forFamilies(query));
 const unpriced=structuredClone(f.manifest);unpriced.families[0]!.priceReviews=[];const prior=createReviewedPublicPackRegistry(f.sources,json(unpriced),f.config(unpriced));assert.equal(prior.outcome,"ready");if(prior.outcome!=="ready")throw Error("Expected unpriced quantity");
 assert.deepEqual(prior.quantityForFamilies({familyIds:["family-0","family-1"]}),before.quantityForFamilies({familyIds:["family-1","family-0"]}));
 assert.equal(prior.forFamilies(query).outcome,"held");
});

test("wrong package provenance source holds or excessive combined warnings refuse rather than dilute review",()=>{
 for(const edit of [(m:ReturnType<typeof fixture>["manifest"])=>{m.claims[1]!.sourceSha256="9".repeat(64);},(m:ReturnType<typeof fixture>["manifest"])=>{const p=m.claims[1]!;if("nominalQuantity" in p)p.nominalQuantity=amount(600);},(m:ReturnType<typeof fixture>["manifest"])=>{m.purchaseGroups[0]!.reviewedOn="2026-10-18";}]){const f=fixture(),m=structuredClone(f.manifest);edit(m);assert.equal(createReviewedPublicPackRegistry(f.sources,json(m),f.config(m)).outcome,"error");}
 for(const hold of [true,false]){const f=fixture(),matches=JSON.parse(f.sources.matches.toString());if(hold)matches.matches["b".repeat(64)].holds=["source-review-needed"];else for(const [i,row]of Object.values(matches.matches).entries())(row as {flags:string[]}).flags=Array.from({length:26},(_,n)=>"different-warning-"+i+"-"+n);f.sources.matches=json(matches);assert.equal(f.bind().outcome,"error");}
});

test("mixed-source gram aggregation and one pantry deduction hold across a bounded domain",()=>{
 const {registry}=ready(),bundle=registry.forFamilies({familyIds:["family-0","family-1"],region:"South",asOfDate:"2026-10-19"});assert.equal(bundle.outcome,"prepared");if(bundle.outcome!=="prepared")throw Error("Expected bundle");
 const fact=bundle.regionalPackFacts[0]!;
 for(let n=0;n<=50;n++)for(const denominator of [1,3,7]){
  const demands=[{assignmentId:"first",recipeId:"a",recipeSha256:"e".repeat(64),ingredientId:"food-a",preparedState:"ready-to-use",baseUnit:"g",amount:amount(n*25,denominator)},{assignmentId:"second",recipeId:"b",recipeSha256:"e".repeat(64),ingredientId:"food-b",preparedState:"dry",baseUnit:"g",amount:amount(n*50,denominator)}];
  const p=prepareReferencePurchaseRequirements(demands,bundle.correspondences);assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected aggregate");
  const q=quoteRegionalEstimates({region:"South",storeIds:["synthetic"],budgetCents:100000,asOfDate:"2026-10-19"},p.requirements,[{skuId:fact.skuId,unit:"g",formDigest:fact.formDigest,quantity:{numerator:100,denominator:1}}],bundle.regionalPackFacts);assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected bounded quote");
  const shortage=Math.max(n*75-denominator*100,0),packs=Math.ceil(shortage/(denominator*500));assert.deepEqual(q.estimatedTotalCents,{min:packs*275,max:packs*276});assert.equal(q.uniqueBuyItemCount,packs>0?1:0);
  if(n){const row=q.rows[0]!;assert.equal(row.packCount,packs);assert.equal(BigInt(row.purchasedLeftover.numerator)*BigInt(denominator),BigInt(packs*500*denominator-shortage)*BigInt(row.purchasedLeftover.denominator));}
 }
});

test("group query getters and caller mutation cannot alter a constructed canonical bundle",()=>{
 const {registry,manifest,sources}=ready(),query={familyIds:["family-0","family-1"],region:"South",asOfDate:"2026-10-19"},before=registry.forFamilies(query);
 manifest.purchaseGroups[0]!.anchorFamilyId="family-1";sources.matches[0]^=1;assert.deepEqual(registry.forFamilies(query),before);assert.equal(Object.isFrozen(manifest),false);
 let reads=0;const hostile=Object.defineProperty({...query},"familyIds",{enumerable:true,get(){reads++;throw Error("Do not invoke");}});assert.equal(registry.forFamilies(hostile).outcome,"error");assert.equal(reads,0);
});

test("reviewed name-only aliases with the same consumption key produce one unambiguous correspondence",()=>{
 const f=fixture(),rows=f.sources.catalog.toString().trimEnd().split(/\r?\n/).map(x=>JSON.parse(x)),r=rows[1]!;
 r.recipe.ingredients[0]={...r.recipe.ingredients[0],id:"food-a",name:"Synthetic name alias",state:"ready-to-use"};r.recipe.steps[0].allocations[0].id="food-a";
 const hash=sha(JSON.stringify(canonicalReferenceData(r.recipe)));r.recipe_sha256=hash;r.nutrition.source_refresh.exact_recipe_body_sha256=hash;r.nutrition.source_refresh.recipe_sha256_unchanged=hash;f.sources.catalog=Buffer.from(rows.map(x=>JSON.stringify(x)).join("\n")+"\n");
 const form={id:"food-a",name:"Synthetic name alias",state:"ready-to-use",unit:"g"};f.manifest.catalogSha256=sha(f.sources.catalog);f.manifest.families[1]!.exactForm=form;f.manifest.purchaseGroups[0]!.memberForms[1]!.exactForm=form;
 const matches=JSON.parse(f.sources.matches.toString());matches.matches["b".repeat(64)].exact_form=form;f.sources.matches=json(matches);
 const registry=f.bind();assert.equal(registry.outcome,"ready");if(registry.outcome!=="ready")throw Error("Expected separately reviewed exact source names");
 const q=registry.quantityForFamilies({familyIds:["family-0","family-1"]});assert.equal(q.outcome,"prepared");if(q.outcome!=="prepared")throw Error("Expected canonical mapping");assert.equal(q.correspondences.length,1);assert.equal(q.pantryPurchaseBindings.length,1);
 const demand=[{assignmentId:"one",recipeId:"a",recipeSha256:"e".repeat(64),ingredientId:"food-a",preparedState:"ready-to-use",baseUnit:"g",amount:amount(300)}];assert.equal(prepareReferencePurchaseRequirements(demand,q.correspondences).outcome,"prepared");
});
