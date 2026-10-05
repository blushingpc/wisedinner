// Private, pure arithmetic. No routes, retailer clients or legacy buffered price imports.
import {hash} from "./price-evidence.ts";
import {addCents,ceilRatio,cents,textId,cellKey,verifyRecord,verifyModel,rawModelPrice,verifyCalibration,verifyPhaseSeparation,scopeKey,timestamp,
  type Ratio,type Cell,type Recorded,type Model,type Calibration,type SourcePolicy,type EvidencePolicy,type QuoteScope,type Channel} from "./store-estimate-model.ts";
export type Requirement={skuId:string;category:string;unit:"g"|"ml"|"each";formDigest:string;purchasedNeed:Ratio;perishable:boolean};
export type PantryAmount={skuId:string;unit:Requirement["unit"];formDigest:string;quantity:Ratio};
export type PhysicalStore={id:string;region:string};
export type PackFact=Recorded&{cell:Cell;skuId:string;productId:string;offerId:string;formDigest:string;unit:Requirement["unit"];
  packQuantity:Ratio;packLabel:string;packReviewRevision:string;packReviewedAt:string;availablePacks:number;
  mode:"exact"|"baseline";priceBasis:"raw";rawCents:number;membershipId:string|null;promotionId:string|null};
export type QuoteRequest={storeIds:string[];region:string;channel:Channel;intent:"alternatives"|"split";
  selectionRevision:string;strategyPolicyDigest:string;modelDigest:string;budgetCents:number;
  calibrationPins:{scopeDigest:string;digest:string}[];
  charges:{id:string;cents:number;storeId:string|null}[];membershipIds:string[];promotionIds:string[];policy:EvidencePolicy};
export type Line={skuId:string;required:Ratio;ownedUsed:Ratio;ownedCarryover:Ratio;purchased:Ratio;newCarryover:Ratio;
  rawCents:number;assignments:{storeId:string;factId:string;productId:string;offerId:string;packLabel:string;packQuantity:Ratio;packs:number;packCents:number;mode:PackFact["mode"]}[]};
export type BasketQuote={scope:QuoteScope;scopeDigest:string;fixture:boolean;status:"fixture-only"|"unverified-source"|"unsupported";
  lines:Line[];reasons:string[];rawCents:number|null;allowanceCents:number|null;chargeCents:number|null;totalCents:number|null;withinBudget:boolean|null;modelDigest:string;calibrationDigest:string|null};
