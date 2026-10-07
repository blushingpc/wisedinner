// Acceptance orchestration only. No CLI/env/default fetch, DB constructor or provider binding.
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { accountDeletionWorker, type DeletionProviders, type DeletionRepository } from "../lib/account-deletion.ts";
import { handleOutboxPoll, type SupportOutbox } from "../lib/support/outbox.ts";
import type { Mailbox } from "../lib/support/mail.ts";
import type { Classifier } from "../lib/support/classify.ts";
import type { BillingRepository } from "../lib/billing.ts";
import type { VerifiedAccount } from "../lib/account.ts";
import { requestExplicitRestore, reconcileExplicitRestore, type RestoreRepository, type RestoreProofAdapter } from "../lib/billing-restore.ts";
import { SCHEMA_REVISION, isolatedTarget, verifyIsolatedTarget, type Target, type MigrationPin } from "./account-isolated.ts";

export const DRY_A = "10000000-0000-4000-8000-000000000001", DRY_B = "10000000-0000-4000-8000-000000000002";
export const DRY_WEEK = "30000000-0000-4000-8000-000000000001", DRY_HASH = "a".repeat(64);
export type DryPorts = {
  target: "memory://";
  account: (request: Request) => Promise<Response>;
  billing: BillingRepository;
  restore: RestoreRepository;
  restoreVerify: (request: Request) => Promise<VerifiedAccount>;
  restoreProof?: RestoreProofAdapter;
  deletion: DeletionRepository;
  providers: DeletionProviders;
  outbox: SupportOutbox;
  mail: Mailbox;
  classify: Classifier;
  query: (role: "authenticated" | "anon" | "service_role" | "bootstrap", id: string | null, sql: string, args?: unknown[], age?: number) => Promise<Record<string, unknown>[]>;
  close: () => Promise<void>;
};
type DryOptions = { mode: "dry"; markerRequest: typeof fetch; create: (inventory: MigrationPin[]) => Promise<DryPorts> };
const check = (value: unknown, code: string): void => { if (!value) throw Error(code); };
async function denied(operation: () => Promise<unknown>, code = "sql_permission_denied") {
  try { await operation(); } catch (e) {
    if (e instanceof Error && e.message === code) return;
    throw Error("refusal_unavailable");
  }
  throw Error("expected_refusal_missing");
}

