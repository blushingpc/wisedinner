import assert from "node:assert/strict";
import { test } from "node:test";
import { policyProblems } from "../policy.ts";

test("refund: pointing to Apple without a promise passes", () => {
  assert.deepEqual(policyProblems("Apple handles refunds. You can request one at reportaproblem.apple.com.\n\nWiseDinner support"), []);
  assert.deepEqual(policyProblems("We can't issue a refund ourselves; Apple handles it at reportaproblem.apple.com."), []);
});

test("refund: a promise escalates, and so does a refund mention without the Apple link", () => {
  assert.ok(policyProblems("We will refund you in full. See reportaproblem.apple.com.").some((p) => p.startsWith("refund promise")));
  assert.ok(policyProblems("You'll get a full refund within a week.").some((p) => p.startsWith("refund promise")));
  assert.ok(policyProblems("Your refund is guaranteed, reportaproblem.apple.com").some((p) => p.startsWith("refund promise")));
  assert.deepEqual(policyProblems("Refunds go through Apple."), ["mentions a refund without pointing to reportaproblem.apple.com"]);
});

test("Courier: after release passes; available now escalates", () => {
  assert.deepEqual(policyProblems("Courier arrives in an update after release, so it cannot be bought yet."), []);
  assert.deepEqual(policyProblems("Courier is not available now. It arrives in an update after release."), []);
  assert.ok(policyProblems("Courier is available now in the app. It arrives after release too.").some((p) => p.startsWith("says Courier is available now")));
  assert.ok(policyProblems("You can buy Courier today for $12.99 a month, after release pricing applies.").some((p) => p.startsWith("says Courier is available now")));
  assert.deepEqual(policyProblems("Courier is $12.99 a month."), ["names Courier without saying it arrives after release"]);
});

test("a reply that names neither passes untouched", () => {
  assert.deepEqual(policyProblems("Protein Plan is $8.99 a month or $48 a year.\n\nWiseDinner support"), []);
});
