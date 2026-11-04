import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { randomBytes, randomUUID, generateKeyPairSync, createHash, sign } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { createAppleTokenCustodyService, decodeTrustedAppleIdentity, appleSha, appleIntent, appleDigest } from "./apple-token-custody.server.ts";
import type { AppleData, AppleRepository, AppleCustodyDependencies } from "./apple-token-custody.server.ts";
import { createAccountDeletionV2Service, deletionIntentHash, deletionRecoveryHash, advanceAccountDeletionV2 } from "./account-deletion-v2.server.ts";
import type { DeletionV2Repository } from "./account-deletion-v2.server.ts";
import { createAccountDeletionV2AuthAdapter } from "./account-deletion-v2-auth.server.ts";
import type { AuthScopeInput, AuthScopeProof } from "./account-deletion-v2-auth.server.ts";
import { createAppleRevocationProvider, createAppleCustodyDeletionPorts } from "./apple-revocation.server.ts";
import { createCurrentAccountLifecycle } from "./current-account-lifecycle.server.ts";
const A = "10000000-0000-4000-8000-000000000001", B = "10000000-0000-4000-8000-000000000002";
test("prepared-bound actual lifecycle custody: admission, lost store ACK, original recovery and scoped expiry executor", async () => {
 const f=await fixture();try{
  assert.equal((await f.call("prepare")).status,200);
  const c=f.captureRequest();let lose=true;
  const transport:typeof fetch=async(url,init)=>{
   const u=new URL(String(url));
   if(u.pathname==="/auth/v1/user")return f.request("https://fixture.invalid/auth/v1/admin/users/"+A,init);
   if(!u.pathname.startsWith("/rest/v1/rpc/"))return f.request(url,init);
   const x=JSON.parse(String(init?.body)),result=await f.rpc(u.pathname.split("/").at(-1)!,x.p_action,x.p_body);
   if(x.p_action==="store"&&lose){lose=false;throw Error("synthetic committed store ACK loss");}
   return Response.json(result);
  };
  const lifecycle=createCurrentAccountLifecycle({enabled:true,origin:"https://fixture.invalid",serverCredential:"synthetic",verify:f.custodyDeps.verify,client:f.custodyDeps.client,keyVersion:"test",keyring:f.keyring,applePolicy:custodyPolicy,deletionPolicy,preflight:f.scope,request:transport,repositories:{apple:f.repository,deletion:f.original},cleanup:{verify:async x=>({outcome:"verified",evidenceSha256:"a".repeat(64),policySha256:x.policySha256,validUntil:x.now+10000})}});
  const capture=()=>{const r=c.request();r.headers.set("x-wd-deletion-operation-id",f.deletionId);r.headers.set("x-wd-deletion-intent-sha256",f.intent);r.headers.set("x-wd-deletion-recovery",f.capability);return r;};
  const wrong=capture();wrong.headers.set("x-wd-deletion-intent-sha256","0".repeat(64));
  assert.equal((await lifecycle.custody(wrong)).status,409);assert.equal(f.counts().exchanges,0);
  const lost=await(await lifecycle.custody(capture())).json();assert.equal(lost.result.statusRequired,true,JSON.stringify(lost));assert.equal(f.counts().exchanges,1,JSON.stringify(lost));
  await f.reopen();
  const read=new Request("https://fixture.invalid/api/v1/account/apple-credential",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer synthetic"},body:JSON.stringify({contract:"wd-apple-custody-v1",operation:"status",operationId:c.operationId,intentSha256:c.intentSha256})});
  assert.equal((await(await lifecycle.custody(read)).json()).result.outcome,"stored");
  await lifecycle.custody(capture());assert.equal(f.counts().exchanges,1);
  const credential=await f.admin(async db=>(await db.query<{lineage_id:string;policy_hash:string}>("select lineage_id,policy_hash from wd_apple_private.credentials")).rows[0]);
  const target={ownerId:A,lineageId:credential.lineage_id,policySha256:credential.policy_hash};
  assert.equal((await lifecycle.eraseExpiredCredential(target)).error,"policy_required");
  await f.admin(db=>db.exec("update wd_apple_private.credentials set expires_at=now()-interval '1 second'"));
  assert.equal((await lifecycle.eraseExpiredCredential(target)).outcome,"erased");await f.reopen();
  await f.admin(async db=>assert.equal((await db.query<{envelope:unknown}>("select envelope from wd_apple_private.credentials")).rows[0].envelope,null));
 }finally{await f.close();}
});
test("prepared SQL wrapper retains encrypted late exchange after Auth cleanup and never permits a second begin",async()=>{
 const f=await fixture();try{
  await f.call("prepare");const c=f.captureRequest();
  const target={userId:A,operationId:f.deletionId,intentSha256:f.intent,recoveryHash:deletionRecoveryHash(f.deletionId,f.capability)};
  const scoped:AppleRepository={command:(ns,action,body)=>ns==="custody"?f.rpc("wd_current_prepared_custody_command",action,{target,body}):f.repository.command(ns,action,body)};
  const originalExchange=f.custodyDeps.client.exchange;
  let completion:AppleData={};
  const client={...f.custodyDeps.client,exchange:async(code:string)=>{const result=await originalExchange(code);const pair=f.ports();const auth=pair.providers.auth;
   const service=createAccountDeletionV2Service({enabled:true,verify:f.custodyDeps.verify,repository:pair.repository,providers:{...pair.providers,auth},policy:deletionPolicy});
   completion=(await(await service(new Request("https://fixture.invalid/api/v1/account/deletion-v2",{method:"POST",headers:{"content-type":"application/json",authorization:"Bearer synthetic","x-wd-deletion-recovery":f.capability},body:JSON.stringify({contract:"wd-account-deletion-v2",operation:"confirm",operationId:f.deletionId,intentSha256:f.intent,expectedAccountRevision:1,confirmation:"DELETE MY ACCOUNT"})}))).json()).result;return result;}};
  const result=await(await createAppleTokenCustodyService({...f.custodyDeps,client,repository:scoped})(c.request())).json();
  assert.equal(result.result.statusRequired,true,JSON.stringify(result));assert.equal(f.counts().exchanges,1,JSON.stringify(result));
  assert.equal(completion.authDeletion,"confirmed",JSON.stringify(completion));
  await f.reopen();await f.admin(async db=>{const rows=(await db.query<{state:string;envelope:unknown}>("select state,envelope from wd_apple_private.credentials")).rows;assert.equal(rows.length,1);assert.equal(rows[0].state,"revoking");assert.ok(rows[0].envelope);});
  const repeat=await scoped.command("custody","begin",{ownerId:A,operationId:c.operationId,intentSha256:c.intentSha256});assert.equal(repeat.error,"scope_unverified");
 }finally{await f.close();}
});
const custodyPolicy = { approved: true, version: "synthetic-only", credentialSeconds: 3600, recoverySeconds: 3600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
const deletionPolicy = { approved: true, version: "synthetic-only", preparedSeconds: 3600, pendingSeconds: 3600, recoverySeconds: 3600, receiptSeconds: 3600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
const rsa = generateKeyPairSync("rsa", { modulusLength: 2048 }), kid = "synthetic", jwk = { ...rsa.publicKey.export({ format: "jwk" }), kid, alg: "RS256", use: "sig" }, clientId = "fixture.native";
async function fixture(withAccount = true) {
  const dir = await mkdtemp(path.join(tmpdir(), "wd-apple-custody-")); let db = await PGlite.create(dir), userMissing = false, provider = "apple", deleteCalls = 0, revokeCalls = 0, exchangeCalls = 0, revokeMode = "ok", loseAuth = false, denyScope = false;
  let queue: Promise<unknown> = Promise.resolve(); const serial = <T>(fn: () => Promise<T>) => { const p = queue.then(fn); queue = p.catch(() => {}); return p; };
  await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
   create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
   create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
   create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
  for (const name of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql", "0021_wd_deletion_lifecycle_v2.sql", "0022_wd_apple_token_custody.sql", "0023_wd_deletion_prepared_retirement.sql"]) await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
  if (withAccount) await db.query("insert into wd_accounts(user_id) values($1),($2)", [A, B]);
  else await db.query("insert into wd_accounts(user_id)values($1)", [B]);
  await db.exec("create table public.ce_isolated_sentinel(id int primary key);insert into public.ce_isolated_sentinel values(7);create table public.source_isolated_sentinel(id int primary key);insert into public.source_isolated_sentinel values(43)");
  if (withAccount) { await db.query("insert into wd_billing_bindings(user_id)values($1)", [A]); await db.query("insert into wd_billing_states(user_id,environment,state)values($1,'SANDBOX','{\"state\":\"unknown\",\"reason\":\"original_ack_lost\"}')", [A]); }
  const role = async (name: string, user = A) => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: name, sub: user, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) }] })]); await db.exec("set role " + name); };
  const rpc = (name: string, action: string, body: AppleData, user = A, asRole = name === "wd_deletion_v2_account_command" ? "authenticated" : "service_role") => serial(async () => { await role(asRole, user); return (await db.query<{ result: AppleData }>(`select public.${name}($1,$2::jsonb) result`, [action, JSON.stringify(body)])).rows[0].result; });
  const repository: AppleRepository = { command: (ns, action, body) => rpc({ custody: "wd_apple_custody_command", revocation: "wd_apple_revocation_command", deletion: "wd_apple_deletion_command" }[ns], action, body) };
  const original: DeletionV2Repository = { account: (owner, action, body) => rpc("wd_deletion_v2_account_command", action, body, owner.id), worker: (action, body) => rpc("wd_deletion_v2_worker_command", action, body) };
  const identityId = randomUUID();
  const user = () => ({ id: A, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: identityId, user_id: A, provider, id: provider === "apple" ? "synthetic-apple-sub" : "synthetic-email-id", created_at: "2026-10-01T00:00:00Z" }] });
  const request: typeof fetch = async (url, init) => { assert.equal(String(url), "https://fixture.invalid/auth/v1/admin/users/" + A); if (init?.method === "DELETE") { deleteCalls++; userMissing = true; if (loseAuth) throw Error("synthetic lost Auth ACK"); return Response.json({}); } return userMissing ? Response.json({ code: "user_not_found" }, { status: 404 }) : Response.json(user()); };
  const scope = async (x: AuthScopeInput): Promise<AuthScopeProof> => denyScope ? { outcome: "held" } : { outcome: "allowed", binding: { ...x, scopeSha256: "a".repeat(64), policySha256: appleDigest(deletionPolicy), authorizationId: randomUUID(), evidenceSha256: "b".repeat(64), observedAt: new Date(Date.now() - 1000).toISOString(), validUntil: new Date(Math.min(Date.now() + 10000, Date.parse(x.leaseUntil))).toISOString() }, coverage: { coveredAuthGraphSha256: "c".repeat(64), storage: "verified_clear", sharedEngine: "verified_preserved", relatedOwnerReferences: "verified_clear" } };
  const key = randomBytes(32), keyring = new Map([["test", key]]); let lastToken = "";
  const client = { clientId, keys: async () => ({ keys: [jwk] }), exchange: async () => { exchangeCalls++; return { status: 200, value: { id_token: lastToken, refresh_token: randomBytes(32).toString("hex"), access_token: randomBytes(32).toString("hex"), token_type: "Bearer", expires_in: 3600 } }; }, revoke: async () => { revokeCalls++; if (revokeMode === "timeout") throw Error("synthetic provider timeout"); return revokeMode !== "refuse"; } };
  const owner = { id: A, token: "synthetic", authenticatedAt: Math.floor(Date.now() / 1000), providers: ["apple"] };
  const custodyDeps: AppleCustodyDependencies = { enabled: true, deletionCompositionAdmitted: true, verify: async () => owner, identity: async () => decodeTrustedAppleIdentity(user(), A, "https://fixture.invalid"), repository, client, origin: "https://fixture.invalid", clientId, keyVersion: "test", keyring, policy: custodyPolicy };
  function captureRequest() {
    const operationId = randomUUID(), nonce = randomUUID(), code = randomBytes(32).toString("hex"), now = Math.floor(Date.now() / 1000);
    const h = Buffer.from(JSON.stringify({ alg: "RS256", kid })).toString("base64url"), p = Buffer.from(JSON.stringify({ iss: "https://appleid.apple.com", aud: clientId, sub: "synthetic-apple-sub", iat: now - 1, exp: now + 300, nonce: appleSha(nonce), c_hash: createHash("sha256").update(code).digest().subarray(0, 16).toString("base64url") })).toString("base64url");
    lastToken = h + "." + p + "." + sign("RSA-SHA256", Buffer.from(h + "." + p), rsa.privateKey).toString("base64url");
    const identityToken = lastToken;
    const intentSha256 = appleIntent(A, operationId, code, lastToken, nonce, clientId, appleDigest(custodyPolicy));
    return { operationId, intentSha256, request: () => new Request("https://fixture.invalid/api/v1/account/apple-credential", { method: "POST", headers: { authorization: "Bearer synthetic", "content-type": "application/json", "x-wd-apple-intent-sha256": intentSha256 }, body: JSON.stringify({ contract: "wd-apple-custody-v1", operation: "exchange", operationId, nonce, authorizationCode: code, identityToken }) }) };
  }
  const capture = async () => { const c = captureRequest(), r = await createAppleTokenCustodyService(custodyDeps)(c.request()); return { ...c, status: r.status, body: await r.json() as { result: AppleData } }; };
  const auth = () => createAccountDeletionV2AuthAdapter({ origin: "https://fixture.invalid", serverCredential: "synthetic", repository, preflight: scope, request });
  const ports = (override: AppleRepository = repository) => { const a = auth(); return createAppleCustodyDeletionPorts({ repository: override, original, verifyIdentity: a.verifyIdentity, auth: a.auth, apple: createAppleRevocationProvider({ repository: override, client, keyring, timeoutMs: 2000, verifyIdentity: a.verifyIdentity }) }); };
  const deletionId = randomUUID(), capability = randomBytes(32).toString("base64url"), intent = deletionIntentHash(A, deletionId, 1, deletionRecoveryHash(deletionId, capability), appleDigest(deletionPolicy));
  const call = async (operation: "prepare" | "confirm" | "status", override?: AppleRepository) => { const pair = ports(override); const service = createAccountDeletionV2Service({ enabled: true, verify: async () => { if (userMissing) throw Error("signed out"); return { ...owner, authenticatedAt: Math.floor(Date.now() / 1000) }; }, repository: pair.repository, providers: pair.providers, policy: deletionPolicy }); const r = await service(new Request("https://fixture.invalid/api/v1/account/deletion-v2", { method: "POST", headers: { "content-type": "application/json", ...(operation === "status" ? { authorization: `Deletion-Recovery ${capability}` } : { authorization: "Bearer synthetic", "x-wd-deletion-recovery": capability, "x-wd-deletion-intent-sha256": intent }) }, body: JSON.stringify({ contract: "wd-account-deletion-v2", operation, operationId: deletionId, ...(operation === "status" ? { intentSha256: intent } : { expectedAccountRevision: 1, ...(operation === "confirm" ? { intentSha256: intent, confirmation: "DELETE MY ACCOUNT" } : {}) }) }) })); return { status: r.status, body: await r.json() as { result: AppleData } }; };
  const admin = <T>(fn: (d: PGlite) => Promise<T>) => serial(async () => { await db.exec("reset role"); return fn(db); });
  const reopen = () => serial(async () => { await db.close(); db = await PGlite.create(dir); });
  return { dir, repository, original, rpc, admin, reopen, capture, captureRequest, custodyDeps, ports, auth, call, intent, deletionId, capability, request, scope, keyring, counts: () => ({ deletes: deleteCalls, revokes: revokeCalls, exchanges: exchangeCalls }), unlink: () => provider = "email", revokeMode: (x: string) => revokeMode = x, loseAuth: () => loseAuth = true, denyScope: () => denyScope = true, close: async () => { await queue; await db.close(); await rm(dir, { recursive: true }); } };
}