export async function runDryPrepared(target: Target, options?: DryOptions) {
  // Revalidate every public entry point before constructing SQL/storage/provider ports.
  target = isolatedTarget(target);
  check(options?.mode === "dry" && typeof options.markerRequest === "function" && typeof options.create === "function" && Object.keys(options).sort().join() === ["mode", "markerRequest", "create"].sort().join(), "explicit_dry_ports_required");
  const inventory = await verifyIsolatedTarget(target, "synthetic-marker-key", options!.markerRequest);
  const p = await options!.create(inventory);
  try {
    check(p.target === "memory://", "memory_target_required");
    const cases: string[] = [];
    const call = (id: string, method: string, body?: unknown, key = randomUUID(), path = "", stale = false) => p.account(new Request(`https://dry.invalid/api/v1/account${path}`, {
      method, headers: { Authorization: `Bearer synthetic-${id}${stale ? "-stale" : ""}`, "Content-Type": "application/json", "Idempotency-Key": key },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }));
    const result = async (r: Response) => { check(r.status === 200 && r.headers.get("cache-control") === "no-store", "account_contract_failed"); return (await r.json()).result; };
    for (const id of [DRY_A, DRY_B]) await result(await call(id, "POST", {}));
    // Historical association rows test deletion cleanup, not token registration or push delivery.
    await p.query("bootstrap", null, "insert into public.wd_push_projects values($1,'development',true)", [DRY_WEEK]);
    for (const id of [DRY_A, DRY_B]) await p.query("bootstrap", null, "insert into public.wd_push_tokens values($1,$2,$2,'development',$3,1,$4,true,now())", [id, DRY_WEEK, `synthetic-push-${id}`, id === DRY_A ? DRY_HASH : "b".repeat(64)]);
    await p.query("bootstrap", null, "insert into public.wd_push_receipts values($1,$2,$3,'{}',now())", [DRY_A, DRY_WEEK, DRY_HASH]);
    await p.query("bootstrap", null, "insert into public.wd_push_jobs(id,user_id,device_id,project_id,environment,body)values($1,$2,$1,$1,'development','synthetic')", [DRY_WEEK, DRY_A]);
    const prefs = { diet: "none", allergens: [], excludedSkuIds: [], household: 2, notifications: false };
    await result(await call(DRY_A, "PATCH", { revision: 1, preferences: prefs }));
    const bBefore = await result(await call(DRY_B, "GET"));
    for (const id of [DRY_A, DRY_B]) {
      const rows = await p.query("authenticated", id, "select user_id from public.wd_accounts");
      check(rows.length === 1 && rows[0].user_id === id, "owned_rows_failed");
      await denied(() => p.query("authenticated", id, "update public.wd_accounts set revision=99"));
      for (const table of ["wd_deletion_work", "wd_support_work", "wd_support_sends"]) {
        await denied(() => p.query("authenticated", id, `select * from public.${table}`));
        await denied(() => p.query("authenticated", id, `delete from public.${table}`));
      }
      await denied(() => p.query("authenticated", id, "select public.wd_deletion_command('claim',$1::jsonb)", [JSON.stringify({ userId: DRY_A, owner: randomUUID() })]));
      await denied(() => p.query("authenticated", id, "select public.wd_support_progress('claim',$1::jsonb)", [JSON.stringify({ owner: randomUUID(), exclude: [] })]));
      await result(await call(id, "POST", { id: DRY_WEEK, revision: 0, week: { snapshotVersion: 5, snapshotSha256: DRY_HASH, solverRevision: "dry", catalogRevision: "dry", recipeIds: Array(15).fill("main"), seed: 7 } }, randomUUID(), "/weeks"));
    }
    await denied(() => p.query("anon", null, "select * from public.wd_deletion_work"));
    await denied(() => p.query("anon", null, "select * from public.wd_support_work"));
    cases.push("A/B actual handler ownership, saved metadata and private SQL grants");
    const bindings = [await p.billing.bind(DRY_A), await p.billing.bind(DRY_B)];
    check(bindings[0].appUserId !== bindings[1].appUserId, "binding_isolation_failed");
    // Existing private runtime and applied memory SQL only. Supplied proof is fictional;
    // no adapter can initiate a store restore/purchase or establish hosted ownership here.
    for (const role of ["anon", "authenticated"] as const) {
      for (const table of ["wd_restore_intents", "wd_restore_lineages", "wd_restore_aliases", "wd_restore_fences"])
        await denied(() => p.query(role, role === "anon" ? null : DRY_B, `select * from public.${table}`));
      await denied(() => p.query(role, role === "anon" ? null : DRY_B, "select public.wd_restore_command('read',$1::jsonb)", [JSON.stringify({ operation: randomUUID() })]));
    }
    const scope = { environment: "SANDBOX" as const, app: "dry_app", product: "dry_monthly", entitlement: "dry_pro" };
    const started = await p.billing.begin(DRY_A, scope.environment), restoreNow = Date.now();
    await p.billing.commit(DRY_A, scope.environment, started.generation, { state: "active", expiresAt: restoreNow + 86400000, observedAt: restoreNow, reason: "synthetic_acceptance", transactionHash: DRY_HASH });
    const restoreOperation = randomUUID();
    const restoreRequest = () => new Request("https://dry.invalid/internal", { method: "POST", headers: { Authorization: `Bearer synthetic-${DRY_B}`, "Content-Type": "application/json" }, body: JSON.stringify({ intent: "restore" }) });
    const deps = { verify: p.restoreVerify, repository: p.restore, scope };
    const restoreIntent = await requestExplicitRestore(restoreRequest(), restoreOperation, deps);
    check(restoreIntent.targetBinding === bindings[1].appUserId, "verified_restore_target_failed");
    assert.deepEqual(await requestExplicitRestore(restoreRequest(), restoreOperation, deps), restoreIntent);
    await denied(() => p.restore.execute("intent", { operation: restoreOperation, target: DRY_A, ...scope }), "idempotency_conflict");
    const restoreFirst = await reconcileExplicitRestore(restoreOperation, p.restore, p.restoreProof);
    const restoreRestart = await reconcileExplicitRestore(restoreOperation, p.restore, p.restoreProof);
    const restoreStates = await p.query("bootstrap", null, "select user_id,state from public.wd_billing_states where environment='SANDBOX' order by user_id");
    const activeOwners = restoreStates.filter(r => ["active", "trial"].includes((r.state as { state: string }).state));
    check(activeOwners.length === 1, "single_restore_owner_failed");
    const lineage = await p.query("bootstrap", null, "select owner_id,original_purchase_ms from public.wd_restore_lineages where environment='SANDBOX'");
    if (restoreRestart.status === "completed") {
      check(activeOwners[0].user_id === DRY_B && (restoreStates.find(r => r.user_id === DRY_A)!.state as { state: string }).state === "revoked", "restore_revocation_required");
      check(lineage.length === 1 && lineage[0].owner_id === DRY_B && Number(lineage[0].original_purchase_ms) === 946684800000, "original_restore_lineage_failed");
    } else {
      check(restoreRestart.status === "held" && activeOwners[0].user_id === DRY_A && lineage.length === 0, "held_restore_granted_access");
    }
    cases.push("nine-file memory SQL explicit restore, private RPC denial, verified target/idempotency, one owner and read-only reconciliation retry");
    const intent = randomUUID(), confirmation = { confirmation: "DELETE MY ACCOUNT" };
    check((await call(DRY_A, "DELETE", confirmation, intent, "", true)).status === 401, "recent_AMR_required");
    // Direct SQL checks independently enforce AMR, not a refreshed iat or local claim.
    const stale = await p.query("authenticated", DRY_A, "select public.wd_account_command('begin_deletion',$1::jsonb,$2::uuid) r", [JSON.stringify(confirmation), intent], 301);
    check((stale[0].r as { error: string }).error === "invalid_command", "SQL_recent_AMR_required");
    const accepted = await result(await call(DRY_A, "DELETE", confirmation, intent));
    check(accepted.state === "deletion_pending" && accepted.subscriptionCancelled === false, "intent_contract_failed");
    assert.deepEqual(await result(await call(DRY_A, "DELETE", confirmation, intent)), accepted);
    for (const method of ["GET", "POST", "PATCH"]) check((await call(DRY_A, method, method === "GET" ? undefined : method === "POST" ? {} : { revision: 2, preferences: prefs })).status === 410, "tombstone_denial_failed");
    await denied(() => p.billing.bind(DRY_A), "account_inactive");
    await denied(() => p.billing.begin(DRY_A, "SANDBOX"), "account_inactive");
    const push = await p.query("authenticated", DRY_A, "select public.wd_push_command('register','{}',$1::uuid) r", [randomUUID()]);
    check((push[0].r as { error: string }).error === "account_inactive", "push_resurrection_denied");
    assert.deepEqual(await result(await call(DRY_B, "GET")), bBefore);
    cases.push("recent-auth intent/idempotency, immediate tombstone, billing/push/bootstrap denial and B preserved");
    const owner = randomUUID(), other = randomUUID();
    const claim = await p.deletion.command("claim", { userId: DRY_A, owner });
    const context = { userId: DRY_A, owner, attempt: claim.work.attempt };
    await denied(() => p.deletion.command("claim", { userId: DRY_A, owner: other }), "claim_busy");
    await denied(() => p.deletion.command("complete", context), "invalid_progress");
    await denied(() => p.deletion.command("proof", { ...context, dependency: "apple", operationId: randomUUID(), identityHash: DRY_HASH, evidenceHash: DRY_HASH, outcome: "confirmed" }), "invalid_progress");
    await p.deletion.command("release", context);
    await denied(() => p.deletion.command("cleanup", context), "stale_claim");
    cases.push("competing/stale deletion claims and premature unbound proof refused");
    // Fresh worker instances reuse persisted SQL, never local worker object state.
    const deletionFirst = await accountDeletionWorker(p.deletion, p.providers)(DRY_A);
    const firstProgress = (await p.query("service_role", null, "select apple_state from public.wd_deletion_work where user_id=$1", [DRY_A]))[0];
    if (firstProgress.apple_state === "held") {
      // Exercise wrong pins after real worker identity/begin/proof persistence, not just an unbound refusal.
      const held = await p.deletion.command("claim", { userId: DRY_A, owner: randomUUID() });
      const heldContext = { userId: DRY_A, owner: held.work.owner, attempt: held.work.attempt, dependency: "apple", evidenceHash: DRY_HASH, outcome: "confirmed" };
      await denied(() => p.deletion.command("proof", { ...heldContext, operationId: randomUUID(), identityHash: held.work.identity_hash }), "invalid_progress");
      await denied(() => p.deletion.command("proof", { ...heldContext, operationId: held.work.apple_operation, identityHash: "b".repeat(64) }), "invalid_progress");
      await p.deletion.command("release", { userId: DRY_A, owner: held.work.owner, attempt: held.work.attempt });
      cases.push("held worker operation/identity mismatch refused without progress");
    }
    const deletionRestart = await accountDeletionWorker(p.deletion, p.providers)(DRY_A);
    const progress = (await p.query("service_role", null, "select apple_state,auth_state,complete from public.wd_deletion_work where user_id=$1", [DRY_A]))[0];
    const status = await result(await call(DRY_A, "GET", undefined, randomUUID(), "/deletion"));
    check(["deletion_pending", "deleted"].includes(status.state), "status_contract_failed");
    check(Object.keys(status).sort().join() === "dependencies,state" && !/operation|identity_hash|evidence|owner/.test(JSON.stringify(status)), "private_progress_leaked");
    const aWeeks = await p.query("bootstrap", null, "select id from public.wd_saved_weeks where user_id=$1", [DRY_A]);
    const bWeeks = await p.query("bootstrap", null, "select id from public.wd_saved_weeks where user_id=$1", [DRY_B]);
    check(aWeeks.length === 0 && bWeeks.length === 1, "owned_cleanup_failed");
    for (const table of ["wd_push_tokens", "wd_push_receipts", "wd_push_jobs"]) check((await p.query("bootstrap", null, `select user_id from public.${table} where user_id=$1`, [DRY_A])).length === 0, "push_cleanup_failed");
    check((await p.query("bootstrap", null, "select user_id from public.wd_push_tokens where user_id=$1", [DRY_B])).length === 1, "B_push_removed");
    assert.deepEqual(await result(await call(DRY_B, "GET")), bBefore);
    check((await p.billing.bind(DRY_B)).appUserId === bindings[1].appUserId, "B_binding_changed");
    cases.push("durable deletion first/restart and public coarse status; B unchanged");
    const mailInput = (await p.mail.unread(1))[0];
    await p.outbox.command("record", { input: { messageId: mailInput.messageId, from: mailInput.from, subject: mailInput.subject, text: mailInput.text, inReplyTo: mailInput.inReplyTo ?? null, threadSubject: mailInput.subject } });
    const supportOwner = randomUUID(), supportOther = randomUUID();
    const work = (await p.outbox.command("claim", { owner: supportOwner, exclude: [] })).work as { id: string; attempt: number };
    check(work && (await p.outbox.command("claim", { owner: supportOther, exclude: [] })).work === null, "competing_outbox_claim");
    const supportContext = { id: work.id, owner: supportOwner, attempt: work.attempt };
    await denied(() => p.outbox.command("finish", supportContext), "invalid_command");
    await denied(() => p.outbox.command("release", { ...supportContext, owner: supportOther }), "stale_claim");
    await p.outbox.command("release", supportContext);
    await denied(() => p.outbox.command("begin", supportContext), "stale_claim");
    cases.push("competing/stale outbox claims and premature completion refused");
    const supportFirst = await handleOutboxPoll(p.mail, p.classify, "", p.outbox);
    const frozen = await p.query("bootstrap", null, "select payload from public.wd_support_work");
    const supportRestart = await handleOutboxPoll(p.mail, p.classify, "", p.outbox);
    assert.deepEqual(await p.query("bootstrap", null, "select payload from public.wd_support_work"), frozen);
    const supportStates = await p.query("bootstrap", null, "select state from public.wd_support_work order by id");
    check(supportStates.length === 1 && ["done", "held"].includes(supportStates[0].state as string), "support_outcome_missing");
    cases.push("actual durable outbox first/restart with injected mailbox/classifier");
    const deletionOutcome = deletionRestart.state === "deleted" ? "confirmed" : [progress.apple_state, progress.auth_state].includes("held") ? "held" : "unavailable";
    return { status: "local_dry_observed", outcomes: { deletion: deletionOutcome, support: supportStates[0].state === "done" ? "confirmed" : "held" }, schemaRevision: SCHEMA_REVISION, executedMigrations: inventory, cases, restoreFirst, restoreRestart, deletionFirst, deletionRestart, accountStatus: status, supportFirst, supportRestart, supportState: supportStates[0].state, frozenPayloadDigest: createHash("sha256").update(JSON.stringify(frozen)).digest("hex") };
  } finally { await p.close(); }
}
