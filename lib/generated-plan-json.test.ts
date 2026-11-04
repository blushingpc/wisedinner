import test from "node:test";
import assert from "node:assert/strict";
import { parseReferenceJson, readReferenceJson, REFERENCE_BODY_LIMIT } from "./generated-plan-json.ts";

test("strict JSON round trips a bounded nested input domain without changing values", () => {
  const leaves = [null, true, false, 0, -0.125, "escaped\\\"\n", "π", { "__proto__": null }];
  for (let n = 0; n < 100; n++) {
    const value = { n, rows: [leaves[n % leaves.length], { key: "v" + n, nested: [n / 4, null, true] }], empty: {} };
    const raw = JSON.stringify(value); assert.deepEqual(parseReferenceJson(raw), JSON.parse(raw));
  }
});

test("duplicate keys including escaped spelling are rejected at every nesting level", () => {
  for (const raw of ['{"x":1,"x":2}', '{"x":1,"\\u0078":2}', '{"a":[{"p":1,"p":1}]}', '{"a":{"payload":{},"payload":{}}}']) assert.throws(() => parseReferenceJson(raw));
  assert.deepEqual(parseReferenceJson('{"a":{"x":1},"b":{"x":2}}'), { a: { x: 1 }, b: { x: 2 } });
});

test("grammar depth scalar and array capacity guards reject invalid packets", () => {
  for (const raw of ["", "NaN", "Infinity", "1e999", "01", "true false", "[1,]", '{"x":1,}', '{"x":undefined}', '{"x":"\\q"}', "\ufeff{}", "[".repeat(18) + "0" + "]".repeat(18), JSON.stringify("x".repeat(10001)), JSON.stringify(Array(20001).fill(0))]) assert.throws(() => parseReferenceJson(raw));
  assert.throws(() => parseReferenceJson(" ".repeat(REFERENCE_BODY_LIMIT + 1)));
});

test("body reader checks byte length UTF8 content type and abort without partial JSON", async () => {
  const make = (body: BodyInit, headers: Record<string, string> = {}) => new Request("http://reference.invalid/", { method: "POST", body, headers: { "content-type": "application/json", ...headers } });
  assert.deepEqual(await readReferenceJson(make('{"text":"π"}', { "content-length": "13" })), { text: "π" });
  await assert.rejects(readReferenceJson(make("{}", { "content-length": "3" })), { code: "body_length_mismatch" });
  await assert.rejects(readReferenceJson(make("{}", { "content-type": "text/plain" })), { code: "json_content_type_required" });
  await assert.rejects(readReferenceJson(make(new Uint8Array([0x22, 0xc3, 0x28, 0x22]))), { code: "invalid_json_body" });
  await assert.rejects(readReferenceJson(make("{}", { "content-length": String(REFERENCE_BODY_LIMIT + 1) })), { code: "body_capacity_exceeded" });
  const controller = new AbortController(); let cancelled = 0;
  const body = new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(new TextEncoder().encode("{")); }, cancel() { cancelled++; } });
  const request = new Request("http://reference.invalid/", { method: "POST", body, headers: { "content-type": "application/json" }, signal: controller.signal, duplex: "half" } as RequestInit);
  const pending = readReferenceJson(request); controller.abort(); await assert.rejects(pending, { code: "request_aborted" }); assert.equal(cancelled, 1);
});

test("streamed capacity is enforced independently of absent or dishonest length header", async () => {
  let cancelled = false;
  const body = new ReadableStream<Uint8Array>({ start(stream) { stream.enqueue(new Uint8Array(REFERENCE_BODY_LIMIT)); stream.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } });
  const request = new Request("http://reference.invalid/", { method: "POST", body, headers: { "content-type": "application/json" }, duplex: "half" } as RequestInit);
  await assert.rejects(readReferenceJson(request), { code: "body_capacity_exceeded" }); assert.equal(cancelled, true);
});
