// Fictional prices and declared independent units. Never source-supported pricing.
import {hash} from "./price-evidence.ts";
import {fitModel,sealRecord,calibrate,type Recorded,type SourcePolicy,type Cell,type FitSample,type QuoteScope,type Model,type BasketObservation,type Ratio} from "./store-estimate-model.ts";
import {ratio,decimalQuantity,multiply,strategyDigest,type PackFact,type Requirement,type QuoteRequest} from "./store-estimates.ts";
export const fixturePolicy={asOf:"2026-10-05T18:00:00Z",maxAgeMs:7*86400000};
export const fixtureStores=[{id:"fixture-store-a",region:"fixture-region"},{id:"fixture-store-b",region:"fixture-region"},{id:"fixture-store-c",region:"fixture-region"}];
export const fixtureStrategy={revision:"fixture-whole-pack-v1",description:"Bounded reviewed catalog; full five-day week, all food rules; exact purchased basis; partial physical pantry; single-store or explicit split; no approved reroll shopping rule",maxOffersPerIngredient:6,maxPacksPerOffer:100,maxSearchNodes:20000,perishableUseFloor:{numerator:2,denominator:3},priceBasis:"raw",allowance:"one full-basket relative-error order statistic",charges:"explicit; per-store charged only if visited",eligibility:"explicit membership/promotion IDs",samplePolicy:"Synthetic physical units only; no independence or coverage guarantee"};
export function evidence(id:string,at="2026-10-04T12:00:00Z"){return {sourceId:"fixture-source",kind:"fixture" as const,reference:`fixture:${id}`,observedAt:at,reviewedDigest:""};}
export function sourceFor(rows:Recorded[],cells:Cell[]):SourcePolicy[]{return [{id:"fixture-source",kind:"fixture",uses:["storage","estimate","compare","derive"],cells,
  records:rows.map(r=>({id:r.id,digest:r.evidence.reviewedDigest,observedAt:r.evidence.observedAt,reference:r.evidence.reference}))}];}
export function fixtureModel(categories:string[]){
  const cells=fixtureStores.flatMap(s=>categories.map(category=>({storeId:s.id,region:s.region,category,channel:"in-store" as const})));
  const samples:FitSample[]=cells.flatMap((cell,i)=>[0,1].map(j=>sealRecord({id:`fit-${i}-${j}`,evidence:evidence(`fit-${i}-${j}`,"2026-09-30T12:00:00Z"),independentUnit:`fit-unit-${i}-${j}`,cell,productId:`fixture-product-${i}`,baselinePackDigest:hash([i,"same-physical-pack"]),actualPackDigest:hash([i,"same-physical-pack"]),baselineObservedAt:"2026-09-29T12:00:00Z",baselineCents:100,actualCents:110+i,priceBasis:"raw" as const})));
  return fitModel("fixture-model-v1",samples,sourceFor(samples,cells),{...fixturePolicy,asOf:"2026-10-01T12:00:00Z",minSamples:2});
}
export function fixtureRequest(model:Model,intent:QuoteRequest["intent"]="alternatives",storeIds=[fixtureStores[0].id],budgetCents=6000):QuoteRequest{
  return {storeIds,region:"fixture-region",channel:"in-store",intent,selectionRevision:"reviewed-bounded-96-v1",strategyPolicyDigest:strategyDigest({charges:[],membershipIds:[],promotionIds:[]}),modelDigest:model.digest,budgetCents,calibrationPins:[],charges:[],membershipIds:[],promotionIds:[],policy:fixturePolicy};
}
export function fixtureFacts(requirements:Requirement[],packSizes:Record<string,number|Ratio>={},priceShift=0):PackFact[]{
  return requirements.flatMap((req,i)=>fixtureStores.flatMap((s,j)=>[1,2].map(size=>{
    const id=`fact-${req.skuId}-${j}-${size}`;
    const original=packSizes[req.skuId]??500,packQuantity=multiply(typeof original==="number"?decimalQuantity(original):original,ratio(size));
    return sealRecord({id,evidence:evidence(id,"2026-10-01T18:00:00Z"),cell:{storeId:s.id,region:s.region,category:req.category,channel:"in-store" as const},skuId:req.skuId,
      productId:`fixture-${req.skuId}-${size}`,offerId:`fixture-offer-${req.skuId}-${j}-${size}`,formDigest:req.formDigest,unit:req.unit,
      packQuantity,packLabel:`FICTIONAL ${packQuantity.numerator}/${packQuantity.denominator} ${req.unit} pack`,packReviewRevision:"fixture-pack-v1",packReviewedAt:"2026-10-01T16:00:00Z",availablePacks:100,
      mode:"exact" as const,priceBasis:"raw" as const,rawCents:100+(i%3)*20+size*50+(j===i%3?0:20)+priceShift,membershipId:null,promotionId:null});
  })));
}
export function fixtureScope(request:QuoteRequest,requirements:Requirement[],storeId:string|null):QuoteScope{return {storeIds:request.storeIds,quotedStoreId:storeId,region:request.region,channel:request.channel,categories:[...new Set(requirements.map(r=>r.category))].sort(),strategy:storeId===null?"split-store":"single-store",selectionRevision:request.selectionRevision,strategyPolicyDigest:request.strategyPolicyDigest,modelDigest:request.modelDigest};}
export function fixtureCalibration(model:Model,scope:QuoteScope,rawPredictions:number[],namespace:string){
  // Caller supplies predictions replayed from complete, frozen-model raw baskets, never item-average errors.
  const rows:BasketObservation[]=rawPredictions.map((raw,i)=>sealRecord({id:`cal-${namespace}-${i}`,evidence:evidence(`cal-${namespace}-${i}`,"2026-10-02T12:00:00Z"),independentUnit:`cal-unit-${namespace}-${i}`,scope,rawPredictionCents:raw,actualCents:raw+Math.ceil(raw*(i+1)/100),basketDigest:hash([namespace,i,"synthetic-physical-basket"]),priceBasis:"raw" as const}));
  const cells=scope.storeIds.flatMap(storeId=>scope.categories.map(category=>({storeId,region:scope.region,channel:scope.channel,category})));
  return calibrate(model,scope,rows,sourceFor(rows,cells),{...fixturePolicy,asOf:"2026-10-02T18:00:00Z",minSamples:9,coverage:ratio(9,10)});
}
