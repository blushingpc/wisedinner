// LOCAL synthetic Auth/RPC replies through actual installed HTTP components.
// No signature verification, hosted Auth, customer, network or database proof.
import test from "node:test";
import assert from "node:assert/strict";
import {accountHandler, supabaseAccountRepository, supabaseVerifier} from "./account.ts";
import {composeOwnerPlanServer} from "./owner-plan-server.ts";
import {POST as accountPOST} from "../app/api/v1/account/[[...path]]/route.ts";

const id = "10000000-0000-4000-8000-000000000001";
const key = "20000000-0000-4000-8000-000000000001";
const origin = "https://auth-fixture.invalid", now = Date.parse("2026-10-09T08:30:00Z");
const confirmed = "2026-10-08T00:00:00Z";
const baseUser = {id, is_anonymous: false, identities: [{provider: "email"}]};
function token(patch: Record<string, unknown> = {}) {
  return "e30." + Buffer.from(JSON.stringify({sub: id, iss: origin + "/auth/v1", aud: "authenticated", role: "authenticated", exp: now / 1000 + 600, amr: [{method: "otp", timestamp: now / 1000 - 10}], ...patch})).toString("base64url") + ".fixture";
}
function request(method = "POST", path = "", body: unknown = {}, claims: Record<string, unknown> = {}) {
  return new Request("https://backend-fixture.invalid/api/v1/account" + path, {method, headers: {authorization: "Bearer " + token(claims), "content-type": "application/json", "idempotency-key": key}, ...(method === "GET" ? {} : {body: JSON.stringify(body)})});
}
function composition(user: Record<string, unknown>, authStatus = 200) {
  let authCalls = 0, rpcCalls = 0;
  const actions: string[] = [];
  const fetcher: typeof fetch = async (input, init) => {
    assert.equal(init?.cache, "no-store"); assert.equal(init?.redirect, "error"); assert.ok(init?.signal);
    assert.equal(new Headers(init?.headers).get("authorization"), "Bearer " + token());
    if (String(input) === origin + "/auth/v1/user") {authCalls++; return Response.json(user, {status: authStatus});}
    assert.equal(String(input), origin + "/rest/v1/rpc/wd_account_command");
    rpcCalls++; const command = JSON.parse(String(init?.body)); actions.push(command.p_action);
    assert.equal(command.user_id, undefined);
    return Response.json({state: "active", revision: 1});
  };
  const verify = supabaseVerifier(origin, "fixture-public-key", fetcher, () => now);
  const handler = accountHandler({verify, repository: supabaseAccountRepository(origin, "fixture-public-key", fetcher), now: () => now});
  return {verify, handler, fetcher, counts: () => ({authCalls, rpcCalls, actions})};
}
const rejected: [string, Record<string, unknown>][] = [
  ["null server email confirmation", {email_confirmed_at: null}],
  ["missing server email confirmation", {}],
  ["empty server email confirmation", {email_confirmed_at: ""}],
  ["numeric server email confirmation", {email_confirmed_at: now - 1000}],
  ["object server email confirmation", {email_confirmed_at: {verified: true}}],
  ["unparseable server email confirmation", {email_confirmed_at: "not-a-time"}],
  ["date-only server email confirmation", {email_confirmed_at: "2026-10-08"}],
  ["rolled-over calendar date", {email_confirmed_at: "2026-02-30T00:00:00Z"}],
  ["invalid clock component", {email_confirmed_at: "2026-10-08T24:00:00Z"}],
  ["future server email confirmation", {email_confirmed_at: "2026-10-09T08:30:00.001Z"}],
  ["epoch server email confirmation", {email_confirmed_at: "1970-01-01T00:00:00Z"}],
  ["whitespace server email confirmation", {email_confirmed_at: " 2026-10-08T00:00:00Z "}],
  ["phone-only and editable metadata confirmation", {confirmed_at: confirmed, phone_confirmed_at: confirmed, user_metadata: {email_verified: true}, app_metadata: {providers: ["email", "apple", "google"]}}],
];
for (const [label, patch] of rejected) test("installed verifier/handler/RPC refuses " + label, async () => {
  const f = composition({...baseUser, ...patch}), response = await f.handler(request());
  assert.equal(response.status, 401); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {error: "invalid_session"});
  assert.deepEqual(f.counts(), {authCalls: 1, rpcCalls: 0, actions: []});
});
for (const [provider, email, timestamp] of [
  ["email", "code-fixture@example.invalid", confirmed],
  ["apple", "relay-fixture@privaterelay.appleid.com", "2026-10-08T00:00:00.123456Z"],
  ["google", "oauth-fixture@example.invalid", "2026-10-08T02:00:00+02:00"],
] as const) test("server-confirmed " + provider + " retains installed account initialization", async () => {
  const f = composition({...baseUser, email, email_confirmed_at: timestamp, identities: [{provider}]}), response = await f.handler(request());
  assert.equal(response.status, 200); assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(f.counts(), {authCalls: 1, rpcCalls: 1, actions: ["initialize"]});
  const account = await f.verify(request()); assert.equal(account.id, id); assert.deepEqual(account.providers, [provider]); assert.equal(account.authenticatedAt, now / 1000 - 10);
});
test("decoded confirmation and provider claims cannot replace independent server confirmation", async () => {
  let rpcCalls = 0;
  const verify = supabaseVerifier(origin, "fixture-public-key", async () => Response.json(baseUser), () => now);
  const handler = accountHandler({verify, repository: {execute: async () => {rpcCalls++;}}});
  const response = await handler(request("POST", "", {}, {email_confirmed_at: confirmed, email_verified: true, user_metadata: {email_verified: true}, providers: ["apple"]}));
  assert.equal(response.status, 401); assert.equal(rpcCalls, 0);
});
test("unconfirmed user cannot cross account reads, mutation or deletion HTTP boundaries", async () => {
  const f = composition({...baseUser, email_confirmed_at: null});
  for (const [method, endpoint, body] of [["GET", "", null], ["GET", "/weeks", null], ["GET", "/deletion", null], ["PATCH", "", {}], ["POST", "/weeks", {}], ["DELETE", "", {confirmation: "DELETE MY ACCOUNT"}]] as const) {
    assert.equal((await f.handler(request(method, endpoint, body))).status, 401);
  }
  assert.equal(f.counts().rpcCalls, 0);
});
test("unconfirmed user cannot enter actual owner-plan admission or transaction", async () => {
  const f = composition({...baseUser, email_confirmed_at: null}); let admission = 0, transactions = 0;
  const server = composeOwnerPlanServer({verify: f.verify, admit: async () => {admission++; throw Error("must_not_admit");}, transactions: {transaction: async () => {transactions++; throw Error("must_not_transact");}}});
  for (const method of ["GET", "PUT"] as const) {
    const response = await server.handler(new Request("https://backend-fixture.invalid/proposal/owner-plan-v2", {method, headers: {authorization: "Bearer " + token(), "content-type": "application/json", "idempotency-key": key}, ...(method === "PUT" ? {body: "{}"} : {})}));
    assert.equal(response.status, 401);
  }
  assert.equal(admission, 0); assert.equal(transactions, 0);
});
test("confirmed timestamp does not replace signature response or signed issuer/recent-auth checks", async () => {
  const denied = composition({...baseUser, email_confirmed_at: confirmed}, 401);
  assert.equal((await denied.handler(request())).status, 401); assert.equal(denied.counts().rpcCalls, 0);
  let rpcCalls = 0;
  const verify = supabaseVerifier(origin, "fixture-public-key", async () => Response.json({...baseUser, email_confirmed_at: confirmed}), () => now);
  const handler = accountHandler({verify, repository: {execute: async () => {rpcCalls++;}}, now: () => now});
  assert.equal((await handler(request("POST", "", {}, {iss: "https://other-fixture.invalid/auth/v1"}))).status, 401);
  for (const amr of [[], [{method: "otp", timestamp: now / 1000 - 301}]]) assert.equal((await handler(request("DELETE", "", {confirmation: "DELETE MY ACCOUNT"}, {amr}))).status, 401);
  assert.equal(rpcCalls, 0);
});
test("actual versioned account POST refuses unconfirmed Auth before RPC and preserves confirmed path", async () => {
  const names = ["WD_ACCOUNT_API_ENABLED", "SUPABASE_URL", "SUPABASE_ANON_KEY"], previous = names.map(n => process.env[n]), priorFetch = globalThis.fetch;
  try {
    process.env.WD_ACCOUNT_API_ENABLED = "true"; process.env.SUPABASE_URL = origin; process.env.SUPABASE_ANON_KEY = "fixture-public-key";
    // Actual route uses the real current clock, so its synthetic token is generated from that clock.
    for (const valid of [false, true]) {
      let calls = 0; globalThis.fetch = async input => {
        if (String(input).endsWith("/auth/v1/user")) return Response.json({...baseUser, email_confirmed_at: valid ? confirmed : null});
        calls++; assert.equal(String(input), origin + "/rest/v1/rpc/wd_account_command"); return Response.json({revision: 1});
      };
      const r = request("POST", "", {}, {exp: Math.floor(Date.now() / 1000) + 600});
      assert.equal((await accountPOST(r)).status, valid ? 200 : 401); assert.equal(calls, valid ? 1 : 0);
    }
  } finally {names.forEach((n, i) => {if (previous[i] === undefined) delete process.env[n]; else process.env[n] = previous[i];}); globalThis.fetch = priorFetch;}
});
