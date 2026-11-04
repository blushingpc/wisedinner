import test, { after } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { resolve } from "node:path";
import { appleDigest, type AppleData } from "./apple-token-custody.server.ts";
import { CURRENT_AUTH_SCOPE, CURRENT_AUTH_SCOPE_REFERENCES, type ScopeObservationRequest, type ScopeObservation, type CurrentScopeReference } from "./current-auth-scope.server.ts";
import { createCurrentUuidReceiptCleanup } from "./current-uuid-receipt-cleanup.server.ts";
import { createCurrentUuidClaimScopeIssuer, type CurrentUuidClaimScopeDependencies, type CurrentUuidClaimTemplate, type ClaimReferenceSelector } from "./current-uuid-claim-scope.server.ts";
import { createCurrentUuidAuthScopePreflight, isIssuedUuidAuthScopeProof } from "./current-uuid-auth-scope.server.ts";

const slotPath = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION;
assert.ok(slotPath, "Main exclusive local slot required before PGlite, no skip");
const slot = JSON.parse(await readFile(slotPath, "utf8"));
assert.equal(slot.contract, "wd-local-source-test-slot-v1");
assert.equal(slot.taskId, "backend-private-claim-scope-issuer-20261101");
assert.equal(slot.workerThreadId, "01a192eb-8b77-71f1-94a8-c96a303e937b");
assert.equal(resolve(slot.workspace), resolve(process.cwd()));
assert.ok(Date.parse(slot.at) <= Date.now() && Date.parse(slot.validUntil) > Date.now());
assert.ok(slot.argv.includes("lib/current-uuid-claim-scope.test.ts"));
const { PGlite } = await import("@electric-sql/pglite");

