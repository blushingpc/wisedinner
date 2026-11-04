import { sha256 } from "@noble/hashes/sha2.js";

// Narrow same-engine byte seam. No Node/global crypto, Buffer, Fetch or encoding
// mocks. SHA256 is synchronous; every original canonical/domain input is kept.
const typed = Object.getPrototypeOf(Uint8Array.prototype);
const buffer = Object.getOwnPropertyDescriptor(typed, "buffer")!.get!;
const offset = Object.getOwnPropertyDescriptor(typed, "byteOffset")!.get!;
const length = Object.getOwnPropertyDescriptor(typed, "byteLength")!.get!;
const tag = Object.getOwnPropertyDescriptor(typed, Symbol.toStringTag)!.get!;
export function copyRuntimeBytes(value: Uint8Array): Uint8Array {
  if (tag.call(value) !== "Uint8Array") throw Error("invalid_runtime_bytes");
  const size = length.call(value) as number, start = offset.call(value) as number;
  return new Uint8Array(new Uint8Array(buffer.call(value) as ArrayBuffer, start, size));
}
function points(text: string, visit: (code: number) => void) {
  if (typeof text !== "string") throw Error("invalid_runtime_text");
  for (const char of text) { const point = char.codePointAt(0)!; visit(point >= 0xd800 && point <= 0xdfff ? 0xfffd : point); }
}
export function utf8ByteLength(text: string): number {
  let bytes = 0; points(text, c => { bytes += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4; }); return bytes;
}
export function utf8Encode(text: string): Uint8Array {
  const result = new Uint8Array(utf8ByteLength(text)); let at = 0;
  points(text, c => {
    if (c < 0x80) result[at++] = c;
    else if (c < 0x800) { result[at++] = 0xc0 | c >> 6; result[at++] = 0x80 | c & 63; }
    else if (c < 0x10000) { result[at++] = 0xe0 | c >> 12; result[at++] = 0x80 | c >> 6 & 63; result[at++] = 0x80 | c & 63; }
    else { result[at++] = 0xf0 | c >> 18; result[at++] = 0x80 | c >> 12 & 63; result[at++] = 0x80 | c >> 6 & 63; result[at++] = 0x80 | c & 63; }
  }); return result;
}
export function utf8DecodeFatal(value: Uint8Array, ignoreBOM = false): string {
  const bytes = copyRuntimeBytes(value), parts: string[] = []; let first = true, chunk = "";
  for (let at = 0; at < bytes.length;) {
    if (bytes[at]! < 0x80) {
      const start = at; while (at < bytes.length && bytes[at]! < 0x80 && at - start < 8192) at++;
      chunk += String.fromCharCode(...bytes.subarray(start, at)); first = false;
      if (chunk.length >= 8192) { parts.push(chunk); chunk = ""; }
      continue;
    }
    const lead = bytes[at++]!; let point = lead, count = 0;
    if (lead < 0x80) count = 0;
    else if (lead >= 0xc2 && lead <= 0xdf) { point = lead & 31; count = 1; }
    else if (lead >= 0xe0 && lead <= 0xef) { point = lead & 15; count = 2; }
    else if (lead >= 0xf0 && lead <= 0xf4) { point = lead & 7; count = 3; }
    else throw Error("invalid_utf8");
    if (at + count > bytes.length) throw Error("invalid_utf8");
    for (let i = 0; i < count; i++) { const b = bytes[at++]!; if (b < 0x80 || b > 0xbf || i === 0 && (lead === 0xe0 && b < 0xa0 || lead === 0xed && b > 0x9f || lead === 0xf0 && b < 0x90 || lead === 0xf4 && b > 0x8f)) throw Error("invalid_utf8"); point = point << 6 | b & 63; }
    if (!first || ignoreBOM || point !== 0xfeff) chunk += String.fromCodePoint(point); first = false;
    if (chunk.length >= 8192) { parts.push(chunk); chunk = ""; }
  }
  return parts.join("") + chunk;
}
function hex(bytes: Uint8Array): string { let result = ""; for (const b of bytes) result += b.toString(16).padStart(2, "0"); return result; }
export function sha256Hex(value: string | Uint8Array): string { return hex(sha256(typeof value === "string" ? utf8Encode(value) : copyRuntimeBytes(value))); }
export function createRuntimeSha256() {
  const hash = sha256.create(); let finished = false;
  const api = Object.freeze({
    update(value: string | Uint8Array) { if (finished) throw Error("hash_finished"); hash.update(typeof value === "string" ? utf8Encode(value) : copyRuntimeBytes(value)); return api; },
    digestHex() { if (finished) throw Error("hash_finished"); finished = true; return hex(hash.digest()); },
  }); return api;
}
