import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { hash } from "../scripts/data/price-evidence.ts";
import { createCurrentOwnerRpcStatePort } from "./generated-current-rpc-state.ts";
import { admitVerifiedReferenceOwner } from "./generated-owner-scope.ts";
import { createReferenceSessionHandlerV2 } from "./generated-plan-session.ts";
import { syntheticV2, op } from "./generated-plan-v2.test-support.ts";
import { createCurrentOwnerIntegrationHandler, type CurrentOwnerServiceDependencies } from "./generated-current-owner-service.ts";
import { createCurrentOwnerServer } from "./generated-current-owner-server.ts";

const A = "10000000-0000-4000-8000-000000000101", B = "10000000-0000-4000-8000-000000000102";
const OP = "20000000-0000-4000-8000-000000000101";
const key = (owner: string) => hash({ protocol: "joined-session-v2", namespace: `wd-current-catalog-1300-v1/${owner}` });
const empty = { current: null, draft: null, revision: 0 };

async function fixture(restrictedMigrationActor = false) {
  // Isolated PostgreSQL memory only. No URL, env, credentials, customer rows or providers.
  const db = await PGlite.create("memory://");
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
  if (restrictedMigrationActor) {
    await db.exec("create role fixture_migrator createrole bypassrls nosuperuser;grant all on schema public to fixture_migrator with grant option;grant usage on schema auth to fixture_migrator");
    const database = (await db.query<{ name: string }>("select current_database() name")).rows[0].name;
    await db.exec(`grant create on database "${database.replaceAll('"', '""')}" to fixture_migrator;set role fixture_migrator`);
  }
  for (const file of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url), "utf8"));
  }
  await db.query("insert into public.wd_accounts(user_id)values($1),($2)", [A, B]);
  await db.exec("create table public.unrelated_sentinel(id integer primary key);insert into public.unrelated_sentinel values(7)");
  const role = async (name = "service_role", owner = A) => {
    await db.exec("reset role");
    await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: name, sub: owner, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) }] })]);
    await db.exec(`set role ${name}`);
  };
  await role();
  const rpc = async (action: string, body = {}, owner = A, revision = 1, scope = key(owner), expires: number | null = Date.now() + 60000) => (await db.query<{ result: Record<string, unknown> }>(
    "select public.wd_current_plan_rpc($1::uuid,$2::int,$3,$4,$5::jsonb,$6::bigint) result", [owner, revision, scope, action, JSON.stringify(body), action === "commit" ? expires : null],
  )).rows[0].result;
  const commit = (operationId = OP, expectedRevision = 0, expectedRecordSha256: string | null = null) => {
    const state = { ...empty, revision: expectedRevision + 1 };
    const operation = { operationId, intentSha256: "a".repeat(64), receipt: { outcome: "acknowledged", operationId, state, committedSourcePolicyBasisSha256: "b".repeat(64) } };
    return { operation, expectedRevision, expectedRecordSha256, stateRecordSha256: hash(state), operationRecordSha256: hash(operation) };
  };
  return { db, role, rpc, commit };
}

test("current owner SQL hides private tables, constrains scope and atomically preserves original receipts", async () => {
  const f = await fixture();
  try {
    for (const role of ["anon", "authenticated", "service_role"]) {
      await f.role(role);
      await assert.rejects(f.db.query("select * from wd_current_private.states"), /permission denied/);
      if (role !== "service_role") await assert.rejects(f.rpc("read_state"), /permission denied/);
    }
    await f.role();
    assert.deepEqual(await f.rpc("read_state"), { state: null, meta: null });
    assert.equal((await f.rpc("read_state", {}, A, 1, key(B))).error, "owner_scope_mismatch");
    assert.equal((await f.rpc("read_state", {}, A, 2)).error, "owner_revision_changed");
    const body = f.commit();
    assert.equal((await f.rpc("commit", body)).outcome, "committed");
    const saved = await f.rpc("read_state");
    assert.deepEqual(saved.state, body.operation.receipt.state);
    assert.equal((await f.rpc("commit", body)).outcome, "known");
    const conflict = structuredClone(body); conflict.operation.intentSha256 = "c".repeat(64);
    assert.equal((await f.rpc("commit", conflict)).error, "idempotency_conflict");
    assert.equal((await f.rpc("commit", f.commit("20000000-0000-4000-8000-000000000102"))).error, "revision_conflict");
    assert.deepEqual((await f.rpc("read_operation", { operationId: OP })).operation, body.operation);
    assert.equal((await f.rpc("read_operation", { operationId: OP }, B)).operation, null);
    assert.deepEqual(await f.rpc("read_state", {}, B), { state: null, meta: null });
    await f.db.exec("reset role");
    await f.db.query("select set_config('wd.current.owner',$1,false)", [A]);
    await f.db.exec("set role wd_current_plan_internal");
    assert.equal((await f.db.query("select * from wd_current_private.states where user_id=$1", [A])).rows.length, 1);
    assert.equal((await f.db.query("select * from wd_current_private.states where user_id=$1", [B])).rows.length, 0);
    await assert.rejects(f.db.query("insert into wd_current_private.states values($1,$2,0,$3::jsonb,$4)", [B, "d".repeat(64), JSON.stringify(empty), hash(empty)]), /row-level security/);
  } finally { await f.db.close(); }
});

