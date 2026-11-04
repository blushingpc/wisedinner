import test from "node:test";
import assert from "node:assert/strict";
import { quoteRegionalEstimates } from "./generated-regional-quote.ts";
const amount=(n:number,d=1)=>({numerator:String(n),denominator:String(d)});
const request={region:"South",storeIds:["unchanged-store"],budgetCents:1000,asOfDate:"2026-10-19"};
const need=[{skuId:"a",category:"pantry",unit:"g",formDigest:"a".repeat(64),perishable:false,purchasedNeed:{numerator:150,denominator:1}}];
const regional={id:"regional",skuId:"a",unit:"g",formDigest:"a".repeat(64),region:"South",packQuantity:amount(100),packPriceCents:{min:200,max:210},currency:"USD",observedOn:"2026-10-18",usableThrough:"2026-10-19",sourceSha256:"1".repeat(64),basis:"modeled-regional-average",flags:["synthetic-only"]};
function reference(kind:"national-reference"|"manufacturer-reference"="national-reference"){
 return {id:kind,skuId:"a",unit:"g",formDigest:"a".repeat(64),packQuantity:amount(100),packPriceCents:{min:100,max:110},currency:"USD",sourceSha256:"2".repeat(64),sourceUrl:"https://example.invalid/synthetic-only",kind,
 sourceBasis:kind==="national-reference"?{geography:"US-national",observationPeriod:"2026-09",observedOn:null,publishedOn:null,knownAvailableBy:"2026-10-14"}:{geography:"manufacturer-reference-not-regional",manufacturer:"Synthetic manufacturer only",capturedOn:"2026-10-19",observedOn:null,publishedOn:null},
 reviewEffectiveFrom:"2026-10-19",usableThrough:"2026-10-19",flags:["synthetic-only","not-market-uncertainty"]};
}
const policy=(facts:unknown[])=>({policy:"wd-price-reference-fallback-v1",facts});
test("explicit national/manufacturer estimates never masquerade as regional averages",()=>{
 assert.equal(quoteRegionalEstimates(request,need,[],[]).outcome,"held");
 for(const kind of ["national-reference","manufacturer-reference"] as const){
  const ref=reference(kind), q=quoteRegionalEstimates(request,need,[],[],policy([ref]));
  assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected explicit reference estimate");
  assert.equal(q.scope,"mixed-geography-reference-typical-whole-pack-ingredient-estimate");
  assert.deepEqual(q.estimatedTotalCents,{min:200,max:220});assert.equal(q.uniqueBuyItemCount,1);
  assert.equal(q.referenceEstimates?.policy,"wd-price-reference-fallback-v1");
  assert.equal(q.referenceEstimates?.sources[0]?.kind,kind);
  assert.equal(q.factPins[0]!.basis,kind);assert.equal(q.rows[0]!.packCount,2);
  assert.equal(q.rows[0]!.flags.includes("reference-not-regional-average"),true);
 }
});
test("current regional wins and default regional result stays byte-identical",()=>{
 const old=quoteRegionalEstimates(request,need,[],[regional]);
 const withRefs=quoteRegionalEstimates(request,need,[],[regional],policy([reference()]));
 assert.deepEqual(withRefs,old);
 assert.deepEqual(quoteRegionalEstimates(request,need,[],[regional,{...regional,id:"duplicate"}],policy([reference()])),{outcome:"held",code:"regional_pack_fact_ambiguous"});
});
test("source ambiguity malformed geography invalid policy and unknown quantity remain held or error",()=>{
 assert.equal(quoteRegionalEstimates(request,need,[],[],policy([reference(),reference("manufacturer-reference")])).outcome,"held");
 for(const ref of [{...reference(),region:"South"},{...reference(),sourceBasis:{...reference().sourceBasis,geography:"South"}},{...reference(),reviewEffectiveFrom:"2026-10-13"},{...reference(),sourceUrl:"https://example.invalid/?token=not-public-source"}]){
  assert.equal(quoteRegionalEstimates(request,need,[],[],policy([ref])).outcome,"error");
 }
 assert.equal(quoteRegionalEstimates(request,need,[],[],{policy:"yes",facts:[reference()]}).outcome,"error");
 assert.equal(quoteRegionalEstimates(request,[{...need[0],unit:"each"}],[],[],policy([reference()])).outcome,"held");
 const unknown={...need[0],purchasedNeed:null};assert.equal(quoteRegionalEstimates(request,[unknown],[],[],policy([reference()])).outcome,"error");
});
test("owned stock remains independent from price absence and explicit estimates do not invent missing yield",()=>{
 const owned=[{skuId:"a",unit:"g",formDigest:"a".repeat(64),quantity:{numerator:150,denominator:1}}];
 const covered=quoteRegionalEstimates({...request,budgetCents:0},need,owned,[],policy([]));assert.equal(covered.outcome,"quoted");if(covered.outcome==="quoted"){assert.deepEqual(covered.estimatedTotalCents,{min:0,max:0});assert.equal(covered.referenceEstimates,undefined);}
 assert.equal(quoteRegionalEstimates(request,need,[{...owned[0],quantity:{numerator:149,denominator:1}}],[],policy([])).outcome,"held");
});

