import test from "node:test";
import assert from "node:assert/strict";
import { GET } from "../../preserved-api/support/poll/route.ts";

test("actual prepared poll rejects unauthenticated callers with no-store and no provider calls", async () => {
  const secret = process.env.CRON_SECRET; process.env.CRON_SECRET = "synthetic-cron-authorization";
  const request = globalThis.fetch; let calls = 0;
  globalThis.fetch = async () => { calls++; throw Error("must_not_call"); };
  try {
    for (const headers of [new Headers(), new Headers({ authorization: "Bearer wrong" })]) {
      const r = await GET(new Request("https://fixture.invalid/api/support/poll", { headers }));
      assert.equal(r.status, 401); assert.equal(r.headers.get("cache-control"), "no-store"); assert.deepEqual(await r.json(), { error: "unauthorized" });
    }
    assert.equal(calls, 0);
  } finally { globalThis.fetch = request; if (secret === undefined) delete process.env.CRON_SECRET; else process.env.CRON_SECRET = secret; }
});

test("actual prepared route redacts configuration errors before constructing any live adapter", async () => {
  const values = { CRON_SECRET: "synthetic-cron", NEXT_PUBLIC_SUPABASE_URL: "https://fixture.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "synthetic-service", SUPPORT_GMAIL_ADDRESS: "synthetic@example.invalid", SUPPORT_GMAIL_APP_PASSWORD: "synthetic-password", ANTHROPIC_API_KEY: "synthetic-classifier-key", WD_SUPPORT_OUTBOX_ENABLED: "true", WD_SUPPORT_DURABLE_SENDS_ENABLED: "false" };
  const old = Object.fromEntries(Object.keys(values).map(k => [k, process.env[k]])); Object.assign(process.env, values);
  const request = globalThis.fetch; let calls = 0; globalThis.fetch = async () => { calls++; throw Error("must_not_call"); };
  try {
    const r = await GET(new Request("https://fixture.invalid/api/support/poll", { headers: { authorization: "Bearer synthetic-cron" } }));
    assert.equal(r.status, 502); assert.equal(r.headers.get("cache-control"), "no-store"); assert.deepEqual(await r.json(), { error: "poll failed" }); assert.equal(calls, 0);
  } finally { globalThis.fetch = request; for (const [key, value] of Object.entries(old)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
});
