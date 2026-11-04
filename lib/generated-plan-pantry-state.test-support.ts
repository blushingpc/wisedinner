// Synthetic evidence only. No real ingredient conversion or market adoption.
import { setup } from "./generated-joined-plan.test-support.ts";
export function pantryFixture() {
  const f = setup();
  const pantryIntake = { measureFacts: [{ id: "cup-fixture", ingredientId: "owned-food-a", preparedState: "raw", baseUnit: "g", fromUnit: "cup", factor: { numerator: "120", denominator: "1" }, sourceSha256: "a".repeat(64), basis: { kind: "volume", convention: "Synthetic120g cup" } }], purchaseBindings: [{ id: "owned-a", ingredientId: "owned-food-a", preparedState: "raw", baseUnit: "g", skuId: "buy-a", formDigest: "d".repeat(64), sourceSha256: "b".repeat(64) }] };
  const entries = [{ pantryId: "container-one", kind: "known", ingredientId: "owned-food-a", preparedState: "raw", baseUnit: "g", amount: { numerator: "1", denominator: "2" }, unit: "cup" }];
  return { ...f, configuration: { ...f.configuration, pantryIntake }, entries };
}