// Synthetic private operator-reviewed policies/selectors. Not production
// authority, provider identity-CAS, hosted admission or PostgreSQL concurrency.
const H = "a".repeat(64), C = "b".repeat(64), E = "c".repeat(64);
const policy = { approved: true as const, version: "wd-owner-uuid-delete-v1", preparedSeconds: 600, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 600, retainedEvidence: ["deletion_receipt", "billing_evidence", "apple_credential_recovery"] };
const custodyPolicy = { approved: true as const, version: "synthetic-only", credentialSeconds: 600, recoverySeconds: 600, evidenceSeconds: 3600, retainedEvidence: ["apple_credential_recovery"] };
type Mutable = Record<string, unknown>;
function fixture() {
  const at = Date.now(), target = { userId: randomUUID(), identityHash: H, operationId: randomUUID() };
  let clock = at, calls = 0, observations = 0, identityCalls = 0, selections = 0, absent = false, existing = false;
  const lease = new Date(at + 60000).toISOString();
  const fence: AppleData = { owner: randomUUID(), attempt: 1, lease, authState: "started", disposition: "not_required", currentIdentityHash: H, actualApple: "none", effectiveApple: "none", apple: "none", appleState: "not_required", intentId: randomUUID(), intentSha256: H, policySha256: appleDigest(policy), retainedEvidence: [...policy.retainedEvidence], fenceHash: H };
  const claim = { userId: target.userId, identityHash: H, authOperationId: target.operationId, deletionOperationId: fence.intentId as string, intentSha256: H, workOwner: fence.owner as string, workAttempt: 1, leaseUntil: lease };
  const retainedRow = { count: 1, sha256: appleDigest(["synthetic-reviewed-tombstone", target.userId, 2]) };
  const selectors: ClaimReferenceSelector[] = [{ reference: "accountTombstone", projection: CURRENT_AUTH_SCOPE + "/accountTombstone", userId: target.userId, identityHash: H, policySha256: appleDigest(policy), maxCount: 1,
    async select(q) { selections++; assert.deepEqual(q.binding, claim); assert.equal(q.accountRevision, 2); return { projectionIdentitySha256: q.projectionIdentitySha256, value: retainedRow }; } }];
  const template: CurrentUuidClaimTemplate = { deletionPolicy: policy, custodyPolicy, expectedCatalogSha256: C, expectedEngineSha256: E, writerManifestSha256: H, writerCatalogSha256: C, validUntil: lease, maxObservationAgeMs: 8000, selectors };
  const original: AppleData = { state: "started", scopeAdmitted: true, scopeHash: E, evidenceHash: null, scopeProfile: policy.version, scopeProviderPredicate: "account-uuid-only", scopePolicySha256: appleDigest(policy), scopeAccountRevision: 2 };
  function observation(q: ScopeObservationRequest): ScopeObservation {
    const references = Object.fromEntries(Object.keys(CURRENT_AUTH_SCOPE_REFERENCES).map(k => [k, k === "retentionAttempts" ? { count: 0, sha256: H, validUntil: null } : { count: 0, sha256: H }])) as ScopeObservation["references"];
    return { contract: CURRENT_AUTH_SCOPE, binding: structuredClone(q.binding), policySha256: q.policySha256, authorizationId: q.authorizationId, scopeSha256: q.scopeSha256, observedAt: new Date(clock).toISOString(), validUntil: lease,
      accountRevision: 2, authGraphSha256: H, catalogSha256: C, references: { ...references, accountTombstone: retainedRow },
      storage: { objects: 0, buckets: 0, multipartUploads: 0, multipartParts: 0, metadataReferences: 0, unknownLinkages: 0 },
      application: { savedWeeks: 0, accountReceipts: 0, pushTokens: 0, pushReceipts: 0, pushJobs: 0, currentPlanCleanupPending: false, privateResidue: 0, unexpectedAccountFields: 0 },
      engine: { metadataSha256: E, authLinks: 0, ownerMatches: 0, unknownLinkages: 0 }, providerOperations: "settled", unclassifiedReferences: 0, writeFence: null };
  }
  const requests: ScopeObservationRequest[] = [];
  const deps: { -readonly [K in keyof CurrentUuidClaimScopeDependencies]: CurrentUuidClaimScopeDependencies[K] } = { template, now: () => clock,
    repository: { async command(ns, action, t) { calls++; assert.equal(ns, "deletion"); assert.deepEqual(t, target); assert.ok(["auth_fence", "auth_original"].includes(action), "no mutation command"); return structuredClone(action === "auth_fence" ? fence : existing ? original : { error: "original_unresolved" }); } },
    async readIdentity(userId) { identityCalls++; assert.equal(userId, target.userId); return absent ? { outcome: "absent", userId, observedAt: new Date(clock).toISOString() } : { outcome: "present", identity: { userId, identityHash: H, evidenceHash: E, apple: "none" }, observedAt: new Date(clock).toISOString() }; },
    async observe(q) { observations++; requests.push(structuredClone(q)); return observation(q); }
  };
  return { at, target, fence, claim, template, original, retainedRow, deps, observation, requests, setClock: (v: number) => clock = v, setAbsent: () => { absent = true; existing = true; }, setExistingOriginal: () => existing = true, counts: () => ({ calls, observations, identityCalls, selections }) };
}
test("pure construction; exact current target issuance is frozen, observed twice and never a final proof", async () => {
  const f = fixture(), issuer = createCurrentUuidClaimScopeIssuer(f.deps);
  assert.deepEqual(f.counts(), { calls: 0, observations: 0, identityCalls: 0, selections: 0 });
  const result = await issuer.issue({ phase: "run", target: f.target, fence: f.fence });
  assert.ok(result); assert.equal(result.phase, "run"); assert.deepEqual(result.admission.target, f.claim);
  assert.equal(result.admission.expectedCatalogSha256, C); assert.equal(result.admission.expectedEngineSha256, E);
  assert.equal(result.admission.expiresAt, f.claim.leaseUntil); assert.equal(isIssuedUuidAuthScopeProof(result), false);
  assert.equal(f.requests.length, 2); assert.notEqual(f.requests[0].scopeSha256, f.requests[1].scopeSha256);
  assert.equal(f.requests[1].scopeSha256, appleDigest(["wd-current-auth-scope-admission-v2", result.admission]));
  assert.equal(f.requests[0].authorizationId, f.requests[1].authorizationId); assert.notEqual(f.requests[0].scopeSha256, "0".repeat(64));
  assert.ok(Object.isFrozen(result) && Object.isFrozen(result.admission.retained.accountTombstone));
});
test("separate issuance gets a fresh nonce, does not mutate or repin previous scope", async () => {
  const f = fixture(), issuer = createCurrentUuidClaimScopeIssuer(f.deps), input = { phase: "run" as const, target: f.target, fence: f.fence };
  const first = await issuer.issue(input), before = appleDigest(first); const second = await issuer.issue(input);
  assert.ok(first && second); assert.notEqual(first.admission.authorizationId, second.admission.authorizationId); assert.equal(appleDigest(first), before);
});
test("missing configuration/accessor/proxy/functions with hostile bind are closed without construction IO", async () => {
  const f = fixture(); let effects = 0;
  const getter = Object.defineProperty({}, "template", { enumerable: true, get() { effects++; throw Error(); } });
  const proxy = new Proxy({}, { ownKeys() { effects++; throw Error(); }, getPrototypeOf() { effects++; throw Error(); } });
  for (const d of [undefined, getter, proxy, { ...f.deps, template: { ...f.template, selectors: [proxy] } }]) {
    assert.equal(await createCurrentUuidClaimScopeIssuer(d as CurrentUuidClaimScopeDependencies).issue({ phase: "run", target: f.target, fence: f.fence }), null);
  }
  Object.defineProperty(f.deps.observe, "bind", { get() { effects++; throw Error(); } });
  assert.ok(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: f.target, fence: f.fence })); assert.equal(effects, 0);
});
test("own-data immutable configuration snapshots preserve captured receiver, reject input accessors/proxies", async () => {
  const f = fixture(), originalCommand = f.deps.repository.command;
  f.deps.repository.command = async function(ns, action, body) { assert.equal(this, f.deps.repository); return originalCommand(ns, action, body); };
  const issuer = createCurrentUuidClaimScopeIssuer(f.deps);
  (f.template as unknown as Mutable).expectedCatalogSha256 = H;
  f.deps.repository.command = async () => { throw Error("replaced"); };
  assert.ok(await issuer.issue({ phase: "run", target: f.target, fence: f.fence }));
  let gets = 0; const input = Object.defineProperty({}, "phase", { enumerable: true, get() { gets++; throw Error(); } });
  assert.equal(await issuer.issue(input as never), null);
  assert.equal(await issuer.issue(new Proxy({}, { ownKeys() { gets++; throw Error(); } }) as never), null); assert.equal(gets, 0);
});
for (const field of ["owner", "attempt", "lease", "intentId", "intentSha256", "currentIdentityHash", "policySha256", "fenceHash", "extra"]) test("complete supplied fence drift holds: " + field, async () => {
  const f = fixture(), bad = { ...f.fence, [field]: field === "attempt" ? 2 : field === "lease" ? new Date(f.at + 30000).toISOString() : "changed" };
  assert.equal(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: f.target, fence: bad }), null); assert.equal(f.counts().observations, 0);
});
for (const mode of ["missing-selector", "wrong-projection", "wrong-owner", "wrong-policy", "wrong-identity", "count-bound", "wrong-content", "wrong-projection-identity", "stale-template", "unapproved-policy", "malformed-selector"]) test("explicit reference authority holds: " + mode, async () => {
  const f = fixture(), selectors = f.template.selectors as ClaimReferenceSelector[], m = selectors[0] as unknown as Mutable;
  if (mode === "missing-selector") selectors.length = 0;
  if (mode === "wrong-projection") m.projection = "*";
  if (mode === "wrong-owner") m.userId = randomUUID();
  if (mode === "wrong-policy") m.policySha256 = E;
  if (mode === "wrong-identity") m.identityHash = E;
  if (mode === "count-bound") m.maxCount = 0;
  if (mode === "wrong-content") m.select = async (q: { projectionIdentitySha256: string }) => ({ projectionIdentitySha256: q.projectionIdentitySha256, value: { count: 1, sha256: E } });
  if (mode === "wrong-projection-identity") m.select = async () => ({ projectionIdentitySha256: H, value: f.retainedRow });
  if (mode === "stale-template") (f.template as unknown as Mutable).validUntil = new Date(f.at - 1).toISOString();
  if (mode === "unapproved-policy") (f.template as unknown as Mutable).deletionPolicy = { ...policy, approved: false };
  if (mode === "malformed-selector") m.extra = true;
  assert.equal(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: f.target, fence: f.fence }), null);
});
for (const mode of ["catalog", "engine", "unknown-reference", "unknown-schema", "storage", "application", "provider", "count", "retention-zero-shape", "expired", "future", "identity", "fence-after", "final-content", "final-echo"]) test("actual fact/reobservation hold: " + mode, async () => {
  const f = fixture(), ob = f.deps.observe, cmd = f.deps.repository.command; let n = 0;
  f.deps.observe = async q => { n++; const o = await ob(q) as unknown as Mutable;
    if (mode === "catalog") o.catalogSha256 = H;
    if (mode === "engine") (o.engine as Mutable).metadataSha256 = H;
    if (mode === "unknown-reference") (o.references as Mutable).unknown = { count: 1, sha256: H };
    if (mode === "unknown-schema") o.unclassifiedReferences = 1;
    if (mode === "storage") (o.storage as Mutable).objects = 1;
    if (mode === "application") (o.application as Mutable).accountReceipts = 1;
    if (mode === "provider") o.providerOperations = "unknown";
    if (mode === "count") ((o.references as Mutable).accountTombstone as Mutable).count = 129;
    if (mode === "retention-zero-shape") (o.references as Mutable).retentionAttempts = { count: 0, sha256: H, validUntil: f.claim.leaseUntil };
    if (mode === "expired") o.validUntil = new Date(f.at - 1).toISOString();
    if (mode === "future") o.observedAt = new Date(f.at + 1).toISOString();
    if (mode === "final-content" && n === 2) o.authGraphSha256 = E;
    if (mode === "final-echo" && n === 2) o.scopeSha256 = f.requests[0].scopeSha256;
    return o;
  };
  if (mode === "identity") f.deps.readIdentity = async () => ({ outcome: "unknown" });
  if (mode === "fence-after") { let reads = 0; f.deps.repository.command = async (ns, action, b) => { const o = await cmd(ns, action, b); if (++reads === 2) o.owner = randomUUID(); return o; }; }
  assert.equal(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: f.target, fence: f.fence }), null);
});
test("Auth absence is reconcile-only and requires unchanged durable stored UUID original", async () => {
  const f = fixture(); f.setAbsent(); const issuer = createCurrentUuidClaimScopeIssuer(f.deps);
  assert.equal(await issuer.issue({ phase: "run", target: f.target, fence: f.fence }), null);
  const result = await issuer.issue({ phase: "reconcile", target: f.target, fence: f.fence }); assert.ok(result); assert.equal(result.phase, "reconcile");
  for (const key of ["scopeAdmitted", "scopeProfile", "scopePolicySha256", "scopeAccountRevision", "scopeHash", "state"]) {
    const g = fixture(); g.setAbsent(); g.original[key] = key === "scopeAdmitted" ? false : key === "scopeAccountRevision" ? 3 : "unknown";
    assert.equal(await createCurrentUuidClaimScopeIssuer(g.deps).issue({ phase: "reconcile", target: g.target, fence: g.fence }), null);
  }
});
test("deadline crossing and changed durable reconciliation original hold without retry", async () => {
  const f = fixture(), ob = f.deps.observe; f.deps.observe = async q => { const o = await ob(q); f.setClock(f.at + 60001); return o; };
  assert.equal(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: f.target, fence: f.fence }), null);
  const g = fixture(), cmd = g.deps.repository.command; let n = 0; g.setAbsent();
  g.deps.repository.command = async (ns, action, b) => { const o = await cmd(ns, action, b); if (action === "auth_original" && ++n === 2) o.scopeHash = H; return o; };
  assert.equal(await createCurrentUuidClaimScopeIssuer(g.deps).issue({ phase: "reconcile", target: g.target, fence: g.fence }), null); assert.equal(n, 2);
});

