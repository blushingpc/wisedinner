// Private arithmetic. Pins prove integrity, never source truth or statistical independence.
import {hash} from "./price-evidence.ts";
export type Channel="in-store"|"pickup"|"delivery";
export type Cell={storeId:string;region:string;category:string;channel:Channel};
export type Ratio={numerator:number;denominator:number};
export type Evidence={sourceId:string;kind:"fixture"|"observed";reference:string;observedAt:string;reviewedDigest:string};
export type Recorded={id:string;evidence:Evidence};
export type SourcePolicy={id:string;kind:"fixture"|"observed";uses:("storage"|"estimate"|"compare"|"derive")[];cells:Cell[];
  records:{id:string;digest:string;observedAt:string;reference:string}[]};
export type EvidencePolicy={asOf:string;maxAgeMs:number};
export type FitPolicy=EvidencePolicy&{minSamples:number};
export type FitSample=Recorded&{independentUnit:string;cell:Cell;productId:string;baselinePackDigest:string;actualPackDigest:string;
  baselineObservedAt:string;baselineCents:number;actualCents:number;priceBasis:"raw"};
export type QuoteScope={storeIds:string[];quotedStoreId:string|null;region:string;channel:Channel;categories:string[];
  strategy:"single-store"|"split-store";selectionRevision:string;strategyPolicyDigest:string;modelDigest:string};
export type BasketObservation=Recorded&{independentUnit:string;scope:QuoteScope;rawPredictionCents:number;actualCents:number;basketDigest:string;priceBasis:"raw"};
export type CalibrationPolicy=FitPolicy&{coverage:Ratio};
export type Model={revision:string;frozenAt:string;fittedThrough:string;fixture:boolean;fitIds:string[];fitUnits:string[];
  cells:{key:string;ratio:Ratio;sampleCount:number}[];samples:FitSample[];sources:SourcePolicy[];policy:FitPolicy;digest:string};
export type Calibration={scope:QuoteScope;fixture:boolean;frozenAt:string;calibratedThrough:string;ids:string[];units:string[];sampleCount:number;rank:number;
  upperError:Ratio|null;reason:string|null;rows:BasketObservation[];sources:SourcePolicy[];policy:CalibrationPolicy;digest:string};
