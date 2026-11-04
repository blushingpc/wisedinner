import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { sha256Hex, createRuntimeSha256, utf8Encode, utf8ByteLength, utf8DecodeFatal, copyRuntimeBytes } from "./generated-runtime-bytes.ts";
import { copyReferenceData, canonicalReferenceData } from "./generated-plan-data.ts";
import { AccountError as AccountExport } from "./account.ts";
import { AccountError as PureExport } from "./generated-runtime-error.ts";
import { ownCopy, MAX_BYTES } from "./owner-plan-codec.ts";

test("native byte adapter matches Node UTF8 replacement, all bytes and exact offset input", () => {
  const samples = ["", "abc", "\0", "\uFEFFa", "café😀", "\ud800", "\udc00", "a\ud800x", "\ud800\udc00"];
  for (let i = 0; i < 512; i++) samples.push(String.fromCharCode((i * 7919) % 65536, (i * 65521) % 65536));
  for (const s of samples) {
    assert.deepEqual([...utf8Encode(s)], [...Buffer.from(s)]); assert.equal(utf8ByteLength(s), Buffer.byteLength(s));
    assert.equal(sha256Hex(s), createHash("sha256").update(s).digest("hex"));
    assert.equal(utf8DecodeFatal(utf8Encode(s)), new TextDecoder("utf-8", { fatal: true }).decode(Buffer.from(s)));
  }
  const bytes = Uint8Array.from({ length: 256 }, (_, i) => i), view = bytes.subarray(7, 199);
  assert.equal(sha256Hex(view), createHash("sha256").update(view).digest("hex"));
  assert.deepEqual([...copyRuntimeBytes(view)], [...view]);
  let calls = 0; Object.defineProperty(view, "byteLength", { get() { calls++; throw Error("getter"); } });
  assert.equal(copyRuntimeBytes(view).length, 192); assert.equal(calls, 0);
  assert.throws(() => copyRuntimeBytes(new Uint16Array([1, 2]) as unknown as Uint8Array));
});
test("fatal decoder preserves BOM distinction and rejects malformed/truncated/overlong/surrogate UTF8", () => {
  assert.equal(utf8DecodeFatal(utf8Encode("\ufeffa")), "a");
  assert.equal(utf8DecodeFatal(utf8Encode("\ufeffa"), true), "\ufeffa");
  for (const bytes of [[0x80], [0xc0, 0x80], [0xc1, 0xbf], [0xc2], [0xe0, 0x80, 0x80], [0xed, 0xa0, 0x80], [0xf0, 0x80, 0x80, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xf5, 0x80, 0x80, 0x80], [0xff], [0x61, 0xe2, 0x82]]) {
    assert.throws(() => utf8DecodeFatal(Uint8Array.from(bytes)));
    assert.throws(() => new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes)));
  }
});
test("incremental SHA and original full1300catalog bytes match Node exactly", () => {
  const bytes = readFileSync("C:/Users/borgh/Documents/ChatGPT/wisedinner/recipe-intake/runtime/recipe-appeal/usda-refresh-20261016-01/export-02/recipes-with-usda-macros.jsonl");
  assert.equal(sha256Hex(bytes), "4090fd801a572db5f87bff1b3d3a7693fc996dbc3c8d6e858e9e5e3484b02cc0");
  assert.equal(utf8DecodeFatal(bytes), new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  const hash = createRuntimeSha256(); for (let i = 0; i < bytes.length; i += 8191) hash.update(bytes.subarray(i, i + 8191));
  assert.equal(hash.digestHex(), createHash("sha256").update(bytes).digest("hex")); assert.throws(() => hash.digestHex());
  const s = createRuntimeSha256().update("\ud800").update("\udc00");
  assert.equal(s.digestHex(), createHash("sha256").update("\ud800").update("\udc00").digest("hex"));
});

test("shared copier preserves Unicode keys/values, lone surrogates, canonical order and every ingress guard", () => {
  const input = { "😀": "café\ud800", a: ["\ufeff", "\udc00", 1, null] };
  assert.deepEqual(copyReferenceData(input), input);
  assert.equal(JSON.stringify(canonicalReferenceData(input)), JSON.stringify({ a: input.a, "😀": input["😀"] }));
  const exact = "😀".repeat(2500); assert.equal(exact.length, 5000); assert.equal(Buffer.byteLength(exact), 10000); assert.deepEqual(copyReferenceData([exact]), [exact]);
  assert.throws(() => copyReferenceData({ value: "x".repeat(10001) }));
  assert.throws(() => copyReferenceData({ ["x".repeat(501)]: 1 }));
  const large = Array.from({ length: 3356 }, () => "😀".repeat(2500)); assert.throws(() => copyReferenceData(large));
  let calls = 0; const accessor = Object.defineProperty({}, "x", { enumerable: true, get() { calls++; return 1; } });
  assert.throws(() => copyReferenceData(accessor)); assert.equal(calls, 0);
  assert.throws(() => copyReferenceData(new Date())); assert.throws(() => copyReferenceData([,]));
  assert.throws(() => copyReferenceData({ toJSON() { calls++; return {}; } })); assert.equal(calls, 0);
  let deep: unknown = null; for (let i = 0; i < 18; i++) deep = { next: deep }; assert.throws(() => copyReferenceData(deep));
});

test("account and owner codec retain one exact error identity and original128KiB/own-data guards", () => {
  assert.equal(AccountExport, PureExport); assert.equal(MAX_BYTES, 131072);
  const reject = (value: unknown, code = "invalid_full_state") => assert.throws(() => ownCopy(value), (e: unknown) => e instanceof AccountExport && e.status === 400 && e.message === code);
  const valid = { "😀": "\ud800", a: [1, false, null] }; assert.deepEqual(ownCopy(valid), valid);
  reject({ value: "x".repeat(4097) }); reject(Array.from({ length: 257 }, () => 1)); reject(JSON.parse('{"__proto__":1}'));
  const cycle: { self?: unknown } = {}; cycle.self = cycle; reject(cycle);
  let calls = 0; reject(Object.defineProperty({}, "v", { enumerable: true, get() { calls++; return 1; } })); assert.equal(calls, 0);
  //32x4096text plus separators is beyond the original128KiB serialized cap.
  reject(Array.from({ length: 32 }, () => "x".repeat(4096)), "state_too_large");
  const boundary = Array.from({ length: 31 }, () => "x".repeat(4096)); assert.deepEqual(ownCopy(boundary), boundary);
});
