import test from "node:test";
import assert from "node:assert/strict";
import { createCurrentOwnerSupabaseRpcDriver } from "./generated-current-rpc-driver.ts";

const url = "https://zpvqxtklvjitofpbddrn.supabase.co";
const input = { ownerId: "10000000-0000-4000-8000-000000000101", accountRevision: 1, scopeKey: "a".repeat(64), action: "read_state" as const, body: {} };
test("configured owner RPC uses the exact project/function and never discovers keys or retries", async () => {
  let calls = 0;
  const driver = createCurrentOwnerSupabaseRpcDriver(url, "synthetic-only-not-a-key", async (target, options) => {
    calls++; assert.equal(target, url + "/rest/v1/rpc/wd_current_plan_rpc");
    assert.equal(options?.method, "POST"); assert.equal(options?.redirect, "error"); assert.equal(options?.cache, "no-store");
    assert.equal(options?.signal instanceof AbortSignal, true);
    assert.deepEqual(JSON.parse(options?.body as string), { p_owner: input.ownerId, p_account_revision: 1, p_scope_key: input.scopeKey, p_action: "read_state", p_body: {}, p_access_expires_at: null });
    return Response.json({ state: null, meta: null });
  });
  assert.equal(calls, 0);
  assert.deepEqual(await driver.call(input), { state: null, meta: null }); assert.equal(calls, 1);
  for (const target of ["http://zpvqxtklvjitofpbddrn.supabase.co", url + "/", "https://other.supabase.co", url + "@evil.invalid"]) {
    assert.throws(() => createCurrentOwnerSupabaseRpcDriver(target, "synthetic-only"), /unavailable/);
  }
});
test("owner RPC bounds responses and redacts failures without repeating an uncertain request", async () => {
  const cases: (() => Promise<Response>)[] = [
    async () => { throw Error("synthetic private transport detail"); },
    async () => new Response("synthetic private diagnostic", { status: 500 }),
    async () => new Response("{}", { headers: { "Content-Type": "text/html" } }),
    async () => new Response("{", { headers: { "Content-Type": "application/json" } }),
    async () => new Response("{}", { headers: { "Content-Type": "application/json", "Content-Length": String(16 * 1024 * 1024 + 1) } }),
  ];
  for (const failure of cases) {
    let calls = 0;
    const driver = createCurrentOwnerSupabaseRpcDriver(url, "synthetic-only-not-a-key", async () => { calls++; return failure(); });
    await assert.rejects(driver.call(input), error => { assert.equal((error as Error).message, "Current owner RPC unavailable"); return true; });
    assert.equal(calls, 1);
  }
  let canceled = false, reads = 0;
  const stream = new ReadableStream<Uint8Array>({ pull(controller) { reads++; controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { canceled = true; } });
  const oversized = createCurrentOwnerSupabaseRpcDriver(url, "synthetic-only-not-a-key", async () => new Response(stream, { headers: { "Content-Type": "application/json" } }));
  await assert.rejects(oversized.call(input), /unavailable/); assert.equal(canceled, true); assert.ok(reads <= 18);
});
