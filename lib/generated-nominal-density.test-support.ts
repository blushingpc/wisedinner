import { createHash } from "node:crypto";
import { setup } from "./generated-joined-plan.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createReviewedPublicPackRegistry } from "./generated-reviewed-pack-registry.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
export const sha=(v:string|Uint8Array)=>createHash("sha256").update(v).digest("hex");
export const json=(v:unknown)=>Buffer.from(JSON.stringify(v));
export const amount=(n:number|string,d:number|string=1)=>({numerator:String(n),denominator:String(d)});
export function densityFixture(grouped=false) {
 const initial=setup(),rows=structuredClone(initial.rows);
 rows.forEach((r,i)=>{r.recipe.ingredients[0]!.state=i?"ready-to-use":"liquid";const h=sha(JSON.stringify(canonicalReferenceData(r.recipe)));r.recipe_sha256=h;r.nutrition.source_refresh.exact_recipe_body_sha256=h;r.nutrition.source_refresh.recipe_sha256_unchanged=h;});
 const catalog=Buffer.from(rows.map(r=>JSON.stringify(r)).join("\n")+"\n"),signatures=["a".repeat(64),"b".repeat(64)],forms=rows.map(r=>{const i=r.recipe.ingredients[0]!;return{id:i.id,name:i.name,state:i.state,unit:i.unit};});
 const matches=json({matches:Object.fromEntries(signatures.map((signature,i)=>[signature,{exact_form:forms[i],status:"conditional-reference",record_ids:[10],flags:["synthetic-warning-"+i],holds:[]}]))});
 const records=json({"10":{fdc_id:10,description:"Synthetic liquid reference only",raw_food_row_sha256:"2".repeat(64),portions:[]}});
 const point={series_id:"APU0300FF1101",area_code:"0300",item_code:"FF1101",region:"South",currency:"USD",source_kind:"bls-average-retail-price",product:"Synthetic liquid unit price",period:"2026-09",unit:"liter",unit_amount:"1",value:"2.000",source_ids:["point"]};
 const snapshot=(observations:unknown[])=>json({schema:"wisedinner-bls-average-price-v1",source_kind:"bls-average-retail-price",currency:"USD",as_of:"2026-10-14",status:"partial-observations",observations,sources:[{id:"point",sha256:"3".repeat(64)}]});
 const sources={catalog,matches,records,staples:snapshot([point]),produce:snapshot([])},shared={sourceUrl:"https://example.invalid/synthetic-liquid-only",sourceSha256:"4".repeat(64),reviewedOn:"2026-10-19",evidenceLevel:"synthetic-test-only",description:"Synthetic nominal model only, not measured food or product density"};
 const densities=signatures.map((signature,i)=>({...shared,id:"density-"+i,kind:"density-reference",ingredientSignature:signature,recordRows:[{fdcId:10,foodRowSha256:"2".repeat(64)}],measurementKind:"mass-density",unit:"g/ml",densityGPerMl:amount(9,10),sourceEdition:"synthetic-only",temperatureC:null as string|null,scope:"published-nominal-input-reference-not-measured-product"}));
 const packages=signatures.map((signature,i)=>({...shared,id:"package-"+i,kind:"package-reference",ingredientSignature:signature,purchaseState:grouped?"liquid":forms[i]!.state,unit:"ml",nominalQuantity:amount(500)}));
 const category={...shared,id:"category",kind:"price-category-reference",ingredientSignature:signatures[0]!,product:point.product,priceScope:"conditional-category-unit-model"},review={id:"south-september",region:"South",seriesId:point.series_id,product:point.product,period:"2026-09",categoryClaimId:"category",reviewEffectiveFrom:"2026-10-19",usableThrough:"2026-10-19"};
 const families=forms.slice(0,grouped?2:1).map((exactForm,i)=>({id:"family-"+i,ingredientSignature:signatures[i]!,exactForm,recordIds:[10],purchase:{skuId:grouped?"one-liquid":"liquid-"+i,state:grouped?"liquid":exactForm.state,unit:"ml",category:"pantry",perishable:false},quantityBasis:grouped?{kind:"reviewed-input-state-equivalence-density",groupId:"liquid-input-group",densityClaimId:"density-"+i}:{kind:"reviewed-mass-volume-reference",densityClaimId:"density-"+i},packageClaimId:"package-"+i,priceReviews:i?[]:[review]}));
 const group={...shared,id:"liquid-input-group",memberFamilyIds:families.map(f=>f.id),memberForms:families.map(f=>({familyId:f.id,ingredientSignature:f.ingredientSignature,exactForm:f.exactForm,recordIds:f.recordIds})),anchorFamilyId:"family-0",scope:"same-food-input-grams-no-physical-transition"};
 const manifest={schema:"wd-reviewed-public-pack-manifest-v3",catalogSha256:sha(catalog),claims:[...packages,...densities,category] as unknown[],families,purchaseGroups:grouped?[group]:[]};
 function config(m:unknown=manifest){return{catalog:{sha256:sha(sources.catalog),recordCount:2},matches:{sha256:sha(sources.matches)},records:{sha256:sha(sources.records)},staples:{sha256:sha(sources.staples),observations:1},produce:{sha256:sha(sources.produce),observations:0},manifestSha256:sha(json(m))};}
 return{initial,sources,manifest,config,rows,densities,packages,category,bind:()=>createReviewedPublicPackRegistry(sources,json(manifest),config())};
}

export function densityPlanFixture(changedSource=false) {
 const f=densityFixture(true);f.packages.forEach(p=>{p.nominalQuantity=amount(100);});if(changedSource)f.densities.forEach(d=>{d.sourceSha256="e".repeat(64);});
 const r=f.bind();if(r.outcome!=="ready")throw Error("Expected synthetic nominal registry");const p=r.forFamilies({familyIds:["family-0","family-1"],region:"South",asOfDate:"2026-10-19"});if(p.outcome!=="prepared")throw Error("Expected source bundle");
 const configuration={sourcePin:{sha256:sha(f.sources.catalog),recordCount:2},correspondences:p.correspondences,regionalPackFacts:p.regionalPackFacts,pantryIntake:{measureFacts:[],purchaseBindings:p.pantryPurchaseBindings}},bound=createJoinedReferencePlanner(f.sources.catalog,configuration);
 if(bound.outcome!=="ready")throw Error("Expected fixed nominal planner");const request={...f.initial.request,asOfDate:"2026-10-19"},assignments=f.initial.assignments.map(a=>({...a,recipeSha256:f.rows[0]!.recipe_sha256})),binding=p.pantryPurchaseBindings[0]!;
 const entries=[{pantryId:"synthetic-measured-volume",kind:"known",ingredientId:binding.ingredientId,preparedState:binding.preparedState,baseUnit:"ml",amount:amount(3000),unit:"ml",purchaseBindingId:binding.id}];
 return{...f,configuration,planner:bound.planner,request,assignments,entries,labels:[{skuId:binding.skuId,displayName:"Synthetic liquid reference",aisle:"Pantry"}],bytes:f.sources.catalog};
}

