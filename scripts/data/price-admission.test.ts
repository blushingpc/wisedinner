import {test} from "node:test";
import assert from "node:assert/strict";
import {SKUS} from "./authored/skus.ts";
import {hash,packFingerprint,recordOffer,observationValid,quarantinePrices,type ExactPrice,type PackReview} from "./price-evidence.ts";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";

const sku=SKUS.find(s=>s.id==="lentils")!;
const review:PackReview={status:"reviewed",sku_id:sku.id,product_id:"fixture-product",description:"Plain Dry Lentils",item_id:"fixture-item",pack_size:"1 lb",pack_canonical:453.592,sku_fingerprint:packFingerprint(sku),form_basis:"Synthetic dry lentils pack control",source_urls:["https://example.invalid/synthetic-panel"],reviewed_at:"2026-09-26T00:00:00Z",revision:"fixture-1",sold_by:"UNIT"};
const location={store_id:"kroger",location_id:"fixture-location",zip:"43215",channel:"instore"};
// One day is a synthetic test policy, not an adopted production freshness duration.
const context={now:"2026-10-06T12:00:00Z",requested:location,policy:{revision:"synthetic-policy-1",max_age_ms:86400000,locations:[location]}};
function row(time="2026-10-06T11:00:00Z",loc=location):ExactPrice{return recordOffer({productId:review.product_id,description:review.description,items:[{itemId:review.item_id,size:review.pack_size,soldBy:"UNIT",fulfillment:{instore:true},price:{regular:2.49}}]},sku,review,{locationId:loc.location_id,store_id:loc.store_id,zip:loc.zip},time);}
// Before the fix the actual historical gate ignores the third argument.
const admit=quarantinePrices as (rows:ExactPrice[],skus:typeof SKUS,context?:unknown)=>ReturnType<typeof quarantinePrices>;
test("fresh exact requested location and exact age boundary remain usable",()=>{for(const r of [row(),row("2026-10-05T12:00:00Z")]){assert.equal(observationValid(r,sku),true);assert.deepEqual(admit([r],SKUS,context).accepted,[r]);}});
test("future observation retains historical integrity but cannot be used now",()=>{const r=row("2026-10-06T12:00:00.001Z");assert.equal(observationValid(r,sku),true);assert.equal(admit([r],SKUS,context).accepted.length,0);});
test("just expired observation cannot be used now",()=>{const r=row("2026-10-05T11:59:59.999Z");assert.equal(observationValid(r,sku),true);assert.equal(admit([r],SKUS,context).accepted.length,0);});
test("immutable other physical location is not the requested location",()=>{const r=row(undefined,{...location,location_id:"fixture-other"});assert.equal(observationValid(r,sku),true);assert.equal(admit([r],SKUS,context).accepted.length,0);});
test("absent policy holds instead of choosing a duration or location",()=>{assert.equal(admit([row()],SKUS).accepted.length,0);});
test("duplicate observations hold both rather than selecting a winner",()=>{const r=row();assert.equal(admit([r,r],SKUS,context).accepted.length,0);});
test("invalid/missing clocks and policy never choose ambient time or defaults",()=>{
 for(const now of [undefined,null,NaN,Infinity,"2026-02-30T12:00:00Z","2026-10-06","2026-10-06T12:00:00+00:00","bad"]){assert.equal(admit([row()],SKUS,{...context,now}).accepted.length,0);}
 for(const policy of [undefined,null,{}, {...context.policy,revision:" "},...[-1,1.1,NaN,Infinity,Number.MAX_SAFE_INTEGER+1,"86400000"].map(max_age_ms=>({...context.policy,max_age_ms}))])assert.equal(admit([row()],SKUS,{...context,policy}).accepted.length,0);
 // A trusted earlier clock makes this observation future; a supplied clock is not independently authenticated here.
 assert.equal(admit([row()],SKUS,{...context,now:"2026-10-06T10:59:59.999Z"}).accepted.length,0);
 assert.equal(admit([row(context.now)],SKUS,{...context,policy:{...context.policy,max_age_ms:0}}).accepted.length,1);
 assert.equal(admit([row("2026-10-06T11:59:59.999Z")],SKUS,{...context,policy:{...context.policy,max_age_ms:0}}).accepted.length,0);
});
test("exact supported store/location/ZIP/channel, no fallback or remapping",()=>{
 for(const requested of [{...location,store_id:"ralphs"},{...location,location_id:"other"},{...location,zip:"43216"},{...location,channel:"delivery"},{...location,store_id:"walmart"},{...location,store_id:"unknown"},{...location,store_id:" kroger"},{...location,location_id:" "},...['4321','432150',43215,'abcde'].map(zip=>({...location,zip}))])assert.equal(admit([row()],SKUS,{...context,requested}).accepted.length,0);
 for(const locations of [[],[location,location],new Array(1),[{...location,zip:"bad"}],[{...location,location_id:"other"}]])assert.equal(admit([row()],SKUS,{...context,policy:{...context.policy,locations}}).accepted.length,0);
 for(const loc of [{...location,store_id:"ralphs"},{...location,zip:"43216"}]){const r=row(undefined,loc);assert.equal(observationValid(r,sku),true);assert.equal(admit([r],SKUS,context).accepted.length,0);}
});
function reseal(r:ExactPrice){const {observation_digest:ignored,...p}=r.provenance;void ignored;r.provenance.observation_digest=hash(p);return r;}
test("original immutable mapping/pack/cents must pass in addition to current policy",()=>{
 const changes:((r:ExactPrice)=>void)[]=[r=>{r.as_of="2026-10-05";},r=>{r.shelf_price=2.5;},r=>{r.unit_price=1;},r=>{r.region="43216";},r=>{r.provenance.pack_canonical=1;},r=>{r.provenance.mapping_revision="later-map";},r=>{r.provenance.review.description="Prepared lentils";},r=>{r.provenance.regular_cents=249.1;},r=>{r.provenance.regular_cents=Infinity;},r=>{r.provenance.product_id="";},r=>{r.provenance.offer_id=" ";},r=>{r.provenance.channel="delivery" as "instore";},r=>{r.provenance.observed_at="2026-02-30T11:00:00Z";}];
 for(const change of changes){const r=row();change(r);assert.equal(admit([r],SKUS,context).accepted.length,0);assert.equal(admit([reseal(r)],SKUS,context).accepted.length,0);}
 const badInteger=row();badInteger.provenance.regular_cents=Number.MAX_SAFE_INTEGER+1;badInteger.shelf_price=badInteger.provenance.regular_cents/100;badInteger.unit_price=badInteger.shelf_price/review.pack_canonical;assert.equal(admit([reseal(badInteger)],SKUS,context).accepted.length,0);
});
test("unsupported/malformed rows and duplicate authored identities hold; input bytes stay unchanged",()=>{
 for(const rows of [[null],[{}],new Array(1),[{...row(),sku_id:"unsupported"}]])assert.equal(admit(rows as ExactPrice[],SKUS,context).accepted.length,0);
 assert.equal(admit([row()], [...SKUS,sku],context).accepted.length,0);
 assert.equal(admit([row(),row(undefined,{...location,location_id:"other"})],SKUS,context).accepted.length,0);
 const r=row(),before=JSON.stringify({r,context});assert.deepEqual(admit([r],SKUS,context).accepted,[r]);assert.equal(JSON.stringify({r,context}),before);
 let calls=0;const getter={...context};Object.defineProperty(getter,"now",{get(){calls++;throw Error("clock getter");}});assert.equal(admit([r],SKUS,getter).accepted.length,0);assert.equal(calls,0);
 const p=Proxy.revocable([],{});p.revoke();assert.equal(admit([r],SKUS,{...context,policy:{...context.policy,locations:p.proxy}}).accepted.length,0);
});

