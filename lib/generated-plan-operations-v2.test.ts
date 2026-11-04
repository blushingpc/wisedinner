import test from "node:test";
import assert from "node:assert/strict";
import { syntheticV2, labelsV2 } from "./generated-plan-v2.test-support.ts";
import { createBoundReferenceOperationHandlerV2 } from "./generated-plan-operations.ts";
test("pure V2 proposals require exact basis and emit no raw retailer data", async () => {
  const f = syntheticV2(), candidate = createBoundReferenceOperationHandlerV2(f.binding, { labels: labelsV2, authorize: () => "allow" }); if (candidate.outcome !== "ready") throw Error("Expected handler"); const bound = candidate;
  async function send(expected: string | null) { return bound.handle(new Request("http://private.invalid", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(f.envelope("evaluateJoined", { assignments: f.assignments, request: f.request }, 1, expected)) })); }
  for (const bad of [null, "a".repeat(64)]) { const response = await send(bad); assert.equal(response.status, 409); assert.equal((await response.json()).result.code, "stale_source_policy_basis"); }
  const response = await send(f.binding.sourcePolicyBasis.basisSha256), body = await response.json(); assert.equal(body.result.outcome, "week-proposal"); assert.equal(body.result.saved, false); assert.equal(body.result.sourcePolicyBasisSha256, f.binding.sourcePolicyBasis.basisSha256); assert.equal(body.result.nonShoppingUsage, null);
  for (const key of ["retailerId", "productId", "offerContext", "sourceUrl", "packPriceCents", "estimatedLineCents", "factPins"]) assert.equal(JSON.stringify(body.result).includes('"' + key + '"'), false);
});
