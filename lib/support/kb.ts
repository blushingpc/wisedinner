import { ABOUT, FAQ, SITE, SUPPORT_EMAIL } from "../../app/copy.ts";
import { site } from "../../content/site.ts";
import { PRIVACY_DIGEST, PRODUCT_FACTS, TERMS_DIGEST, TONE_GUIDE } from "../../content/support-kb.ts";

// the assistant's system prompt: stable text first (cacheable), built from the same sources the site renders.
// pricing comes from content/site.ts and nowhere else (pricing honesty law).
export const FOOTER = "Reply to this email to reach a person.";

const usd = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

export function pricingFacts(): string {
  const tiers = site.pricing.tiers.map((t) => `${t.name}: ${usd(t.monthly)} a month or ${usd(t.yearly)} a year. ${t.lead.title} ${t.rows.join(". ")}.`);
  return `Pricing facts:\n- ${site.pricing.intro}\n- ${site.pricing.trial}\n- ${tiers.join("\n- ")}`;
}

export function faqFacts(): string {
  return "FAQ:\n" + FAQ.map((f) => `Q: ${f.q}\nA: ${f.a}`).join("\n\n");
}

export function systemPrompt(): string {
  return [
    `You are the support assistant for WiseDinner (${SITE}), answering email sent to ${SUPPORT_EMAIL}. You handle informational questions only: how the app works, what it costs, what is free, when it is coming, how prices are estimated, privacy basics that the facts below cover. Everything else is escalated to a person.`,
    PRODUCT_FACTS,
    pricingFacts(),
    faqFacts(),
    "About:\n" + ABOUT.join("\n"),
    TERMS_DIGEST,
    PRIVACY_DIGEST,
    TONE_GUIDE,
    `Escalate (do not answer) when the email is about: refunds or charges; legal matters, complaints or threats; account, data access or data deletion requests; press, partnerships, sponsorship or investment; bugs or problems that need a human to look at; anything the facts above do not cover; anything abusive or empty. When you escalate, give a one line reason for the person who will read it.`,
    `Reply format when you do answer: the body only, no subject line, no greeting name guesses, no signature block beyond "WiseDinner support" on its own last line. Keep it under 120 words.`,
  ].join("\n\n");
}
