import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createAccountDeletionV2Service, supabaseDeletionAuthV2, advanceAccountDeletionV2, deletionRecoveryHash, deletionIntentHash, type DeletionV2Repository, type DeletionV2Providers } from "./account-deletion-v2.server.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import type { VerifiedAccount } from "./account.ts";

const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
type Data = Record<string, unknown>;
// Explicit TEST policy only. No production duration or retention approval inferred.
const policy = { approved: true, version: "isolated-test-only", preparedSeconds: 3600, pendingSeconds: 3600, recoverySeconds: 3600, receiptSeconds: 3600, retainedEvidence: ["account_marker", "deletion_receipt", "billing_evidence"] };
const policyHash = createHash("sha256").update(JSON.stringify(canonicalReferenceData(policy))).digest("hex");
async function fixture(apple = true) {
  const dir = await mkdtemp(path.join(tmpdir(), "wd-deletion-v2-"));
  let db = await PGlite.create(dir), deletes = 0, loseDelete = false, authMissing = false, precise404 = true;
  let chain: Promise<unknown> = Promise.resolve();
  const serial = <T>(fn: () => Promise<T>): Promise<T> => { const result = chain.then(fn); chain = result.catch(() => {}); return result; };
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
  for (const file of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql", "0021_wd_deletion_lifecycle_v2.sql"]) await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  await db.query("insert into public.wd_accounts(user_id,preferences)values($1,'{\"diet\":\"synthetic\"}'),($2,'{}')", [A, B]);
  await db.exec("create table public.ce_isolated_sentinel(id int primary key);insert into public.ce_isolated_sentinel values(7);create table public.source_isolated_sentinel(id int primary key);insert into public.source_isolated_sentinel values(43)");
  await db.query("insert into public.wd_billing_bindings(user_id)values($1),($2)", [A, B]);
  await db.query("insert into public.wd_billing_states(user_id,environment,state)values($1,'SANDBOX','{\"state\":\"unknown\",\"reason\":\"original_purchase_ack_lost\"}')", [A]);
  await db.query("insert into public.wd_billing_transactions(environment,transaction_hash,user_id)values('SANDBOX',$1,$2)", ["a".repeat(64), A]);
  const role = async (name: string, owner = A, age = 0) => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: name, sub: owner, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) - age }] })]); await db.exec(`set role ${name}`); };
  const rpc = (name: string, action: string, body: Data, owner = A, age = 0) => serial(async () => { await role(name === "wd_deletion_v2_account_command" || name === "wd_account_command" ? "authenticated" : "service_role", owner, age); return (await db.query<{ result: Data }>(`select public.${name}($1,$2::jsonb) result`, [action, JSON.stringify(body)])).rows[0].result; });
  const repository: DeletionV2Repository = { account: (account, action, body) => rpc("wd_deletion_v2_account_command", action, body, account.id), worker: (action, body) => rpc("wd_deletion_v2_worker_command", action, body) };
  const fetcher: typeof fetch = async (input, init) => {
    const url = String(input);
    if (url.includes("/rest/v1/rpc/")) { const body = JSON.parse(String(init?.body)); return Response.json(await repository.worker(body.p_action, body.p_body)); }
    assert.equal(url, `https://fixture.invalid/auth/v1/admin/users/${A}`);
    if (init?.method === "DELETE") { deletes++; authMissing = true; if (loseDelete) throw Error("synthetic lost DELETE acknowledgement"); return Response.json({}); }
    return authMissing ? Response.json({ code: precise404 ? "user_not_found" : "generic_gateway_missing" }, { status: 404 }) : Response.json({ id: A, created_at: "2026-10-01T00:00:00Z", is_anonymous: false, identities: [{ identity_id: "30000000-0000-4000-8000-000000000001", user_id: A, provider: apple ? "apple" : "email", id: "synthetic-subject", created_at: "2026-10-01T00:00:00Z" }] });
  };
  const providers = supabaseDeletionAuthV2("https://fixture.invalid", "synthetic-server-credential", fetcher);
  let signedOut = false, authAge = 0;
  const verify = async (request: Request): Promise<VerifiedAccount> => { if (signedOut) throw Error("signed out"); return { id: request.headers.get("authorization") === "Bearer B" ? B : A, token: "synthetic", providers: ["apple"], authenticatedAt: Math.floor(Date.now() / 1000) - authAge }; };
  const service = (extra: Partial<{ policy: unknown; providers: DeletionV2Providers; repository: DeletionV2Repository }> = {}) => createAccountDeletionV2Service({ enabled: true, verify, repository, providers, policy, ...extra });
  const op = randomUUID(), capability = randomBytes(32).toString("base64url");
  const originalIntent = deletionIntentHash(A, op, 1, deletionRecoveryHash(op, capability), policyHash);
  const call = async (operation: string, extra: Data = {}, opts: { owner?: string; secret?: string; intentHeader?: string; handler?: ReturnType<typeof service> } = {}) => {
    const body = { contract: "wd-account-deletion-v2", operation, operationId: op, ...(operation === "status" ? {} : { expectedAccountRevision: 1 }), ...extra };
    const response = await (opts.handler ?? service())(new Request("https://fixture.invalid/api/v1/account/deletion-v2", { method: "POST", headers: { "content-type": "application/json", ...(operation === "prepare" ? { "x-wd-deletion-intent-sha256": opts.intentHeader ?? originalIntent } : {}), ...(operation === "status" ? { authorization: `Deletion-Recovery ${opts.secret ?? capability}` } : { authorization: `Bearer ${opts.owner ?? "A"}`, "x-wd-deletion-recovery": opts.secret ?? capability }) }, body: JSON.stringify(body) }));
    return { status: response.status, body: await response.json() as { result: Data } };
  };
  const admin = <T>(fn: (db: PGlite) => Promise<T>) => serial(async () => { await db.exec("reset role"); return fn(db); });
  const reopen = () => serial(async () => { await db.close(); db = await PGlite.create(dir); });
  return { op, capability, originalIntent, repository, providers, call, rpc, admin, reopen, service, setPrecise404: (v: boolean) => { precise404 = v; }, setSignedOut: (v: boolean) => { signedOut = v; }, setAuthAge: (v: number) => { authAge = v; }, loseDelete: () => { loseDelete = true; }, deletes: () => deletes, close: async () => { await chain; await db.close(); await rm(dir, { recursive: true }); } };
}

