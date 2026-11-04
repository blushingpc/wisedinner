import { isKeyObject, isProxy } from "node:util/types";
import type { KeyObject } from "node:crypto";
import type { CurrentIntegrationRuntimeDependencies, CurrentLifecycleAdmission, CurrentLifecycleHandlers } from "./current-integration-runtime.server.ts";
import { createCurrentAccountLifecycle, type LifecycleAdmission } from "./current-account-lifecycle.server.ts";

import { UUID_DELETE_PROFILE, type CurrentUuidAuthScopeDependencies } from "./current-uuid-auth-scope.server.ts";
import { parseCurrentPrivateLifecycleMaterial, type PrivateLifecycleMaterial } from "./current-private-lifecycle-config.server.ts";
import { createCurrentRetentionCleanup, createCurrentRetentionRpcPorts, type CurrentRetentionCleanupDependencies } from "./current-retention-cleanup.server.ts";
import { appleDigest, appleOrigin, appleText, appleRead, appleUuid, appleHash, appleExact, appleIntent, appleEqual, APPLE_CUSTODY, createAppleClient } from "./apple-token-custody.server.ts";
import { supabaseDeletionAuthV2, deletionRecoveryHash, deletionIntentHash, DELETION_V2 } from "./account-deletion-v2.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { createCurrentUuidClaimScopeIssuer, type CurrentUuidClaimTemplate } from "./current-uuid-claim-scope.server.ts";
import { createCurrentUuidClaimAuthStrategy } from "./current-uuid-claim-auth.server.ts";
import { createCurrentUuidOriginalRecoveryStrategy } from "./current-uuid-original-recovery.server.ts";
import { createCurrentUuidReceiptCleanup } from "./current-uuid-receipt-cleanup.server.ts";
import { createAppleRpcRepository } from "./apple-token-custody.server.ts";

// Trusted PRIVATE material and independently admitted facts only. Neither a
// material label nor this explicit selection enables any default HTTP route.
export type CurrentUuidLifecycleHostConfiguration = Readonly<{
  enabled?: boolean; material?: PrivateLifecycleMaterial; template?: CurrentUuidClaimTemplate;
  ports?: Required<Pick<CurrentUuidAuthScopeDependencies, "observe" | "observeLocalDenial">>;
  retention?: Pick<CurrentRetentionCleanupDependencies, "schemaSha256" | "eraserSha256" | "maxRecords" | "freshnessMs" | "clockSkewMs" | "readAdmission">;
  verify: CurrentLifecycleAdmission["verify"]; request: typeof fetch; now: () => number;
  repositories?: CurrentLifecycleAdmission["repositories"];
}>;
type Port = NonNullable<CurrentIntegrationRuntimeDependencies["lifecycle"]>;
type Base = Omit<CurrentLifecycleAdmission, "preflight" | "cleanup">;
const held = Object.freeze({ outcome: "held" as const });

function data<T extends object>(value: T): T {
  if (isProxy(value) || !value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error("configuration");
  const ds = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(ds).some(k => typeof k !== "string" || !("value" in ds[k]))) throw Error("configuration");
  return Object.fromEntries(Object.entries(ds).map(([k, d]) => [k, d.value])) as T;
}
// Capture receiver and own function value once. Never touch fn.bind/name/length.
function method<T extends object, K extends keyof T>(receiver: T, key: K): T[K] {
  const fn = data(receiver)[key]; if (typeof fn !== "function" || isProxy(fn)) throw Error("configuration");
  return ((...args: unknown[]) => Reflect.apply(fn, receiver, args)) as T[K];
}
function keys(value: ReadonlyMap<string, Buffer> | undefined): ReadonlyMap<string, Buffer> {
  const result = new Map<string, Buffer>();
  if (value !== undefined && (isProxy(value) || Object.getPrototypeOf(value) !== Map.prototype || Reflect.ownKeys(value).length)) throw Error("configuration");
  if (value !== undefined) for (const [name, bytes] of Map.prototype.entries.call(value)) {
    if (typeof name !== "string" || isProxy(bytes) || !Buffer.isBuffer(bytes) || Object.getPrototypeOf(bytes) !== Buffer.prototype
      || Reflect.ownKeys(bytes).some(k => typeof k !== "string" || !/^(0|[1-9]\d*)$/.test(k))) throw Error("configuration");
    // Builtin iterator reads the typed-array slots, not an overridden valueOf.
    result.set(name, Buffer.from([...Uint8Array.prototype.values.call(bytes)]));
  }
  return result;
}
function capture(value: Base): Base {
  const v = data(value); appleOrigin(v.origin); appleText(v.serverCredential, 16384);
  if (typeof v.enabled !== "boolean") throw Error("configuration");
  const r = v.repositories && data(v.repositories), client = v.client && data(v.client);
  return Object.freeze({ enabled: v.enabled, origin: v.origin, serverCredential: v.serverCredential, verify: method(value, "verify"),
    ...(v.request ? { request: method(value, "request") } : {}), ...(v.now ? { now: method(value, "now") } : {}),
    ...(r ? { repositories: Object.freeze({ apple: Object.freeze({ command: method(r.apple, "command") }), deletion: Object.freeze({ account: method(r.deletion, "account"), worker: method(r.deletion, "worker") }) }) } : {}),
    ...(client ? { client: Object.freeze({ clientId: client.clientId, keys: method(v.client!, "keys"), exchange: method(v.client!, "exchange"), revoke: method(v.client!, "revoke") }) } : {}),
    keyVersion: v.keyVersion, keyring: keys(v.keyring),
    ...(v.applePolicy !== undefined ? { applePolicy: copyReferenceData(v.applePolicy) as Base["applePolicy"] } : {}),
    ...(v.deletionPolicy !== undefined ? { deletionPolicy: copyReferenceData(v.deletionPolicy) as Base["deletionPolicy"] } : {}),
  });
}

