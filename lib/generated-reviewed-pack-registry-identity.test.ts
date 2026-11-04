import test from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {setup} from "./generated-joined-plan.test-support.ts";
import {createReviewedPublicPackRegistry} from "./generated-reviewed-pack-registry.ts";
import {prepareReferencePurchaseRequirements} from "./generated-plan-quote.ts";
import {quoteRegionalEstimates} from "./generated-regional-quote.ts";

const sha=(v:string|Uint8Array)=>createHash("sha256").update(v).digest("hex");
const json=(v:unknown)=>Buffer.from(JSON.stringify(v));
const amount=(n:number)=>({numerator:String(n),denominator:"1"});
const context={region:"South",asOfDate:"2026-10-19"};
function fixture(familyIds=["family","family:a"],reviewIds=["a:b","b"]){
 const {bytes,rows}=setup(),signatures=["1".repeat(64),"2".repeat(64)];
 const forms=rows.map(r=>{const i=r.recipe.ingredients[0]!;return{id:i.id,name:i.name,state:i.state,unit:i.unit};});
 const matches=json({matches:Object.fromEntries(signatures.map((s,i)=>[s,{exact_form:forms[i],status:"conditional-reference",record_ids:[10+i],flags:[],holds:[]}]))});
 const records=json(Object.fromEntries([10,11].map(n=>[String(n),{fdc_id:n,description:"Fictional identity-test food "+n,raw_food_row_sha256:"3".repeat(64),portions:[]}])));
 const point={series_id:"APU0300701312",area_code:"0300",item_code:"701312",region:"South",currency:"USD",source_kind:"bls-average-retail-price",product:"Synthetic unit-price reference",period:"2026-09",unit:"lb",unit_amount:"1",value:"2.500",source_ids:["point"]};
 const snapshot=(observations:unknown[])=>json({schema:"wisedinner-bls-average-price-v1",source_kind:"bls-average-retail-price",currency:"USD",as_of:"2026-10-14",status:"partial-observations",observations,sources:[{id:"point",sha256:"4".repeat(64)}]});
 const sources={catalog:bytes,matches,records,staples:snapshot([point]),produce:snapshot([])};
 const claims=forms.flatMap((_,i)=>{
  const shared={ingredientSignature:signatures[i],sourceUrl:"https://example.invalid/identity-test-only",sourceSha256:"5".repeat(64),reviewedOn:"2026-10-19",evidenceLevel:"synthetic-test-only",description:"Fictional identity test, not food/market/source truth"};
  return[{...shared,id:"package-"+i,kind:"package-reference",purchaseState:"raw",unit:"g",nominalQuantity:amount(500)},{...shared,id:"category-"+i,kind:"price-category-reference",product:point.product,priceScope:"conditional-category-unit-model"}];
 });
 const families=forms.map((exactForm,i)=>({id:familyIds[i]!,ingredientSignature:signatures[i]!,exactForm,recordIds:[10+i],purchase:{skuId:"synthetic-buy-"+i,state:"raw",unit:"g",category:"pantry",perishable:false},quantityBasis:{kind:"same-state-identity"},packageClaimId:"package-"+i,priceReviews:[{id:reviewIds[i]!,region:"South",seriesId:point.series_id,product:point.product,period:"2026-09",categoryClaimId:"category-"+i,reviewEffectiveFrom:"2026-10-19",usableThrough:"2026-10-19"}]}));
 const manifest={schema:"wd-reviewed-public-pack-manifest-v1",catalogSha256:sha(bytes),claims,families};
 function bind(m=manifest){
  const config={catalog:{sha256:sha(bytes),recordCount:rows.length},matches:{sha256:sha(matches)},records:{sha256:sha(records)},staples:{sha256:sha(sources.staples),observations:1},produce:{sha256:sha(sources.produce),observations:0},manifestSha256:sha(json(m))};
  const registry=createReviewedPublicPackRegistry(sources,json(m),config);assert.equal(registry.outcome,"ready");
  if(registry.outcome!=="ready")throw Error("Expected reviewed synthetic families");return registry;
 }
 const demands=rows.map((r,i)=>({assignmentId:"synthetic-"+i,recipeId:r.id,recipeSha256:r.recipe_sha256,ingredientId:forms[i]!.id,preparedState:"raw",baseUnit:"g",amount:amount(100*(i+1))}));
 return{bind,manifest,familyIds,reviewIds,demands};
}
function bundle(f:ReturnType<typeof fixture>){
 const registry=f.bind(),result=registry.forFamilies({familyIds:f.familyIds,...context});
 assert.equal(result.outcome,"prepared");if(result.outcome!=="prepared")throw Error("Accepted families must compose");
 const requirements=prepareReferencePurchaseRequirements(f.demands,result.correspondences);
 assert.equal(requirements.outcome,"prepared");if(requirements.outcome!=="prepared")throw Error("Actual joined preparation must succeed");
 const quote=quoteRegionalEstimates({...context,storeIds:["synthetic-store"],budgetCents:1000},requirements.requirements,[],result.regionalPackFacts);
 assert.equal(quote.outcome,"quoted");if(quote.outcome!=="quoted")throw Error("Actual combined quote must succeed");
 assert.deepEqual(quote.estimatedTotalCents,{min:550,max:552});assert.equal(quote.uniqueBuyItemCount,2);
 return{registry,result,quote,requirements};
}

