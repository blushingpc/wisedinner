import { isProxy } from "node:util/types";
import { createHash, randomUUID } from "node:crypto";
import type { VerifiedAccount } from "./account.ts";
import type { DeletionProvider, DeletionProof, DeletionTarget, DeletionWork, VerifiedDeletionIdentity } from "./account-deletion.ts";
import { parseReferenceJson } from "./generated-plan-json.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";

export const DELETION_V2 = "wd-account-deletion-v2";
type Data = Record<string, unknown>;
export type DeletionV2Policy = Readonly<{ approved: true; version: string; preparedSeconds: number; pendingSeconds: number; recoverySeconds: number; receiptSeconds: number; retainedEvidence: readonly string[] }>;
export type DeletionV2Repository = Readonly<{
  account(account: VerifiedAccount, action: "prepare" | "confirm", body: Data): Promise<unknown>;
  worker(action: string, body: Data): Promise<unknown>;
}>;
export type DeletionV2Providers = Readonly<{
  verifyIdentity(userId: string): Promise<VerifiedDeletionIdentity | null>;
  auth: DeletionProvider;
  // Optional already-reviewed token-custody/provider boundary. No token/code
  // enters HTTP or this protocol. Absence of this port is not proof of absence
  // of historic tokens or an unknown previously admitted provider operation.
  apple?: Readonly<{ run(target: DeletionTarget): Promise<DeletionProof | (DeletionTarget & { outcome: "failed"; evidenceHash: string })>; reconcile?(target: DeletionTarget): Promise<DeletionProof | (DeletionTarget & { outcome: "failed"; evidenceHash: string })> }>;
}>;
// Optional private status-only composition. Original capability/receipt is read
// first; no hook may replace a failed original read or allocate a new original.
export type DeletionV2StatusRecoveryInput = Readonly<{ operationId: string; intentSha256: string; recoveryHash: string; receipt: Readonly<Data> }>;
export type DeletionV2StatusRecovery = Readonly<{ recover(input: DeletionV2StatusRecoveryInput): Promise<unknown> }>;
function statusRecoveryData(value: unknown): unknown {
  let count=0;
  function check(v:unknown,depth:number){
    if(++count>256 || depth>8 || isProxy(v)) throw Error("status_recovery_invalid");
    if(v && typeof v==="object") for(const d of Object.values(Object.getOwnPropertyDescriptors(v))){if(!("value" in d))throw Error("status_recovery_invalid");check(d.value,depth+1);}
  }
  check(value,0);return canonicalReferenceData(value);
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA = /^[a-f0-9]{64}$/;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(canonicalReferenceData(value))).digest("hex");
export class DeletionV2Error extends Error { readonly code: string; constructor(code: string) { super(code); this.code = code; } }
function fail(code: string): never { throw new DeletionV2Error(code); }
function object(value: unknown): Data { if (!value || typeof value !== "object" || Array.isArray(value)) fail("invalid_shape"); return value as Data; }
function exact(value: unknown, keys: string[]): Data { const row = object(value); if (Object.keys(row).sort().join() !== [...keys].sort().join()) fail("invalid_shape"); return row; }
function uuid(value: unknown): string { if (typeof value !== "string" || !UUID.test(value)) fail("invalid_id"); return value; }
function sha(value: unknown): string { if (typeof value !== "string" || !SHA.test(value)) fail("invalid_digest"); return value; }
function revision(value: unknown): number { if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 2147483647) fail("invalid_revision"); return value as number; }
function checked(value: unknown): Data {
  const row = object(value);
  if (row.error) fail(["intent_conflict", "revision_conflict", "recent_auth_required", "recovery_unavailable", "claim_busy", "stale_claim", "invalid_progress", "cleanup_pending", "invalid_command", "policy_required", "deletion_v2_required", "prepared_original_retired", "prepared_retirement_held"].includes(String(row.error)) ? String(row.error) : "deletion_unavailable");
  return row;
}
export function inspectDeletionV2Policy(value: unknown): DeletionV2Policy {
  const row = exact(value, ["approved", "version", "preparedSeconds", "pendingSeconds", "recoverySeconds", "receiptSeconds", "retainedEvidence"]);
  if (row.approved !== true || typeof row.version !== "string" || !/^[a-zA-Z0-9_.-]{1,100}$/.test(row.version)) fail("policy_required");
  for (const key of ["preparedSeconds", "pendingSeconds", "recoverySeconds", "receiptSeconds"]) revision(row[key]);
  if (!Array.isArray(row.retainedEvidence) || !row.retainedEvidence.length || row.retainedEvidence.length > 10 || row.retainedEvidence.some(x => typeof x !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(x))) fail("policy_required");
  return canonicalReferenceData(row) as DeletionV2Policy;
}
export function deletionRecoveryHash(operationId: string, credential: string): string {
  uuid(operationId);
  if (!/^[A-Za-z0-9_-]{43}$/.test(credential) || Buffer.from(credential, "base64url").length !== 32 || Buffer.from(credential, "base64url").toString("base64url") !== credential) fail("recovery_unavailable");
  // SQL additionally binds this prehash to the independently verified owner.
  return digest(["wd-deletion-recovery-prehash-v2", operationId, credential]);
}
// Pure original intent, knowable and durably persistable BEFORE prepare. The
// header is a precondition, never an owner grant or a substitute for Auth.
export function deletionIntentHash(ownerId: string, operationId: string, expectedAccountRevision: number, recoveryHash: string, policySha256: string): string {
  return digest([DELETION_V2, uuid(ownerId), uuid(operationId), revision(expectedAccountRevision), sha(recoveryHash), sha(policySha256), "DELETE MY ACCOUNT"]);
}
const receiptKeys = ["contract", "operationId", "intentSha256", "receiptRevision", "intentState", "applicationData", "authDeletion", "appleRevocation", "manualAppleRemoval", "subscriptionCancelled", "clientDisposition", "retainedEvidence", "nextAction"];
export function inspectDeletionV2Receipt(value: unknown): Data {
  const row = exact(value, receiptKeys); uuid(row.operationId); sha(row.intentSha256); revision(row.receiptRevision);
  if (row.contract !== DELETION_V2 || row.subscriptionCancelled !== false) fail("invalid_receipt");
  const enums: Record<string, string[]> = { intentState: ["prepared", "confirmed", "settled", "unknown"], applicationData: ["pending", "cleared", "unknown"], authDeletion: ["pending", "confirmed", "unknown"], appleRevocation: ["pending", "not_required", "manual_required", "confirmed", "failed", "unknown"], manualAppleRemoval: ["required", "recommended", "not_required"], clientDisposition: ["return_unauthenticated", "reauthentication_available"], nextAction: ["none", "manual_apple_removal", "confirm_with_recent_auth", "original_status_required"] };
  for (const [key, values] of Object.entries(enums)) if (!values.includes(String(row[key]))) fail("invalid_receipt");
  if (!Array.isArray(row.retainedEvidence) || row.retainedEvidence.length > 10 || row.retainedEvidence.some(x => typeof x !== "string" || !/^[a-z][a-z0-9_-]{0,63}$/.test(x))) fail("invalid_receipt");
  if (row.intentState === "settled" && (row.applicationData !== "cleared" || row.authDeletion !== "confirmed" || row.appleRevocation === "pending")) fail("invalid_receipt");
  return canonicalReferenceData(row) as Data;
}

