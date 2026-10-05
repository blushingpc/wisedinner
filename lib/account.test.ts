import test from "node:test";
import assert from "node:assert/strict";
import { AccountError, accountHandler, finishAccountDeletion, loadCatalogPin, supabaseAccountRepository, supabaseVerifier, type AccountRepository, type VerifiedAccount, type AccountCommand, type CatalogPin } from "./account.ts";
import { GET as accountGET } from "../app/api/v1/account/[[...path]]/route.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const key = "20000000-0000-4000-8000-000000000001", weekId = "30000000-0000-4000-8000-000000000001";
const now = 2000000000 * 1000;
const user = (id = A): VerifiedAccount => ({ id, token: "synthetic", authenticatedAt: now / 1000 - 20, providers: ["apple"] });
const prefs = { diet: "none", allergens: [], excludedSkuIds: [], household: 1, notifications: false };
const pin: CatalogPin = { version: 5, sha256: "a".repeat(64), solverRevision: "test-solver", catalogRevision: "test-catalog", recipeIds: new Set(["breakfast", "main"]) };
const week = { snapshotVersion: 5, snapshotSha256: pin.sha256, solverRevision: pin.solverRevision, catalogRevision: pin.catalogRevision, recipeIds: Array(15).fill("main"), seed: 7 };
const req = (method = "GET", path = "", body?: unknown, idempotency = key) => new Request(`https://test.invalid/api/v1/account/${path}`, { method, headers: { Authorization: "Bearer synthetic", "Content-Type": "application/json", "Idempotency-Key": idempotency }, body: body === undefined ? undefined : JSON.stringify(body) });
// Deliberately fake repository: tests exercise HTTP validation/ownership/lifecycle, NOT SQL/RLS.
function fakeRepository(): AccountRepository {
  const accounts = new Map<string, { revision: number; inactive: boolean; weeks: Map<string, { revision: number; week: unknown }>; receipts: Map<string, { request: string; result: unknown }> }>();
  return { async execute(u: VerifiedAccount, c: AccountCommand) {
    let a = accounts.get(u.id);
    if (!a && c.action === "initialize") { a = { revision: 1, inactive: false, weeks: new Map(), receipts: new Map() }; accounts.set(u.id, a); }
    if (!a) throw new AccountError(404, "account_missing");
    if (a.inactive && !["begin_deletion", "deletion_status"].includes(c.action)) throw new AccountError(410, "account_inactive");
    const prior = c.key ? a.receipts.get(c.key) : undefined; const digest = JSON.stringify(c);
    if (prior) { if (prior.request !== digest) throw new AccountError(409, "idempotency_conflict"); return prior.result; }
    let result: unknown;
    if (c.action === "update") { if (c.body.revision !== a.revision) throw new AccountError(409, "revision_conflict"); result = { revision: ++a.revision }; }
    else if (c.action === "save_week") { const old = a.weeks.get(c.body.id as string); if ((old?.revision ?? 0) !== c.body.revision) throw new AccountError(409, "revision_conflict"); const saved = { revision: (old?.revision ?? 0) + 1, week: c.body.week }; a.weeks.set(c.body.id as string, saved); result = saved; }
    else if (c.action === "delete_week") { const old = a.weeks.get(c.body.id as string); if (!old || old.revision !== c.body.revision) throw new AccountError(409, "revision_conflict"); a.weeks.delete(c.body.id as string); result = { deleted: true }; }
    else if (c.action === "list_weeks") result = { weeks: [...a.weeks.values()] };
    else if (c.action === "begin_deletion") { a.inactive = true; a.weeks.clear(); a.receipts.clear(); result = { state: "deletion_pending", subscriptionCancelled: false }; }
    else result = { revision: a.revision, state: a.inactive ? "deletion_pending" : "active" };
    if (c.key) a.receipts.set(c.key, { request: digest, result }); return result;
  } };
}
function harness(account = user(), repository = fakeRepository()) { return accountHandler({ verify: async () => account, repository, pin, now: () => now }); }
function jwt(patch: Record<string, unknown> = {}) { return `e30.${Buffer.from(JSON.stringify({ sub: A, iss: "https://project.supabase.co/auth/v1", aud: "authenticated", role: "authenticated", exp: now / 1000 + 100, amr: [{ method: "oauth", timestamp: now / 1000 - 20 }], ...patch })).toString("base64url")}.synthetic`; }
const authUser = { id: A, is_anonymous: false, identities: [{ provider: "apple" }] };
test("Auth server must verify signature/session before decoded claims can authorize", async () => {
  let calls = 0;
  const verify = supabaseVerifier("https://project.supabase.co", "synthetic-key", async (_url, options) => { calls++; assert.equal(new Headers(options?.headers).get("apikey"), "synthetic-key"); return Response.json(authUser); }, () => now);
  await assert.rejects(verify(new Request("https://test.invalid")), /invalid_session/); assert.equal(calls, 0);
  const actual = await verify(new Request("https://test.invalid", { headers: { Authorization: `Bearer ${jwt()}` } })); assert.equal(actual.id, A); assert.equal(actual.authenticatedAt, now / 1000 - 20);
  for (const patch of [{ exp: now / 1000 }, { iss: "https://attacker.invalid/auth/v1" }, { aud: "anon" }, { sub: B }, { role: "service_role" }]) await assert.rejects(verify(new Request("https://test.invalid", { headers: { Authorization: `Bearer ${jwt(patch)}` } })), /invalid_session/);
  const reject = supabaseVerifier("https://project.supabase.co", "synthetic-key", async () => new Response(null, { status: 401 }), () => now);
  await assert.rejects(reject(new Request("https://test.invalid", { headers: { Authorization: `Bearer ${jwt()}` } })), /invalid_session/);
});
test("Auth outage and anonymous users fail closed; refresh iat is not recent-auth proof", async () => {
  const outage = supabaseVerifier("https://project.supabase.co", "key", async () => { throw new Error("private provider detail"); }, () => now);
  await assert.rejects(outage(new Request("https://test.invalid", { headers: { Authorization: `Bearer ${jwt()}` } })), /auth_unavailable/);
  const anonymous = supabaseVerifier("https://project.supabase.co", "key", async () => Response.json({ ...authUser, is_anonymous: true }), () => now);
  await assert.rejects(anonymous(new Request("https://test.invalid", { headers: { Authorization: `Bearer ${jwt()}` } })), /invalid_session/);
  const verify = supabaseVerifier("https://project.supabase.co", "key", async () => Response.json(authUser), () => now);
  assert.equal((await verify(new Request("https://test.invalid", { headers: { Authorization: `Bearer ${jwt({ amr: [], iat: now / 1000 })}` } }))).authenticatedAt, null);
});
test("Logged out and forged ownership/tier cannot reach private writes", async () => {
  let called = false; const denied = accountHandler({ verify: async () => { throw new AccountError(401, "invalid_session"); }, repository: { execute: async () => { called = true; } } });
  assert.equal((await denied(req())).status, 401); assert.equal(called, false);
  const handle = harness();
  assert.equal((await handle(req("POST", "", { user_id: B, tier: "protein" }))).status, 400);
  assert.equal((await handle(req("PATCH", "", { revision: 1, preferences: { ...prefs, tier: "protein" } }))).status, 400);
});
test("Bounded stream, malformed payload, wrong type and missing idempotency reject before repository", async () => {
  const handle = harness();
  assert.equal((await handle(req("POST", "", { huge: "x".repeat(17000) }))).status, 413);
  assert.equal((await handle(req("POST", "", []))).status, 400);
  assert.equal((await handle(req("POST", "", {}, ""))).status, 400);
  assert.equal((await handle(new Request("https://test.invalid/api/v1/account", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{" }))).status, 400);
  assert.equal((await handle(req("GET", "weeks?limit=51"))).status, 400);
});
test("A/B account-owned reads, saves, deletes and optimistic competing writes", async () => {
  const repository = fakeRepository(); const a = harness(user(A), repository), b = harness(user(B), repository);
  await a(req("POST", "", {})); await b(req("POST", "", {}));
  assert.equal((await a(req("POST", "weeks", { id: weekId, revision: 0, week }, weekId))).status, 200);
  assert.deepEqual((await (await b(req("GET", "weeks"))).json()).result.weeks, []);
  assert.equal((await b(req("DELETE", `weeks/${weekId}`, { revision: 1 }, weekId))).status, 409);
  const responses = await Promise.all([a(req("PATCH", "", { revision: 1, preferences: prefs }, B)), a(req("PATCH", "", { revision: 1, preferences: prefs }, weekId))]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await a(req("GET"))).status, 200);
});
test("Saved weeks pin source/catalog/solver revisions and real recipe IDs; no client nutrient proof", async () => {
  const handle = harness(); await handle(req("POST", "", {}));
  for (const patch of [{ snapshotSha256: "b".repeat(64) }, { catalogRevision: "old" }, { solverRevision: "old" }]) assert.equal((await handle(req("POST", "weeks", { id: weekId, revision: 0, week: { ...week, ...patch } }, weekId))).status, 409);
  assert.equal((await handle(req("POST", "weeks", { id: weekId, revision: 0, week: { ...week, recipeIds: Array(15).fill("unknown") } }, weekId))).status, 400);
  assert.equal((await handle(req("POST", "weeks", { id: weekId, revision: 0, week: { ...week, feasible: true } }, weekId))).status, 400);
  const unconfigured = accountHandler({ verify: async () => user(), repository: fakeRepository() });
  assert.equal((await unconfigured(req("POST", "weeks", { id: weekId, revision: 0, week }, weekId))).status, 503);
});
test("Deletion requires signed recent authentication and intentional confirmation; retries do not resurrect", async () => {
  const repository = fakeRepository(); const handle = harness(user(), repository); await handle(req("POST", "", {}));
  assert.equal((await handle(req("DELETE", "", { confirmation: "yes" }, B))).status, 400);
  const stale = harness({ ...user(), authenticatedAt: now / 1000 - 301 }, repository);
  assert.equal((await stale(req("DELETE", "", { confirmation: "DELETE MY ACCOUNT" }, B))).status, 401);
  const deletion = req("DELETE", "", { confirmation: "DELETE MY ACCOUNT" }, B);
  const first = await (await handle(deletion)).json(); const retry = await (await handle(req("DELETE", "", { confirmation: "DELETE MY ACCOUNT" }, B))).json();
  assert.deepEqual(first, retry); assert.equal(first.result.subscriptionCancelled, false);
  assert.equal((await handle(req())).status, 410); assert.equal((await handle(req("POST", "", {}))).status, 410);
  assert.equal((await handle(req("GET", "deletion"))).status, 200);
});
test("Repository forwards user bearer, never service-role ownership override, and redacts provider errors", async () => {
  const repository = supabaseAccountRepository("https://project.supabase.co", "synthetic-key", async (_url, options) => {
    assert.equal(new Headers(options?.headers).get("authorization"), "Bearer synthetic");
    assert.equal(JSON.parse(options?.body as string).user_id, undefined); return Response.json({ error: "revision_conflict" });
  });
  await assert.rejects(repository.execute(user(), { action: "update", body: {}, key }), /revision_conflict/);
  const failing = supabaseAccountRepository("https://project.supabase.co", "key", async () => new Response("private error detail", { status: 500 }));
  await assert.rejects(failing.execute(user(), { action: "read", body: {}, key: null }), /account_unavailable/);
});
test("Catalog pins come from server-owned immutable rows, not client revision claims", async () => {
  const fetched = await loadCatalogPin("https://project.supabase.co", "key", "synthetic", "test-catalog", async () => Response.json([{ snapshot_version: 5, snapshot_sha256: "a".repeat(64), solver_revision: "test-solver", catalog_revision: "test-catalog", recipe_ids: ["main"] }]));
  assert.equal(fetched.recipeIds.has("main"), true);
  await assert.rejects(loadCatalogPin("https://project.supabase.co", "key", "synthetic", "test-catalog", async () => Response.json([])), /catalog_pin_unavailable/);
});
test("Deletion worker reports partial failure, retries in order, never cancels subscription or deletes another identity", async () => {
  const job = { userId: A, state: "deletion_pending" as const, appleLinked: true }; const steps: string[] = [];
  let fail = true;
  const adapters = { claim: async () => job, removePush: async () => { steps.push("push"); }, revokeApple: async () => { steps.push("apple"); if (fail) throw new Error("private token detail"); }, deleteAuth: async () => { steps.push("auth"); }, complete: async () => { steps.push("complete"); } };
  assert.deepEqual(await finishAccountDeletion(job, adapters), { state: "deletion_pending", dependency: "apple_revocation", subscriptionCancelled: false });
  assert.deepEqual(steps, ["push", "apple"]); fail = false;
  assert.equal((await finishAccountDeletion(job, adapters)).state, "deleted");
  assert.deepEqual(steps.slice(2), ["push", "apple", "auth", "complete"]);
  assert.equal((await finishAccountDeletion(job, { ...adapters, claim: async () => ({ ...job, userId: B }) })).dependency, "claim");
});
test("Actual versioned route preserves authentication errors and stays default-off", async () => {
  const names = ["WD_ACCOUNT_API_ENABLED", "SUPABASE_URL", "SUPABASE_ANON_KEY"];
  const previous = names.map(n => process.env[n]); const priorFetch = globalThis.fetch;
  try {
    delete process.env.WD_ACCOUNT_API_ENABLED;
    assert.equal((await accountGET(req())).status, 503);
    process.env.WD_ACCOUNT_API_ENABLED = "true"; process.env.SUPABASE_URL = "https://project.supabase.co"; process.env.SUPABASE_ANON_KEY = "synthetic";
    globalThis.fetch = async () => new Response(null, { status: 401 });
    assert.equal((await accountGET(new Request("https://test.invalid/api/v1/account", { headers: { Authorization: `Bearer ${jwt()}` } }))).status, 401);
  } finally { names.forEach((n, i) => { if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i]; }); globalThis.fetch = priorFetch; }
});