export function cents(v:number,positive=false){if(!Number.isSafeInteger(v)||v<(positive?1:0))throw Error("Invalid integer cents/count");return v;}
export function textId(v:string){if(typeof v!=="string"||!v.trim()||v!==v.trim()||v.length>256)throw Error("Missing or excessive identifier");}
export function timestamp(v:string){
  if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/.test(v))throw Error("Explicit UTC timestamp required");
  const t=Date.parse(v);if(!Number.isFinite(t)||new Date(t).toISOString().slice(0,19)!==v.slice(0,19))throw Error("Invalid observation timestamp");return t;
}
export function fresh(at:string,p:EvidencePolicy){const now=timestamp(p.asOf),t=timestamp(at);cents(p.maxAgeMs,true);if(t>now||now-t>p.maxAgeMs)throw Error("Future or stale evidence");}
export function ceilRatio(v:number,r:Ratio){cents(v);cents(r.numerator);cents(r.denominator,true);const n=BigInt(v)*BigInt(r.numerator),d=BigInt(r.denominator);return cents(Number((n+d-BigInt(1))/d));}
export function addCents(v:number[]){return cents(Number(v.reduce((n,x)=>n+BigInt(cents(x)),BigInt(0))));}
export function recordDigest(r:Recorded){const evidence:Partial<Evidence>={...r.evidence};delete evidence.reviewedDigest;return hash({...r,evidence});}
export function sealRecord<T extends Recorded>(r:T):T{const copy=structuredClone(r);copy.evidence.reviewedDigest=recordDigest(copy);return copy;}
export function cellKey(c:Cell){for(const v of [c.storeId,c.region,c.category])textId(v);if(!["in-store","pickup","delivery"].includes(c.channel))throw Error("Unknown shopping channel");return JSON.stringify([c.storeId,c.region,c.category,c.channel]);}
export function verifyRecord(r:Recorded,sources:SourcePolicy[],p:EvidencePolicy,cell?:Cell){
  textId(r.id);const e=r.evidence;if(!e||recordDigest(r)!==e.reviewedDigest)throw Error("Edited or unreviewed evidence");
  const s=sources.find(s=>s.id===e.sourceId);
  if(new Set(sources.map(s=>s.id)).size!==sources.length||!s||s.kind!==e.kind||!["fixture","observed"].includes(e.kind))throw Error("Unknown source scope");
  if(!["storage","estimate","compare","derive"].every(u=>s.uses.includes(u as SourcePolicy["uses"][number])))throw Error("Source use unsupported");
  if(new Set(s.records.map(r=>r.id)).size!==s.records.length)throw Error("Duplicate source pins");
  const pin=s.records.find(x=>x.id===r.id);
  if(!pin||pin.digest!==e.reviewedDigest||pin.observedAt!==e.observedAt||pin.reference!==e.reference)throw Error("Source/date pin mismatch");
  if(cell&&!s.cells.some(c=>cellKey(c)===cellKey(cell)))throw Error("Source cell unsupported");
  if(e.kind==="observed"&&!/^https:\/\//.test(e.reference))throw Error("Original source reference absent");textId(e.reference);fresh(e.observedAt,p);
}
export function scopeKey(s:QuoteScope){
  if(!s.storeIds.length||s.storeIds.length>3||new Set(s.storeIds).size!==s.storeIds.length||!s.categories.length||new Set(s.categories).size!==s.categories.length)throw Error("Invalid calibration scope");
  for(const v of [...s.storeIds,...s.categories,s.region,s.selectionRevision,s.strategyPolicyDigest,s.modelDigest])textId(v);
  if(s.strategy==="single-store"?!s.quotedStoreId||!s.storeIds.includes(s.quotedStoreId):s.strategy!=="split-store"||s.quotedStoreId!==null)throw Error("Invalid shopping strategy scope");
  if(!["in-store","pickup","delivery"].includes(s.channel))throw Error("Unknown shopping channel");
  return hash({...s,categories:[...s.categories].sort()}); // Store order pins deterministic tie behavior.
}
export function fitModel(revision:string,samples:FitSample[],sources:SourcePolicy[],policy:FitPolicy):Model{
  textId(revision);cents(policy.minSamples,true);timestamp(policy.asOf);
  if(!samples.length||samples.length>10000||new Set(samples.map(s=>s.id)).size!==samples.length||new Set(samples.map(s=>s.independentUnit)).size!==samples.length)throw Error("Missing, duplicate or reused fit units");
  const groups=new Map<string,FitSample[]>();
  for(const r of samples){verifyRecord(r,sources,policy,r.cell);textId(r.independentUnit);textId(r.productId);
    if(r.priceBasis!=="raw"||!r.baselinePackDigest||r.baselinePackDigest!==r.actualPackDigest)throw Error("Fit needs matching raw physical packs");
    fresh(r.baselineObservedAt,policy);if(timestamp(r.baselineObservedAt)>timestamp(r.evidence.observedAt))throw Error("Baseline time leakage");
    cents(r.baselineCents,true);cents(r.actualCents,true);const key=cellKey(r.cell),rows=groups.get(key)??[];rows.push(r);groups.set(key,rows);
  }
  const cells=[...groups].sort(([a],[b])=>a<b?-1:a>b?1:0).map(([key,rows])=>{
    if(rows.length<policy.minSamples)throw Error("Insufficient independent cell evidence");
    return {key,ratio:{numerator:addCents(rows.map(r=>r.actualCents)),denominator:addCents(rows.map(r=>r.baselineCents))},sampleCount:rows.length};
  });
  const body={revision,frozenAt:policy.asOf,fittedThrough:new Date(Math.max(...samples.map(s=>timestamp(s.evidence.observedAt)))).toISOString(),fixture:samples.some(s=>s.evidence.kind==="fixture"),
    fitIds:samples.map(s=>s.id),fitUnits:samples.map(s=>s.independentUnit),cells,samples:structuredClone(samples),sources:structuredClone(sources),policy:structuredClone(policy)};
  return {...body,digest:hash(body)};
}
export function verifyModel(m:Model,current?:EvidencePolicy){
  if(hash(m)!==hash(fitModel(m.revision,m.samples,m.sources,m.policy)))throw Error("Frozen model changed or derivation mismatch");
  if(current){fresh(m.frozenAt,current);for(const s of m.samples){fresh(s.evidence.observedAt,current);fresh(s.baselineObservedAt,current);}}
}
export function rawModelPrice(m:Model,c:Cell,baseline:number){verifyModel(m);cents(baseline,true);const f=m.cells.find(f=>f.key===cellKey(c));if(!f)throw Error("Unsupported store/category/region/channel cell");return ceilRatio(baseline,f.ratio);}
function verifyObservations(rows:BasketObservation[],m:Model,scope:QuoteScope,sources:SourcePolicy[],p:EvidencePolicy){
  verifyModel(m,p);if(timestamp(p.asOf)<=timestamp(m.frozenAt))throw Error("Observation phase must follow frozen model");
  if(rows.length>10000||new Set(rows.map(r=>r.id)).size!==rows.length||new Set(rows.map(r=>r.independentUnit)).size!==rows.length||new Set(rows.map(r=>r.basketDigest)).size!==rows.length)throw Error("Repeated independent basket evidence");
  if(scope.modelDigest!==m.digest)throw Error("Calibration model mismatch");const key=scopeKey(scope);
  for(const r of rows){verifyRecord(r,sources,p);textId(r.independentUnit);textId(r.basketDigest);
    for(const storeId of r.scope.strategy==="single-store"?[r.scope.quotedStoreId!]:r.scope.storeIds)for(const category of r.scope.categories)verifyRecord(r,sources,p,{storeId,category,region:r.scope.region,channel:r.scope.channel});
    cents(r.rawPredictionCents,true);cents(r.actualCents);
    if(r.priceBasis!=="raw"||scopeKey(r.scope)!==key||m.fitIds.includes(r.id)||m.fitUnits.includes(r.independentUnit)||timestamp(r.evidence.observedAt)<=timestamp(m.frozenAt))throw Error("Buffered, mixed, overlapping or pre-freeze basket evidence");
  }
}
export function calibrate(m:Model,scope:QuoteScope,rows:BasketObservation[],sources:SourcePolicy[],policy:CalibrationPolicy):Calibration{
  cents(policy.coverage.numerator,true);cents(policy.coverage.denominator,true);cents(policy.minSamples,true);
  if(policy.coverage.numerator>=policy.coverage.denominator)throw Error("Coverage must be strictly between zero and one");
  verifyObservations(rows,m,scope,sources,policy);const rank=ceilRatio(rows.length+1,policy.coverage);
  const errors=rows.map(r=>({numerator:Math.max(0,r.actualCents-r.rawPredictionCents),denominator:r.rawPredictionCents}));
  errors.sort((a,b)=>{const x=BigInt(a.numerator)*BigInt(b.denominator),y=BigInt(b.numerator)*BigInt(a.denominator);return x<y?-1:x>y?1:0;});
  const available=rows.length>=policy.minSamples&&rank<=rows.length;
  // Positive coverage/rank and available imply 1 <= rank <= errors.length.
  const body={scope:structuredClone(scope),fixture:m.fixture||rows.some(r=>r.evidence.kind==="fixture"),frozenAt:policy.asOf,
    calibratedThrough:rows.length?new Date(Math.max(...rows.map(r=>timestamp(r.evidence.observedAt)))).toISOString():m.frozenAt,
    ids:rows.map(r=>r.id),units:rows.map(r=>r.independentUnit),sampleCount:rows.length,rank,upperError:available?errors[rank-1]!:null,
    reason:available?null:"Insufficient independent calibration for the requested coverage",rows:structuredClone(rows),sources:structuredClone(sources),policy:structuredClone(policy)};
  return {...body,digest:hash(body)};
}
export function verifyCalibration(c:Calibration,m:Model,scope:QuoteScope,p:EvidencePolicy){
  verifyModel(m,p);if(hash(c)!==hash(calibrate(m,c.scope,c.rows,c.sources,c.policy))||scopeKey(scope)!==scopeKey(c.scope))throw Error("Frozen calibration changed or scope mismatch");
  fresh(c.frozenAt,p);for(const r of c.rows)fresh(r.evidence.observedAt,p);
}
// A collection plan must separate physical units across ALL scopes, not just within one cell.
// Caller labels do not prove independence; this only rejects declared overlap.
export function verifyPhaseSeparation(fit:FitSample[],calibration:BasketObservation[],heldOut:BasketObservation[]){
  const ids=new Set<string>(),units=new Set<string>();
  for(const row of [...fit,...calibration,...heldOut]){
    textId(row.id);textId(row.independentUnit);
    if(ids.has(row.id)||units.has(row.independentUnit))throw Error("Global phase overlap or reused physical independent unit");
    ids.add(row.id);units.add(row.independentUnit);
  }
}
export function evaluateHeldOut(m:Model,c:Calibration,rows:BasketObservation[],sources:SourcePolicy[],p:EvidencePolicy){
  verifyCalibration(c,m,c.scope,p);verifyObservations(rows,m,c.scope,sources,p);if(!rows.length||!c.upperError)throw Error("Held-out evaluation or calibration unavailable");
  const results=rows.map(r=>{if(c.ids.includes(r.id)||c.units.includes(r.independentUnit)||c.rows.some(x=>x.basketDigest===r.basketDigest)||timestamp(r.evidence.observedAt)<=timestamp(c.frozenAt))throw Error("Evaluation reused calibration evidence or time");
    const allowanceCents=ceilRatio(r.rawPredictionCents,c.upperError!),guardedCents=addCents([r.rawPredictionCents,allowanceCents]);
    return {id:r.id,rawCents:r.rawPredictionCents,actualCents:r.actualCents,allowanceCents,guardedCents,overrunCents:Math.max(0,r.actualCents-guardedCents),excessAllowanceCents:Math.max(0,guardedCents-r.actualCents)};});
  return {fixture:m.fixture||c.fixture||rows.some(r=>r.evidence.kind==="fixture"),modelDigest:m.digest,calibrationDigest:c.digest,count:results.length,
    overrunCount:results.filter(r=>r.overrunCents>0).length,maximumOverrunCents:Math.max(...results.map(r=>r.overrunCents)),results};
}