test("inactive owner cleanup clears only owned current data and narrow internal privileges remain", async () => {
  const f = await fixture();
  try {
    await f.rpc("commit", f.commit()); await f.rpc("commit", f.commit(), B);
    await f.role("authenticated", A);
    await f.db.query("select public.wd_account_command('begin_deletion',$1::jsonb,$2::uuid)", [JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }), OP]);
    await f.role();
    assert.equal((await f.rpc("read_state")).error, "owner_inactive");
    assert.equal((await f.rpc("read_state", {}, B)).state !== null, true);
    const pending = (await f.db.query<{ pending: boolean }>("select public.wd_current_plan_cleanup_pending($1::uuid) pending", [A])).rows[0].pending;
    assert.equal(pending, false);
    await f.db.exec("reset role");
    assert.deepEqual((await f.db.query("select id from public.unrelated_sentinel")).rows, [{ id: 7 }]);
    const privileges = (await f.db.query<{ login: boolean; bypass: boolean; super: boolean; publicCreate: boolean }>("select rolcanlogin login,rolbypassrls bypass,rolsuper super,has_schema_privilege(oid,'public','CREATE') \"publicCreate\" from pg_roles where rolname='wd_current_plan_internal'")).rows[0];
    assert.deepEqual(privileges, { login: false, bypass: false, super: false, publicCreate: false });
    const count = (await f.db.query<{ count: number }>("select count(*)::int count from wd_current_private.states where user_id=$1", [B])).rows[0].count;
    assert.equal(count, 1);
  } finally { await f.db.close(); }
});

test("not-applied receipts remain original without advancing or rewriting later state", async () => {
  const f = await fixture();
  try {
    const operation = { operationId: OP, intentSha256: "a".repeat(64), receipt: { outcome: "not_applied", operationId: OP, result: { outcome: "held", code: "synthetic-only" } } };
    const body = { operation, expectedRevision: 0, expectedRecordSha256: null, stateRecordSha256: hash(empty), operationRecordSha256: hash(operation) };
    assert.equal((await f.rpc("commit", { ...body, stateRecordSha256: "0".repeat(64) })).error, "invalid_state");
    assert.deepEqual(await f.rpc("read_state"), { state: null, meta: null });
    assert.equal((await f.rpc("commit", body)).outcome, "committed");
    assert.deepEqual((await f.rpc("read_state")).state, empty);
    const accepted = f.commit("20000000-0000-4000-8000-000000000102", 0, hash(empty));
    assert.equal((await f.rpc("commit", accepted)).outcome, "committed");
    assert.deepEqual((await f.rpc("commit", body)).operation, operation);
    assert.deepEqual((await f.rpc("read_state")).state, accepted.operation.receipt.state);
  } finally { await f.db.close(); }
});

