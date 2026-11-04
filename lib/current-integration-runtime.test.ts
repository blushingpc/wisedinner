import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { createCurrentIntegrationRuntime, CURRENT_INTEGRATION_ROUTES, CURRENT_INTEGRATION_SOURCE_MANIFEST, type CurrentIntegrationRuntimeDependencies, type CurrentLifecycleAdmission, type CurrentRetentionVerification } from "./current-integration-runtime.server.ts";

const host = "https://private.synthetic.invalid", target = "https://zpvqxtklvjitofpbddrn.supabase.co";
const key = (role: string) => "eyJhbGciOiJub25lIn0." + Buffer.from(JSON.stringify({ role })).toString("base64url") + ".synthetic";
const supabase = { origin: target, publicAuthKey: key("anon"), serverCredential: key("service_role") };
const request = (route: keyof typeof CURRENT_INTEGRATION_ROUTES, body = "{}", extra: RequestInit = {}) => new Request(host + CURRENT_INTEGRATION_ROUTES[route], { method: "POST", headers: { "Content-Type": "application/json" }, body, ...extra });

test("construction and inspection are default off, pure and secret-free even with configured factories", async () => {
  let effects = 0;
  const forbidden = () => { effects++; throw Error("private-canary-must-not-escape"); };
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: { identity: { verify: forbidden, readAccount: forbidden }, rpc: { call: forbidden } },
    lifecycle: { create: forbidden }, request: forbidden });
  assert.equal(effects, 0);
  assert.equal(runtime.inspect().routes.currentRead.state, "off");
  for (const name of Object.keys(CURRENT_INTEGRATION_ROUTES) as (keyof typeof CURRENT_INTEGRATION_ROUTES)[]) {
    const response = await runtime.routes[name](request(name)); assert.equal(response.status, 503); assert.equal(response.headers.get("cache-control"), "no-store");
  }
  const publicProjection = JSON.stringify([runtime.inspect(), runtime.sourceManifest]);
  assert.ok(!publicProjection.includes(supabase.publicAuthKey)); assert.ok(!publicProjection.includes(supabase.serverCredential));
  assert.doesNotMatch(publicProjection, /private-canary/); assert.equal(effects, 0);
});

test("malformed host/origin, missing or swapped credentials hold owner routes before effects", async () => {
  let effects = 0;
  const owner = { identity: { verify: async () => { effects++; throw Error("private-value"); }, readAccount: async () => { effects++; throw Error("private-value"); } }, rpc: { call: async () => { effects++; throw Error("private-value"); } } };
  const cases: CurrentIntegrationRuntimeDependencies[] = [
    { hostOrigin: "http://private.synthetic.invalid", supabase }, { hostOrigin: host + "/path", supabase }, { hostOrigin: "https://user:password@private.synthetic.invalid", supabase },
    { hostOrigin: host }, { hostOrigin: host, supabase: { ...supabase, origin: "https://other.supabase.co" } },
    { hostOrigin: host, supabase: { ...supabase, serverCredential: supabase.publicAuthKey } },
    { hostOrigin: host, supabase: { ...supabase, publicAuthKey: supabase.serverCredential } },
    { hostOrigin: host, supabase: { ...supabase, serverCredential: supabase.serverCredential + "\r\n" } },
  ];
  for (const config of cases) {
    const runtime = createCurrentIntegrationRuntime({ ...config, owner, flags: { currentRead: true, currentSession: true } });
    assert.equal((await runtime.routes.currentRead(request("currentRead"))).status, 503);
    assert.equal(runtime.inspect().routes.currentRead.state, "unsupported");
  }
  assert.equal(effects, 0);
});

