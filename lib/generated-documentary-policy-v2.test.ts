import test from "node:test";
import assert from "node:assert/strict";
import { syntheticV2, op, hashV2 } from "./generated-plan-v2.test-support.ts";
import { createJoinedReferencePlannerV2 } from "./generated-joined-plan.ts";
import { DOCUMENTARY_VALUATION_POLICY, readReferencePriceConfigurationV2, quoteRegionalEstimatesV2 } from "./generated-regional-quote.ts";
import { createReferencePlanRepositoryV2 } from "./generated-plan-state.ts";

function fixture() {
  const f = syntheticV2();
  const configuration = { ...f.configuration, referencePrices: { ...f.configuration.referencePrices, valuationPolicy: DOCUMENTARY_VALUATION_POLICY } };
  const binding = createJoinedReferencePlannerV2(f.bytes, configuration);
  assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") throw Error("binding");
  return { ...f, configuration, binding };
}

test("documentary valuation is explicit, strict and separate from actual planning date", () => {
  const f = fixture();
  assert.equal(readReferencePriceConfigurationV2(f.configuration.referencePrices).valuationPolicy, DOCUMENTARY_VALUATION_POLICY);
  assert.throws(() => readReferencePriceConfigurationV2({ ...f.configuration.referencePrices, valuationPolicy: "unknown" }));
  assert.throws(() => readReferencePriceConfigurationV2({ ...f.configuration.referencePrices, unexpected: true }));
  const tampered = structuredClone(f.configuration.referencePrices); tampered.facts[0]!.usableThrough = "2030-01-01";
  assert.throws(() => readReferencePriceConfigurationV2(tampered));
  const legacy = createJoinedReferencePlannerV2(f.bytes, { ...f.configuration, referencePrices: { policy: f.configuration.referencePrices.policy, facts: f.configuration.referencePrices.facts } });
  assert.equal(legacy.outcome, "ready"); if (legacy.outcome !== "ready") return;
  assert.notEqual(legacy.sourcePolicyBasis.basisSha256, f.binding.sourcePolicyBasis.basisSha256);
  for (const day of ["2026-10-24", "2026-10-25", "2026-10-31"]) {
    const request = { ...f.request, asOfDate: day };
    const result = f.binding.planner.evaluateJoined(f.assignments, request);
    assert.equal(result.outcome, "success"); if (result.outcome !== "success") continue;
    assert.equal(result.quote.asOfDate, day);
    assert.equal(result.quote.referenceEstimates?.planningDate, day);
    assert.equal(result.quote.referenceEstimates?.valuationPolicy, DOCUMENTARY_VALUATION_POLICY);
    assert.equal(result.quote.referenceEstimates?.sources[0]?.usableThrough, "2026-10-18");
    assert.equal(result.sourcePolicyBasis.documentaryValuationPolicy, DOCUMENTARY_VALUATION_POLICY);
    assert.notEqual(legacy.planner.evaluateJoined(f.assignments, request).outcome, "success");
  }
  assert.notEqual(f.binding.planner.evaluateJoined(f.assignments, { ...f.request, asOfDate: "2026-10-17" }).outcome, "success");
});

test("old V2 saved state and committed status survive documentary policy drift without repricing", async () => {
  const f = syntheticV2();
  const old = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port });
  const command = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  const committed = await old.applyPlanCommand(f.scope, command); assert.equal(committed.outcome, "acknowledged");
  const binding = createJoinedReferencePlannerV2(f.bytes, { ...f.configuration, referencePrices: { ...f.configuration.referencePrices, valuationPolicy: DOCUMENTARY_VALUATION_POLICY } });
  assert.equal(binding.outcome, "ready"); if (binding.outcome !== "ready") return;
  const next = createReferencePlanRepositoryV2({ planner: binding.planner, sourcePolicyBasis: binding.sourcePolicyBasis, transactions: f.port });
  assert.deepEqual(await next.read(f.scope), await old.read(f.scope));
  assert.deepEqual(await next.getOperationStatus(f.scope, op(1)), await old.getOperationStatus(f.scope, op(1)));
  assert.deepEqual(await old.applyPlanCommand(f.scope, command), committed);
});

test("documentary basis lost commit acknowledgement remains status-only", async () => {
  const f = fixture(), repository = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port });
  const command = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: { ...f.request, asOfDate: "2026-10-31" }, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  f.memory.failOnce("after-commit");
  assert.equal((await repository.applyPlanCommand(f.scope, command)).outcome, "unknown");
  assert.deepEqual(await repository.applyPlanCommand(f.scope, command), { outcome: "held", code: "operation_status_required" });
  const status = await repository.getOperationStatus(f.scope, op(1));
  assert.equal(status.outcome, "committed");
});

test("documentary opt-in does not admit expired regional quotes or unknown/tampered stored policy", async () => {
  const f = fixture();
  const fact = { id: "regional-expiry-control", skuId: "not-a-reference-sku", unit: "g", formDigest: "a".repeat(64), region: "South", packQuantity: { numerator: "500", denominator: "1" }, packPriceCents: { min: 200, max: 300 }, currency: "USD", observedOn: "2026-10-01", usableThrough: "2026-10-24", sourceSha256: "b".repeat(64), basis: "observed-regional-average", flags: [] };
  const need = { skuId: fact.skuId, category: "pantry", unit: fact.unit, formDigest: fact.formDigest, perishable: false, purchasedNeed: { numerator: 750, denominator: 1 } };
  const request = { region: "South", storeIds: [], budgetCents: 1000, asOfDate: "2026-10-25" };
  assert.notEqual(quoteRegionalEstimatesV2(request, [need], [], [fact], f.configuration.referencePrices).outcome, "quoted");
  assert.equal(quoteRegionalEstimatesV2({ ...request, asOfDate: "2026-10-24" }, [need], [], [fact], f.configuration.referencePrices).outcome, "quoted");
  const repository = createReferencePlanRepositoryV2({ planner: f.binding.planner, sourcePolicyBasis: f.binding.sourcePolicyBasis, transactions: f.port });
  const command = { operationId: op(1), kind: "install-current", expectedRevision: 0, weekId: op(100), request: f.request, assignments: f.assignments, expectedSourcePolicyBasisSha256: f.binding.sourcePolicyBasis.basisSha256 };
  assert.equal((await repository.applyPlanCommand(f.scope, command)).outcome, "acknowledged");
  f.memory.tamperState(state => {
    const current = state.current! as unknown as Record<string, unknown>;
    const basis = current.sourcePolicyBasis as Record<string, unknown>;
    basis.documentaryValuationPolicy = "unknown";
    const { basisSha256: ignored, ...body } = basis; void ignored;
    basis.basisSha256 = hashV2(["wd-source-policy-basis-v2", body]);
    return state;
  });
  assert.equal((await repository.read(f.scope)).outcome, "error");
});
