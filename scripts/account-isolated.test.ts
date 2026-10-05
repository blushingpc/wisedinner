import test from "node:test";
import assert from "node:assert/strict";
import { isolatedTarget, verifyIsolatedTarget } from "./account-isolated.ts";

const target = { purpose: "wisedinner-disposable-account-acceptance", disposable: true, projectRef: "abcdefghijklmnopqrst", url: "https://abcdefghijklmnopqrst.supabase.co", nonce: "10000000-0000-4000-8000-000000000001", credentialFile: "C:/acceptance/keys.json", outputDir: "C:/acceptance/runs" };
// Guard tests only. Fake HTTP responses do not establish hosted execution proof.
test("shared target refuses before network or mutation even with disposable assertion", async () => {
  let requests = 0;
  const fetcher = (async () => { requests++; throw Error("must_not_call"); }) as typeof fetch;
  await assert.rejects(verifyIsolatedTarget({ ...target, projectRef: "zpvqxtklvjitofpbddrn", url: "https://zpvqxtklvjitofpbddrn.supabase.co" }, "unused", fetcher));
  assert.equal(requests, 0);
});
test("normal guard permits only matching server marker and GET without redirects", async () => {
  const calls: RequestInit[] = [];
  const fetcher = (async (_url, init) => {
    calls.push(init!);
    return Response.json([{ id: target.nonce, purpose: target.purpose, disposable: true, project_ref: target.projectRef, schema_revision: "0006-0011" }]);
  }) as typeof fetch;
  await verifyIsolatedTarget(target, "unused", fetcher);
  assert.equal(calls.length, 1); assert.equal(calls[0].method, "GET"); assert.equal(calls[0].redirect, "error");
});
test("edge marker mismatch and ambiguous URL refuse without a write", async () => {
  const methods: string[] = [];
  const fetcher = (async (_url, init) => { methods.push(init!.method!); return Response.json([{ id: target.nonce, disposable: false }]); }) as typeof fetch;
  await assert.rejects(verifyIsolatedTarget(target, "unused", fetcher));
  assert.deepEqual(methods, ["GET"]);
  for (const url of [`${target.url}/`, `${target.url}?ref=zpvqxtklvjitofpbddrn`, "http://localhost:54321", "https://other.supabase.co", "https://user:password@abcdefghijklmnopqrst.supabase.co"]) assert.throws(() => isolatedTarget({ ...target, url }));
});
test("non-trigger missing manifest, false authority and embedded secrets refuse", async () => {
  for (const value of [undefined, {}, { ...target, disposable: false }, { ...target, purpose: "production" }, { ...target, serviceRoleKey: "must_not_accept" }, { ...target, credentialFile: ".env.local" }]) assert.throws(() => isolatedTarget(value));
});