test("nonempty retention is exact target projection/count/content/deadline, with fixed128bound", async () => {
  for (const change of ["none", "missing", "content", "expiry", "owner", "over128"]) {
    const f = fixture(), deadline = new Date(f.at + 30000).toISOString();
    const row = { count: change === "over128" ? 129 : 128, sha256: appleDigest(["synthetic-reviewed-associated-retention", f.claim, deadline]), validUntil: deadline };
    const expected = { ...row, ...(change === "content" ? { sha256: E } : {}), ...(change === "expiry" ? { validUntil: f.claim.leaseUntil } : {}) };
    if (change !== "missing") (f.template.selectors as ClaimReferenceSelector[]).push({ reference: "retentionAttempts", projection: CURRENT_AUTH_SCOPE + "/retentionAttempts", userId: change === "owner" ? randomUUID() : f.target.userId, identityHash: H, policySha256: appleDigest(policy), maxCount: 128,
      async select(q) { assert.deepEqual(q.binding, f.claim); return { projectionIdentitySha256: q.projectionIdentitySha256, value: expected }; } });
    f.deps.observe = async q => { const o = f.observation(q); return { ...o, validUntil: deadline, references: { ...o.references, retentionAttempts: row } }; };
    const result = await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: f.target, fence: f.fence });
    if (change === "none") { assert.ok(result); assert.equal(result.admission.expiresAt, deadline); assert.deepEqual(result.admission.retained.retentionAttempts, row); }
    else assert.equal(result, null, change);
  }
});
test("cross-target and fresh provider identity/absence are independently checked", async () => {
  for (const mode of ["user", "operation", "identity", "provider-owner", "provider-identity", "provider-apple", "stale-provider"]) {
    const f = fixture(), t = { ...f.target }, read = f.deps.readIdentity;
    if (mode === "user") t.userId = randomUUID();
    if (mode === "operation") t.operationId = randomUUID();
    if (mode === "identity") t.identityHash = E;
    f.deps.readIdentity = async id => {
      const v = await read(id); if (v.outcome !== "present") return v;
      return { ...v, observedAt: mode === "stale-provider" ? new Date(f.at - 8001).toISOString() : v.observedAt,
        identity: { ...v.identity, ...(mode === "provider-owner" ? { userId: randomUUID() } : {}), ...(mode === "provider-identity" ? { identityHash: E } : {}), ...(mode === "provider-apple" ? { apple: "linked" as const } : {}) } };
    };
    assert.equal(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: t, fence: f.fence }), null, mode);
  }
});
test("construction does not call configured clock, receiver/name getters, source or admission", async () => {
  const f = fixture(); let clocks = 0, names = 0;
  f.deps.now = () => { clocks++; return f.at; };
  Object.defineProperty(f.deps.repository.command, "name", { get() { names++; throw Error(); } });
  const issuer = createCurrentUuidClaimScopeIssuer(f.deps); assert.equal(clocks, 0); assert.equal(names, 0); assert.equal(f.counts().calls, 0);
  assert.ok(await issuer.issue({ phase: "run", target: f.target, fence: f.fence })); assert.equal(names, 0);
});

