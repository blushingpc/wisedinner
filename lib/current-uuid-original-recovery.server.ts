import { types } from "node:util";
import type { DeletionTarget, DeletionProof } from "./account-deletion.ts";
import { inspectDeletionV2Policy, type DeletionV2Policy } from "./account-deletion-v2.server.ts";
import { appleExact, appleUuid, appleHash, appleOrigin, appleText, appleDigest, appleHttp, type AppleData, type AppleRepository } from "./apple-token-custody.server.ts";
import { copyReferenceData } from "./generated-plan-data.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { UUID_DELETE_PROFILE } from "./current-uuid-auth-scope.server.ts";
import type { CurrentUuidOriginalRecoveryStrategy } from "./current-uuid-original-recovery-contract.server.ts";

export type CurrentUuidOriginalRecoveryDependencies = Readonly<{
 origin: string; serverCredential: string; request: typeof fetch; repository: AppleRepository;
 policy: DeletionV2Policy; now(): number; timeoutMs: number;
}>;
function held(): never { throw Error("original_recovery_held"); }
function own(x: unknown) {
 if (!x || typeof x !== "object" || types.isProxy(x) || ![Object.prototype, null].includes(Object.getPrototypeOf(x))) held();
 const d = Object.getOwnPropertyDescriptors(x);
 if (Reflect.ownKeys(d).some(k => typeof k !== "string") || Object.values(d).some(v => !("value" in v) || !v.enumerable)) held();
 return d;
}
function data(x: unknown): unknown {
 let count = 0;
 function inspect(v: unknown, depth: number) {
  if (++count > 20000 || depth > 16) held();
  if (!v || typeof v !== "object") return;
  if (types.isProxy(v)) held();
  for (const d of Object.values(Object.getOwnPropertyDescriptors(v))) { if (!("value" in d)) held(); inspect(d.value, depth + 1); }
 }
 inspect(x, 0); return copyReferenceData(x);
}
function frozen<T>(x: T): T { if (x && typeof x === "object") { Object.values(x).forEach(frozen); Object.freeze(x); } return x; }
function fn(x: unknown): (...args: never[]) => unknown { if (typeof x !== "function" || types.isProxy(x)) held(); return x as (...args: never[]) => unknown; }
function stamp(x: unknown): number {
 if (typeof x !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(x)) held();
 const n = Date.parse(x); if (Number(x.slice(11,13)) > 23 || Number(x.slice(14,16)) > 59 || Number(x.slice(17,19)) > 59 || !Number.isSafeInteger(n) || new Date(x.slice(0,10) + "T00:00:00Z").toISOString().slice(0,10) !== x.slice(0,10)) held(); return n;
}
function positive(x: unknown) { if (!Number.isSafeInteger(x) || Number(x) < 1 || Number(x) > 2147483647) held(); return Number(x); }
function target(x: unknown): DeletionTarget { const t = appleExact(data(x), ["userId", "identityHash", "operationId"]); return frozen({ userId: appleUuid(t.userId), identityHash: appleHash(t.identityHash), operationId: appleUuid(t.operationId) }); }
// Same accepted fixed UUID adapter's exact404 grammar. Raw payload is transient,
// never returned, logged, hashed as evidence or persisted.
function absent(status: number, text: string): boolean {
 if (status !== 404) return false;
 const v = appleExactOrError(text);
 return Object.keys(v).every(k => ["code", "error_code", "msg", "message"].includes(k)) && (v.code === "user_not_found" || v.error_code === "user_not_found")
  && (v.code == null || v.code === 404 || v.code === "user_not_found") && (v.error_code == null || v.error_code === "user_not_found");
}
function appleExactOrError(text: string): AppleData { const v = data(parseReferenceJson(text)); own(v); return v as AppleData; }
// No issuer, preflight, scope mutation, auth_begin or DELETE exists in this module.
export function createCurrentUuidOriginalRecoveryStrategy(deps?: CurrentUuidOriginalRecoveryDependencies): CurrentUuidOriginalRecoveryStrategy {
 let config: { origin: string; credential: string; policy: DeletionV2Policy; timeout: number; command: AppleRepository["command"]; request: typeof fetch; now: () => number } | undefined;
 try {
  const d = own(deps);
  if (Object.keys(d).sort().join() !== ["origin","serverCredential","request","repository","policy","now","timeoutMs"].sort().join()) held();
  const origin = appleOrigin(appleText(d.origin.value,2048)), credential = appleText(d.serverCredential.value,16384);
  const policy = frozen(inspectDeletionV2Policy(data(d.policy.value))); if (policy.version !== UUID_DELETE_PROFILE) held();
  const timeout = positive(d.timeoutMs.value); if (timeout > 8000) held();
  const repo = d.repository.value, rd = own(repo); if (Object.keys(rd).join() !== "command") held();
  const command = fn(rd.command.value), request = fn(d.request.value), clock = fn(d.now.value);
  config = { origin, credential, policy, timeout,
   command: (ns,action,body) => Reflect.apply(command,repo,[ns,action,body]),
   request: (url,init) => Reflect.apply(request,deps,[url,init]), now: () => Reflect.apply(clock,deps,[]) };
 } catch { config = undefined; }
 const c = config;
 return Object.freeze({ forOwner(value: string) {
  let owner: string | undefined; try { owner = appleUuid(value); } catch { owner = undefined; }
  const active = new Set<string>();
  return Object.freeze({ async reconcile(value: DeletionTarget): Promise<DeletionProof> {
   const t = target(value);
   const proof = (outcome: DeletionProof["outcome"], basis: unknown): DeletionProof => frozen({ ...t, outcome, evidenceHash: appleDigest([UUID_DELETE_PROFILE,c?.origin ?? "unconfigured",t,outcome,basis]) });
   if (!c || owner !== t.userId || active.has(t.operationId)) return proof("unknown","recovery-unavailable");
   active.add(t.operationId);
   try {
    const now = () => { const n = c.now(); if (!Number.isSafeInteger(n) || n < 0) held(); return n; };
    const start = now(), policyHash = appleDigest(c.policy);
    async function bounded<T>(p: Promise<T>): Promise<T> { let timer: ReturnType<typeof setTimeout> | undefined; try { return await Promise.race([p,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error("recovery_timeout")),c!.timeout);})]); } finally { clearTimeout(timer); } }
    async function command(action: string, body: AppleData = t): Promise<AppleData> { return appleExactOrData(await bounded(c!.command("deletion",action,frozen(data(body) as AppleData)))); }
    function fresh(f: AppleData) {
     appleExact(f,["owner","attempt","lease","apple","appleState","authState","intentId","intentSha256","disposition","currentIdentityHash","actualApple","effectiveApple","policySha256","retainedEvidence","fenceHash"]);
     appleUuid(f.owner); positive(f.attempt); appleUuid(f.intentId); appleHash(f.intentSha256); appleHash(f.fenceHash);
     if (f.currentIdentityHash !== t.identityHash || f.policySha256 !== policyHash || appleDigest(f.retainedEvidence) !== appleDigest(c!.policy.retainedEvidence)
      || !["started","held"].includes(String(f.authState)) || !["not_required","confirmed","manual_required","failed","unknown"].includes(String(f.disposition))
      || !["linked","none"].includes(String(f.actualApple)) || !["linked","none"].includes(String(f.apple)) || f.effectiveApple !== f.apple || stamp(f.lease) <= now()) held();
    }
    function original(o: AppleData) {
     appleExact(o,["state","scopeAdmitted","scopeHash","evidenceHash","scopeProfile","scopeProviderPredicate","scopePolicySha256","scopeAccountRevision"]);
     if (o.scopeAdmitted !== true || o.scopeProfile !== UUID_DELETE_PROFILE || o.scopeProviderPredicate !== "account-uuid-only" || o.scopePolicySha256 !== policyHash || !["started","confirmed"].includes(String(o.state))) held();
     appleHash(o.scopeHash); positive(o.scopeAccountRevision);
     if (o.state === "confirmed") appleHash(o.evidenceHash); else if (o.evidenceHash !== null) held();
    }
    const f = await command("auth_fence"); fresh(f);
    const o = await command("auth_original"); original(o);
    async function unchanged() {
     const next = await command("auth_fence"); fresh(next); if (appleDigest(next) !== appleDigest(f)) held();
     const saved = await command("auth_original"); original(saved); if (appleDigest(saved) !== appleDigest(o)) held();
     const after = now(); if (after < start || after - start > c!.timeout || stamp(f.lease) <= after) held();
    }
    // The repository's actual parent/original RPCs establish target/original/claim
    // and stored profile/revision. Do not invent missing binding fields in replies.
    await unchanged();
    if (o.state === "confirmed") return proof("confirmed",appleHash(o.evidenceHash));
    const response = await appleHttp(c.origin + "/auth/v1/admin/users/" + encodeURIComponent(t.userId), { method:"GET", headers:{ apikey:c.credential,Authorization:`Bearer ${c.credential}`,"content-type":"application/json","X-Supabase-Api-Version":"2024-01-01" } },c.request,32768,c.timeout);
    if (!absent(response.status,response.text)) return proof("unknown","no-original-admitted-absence-proof");
    await unchanged();
    const evidence = appleDigest([UUID_DELETE_PROFILE,"original-admitted-exact404",t,o.scopeHash]);
    const recorded = appleExact(await command("auth_record",{...t,outcome:"confirmed",evidenceHash:evidence}),["state","evidenceHash"]);
    if (recorded.state !== "confirmed" || recorded.evidenceHash !== evidence) held();
    const finalFence = await command("auth_fence"); fresh(finalFence); if (appleDigest(finalFence) !== appleDigest(f)) held();
    const saved = await command("auth_original"); original(saved);
    if (appleDigest(saved) !== appleDigest({...o,state:"confirmed",evidenceHash:evidence})) held();
    const end=now(); if (end < start || end-start>c.timeout || stamp(f.lease)<=end) held();
    return proof("already_absent",evidence);
   } catch { return proof("unknown","read-only-original-reconciliation-held"); }
   finally { active.delete(t.operationId); }
  } });
 } });
}
function appleExactOrData(x: unknown): AppleData { const v = data(x); own(v); if (Object.hasOwn(v as object,"error")) held(); return v as AppleData; }
