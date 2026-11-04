import test from "node:test";
import assert from "node:assert/strict";
import { createCurrentIntegrationHost, withCurrentIntegrationHostResolver } from "./current-integration-host.server.ts";
import { createCurrentLifecycleHostAdapter } from "./current-lifecycle-host-admission.server.ts";
import { POST as deletionPOST } from "../app/api/v1/account/deletion-v2/route.ts";
import { POST as custodyPOST } from "../app/api/v1/account/apple-credential/route.ts";

// These tests compose the actual canonical HTTP exports, runtime and lifecycle
// adapter. They deliberately supply NO mutation admission, policy or real
// credentials. A configured route must not invent permission or provider proof.
const HOST = "https://runtime.example";
function composed() {
  const actual = createCurrentLifecycleHostAdapter();
  let pairs = 0;
  const seen: Request[] = [];
  const lifecycle = {
    create() {
      pairs++;
      const pair = actual.create();
      return {
        custody(request: Request) { seen.push(request); return pair.custody(request); },
        deletion(request: Request) { seen.push(request); return pair.deletion(request); },
      };
    },
  };
  const deps = { hostOrigin: HOST, flags: { appleCredential: true, deletion: true }, lifecycle };
  return { deps, seen, pairs: () => pairs };
}
function request(path: string) {
  return new Request(HOST + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: "status" }) });
}

test("composed host inspection does not construct lifecycle handlers or admit mutations", () => {
  const f = composed();
  const host = createCurrentIntegrationHost(f.deps);
  const inspection = host.inspect();
  assert.equal(f.pairs(), 0);
  assert.equal(inspection.productionReady, false);
  assert.deepEqual(inspection.verification, { hosted: false, provider: false, native: false, device: false });
});

test("both actual lifecycle HTTP exports preserve the original request and hold without admission", async () => {
  const f = composed();
  for (const [path, post] of [["/api/v1/account/deletion-v2", deletionPOST], ["/api/v1/account/apple-credential", custodyPOST]] as const) {
    const original = request(path);
    const response = await withCurrentIntegrationHostResolver({ resolve: () => f.deps }, () => post(original));
    assert.equal(response.status, 503);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.equal((await response.json()).result.outcome, "held");
    assert.equal(f.seen.at(-1), original);
    assert.equal(original.bodyUsed, false);
  }
  assert.equal(f.pairs(), 2);
});

test("invalid HTTP route identity stops before the real lifecycle pair is constructed", async () => {
  const f = composed();
  const response = await withCurrentIntegrationHostResolver({ resolve: () => f.deps }, () => deletionPOST(request("/api/v1/account/deletion-v2?unexpected=1")));
  assert.equal(response.status, 409);
  assert.equal(f.pairs(), 0);
  assert.equal(f.seen.length, 0);
});

test("parallel server resolver contexts do not share lifecycle instances", async () => {
  const a = composed(), b = composed();
  const requestA = request("/api/v1/account/deletion-v2"), requestB = request("/api/v1/account/apple-credential");
  const responses = await Promise.all([
    withCurrentIntegrationHostResolver({ resolve: async () => { await Promise.resolve(); return a.deps; } }, () => deletionPOST(requestA)),
    withCurrentIntegrationHostResolver({ resolve: async () => { await Promise.resolve(); return b.deps; } }, () => custodyPOST(requestB)),
  ]);
  assert.deepEqual(responses.map(x => x.status), [503, 503]);
  assert.equal(a.pairs(), 1); assert.equal(b.pairs(), 1);
  assert.deepEqual(a.seen, [requestA]); assert.deepEqual(b.seen, [requestB]);
});