test("an already admitted unknown original is reconcile-only, with no new run scope", async () => {
  const f = fixture(); f.setExistingOriginal(); const before = appleDigest(f.original);
  assert.equal(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "run", target: f.target, fence: f.fence }), null);
  assert.equal(f.counts().observations, 0); assert.equal(appleDigest(f.original), before);
  assert.ok(await createCurrentUuidClaimScopeIssuer(f.deps).issue({ phase: "reconcile", target: f.target, fence: f.fence }));
});
let db = await PGlite.create();
const syntheticRoleDDL = `create role anon;create role authenticated;create role service_role bypassrls;
    create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid() returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role() returns text language sql stable as $$select auth.jwt()->>'role'$$;
    create table auth.users(id uuid primary key);create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);
    grant select on auth.users,auth.identities to service_role;
    create schema storage;grant usage on schema storage to service_role;
    create table storage.buckets(id text primary key,owner uuid,owner_id text);
    create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);
    create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);
    grant select on all tables in schema storage to service_role;`;
await db.exec(syntheticRoleDDL);

const directory = new URL("../supabase/migrations/", import.meta.url);
for (const name of (await readdir(directory)).filter(n => /^00\d\d_.*\.sql$/.test(n) && Number(n.slice(0,4)) <= 27).sort()) await db.exec(await readFile(new URL(name, directory), "utf8"));
after(async () => { await db.close(); });
async function role(principal = "service_role", uid = "10000000-0000-4000-8000-000000000001") {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: principal, sub: uid, is_anonymous: false, amr: [{ method: "password", timestamp: Math.floor(Date.now()/1000) }] })]);
  assert.ok(["authenticated", "service_role"].includes(principal)); await db.exec("set role " + principal);
}
async function rpc(name: string, action: string, body: unknown, principal = "service_role", uid?: string): Promise<AppleData> {
  assert.match(name, /^wd_[a-z0-9_]+$/); await role(principal, uid);
  return (await db.query<{ r: AppleData }>(`select public.${name}($1,$2::jsonb) r`, [action, JSON.stringify(body)])).rows[0].r;
}
async function observe(q: ScopeObservationRequest): Promise<ScopeObservation> {
  await role(); return (await db.query<{ r: ScopeObservation }>("select public.wd_current_auth_scope_observe($1::jsonb) r", [JSON.stringify(q)])).rows[0].r;
}
test("actual unchanged0001..0027 fresh active -> admitted -> confirmed -> random claim/cleanup/auth fence: protected observer holds real receipt/unknown schema", async () => {
  const userId = "10000000-0000-4000-8000-000000000001", op = randomUUID(), recoveryHash = H;
  await db.exec("reset role"); await db.query("insert into auth.users values($1)", [userId]); await db.query("insert into public.wd_accounts(user_id)values($1)", [userId]);
  const f = fixture(), repository = { async command(ns: "custody" | "revocation" | "deletion", action: string, body: AppleData) { assert.equal(ns, "deletion"); assert.ok(["auth_fence", "auth_original"].includes(action)); return rpc("wd_apple_deletion_command", action, body); } };
  const activeTarget = { userId, identityHash: H, operationId: randomUUID() };
  assert.equal(await createCurrentUuidClaimScopeIssuer({ ...f.deps, repository, observe }).issue({ phase: "run", target: activeTarget, fence: {} }), null);
  const basis = await rpc("wd_apple_deletion_command", "effective_basis", { userId });
  const admitted = await rpc("wd_apple_deletion_command", "admit_original", { original: { userId, operationId: op, recoveryHash, expectedAccountRevision: 1, identityHash: H, identityEvidence: H, appleLinkage: "none", policy, policyHash: appleDigest(policy), intentSha256: H }, basis: { userId, currentIdentityHash: H, identityEvidence: H, actualApple: "none", effectiveApple: "none", inventoryRevision: basis.revision, inventoryHash: basis.inventoryHash } });
  assert.equal(admitted.outcome, "admitted");
  const confirm = await rpc("wd_deletion_v2_account_command", "confirm", { operationId: op, recoveryHash, expectedAccountRevision: 1, intentSha256: H, confirmation: "DELETE MY ACCOUNT" }, "authenticated", userId); assert.equal(confirm.intentState, "confirmed");
  const owner = randomUUID(), original = { operationId: op, intentSha256: H, owner };
  const claimed = await rpc("wd_deletion_v2_worker_command", "claim", original), work = claimed.work as AppleData; assert.equal(work.owner, owner); assert.equal(work.attempt, 1);
  const advance = { ...original, attempt: work.attempt };
  assert.ok((await rpc("wd_deletion_v2_worker_command", "cleanup", advance)).receipt);
  await rpc("wd_deletion_v2_worker_command", "apple_unavailable", advance); await rpc("wd_deletion_v2_worker_command", "begin", { ...advance, dependency: "auth" });
  const target = { userId, identityHash: H, operationId: String(work.auth_operation) };
  const fence = await rpc("wd_apple_deletion_command", "auth_fence", target); assert.equal(fence.owner, owner); assert.equal(fence.attempt, 1); assert.equal(Date.parse(String(fence.lease)), Date.parse(String(work.lease_until)));
  const binding = { userId, identityHash: H, authOperationId: target.operationId, deletionOperationId: op, intentSha256: H, workOwner: owner, workAttempt: 1, leaseUntil: String(fence.lease) };
  const request: ScopeObservationRequest = { binding, policySha256: appleDigest(policy), authorizationId: randomUUID(), scopeSha256: appleDigest(["synthetic-non-authorizing-inspection", binding]), custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
  const actual = await observe(request); assert.equal(actual.contract, CURRENT_AUTH_SCOPE); assert.equal(actual.application.accountReceipts, 1); assert.ok(actual.unclassifiedReferences > 0);
  const template = { ...f.template, validUntil: binding.leaseUntil, selectors: [] };
  // Deliberately no afterimage-derived static authorization. The immutable
  // synthetic expected catalog cannot authorize the actual unknown full schema.
  const issuer = createCurrentUuidClaimScopeIssuer({ template, repository, observe, now: Date.now, readIdentity: async id => ({ outcome: "present", identity: { userId: id, identityHash: H, evidenceHash: H, apple: "none" }, observedAt: new Date().toISOString() }) });
  assert.equal(await issuer.issue({ phase: "run", target, fence }), null);
  await db.exec("reset role"); assert.equal((await db.query<{ n: number }>("select count(*)::int n from public.wd_account_receipts where user_id=$1", [userId])).rows[0].n, 1);
  assert.equal((await db.query<{ n: number }>("select count(*)::int n from wd_apple_private.auth_attempts where owner_id=$1", [userId])).rows[0].n, 0);
});
// No PGlite schedule is evidence of two physical PostgreSQL connections.

// Exact SYNTHETIC operator review is performed before ANY fresh owner operation.
// Approval of this test/source package is not production private authority.
const reviewedSourcePackageSha256 = "fb026af9c016dff6d008b7065ffb57ae6dd440ec026d649694e3c720e7dbf47e";
const sha = (v: string) => createHash("sha256").update(v).digest("hex");
function freezeFixture<T>(v: T): T {
  if (v && typeof v === "object") { Object.values(v).forEach(freezeFixture); Object.freeze(v); } return v;
}
test("accepted28/29: genuine fresh SQL RUN issuance under independent synthetic operator metadata/target selectors", async t => {
  // The original27 database is closed before the new instance is initialized.
  // Never two resident PGlite databases; no physical concurrency assertion.
  await db.close(); db = await PGlite.create(); await db.exec(syntheticRoleDDL);
  const names = (await readdir(directory)).filter(n => /^00\d\d_.*\.sql$/.test(n) && Number(n.slice(0,4)) <= 29).sort();
  assert.equal(names.length, 29);
  const ddl = new Map<string, string>();
  for (const name of names) ddl.set(name, await readFile(new URL(name, directory), "utf8"));
  assert.equal(sha(names.map(n => n + "|" + sha(ddl.get(n)!)).join("\n")), reviewedSourcePackageSha256, "fixed operator-reviewed DDL package before effects");
  assert.equal(JSON.parse(await readFile(new URL("../package.json", import.meta.resolve("@electric-sql/pglite")), "utf8")).version, "0.5.8");
  for (const name of names) await db.exec(ddl.get(name)!);
  const version = (await db.query<{ version: string }>("select version() version")).rows[0].version;
  assert.match(version, /^PostgreSQL 18\.3 \(PGlite 0\.5\.8\)/, "exact installed synthetic engine version, not live PostgreSQL concurrency");
  const roles = (await db.query<{ rolname: string; rolsuper: boolean; rolcanlogin: boolean; rolbypassrls: boolean }>("select rolname,rolsuper,rolcanlogin,rolbypassrls from pg_roles where rolname in('wd_deletion_v2_internal','wd_current_plan_internal','wd_receipt_cleanup_internal') order by rolname")).rows;
  assert.equal(roles.length, 3); assert.ok(roles.every(r => !r.rolsuper && !r.rolcanlogin && !r.rolbypassrls));
  const wrapper = (await db.query<{ invoker: boolean; owner: string; proconfig: string[]; runtime: boolean }>("select not prosecdef invoker,proowner::regrole::text owner,proconfig,has_function_privilege('service_role',oid,'EXECUTE') runtime from pg_proc where oid='public.wd_current_auth_scope_observe(jsonb)'::regprocedure")).rows[0];
  assert.deepEqual(wrapper, { invoker: true, owner: "postgres", proconfig: ['search_path=""'], runtime: true });
  assert.equal((await db.query<{ p: boolean }>("select has_table_privilege('service_role','public.wd_restore_intents','SELECT') p")).rows[0].p, false);
  assert.equal((await db.query<{ p: boolean }>("select has_table_privilege('service_role','public.wd_account_receipts','DELETE') p")).rows[0].p, false);

  // Fixed maintained metadata definitions from the byte-pinned package. These
  // catalog queries have NO target/observer success input and run before users.
  const observerDDL = ddl.get("0028_wd_current_reviewed_legacy_scope.sql")!;
  const barrierDDL = ddl.get("0027_wd_current_local_deletion_barrier.sql")!;
  function statement(source: string, start: string, end: string) {
    const a = source.indexOf(start); assert.ok(a >= 0); const b = source.indexOf(end, a); assert.ok(b > a); return source.slice(a, b + end.length);
  }
  const catalogQuery = statement(observerDDL, "select encode(sha256(convert_to(coalesce(jsonb_agg(v order by v::text)", ") s;").replace("into catalog_hash", "as hash");
  const engineQuery = statement(observerDDL, "select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(c.relname", "and c.relkind in('r','p');").replace("into engine_hash", "as hash");
  const manifestQuery = statement(barrierDDL, "select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_array(ns.nspname,p.proname", "and p.prokind in('f','p');").replace("into manifest_hash", "as hash");
  const writerQuery = statement(barrierDDL, "select encode(sha256(convert_to(jsonb_build_array(o->>'catalogSha256'", "into catalog_hash;").replace("o->>'catalogSha256'", "$1::text").replace("into catalog_hash", "as hash");
  async function metadata(query: string, args: unknown[] = []) { await db.exec("reset role;set search_path=\'\'"); return (await db.query<{ hash: string }>(query, args)).rows[0].hash; }
  const operator = freezeFixture({
    sourcePackageSha256: reviewedSourcePackageSha256, postgresVersion: version,
    expectedCatalogSha256: await metadata(catalogQuery), expectedEngineSha256: await metadata(engineQuery), writerManifestSha256: await metadata(manifestQuery),
    writerCatalogSha256: "", validUntil: new Date(Date.now() + 600000).toISOString(), maxObservationAgeMs: 8000,
    projectionDefinitions: ["accountTombstone", "deletionWork", "deletionIntents", "appleOwners", "appleBindings"] as CurrentScopeReference[]
  });
  // Object is frozen already; construct a second final immutable operator record
  // rather than mutating/adopting a later runtime observation.
  const approvedOperator = freezeFixture({ ...operator, writerCatalogSha256: await metadata(writerQuery, [operator.expectedCatalogSha256]) });
  assert.match(approvedOperator.expectedCatalogSha256, /^[a-f0-9]{64}$/);
  const A = "10000000-0000-4000-8000-000000000001";
  const commands: string[] = [], observations: ScopeObservationRequest[] = [], projections: string[] = [];
  const repository = { async command(ns: "custody" | "revocation" | "deletion", action: string, body: AppleData) { assert.equal(ns, "deletion"); assert.ok(["auth_fence", "auth_original"].includes(action)); commands.push(action); return rpc("wd_apple_deletion_command", action, body); } };
  const realObserve = async (q: ScopeObservationRequest) => { observations.push(structuredClone(q)); return observe(q); };
  const identity = async (userId: string) => ({ outcome: "present" as const, identity: { userId, identityHash: H, evidenceHash: H, apple: "none" as const }, observedAt: new Date().toISOString() });
  const selectors: ClaimReferenceSelector[] = approvedOperator.projectionDefinitions.map(reference => ({
    reference, projection: CURRENT_AUTH_SCOPE + "/" + reference, userId: A, identityHash: H, policySha256: appleDigest(policy), maxCount: 1,
    async select(q) {
      // Separately correlated maintained sanitized metadata read. No issuer raw
      // reply/references is captured or returned here, even by closure.
      assert.equal(q.reference, reference); assert.equal(q.projection, CURRENT_AUTH_SCOPE + "/" + reference); assert.equal(q.phase, "run");
      assert.equal(q.binding.userId, A); assert.equal(q.binding.identityHash, H); assert.equal(q.policySha256, appleDigest(policy)); assert.equal(q.accountRevision, 2);
      const { projectionIdentitySha256, ...domain } = q;
      assert.equal(projectionIdentitySha256, appleDigest(["wd-current-uuid-claim-target-projection-v1", domain]));
      const f = await rpc("wd_apple_deletion_command", "auth_fence", { userId: A, identityHash: H, operationId: q.binding.authOperationId });
      assert.equal(f.owner, q.binding.workOwner); assert.equal(f.attempt, q.binding.workAttempt); assert.equal(f.lease, q.binding.leaseUntil);
      assert.equal(f.intentId, q.binding.deletionOperationId); assert.equal(f.intentSha256, q.binding.intentSha256); assert.equal(f.policySha256, q.policySha256);
      const projectionRequest: ScopeObservationRequest = { binding: q.binding, policySha256: q.policySha256, authorizationId: randomUUID(),
        scopeSha256: appleDigest(["synthetic-reviewed-independent-projection-v78", q, randomUUID()]), custodyPolicy, custodyPolicySha256: appleDigest(custodyPolicy) };
      await role();
      let value: { count: number; sha256: string };
      if (reference === "accountTombstone") {
        value = (await db.query<{ value: { count: number; sha256: string } }>("select jsonb_build_object('count',count(*),'sha256',encode(sha256(convert_to(coalesce(jsonb_agg(to_jsonb(t) order by t.user_id),'[]')::text,'UTF8')),'hex')) value from public.wd_accounts t where user_id=$1::uuid and revision=$2", [A, q.accountRevision])).rows[0].value;
      } else {
        const meta = (await db.query<{ value: AppleData }>("select public.wd_current_auth_scope_private($1::jsonb) value", [JSON.stringify(projectionRequest)])).rows[0].value;
        assert.notEqual(meta.outcome, "held"); value = (meta.references as Record<string, { count: number; sha256: string }>)[reference];
      }
      assert.equal(value.count, 1); assert.match(value.sha256, /^[a-f0-9]{64}$/); projections.push(reference);
      return { projectionIdentitySha256, value: structuredClone(value) };
    }
  }));
  const template: CurrentUuidClaimTemplate = freezeFixture({ deletionPolicy: policy, custodyPolicy,
    expectedCatalogSha256: approvedOperator.expectedCatalogSha256, expectedEngineSha256: approvedOperator.expectedEngineSha256,
    writerManifestSha256: approvedOperator.writerManifestSha256, writerCatalogSha256: approvedOperator.writerCatalogSha256,
    validUntil: approvedOperator.validUntil, maxObservationAgeMs: approvedOperator.maxObservationAgeMs, selectors });
  const deps: CurrentUuidClaimScopeDependencies = { template, repository, observe: realObserve, now: Date.now, readIdentity: identity };
  async function admin<T = Record<string, unknown>>(query: string, args: unknown[] = []) { await db.exec("reset role"); return db.query<T>(query, args); }
  async function trial(fn: () => Promise<void>) { await admin("begin"); try { await fn(); } finally { await db.exec("rollback;reset role"); } }
  async function fresh() {
    await admin("insert into auth.users values($1)", [A]); await admin("insert into public.wd_accounts(user_id)values($1)", [A]);
    const active = { userId: A, identityHash: H, operationId: randomUUID() };
    assert.equal(await createCurrentUuidClaimScopeIssuer(deps).issue({ phase: "run", target: active, fence: {} }), null);
    const op = randomUUID(), owner = randomUUID(), basis = await rpc("wd_apple_deletion_command", "effective_basis", { userId: A });
    const admitted = await rpc("wd_apple_deletion_command", "admit_original", { original: { userId: A, operationId: op, recoveryHash: H, expectedAccountRevision: 1, identityHash: H, identityEvidence: H, appleLinkage: "none", policy, policyHash: appleDigest(policy), intentSha256: H }, basis: { userId: A, currentIdentityHash: H, identityEvidence: H, actualApple: "none", effectiveApple: "none", inventoryRevision: basis.revision, inventoryHash: basis.inventoryHash } }); assert.equal(admitted.outcome, "admitted");
    assert.equal((await rpc("wd_deletion_v2_account_command", "confirm", { operationId: op, recoveryHash: H, expectedAccountRevision: 1, intentSha256: H, confirmation: "DELETE MY ACCOUNT" }, "authenticated", A)).intentState, "confirmed");
    const command = { operationId: op, intentSha256: H, owner }, work = (await rpc("wd_deletion_v2_worker_command", "claim", command)).work as AppleData;
    assert.equal(work.owner, owner); assert.equal(work.attempt, 1);
    assert.ok((await rpc("wd_deletion_v2_worker_command", "cleanup", { ...command, attempt: work.attempt })).receipt);
    assert.equal((await admin<{ n: number }>("select count(*)::int n from public.wd_account_receipts where user_id=$1", [A])).rows[0].n, 1);
    // The actual0029 precondition is auth_state=pending: cleanup is a separate
    // trusted caller step before auth worker begin, never inside this issuer.
    const cleanupInput = { userId: A, authOperationId: String(work.auth_operation), deletionOperationId: op, intentSha256: H, identityHash: H, workOwner: owner, workAttempt: Number(work.attempt), leaseUntil: String(work.lease_until), accountRevision: 2, policySha256: appleDigest(policy) };
    const cleanup = createCurrentUuidReceiptCleanup({ policy, now: Date.now, timeoutMs: 8000, maxObservationAgeMs: 8000, async rpc(name, body) { assert.equal(name, "wd_current_ephemeral_deletion_receipt_cleanup"); await role(); return (await db.query<{ r: unknown }>("select public.wd_current_ephemeral_deletion_receipt_cleanup($1::jsonb) r", [JSON.stringify(body)])).rows[0].r; } });
    const cleared = await cleanup.clear(cleanupInput); assert.equal(cleared.outcome, "cleared"); if (cleared.outcome === "cleared") assert.equal(cleared.removed, 1);
    assert.equal((await admin<{ n: number }>("select count(*)::int n from public.wd_account_receipts where user_id=$1", [A])).rows[0].n, 0);
    await rpc("wd_deletion_v2_worker_command", "apple_unavailable", { ...command, attempt: work.attempt });
    await rpc("wd_deletion_v2_worker_command", "begin", { ...command, attempt: work.attempt, dependency: "auth" });
    const target = { userId: A, identityHash: H, operationId: String(work.auth_operation) }, fence = await rpc("wd_apple_deletion_command", "auth_fence", target);
    const binding = { userId: A, identityHash: H, authOperationId: target.operationId, deletionOperationId: op, intentSha256: H, workOwner: owner, workAttempt: Number(work.attempt), leaseUntil: String(fence.lease) };
    assert.equal(fence.owner, owner); assert.equal(fence.attempt, work.attempt); assert.equal(Date.parse(String(fence.lease)), Date.parse(String(work.lease_until)));
    return { target, fence, binding };
  }
  async function commitments() {
    await db.exec("reset role");
    const tables = (await db.query<{ name: string }>("select quote_ident(n.nspname)||'.'||quote_ident(c.relname) name from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind='r' and n.nspname in('public','auth','storage','wd_current_private','wd_apple_private','wd_deletion_v2_private') order by 1")).rows;
    const result: Record<string, string> = {};
    for (const { name } of tables) result[name] = (await db.query<{ hash: string }>(`select encode(sha256(convert_to(coalesce(jsonb_agg(v order by v::text),'[]')::text,'UTF8')),'hex') hash from(select to_jsonb(t) v from ${name} t) q`)).rows[0].hash;
    return result;
  }
  await t.test("fresh actual RUN produces frozen exact admission after real independent projections and final common reobservation", () => trial(async () => {
    const f = await fresh(), start = observations.length, before = await commitments();
    const result = await createCurrentUuidClaimScopeIssuer(deps).issue({ phase: "run", target: f.target, fence: f.fence });
    assert.ok(result, "required actual SQL RUN issuance; bounded diagnostics=" + JSON.stringify({ commandTail: commands.slice(-5), observations: observations.length-start, selected: projections.slice(-5) }));
    assert.deepEqual(result.admission.target, f.binding); assert.equal(result.admission.accountRevision, 2); assert.equal(appleDigest(result.admission.deletionPolicy), appleDigest(policy));
    assert.equal(result.admission.expectedCatalogSha256, approvedOperator.expectedCatalogSha256); assert.equal(result.writerManifestSha256, approvedOperator.writerManifestSha256); assert.equal(result.writerCatalogSha256, approvedOperator.writerCatalogSha256);
    assert.deepEqual(Object.keys(result.admission.retained).sort(), [...approvedOperator.projectionDefinitions].sort());
    assert.ok(approvedOperator.projectionDefinitions.every(k => projections.includes(k)));
    assert.equal(observations.length-start, 2); assert.equal(observations.at(-1)!.scopeSha256, appleDigest(["wd-current-auth-scope-admission-v2", result.admission]));
    const actual = await observe(observations.at(-1)!); assert.equal(actual.application.accountReceipts, 0); assert.equal(actual.unclassifiedReferences, 0); assert.equal(actual.providerOperations, "settled"); assert.equal(actual.writeFence, null);
    assert.ok(Object.isFrozen(result.admission)); assert.equal(isIssuedUuidAuthScopeProof(result), false);
    assert.deepEqual(await commitments(), before, "issuer/selectors/reobservation preserve all synthetic application/Auth/storage/private table commitments");
    assert.equal((await admin<{ n: number }>("select count(*)::int n from wd_apple_private.auth_attempts")).rows[0].n, 0, "issuer never admits Auth effect");
    assert.ok(commands.every(c => ["auth_fence", "auth_original"].includes(c)));
  }));
  for (const mode of ["missing-selector", "wrong-static-catalog", "wrong-static-engine", "nonempty-legacy", "schema-drift", "dynamic-reference-change"]) await t.test("real SQL guard remains closed: " + mode, () => trial(async () => {
    const f = await fresh(); let config = deps;
    if (mode === "missing-selector") config = { ...deps, template: { ...template, selectors: template.selectors.filter(x => x.reference !== "deletionWork") } };
    if (mode === "wrong-static-catalog") config = { ...deps, template: { ...template, expectedCatalogSha256: H } };
    if (mode === "wrong-static-engine") config = { ...deps, template: { ...template, expectedEngineSha256: H } };
    if (mode === "nonempty-legacy") await admin("insert into public.waitlist(email,source) values('synthetic@example.invalid','synthetic')");
    if (mode === "schema-drift") await admin("alter table public.waitlist add column unclassified jsonb");
    if (mode === "dynamic-reference-change") {
      let calls = 0; config = { ...deps, async observe(q) { if (++calls === 2) await admin("update public.wd_deletion_work set apple_evidence=repeat(\'d\',64) where user_id=$1", [A]); return realObserve(q); } };
    }
    assert.equal(await createCurrentUuidClaimScopeIssuer(config).issue({ phase: "run", target: f.target, fence: f.fence }), null);
    assert.equal((await admin<{ n: number }>("select count(*)::int n from wd_apple_private.auth_attempts")).rows[0].n, 0);
  }));
  await t.test("real outstanding Auth original and actual Auth absence do not fake destructive reconcile scope or repin history", () => trial(async () => {
    const f = await fresh(), issued = await createCurrentUuidClaimScopeIssuer(deps).issue({ phase: "run", target: f.target, fence: f.fence }); assert.ok(issued);
    const preflight = createCurrentUuidAuthScopePreflight({ enabled: true, admission: issued.admission, writerManifestSha256: issued.writerManifestSha256, writerCatalogSha256: issued.writerCatalogSha256, observe: realObserve, observeLocalDenial: async q => { await role(); return (await db.query<{ r: unknown }>("select public.wd_current_local_deletion_barrier($1::jsonb) r", [JSON.stringify(q)])).rows[0].r; }, now: Date.now });
    const proof = await preflight(f.binding); assert.equal(proof.outcome, "allowed");
    assert.equal((await rpc("wd_apple_deletion_command", "auth_begin", { ...f.target, fenceHash: f.fence.fenceHash, scope: proof })).fresh, true);
    const stored = await rpc("wd_apple_deletion_command", "auth_original", f.target); assert.equal(stored.scopeProfile, policy.version); assert.equal(stored.state, "started");
    assert.equal(await createCurrentUuidClaimScopeIssuer(deps).issue({ phase: "reconcile", target: f.target, fence: f.fence }), null, "outstanding attempt makes actual observer unknown");
    // Only this synthetic fixture row is removed inside the rolled-back local
    // test. No provider/delete transport is installed or called.
    await admin("delete from auth.users where id=$1", [A]);
    const absentDeps: CurrentUuidClaimScopeDependencies = { ...deps, readIdentity: async userId => ({ outcome: "absent", userId, observedAt: new Date().toISOString() }) };
    assert.equal(await createCurrentUuidClaimScopeIssuer(absentDeps).issue({ phase: "reconcile", target: f.target, fence: f.fence }), null);
    assert.deepEqual(await rpc("wd_apple_deletion_command", "auth_original", f.target), stored, "stored scope/hash/profile/operation preserved, no retry or repin");
    assert.equal((await admin<{ n: number }>("select count(*)::int n from wd_apple_private.auth_attempts")).rows[0].n, 1);
  }));
});
