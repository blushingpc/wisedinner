import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { FAQ } from "../../../app/copy.ts";
import { DIGEST_REVIEWED } from "../../../content/support-kb.ts";
import { PRIVACY_EFFECTIVE, PURCHASES, SUBSCRIPTIONS, TERMS_EFFECTIVE } from "../../../content/legal.ts";
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

// drift guards (2026-09-26): the bot quotes the same text the site renders, and a page edit fails here until the
// hand-kept digest has been re-read against it.
const src = (f: string) => readFileSync(f, "utf8").replace(/\r\n/g, "\n");
const sha = (f: string) => createHash("sha256").update(src(f)).digest("hex");
const usd = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

test("the prompt quotes the live legal text, prices, FAQ answers and pricing intro verbatim", () => {
  const p = systemPrompt();
  for (const s of [PURCHASES, SUBSCRIPTIONS, `effective ${PRIVACY_EFFECTIVE}`, `effective ${TERMS_EFFECTIVE}`, site.pricing.pageIntro]) assert.ok(p.includes(s), s.slice(0, 60));
  for (const t of site.pricing.tiers) {
    assert.ok(p.includes(`${t.name}: ${usd(t.monthly)} a month or ${usd(t.yearly)} a year.`), t.name);
    assert.ok(p.includes(t.lead), `${t.name} lead`);
    for (const r of t.rows) assert.ok(p.includes(r), r);
    if (t.note) assert.ok(p.includes(t.note), `${t.name} note`);
  }
  for (const f of FAQ) assert.ok(p.includes(f.a), f.q);
  for (const stale of ["September 9, 2026", "planned for you every Sunday", "collects no data"]) assert.ok(!p.includes(stale), stale);
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