test("actual compiled isolated staging holds before assembly, with strict synthetic ports",async()=>{
 const source=readFileSync(new URL("./staged-pipeline.ts",import.meta.url),"utf8");
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 for(const [rows,ctx,pass] of [[[row()],context,true],[[row()],undefined,false],[[row("2026-10-06T12:00:00.001Z")],context,false],[[row("2026-10-05T11:59:59.999Z")],context,false],[[row(undefined,{...location,location_id:"other"})],context,false],[[row(),row()],context,false]] as const){
  const effects={assemble:0,stage:0,write:0,core:0};const exports:Record<string,unknown>={};
  const ports:Record<string,unknown>={
   "node:fs":{existsSync:()=>true,readFileSync:()=>JSON.stringify({rows}),mkdirSync:()=>{},realpathSync:(p:string)=>p==="."?"/synthetic-root":"/synthetic-root/data/pipeline/staging",writeFileSync:()=>{effects.write++;}},
   "node:path":{sep:"/",resolve:(...p:string[])=>"/synthetic-root/"+p.join("/")},
   "./snapshot.ts":{assemble:()=>{effects.assemble++;return {};},previousSnapshot:()=>null,guard:()=>{throw Error("unexpected guard execution");}},
   "./authored/skus.ts":{SKUS},"./overnight-food.ts":{overnightBasket:()=>({source_digest:"synthetic",blocked:[]})},"./reviewed-week.ts":{digest:hash},"./price-evidence.ts":{quarantinePrices},
   "./publication.ts":{stageSnapshot:async()=>{effects.stage++;return {bytes:"{}",fixtures:[],manifest:{status:"synthetic-stage"}};}},
   "../../packages/solver/src/engine.ts":{solve:()=>{effects.core++;throw Error("unexpected core");},evaluateWeek:()=>{effects.core++;throw Error("unexpected core");}},"../../packages/solver/src/profiles.ts":{PROFILES:[]}
  };
  runInNewContext(js,{exports,require:(id:string)=>{if(!(id in ports))throw Error(`Unexpected import ${id}`);return ports[id];}});
  const run=exports.stagedPipeline as (path:string,ctx:unknown)=>Promise<Record<string,unknown>>;
  const manifest=await run("data/pipeline/staging/synthetic-test",ctx);
  assert.equal(effects.assemble,pass?1:0);assert.equal(effects.stage,pass?1:0);assert.equal(effects.write,pass?3:1);assert.equal(effects.core,0);assert.equal(manifest.status,pass?"synthetic-stage":"blocked");
 }
});
