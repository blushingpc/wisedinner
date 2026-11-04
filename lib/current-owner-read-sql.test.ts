import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createCurrentOwnerReadService, CURRENT_OWNER_READ_CONTRACT } from "./current-owner-read.server.ts";
import { admitVerifiedReferenceOwner, type OwnerScopeDependencies } from "./generated-owner-scope.ts";
import { createCurrentOwnerRpcStatePort, type CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";
import { createCurrentOwnerIntegrationHandler } from "./generated-current-owner-service.ts";
import { createReferenceSessionHandlerV2 } from "./generated-plan-session.ts";
import { syntheticV2, op } from "./generated-plan-v2.test-support.ts";
import { hash } from "../scripts/data/price-evidence.ts";
import { createReviewedCurrentSourceBinder } from "./generated-current-reviewed-source.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
import { gunzipSync } from "node:zlib";
import { reviewedMethodSourceServings } from "./generated-reviewed-method-lineage.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { createHash } from "node:crypto";
import capsule from "./generated-current-source-capsule-v4.json" with { type: "json" };

const A = op(801), B = op(802);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Test-only SQL response inspection; original receipt and full persisted tuples are compared.
type Data = Record<string, any>;
test("T1/T2/T4: real SQL disk reopens, lost ACK, source expiry and cross-owner exact original recovery", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "wd-owner-read-"));
  let db = await PGlite.create(directory), ownerId = A, accountRevision = 1, now = Date.now(), loseAck = true, commits = 0;
  const nowInitial = now, deadline = Date.parse("2026-11-06T00:00:00Z");
  const f = syntheticV2();
  const sourceBytes = Buffer.from(f.rows.map(row => JSON.stringify({ ...row, sections: ["breakfast", "lunch", "dinner"] })).join("\n") + "\n");
  const sourceSha256 = createHash("sha256").update(sourceBytes).digest("hex");
  const configuration = { ...f.configuration, sourcePin: { sha256: sourceSha256, recordCount: 2 } };
  const fixtureBinding = createJoinedReferencePlannerV2(sourceBytes, configuration); assert.equal(fixtureBinding.outcome, "ready"); if (fixtureBinding.outcome !== "ready") throw Error("source failed");
  const selectedRequest = { ...f.request, slots: ["breakfast", "lunch", "dinner"] };
  const selectedAssignments = f.assignments.flatMap(row => selectedRequest.slots.map(slot => ({ ...row, slot, assignmentId: row.assignmentId + slot })));
  const initial = { ...f.initial, request: selectedRequest, assignments: selectedAssignments };
  const envelope = (operation: string, payload: unknown, id: number) => {
    const { intentSha256: ignored, ...body } = f.envelope(operation, payload, id); void ignored;
    const intent = { ...body, sourceSha256, expectedSourcePolicyBasisSha256: fixtureBinding.sourcePolicyBasis.basisSha256 };
    return { ...intent, intentSha256: referenceOperationDigest(intent) };
  };
  const identity: OwnerScopeDependencies = {
    verify: async () => ({ id: ownerId, token: "synthetic-only", authenticatedAt: 1, providers: ["email"] }),
    readAccount: async () => ({ userId: ownerId, state: "active", revision: accountRevision }),
  };
  const driver: CurrentOwnerRpcDriver = { async call(input) {
    const result = (await db.query<{ result: unknown }>("select public.wd_current_plan_rpc($1::uuid,$2::int,$3,$4,$5::jsonb,$6::bigint) result", [input.ownerId, input.accountRevision, input.scopeKey, input.action, JSON.stringify(input.body), input.accessExpiresAt ?? null])).rows[0].result;
    if (input.action === "commit") { commits++; if (loseAck) { assert.equal((result as Data).outcome, "committed"); loseAck = false; throw Error("Synthetic committed ACK lost"); } }
    return result;
  } };
  const reopen = async () => { await db.close(); db = await PGlite.create(directory); await role(); };
  const role = async () => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claims',$1,false)", [JSON.stringify({ role: "service_role", sub: A })]); await db.exec("set role service_role"); };
  async function send(body: unknown) {
    // New service instance models another authenticated client/process; no
    // shared last-result cache or live catalog is required to recover a receipt.
    const response = await createCurrentOwnerReadService({ enabled: true, identity, rpc: driver })(new Request("https://synthetic.invalid/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
    return await response.json() as Data;
  }
  try {
    await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;
      create schema auth;grant usage on schema public,auth to anon,authenticated,service_role;
      create function auth.jwt()returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;
      create function auth.uid()returns uuid language sql stable as $$select (auth.jwt()->>'sub')::uuid$$;
      create function auth.role()returns text language sql stable as $$select auth.jwt()->>'role'$$;`);
    for (const name of ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql", "0018_wd_current_plan.sql", "0019_wd_current_account_ingress.sql", "0020_wd_current_exec_acl.sql"]) await db.exec(await readFile(new URL("../supabase/migrations/" + name, import.meta.url), "utf8"));
    await db.query("insert into public.wd_accounts(user_id)values($1),($2)", [A, B]); await role();
    const producer = createCurrentOwnerIntegrationHandler({ enabled: true, identity, rpc: driver, now: () => now,
      access: async () => ({ allowed: true, state: "active", stale: false, expiresAt: now + 60000, observedAt: now, reason: "provider_verified", rerollsIncluded: true }),
      bind: async (owner, transactions) => {
        const bound = createReferenceSessionHandlerV2(sourceBytes, configuration, { ...f.options, transactions, resolveScope: () => owner.scope });
        return bound.outcome === "ready" ? { ...bound, newWeekCommitBefore: deadline } : null;
      } });
    const original = envelope("installCurrent", initial, 880);
    const request = () => new Request("https://synthetic.invalid/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(original) });
    const lost = await (await producer(request())).json(); assert.equal(lost.result.outcome, "unknown"); assert.equal(commits, 1);
    await reopen();
    const metadata = { contract: CURRENT_OWNER_READ_CONTRACT, requestId: op(810), operation: "metadata", target: "current" };
    const status = { contract: CURRENT_OWNER_READ_CONTRACT, requestId: op(811), operation: "operationStatus", targetOperationId: original.operationId, targetIntentSha256: original.intentSha256, originalEnvelope: original };
    const saved = (await send(metadata)).result; assert.equal(saved.outcome, "metadata");
    const owner = await admitVerifiedReferenceOwner(new Request("https://synthetic.invalid"), identity); assert.equal(owner.outcome, "ready"); if (owner.outcome !== "ready") throw Error("fixture owner failed");
    const actual = await createCurrentOwnerRpcStatePort(driver, owner).transaction(tx => tx.readState(owner.storageKey)); assert.ok(actual?.current);
    assert.equal(saved.week.assignments.length, 42); assert.deepEqual(saved.week.assignments, actual.current.assignments); assert.deepEqual(saved.week.request, actual.current.request);
    for (const field of ["requestSha256", "assignmentsSha256", "sourceSha256", "contentSha256"] as const) assert.equal(saved.week[field], actual.current[field]);
    await reopen(); now = deadline + 1;
    const known = (await send(status)).result; assert.equal(known.saved, true); assert.equal(known.intentSha256, original.intentSha256); assert.deepEqual(known.state.current.assignments, actual.current.assignments); assert.equal(known.sourceBinding.sourceSha256, sourceSha256);
    const duplicate = await (await producer(request())).json(); assert.equal(duplicate.result.outcome, "acknowledged"); assert.equal(commits, 1);
    const fresh = envelope("saveCurrent", { ...initial, expectedRevision: 1 }, 881);
    const expired = await (await producer(new Request("https://synthetic.invalid/session", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(fresh) }))).json(); assert.notEqual(expired.result.outcome, "acknowledged");
    ownerId = B; assert.equal((await send(metadata)).result.week, null); assert.equal((await send(status)).result.disposition, "unresolved"); ownerId = A;
    await reopen(); assert.equal((await send(status)).result.saved, true);
    assert.equal((await send({ ...status, targetIntentSha256: "0".repeat(64), originalEnvelope: undefined })).result.code, "original_intent_mismatch");
    accountRevision = 2; assert.equal((await send(metadata)).result.code, "owner_read_unavailable"); accountRevision = 1;
    assert.equal(nowInitial < deadline, true);
  } finally { await db.close(); await rm(directory, { recursive: true, force: true }); }
});

test("T4: sealed current 1300-information/three-family producer metadata reads after documentary expiry", async () => {
  let now = Date.parse("2026-10-30T12:00:00Z");
  const binder = createReviewedCurrentSourceBinder(capsule, () => now), memory = syntheticV2();
  const identity: OwnerScopeDependencies = { verify: async () => ({ id: op(899), token: "synthetic", authenticatedAt: 1, providers: ["email"] }), readAccount: async account => ({ userId: account.id, state: "active", revision: 1 }) };
  const owner = await admitVerifiedReferenceOwner(new Request("https://synthetic.invalid"), identity); assert.equal(owner.outcome, "ready"); if (owner.outcome !== "ready") throw Error("owner failed");
  const bound = await binder.bind(owner, memory.port); assert.ok(bound);
  // Only inspect the three sealed family IDs in existing configuration. This
  // test does not declare all catalog recipes eligible or mutate source data.
  assert.equal(binder.sourceSha256, "4c4e64e9c7030ac588cd665a16786620a066d23c7fc409a086d12ac3d393051c");
  assert.equal(binder.sourcePolicyBasisSha256, "6416f956c50b380e4cbd11d223c9095642487cf028142e58aaff80419e5628f4");
  const rows = gunzipSync(Buffer.from(capsule.sourceGzipBase64, "base64")).toString("utf8").trim().split("\n").map(line => JSON.parse(line));
  const practical = rows.filter(row => reviewedMethodSourceServings(row)); assert.equal(practical.length, 3);
  const days = ["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05"];
  const people = memory.request.people.map((person, i) => ({ ...person, proteinGoal: { kind: "known", gramsPerDay: i ? "80" : "60", coverage: "full-day" } }));
  const request = { ...memory.request, people, selectedDays: days, slots: ["breakfast", "lunch", "dinner"], asOfDate: days[0], budgetCents: 100000, storeIds: ["reference-estimates"], equipment: [...new Set(practical.flatMap(row => row.recipe.equipment as string[]))].sort() };
  const selected = [practical.find(row => row.id === "WD-R6-B-0104"), practical.find(row => row.id === "WD-R6-M-229a763292298d2a"), practical.find(row => row.id === "WD-R6-M-431627cc2c407495")];
  const assignments = days.flatMap(date => people.flatMap(person => request.slots.map((slot, i) => ({ assignmentId: `${person.personId}/${date}/${slot}`, personId: person.personId, profileRevision: person.profileRevision, date, slot, recipeId: selected[i].id, recipeSha256: selected[i].recipe_sha256, sourceServings: { numerator: "1", denominator: "1" } }))));
  const intent = { contract: "wd-joined-session-proposal-v2", operation: "installCurrent", operationId: op(901), sourceSha256: binder.sourceSha256, expectedSourcePolicyBasisSha256: binder.sourcePolicyBasisSha256, payload: { expectedRevision: 0, weekId: op(902), request, assignments, pantryEntries: [] } };
  const original = { ...intent, intentSha256: referenceOperationDigest(intent) };
  const saved = await (await bound.handle(new Request("https://synthetic.invalid/source-bound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(original) }))).json();
  assert.equal(saved.result.outcome, "acknowledged", JSON.stringify(saved.result));
  const rpc: CurrentOwnerRpcDriver = { call: input => memory.port.transaction(async tx => {
    assert.notEqual(input.action, "commit"); const raw = await tx.readState(input.scopeKey), state = raw ? canonicalReferenceData(raw) as typeof raw : null, meta = state ? { revision: state.revision, recordSha256: hash(state) } : null;
    if (input.action === "read_state") return { state, meta };
    const rawOperation = await tx.readOperation(input.scopeKey, input.body.operationId as string), operation = rawOperation ? canonicalReferenceData(rawOperation) : null;
    return { meta, operation, operationRecordSha256: operation ? hash(operation) : null };
  }) };
  now = Date.parse("2026-11-06T00:00:00Z");
  const service = createCurrentOwnerReadService({ enabled: true, identity, rpc });
  const read = async (body: unknown) => (await (await service(new Request("https://synthetic.invalid/read", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }))).json()).result;
  const metadata = await read({ contract: CURRENT_OWNER_READ_CONTRACT, operation: "metadata", requestId: op(903), target: "current" });
  assert.equal(metadata.outcome, "metadata", JSON.stringify(metadata)); assert.equal(metadata.week.assignments.length, 42);
  assert.deepEqual(metadata.week.assignments, [...assignments].sort((a, b) => a.assignmentId < b.assignmentId ? -1 : 1));
  assert.equal(metadata.week.requestSha256, saved.result.state.current.requestSha256); assert.equal(metadata.week.contentSha256, saved.result.state.current.contentSha256);
  const status = await read({ contract: CURRENT_OWNER_READ_CONTRACT, operation: "operationStatus", requestId: op(904), targetOperationId: original.operationId, targetIntentSha256: original.intentSha256, originalEnvelope: original });
  assert.equal(status.saved, true); assert.equal(status.sourceBinding.sourceSha256, binder.sourceSha256);
  const expiredIntent = { ...intent, operationId: op(905), operation: "saveCurrent", payload: { ...intent.payload, expectedRevision: 1 } };
  const expired = await (await bound.handle(new Request("https://synthetic.invalid/source-bound", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...expiredIntent, intentSha256: referenceOperationDigest(expiredIntent) }) }))).json();
  assert.notEqual(expired.result.outcome, "acknowledged");
  assert.equal(binder.referenceWindow.commitBefore, now);
  assert.equal(hash(capsule), hash(structuredClone(capsule)));
});