test("route mounting enforces exact HTTPS destination/method and never consumes an unaccepted request body", async () => {
  let delegates = 0;
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, flags: { deletion: true }, lifecycle: { create: () => ({ custody: async () => { throw Error("wrong route"); }, deletion: async r => { delegates++; assert.equal(r.bodyUsed, false); return Response.json({ result: { outcome: "held", code: "original_unknown", retryAuthorized: false } }); } }) } });
  for (const url of ["http://private.synthetic.invalid" + CURRENT_INTEGRATION_ROUTES.deletion, "https://wrong.invalid" + CURRENT_INTEGRATION_ROUTES.deletion, host + CURRENT_INTEGRATION_ROUTES.deletion + "?owner=forged", host + "/wrong"]) {
    const r = new Request(url, { method: "POST", body: "private-text" }); assert.equal((await runtime.routes.deletion(r)).status, 409); assert.equal(r.bodyUsed, false);
  }
  assert.equal((await runtime.routes.deletion(request("deletion", undefined, { method: "GET", body: undefined }))).status, 405);
  const abort = new AbortController(); abort.abort(); assert.equal((await runtime.routes.deletion(request("deletion", "{}", { signal: abort.signal }))).status, 499);
  const accepted = request("deletion"); const reply = await runtime.routes.deletion(accepted);
  assert.equal((await reply.json()).result.code, "original_unknown"); assert.equal(delegates, 1); assert.equal(reply.headers.get("cache-control"), "no-store");
});

test("lifecycle factories are request-local, keep independent recovery and preserve pending/manual/unknown outcomes", async () => {
  let pairs = 0, consumed = 0;
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, flags: { appleCredential: true, deletion: true }, lifecycle: { create: admission => {
    pairs++; assert.equal(admission, undefined); const pair = pairs;
    const handler = (name: string) => async (r: Request) => { assert.equal(r.bodyUsed, false); const body = await r.json(); consumed++; return Response.json({ name, pair, owner: body.owner, result: { outcome: "held", code: body.code, statusRequired: true, retryAuthorized: false } }); };
    return { custody: handler("custody"), deletion: handler("deletion") };
  } } });
  assert.equal(pairs, 0); assert.equal(runtime.inspect().routes.deletion.state, "configured");
  const a = await runtime.routes.deletion(request("deletion", JSON.stringify({ owner: "A", code: "transport_unknown" })));
  const b = await runtime.routes.appleCredential(request("appleCredential", JSON.stringify({ owner: "B", code: "original_status_required" })));
  const c = await runtime.routes.deletion(request("deletion", JSON.stringify({ owner: "A", code: "manual_required" })));
  const [x, y, z] = await Promise.all([a.json(), b.json(), c.json()]);
  assert.deepEqual([x.owner, y.owner, z.owner], ["A", "B", "A"]); assert.deepEqual([x.pair, y.pair, z.pair], [1, 2, 3]);
  assert.equal(y.name, "custody"); assert.equal(x.name, "deletion"); assert.equal(z.result.code, "manual_required");
  assert.equal(consumed, 3); assert.equal(pairs, 3);
  assert.equal(runtime.inspect().verification.provider, false);
});