// One explicit bounded original operation; no dispatcher, scan or retry loop.
export async function advanceAccountDeletionV2(repository: DeletionV2Repository, providers: DeletionV2Providers, operationId: string, intentSha256: string, timeoutMs = 8000): Promise<Data> {
  uuid(operationId); sha(intentSha256);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8000) fail("invalid_timeout");
  let work: DeletionWork | undefined, last: Data | undefined;
  const owner = randomUUID();
  const command = async (action: string, extra: Data = {}) => {
    const row = checked(await repository.worker(action, { operationId, intentSha256, owner, ...(work ? { attempt: work.attempt } : {}), ...extra }));
    if (row.work) { const candidate = object(row.work); if (!UUID.test(String(candidate.user_id)) || candidate.owner !== null && !UUID.test(String(candidate.owner)) || !Number.isSafeInteger(candidate.attempt)) fail("invalid_work"); work = candidate as DeletionWork; }
    if (row.receipt) { last = inspectDeletionV2Receipt(row.receipt); if (last.operationId !== operationId || last.intentSha256 !== intentSha256) fail("original_intent_mismatch"); }
    return row;
  };
  const invoke = async (provider: DeletionV2Providers["auth"] | NonNullable<DeletionV2Providers["apple"]>, target: DeletionTarget, reconcile: boolean) => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const call = reconcile ? provider.reconcile?.(target) : provider.run(target);
      if (!call) return { ...target, outcome: "unknown", evidenceHash: digest(["wd-deletion-v2-no-reconciliation", target]) } as DeletionProof;
      return await Promise.race([call, new Promise<DeletionProof>(resolve => { timer = setTimeout(() => resolve({ ...target, outcome: "unknown", evidenceHash: digest(["wd-deletion-v2-timeout", target]) }), timeoutMs); })]);
    } catch { return { ...target, outcome: "unknown", evidenceHash: digest(["wd-deletion-v2-unverified", target]) } as DeletionProof; }
    finally { clearTimeout(timer); }
  };
  try {
    await command("claim"); if (!work || !last) fail("invalid_work");
    if (last.intentState === "settled") return last;
    if (work.owner !== owner || !work.identity_hash) fail("invalid_work");
    await command("cleanup");
    for (const dependency of ["apple", "auth"] as const) {
      const current = () => dependency === "apple" ? work!.apple_state : work!.auth_state;
      if (dependency === "apple" && (work!.apple_linkage === "none" || !providers.apple || current() === "done")) { await command("apple_unavailable"); continue; }
      if (current() === "done") continue;
      const provider = dependency === "apple" ? providers.apple! : providers.auth;
      const target = { userId: work!.user_id, identityHash: work!.identity_hash!, operationId: dependency === "apple" ? work!.apple_operation : work!.auth_operation };
      const reconciling = ["started", "held"].includes(current());
      if (!reconciling) await command("begin", { dependency });
      let proof: Data;
      try {
        proof = exact(await invoke(provider, target, reconciling), ["userId", "identityHash", "operationId", "outcome", "evidenceHash"]);
        if (proof.userId !== target.userId || proof.identityHash !== target.identityHash || proof.operationId !== target.operationId || !["confirmed", "already_absent", "not_started", "unknown", ...(dependency === "apple" ? ["failed"] : [])].includes(String(proof.outcome)) || dependency === "apple" && proof.outcome === "already_absent") fail("provider_proof_unverified");
        sha(proof.evidenceHash);
      } catch {
        // A malformed/cross-operation proof proves nothing. Persist a local
        // uncertainty marker for THIS original, not the supplied proof. Apple
        // uncertainty must not indefinitely prevent local/Auth data deletion.
        proof = { ...target, outcome: "unknown", evidenceHash: digest(["wd-deletion-v2-invalid-proof", target]) };
      }
      await command("proof", { dependency, providerOperationId: target.operationId, identityHash: target.identityHash, outcome: proof.outcome, evidenceHash: sha(proof.evidenceHash) });
      // A settled non-execution proof is not automatic permission to repeat.
      if (dependency === "auth" && current() !== "done") break;
    }
    if (work!.auth_state === "done") await command("complete");
  } catch {
    // Preserve original unknown evidence. No swallowed provider payloads or
    // automatic repeated calls. Exact status remains the recovery channel.
  } finally {
    if (work?.owner === owner && !work.complete) try { await command("release"); } catch { /* retain fenced original work */ }
  }
  if (!last) fail("original_status_required"); return last;
}

