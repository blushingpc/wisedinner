import type { CurrentOwnerRpcDriver } from "./generated-current-rpc-state.ts";

const PROJECT = "zpvqxtklvjitofpbddrn";
const LIMIT = 16 * 1024 * 1024;
function unavailable(): never { throw new Error("Current owner RPC unavailable"); }

// Server-only configured transport. No credential discovery, connection, schema
// mutation, provider request or retry occurs at construction. The SQL function
// independently enforces service_role and the verified owner's active revision.
export function createCurrentOwnerSupabaseRpcDriver(url: string, serverKey: string, fetchImpl: typeof fetch = fetch): CurrentOwnerRpcDriver {
  if (url !== `https://${PROJECT}.supabase.co` || typeof serverKey !== "string" || !serverKey || serverKey.length > 8192 || /[\r\n]/.test(serverKey)) unavailable();
  return Object.freeze({
    async call(input: Parameters<CurrentOwnerRpcDriver["call"]>[0]) {
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const body = JSON.stringify({ p_owner: input.ownerId, p_account_revision: input.accountRevision, p_scope_key: input.scopeKey, p_action: input.action, p_body: input.body, p_access_expires_at: input.accessExpiresAt ?? null });
        if (Buffer.byteLength(body, "utf8") > LIMIT) unavailable();
        const response = await fetchImpl(`${url}/rest/v1/rpc/wd_current_plan_rpc`, {
          method: "POST", headers: { apikey: serverKey, Authorization: `Bearer ${serverKey}`, "Content-Type": "application/json" },
          body, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(12000),
        });
        if (!response.ok || response.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") unavailable();
        const length = response.headers.get("content-length");
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > LIMIT)) { await response.body?.cancel(); unavailable(); }
        reader = response.body?.getReader(); if (!reader) unavailable();
        const chunks: Uint8Array[] = []; let size = 0;
        while (true) {
          const result = await reader.read(); if (result.done) break;
          size += result.value.byteLength;
          if (size > LIMIT) { await reader.cancel(); unavailable(); }
          chunks.push(result.value);
        }
        return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      } catch { return unavailable(); }
      finally { reader?.releaseLock(); }
    },
  });
}