test("deletion progress refuses residual private state even if its cleanup trigger failed", async () => {
  const f = await fixture();
  try {
    await f.role("authenticated", A);
    await f.db.query("select public.wd_account_command('begin_deletion',$1::jsonb,$2::uuid)", [JSON.stringify({ confirmation: "DELETE MY ACCOUNT" }), OP]);
    await f.db.exec("reset role");
    await f.db.query("insert into wd_current_private.states values($1,$2,0,$3::jsonb,$4)", [A, key(A), JSON.stringify(empty), hash(empty)]);
    await f.role();
    const owner = "40000000-0000-4000-8000-000000000101";
    const claim = (await f.db.query<{ result: { work: { attempt: number } } }>("select public.wd_deletion_command('claim',$1::jsonb) result", [JSON.stringify({ userId: A, owner })])).rows[0].result;
    const cleanup = (await f.db.query<{ result: { error: string } }>("select public.wd_deletion_command('cleanup',$1::jsonb) result", [JSON.stringify({ userId: A, owner, attempt: claim.work.attempt })])).rows[0].result;
    assert.equal(cleanup.error, "cleanup_pending");
  } finally { await f.db.close(); }
});

async function admitted() {
  const owner = await admitVerifiedReferenceOwner(new Request("https://synthetic.invalid"), {
    verify: async () => ({ id: A, token: "synthetic-only", authenticatedAt: 1, providers: ["email"] }),
    readAccount: async () => ({ userId: A, state: "active", revision: 1 }),
  });
  assert.equal(owner.outcome, "ready"); if (owner.outcome !== "ready") throw Error("Synthetic owner unavailable"); return owner;
}

test("actual V2 kernel recovers a lost SQL acknowledgement and reopens checked groceries through the owner RPC port", async () => {
  const f = await fixture(), owner = await admitted(), data = syntheticV2();
  let loseAcknowledgement = true;
  const driver = { async call(input: Parameters<Parameters<typeof createCurrentOwnerRpcStatePort>[0]["call"]>[0]) {
    const result = await f.rpc(input.action, input.body, input.ownerId, input.accountRevision, input.scopeKey);
    if (input.action === "commit" && loseAcknowledgement) { loseAcknowledgement = false; throw Error("synthetic lost acknowledgement"); }
    return result;
  } };
  const handler = () => {
    const result = createReferenceSessionHandlerV2(data.bytes, data.configuration, { ...data.options, transactions: createCurrentOwnerRpcStatePort(driver, owner), resolveScope: () => owner.scope });
    assert.equal(result.outcome, "ready"); if (result.outcome !== "ready") throw Error("Synthetic kernel unavailable"); return result;
  };
  try {
    const first = handler();
    const lost = await data.send("installCurrent", data.initial, 1, data.binding.sourcePolicyBasis.basisSha256, first);
    assert.equal(lost.body.result.outcome, "unknown");
    const reopened = handler();
    const recovered = await data.send("operationStatus", { targetOperationId: op(1) }, 2, null, reopened);
    assert.equal(recovered.body.result.outcome, "committed");
    assert.equal(recovered.body.result.receipt.state.revision, 1);
    const current = recovered.body.result.receipt.state.current;
    const storedState = (await f.rpc("read_state")).state as { current: { assignments: unknown[] } };
    assert.equal(storedState.current.assignments.length, data.initial.assignments.length);
    const item = current.view.groceries.groups[0].items[0];
    const checked = await data.send("shoppingCheck", { expectedRevision: 1, weekId: op(100), itemKey: item.itemKey, fingerprint: item.fingerprint, checked: true }, 3, data.binding.sourcePolicyBasis.basisSha256, reopened);
    assert.equal(checked.body.result.state.revision, 2);
    const read = await data.send("readCurrent", {}, 4, null, handler());
    assert.equal(read.body.result.state.current.view.groceries.groups[0].items[0].checked, true);
    const duplicate = await data.send("installCurrent", data.initial, 1, data.binding.sourcePolicyBasis.basisSha256, handler());
    assert.equal(duplicate.body.result.state.revision, 1, "original receipt cannot become a new mutation");
    assert.equal((await f.rpc("read_state")).state !== null, true);
    assert.equal(((await f.rpc("read_state")).state as { revision: number }).revision, 2);
  } finally { await f.db.close(); }
});