export function createAccountDeletionV2Service(deps: Readonly<{ enabled: boolean; verify(request: Request): Promise<VerifiedAccount>; repository: DeletionV2Repository; providers: DeletionV2Providers; policy?: unknown; now?: () => number; providerTimeoutMs?: number; statusRecovery?: DeletionV2StatusRecovery }>) {
  const { enabled, verify, repository, providers } = deps, now = deps.now ?? Date.now;
  const policy = deps.policy === undefined ? undefined : inspectDeletionV2Policy(deps.policy);
  let recover: DeletionV2StatusRecovery["recover"] | undefined;
  try {
    const port = Object.getOwnPropertyDescriptor(deps,"statusRecovery");
    const receiver = port && "value" in port ? port.value : undefined;
    if(receiver && (isProxy(receiver) || ![Object.prototype,null].includes(Object.getPrototypeOf(receiver)) || Reflect.ownKeys(receiver).join()!=="recover")) throw Error("status_recovery_invalid");
    const method = receiver && Object.getOwnPropertyDescriptor(receiver,"recover");
    if(method && "value" in method && typeof method.value === "function" && !isProxy(method.value)) {
      const fn = method.value; recover = input => Reflect.apply(fn,receiver,[input]);
    }
  } catch { /* Original read remains available. */ }

  return async (request: Request): Promise<Response> => {
    let operationId: string | null = null;
    const respond = (result: Data, status = 200) => Response.json({ contract: DELETION_V2, operationId, apiAccepted: false, productionReady: false, result }, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
    if (!enabled) return respond({ outcome: "held", code: "deletion_v2_disabled" }, 503);
    try {
      if (request.method !== "POST" || new URL(request.url).search) fail("invalid_request");
      const lifecycle = request.headers.get("x-wd-deletion-lifecycle");
      if (lifecycle !== null && lifecycle !== "wd-prepared-retirement-v1") fail("unsupported_lifecycle");
      if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") ?? "")) fail("invalid_request");
      const length = request.headers.get("content-length"); if (length !== null && (!/^(0|[1-9]\d*)$/.test(length) || Number(length) > 16384)) fail("body_capacity_exceeded");
      if (!request.body) fail("invalid_request");
      const reader = request.body.getReader(); let bytes = 0; const chunks: Uint8Array[] = [];
      try { while (true) { const chunk = await reader.read(); if (request.signal.aborted) fail("request_aborted"); if (chunk.done) break; bytes += chunk.value.byteLength; if (bytes > 16384) fail("body_capacity_exceeded"); chunks.push(chunk.value); } }
      finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
      if (length !== null && Number(length) !== bytes) fail("invalid_request");
      const input = object(parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))));
      if (input.contract !== DELETION_V2) fail("contract_mismatch"); operationId = uuid(input.operationId);
      if (input.operation === "status") {
        exact(input, ["contract", "operation", "operationId", "intentSha256"]);
        if (request.headers.get("x-wd-deletion-lifecycle") === "wd-prepared-retirement-v1" && request.headers.get("authorization")?.startsWith("Bearer ")) {
          const account = await verify(request), capability = request.headers.get("x-wd-deletion-recovery");
          if (!capability) fail("recovery_unavailable");
          const terminal = checked(await repository.worker("retirement_status", { userId: uuid(account.id), operationId, intentSha256: sha(input.intentSha256), recoveryHash: deletionRecoveryHash(operationId, capability) }));
          const keys = ["contract", "operationId", "intentSha256", "receiptRevision", "disposition", "applicationData", "authDeletion", "appleRevocation", "retryAuthorized", "mayPrepareNewOriginal"];
          exact(terminal, keys);
          if (terminal.contract !== "wd-prepared-retirement-v1" || terminal.operationId !== operationId || terminal.intentSha256 !== input.intentSha256 || terminal.disposition !== "expired-no-effect" || terminal.applicationData !== "not_started" || terminal.authDeletion !== "not_started" || terminal.appleRevocation !== "not_started" || terminal.retryAuthorized !== false || typeof terminal.mayPrepareNewOriginal !== "boolean") fail("invalid_receipt");
          revision(terminal.receiptRevision); return respond(terminal);
        }
        const credential = request.headers.get("authorization")?.match(/^Deletion-Recovery ([A-Za-z0-9_-]{43})$/)?.[1]; if (!credential) fail("recovery_unavailable");
        const row = checked(await repository.worker("status", { operationId, intentSha256: sha(input.intentSha256), recoveryHash: deletionRecoveryHash(operationId, credential) }));
        const receipt = inspectDeletionV2Receipt(row); if (receipt.operationId !== operationId || receipt.intentSha256 !== input.intentSha256) fail("recovery_unavailable");
        // Preserve this exact durable original on missing/unknown recovery. This
        // seam cannot authenticate a new owner or authorize a fresh provider run.
        if(recover && receipt.intentState === "confirmed" && receipt.applicationData === "cleared" && receipt.authDeletion === "unknown") {
          try {
            const original = Object.freeze(canonicalReferenceData(receipt) as Data);
            const value = inspectDeletionV2Receipt(statusRecoveryData(await recover(Object.freeze({operationId,intentSha256:sha(input.intentSha256),recoveryHash:deletionRecoveryHash(operationId,credential),receipt:original}))));
            if(value.operationId === operationId && value.intentSha256 === receipt.intentSha256 && Number(value.receiptRevision)>=Number(receipt.receiptRevision)
              && value.authDeletion === "confirmed" && ["confirmed","settled"].includes(String(value.intentState))
              && value.applicationData === receipt.applicationData && value.appleRevocation === receipt.appleRevocation
              && value.manualAppleRemoval === receipt.manualAppleRemoval && value.clientDisposition === receipt.clientDisposition
              && digest(value.retainedEvidence) === digest(receipt.retainedEvidence)) return respond(value);
          } catch { /* No retry; retain original receipt/unknown outcome. */ }
        }
        return respond(receipt);
      }
      const preparing = input.operation === "prepare";
      if (!preparing && input.operation !== "confirm") fail("invalid_request");
      exact(input, ["contract", "operation", "operationId", "expectedAccountRevision", ...(preparing ? [] : ["intentSha256", "confirmation"])]);
      const expectedAccountRevision = revision(input.expectedAccountRevision), credential = request.headers.get("x-wd-deletion-recovery"); if (!credential) fail("recovery_unavailable");
      const recoveryHash = deletionRecoveryHash(operationId, credential), account = await verify(request); uuid(account.id);
      if (preparing) {
        if (!policy) fail("policy_required");
        const policyHash = digest(policy), intentSha256 = deletionIntentHash(account.id, operationId, expectedAccountRevision, recoveryHash, policyHash);
        const suppliedIntent = request.headers.get("x-wd-deletion-intent-sha256");
        if (suppliedIntent === null || !SHA.test(suppliedIntent) || suppliedIntent !== intentSha256) fail("original_intent_mismatch");
        const identity = await providers.verifyIdentity(account.id);
        if (!identity || identity.userId !== account.id || !["linked", "none"].includes(identity.apple)) fail("identity_unverified");
        checked(await repository.worker(request.headers.get("x-wd-deletion-lifecycle") === "wd-prepared-retirement-v1" ? "admit_retiring" : "admit", { userId: account.id, operationId, expectedAccountRevision, recoveryHash, identityHash: sha(identity.identityHash), identityEvidence: sha(identity.evidenceHash), appleLinkage: identity.apple, policy, policyHash, intentSha256 }));
        const receipt = inspectDeletionV2Receipt(checked(await repository.account(account, "prepare", { operationId, expectedAccountRevision, recoveryHash })));
        if (receipt.operationId !== operationId || receipt.intentSha256 !== intentSha256) fail("original_intent_mismatch");
        return respond(receipt);
      }
      const intentSha256 = sha(input.intentSha256);
      if (input.confirmation !== "DELETE MY ACCOUNT" || account.authenticatedAt === null || account.authenticatedAt > now() / 1000 || now() / 1000 - account.authenticatedAt > 300) fail("recent_auth_required");
      const receipt = inspectDeletionV2Receipt(checked(await repository.account(account, "confirm", { operationId, intentSha256, expectedAccountRevision, recoveryHash, confirmation: input.confirmation })));
      if (receipt.operationId !== operationId || receipt.intentSha256 !== intentSha256) fail("original_intent_mismatch");
      // Confirmed original is durable before provider work. Duplicate confirm
      // may reconcile that same original, but can never repeat an unknown call.
      return respond(await advanceAccountDeletionV2(repository, providers, operationId, intentSha256, deps.providerTimeoutMs));
    } catch (error) {
      const code = error instanceof DeletionV2Error ? error.code : "deletion_unavailable";
      return respond({ outcome: "held", code, statusRequired: true, retryAuthorized: false }, code === "body_capacity_exceeded" ? 413 : code === "policy_required" ? 503 : 409);
    }
  };
}

