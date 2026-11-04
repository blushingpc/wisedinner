import test from "node:test";
import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { createHash, randomUUID, randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync } from "node:zlib";
import type { PGlite } from "@electric-sql/pglite";
import { createCurrentIntegrationRuntime, CURRENT_INTEGRATION_ROUTES, type CurrentIntegrationSource, type CurrentIntegrationSourceIdentity } from "./current-integration-runtime.server.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { createCurrentGuidePolicy, CURRENT_GUIDE_POLICY } from "./generated-current-guide-policy.ts";
import { createCurrentMealCoverage, mealCoverageHash } from "./generated-current-meal-coverage.ts";
import { createCurrentOwnerSubscriptionAccess } from "./current-subscription-scope-bridge.server.ts";
import { admitVerifiedReferenceOwner, type OwnerScopeDependencies } from "./generated-owner-scope.ts";
import { supabaseBillingRepository, type BillingProvider } from "./billing.ts";
import { createCurrentAccountLifecycle, type LifecycleAdmission } from "./current-account-lifecycle.server.ts";
import { createCurrentRetentionCleanup } from "./current-retention-cleanup.server.ts";
import { createCurrentAuthScopePreflight, type ScopeObservationRequest } from "./current-auth-scope.server.ts";
import { createAppleRpcRepository, appleDigest } from "./apple-token-custody.server.ts";
import { createDeletionV2RpcRepository, deletionIntentHash, deletionRecoveryHash } from "./account-deletion-v2.server.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import type { CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";

// No Boolean bypass and no PGlite import/initialization before the current
// Main-sealed exclusive-slot receipt, accepted peer bytes and deadline check.
const root = "C:/Users/borgh/Documents/ChatGPT/wisedinner/reports/website-refresh-20261027/normal-ui-study/native-integration-20261030/backend-repair-round-v3";
const digest = (b: string | Uint8Array) => createHash("sha256").update(b).digest("hex");
type Pin = { file: string; sha256: string };
async function current(p: Pin) { assert.equal(digest(await readFile(p.file)), p.sha256, p.file); }
async function grant() {
  assert.ok(process.env.WD_RUNTIME_SQL_ADMISSION, "fresh Main exclusive SQL receipt required, never skip");
  const g = JSON.parse(await readFile(process.env.WD_RUNTIME_SQL_ADMISSION, "utf8"));
  const bytes = await readFile(join(root, "RUNTIME-ADMISSION-v4.json")), a = JSON.parse(bytes.toString("utf8"));
  assert.equal(g.contract, "wd-runtime-local-sql-admission-v1"); assert.equal(g.manager, "01a10302-a7d9-72f3-8abf-64605cde3a58");
  assert.equal(g.worker, "01a192ec-3719-7373-abfa-1bfb6e2818e3"); assert.equal(g.taskId, "backend-hosted-runtime-wiring-20261031");
  assert.equal(g.exclusiveSlotGranted, true); assert.ok(Date.parse(g.validUntil) > Date.now());
  assert.equal(g.admission.sha256, digest(bytes)); assert.deepEqual(g.acceptedPeers, a.acceptedPeerResults);
  assert.ok(g.acceptedPeers.length >= 5);
  for (const pin of [...a.protectedPeers, ...g.acceptedPeers]) await current(pin);
  return g;
}
const A = "10000000-0000-4000-8000-000000000101", B = "10000000-0000-4000-8000-000000000102";
const host = "https://runtime.synthetic.invalid", target = "https://zpvqxtklvjitofpbddrn.supabase.co";
const key = (role: string) => "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".synthetic";
const products = ["com.wisedinner.app.protein.weekly", "com.wisedinner.app.protein.yearly"];
const deletionPolicy = { approved: true as const, version: "synthetic-runtime-only", preparedSeconds: 60, pendingSeconds: 600, recoverySeconds: 600, receiptSeconds: 3600, retainedEvidence: ["deletion_receipt", "prepared_retirement_receipt", "apple_credential_recovery", "billing_evidence"] };
const custodyPolicy = { approved: true as const, version: "synthetic-runtime-only", credentialSeconds: 60, recoverySeconds: 120, evidenceSeconds: 600, retainedEvidence: ["apple_credential_recovery", "apple_credential_expiry_erase"] };

