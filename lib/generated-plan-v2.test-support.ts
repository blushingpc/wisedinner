// Synthetic protocol/retailer facts only. Not production catalog or storage.
import { createHash } from "node:crypto";
import { setup } from "./generated-joined-plan.test-support.ts";
import { memoryPort, op } from "./generated-plan-state.test-support.ts";
import { canonicalReferenceData } from "./generated-plan-data.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { createReferenceSessionHandlerV2, REFERENCE_SESSION_CONTRACT_V2 } from "./generated-plan-session.ts";
import { issueLocalReferenceScopeV2, type ReferenceStatePortV2 } from "./generated-plan-state.ts";
import { referenceOperationDigest } from "./generated-plan-operations.ts";
export { op, memoryPort };
export const hashV2 = (value: unknown) => createHash("sha256").update(JSON.stringify(canonicalReferenceData(value))).digest("hex");
export const labelsV2 = ["a", "b"].map(id => ({ skuId: "buy-" + id, displayName: "Synthetic " + id, aisle: "Pantry" }));
let serial = 0;
export function syntheticV2() {
  const f = setup();
  const facts = ["a", "b"].map(id => {
    const body = { skuId: "buy-" + id, unit: "g", formDigest: "d".repeat(64), packQuantity: { numerator: "100", denominator: "1" }, packPriceCents: { min: 120, max: 130 }, currency: "USD", kind: "retailer-reference", sourceSha256: "a".repeat(64), sourceUrl: "https://example.invalid/retailer-" + id, sourceBasis: { geography: "retailer-reference-not-regional", retailerId: "synthetic-retailer", productId: id, offerContext: { channel: "online-public", geographyDescription: "Synthetic contract only", storeId: null, fulfilment: null }, capturedOn: "2026-10-18", observedOn: null, publishedOn: null }, reviewEffectiveFrom: "2026-10-18", usableThrough: "2026-10-18", flags: ["synthetic-only"] };
    return { id: "rr1:" + hashV2(["wd-retailer-reference-fact-v1", body]), ...body };
  });
  const configuration = { ...f.configuration, regionalPackFacts: [] as unknown[], referencePrices: { policy: "wd-price-reference-fallback-v2", facts } };
  const candidateBinding = createJoinedReferencePlannerV2(f.bytes, configuration); if (candidateBinding.outcome !== "ready") throw Error("V2 synthetic binding unavailable");
  const binding = candidateBinding;
  const originalMemory = memoryPort(), rawPort = originalMemory.port as unknown as ReferenceStatePortV2;
  let pendingFailure: "before-commit" | "after-commit" | null = null;
  // Inject write faults at actual commit transactions, not the earlier
  // read-only original-intent lookup. Old V1 test port stays unchanged.
  const port: ReferenceStatePortV2 = { transaction: body => rawPort.transaction(tx => body({ ...tx, async commit(...args) { if (pendingFailure) { originalMemory.failOnce(pendingFailure); pendingFailure = null; } await tx.commit(...args); } })) };
  const memory = { ...originalMemory, failOnce(mode: typeof pendingFailure) { pendingFailure = mode; } }, scope = issueLocalReferenceScopeV2("v2-synthetic-" + serial++, 1);
  const options = { labels: labelsV2, transactions: port, resolveScope: () => scope, newWeekPolicy: "wd-new-week-reconfirm-v1" as const };
  const candidateHandler = createReferenceSessionHandlerV2(f.bytes, configuration, options); if (candidateHandler.outcome !== "ready") throw Error("V2 session unavailable");
  const handler = candidateHandler;
  function envelope(operation: string, payload: unknown, id = 1, expected: string | null = binding.sourcePolicyBasis.basisSha256) {
    const intent = { contract: REFERENCE_SESSION_CONTRACT_V2, operation, operationId: op(id), sourceSha256: binding.source.sha256, payload, expectedSourcePolicyBasisSha256: expected };
    return { ...intent, intentSha256: referenceOperationDigest(intent) };
  }
  async function send(operation: string, payload: unknown, id = 1, expected: string | null = binding.sourcePolicyBasis.basisSha256, target = handler) {
    const response = await target.handle(new Request("http://private.invalid/synthetic-v2", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(envelope(operation, payload, id, expected)) }));
    return { status: response.status, body: await response.json(), headers: response.headers };
  }
  const initial = { expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, pantryEntries: [] };
  return { ...f, configuration, binding, memory, port, scope, options, handler, envelope, send, initial };
}