test("frozen cleanup contract is numeric; lifecycle owns maintenance before prepare, independent recovery stays available", async () => {
  // Contract-only peer fixture. This is not the unaccepted Backend1/5 producer.
  const at = 1_800_000_000_000, digest = "a".repeat(64); let cleanupCalls = 0;
  let proof: CurrentRetentionVerification = { outcome: "held" };
  const admission: CurrentLifecycleAdmission = { enabled: true, origin: target, serverCredential: supabase.serverCredential,
    verify: async () => { throw Error("recovery must not need renewed Auth"); },
    cleanup: { async verify(input) { cleanupCalls++; assert.deepEqual(input, { policySha256: digest, now: at }); return proof; } } };
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, flags: { deletion: true }, lifecycle: { admission, create: captured => ({
    custody: async () => Response.json({ outcome: "held" }),
    deletion: async r => {
      const value = await r.json();
      if (value.operation === "status") return Response.json({ result: { outcome: "status", original: value.original, retryAuthorized: false } });
      const verified = await captured!.cleanup!.verify({ policySha256: digest, now: at });
      return Response.json({ result: { outcome: verified.outcome === "verified" && Number.isSafeInteger(verified.validUntil) && verified.validUntil > at && verified.policySha256 === digest ? "prepared" : "held" } });
    },
  }) } });
  assert.equal(cleanupCalls, 0);
  assert.equal((await (await runtime.routes.deletion(request("deletion", '{"operation":"prepare"}'))).json()).result.outcome, "held");
  const recovery = await (await runtime.routes.deletion(request("deletion", '{"operation":"status","original":"same-original"}'))).json();
  assert.equal(recovery.result.original, "same-original"); assert.equal(cleanupCalls, 1);
  proof = { outcome: "verified", policySha256: digest, evidenceSha256: digest, validUntil: at + 10 };
  assert.equal((await (await runtime.routes.deletion(request("deletion", '{"operation":"prepare"}'))).json()).result.outcome, "prepared");
  proof = { ...proof, validUntil: at - 1 };
  assert.equal((await (await runtime.routes.deletion(request("deletion", '{"operation":"prepare"}'))).json()).result.outcome, "held");
});

test("private configuration is captured; keyring/policies cannot mutate or leak through projections/errors", async () => {
  const bytes = Buffer.alloc(32, 7), keys = new Map([["v1", bytes]]); let seen = 0;
  const admission: CurrentLifecycleAdmission = { enabled: true, origin: target, serverCredential: "private-canary-service", keyring: keys, verify: async () => { throw Error("private-canary-verify"); } };
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, flags: { deletion: true }, lifecycle: { admission, create: captured => {
    assert.equal(captured!.keyring!.get("v1")![0], 7); seen++;
    captured!.keyring!.get("v1")![0] = 99;
    return { custody: async () => { throw Error("private-canary-custody"); }, deletion: async () => { throw Error("private-canary-deletion"); } };
  } } });
  bytes.fill(1); keys.clear();
  for (let n = 0; n < 2; n++) { const r = await runtime.routes.deletion(request("deletion")); assert.doesNotMatch(await r.text(), /private-canary/); }
  assert.equal(seen, 2); assert.doesNotMatch(JSON.stringify([runtime.inspect(), runtime.sourceManifest]), /private-canary/);
});

test("source manifest covers actual transitive relative runtime imports without key/test/client inclusion", () => {
  const manifest = CURRENT_INTEGRATION_SOURCE_MANIFEST, root = new URL("../", import.meta.url), todo: string[] = [manifest.entry], seen = new Set<string>();
  while (todo.length) {
    const name = todo.pop()!; if (seen.has(name)) continue; seen.add(name);
    assert.ok(manifest.codeAndAssets.includes(name), "unlisted dependency " + name);
    const url = new URL(name, root), content = readFileSync(url, "utf8");
    if (!name.endsWith(".ts")) continue;
    for (const match of content.matchAll(/(?:from\s*|import\s*)["']([^"']+)["']/g)) {
      if (match[1].startsWith(".")) todo.push(new URL(match[1], url).pathname.slice(root.pathname.length));
    }
  }
  assert.ok(seen.size > 40); assert.equal(manifest.peerGraphsAccepted, false);
  for (const name of manifest.codeAndAssets) { assert.doesNotMatch(name, /\.test\.|\.env|\.p8|client|node_modules|media\//); assert.doesNotThrow(() => readFileSync(new URL(name, root))); }
  for (const name of manifest.environmentNames) assert.match(name, /^[A-Z][A-Z0-9_]+$/);
  const asset = readFileSync(new URL("lib/generated-current-source-capsule-v4.json", root)); assert.equal(createHash("sha256").update(asset).digest("hex").length, 64);
});


test("constructor rejects accessor configuration without executing getters or callable metadata", () => {
  let reads = 0;
  const malicious = Object.defineProperty({}, "hostOrigin", { get() { reads++; throw Error("private"); } });
  assert.doesNotThrow(() => createCurrentIntegrationRuntime(malicious).inspect());
  assert.equal(reads, 0);
  const verify = async () => { throw Error("unused"); };
  Object.defineProperty(verify, "bind", { get() { reads++; throw Error("bind metadata"); } });
  Object.defineProperty(verify, "name", { get() { reads++; throw Error("name metadata"); } });
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: { identity: { verify, readAccount: async () => { throw Error("unused"); } }, rpc: { call: async () => { throw Error("unused"); } } } });
  runtime.inspect(); assert.equal(reads, 0);
});