// Explicitly synthetic Auth/provider transport; repository and evaluator results
// below are the actual accepted implementations and actual PostgreSQL commands.
test("Main-admitted actual runtime consumer composition, SQL fences and original recovery", async t => {
  const admission = await grant(), dir = await mkdtemp(join(tmpdir(), "wd-runtime-consumer-"));
  const { PGlite: Database } = await import("@electric-sql/pglite");
  let db: PGlite = await Database.create(dir), clock = Date.now(), fetches = 0, deletes = 0, commits = 0;
  let flip: (() => Promise<void>) | undefined, failProvider = false, lostCommit = false, changedOwner: string | null = null;
  let originalRequest: Request | undefined;
  let queue: Promise<unknown> = Promise.resolve();
  const serial = <T>(f: () => Promise<T>) => { const p = queue.then(f); queue = p.catch(() => {}); return p; };
  const admin = <T>(f: (d: PGlite) => Promise<T>) => serial(async () => { await db.exec("reset role"); return f(db); });
  const role = async (name: string, owner: string) => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ sub: owner, role: name, is_anonymous: false, amr: [{ method: "oauth", timestamp: Math.floor(Date.now() / 1000) }] })]); await db.exec("set role " + name); };
  const allowed = new Set(["wd_billing_command", "wd_deletion_v2_account_command", "wd_deletion_v2_worker_command", "wd_apple_custody_command", "wd_apple_deletion_command", "wd_apple_revocation_command", "wd_current_retention_inventory_command", "wd_current_credential_expiry_command", "wd_current_prepared_custody_command"]);
  const rpc = (name: string, action: string, body: unknown, owner = A, as = "service_role") => serial(async () => {
    assert.ok(allowed.has(name)); assert.ok(["service_role", "authenticated", "anon"].includes(as)); await role(as, owner);
    return (await db.query<{ r: Record<string, unknown> }>(`select public.${name}($1,$2::jsonb) r`, [action, JSON.stringify(body)])).rows[0].r;
  });
  const transport: typeof fetch = async (url, init) => {
    const u = new URL(String(url)); assert.equal(u.origin, target);
    if (u.pathname.startsWith("/auth/")) { if (init?.method === "DELETE") { deletes++; throw Error("real DELETE forbidden by fixture"); } const id = u.pathname.split("/").at(-1)!; assert.ok(id === A || id === B); return Response.json({ id, is_anonymous: false, created_at: "2026-10-01T00:00:00Z", identities: [{ identity_id: id, user_id: id, provider: "email", id: "synthetic-" + id, created_at: "2026-10-01T00:00:00Z" }] }); }
    const v = JSON.parse(String(init?.body)), token = new Headers(init?.headers).get("authorization") ?? "";
    const owner = token.endsWith(B) ? B : A;
    return Response.json(await rpc(u.pathname.split("/").at(-1)!, v.p_action, v.p_body, owner, token.includes("synthetic-owner-") ? "authenticated" : "service_role"));
  };
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;
      create table auth.users(id uuid primary key);create table auth.identities(id uuid primary key,user_id uuid references auth.users(id) on delete cascade);grant select on auth.users,auth.identities to service_role;`);
    for (const name of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql", "0021_wd_deletion_lifecycle_v2.sql", "0022_wd_apple_token_custody.sql", "0023_wd_deletion_prepared_retirement.sql", "0024_wd_current_auth_scope.sql", "0025_wd_current_retention_inventory.sql"]) await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    await db.query("insert into wd_accounts(user_id)values($1),($2)", [A, B]); await db.query("insert into auth.users values($1),($2)", [A, B]);
    await db.exec("create schema storage;grant usage on schema storage to service_role;create table storage.buckets(id text primary key,owner uuid,owner_id text);create table storage.objects(id uuid primary key,name text,owner uuid,owner_id text,user_metadata jsonb);create table storage.s3_multipart_uploads(id text primary key,key text,owner_id text,user_metadata jsonb);create table storage.s3_multipart_uploads_parts(id uuid primary key,key text,owner_id text);grant select on all tables in schema storage to service_role;create table public.ce_runtime_sentinel(id int);insert into ce_runtime_sentinel values(17)");
    const identity: OwnerScopeDependencies = {
      async verify(r) { assert.equal(r, originalRequest, "bridge reuses SAME original Request"); const id = changedOwner ?? r.headers.get("authorization")?.slice(7); assert.ok(id === A || id === B); return { id, token: "synthetic-owner-" + id, authenticatedAt: 1, providers: ["email"] }; },
      async readAccount(a) { return admin(async d => { const row = (await d.query<{ userId: string; state: "active"; revision: number }>('select user_id::text "userId",state,revision from wd_accounts where user_id=$1', [a.id])).rows[0]; return row; }); },
    };
    const driver: CurrentOwnerRpcDriver = { call: i => serial(async () => {
      await role("service_role", i.ownerId);
      const r = (await db.query<{ r: unknown }>("select wd_current_plan_rpc($1::uuid,$2::int,$3,$4,$5::jsonb,$6::bigint) r", [i.ownerId, i.accountRevision, i.scopeKey, i.action, JSON.stringify(i.body), i.accessExpiresAt ?? null])).rows[0].r;
      if (i.action === "commit") { t.diagnostic(JSON.stringify({ sqlCommit: r && typeof r === "object" ? { outcome: (r as Record<string, unknown>).outcome, error: (r as Record<string, unknown>).error } : r, receipt: (i.body.operation as { receipt: { outcome: string; result?: unknown } }).receipt.outcome, rejection: (i.body.operation as { receipt: { result?: unknown } }).receipt.result })); commits++; if (lostCommit) { lostCommit = false; throw Error("lost actual SQL commit ACK"); } }
      return r;
    }) };
    const repository = supabaseBillingRepository(target, key("service_role"), transport);
    const provider: BillingProvider = { async fetch(bound) {
      fetches++; if (flip) { const action = flip; flip = undefined; await action(); } if (failProvider) throw Error("synthetic provider unavailable");
      return { request_date_ms: clock, subscriber: { original_app_user_id: bound, entitlements: { wisedinner_pro: { product_identifier: products[0], expires_date: new Date(clock + 3600000).toISOString() } }, subscriptions: { [products[0]]: { store: "app_store", is_sandbox: true, ownership_type: "PURCHASED", period_type: "normal", purchase_date: new Date(clock - 10000).toISOString(), expires_date: new Date(clock + 3600000).toISOString(), store_transaction_id: "synthetic-runtime-" + bound } } } };
    } };
    const subscription = { environment: "SANDBOX" as const, repository, provider, config: { environment: "SANDBOX" as const, entitlement: "wisedinner_pro", products } };
    const capsule = JSON.parse(await readFile(new URL("./generated-current-source-capsule-v4.json", import.meta.url), "utf8"));
    const sourceText = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString("utf8");
    const guide = createCurrentGuidePolicy(sourceText, capsule.configuration), binder = createReviewedCurrentSourceBinder(capsule, () => clock), packet = binder.reviewedReferenceData!;
    const source: CurrentIntegrationSource = { ...binder, reviewedReferenceData: packet, guidePolicy: { version: CURRENT_GUIDE_POLICY, sha256: guide.sha256 } };
    const expected: CurrentIntegrationSourceIdentity = { sourceSha256: binder.sourceSha256, sourcePolicyBasisSha256: binder.sourcePolicyBasisSha256, configurationSha256: packet.configurationSha256, reviewedDataSha256: packet.reviewedDataSha256, evidenceManifestSha256: packet.evidenceManifestSha256, window: binder.referenceWindow, guidePolicy: source.guidePolicy };
    const schema = await admin(async d => (await d.query<{ r: { schemaSha256: string; eraserSha256: string } }>("select wd_apple_private.current_retention_schema() r")).rows[0].r);
    const cleanup = createCurrentRetentionCleanup({ ...schema, deletionPolicy, custodyPolicy, maxRecords: 4, freshnessMs: 30000, clockSkewMs: 30000,
      repository: { command: (action, body) => rpc("wd_current_retention_inventory_command", action, body) }, eraseExpired: body => rpc("wd_current_credential_expiry_command", "erase_expired", body),
      readAdmission: async i => ({ outcome: "admitted", registryId: "wd-apple-custody-v1", ...schema, policySha256: i.policySha256, custodyPolicySha256: i.custodyPolicySha256, observedAt: Date.now(), validUntil: Date.now() + 30000 }) });
    // No host quiescence/admission is forged. This actual default-off scope
    // producer must hold; raw SQL independently remains fence:null.
    const preflight = createCurrentAuthScopePreflight({ enabled: false });
    const lifecycleAdmission: LifecycleAdmission = { enabled: true, origin: target, serverCredential: key("service_role"), verify: r => identity.verify(r), request: transport,
      applePolicy: custodyPolicy, deletionPolicy, cleanup, preflight, keyVersion: "synthetic", keyring: new Map([["synthetic", randomBytes(32)]]),
      client: { clientId: "synthetic.native", keys: async () => ({ keys: [] }), exchange: async () => { throw Error("no Apple exchange"); }, revoke: async () => { throw Error("no Apple revoke"); } },
      repositories: { apple: createAppleRpcRepository(target, key("service_role"), transport), deletion: createDeletionV2RpcRepository(target, key("service_role"), transport) } };
    const deps = { hostOrigin: host, supabase: { origin: target, publicAuthKey: key("anon"), serverCredential: key("service_role") }, owner: { identity, rpc: driver }, subscription, source: { expected, create: () => source }, now: () => clock,
      flags: { currentSession: true, currentRead: true, deletion: true, appleCredential: true }, lifecycle: { admission: { ...lifecycleAdmission, applePolicy: custodyPolicy, deletionPolicy }, create: () => createCurrentAccountLifecycle(lifecycleAdmission) } };
    const runtime = createCurrentIntegrationRuntime(deps);
    const envelope = (operation: string, payload: unknown, basis: string | null = binder.sourcePolicyBasisSha256) => { const intent = { contract: "wd-joined-session-proposal-v2", operation, operationId: randomUUID(), sourceSha256: binder.sourceSha256, expectedSourcePolicyBasisSha256: basis, payload }; return { ...intent, intentSha256: referenceOperationDigest(intent) }; };
    const route = async (which: keyof typeof CURRENT_INTEGRATION_ROUTES, body: unknown, owner = A, active = runtime, headers: Record<string, string> = {}) => {
      const request = new Request(host + CURRENT_INTEGRATION_ROUTES[which], { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + owner, ...headers }, body: JSON.stringify(body) });
      originalRequest = request; const response = await active.routes[which](request); return { status: response.status, headers: response.headers, body: await response.json() };
    };
    const send = (operation: string, payload: unknown, owner = A) => route("currentSession", envelope(operation, payload), owner);
    const rows = sourceText.trimEnd().split("\n").map(l => JSON.parse(l));
    const recipes = ["WD-R6-B-0129", "WD-R6-M-431627cc2c407495", "WD-R6-M-229a763292298d2a"].map(id => rows.find(r => r.id === id));
    const request = { people: [{ personId: "synthetic-person", profileRevision: 1, label: "Synthetic", proteinGoal: { kind: "known", gramsPerDay: "150", coverage: "full-day" }, exclusions: { kind: "none" } }], selectedDays: ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"], slots: ["breakfast", "lunch", "dinner"], asOfDate: new Date(clock).toISOString().slice(0, 10), region: "South", storeIds: ["reference-store-context-only"], budgetCents: 15000, pantry: [], equipment: [...new Set(recipes.flatMap(r => r.recipe.equipment))] };
    const assignments = request.selectedDays.flatMap(date => recipes.map((r, i) => ({ assignmentId: date + i, personId: request.people[0].personId, profileRevision: 1, date, slot: request.slots[i], recipeId: r.id, recipeSha256: r.recipe_sha256, sourceServings: { numerator: i === 2 ? "1" : "2", denominator: "1" } })));
    const weekId = randomUUID(), good = { expectedRevision: 0, weekId, request, assignments, pantryEntries: [] };
    let original: ReturnType<typeof envelope>;
    await t.test("currentV4/baseline7 truth and actual150g150USD seven-day evaluation", async () => {
      const coverage = createCurrentMealCoverage(sourceText, { configuration: capsule.configuration, sourcePin: capsule.configuration.sourcePin, configurationSha256: mealCoverageHash(capsule.configuration), asOfDate: "2026-10-30", region: "South", storeIds: request.storeIds });
      assert.equal(coverage.outcome, "ready"); if (coverage.outcome !== "ready") throw Error("coverage"); assert.equal(coverage.rows.length, 1300); assert.equal(coverage.rows.filter(r => r.price.outcome === "covered").length, 7);
      const cap = await send("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1" }); assert.equal(cap.status, 200); assert.equal(cap.headers.get("X-WiseDinner-Guide-Policy-Sha256"), guide.sha256); assert.equal(cap.body.result.reviewedReferenceData.reviewRevision, 4); assert.equal(fetches, 0);
      const evaluated = await send("evaluateJoined", { assignments, request }); assert.equal(evaluated.status, 200); assert.equal(evaluated.body.result.outcome, "week-proposal");
      assert.equal(request.budgetCents, 15000); assert.equal(request.people[0].proteinGoal.gramsPerDay, "150"); assert.equal(request.selectedDays.length, 7);
    });
    await t.test("actual route billingSQL and currentSQL save/lost ACK/disk reopen/owner A-B-A recovery", async () => {
      original = envelope("installCurrent", good); lostCommit = true;
      const unknown = await route("currentSession", original); assert.equal(unknown.status, 202, JSON.stringify(unknown.body)); assert.equal(unknown.body.result.outcome, "unknown"); assert.equal(commits, 1); assert.ok(fetches >= 2);
      await queue; await db.close(); db = await Database.create(dir);
      const status = { contract: "wd-current-owner-read-v1", operation: "operationStatus", requestId: randomUUID(), targetOperationId: original.operationId, targetIntentSha256: original.intentSha256, originalEnvelope: original };
      const recovered = await route("currentRead", status); assert.equal(recovered.body.result.saved, true, JSON.stringify(recovered.body)); assert.equal(recovered.body.result.retryAuthorized, false);
      const wrong = await route("currentRead", status, B); assert.equal(wrong.body.result.disposition, "unresolved"); assert.equal((await route("currentRead", status)).body.result.saved, true);
      const repeat = await route("currentSession", original); assert.equal(repeat.body.result.saved, true); assert.equal(commits, 1);
      const read = await send("readCurrent", {}); assert.equal(read.body.result.state.current.view.personDays.length, 7);
    });
    await t.test("actual recipe/grocery whole-pack stock, bought checkbox and no-extra-SKU replacement journey", async () => {
      const read = await send("readCurrent", {}), state = read.body.result.state, view = state.current.view;
      assert.equal(view.outcome, "saved-week"); assert.equal(view.meals.length, 21); assert.equal(view.groceries.outcome, "groceries");
      for (const meal of view.meals) {
        const sourceRow = recipes.find(r => r.id === meal.recipeId); assert.deepEqual(meal.originalBatchRecipe, sourceRow.recipe);
        assert.equal(Object.hasOwn(meal, "ingredientPrices"), false);
      }
      for (const day of view.personDays) { const q = day.nutrition.totals.protein_g.min; assert.ok(BigInt(q.numerator) >= BigInt(150) * BigInt(q.denominator)); }
      assert.ok(view.groceries.estimatedTotalCents.max <= 15000);
      const items = view.groceries.groups.flatMap((g: { items: unknown[] }) => g.items); assert.ok(items.length > 0);
      const item = items[0];
      const checked = await send("shoppingCheck", { expectedRevision: state.revision, weekId, itemKey: item.itemKey, fingerprint: item.fingerprint, checked: true });
      assert.equal(checked.body.result.saved, true); const checkedView = checked.body.result.state.current.view;
      const checkedRows = checkedView.groceries.groups.flatMap((g: { items: unknown[] }) => g.items);
      assert.equal(checkedRows.find((r: { itemKey: string }) => r.itemKey === item.itemKey).checked, true);
      const a = assignments[0], intent = { assignmentId: a.assignmentId, personId: a.personId, expectedRecipeSha256: a.recipeSha256, replacementRecipeId: a.recipeId, sourceServings: a.sourceServings };
      const preview = await send("previewReplacement", { request, assignments, intent }); assert.equal(preview.body.result.outcome, "replacement-preview");
      const pr = preview.body.result;
      const replaced = await send("saveReplacement", { expectedRevision: checked.body.result.state.revision, weekId, intent, expectedPreviewSha256: pr.previewSha256, expectedRequestSha256: pr.requestSha256, expectedAssignmentsSha256: pr.baseAssignmentsSha256 });
      assert.equal(replaced.body.result.saved, true, JSON.stringify({ status: replaced.status, result: replaced.body.result.code, outcome: replaced.body.result.outcome }));
      const afterRows = replaced.body.result.state.current.view.groceries.groups.flatMap((g: { items: unknown[] }) => g.items);
      assert.deepEqual(afterRows, checkedRows, "same reserved packs and bought flags; no added grocery SKU");
      const invalidGuide = assignments.map((x, i) => i ? x : { ...x, sourceServings: { numerator: "1", denominator: "4" } });
      const guideHeld = await send("installCurrent", { ...good, weekId: randomUUID(), expectedRevision: replaced.body.result.state.revision, assignments: invalidGuide });
      assert.equal(guideHeld.body.result.outcome, "not_applied"); assert.equal(guideHeld.body.result.result.reasons[0].code, "source_serving_guide_required");
      const missingTools = await send("evaluateJoined", { assignments, request: { ...request, equipment: [] } }); assert.notEqual(missingTools.body.result.outcome, "week-proposal");
      const unsupported = await send("evaluateJoined", { assignments, request: { ...request, unsupportedConstraint: true } }); assert.notEqual(unsupported.body.result.outcome, "week-proposal");
      const capacity = await route("currentSession", envelope("capabilities", {}), A, runtime, { "content-length": String(8 * 1024 * 1024 + 1) }); assert.equal(capacity.status, 413);
    });
    await t.test("exact Request bridge provenance/revision/foreign storage and provider unknown cannot grant", async () => {
      const before = commits;
      for (const mode of ["owner", "revision", "provider"] as const) {
        if (mode === "owner") flip = async () => { changedOwner = B; };
        if (mode === "revision") flip = async () => { await admin(d => d.query("update wd_accounts set revision=revision+1 where user_id=$1", [A])); };
        if (mode === "provider") failProvider = true;
        try { const r = await send("saveCurrent", { ...good, expectedRevision: 1 }); assert.equal(r.status, 403, mode + ":" + JSON.stringify(r.body)); } finally { changedOwner = null; failProvider = false; }
      }
      assert.equal(commits, before);
      const req = new Request(host); originalRequest = req; const owner = await admitVerifiedReferenceOwner(req, { ...identity, verify: async r => { assert.equal(r, req); return { id: A, token: "synthetic-owner-" + A, authenticatedAt: 1, providers: ["email"] }; } }); assert.equal(owner.outcome, "ready");
      if (owner.outcome !== "ready") throw Error("owner");
      const bridge = createCurrentOwnerSubscriptionAccess(req, { enabled: true, identity, repository, provider, config: subscription.config, now: () => clock }), count = fetches;
      for (const forged of [{ ...owner }, { ...owner, storageKey: "forged" }, { ...owner, ownerId: B }, { ...owner, accountRevision: 2 }]) assert.equal((await bridge(forged)).allowed, false);
      assert.equal(fetches, count);
    });
    await t.test("actual lifecycle with actual retention admits synthetic prepare; missing keys/policy/fence holds and original status survives", async () => {
      assert.equal((await cleanup.verify({ policySha256: appleDigest(deletionPolicy), now: Date.now() })).outcome, "verified");
      const revision = (await admin(d => d.query<{ revision: number }>("select revision from wd_accounts where user_id=$1", [A]))).rows[0].revision;
      const operationId = randomUUID(), capability = randomBytes(32).toString("base64url"), intentSha256 = deletionIntentHash(A, operationId, revision, deletionRecoveryHash(operationId, capability), appleDigest(deletionPolicy));
      const prepared = await route("deletion", { contract: "wd-account-deletion-v2", operation: "prepare", operationId, expectedAccountRevision: revision }, A, runtime, { "x-wd-deletion-recovery": capability, "x-wd-deletion-intent-sha256": intentSha256 }); assert.equal(prepared.status, 200, JSON.stringify(prepared.body));
      const missing = createCurrentIntegrationRuntime({ ...deps, source: undefined, subscription: undefined, lifecycle: { admission: { ...lifecycleAdmission, keyring: new Map(), applePolicy: undefined, deletionPolicy: undefined }, create: () => createCurrentAccountLifecycle({ ...lifecycleAdmission, keyring: new Map(), applePolicy: undefined, deletionPolicy: undefined }) } });
      const statusBody = { contract: "wd-account-deletion-v2", operation: "status", operationId, intentSha256 };
      const recovered = await route("deletion", statusBody, A, missing, { authorization: "Deletion-Recovery " + capability }); assert.equal(recovered.status, 200); assert.equal(recovered.body.result.operationId, operationId); assert.equal(recovered.body.result.intentSha256, intentSha256); assert.equal(recovered.body.result.intentState, "prepared"); assert.equal(recovered.body.result.nextAction, "confirm_with_recent_auth");
      const denied = await route("deletion", { contract: "wd-account-deletion-v2", operation: "prepare", operationId: randomUUID(), expectedAccountRevision: 1 }, A, missing, { "x-wd-deletion-recovery": randomBytes(32).toString("base64url") }); assert.equal(denied.status, 503);
      assert.deepEqual(await preflight({} as Parameters<typeof preflight>[0]), { outcome: "held" }); assert.equal(deletes, 0);
      const h = "a".repeat(64), binding = { userId: A, identityHash: h, authOperationId: randomUUID(), deletionOperationId: operationId, intentSha256, workOwner: randomUUID(), workAttempt: 1, leaseUntil: new Date(Date.now() + 60000).toISOString() }; let observations = 0;
      const actualObserver = async (input: ScopeObservationRequest) => serial(async () => { observations++; await role("service_role", A); return (await db.query<{ r: unknown }>("select wd_current_auth_scope_observe($1::jsonb) r", [JSON.stringify(input)])).rows[0].r; });
      const actualPreflight = createCurrentAuthScopePreflight({ enabled: true, admission: { authorizationId: randomUUID(), target: binding, deletionPolicy, custodyPolicy, accountRevision: revision, expectedAuthGraphSha256: h, expectedCatalogSha256: h, expectedEngineSha256: h, expiresAt: binding.leaseUntil, maxObservationAgeMs: 8000, retained: {} }, observe: actualObserver });
      assert.deepEqual(await actualPreflight(binding), { outcome: "held" }); assert.equal(observations, 1, "actual accepted SQL observer is invoked, never fabricated AuthScopeProof");
      const observe = await serial(async () => { await role("service_role", A); return (await db.query<{ r: unknown }>("select wd_current_auth_scope_observe($1::jsonb) r", [JSON.stringify({})])).rows[0].r; }); assert.deepEqual(observe, { outcome: "held" });
    });
    await t.test("expired current source blocks NEW evaluate/save/replacement; independent original read persists", async () => {
      const before = clock; clock = Date.parse("2026-11-06T00:00:00Z");
      try {
        const evaluated = await send("evaluateJoined", { assignments, request }); assert.equal(evaluated.body.result?.code, "reference_snapshot_expired");
        const a = assignments[0]; const replacement = await send("previewReplacement", { request, assignments, intent: { assignmentId: a.assignmentId, personId: a.personId, expectedRecipeSha256: a.recipeSha256, replacementRecipeId: a.recipeId, sourceServings: a.sourceServings } }); assert.equal(replacement.body.result.code, "reference_snapshot_expired");
        const mutation = await send("installCurrent", { ...good, weekId: randomUUID(), expectedRevision: 1 }); assert.equal(mutation.status, 409); assert.equal(mutation.body.result.code, "reference_snapshot_expired");
        const read = await route("currentRead", { contract: "wd-current-owner-read-v1", operation: "operationStatus", requestId: randomUUID(), targetOperationId: original.operationId, targetIntentSha256: original.intentSha256, originalEnvelope: original }); assert.equal(read.body.result.saved, true); assert.equal(read.body.result.retryAuthorized, false);
      } finally { clock = before; }
    });
    await t.test("SQL private RLS and foreign-owner/ce sentinel preservation", async () => {
      await serial(async () => { await role("authenticated", A); await assert.rejects(db.query("select * from wd_current_private.states"), /permission denied/); });
      await admin(async d => { assert.deepEqual((await d.query("select * from ce_runtime_sentinel")).rows, [{ id: 17 }]); assert.equal((await d.query("select * from wd_accounts where user_id=$1", [B])).rows.length, 1); });
      assert.equal(deletes, 0); assert.equal(runtime.inspect().verification.provider, false); assert.ok(Date.parse(admission.validUntil) > Date.now());
    });
  } finally { await queue; await db.close(); await rm(dir, { recursive: true, force: true }); }
});
