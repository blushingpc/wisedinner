import { copyRuntimeBytes, utf8Encode, utf8ByteLength, utf8DecodeFatal } from "./generated-runtime-bytes.ts";

export type RuntimeReader = { read: () => Promise<{ done: boolean; value?: Uint8Array }>; cancel: () => Promise<void>; releaseLock: () => void };
export type RuntimeRequest = { readonly method: string; readonly url: string; readonly headers: { get: (key: string) => string | null }; readonly signal: AbortSignal; readonly body: { getReader: () => RuntimeReader } | null };
export type RuntimeResponse = { readonly status: number; readonly headers: { get: (key: string) => string | null }; text: () => Promise<string>; json: () => Promise<Record<string, unknown>> };
export type RuntimeHttp<Q extends RuntimeRequest, S extends RuntimeResponse> = {
  request: (url: string, init: { method: string; headers: Record<string, string>; body: string; signal: AbortSignal }) => Q;
  response: (body: string, init: { status: number; headers: Record<string, string> }) => S;
};
// Standard web factories keep original V1/V2 Request/Response public surfaces.
// They are lazy, never global patches, and unused by the explicit native port.
export function webRuntimeHttp(): RuntimeHttp<Request, Response> {
  return Object.freeze({ request: (url, init) => new Request(url, init), response: (body, init) => new Response(body, init) });
}
function headers(input: Record<string, string>) { const map = new Map(Object.entries(input).map(([k, v]): [string, string] => [k.toLowerCase(), v]).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)); return Object.freeze({ get: (k: string) => map.get(k.toLowerCase()) ?? null, [Symbol.iterator]: () => map[Symbol.iterator]() }); }

// In-process byte ports, not a URL transport or authorization provider. No
// localhost listener or assumption about Expo global Request.body.getReader.
export function createNativeRuntimeHttp(): RuntimeHttp<RuntimeRequest, RuntimeResponse> {
  return Object.freeze({
    request(url, init) {
      if (typeof init.body !== "string" || utf8ByteLength(init.body) > 8 * 1024 * 1024) throw Error("body_capacity_exceeded");
      const bytes = utf8Encode(init.body), signal = init.signal; let locked = false, consumed = false;
      return Object.freeze({ url, method: init.method, headers: headers(init.headers), signal, body: Object.freeze({ getReader() {
        if (locked || consumed) throw Error("body_already_used"); locked = true; let at = 0, cancelled = false;
        return Object.freeze({
          async read() { if (!locked || cancelled || signal.aborted) throw Error("request_aborted"); if (at >= bytes.length) { consumed = true; return { done: true }; } const value = copyRuntimeBytes(bytes.subarray(at, at + 65536)); at += value.length; return { done: false, value }; },
          async cancel() { cancelled = true; consumed = true; },
          releaseLock() { locked = false; consumed = true; },
        });
      } }) });
    },
    response(body, init) {
      if (typeof body !== "string" || utf8ByteLength(body) > 16 * 1024 * 1024 || !Number.isInteger(init.status) || init.status < 200 || init.status > 599) throw Error("response_capacity_or_status");
      const text = utf8DecodeFatal(utf8Encode(body), true); let used = false;
      const consume = () => { if (used) throw Error("response_already_used"); used = true; return text; };
      return Object.freeze({ status: init.status, headers: headers(init.headers), async text() { return consume(); }, async json() { const value: unknown = JSON.parse(consume()); if (!value || typeof value !== "object" || Array.isArray(value)) throw Error("invalid_response_json"); return value as Record<string, unknown>; } });
    },
  });
}