export function createDeletionV2RpcRepository(origin: string, serverKey: string, request: typeof fetch = fetch): DeletionV2Repository {
  const url = new URL(origin);
  if (url.protocol !== "https:" || url.pathname !== "/" || url.username || url.password || url.search || url.hash || url.port || !serverKey) fail("deletion_not_configured");
  const rpc = async (name: string, token: string, action: string, body: Data) => {
    const endpoint = `${url.origin}/rest/v1/rpc/${name}`;
    const response = await request(endpoint, { method: "POST", headers: { apikey: serverKey, authorization: `Bearer ${token}`, "content-type": "application/json" }, redirect: "error", cache: "no-store", signal: AbortSignal.timeout(8000), body: JSON.stringify({ p_action: action, p_body: body }) });
    if (!response.ok || response.redirected || response.url && response.url !== endpoint) fail("deletion_unavailable");
    // Bound transport independently of untrusted Content-Length.
    const reader = response.body?.getReader(); if (!reader) fail("deletion_unavailable"); const chunks: Uint8Array[] = []; let size = 0;
    try { while (true) { const chunk = await reader.read(); if (chunk.done) break; size += chunk.value.byteLength; if (size > 16384) fail("deletion_unavailable"); chunks.push(chunk.value); } return parseReferenceJson(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))); }
    finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
  };
  return { account: (account, action, body) => rpc("wd_deletion_v2_account_command", account.token, action, body), worker: (action, body) => rpc("wd_deletion_v2_worker_command", serverKey, action, body) };
}