test("owner RPC port rejects copied bindings, digest corruption and mixed-revision reads", async () => {
  const f = await fixture(), owner = await admitted();
  const driver = { call: (input: Parameters<Parameters<typeof createCurrentOwnerRpcStatePort>[0]["call"]>[0]) => f.rpc(input.action, input.body, input.ownerId, input.accountRevision, input.scopeKey) };
  try {
    assert.throws(() => createCurrentOwnerRpcStatePort(driver, JSON.parse(JSON.stringify(owner))), /unavailable/);
    const port = createCurrentOwnerRpcStatePort(driver, owner);
    await assert.rejects(port.transaction(async tx => {
      await tx.readState(owner.storageKey);
      await f.rpc("commit", f.commit());
      await tx.readOperation(owner.storageKey, OP);
    }), /unavailable/);
    const corrupt = createCurrentOwnerRpcStatePort({ async call(input) {
      const result = await driver.call(input);
      return input.action === "read_state" ? { ...result, meta: { revision: 1, recordSha256: "0".repeat(64) } } : result;
    } }, owner);
    await assert.rejects(corrupt.transaction(tx => tx.readState(owner.storageKey)), /unavailable/);
    const failed = createCurrentOwnerRpcStatePort({ call: async () => { throw Error("synthetic-private-provider-detail"); } }, owner);
    await assert.rejects(failed.transaction(tx => tx.readState(owner.storageKey)), error => {
      assert.equal((error as Error).message, "Current owner state unavailable"); return true;
    });
  } finally { await f.db.close(); }
});

test("private owner service rechecks paid access at commit, permits recovery without purchase, and stays default-off", async () => {
  const f = await fixture(), data = syntheticV2(), now = Date.now();
  let accessCalls = 0, denyAtCommit = true, binds = 0, identityCalls = 0, sourceDeadline = now + 30000;
  let observedLease: number | null = null;
  const dependencies: CurrentOwnerServiceDependencies = {
    enabled: true, now: () => now,
    identity: {
      verify: async () => { identityCalls++; return { id: A, token: "synthetic-only", authenticatedAt: 1, providers: ["email"] }; },
      readAccount: async () => ({ userId: A, state: "active", revision: 1 }),
    },
    rpc: { call: input => { if (input.action === "commit") observedLease = input.accessExpiresAt ?? null; return f.rpc(input.action, input.body, input.ownerId, input.accountRevision, input.scopeKey, input.accessExpiresAt ?? null); } },
    access: async () => {
      accessCalls++;
      const allowed = !(denyAtCommit && accessCalls > 1);
      return { allowed, state: allowed ? "active" : "expired", expiresAt: allowed ? now + 60000 : now - 1, observedAt: now, reason: "provider_verified", rerollsIncluded: allowed, stale: false };
    },
    bind: async (owner, transactions) => {
      binds++;
      const kernel = createReferenceSessionHandlerV2(data.bytes, data.configuration, { ...data.options, transactions, resolveScope: () => owner.scope });
      return kernel.outcome === "ready" ? { ...kernel, newWeekCommitBefore: sourceDeadline } : null;
    },
  };
  const request = (operation: string, payload: unknown, id: number, expected: string | null = data.binding.sourcePolicyBasis.basisSha256) => new Request("https://synthetic.invalid/current", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.envelope(operation, payload, id, expected)) });
  try {
    const disabled = createCurrentOwnerIntegrationHandler({ ...dependencies, enabled: false });
    assert.equal((await disabled(request("readCurrent", {}, 1))).status, 503);
    assert.equal(identityCalls, 0); assert.equal(binds, 0);
    const handler = createCurrentOwnerIntegrationHandler(dependencies);
    const lost = await handler(request("installCurrent", data.initial, 1));
    assert.equal((await lost.json()).result.outcome, "unknown", "revoked access at commit cannot produce a false saved acknowledgement");
    assert.deepEqual(await f.rpc("read_state"), { state: null, meta: null });
    denyAtCommit = false;
    const saved = await handler(request("installCurrent", data.initial, 2));
    const savedBody = await saved.json(); assert.equal(savedBody.result.saved, true); assert.equal(savedBody.apiAccepted, false);
    assert.equal(observedLease, sourceDeadline, "new-week SQL lease is clipped to source expiry, not just membership expiry");
    sourceDeadline = now - 1;
    const recovery = createCurrentOwnerIntegrationHandler({ ...dependencies, access: async () => { throw Error("must not require payment for data recovery"); } });
    const status = await recovery(request("operationStatus", { targetOperationId: op(2) }, 3, null));
    assert.equal((await status.json()).result.outcome, "committed"); assert.equal(status.headers.get("cache-control"), "no-store");
    const forged = new Request("https://synthetic.invalid/current", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data.envelope("readCurrent", {}, 4)).replace('"operation":"readCurrent"', '"operation":"readCurrent","operation":"readCurrent"') });
    assert.equal((await recovery(forged)).status, 400, "kernel still rejects duplicate keys from the exact original bytes");
    let canceled = false;
    const stream = new ReadableStream<Uint8Array>({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { canceled = true; } });
    const oversized = new Request("https://synthetic.invalid/current", { method: "POST", headers: { "Content-Type": "application/json" }, body: stream, duplex: "half" } as RequestInit);
    assert.equal((await recovery(oversized)).status, 413); assert.equal(canceled, true);
  } finally { await f.db.close(); }
});

