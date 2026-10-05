// Prepared adapter only. No CLI, environment auto-loading, bucket activation or default live binding.
import type {Publisher,Stage} from "./publication.ts";
export function supabasePublisher(config:{url:string;serviceKey:string;enabled:boolean},mirror:(s:Stage)=>Promise<void>,request:typeof fetch=fetch):Publisher {
 if(!config.enabled||!/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.url)||!config.serviceKey)throw new Error("Publisher disabled or configuration unavailable");
 const headers={apikey:config.serviceKey,authorization:`Bearer ${config.serviceKey}`};
 return {
  putIfAbsent:async(version,bytes)=>{
   const path=`data/snapshots/v${version}.json`,endpoint=`${config.url}/storage/v1/object/${path}`;
   const res=await request(endpoint,{method:"POST",headers:{...headers,"content-type":"application/json","x-upsert":"false"},body:Buffer.from(bytes),signal:AbortSignal.timeout(20_000)});
   // Existing object after an interrupted upload is verified, never overwritten. Other failed uploads stop.
   if(!res.ok && res.status!==409 && res.status!==400)throw new Error("Immutable storage upload unavailable");
   const stored=await request(endpoint,{headers,cache:"no-store",signal:AbortSignal.timeout(20_000)});
   if(!stored.ok || Number(stored.headers.get("content-length"))>16_777_216)throw new Error("Stored object verification unavailable");
   const reader=stored.body?.getReader();if(!reader)throw new Error("Stored object unavailable");const chunks:Uint8Array[]=[];let size=0;
   while(true){const r=await reader.read();if(r.done)break;size+=r.value.length;if(size>16_777_216){await reader.cancel();throw new Error("Stored object too large");}chunks.push(r.value);}
   return {url:`${config.url}/storage/v1/object/public/${path}`,storedBytes:Buffer.concat(chunks)};
  },
  commitPointer:async(expected,version,url,hash)=>{
   const res=await request(`${config.url}/rest/v1/rpc/wd_publish_pointer`,{method:"POST",headers:{...headers,"content-type":"application/json"},body:JSON.stringify({p_expected:expected,p_version:version,p_url:url,p_sha:hash}),signal:AbortSignal.timeout(15_000)});
   if(!res.ok)throw new Error("Pointer commit failed; keep object and last-good pointer, retry only same accepted stage");
   const j=await res.json();if(!Number.isInteger(j.currentVersion)||j.currentVersion<version)throw new Error("Pointer response invalid");return {currentVersion:j.currentVersion};
  },mirror,
 };
}