test("reference-only exact arithmetic conserves independent pantry and whole packs across a bounded domain",()=>{
 for(let n=0;n<=160;n++)for(const d of [1,2,7])for(const owned of [0,100,500]){
  const q=quoteRegionalEstimates({...request,budgetCents:1000000},[{...need[0],purchasedNeed:{numerator:n*25,denominator:d}}],[{skuId:"a",unit:"g",formDigest:"a".repeat(64),quantity:{numerator:owned,denominator:1}}],[],policy([reference()]));
  assert.equal(q.outcome,"quoted");if(q.outcome!=="quoted")throw Error("Expected bounded reference quote");
  const shortage=Math.max(n*25-owned*d,0),packs=Math.ceil(shortage/(d*100));
  assert.deepEqual(q.estimatedTotalCents,{min:packs*100,max:packs*110});assert.equal(q.uniqueBuyItemCount,packs>0?1:0);
  const row=q.rows[0]!;assert.equal(row.packCount,packs);
  assert.equal(BigInt(row.purchasedLeftover.numerator)*BigInt(d),BigInt(packs*100*d-shortage)*BigInt(row.purchasedLeftover.denominator));
  assert.equal(q.referenceEstimates!==undefined,packs>0);
 }
});

test("expired regional data may use a current reference but invalid/ambiguous sources and stale references do not",()=>{
 const expired={...regional,observedOn:"2026-10-17",usableThrough:"2026-10-18"};
 const fallback=quoteRegionalEstimates(request,need,[],[expired],policy([reference()]));assert.equal(fallback.outcome,"quoted");
 if(fallback.outcome==="quoted")assert.equal(fallback.factPins[0]!.basis,"national-reference");
 assert.equal(quoteRegionalEstimates({...request,asOfDate:"2026-10-20"},need,[],[],policy([reference()])).outcome,"held");
 let reads=0;const hostile=Object.defineProperty(reference(),"sourceBasis",{enumerable:true,get(){reads++;throw Error("Do not invoke");}});
 assert.equal(quoteRegionalEstimates(request,need,[],[],policy([hostile])).outcome,"error");assert.equal(reads,0);
 const ref=reference(),q=quoteRegionalEstimates(request,need,[],[],policy([ref]));ref.packPriceCents.max=900;ref.flags.push("caller change");
 if(q.outcome!=="quoted")throw Error("Expected snapshot result");assert.deepEqual(q.estimatedTotalCents,{min:200,max:220});assert.equal(Object.isFrozen(ref),false);assert.ok(Object.isFrozen(q.referenceEstimates!.sources[0]!.sourceBasis));
 const tiny={...reference(),packQuantity:amount(1,1000000)};const huge=[{...need[0],purchasedNeed:{numerator:Number.MAX_SAFE_INTEGER,denominator:1}}];
 assert.deepEqual(quoteRegionalEstimates(request,huge,[],[],policy([tiny])),{outcome:"held",code:"regional_quote_capacity_exceeded"});
});