test("SQL rejects a missing/expired access lease and rolls back if it expires between the atomic writes", async () => {
  const f = await fixture();
  try {
    for (const expiry of [null, Date.now() - 1]) {
      assert.equal((await f.rpc("commit", f.commit(), A, 1, key(A), expiry)).error, "owner_access_expired");
      assert.deepEqual(await f.rpc("read_state"), { state: null, meta: null });
    }
    await f.db.exec("reset role");
    await f.db.exec("create function wd_current_private.synthetic_slow_receipt()returns trigger language plpgsql as $$begin perform pg_sleep(0.2);return new;end$$;create trigger synthetic_slow before insert on wd_current_private.operations for each row execute function wd_current_private.synthetic_slow_receipt()");
    await f.role();
    const body = f.commit();
    const result = (await f.db.query<{ result: { error: string } }>("select public.wd_current_plan_rpc($1::uuid,1,$2,'commit',$3::jsonb,(extract(epoch from clock_timestamp())*1000+50)::bigint) result", [A, key(A), JSON.stringify(body)])).rows[0].result;
    assert.equal(result.error, "invalid_command");
    assert.deepEqual(await f.rpc("read_state"), { state: null, meta: null });
    assert.equal((await f.rpc("read_operation", { operationId: OP })).operation, null);
  } finally { await f.db.close(); }
});

test("migration and current RPC work under a non-superuser administrator without leaving internal SET access", async () => {
  const f = await fixture(true);
  try {
    assert.equal((await f.rpc("commit", f.commit())).outcome, "committed");
    await f.db.exec("reset role");
    const row = (await f.db.query<{ canSet: boolean; inherits: boolean; owner: string; superuser: boolean }>("select pg_has_role('fixture_migrator','wd_current_plan_internal','SET') \"canSet\",pg_has_role('fixture_migrator','wd_current_plan_internal','USAGE') inherits,(select pg_get_userbyid(proowner) from pg_proc where oid='public.wd_current_plan_rpc(uuid,integer,text,text,jsonb,bigint)'::regprocedure) owner,(select rolsuper from pg_roles where rolname='fixture_migrator') superuser")).rows[0];
    assert.deepEqual(row, { canSet: false, inherits: false, owner: "wd_current_plan_internal", superuser: false });
    for (const role of ["anon", "authenticated", "service_role"]) {
      assert.equal((await f.db.query<{ member: boolean }>("select pg_has_role($1,'wd_current_plan_internal','MEMBER') member", [role])).rows[0].member, false);
    }
  } finally { await f.db.close(); }
});

test("current account ingress preserves account/deletion behavior but cannot activate the old15-meal write API", async () => {
  const f = await fixture(true);
  try {
    await f.role("authenticated", A);
    const read = (await f.db.query<{ result: { revision: number } }>("select public.wd_account_command('read','{}') result")).rows[0].result;
    assert.equal(read.revision, 1);
    for (const action of ["save_week", "delete_week", "list_weeks"]) {
      const result = (await f.db.query<{ result: { error: string } }>("select public.wd_account_command($1,'{}',$2::uuid) result", [action, OP])).rows[0].result;
      assert.equal(result.error, "current_account_action_required");
    }
    await assert.rejects(f.db.query("select wd_current_private.wd_account_command('read','{}')"), /permission denied/);
    await f.db.exec("reset role");
    assert.equal((await f.db.query<{ count: number }>("select count(*)::int count from public.wd_saved_weeks")).rows[0].count, 0);
  } finally { await f.db.close(); }
});

