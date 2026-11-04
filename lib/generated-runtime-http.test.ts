import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createNativeRuntimeHttp, type RuntimeRequest } from "./generated-runtime-http.ts";
import { readReferenceJson } from "./generated-plan-json.ts";
import { utf8Encode } from "./generated-runtime-bytes.ts";

test("explicit native byte ports preserve JSON grammar, BOM/UTF8/capacity/length/abort and one-use bodies", async () => {
  const http = createNativeRuntimeHttp(), controller = new AbortController();
  const request = (text: string) => http.request("in-process:only", { method: "POST", headers: { "content-type": "application/json" }, body: text, signal: controller.signal });
  assert.deepEqual(await readReferenceJson(request('{"emoji":"😀"}')), { emoji: "😀" });
  await assert.rejects(readReferenceJson(request('{"a":1,"\\u0061":2}')));
  await assert.rejects(readReferenceJson(request('\ufeff{"a":1}')));
  assert.throws(() => request("x".repeat(8 * 1024 * 1024 + 1)));
  const bad = request("{}"), body = { getReader() { let done = false; return { async read() { if (done) return { done: true }; done = true; return { done: false, value: Uint8Array.from([0xc0, 0x80]) }; }, async cancel() {}, releaseLock() {} }; } };
  await assert.rejects(readReferenceJson({ ...bad, body }));
  await assert.rejects(readReferenceJson({ ...request("{}"), headers: { get: k => k === "content-length" ? "1" : "application/json" } }));
  const interrupted = request("{}"); controller.abort(); await assert.rejects(readReferenceJson(interrupted));
  const response = http.response('{"outcome":"ok"}', { status: 200, headers: { "content-type": "application/json", "cache-control": "no-store" } });
  assert.equal(response.headers.get("CACHE-CONTROL"), "no-store"); assert.deepEqual(await response.json(), { outcome: "ok" }); await assert.rejects(response.text());
  // UTF8 codepoint split across transport chunks remains fatal-decoded correctly.
  const encoded = utf8Encode('{"v":"😀"}'); let at = 0;
  const split: RuntimeRequest = { ...bad, signal: new AbortController().signal, body: { getReader() { return { async read() { return at === encoded.length ? { done: true } : { done: false, value: encoded.subarray(at, ++at) }; }, async cancel() {}, releaseLock() {} }; } } };
  assert.deepEqual(await readReferenceJson(split), { v: "😀" });
});

test("same-engine explicit native port reproduces all11accepted actual-source response bytes and digests", () => {
  const job = "C:/Users/borgh/Projects/wisedinner-app/tasks/apple-preorder-minimum-2026-10-22/", original = job + "current-source-session-v2-probe.mjs";
  const text = readFileSync(original, "utf8"), baseline = JSON.parse(readFileSync(job + "CURRENT-SOURCE-V2-SESSION-PACKETS.json", "utf8"));
  let native = text.replace("import { createReferenceSessionHandlerV2 }", "import { createReferenceSessionPortV2 }");
  native = native.replace("const J=", 'import { createNativeRuntimeHttp } from "file:///C:/Users/borgh/Projects/wisedinner-backend/lib/generated-runtime-http.ts";\nconst nativeHttp=createNativeRuntimeHttp();\nconst createReferenceSessionHandlerV2=(source,config,options)=>createReferenceSessionPortV2(source,config,options,nativeHttp);\nconst nativeRequest=(url,init)=>nativeHttp.request(url,{...init,signal:init.signal??new AbortController().signal});\nconst J=');
  native = native.replaceAll("new Request(", "nativeRequest(").replace("read(new URL(import.meta.url).pathname.slice(1))", "read(" + JSON.stringify(original) + ")");
  assert.notEqual(native, text); assert.equal(native.includes("new Request("), false);
  const result = spawnSync(process.execPath, ["--input-type=module", "-e", native], { encoding: "utf8", timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
  assert.equal(result.status, 0, result.stderr);
  const actual = JSON.parse(result.stdout);
  assert.equal(actual.summary.length, 11); assert.equal(actual.stateRevision, 5);
  assert.deepEqual(actual.summary.map((p: { operation: string; responseSha256: string }) => [p.operation, p.responseSha256]), baseline.summary.map((p: { operation: string; responseSha256: string }) => [p.operation, p.responseSha256]));
  assert.equal(actual.packetBundle.uncompressedSha256, baseline.packetBundle.uncompressedSha256);
  assert.equal(actual.basisSha256, baseline.basisSha256);
  assert.equal(createHash("sha256").update(readFileSync(original)).digest("hex"), baseline.pins.find((p: { file: string }) => p.file === original).sha256);
});
