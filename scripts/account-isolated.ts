import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, realpath, stat, writeFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { accountHandler, supabaseAccountRepository, supabaseVerifier, UUID } from "../lib/account.ts";
import { supabaseBillingRepository } from "../lib/billing.ts";

const PURPOSE = "wisedinner-disposable-account-acceptance";
const SHARED = "zpvqxtklvjitofpbddrn";
export type Target = { purpose: string; disposable: boolean; projectRef: string; url: string; nonce: string; credentialFile: string; outputDir: string };
type Credentials = { anonKey: string; serviceRoleKey: string };
export const SCHEMA_REVISION = "0006-0014";
const MIGRATIONS = ["0006_wd_accounts.sql", "0007_wd_billing.sql", "0008_wd_publication.sql", "0009_wd_notifications.sql", "0010_wd_operations.sql", "0011_wd_support_sends.sql", "0012_wd_support_outbox.sql", "0013_wd_account_deletion.sql", "0014_wd_billing_restore.sql"] as const;
export type MigrationPin = { file: string; sha256: string; bytes: number };
export async function migrationInventory(): Promise<MigrationPin[]> {
  const pins = [];
  for (const file of MIGRATIONS) {
    const bytes = await readFile(new URL(`../supabase/migrations/${file}`, import.meta.url));
    pins.push({ file, sha256: createHash("sha256").update(bytes).digest("hex"), bytes: bytes.length });
  }
  return pins;
}
function requireSafe(condition: unknown, code: string): asserts condition { if (!condition) throw Error(code); }

// No env fallbacks, shared credentials, schema changes, reset, mail or provider calls.
export function isolatedTarget(value: unknown): Target {
  assert(value && typeof value === "object" && !Array.isArray(value), "manifest_required");
  const t = value as Target;
  requireSafe(Object.keys(t).sort().join() === ["purpose", "disposable", "projectRef", "url", "nonce", "credentialFile", "outputDir"].sort().join(), "manifest_fields");
  requireSafe(t.purpose === PURPOSE, "purpose_required");
  requireSafe(t.disposable === true, "disposable_required");
  assert(typeof t.projectRef === "string" && /^[a-z]{20}$/.test(t.projectRef) && t.projectRef !== SHARED, "shared_or_invalid_target");
  requireSafe(t.url === `https://${t.projectRef}.supabase.co`, "exact_https_target_required");
  assert(typeof t.nonce === "string" && UUID.test(t.nonce), "target_nonce_required");
  assert(typeof t.credentialFile === "string" && isAbsolute(t.credentialFile), "external_credentials_required");
  assert(typeof t.outputDir === "string" && isAbsolute(t.outputDir), "exclusive_output_required");
  return Object.freeze({ ...t });
}

export async function verifyIsolatedTarget(target: Target, serviceKey: string, request: typeof fetch = fetch, deadlineMs = 8000) {
  // Recheck before the first network request even when called outside the CLI.
  target = isolatedTarget(target);
  requireSafe(typeof serviceKey === "string" && serviceKey.length > 0 && serviceKey.length <= 16384, "marker_credential_required");
  requireSafe(Number.isInteger(deadlineMs) && deadlineMs > 0 && deadlineMs <= 8000 && typeof request === "function", "target_verifier_required");
  const inventory = await migrationInventory(), controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  const work = async () => {
    const response = await request(`${target.url}/rest/v1/wd_readiness_target?id=eq.${target.nonce}&select=id,purpose,disposable,project_ref,schema_revision,migration_digests`, {
      method: "GET", headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      redirect: "error", cache: "no-store", signal: controller.signal,
    });
    requireSafe(response.status === 200 && !response.redirected && (!response.url || response.url === `${target.url}/rest/v1/wd_readiness_target?id=eq.${target.nonce}&select=id,purpose,disposable,project_ref,schema_revision,migration_digests`), "target_marker_unavailable");
    requireSafe(response.headers.get("content-type")?.split(";")[0].trim() === "application/json", "target_marker_malformed");
    const length = response.headers.get("content-length");
    requireSafe(!length || /^\d+$/.test(length) && Number(length) <= 16384, "target_marker_size");
    reader = response.body?.getReader(); requireSafe(reader, "target_marker_malformed");
    let size = 0; const chunks: Uint8Array[] = [];
    while (true) {
      const part = await reader.read(); if (part.done) break;
      size += part.value.byteLength; requireSafe(size <= 16384, "target_marker_size"); chunks.push(part.value);
    }
    const value = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    const expected = [{ id: target.nonce, purpose: PURPOSE, disposable: true, project_ref: target.projectRef, schema_revision: SCHEMA_REVISION, migration_digests: inventory }];
    // Comparison is strict, but failure never carries the private response or assertion diff.
    requireSafe(typeof value === "object" && value !== null, "target_marker_mismatch");
    try { assert.deepEqual(value, expected); } catch { throw Error("target_marker_mismatch"); }
    return inventory;
  };
  try {
    return await Promise.race([work(), new Promise<never>((_, reject) => {
      timer = setTimeout(() => { controller.abort(); reject(Error("target_marker_unavailable")); }, deadlineMs);
    })]);
  } catch { throw Error("target_marker_refused"); }
  finally { clearTimeout(timer); controller.abort(); void reader?.cancel().catch(() => {}); }
}