test("D1-D3/D6-D9 real HTTP/SQL original intent, manual Apple path, least-privilege recovery and retained sentinels", async () => {
  const f = await fixture();
  try {
    assert.equal((await f.call("prepare", {}, { handler: f.service({ policy: undefined }) })).status, 503);
    const prepared = await f.call("prepare"); assert.equal(prepared.status, 200); const intent = prepared.body.result.intentSha256;
    assert.match(String(intent), /^[a-f0-9]{64}$/);
    await f.reopen(); // lost prepare ACK: recover original status, never repeat prepare.
    assert.deepEqual((await f.call("status", { intentSha256: f.originalIntent })).body, prepared.body);
    assert.equal((await f.call("prepare", { operationId: randomUUID() })).status, 409);
    assert.equal((await f.call("confirm", { intentSha256: intent, expectedAccountRevision: 2, confirmation: "DELETE MY ACCOUNT" })).status, 409);
    assert.equal((await f.call("prepare", {}, { secret: randomBytes(32).toString("base64url") })).status, 409);
    assert.equal((await f.call("prepare", {}, { owner: "B" })).status, 409);
    assert.equal((await f.rpc("wd_account_command", "begin_deletion", { confirmation: "DELETE MY ACCOUNT" })).error, "deletion_v2_required");
    assert.equal((await f.rpc("wd_deletion_command", "claim", { userId: A, owner: randomUUID() })).error, "deletion_v2_required");
    f.setAuthAge(301); assert.equal((await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" })).status, 409); f.setAuthAge(0);
    assert.equal((await f.call("confirm", { intentSha256: "f".repeat(64), confirmation: "DELETE MY ACCOUNT" })).status, 409);
    const confirmed = await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" });
    assert.equal(confirmed.status, 200); assert.equal(confirmed.body.result.intentState, "settled"); assert.equal(confirmed.body.result.applicationData, "cleared"); assert.equal(confirmed.body.result.authDeletion, "confirmed"); assert.equal(confirmed.body.result.appleRevocation, "manual_required"); assert.equal(confirmed.body.result.subscriptionCancelled, false); assert.equal(f.deletes(), 1);
    assert.equal((await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" })).body.result.intentState, "settled"); assert.equal(f.deletes(), 1);
    assert.equal((await f.repository.worker("proof", { operationId: f.op, intentSha256: intent, owner: randomUUID(), attempt: 1, dependency: "apple", providerOperationId: randomUUID(), identityHash: "a".repeat(64), evidenceHash: "b".repeat(64), outcome: "confirmed" }) as Data).error, "invalid_progress");
    f.setSignedOut(true); await f.reopen();
    const recovered = await f.call("status", { intentSha256: intent }); assert.equal(recovered.status, 200); assert.deepEqual(recovered.body.result, confirmed.body.result);
    const publicReceipt = JSON.stringify(recovered.body);
    for (const forbidden of [f.capability, "identity_hash", "verifier", "user_id", "synthetic-subject", "price", "token", "provider_receipt"]) assert.equal(publicReceipt.includes(forbidden), false);
    for (const extra of [{ intentSha256: "e".repeat(64) }, { intentSha256: intent, operationId: randomUUID() }, { intentSha256: intent, owner: A }]) assert.equal((await f.call("status", extra)).status, 409);
    assert.equal((await f.call("status", { intentSha256: intent }, { secret: randomBytes(32).toString("base64url") })).status, 409);
    await f.admin(async db => {
      assert.deepEqual((await db.query("select id from public.ce_isolated_sentinel")).rows, [{ id: 7 }]);
      assert.deepEqual((await db.query("select id from public.source_isolated_sentinel")).rows, [{ id: 43 }]);
      assert.equal((await db.query("select * from public.wd_billing_bindings")).rows.length, 2);
      assert.deepEqual((await db.query("select state from public.wd_billing_states where user_id=$1", [A])).rows, [{ state: { state: "unknown", reason: "original_purchase_ack_lost" } }]);
      assert.deepEqual((await db.query("select environment,transaction_hash,user_id from public.wd_billing_transactions")).rows, [{ environment: "SANDBOX", transaction_hash: "a".repeat(64), user_id: A }]);
      assert.deepEqual((await db.query("select state,preferences from public.wd_accounts where user_id=$1", [B])).rows, [{ state: "active", preferences: {} }]);
      assert.equal((await db.query<{ state: string }>("select state from public.wd_accounts where user_id=$1", [A])).rows[0].state, "deleted");
      const privateRow = JSON.stringify((await db.query("select * from wd_deletion_v2_private.intents")).rows); assert.equal(privateRow.includes(f.capability), false);
      await db.query("update wd_deletion_v2_private.intents set recovery_until=now()-interval '1 second'");
    });
    assert.equal((await f.call("status", { intentSha256: intent })).status, 409);
  } finally { await f.close(); }
});

for (const boundary of ["admit", "prepare"] as const) {
  test(`P3/P4 lost ACK immediately after ${boundary}: disk status recovers precomputed original, no repeated prepare`, async () => {
    const f = await fixture(false);
    try {
      // This exists BEFORE first HTTP request and never comes from its response.
      const persistedOriginal = { operationId: f.op, intentSha256: f.originalIntent, capability: f.capability };
      let admissions = 0, accountPrepares = 0;
      const repository: DeletionV2Repository = {
        worker: async (action, body) => { const result = await f.repository.worker(action, body); if (action === "admit") { admissions++; if (boundary === "admit") throw Error("stopped after SQL admit before account prepare"); } return result; },
        account: async (owner, action, body) => { const result = await f.repository.account(owner, action, body); if (action === "prepare") { accountPrepares++; throw Error("completed prepare ACK lost"); } return result; },
      };
      assert.equal((await f.call("prepare", {}, { handler: f.service({ repository }) })).status, 409);
      assert.equal(admissions, 1); assert.equal(accountPrepares, boundary === "admit" ? 0 : 1); assert.equal(f.deletes(), 0);
      await f.reopen();
      const recovered = await f.call("status", { intentSha256: persistedOriginal.intentSha256 });
      assert.equal(recovered.status, 200); assert.equal(recovered.body.result.operationId, persistedOriginal.operationId); assert.equal(recovered.body.result.intentSha256, persistedOriginal.intentSha256);
      assert.equal(recovered.body.result.intentState, "prepared"); assert.equal(recovered.body.result.nextAction, "confirm_with_recent_auth");
      assert.equal(recovered.body.result.applicationData, "pending"); assert.equal(recovered.body.result.authDeletion, "pending");
      f.setAuthAge(301); assert.equal((await f.call("confirm", { intentSha256: persistedOriginal.intentSha256, confirmation: "DELETE MY ACCOUNT" })).status, 409); f.setAuthAge(0);
      const confirmed = await f.call("confirm", { intentSha256: persistedOriginal.intentSha256, confirmation: "DELETE MY ACCOUNT" });
      assert.equal(confirmed.body.result.intentState, "settled"); assert.equal(f.deletes(), 1);
      // Discard the successful confirm ACK. Original status, never a second
      // confirm/prepare, is the only recovery action after another disk reopen.
      f.setSignedOut(true); await f.reopen();
      const final = await f.call("status", { intentSha256: persistedOriginal.intentSha256 });
      assert.equal(final.status, 200); assert.deepEqual(final.body.result, confirmed.body.result);
      assert.equal(admissions, 1); assert.equal(accountPrepares, boundary === "admit" ? 0 : 1); assert.equal(f.deletes(), 1);
    } finally { await f.close(); }
  });
}

test("D4/D5 actual Auth lost DELETE ACK survives disk reopen and reconciles exact original without another DELETE", async () => {
  const f = await fixture(false);
  try {
    const intent = (await f.call("prepare")).body.result.intentSha256 as string;
    f.setSignedOut(true); assert.equal((await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" })).status, 409); assert.equal(f.deletes(), 0); f.setSignedOut(false);
    f.loseDelete(); const first = await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" });
    assert.equal(first.body.result.authDeletion, "unknown"); assert.equal(f.deletes(), 1);
    await f.reopen();
    f.setPrecise404(false);
    assert.equal((await advanceAccountDeletionV2(f.repository, f.providers, f.op, intent)).authDeletion, "unknown"); assert.equal(f.deletes(), 1);
    f.setPrecise404(true);
    const settled = await advanceAccountDeletionV2(f.repository, f.providers, f.op, intent);
    assert.equal(settled.intentState, "settled"); assert.equal(settled.authDeletion, "confirmed"); assert.equal(settled.appleRevocation, "not_required"); assert.equal(f.deletes(), 1);
    await f.reopen(); assert.equal((await f.call("status", { intentSha256: intent })).body.result.intentState, "settled");
  } finally { await f.close(); }
});

for (const lostAction of ["proof", "complete"] as const) {
  test(`D5 original ${lostAction} commit acknowledgement lost, disk reopen preserves known effect`, async () => {
    const f = await fixture(false);
    try {
      let lost = false;
      const repository: DeletionV2Repository = { ...f.repository, worker: async (action, body) => { const result = await f.repository.worker(action, body); if (!lost && action === lostAction) { lost = true; throw Error("synthetic committed acknowledgement lost"); } return result; } };
      const handler = f.service({ repository });
      const intent = (await f.call("prepare", {}, { handler })).body.result.intentSha256 as string;
      await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" }, { handler }); assert.equal(lost, true); assert.equal(f.deletes(), 1);
      await f.reopen();
      const settled = await advanceAccountDeletionV2(f.repository, f.providers, f.op, intent);
      assert.equal(settled.intentState, "settled"); assert.equal(settled.operationId, f.op); assert.equal(settled.intentSha256, intent); assert.equal(f.deletes(), 1);
    } finally { await f.close(); }
  });
}

test("D7 SQL role/grant/RLS/fixed-search-path boundaries and original CAS rejects hostile owners", async () => {
  const f = await fixture();
  try {
    const intent = (await f.call("prepare")).body.result.intentSha256;
    assert.equal((await f.rpc("wd_deletion_v2_account_command", "confirm", { operationId: f.op, expectedAccountRevision: 1, recoveryHash: deletionRecoveryHash(f.op, f.capability), intentSha256: intent, confirmation: "DELETE MY ACCOUNT" }, B)).error, "recovery_unavailable");
    assert.equal((await f.rpc("wd_deletion_v2_account_command", "confirm", { operationId: f.op, expectedAccountRevision: 1, recoveryHash: deletionRecoveryHash(f.op, f.capability), intentSha256: intent, confirmation: "DELETE MY ACCOUNT" }, A, 301)).error, "recent_auth_required");
    await f.admin(async db => {
      const table = (await db.query<{ relrowsecurity: boolean; relforcerowsecurity: boolean }>("select relrowsecurity,relforcerowsecurity from pg_class where oid='wd_deletion_v2_private.intents'::regclass")).rows[0]; assert.deepEqual(table, { relrowsecurity: true, relforcerowsecurity: true });
      for (const name of ["anon", "authenticated", "service_role"]) {
        await db.exec(`set role ${name}`); await assert.rejects(db.query("select * from wd_deletion_v2_private.intents"), /permission denied/); await db.exec("reset role");
      }
      for (const name of ["anon", "authenticated"]) { await db.exec(`set role ${name}`); await assert.rejects(db.query("select public.wd_deletion_v2_worker_command('claim','{}')"), /permission denied/); await db.exec("reset role"); }
      const functions = (await db.query<{ proconfig: string[] }>("select proconfig from pg_proc where proname in('wd_deletion_v2_account_command','wd_deletion_v2_worker_command')")).rows; assert.equal(functions.length, 2); assert.ok(functions.every(x => x.proconfig.includes('search_path=""')));
    });
  } finally { await f.close(); }
});

for (const outcome of ["confirmed", "failed", "unknown", "not_started", "forged"] as const) {
  test(`D4 Apple ${outcome} remains distinct and never prevents local/Auth deletion`, async () => {
    const f = await fixture();
    try {
      let calls = 0;
      const apple: NonNullable<DeletionV2Providers["apple"]> = { run: async target => { calls++; return { ...target, ...(outcome === "forged" ? { operationId: randomUUID() } : {}), outcome: outcome === "forged" ? "confirmed" : outcome, evidenceHash: "a".repeat(64) }; } };
      const handler = f.service({ providers: { ...f.providers, apple } });
      const intent = (await f.call("prepare", {}, { handler })).body.result.intentSha256;
      const result = (await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" }, { handler })).body.result;
      assert.equal(result.intentState, "settled"); assert.equal(result.authDeletion, "confirmed");
      assert.equal(result.appleRevocation, ["confirmed", "failed"].includes(outcome) ? outcome : "unknown");
      assert.equal(calls, 1); assert.equal(f.deletes(), 1);
      await f.reopen();
      await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" }, { handler }); assert.equal(calls, 1); assert.equal(f.deletes(), 1);
    } finally { await f.close(); }
  });
}

test("D2/D4/D5 original pending/unknown provider operations cannot be blindly replayed or changed by stale claims", async () => {
  const f = await fixture();
  try {
    let appleCalls = 0, authCalls = 0, reconciles = 0;
    const providers: DeletionV2Providers = { verifyIdentity: f.providers.verifyIdentity, apple: { run: async () => { appleCalls++; throw Error("one-time exchange uncertain"); } }, auth: { run: async t => { authCalls++; return { ...t, outcome: "unknown", evidenceHash: "a".repeat(64) }; }, reconcile: async t => { reconciles++; return { ...t, outcome: "unknown", evidenceHash: "b".repeat(64) }; } } };
    const handler = f.service({ providers });
    const intent = (await f.call("prepare", {}, { handler })).body.result.intentSha256 as string;
    const first = await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" }, { handler });
    assert.equal(first.body.result.appleRevocation, "unknown"); assert.equal(first.body.result.authDeletion, "unknown");
    await f.reopen();
    await f.call("confirm", { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" }, { handler });
    assert.equal(appleCalls, 1); assert.equal(authCalls, 1); assert.equal(reconciles, 1);
    const common = { operationId: f.op, intentSha256: intent, owner: randomUUID(), attempt: 1 };
    assert.equal((await f.repository.worker("complete", common) as Data).error, "stale_claim");
    assert.equal((await f.repository.worker("begin", { ...common, dependency: "auth", extra: true }) as Data).error, "invalid_command");
    assert.equal((await f.repository.worker("nonexistent", common) as Data).error, "invalid_command");
    const owner = randomUUID(); const claimed = await f.repository.worker("claim", { operationId: f.op, intentSha256: intent, owner }) as { work: { attempt: number } };
    assert.equal((await f.repository.worker("claim", { operationId: f.op, intentSha256: intent, owner: randomUUID() }) as Data).error, "claim_busy");
    assert.equal((await f.repository.worker("proof", { operationId: f.op, intentSha256: intent, owner, attempt: claimed.work.attempt, dependency: "auth", providerOperationId: randomUUID(), identityHash: "a".repeat(64), outcome: "confirmed", evidenceHash: "b".repeat(64) }) as Data).error, "invalid_progress");
    await f.admin(async db => { await db.query("update public.wd_deletion_work set lease_until=now()-interval '1 second' where user_id=$1", [A]); });
    assert.equal((await f.repository.worker("complete", { operationId: f.op, intentSha256: intent, owner, attempt: claimed.work.attempt }) as Data).error, "stale_claim");
  } finally { await f.close(); }
});