test("legacy HTTP access stub cannot be admitted as billing dependencies", () => {
  const legacy = { environment: "SANDBOX", access: async () => Response.json({ allowed: true }) };
  const runtime = createCurrentIntegrationRuntime({ subscription: legacy } as unknown as CurrentIntegrationRuntimeDependencies);
  assert.equal(runtime.inspect().subscription.state, "unsupported");
});


test("host coercion, nested getters and captured receiver methods cannot execute during inspection", async () => {
  let reads = 0;
  const coercion = { toString() { reads++; return host; } };
  createCurrentIntegrationRuntime({ hostOrigin: coercion } as unknown as CurrentIntegrationRuntimeDependencies).inspect();
  const identity = Object.defineProperty({}, "verify", { get() { reads++; throw Error("getter"); } });
  createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner: { identity, rpc: {} } } as unknown as CurrentIntegrationRuntimeDependencies).inspect();
  assert.equal(reads, 0);
  const lifecycle = { marker: "captured", create() { assert.equal(this.marker, "captured"); return { marker: "handler", async custody() { throw Error("unused"); }, async deletion() { assert.equal(this.marker, "handler"); return Response.json({ held: true }); } }; } };
  const runtime = createCurrentIntegrationRuntime({ hostOrigin: host, flags: { deletion: true }, lifecycle });
  assert.equal((await runtime.routes.deletion(request("deletion"))).status, 200); assert.equal(reads, 0);
});

test("explicit final V5 requires the full immutable tuple before owner/factory effects", async () => {
  const { CURRENT_INTEGRATION_REFERENCE_V5_IDENTITY: v5 } = await import("./current-integration-reference-v5.server.ts");
  let effects = 0;
  const forbidden = async () => { effects++; throw Error("must remain closed"); };
  const owner = { identity: { verify: forbidden, readAccount: forbidden }, rpc: { call: forbidden } };
  const configured = () => { effects++; throw Error("not during construction/inspection"); };
  const good = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner, flags: { currentSession: true }, source: { expected: v5, create: configured } });
  assert.equal(good.inspect().routes.currentSession.state, "configured"); assert.equal(effects, 0);
  const cases = [
    { ...v5, configurationSha256: "f".repeat(64) }, { ...v5, sourcePolicyBasisSha256: "f".repeat(64) },
    { ...v5, reviewedDataSha256: "f".repeat(64) }, { ...v5, evidenceManifestSha256: "f".repeat(64) },
    { ...v5, guidePolicy: { ...v5.guidePolicy, sha256: "f".repeat(64) } },
    { ...v5, window: { ...v5.window, lastDay: "2026-12-01", commitBefore: Date.parse("2026-12-02T00:00:00Z") } },
    { ...v5, reviewRevision: 6 }, { ...v5, sourceSha256: "f".repeat(64) },
  ];
  for (const expected of cases) {
    const closed = createCurrentIntegrationRuntime({ hostOrigin: host, supabase, owner, flags: { currentSession: true }, source: { expected, create: configured } });
    assert.equal(closed.inspect().routes.currentSession.state, "unsupported"); assert.equal((await closed.routes.currentSession(request("currentSession"))).status, 503);
  }
  assert.equal(effects, 0);
});