// Exact rational quantities avoid epsilon pack rounding. Overflow fails closed at the boundary.
export function ratio(numerator:number,denominator=1):Ratio{cents(numerator);cents(denominator,true);return {numerator,denominator};}
export function decimalQuantity(value:number):Ratio{
  if(!Number.isFinite(value)||value<0)throw Error("Invalid physical quantity");
  const [mantissa,exponent="0"]=String(value).split("e"),[whole,fraction=""]=mantissa.split(".");
  const scale=fraction.length-Number(exponent),n=BigInt(whole+fraction);
  return scale>=0?fromBig(n,BigInt(10)**BigInt(scale)):fromBig(n*BigInt(10)**BigInt(-scale),BigInt(1));
}
function gcd(a:bigint,b:bigint):bigint{while(b){const t=a%b;a=b;b=t;}return a;}
function fromBig(n:bigint,d:bigint):Ratio{const g=gcd(n,d);return ratio(Number(n/g),Number(d/g));}
function valid(r:Ratio){ratio(r.numerator,r.denominator);}
function compare(a:Ratio,b:Ratio){valid(a);valid(b);const x=BigInt(a.numerator)*BigInt(b.denominator)-BigInt(b.numerator)*BigInt(a.denominator);return x<BigInt(0)?-1:x>BigInt(0)?1:0;}
export function sum(a:Ratio,b:Ratio){valid(a);valid(b);return fromBig(BigInt(a.numerator)*BigInt(b.denominator)+BigInt(b.numerator)*BigInt(a.denominator),BigInt(a.denominator)*BigInt(b.denominator));}
export function multiply(a:Ratio,b:Ratio){valid(a);valid(b);return fromBig(BigInt(a.numerator)*BigInt(b.numerator),BigInt(a.denominator)*BigInt(b.denominator));}
export function divide(a:Ratio,b:Ratio){valid(a);valid(b);if(!b.numerator)throw Error("Zero quantity divisor");return fromBig(BigInt(a.numerator)*BigInt(b.denominator),BigInt(a.denominator)*BigInt(b.numerator));}
function subtract(a:Ratio,b:Ratio){if(compare(a,b)<0)throw Error("Negative quantity");return fromBig(BigInt(a.numerator)*BigInt(b.denominator)-BigInt(b.numerator)*BigInt(a.denominator),BigInt(a.denominator)*BigInt(b.denominator));}
function times(a:Ratio,n:number){return fromBig(BigInt(a.numerator)*BigInt(cents(n)),BigInt(a.denominator));}
function needed(need:Ratio,pack:Ratio){if(!pack.numerator)throw Error("Empty offered pack");const n=BigInt(need.numerator)*BigInt(pack.denominator),d=BigInt(need.denominator)*BigInt(pack.numerator);return cents(Number((n+d-BigInt(1))/d));}
export function formKey(value:unknown){return hash(value);}
export function factPackDigest(f:PackFact){return hash([f.productId,f.offerId,f.formDigest,f.unit,f.packQuantity,f.packLabel,f.packReviewRevision]);}
// Pin implemented strategy semantics plus explicit charge/eligibility policies, not just a caller seal.
export function strategyDigest(r:Pick<QuoteRequest,"charges"|"membershipIds"|"promotionIds">){return hash({algorithm:"whole-pack-exhaustive-v1",maxOffers:6,maxPacks:100,maxNodes:20000,perishableUseFloor:ratio(2,3),pantry:"physical-unprepared-subtract-once",allowance:"one-sided-full-basket-relative-error",charges:r.charges,membershipIds:r.membershipIds,promotionIds:r.promotionIds});}
function scopeFor(r:QuoteRequest,categories:string[],storeId:string|null):QuoteScope{return {storeIds:[...r.storeIds],quotedStoreId:storeId,region:r.region,channel:r.channel,categories:[...categories].sort(),strategy:storeId===null?"split-store":"single-store",selectionRevision:r.selectionRevision,strategyPolicyDigest:r.strategyPolicyDigest,modelDigest:r.modelDigest};}
// Exhaustive combinations of admitted offers, including mixed package sizes. Bound exhaustion is unknown.
function lineFor(req:Requirement,owned:Ratio,facts:PackFact[],m:Model):Line{
  const ownedUsed=compare(owned,req.purchasedNeed)>0?req.purchasedNeed:owned,remaining=subtract(req.purchasedNeed,ownedUsed);
  const base={skuId:req.skuId,required:req.purchasedNeed,ownedUsed,ownedCarryover:subtract(owned,ownedUsed)};
  if(!remaining.numerator)return {...base,purchased:ratio(0),newCarryover:ratio(0),rawCents:0,assignments:[]};
  if(!facts.length||facts.length>6)throw Error("Missing or excessive realizable offers");
  const prices=facts.map(f=>f.mode==="exact"?f.rawCents:rawModelPrice(m,f.cell,f.rawCents));
  const caps=facts.map(f=>Math.min(needed(remaining,f.packQuantity),f.availablePacks));
  if(caps.some(n=>n>100))throw Error("Pack search bound exceeded");
  let visited=0,best:{counts:number[];quantity:Ratio;cost:number}|null=null;
  const walk=(index:number,quantity:Ratio,cost:number,counts:number[])=>{
    if(++visited>20000)throw Error("Pack search bound exceeded");
    if(best&&cost>best.cost)return;
    if(compare(quantity,remaining)>=0){
      // Same unchanged two-thirds use floor as the legacy solver, now on actual purchased packs.
      if(req.perishable&&compare(times(sum(quantity,ownedUsed),2),times(req.purchasedNeed,3))>0)return;
      if(!best||cost<best.cost||(cost===best.cost&&compare(quantity,best.quantity)<0))best={counts:[...counts,...Array(facts.length-index).fill(0)],quantity,cost};
      return;
    }
    if(index===facts.length)return;
    // More preferred/source-earlier packs win otherwise equal ties.
    for(let n=caps[index];n>=0;n--)walk(index+1,sum(quantity,times(facts[index].packQuantity,n)),addCents([cost,ceilRatio(prices[index],ratio(n))]),[...counts,n]);
  };
  walk(0,ratio(0),0,[]);
  if(!best)throw Error("Unavailable packs or perishable carryover limit");
  const chosen=best as {counts:number[];quantity:Ratio;cost:number};
  return {...base,purchased:chosen.quantity,newCarryover:subtract(chosen.quantity,remaining),rawCents:chosen.cost,
    assignments:facts.flatMap((f,i)=>chosen.counts[i]?[{storeId:f.cell.storeId,factId:f.id,productId:f.productId,offerId:f.offerId,packLabel:f.packLabel,packQuantity:f.packQuantity,packs:chosen.counts[i],packCents:prices[i],mode:f.mode}]:[])};
}
export function quoteBaskets(request:QuoteRequest,requirements:Requirement[],pantry:PantryAmount[],stores:PhysicalStore[],facts:PackFact[],sources:SourcePolicy[],model:Model,calibrations:Calibration[]){
  cents(request.budgetCents);textId(request.region);textId(request.selectionRevision);textId(request.strategyPolicyDigest);
  if(request.strategyPolicyDigest!==strategyDigest(request))throw Error("Frozen strategy policy does not match implemented quote semantics");
  if(!["alternatives","split"].includes(request.intent)||request.storeIds.length<1||request.storeIds.length>3||new Set(request.storeIds).size!==request.storeIds.length||new Set(stores.map(s=>s.id)).size!==stores.length||request.storeIds.some(id=>!stores.some(s=>s.id===id&&s.region===request.region)))throw Error("Choose one to three known physical stores in the explicit region");
  if(!["in-store","pickup","delivery"].includes(request.channel))throw Error("Unknown shopping channel");
  if(!requirements.length||requirements.length>79||new Set(requirements.map(r=>r.skuId)).size!==requirements.length||new Set(pantry.map(p=>p.skuId)).size!==pantry.length||pantry.length>79||facts.length>1000||new Set(facts.map(f=>f.id)).size!==facts.length)throw Error("Missing, duplicate or excessive basket input");
  if(new Set(request.charges.map(c=>c.id)).size!==request.charges.length)throw Error("Duplicate charge");
  for(const c of request.charges){textId(c.id);cents(c.cents);if(c.storeId!==null&&!request.storeIds.includes(c.storeId))throw Error("Charge assigned to unchosen store");}
  for(const r of requirements){textId(r.skuId);textId(r.category);textId(r.formDigest);valid(r.purchasedNeed);if(!r.purchasedNeed.numerator||!["g","ml","each"].includes(r.unit)||typeof r.perishable!=="boolean")throw Error("Unknown purchased basis");}
  const owned=new Map<string,Ratio>();
  for(const p of pantry){const r=requirements.find(r=>r.skuId===p.skuId);valid(p.quantity);if(!r||p.unit!==r.unit||p.formDigest!==r.formDigest)throw Error("Unknown or incompatible physical pantry basis");owned.set(p.skuId,p.quantity);}
  verifyModel(model,request.policy);if(request.modelDigest!==model.digest)throw Error("Frozen model revision mismatch");
  if(calibrations.length>4||new Set(calibrations.map(c=>scopeKey(c.scope))).size!==calibrations.length||request.calibrationPins.length>4||new Set(request.calibrationPins.map(p=>p.scopeDigest)).size!==request.calibrationPins.length)throw Error("Duplicate or excessive calibration scope");
  verifyPhaseSeparation(model.samples,calibrations.flatMap(c=>c.rows),[]);
  const categories=[...new Set(requirements.map(r=>r.category))];
  const make=(storeId:string|null):BasketQuote=>{
    const scope=scopeFor(request,categories,storeId),reasons:string[]=[],lines:Line[]=[];
    const relevant=facts.filter(f=>request.storeIds.includes(f.cell.storeId)&&(!storeId||f.cell.storeId===storeId));
    for(const req of requirements)try{
      const compatible=relevant.filter(f=>f.skuId===req.skuId&&f.cell.region===request.region&&f.cell.channel===request.channel);
      const admitted:PackFact[]=[];
      for(const f of compatible){
        verifyRecord(f,sources,request.policy,f.cell);cellKey(f.cell);
        if(f.priceBasis!=="raw"||!["exact","baseline"].includes(f.mode)||f.cell.category!==req.category||f.formDigest!==req.formDigest||f.unit!==req.unit)throw Error("Raw price/form/category/unit review missing");
        cents(f.rawCents,true);cents(f.availablePacks);valid(f.packQuantity);textId(f.productId);textId(f.offerId);textId(f.packLabel);textId(f.packReviewRevision);
        if(!f.packQuantity.numerator||(f.unit==="each"&&f.packQuantity.numerator%f.packQuantity.denominator!==0)||timestamp(f.packReviewedAt)>timestamp(f.evidence.observedAt))throw Error("Pack review missing, fractional piece pack or postdates observation");
        if(f.membershipId!==null&&!request.membershipIds.includes(f.membershipId)||f.promotionId!==null&&!request.promotionIds.includes(f.promotionId)||!f.availablePacks)continue;
        admitted.push(f);
      }
      const exactStores=new Set(admitted.filter(f=>f.mode==="exact").map(f=>f.cell.storeId));
      const chosen=admitted.filter(f=>f.mode==="exact"||!exactStores.has(f.cell.storeId)).sort((a,b)=>request.storeIds.indexOf(a.cell.storeId)-request.storeIds.indexOf(b.cell.storeId));
      lines.push(lineFor(req,owned.get(req.skuId)??ratio(0),chosen,model));
    }catch(e){reasons.push(`${req.skuId}: ${(e as Error).message}`);}
    const rawCents=reasons.length?null:addCents(lines.map(l=>l.rawCents));
    const calibration=calibrations.find(c=>scopeKey(c.scope)===scopeKey(scope));
    let allowanceCents:number|null=null,chargeCents:number|null=null,totalCents:number|null=null;
    if(rawCents!==null)try{
      if(!calibration)throw Error("Matching full-strategy calibration unavailable");
      if(!request.calibrationPins.some(p=>p.scopeDigest===scopeKey(scope)&&p.digest===calibration.digest))throw Error("Frozen calibration revision mismatch");
      verifyCalibration(calibration,model,scope,request.policy);if(!calibration.upperError)throw Error(calibration.reason!);
      allowanceCents=ceilRatio(rawCents,calibration.upperError);
      const usedStores=new Set(lines.flatMap(l=>l.assignments.map(a=>a.storeId)));
      chargeCents=addCents(request.charges.filter(c=>c.storeId===null||usedStores.has(c.storeId)).map(c=>c.cents));
      totalCents=addCents([rawCents,allowanceCents,chargeCents]);
    }catch(e){reasons.push((e as Error).message);}
    const fixture=model.fixture||!!calibration?.fixture||relevant.some(f=>f.evidence.kind==="fixture");
    return {scope,scopeDigest:scopeKey(scope),fixture,status:reasons.length?"unsupported":fixture?"fixture-only":"unverified-source",lines,reasons,rawCents,allowanceCents,chargeCents,totalCents,withinBudget:totalCents===null?null:totalCents<=request.budgetCents,modelDigest:model.digest,calibrationDigest:calibration?.digest??null};
  };
  const alternatives=request.storeIds.map(id=>make(id));
  return {private:true,fixtureOnly:true,requestDigest:hash(request),inputDigest:hash({requirements,pantry,stores,facts,sources}),alternatives,
    split:request.intent==="split"?make(null):null,
    note:"Integrity and declared scope checks do not establish original-source truth, independence or launch-supported prices. Fixture thresholds are test parameters. No legacy uplift or budget reserve is applied."};
}
