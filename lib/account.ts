import { createHash } from "node:crypto";

// Versioned private account seam. No entitlement is needed to manage/delete an account.
export class AccountError extends Error {
  status: number;
  constructor(status: number, code: string) { super(code); this.status = status; }
}
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type VerifiedAccount = { id: string; token: string; authenticatedAt: number | null; providers: string[] };
export type AccountCommand = { action: string; body: Record<string, unknown>; key: string | null };
export type AccountRepository = { execute: (account: VerifiedAccount, command: AccountCommand) => Promise<unknown> };
export type CatalogPin = { version: number; sha256: string; solverRevision: string; catalogRevision: string; recipeIds: ReadonlySet<string> };

export function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new AccountError(400, "invalid_shape");
  return value as Record<string, unknown>;
}
export function keys(value: Record<string, unknown>, allowed: string[]) {
  if (Object.keys(value).some(k => !allowed.includes(k))) throw new AccountError(400, "unknown_field");
}
function integer(value: unknown, min: number, max: number) {
  if (!Number.isSafeInteger(value) || (value as number) < min || (value as number) > max) throw new AccountError(400, "invalid_number");
  return value as number;
}
function strings(value: unknown, max: number): string[] {
  if (!Array.isArray(value) || value.length > max || value.some(x => typeof x !== "string" || !/^[a-z0-9-]{1,64}$/.test(x))) throw new AccountError(400, "invalid_list");
  if (new Set(value).size !== value.length) throw new AccountError(400, "duplicate_item");
  return value as string[];
}
export async function boundedJson(request: Request, limit = 16384): Promise<Record<string, unknown>> {
  const mediaType = request.headers.get("content-type")?.split(";")[0];
  if (mediaType?.trim().toLowerCase() !== "application/json") throw new AccountError(415, "json_required");
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/.test(length) || Number(length) > limit)) throw new AccountError(413, "payload_too_large");
  const reader = request.body?.getReader();
  if (!reader) throw new AccountError(400, "body_required");
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw new AccountError(413, "payload_too_large"); }
      chunks.push(value);
    }
    return object(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  } catch (error) {
    if (error instanceof AccountError) throw error;
    throw new AccountError(400, "invalid_json");
  } finally { reader.releaseLock(); }
}

// The Auth server verifies the token first, as getUser(jwt) does. Claims are NOT trusted before that response.
// JWT decoding below only adds issuer/audience/expiry/sub consistency and signed AMR checks.
export function supabaseVerifier(url: string, key: string, fetchImpl: typeof fetch = fetch, now = () => Date.now()) {
  const origin = new URL(url);
  if (origin.protocol !== "https:" || origin.pathname !== "/" || origin.username || origin.password || origin.search || origin.hash) throw new AccountError(503, "auth_configuration");
  return async (request: Request): Promise<VerifiedAccount> => {
    const header = request.headers.get("authorization") ?? "";
    if (!/^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(header) || header.length > 8192) throw new AccountError(401, "invalid_session");
    const token = header.slice(7);
    let response: Response;
    try { response = await fetchImpl(`${origin.origin}/auth/v1/user`, { headers: { apikey: key, Authorization: header }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) }); }
    catch { throw new AccountError(503, "auth_unavailable"); }
    if (!response.ok) throw new AccountError(response.status >= 500 || response.status === 429 ? 503 : 401, "invalid_session");
    try {
      const user = object(await response.json());
      const payload = token.split(".")[1];
      if (typeof payload !== "string" || !payload) throw new Error("invalid");
      const claims = object(JSON.parse(Buffer.from(payload, "base64url").toString("utf8")));
      if (typeof user.id !== "string" || !UUID.test(user.id) || user.is_anonymous !== false || claims.sub !== user.id || claims.iss !== `${origin.origin}/auth/v1` || claims.aud !== "authenticated" || claims.role !== "authenticated" || typeof claims.exp !== "number" || claims.exp * 1000 <= now()) throw new Error("invalid");
      const amr = Array.isArray(claims.amr) ? claims.amr : [];
      const times = amr.filter(x => x && typeof x === "object" && ["password", "otp", "oauth", "totp", "webauthn"].includes(x.method) && Number.isSafeInteger(x.timestamp) && x.timestamp * 1000 <= now()).map(x => x.timestamp as number);
      // Provider identities come from the verified Auth user, not editable user_metadata.
      const identities = Array.isArray(user.identities) ? user.identities : [];
      return { id: user.id, token, authenticatedAt: times.length ? Math.max(...times) : null, providers: identities.flatMap(x => x && typeof x.provider === "string" ? [x.provider] : []) };
    } catch { throw new AccountError(401, "invalid_session"); }
  };
}