export function createCurrentUuidLifecycleHostAdapter(configuration?: CurrentUuidLifecycleHostConfiguration): Port {
  let base: Base | undefined, parser: ReturnType<typeof parseCurrentPrivateLifecycleMaterial> | undefined;
  let strategy: ReturnType<typeof createCurrentUuidClaimAuthStrategy> | undefined;
  let cleanup: ReturnType<typeof createCurrentRetentionCleanup> | undefined;
  let validUntil = 0, permittedOwners: ReadonlySet<string> = new Set();
  try {
    const c = data(configuration!);
    if (Object.keys(c).some(k => !["enabled","material","template","ports","retention","verify","request","now","repositories"].includes(k))) throw Error("configuration");
    const m = data(c.material!) as PrivateLifecycleMaterial & { toJSON?: unknown };
    if (Object.keys(m).some(k => !["origin","serverCredential","profile","profilePolicyVersion","clientId","teamId","keyId","signer","secretSeconds","keyVersion","keyring","applePolicy","deletionPolicy","validUntil","toJSON"].includes(k)) || m.profile !== UUID_DELETE_PROFILE) throw Error("material");
    if (isProxy(m.signer) || !isKeyObject(m.signer) || Object.values(Object.getOwnPropertyDescriptors(m.signer)).some(d => !("value" in d))) throw Error("signer");
    const signer = structuredClone(m.signer) as KeyObject;
    const { signer: ignored, toJSON: ignoredJson, ...fields } = m; void ignored; void ignoredJson;
    parser = parseCurrentPrivateLifecycleMaterial({ ...fields, privateKeyPem: signer.export({ type:"pkcs8",format:"pem" }).toString() });
    const material = parser.detach(0);
    if (!material || material.profilePolicyVersion !== UUID_DELETE_PROFILE) throw Error("material");
    const clock = method(configuration!,"now"), request = method(configuration!,"request");
    const client = createAppleClient({ clientId:material.clientId,teamId:material.teamId,keyId:material.keyId,signer:material.signer,secretSeconds:material.secretSeconds,timeoutMs:3000,now:clock },request);
    base = capture({ enabled:c.enabled===true,origin:material.origin,serverCredential:material.serverCredential,verify:method(configuration!,"verify"),request,now:clock,
      client,keyVersion:material.keyVersion,keyring:material.keyring,applePolicy:material.applePolicy,deletionPolicy:material.deletionPolicy,...(c.repositories?{repositories:c.repositories}:{}) });
    if (c.enabled!==true || !c.template || !c.ports || !c.retention) throw Error("admission");
    const template = data(c.template), p = data(c.ports), r = data(c.retention);
    if (Object.keys(p).sort().join()!=="observe,observeLocalDenial" || Object.keys(r).some(k=>!["schemaSha256","eraserSha256","maxRecords","freshnessMs","clockSkewMs","readAdmission"].includes(k))
      || appleDigest(template.deletionPolicy)!==appleDigest(material.deletionPolicy) || appleDigest(template.custodyPolicy)!==appleDigest(material.applePolicy)) throw Error("policy");
    appleExact(template,["deletionPolicy","custodyPolicy","expectedCatalogSha256","expectedEngineSha256","writerManifestSha256","writerCatalogSha256","validUntil","maxObservationAgeMs","selectors"]);
    for(const h of [template.expectedCatalogSha256,template.expectedEngineSha256,template.writerManifestSha256,template.writerCatalogSha256])appleHash(h);
    if(!Number.isSafeInteger(template.maxObservationAgeMs)||template.maxObservationAgeMs<1||template.maxObservationAgeMs>8000)throw Error("freshness");
    validUntil = Date.parse(template.validUntil);
    // The trusted operator selectors bind owners, not a predicted future claim.
    // Descriptor-copy the list before reading selector metadata.
    if (isProxy(template.selectors) || !Array.isArray(template.selectors)) throw Error("selectors");
    const ds=Object.getOwnPropertyDescriptors(template.selectors);
    if(Reflect.ownKeys(ds).length!==template.selectors.length+1||Object.values(ds).some(d=>!("value" in d)))throw Error("selectors");
    permittedOwners = new Set(Array.prototype.map.call(template.selectors,(s:unknown)=>appleUuid(data(s as {userId:string}).userId)) as string[]);
    const observe=method(c.ports,"observe"), observeLocalDenial=method(c.ports,"observeLocalDenial");
    const repository=base.repositories?.apple ?? createAppleRpcRepository(base.origin,base.serverCredential,request);
    const identity=supabaseDeletionAuthV2(base.origin,base.serverCredential,request,3000).verifyIdentity;
    const issuer=createCurrentUuidClaimScopeIssuer({template,repository,observe,now:clock,async readIdentity(userId){const value=await identity(userId);return value?{outcome:"present",identity:value,observedAt:new Date(clock()).toISOString()}:{outcome:"unknown"};}});
    const receipt=createCurrentUuidReceiptCleanup({policy:material.deletionPolicy,now:clock,timeoutMs:3000,maxObservationAgeMs:3000,async rpc(name,body){
      const response=await request(base!.origin+"/rest/v1/rpc/"+name,{method:"POST",redirect:"error",signal:AbortSignal.timeout(3000),headers:{apikey:base!.serverCredential,authorization:"Bearer "+base!.serverCredential,"content-type":"application/json"},body:JSON.stringify({p:body})});
      if(!response.ok)throw Error("receipt_unknown");return parseReferenceJson(await appleRead(response.body,16384));
    }});
    const recovery=createCurrentUuidOriginalRecoveryStrategy({origin:base.origin,serverCredential:base.serverCredential,request,repository,policy:material.deletionPolicy,now:clock,timeoutMs:3000});
    strategy=createCurrentUuidClaimAuthStrategy({origin:base.origin,serverCredential:base.serverCredential,repository,issuer,observe,observeLocalDenial,deletionPolicy:material.deletionPolicy,custodyPolicy:material.applePolicy,request,now:clock,timeoutMs:3000,receiptCleanup:receipt,originalRecovery:recovery});
    const ports=createCurrentRetentionRpcPorts(base.origin,base.serverCredential,request);
    cleanup=createCurrentRetentionCleanup({deletionPolicy:material.deletionPolicy,custodyPolicy:material.applePolicy,schemaSha256:r.schemaSha256,eraserSha256:r.eraserSha256,maxRecords:r.maxRecords,freshnessMs:r.freshnessMs,clockSkewMs:r.clockSkewMs,readAdmission:method(c.retention,"readAdmission"),repository:ports,eraseExpired:ports.eraseExpired,clock});
  } catch { strategy=undefined; cleanup=undefined; }
  const original=base, admittedStrategy=strategy, retention=cleanup;
  function compose(value:Base): CurrentLifecycleAdmission {
    return Object.freeze({...capture(value),preflight:async()=>held,cleanup:retention??{verify:async()=>held}});
  }
  let admission: CurrentLifecycleAdmission|undefined;
  try{if(original)admission=compose(original);}catch{ /* off */ }
  return Object.freeze({...(admission?{admission}:{}),create(supplied?:CurrentLifecycleAdmission):CurrentLifecycleHandlers{
    let current:ReturnType<typeof compose>|undefined;
    try{if(original){const candidate=supplied?data(supplied):original;
      if(candidate.origin!==original.origin||candidate.serverCredential!==original.serverCredential)throw Error("target");
      current=compose({...original,enabled:candidate.enabled,client:candidate.client?original.client:undefined,keyVersion:candidate.keyVersion,keyring:candidate.keyring,applePolicy:candidate.applePolicy,deletionPolicy:candidate.deletionPolicy});}}
    catch{current=undefined;}
    const actual=createCurrentAccountLifecycle(current?{...current,uuidAuth:admittedStrategy} as LifecycleAdmission:undefined);
    const handle=(kind:"custody"|"deletion")=>async(request:Request)=>{
      try{
        const body=data(parseReferenceJson(await appleRead(request.clone().body,kind==="custody"?32768:16384,request.signal)) as Record<string,unknown>);
        if(body.operation==="status")return await actual[kind](request);
        if(!current?.enabled||!admittedStrategy||!retention||!parser?.detach(current.now!())||!Number.isFinite(validUntil)||validUntil<=current.now!()
          ||!current.client||!current.keyVersion||current.keyring?.get(current.keyVersion)?.length!==32
          ||appleDigest(current.deletionPolicy)!==appleDigest(original!.deletionPolicy)||appleDigest(current.applePolicy)!==appleDigest(original!.applePolicy)
          ||current.keyVersion!==original!.keyVersion||!current.keyring.get(current.keyVersion)!.equals(original!.keyring!.get(original!.keyVersion!)!))return await createCurrentAccountLifecycle()[kind](request);
        const owner=copyReferenceData(await current.verify(request)) as Awaited<ReturnType<Base["verify"]>>;
        if(permittedOwners.size!==1||!permittedOwners.has(owner.id))return await createCurrentAccountLifecycle()[kind](request);
        const type=request.headers.get("content-type"),length=request.headers.get("content-length");
        if(request.method!=="POST"||!/^application\/json(?:\s*;|\s*$)/i.test(type??"")||!/^Bearer [^\s]+$/.test(request.headers.get("authorization")??"")||request.headers.has("content-encoding")||new URL(request.url).search)throw Error("request");
        if(length!==null&&(!/^(0|[1-9]\d*)$/.test(length)||Number(length)>32768))throw Error("request");
        if(kind==="deletion"){
          const preparing=body.operation==="prepare";
          if(!preparing&&body.operation!=="confirm"||body.contract!==DELETION_V2)throw Error("operation");
          appleExact(body,["contract","operation","operationId","expectedAccountRevision",...(preparing?[]:["intentSha256","confirmation"])]);
          const id=appleUuid(body.operationId),revision=body.expectedAccountRevision;
          if(!Number.isSafeInteger(revision)||Number(revision)<1)throw Error("revision");
          const recovery=deletionRecoveryHash(id,request.headers.get("x-wd-deletion-recovery")??"");
          const intent=deletionIntentHash(owner.id,id,Number(revision),recovery,appleDigest(current.deletionPolicy));
          if(request.headers.get("x-wd-deletion-intent-sha256")!==intent||!preparing&&(body.intentSha256!==intent||body.confirmation!=="DELETE MY ACCOUNT"))throw Error("intent");
          if(!preparing&&(owner.authenticatedAt===null||owner.authenticatedAt>current.now!()/1000||current.now!()/1000-owner.authenticatedAt>300))throw Error("recent_auth");
        }else{
          appleExact(body,["contract","operation","operationId","authorizationCode","identityToken","nonce"]);
          if(body.contract!==APPLE_CUSTODY||body.operation!=="exchange")throw Error("operation");
          const id=appleUuid(body.operationId),nonce=appleUuid(body.nonce),code=appleText(body.authorizationCode,4096),token=appleText(body.identityToken,20480);
          if(!/^[\x21-\x7e]+$/.test(code)||!appleEqual(request.headers.get("x-wd-apple-intent-sha256")??"",appleIntent(owner.id,id,code,token,nonce,current.client.clientId,appleDigest(current.applePolicy))))throw Error("intent");
          deletionRecoveryHash(appleUuid(request.headers.get("x-wd-deletion-operation-id")),request.headers.get("x-wd-deletion-recovery")??"");
        }
        // Existing maintained service owns public command/recent-auth/capability
        // validation. No final ScopeAdmission is demanded before prepare.
        return await actual[kind](request);
      }catch{return await createCurrentAccountLifecycle()[kind](request);}
    };
    return Object.freeze({custody:handle("custody"),deletion:handle("deletion")});
  }});
}
