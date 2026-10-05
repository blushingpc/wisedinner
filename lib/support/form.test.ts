import assert from "node:assert/strict";
import {test} from "node:test";
import {supportFormHandler} from "./form.ts";
const valid={name:"Test",email:["test","example.invalid"].join("@"),message:"A test request"};
const req=(body:unknown)=>new Request("https://test.invalid/api/support",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
test("actual support form path bounds bytes/shape and ignores honeypots before storage",async()=>{
 let writes=0;const handler=supportFormHandler({configured:()=>true,limited:()=>false,insert:async()=>{writes++;return {ok:true,status:201};}});
 for(const body of [{...valid,user_id:"forged"},{...valid,message:42},{...valid,name:"x".repeat(121)},{...valid,message:"x".repeat(9000)}])assert.ok((await handler(req(body))).status>=400);
 assert.equal((await handler(req({...valid,website:"robot"}))).status,200);assert.equal(writes,0);
 assert.equal((await handler(req(valid))).status,200);assert.equal(writes,2);
});
test("form config, abuse fallback and storage failure never disclose provider details",async()=>{
 for(const [configured,limited,status] of [[false,false,503],[true,true,429]] as const){const handler=supportFormHandler({configured:()=>configured,limited:()=>limited,insert:async()=>{throw Error("must not call");}});assert.equal((await handler(req(valid))).status,status);}
 for(const failure of [1,2]){let n=0;const handler=supportFormHandler({configured:()=>true,limited:()=>false,insert:async()=>{if(++n===failure)throw Error("private provider diagnostic");return {ok:true,status:201};}});const r=await handler(req(valid));assert.equal(r.status,502);assert.doesNotMatch(await r.text(),/private|diagnostic/);assert.equal(n,failure);}
});