test("separately valid colon-containing family/review IDs compose into the actual two-item basket",()=>{
 const f=fixture(),r=f.bind();
 const separate=f.familyIds.map(familyId=>r.forPlanning({familyId,...context}));
 assert.ok(separate.every(x=>x.outcome==="prepared"));
 const {result}=bundle(f);assert.equal(new Set(result.regionalPackFacts.map(x=>x.id)).size,2);
});

test("bounded adversarial tuple domain preserves distinct IDs and independent whole-pack totals",()=>{
 const prefixes=["family","family:a","x|y","x,y","[x]","é","菜","🙂"],suffixes=["a","a:b","|","comma,colon:"];
 let cases=0;
 for(const prefix of prefixes)for(const suffix of suffixes){
  const f=fixture([prefix,prefix+":"+suffix],[suffix+":b","b"]),{result}=bundle(f);
  assert.equal(result.regionalPackFacts.length,2);
  for(let i=0;i<2;i++){
   const p=f.bind().forPlanning({familyId:f.familyIds[i],...context});
   assert.equal(p.outcome,"prepared");if(p.outcome!=="prepared")throw Error("Expected individual fact");
   const expected="wd-rpr-price-v1:"+sha(JSON.stringify(["wd-reviewed-pack-price-id-v1",f.familyIds[i],f.reviewIds[i]]));
   assert.equal(p.regionalPackFacts[0]!.id,expected);assert.ok(expected.length<256);
  }cases++;
 }
 assert.equal(cases,32);
});

test("family/claim ordering changes neither price identities/proof nor quantity bindings",()=>{
 const f=fixture(),r=f.bind(),m=structuredClone(f.manifest);m.families.reverse();m.claims.reverse();const other=f.bind(m);
 assert.deepEqual(other.forFamilies({familyIds:[...f.familyIds].reverse(),...context}),r.forFamilies({familyIds:f.familyIds,...context}));
});

test("price-only review changes preserve exact prior pantry quantity identities and source proof",()=>{
 const f=fixture(),before=f.bind(),m=structuredClone(f.manifest);
 m.families[0]!.priceReviews[0]!.id="different:price:review";
 const after=f.bind(m);
 for(const familyId of f.familyIds){
  const q=before.quantityForFamily({familyId});assert.equal(q.outcome,"prepared");
  if(q.outcome!=="prepared")throw Error("Expected quantity");
  assert.equal(q.correspondences[0]!.id,familyId+":quantity");
  assert.equal(q.pantryPurchaseBindings[0]!.id,familyId+":owned");
  assert.deepEqual(after.quantityForFamily({familyId}),q);
 }
 const a=before.forPlanning({familyId:f.familyIds[0],...context}),b=after.forPlanning({familyId:f.familyIds[0],...context});
 assert.equal(a.outcome,"prepared");assert.equal(b.outcome,"prepared");
 if(a.outcome!=="prepared"||b.outcome!=="prepared")throw Error("Expected price");
 assert.notEqual(a.regionalPackFacts[0]!.id,b.regionalPackFacts[0]!.id);
 assert.notEqual(a.regionalPackFacts[0]!.sourceSha256,b.regionalPackFacts[0]!.sourceSha256);
});

test("maximum accepted family/review IDs produce bounded price IDs without truncating inputs",()=>{
 const f=fixture(["f".repeat(120),"g".repeat(120)],["r".repeat(120),"s".repeat(120)]);
 const {result}=bundle(f);
 assert.ok(result.regionalPackFacts.every(x=>x.id.length===80));
});

test("basket duplicate price-ID rejection remains intact after producer framing",()=>{
 const f=fixture(),{result,requirements}=bundle(f),a=result.regionalPackFacts[0]!,b=result.regionalPackFacts[1]!;
 assert.deepEqual(quoteRegionalEstimates({...context,storeIds:["synthetic-store"],budgetCents:1000},requirements.requirements,[],[a,{...b,id:a.id}]),{outcome:"error",code:"invalid_regional_quote_input"});
});