test("actual custody/unchanged deletion SQL: reuse, unlink, all historical revocation, Auth deletion, original status and retained sentinels survive reopen", async () => {
  const f = await fixture(); try {
    assert.equal((await f.capture()).body.result.outcome, "stored"); await f.reopen(); assert.equal((await f.capture()).body.result.outcome, "reused_existing"); assert.equal(f.counts().exchanges, 1);
    // Preserve an older lineage while deliberately making it ineligible for reuse.
    await f.admin(d => d.exec("update wd_apple_private.credentials set expires_at=now()-interval '1 second'"));
    assert.equal((await f.capture()).body.result.outcome, "stored"); assert.equal(f.counts().exchanges, 2);
    f.unlink(); const prepared = await f.call("prepare"); assert.equal(prepared.status, 200); await f.reopen();
    const complete = await f.call("confirm"); assert.equal(complete.body.result.intentState, "settled"); assert.equal(complete.body.result.appleRevocation, "confirmed"); assert.equal(complete.body.result.authDeletion, "confirmed"); assert.equal(complete.body.result.subscriptionCancelled, false);
    assert.deepEqual(f.counts(), { deletes: 1, revokes: 2, exchanges: 2 }); await f.reopen(); assert.deepEqual((await f.call("status")).body.result, complete.body.result);
    await f.admin(async d => { assert.equal((await d.query("select * from ce_isolated_sentinel")).rows.length, 1); assert.equal((await d.query("select * from source_isolated_sentinel")).rows.length, 1); assert.equal((await d.query("select * from wd_billing_states")).rows.length, 1); assert.equal((await d.query("select * from wd_apple_private.credentials where envelope is not null")).rows.length, 0); });
  } finally { await f.close(); }
});
test("actual SQL Apple timeout + unlinked historical custody permits scoped Auth; encrypted recovery remains, no replay", async () => {
  const f = await fixture(); try {
    const capture = await f.capture(); f.unlink(); f.revokeMode("timeout"); assert.equal((await f.call("prepare")).status, 200);
    const result = await f.call("confirm"); assert.equal(result.body.result.intentState, "settled"); assert.equal(result.body.result.appleRevocation, "unknown"); assert.equal(result.body.result.authDeletion, "confirmed"); assert.equal(f.counts().deletes, 1);
    await f.reopen(); assert.equal((await f.call("status")).body.result.appleRevocation, "unknown"); assert.equal(f.counts().revokes, 1);
    await f.admin(async d => { const c = (await d.query<{ state: string; envelope: unknown }>("select state,envelope from wd_apple_private.credentials")).rows[0]; assert.equal(c.state, "revoke_unknown"); assert.ok(c.envelope); });
    const erase = { ownerId: A, operationId: capture.operationId, intentSha256: capture.intentSha256 };
    assert.equal((await f.repository.command("custody", "policy_erase", erase)).erased, 0);
    await f.admin(d => d.exec("update wd_apple_private.credentials set recovery_until=now()-interval '1 second'"));
    assert.equal((await f.repository.command("custody", "policy_erase", erase)).erased, 1);
    const status = await f.repository.command("custody", "status", erase); assert.equal(status.state, "stored"); assert.equal(status.custody, "erased");
  } finally { await f.close(); }
});
test("linked Apple timeout also permits scoped Auth, with truthful unknown and retained encrypted recovery", async () => {
  const f = await fixture(); try { await f.capture(); f.revokeMode("timeout"); await f.call("prepare"); const result = await f.call("confirm"); assert.equal(result.body.result.intentState, "settled"); assert.equal(result.body.result.appleRevocation, "unknown"); assert.equal(result.body.result.authDeletion, "confirmed"); assert.equal(f.counts().deletes, 1); } finally { await f.close(); }
});
test("actual SQL lost snapshot ACK preserves nonactive original recovery, no revoke replay after reopen", async () => {
  const f = await fixture(); try {
    await f.capture(); await f.call("prepare"); let snapshots = 0;
    const lost: AppleRepository = { command: async (ns, action, body) => { const r = await f.repository.command(ns, action, body); if (action === "snapshot_original") { snapshots++; throw Error("synthetic snapshot ACK loss"); } return r; } };
    const result = await f.call("confirm", lost); assert.equal(result.body.result.authDeletion, "confirmed"); assert.equal(result.body.result.appleRevocation, "unknown"); assert.equal(f.counts().revokes, 0); assert.equal(snapshots, 1);
    await f.reopen(); await f.call("status"); assert.equal(f.counts().revokes, 0);
    await f.admin(async d => { const c = (await d.query<{ state: string; envelope: unknown }>("select state,envelope from wd_apple_private.credentials")).rows[0]; assert.equal(c.state, "revoking"); assert.ok(c.envelope); });
  } finally { await f.close(); }
});
test("unavailable pre-snapshot Apple boundary cannot leave active material after independently scoped Auth cleanup", async () => {
  const f = await fixture(); try {
    await f.capture(); await f.call("prepare");
    const unavailable: AppleRepository = { command: async (ns, action, body) => { if (action === "snapshot_original") throw Error("synthetic boundary unavailable before snapshot"); return f.repository.command(ns, action, body); } };
    const result = await f.call("confirm", unavailable); assert.equal(result.body.result.authDeletion, "confirmed"); assert.equal(result.body.result.appleRevocation, "unknown"); assert.equal(f.counts().revokes, 0);
    await f.reopen(); await f.admin(async d => { const c = (await d.query<{ state: string; envelope: unknown }>("select state,envelope from wd_apple_private.credentials")).rows[0]; assert.equal(c.state, "revoke_unknown"); assert.ok(c.envelope); });
  } finally { await f.close(); }
});
test("actual SQL lost store ACK retains ciphertext and known original status, never another exchange", async () => {
  const f = await fixture(); try {
    const c = f.captureRequest(); const lost: AppleRepository = { command: async (ns, action, body) => { const r = await f.repository.command(ns, action, body); if (action === "store") throw Error("synthetic store ACK loss"); return r; } };
    assert.equal((await createAppleTokenCustodyService({ ...f.custodyDeps, repository: lost })(c.request())).status, 409); await f.reopen();
    assert.equal((await f.repository.command("custody", "status", { ownerId: A, operationId: c.operationId, intentSha256: c.intentSha256 })).state, "stored");
    assert.equal((await createAppleTokenCustodyService(f.custodyDeps)(c.request())).status, 200); assert.equal(f.counts().exchanges, 1);
    await f.admin(async d => assert.equal((await d.query("select * from wd_apple_private.credentials where envelope is not null")).rows.length, 1));
  } finally { await f.close(); }
});
test("changed actual Auth identity after prepare holds original before Apple/Auth effects", async () => {
  const f = await fixture(); try { await f.capture(); await f.call("prepare"); f.unlink(); const result = await f.call("confirm"); assert.equal(result.body.result.authDeletion, "unknown"); assert.equal(f.counts().revokes, 0); assert.equal(f.counts().deletes, 0); } finally { await f.close(); }
});
test("known never-managed email-only scope gets not_required, while denied target scope yields zero DELETE", async () => {
  const f = await fixture(); try { f.unlink(); assert.equal((await f.call("prepare")).status, 200); f.denyScope(); const held = await f.call("confirm"); assert.equal(held.body.result.appleRevocation, "not_required"); assert.equal(held.body.result.authDeletion, "unknown"); assert.equal(f.counts().deletes, 0); await f.reopen(); assert.equal((await f.call("status")).body.result.authDeletion, "unknown"); } finally { await f.close(); }
});
test("actual disk Auth lost DELETE ACK reconciles original404 without a second DELETE", async () => {
  const f = await fixture(); try { f.unlink(); await f.call("prepare"); f.loseAuth(); assert.equal((await f.call("confirm")).body.result.authDeletion, "unknown"); assert.equal(f.counts().deletes, 1); await f.reopen(); const pair = f.ports(); const r = await advanceAccountDeletionV2(pair.repository, pair.providers, f.deletionId, f.intent); assert.equal(r.intentState, "settled"); assert.equal(r.authDeletion, "confirmed"); assert.equal(f.counts().deletes, 1); } finally { await f.close(); }
});
test("actual SQL begin/store ACK loss, stale/foreign binding, RLS/grants and one-shot CAS", async () => {
  const f = await fixture(); try {
    const c = f.captureRequest(); let begins = 0;
    const lost: AppleRepository = { command: async (ns, action, body) => { const r = await f.repository.command(ns, action, body); if (action === "begin") { begins++; throw Error("synthetic lost begin ACK"); } return r; } };
    assert.equal((await createAppleTokenCustodyService({ ...f.custodyDeps, repository: lost })(c.request())).status, 409); await f.reopen(); assert.equal((await createAppleTokenCustodyService(f.custodyDeps)(c.request())).status, 409); assert.equal(f.counts().exchanges, 0); assert.equal(begins, 1);
    assert.equal((await f.repository.command("custody", "status", { ownerId: B, operationId: c.operationId, intentSha256: c.intentSha256 })).state, "unresolved");
    await assert.rejects(f.rpc("wd_apple_custody_command", "status", { ownerId: A, operationId: c.operationId, intentSha256: c.intentSha256 }, A, "authenticated"));
    await f.admin(async d => { const rows = (await d.query<{ relname: string; relrowsecurity: boolean; relforcerowsecurity: boolean }>("select relname,relrowsecurity,relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='wd_apple_private' and c.relkind='r'")).rows; assert.deepEqual(rows.map(x => x.relname).sort(), ["auth_attempts", "credentials", "deletion_bindings", "exchanges", "owners", "prepared_captures", "registry", "revocation_groups", "revocations"]); assert.ok(rows.every(x => x.relrowsecurity && x.relforcerowsecurity)); await d.exec("set role service_role"); await assert.rejects(d.query("select * from wd_apple_private.credentials")); await d.exec("reset role"); });
    // Pending originals reserve capacity too;32 parallel admissions cannot later
    // overflow the secret inventory just because none has stored a blob yet.
    const base = { ownerId: A, intentSha256: "a".repeat(64), clientId, appleIdentityHash: "b".repeat(64), identityHash: "c".repeat(64), policy: custodyPolicy, policySha256: appleDigest(custodyPolicy), reuseLineage: null };
    for (let n = 0; n < 31; n++) assert.equal((await f.repository.command("custody", "admit", { ...base, operationId: randomUUID(), codeHash: randomBytes(32).toString("hex") })).fresh, true);
    assert.equal((await f.repository.command("custody", "admit", { ...base, operationId: randomUUID(), codeHash: randomBytes(32).toString("hex") })).error, "credential_capacity");
  } finally { await f.close(); }
});
test("actual first-login SQL custody works before a wd account exists, with no implicit account or membership", async () => {
  const f = await fixture(false); try {
    assert.equal((await f.capture()).body.result.outcome, "stored"); await f.reopen(); assert.equal((await f.capture()).body.result.outcome, "reused_existing"); assert.equal(f.counts().exchanges, 1);
    await f.admin(async d => { assert.equal((await d.query("select user_id from wd_accounts where user_id=$1", [A])).rows.length, 0); assert.equal((await d.query("select user_id from wd_billing_bindings where user_id=$1", [A])).rows.length, 0); });
    assert.equal((await f.call("prepare")).status, 409); assert.equal(f.counts().deletes, 0);
  } finally { await f.close(); }
});
test("disk recovery after custody admit ACK loss or consumed-code process loss never grants another exchange", async () => {
  for (const boundary of ["admit", "exchange"]) {
    const f = await fixture(); try {
      const c = f.captureRequest();
      const repository: AppleRepository = { command: async (ns, action, body) => { const r = await f.repository.command(ns, action, body); if (boundary === "admit" && action === "admit") throw Error("synthetic stopped after admit"); return r; } };
      const originalExchange = f.custodyDeps.client.exchange;
      const client = { ...f.custodyDeps.client, exchange: async (code: string) => { const r = await originalExchange(code); if (boundary === "exchange") throw Error("synthetic consumed code before durable store"); return r; } };
      assert.equal((await createAppleTokenCustodyService({ ...f.custodyDeps, repository, client })(c.request())).status, 409);
      const count = f.counts().exchanges; assert.equal(count, boundary === "admit" ? 0 : 1); await f.reopen();
      assert.equal((await createAppleTokenCustodyService(f.custodyDeps)(c.request())).status, 409); assert.equal(f.counts().exchanges, count);
      assert.equal((await f.repository.command("custody", "status", { ownerId: A, operationId: c.operationId, intentSha256: c.intentSha256 })).state, boundary === "admit" ? "admitted" : "started");
      await f.admin(async d => assert.equal((await d.query("select * from wd_apple_private.credentials")).rows.length, 0));
    } finally { await f.close(); }
  }
});
