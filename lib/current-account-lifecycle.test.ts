import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomUUID, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createCurrentAccountLifecycle, type LifecycleAdmission } from "./current-account-lifecycle.server.ts";
import { deletionIntentHash, deletionRecoveryHash } from "./account-deletion-v2.server.ts";
import { appleDigest } from "./apple-token-custody.server.ts";
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
const policy = { approved: true, version: "synthetic-only", preparedSeconds: 60, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 3600, retainedEvidence: ["deletion_receipt", "prepared_retirement_receipt", "apple_credential_recovery"] };
const applePolicy = { approved: true, version: "synthetic-only", credentialSeconds: 60, recoverySeconds: 120, evidenceSeconds: 600, retainedEvidence: ["apple_credential_recovery", "apple_credential_expiry_erase"] };
async function fixture(managedMigrationActor = false) {
  const dir = await mkdtemp(path.join(tmpdir(), "wd-final-local-")); let db = await PGlite.create(dir), deletes = 0, failCleanup = false;
  const deletedOwners = new Set<string>();
  let migrationActorBefore: unknown;
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
  create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
  create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
  create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
  if (managedMigrationActor) {
    // Explicit local migration prerequisite: the migration actor can delegate
    // usage of the synthetic Auth helper schema. This is not hosted scope proof.
    await db.exec("create role fixture_admin superuser;set session authorization fixture_admin;alter role postgres rename to fixture_bootstrap;create role postgres nosuperuser createrole bypassrls;grant all on schema public to postgres with grant option;grant usage on schema auth to postgres with grant option");
    const name = (await db.query<{name:string}>("select current_database() name")).rows[0].name;
    await db.exec(`grant create on database "${name.replaceAll('"', '""')}" to postgres;set role postgres`);
  }
  for (const file of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql", "0021_wd_deletion_lifecycle_v2.sql", "0022_wd_apple_token_custody.sql", "0023_wd_deletion_prepared_retirement.sql"]) {
    if (managedMigrationActor && file.startsWith("0023")) migrationActorBefore = (await db.query("select pg_has_role('postgres','wd_deletion_v2_internal','MEMBER') member,pg_has_role('postgres','wd_deletion_v2_internal','USAGE') inherited")).rows[0];
    await db.exec(await readFile(new URL("../supabase/migrations/" + file, import.meta.url), "utf8"));
  }
  await db.exec("reset role");
  await db.query("insert into wd_accounts(user_id)values($1),($2)", [A, B]);
  await db.exec("create table ce_isolated_sentinel(id int);insert into ce_isolated_sentinel values(7)");
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(f: () => Promise<T>) => { const p = queue.then(f); queue = p.catch(() => {}); return p; };
  const admin = <T>(f: (d: PGlite) => Promise<T>) => serial(async () => { await db.exec("reset role"); return f(db); });
  const rpc = (name: string, action: string, body: unknown, owner = A, role = "service_role") => serial(async () => {
    assert.ok(["wd_current_prepared_custody_command", "wd_current_credential_expiry_command", "wd_deletion_v2_worker_command", "wd_deletion_v2_account_command", "wd_apple_deletion_command", "wd_apple_custody_command", "wd_apple_revocation_command"].includes(name));
    await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: owner, role, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) }] })]); await db.exec("set role " + role);
    return (await db.query<{ result: Record<string, unknown> }>(`select public.${name}($1,$2::jsonb) result`, [action, JSON.stringify(body)])).rows[0].result;
  });
  const request: typeof fetch = async (url, init) => {
    const u = new URL(String(url));
    if (u.pathname.startsWith("/auth/v1/admin/users/")) {
      const id = u.pathname.split("/").at(-1)!;
      if (init?.method === "DELETE") { deletes++; deletedOwners.add(id); return Response.json({}); }
      if (deletedOwners.has(id)) return Response.json({ code: "user_not_found" }, { status: 404 });
      return Response.json({ id, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: id, user_id: id, provider: "email", id: "fixture-" + id, created_at: "2026-10-01T00:00:00Z" }] });
    }
    const value = JSON.parse(String(init?.body)); return Response.json(await rpc(u.pathname.split("/").at(-1)!, value.p_action, value.p_body));
  };
  const deps: LifecycleAdmission = { enabled: true, origin: "https://fixture.invalid", serverCredential: "synthetic", request,
    verify: async r => ({ id: r.headers.get("authorization") === "Bearer B" ? B : A, token: "synthetic", authenticatedAt: Math.floor(Date.now() / 1000), providers: ["email"] }),
    repositories: { apple: { command: (ns, action, body) => rpc({ deletion: "wd_apple_deletion_command", custody: "wd_apple_custody_command", revocation: "wd_apple_revocation_command" }[ns], action, body) }, deletion: { account: (owner, action, body) => rpc("wd_deletion_v2_account_command", action, body, owner.id, "authenticated"), worker: (action, body) => rpc("wd_deletion_v2_worker_command", action, body) } },
    client: { clientId: "synthetic.native", keys: async () => ({ keys: [] }), exchange: async () => { throw Error("unexpected exchange"); }, revoke: async () => { throw Error("unexpected revoke"); } }, keyVersion: "test", keyring: new Map([["test", randomBytes(32)]]), applePolicy, deletionPolicy: policy,
    preflight: async x => ({ outcome: "allowed", binding: { ...x, scopeSha256: "a".repeat(64), policySha256: appleDigest(policy), authorizationId: randomUUID(), evidenceSha256: "b".repeat(64), observedAt: new Date(Date.now() - 1000).toISOString(), validUntil: new Date(Math.min(Date.now() + 10000, Date.parse(x.leaseUntil))).toISOString() }, coverage: { coveredAuthGraphSha256: "c".repeat(64), storage: "verified_clear", sharedEngine: "verified_preserved", relatedOwnerReferences: "verified_clear" } }),
    cleanup: { verify: async x => { if (failCleanup) return { outcome: "held" }; await admin(async d => assert.equal((await d.query("select * from ce_isolated_sentinel")).rows.length, 1)); return { outcome: "verified", policySha256: x.policySha256, evidenceSha256: "d".repeat(64), validUntil: x.now + 1000 }; } }
  };
  function original(owner = A) { const operationId = randomUUID(), capability = randomBytes(32).toString("base64url"); return { owner, operationId, capability, intentSha256: deletionIntentHash(owner, operationId, 1, deletionRecoveryHash(operationId, capability), appleDigest(policy)) }; }
  async function call(o: ReturnType<typeof original>, operation: "prepare" | "confirm" | "status", opted = false, custom = deps) {
    return createCurrentAccountLifecycle(custom).deletion(new Request("https://fixture.invalid/api/v1/account/deletion-v2", { method: "POST", headers: { "content-type": "application/json", authorization: operation === "status" && !opted ? "Deletion-Recovery " + o.capability : "Bearer " + (o.owner === A ? "A" : "B"), "x-wd-deletion-recovery": o.capability, "x-wd-deletion-intent-sha256": o.intentSha256, ...(opted ? { "x-wd-deletion-lifecycle": "wd-prepared-retirement-v1" } : {}) }, body: JSON.stringify({ contract: "wd-account-deletion-v2", operation, operationId: o.operationId, ...(operation === "status" ? { intentSha256: o.intentSha256 } : { expectedAccountRevision: 1, ...(operation === "confirm" ? { intentSha256: o.intentSha256, confirmation: "DELETE MY ACCOUNT" } : {}) }) }) }));
  }
  return { deps, original, call, rpc, admin, migrationActorBefore, counts: () => deletes, failCleanup: () => failCleanup = true, reopen: () => serial(async () => { await db.close(); db = await PGlite.create(dir); }), close: async () => { await queue; await db.close(); await rm(dir, { recursive: true }); } };
}
test("default-off lifecycle routes and unavailable cleanup cannot cause provider effects", async () => {
  const request = new Request("https://fixture.invalid", { method: "POST", body: "{}" });
  const off = await createCurrentAccountLifecycle().deletion(request); assert.equal(off.status, 503); assert.deepEqual(await off.json(), { contract: "wd-account-deletion-v2", result: { outcome: "held", code: "deletion_v2_disabled" } });
  const f = await fixture(); try { f.failCleanup(); assert.equal((await f.call(f.original(), "prepare")).status, 503); assert.equal(f.counts(), 0); } finally { await f.close(); }
});
test("actual per-request lifecycle A/B/A and SQL retirement preserve original receipts over disk reopen", async () => {
  const f = await fixture(); try {
    const a = f.original(), b = f.original(B);
    assert.equal((await f.call(a, "prepare")).status, 200); assert.equal((await f.call(b, "prepare")).status, 200);
    await f.admin(d => d.query("update wd_deletion_v2_private.intents set prepared_until=now()-interval '1 second' where operation_id=$1", [a.operationId]));
    const next = f.original(); assert.equal((await f.call(next, "prepare", true)).status, 200);
    await f.reopen();
    const terminal = await (await f.call(a, "status", true)).json(); assert.equal(terminal.result.disposition, "expired-no-effect"); assert.equal(terminal.result.retryAuthorized, false); assert.equal(terminal.result.mayPrepareNewOriginal, false, "the newer prepared original still reserves this owner");
    assert.equal((await f.call(a, "confirm")).status, 409);
    assert.equal((await f.call(next, "prepare", true)).status, 200);
    assert.equal(f.counts(), 0);
    const wrong = { ...a, owner: B }; assert.equal((await f.call(wrong, "status", true)).status, 409);
    await f.admin(async d => { assert.equal((await d.query<{n:number}>("select count(*)::int n from wd_deletion_v2_private.intents")).rows[0].n, 3); assert.equal((await d.query("select * from ce_isolated_sentinel")).rows.length, 1); });
  } finally { await f.close(); }
});
test("retirement fails closed for active work and invalid new admission, preserves old original and least privilege", async () => {
  const f = await fixture(); try {
    const old = f.original(); assert.equal((await f.call(old, "prepare")).status, 200);
    const next = f.original(); assert.equal((await f.call(next, "prepare", true)).status, 409);
    await f.admin(d => d.query("update wd_deletion_v2_private.intents set prepared_until=now()-interval '1 second' where operation_id=$1", [old.operationId]));
    const row = await f.admin(async d => (await d.query<Record<string, unknown>>("select * from wd_deletion_v2_private.intents where operation_id=$1", [old.operationId])).rows[0]);
    const body = { userId: A, operationId: next.operationId, recoveryHash: deletionRecoveryHash(next.operationId, next.capability), expectedAccountRevision: 1, identityHash: row.identity_hash, identityEvidence: row.identity_evidence, appleLinkage: row.apple_linkage, policy, policyHash: appleDigest(policy), intentSha256: "bad" };
    assert.ok((await f.rpc("wd_deletion_v2_worker_command", "admit_retiring", body)).error);
    await f.admin(async d => assert.equal((await d.query<{retired_at:unknown}>("select retired_at from wd_deletion_v2_private.intents where operation_id=$1", [old.operationId])).rows[0].retired_at, null));
    await assert.rejects(f.rpc("wd_current_prepared_custody_command", "preflight", {}, A, "authenticated"), /permission denied/);
    await f.admin(async d => {
      const acl = await d.query<{relrowsecurity:boolean;relforcerowsecurity:boolean}>("select relrowsecurity,relforcerowsecurity from pg_class where oid='wd_apple_private.prepared_captures'::regclass");
      assert.equal(acl.rows[0].relrowsecurity, true); assert.equal(acl.rows[0].relforcerowsecurity, true);
      await d.query("insert into wd_apple_private.exchanges(operation_id,owner_id,intent_hash,client_id,apple_identity_hash,identity_hash,code_hash,policy,policy_hash,state,expires_at)values($1,$2,$3,'synthetic',$3,$3,$3,$4,$3,'unknown',now()+interval '1 hour')", [randomUUID(), A, "a".repeat(64), JSON.stringify(applePolicy)]);
    });
    assert.equal((await f.call(next, "prepare", true)).status, 409);
    assert.equal(f.counts(), 0);
  } finally { await f.close(); }
});
test("actual composed lifecycle executes scoped local cleanup and Auth deletion; recovery stays original after Auth removal", async () => {
  const f = await fixture(); try {
    const o = f.original();
    await f.admin(d => d.query("update wd_accounts set preferences='{\"synthetic\":true}' where user_id=$1", [A]));
    assert.equal((await f.call(o, "prepare")).status, 200);
    const denied = { ...f.deps, preflight: async () => ({ outcome: "held" as const }) };
    const held = await (await f.call(o, "confirm", false, denied)).json(); assert.equal(held.result.authDeletion, "unknown"); assert.equal(f.counts(), 0);
    // A denied original is not a new delete grant. Its reconciliation cannot
    // claim absence or manufacture an Auth attempt that never happened.
    await f.reopen(); const read = await (await f.call(o, "status")).json(); assert.equal(read.result.operationId, o.operationId); assert.equal(read.result.authDeletion, "unknown"); assert.equal(f.counts(), 0);
    const b = f.original(B); assert.equal((await f.call(b, "prepare")).status, 200);
    const finished = await (await f.call(b, "confirm")).json(); assert.equal(finished.result.authDeletion, "confirmed"); assert.equal(finished.result.applicationData, "cleared"); assert.equal(finished.result.subscriptionCancelled, false); assert.equal(f.counts(), 1);
    await f.reopen(); const recovered = await (await f.call(b, "status", false, { ...f.deps, deletionPolicy: undefined, keyring: new Map() })).json(); assert.equal(recovered.result.operationId, b.operationId); assert.equal(recovered.result.authDeletion, "confirmed");
    await f.admin(async d => { const row = (await d.query<{state:string;preferences:unknown}>("select state,preferences from wd_accounts where user_id=$1", [B])).rows[0]; assert.equal(row.state, "deleted"); assert.deepEqual(row.preferences, {}); assert.equal((await d.query("select * from ce_isolated_sentinel")).rows.length, 1); });
  } finally { await f.close(); }
});
test("additive0023 applies under managed non-superuser role and restores original executor privilege baseline", async () => {
  const f = await fixture(true); try {
    await f.admin(async d => {
      const row = (await d.query<{rolsuper:boolean;rolcreaterole:boolean}>("select rolsuper,rolcreaterole from pg_roles where rolname='postgres'")).rows[0];
      assert.equal(row.rolsuper, false); assert.equal(row.rolcreaterole, true);
      const actual = (await d.query("select pg_has_role('postgres','wd_deletion_v2_internal','MEMBER') member,pg_has_role('postgres','wd_deletion_v2_internal','USAGE') inherited")).rows[0];
      assert.deepEqual(actual, f.migrationActorBefore);
    });
    const o = f.original(), prepared = await f.call(o, "prepare"); assert.equal(prepared.status, 200, JSON.stringify(await prepared.json()));
  } finally { await f.close(); }
});
test("first opted prepare establishes owner-before-account fence; wrong expiry ACK never proves an erase", async () => {
  const f = await fixture(); try {
    const o = f.original(); assert.equal((await f.call(o, "prepare", true)).status, 200);
    await f.admin(async d => { const row = (await d.query<{reserved_original:string}>("select reserved_original from wd_apple_private.owners where owner_id=$1", [A])).rows[0]; assert.equal(row.reserved_original, o.operationId); });
    const input = { ownerId: A, lineageId: randomUUID(), policySha256: "a".repeat(64) };
    const wrong = createCurrentAccountLifecycle({ ...f.deps, request: async () => Response.json({ outcome: "erased", lineageId: randomUUID(), policySha256: input.policySha256 }) });
    const result = await wrong.eraseExpiredCredential(input); assert.equal(result.outcome, "unknown"); assert.equal(result.retryAuthorized, false); assert.equal(f.counts(), 0);
  } finally { await f.close(); }
});

test("private UUID strategy requires its exact profile and cannot replace the legacy default",async()=>{
 const f=await fixture();try{
  let selected=0;const uuidAuth={profile:"wd-owner-uuid-delete-v1" as const,forOwner(){selected++;throw Error("must remain closed");}};
  const o=f.original();assert.equal((await f.call(o,"prepare",false,{...f.deps,uuidAuth})).status,503);
  assert.equal((await f.call(o,"prepare",false,{...f.deps,deletionPolicy:{...policy,version:"wd-owner-uuid-delete-v1"}})).status,503);
  assert.equal(selected,0);assert.equal(f.counts(),0);
 }finally{await f.close();}
});
