import { createDeletionV2RpcRepository } from "./account-deletion-v2.server.ts";
import { createCurrentOriginalStatusHandler } from "./current-original-status-recovery.server.ts";
import { CURRENT_CONTACT_CATALOG_IDENTITY, CURRENT_CONTACT_CATALOG_PROFILE } from "./current-legacy-contact-catalog-profile.server.ts";
import { AsyncLocalStorage } from "node:async_hooks";
import { isProxy } from "node:util/types";
import { createCurrentLifecycleHostAdapter } from "./current-lifecycle-host-admission.server.ts";
import { supabaseVerifier, type VerifiedAccount } from "./account.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { parseCurrentPrivateLifecycleMaterial } from "./current-private-lifecycle-config.server.ts";
import { createCurrentUuidLifecycleHostAdapter, type CurrentUuidLifecycleHostConfiguration } from "./current-uuid-lifecycle-host-admission.server.ts";
import { createCurrentUuidScopeRpcPorts, createCurrentSparseUuidScopeRpcPorts, createCurrentContactUuidScopeRpcPorts } from "./current-uuid-scope-rpc.server.ts";
import { CURRENT_SPARSE_CATALOG_IDENTITY, CURRENT_SPARSE_CATALOG_PROFILE } from "./current-sparse-catalog-profile.server.ts";
import { appleRead, appleDigest, appleHttp, appleExact, appleUuid, appleHash, checkedApple, createAppleRpcRepository, type AppleRepository } from "./apple-token-custody.server.ts";
import type { CurrentIntegrationRuntimeDependencies } from "./current-integration-runtime.server.ts";

/** Server-only operator material. Existing Apple names are reused (PREVIEW was
 * observed configured, not production verified). No value is exported/logged.
 * JSON contains profile/profilePolicyVersion, secretSeconds, keyVersion,
 * keyring:{version:canonicalBase64}, applePolicy, deletionPolicy, validUntil.
 * Policies, key custody and validity require independent operator admission;
 * this loader neither supplies defaults nor renews their expiry. */
export const CURRENT_LIFECYCLE_CONFIGURATION_NAMES = Object.freeze([
  "WD_CURRENT_UUID_LIFECYCLE_ENABLED", "WD_CURRENT_LIFECYCLE_MATERIAL_JSON", "WD_CURRENT_INTEGRATION_HOST_ORIGIN",
  "APPLE_SIGNIN_PRIVATE_KEY", "APPLE_SIGNIN_KEY_ID", "APPLE_SIGNIN_TEAM_ID", "APPLE_SIGNIN_CLIENT_ID",
  "SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY",
] as const);
export type CurrentOwnerLifecycleInputs = Readonly<{
  template: NonNullable<CurrentUuidLifecycleHostConfiguration["template"]>;
  retention: NonNullable<CurrentUuidLifecycleHostConfiguration["retention"]>;
  observer: Readonly<{ profile: "strict" } | { profile: typeof CURRENT_SPARSE_CATALOG_PROFILE; catalogIdentity: typeof CURRENT_SPARSE_CATALOG_IDENTITY } | { profile: typeof CURRENT_CONTACT_CATALOG_PROFILE; catalogIdentity: typeof CURRENT_CONTACT_CATALOG_IDENTITY }>;
}>;
/** Trusted maintained server producer, never an endpoint/body/env JSON port.
 * Called with actual authenticated owner, not a predicted operation/work claim.
 * Selectors must independently project accepted bounded retained evidence.
 * No copying observe() results into expected retention/catalog authority.
 * A missing producer holds new mutations; original status remains the accepted
 * repository path. Source catalog identity only chooses a named observer. */
export type CurrentIntegrationPrivateConfiguration = Readonly<{
  forOwner(owner: Readonly<Omit<VerifiedAccount,"providers"> & { providers: readonly string[] }>): Promise<CurrentOwnerLifecycleInputs | null>;
}>;
const privatePorts = new AsyncLocalStorage<CurrentIntegrationPrivateConfiguration["forOwner"]>();
function data(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value) || isProxy(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("configuration");
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).some(k => typeof k !== "string" || !("value" in ds[k]))) throw Error("configuration");
  return Object.fromEntries(Object.entries(ds).map(([k,d])=>[k,d.value]));
}
/** Explicit server composition boundary. Async context cannot leak owner ports
 * between concurrent requests. Captures receiver without Function.bind/name. */
