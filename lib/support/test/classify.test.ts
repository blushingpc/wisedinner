import assert from "node:assert/strict";
import { test } from "node:test";
import { parseTriage } from "../classify.ts";

test("triage parse: leaked tool markup in any field escalates, never sends", () => {
  // the shape Haiku 4.5 produced under forced tool use (2026-09-12): the draft landed in reason behind parameter markup
  const leaked = JSON.stringify({ intent: "informational", category: "pricing", reason: '</antml parameter>\n<parameter name="reply">The pre-order build is free.', reply: "</antml>\n" });
  const t = parseTriage(leaked);
  assert.equal(t.intent, "escalate");
  assert.equal(t.reply, "");
  assert.match(t.reason, /^malformed triage/);
});

test("triage parse: non-JSON, a wrong shape or an empty informational reply escalates", () => {
  assert.match(parseTriage("The pre-order build is free.").reason, /not JSON/);
  assert.match(parseTriage(JSON.stringify({ intent: "maybe", category: "pricing", reason: "", reply: "Hi" })).reason, /wrong shape/);
  assert.equal(parseTriage(JSON.stringify({ intent: "informational", category: "pricing", reason: "answered", reply: "  " })).intent, "escalate");
  const contradictory = parseTriage(JSON.stringify({ intent: "informational", category: "refund", reply: "We will refund you.", reason: "answered" }));
  assert.deepEqual({ intent: contradictory.intent, reply: contradictory.reply }, { intent: "escalate", reply: "" }, "an informational verdict on a refund is not confident");
});

test("triage parse: a clean informational verdict passes; an escalation drops any reply", () => {
  const ok = parseTriage(JSON.stringify({ intent: "informational", category: "pricing", reply: "The pre-order build is free.\n\nWiseDinner support", reason: "answered pricing" }));
  assert.equal(ok.intent, "informational");
  assert.equal(ok.reply, "The pre-order build is free.\n\nWiseDinner support");
  const esc = parseTriage(JSON.stringify({ intent: "escalate", category: "refund", reply: "sorry", reason: "refunds need a person" }));
  assert.deepEqual(esc, { intent: "escalate", category: "refund", reply: "", reason: "refunds need a person" });
});
