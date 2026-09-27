import { ABOUT, FAQ, SITE, SUPPORT_EMAIL } from "../../app/copy.ts";
import { site } from "../../content/site.ts";
import { PRIVACY_DIGEST, PRODUCT_FACTS, TERMS_DIGEST, TONE_GUIDE } from "../../content/support-kb.ts";

// the assistant's system prompt: stable text first (cacheable), built from the same sources the site renders.
// pricing comes from content/site.ts and nowhere else (pricing honesty law).
export const FOOTER = "Reply to this email to reach a person.";
export const SIGN_OFF = "WiseDinner support";

// closings the model tends to write on its own last lines: the sign-off, a thanks or regards line, a team name, the
// footer itself. only trailing lines are stripped, so "thanks" inside the body is untouched.
const CLOSING = /^(?:[-\s]*)(?:(?:best|kind|warm)?\s*regards|best(?: wishes)?|all the best|thanks(?: again)?|thank you|cheers|sincerely|(?:the\s+)?wisedinner(?:\s+support)?(?:\s+team)?|reply to this email to reach a person)[\s,.]*$/i;

// every sent reply: the model's body with any closing it wrote removed, then exactly the sign-off and the footer, so
// neither ever shows up twice.
export function withSignOff(reply: string): string {
  const lines = reply.replace(/\r\n/g, "\n").trimEnd().split("\n");
  while (lines.length && (!lines[lines.length - 1].trim() || CLOSING.test(lines[lines.length - 1].trim()))) lines.pop();
  return `${lines.join("\n").trimEnd()}\n\n${SIGN_OFF}\n${FOOTER}`;
}

const usd = (n: number) => "$" + n.toFixed(2).replace(/\.00$/, "");

export function pricingFacts(): string {
  const tiers = site.pricing.tiers.map((t) => `${t.name}: ${usd(t.monthly)} a month or ${usd(t.yearly)} a year. ${t.note ? t.note + " " : ""}${t.lead} ${t.rows.join(". ")}.`);
  return `Pricing facts:\n- ${site.pricing.pageIntro}\n- ${site.pricing.intro}\n- ${site.pricing.trial}\n- ${tiers.join("\n- ")}`;
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
    `Reply format when you do answer: the body only, no subject line, no greeting name guesses, no sign-off and no signature: the mailer adds "WiseDinner support" and the footer to every reply. Keep it under 120 words.`,
  ].join("\n\n");
}