test("configured server joins actual Auth verifier, account/billing SQL, provider validation, V2 kernel and current RPC", async () => {
  const f = await fixture(true), data = syntheticV2(), now = Date.now();
  const origin = "https://zpvqxtklvjitofpbddrn.supabase.co";
  const token = "e30." + Buffer.from(JSON.stringify({ sub: A, iss: origin + "/auth/v1", aud: "authenticated", role: "authenticated", exp: Math.floor(now / 1000) + 600, amr: [{ method: "otp", timestamp: Math.floor(now / 1000) - 10 }] })).toString("base64url") + ".synthetic";
  let calls = 0, providerCalls = 0;
  const fetcher: typeof fetch = async (target, options) => {
    calls++; const url = String(target);
    if (url === origin + "/auth/v1/user") return Response.json({ id: A, is_anonymous: false, email_confirmed_at: new Date(now - 86400000).toISOString(), identities: [{ provider: "email" }] });
    if (url === origin + "/rest/v1/rpc/wd_account_command") {
      await f.role("authenticated", A);
      const body = JSON.parse(options?.body as string);
      const result = (await f.db.query<{ result: unknown }>("select public.wd_account_command($1,$2::jsonb,$3::uuid) result", [body.p_action, JSON.stringify(body.p_body), body.p_key])).rows[0].result;
      await f.role(); return Response.json(result);
    }
    if (url === origin + "/rest/v1/rpc/wd_billing_command") {
      const body = JSON.parse(options?.body as string);
      return Response.json((await f.db.query<{ result: unknown }>("select public.wd_billing_command($1,$2::jsonb) result", [body.p_action, JSON.stringify(body.p_body)])).rows[0].result);
    }
    if (url.startsWith("https://api.revenuecat.com/v1/subscribers/")) {
      providerCalls++;
      const id = decodeURIComponent(url.split("/").at(-1)!);
      assert.match(id, /^wd_[0-9a-f-]{36}$/);
      return Response.json({ request_date_ms: now, subscriber: { original_app_user_id: id,
        entitlements: { wisedinner_pro: { product_identifier: "com.wisedinner.app.protein.weekly", expires_date: new Date(now + 600000).toISOString() } },
        subscriptions: { "com.wisedinner.app.protein.weekly": { store: "app_store", is_sandbox: false, ownership_type: "PURCHASED", period_type: "normal", expires_date: new Date(now + 600000).toISOString(), purchase_date: new Date(now - 60000).toISOString(), store_transaction_id: "synthetic-only-no-store-transaction" } },
      } });
    }
    assert.equal(url, origin + "/rest/v1/rpc/wd_current_plan_rpc");
    const body = JSON.parse(options?.body as string);
    return Response.json(await f.rpc(body.p_action, body.p_body, body.p_owner, body.p_account_revision, body.p_scope_key, body.p_access_expires_at));
  };
  const config = { enabled: true, supabaseUrl: origin, publicAuthKey: "synthetic-only-public", serverRpcKey: "synthetic-only-server", revenueCatLookupKey: "synthetic-only-provider", billingEnvironment: "PRODUCTION" as const, fetch: fetcher, now: () => now,
    bind: async (owner: Parameters<CurrentOwnerServiceDependencies["bind"]>[0], transactions: Parameters<CurrentOwnerServiceDependencies["bind"]>[1]) => {
      const candidate = createReferenceSessionHandlerV2(data.bytes, data.configuration, { ...data.options, transactions, resolveScope: () => owner.scope }); return candidate.outcome === "ready" ? candidate : null;
    },
  };
  const request = () => new Request("https://synthetic.invalid/current", { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json", "x-owner-id": B }, body: JSON.stringify(data.envelope("installCurrent", data.initial)) });
  try {
    const disabled = createCurrentOwnerServer({ ...config, enabled: false }); assert.equal((await disabled(request())).status, 503); assert.equal(calls, 0);
    const handler = createCurrentOwnerServer(config); assert.equal(calls, 0);
    const result = await handler(request()); assert.equal(result.status, 200);
    assert.equal((await result.json()).result.saved, true); assert.equal(providerCalls, 2);
    assert.equal((await f.rpc("read_state", {}, B)).state, null, "forged owner header cannot route the write");
    assert.notEqual((await f.rpc("read_state")).state, null);
  } finally { await f.db.close(); }
});
