// Synthetic protocol setup only. No price/food/source/native adoption.
import assert from "node:assert/strict";
import { setup } from "./generated-joined-plan.test-support.ts";
import { createJoinedReferencePlanner } from "./generated-joined-plan.ts";
export function referencePriceFixture() {
  const f = setup(), original = f.configuration.regionalPackFacts[0]!;
  const { region, basis, observedOn, ...shared } = original; void region; void basis; void observedOn;
  const fact = { ...shared, id: "synthetic-manufacturer-reference", kind: "manufacturer-reference", sourceUrl: "https://example.invalid/synthetic-only", packPriceCents: { min: 600, max: 650 }, sourceBasis: { geography: "manufacturer-reference-not-regional", manufacturer: "Synthetic supplier", capturedOn: "2026-10-19", observedOn: null, publishedOn: null }, reviewEffectiveFrom: "2026-10-19" };
  const configuration = { ...f.configuration, regionalPackFacts: [f.configuration.regionalPackFacts[1]!], referencePrices: { policy: "wd-price-reference-fallback-v1", facts: [fact] } };
  const request = { ...f.request, asOfDate: "2026-10-19" }, bound = createJoinedReferencePlanner(f.bytes, configuration);
  assert.equal(bound.outcome, "ready"); if (bound.outcome !== "ready") throw Error("Expected explicit reference proposal");
  const labels = ["a", "b"].map(id => ({ skuId: "buy-" + id, displayName: "Synthetic " + id, aisle: "Pantry" }));
  return { ...f, configuration, request, planner: bound.planner, fact, labels };
}
