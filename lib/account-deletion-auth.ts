// Server-only, explicitly constructed and UNBOUND. No environment/factory/route registration.
import { createHash } from "node:crypto";
import type { DeletionProvider, DeletionProof, DeletionTarget, VerifiedDeletionIdentity } from "./account-deletion.ts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[0-9a-f]{64}$/;
const TIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const controls = (value: string) => [...value].some(c => c.charCodeAt(0) < 32);
export class AuthDeletionError extends Error { constructor() { super("auth_deletion_unverified"); } }
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
type Fence = { owner: string; attempt: number; lease: string; apple: "none" | "linked"; appleState: string; authState: string };

export function supabaseDeletionAuth(origin: string, serverCredential: string, request: typeof fetch = fetch, timeoutMs = 8000): { verifyIdentity: (id: string) => Promise<VerifiedDeletionIdentity | null>; auth: DeletionProvider } {
  let url: URL;
  try { url = new URL(origin); } catch { throw new AuthDeletionError(); }
  if (url.protocol !== "https:" || url.port || url.username || url.password || url.search || url.hash || url.pathname !== "/" || ![url.origin, url.origin + "/"].includes(origin) || url.hostname === "localhost" || /^\d+(?:\.\d+){3}$/.test(url.hostname) || url.hostname.startsWith("[")) throw new AuthDeletionError();
  if (typeof serverCredential !== "string" || !serverCredential || serverCredential.length > 16384 || /\s/.test(serverCredential) || controls(serverCredential) || typeof request !== "function" || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 8000) throw new AuthDeletionError();
  const base = url.origin;
  async function http(path: string, method = "GET") {
    const endpoint = base + path, controller = new AbortController(); let timer: ReturnType<typeof setTimeout> | undefined;
    let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
    try {
      return await Promise.race([(async () => {
        const response = await request(endpoint, { method, headers: { apikey: serverCredential, Authorization: `Bearer ${serverCredential}`, "Content-Type": "application/json", "X-Supabase-Api-Version": "2024-01-01" }, ...(method === "DELETE" ? { body: '{"should_soft_delete":false}' } : {}), redirect: "error", cache: "no-store", signal: controller.signal });
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
