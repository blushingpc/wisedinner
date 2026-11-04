import { utf8ByteLength } from "./generated-runtime-bytes.ts";
// Bounded own-data snapshot for trusted configuration ingress and private draft
// inputs. No getters, toJSON, functions, sparse arrays or implicit coercion.
export function copyReferenceData(value: unknown): unknown {
  let nodes = 0, stringBytes = 0;
  function invalid(): never { throw new Error("Invalid reference data"); }
  function walk(value: unknown, depth: number): unknown {
    if (++nodes > 500000 || depth > 16) invalid();
    if (value === null || typeof value === "boolean") return value;
    if (typeof value === "string") { stringBytes += utf8ByteLength(value); if (value.length > 10000 || stringBytes > 32 * 1024 * 1024) invalid(); return value; }
    if (typeof value === "number") { if (!Number.isFinite(value)) invalid(); return value; }
    if (!value || typeof value !== "object") invalid();
    const array = Array.isArray(value), prototype = Object.getPrototypeOf(value);
    if (array ? prototype !== Array.prototype : prototype !== Object.prototype && prototype !== null) invalid();
    const descriptors = Object.getOwnPropertyDescriptors(value), keys = Reflect.ownKeys(descriptors);
    if (array) {
      const length = descriptors.length?.value;
      if (!Number.isSafeInteger(length) || length < 0 || length > 20000 || keys.length !== length + 1) invalid();
      const result: unknown[] = [];
      for (let i = 0; i < length; i++) { const descriptor = descriptors[String(i)]; if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) invalid(); result.push(walk(descriptor.value, depth + 1)); }
      return result;
    }
    const result: Record<string, unknown> = {};
    for (const key of keys) {
      if (typeof key !== "string" || key.length > 500) invalid();
      stringBytes += utf8ByteLength(key); if (stringBytes > 32 * 1024 * 1024) invalid();
      const descriptor = descriptors[key]!; if (!("value" in descriptor) || !descriptor.enumerable) invalid();
      Object.defineProperty(result, key, { value: walk(descriptor.value, depth + 1), enumerable: true, writable: true, configurable: true });
    }
    return result;
  }
  return walk(value, 0);
}

export function canonicalReferenceData(value: unknown): unknown {
  const copied = copyReferenceData(value);
  function ordered(value: unknown): unknown {
    if (Array.isArray(value)) return value.map(ordered);
    if (value && typeof value === "object") return Object.fromEntries(Object.keys(value).sort().map(key => [key, ordered((value as Record<string, unknown>)[key])]));
    return value;
  }
  return ordered(copied);
}
