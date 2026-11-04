import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { createCurrentGuidePolicy } from "./generated-current-guide-policy.ts";
import { createCurrentMealCoverage, mealCoverageHash } from "./generated-current-meal-coverage.ts";
import { createReferenceSessionFactoryV2 } from "./generated-plan-session.ts";
import { syntheticV2, op } from "./generated-plan-v2.test-support.ts";
import practical from "./fixtures/current-reviewed-practical-guides-v1.json" with { type: "json" };
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createCurrentOwnerRpcStatePort } from "./generated-current-rpc-state.ts";
import { admitVerifiedReferenceOwner } from "./generated-owner-scope.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
const capsule = JSON.parse(readFileSync(new URL("./generated-current-source-capsule-v4.json", import.meta.url), "utf8"));
const source = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString();
const policy = createCurrentGuidePolicy(source, capsule.configuration);
test("current policy covers all original batches and exactly sealed reviewed rational domains", () => {
  const c = createCurrentMealCoverage(source, { sourcePin: capsule.configuration.sourcePin, configuration: capsule.configuration, configurationSha256: mealCoverageHash(capsule.configuration), asOfDate: "2026-10-30", region: "South", storeIds: ["reference-store-context-only"], practicalAssets: practical });
  assert.equal(c.outcome, "ready"); if (c.outcome !== "ready") throw Error("coverage");
  assert.equal(c.rows.length, 1300);
  for (const row of c.rows) for (const d of row.guideDomains) {
    assert.equal(policy.check({ ...row, sourceServings: d.sourceServings, request: {} }).outcome, "allowed");
    assert.equal(policy.check({ ...row, sourceServings: { numerator: String(BigInt(d.sourceServings.numerator) * BigInt(2)), denominator: String(BigInt(d.sourceServings.denominator) * BigInt(2)) }, request: {} }).outcome, "allowed");
    assert.equal(policy.check({ ...row, recipeSha256: "0".repeat(64), sourceServings: d.sourceServings, request: {} }).outcome, "held");
  }
  const ordinary = c.rows.find(r => r.guideDomains.length === 1)!;
  assert.equal(policy.check({ ...ordinary, sourceServings: { numerator: "1", denominator: "4" }, request: {} }).outcome, "held");
  assert.equal(createHash("sha256").update(readFileSync(new URL("./fixtures/current-reviewed-practical-guides-v1.json", import.meta.url))).digest("hex"), "660e09c42c051f9a6e037e3892837ffdf3c47d95bd1f8d3f5f71d19878891891");
  assert.throws(() => createCurrentGuidePolicy(source + " ", capsule.configuration));
});
test("actual session uses trusted guide guard for writes but exact original ACK survives later hold", async () => {
  const f = syntheticV2();
  const installed = await f.send("installCurrent", f.initial);
  assert.equal(installed.body.result.saved, true);
  let calls = 0;
  const factory = createReferenceSessionFactoryV2(f.bytes, f.configuration, { currentGuidePolicy: { check: () => { calls++; return { outcome: "held", reasons: ["source_serving_guide_required"] }; } } });
  assert.equal(factory.outcome, "ready"); if (factory.outcome !== "ready") throw Error("factory");
  const handler = factory.bind(f.options); assert.equal(handler.outcome, "ready"); if (handler.outcome !== "ready") throw Error("handler");
  const duplicate = await f.send("installCurrent", f.initial, 1, f.binding.sourcePolicyBasis.basisSha256, handler);
  assert.equal(duplicate.body.result.saved, true); assert.equal(duplicate.body.result.state.revision, 1);
  assert.equal((await f.send("operationStatus", { targetOperationId: op(1) }, 2, null, handler)).body.result.receipt.saved, true);
  const next = await f.send("saveCurrent", { ...f.initial, expectedRevision: 1 }, 3, f.binding.sourcePolicyBasis.basisSha256, handler);
  assert.equal(next.body.result.outcome, "not_applied");
  assert.deepEqual(next.body.result.result.reasons, [{ code: "source_serving_guide_required", assignmentId: f.assignments[0].assignmentId }]); assert.ok(calls > 0);
  assert.equal((await f.send("readCurrent", {}, 4, null)).body.result.state.revision, 1);
});
test("one trusted predicate filters search and alternatives before evaluation budgets and ranking", () => {
  const f = syntheticV2(), factory = createJoinedReferencePlannerV2(f.bytes, f.configuration, { currentGuidePolicy: { check: i => i.recipeId === "a" && ["3", "4"].includes(i.sourceServings.numerator) && i.sourceServings.denominator === "1" ? { outcome: "allowed" } : { outcome: "held", reasons: ["source_serving_guide_required"] } } });
  if (factory.outcome !== "ready") throw Error("planner");
  const grid = { recipeIds: ["a", "b"], portionsByPerson: f.request.people.map((p, i) => ({ personId: p.personId, profileRevision: p.profileRevision, sourceServings: [{ numerator: String(i + 3), denominator: "1" }] })), maxRecipeUsesPerPerson: 7, maxEvaluations: 16, seed: "guide-only-synthetic" };
  const result = factory.planner.planJoined(f.request, grid); assert.equal(result.outcome, "success");
  if (result.outcome === "success") assert.ok(result.projection.assignments.every(a => a.recipeId === "a"));
  const a = f.assignments[0], alternatives = factory.planner.findReplacements(f.assignments, f.request, { personId: a.personId, assignmentId: a.assignmentId, expectedRecipeSha256: a.recipeSha256, candidates: [{ recipeId: "b", sourceServings: a.sourceServings }, { recipeId: "a", sourceServings: { numerator: "5", denominator: "1" } }], maxEvaluations: 1, limit: 10 });
  assert.equal(alternatives.outcome, "alternatives"); if (alternatives.outcome !== "alternatives") throw Error("alternatives");
  assert.equal(alternatives.candidates.length, 0); assert.equal(alternatives.search.evaluatedCandidateCount, 0); assert.equal(alternatives.excluded.length, 2);
});
test("actual current capability headers admit immutable guide policy separately from unchanged reference packet and clock", async () => {
  const binder = createReviewedCurrentSourceBinder(capsule, () => Date.UTC(2026, 9, 31, 17));
  const owner = await admitVerifiedReferenceOwner(new Request("https://fixture.invalid"), { verify: async () => ({ id: "10000000-0000-4000-8000-000000000101", token: "synthetic", authenticatedAt: 1, providers: ["email"] }), readAccount: async a => ({ userId: a.id, state: "active", revision: 1 }) });
  if (owner.outcome !== "ready") throw Error("owner");
  const kernel = await binder.bind(owner, syntheticV2().port); if (!kernel) throw Error("binding");
  const intent = { contract: "wd-joined-session-proposal-v2", operation: "capabilities", operationId: op(1100), sourceSha256: binder.sourceSha256, expectedSourcePolicyBasisSha256: null, payload: { reviewedReferenceData: "wd-reviewed-reference-data-v1" } };
  const response = await kernel.handle(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...intent, intentSha256: referenceOperationDigest(intent) }) }));
  assert.equal(response.headers.get("X-WiseDinner-Guide-Policy"), "wd-current-guide-policy-v1");
  assert.equal(response.headers.get("X-WiseDinner-Guide-Policy-Sha256"), policy.sha256);
  assert.equal(response.headers.get("X-WiseDinner-Clock-Utc"), "2026-10-31T17:00:00.000Z");
  const body = await response.json(); assert.equal(body.result.reviewedReferenceData.reviewedDataSha256, "353eef4f84fb486701b9d08317907594b947b1c5c2e446a4cb70e461e3120174");
  assert.equal(Object.hasOwn(body.result.reviewedReferenceData, "guidePolicy"), false);
});
test("actual current1300 HTTP/SQL guide fence, unchanged150g/150USD inputs and disk original recovery", async () => {
  const dir = await mkdtemp(join(tmpdir(), "wd-guide-current-")); let db = await PGlite.create(dir);
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
    create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
    create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
    create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
    for (const name of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql"]) await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    const id = "10000000-0000-4000-8000-000000000101"; await db.query("insert into wd_accounts(user_id)values($1)", [id]);
    const owner = await admitVerifiedReferenceOwner(new Request("https://fixture.invalid"), { verify: async () => ({ id, token: "synthetic", authenticatedAt: 1, providers: ["email"] }), readAccount: async () => ({ userId: id, state: "active", revision: 1 }) });
    if (owner.outcome !== "ready") throw Error("owner");
    const port = createCurrentOwnerRpcStatePort({ call: async i => {
      await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "service_role", sub: id })]); await db.exec("set role service_role");
      return (await db.query<{ result: unknown }>("select wd_current_plan_rpc($1::uuid,$2::int,$3,$4,$5::jsonb,$6::bigint) result", [i.ownerId, i.accountRevision, i.scopeKey, i.action, JSON.stringify(i.body), i.action === "commit" ? Date.now() + 60000 : null])).rows[0].result;
    } }, owner);
    const base = syntheticV2(), rows = source.trimEnd().split("\n").map(l => JSON.parse(l));
    const ids = ["WD-R6-B-0129", "WD-R6-M-431627cc2c407495", "WD-R6-M-229a763292298d2a"], recipes = ids.map(id => rows.find(r => r.id === id));
    const request = { ...base.request, people: [{ ...base.request.people[0], proteinGoal: { kind: "known", gramsPerDay: "150", coverage: "full-day" } }], selectedDays: Array.from({ length: 7 }, (_, i) => "2026-10-" + (30 + i <= 31 ? 30 + i : "unused")), slots: ["breakfast", "lunch", "dinner"], asOfDate: "2026-10-30", storeIds: ["reference-store-context-only"], budgetCents: 15000, equipment: [...new Set(recipes.flatMap(r => r.recipe.equipment))] };
    request.selectedDays = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
    const assignments = request.selectedDays.flatMap(date => recipes.map((r, i) => ({ assignmentId: date + i, personId: request.people[0].personId, profileRevision: request.people[0].profileRevision, date, slot: request.slots[i], recipeId: r.id, recipeSha256: r.recipe_sha256, sourceServings: { numerator: i === 2 ? "1" : "2", denominator: "1" } })));
    const factory = createReferenceSessionFactoryV2(source, capsule.configuration, { currentGuidePolicy: policy }); if (factory.outcome !== "ready") throw Error("factory");
    const handler = factory.bind({ labels: capsule.labels, transactions: port, resolveScope: () => owner.scope }); if (handler.outcome !== "ready") throw Error("session");
    const activeFactory = factory, activeHandler = handler;
    async function send(operation: string, payload: unknown, n: number, target = activeHandler) {
      const value = { contract: "wd-joined-session-proposal-v2", operation, operationId: op(n), sourceSha256: activeFactory.source.sha256, expectedSourcePolicyBasisSha256: activeFactory.sourcePolicyBasis.basisSha256, payload };
      const response = await target.handle(new Request("https://fixture.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...value, intentSha256: (await import("./generated-plan-operations.ts")).referenceOperationDigest(value) }) })); return (await response.json()).result;
    }
    const unguarded = createJoinedReferencePlannerV2(source, capsule.configuration); if (unguarded.outcome !== "ready") throw Error("planner");
    const expected = unguarded.planner.evaluateJoined(assignments, request);
    const evaluated = await send("evaluateJoined", { assignments, request }, 10);
    assert.equal(expected.outcome, "success"); assert.equal(evaluated.outcome, "week-proposal"); assert.equal(request.budgetCents, 15000); assert.equal(request.people[0].proteinGoal.gramsPerDay, "150");
    const bad = assignments.map((a, i) => i ? a : { ...a, sourceServings: { numerator: "1", denominator: "4" } });
    const rejected = await send("installCurrent", { weekId: op(200), expectedRevision: 0, assignments: bad, request, pantryEntries: [] }, 11);
    assert.equal(rejected.outcome, "not_applied"); assert.equal(rejected.result.reasons[0].code, "source_serving_guide_required");
    await db.close(); db = await PGlite.create(dir);
    const original = await send("operationStatus", { targetOperationId: op(11) }, 12);
    assert.equal(original.outcome, "committed"); assert.equal(original.receipt.outcome, "not_applied");
    const good = { weekId: op(200), expectedRevision: 0, assignments, request, pantryEntries: [] };
    const saved = await send("installCurrent", good, 13); assert.equal(saved.saved, true);
    assert.equal(saved.state.current.view.personDays.length, 7);
    if (expected.outcome === "success") assert.ok(expected.quote.estimatedTotalCents.max <= 15000);
    const changed = createReferenceSessionFactoryV2(source, capsule.configuration, { currentGuidePolicy: { check: () => ({ outcome: "held", reasons: ["source_serving_guide_required"] }) } }); if (changed.outcome !== "ready") throw Error("changed factory");
    const changedHandler = changed.bind({ labels: capsule.labels, transactions: port, resolveScope: () => owner.scope }); if (changedHandler.outcome !== "ready") throw Error("changed handler");
    assert.equal((await send("installCurrent", good, 13, changedHandler)).saved, true);
  } finally { await db.close(); await rm(dir, { recursive: true }); }
});
