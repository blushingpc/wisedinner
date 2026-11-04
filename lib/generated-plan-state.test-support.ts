// Isolated synthetic atomic protocol port only, not a persistence adapter.
import type { ReferenceStatePort, ReferenceEnvelope, StoredReferenceOperation } from "./generated-plan-state.ts";
export const op = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function memoryPort() {
  const states = new Map<string, ReferenceEnvelope>(), operations = new Map<string, StoredReferenceOperation>();
  let serial: Promise<unknown> = Promise.resolve(), failure: "before-commit" | "after-commit" | null = null;
  const port: ReferenceStatePort = { transaction<T>(body: Parameters<ReferenceStatePort["transaction"]>[0]): Promise<T> {
    const run = serial.then(async () => {
      const nextStates = structuredClone(states), nextOperations = structuredClone(operations);
      const result = await body({
        async readState(scope) { return structuredClone(nextStates.get(scope) ?? null); },
        async readOperation(scope, id) { return structuredClone(nextOperations.get(scope + id) ?? null); },
        async commit(scope, state, operation) { nextStates.set(scope, structuredClone(state)); nextOperations.set(scope + operation.operationId, structuredClone(operation)); },
      });
      const injected = failure; failure = null;
      if (injected === "before-commit") throw new Error("Fixture rollback");
      states.clear(); nextStates.forEach((v, k) => states.set(k, v)); operations.clear(); nextOperations.forEach((v, k) => operations.set(k, v));
      if (injected === "after-commit") throw new Error("Fixture acknowledgement lost");
      return result;
    });
    serial = run.catch(() => undefined); return run as Promise<T>;
  } };
  return { port, failOnce(mode: typeof failure) { failure = mode; }, tamperState(mutate: (state: ReferenceEnvelope) => ReferenceEnvelope) { for (const [key, state] of states) states.set(key, mutate(structuredClone(state))); } };
}
