import type { ReferenceStatePort, ReferenceEnvelope, StoredReferenceOperation } from "./generated-plan-state.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { UUID } from "./account.ts";
import { hash } from "../scripts/data/price-evidence.ts";

type Row = Record<string, unknown>;
export type ReferenceSqlTransaction = { query(sql: string, parameters?: unknown[]): Promise<{ rows: Row[] }> };
export type ReferenceSqlDriver = { transaction<T>(body: (transaction: ReferenceSqlTransaction) => Promise<T>): Promise<T> };
const SHA = /^[a-f0-9]{64}$/;
function refuse(): never { throw new Error("Reference SQL port refused"); }
function copy<T>(value: T): T {
  const result = canonicalReferenceData(value);
  if (Buffer.byteLength(JSON.stringify(result), "utf8") > 8 * 1024 * 1024) refuse();
  return result as T;
}
function revision(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string" || !/^(0|[1-9]\d*)$/.test(String(value))) refuse();
  const result = Number(value); if (!Number.isSafeInteger(result) || result >= Number.MAX_SAFE_INTEGER) refuse(); return result;
}
function envelope(value: unknown): ReferenceEnvelope {
  const copied = copy(value) as ReferenceEnvelope;
  if (!copied || typeof copied !== "object" || Array.isArray(copied) || Object.keys(copied).sort().join() !== "current,draft,revision") refuse();
  revision(copied.revision); return copied;
}
function storedOperation(value: unknown): StoredReferenceOperation {
  const copied = copy(value) as StoredReferenceOperation;
  if (!copied || typeof copied !== "object" || Array.isArray(copied) || Object.keys(copied).sort().join() !== "intentSha256,operationId,receipt" || !UUID.test(copied.operationId) || !SHA.test(copied.intentSha256) || copied.receipt?.operationId !== copied.operationId || !["acknowledged", "not_applied"].includes(copied.receipt.outcome)) refuse();
  return copied;
}

// Required injected driver and trusted opaque scope. Opens no connection and
// applies no DDL. Not an Auth/RLS adapter: hosted identity/role binding remains
// absent. A client JSON scope/owner claim must never create this port.
export function createPostgresReferenceStatePort(driver: ReferenceSqlDriver, trustedScopeKey: string): ReferenceStatePort {
  if (typeof driver?.transaction !== "function" || typeof trustedScopeKey !== "string" || !SHA.test(trustedScopeKey)) refuse();
  const lock = Buffer.from(trustedScopeKey.slice(0, 16), "hex"), first = lock.readInt32BE(0), second = lock.readInt32BE(4);
  return Object.freeze({
    async transaction<T>(body: Parameters<ReferenceStatePort["transaction"]>[0]): Promise<T> {
      return driver.transaction(async sql => {
        // One scope per transaction and transaction-scoped locks, never session
        // locks left on a pooled connection. Digest collisions only serialize.
        await sql.query("select set_config('statement_timeout','10000',true), set_config('lock_timeout','2000',true)");
        await sql.query("select pg_advisory_xact_lock($1::integer,$2::integer)", [first, second]);
        let active = true, committed = false, observed: ReferenceEnvelope | null | undefined;
        const readOperations = new Map<string, StoredReferenceOperation | null>();
        const check = (key: string) => { if (!active || committed || key !== trustedScopeKey) refuse(); };
        try {
          const result = await body({
            async readState(key) {
              check(key);
              const result = await sql.query("select revision,state,record_sha256 from wd_reference_private.states where scope_key=$1 for update", [trustedScopeKey]);
              if (result.rows.length > 1) refuse(); const row = result.rows[0];
              if (!row) { observed = null; return null; }
              const state = envelope(row.state);
              if (revision(row.revision) !== state.revision || hash(state) !== row.record_sha256) refuse();
              observed = state; return copy(state);
            },
            async readOperation(key, id) {
              check(key); if (typeof id !== "string" || !UUID.test(id)) refuse();
              const result = await sql.query("select operation_id,intent_sha256,operation,record_sha256 from wd_reference_private.operations where scope_key=$1 and operation_id=$2::uuid", [trustedScopeKey, id]);
              if (result.rows.length > 1) refuse(); const row = result.rows[0];
              if (!row) { readOperations.set(id, null); return null; }
              const operation = storedOperation(row.operation);
              if (operation.operationId !== row.operation_id || operation.operationId !== id || operation.intentSha256 !== row.intent_sha256 || hash(operation) !== row.record_sha256) refuse();
              readOperations.set(id, operation); return copy(operation);
            },
            async commit(key, stateValue, operationValue) {
              check(key);
              const state = envelope(stateValue), operation = storedOperation(operationValue), previous = observed ?? { revision: 0, current: null, draft: null };
              if (observed === undefined || !readOperations.has(operation.operationId) || readOperations.get(operation.operationId) !== null) refuse();
              if (operation.receipt.outcome === "acknowledged") {
                if (state.revision !== previous.revision + 1 || hash(copy(operation.receipt.state)) !== hash(state)) refuse();
              } else if (state.revision !== previous.revision || hash(state) !== hash(previous)) refuse();
              const saved = observed === null
                ? await sql.query("insert into wd_reference_private.states(scope_key,revision,state,record_sha256) values($1,$2,$3::jsonb,$4) on conflict do nothing returning scope_key", [trustedScopeKey, state.revision, JSON.stringify(state), hash(state)])
                : await sql.query("update wd_reference_private.states set revision=$2,state=$3::jsonb,record_sha256=$4 where scope_key=$1 and revision=$5 returning scope_key", [trustedScopeKey, state.revision, JSON.stringify(state), hash(state), previous.revision]);
              if (saved.rows.length !== 1 || saved.rows[0]!.scope_key !== trustedScopeKey) refuse();
              const receipt = await sql.query("insert into wd_reference_private.operations(scope_key,operation_id,intent_sha256,operation,record_sha256) values($1,$2::uuid,$3,$4::jsonb,$5) on conflict do nothing returning operation_id", [trustedScopeKey, operation.operationId, operation.intentSha256, JSON.stringify(operation), hash(operation)]);
              if (receipt.rows.length !== 1 || receipt.rows[0]!.operation_id !== operation.operationId) refuse();
              committed = true;
            },
          });
          return result as T;
        } finally { active = false; }
      });
    },
  });
}