function preferences(value: unknown) {
  const p = object(value); keys(p, ["diet", "allergens", "excludedSkuIds", "household", "notifications"]);
  if (!["none", "vegan", "vegetarian", "dairy-free", "gluten-free"].includes(p.diet as string)) throw new AccountError(400, "invalid_diet");
  const allergens = strings(p.allergens, 9);
  if (allergens.some(x => !["peanuts", "tree-nuts", "dairy", "eggs", "wheat", "soy", "fish", "shellfish", "sesame"].includes(x))) throw new AccountError(400, "invalid_allergen");
  if (typeof p.notifications !== "boolean") throw new AccountError(400, "invalid_preference");
  return { diet: p.diet, allergens, excludedSkuIds: strings(p.excludedSkuIds, 79), household: integer(p.household, 1, 8), notifications: p.notifications };
}
function savedWeek(value: unknown, pin?: CatalogPin) {
  if (!pin) throw new AccountError(503, "catalog_pin_unavailable");
  const w = object(value); keys(w, ["snapshotVersion", "snapshotSha256", "solverRevision", "catalogRevision", "recipeIds", "seed"]);
  if (w.snapshotVersion !== pin.version || w.snapshotSha256 !== pin.sha256 || w.solverRevision !== pin.solverRevision || w.catalogRevision !== pin.catalogRevision) throw new AccountError(409, "catalog_pin_mismatch");
  const ids = w.recipeIds;
  if (!Array.isArray(ids) || ids.length !== 15 || ids.some(x => typeof x !== "string" || !pin.recipeIds.has(x))) throw new AccountError(400, "invalid_recipe_ids");
  return { ...w, seed: integer(w.seed, 0, 2147483647) };
}
export function accountHandler(deps: { verify: (r: Request) => Promise<VerifiedAccount>; repository: AccountRepository; pin?: CatalogPin; now?: () => number }) {
  return async (request: Request): Promise<Response> => {
    try {
      const account = await deps.verify(request);
      const path = new URL(request.url).pathname.replace(/^\/api\/v1\/account\/?/, "");
      let action: string; let body: Record<string, unknown> = {}; let key: string | null = null;
      if (request.method === "GET") {
        if (path === "") action = "read";
        else if (path === "deletion") action = "deletion_status";
        else if (path === "weeks") {
          const query = new URL(request.url).searchParams;
          if ([...query.keys()].some(k => !["limit", "before"].includes(k))) throw new AccountError(400, "invalid_query");
          const before = query.get("before"); if (before && !UUID.test(before)) throw new AccountError(400, "invalid_cursor");
          body = { limit: integer(Number(query.get("limit") ?? 20), 1, 50), before }; action = "list_weeks";
        } else throw new AccountError(404, "not_found");
      } else {
        body = await boundedJson(request);
        key = request.headers.get("idempotency-key");
        if (!key || !UUID.test(key)) throw new AccountError(400, "idempotency_key_required");
        if (path === "" && request.method === "POST") { keys(body, []); action = "initialize"; }
        else if (path === "" && request.method === "PATCH") { keys(body, ["revision", "preferences"]); body = { revision: integer(body.revision, 1, 2147483647), preferences: preferences(body.preferences) }; action = "update"; }
        else if (path === "" && request.method === "DELETE") {
          keys(body, ["confirmation"]);
          if (body.confirmation !== "DELETE MY ACCOUNT") throw new AccountError(400, "confirmation_required");
          const now = (deps.now ?? Date.now)() / 1000;
          if (account.authenticatedAt === null || account.authenticatedAt > now || now - account.authenticatedAt > 300) throw new AccountError(401, "recent_auth_required");
          // Partial deletion is explicit. Provider deletion/revocation is a separate retryable worker.
          // The independently callable authenticated RPC must enforce the same intent, not just this route.
          // Apple linkage remains a trusted provider-worker lookup, never a client-provided list.
          body = { confirmation: "DELETE MY ACCOUNT" }; action = "begin_deletion";
        } else if (path === "weeks" && request.method === "POST") { keys(body, ["id", "revision", "week"]); if (typeof body.id !== "string" || !UUID.test(body.id)) throw new AccountError(400, "invalid_id"); body = { id: body.id, revision: integer(body.revision, 0, 2147483647), week: savedWeek(body.week, deps.pin) }; action = "save_week"; }
        else if (/^weeks\/[0-9a-f-]+$/i.test(path) && request.method === "DELETE") { keys(body, ["revision"]); const id = path.slice(6); if (!UUID.test(id)) throw new AccountError(400, "invalid_id"); body = { id, revision: integer(body.revision, 1, 2147483647) }; action = "delete_week"; }
        else throw new AccountError(404, "not_found");
      }
      const result = await deps.repository.execute(account, { action, body, key });
      return Response.json({ apiVersion: 1, result }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
      const safe = error instanceof AccountError ? error : new AccountError(503, "account_unavailable");
      return Response.json({ error: safe.message }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
    }
  };
}
export function supabaseAccountRepository(url: string, key: string, fetchImpl: typeof fetch = fetch): AccountRepository {
  return { async execute(account, command) {
    let response: Response;
    try { response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/rpc/wd_account_command`, { method: "POST", headers: { apikey: key, Authorization: `Bearer ${account.token}`, "Content-Type": "application/json" }, body: JSON.stringify({ p_action: command.action, p_body: command.body, p_key: command.key }), cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) }); }
    catch { throw new AccountError(503, "account_unavailable"); }
    if (!response.ok) throw new AccountError(503, "account_unavailable");
    const result = object(await response.json());
    if (typeof result.error === "string") {
      const allowed: Record<string, number> = { account_inactive: 410, account_missing: 404, revision_conflict: 409, idempotency_conflict: 409, invalid_command: 400, week_limit: 409, rate_limited: 429 };
      throw new AccountError(allowed[result.error] ?? 503, result.error in allowed ? result.error : "account_unavailable");
    }
    return result;
  } };
}
export async function loadCatalogPin(url: string, key: string, token: string, revision: string, fetchImpl: typeof fetch = fetch): Promise<CatalogPin> {
  if (!/^[a-zA-Z0-9._:-]{1,128}$/.test(revision)) throw new AccountError(503, "catalog_pin_unavailable");
  try {
    const response = await fetchImpl(`${url.replace(/\/$/, "")}/rest/v1/wd_catalog_pins?catalog_revision=eq.${encodeURIComponent(revision)}&limit=1`, { headers: { apikey: key, Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(8000) });
    if (!response.ok) throw new Error("unavailable");
    const rows = await response.json();
    if (!Array.isArray(rows) || rows.length !== 1) throw new Error("unavailable");
    const row = object(rows[0]);
    if (row.catalog_revision !== revision || typeof row.snapshot_sha256 !== "string" || !/^[0-9a-f]{64}$/.test(row.snapshot_sha256) || typeof row.solver_revision !== "string" || !row.solver_revision || !Array.isArray(row.recipe_ids) || row.recipe_ids.length > 10000 || row.recipe_ids.some(x => typeof x !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(x))) throw new Error("invalid");
    return { version: integer(row.snapshot_version, 1, 2147483647), sha256: row.snapshot_sha256, solverRevision: row.solver_revision, catalogRevision: revision, recipeIds: new Set(row.recipe_ids) };
  } catch { throw new AccountError(503, "catalog_pin_unavailable"); }
}

export type DeletionJob = { userId: string; state: "deletion_pending" | "deleted"; appleLinked: boolean };
// Worker seam only. No live worker is bound or scheduled in this run. Each adapter must be retry-safe.
// A durable claim serializes jobs; final tombstone remains after Auth deletion. Billing never recreates it.
export async function finishAccountDeletion(job: DeletionJob, adapters: {
  claim: (id: string) => Promise<DeletionJob>;
  removePush: (id: string) => Promise<void>;
  revokeApple: (id: string) => Promise<void>;
  deleteAuth: (id: string) => Promise<void>;
  complete: (id: string) => Promise<void>;
}): Promise<{ state: "deleted" | "deletion_pending"; dependency?: string; subscriptionCancelled: false }> {
  if (!UUID.test(job.userId)) throw new AccountError(400, "invalid_id");
  let step = "claim";
  try {
    const owned = await adapters.claim(job.userId);
    if (owned.userId !== job.userId) throw new Error("ownership");
    if (owned.state === "deleted") return { state: "deleted", subscriptionCancelled: false };
    if (owned.state !== "deletion_pending") throw new Error("inactive");
    step = "push_cleanup"; await adapters.removePush(owned.userId);
    if (owned.appleLinked) { step = "apple_revocation"; await adapters.revokeApple(owned.userId); }
    // Auth deletion invalidates refresh sessions; outstanding JWTs remain denied by the account tombstone.
    step = "auth_deletion"; await adapters.deleteAuth(owned.userId);
    step = "completion"; await adapters.complete(owned.userId);
    return { state: "deleted", subscriptionCancelled: false };
  } catch { return { state: "deletion_pending", dependency: step, subscriptionCancelled: false }; }
}
export const commandDigest = (command: AccountCommand) => createHash("sha256").update(JSON.stringify({ action: command.action, body: command.body })).digest("hex");
