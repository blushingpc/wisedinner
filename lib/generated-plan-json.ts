import { copyReferenceData } from "./generated-plan-data.ts";
import { utf8ByteLength, utf8DecodeFatal, copyRuntimeBytes } from "./generated-runtime-bytes.ts";
import type { RuntimeRequest } from "./generated-runtime-http.ts";

// Private ingress guard. JSON.parse alone silently accepts duplicate keys.
// Scan complete grammar first, including escaped key equivalence, then parse.
export const REFERENCE_BODY_LIMIT = 8 * 1024 * 1024;
export function parseReferenceJson(text: string): unknown {
  if (typeof text !== "string" || utf8ByteLength(text) > REFERENCE_BODY_LIMIT) throw new Error("Invalid body");
  let offset = 0, nodes = 0;
  const invalid = (): never => { throw new Error("Invalid JSON"); };
  function space() { while (offset < text.length && /[\t\r\n ]/.test(text[offset]!)) offset++; }
  function string(key = false): string {
    const start = offset; if (text[offset++] !== '"') invalid();
    while (offset < text.length) {
      const next = text[offset++]!;
      if (next === "\\") { offset++; continue; }
      if (next === '"') { const result = JSON.parse(text.slice(start, offset)) as string; if (result.length > (key ? 500 : 10000)) invalid(); return result; }
    }
    return invalid();
  }
  function value(depth: number): void {
    if (++nodes > 500000 || depth > 16) invalid(); space();
    const first = text[offset];
    if (first === '"') { string(); return; }
    if (first === "{" || first === "[") {
      offset++; space(); const close = first === "{" ? "}" : "]", keys = new Set<string>(); let entries = 0;
      if (text[offset] === close) { offset++; return; }
      while (offset < text.length) {
        if (++entries > (first === "[" ? 20000 : 500000)) invalid();
        if (first === "{") { space(); const key = string(true); if (keys.has(key)) invalid(); keys.add(key); space(); if (text[offset++] !== ":") invalid(); }
        value(depth + 1); space(); const next = text[offset++]; if (next === close) return; if (next !== ",") invalid();
      }
      invalid();
    }
    const start = offset; while (offset < text.length && !/[\t\r\n ,\]}]/.test(text[offset]!)) offset++;
    if (offset === start) invalid(); const parsed: unknown = JSON.parse(text.slice(start, offset));
    if (typeof parsed === "number" ? !Number.isFinite(parsed) : parsed !== null && typeof parsed !== "boolean") invalid();
  }
  value(0); space(); if (offset !== text.length) invalid();
  return copyReferenceData(JSON.parse(text));
}

export class ReferenceBodyError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.code = code; }
}
export async function readReferenceJson(request: RuntimeRequest): Promise<unknown> {
  if (request.signal.aborted) throw new ReferenceBodyError("request_aborted");
  if (!/^application\/json(?:\s*;|\s*$)/i.test(request.headers.get("content-type") ?? "")) throw new ReferenceBodyError("json_content_type_required");
  const length = request.headers.get("content-length");
  if (length !== null && (!/^(0|[1-9]\d*)$/.test(length) || Number(length) > REFERENCE_BODY_LIMIT)) throw new ReferenceBodyError("body_capacity_exceeded");
  if (!request.body) throw new ReferenceBodyError("invalid_json_body");
  const reader = request.body.getReader(), chunks: Uint8Array[] = []; let bytes = 0;
  const abort = () => { void reader.cancel().catch(() => {}); };
  request.signal.addEventListener("abort", abort, { once: true });
  try {
    while (true) {
      const chunk = await reader.read(); if (request.signal.aborted) throw new ReferenceBodyError("request_aborted");
      if (chunk.done) break;
      if (!chunk.value) throw new ReferenceBodyError("invalid_json_body");
      const value = copyRuntimeBytes(chunk.value); bytes += value.byteLength;
      if (bytes > REFERENCE_BODY_LIMIT) throw new ReferenceBodyError("body_capacity_exceeded");
      chunks.push(value);
    }
    const joined = new Uint8Array(bytes); let at = 0; for (const chunk of chunks) { joined.set(chunk, at); at += chunk.length; }
    const text = utf8DecodeFatal(joined, true);
    if (length !== null && Number(length) !== bytes) throw new ReferenceBodyError("body_length_mismatch");
    return parseReferenceJson(text);
  } catch (error) {
    void reader.cancel().catch(() => {});
    if (error instanceof ReferenceBodyError) throw error;
    throw new ReferenceBodyError("invalid_json_body");
  } finally { request.signal.removeEventListener("abort", abort); reader.releaseLock(); }
}
