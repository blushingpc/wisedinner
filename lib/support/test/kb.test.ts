import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { DIGEST_REVIEWED } from "../../../content/support-kb.ts";
import { PRIVACY_EFFECTIVE, PURCHASES, SUBSCRIPTIONS, TERMS_EFFECTIVE } from "../../../content/legal.ts";
import { FOOTER, pricingFacts, systemPrompt } from "../kb.ts";
import { site } from "../../../content/site.ts";

test("the support prompt carries current account/trial scope and exact source prices",()=>{
 const p=systemPrompt();
 assert.ok(p.includes("fourteen-day")&&p.includes("Rerolls are included")&&p.includes("Apple, Google or email"));
 assert.ok(p.includes("$8.99")&&p.includes("$48.00"));
 assert.ok(p.includes("Terms of service")&&p.includes("Privacy policy")&&p.includes("Never promise a date")&&p.includes("Escalate"));
});

test("pricing facts read the tiers, not hardcoded numbers", () => {
  const f = pricingFacts();
  assert.ok(f.includes(site.pricing.intro));
  assert.ok(f.includes(site.pricing.trial));
});

test("the footer is the one the spec asks for", () => {
  assert.equal(FOOTER, "Reply to this email to reach a person.");
});

// drift guards (2026-09-26): the bot quotes the same text the site renders, and a page edit fails here until the
// hand-kept digest has been re-read against it.
const src = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const sha = (f: string) => createHash("sha256").update(src(f)).digest("hex");

test("old website legal/FAQ references cannot become app launch facts",()=>{
 const p=systemPrompt();
 for(const s of [PURCHASES,SUBSCRIPTIONS,`effective ${PRIVACY_EFFECTIVE}`,`effective ${TERMS_EFFECTIVE}`])assert.ok(p.includes(s));
 assert.ok(p.includes("not the app's new policy")&&p.includes("store determines eligibility"));
 assert.ok(!p.includes("The pre-order build is free and complete"));
});

test("the prompt carries the two never rules: no refund promises, Courier never available now", () => {
  const p = systemPrompt();
  assert.ok(p.includes("reportaproblem.apple.com"));
  assert.ok(p.includes("Never say Courier is available now"));
});

test("the pages render the shared constants, not their own copies", () => {
  const privacy = src("app/privacy/page.tsx");
  const terms = src("app/terms/page.tsx");
  assert.ok(privacy.includes("<p>{PURCHASES}</p>") && privacy.includes("effective={PRIVACY_EFFECTIVE}") && privacy.includes("Effective: {PRIVACY_EFFECTIVE}"));
  assert.ok(terms.includes("<p>{SUBSCRIPTIONS}</p>") && terms.includes("effective={TERMS_EFFECTIVE}") && terms.includes("Effective: {TERMS_EFFECTIVE}"));
  for (const [name, s] of [["privacy", privacy], ["terms", terms]]) assert.ok(!/\b20\d\d\b/.test(s), `${name} page hardcodes a year; use content/legal.ts`);
  assert.ok(src("app/pricing/page.tsx").includes("sub={site.pricing.pageIntro}"));
});

test("the legal digests were re-read against the current pages", () => {
  const now = { privacy: sha("app/privacy/page.tsx"), terms: sha("app/terms/page.tsx") };
  for (const k of ["privacy", "terms"] as const) {
    assert.equal(now[k], DIGEST_REVIEWED[k], `app/${k}/page.tsx changed: re-read ${k === "privacy" ? "PRIVACY_DIGEST" : "TERMS_DIGEST"} in content/support-kb.ts against it, then set DIGEST_REVIEWED.${k} to ${now[k]}`);
  }
});
