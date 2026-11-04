import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createPostgresReferenceStatePort, type ReferenceSqlDriver } from "./generated-plan-postgres.ts";
import { createReferenceSessionHandler, REFERENCE_SESSION_CONTRACT } from "./generated-plan-session.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { issueLocalReferenceScope } from "./generated-plan-state.ts";
import { rawYieldPlanFixture } from "./generated-nominal-preparation-yield.test-support.ts";
import { op } from "./generated-plan-state.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";

function fixture(db:PGlite,generation:number,changedSource=false){
 const f=rawYieldPlanFixture(changedSource),namespace="nominal-raw-preparation-isolated-disk-only";let lose=false;
 const driver:ReferenceSqlDriver={async transaction(body){const result=await db.transaction(tx=>body({async query(sql,parameters){return tx.query<Record<string,unknown>>(sql,parameters);}}));if(lose){lose=false;throw Error("Synthetic committed acknowledgement loss");}return result;}};
 const scope=issueLocalReferenceScope(namespace,generation),transactions=createPostgresReferenceStatePort(driver,hash({namespace})),binding=createReferenceSessionHandler(f.bytes,f.configuration,{labels:f.labels,transactions,resolveScope:()=>scope,newWeekPolicy:"wd-new-week-reconfirm-v1"});if(binding.outcome!=="ready")throw Error("Expected source-bound nominal session");const bound=binding;
 async function send(operation:string,payload:unknown,id:number){const value={contract:REFERENCE_SESSION_CONTRACT,operation,payload,operationId:op(id),sourceSha256:f.configuration.sourcePin.sha256},response=await bound.handle(new Request("http://private.invalid",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...value,intentSha256:referenceOperationDigest(value)})}));return(await response.json()).result;}
 return{...f,send,loseNextAcknowledgement(){lose=true;}};
}
test("actual SQL restart retains fully owned raw preparation warnings and exact commit while changed quantity evidence holds views",async()=>{
 const directory=await mkdtemp(join(tmpdir(),"wd-nominal-raw-preparation-"));let db:PGlite|null=null;
 try{
 db=await PGlite.create(directory);await db.exec(await readFile(new URL("./generated-plan-postgres.fixture.sql",import.meta.url),"utf8"));let f=fixture(db,1);
 const initial={weekId:op(1130),expectedRevision:0,request:f.request,assignments:f.assignments,pantryEntries:f.entries};f.loseNextAcknowledgement();assert.equal((await f.send("installCurrent",initial,1131)).outcome,"unknown");
 await db.close();db=await PGlite.create(directory);f=fixture(db,2);const recovered=await f.send("operationStatus",{targetOperationId:op(1131)},1132);assert.equal(recovered.outcome,"committed");assert.equal(recovered.receipt.state.revision,1);const view=recovered.receipt.state.current.view;assert.equal(view.outcome,"saved-week");assert.deepEqual(view.groceries.estimatedTotalCents,{min:0,max:0});assert(view.groceries.warnings.includes("uses-nominal-raw-preparation-yield-reference"));for(const key of["nominalPreparationYieldReference","preparedPerPurchased","estimatedLineCents","packPriceCents"])assert.equal(JSON.stringify(recovered).includes(key),false);assert.deepEqual(await f.send("installCurrent",initial,1131),recovered.receipt);
 const request={...f.request,selectedDays:f.request.selectedDays.map(d=>d.replace("2026-10-","2026-11-"))},assignments=f.assignments.map(a=>({...a,assignmentId:a.assignmentId+"next",date:a.date.replace("2026-10-","2026-11-")}));
 const draft=await f.send("createWeekDraft",{...initial,weekId:op(1140),expectedRevision:1,request,assignments,pantryReconfirmed:true},1133);assert.equal(draft.outcome,"acknowledged");assert.equal(draft.state.current.weekId,op(1130));assert(draft.state.draft.view.groceries.warnings.includes("uses-nominal-raw-preparation-yield-reference"));
 await db.close();db=await PGlite.create(directory);f=fixture(db,3,true);const changed=await f.send("readCurrent",{},1134);assert.equal(changed.outcome,"read");assert.equal(changed.state.revision,2);assert.equal(changed.state.current.view.outcome,"held");assert.equal(changed.state.draft.view.outcome,"held");assert.equal((await f.send("confirmNewWeek",{weekId:op(1140),expectedRevision:2},1135)).code,"saved_pantry_basis_changed");const rows=await db.query<{count:number}>("select count(*)::int as count from wd_reference_private.operations");assert.equal(rows.rows[0]!.count,2);
 }finally{if(db)await db.close();if(!resolve(directory).startsWith(resolve(tmpdir())+sep+"wd-nominal-raw-preparation-"))throw Error("Unsafe isolated cleanup target");await rm(directory,{recursive:true,force:true});}
});
