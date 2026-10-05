import {test} from "node:test";
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {readFileSync} from "node:fs";
import {miniSnapshot} from "../../packages/solver/test/helpers.ts";
import {stageSnapshot,publishStaged,type Publisher,type StageChecks} from "./publication.ts";
import {publish} from "./snapshot.ts";
import {supabasePublisher} from "./publication-adapter.ts";
const checks:StageChecks={sources:()=>[],acceptance:async()=>[],fixtures:async s=>({synthetic:true,version:s.version})};
const next=()=>({...miniSnapshot(),version:2});
const staged=()=>stageSnapshot(next(),miniSnapshot(),checks);
test("prepared stage-only workflow has no write permission, secret bindings or public commands",()=>{
 const workflow=readFileSync(".github/workflows/weekly-drop.yml","utf8");
 assert.match(workflow,/permissions:\s*contents: read/);
 assert.doesNotMatch(workflow,/secrets\.|contents: write|git push|gen-fixtures|gen-drop|data:pipeline|data:local/);
 assert.match(workflow,/scripts\/data\/run\.ts --stage=data\/pipeline\/staging\//);
 assert.match(workflow,/run: npm test/);assert.match(workflow,/run: npx tsc --noEmit/);
});
function writer(){
 const objects=new Map<number,{url:string;bytes:Uint8Array;hash:string}>();let pointer=1,mirrors=0,failUpload=false,failPointer=false,failMirror=false;
 const w:Publisher={putIfAbsent:async(v,bytes)=>{if(failUpload)throw Error("upload");const h=createHash("sha256").update(bytes).digest("hex"),old=objects.get(v);if(old&&old.hash!==h)throw Error("immutable conflict");if(!old)objects.set(v,{url:`https://example.invalid/snapshots/v${v}.json`,bytes:bytes.slice(),hash:h});return {url:objects.get(v)!.url,storedBytes:objects.get(v)!.bytes.slice()};},commitPointer:async(expected,v)=>{if(failPointer)throw Error("pointer");if(pointer===v)return {currentVersion:pointer};if(pointer!==expected)throw Error("competing pointer");pointer=v;return {currentVersion:pointer};},mirror:async()=>{if(failMirror)throw Error("mirror");mirrors++;}};
 return {w,objects,get pointer(){return pointer;},get mirrors(){return mirrors;},fail:(kind:string)=>{failUpload=kind==="upload";failPointer=kind==="pointer";failMirror=kind==="mirror";}};
}
test("source, schema, fixture and test rejection precedes any writer and preserves public file",async()=>{
 const before=readFileSync("data/snapshot.json");
 for(const bad of [{...checks,sources:()=>["identity"]},{...checks,acceptance:async()=>["test"]},{...checks,fixtures:async()=>{throw Error("fixture");}}])await assert.rejects(stageSnapshot(next(),miniSnapshot(),bad));
 await assert.rejects(stageSnapshot({},miniSnapshot(),checks));await assert.rejects(publish(next(),true),/disabled/);assert.deepEqual(readFileSync("data/snapshot.json"),before);
});
test("exact stored bytes, upload/pointer faults and interrupted immutable retry",async()=>{
 const s=await staged(),p=writer();p.fail("upload");await assert.rejects(publishStaged(s,p.w));assert.equal(p.pointer,1);assert.equal(p.objects.size,0);
 p.fail("pointer");await assert.rejects(publishStaged(s,p.w));assert.equal(p.pointer,1);assert.equal(p.objects.size,1);p.fail("");assert.equal((await publishStaged(s,p.w)).state,"published");assert.equal(p.pointer,2);
 const old=p.w.putIfAbsent;p.w.putIfAbsent=async(...args)=>({...await old(...args),storedBytes:new TextEncoder().encode("changed")});await assert.rejects(publishStaged(s,p.w),/bytes differ/);
});
test("immutable version conflict, competing attempts and mirror failure remain separate boundaries",async()=>{
 const p=writer(),s=await staged();const other=await stageSnapshot({...next(),generated_at:"2026-10-04"},miniSnapshot(),checks);
 p.fail("mirror");assert.equal((await publishStaged(s,p.w)).state,"published-mirror-pending");assert.equal(p.pointer,2);assert.equal(p.mirrors,0);
 await assert.rejects(publishStaged(other,p.w),/immutable conflict/);p.fail("");assert.equal((await publishStaged(s,p.w)).state,"published");
 const p2=writer();p2.w.commitPointer=async()=>{throw Error("competing pointer");};await assert.rejects(publishStaged(s,p2.w));assert.equal(p2.pointer,1);assert.equal(p2.objects.size,1);
});
test("mutation, rehydrated fake acceptance and stale superseded retry cannot mirror old data",async()=>{
 const s=await staged(),p=writer();s.bytes[0]=0;await assert.rejects(publishStaged(s,p.w),/changed/);
 await assert.rejects(publishStaged({...await staged()},p.w),/missing or changed/);
 const good=await staged();p.w.commitPointer=async()=>({currentVersion:3});assert.equal((await publishStaged(good,p.w)).state,"superseded");assert.equal(p.mirrors,0);
 await assert.rejects(stageSnapshot(next(),miniSnapshot(),{...checks,sources:s=>{s.nutrition[0].kcal=99;return [];}}),/read only/);
});
test("prepared storage adapter uses non-upsert bytes/readback and CAS without any real service",async()=>{
 const s=await staged(),calls:{url:string;options?:RequestInit}[]=[];
 const request:typeof fetch=async(url,options)=>{calls.push({url:String(url),options});if(String(url).includes("/rpc/"))return Response.json({currentVersion:2});if(options?.method==="POST")return new Response("duplicate",{status:400});return new Response(Buffer.from(s.bytes));};
 assert.throws(()=>supabasePublisher({url:"https://fixture.supabase.co",serviceKey:"synthetic",enabled:false},async()=>{},request),/disabled/);
 const p=supabasePublisher({url:"https://fixture.supabase.co",serviceKey:"synthetic",enabled:true},async()=>{},request);
 assert.equal((await publishStaged(s,p)).state,"published");assert.equal(calls.length,3);
 assert.equal((calls[0].options!.headers as Record<string,string>)["x-upsert"],"false");
 assert.deepEqual(calls[0].options!.body,Buffer.from(s.bytes));
 assert.ok(calls[2].url.endsWith("wd_publish_pointer"));
});