export function withCurrentIntegrationPrivateConfiguration<T>(ports: CurrentIntegrationPrivateConfiguration, work: () => T): T {
  const fn = data(ports).forOwner;
  if (typeof fn !== "function" || isProxy(fn)) throw Error("configuration");
  return privatePorts.run(owner => Reflect.apply(fn, ports, [owner]), work);
}
function environment(value: unknown): Record<string,string | undefined> {
  // process.env has a special prototype, so inspect only exact own names.
  if (!value || typeof value !== "object" || isProxy(value)) throw Error("configuration");
  const out: Record<string,string | undefined> = Object.create(null);
  for (const k of CURRENT_LIFECYCLE_CONFIGURATION_NAMES) {
    const d=Object.getOwnPropertyDescriptor(value,k);
    if (d && (!("value" in d) || d.value!==undefined && typeof d.value!=="string")) throw Error("configuration");
    out[k]=d?.value;
  }
  return out;
}
export async function resolveCurrentIntegrationLifecycleConfiguration(value: unknown, request: Request, transport: typeof fetch = fetch, now: () => number = Date.now): Promise<CurrentIntegrationRuntimeDependencies["lifecycle"]> {
  try {
    const c=environment(value);

    const url=new URL(request.url), type=request.headers.get("content-type"), length=request.headers.get("content-length");
    const deleting=url.pathname==="/api/v1/account/deletion-v2", limit=deleting?16384:32768;
    if(request.method!=="POST" || request.signal.aborted || url.origin!==c.WD_CURRENT_INTEGRATION_HOST_ORIGIN || url.search || url.hash
      || !["/api/v1/account/deletion-v2","/api/v1/account/apple-credential"].includes(url.pathname)
      || !/^application\/json(?:\s*;|\s*$)/i.test(type??"") || request.headers.has("content-encoding")
      || length!==null && (!/^(0|[1-9]\d*)$/.test(length)||Number(length)>limit)) return undefined;
    const lifecycle=request.headers.get("x-wd-deletion-lifecycle");
    if(deleting && lifecycle!==null && lifecycle!=="wd-prepared-retirement-v1") return undefined;
    let bytes=0;
    const counter=new TransformStream<Uint8Array,Uint8Array>({transform(chunk,controller){bytes+=chunk.byteLength;controller.enqueue(chunk);}});
    const bodyText=await appleRead(request.clone().body?.pipeThrough(counter)??null,limit,request.signal);
    if(length!==null && Number(length)!==bytes) return undefined;
    const body=data(parseReferenceJson(bodyText));
    const origin=c.SUPABASE_URL??c.NEXT_PUBLIC_SUPABASE_URL, publicKey=c.SUPABASE_ANON_KEY??c.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if(origin!=="https://zpvqxtklvjitofpbddrn.supabase.co" || !c.SUPABASE_SERVICE_ROLE_KEY) return undefined;
    if(deleting && body.operation==="status") {
      const deletion=createCurrentOriginalStatusHandler({origin,serverCredential:c.SUPABASE_SERVICE_ROLE_KEY,request:transport,now,timeoutMs:3000});
      return Object.freeze({create(){return Object.freeze({deletion,custody:createCurrentLifecycleHostAdapter().create().custody});}});
    }
    if(body.operation==="status" && publicKey) return createCurrentLifecycleHostAdapter({admission:{enabled:true,origin,serverCredential:c.SUPABASE_SERVICE_ROLE_KEY,verify:supabaseVerifier(origin,publicKey,transport,now),request:transport,now}});
    if(c.WD_CURRENT_UUID_LIFECYCLE_ENABLED!=="true" || !publicKey) return undefined;
    const verify=supabaseVerifier(origin,publicKey,transport,now);
    const text=c.WD_CURRENT_LIFECYCLE_MATERIAL_JSON;
    if(!text || text.length>131072 || !origin || !publicKey || !c.SUPABASE_SERVICE_ROLE_KEY) return undefined;
    const raw=data(parseReferenceJson(text));
    const allowed=["profile","profilePolicyVersion","secretSeconds","keyVersion","keyring","applePolicy","deletionPolicy","validUntil"];
    if(Object.keys(raw).some(k=>!allowed.includes(k))) return undefined;
    const encoded=data(raw.keyring), keyring=new Map<string,Buffer>();
    for(const [name,v] of Object.entries(encoded)) {
      if(typeof v!=="string" || v.length!==44) throw Error("keyring");
      const b=Buffer.from(v,"base64");if(b.length!==32 || b.toString("base64")!==v) throw Error("keyring");
      keyring.set(name,b);
    }
    const material=parseCurrentPrivateLifecycleMaterial({...raw,origin,serverCredential:c.SUPABASE_SERVICE_ROLE_KEY,keyring,
      clientId:c.APPLE_SIGNIN_CLIENT_ID,teamId:c.APPLE_SIGNIN_TEAM_ID,keyId:c.APPLE_SIGNIN_KEY_ID,privateKeyPem:c.APPLE_SIGNIN_PRIVATE_KEY}).detach(now());
    if(!material) return undefined;
    const producer=privatePorts.getStore();
    // Do not load a current-owner template for status. Bodyless-original status
    // keeps the original repository/policy and requires no new final proof.
    // clone is read only to choose that safe route; actual service validates it.
    let inputs: CurrentOwnerLifecycleInputs | null=null;
    if(producer) {
      const owner=await verify(request);
      let timer: ReturnType<typeof setTimeout> | undefined;
      try { inputs=await Promise.race([producer(Object.freeze({...owner,providers:Object.freeze([...owner.providers])})),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("private_read_timeout")),3000);})]); }
      finally {clearTimeout(timer);}
      if(request.signal.aborted || !Number.isSafeInteger(now()) || now()>=Date.parse(material.validUntil)) return undefined;
      if(inputs) inputs=data(inputs) as CurrentOwnerLifecycleInputs;
      if(inputs) {
        const i=data(inputs),t=data(i.template),o=data(i.observer);
        if(Object.keys(i).sort().join()!=="observer,retention,template" || Object.keys(o).sort().join()!==(o.profile==="strict"?"profile":"catalogIdentity,profile")) return undefined;
        if(appleDigest(t.deletionPolicy)!==appleDigest(material.deletionPolicy)||appleDigest(t.custodyPolicy)!==appleDigest(material.applePolicy)) return undefined;
        const selectors=t.selectors;
        if(!Array.isArray(selectors)||isProxy(selectors)||Object.getPrototypeOf(selectors)!==Array.prototype||Reflect.ownKeys(selectors).length!==selectors.length+1) return undefined;
        for(const d of Object.values(Object.getOwnPropertyDescriptors(selectors))) if(!("value" in d)) return undefined;
        if(!selectors.length || Array.prototype.some.call(selectors,(s:unknown)=>data(s).userId!==owner.id)) return undefined;
        if(o.profile!=="strict" && !(o.profile===CURRENT_SPARSE_CATALOG_PROFILE && o.catalogIdentity===CURRENT_SPARSE_CATALOG_IDENTITY) && !(o.profile===CURRENT_CONTACT_CATALOG_PROFILE && o.catalogIdentity===CURRENT_CONTACT_CATALOG_IDENTITY)) return undefined;
      }
    }
    const admitted=inputs && data(inputs),observer=admitted && data(admitted.observer);
    // Each issuer-generated request (including its fresh authorizationId and
    // final digest) is bound before transport construction. No future claim is
    // stored globally and no observed response is converted into admission.
    const factory=observer?.profile===CURRENT_CONTACT_CATALOG_PROFILE?createCurrentContactUuidScopeRpcPorts:observer?.profile===CURRENT_SPARSE_CATALOG_PROFILE?createCurrentSparseUuidScopeRpcPorts:createCurrentUuidScopeRpcPorts;
    const ports={
      async observe(q: Parameters<ReturnType<typeof factory>["observe"]>[0]) {return factory({origin,serverCredential:material.serverCredential,expectedRequest:q,request:transport,now}).observe(q);},
      async observeLocalDenial(q: Parameters<ReturnType<typeof factory>["observe"]>[0]) {return factory({origin,serverCredential:material.serverCredential,expectedRequest:q,request:transport,now}).observeLocalDenial(q);},
    };
    const concrete=createAppleRpcRepository(origin,material.serverCredential,transport),command=concrete.command;
    // The issuer consumes this exact non-authorizing SQL read sentinel. The
    // general repository intentionally throws on it for other consumers. Decode
    // ONLY this fixed successful read, never a thrown/lost/extra-field reply.
    const apple:AppleRepository=Object.freeze({async command(ns,action,body){
      if(ns!=="deletion"||action!=="auth_original")return Reflect.apply(command,concrete,[ns,action,body]);
      const target=appleExact(body,["userId","identityHash","operationId"]);
      appleUuid(target.userId);appleHash(target.identityHash);appleUuid(target.operationId);
      const reply=await appleHttp(origin+"/rest/v1/rpc/wd_apple_deletion_command",{method:"POST",headers:{apikey:material.serverCredential,authorization:"Bearer "+material.serverCredential,"content-type":"application/json"},body:JSON.stringify({p_action:"auth_original",p_body:target})},transport,16384,3000);
      if(reply.status!==200)throw Error("original_read_unavailable");
      const row=data(parseReferenceJson(reply.text));
      if(Object.keys(row).length===1&&row.error==="original_unresolved")return Object.freeze({error:"original_unresolved"});
      return checkedApple(row);
    }});
    return createCurrentUuidLifecycleHostAdapter({enabled:true,material,verify,request:transport,now,repositories:{apple,deletion:createDeletionV2RpcRepository(origin,material.serverCredential,transport)},
      ...(inputs?{template:{...inputs.template,validUntil:new Date(Math.min(Date.parse(inputs.template.validUntil),Date.parse(material.validUntil))).toISOString()},retention:inputs.retention,ports}:{})});
  }catch{return undefined;}
}