// V2-only Auth consumer is intentionally colocated here. The accepted legacy
// Auth source stays byte-identical; no seventh module or weakened fence.
export function supabaseDeletionAuthV2(origin: string, serverCredential: string, request: typeof fetch = fetch, timeoutMs = 8000): { verifyIdentity: (id: string) => Promise<VerifiedDeletionIdentity | null>; auth: DeletionProvider } {
  // Server-only, explicitly constructed and UNBOUND. No environment/factory/route registration.
  
  const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
  const HASH = /^[0-9a-f]{64}$/;
  const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  const controls = (value: string) => [...value].some(c => c.charCodeAt(0) < 32);
  class AuthDeletionError extends Error { constructor() { super("auth_deletion_unverified"); } }
  function object(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== "object" || Array.isArray(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw new AuthDeletionError();
    const descriptors = Object.getOwnPropertyDescriptors(value);
    if (Reflect.ownKeys(value).some(k => typeof k !== "string") || Object.values(descriptors).some(d => !("value" in d))) throw new AuthDeletionError();
    return value as Record<string, unknown>;
  }
  function exact(value: unknown, fields: string[]) {
    const v = object(value); if (Object.keys(v).length !== fields.length || fields.some(k => !Object.hasOwn(v, k))) throw new AuthDeletionError(); return v;
  }
  function uuid(value: unknown): asserts value is string { if (typeof value !== "string" || !UUID.test(value)) throw new AuthDeletionError(); }
  function time(value: unknown): asserts value is string {
    if (typeof value !== "string" || !TIME.test(value) || !Number.isFinite(Date.parse(value))) throw new AuthDeletionError();
    const [year, month, day] = value.slice(0, 10).split("-").map(Number);
    if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate() || Number(value.slice(11, 13)) > 23 || Number(value.slice(14, 16)) > 59 || Number(value.slice(17, 19)) > 59) throw new AuthDeletionError();
  }
  function target(value: DeletionTarget): DeletionTarget {
    const t = exact(value, ["userId", "identityHash", "operationId"]); uuid(t.userId); uuid(t.operationId);
    if (typeof t.identityHash !== "string" || !HASH.test(t.identityHash)) throw new AuthDeletionError();
    return { userId: t.userId, identityHash: t.identityHash, operationId: t.operationId };
  }
  type Identity = { hash: string; apple: "none" | "linked" };
  type Fence = { owner: string; attempt: number; lease: string; apple: "none" | "linked"; appleState: string; authState: string; intentId?: string; intentSha256?: string; disposition?: string };
  
  function createSupabaseDeletionAuth(origin: string, serverCredential: string, request: typeof fetch, timeoutMs: number, v2: boolean): { verifyIdentity: (id: string) => Promise<VerifiedDeletionIdentity | null>; auth: DeletionProvider } {
    let url: URL;
    try { url = new URL(origin); } catch { throw new AuthDeletionError(); }
    if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/" || ![url.origin, url.origin + "/"].includes(origin) || url.hostname === "localhost" || /^\d+(?:\.\d+){3}$/.test(url.hostname) || url.hostname.startsWith("[")) throw new AuthDeletionError();
    if (typeof serverCredential !== "string" || !serverCredential || serverCredential.length > 16384 || /\s/.test(serverCredential) || controls(serverCredential) || typeof request !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8000) throw new AuthDeletionError();
    const base = url.origin;
    async function http(path: string, method = "GET", payload?: unknown) {
      const endpoint = base + path, controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        return await Promise.race([(async () => {
          const response = await request(endpoint, { method, headers: { apikey: serverCredential, Authorization: `Bearer ${serverCredential}`, "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" }, ...(method === "DELETE" ? { body: '{"should_soft_delete":false}' } : payload === undefined ? {} : { body: JSON.stringify(payload) }), redirect: "error", cache: "no-store", signal: controller.signal });
          if (response.redirected || response.url && response.url !== endpoint || response.headers.get("content-type")?.split(";")[0].trim() !== "application/json") throw new AuthDeletionError();
          const length = response.headers.get("content-length"); if (length && (!/^\d+$/.test(length) || Number(length) > 32768)) throw new AuthDeletionError();
          reader = response.body?.getReader(); if (!reader) throw new AuthDeletionError();
          const chunks: Uint8Array[] = []; let size = 0;
          for (;;) { const p = await reader.read(); if (p.done) break; size += p.value.byteLength; if (size > 32768) throw new AuthDeletionError(); chunks.push(p.value); }
          return { status: response.status, value: JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown };
        })(), new Promise<never>((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new AuthDeletionError()); }, timeoutMs); })]);
      } catch { throw new AuthDeletionError(); }
      finally { clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
    }
    function identity(value: unknown, id: string): Identity {
      const response = object(value), u = Object.hasOwn(response, "user") ? exact(response, ["user"]).user : response;
      const user = object(u); if (user.id !== id || user.is_anonymous !== false || user.deleted_at != null || user.is_sso_user === true) throw new AuthDeletionError();
      time(user.created_at);
      if (!Array.isArray(user.identities) || user.identities.length < 1 || user.identities.length > 16) throw new AuthDeletionError();
      const seen = new Set<string>();
      const rows = user.identities.map(value => {
        const i = object(value); uuid(i.identity_id); if (i.user_id !== id || typeof i.provider !== "string" || !["email", "google", "apple"].includes(i.provider) || typeof i.id !== "string" || !i.id || Buffer.byteLength(i.id) > 1024 || controls(i.id)) throw new AuthDeletionError();
        time(i.created_at); if (seen.has(i.identity_id)) throw new AuthDeletionError(); seen.add(i.identity_id);
        return [i.identity_id, i.provider, i.id, i.user_id, i.created_at] as string[];
      }).sort((a, b) => a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0);
      if (new Set(rows.map(r => r[1] + "\0" + r[2])).size !== rows.length) throw new AuthDeletionError();
      // Explicit email/phone, editable metadata, tokens, identity_data and mutable dates excluded.
      // Opaque provider IDs can contain personal data; only their context-bound lineage hash leaves here.
      return { hash: digest(["wd-supabase-auth-lineage-1", base, id, user.created_at, rows]), apple: rows.some(r => r[1] === "apple") ? "linked" : "none" };
    }
    function absent(r: Awaited<ReturnType<typeof http>>) {
      if (r.status !== 404) return false;
      try {
        const e = object(r.value); if (Object.keys(e).some(k => !["code", "error_code", "msg", "message"].includes(k))) return false;
        const code = typeof e.code === "string" ? e.code : e.error_code;
        return code === "user_not_found" && (e.error_code == null || e.error_code === "user_not_found") && (e.code == null || e.code === "user_not_found" || e.code === 404);
      } catch { return false; }
    }
    const userPath = (id: string) => `/auth/v1/admin/users/${encodeURIComponent(id)}`;
    async function fence(t: DeletionTarget, mode: "run" | "reconcile"): Promise<Fence> {
      if (v2) {
        const result = await http("/rest/v1/rpc/wd_deletion_v2_worker_command", "POST", { p_action: "auth_fence", p_body: { userId: t.userId, identityHash: t.identityHash, operationId: t.operationId } });
        if (result.status !== 200) throw new AuthDeletionError();
        const row = exact(result.value, ["owner", "attempt", "lease", "apple", "appleState", "authState", "intentId", "intentSha256", "disposition"]);
        uuid(row.owner); uuid(row.intentId); time(row.lease);
        if (!Number.isSafeInteger(row.attempt) || (row.attempt as number) < 1 || Date.parse(row.lease) <= Date.now() || typeof row.intentSha256 !== "string" || !HASH.test(row.intentSha256)
          || !["linked", "none"].includes(row.apple as string) || !(mode === "run" ? ["started"] : ["started", "held"]).includes(row.authState as string)
          || !["not_required", "confirmed", "manual_required", "failed", "unknown"].includes(row.disposition as string)
          || row.apple === "none" && (row.disposition !== "not_required" || row.appleState !== "not_required")
          || row.apple === "linked" && (row.disposition === "not_required" || row.disposition === "confirmed" && row.appleState !== "done")) throw new AuthDeletionError();
        return row as Fence;
      }
      const a = await http(`/rest/v1/wd_accounts?user_id=eq.${t.userId}&select=user_id,state&limit=1`);
      const w = await http(`/rest/v1/wd_deletion_work?user_id=eq.${t.userId}&select=user_id,owner,attempt,lease_until,identity_hash,apple_linkage,apple_state,auth_state,auth_operation,complete&limit=1`);
      if (a.status !== 200 || w.status !== 200 || !Array.isArray(a.value) || a.value.length !== 1 || !Array.isArray(w.value) || w.value.length !== 1) throw new AuthDeletionError();
      const account = exact(a.value[0], ["user_id", "state"]), work = exact(w.value[0], ["user_id", "owner", "attempt", "lease_until", "identity_hash", "apple_linkage", "apple_state", "auth_state", "auth_operation", "complete"]);
      if (account.user_id !== t.userId || account.state !== "deletion_pending" || work.user_id !== t.userId || work.identity_hash !== t.identityHash || work.auth_operation !== t.operationId || work.complete !== false || !Number.isSafeInteger(work.attempt) || (work.attempt as number) < 1) throw new AuthDeletionError();
      uuid(work.owner); time(work.lease_until); if (Date.parse(work.lease_until) <= Date.now()) throw new AuthDeletionError();
      if (work.apple_linkage === "none" && work.apple_state !== "not_required" || work.apple_linkage === "linked" && work.apple_state !== "done" || !["none", "linked"].includes(work.apple_linkage as string) || !(mode === "run" ? ["started"] : ["started", "held"]).includes(work.auth_state as string)) throw new AuthDeletionError();
      return { owner: work.owner, attempt: work.attempt as number, lease: work.lease_until, apple: work.apple_linkage as "none" | "linked", appleState: work.apple_state as string, authState: work.auth_state as string };
    }
    function same(a: Fence, b: Fence) { if (JSON.stringify(a) !== JSON.stringify(b)) throw new AuthDeletionError(); }
    const proof = (t: DeletionTarget, outcome: DeletionProof["outcome"], observation: string): DeletionProof => ({ ...t, outcome, evidenceHash: digest(["wd-auth-deletion-proof-1", base, t.userId, t.identityHash, t.operationId, outcome, observation]) });
    return {
      async verifyIdentity(id) {
        uuid(id);
        try { const r = await http(userPath(id)); if (r.status !== 200) return null; const i = identity(r.value, id); return { userId: id, identityHash: i.hash, evidenceHash: digest(["wd-auth-identity-1", base, id, i.hash, i.apple]), apple: i.apple }; } catch { return null; }
      },
      auth: {
        async run(input) {
          const t = target(input);
          try {
            const before = await fence(t, "run"), r = await http(userPath(t.userId));
            if (r.status !== 200) throw new AuthDeletionError(); const i = identity(r.value, t.userId);
            if (i.hash !== t.identityHash || i.apple !== before.apple) throw new AuthDeletionError();
            same(before, await fence(t, "run"));
            // Only after durable worker begin. No retry loop or in-memory operation registry.
            const deleted = await http(userPath(t.userId), "DELETE");
            if (deleted.status !== 200) throw new AuthDeletionError();
            const body = object(deleted.value);
            if (Object.keys(body).length && identity(body, t.userId).hash !== t.identityHash) throw new AuthDeletionError();
            const after = await http(userPath(t.userId)); if (!absent(after)) throw new AuthDeletionError();
            same(before, await fence(t, "run"));
            return proof(t, "confirmed", "hard-delete200-valid-body;admin-get404-user_not_found;durable-provenance-unchanged");
          } catch { return proof(t, "unknown", "operation-unverified-hold"); }
        },
        async reconcile(input) {
          const t = target(input);
          try {
            const before = await fence(t, "reconcile"), r = await http(userPath(t.userId));
            if (!absent(r)) throw new AuthDeletionError(); same(before, await fence(t, "reconcile"));
            return proof(t, "already_absent", "admin-get404-user_not_found;exact-started-held-durable-provenance");
          } catch { return proof(t, "unknown", "read-only-reconciliation-unverified-hold"); }
        }
      }
    };
  }
  
  return createSupabaseDeletionAuth(origin, serverCredential, request, timeoutMs, true);
}
