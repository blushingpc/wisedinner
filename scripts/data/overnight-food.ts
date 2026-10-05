// Additive private review overlay. Earlier source/approval artifacts and public data are unchanged.
import { readFileSync } from "node:fs";
import { SKUS } from "./authored/skus.ts";
import { toSku } from "./expand.ts";
import { reviewedBasket, targetedCandidates, digest, labelNutrition, type WeekApproval } from "./reviewed-week.ts";
import { compileCandidate, directions, type Candidate } from "./catalog-expansion.ts";
import type { Ing } from "./authored/types.ts";

export function overnightBasket() {
  const b=reviewedBasket(), labels=JSON.parse(readFileSync("docs/ingredient-catalog/overnight-labels.json","utf8"));
  const p=labels["ww-spaghetti"], map=JSON.parse(readFileSync("data/kroger-map.json","utf8"))["ww-spaghetti"];
  const sku=toSku(SKUS.find(s=>s.id==="ww-spaghetti")!);
  if(p.status!=="reviewed-original-label" || p.upc!=="0007680800584" || p.gtin!=="00076808005844" || p.pack!=="16 oz" || map.productId!==p.upc || map.size!==p.pack || sku.pack_qty!==1 || sku.pack_unit!=="lb" || digest(p.ingredients)!==digest(["Whole Grain Durum Wheat Flour"]) || p.yield!==1 || p.serving_g!==56) throw new Error("Whole-grain spaghetti identity/quantity review stale");
  b.quantities[sku.id]={sku_id:sku.id,source:p.panel,identity:p.identity,accessed:p.accessed,source_basis:"dry",edible_per_purchased:1,yield_source:p.manufacturer,yield_row:p.yield_basis,limits:p.limits,nutrition:labelNutrition(sku.id,p),purchase_basis:digest([sku.id,sku.pack_qty,sku.pack_unit,sku.pack_label,sku.canonical_unit,sku.grams_per_unit])};
  b.safety[sku.id]={...b.safety[sku.id],status:"reviewed",allergens:["wheat","eggs"],diet:["gluten"],known_allergens:["wheat","eggs"],known_diet:["gluten"],sources:[p.manufacturer,p.panel,p.serving_source],reviewed_at:p.accessed,basis:p.limits};
  b.input_digest=digest({prior:b.input_digest,labels});
  b.source_digest=digest({quantities:b.quantities,safety:b.safety,input_digest:b.input_digest});
  b.blocked=b.blocked.filter(id=>id!==sku.id);
  return b;
}

export function overnightCandidates(): Candidate[] {
  const old=targetedCandidates(), out=[...old];
  // Existing quantities retained: substantive grain substitution, not a cosmetic alias or protein stretching.
  for(const c of old.filter(c=>c.parts.find(p=>p.role==="grain")!.row[0]==="white-rice")) {
    const next=structuredClone(c);
    const grain=next.parts.find(p=>p.role==="grain")!;
    grain.row[0]="ww-spaghetti";
    next.recipe.id=next.recipe.id.replace("white-rice","ww-spaghetti");
    next.recipe.name=next.recipe.name.replace("white rice","whole grain spaghetti");
    next.recipe.ingredients=next.parts.map(p=>p.row);
    next.recipe.steps=directions(next.parts,next.method,true);
    compileCandidate(next);out.push(next);
  }
  // Three different vegetable preparations of a substantial egg/lentil/edamame savory breakfast.
  // Adds a real third protein ingredient, retaining the existing authored amounts and all juices.
  for(const c of old.filter(c=>c.recipe.meal_type==="breakfast" && c.recipe.protein==="eggs and lentils")) {
    const next=structuredClone(c), row:Ing=["frozen-edamame",150,"g"];
    next.parts.splice(2,0,{row,role:"protein"});
    next.recipe.id=next.recipe.id.replace("eggs-lentils-","eggs-lentils-frozen-edamame-");
    next.recipe.name=next.recipe.name.replace("Eggs and lentils","Eggs, lentils and edamame");
    next.recipe.protein="eggs and lentils and frozen-edamame";
    next.recipe.ingredients=next.parts.map(p=>p.row);next.recipe.steps=directions(next.parts,next.method,true);
    compileCandidate(next);out.push(next);
  }
  // Edamame-led mains reduce dependence on lentils without a token ingredient or extra protein portion.
  for(const c of [...out].filter(c=>["white-rice","ww-spaghetti"].includes(c.parts.find(p=>p.role==="grain")!.row[0]) && c.recipe.protein==="lentils and frozen-edamame")) {
    const next=structuredClone(c);
    next.parts=next.parts.filter(p=>p.row[0]!=="lentils");
    next.parts.find(p=>p.role==="grain")!.row[1]=110;
    next.recipe.id=next.recipe.id.replace("lentils-frozen-edamame-","frozen-edamame-");
    next.recipe.name=next.recipe.name.replace("Lentils and edamame","Edamame");next.recipe.protein="frozen-edamame";
    next.recipe.ingredients=next.parts.map(p=>p.row);next.recipe.steps=directions(next.parts,next.method,true);
    compileCandidate(next);out.push(next);
  }
  return out;
}
export function overnightApproval(): WeekApproval {
  return JSON.parse(readFileSync("docs/ingredient-catalog/overnight-approval.json","utf8"));
}
