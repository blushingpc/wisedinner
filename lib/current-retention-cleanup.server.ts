import { randomUUID } from "node:crypto";
import { appleDigest, appleExact, appleHttp, appleOrigin, appleUuid, inspectApplePolicy, parseAppleJson } from "./apple-token-custody.server.ts";
import { inspectDeletionV2Policy } from "./account-deletion-v2.server.ts";

export const CURRENT_RETENTION = "wd-current-retention-v1";
type Data = Record<string, unknown>;
export type RetentionResult = Readonly<{ outcome: "held" } | { outcome: "verified"; policySha256: string; evidenceSha256: string; validUntil: number }>;
export type RetentionRepository = Readonly<{ command(action: "inventory" | "reserve" | "status", body: Data): Promise<unknown> }>;
export type RetentionEraseInput = Readonly<{ ownerId: string; lineageId: string; policySha256: string }>;
export type CurrentRetentionCleanupDependencies = Readonly<{
  deletionPolicy: unknown; custodyPolicy: unknown;
  schemaSha256: string; eraserSha256: string;
  maxRecords: number; freshnessMs: number; clockSkewMs: number;
  repository: RetentionRepository;
  // Independently admitted direct0023 executor, never lifecycle.eraseExpiredCredential.
  eraseExpired(input: RetentionEraseInput): Promise<unknown>;
  readAdmission(input: Readonly<{ policySha256: string; custodyPolicySha256: string; now: number }>): Promise<unknown>;
  clock?: () => number;
}>;
const HELD = Object.freeze({ outcome: "held" as const });
const sha = (x: unknown): string => { if (typeof x !== "string" || !/^[a-f0-9]{64}$/.test(x)) throw Error("invalid_digest"); return x; };
const integer = (x: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => { if (!Number.isSafeInteger(x) || (x as number) < min || (x as number) > max) throw Error("invalid_number"); return x as number; };
const exact = (x: unknown, keys: string[]) => appleExact(x, keys);
const bool = (x: unknown): boolean => { if (typeof x !== "boolean") throw Error("invalid_boolean"); return x; };
const uuid = (x: unknown) => appleUuid(x);
type Candidate = { ownerId: string; lineageId: string; operationId: string; intentSha256: string; policySha256: string; dueAt: number; state: string; attemptId: string | null };
const candidateKeys = ["ownerId", "lineageId", "operationId", "intentSha256", "policySha256", "dueAt", "state", "attemptId"];
function candidate(x: unknown, policy: string): Candidate {
  const r = exact(x, candidateKeys);
  if (sha(r.policySha256) !== policy || !["available", "revoking", "revoke_unknown", "erased"].includes(String(r.state)) || r.state === "erased" && r.attemptId === null) throw Error("invalid_candidate");
  return { ownerId: uuid(r.ownerId), lineageId: uuid(r.lineageId), operationId: uuid(r.operationId), intentSha256: sha(r.intentSha256), policySha256: policy, dueAt: integer(r.dueAt), state: String(r.state), attemptId: r.attemptId === null ? null : uuid(r.attemptId) };
}

// Construction snapshots data and callbacks, but does not read env, clock,
// admission, inventory, provider, key material or any other external source.
export function createCurrentRetentionCleanup(input?: CurrentRetentionCleanupDependencies): Readonly<{ verify(input: Readonly<{ policySha256: string; now: number }>): Promise<RetentionResult> }> {
  let deps: CurrentRetentionCleanupDependencies | undefined, deletionHash = "", custodyHash = "", custodyPolicy: unknown;
  try {
    if (!input) throw Error("unconfigured");
    const deletionPolicy = inspectDeletionV2Policy(input.deletionPolicy);
    custodyPolicy = inspectApplePolicy(input.custodyPolicy);
    deletionHash = appleDigest(deletionPolicy); custodyHash = appleDigest(custodyPolicy);
    sha(input.schemaSha256); sha(input.eraserSha256);
    integer(input.maxRecords, 1, 256); integer(input.freshnessMs, 1, 60000); integer(input.clockSkewMs, 0, 60000);
    if (typeof input.repository?.command !== "function" || typeof input.eraseExpired !== "function" || typeof input.readAdmission !== "function" || input.clock !== undefined && typeof input.clock !== "function") throw Error("unconfigured");
    deps = Object.freeze({ ...input, deletionPolicy, custodyPolicy, repository: Object.freeze({ command: input.repository.command.bind(input.repository) }), eraseExpired: input.eraseExpired.bind(input), readAdmission: input.readAdmission.bind(input) });
  } catch { /* A partial configuration is inert and held. */ }
  // Serialize callers sharing this instance. Independent instances are fenced by
  // the durable per-lineage reservation, not an in-process success cache.
  let queue: Promise<unknown> = Promise.resolve();
  async function verify(value: Readonly<{ policySha256: string; now: number }>): Promise<RetentionResult> {
    if (!deps) return HELD;
    const d = deps;
    try {
      const v = exact(value, ["policySha256", "now"]), requestedAt = integer(v.now);
      if (sha(v.policySha256) !== deletionHash) return HELD;
      const clock = () => integer((d.clock ?? Date.now)());
      const started = clock();
      if (Math.abs(started - requestedAt) > d.clockSkewMs) return HELD;
      const observed: number[] = [], horizons: number[] = [];
      const fresh = (x: unknown) => { const n = integer(x), now = clock(); if (n > now + d.clockSkewMs || now - n > d.freshnessMs) throw Error("stale_observation"); observed.push(n); horizons.push(n + d.freshnessMs); return n; };
      const schema = (r: Data) => { if (sha(r.schemaSha256) !== d.schemaSha256 || sha(r.eraserSha256) !== d.eraserSha256) throw Error("schema_changed"); fresh(r.observedAt); };
      const admission = exact(await d.readAdmission({ policySha256: deletionHash, custodyPolicySha256: custodyHash, now: requestedAt }), ["outcome", "registryId", "policySha256", "custodyPolicySha256", "schemaSha256", "eraserSha256", "observedAt", "validUntil"]);
      if (admission.outcome !== "admitted" || admission.registryId !== "wd-apple-custody-v1" || admission.policySha256 !== deletionHash || admission.custodyPolicySha256 !== custodyHash) return HELD;
      schema(admission); horizons.push(integer(admission.validUntil));
      if (Math.min(...horizons) <= clock()) return HELD;
      const common = { policySha256: deletionHash, custodyPolicySha256: custodyHash, custodyPolicy, maxRecords: d.maxRecords };
      const readInventory = async () => {
        const r = exact(await d.repository.command("inventory", common), ["contract", "registryId", "policySha256", "custodyPolicySha256", "schemaSha256", "eraserSha256", "observedAt", "dueCount", "unknownCount", "foreignPolicyCount", "overflow", "nextDueAt", "rows"]);
        if (r.contract !== CURRENT_RETENTION || r.registryId !== "wd-apple-custody-v1" || r.policySha256 !== deletionHash || r.custodyPolicySha256 !== custodyHash) throw Error("inventory_binding");
        schema(r);
        const due = integer(r.dueCount), unknown = integer(r.unknownCount), foreign = integer(r.foreignPolicyCount);
        if (bool(r.overflow) || unknown !== 0 || foreign !== 0 || due > d.maxRecords || !Array.isArray(r.rows) || r.rows.length !== due) throw Error("inventory_incomplete");
        const rows = r.rows.map(x => candidate(x, custodyHash));
        if (new Set(rows.map(x => x.lineageId)).size !== rows.length) throw Error("inventory_duplicate");
        if (rows.some(x => x.dueAt > integer(r.observedAt))) throw Error("not_due");
        if (r.nextDueAt !== null) { const next = integer(r.nextDueAt); if (next <= integer(r.observedAt)) throw Error("invalid_next_due"); horizons.push(next); }
        return { raw: r, rows };
      };
      const readStatus = async (row: Candidate, attemptId: string) => {
        const r = exact(await d.repository.command("status", { ...common, ownerId: row.ownerId, lineageId: row.lineageId, operationId: row.operationId, intentSha256: row.intentSha256, attemptId }), ["contract", "schemaSha256", "eraserSha256", "observedAt", "ownerId", "lineageId", "operationId", "intentSha256", "policySha256", "attemptId", "state", "envelopePresent", "providerState"]);
        schema(r);
        if (r.contract !== CURRENT_RETENTION || r.ownerId !== row.ownerId || r.lineageId !== row.lineageId || r.operationId !== row.operationId || r.intentSha256 !== row.intentSha256 || r.policySha256 !== custodyHash || r.attemptId !== attemptId || !["admitted", "started", "stored", "reused", "refused", "unknown", "erased"].includes(String(r.providerState))) throw Error("original_status_mismatch");
        if (r.state !== "erased" || bool(r.envelopePresent)) throw Error("original_unresolved");
        return r;
      };
      const before = await readInventory(), afterimages: Data[] = [];
      for (const row of before.rows) {
        if (Math.min(...horizons) <= clock()) return HELD;
        if (row.attemptId) { afterimages.push(await readStatus(row, row.attemptId)); continue; }
        const proposed = randomUUID();
        const reserved = exact(await d.repository.command("reserve", { ...common, ownerId: row.ownerId, lineageId: row.lineageId, operationId: row.operationId, intentSha256: row.intentSha256, attemptId: proposed }), ["contract", "schemaSha256", "eraserSha256", "observedAt", "ownerId", "lineageId", "operationId", "intentSha256", "policySha256", "attemptId", "fresh"]);
        schema(reserved);
        if (reserved.contract !== CURRENT_RETENTION || reserved.ownerId !== row.ownerId || reserved.lineageId !== row.lineageId || reserved.operationId !== row.operationId || reserved.intentSha256 !== row.intentSha256 || reserved.policySha256 !== custodyHash) throw Error("reservation_binding");
        const attemptId = uuid(reserved.attemptId), isFresh = bool(reserved.fresh);
        if (isFresh && attemptId !== proposed) throw Error("reservation_original");
        let eraseAck = "original_status_only";
        if (isFresh) {
          if (Math.min(...horizons) <= clock()) return HELD;
          // A rejected/lost ACK never authorizes a second call. A matching
          // durable afterimage is the only path to verified after uncertainty.
          eraseAck = "unknown";
          try {
            const ack = exact(await d.eraseExpired({ ownerId: row.ownerId, lineageId: row.lineageId, policySha256: custodyHash }), ["outcome", "lineageId", "policySha256"]);
            if (ack.outcome === "erased" && ack.lineageId === row.lineageId && ack.policySha256 === custodyHash) eraseAck = "confirmed";
          } catch { /* Status, never resend. */ }
        }
        afterimages.push({ original: await readStatus(row, attemptId), eraseAck });
      }
      const after = await readInventory();
      if (after.rows.length !== 0) return HELD;
      const finished = clock(), validUntil = integer(Math.min(...horizons));
      if (finished < started || finished - started > d.freshnessMs || Math.abs(finished - requestedAt) > d.freshnessMs + d.clockSkewMs || validUntil <= Math.max(finished, requestedAt)) return HELD;
      return Object.freeze({ outcome: "verified", policySha256: deletionHash, evidenceSha256: appleDigest({ contract: CURRENT_RETENTION, admission, before: before.raw, afterimages, after: after.raw, observed }), validUntil });
    } catch { return HELD; }
  }
  return Object.freeze({ verify(value) { const p = queue.then(() => verify(value)); queue = p.catch(() => {}); return p; } });
}

// Main injects this port only after actual schema/eraser admission. This adapter
// does not read secrets or perform IO until explicitly called.
export function createCurrentRetentionRpcPorts(origin: string, serverCredential: string, request: typeof fetch = fetch): RetentionRepository & { eraseExpired(input: RetentionEraseInput): Promise<unknown> } {
  const base = appleOrigin(origin);
  if (typeof serverCredential !== "string" || !serverCredential || serverCredential.length > 16384 || /[\r\n]/.test(serverCredential)) throw Error("invalid_credential");
  const rpc = async (name: string, action: string, body: unknown) => {
    const payload = JSON.stringify({ p_action: action, p_body: body });
    if (Buffer.byteLength(payload) > 32768) throw Error("capacity_exceeded");
    const response = await appleHttp(base + "/rest/v1/rpc/" + name, { method: "POST", headers: { apikey: serverCredential, authorization: "Bearer " + serverCredential, "content-type": "application/json" }, body: payload }, request, 262144);
    if (response.status !== 200) throw Error("retention_transport_unknown");
    return parseAppleJson(response.text);
  };
  return Object.freeze({ command: (action, body) => { if (!["inventory", "reserve", "status"].includes(action)) throw Error("invalid_action"); return rpc("wd_current_retention_inventory_command", action, body); }, eraseExpired: body => rpc("wd_current_credential_expiry_command", "erase_expired", body) });
}