function outsideRepo(path: string, repo: string) {
  const r = relative(repo, path);
  assert(r === ".." || r.startsWith(`..${sep}`) || isAbsolute(r), "file_must_be_outside_repo");
}
async function externalJson(path: string): Promise<unknown> {
  try {
    const info = await stat(path);
    requireSafe(info.isFile() && info.size <= 16384, "external_json_refused");
    const bytes = await readFile(path);
    requireSafe(bytes.length <= 16384, "external_json_refused");
    return JSON.parse(bytes.toString("utf8"));
  } catch { throw Error("external_json_refused"); }
}

export async function runIsolated(manifest: string) {
  requireSafe(typeof manifest === "string" && isAbsolute(manifest), "external_manifest_required");
  const repo = await realpath(fileURLToPath(new URL("..", import.meta.url)));
  const manifestPath = await realpath(manifest); outsideRepo(manifestPath, repo);
  const target = isolatedTarget(await externalJson(manifestPath));
  const credentialPath = await realpath(target.credentialFile); outsideRepo(credentialPath, repo);
  const outputRoot = await realpath(target.outputDir); outsideRepo(outputRoot, repo);
  for (const sibling of ["wisedinner-app", "wisedinner"]) {
    const root = await realpath(resolve(repo, "..", sibling));
    for (const path of [manifestPath, credentialPath, outputRoot]) outsideRepo(path, root);
  }
  const credentials = await externalJson(credentialPath) as Credentials;
  requireSafe(credentials && typeof credentials === "object" && !Array.isArray(credentials), "credential_fields");
  requireSafe(Object.keys(credentials).sort().join() === ["anonKey", "serviceRoleKey"].sort().join(), "credential_fields");
  assert(typeof credentials.anonKey === "string" && credentials.anonKey.length > 20 && typeof credentials.serviceRoleKey === "string" && credentials.serviceRoleKey.length > 20, "credentials_required");
  // Exclusive per-attempt directory preserves failed evidence and prevents replay overwrite.
  const output = resolve(outputRoot, `account-acceptance-${randomUUID()}`);
  await mkdir(output);
  const evidence: { status: string; target: string; cases: string[]; lastStep: string; limitations: string[] } = {
    status: "running", target: target.projectRef, cases: [], lastStep: "target_readonly_verification",
    limitations: ["Synthetic disposable users and billing states only; no Apple/Google OAuth, RevenueCat, StoreKit, app cache, bound worker, mail or production proof.", "Concurrent HTTP requests exercise PostgREST; SQL lock instrumentation and connection identities are not captured."],
  };
  const save = () => writeFile(resolve(output, "checkpoint.json"), `${JSON.stringify(evidence, null, 2)}\n`);
  await save();
  try {
    const inventory = await verifyIsolatedTarget(target, credentials.serviceRoleKey);
    await writeFile(resolve(output, "migration-attestation.json"), `${JSON.stringify({ revision: SCHEMA_REVISION, inventory, executedSchemaProof: "unrun" }, null, 2)}\n`, { flag: "wx" });
    evidence.cases.push("exact disposable marker verified before writes"); await save();
    async function api(path: string, token: string, method = "GET", body?: unknown, service = false) {
      const response = await fetch(`${target.url}${path}`, { method, headers: { apikey: service ? credentials.serviceRoleKey : credentials.anonKey, Authorization: `Bearer ${token}`, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), redirect: "error", cache: "no-store", signal: AbortSignal.timeout(15000) });
      return { status: response.status, value: await response.json() };
    }
    async function user() {
      const password = `${randomUUID()}Aa9!`;
      const email = `${randomUUID()}@example.invalid`;
      const created = await api("/auth/v1/admin/users", credentials.serviceRoleKey, "POST", { email, password, email_confirm: true }, true);
      assert([200, 201].includes(created.status), "disposable_user_creation");
      const session = await api("/auth/v1/token?grant_type=password", credentials.anonKey, "POST", { email, password });
      assert.equal(session.status, 200, "disposable_signin");
      const token = session.value.access_token as string;
      const verified = await supabaseVerifier(target.url, credentials.anonKey)(new Request("https://acceptance.invalid/", { headers: { Authorization: `Bearer ${token}` } }));
      assert.equal(verified.id, created.value.id, "auth_subject_match");
      return verified;
    }
    const publicMarker = await api(`/rest/v1/wd_readiness_target?id=eq.${target.nonce}&select=id`, credentials.anonKey);
    requireSafe([401, 403].includes(publicMarker.status), "server_only_marker_required");
    evidence.lastStep = "synthetic_auth_users"; await save();
    const a = await user(), b = await user();
    const handler = accountHandler({ verify: supabaseVerifier(target.url, credentials.anonKey), repository: supabaseAccountRepository(target.url, credentials.anonKey) });
    const call = (token: string, method: string, body?: unknown, key = randomUUID()) => handler(new Request("https://acceptance.invalid/api/v1/account", { method, headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "idempotency-key": key }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) }));
    for (const u of [a, b]) assert.equal((await call(u.token, "POST", {})).status, 200, "initialize");
    const parts = a.token.split("."); parts[2] = `${parts[2][0] === "A" ? "B" : "A"}${parts[2].slice(1)}`;
    assert.equal((await call(parts.join("."), "GET")).status, 401, "forged_signature_denied");
    evidence.cases.push("real Auth password sessions, verified subjects and forged JWT denial");
    evidence.lastStep = "ownership_rls"; await save();
    for (const [u, other] of [[a, b], [b, a]]) {
      const rows = await api("/rest/v1/wd_accounts?select=user_id", u.token);
      assert.equal(rows.status, 200); assert.deepEqual(rows.value, [{ user_id: u.id }], "RLS_own_row_only");
      const hidden = await api(`/rest/v1/wd_accounts?user_id=eq.${other.id}&select=user_id`, u.token);
      assert.equal(hidden.status, 200); assert.deepEqual(hidden.value, [], "other_account_hidden");
      const direct = await api(`/rest/v1/wd_accounts?user_id=eq.${u.id}`, u.token, "PATCH", { revision: 99 });
      assert([401, 403].includes(direct.status), "direct_write_denied");
      const bill = await api("/rest/v1/rpc/wd_billing_command", u.token, "POST", { p_action: "bind", p_body: { userId: other.id } });
      assert([401, 403].includes(bill.status), "client_billing_denied");
    }
    evidence.cases.push("A/B RLS rows, cross-account reads and direct account/billing writes denied");
    const prefs = { diet: "none", allergens: [], excludedSkuIds: [], household: 2, notifications: false };
    assert.equal((await call(a.token, "PATCH", { revision: 1, preferences: { ...prefs, tier: "protein" } })).status, 400, "client_tier_denied");
    evidence.lastStep = "concurrent_revisions_and_retries"; await save();
    const parallel = await Promise.all([call(a.token, "PATCH", { revision: 1, preferences: prefs }), call(a.token, "PATCH", { revision: 1, preferences: { ...prefs, household: 3 } })]);
    assert.deepEqual(parallel.map(r => r.status).sort(), [200, 409], "single_revision_winner");
    const key = randomUUID(), body = { revision: 2, preferences: prefs };
    const retries = await Promise.all([call(a.token, "PATCH", body, key), call(a.token, "PATCH", body, key)]);
    assert(retries.every(r => r.status === 200));
    assert.deepEqual(await retries[0].json(), await retries[1].json(), "atomic_same_key_replay");
    assert.equal((await call(a.token, "PATCH", { ...body, revision: 3 }, key)).status, 409, "changed_key_conflict");
    const aRead = await (await call(a.token, "GET")).json(), bRead = await (await call(b.token, "GET")).json();
    assert.equal(aRead.result.revision, 3); assert.equal(bRead.result.revision, 1, "switch_has_no_A_preferences");
    evidence.cases.push("overlapping revisions, atomic retries, idempotency conflict and A/B session switching");
    evidence.lastStep = "synthetic_billing_ownership"; await save();
    const billing = supabaseBillingRepository(target.url, credentials.serviceRoleKey);
    const bindings = await Promise.all([billing.bind(a.id), billing.bind(b.id)]);
    assert.notEqual(bindings[0].appUserId, bindings[1].appUserId);
    assert.deepEqual(await billing.bind(a.id), bindings[0]);
    const starts = await Promise.all([billing.begin(a.id, "SANDBOX"), billing.begin(b.id, "SANDBOX")]);
    const now = Date.now();
    const state = { state: "active" as const, expiresAt: now + 60000, observedAt: now, reason: "synthetic_acceptance", transactionHash: randomUUID().replaceAll("-", "").repeat(2) };
    const committed = await Promise.all(starts.map((start, i) => billing.commit(i === 0 ? a.id : b.id, "SANDBOX", start.generation, state)));
    assert.equal(committed.filter(s => s.state === "active").length, 1, "one_transaction_owner");
    const holds = await Promise.all([billing.begin(a.id, "SANDBOX"), billing.begin(b.id, "SANDBOX")]);
    assert(holds.every(s => s.binding.held), "ownership_conflict_held");
    evidence.cases.push("opaque stable A/B identities and overlapping synthetic transaction ownership held");
    evidence.lastStep = "deletion_and_old_session"; await save();
    assert.equal((await call(a.token, "DELETE", { confirmation: "yes" })).status, 400);
    const deletion = await call(a.token, "DELETE", { confirmation: "DELETE MY ACCOUNT" });
    assert.equal(deletion.status, 200); assert.equal((await deletion.json()).result.subscriptionCancelled, false);
    assert.equal((await call(a.token, "GET")).status, 410, "old_session_tombstone_denied");
    assert.equal((await call(b.token, "GET")).status, 200, "B_survives_A_deletion");
    evidence.cases.push("intentional deletion, immediate tombstone denial and B isolation");
    // A future hosted operator must separately bind/authorize verified durable 0013 adapters.
    // Direct admin Auth removal is not durable lifecycle acceptance and is never run here.
    evidence.status = "unavailable"; evidence.lastStep = "durable_hosted_adapters_unbound"; await save();
    await writeFile(resolve(output, "result.json"), `${JSON.stringify(evidence, null, 2)}\n`, { flag: "wx" });
    console.log(`Isolated ownership checks passed; durable hosted acceptance unavailable. Evidence: ${output}`);
    process.exitCode = 1;
  } catch {
    evidence.status = "failed"; await save();
    // Never stringify exceptions/assertions: they may contain credentials, JWTs or user data.
    console.error(`Isolated acceptance failed at ${evidence.lastStep}. Evidence: ${output}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--manifest") { console.error("Required: --manifest <absolute external disposable manifest path>"); process.exitCode = 1; }
  else { try { await runIsolated(args[1]); } catch { console.error("Isolated acceptance refused before execution: invalid or unavailable manifest, paths or credentials."); process.exitCode = 1; } }
}
