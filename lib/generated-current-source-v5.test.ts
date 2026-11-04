import test from "node:test";
import { POST as currentSessionPOST } from "../app/api/v1/current/session/route.ts";
import { withCurrentIntegrationHostResolver } from "./current-integration-host.server.ts";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { randomUUID } from "node:crypto";
import type { PGlite } from "@electric-sql/pglite";
import { createReviewedCurrentSourceBinder, createReviewedCurrentReferenceArchive } from "./generated-current-reviewed-source.ts";
import { createCurrentIntegrationReferenceV5, CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY as expected } from "./current-integration-reference-v5.server.ts";
import { createCurrentIntegrationRuntime, CURRENT_INTEGRATION_ROUTES, type CurrentIntegrationSource } from "./current-integration-runtime.server.ts";
import { referenceAdmissionFor, referenceConfigurationDigest } from "./generated-reviewed-reference-data.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { syntheticV2 } from "./generated-plan-v2.test-support.ts";
import { supabaseBillingRepository, type BillingProvider } from "./billing.ts";
import { AccountError } from "./account.ts";
import type { OwnerScopeDependencies } from "./generated-owner-scope.ts";
import type { CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";
const read = (name: string) => JSON.parse(readFileSync(new URL(name, import.meta.url), "utf8"));
const capsule = read("./generated-current-source-capsule-v5.json");
let utc = Date.parse("2026-11-01T12:00:00Z"), cached: CurrentIntegrationSource | undefined;
const v5 = () => cached ??= createCurrentIntegrationReferenceV5(() => utc);
const HOST = "https://v5.synthetic.invalid", A = "10000000-0000-4000-8000-000000000101", B = "10000000-0000-4000-8000-000000000102";
const key = (role: string) => "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".synthetic";
const supabase = { origin: "https://zpvqxtklvjitofpbddrn.supabase.co", publicAuthKey: key("anon"), serverCredential: key("service_role") };

test("exact factual V5 handoff retains original source, final tuple/window and configured guide", () => {
  const bound = v5(), p = bound.reviewedReferenceData;
  assert.equal(p.reviewRevision, 5); assert.equal(p.sourcePin.recordCount, 1300);
  assert.equal(p.reviewedDataSha256, expected.reviewedDataSha256);
  assert.equal(p.configurationSha256, "cb9d5965ac9c81a9c6a28dee3aaf598b556d2fda5ef956609a32d9afdebbe027");
  assert.deepEqual(p.configuration, capsule.configuration); assert.deepEqual(p.window, expected.window);
  assert.equal(bound.guidePolicy.sha256, expected.guidePolicy.sha256);
  assert.equal(bound.referenceWindow.lastDay, "2026-11-30");
  assert.equal(capsule.configuration.referencePrices.facts.length, 54);
  const corn = capsule.configuration.referencePrices.facts.find((f: { skuId: string }) => f.skuId === "proposal-v105-r3-corn");
  assert.deepEqual(corn.packPriceCents, { min: 139, max: 139 });
  assert.equal(corn.sourceBasis.observedOn, null); assert.equal(corn.sourceBasis.capturedOn, "2026-11-01");
});

test("closed binder rejects unknown/higher/foreign/mutated capsule, source, configuration and labels", () => {
  const changes = [
    (p: typeof capsule) => { p.schema = "wd-current-server-source-capsule-v6"; },
    (p: typeof capsule) => { p.reviewRevision = 6; },
    (p: typeof capsule) => { p.sourceGzipBase64 = p.sourceGzipBase64.slice(1); },
    (p: typeof capsule) => { p.configuration.referencePrices.facts[0].packPriceCents.max++; },
    (p: typeof capsule) => { p.configuration.sourcePin.sha256 = "f".repeat(64); },
    (p: typeof capsule) => { p.labels[0].displayName += " changed"; },
    (p: typeof capsule) => { p.allowed = true; },
  ];
  for (const change of changes) { const bad = structuredClone(capsule); change(bad); assert.throws(() => createReviewedCurrentSourceBinder(bad)); }
  for (const bad of [null, [], {}, true]) assert.throws(() => createReviewedCurrentSourceBinder(bad));
});

test("original V2/V4 remain byte-bound and V4 is retained in exact reviewed archive", () => {
  const old2 = createReviewedCurrentSourceBinder(read("./generated-current-source-capsule-v2.json"), () => Date.parse("2026-10-30T12:00:00Z"));
  assert.equal(old2.reviewedReferenceData, undefined); assert.equal(old2.referenceWindow.lastDay, "2026-10-30");
  const old4 = createReviewedCurrentSourceBinder(read("./generated-current-source-capsule-v4.json"), () => Date.parse("2026-10-31T12:00:00Z"));
  assert.equal(old4.reviewedReferenceData!.reviewRevision, 4);
  assert.equal(old4.sourcePolicyBasisSha256, "6416f956c50b380e4cbd11d223c9095642487cf028142e58aaff80419e5628f4");
  const source = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString("utf8");
  const p4 = old4.reviewedReferenceData!, p5 = v5().reviewedReferenceData;
  const archive = createReviewedCurrentReferenceArchive(source, [p4, p5], [referenceAdmissionFor(p4), referenceAdmissionFor(p5)]);
  assert.equal(archive.current().reviewRevision, 5);
  assert.deepEqual(archive.getOriginal({ sourceSha256: p4.sourcePin.sha256, sourcePolicyBasisSha256: p4.sourcePolicyBasis.basisSha256, reviewRevision: 4 }), { outcome: "ready", packet: p4 });
  assert.equal(archive.getOriginal({ sourceSha256: expected.sourceSha256, sourcePolicyBasisSha256: "f".repeat(64) }).outcome, "held");
});

test("actual V5 runtime capabilities, SQL owner read/commit, current/future weeks and original recovery", async t => {
  const receiptPath = process.env.WD_LOCAL_BACKEND_TEST_ADMISSION; assert.ok(receiptPath);
  const slot = JSON.parse(await readFile(receiptPath, "utf8"));
  assert.equal(slot.contract, "wd-local-source-test-slot-v1"); assert.equal(slot.taskId, "backend-final-reference-v125");
  assert.equal(slot.workerThreadId, "01a192f8-e59a-71a2-9149-1158d9e93c50"); assert.ok(Date.parse(slot.validUntil) > Date.now());
  assert.ok(slot.argv.includes("lib/generated-current-source-v5.test.ts"));
  const { PGlite: Database } = await import("@electric-sql/pglite"); const db: PGlite = await Database.create();
  let ownerReads = 0, rpcReads = 0, commits = 0, creates = 0, loseAck = false, crossOwner = false, clockFault = false, faultAfterCommit = false;
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
    for (const name of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql"]) await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    await db.query("insert into wd_accounts(user_id)values($1),($2)", [A, B]);
    async function role() { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "service_role" })]); await db.exec("set role service_role"); }
    const identity: OwnerScopeDependencies = {
      async verify(request) { const id = request.headers.get("authorization")?.slice(7); if (id !== A && id !== B) throw new AccountError(401, "owner_session_invalid"); return { id, token: "synthetic-owner-" + id, authenticatedAt: 1, providers: ["email"] }; },
      async readAccount(account) { ownerReads++; await db.exec("reset role"); return (await db.query<{ userId: string; state: "active"; revision: number }>('select user_id::text "userId",state,revision from wd_accounts where user_id=$1', [crossOwner ? B : account.id])).rows[0]; },
    };
    const rpc: CurrentOwnerRpcDriver = { async call(i) {
      await role(); if (i.action === "commit") commits++; else rpcReads++;
      const result = (await db.query<{ r: unknown }>("select wd_current_plan_rpc($1::uuid,$2::int,$3,$4,$5::jsonb,$6::bigint)r", [i.ownerId, i.accountRevision, i.scopeKey, i.action, JSON.stringify(i.body), i.accessExpiresAt])).rows[0].r;
      if (i.action === "commit" && faultAfterCommit) { faultAfterCommit = false; clockFault = true; }
      if (i.action === "commit" && loseAck) { loseAck = false; throw Error("synthetic lost ACK after actual SQL commit"); }
      return result;
    } };
    // Explicitly fake SANDBOX provider data, actual maintained billing repository.
    const transport: typeof fetch = async (_url, init) => { const b = JSON.parse(String(init?.body)); await role(); return Response.json((await db.query<{ r: unknown }>("select wd_billing_command($1,$2::jsonb)r", [b.p_action, JSON.stringify(b.p_body)])).rows[0].r); };
    const products = ["com.wisedinner.app.protein.weekly", "com.wisedinner.app.protein.yearly"];
    const provider: BillingProvider = { async fetch(id) { return { request_date_ms: utc, subscriber: { original_app_user_id: id, entitlements: { wisedinner_pro: { product_identifier: products[0], expires_date: new Date(utc + 3600000).toISOString() } }, subscriptions: { [products[0]]: { store: "app_store", is_sandbox: true, ownership_type: "PURCHASED", period_type: "normal", purchase_date: new Date(utc - 10000).toISOString(), expires_date: new Date(utc + 3600000).toISOString(), store_transaction_id: "synthetic-v5-" + id } } } }; } };
    const subscription = { environment: "SANDBOX" as const, repository: supabaseBillingRepository(supabase.origin, supabase.serverCredential, transport), provider, config: { environment: "SANDBOX" as const, entitlement: "wisedinner_pro", products } };
    const now = () => { if (clockFault) throw Error("synthetic clock unavailable during post-commit headers"); return utc; };
    const dependencies = () => ({ hostOrigin: HOST, supabase, flags: { currentSession: true, currentRead: true }, owner: { identity, rpc }, subscription, now,
      source: { expected, create() { assert.ok(ownerReads > 0); creates++; const source = v5(); return source; } } });
    const runtime = () => createCurrentIntegrationRuntime(dependencies());
    let active = runtime(); assert.equal(creates, 0);
    const envelope = (operation: string, payload: unknown, basis: string | null = expected.sourcePolicyBasisSha256) => { const body = { contract: "wd-joined-session-proposal-v2", operation, operationId: randomUUID(), sourceSha256: expected.sourceSha256, expectedSourcePolicyBasisSha256: basis, payload }; return { ...body, intentSha256: referenceOperationDigest(body) }; };
    async function send(value: ReturnType<typeof envelope>, owner = A) { const response = await active.routes.currentSession(new Request(HOST + CURRENT_INTEGRATION_ROUTES.currentSession, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + owner }, body: JSON.stringify(value) })); return { response, body: await response.json() }; }
    await t.test("only opted authenticated owner after real SQL read receives exact V5 tuple and headers", async () => {
      const legacy = await send(envelope("capabilities", {}, null)); assert.equal(Object.hasOwn(legacy.body.result, "reviewedReferenceData"), false);
      const opted = await send(envelope("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1" }, null));
      assert.deepEqual(opted.body.result.reviewedReferenceData, v5().reviewedReferenceData); assert.ok(ownerReads > 0 && rpcReads > 0); assert.equal(commits, 0);
      assert.equal(opted.response.headers.get("X-WiseDinner-Reference-Through"), "2026-11-30"); assert.equal(opted.response.headers.get("X-WiseDinner-Source"), expected.sourceSha256);
      assert.equal(opted.response.headers.get("X-WiseDinner-Guide-Policy-Sha256"), expected.guidePolicy.sha256); assert.equal(opted.response.headers.get("X-WiseDinner-Clock-Utc"), new Date(utc).toISOString());
      for (const [owner, status] of [["", 401]] as const) assert.equal((await send(envelope("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1" }), owner)).response.status, status);
      crossOwner = true; assert.equal((await send(envelope("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1" }))).response.status, 503); crossOwner = false;
      assert.equal((await send(envelope("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1" }, "f".repeat(64)))).response.status, 409);
      assert.equal((await send(envelope("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1", allowed: true }))).body.result.outcome, "error");
    });
    await t.test("actual existing session POST export returns opted V5 after verified owner/SQL read", async () => {
      const value = envelope("capabilities", { reviewedReferenceData: "wd-reviewed-reference-data-v1" });
      const original = new Request(HOST + CURRENT_INTEGRATION_ROUTES.currentSession, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + A }, body: JSON.stringify(value) });
      const response = await withCurrentIntegrationHostResolver({ resolve: dependencies }, () => currentSessionPOST(original));
      const body = await response.json(); assert.equal(response.status, 200); assert.deepEqual(body.result.reviewedReferenceData, v5().reviewedReferenceData);
      assert.equal(response.headers.get("X-WiseDinner-Guide-Policy-Sha256"), expected.guidePolicy.sha256);
    });
    const base = syntheticV2(), rows = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString("utf8").trimEnd().split("\n").map(l => JSON.parse(l));
    const recipes = ["WD-R6-B-0104", "WD-R6-M-229a763292298d2a", "WD-R6-M-431627cc2c407495"].map(id => rows.find(r => r.id === id));
    const makeWeek = (start: string) => { const request = { ...base.request, people: [{ ...base.request.people[0], proteinGoal: { kind: "known", gramsPerDay: "150", coverage: "full-day" } }], selectedDays: Array.from({ length: 7 }, (_, i) => new Date(Date.parse(start) + i * 86400000).toISOString().slice(0, 10)), slots: ["breakfast", "lunch", "dinner"], asOfDate: "2026-11-01", storeIds: ["reference-store-context-only"], budgetCents: 15000, equipment: [...new Set<string>(recipes.flatMap(r => r.recipe.equipment))], pantry: [] };
      const assignments = request.selectedDays.flatMap(date => recipes.map((r, i) => ({ assignmentId: date + i, personId: request.people[0].personId, profileRevision: request.people[0].profileRevision, date, slot: request.slots[i], recipeId: r.id, recipeSha256: r.recipe_sha256, sourceServings: { numerator: i === 1 ? "1" : "2", denominator: "1" } }))); return { request, assignments }; };
    const current = makeWeek("2026-11-01");
    await t.test("current/future21meal150g150USD uses real maintained evaluator and guide", async () => {
      for (const start of ["2026-11-01", "2026-11-08"]) { const w = makeWeek(start), evaluated = await send(envelope("evaluateJoined", w)); assert.equal(evaluated.body.result.outcome, "week-proposal", JSON.stringify(evaluated.body.result)); assert.equal(w.assignments.length, 21); assert.equal(w.request.budgetCents, 15000); }
    });
    await t.test("actual finite-grid search holds honestly at its declared capacity without changing150g150USD", async () => {
      for (const start of ["2026-11-01", "2026-11-08"]) {
        const w = makeWeek(start), person = w.request.people[0];
        const searchGrid = { recipeIds: recipes.map(r => r.id), portionsByPerson: [{ personId: person.personId, profileRevision: person.profileRevision, sourceServings: [{ numerator: "2", denominator: "1" }] }], maxRecipeUsesPerPerson: 7, maxEvaluations: 16, seed: "actual-v5-source-regression" };
        const planned = await send(envelope("planJoined", { request: w.request, searchGrid }));
        assert.equal(planned.body.result.outcome, "held", JSON.stringify(planned.body.result));
        assert.deepEqual(planned.body.result.reasons, [{ code: "search_limit_reached" }]); assert.equal(planned.body.result.search.evaluations, 16); assert.equal(planned.body.result.search.complete, false);
        assert.equal(w.request.people[0].proteinGoal.gramsPerDay, "150"); assert.equal(w.request.budgetCents, 15000); assert.equal(w.request.selectedDays.length * w.request.slots.length, 21);
      }
    });
    const installed = envelope("installCurrent", { ...current, pantryEntries: [], weekId: randomUUID(), expectedRevision: 0 });
    await t.test("real SQL lost ACK is recovered after session reopen without repeated commit", async () => {
      loseAck = true; const lost = await send(installed); assert.equal(lost.body.result.outcome, "unknown", JSON.stringify(lost.body)); const count = commits;
      active = runtime(); const recovered = await send(envelope("operationStatus", { targetOperationId: installed.operationId }, null)); assert.equal(recovered.body.result.outcome, "committed"); assert.equal(recovered.body.result.receipt.saved, true); assert.equal(commits, count);
      const reopened = await send(envelope("readCurrent", {}, null)); assert.equal(reopened.body.result.state.current.view.meals.length, 21);
      const duplicate = await send(installed); assert.equal(duplicate.body.result.saved, true); assert.equal(commits, count);
    });
    await t.test("post-commit clock header failure preserves actual ACK and bought state", async () => {
      const read = await send(envelope("readCurrent", {}, null)), currentState = read.body.result.state.current;
      const item = currentState.view.groceries.groups[0].items[0]; faultAfterCommit = true;
      const checked = await send(envelope("shoppingCheck", { expectedRevision: 1, weekId: currentState.weekId, itemKey: item.itemKey, fingerprint: item.fingerprint, checked: true }));
      clockFault = false; assert.equal(checked.response.status, 200); assert.equal(checked.body.result.state.revision, 2);
      assert.ok(checked.body.result.state.current.view.groceries.groups.flatMap((g: { items: { checked: boolean }[] }) => g.items).some((i: { checked: boolean }) => i.checked));
    });
    await t.test("selected-day lunch Menu same-cart portion replacement preserves bought and honest empty result", async () => {
      const selected = current.assignments.find(a => a.date === "2026-11-01" && a.slot === "lunch")!;
      const grid = { personId: selected.personId, assignmentId: selected.assignmentId, expectedRecipeSha256: selected.recipeSha256,
        candidates: [{ recipeId: selected.recipeId, sourceServings: { numerator: "2", denominator: "1" } }], maxEvaluations: 1, limit: 1 };
      const found = await send(envelope("findReplacements", { ...current, candidateGrid: grid }));
      assert.equal(found.body.result.outcome, "replacement-alternatives", JSON.stringify(found.body.result)); assert.equal(found.body.result.candidates.length, 1);
      const candidate = found.body.result.candidates[0], preview = candidate.preview;
      assert.equal(candidate.recipeId, selected.recipeId); assert.deepEqual(preview.addedBuyIds, []); assert.deepEqual(preview.removedBuyIds, []); assert.equal(preview.itemCountDelta, 0);
      assert.ok(preview.before.groups.length);
      const cart = (v: { groups: { items: Record<string, unknown>[] }[] }) => v.groups.flatMap(g => g.items.map(({ skuId, unit, packCount, packQuantity, purchasedQuantity }) => ({ skuId, unit, packCount, packQuantity, purchasedQuantity })));
      assert.equal(referenceConfigurationDigest(cart(preview.before)), referenceConfigurationDigest(cart(preview.after)));
      assert.deepEqual(preview.before.estimatedTotalCents, preview.after.estimatedTotalCents); assert.ok(preview.after.estimatedTotalCents.max <= 15000);
      const original = (await send(envelope("readCurrent", {}, null))).body.result.state.current;
      const intent = { personId: selected.personId, assignmentId: selected.assignmentId, expectedRecipeSha256: selected.recipeSha256, replacementRecipeId: candidate.recipeId, sourceServings: candidate.sourceServings };
      const saved = await send(envelope("saveReplacement", { expectedRevision: 2, weekId: original.weekId, intent, expectedPreviewSha256: preview.previewSha256, expectedRequestSha256: preview.requestSha256, expectedAssignmentsSha256: preview.baseAssignmentsSha256 }));
      assert.equal(saved.body.result.state.revision, 3, JSON.stringify(saved.body.result));
      assert.ok(saved.body.result.state.current.view.groceries.groups.flatMap((g: { items: { checked: boolean }[] }) => g.items).some((i: { checked: boolean }) => i.checked));
      const empty = await send(envelope("findReplacements", { ...current, candidateGrid: { ...grid, candidates: [{ recipeId: selected.recipeId, sourceServings: selected.sourceServings }] } }));
      assert.equal(empty.body.result.outcome, "replacement-alternatives"); assert.deepEqual(empty.body.result.candidates, []);
      // No distinct-dish claim: this is the actual admitted same-recipe1->2 path.
    });
    await t.test("expired/missing current source cannot erase original operation recovery via independent read", async () => {
      const readOnly = createCurrentIntegrationRuntime({ hostOrigin: HOST, supabase, owner: { identity, rpc }, flags: { currentRead: true }, now });
      const response = await readOnly.routes.currentRead(new Request(HOST + CURRENT_INTEGRATION_ROUTES.currentRead, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + A }, body: JSON.stringify({ contract: "wd-current-owner-read-v1", operation: "operationStatus", requestId: randomUUID(), targetOperationId: installed.operationId, targetIntentSha256: installed.intentSha256, originalEnvelope: installed }) }));
      const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.result.retryAuthorized, false); assert.doesNotMatch(JSON.stringify(body), /source_unavailable/);
      utc = expected.window.commitBefore; assert.equal((await send(envelope("evaluateJoined", current))).body.result.code, "reference_snapshot_expired"); utc = Date.parse("2026-11-01T12:00:00Z");
    });
  } finally { await db.close(); }
});