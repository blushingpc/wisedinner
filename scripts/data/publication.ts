// No live writer binding. Staging and publication are separate, explicitly injected boundaries.
import {createHash} from "node:crypto";
import {validateSnapshot} from "../../packages/solver/src/snapshot.ts";
import {guardContinuity} from "./guards.ts";
import type {Snapshot} from "../../packages/solver/src/types.ts";
const sha=(bytes:Uint8Array)=>createHash("sha256").update(bytes).digest("hex");
export type StageChecks={sources:(s:Snapshot)=>string[];acceptance:(s:Snapshot)=>Promise<string[]>;fixtures:(s:Snapshot)=>Promise<Record<string,unknown>>};
const sealed=new WeakMap<object,string>();
function freeze(value:unknown){if(value&&typeof value==="object"){for(const child of Object.values(value))freeze(child);Object.freeze(value);}}
export type Stage={manifest:{status:"accepted";version:number;expected_previous:number;sha256:string;bytes:number;fixtures_sha256:string};bytes:Uint8Array;fixtures:Record<string,unknown>};
export async function stageSnapshot(raw:unknown,previous:Snapshot|null,checks:StageChecks):Promise<Stage>{
 const snapshot=structuredClone(validateSnapshot(raw));
 freeze(snapshot);
 if(!Number.isInteger(snapshot.version)||snapshot.version<1)throw new Error("Invalid version");
 const problems=[...guardContinuity(snapshot,previous,.3),...checks.sources(snapshot),...await checks.acceptance(snapshot)];
 if(problems.length)throw new Error(`Stage rejected: ${problems.join("; ")}`);
 // Any fixture failure precedes every writer. These fixtures must derive from this exact candidate.
 const fixtures=await checks.fixtures(snapshot),bytes=new TextEncoder().encode(JSON.stringify(snapshot));
 const result:Stage={manifest:{status:"accepted",version:snapshot.version,expected_previous:previous?.version??0,sha256:sha(bytes),bytes:bytes.length,fixtures_sha256:sha(new TextEncoder().encode(JSON.stringify(fixtures)))},bytes,fixtures};
 sealed.set(result,JSON.stringify(result.manifest));return result;
}
export type Publisher={
 putIfAbsent:(version:number,bytes:Uint8Array)=>Promise<{url:string;storedBytes:Uint8Array}>;
 commitPointer:(expected:number,version:number,url:string,hash:string)=>Promise<{currentVersion:number}>;
 mirror:(stage:Stage)=>Promise<void>;
};
export async function publishStaged(stage:Stage,writer:Publisher){
 if(sealed.get(stage)!==JSON.stringify(stage.manifest)||sha(stage.bytes)!==stage.manifest.sha256||stage.bytes.length!==stage.manifest.bytes||sha(new TextEncoder().encode(JSON.stringify(stage.fixtures)))!==stage.manifest.fixtures_sha256||JSON.parse(new TextDecoder().decode(stage.bytes)).version!==stage.manifest.version)throw new Error("Stage missing or changed; rerun acceptance");
 const {version,sha256,expected_previous}=stage.manifest;
 const object=await writer.putIfAbsent(version,stage.bytes);
 if(sha(object.storedBytes)!==sha256 || Buffer.compare(Buffer.from(object.storedBytes),Buffer.from(stage.bytes))!==0)throw new Error("Stored bytes differ; pointer untouched");
 const pointer=await writer.commitPointer(expected_previous,version,object.url,sha256);
 if(pointer.currentVersion!==version)return {version,state:"superseded" as const,mirror:false};
 try{await writer.mirror(stage);return {version,state:"published" as const,mirror:true};}
 catch{return {version,state:"published-mirror-pending" as const,mirror:false};}
}
