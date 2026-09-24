import assert from "node:assert/strict";
import { test } from "node:test";
import { FOOTER, pricingFacts, systemPrompt } from "../kb.ts";
import { site } from "../../../content/site.ts";

test("the system prompt carries the FAQ, the pricing facts from content/site.ts, the legal digests and the tone guide", () => {
  const p = systemPrompt();
  assert.ok(p.includes("What is WiseDinner?"));
  for (const t of site.pricing.tiers) assert.ok(p.includes(t.name) && p.includes(`$${t.monthly}`), t.name);
  assert.ok(p.includes("Terms of service"));
  assert.ok(p.includes("Privacy policy"));
  assert.ok(p.includes("Never promise a date"));
  assert.ok(p.includes("Escalate"));
});

test("pricing facts read the tiers, not hardcoded numbers", () => {
  const f = pricingFacts();
  assert.ok(f.includes(site.pricing.intro));
  assert.ok(f.includes(site.pricing.trial));
});

test("the footer is the one the spec asks for", () => {
  assert.equal(FOOTER, "Reply to this email to reach a person.");
});
