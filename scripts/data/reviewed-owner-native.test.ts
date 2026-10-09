import test from "node:test";
import assert from "node:assert/strict";
import {writeFileSync,readFileSync} from "node:fs";
import {createNativeReviewedOwnerProducer} from "./reviewed-owner-native.ts";
import {createNativeReviewedOwnerProducer as appProducer} from "../../../wisedinner-app/src/data/owner-reviewed-native.ts";
import {createReviewedOwnerInventory} from "./reviewed-owner-inventory.ts";
import {createReviewedOwnerReroll} from "./reviewed-owner-reroll.ts";
import {inventoryBasis,decodeInventoryPlan} from "./reviewed-owner-inventory-model.ts";
import {REGISTRY} from "./reviewed-owner-model.ts";
import {assertSourceCorrespondence} from "../../packages/reviewed-owner-native/source-correspondence.ts";
import source from "./reviewed-owner-source.json" with {type:"json"};
import {stageNative} from "../../packages/reviewed-owner-native/stage.ts";
import {stageReviewed,reviewedBasket,type WeekApproval} from "./reviewed-week.ts";
const tools=["stovetop","nonstick-pan","spatula","food-thermometer","knife","cutting-board","saucepan","strainer","bowl","spoon","measuring-tools"];
const base={owner:"10000000-0000-4000-8000-000000000001",planningRevision:1,profileRevision:1,registry:REGISTRY,budget:60,protein:150,kcalMin:1800,kcalMax:2800,diet:"none",allergies:[],household:1,stores:["kroger"],zip:"43215",seed:7,equipment:tools};
const native=createNativeReviewedOwnerProducer(),consumer=appProducer(),original=createReviewedOwnerInventory(),reroll=createReviewedOwnerReroll();
test("native transient physical projection equals original reviewed stage without pack/density changes",()=>{const approval:WeekApproval=JSON.parse(readFileSync("docs/ingredient-catalog/reviewed-week-approval.json","utf8")),native=stageNative(),original=stageReviewed(approval,reviewedBasket());assert.equal(JSON.stringify(native.edible),JSON.stringify(original.edible));assert.equal(JSON.stringify(native.basket),JSON.stringify(original.basket));assert.equal(JSON.stringify(native.purchased),JSON.stringify(original.purchased));assert.deepEqual(native.purchased.skus,native.edible.skus);});
for(const [profile,patch] of [["typical",{}],["floor",{budget:45,protein:100,kcalMin:1600,kcalMax:2600}],["household-two",{budget:120,household:2}]] as const)for(const seed of [0,7,19])test(`native canonical full-value ${profile}/${seed}: original install and all 15 replacements`,()=>{
 const request={...base,...patch,seed},before=original.install(request,[]);
 assert.equal(native.install(request,[]),before);assert.equal(consumer.install(request,[]),before);
 if(process.env.WD_REVIEWED_OUTPUT)writeFileSync(`${process.env.WD_REVIEWED_OUTPUT}/${profile}-${seed}-original.json`,before,{flag:"wx"});
 let fits=0,misses=0;
 for(let slot=0;slot<15;slot++){const expected=reroll.replace(before,slot);assert.equal(native.replace(before,slot),expected);assert.equal(consumer.replace(before,slot),expected);if(expected===null)misses++;else fits++;if(process.env.WD_REVIEWED_OUTPUT)writeFileSync(`${process.env.WD_REVIEWED_OUTPUT}/${profile}-${seed}-slot-${slot}.json`,expected??"null",{flag:"wx"});}
 console.log(JSON.stringify({profile,seed,fits,misses,cents:decodeInventoryPlan(before).model.totalCents}));
});
test("native finite exact-source pantry and repeated replacement match independent Node accounting",()=>{
 const pantry=[{id:"oats",fraction:1,basis:inventoryBasis("oats")}],before=original.install(base,pantry);assert.equal(native.install(base,pantry),before);assert.equal(consumer.install(base,pantry),before);
 let current=before;for(let round=0;round<2;round++){let replacement:string|null=null;for(let slot=0;slot<15&&replacement===null;slot++){replacement=reroll.replace(current,slot);assert.equal(native.replace(current,slot),replacement);assert.equal(consumer.replace(current,slot),replacement);}assert(replacement);current=replacement;}
 for(const rows of [[{...pantry[0],fraction:-1}],[{...pantry[0],fraction:101}],[{...pantry[0],basis:"name-only"}],[...pantry,...pantry]])assert.throws(()=>native.install(base,rows));
});
test("native source correspondence rejects complete corruptions and descriptor effects without source injection",()=>{
 assertSourceCorrespondence(source);for(const mutate of [(v:typeof source)=>{v.source="wrong";},(v:typeof source)=>{const s=v.edible.skus[0];assert(s);s.pack_qty+=1;},(v:typeof source)=>{const r=v.edible.recipe_ingredients[0];assert(r);r.qty+=1;},(v:typeof source)=>{const r=v.edible.nutrition[0];assert(r);r.protein_g=-1;}]){const v=structuredClone(source);mutate(v);assert.throws(()=>assertSourceCorrespondence(v));}
 let effects=0;const getter={};Object.defineProperty(getter,"source",{enumerable:true,get(){effects++;return source.source;}});assert.throws(()=>assertSourceCorrespondence(getter));assert.equal(effects,0);assert.throws(()=>assertSourceCorrespondence(Object.create(source)));const sparse=Array(2);assert.throws(()=>assertSourceCorrespondence(sparse));
 assert(!source.edible.skus.some(v=>v.id==="chicken-thighs"));assert(!source.edible.skus.some(v=>v.id==="pork-loin"));
});
test("native supported and held restriction/location/equipment profiles preserve real Node outcomes",()=>{
 for(const patch of [{diet:"vegetarian"},{diet:"vegan"},{diet:"gluten-free"},{allergies:["eggs"]},{allergies:["soy"]},{equipment:[]},{equipment:["knife"]},{equipment:["unknown"]},{zip:"33301"},{stores:["unknown"]},{pantry:["oats"]}]){const request={...base,...patch};let expected:string|undefined;try{expected=original.install(request,[]);}catch{assert.throws(()=>native.install(request,[]));assert.throws(()=>consumer.install(request,[]));continue;}assert.equal(native.install(request,[]),expected);assert.equal(consumer.install(request,[]),expected);}
 const before=native.install(base,[]);for(const slot of [-1,15,.5,NaN,null,{},"0"])assert.throws(()=>native.replace(before,slot));assert.throws(()=>native.replace(before.replace('"source":','"unknown":true,"source":'),0));
});
test("native mirrored canonical module bodies and source assets remain exact",()=>{
 for(const name of ["types","units","snapshot","pricing","engine","swaps"]){const original=readFileSync(`packages/solver/src/${name}.ts`,"utf8").replaceAll("\r\n","\n");for(const root of ["packages/reviewed-owner-native","../wisedinner-app/src/solver/reviewed-owner-native"])assert.equal(readFileSync(`${root}/core/${name}.ts`,"utf8").replaceAll("\r\n","\n"),original);}
 assert.equal(readFileSync("scripts/data/reviewed-owner-source.json","utf8"),readFileSync("../wisedinner-app/src/data/reviewed-owner-source.json","utf8"));
});
